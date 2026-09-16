# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }

import genlayer as gl
from genlayer.types import *

import json
import typing

# External GEN transfer to a wallet (EOA). Do not use gl.get_contract_at(eoa):
# that is an internal IC message and shows as OUT (construct...) + GENVM ERROR
# on Studio explorer. Official pattern: EVM interface + emit_transfer.
@gl.evm.contract_interface
class _Recipient:
    class View:
        pass

    class Write:
        pass


BASIS_POINTS_TOTAL = 10000

STATUS_PENDING = "PENDING"
STATUS_DISPUTED = "DISPUTED"
STATUS_RESOLVED = "RESOLVED"
STATUS_SETTLED = "SETTLED"
STATUS_PAYOUT_FAILED = "PAYOUT_FAILED"


def _err(msg: str):
    raise gl.vm.UserError(msg)


def _addr_str(a) -> str:
    try:
        return a.as_hex.lower()
    except Exception:
        s = str(a).lower()
        if not s.startswith("0x") and len(s) == 40:
            return "0x" + s
        return s


def _to_address(val) -> Address:
    if isinstance(val, Address):
        return val
    if isinstance(val, bytes):
        return Address("0x" + val.hex())
    if isinstance(val, str):
        val_str = val.strip()
        if not val_str.startswith("0x"):
            val_str = "0x" + val_str
        return Address(val_str)
    if hasattr(val, "as_hex"):
        return val
    return Address(val)


def _same_addr(a, b) -> bool:
    return _addr_str(a) == _addr_str(b)


def _as_int(val) -> int:
    try:
        return int(val)
    except Exception:
        return int(str(val))


def _loads(raw: str) -> dict:
    try:
        data = json.loads(raw)
    except Exception:
        _err("corrupt stored json")
    if not isinstance(data, dict):
        _err("corrupt stored json")
    return data


def _member_list(raw) -> list:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(x).strip() for x in raw if str(x).strip()]
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return []
        try:
            if text.startswith("["):
                parsed = json.loads(text)
                if isinstance(parsed, list):
                    return [str(x).strip() for x in parsed if str(x).strip()]
            return [part.strip() for part in text.split(",") if part.strip()]
        except Exception:
            _err("member_addresses must be a JSON array of addresses")
    n = 0
    try:
        n = len(raw)
    except Exception:
        return []
    out = []
    for i in range(n):
        item = str(raw[i]).strip()
        if item:
            out.append(item)
    return out


def _strip_code_fence(raw: str) -> str:
    cleaned = str(raw).strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if len(lines) >= 2 and lines[0].startswith("```"):
            lines = lines[1:]
        if len(lines) >= 1 and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    return cleaned


def _parse_verdict(raw, valid_ids: list) -> dict:
    if isinstance(raw, dict):
        data = raw
    else:
        cleaned = _strip_code_fence(raw)
        if cleaned in valid_ids:
            return {"winning_proposal_id": cleaned, "reason": ""}
        try:
            data = json.loads(cleaned)
        except Exception as e:
            _err("Invalid JSON returned by AI adjudicator: " + str(e))

    if not isinstance(data, dict):
        _err("AI verdict response must be a JSON object")

    wid = ""
    if "winning_proposal_id" in data:
        wid = str(data["winning_proposal_id"]).strip()
    elif "id" in data:
        wid = str(data["id"]).strip()
    if wid not in valid_ids:
        _err("verdict returned an unknown proposal id: " + wid)

    return {
        "winning_proposal_id": wid,
        "reason": str(data.get("reason", "")),
    }


class SplitVerdict(gl.contract.Contract):
    owner: Address
    group_counter: u256
    expense_counter: u256
    proposal_counter: u256
    groups: gl.storage.TreeMap[str, str]
    expenses: gl.storage.TreeMap[str, str]
    proposals: gl.storage.TreeMap[str, str]
    deposits: gl.storage.TreeMap[str, u256]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.group_counter = 0
        self.expense_counter = 0
        self.proposal_counter = 0

    def _require_group(self, group_id: str) -> dict:
        if group_id not in self.groups:
            _err("unknown group")
        return _loads(self.groups[group_id])

    def _require_expense(self, expense_id: str) -> dict:
        if expense_id not in self.expenses:
            _err("unknown expense")
        return _loads(self.expenses[expense_id])

    def _require_proposal(self, proposal_id: str) -> dict:
        if proposal_id not in self.proposals:
            _err("unknown proposal")
        return _loads(self.proposals[proposal_id])

    def _save_group(self, group_id: str, group: dict) -> None:
        self.groups[group_id] = json.dumps(group)

    def _save_expense(self, expense_id: str, expense: dict) -> None:
        self.expenses[expense_id] = json.dumps(expense)

    def _save_proposal(self, proposal_id: str, proposal: dict) -> None:
        self.proposals[proposal_id] = json.dumps(proposal)

    def _is_member(self, group: dict, addr) -> bool:
        target = _addr_str(addr)
        for item in group.get("members", []):
            if _addr_str(item) == target:
                return True
        return False

    def _require_member(self, group: dict, addr) -> None:
        if not self._is_member(group, addr):
            _err("sender is not a member of this group")

    def _deposit_key(self, expense_id: str, member) -> str:
        return expense_id + ":" + _addr_str(member)

    def _get_deposit(self, expense_id: str, member) -> int:
        key = self._deposit_key(expense_id, member)
        if key in self.deposits:
            return _as_int(self.deposits[key])
        return 0

    def _shares_map(self, proposal: dict) -> dict:
        raw = proposal.get("shares", {})
        if not isinstance(raw, dict):
            return {}
        out = {}
        for addr_raw, bps_raw in raw.items():
            out[_addr_str(addr_raw)] = _as_int(bps_raw)
        return out

    def _parse_shares(self, shares_json: str, group: dict) -> dict:
        try:
            data = json.loads(shares_json)
        except Exception:
            _err("shares_json must be a JSON object {address: basis_points}")
        if not isinstance(data, dict):
            _err("shares_json must be a JSON object {address: basis_points}")

        group_set = {}
        for hex_a in group.get("members", []):
            group_set[_addr_str(hex_a)] = True

        shares = {}
        total = 0
        for addr_raw, bps_raw in data.items():
            hex_a = _addr_str(_to_address(str(addr_raw)))
            if hex_a in shares:
                _err("duplicate share member: " + hex_a)
            if hex_a not in group_set:
                _err("share member is not in the group: " + hex_a)
            try:
                bps = int(bps_raw)
            except Exception:
                _err("basis points must be an integer, no floats")
            if bps < 0:
                _err("basis points cannot be negative")
            shares[hex_a] = bps
            total += bps

        if len(shares) == 0:
            _err("shares cannot be empty")
        if total != BASIS_POINTS_TOTAL:
            _err(
                "shares must sum to exactly "
                + str(BASIS_POINTS_TOTAL)
                + " basis points, got "
                + str(total)
            )
        return shares

    def _compute_owed(self, expense: dict, proposal: dict, member) -> int:
        bps = self._shares_map(proposal).get(_addr_str(member), 0)
        return (_as_int(expense["total_amount"]) * bps) // BASIS_POINTS_TOTAL

    def _winning_or_latest(self, expense: dict) -> dict:
        if expense.get("winning_proposal_id"):
            return self._require_proposal(str(expense["winning_proposal_id"]))
        ids = list(expense.get("proposal_ids", []))
        if len(ids) == 0:
            _err("no proposal to read")
        return self._require_proposal(str(ids[len(ids) - 1]))

    def _collectable(self, expense: dict, proposal: dict) -> int:
        total = 0
        payer = expense["payer"]
        for hex_a in self._shares_map(proposal):
            if _same_addr(hex_a, payer):
                continue
            total += self._compute_owed(expense, proposal, hex_a)
        return total

    def _try_transfer(self, recipient, amount: int) -> None:
        if amount <= 0:
            return
        v = _as_int(amount)
        _Recipient(Address(_addr_str(recipient))).emit_transfer(value=v)

    def _submit_proposal(self, expense_id: str, proposer, shares_json: str, evidence_text: str) -> str:
        expense = self._require_expense(expense_id)
        group = self._require_group(str(expense["group_id"]))
        shares = self._parse_shares(shares_json, group)

        proposal_id = str(_as_int(self.proposal_counter))
        self.proposal_counter = _as_int(self.proposal_counter) + 1
        self._save_proposal(
            proposal_id,
            {
                "expense_id": expense_id,
                "proposer": _addr_str(proposer),
                "evidence_text": str(evidence_text),
                "shares": shares,
            },
        )

        ids = list(expense.get("proposal_ids", []))
        ids.append(proposal_id)
        expense["proposal_ids"] = ids
        self._save_expense(expense_id, expense)
        return proposal_id

    def _proposal_dict(self, proposal_id: str, proposal: dict) -> dict:
        return {
            "id": proposal_id,
            "expense_id": proposal["expense_id"],
            "proposer": _addr_str(proposal["proposer"]),
            "evidence_text": proposal.get("evidence_text", ""),
            "shares": self._shares_map(proposal),
        }

    def _expense_dict(self, expense_id: str, expense: dict, full: bool) -> dict:
        group = self._require_group(str(expense["group_id"]))
        ids = [str(x) for x in expense.get("proposal_ids", [])]
        latest_id = ids[len(ids) - 1] if len(ids) > 0 else ""
        row = {
            "expense_id": expense_id,
            "group_id": expense["group_id"],
            "group_name": group["name"],
            "payer": _addr_str(expense["payer"]),
            "total_amount": str(_as_int(expense["total_amount"])),
            "description": expense["description"],
            "status": expense["status"],
            "winning_proposal_id": expense.get("winning_proposal_id", ""),
            "latest_proposal_id": latest_id,
            "verdict_reason": expense.get("verdict_reason", ""),
            "settled": bool(expense.get("settled", False)),
            "proposal_ids": ids,
        }
        if full:
            deposits = {}
            owed = {}
            payout = "0"
            shares = {}
            current = None
            if expense.get("winning_proposal_id"):
                current = self._require_proposal(str(expense["winning_proposal_id"]))
            elif latest_id:
                current = self._require_proposal(latest_id)
            if current is not None:
                shares = self._shares_map(current)
                for member in group.get("members", []):
                    hex_a = _addr_str(member)
                    owed[hex_a] = str(self._compute_owed(expense, current, member))
                    deposits[hex_a] = str(self._get_deposit(expense_id, member))
                payout = str(self._collectable(expense, current))
            row["members"] = [_addr_str(x) for x in group.get("members", [])]
            row["shares"] = shares
            row["deposits"] = deposits
            row["owed"] = owed
            row["payout_amount"] = payout
            row["proposals"] = [self._proposal_dict(pid, self._require_proposal(pid)) for pid in ids]
        return row

    def _group_dict(self, group_id: str, group: dict) -> dict:
        return {
            "group_id": group_id,
            "name": group["name"],
            "creator": _addr_str(group["creator"]),
            "members": [_addr_str(x) for x in group.get("members", [])],
        }

    def _pay_payer(self, expense_id: str, expense: dict) -> None:
        if not expense.get("winning_proposal_id"):
            _err("no winning proposal set")
        proposal = self._require_proposal(str(expense["winning_proposal_id"]))
        for hex_a in self._shares_map(proposal):
            if _same_addr(hex_a, expense["payer"]):
                continue
            owed = self._compute_owed(expense, proposal, hex_a)
            deposited = self._get_deposit(expense_id, hex_a)
            if deposited < owed:
                _err("member " + _addr_str(hex_a) + " has not fully paid their share")

        payout = self._collectable(expense, proposal)
        try:
            self._try_transfer(expense["payer"], payout)
            expense["settled"] = True
            expense["status"] = STATUS_SETTLED
        except Exception as e:
            expense["settled"] = False
            expense["status"] = STATUS_PAYOUT_FAILED
            expense["verdict_reason"] = str(expense.get("verdict_reason", "")) + " (Payout failed: " + str(e) + ")"
        self._save_expense(expense_id, expense)

    @gl.public.write
    def create_group(self, name: str, member_addresses: str) -> str:
        cleaned_name = str(name).strip()
        if not cleaned_name:
            _err("group name cannot be empty")
        if len(cleaned_name) > 120:
            _err("group name cannot exceed 120 characters")

        creator = gl.message.sender_address
        unique = []
        seen = {}
        creator_hex = _addr_str(creator)
        unique.append(creator_hex)
        seen[creator_hex] = True

        for raw in _member_list(member_addresses):
            hex_a = _addr_str(_to_address(raw))
            if hex_a in seen:
                continue
            seen[hex_a] = True
            unique.append(hex_a)

        if len(unique) < 2:
            _err("a group needs at least 2 members")

        group_id = str(_as_int(self.group_counter))
        self.group_counter = _as_int(self.group_counter) + 1
        self._save_group(
            group_id,
            {
                "name": cleaned_name,
                "creator": creator_hex,
                "members": unique,
            },
        )
        return group_id

    @gl.public.write
    def create_expense(
        self,
        group_id: str,
        total_amount: str,
        description: str,
        shares_json: str,
    ) -> str:
        group = self._require_group(group_id)
        payer = gl.message.sender_address
        self._require_member(group, payer)

        amount = _as_int(total_amount)
        if amount <= 0:
            _err("total_amount must be greater than 0")

        desc = str(description).strip()
        if not desc:
            _err("description cannot be empty")
        if len(desc) > 2000:
            _err("description cannot exceed 2000 characters")

        expense_id = str(_as_int(self.expense_counter))
        self.expense_counter = _as_int(self.expense_counter) + 1
        self._save_expense(
            expense_id,
            {
                "group_id": group_id,
                "payer": _addr_str(payer),
                "total_amount": str(amount),
                "description": desc,
                "status": STATUS_PENDING,
                "winning_proposal_id": "",
                "proposal_ids": [],
                "verdict_reason": "",
                "settled": False,
            },
        )
        self._submit_proposal(expense_id, payer, shares_json, "initial proposal by payer")
        return expense_id

    @gl.public.write
    def accept_split(self, expense_id: str) -> None:
        expense = self._require_expense(expense_id)
        if expense["status"] not in (STATUS_PENDING, STATUS_DISPUTED):
            _err("expense not open")
        group = self._require_group(str(expense["group_id"]))
        self._require_member(group, gl.message.sender_address)

        ids = list(expense.get("proposal_ids", []))
        if len(ids) == 0:
            _err("no proposal to accept")
        latest_id = str(ids[len(ids) - 1])
        expense["status"] = STATUS_RESOLVED
        expense["winning_proposal_id"] = latest_id
        expense["verdict_reason"] = "Accepted by " + _addr_str(gl.message.sender_address)
        self._save_expense(expense_id, expense)

    @gl.public.write
    def dispute_split(self, expense_id: str, shares_json: str, evidence_text: str) -> None:
        expense = self._require_expense(expense_id)
        if expense["status"] not in (STATUS_PENDING, STATUS_DISPUTED):
            _err("expense not open for dispute")
        group = self._require_group(str(expense["group_id"]))
        proposer = gl.message.sender_address
        self._require_member(group, proposer)

        note = str(evidence_text).strip()
        if not note:
            _err("evidence_text cannot be empty")
        if len(note) > 4000:
            _err("evidence_text cannot exceed 4000 characters")

        expense["status"] = STATUS_DISPUTED
        self._save_expense(expense_id, expense)
        self._submit_proposal(expense_id, proposer, shares_json, note)

    @gl.public.write
    def resolve_dispute(self, expense_id: str) -> typing.Any:
        expense = self._require_expense(expense_id)
        if expense["status"] != STATUS_DISPUTED:
            raise gl.vm.UserError("expense is not disputed")

        ids = [str(x) for x in expense.get("proposal_ids", [])]
        if len(ids) < 2:
            raise gl.vm.UserError("need at least 2 competing proposals to arbitrate")

        snapshot = []
        for pid in ids:
            snapshot.append(self._proposal_dict(pid, self._require_proposal(pid)))
        description = str(expense["description"])
        total_amount = str(_as_int(expense["total_amount"]))
        valid_ids = list(ids)

        def get_verdict() -> typing.Any:
            task = f"""
You are arbitrating a group expense dispute.
Expense description: {description}
Total amount (base units): {total_amount}

Competing split proposals (JSON):
{json.dumps(snapshot)}
End of proposals.

Each proposal's "shares" maps a member address to a basis-point share (out of 10000).
Decide which single proposal is the FAIREST and most consistent with the evidence.

Respond with the following JSON format:
{{
    "winning_proposal_id": str, // must be one of {json.dumps(valid_ids)}
    "reason": str
}}
It is mandatory that you respond only using the JSON format above,
nothing else. Don't include any other words or characters,
your output must be only JSON without any formatting prefix or suffix.
This result should be perfectly parsable by a JSON parser without errors.
            """
            result = (
                gl.nondet.exec_prompt(task).replace("```json", "").replace("```", "")
            )
            parsed = _parse_verdict(result, valid_ids)
            return {
                "winning_proposal_id": parsed["winning_proposal_id"],
            }

        result_json = gl.eq_principle.strict_eq(get_verdict)
        winning_id = str(result_json["winning_proposal_id"]).strip()
        if winning_id not in valid_ids:
            raise gl.vm.UserError("consensus returned an unknown proposal id")

        expense["status"] = STATUS_RESOLVED
        expense["winning_proposal_id"] = winning_id
        expense["verdict_reason"] = "AI consensus chose proposal " + winning_id
        self._save_expense(expense_id, expense)
        return result_json

    @gl.public.write.payable
    def deposit_share(self, expense_id: str) -> None:
        expense = self._require_expense(expense_id)
        if expense["status"] != STATUS_RESOLVED:
            _err("expense not resolved yet")
        if expense.get("settled"):
            _err("expense already settled")

        group = self._require_group(str(expense["group_id"]))
        payer_address = gl.message.sender_address
        self._require_member(group, payer_address)
        if _same_addr(payer_address, expense["payer"]):
            _err("the original payer does not deposit against themself")

        amount_sent = _as_int(gl.message.value)
        if amount_sent <= 0:
            _err("Must send GEN as the share deposit (amount must be > 0)")

        winning = self._require_proposal(str(expense["winning_proposal_id"]))
        owed = self._compute_owed(expense, winning, payer_address)
        if owed <= 0:
            _err("this member owes nothing on this expense")

        already = self._get_deposit(expense_id, payer_address)
        if already + amount_sent > owed:
            _err("overpayment not allowed, deposit exact remaining share")

        self.deposits[self._deposit_key(expense_id, payer_address)] = already + amount_sent

    @gl.public.write
    def settle(self, expense_id: str) -> None:
        expense = self._require_expense(expense_id)
        if expense["status"] != STATUS_RESOLVED:
            _err("expense not resolved")
        if expense.get("settled"):
            _err("expense already settled")
        self._pay_payer(expense_id, expense)

    @gl.public.write
    def retry_settlement(self, expense_id: str) -> None:
        expense = self._require_expense(expense_id)
        if expense["status"] != STATUS_PAYOUT_FAILED:
            _err("can only retry PAYOUT_FAILED expenses")
        if expense.get("settled"):
            _err("expense already settled")
        self._pay_payer(expense_id, expense)

    @gl.public.view
    def get_group(self, group_id: str) -> str:
        group = self._require_group(group_id)
        return json.dumps(self._group_dict(group_id, group))

    @gl.public.view
    def list_groups(self) -> str:
        results = []
        n = _as_int(self.group_counter)
        for i in range(n):
            gid = str(i)
            if gid in self.groups:
                results.append(self._group_dict(gid, _loads(self.groups[gid])))
        return json.dumps(results)

    @gl.public.view
    def get_expense(self, expense_id: str) -> str:
        expense = self._require_expense(expense_id)
        return json.dumps(self._expense_dict(expense_id, expense, True))

    @gl.public.view
    def list_expenses(self, group_id: str) -> str:
        results = []
        n = _as_int(self.expense_counter)
        for i in range(n):
            eid = str(i)
            if eid in self.expenses:
                expense = _loads(self.expenses[eid])
                if group_id == "" or expense["group_id"] == group_id:
                    results.append(self._expense_dict(eid, expense, False))
        return json.dumps(results)

    @gl.public.view
    def get_proposals(self, expense_id: str) -> str:
        expense = self._require_expense(expense_id)
        rows = []
        for pid in expense.get("proposal_ids", []):
            rows.append(self._proposal_dict(str(pid), self._require_proposal(str(pid))))
        return json.dumps(rows)

    @gl.public.view
    def get_owed_amount(self, expense_id: str, member_address: str) -> str:
        expense = self._require_expense(expense_id)
        proposal = self._winning_or_latest(expense)
        owed = self._compute_owed(expense, proposal, _to_address(member_address))
        return str(owed)

    @gl.public.view
    def get_deposit_status(self, expense_id: str) -> str:
        expense = self._require_expense(expense_id)
        group = self._require_group(str(expense["group_id"]))
        out = {}
        for member in group.get("members", []):
            out[_addr_str(member)] = str(self._get_deposit(expense_id, member))
        return json.dumps(out)

    @gl.public.view
    def get_group_count(self) -> str:
        return str(_as_int(self.group_counter))

    @gl.public.view
    def get_expense_count(self) -> str:
        return str(_as_int(self.expense_counter))

    @gl.public.view
    def get_owner(self) -> str:
        return _addr_str(self.owner)

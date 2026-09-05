# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import json

UserError = gl.vm.UserError

BASIS_POINTS_TOTAL = 10000

STATUS_PENDING = "PENDING"
STATUS_DISPUTED = "DISPUTED"
STATUS_RESOLVED = "RESOLVED"
STATUS_SETTLED = "SETTLED"
STATUS_PAYOUT_FAILED = "PAYOUT_FAILED"


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


def _empty_addrs():
    try:
        return DynArray[Address]()
    except Exception:
        return []


def _empty_ids():
    try:
        return DynArray[str]()
    except Exception:
        return []


def _empty_bps():
    try:
        return DynArray[u256]()
    except Exception:
        return []


def _iter_len(seq) -> int:
    try:
        return len(seq)
    except Exception:
        return 0


def _addr_list(seq) -> list:
    out = []
    n = _iter_len(seq)
    for i in range(n):
        out.append(_addr_str(seq[i]))
    return out


def _str_list(seq) -> list:
    out = []
    n = _iter_len(seq)
    for i in range(n):
        out.append(str(seq[i]))
    return out


def _leader_payload(leader_res):
    if hasattr(leader_res, "value") and isinstance(leader_res.value, dict):
        return leader_res.value
    if hasattr(leader_res, "calldata") and isinstance(leader_res.calldata, dict):
        return leader_res.calldata
    if isinstance(leader_res, dict):
        return leader_res
    return None


def _extract_result(result) -> dict:
    payload = _leader_payload(result)
    if payload is None:
        raise UserError("Invalid nondet consensus result")
    return payload


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
            raise UserError("Invalid JSON returned by AI adjudicator: " + str(e))

    if not isinstance(data, dict):
        raise UserError("AI verdict response must be a JSON object")

    wid = ""
    if "winning_proposal_id" in data:
        wid = str(data["winning_proposal_id"]).strip()
    elif "id" in data:
        wid = str(data["id"]).strip()
    if wid not in valid_ids:
        raise UserError("verdict returned an unknown proposal id: " + wid)

    return {
        "winning_proposal_id": wid,
        "reason": str(data.get("reason", "")),
    }


@allow_storage
@dataclass
class Group:
    name: str
    creator: Address
    members: DynArray[Address]


@allow_storage
@dataclass
class Expense:
    group_id: str
    payer: Address
    total_amount: bigint
    description: str
    status: str
    winning_proposal_id: str
    proposal_ids: DynArray[str]
    verdict_reason: str
    settled: bool


@allow_storage
@dataclass
class Proposal:
    expense_id: str
    proposer: Address
    evidence_text: str
    share_members: DynArray[Address]
    share_bps: DynArray[u256]


class Contract(gl.Contract):
    owner: Address
    group_counter: bigint
    expense_counter: bigint
    proposal_counter: bigint
    groups: TreeMap[str, Group]
    expenses: TreeMap[str, Expense]
    proposals: TreeMap[str, Proposal]
    deposits: TreeMap[str, bigint]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.group_counter = bigint(0)
        self.expense_counter = bigint(0)
        self.proposal_counter = bigint(0)

    def _require_group(self, group_id: str) -> Group:
        if group_id not in self.groups:
            raise UserError("unknown group")
        return self.groups[group_id]

    def _require_expense(self, expense_id: str) -> Expense:
        if expense_id not in self.expenses:
            raise UserError("unknown expense")
        return self.expenses[expense_id]

    def _require_proposal(self, proposal_id: str) -> Proposal:
        if proposal_id not in self.proposals:
            raise UserError("unknown proposal")
        return self.proposals[proposal_id]

    def _is_member(self, group: Group, addr) -> bool:
        n = _iter_len(group.members)
        for i in range(n):
            if _same_addr(group.members[i], addr):
                return True
        return False

    def _require_member(self, group: Group, addr) -> None:
        if not self._is_member(group, addr):
            raise UserError("sender is not a member of this group")

    def _deposit_key(self, expense_id: str, member) -> str:
        return expense_id + ":" + _addr_str(member)

    def _get_deposit(self, expense_id: str, member) -> bigint:
        key = self._deposit_key(expense_id, member)
        if key in self.deposits:
            return self.deposits[key]
        return bigint(0)

    def _shares_map(self, proposal: Proposal) -> dict:
        out = {}
        n = _iter_len(proposal.share_members)
        for i in range(n):
            out[_addr_str(proposal.share_members[i])] = int(proposal.share_bps[i])
        return out

    def _parse_shares(self, shares_json: str, group: Group):
        try:
            data = json.loads(shares_json)
        except Exception:
            raise UserError("shares_json must be a JSON object {address: basis_points}")
        if not isinstance(data, dict):
            raise UserError("shares_json must be a JSON object {address: basis_points}")

        members = []
        bps_list = []
        total = 0
        seen = {}
        group_set = {}
        for hex_a in _addr_list(group.members):
            group_set[hex_a] = True

        for addr_raw, bps_raw in data.items():
            addr = _to_address(str(addr_raw))
            hex_a = _addr_str(addr)
            if hex_a in seen:
                raise UserError("duplicate share member: " + hex_a)
            seen[hex_a] = True
            if hex_a not in group_set:
                raise UserError("share member is not in the group: " + hex_a)
            try:
                bps = int(bps_raw)
            except Exception:
                raise UserError("basis points must be an integer, no floats")
            if bps < 0:
                raise UserError("basis points cannot be negative")
            members.append(addr)
            bps_list.append(u256(bps))
            total += bps

        if len(members) == 0:
            raise UserError("shares cannot be empty")
        if total != BASIS_POINTS_TOTAL:
            raise UserError(
                "shares must sum to exactly "
                + str(BASIS_POINTS_TOTAL)
                + " basis points, got "
                + str(total)
            )
        return members, bps_list

    def _compute_owed(self, expense: Expense, proposal: Proposal, member) -> bigint:
        target = _addr_str(member)
        n = _iter_len(proposal.share_members)
        bps = 0
        for i in range(n):
            if _addr_str(proposal.share_members[i]) == target:
                bps = int(proposal.share_bps[i])
                break
        return (expense.total_amount * bigint(bps)) // bigint(BASIS_POINTS_TOTAL)

    def _winning_or_latest(self, expense: Expense) -> Proposal:
        if expense.winning_proposal_id:
            return self._require_proposal(expense.winning_proposal_id)
        ids = _str_list(expense.proposal_ids)
        if len(ids) == 0:
            raise UserError("no proposal to read")
        return self._require_proposal(ids[len(ids) - 1])

    def _collectable(self, expense: Expense, proposal: Proposal) -> bigint:
        """Sum of non-payer owed shares — the GEN the contract can actually pay out."""
        total = bigint(0)
        n = _iter_len(proposal.share_members)
        for i in range(n):
            member = proposal.share_members[i]
            if _same_addr(member, expense.payer):
                continue
            total = total + self._compute_owed(expense, proposal, member)
        return total

    def _try_transfer(self, recipient: Address, amount: bigint) -> None:
        if amount <= bigint(0):
            return
        gl.get_contract_at(recipient).emit_transfer(value=u256(amount))

    def _submit_proposal(self, expense_id: str, proposer, shares_json: str, evidence_text: str) -> str:
        expense = self._require_expense(expense_id)
        group = self._require_group(expense.group_id)
        members, bps_list = self._parse_shares(shares_json, group)

        proposal_id = str(self.proposal_counter)
        self.proposal_counter = self.proposal_counter + bigint(1)

        self.proposals[proposal_id] = Proposal(
            expense_id=expense_id,
            proposer=_to_address(proposer),
            evidence_text=str(evidence_text),
            share_members=members,
            share_bps=bps_list,
        )

        ids = _str_list(expense.proposal_ids)
        ids.append(proposal_id)
        expense.proposal_ids = ids
        self.expenses[expense_id] = expense
        return proposal_id

    def _proposal_dict(self, proposal_id: str, proposal: Proposal) -> dict:
        return {
            "id": proposal_id,
            "expense_id": proposal.expense_id,
            "proposer": _addr_str(proposal.proposer),
            "evidence_text": proposal.evidence_text,
            "shares": self._shares_map(proposal),
        }

    def _expense_dict(self, expense_id: str, expense: Expense, full: bool) -> dict:
        group = self._require_group(expense.group_id)
        ids = _str_list(expense.proposal_ids)
        latest_id = ids[len(ids) - 1] if len(ids) > 0 else ""
        row = {
            "expense_id": expense_id,
            "group_id": expense.group_id,
            "group_name": group.name,
            "payer": _addr_str(expense.payer),
            "total_amount": str(int(expense.total_amount)),
            "description": expense.description,
            "status": expense.status,
            "winning_proposal_id": expense.winning_proposal_id,
            "latest_proposal_id": latest_id,
            "verdict_reason": expense.verdict_reason,
            "settled": bool(expense.settled),
            "proposal_ids": ids,
        }
        if full:
            deposits = {}
            owed = {}
            payout = "0"
            shares = {}
            current = None
            if expense.winning_proposal_id:
                current = self._require_proposal(expense.winning_proposal_id)
            elif latest_id:
                current = self._require_proposal(latest_id)
            if current is not None:
                shares = self._shares_map(current)
                n = _iter_len(group.members)
                for i in range(n):
                    member = group.members[i]
                    hex_a = _addr_str(member)
                    owed[hex_a] = str(int(self._compute_owed(expense, current, member)))
                    deposits[hex_a] = str(int(self._get_deposit(expense_id, member)))
                payout = str(int(self._collectable(expense, current)))
            row["members"] = _addr_list(group.members)
            row["shares"] = shares
            row["deposits"] = deposits
            row["owed"] = owed
            row["payout_amount"] = payout
            row["proposals"] = [self._proposal_dict(pid, self._require_proposal(pid)) for pid in ids]
        return row

    def _group_dict(self, group_id: str, group: Group) -> dict:
        return {
            "group_id": group_id,
            "name": group.name,
            "creator": _addr_str(group.creator),
            "members": _addr_list(group.members),
        }

    def _pay_payer(self, expense_id: str, expense: Expense) -> None:
        if not expense.winning_proposal_id:
            raise UserError("no winning proposal set")
        proposal = self._require_proposal(expense.winning_proposal_id)
        n = _iter_len(proposal.share_members)
        for i in range(n):
            member = proposal.share_members[i]
            if _same_addr(member, expense.payer):
                continue
            owed = self._compute_owed(expense, proposal, member)
            deposited = self._get_deposit(expense_id, member)
            if deposited < owed:
                raise UserError("member " + _addr_str(member) + " has not fully paid their share")

        payout = self._collectable(expense, proposal)
        try:
            self._try_transfer(expense.payer, payout)
            expense.settled = True
            expense.status = STATUS_SETTLED
        except Exception as e:
            expense.settled = False
            expense.status = STATUS_PAYOUT_FAILED
            expense.verdict_reason = expense.verdict_reason + " (Payout failed: " + str(e) + ")"
        self.expenses[expense_id] = expense

    # -----------------------------------------------------------------
    # Group management
    # -----------------------------------------------------------------
    @gl.public.write
    def create_group(self, name: str, member_addresses: DynArray[str]) -> str:
        cleaned_name = str(name).strip()
        if not cleaned_name:
            raise UserError("group name cannot be empty")
        if len(cleaned_name) > 120:
            raise UserError("group name cannot exceed 120 characters")

        creator = gl.message.sender_address
        unique = []
        seen = {}
        creator_hex = _addr_str(creator)
        unique.append(_to_address(creator))
        seen[creator_hex] = True

        n = _iter_len(member_addresses)
        for i in range(n):
            raw = str(member_addresses[i]).strip()
            if not raw:
                continue
            addr = _to_address(raw)
            hex_a = _addr_str(addr)
            if hex_a in seen:
                continue
            seen[hex_a] = True
            unique.append(addr)

        if len(unique) < 2:
            raise UserError("a group needs at least 2 members")

        group_id = str(self.group_counter)
        self.group_counter = self.group_counter + bigint(1)
        self.groups[group_id] = Group(
            name=cleaned_name,
            creator=_to_address(creator),
            members=unique,
        )
        return group_id

    # -----------------------------------------------------------------
    # Expense lifecycle
    # -----------------------------------------------------------------
    @gl.public.write
    def create_expense(
        self,
        group_id: str,
        total_amount: u256,
        description: str,
        shares_json: str,
    ) -> str:
        group = self._require_group(group_id)
        payer = gl.message.sender_address
        self._require_member(group, payer)

        amount = bigint(int(total_amount))
        if amount <= bigint(0):
            raise UserError("total_amount must be greater than 0")

        desc = str(description).strip()
        if not desc:
            raise UserError("description cannot be empty")
        if len(desc) > 2000:
            raise UserError("description cannot exceed 2000 characters")

        expense_id = str(self.expense_counter)
        self.expense_counter = self.expense_counter + bigint(1)
        self.expenses[expense_id] = Expense(
            group_id=group_id,
            payer=_to_address(payer),
            total_amount=amount,
            description=desc,
            status=STATUS_PENDING,
            winning_proposal_id="",
            proposal_ids=_empty_ids(),
            verdict_reason="",
            settled=False,
        )
        self._submit_proposal(expense_id, payer, shares_json, "initial proposal by payer")
        return expense_id

    @gl.public.write
    def accept_split(self, expense_id: str) -> None:
        """A group member accepts the current latest proposal without AI."""
        expense = self._require_expense(expense_id)
        if expense.status not in (STATUS_PENDING, STATUS_DISPUTED):
            raise UserError("expense not open")
        group = self._require_group(expense.group_id)
        self._require_member(group, gl.message.sender_address)

        ids = _str_list(expense.proposal_ids)
        if len(ids) == 0:
            raise UserError("no proposal to accept")
        latest_id = ids[len(ids) - 1]
        expense.status = STATUS_RESOLVED
        expense.winning_proposal_id = latest_id
        expense.verdict_reason = "Accepted by " + _addr_str(gl.message.sender_address)
        self.expenses[expense_id] = expense

    @gl.public.write
    def dispute_split(self, expense_id: str, shares_json: str, evidence_text: str) -> None:
        expense = self._require_expense(expense_id)
        if expense.status not in (STATUS_PENDING, STATUS_DISPUTED):
            raise UserError("expense not open for dispute")
        group = self._require_group(expense.group_id)
        proposer = gl.message.sender_address
        self._require_member(group, proposer)

        note = str(evidence_text).strip()
        if not note:
            raise UserError("evidence_text cannot be empty")
        if len(note) > 4000:
            raise UserError("evidence_text cannot exceed 4000 characters")

        expense.status = STATUS_DISPUTED
        self.expenses[expense_id] = expense
        self._submit_proposal(expense_id, proposer, shares_json, note)

    # -----------------------------------------------------------------
    # AI-arbitrated resolution
    # -----------------------------------------------------------------
    @gl.public.write
    def resolve_dispute(self, expense_id: str) -> None:
        """
        Independent AI validators read every proposal + evidence and must
        agree on the exact same winning_proposal_id (discrete, no tolerance).
        """
        expense = self._require_expense(expense_id)
        if expense.status != STATUS_DISPUTED:
            raise UserError("expense is not disputed")

        ids = _str_list(expense.proposal_ids)
        if len(ids) < 2:
            raise UserError("need at least 2 competing proposals to arbitrate")

        snapshot = []
        for pid in ids:
            snapshot.append(self._proposal_dict(pid, self._require_proposal(pid)))
        description = expense.description
        total_amount = str(int(expense.total_amount))
        valid_ids = list(ids)

        def leader_fn() -> dict:
            prompt = (
                "You are arbitrating a group expense dispute.\n"
                "Expense description: " + description + "\n"
                "Total amount (base units): " + total_amount + "\n\n"
                "Competing split proposals (JSON):\n"
                + json.dumps(snapshot)
                + "\n\n"
                "Each proposal's \"shares\" maps a member address to a basis-point "
                "share (out of 10000) they believe is fair, plus evidence_text.\n"
                "Decide which single proposal is the FAIREST and most consistent "
                "with the evidence. Return ONLY raw JSON, no markdown:\n"
                "{\"winning_proposal_id\": \"<id>\", \"reason\": \"<short justification>\"}"
            )
            raw = gl.nondet.exec_prompt(prompt)
            return _parse_verdict(raw, valid_ids)

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            leader_val = _leader_payload(leader_res)
            if not isinstance(leader_val, dict) or "winning_proposal_id" not in leader_val:
                return False
            try:
                my_res = leader_fn()
            except Exception:
                return False
            return my_res["winning_proposal_id"] == leader_val["winning_proposal_id"]

        result = _extract_result(gl.vm.run_nondet(leader_fn, validator_fn))
        winning_id = str(result["winning_proposal_id"]).strip()
        if winning_id not in valid_ids:
            raise UserError("consensus returned an unknown proposal id")

        expense.status = STATUS_RESOLVED
        expense.winning_proposal_id = winning_id
        expense.verdict_reason = str(result.get("reason", ""))
        self.expenses[expense_id] = expense

    # -----------------------------------------------------------------
    # Settlement / payout
    # -----------------------------------------------------------------
    @gl.public.write.payable
    def deposit_share(self, expense_id: str) -> None:
        """A member pays their computed share. Amount comes from gl.message.value."""
        expense = self._require_expense(expense_id)
        if expense.status != STATUS_RESOLVED:
            raise UserError("expense not resolved yet")
        if expense.settled:
            raise UserError("expense already settled")

        group = self._require_group(expense.group_id)
        payer_address = gl.message.sender_address
        self._require_member(group, payer_address)
        if _same_addr(payer_address, expense.payer):
            raise UserError("the original payer does not deposit against themself")

        amount_sent = bigint(gl.message.value)
        if amount_sent <= bigint(0):
            raise UserError("Must send GEN as the share deposit (amount must be > 0)")

        winning = self._require_proposal(expense.winning_proposal_id)
        owed = self._compute_owed(expense, winning, payer_address)
        if owed <= bigint(0):
            raise UserError("this member owes nothing on this expense")

        already = self._get_deposit(expense_id, payer_address)
        if already + amount_sent > owed:
            raise UserError("overpayment not allowed, deposit exact remaining share")

        self.deposits[self._deposit_key(expense_id, payer_address)] = already + amount_sent

    @gl.public.write
    def settle(self, expense_id: str) -> None:
        """Once all non-payer shares are deposited, forward that sum to the payer."""
        expense = self._require_expense(expense_id)
        if expense.status != STATUS_RESOLVED:
            raise UserError("expense not resolved")
        if expense.settled:
            raise UserError("expense already settled")
        self._pay_payer(expense_id, expense)

    @gl.public.write
    def retry_settlement(self, expense_id: str) -> None:
        """Retry a failed transfer to the payer. Does not re-collect deposits or re-run AI."""
        expense = self._require_expense(expense_id)
        if expense.status != STATUS_PAYOUT_FAILED:
            raise UserError("can only retry PAYOUT_FAILED expenses")
        if expense.settled:
            raise UserError("expense already settled")
        self._pay_payer(expense_id, expense)

    # -----------------------------------------------------------------
    # Read views — JSON strings (Studio / genlayer-js friendly)
    # -----------------------------------------------------------------
    @gl.public.view
    def get_group(self, group_id: str) -> str:
        group = self._require_group(group_id)
        return json.dumps(self._group_dict(group_id, group))

    @gl.public.view
    def list_groups(self) -> str:
        results = []
        n = int(self.group_counter)
        for i in range(n):
            gid = str(i)
            if gid in self.groups:
                results.append(self._group_dict(gid, self.groups[gid]))
        return json.dumps(results)

    @gl.public.view
    def get_expense(self, expense_id: str) -> str:
        expense = self._require_expense(expense_id)
        return json.dumps(self._expense_dict(expense_id, expense, True))

    @gl.public.view
    def list_expenses(self, group_id: str) -> str:
        results = []
        n = int(self.expense_counter)
        for i in range(n):
            eid = str(i)
            if eid in self.expenses:
                expense = self.expenses[eid]
                if group_id == "" or expense.group_id == group_id:
                    results.append(self._expense_dict(eid, expense, False))
        return json.dumps(results)

    @gl.public.view
    def get_proposals(self, expense_id: str) -> str:
        expense = self._require_expense(expense_id)
        rows = []
        for pid in _str_list(expense.proposal_ids):
            rows.append(self._proposal_dict(pid, self._require_proposal(pid)))
        return json.dumps(rows)

    @gl.public.view
    def get_owed_amount(self, expense_id: str, member_address: str) -> str:
        expense = self._require_expense(expense_id)
        proposal = self._winning_or_latest(expense)
        owed = self._compute_owed(expense, proposal, _to_address(member_address))
        return str(int(owed))

    @gl.public.view
    def get_deposit_status(self, expense_id: str) -> str:
        expense = self._require_expense(expense_id)
        group = self._require_group(expense.group_id)
        out = {}
        n = _iter_len(group.members)
        for i in range(n):
            member = group.members[i]
            out[_addr_str(member)] = str(int(self._get_deposit(expense_id, member)))
        return json.dumps(out)

    @gl.public.view
    def get_group_count(self) -> int:
        return int(self.group_counter)

    @gl.public.view
    def get_expense_count(self) -> int:
        return int(self.expense_counter)

    @gl.public.view
    def get_owner(self) -> str:
        return _addr_str(self.owner)

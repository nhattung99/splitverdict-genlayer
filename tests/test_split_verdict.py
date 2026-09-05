import json
import pytest

CONTRACT_PATH = "contracts/split_verdict.py"


def _set_value(vm, amount):
    if hasattr(vm, "value"):
        try:
            vm.value = amount
        except Exception:
            pass
    if hasattr(vm, "_value"):
        vm._value = amount
    if hasattr(vm, "_refresh_gl_message"):
        vm._refresh_gl_message()


def _clear_value(vm):
    _set_value(vm, 0)


def _active_vm(direct_vm):
    try:
        from gltest.direct.loader import _get_active_vm
        return _get_active_vm() or direct_vm
    except Exception:
        return direct_vm


def sim_installMocks(vm, web=None, llm=None):
    web = web or {}
    llm_payload = llm if isinstance(llm, str) or llm is None else json.dumps(llm)

    if hasattr(vm, "sim_installMocks"):
        vm.sim_installMocks({"web": web, "llm": llm_payload})
        return
    if hasattr(vm, "sim_install_mocks"):
        vm.sim_install_mocks({"web": web, "llm": llm_payload})
        return

    if hasattr(vm, "clear_mocks"):
        try:
            vm.clear_mocks()
        except Exception:
            pass
    for url, body in web.items():
        vm.mock_web(url, body)
    if llm_payload is not None:
        vm.mock_llm(".*", llm_payload)


def _parse(raw):
    if isinstance(raw, str):
        return json.loads(raw)
    return raw


def _hex(a):
    if hasattr(a, "as_hex"):
        return a.as_hex.lower()
    s = str(a).lower()
    if not s.startswith("0x") and len(s) == 40:
        return "0x" + s
    return s


def _shares(mapping):
    return json.dumps({_hex(k): int(v) for k, v in mapping.items()})


def _group(contract, group_id):
    return _parse(contract.get_group(group_id))


def _expense(contract, expense_id):
    return _parse(contract.get_expense(expense_id))


def _create_group(contract, vm, creator, extra_members, name="Tokyo trip"):
    vm.sender = creator
    members = [_hex(m) for m in extra_members]
    return contract.create_group(name, members)


def _create_expense(contract, vm, payer, group_id, shares_map, amount=10000, description="Airbnb Saturday"):
    vm.sender = payer
    return contract.create_expense(group_id, amount, description, _shares(shares_map))


def test_create_group_and_accept_split(direct_vm, direct_deploy, direct_accounts):
    payer = direct_accounts[1]
    roommate = direct_accounts[2]
    contract = direct_deploy(CONTRACT_PATH)
    vm = _active_vm(direct_vm)

    gid = _create_group(contract, vm, payer, [roommate])
    g = _group(contract, gid)
    assert g["name"] == "Tokyo trip"
    assert len(g["members"]) == 2

    eid = _create_expense(
        contract, vm, payer, gid,
        {payer: 5000, roommate: 5000},
        amount=10000,
    )
    row = _expense(contract, eid)
    assert row["status"] == "PENDING"
    assert row["payer"] == _hex(payer)
    assert row["total_amount"] == "10000"
    assert len(row["proposals"]) == 1

    vm.sender = roommate
    contract.accept_split(eid)
    row = _expense(contract, eid)
    assert row["status"] == "RESOLVED"
    assert row["winning_proposal_id"] == row["latest_proposal_id"]
    assert row["owed"][_hex(roommate)] == "5000"
    assert row["payout_amount"] == "5000"


def test_shares_must_sum_to_10000(direct_vm, direct_deploy, direct_accounts):
    payer = direct_accounts[1]
    roommate = direct_accounts[2]
    contract = direct_deploy(CONTRACT_PATH)
    vm = _active_vm(direct_vm)
    gid = _create_group(contract, vm, payer, [roommate])

    vm.sender = payer
    with pytest.raises(Exception):
        contract.create_expense(gid, 10000, "Dinner", _shares({payer: 4000, roommate: 4000}))


def test_group_needs_two_members(direct_vm, direct_deploy, direct_accounts):
    payer = direct_accounts[1]
    contract = direct_deploy(CONTRACT_PATH)
    vm = _active_vm(direct_vm)
    vm.sender = payer
    with pytest.raises(Exception):
        contract.create_group("Solo", [])


def test_dispute_then_ai_resolve_deposit_settle(direct_vm, direct_deploy, direct_accounts):
    payer = direct_accounts[1]
    roommate = direct_accounts[2]
    contract = direct_deploy(CONTRACT_PATH)
    vm = _active_vm(direct_vm)

    gid = _create_group(contract, vm, payer, [roommate], name="Hackathon dinner")
    eid = _create_expense(
        contract, vm, payer, gid,
        {payer: 2000, roommate: 8000},
        amount=10000,
        description="Team dinner after demo day",
    )

    vm.sender = roommate
    contract.dispute_split(
        eid,
        _shares({payer: 5000, roommate: 5000}),
        "Receipt shows we split the bill evenly. I only ordered one dish.",
    )
    row = _expense(contract, eid)
    assert row["status"] == "DISPUTED"
    assert len(row["proposal_ids"]) == 2
    winning_expected = row["proposal_ids"][1]

    sim_installMocks(
        vm,
        llm={
            "winning_proposal_id": winning_expected,
            "reason": "Counter-proposal matches the even split on the receipt",
        },
    )
    vm.sender = payer
    contract.resolve_dispute(eid)

    row = _expense(contract, eid)
    assert row["status"] == "RESOLVED"
    assert row["winning_proposal_id"] == winning_expected
    assert row["owed"][_hex(roommate)] == "5000"
    assert row["payout_amount"] == "5000"

    vm.sender = roommate
    _set_value(vm, 5000)
    contract.deposit_share(eid)
    _clear_value(vm)

    row = _expense(contract, eid)
    assert row["deposits"][_hex(roommate)] == "5000"

    vm.sender = payer
    contract.settle(eid)
    row = _expense(contract, eid)
    assert row["status"] == "SETTLED"
    assert row["settled"] is True


def test_overpayment_rejected(direct_vm, direct_deploy, direct_accounts):
    payer = direct_accounts[1]
    roommate = direct_accounts[2]
    contract = direct_deploy(CONTRACT_PATH)
    vm = _active_vm(direct_vm)

    gid = _create_group(contract, vm, payer, [roommate])
    eid = _create_expense(contract, vm, payer, gid, {payer: 5000, roommate: 5000}, amount=10000)
    vm.sender = roommate
    contract.accept_split(eid)

    vm.sender = roommate
    _set_value(vm, 5001)
    with pytest.raises(Exception):
        contract.deposit_share(eid)
    _clear_value(vm)


def test_payer_cannot_deposit(direct_vm, direct_deploy, direct_accounts):
    payer = direct_accounts[1]
    roommate = direct_accounts[2]
    contract = direct_deploy(CONTRACT_PATH)
    vm = _active_vm(direct_vm)

    gid = _create_group(contract, vm, payer, [roommate])
    eid = _create_expense(contract, vm, payer, gid, {payer: 5000, roommate: 5000}, amount=10000)
    vm.sender = roommate
    contract.accept_split(eid)

    vm.sender = payer
    _set_value(vm, 5000)
    with pytest.raises(Exception):
        contract.deposit_share(eid)
    _clear_value(vm)


def test_deposit_before_resolve_rejected(direct_vm, direct_deploy, direct_accounts):
    payer = direct_accounts[1]
    roommate = direct_accounts[2]
    contract = direct_deploy(CONTRACT_PATH)
    vm = _active_vm(direct_vm)

    gid = _create_group(contract, vm, payer, [roommate])
    eid = _create_expense(contract, vm, payer, gid, {payer: 5000, roommate: 5000}, amount=10000)

    vm.sender = roommate
    _set_value(vm, 5000)
    with pytest.raises(Exception):
        contract.deposit_share(eid)
    _clear_value(vm)


def test_non_member_cannot_accept(direct_vm, direct_deploy, direct_accounts):
    payer = direct_accounts[1]
    roommate = direct_accounts[2]
    outsider = direct_accounts[3]
    contract = direct_deploy(CONTRACT_PATH)
    vm = _active_vm(direct_vm)

    gid = _create_group(contract, vm, payer, [roommate])
    eid = _create_expense(contract, vm, payer, gid, {payer: 5000, roommate: 5000}, amount=10000)
    vm.sender = outsider
    with pytest.raises(Exception):
        contract.accept_split(eid)


def test_integer_dust_absorbed_by_payer(direct_vm, direct_deploy, direct_accounts):
    payer = direct_accounts[1]
    a = direct_accounts[2]
    b = direct_accounts[3]
    contract = direct_deploy(CONTRACT_PATH)
    vm = _active_vm(direct_vm)

    gid = _create_group(contract, vm, payer, [a, b], name="Three-way")
    # 3333 + 3333 + 3334 = 10000; total 100 wei → owed 33, 33, 33
    eid = _create_expense(
        contract, vm, payer, gid,
        {payer: 3334, a: 3333, b: 3333},
        amount=100,
    )
    vm.sender = a
    contract.accept_split(eid)
    row = _expense(contract, eid)
    assert row["owed"][_hex(a)] == "33"
    assert row["owed"][_hex(b)] == "33"
    assert row["owed"][_hex(payer)] == "33"
    assert row["payout_amount"] == "66"


def test_partial_deposit_then_remainder(direct_vm, direct_deploy, direct_accounts):
    payer = direct_accounts[1]
    roommate = direct_accounts[2]
    contract = direct_deploy(CONTRACT_PATH)
    vm = _active_vm(direct_vm)

    gid = _create_group(contract, vm, payer, [roommate])
    eid = _create_expense(contract, vm, payer, gid, {payer: 0, roommate: 10000}, amount=80)
    vm.sender = roommate
    contract.accept_split(eid)

    vm.sender = roommate
    _set_value(vm, 30)
    contract.deposit_share(eid)
    _clear_value(vm)
    row = _expense(contract, eid)
    assert row["deposits"][_hex(roommate)] == "30"

    vm.sender = roommate
    _set_value(vm, 50)
    contract.deposit_share(eid)
    _clear_value(vm)
    row = _expense(contract, eid)
    assert row["deposits"][_hex(roommate)] == "80"

    vm.sender = payer
    contract.settle(eid)
    assert _expense(contract, eid)["status"] == "SETTLED"


def test_settle_blocked_until_all_paid(direct_vm, direct_deploy, direct_accounts):
    payer = direct_accounts[1]
    roommate = direct_accounts[2]
    contract = direct_deploy(CONTRACT_PATH)
    vm = _active_vm(direct_vm)

    gid = _create_group(contract, vm, payer, [roommate])
    eid = _create_expense(contract, vm, payer, gid, {payer: 5000, roommate: 5000}, amount=10000)
    vm.sender = roommate
    contract.accept_split(eid)

    vm.sender = payer
    with pytest.raises(Exception):
        contract.settle(eid)


def test_transfer_failure_then_retry(direct_vm, direct_deploy, direct_accounts, monkeypatch):
    payer = direct_accounts[1]
    roommate = direct_accounts[2]
    contract = direct_deploy(CONTRACT_PATH)
    vm = _active_vm(direct_vm)

    gid = _create_group(contract, vm, payer, [roommate])
    eid = _create_expense(contract, vm, payer, gid, {payer: 5000, roommate: 5000}, amount=10000)
    vm.sender = roommate
    contract.accept_split(eid)
    vm.sender = roommate
    _set_value(vm, 5000)
    contract.deposit_share(eid)
    _clear_value(vm)

    import gltest.direct.loader

    def failing_emit_transfer(self, value):
        raise Exception("Simulated native transfer execution failure")

    monkeypatch.setattr(gltest.direct.loader._EOAProxy, "emit_transfer", failing_emit_transfer)

    vm.sender = payer
    contract.settle(eid)
    row = _expense(contract, eid)
    assert row["status"] == "PAYOUT_FAILED"
    assert row["settled"] is False

    monkeypatch.undo()
    vm.sender = roommate
    contract.retry_settlement(eid)
    row = _expense(contract, eid)
    assert row["status"] == "SETTLED"
    assert row["settled"] is True


def test_list_helpers(direct_vm, direct_deploy, direct_accounts):
    payer = direct_accounts[1]
    roommate = direct_accounts[2]
    contract = direct_deploy(CONTRACT_PATH)
    vm = _active_vm(direct_vm)

    gid = _create_group(contract, vm, payer, [roommate])
    _create_expense(contract, vm, payer, gid, {payer: 5000, roommate: 5000}, amount=10000)

    groups = _parse(contract.list_groups())
    expenses = _parse(contract.list_expenses(""))
    assert len(groups) == 1
    assert len(expenses) == 1
    assert contract.get_group_count() == 1
    assert contract.get_expense_count() == 1

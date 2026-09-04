"""Direct-mode safety tests for the guarded Sentinel Vault."""

from tests.direct.conftest import as_address


def _deploy_configured_vault(direct_vm, direct_deploy, direct_owner, direct_alice):
    direct_vm.sender = direct_owner
    vault = direct_deploy("contracts/sentinel_vault.py", 25_000)
    vault.configure_sentinel(as_address(direct_alice))
    return vault


def test_only_governor_can_bind_the_sentinel(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob
):
    direct_vm.sender = direct_owner
    vault = direct_deploy("contracts/sentinel_vault.py", 25_000)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("governor authorization required"):
        vault.configure_sentinel(as_address(direct_alice))

    direct_vm.sender = direct_owner
    vault.configure_sentinel(as_address(direct_alice))
    with direct_vm.expect_revert("sentinel already configured"):
        vault.configure_sentinel(as_address(direct_bob))


def test_only_sentinel_executes_and_replay_is_rejected(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, direct_charlie
):
    vault = _deploy_configured_vault(direct_vm, direct_deploy, direct_owner, direct_alice)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("sentinel authorization required"):
        vault.execute_authorized_transfer(
            "transfer-1", as_address(direct_charlie), "DEMO", 500, "security audit", 1
        )

    direct_vm.sender = direct_alice
    vault.execute_authorized_transfer(
        "transfer-1", as_address(direct_charlie), "DEMO", 500, "security audit", 1
    )
    assert vault.get_state()["demo_balance"] == 24_500
    assert vault.has_executed("transfer-1") is True
    assert vault.get_execution("transfer-1")["execution_kind"] == "TRANSFER"

    with direct_vm.expect_revert("action already executed"):
        vault.execute_authorized_transfer(
            "transfer-1", as_address(direct_charlie), "DEMO", 500, "security audit", 1
        )


def test_pause_blocks_treasury_operations_and_only_sentinel_releases_it(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, direct_charlie
):
    vault = _deploy_configured_vault(direct_vm, direct_deploy, direct_owner, direct_alice)

    direct_vm.sender = direct_alice
    vault.apply_temporary_pause("incident-1", 24, "active exploit evidence", 1)
    assert vault.get_state()["paused"] is True

    with direct_vm.expect_revert("vault is paused"):
        vault.execute_authorized_transfer(
            "transfer-2", as_address(direct_charlie), "DEMO", 500, "infrastructure", 1
        )

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("sentinel authorization required"):
        vault.release_pause("incident-1")

    direct_vm.sender = direct_alice
    vault.release_pause("incident-1")
    assert vault.get_state()["paused"] is False


def test_pause_cannot_be_replayed_or_exceed_available_balance(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_charlie
):
    vault = _deploy_configured_vault(direct_vm, direct_deploy, direct_owner, direct_alice)
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("insufficient demo treasury balance"):
        vault.execute_authorized_transfer(
            "transfer-overspend", as_address(direct_charlie), "DEMO", 25_001, "ops", 1
        )

    vault.apply_temporary_pause("incident-2", 12, "confirmed exploit", 1)
    vault.release_pause("incident-2")
    with direct_vm.expect_revert("incident already applied"):
        vault.apply_temporary_pause("incident-2", 12, "confirmed exploit", 1)

"""Versioning and role tests for Covenant Sentinel's deterministic layer."""

import json

from tests.direct.conftest import as_address


POLICY_V1 = """R1 — HARD_MAX_TRANSFER: No treasury transfer may exceed 10,000 demo units.
R2 — PURPOSE_ALIGNMENT: Spending must advance development, security, infrastructure, or approved community operations.
R3 — SECURITY_EXCLUSION: Do not interact with a target with credible unresolved critical exploit evidence.
R4 — CONFLICTING_EVIDENCE: Conflicting credible safety evidence forbids immediate execution.
R5 — EMERGENCY_PAUSE: A temporary pause needs independently verifiable active-threat evidence."""


def _deploy_sentinel(direct_vm, direct_deploy, direct_owner, direct_alice):
    direct_vm.sender = direct_owner
    sentinel = direct_deploy("contracts/covenant_sentinel.py")
    sentinel.create_initial_policy(POLICY_V1, 10_000, "covenant-v1")
    sentinel.configure_guarded_vault(as_address(direct_alice))
    sentinel.configure_evidence_domain("security.example.org", True)
    return sentinel


def test_only_governor_can_create_or_publish_policy(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    direct_vm.sender = direct_owner
    sentinel = direct_deploy("contracts/covenant_sentinel.py")

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("governor authorization required"):
        sentinel.create_initial_policy(POLICY_V1, 10_000, "covenant-v1")

    direct_vm.sender = direct_owner
    sentinel.create_initial_policy(POLICY_V1, 10_000, "covenant-v1")
    assert sentinel.get_current_policy_version() == 1
    assert sentinel.get_policy(1)["max_transfer_amount"] == 10_000

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("governor authorization required"):
        sentinel.publish_policy(POLICY_V1, 9_000, "covenant-v2")


def test_policy_versions_are_immutable_for_submitted_proposals(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, direct_charlie
):
    sentinel = _deploy_sentinel(direct_vm, direct_deploy, direct_owner, direct_alice)
    direct_vm.sender = direct_bob
    sentinel.submit_treasury_proposal(
        "proposal-old-policy",
        as_address(direct_charlie),
        "DEMO",
        500,
        "security audit",
        json.dumps(["https://security.example.org/audit"]),
    )
    assert sentinel.get_proposal("proposal-old-policy")["policy_version"] == 1

    direct_vm.sender = direct_owner
    sentinel.publish_policy(POLICY_V1 + "\nVersion two reduces the ceiling.", 8_000, "covenant-v2")
    assert sentinel.get_current_policy_version() == 2
    assert sentinel.get_policy(1)["max_transfer_amount"] == 10_000
    assert sentinel.get_policy(2)["max_transfer_amount"] == 8_000
    assert sentinel.get_proposal("proposal-old-policy")["policy_version"] == 1


def test_governor_configures_vault_domains_and_non_governor_reporters(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob
):
    sentinel = _deploy_sentinel(direct_vm, direct_deploy, direct_owner, direct_alice)
    assert sentinel.get_guarded_vault_configuration()["vault_configured"] is True
    assert sentinel.get_approved_evidence_domains()["domains"] == ["security.example.org"]

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("governor authorization required"):
        sentinel.configure_evidence_domain("status.example.net", True)

    direct_vm.sender = direct_owner
    with direct_vm.expect_revert("governor cannot be an emergency reporter"):
        sentinel.configure_reporter(as_address(direct_owner), True)
    sentinel.configure_reporter(as_address(direct_bob), True)
    sentinel.configure_evidence_domain("status.example.net", True)
    assert sentinel.get_approved_evidence_domains()["total"] == 2

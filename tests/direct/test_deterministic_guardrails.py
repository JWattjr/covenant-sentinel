"""Deterministic proposal and evidence-validation tests."""

import json

from tests.direct.conftest import as_address
from tests.direct.test_policy_management import _deploy_sentinel


def test_transfer_amount_id_and_evidence_constraints(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, direct_charlie
):
    sentinel = _deploy_sentinel(direct_vm, direct_deploy, direct_owner, direct_alice)
    direct_vm.sender = direct_bob

    with direct_vm.expect_revert("transfer exceeds HARD_MAX_TRANSFER"):
        sentinel.submit_treasury_proposal(
            "too-large", as_address(direct_charlie), "DEMO", 10_001, "operations", "[]"
        )
    with direct_vm.expect_revert("invalid action id characters"):
        sentinel.submit_treasury_proposal(
            "contains space", as_address(direct_charlie), "DEMO", 1, "operations", "[]"
        )
    with direct_vm.expect_revert("evidence URL must use HTTPS"):
        sentinel.submit_treasury_proposal(
            "http-source",
            as_address(direct_charlie),
            "DEMO",
            1,
            "operations",
            json.dumps(["http://security.example.org/advisory"]),
        )
    with direct_vm.expect_revert("raw IP evidence targets are forbidden"):
        sentinel.submit_treasury_proposal(
            "raw-ip",
            as_address(direct_charlie),
            "DEMO",
            1,
            "operations",
            json.dumps(["https://127.0.0.1/advisory"]),
        )
    with direct_vm.expect_revert("evidence domain is not approved"):
        sentinel.submit_treasury_proposal(
            "unapproved-domain",
            as_address(direct_charlie),
            "DEMO",
            1,
            "operations",
            json.dumps(["https://evil.example/advisory"]),
        )


def test_duplicate_actions_and_cancellation_permissions(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, direct_charlie
):
    sentinel = _deploy_sentinel(direct_vm, direct_deploy, direct_owner, direct_alice)
    evidence = json.dumps(["https://security.example.org/notice"])
    direct_vm.sender = direct_bob
    sentinel.submit_treasury_proposal(
        "unique-transfer", as_address(direct_charlie), "DEMO", 25, "infrastructure", evidence
    )
    with direct_vm.expect_revert("proposal id already exists"):
        sentinel.submit_treasury_proposal(
            "unique-transfer", as_address(direct_charlie), "DEMO", 25, "infrastructure", evidence
        )

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("cancellation authorization required"):
        sentinel.cancel_proposal("unique-transfer")

    direct_vm.sender = direct_bob
    sentinel.cancel_proposal("unique-transfer")
    assert sentinel.get_proposal("unique-transfer")["status"] == "CANCELLED"
    with direct_vm.expect_revert("proposal cannot be evaluated"):
        sentinel.evaluate_proposal("unique-transfer")


def test_emergency_reporting_is_constrained(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob
):
    sentinel = _deploy_sentinel(direct_vm, direct_deploy, direct_owner, direct_alice)
    direct_vm.sender = direct_owner
    sentinel.configure_reporter(as_address(direct_bob), True)
    sentinel.configure_evidence_domain("incident.example.net", True)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("invalid emergency pause duration"):
        sentinel.submit_emergency_pause_proposal(
            "incident-too-long",
            as_address(direct_alice),
            "active exploit",
            json.dumps(
                [
                    "https://security.example.org/a",
                    "https://incident.example.net/b",
                ]
            ),
            73,
        )
    with direct_vm.expect_revert("two independent domains"):
        sentinel.submit_emergency_pause_proposal(
            "incident-one-domain",
            as_address(direct_alice),
            "active exploit",
            json.dumps(
                [
                    "https://security.example.org/a",
                    "https://security.example.org/b",
                ]
            ),
            24,
        )

    sentinel.submit_emergency_pause_proposal(
        "incident-valid",
        as_address(direct_alice),
        "active exploit",
        json.dumps(
            ["https://security.example.org/a", "https://incident.example.net/b"]
        ),
        24,
    )
    proposal = sentinel.get_proposal("incident-valid")
    assert proposal["proposal_type"] == "EMERGENCY_PAUSE"
    assert proposal["requested_pause_hours"] == 24

"""Five-validator GLSim flow tests for transfer authorization and blocking."""

import json

import pytest

from .conftest import deploy_wired_protocol, finalized, mocked_consensus_context


@pytest.mark.integration
def test_full_consensus_allowed_transfer_executes_in_guarded_vault():
    sentinel, vault = deploy_wired_protocol()
    recipient = "0x00000000000000000000000000000000000000aa"
    finalized(
        sentinel.submit_treasury_proposal(
            args=[
                "integration-allow",
                recipient,
                "DEMO",
                500,
                "independent protocol security audit",
                json.dumps(["https://security.example.org/audit"]),
            ]
        )
    )
    context = mocked_consensus_context(
        {
            "https://security.example.org/audit": (
                200,
                "An independent audit advances protocol security and infrastructure.",
            )
        },
        {
            "verdict": "ALLOW",
            "risk_level": "LOW",
            "reason_code": "PURPOSE_ALIGNED",
            "violated_rule_ids": [],
            "satisfied_rule_ids": ["R1", "R2"],
            "evidence_findings": [
                {"source_id": "E1", "rule_id": "R2", "finding": "Audit supports security work."}
            ],
            "summary": "The bounded audit spend materially advances protocol security.",
        },
    )
    receipt = finalized(sentinel.evaluate_proposal(args=["integration-allow"]), context=context)
    assert len(receipt.get("consensus_data", {}).get("votes", {})) == 5

    # GLSim materializes finalized messages immediately. Reading the vault also
    # drains the safe callback message, so the parent can record actual child
    # success rather than assuming the parent receipt proves execution.
    state = vault.get_state(args=[]).call()
    assert state["demo_balance"] == 24_500
    assert vault.has_executed(args=["integration-allow"]).call() is True
    proposal = sentinel.get_proposal(args=["integration-allow"]).call()
    assert proposal["status"] == "EXECUTED"
    assert proposal["execution_status"] == "SUCCEEDED"


@pytest.mark.integration
def test_full_consensus_block_never_executes_the_vault():
    sentinel, vault = deploy_wired_protocol()
    finalized(
        sentinel.submit_treasury_proposal(
            args=[
                "integration-block",
                "0x00000000000000000000000000000000000000bb",
                "DEMO",
                500,
                "protocol integration maintenance",
                json.dumps(["https://security.example.org/exploit"]),
            ]
        )
    )
    context = mocked_consensus_context(
        {
            "https://security.example.org/exploit": (
                200,
                "A critical exploit remains unresolved and active losses are reported.",
            )
        },
        {
            "verdict": "BLOCK",
            "risk_level": "CRITICAL",
            "reason_code": "SECURITY_CRITICAL_EVIDENCE",
            "violated_rule_ids": ["R3"],
            "satisfied_rule_ids": ["R1"],
            "evidence_findings": [
                {"source_id": "E1", "rule_id": "R3", "finding": "Critical exploit is unresolved."}
            ],
            "summary": "Critical exploit evidence forbids interacting with this target.",
        },
    )
    receipt = finalized(sentinel.evaluate_proposal(args=["integration-block"]), context=context)
    assert len(receipt.get("consensus_data", {}).get("votes", {})) == 5
    assert vault.get_state(args=[]).call()["demo_balance"] == 25_000
    assert vault.has_executed(args=["integration-block"]).call() is False
    proposal = sentinel.get_proposal(args=["integration-block"]).call()
    assert proposal["status"] == "BLOCK"
    assert proposal["execution_status"] == "NOT_QUEUED"

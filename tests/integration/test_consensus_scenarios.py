"""Consensus scenarios that must fail closed or make an appealable decision."""

import json

import pytest

from .conftest import deploy_wired_protocol, finalized, mocked_consensus_context


@pytest.mark.integration
def test_conflicting_evidence_timelocks_with_full_validator_agreement():
    sentinel, vault = deploy_wired_protocol()
    finalized(
        sentinel.submit_treasury_proposal(
            args=[
                "integration-conflict",
                "0x00000000000000000000000000000000000000cc",
                "DEMO",
                100,
                "infrastructure validation",
                json.dumps(["https://security.example.org/conflicting"]),
            ]
        )
    )
    context = mocked_consensus_context(
        {
            "https://security.example.org/conflicting": (
                200,
                "Credible sources materially disagree about whether the target is safe.",
            )
        },
        {
            "verdict": "TIMELOCK",
            "risk_level": "HIGH",
            "reason_code": "CONFLICTING_EVIDENCE",
            "violated_rule_ids": ["R4"],
            "satisfied_rule_ids": ["R1"],
            "evidence_findings": [
                {"source_id": "E1", "rule_id": "R4", "finding": "Safety evidence conflicts."}
            ],
            "summary": "Immediate execution is forbidden while credible sources conflict.",
        },
    )
    receipt = finalized(sentinel.evaluate_proposal(args=["integration-conflict"]), context=context)
    assert len(receipt.get("consensus_data", {}).get("votes", {})) == 5
    assert sentinel.get_proposal(args=["integration-conflict"]).call()["status"] == "TIMELOCK"
    assert vault.get_state(args=[]).call()["demo_balance"] == 25_000


@pytest.mark.integration
def test_unavailable_evidence_fails_closed_without_an_llm_allow():
    sentinel, vault = deploy_wired_protocol()
    finalized(
        sentinel.submit_treasury_proposal(
            args=[
                "integration-unavailable",
                "0x00000000000000000000000000000000000000dd",
                "DEMO",
                100,
                "security operations",
                json.dumps(["https://security.example.org/unavailable"]),
            ]
        )
    )
    # No LLM mock is supplied. The deterministic HTTP failure path must return
    # INSUFFICIENT_EVIDENCE before the evaluator can call an LLM.
    context = mocked_consensus_context(
        {"https://security.example.org/unavailable": (503, "maintenance")},
        {
            "verdict": "ALLOW",
            "risk_level": "LOW",
            "reason_code": "PURPOSE_ALIGNED",
            "violated_rule_ids": [],
            "satisfied_rule_ids": ["R1", "R2"],
            "evidence_findings": [],
            "summary": "This response must never be used.",
        },
    )
    finalized(sentinel.evaluate_proposal(args=["integration-unavailable"]), context=context)
    proposal = sentinel.get_proposal(args=["integration-unavailable"]).call()
    assert proposal["status"] == "INSUFFICIENT_EVIDENCE"
    assert proposal["reason_code"] == "EVIDENCE_UNAVAILABLE"
    assert vault.get_state(args=[]).call()["demo_balance"] == 25_000

"""Finalized emergency-message flow for the guarded vault."""

import json

import pytest

from gltest import create_account

from .conftest import deploy_wired_protocol, finalized, mocked_consensus_context


@pytest.mark.integration
def test_finalized_emergency_pause_and_safe_manual_release():
    sentinel, vault = deploy_wired_protocol()
    reporter = create_account()
    finalized(sentinel.configure_reporter(args=[reporter.address, True]))
    reporter_sentinel = sentinel.connect(reporter)
    finalized(
        reporter_sentinel.submit_emergency_pause_proposal(
            args=[
                "integration-emergency",
                vault.address,
                "Active exploitation threatens the guarded treasury.",
                json.dumps(
                    [
                        "https://security.example.org/active-exploit",
                        "https://incident.example.net/incident-report",
                    ]
                ),
                24,
            ]
        )
    )
    submitted = sentinel.get_proposal(args=["integration-emergency"]).call()
    assert submitted["status"] == "PENDING", submitted
    context = mocked_consensus_context(
        {
            "https://security.example.org/active-exploit": (
                200,
                "A critical active exploit is causing losses.",
            ),
            "https://incident.example.net/incident-report": (
                200,
                "Independent incident report confirms active exploitation.",
            ),
        },
        {
            "verdict": "ALLOW",
            "risk_level": "CRITICAL",
            "reason_code": "EMERGENCY_CONFIRMED",
            "violated_rule_ids": [],
            "satisfied_rule_ids": ["R1", "R5"],
            "evidence_findings": [
                {"source_id": "E1", "rule_id": "R5", "finding": "Active exploit reported."},
                {"source_id": "E2", "rule_id": "R5", "finding": "Independent report corroborates threat."},
            ],
            "summary": "Independent evidence supports a bounded temporary emergency pause.",
        },
    )
    finalized(sentinel.evaluate_proposal(args=["integration-emergency"]), context=context)
    assert vault.get_state(args=[]).call()["paused"] is True
    assert sentinel.get_proposal(args=["integration-emergency"]).call()["status"] == "EXECUTED"

    finalized(sentinel.release_emergency_pause(args=["integration-emergency"]))
    assert vault.get_state(args=[]).call()["paused"] is False

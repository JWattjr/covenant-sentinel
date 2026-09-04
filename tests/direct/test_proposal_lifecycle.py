"""Consensus leader-path tests with deterministic web and LLM fixtures."""

import json

from tests.direct.conftest import as_address
from tests.direct.test_policy_management import _deploy_sentinel


def _ignore_finalized_messages(vm, request):
    """Direct mode captures the parent decision; GLSim covers message delivery."""

    if "PostMessage" in request:
        return {"ok": None}
    return None


def _submit_transfer(sentinel, direct_vm, proposer, target, proposal_id, url):
    direct_vm.sender = proposer
    sentinel.submit_treasury_proposal(
        proposal_id,
        as_address(target),
        "DEMO",
        500,
        "independent security audit for protocol infrastructure",
        json.dumps([url]),
    )


def _mock_verdict(vm, verdict):
    vm.mock_llm(r".*independent policy evaluator.*", json.dumps(verdict))


def test_compliant_transfer_queues_only_finalized_execution(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, direct_charlie
):
    sentinel = _deploy_sentinel(direct_vm, direct_deploy, direct_owner, direct_alice)
    _submit_transfer(
        sentinel,
        direct_vm,
        direct_bob,
        direct_charlie,
        "allow-transfer",
        "https://security.example.org/audit",
    )
    direct_vm.mock_web(
        r".*security\.example\.org/audit.*",
        {"status": 200, "body": "The audit funds independent protocol security work."},
    )
    _mock_verdict(
        direct_vm,
        {
            "verdict": "ALLOW",
            "risk_level": "LOW",
            "reason_code": "PURPOSE_ALIGNED",
            "violated_rule_ids": [],
            "satisfied_rule_ids": ["R1", "R2"],
            "evidence_findings": [
                {"source_id": "E1", "rule_id": "R2", "finding": "Audit advances protocol security."}
            ],
            "summary": "The bounded audit spend advances protocol security.",
        },
    )
    direct_vm._gl_call_hook = _ignore_finalized_messages
    sentinel.evaluate_proposal("allow-transfer")

    proposal = sentinel.get_proposal("allow-transfer")
    assert proposal["verdict"] == "ALLOW"
    assert proposal["status"] == "EXECUTION_QUEUED"
    assert proposal["execution_status"] == "QUEUED_FINALITY"


def test_security_exclusion_blocks_without_queuing_vault_execution(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, direct_charlie
):
    sentinel = _deploy_sentinel(direct_vm, direct_deploy, direct_owner, direct_alice)
    _submit_transfer(
        sentinel,
        direct_vm,
        direct_bob,
        direct_charlie,
        "blocked-transfer",
        "https://security.example.org/exploit",
    )
    direct_vm.mock_web(
        r".*security\.example\.org/exploit.*",
        {"status": 200, "body": "Critical exploit remains unresolved and funds are at risk."},
    )
    _mock_verdict(
        direct_vm,
        {
            "verdict": "BLOCK",
            "risk_level": "CRITICAL",
            "reason_code": "SECURITY_CRITICAL_EVIDENCE",
            "violated_rule_ids": ["R3"],
            "satisfied_rule_ids": ["R1"],
            "evidence_findings": [
                {"source_id": "E1", "rule_id": "R3", "finding": "Critical exploit is unresolved."}
            ],
            "summary": "Credible evidence indicates an unresolved critical exploit.",
        },
    )
    sentinel.evaluate_proposal("blocked-transfer")
    proposal = sentinel.get_proposal("blocked-transfer")
    assert proposal["status"] == "BLOCK"
    assert proposal["execution_status"] == "NOT_QUEUED"


def test_conflicting_and_unavailable_evidence_fail_closed(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, direct_charlie
):
    sentinel = _deploy_sentinel(direct_vm, direct_deploy, direct_owner, direct_alice)
    _submit_transfer(
        sentinel,
        direct_vm,
        direct_bob,
        direct_charlie,
        "conflicting-transfer",
        "https://security.example.org/conflict",
    )
    direct_vm.mock_web(
        r".*security\.example\.org/conflict.*",
        {"status": 200, "body": "Conflicting reports need a safer waiting period."},
    )
    _mock_verdict(
        direct_vm,
        {
            "verdict": "TIMELOCK",
            "risk_level": "HIGH",
            "reason_code": "CONFLICTING_EVIDENCE",
            "violated_rule_ids": ["R4"],
            "satisfied_rule_ids": ["R1"],
            "evidence_findings": [
                {"source_id": "E1", "rule_id": "R4", "finding": "Sources conflict on target safety."}
            ],
            "summary": "Evidence conflicts, so immediate execution is forbidden.",
        },
    )
    sentinel.evaluate_proposal("conflicting-transfer")
    assert sentinel.get_proposal("conflicting-transfer")["status"] == "TIMELOCK"

    direct_vm.clear_mocks()
    _submit_transfer(
        sentinel,
        direct_vm,
        direct_bob,
        direct_charlie,
        "unavailable-transfer",
        "https://security.example.org/unavailable",
    )
    direct_vm.mock_web(
        r".*security\.example\.org/unavailable.*", {"status": 503, "body": "unavailable"}
    )
    sentinel.evaluate_proposal("unavailable-transfer")
    proposal = sentinel.get_proposal("unavailable-transfer")
    assert proposal["status"] == "INSUFFICIENT_EVIDENCE"
    assert proposal["reason_code"] == "EVIDENCE_UNAVAILABLE"
    assert proposal["execution_status"] == "NOT_QUEUED"


def test_validator_independently_rechecks_the_substantive_verdict(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, direct_charlie
):
    """Unlike ordinary direct tests, explicitly invoke the captured validator."""

    sentinel = _deploy_sentinel(direct_vm, direct_deploy, direct_owner, direct_alice)
    _submit_transfer(
        sentinel,
        direct_vm,
        direct_bob,
        direct_charlie,
        "validator-agreement",
        "https://security.example.org/validator",
    )
    direct_vm.mock_web(
        r".*security\.example\.org/validator.*",
        {"status": 200, "body": "A security audit advances protocol infrastructure."},
    )
    allow_verdict = {
        "verdict": "ALLOW",
        "risk_level": "LOW",
        "reason_code": "PURPOSE_ALIGNED",
        "violated_rule_ids": [],
        "satisfied_rule_ids": ["R1", "R2"],
        "evidence_findings": [
            {"source_id": "E1", "rule_id": "R2", "finding": "Audit supports security."}
        ],
        "summary": "The audit materially supports protocol security.",
    }
    _mock_verdict(direct_vm, allow_verdict)
    direct_vm._gl_call_hook = _ignore_finalized_messages
    sentinel.evaluate_proposal("validator-agreement")
    assert direct_vm.run_validator() is True

    direct_vm.clear_mocks()
    direct_vm.mock_web(
        r".*security\.example\.org/validator.*",
        {"status": 200, "body": "A critical exploit remains unresolved."},
    )
    _mock_verdict(
        direct_vm,
        {
            "verdict": "BLOCK",
            "risk_level": "CRITICAL",
            "reason_code": "SECURITY_CRITICAL_EVIDENCE",
            "violated_rule_ids": ["R3"],
            "satisfied_rule_ids": ["R1"],
            "evidence_findings": [
                {"source_id": "E1", "rule_id": "R3", "finding": "Critical exploit remains."}
            ],
            "summary": "Critical security evidence blocks execution.",
        },
    )
    assert direct_vm.run_validator() is False

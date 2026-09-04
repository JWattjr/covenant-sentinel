"""Shared full-consensus helpers for the local GLSim suite."""

import json
from pprint import pformat

from gltest import get_contract_factory, get_validator_factory
from gltest.assertions import tx_execution_succeeded
from gltest.types import TransactionStatus


POLICY_V1 = """R1 — HARD_MAX_TRANSFER: No treasury transfer may exceed 10,000 demo units.
R2 — PURPOSE_ALIGNMENT: Spending must materially advance protocol development, security, infrastructure or approved community operations.
R3 — SECURITY_EXCLUSION: Do not interact with a protocol where credible evidence shows an unresolved critical exploit or active loss.
R4 — CONFLICTING_EVIDENCE: Materially conflicting credible evidence forbids immediate execution.
R5 — EMERGENCY_PAUSE: A temporary, bounded pause requires independently verifiable active-exploit evidence."""


def finalized(function, *, context=None):
    receipt = function.transact(
        wait_transaction_status=TransactionStatus.FINALIZED,
        wait_interval=100,
        wait_retries=100,
        transaction_context=context,
    )
    assert tx_execution_succeeded(receipt), pformat(receipt, width=120)
    return receipt


def deploy_wired_protocol():
    """Deploy, wire, and seed a native Sentinel/Vault pair on GLSim."""

    vault = get_contract_factory("SentinelVault").deploy(
        args=[25_000],
        wait_transaction_status=TransactionStatus.FINALIZED,
        wait_interval=100,
        wait_retries=100,
    )
    sentinel = get_contract_factory("CovenantSentinel").deploy(
        args=[],
        wait_transaction_status=TransactionStatus.FINALIZED,
        wait_interval=100,
        wait_retries=100,
    )
    finalized(vault.configure_sentinel(args=[sentinel.address]))
    finalized(sentinel.configure_guarded_vault(args=[vault.address]))
    finalized(sentinel.create_initial_policy(args=[POLICY_V1, 10_000, "covenant-v1"]))
    finalized(sentinel.configure_evidence_domain(args=["security.example.org", True]))
    finalized(sentinel.configure_evidence_domain(args=["incident.example.net", True]))
    return sentinel, vault


def mocked_consensus_context(web_responses, verdict):
    """Provide the same stable evidence fixture to each of five validators."""

    web_mocks = {
        url: {"method": "GET", "status": status, "body": body}
        for url, (status, body) in web_responses.items()
    }
    validator_factory = get_validator_factory()
    validators = validator_factory.batch_create_mock_validators(
        5,
        mock_web_response={"nondet_web_request": web_mocks},
        mock_llm_response={
            "nondet_exec_prompt": {
                r".*independent policy evaluator.*": json.dumps(verdict)
            }
        },
    )
    return {"validators": [validator.to_dict() for validator in validators]}

# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Treasury record: a per-spender ledger written only from finalized Covenant Sentinel results.

No model runs here. The record reads committed Sentinel state, never caller-supplied
outcomes or amounts. The allowance multiplier comes from the table in this file:

    any BLOCK verdict (violation)     -> frozen (multiplier 0)
    3 clean EXECUTED actions, 0 bad   -> 2x
    otherwise                         -> 1x

Pull payouts: an EXECUTED spend reserves a claim for its proposer. The proposer claims
it after the vault's execution record is verified. An unclaimed reservation expires.
"""

import json

from genlayer import *


VERSION = "treasury-record/1.0.0"

TREASURY_PROPOSAL = "TREASURY_TRANSFER"
VERDICT_BLOCK = "BLOCK"
EXECUTED = "EXECUTED"

RESERVED = "RESERVED"
CLAIMED = "CLAIMED"
EXPIRED = "EXPIRED"

CLEAN_FOR_DOUBLE = 3
CLAIM_WINDOW_SECONDS = 7 * 24 * 60 * 60
MAX_LIST = 200
ERROR_EXPECTED = "[EXPECTED]"

# Multiplier table (basis: spender statistics only). Changing it is a code change, never a model output.
MULTIPLIER_FROZEN = 0
MULTIPLIER_BASE = 1
MULTIPLIER_TRUSTED = 2


@gl.contract_interface
class SentinelProposalRead:
    class View:
        def get_proposal(self, proposal_id: str) -> dict: ...


@gl.contract_interface
class SentinelVaultRead:
    class View:
        def get_execution(self, action_id: str) -> dict: ...


def _fail(prefix: str, message: str):
    raise gl.vm.UserError(f"{prefix} {message}")


def _now_ts() -> int:
    from datetime import datetime, timezone

    try:
        raw = str(gl.message.raw["datetime"])
    except Exception:
        raw = str(gl.message_raw["datetime"])
    moment = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return int(moment.timestamp())


def _canonical(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _multiplier(stats: dict) -> int:
    if int(stats["violations"]) > 0 or stats["frozen"]:
        return MULTIPLIER_FROZEN
    if int(stats["clean"]) >= CLEAN_FOR_DOUBLE:
        return MULTIPLIER_TRUSTED
    return MULTIPLIER_BASE


class TreasuryRecord(gl.Contract):
    owner: Address
    sentinel: str
    vault: str
    spender_stats: TreeMap[str, str]
    recorded: TreeMap[str, str]
    claims: TreeMap[str, str]
    claim_ids: DynArray[str]

    def __init__(self, sentinel: str, vault: str):
        for label, value in (("sentinel", sentinel), ("vault", vault)):
            if not isinstance(value, str) or len(value) != 42 or not value.startswith("0x"):
                _fail(ERROR_EXPECTED, f"INVALID_{label.upper()}_ADDRESS")
        self.owner = gl.message.sender_address
        self.sentinel = sentinel
        self.vault = vault

    def _stats(self, spender: str) -> dict:
        raw = self.spender_stats.get(spender, "")
        if not raw:
            return {"clean": 0, "violations": 0, "frozen": False}
        return json.loads(raw)

    @gl.public.view
    def get_version(self) -> str:
        return VERSION

    @gl.public.write
    def record_outcome(self, proposal_id: str) -> dict:
        """Anyone may call. Only a committed EXECUTED or BLOCK decision is recorded, at most once."""
        if self.recorded.get(proposal_id, ""):
            _fail(ERROR_EXPECTED, "ALREADY_RECORDED")
        proposal = SentinelProposalRead(Address(self.sentinel)).view().get_proposal(proposal_id)
        if proposal.get("proposal_type") != TREASURY_PROPOSAL:
            _fail(ERROR_EXPECTED, "NOT_A_TREASURY_PROPOSAL")
        spender = str(proposal["proposer"]).lower()
        # The Sentinel reports status EXECUTED once the vault callback is finalized. execution_status is SUCCEEDED then.
        executed = proposal.get("status", "") == EXECUTED
        verdict = proposal.get("verdict", "")
        stats = self._stats(spender)
        now = _now_ts()
        if executed:
            stats["clean"] = int(stats["clean"]) + 1
            outcome = "CLEAN_EXECUTED"
            amount = int(proposal["amount"])
            self.claims[proposal_id] = _canonical({
                "proposal_id": proposal_id,
                "spender": spender,
                "amount": amount,
                "state": RESERVED,
                "reserved_at": now,
                "expires_at": now + CLAIM_WINDOW_SECONDS,
            })
            self.claim_ids.append(proposal_id)
        elif verdict == VERDICT_BLOCK:
            stats["violations"] = int(stats["violations"]) + 1
            stats["frozen"] = True
            outcome = "VIOLATION_BLOCKED"
        else:
            _fail(ERROR_EXPECTED, "NOT_A_COUNTABLE_FINAL_OUTCOME")
        self.spender_stats[spender] = _canonical(stats)
        receipt = {"proposal_id": proposal_id, "spender": spender, "outcome": outcome, "recorded_at": now}
        self.recorded[proposal_id] = _canonical(receipt)
        return {"receipt": receipt, "stats": stats, "multiplier": _multiplier(stats)}

    @gl.public.write
    def claim(self, proposal_id: str) -> int:
        raw = self.claims.get(proposal_id, "")
        if not raw:
            _fail(ERROR_EXPECTED, "NO_RESERVED_CLAIM")
        claim = json.loads(raw)
        if gl.message.sender_address.as_hex.lower() != claim["spender"]:
            _fail(ERROR_EXPECTED, "ONLY_RESERVED_SPENDER_CAN_CLAIM")
        if claim["state"] != RESERVED:
            _fail(ERROR_EXPECTED, "CLAIM_NOT_RESERVED")
        if _now_ts() >= int(claim["expires_at"]):
            _fail(ERROR_EXPECTED, "CLAIM_EXPIRED")
        # Verify the credit against the vault's own execution record before paying out.
        execution = SentinelVaultRead(Address(self.vault)).view().get_execution(proposal_id)
        if not execution.get("exists") or int(execution["amount"]) != int(claim["amount"]):
            _fail(ERROR_EXPECTED, "VAULT_CREDIT_NOT_VERIFIED")
        claim["state"] = CLAIMED
        claim["claimed_at"] = _now_ts()
        self.claims[proposal_id] = _canonical(claim)
        return int(claim["amount"])

    @gl.public.write
    def expire_claim(self, proposal_id: str) -> None:
        """Deterministic fallback for an unclaimed reservation past its window."""
        raw = self.claims.get(proposal_id, "")
        if not raw:
            _fail(ERROR_EXPECTED, "NO_RESERVED_CLAIM")
        claim = json.loads(raw)
        if claim["state"] != RESERVED:
            _fail(ERROR_EXPECTED, "CLAIM_NOT_RESERVED")
        if _now_ts() < int(claim["expires_at"]):
            _fail(ERROR_EXPECTED, "CLAIM_WINDOW_NOT_ENDED")
        claim["state"] = EXPIRED
        self.claims[proposal_id] = _canonical(claim)

    @gl.public.view
    def get_spender(self, spender: str) -> dict:
        stats = self._stats(spender.lower())
        return {"spender": spender.lower(), "stats": stats, "multiplier": _multiplier(stats)}

    @gl.public.view
    def get_recorded(self, proposal_id: str) -> dict:
        raw = self.recorded.get(proposal_id, "")
        return json.loads(raw) if raw else {}

    @gl.public.view
    def get_claim(self, proposal_id: str) -> dict:
        raw = self.claims.get(proposal_id, "")
        return json.loads(raw) if raw else {}

    @gl.public.view
    def get_claim_ids(self, offset: u256, limit: u256) -> list:
        if limit == 0 or limit > 50:
            _fail(ERROR_EXPECTED, "INVALID_PAGE_LIMIT")
        return [self.claim_ids[i] for i in range(int(offset), min(len(self.claim_ids), int(offset) + int(limit)))]

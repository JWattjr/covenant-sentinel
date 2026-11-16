# Covenant Sentinel architecture

Covenant Sentinel separates deterministic limits from appealable judgment.
The frontend is an untrusted convenience layer: it prepares inputs, displays
contract state, tracks the GenLayer transaction lifecycle, and submits a real
appeal transaction when eligible. It never computes or persists an authoritative
verdict.

```text
User / autonomous agent
          │ real signed transaction
          ▼
  Covenant Sentinel (GenLayer IC)
   ├─ deterministic validation (IDs, roles, domains, amounts, state)
   ├─ leader fetches bounded approved HTTPS evidence
   ├─ leader proposes a bounded structured verdict
   └─ validators refetch evidence and independently re-evaluate
          │
          ├─ Accepted (provisional; appealable, never executes vault)
          ▼
      Finalized parent receipt
          │ finality-safe IC message only for ALLOW
          ▼
      Sentinel Vault (GenLayer IC)
       ├─ only accepts Covenant Sentinel as caller
       ├─ replay protection by proposal / incident ID
       ├─ simulated treasury accounting
       └─ temporary emergency pause
          │ finality-safe acknowledgement
          ▼
  Covenant Sentinel marks executed after child finalization
```

The MVP deliberately has no EVM or cross-chain adapter. Studio does not support
arbitrary EVM contract calls from an Intelligent Contract, and a relayer would
need separate trust and security assumptions.

## State machine

```text
PENDING → EVALUATING → ALLOW / TIMELOCK / BLOCK / INSUFFICIENT_EVIDENCE
                         │
                         └─ ALLOW → EXECUTION_QUEUED → EXECUTED

PENDING → CANCELLED
```

`EVALUATING` is an in-transaction state. A failed consensus execution rolls it
back to `PENDING`; it never creates a misleading completed decision. An allowed
proposal becomes `EXECUTION_QUEUED` only after consensus accepts the parent
transaction. The child vault message is emitted with `on="finalized"`, so no
vault operation happens during the accepted/appeal window.

## Evidence and consensus boundary

The contract accepts at most five HTTPS evidence URLs on approved domains. It
rejects localhost, private-network names, raw IPs, unsupported schemes, and
overlong inputs before any web call. Validators receive the same policy version
and manifest, independently retrieve a bounded text excerpt, and independently
produce a validated structured verdict. The comparison requires agreement on
verdict, risk level, reason category, and safety-critical violated rules.

Model output, web pages, and evidence metadata are untrusted. The contract
stores URLs plus compact structured findings, never whole webpages. Transport
failure and HTTP errors fail closed; malformed model output is classified as an
LLM error and rotates rather than becoming an allow.

## Defense suite (added)

Three contracts sit beside the Sentinel and Vault. None of them changes the existing pair.

| Contract | Judgment | Source of truth | Fallback |
| --- | --- | --- | --- |
| `UpgradeGuard` (`contracts/upgrade_guard.py`) | ADVANCE, HOLD or ROLLBACK, with one quoted diff line | Commit-pinned old and new source, checked by SHA-256 | DECLARED or HELD past 24 h → VOID |
| `PolicyAmendments` (`contracts/policy_amendments.py`) | LOOSENS, TIGHTENS or NEUTRAL, with one quoted clause | Commit-pinned replacement text, compared with the frozen policy | PROPOSED past 24 h → VOID; PENDING → ACTIVE only after the verdict's delay |
| `TreasuryRecord` (`contracts/treasury_record.py`) | None (no model) | Committed Sentinel proposal state | RESERVED claim past 7 days → EXPIRED |

Rules that hold across all three:

- The model returns strict JSON with a closed set of keys. The quote must be a substring of the evidence the code itself fetched.
- Validators agree on the evidence: each one fetches the sources and checks the leader's quote against its own copy. They do not need identical quotes.
- Unreachable or mismatched evidence is VOID. Nothing is decided against a party.
- No amount is set by the model. The treasury amounts come from the Sentinel's record.
- Every wait has a deadline and a deterministic transition. Time windows are at least 30 minutes.

Live cases and the recorded proof are described in `deploy/proof-v1.json` and `docs/submission/milestone-v1.json`. The console at `/defense` shows the recorded proof and live reads separately.

Known limits, stated rather than hidden:

- The existing Sentinel's policy is not changed by PolicyAmendments. Publishing an amendment into the Sentinel needs the governor's key, which was not available. Amendment verdicts are recorded, and enforcement depends on the governor's publish.
- The vault credit is simulated DEMO accounting, not a native token transfer.
- Appeals are not exposed on StudioNet, so the LOOSENS appeal window is displayed but cannot be acted on.
- The direct-mode test harness allows one contract per test and does not advance the contract clock. Treasury cross-contract behaviour and time-based transitions are therefore proven by the live run, not by the direct tests.

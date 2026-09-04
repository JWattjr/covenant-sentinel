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

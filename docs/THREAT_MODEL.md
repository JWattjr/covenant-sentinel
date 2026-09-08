# Threat model

Covenant Sentinel exists to make one class of failure impossible: an
irreversible treasury action taken on an unverified, unappealable, or fabricated
justification. This document states what it defends against, how, and — just as
importantly — what it does not defend against.

## Assets

| Asset | Where it lives | What loss looks like |
| --- | --- | --- |
| Simulated `DEMO` treasury balance | `SentinelVault.demo_balance` | An unauthorized or policy-violating transfer executes |
| Availability of the treasury | `SentinelVault.paused` | A fabricated incident freezes legitimate spending |
| Policy integrity | `CovenantSentinel.policies` | A proposal is judged under a policy nobody agreed to |
| Decision integrity | `Proposal.verdict` and friends | An ALLOW is recorded that consensus never actually produced |
| Evidence perimeter | `approved_domains` | An attacker-controlled source becomes admissible |

## Trust boundaries

```
untrusted ─────────────────────────────────────────► trusted
 web page   frontend   proposer   reporter   governor   consensus
    │          │          │          │          │          │
    │          │          │          │          │          └─ authoritative
    │          │          │          │          └─ can publish policy + release a pause,
    │          │          │          │             cannot transfer, cannot pause
    │          │          │          └─ can only submit an incident for evaluation
    │          │          └─ can only submit a proposal for evaluation
    │          └─ can only prepare and display; never authoritative
    └─ data only; never instructions
```

---

## Adversary 1 — A malicious or compromised proposer

**Goal:** move funds out of the treasury.

| Attempt | Control |
| --- | --- |
| Request more than the cap | R1 is checked in `submit_treasury_proposal` *before* any nondeterministic work. There is no path where the LLM can waive it. |
| Reuse an approved action ID to double-spend | `SentinelVault.executed_actions` rejects a repeated `action_id`; `_create_proposal` rejects a duplicate proposal ID at submission. |
| Point evidence at a server they control | Every URL must be HTTPS and resolve to an approved domain or subdomain. Raw IPs, `localhost`, `.localhost`, `127.*`, `10.*`, `192.168.*`, `169.254.*`, userinfo (`@`) and explicit ports (`:`) are rejected. |
| Flood the evaluator with sources | At most five URLs, at most 2,000 characters each, at most 10,000 characters of manifest; duplicates rejected. |
| Overwhelm the prompt with a huge page | Each fetched body is truncated to 6,000 characters before it reaches the model. |
| Craft a purpose string that is really an instruction | The purpose is bounded to 280 characters and is presented as a labelled field, not as evaluator instructions. |

**Residual risk.** A proposer who genuinely persuades an approved, credible
source to publish supporting content can obtain an ALLOW. That is the intended
behaviour of an evidence-based policy — the control is the *perimeter*, not
omniscience.

---

## Adversary 2 — Prompt injection inside the evidence

**Goal:** make the evaluator emit an ALLOW regardless of the facts.

Fetched pages are wrapped in explicit `BEGIN/END UNTRUSTED EVIDENCE <id>`
delimiters and the system framing states that evidence is data, never
instructions. That framing alone is not a security control, so the real defence
is downstream and deterministic:

* The response must be JSON with a `verdict` from a closed enum, a `risk_level`
  from a closed enum, and a `reason_code` from a closed enum.
* `violated_rule_ids` and `satisfied_rule_ids` must be known rule IDs.
* Every `evidence_findings[].source_id` must be one of the source IDs the
  contract itself assigned this run. **A fabricated source is rejected**, which
  is exercised by `test_invented_evidence_source_is_rejected_even_with_prompt_injection_text`.
* Action-specific invariants gate the dangerous direction only:
  * A transfer `ALLOW` requires `LOW`/`MEDIUM` risk, `PURPOSE_ALIGNED`, and no
    R3 or R4 violation.
  * A `BLOCK` must name a violated rule; a `TIMELOCK` must cite R4 with
    `CONFLICTING_EVIDENCE`.
  * An emergency `ALLOW` requires `CRITICAL` risk, R5 satisfied, and
    `EMERGENCY_CONFIRMED`.
* Anything else raises an `[LLM_ERROR]`, which is treated as **disagreement**
  and rotates the leader. Malformed output is never cemented into state
  (`test_malformed_or_invented_model_fields_rotate_instead_of_allowing`).

**Residual risk.** An injection that produces a *well-formed, internally
consistent* ALLOW on a page that every validator also fetches would pass. The
mitigations against that are the domain allowlist, independent validator
refetching, and the appeal window — not the schema.

**This applies to our own demo fixtures.** An early revision of the StudioNet
evidence fixtures carried a `policy_mapping` block naming the expected verdict,
reason code, and rule IDs. Nothing in the contract rejected it — the resulting
answer was well-formed and every validator fetched the same page — so the
evaluator was transcribing a verdict rather than deriving one. That is precisely
the residual risk above, demonstrated against ourselves. The fixtures now state
observable facts only, and `frontend/public/evidence/README.md` records the rule
that they must never name a verdict, reason code, or rule ID again.

---

## Adversary 3 — A dishonest leader

**Goal:** propose a verdict the evidence does not support.

`validator_fn` does **not** inspect the leader's JSON for well-formedness. Each
validator independently re-runs `_produce_independent_verdict`: it refetches the
same approved URLs and re-runs the evaluator on its own node, then requires
agreement on verdict, risk level, reason code, and the violated rule set. A
leader that reports `ALLOW` on evidence that reads `BLOCK` is voted down and
rotated (`test_validator_independently_rechecks_the_substantive_verdict`).

Errors are compared by *class*, not by luck: `[EXPECTED]` and `[EXTERNAL]`
errors must match exactly, `[TRANSIENT]` errors match category, and matching
`[LLM_ERROR]` output is deliberately treated as disagreement.

---

## Adversary 4 — A malicious or compromised governor

**Goal:** drain or freeze the treasury using their privileges.

| Attempt | Control |
| --- | --- |
| Call the vault directly | `SentinelVault._require_sentinel` accepts exactly one address. The governor is not it. |
| Re-point the vault at a contract they control | `configure_sentinel` is one-time (`sentinel_configured`) and refuses the governor's own address. |
| Re-point the Sentinel at a vault they control | `configure_guarded_vault` is one-time and refuses the governor's own address. |
| File their own emergency report | `submit_emergency_pause_proposal` explicitly rejects the governor and requires a registered reporter. |
| Appoint themselves reporter | `configure_reporter` refuses the governor address. |
| Publish a permissive policy to unlock a pending proposal | Every proposal stores `policy_version` at submission and is evaluated against that stored version (`test_policy_versions_are_immutable_for_submitted_proposals`). |
| Pause the treasury unilaterally | There is no governor pause path at all. A pause requires a reporter, two independent domains, and an ALLOW verdict. |

The one governor power over the vault is `release_emergency_pause`, and it only
*reduces* restriction. It requires an `EXECUTED` emergency proposal and still
travels as a finality-safe Sentinel message; the vault verifies the incident owns
the current pause.

**Residual risk.** A governor can publish a policy that is bad *going forward*,
and can decline to release a pause. Both are visible on-chain and are governance
problems rather than authorization bypasses.

---

## Adversary 5 — Racing the appeal window

**Goal:** execute against a decision that is about to be overturned.

Nothing executes on acceptance. `evaluate_proposal` sets `EXECUTION_QUEUED` and
emits the vault call with `emit(on="finalized")`. The vault's acknowledgement
back to the Sentinel is also `on="finalized"`. Until the parent transaction
finalizes, an appeal can still change the outcome and no demo unit has moved and
no pause is active.

The console mirrors this: a receipt is only "successful" when the consensus
status is decided **and** `txExecutionResultName` is `FINISHED_WITH_RETURN`, and
`DECIDED` is rendered as explicitly not durable.

---

## Adversary 6 — Availability and infrastructure

| Attempt | Control |
| --- | --- |
| Take the evidence host offline mid-evaluation | A non-2xx or unreachable source short-circuits to a **deterministic** `INSUFFICIENT_EVIDENCE` with `EVIDENCE_UNAVAILABLE`. No LLM call happens, and it can never become an ALLOW (`test_conflicting_and_unavailable_evidence_fail_closed`). |
| Serve different content to different validators | Validators disagree, the leader rotates, and no verdict is recorded. Divergence surfaces as consensus failure rather than as a silent decision. |
| Grief the queue with junk proposals | Submission costs a real transaction, IDs must be unique, and evaluation is a separate opt-in call. Junk proposals sit at `PENDING` and are inert. |
| Spoof the vault's execution acknowledgement | `record_vault_execution` calls `_require_vault()` and additionally requires the proposal to be in `EXECUTION_QUEUED` with a matching execution kind. |

---

## Accepted residual risk

These are limitations, stated plainly rather than papered over:

1. **The treasury is simulated.** `demo_balance` is integer accounting. This
   system has not been designed or audited for real custody, and adding a token
   or bridge adapter needs its own trust model.
2. **A pause does not self-expire.** Intelligent contracts do not wake on a
   clock. The approved bound is recorded and enforced as a *maximum authorized*
   duration; the actual release is a manual, governor-initiated, finality-safe
   message. The UI says so.
3. **The allowlist is hygiene, not truth.** An approved domain that is itself
   compromised, or that publishes a wrong report, will be believed by leader and
   validators alike. Consensus protects against a dishonest *node*, not against a
   dishonest *source*.
4. **Model capability is a dependency.** Validator agreement is required, so a
   model that is uniformly wrong across all validators produces a uniformly wrong
   — but appealable — verdict.
5. **No cross-chain execution.** There is no EVM adapter or relayer, so nothing
   here defends a relayer's trust assumptions, because there is no relayer.
6. **The frontend is not a control.** Its input validation exists to avoid
   wasting a transaction. Every check it performs is repeated on-chain, and a
   caller who skips the UI entirely gains nothing.

# Demo script

A five-minute walkthrough that shows all four safe outcomes and, crucially, the
gap between a *decision* and an *irreversible effect*.

## Before you start

Two terminals, plus a browser.

**Terminal 1 — local simulator (Windows):**

```bash
.venv/Scripts/python config/glsim_windows.py --port 4000 --validators 5 --no-browser --seed covenant-sentinel
```

**Terminal 2 — deploy and wire:**

```bash
genlayer network set localnet && genlayer deploy
```

Copy the two printed addresses into `frontend/.env.local`, then:

```bash
npm run dev
```

Have the reporter address ready (`COVENANT_REPORTER_ADDRESS` at deploy time, or
`genlayer write <sentinel> configure_reporter --args 0x… true`). It must not be
the governor.

> If you are demoing without a live simulator, run the integration suite instead —
> it proves the same five behaviours end to end with five validators:
> `.venv/Scripts/gltest tests/integration/ -v -s --network localnet`

---

## 0:00 — The premise (30s)

Open the console. Point at the header metrics: **policy v1**, the **hard transfer
cap**, the **guarded balance**, and **vault protection**.

> "This treasury has a written constitution. Rule R1 — the transfer cap — is
> arithmetic, so it lives in contract code. Rules R2 through R5 are judgement
> calls about purpose, security, and evidence, so they live in GenLayer
> consensus. The point of this demo is that the judgement is *enforceable*, not
> advisory."

---

## 0:30 — Deterministic refusal (45s)

In **Controlled submission**, request an amount above the cap and submit.

The form refuses before spending a transaction, and — the part that matters —
so does the contract: `submit_treasury_proposal` raises
`transfer exceeds HARD_MAX_TRANSFER` before any web fetch or LLM call.

> "No model was consulted. The cap is not a suggestion the AI can be talked out
> of; it is a precondition for the AI ever being asked."

Try a second refusal: an `http://` evidence URL, or a domain outside the
allowlist shown in **Evidence perimeter**.

---

## 1:15 — ALLOW, but nothing moves yet (90s)

Submit a legitimate request:

| Field | Value |
| --- | --- |
| Action ID | `security-audit-001` |
| Recipient | any address other than the governor |
| Amount | comfortably under the cap |
| Purpose | `Independent protocol security audit` |
| Evidence | one HTTPS URL on an approved domain |

Select it in the queue, then press **Evaluate through consensus**.

While it runs, narrate what is actually happening:

> "The leader is fetching that URL and running the evaluator. Every validator is
> *independently refetching the same URL and rerunning the evaluator on its own
> node*. They are not checking the leader's JSON is well-formed — they are
> checking they reach the same verdict."

When it returns, the decision trace shows `ALLOW`, the risk level, the satisfied
and violated rule chips, the reason code, and per-source findings tagged `E1`,
`E2`, …

**Now the important beat.** Point at two things at once:

* the proposal's execution state: **`QUEUED_FINALITY`**, and
* the lifecycle rail: phase **`DECIDED`**, not `FINALIZED`.

> "Consensus has decided. The guarded balance has not changed by a single unit.
> The vault instruction was emitted with `on=\"finalized\"`, so it is physically
> undeliverable while this transaction is still appealable. If you disagree with
> this AI decision, the **Appeal** button is right there — and it is a real
> appeal bond through the SDK, not a UI gesture."

Press **Refresh lifecycle** until the phase reaches `FINALIZED`. The rail lists
the **child messages** the contract emitted. Refresh the dashboard: the balance
has now dropped and the proposal reads `EXECUTED` / `SUCCEEDED`.

> "That second child message is the vault acknowledging its own execution — also
> finality-safe. The Sentinel only records `EXECUTED` because the vault told it
> the transfer really happened, not because it hoped so."

---

## 2:45 — BLOCK on security evidence (45s)

Submit `bridge-integration-001` with evidence describing an unresolved critical
exploit at the counterparty, and evaluate.

Result: `BLOCK`, `SECURITY_CRITICAL_EVIDENCE`, R3 in the violated chips,
execution state `NOT_QUEUED`.

> "No vault message was ever emitted. There is no queued action to appeal into
> existence, and no operator override anywhere in this system."

---

## 3:30 — Fail closed (45s)

Submit a proposal whose evidence host returns a 5xx, then evaluate.

Result: `INSUFFICIENT_EVIDENCE`, reason `EVIDENCE_UNAVAILABLE`, risk `HIGH`.

> "Watch what did *not* happen: the model was never asked. An unreachable source
> short-circuits deterministically. The failure mode of this system is refusal,
> never optimism."

Conflicting credible sources produce the fourth outcome, `TIMELOCK` with R4 and
`CONFLICTING_EVIDENCE` — a decision to *wait*, not to act.

---

## 4:15 — The emergency path and its honest limit (45s)

Switch the composer to **Emergency**. Sign as the **reporter** account, not the
governor. File `active-exploit-001` with two URLs on two *different* approved
domains, requesting 24 hours.

> "The governor is structurally barred from filing this. Two independent domains
> are required. And note the inversion: a `CRITICAL` risk finding *rejects* a
> transfer, but `CRITICAL` is precisely what *authorizes* a bounded protective
> pause. That asymmetry is deliberate and it is tested."

Evaluate. On `ALLOW` and finality, vault protection flips to paused and treasury
actions start reverting.

Finish on the limitation rather than hiding it:

> "This pause does not expire on its own. Intelligent contracts do not wake
> themselves on a clock. The vault records the maximum authorized duration; the
> release is a manual, governor-initiated, finality-safe message — **Queue safe
> release** in the trace. We chose to show that constraint rather than pretend
> the chain has a timer."

---

## 5:00 — Close (20s)

> "Deterministic limits in code. Judgement under consensus with independent
> validator re-derivation. Untrusted evidence constrained to an allowlist and a
> closed output schema. Effects gated on finality. An appeal path for the
> decisions you dispute. That is what a policy engine has to look like before
> anyone should let an AI near a treasury."

---

## Cheat sheet

| Show this | Expect |
| --- | --- |
| Over-cap transfer | Deterministic revert, no LLM call |
| `http://` or off-allowlist URL | Deterministic revert |
| Aligned purpose, credible source | `ALLOW` → `QUEUED_FINALITY` → `EXECUTED` |
| Unresolved critical exploit evidence | `BLOCK`, R3, `NOT_QUEUED` |
| Two credible sources that contradict | `TIMELOCK`, R4 |
| Evidence host down | `INSUFFICIENT_EVIDENCE`, `EVIDENCE_UNAVAILABLE` |
| Governor files an incident | Reverts — reporter required |
| Reporter files with 2 domains, confirmed | Pause after finality; manual release only |

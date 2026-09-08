# Demo script

A five-minute walkthrough that shows all four safe outcomes and, crucially, the
gap between a *decision* and an *irreversible effect*.

## 60-second reviewer walkthrough

No wallet or transaction is required.

**0:00–0:10 — Open Explorer.** Point out that this is live StudioNet contract
state for a simulated DEMO treasury using controlled synthetic evidence. The
page never replaces a failed read with sample records; if StudioNet is busy,
use **Try live read again**.

**0:10–0:35 — Open `live-audit-001`.** Show `ALLOW`, `LOW`,
`PURPOSE_ALIGNED`, its satisfied rules and the per-source validator finding.
Finish on vault execution: `SUCCEEDED` means the simulated guarded vault
acknowledged a finality-safe instruction; the verdict alone did not move value.

**0:35–0:55 — Open `live-bridge-001`.** Show `BLOCK`, `CRITICAL`,
`SECURITY_CRITICAL_EVIDENCE`, violated rule R3 and `NOT_QUEUED`. No vault
instruction exists for the blocked request.

**0:55–1:00 — Close.** “Same policy engine, two evidence-backed outcomes:
one finalized DEMO action and one refusal. The evidence and execution record
remain inspectable without connecting a wallet.”

## Before you start

The hosted StudioNet demo is at <https://covenant-sentinel.vercel.app>, wired to:

- Sentinel: `0x7CeA0E0D9E2a343C29fdDa253d3925c3Aba9b924`
- Guarded Vault: `0xEB10CF48D9EffA69b66d9013289F5206631E86e9`
- Network: GenLayer Studio Network (`61999`)

The evidence fixtures are controlled and synthetic. They make no claims about a
real protocol, organization, or incident — and, deliberately, they name **no
verdict, reason code, or rule ID**. They state observable facts and let the
evaluator do the judging; `scripts/check_evidence_fixtures.py` fails CI if that
ever regresses. This matters on stage: the outcomes below were derived, not
transcribed.

| Exercises | Evidence URL(s) |
| --- | --- |
| Aligned purpose, clean counterparty | `/evidence/allow-security-audit.json` |
| Unpatched, actively exploited target | `/evidence/block-critical-exploit.json` |
| Two assessors who disagree | `/evidence/conflict-safe.json` and `/evidence/conflict-risk.json` |
| Approved host, non-2xx response | `/evidence/unavailable.json` (intentionally 404) |

The public dashboard reads through a same-origin endpoint that serializes the
contract calls and shares a two-minute verified snapshot across visitors. This
keeps browser CORS restrictions and repeated tabs from multiplying StudioNet's
500-request-per-hour public RPC budget. A failed read stays visibly unavailable
and can be retried; it is never replaced with sample records.

The live queue is pre-seeded and verified at finality:

| Proposal | Outcome produced by consensus | Evaluation transaction |
| --- | --- | --- |
| `live-audit-001` | `ALLOW` / `LOW` / `PURPOSE_ALIGNED` → `EXECUTED` / `SUCCEEDED` | `0x5ebe23fd243a3d712b46ba8cce2f33620bdb5a06bda8be84b2768d99d3726c14` |
| `live-bridge-001` | `BLOCK` / `CRITICAL` / `SECURITY_CRITICAL_EVIDENCE` | `0xb9490b3ec63d98dbd3a262682d69a20a21aed0ee97ce90beb1574055d111eeb5` |
| `live-contested-001` | `TIMELOCK` / `HIGH` / `CONFLICTING_EVIDENCE` | `0x149cca4b63c93580db26045d0e642da889fd85308e66b46b45c19b14a17f5c06` |
| `live-offline-001` | `INSUFFICIENT_EVIDENCE` / `HIGH` / `EVIDENCE_UNAVAILABLE` | `0xf91277ead3c6f7ce4f2e0192e36f696630cfd85f9f8aeeee35b3e3943bb06f5b` |

The allowed proposal released its vault instruction only after the evaluation
finalized, and the vault acknowledged only after its own execution:

```
evaluate 0x5ebe23fd…d3726c14
  └─ vault execution 0x51a5ea38…74394a63
       └─ Sentinel callback 0x6a5101c5…0359ed1c
```

The guarded balance is therefore `24,900 DEMO`, down from `25,000 DEMO`.

Re-seed a fresh deployment on any network with one command:

```bash
COVENANT_SEED_LIVE_DEMO=1 COVENANT_EVIDENCE_DOMAINS=covenant-sentinel.vercel.app genlayer deploy
```

The installed stable `genlayer-js` StudioNet profile does not expose the appeal,
fee-manager, or rounds-storage contracts, so it cannot quote the safe appeal
charge. The hosted console intentionally hides the Appeal action and does not
label these StudioNet decisions appealable. Demonstrate the accepted-versus-
finalized safety boundary here; demonstrate a bonded appeal on a network/client
profile that exposes the supported appeal path.

### Local fallback

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
| Action ID | `demo-audit-001` (any unused id) |
| Recipient | any address other than the governor |
| Amount | comfortably under the cap |
| Purpose | `Independent review of the Covenant Sentinel intelligent contracts` |
| Evidence | `https://covenant-sentinel.vercel.app/evidence/allow-security-audit.json` |

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
> undeliverable until this transaction finalizes. On a network that exposes the
> safe appeal-charge path, this provisional window is where a bonded appeal can
> challenge the decision. The current stable StudioNet client does not expose
> that path, and the UI says so instead of displaying a fake button."

Press **Refresh lifecycle** until the phase reaches `FINALIZED`. The rail lists
the **child messages** the contract emitted. Refresh the dashboard: the balance
has now dropped and the proposal reads `EXECUTED` / `SUCCEEDED`.

> "That second child message is the vault acknowledging its own execution — also
> finality-safe. The Sentinel only records `EXECUTED` because the vault told it
> the transfer really happened, not because it hoped so."

---

## 2:45 — BLOCK on security evidence (45s)

Submit `demo-bridge-001` with
`https://covenant-sentinel.vercel.app/evidence/block-critical-exploit.json`
as its evidence, and evaluate. That fixture describes an unpatched, actively
exploited authorization bypass — it never says the word "block".

Result: `BLOCK`, `SECURITY_CRITICAL_EVIDENCE`, R3 in the violated chips,
execution state `NOT_QUEUED`.

> "No vault message was ever emitted. There is no queued action to appeal into
> existence, and no operator override anywhere in this system."

---

## 3:30 — Fail closed (45s)

Submit `demo-offline-001` pointing at
`https://covenant-sentinel.vercel.app/evidence/unavailable.json`
— an approved host with no document there — then evaluate.

Result: `INSUFFICIENT_EVIDENCE`, reason `EVIDENCE_UNAVAILABLE`, risk `HIGH`.

> "Watch what did *not* happen: the model was never asked. An unreachable source
> short-circuits deterministically. The failure mode of this system is refusal,
> never optimism."

Conflicting credible sources produce the fourth outcome. Submit one proposal
carrying **both** `https://covenant-sentinel.vercel.app/evidence/conflict-safe.json`
and `https://covenant-sentinel.vercel.app/evidence/conflict-risk.json`:
two independent assessors, same target, same patch, opposite conclusions. The
result is `TIMELOCK` with R4 and `CONFLICTING_EVIDENCE` — a decision to *wait*,
not to act. Neither fixture asks for a timelock; the evaluator infers it from the
disagreement.

---

## 4:15 — The emergency path and its honest limit (45s)

Run this section on the local fallback or another deployment with two approved
evidence domains. The hosted treasury-outcome demo currently approves one
controlled domain, so its two-domain emergency precondition cannot be met.

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
> closed output schema. Effects gated on finality. Protocol-level appeals where
> the selected network exposes the safe bonded-appeal path. That is what a
> policy engine has to look like before anyone should let an AI near a treasury."

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

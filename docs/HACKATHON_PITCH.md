# Covenant Sentinel — the pitch

## One line

**A constitutional firewall for on-chain treasuries: the AI verdict *is* the
authorization, and it cannot move a single unit until it has survived finality.**

---

## The problem

DAOs and protocol treasuries fail in a specific, boring way. A multisig signs a
transfer because a proposal *said* it was for a security audit, or because
someone in a call *said* the counterparty was safe. The written constitution
exists — in a forum post. The enforcement is a human reading a document under
time pressure.

Every existing fix is a compromise:

* **Multisigs** verify signatures, not reasons. They cannot read a policy.
* **Timelocks** buy time, but somebody still has to notice and act.
* **Oracles** can deliver a number. They cannot answer "does this spend
  materially advance protocol security?"
* **Off-chain AI reviewers** produce an opinion that a human still has to
  translate into a transaction — so the AI is advisory, and the trust gap is
  exactly where it was.

## Why this is a GenLayer problem specifically

Every one of the five properties this needs is a GenLayer primitive:

| Need | GenLayer primitive |
| --- | --- |
| Judge free text against a written policy | Native LLM access inside the state transition |
| Use live web evidence | Native validated web access — no trusted oracle relay |
| Make a subjective call trustworthy | Equivalence principle: leader proposes, validators independently re-derive |
| Make an AI decision contestable | Optimistic democracy + appeal bond |
| Never act on a provisional result | `emit(on="finalized")` child messages |

Remove GenLayer and this is not a worse product; it is a different, advisory one.

## What we built

Two intelligent contracts and an operator console.

**`CovenantSentinel`** holds immutable policy versions and runs the decision.
Every deterministic limit — the transfer cap, identifier hygiene, HTTPS-only
evidence, at most five URLs, the domain allowlist, the raw-IP and private-address
bans, the reporter requirement, the 72-hour pause ceiling — is enforced **before**
anything nondeterministic runs. Then the leader fetches the approved evidence
and evaluates; **every validator refetches that evidence and reruns the
evaluator itself**, and they must agree on verdict, risk, reason, and violated
rules.

**`SentinelVault`** is a separate guarded child that answers to exactly one
Sentinel address, configured once. The governor cannot bypass it. It has replay
protection by action ID and it can be paused.

The gap between them is the whole idea:

```
ALLOW ──emit(on="finalized")──► Vault executes ──emit(on="finalized")──► EXECUTED
      └── appealable window: nothing has moved ──┘
```

## The three things that make this more than a demo

**1. It fails closed, deterministically.** If an evidence source returns a 5xx,
the contract returns `INSUFFICIENT_EVIDENCE` **without calling the model at
all**. There is no code path in which "we couldn't check" becomes "go ahead."

**2. The model cannot invent its way to an approval.** Output must be JSON with
closed enums, known rule IDs, and — the important one — every cited evidence
source must be a source ID *the contract itself assigned this run*. A fabricated
`E7` is rejected. Malformed output is classified as an LLM error and treated as
**disagreement**, so the leader rotates rather than the bad JSON becoming state.
We have a test that feeds prompt-injection text through this path.

**3. Validators do substantive work, not shape checks.** `validator_fn` does not
inspect the leader's JSON structure. It re-derives the verdict from scratch. A
leader reporting ALLOW on evidence that reads BLOCK loses the vote.

## The detail we are proudest of

A `CRITICAL` risk assessment must **reject** a treasury transfer. But `CRITICAL`
is exactly the condition that **authorizes** a bounded protective emergency
pause. An early version applied the high-risk rejection to both action types,
which silently made the emergency path unusable — a correct-looking rule that
broke the safety feature it was meant to protect. The validator now scopes that
invariant to treasury transfers only, and the asymmetry is tested in both
directions.

That is the kind of bug that only shows up when the AI verdict is load-bearing
rather than decorative.

## What we deliberately did not fake

* The treasury is **simulated integer accounting**. We are not claiming custody
  of real TVL on a hackathon timeline.
* **Pauses do not self-expire.** Contracts do not wake themselves. The vault
  records the maximum authorized duration; release is a manual, governor-
  initiated, finality-safe message. The UI says this out loud.
* **The allowlist is source hygiene, not truth.** Consensus defends against a
  dishonest node, not a dishonest source.
* **The frontend is not a control.** It refuses to render invented state — no
  addresses configured means an explicit "deployment not configured" panel, not
  a mock dataset.

## Evidence it works

* **GenVM lint** clean on both contracts.
* **16 direct-mode tests**: deterministic guardrails, policy immutability under
  version changes, adversarial evidence and prompt injection, the full proposal
  lifecycle, and vault authorization plus replay.
* **5 integration tests on a five-validator local GLSim**: an allowed transfer
  executing only after finality, a block that never reaches the vault,
  conflicting evidence producing a timelock with full validator agreement,
  unavailable evidence failing closed with no LLM allow, and a finalized
  emergency pause followed by a safe manual release.
* **Frontend** typechecks and builds, and reads exclusively through the official
  GenLayer JS SDK. No raw EVM JSON-RPC anywhere in the repository.

## Where it goes next

1. Real asset custody behind an independently audited adapter.
2. Multi-signer policy amendment with its own timelock.
3. A reputation-weighted reporter set instead of a governor-curated one.
4. Policy diffing, so an operator can see exactly which clause changed between
   versions and which pending proposals were bound to which.

## The ask

Judge it on one question: *if this held real money, would the failure modes be
the ones you would choose?* Refusal on missing evidence. Rotation on malformed
output. No effect before finality. No privileged bypass — including for the
person who deployed it.

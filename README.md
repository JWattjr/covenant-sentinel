# Covenant Sentinel

**A constitutional firewall for on-chain treasuries, built as a pair of GenLayer Intelligent Contracts.**

Most "AI governance" demos ask a model a question and print the answer. Covenant
Sentinel makes the answer an *enforceable state transition*: a proposal is bound
to an immutable policy version, evidence is fetched from an approved perimeter
by the leader **and independently re-fetched by every validator**, the verdict is
produced under consensus, and the guarded vault is only ever instructed by a
finality-safe message. Nobody — not the governor, not the frontend, not a keeper —
can move the treasury by any other path.

---

## Why this needs GenLayer

| Requirement | Why an ordinary chain cannot do it |
| --- | --- |
| Judge a spend request against a written policy | Needs an LLM, natively, inside the state transition |
| Read the live web as evidence | Needs native, validated web access — not a trusted oracle feed |
| Make disagreement safe | Needs an equivalence principle: leader proposes, validators independently re-derive |
| Make an AI decision appealable | Needs the optimistic-democracy lifecycle and an appeal bond |
| Never act on a provisional decision | Needs `on="finalized"` child messages |

Everything that *can* be arithmetic stays arithmetic. GenLayer consensus is used
only for the part that genuinely cannot be reduced to a number.

---

## The two contracts

### `contracts/covenant_sentinel.py` — policy and consensus

* Governor-only policy creation and publication. Policy versions are immutable
  and every proposal is permanently bound to the version it was judged under.
* Two proposal kinds:
  * `submit_treasury_proposal(action_id, target, asset_id, amount, purpose, evidence_manifest_json)`
  * `submit_emergency_pause_proposal(incident_id, guarded_target, incident_claim, evidence_manifest_json, requested_pause_hours)`
* **Deterministic guardrails run before any nondeterministic work**: transfer cap
  (R1), identifier and text limits, HTTPS-only evidence, at most five URLs, the
  approved-domain allowlist including subdomains, and rejection of raw IPs and
  local/private addresses. Emergency reports additionally require a non-governor
  authorized reporter, two independent approved domains, and at most 72 hours.
* Evaluation runs through `gl.vm.run_nondet_unsafe`. The leader fetches the
  approved evidence and runs the evaluator; **each validator refetches the same
  evidence and reruns the evaluator itself**, then compares verdict, risk level,
  reason category, and safety-critical violated rules.
* Model output is strict JSON, validated against closed enums, known rule IDs,
  known evidence source IDs, bounded findings, and action-specific invariants.
  Anything malformed is an LLM error that rotates — never an allow.
* Four safe outcomes: `ALLOW`, `TIMELOCK`, `BLOCK`, `INSUFFICIENT_EVIDENCE`.
  Unreachable evidence is a *deterministic* `INSUFFICIENT_EVIDENCE`.

### `contracts/sentinel_vault.py` — the guarded child

* Accepts transfers, pauses, and pause releases from exactly **one** Sentinel
  address, configured once and irreversibly. The governor cannot bypass it.
* Replay protection by action / incident ID, with a stored execution record.
* An active pause blocks treasury actions.
* Uses simulated `DEMO` accounting units. This is deliberately **not** custody of
  a real asset — see [`docs/DECISIONS.md`](docs/DECISIONS.md).

### The finality contract between them

```
evaluate_proposal → ALLOW
        │  emit(on="finalized")            ← nothing has moved yet
        ▼
SentinelVault.execute_authorized_transfer  ← runs only after parent finality
        │  emit(on="finalized")
        ▼
CovenantSentinel.record_vault_execution    ← proposal becomes EXECUTED
```

An **accepted** decision is provisional. On networks whose client profile
exposes the appeal contracts it is also appealable; either way, it cannot move a
demo unit or activate a pause before finality. The dashboard shows accepted and
finalized as different things, on purpose.

> **A note on the risk rule.** A `CRITICAL` risk assessment must reject a
> treasury transfer — but a critical risk is exactly the condition that
> *authorizes* a bounded protective pause. The validator therefore applies the
> high/critical rejection to treasury transfers only. Regressing this would make
> the emergency path unusable.

---

## Repository layout

```
contracts/            CovenantSentinel + SentinelVault intelligent contracts
tests/direct/         16 fast in-memory tests with mocked web and LLM
tests/integration/     5 full five-validator consensus tests against GLSim
deploy/deployScript.ts Ordered, verified deployment and wiring
frontend/             Next.js operator console (see frontend/README.md)
config/               GenLayer config plus a Windows GLSim launcher
docs/                 Architecture, decisions, threat model, demo, pitch, ops
```

---

## Quick start

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
npm install
```

### Lint both contracts

```bash
.venv/Scripts/genvm-lint check contracts/covenant_sentinel.py
```

```bash
.venv/Scripts/genvm-lint check contracts/sentinel_vault.py
```

On a Windows console the linter can die with `UnicodeEncodeError` while printing
its own `✓`. That is a cp1252 stdout problem, not a lint failure — prefix the
command with `PYTHONIOENCODING=utf-8`.

### Direct-mode tests (fast, no simulator)

```bash
.venv/Scripts/pytest tests/direct/ -v
```

### Full consensus integration tests

Start a five-validator local GLSim first. On Windows use the bundled launcher —
the upstream Windows runner has a temporary-file/stdin defect:

```bash
.venv/Scripts/python config/glsim_windows.py --port 4000 --validators 5 --no-browser --seed covenant-sentinel
```

Then, in a second shell:

```bash
.venv/Scripts/gltest tests/integration/ -v -s --network localnet
```

### Frontend

```bash
npm run dev
```

---

## Deployed instance (StudioNet)

A live pair is deployed and wired on GenLayer StudioNet, with the operator
console at <https://covenant-sentinel.vercel.app>.
`deploy/last-deployment.json` holds the full record.

| Contract | Address |
| --- | --- |
| `CovenantSentinel` | `0xdE348d4F02f8e8F4362A4146790541b18659809A` |
| `SentinelVault` | `0x71E2CD156cE4F447A324Fb7981b45ecbF0FF6870` |

Policy `covenant-v1` v1 has a 10,000 DEMO cap. The guarded balance is 24,900
DEMO after the verified ALLOW fixture executed, and the active evidence domain
is `covenant-sentinel.vercel.app`. The queue contains finality-verified ALLOW,
BLOCK, TIMELOCK, and INSUFFICIENT_EVIDENCE examples plus a real browser-wallet
fail-closed evaluation. To point a local console at it, put this in
`frontend/.env.local`:

```
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_COVENANT_SENTINEL_ADDRESS=0xdE348d4F02f8e8F4362A4146790541b18659809A
NEXT_PUBLIC_COVENANT_VAULT_ADDRESS=0x71E2CD156cE4F447A324Fb7981b45ecbF0FF6870
```

The current stable `genlayer-js` StudioNet profile does not expose the appeal,
fee-manager, or rounds-storage contracts needed to quote and submit a safe
appeal. The hosted console therefore does not claim that a StudioNet decision
is appealable or render an Appeal button. Appeal support remains a protocol
capability to exercise on a network/client profile that exposes the safe appeal
charge path.

---

## Deployment

`deploy/deployScript.ts` performs the whole wiring in a fixed order and verifies
**both** the consensus status and the GenVM execution result at every step,
because the two bindings are one-time and irreversible.

```bash
genlayer network set studionet
```

```bash
genlayer deploy
```

Order: Vault → Sentinel → `configure_sentinel` → `configure_guarded_vault` →
`create_initial_policy` → approved evidence domains → optional reporter. The
script writes `deploy/last-deployment.json` and prints the two environment
variables the frontend needs.

Optional environment overrides:

| Variable | Default | Meaning |
| --- | --- | --- |
| `COVENANT_INITIAL_DEMO_BALANCE` | `25000` | Simulated starting balance |
| `COVENANT_MAX_TRANSFER` | `10000` | R1 hard cap in the published policy |
| `COVENANT_POLICY_ID` | `covenant-v1` | Canonical policy identifier |
| `COVENANT_POLICY_FILE` | *(built-in R1–R5)* | Path to a policy text file |
| `COVENANT_EVIDENCE_DOMAINS` | demo pair | Comma-separated allowlist |
| `COVENANT_REPORTER_ADDRESS` | *(unset)* | Non-governor emergency reporter |

Contract deployment and interaction go exclusively through the official GenLayer
CLI and JS SDK. There is no raw EVM JSON-RPC path anywhere in this repository.

---

## Documentation

| Document | Contents |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Component diagram, state machine, evidence boundary |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Why the runner is pinned, why finality gates effects, why the treasury is simulated |
| [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) | Adversaries, attack surfaces, mitigations, and accepted residual risk |
| [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) | A timed walkthrough of the four outcomes |
| [`docs/HACKATHON_PITCH.md`](docs/HACKATHON_PITCH.md) | The judge-facing argument |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | Runbook: deploy, verify, respond, release a pause |

---

## Honest scope

* The treasury is **simulated integer accounting**, not custody of a real or
  bridged asset.
* There is no EVM adapter or cross-chain relayer. Adding one requires a separate,
  independently audited trust model.
* Pauses do **not** self-expire. Intelligent contracts do not wake themselves, so
  the vault records the approved bound and the governor issues a manual,
  finality-safe release. This is stated in the product and the docs rather than
  faked.
* The domain allowlist is a source-*hygiene* control. It does not prove a source
  is correct or uncompromised.

## License

MIT — see [`LICENSE`](LICENSE).

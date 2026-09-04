# Operations runbook

Practical procedures for deploying, verifying, and operating a Covenant Sentinel
pair. Everything here uses the official GenLayer CLI and JS SDK; there is no raw
EVM JSON-RPC path in this repository.

## 1. Prerequisites

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
```

```bash
npm install
```

A configured, unlocked GenLayer account with a positive balance on the target
network:

```bash
genlayer account list
```

```bash
genlayer network set studionet
```

```bash
genlayer account show
```

## 2. Pre-deployment gate

Never deploy without all four of these passing. The two contract bindings are
one-time and irreversible, so a bad deployment is a discarded deployment.

```bash
.venv/Scripts/genvm-lint check contracts/covenant_sentinel.py && .venv/Scripts/genvm-lint check contracts/sentinel_vault.py
```

```bash
.venv/Scripts/pytest tests/direct/ -v
```

```bash
.venv/Scripts/gltest tests/integration/ -v -s --network localnet
```

```bash
npm run lint && npm run build
```

The integration suite needs a local simulator. On Windows use the bundled
launcher — the upstream Windows runner has a temporary-file/stdin defect:

```bash
.venv/Scripts/python config/glsim_windows.py --port 4000 --validators 5 --no-browser --seed covenant-sentinel
```

## 3. Deployment

Configure the deployment through the environment, then run one command.

```bash
COVENANT_MAX_TRANSFER=10000 COVENANT_INITIAL_DEMO_BALANCE=25000 COVENANT_EVIDENCE_DOMAINS=security.example.org,incident.example.net genlayer deploy
```

The script performs seven ordered steps and verifies both the consensus status
and the GenVM execution result after each one:

| Step | Call | Reversible? |
| --- | --- | --- |
| 1 | Deploy `SentinelVault(initial_demo_balance)` | n/a |
| 2 | Deploy `CovenantSentinel()` | n/a |
| 3 | `vault.configure_sentinel(sentinel)` | **No — one-time** |
| 4 | `sentinel.configure_guarded_vault(vault)` | **No — one-time** |
| 5 | `sentinel.create_initial_policy(text, cap, id)` | No — version 1 is immutable |
| 6 | `sentinel.configure_evidence_domain(domain, true)` | Yes — can be disabled later |
| 7 | `sentinel.configure_reporter(address, true)` | Yes |

Results land in `deploy/last-deployment.json` and are printed as the two
environment variables the console needs.

**If a step fails after step 3 or 4**, do not attempt to re-run the script
against the same contracts. The binding cannot be repeated. Deploy a fresh pair.

## 4. Post-deployment verification

Confirm the wiring from the chain, not from the script's output:

```bash
genlayer call <SENTINEL_ADDRESS> get_guarded_vault_configuration
```

Expect `vault_configured: true` and `guarded_vault` equal to the deployed vault.

```bash
genlayer call <VAULT_ADDRESS> get_state
```

Expect `sentinel_configured: true`, `sentinel` equal to the deployed Sentinel,
`paused: false`, and the funded `demo_balance`.

```bash
genlayer call <SENTINEL_ADDRESS> get_approved_evidence_domains
```

```bash
genlayer call <SENTINEL_ADDRESS> get_policy --args 1
```

Then point the console at it:

```bash
cp frontend/.env.example frontend/.env.local
```

Fill in `NEXT_PUBLIC_COVENANT_SENTINEL_ADDRESS`,
`NEXT_PUBLIC_COVENANT_VAULT_ADDRESS`, and `NEXT_PUBLIC_GENLAYER_RPC_URL`, then
restart `npm run dev` — `NEXT_PUBLIC_*` values are inlined at build time.

Complete one browser-wallet submission before calling the console production
ready. The console discovers MetaMask by its EIP-6963 identity and reuses that
same provider for account state and signing; this avoids account/method
mismatches when another EVM wallet extension also injects `window.ethereum`.
Verify this once in a browser profile that has the actual extension mix judges
or operators will use.

## 5. Routine operations

**Publish a new policy version.** Existing proposals stay bound to the version
they were submitted under; only new submissions pick up the new one.

```bash
genlayer write <SENTINEL_ADDRESS> publish_policy --args "R1 — ..." 12000 covenant-v2
```

**Add or remove an evidence domain.**

```bash
genlayer write <SENTINEL_ADDRESS> configure_evidence_domain --args security.example.org true
```

Removing a domain does not retroactively invalidate a stored proposal's URLs,
but a re-evaluation of a still-pending proposal will fetch them again.

**Authorize or revoke an emergency reporter.** The address must not be the
governor.

```bash
genlayer write <SENTINEL_ADDRESS> configure_reporter --args 0xREPORTER true
```

**Inspect a transaction end to end.**

```bash
genlayer receipt <TX_HASH>
```

```bash
genlayer trace <TX_HASH>
```

## 6. Incident response

### An emergency pause is active

1. Confirm it on-chain: `genlayer call <VAULT_ADDRESS> get_state` shows
   `paused: true` with the owning `pause_incident_id`.
2. Read the decision: `genlayer call <SENTINEL_ADDRESS> get_proposal --args <INCIDENT_ID>`
   for the verdict, risk level, cited rules, and per-source findings.
3. Verify the evidence yourself. The pause is a bounded protective measure, not
   a verdict about the underlying incident.
4. When the threat is resolved, the **governor** releases it:

```bash
genlayer write <SENTINEL_ADDRESS> release_emergency_pause --args <INCIDENT_ID>
```

The proposal moves to `UNPAUSE_QUEUED` and the vault unpauses after the message
finalizes. **The pause does not expire on its own** — intelligent contracts do
not wake themselves on a clock. The recorded duration is the maximum authorized
bound, not a timer.

### A decision looks wrong

Appeal it while the transaction is still appealable, from the console's
lifecycle rail or from the CLI:

```bash
genlayer appeal-bond <TX_HASH>
```

```bash
genlayer appeal <TX_HASH>
```

An appeal widens the validator set and re-runs the decision. It is only possible
before finality — which is precisely why no vault effect happens before then.

The stable `genlayer-js` 1.1.8 StudioNet profile has no appeal,
fee-manager, or rounds-storage contract metadata, so `appeal-bond` cannot quote
the required charge there. Do not guess a zero bond or call the low-level
`submitAppeal` surface. The console hides Appeal when the client cannot confirm
eligibility; use a network/client profile that exposes the supported safe appeal
charge path for an end-to-end appeal test.

### An evaluation keeps failing to reach consensus

Repeated rotation usually means the validators genuinely disagree. Check:

* Is an evidence host serving different content to different nodes, or rate
  limiting? Confirm with `genlayer trace <TX_HASH>`.
* Is the model returning output that fails schema validation? That surfaces as
  an `[LLM_ERROR]`, which is treated as disagreement **by design** so bad JSON
  never becomes state.

There is no override. Cancel the proposal and resubmit with better sources:

```bash
genlayer write <SENTINEL_ADDRESS> cancel_proposal --args <PROPOSAL_ID>
```

## 7. What operators cannot do

Stated explicitly, because the absence of these levers is the product:

* Move funds without an ALLOW verdict that has finalized.
* Pause the vault directly — a pause requires a non-governor reporter, two
  independent approved domains, and a consensus ALLOW.
* Re-point either contract at a different counterpart after the one-time binding.
* Change the policy version a pending proposal will be judged under.
* Force an execution through the UI. The console has no privileged path; it makes
  exactly the same calls any wallet could.

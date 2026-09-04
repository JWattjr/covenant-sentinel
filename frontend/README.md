# Covenant Sentinel — operator console

A Next.js dashboard for the Covenant Sentinel intelligent contracts. It is a
deliberately **untrusted convenience layer**: it prepares inputs, displays
contract state, follows the GenLayer transaction lifecycle, and can post an
appeal bond. It never computes, caches, or persists an authoritative verdict.

## Design rules this console follows

1. **No invented state.** Every number on screen comes from a `readContract`
   call against the deployed pair. With no addresses configured, the page shows
   an explicit *"Deployment not configured"* panel naming the missing variables —
   not a demo dataset. If a read fails, the error is shown verbatim.
2. **Decided ≠ done.** A GenLayer receipt is treated as successful only when the
   consensus status is decided **and** the GenVM execution result is
   `FINISHED_WITH_RETURN`. The lifecycle rail distinguishes `SUBMITTED`,
   `DECIDED`, `FINALIZED`, `FAILED`, and `APPEALED`, and says in plain language
   that a decided transfer has not moved anything yet.
3. **Child messages are visible.** Each receipt lists the transactions the
   contract triggered (`getTriggeredTransactionIds`), so the finality-safe
   Sentinel → Vault → Sentinel path is observable rather than asserted.
4. **The form is never the authority.** Client-side checks mirror the contract's
   guardrails purely to save a wasted transaction. The contract repeats all of
   them.

## Configuration

Copy `.env.example` to `.env.local` and fill in the addresses printed by
`npm run deploy` from the repository root.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_COVENANT_SENTINEL_ADDRESS` | yes | Deployed `CovenantSentinel` |
| `NEXT_PUBLIC_COVENANT_VAULT_ADDRESS` | yes | Deployed `SentinelVault` |
| `NEXT_PUBLIC_GENLAYER_RPC_URL` | yes | GenLayer JSON-RPC endpoint |
| `NEXT_PUBLIC_GENLAYER_CHAIN_ID` | no | Used by the MetaMask add/switch-chain helper |
| `NEXT_PUBLIC_GENLAYER_CHAIN_NAME` | no | Display name for that helper |
| `NEXT_PUBLIC_GENLAYER_SYMBOL` | no | Native symbol for that helper |

The chain is derived from the RPC URL: a `localhost`/`127.0.0.1` endpoint uses
`localnet`, an endpoint containing `asimov` uses `testnetAsimov`, anything else
uses `studionet`.

`NEXT_PUBLIC_*` values are inlined at build time, so restart the dev server after
editing them.

## Commands

Run from the repository root (the frontend is an npm workspace):

```bash
npm run dev
```

```bash
npm run lint
```

```bash
npm run build
```

`lint` is `tsc --noEmit`; `build` is the Next.js production build, which
typechecks again.

## What the panels do

| Panel | Contract source |
| --- | --- |
| Active policy, hard transfer cap | `get_current_policy_version`, `get_policy` |
| Guarded balance, vault protection | `SentinelVault.get_state` |
| Proposal queue | `get_proposal_ids` → `get_proposal` |
| Decision trace | the selected proposal's verdict, risk, rule IDs, findings, evidence links, execution status |
| Controlled submission | `submit_treasury_proposal`, `submit_emergency_pause_proposal` |
| Evaluate through consensus | `evaluate_proposal` |
| Queue safe release | `release_emergency_pause` (governor only, executed pauses only) |
| Lifecycle observer | `waitForTransactionReceipt`, `getTransaction`, `getTriggeredTransactionIds`, `canAppeal` |
| Evidence perimeter | `get_approved_evidence_domains` |

## Appeals

The documented flow is:

```ts
const charge = await client.getAppealCharge({ txId });
await client.appealTransaction({ txId, value: charge });
```

`genlayer-js@1.1.x` — the version pinned here — names the bond query
`getMinAppealBond`. `lib/covenant/client.ts` prefers `getAppealCharge` when the
installed SDK exposes it and falls back to `getMinAppealBond` otherwise, so the
console works on both without ever guessing a bond value. The appeal button only
appears when `canAppeal({ txId })` returns true.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 ·
TanStack Query · `genlayer-js` · MetaMask via `window.ethereum`.

## Layout

```
app/            layout, providers, and the single console page
components/     console panels (queue, detail, composer, rail, overview)
lib/covenant/   typed SDK client, dashboard hook, shared types
lib/genlayer/   wallet provider and MetaMask/network helpers
```

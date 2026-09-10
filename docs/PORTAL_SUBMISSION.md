# GenLayer project submission

> **Steward: open the resolved-cases Explorer directly:**
> https://covenant-sentinel.vercel.app/explorer

Paste the copy below into the project portal. The demo video is optional and can
remain blank. Production verification in this guide was performed on
2026-09-10 at 09:20 UTC.

## Response to steward

### Requested page separation

The production app has four independent Next.js routes with URL-changing
navigation. Each URL returned HTTP 200 and rendered its intended page after a
direct load and reload:

- Overview: https://covenant-sentinel.vercel.app/
- Resolved cases: https://covenant-sentinel.vercel.app/explorer
- Submission workflow: https://covenant-sentinel.vercel.app/submit
- Operator workflow: https://covenant-sentinel.vercel.app/operate

### Requested resolved-case explorer

The public, wallet-free Explorer is available at
https://covenant-sentinel.vercel.app/explorer. It displayed four resolved
StudioNet cases at verification time and exposed verdict, policy version,
approved evidence, validator findings, reason code, request details, and vault
execution state.

### Public case verification

- `live-audit-001`: `ALLOW`, Policy v1, evidence URL and three rule-bound
  findings visible, vault execution `SUCCEEDED`.
- `live-bridge-001`: `BLOCK`, Policy v1, critical-exploit evidence and an R3
  finding visible, vault execution `NOT QUEUED`.
- `live-contested-001`: `On hold` (`TIMELOCK`), Policy v1, conflicting evidence,
  vault execution `NOT QUEUED`. On hold does not automatically release.
- `live-offline-001`: `INSUFFICIENT_EVIDENCE`, reason
  `EVIDENCE_UNAVAILABLE`, vault execution `NOT QUEUED`.

The interface explicitly labels the treasury as simulated DEMO state and the
evidence pages as controlled synthetic evidence.

### Production provenance

- Production deployment ID: `dpl_DaDTwdgSANpNeTafsRNRKub5qxFY`
- Immutable deployment URL:
  https://covenant-sentinel-lkp8p0y9y-wattxs-projects.vercel.app
- Production alias: https://covenant-sentinel.vercel.app
- Deployed: 2026-09-08 at 10:10:05 UTC
- Vercel project root: `.` in the linked `frontend` directory
- Framework/build settings: Next.js; default `npm run build`; default output
- Application implementation commit: `e65c168`
- Vercel source metadata: `cli`; Vercel did not record a Git commit SHA for
  this deployment

The verified deployment manifest contains route outputs for `/`, `/explorer`,
`/submit`, `/operate`, and `/api/dashboard`. The Vercel project is not linked to
a Git repository, so publishing the repository commit does not trigger or
replace production.

### Screenshot evidence

- [Explorer route and four cases](evidence/portal-review-2026-09-10/explorer-overview.png)
- [Allowed case: policy, evidence, verdict, and successful vault execution](evidence/portal-review-2026-09-10/explorer-approved-case.png)
- [Blocked case: policy, evidence, verdict, and not-queued vault state](evidence/portal-review-2026-09-10/explorer-blocked-case.png)
- [Separate Submit route](evidence/portal-review-2026-09-10/submit-route.png)
- [Separate Operate route](evidence/portal-review-2026-09-10/operate-route.png)

### Ready-to-paste steward response

> The requested separation and resolved-case Explorer are live in production.
> Please open the Explorer directly at
> https://covenant-sentinel.vercel.app/explorer — it is a real `/explorer`
> route, works without a wallet, survives direct reload, and currently shows
> four resolved StudioNet cases. `live-audit-001` exposes Policy v1, approved
> evidence, validator findings, an ALLOW verdict, and vault execution SUCCEEDED;
> `live-bridge-001` exposes Policy v1, critical-exploit evidence, an R3 finding,
> a BLOCK verdict, and vault execution NOT QUEUED. The app is also separated
> into overview `/`, submission `/submit`, and operator `/operate` routes, with
> navigation that changes the URL. Browser screenshots are in
> https://github.com/JWattjr/covenant-sentinel/tree/feat/live-evidence-demo/docs/evidence/portal-review-2026-09-10.

## Identity

- **Logo:** `frontend/public/covenant-sentinel-logo.png` (512 x 512 PNG, under 2 MB)
- **Project name:** Covenant Sentinel
- **Primary tag:** Infrastructure (or the closest `Infrastructure & Tooling` option)
- **Tag 1:** Security
- **Tag 2:** Governance (use `Treasury Management` instead if offered)

## One-liner

> A constitutional firewall for on-chain treasuries: GenLayer validators evaluate live evidence, enforce policy, fail closed, and release actions only after finality.

## Description

> Covenant Sentinel is an intelligent-contract firewall for on-chain treasuries. Every proposal passes deterministic controls—authorized reporter, transfer cap, valid IDs, HTTPS evidence, approved domains, replay protection, and emergency pause—before AI evaluation. GenLayer validators independently fetch evidence, apply a versioned covenant, and reach consensus on ALLOW, BLOCK, TIMELOCK, or INSUFFICIENT_EVIDENCE. SentinelVault releases approved actions only after finality; every other outcome stays unqueued. The live StudioNet deployment uses labeled synthetic evidence and includes all four finalized outcomes. The repo provides direct tests, integration scenarios, a threat model, deployment provenance, and an official-SDK console with separate public, submission, and operator routes. It protects a simulated DEMO treasury and claims no real TVL.

## Demo video

Leave the optional YouTube URL blank unless a polished recording is available.

## How-to

### 1. Open the resolved-case Explorer

Visit https://covenant-sentinel.vercel.app/explorer directly. Confirm the URL
remains `/explorer` after reload and that four resolved cases appear without a
wallet.

### 2. Inspect an approved execution

Select `live-audit-001`. Confirm `ALLOW`, Policy v1, the approved evidence URL,
three validator findings, and vault execution `SUCCEEDED`.

### 3. Inspect a blocked execution

Select `live-bridge-001`. Confirm `BLOCK`, Policy v1, the critical-exploit
evidence, the R3 finding, and vault execution `NOT QUEUED`.

### 4. Verify page separation

Use the header navigation to open `/submit` and `/operate`. Confirm that the URL
changes and that each route contains only its intended workflow.

### 5. Inspect the proof

Review the screenshot evidence linked above, then inspect `docs/DEMO_SCRIPT.md`,
`docs/THREAT_MODEL.md`, `deploy/last-deployment.json`, and `tests/` in the
repository.

## Expected verification outcome

> The steward should see covenant-v1 and four resolved StudioNet proposals on
> `/explorer`: ALLOW, BLOCK, TIMELOCK (shown as On hold), and
> INSUFFICIENT_EVIDENCE. Only `live-audit-001` has vault execution SUCCEEDED;
> every non-ALLOW case is NOT QUEUED. The interface labels the treasury DEMO and
> the evidence synthetic.

## Contract links

1. Sentinel: https://explorer-studio.genlayer.com/address/0x7CeA0E0D9E2a343C29fdDa253d3925c3Aba9b924
2. Vault: https://explorer-studio.genlayer.com/address/0xEB10CF48D9EffA69b66d9013289F5206631E86e9

## Project links

- **Website:** https://covenant-sentinel.vercel.app
- **Explorer:** https://covenant-sentinel.vercel.app/explorer
- **GitHub:** https://github.com/JWattjr/covenant-sentinel

## Evidence and supporting information

The required repository evidence is:

https://github.com/JWattjr/covenant-sentinel

If the form accepts more links, add these in order:

1. https://covenant-sentinel.vercel.app/explorer
2. https://github.com/JWattjr/covenant-sentinel/tree/feat/live-evidence-demo/docs/evidence/portal-review-2026-09-10
3. https://explorer-studio.genlayer.com/address/0x7CeA0E0D9E2a343C29fdDa253d3925c3Aba9b924
4. https://explorer-studio.genlayer.com/address/0xEB10CF48D9EffA69b66d9013289F5206631E86e9

## 60-second walkthrough

- **0–10s:** Open `/explorer`; point to the URL, four resolved cases, and the
  wallet-free disclosure.
- **10–30s:** Select `live-audit-001`; point to Policy v1, evidence, ALLOW,
  validator findings, and `SUCCEEDED`.
- **30–50s:** Select `live-bridge-001`; point to Policy v1, exploit evidence,
  R3, BLOCK, and `NOT QUEUED`.
- **50–60s:** Use the header to open `/submit` and `/operate`; point out that the
  URL and workflow change on each page.

## Final check

- Open the direct Explorer URL, not only the homepage.
- Attach the Explorer and case-detail screenshots to the resubmission if the
  portal accepts images or links.
- Keep the YouTube field blank if no polished recording is available.
- Submit only after reviewing the portal preview for truncation or broken links.

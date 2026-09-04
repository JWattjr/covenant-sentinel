# GenLayer project submission

Paste the following copy into the project portal. The demo video is optional and
should be left blank unless a polished recording is available before the deadline.

## Identity

- **Logo:** `frontend/public/covenant-sentinel-logo.png` (512 x 512 PNG, under 2 MB)
- **Project name:** Covenant Sentinel
- **Primary tag:** Infrastructure (or the closest `Infrastructure & Tooling` option)
- **Tag 1:** Security
- **Tag 2:** Governance (use `Treasury Management` instead if offered)

## One-liner

164 of 180 characters:

> A constitutional firewall for on-chain treasuries: GenLayer validators evaluate live evidence, enforce policy, fail closed, and release actions only after finality.

## Description

868 of 1,000 characters:

> Covenant Sentinel is an intelligent-contract firewall for on-chain treasuries. Every proposal passes deterministic controls—authorized reporter, transfer cap, valid IDs, HTTPS evidence, approved domains, replay protection, and emergency pause—before AI evaluation. GenLayer validators independently fetch evidence, apply a versioned covenant, and reach consensus on ALLOW, BLOCK, TIMELOCK, or INSUFFICIENT_EVIDENCE. SentinelVault releases approved actions only after finality; every other outcome stays unqueued. The live StudioNet deployment uses labeled synthetic evidence and includes all four finalized outcomes, plus a real MetaMask-submitted fail-closed proposal. The repo provides 16 direct tests, 5 integration scenarios, a threat model, deployment provenance, and an official-SDK operator console. It protects a simulated DEMO treasury and claims no real TVL.

## Demo video

Leave the optional YouTube URL blank.

## How-to

Add these five steps in order.

### 1. Open the live console

Visit https://covenant-sentinel.vercel.app. Wait for the StudioNet snapshot to
load; the header should identify Sentinel `0xdE34…809A` and Vault
`0x71E2…6870`.

### 2. Compare all verdicts

Open `live-allow-002`, `live-block-001`, `live-timelock-001`, and
`live-unavailable-001`. Confirm the contract records ALLOW, BLOCK, TIMELOCK,
and INSUFFICIENT_EVIDENCE.

### 3. Trace authorization

Open `live-allow-002` and confirm the vault state is EXECUTED/SUCCEEDED. Open
the other three and confirm they are NOT_QUEUED: non-ALLOW verdicts never reach
the vault.

### 4. Verify fail-closed behavior

Open `wallet-ui-unavailable-001`. It was submitted through MetaMask against an
approved hostname with a missing path. Confirm EVIDENCE_UNAVAILABLE,
INSUFFICIENT_EVIDENCE, and NOT_QUEUED.

### 5. Inspect the proof

Open the repository and review `docs/DEMO_SCRIPT.md`, `docs/THREAT_MODEL.md`,
`deploy/last-deployment.json`, and `tests/`. The README contains exact
verification commands and the deployed-source provenance limits.

## Expected verification outcome

414 of 500 characters:

> The steward should see covenant-v1, both StudioNet contract addresses, and five finalized proposals. The four seeded cases show ALLOW, BLOCK, TIMELOCK, and INSUFFICIENT_EVIDENCE. Only live-allow-002 reaches the vault (EXECUTED/SUCCEEDED), reducing the simulated balance to 24,900 DEMO; every non-ALLOW case remains NOT_QUEUED. wallet-ui-unavailable-001 must show EVIDENCE_UNAVAILABLE and leave the vault unchanged.

## Contract links

1. Sentinel: https://explorer-studio.genlayer.com/address/0xdE348d4F02f8e8F4362A4146790541b18659809A
2. Vault: https://explorer-studio.genlayer.com/address/0x71E2CD156cE4F447A324Fb7981b45ecbF0FF6870

## Project links

- **Website:** https://covenant-sentinel.vercel.app
- **GitHub:** https://github.com/JWattjr/covenant-sentinel

## Evidence and supporting information

The required repository evidence is:

https://github.com/JWattjr/covenant-sentinel

If the form accepts more links, add these in order:

1. https://covenant-sentinel.vercel.app
2. https://explorer-studio.genlayer.com/address/0xdE348d4F02f8e8F4362A4146790541b18659809A
3. https://explorer-studio.genlayer.com/tx/0xdc043ee18c6aa358f67074a6eb01bf5df7e710a47898cf67dcde22c149d60ce6

## Final check

- Keep the YouTube field blank.
- Confirm the selected tags match the portal's exact taxonomy.
- Open the website and both contract links once before submitting.
- Submit only after reviewing the portal preview for truncation or broken links.

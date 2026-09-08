# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Public reviewers, judges, and prospective treasury stewards need to verify what the system actually decided and whether an approved action reached the guarded vault. This priority is confirmed by the steward feedback supplied on September 7, 2026.
- Treasury operators submit payment requests and approved evidence, then inspect policy, consensus, finality, and vault execution without confusing those stages.
- Governors and authorized reporters manage policy and emergency controls through the contracts; the public interface must not imply that ordinary visitors have those privileges.

## Product Purpose

Covenant Sentinel stops treasury payments that violate a versioned spending policy. A request is checked deterministically, evaluated against approved web evidence by GenLayer validators, and sent to the simulated guarded vault only when an ALLOW decision survives finality. Success means a first-time visitor can understand the request, policy, evidence, verdict, finality, and execution result without connecting a wallet.

## Positioning

Covenant Sentinel is an intelligent-contract firewall rather than a recommendation dashboard: validators independently refetch approved evidence and reach consensus on a closed-schema verdict, while the paired vault accepts instructions only from the Sentinel after finality.

## Operating Context

- The judge-facing experience reads live GenLayer StudioNet contract state.
- Public visitors inspect finalized cases without a wallet.
- Operators connect a wallet only when they need to submit or evaluate a proposal.
- The repository and explorer links provide source, transaction, and deployment provenance for review.
- The current public deployment demonstrates a simulated DEMO treasury with controlled synthetic evidence fixtures.

## Capabilities and Constraints

- Supported verdicts are ALLOW, BLOCK, TIMELOCK, and INSUFFICIENT_EVIDENCE.
- TIMELOCK currently means the request is on hold. It does not schedule automatic release or execution; the supported next step is a new proposal with improved or reconciled evidence.
- The interface must distinguish verdict, consensus finality, and successful vault execution.
- Loading, unavailable reads, and genuinely empty contract state are different states. Failed reads must never be rendered as zero values or synthetic fallback records.
- Evidence URLs are inspectable and restricted by the contract's approved-source rules.
- Treasury balances and transfers use simulated DEMO accounting, not real-asset custody or TVL.
- The current StudioNet client profile does not expose the metadata needed for a safely quoted appeal path, so the public UI must not promise appeals.
- Emergency controls and automatic release behavior must be described only when the selected live deployment can demonstrate them.

## Brand Commitments

- Product name: Covenant Sentinel.
- Preserve the shield-check identity and the product's security-first, evidence-first voice.
- The user selected https://unfair.so/ as a binding reference for feel: decisive editorial hierarchy, generous space, proof-led storytelling, task-specific pages, and purposeful motion. Do not copy its name, assets, illustrations, or creator-marketing visual language.

## Evidence on Hand

- Live app: https://covenant-sentinel.vercel.app
- Maintained deployment record: `deploy/last-deployment.json`
- Public evidence fixtures: `frontend/public/evidence/`
- Judge/demo runbook: `docs/DEMO_SCRIPT.md`
- Threat model and limitations: `docs/THREAT_MODEL.md`
- Direct and integration tests under `tests/`
- No real customers, real TVL, production custody, or independently published case study is available and none may be fabricated.

## Product Principles

1. Prove the control path before explaining the architecture.
2. Give each job a focused surface: understand, inspect, and operate.
3. Make every status honest about what happened on-chain and what did not.
4. Keep public verification wallet-free; reserve wallet friction for actions.
5. Treat evidence as untrusted input and disclose synthetic fixtures clearly.

## Accessibility & Inclusion

No project-specific conformance level has been confirmed. Preserve semantic controls, visible focus, readable contrast, keyboard access, responsive layouts, and reduced-motion behavior as the implementation floor.

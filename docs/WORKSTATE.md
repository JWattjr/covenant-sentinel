# Work state: Covenant Sentinel defense suite (resume log)

Scope: Phases 1-4 in one run, final report only. Network: StudioNet 61999.
Existing Sentinel `0x7CeA0E0D9E2a343C29fdDa253d3925c3Aba9b924` and Vault `0xEB10CF48D9EffA69b66d9013289F5206631E86e9` are NOT modified or redeployed.

## Stop conditions (only these)
- a step would exceed the 1,000-wei deposit cap
- a signature or funding is needed that the user has not given (the one funding transfer)
- a core contract flaw means live cases cannot run

## Known constraints found while reading
- Sentinel `publish_policy` and `configure_*` are governor-only. Governor is `0xdB433ff614bDD1ecE21Aa97221C3E0a7ecf79c92`. No governor key exists in the repo. Publishing a new policy into the Sentinel needs that signature, so it is blocked (recorded, not faked).
- Spend submission and `evaluate_proposal` are open to any caller. Live spend cases can run from the test account.
- Vault is simulated DEMO accounting (no native token transfer). "Native payout" is recorded as a DEMO vault execution.
- Writes on StudioNet go with `value 0`. The existing Sentinel's writes carried 0. No deposit is needed so far.

## Log
- 2026-11-16 Phase 1 verified: Sentinel + Vault live on 61999. Probe contract `0x500dF64C816bd38e87FFBE139476b7EFbD7fc20b` fetched a commit-pinned raw GitHub file, hash matched. Deposit 0.
- Phase 2 started: writing `contracts/upgrade_guard.py`, `contracts/policy_amendments.py`, `contracts/treasury_record.py`.
- Contracts written and linted: `contracts/upgrade_guard.py`, `contracts/policy_amendments.py`, `contracts/treasury_record.py`.
- Direct tests: `tests/direct/test_defense_suite.py` (12 pass, 13 skipped). Skips: 8 treasury tests need two live contracts (one contract per direct-test harness), 5 clock tests need a contract clock the harness does not advance. Both are covered by the live run.
- Fixtures committed at `c123cb20394afbc0e3b5af808527cb316b42a6bd` (`defense-fixtures/`), pushed to `feat/live-evidence-demo`. SHA-256 taken from the served bytes.
- Live run started: `scripts/run-case.mjs`, log `artifacts/run-case.log`, state `artifacts/defense-state.json` (resumable).
- Governor-gated step (publishing the amended policy into the existing Sentinel) is NOT possible: no governor key. Case 7 runs against policy v1.
- Live: UpgradeGuard `0x0955558524A5c5BD268956A34218CF1B6510c3F8`, PolicyAmendments `0x5c483CDb9862F756CdC7651eCAb407490844Cb7f`, TreasuryRecord `0xc975f413C69dae2049393a51e24f78461a7BE501` (all FINALIZED).
- Case 1 (TIGHTEN planned): judged NEUTRAL, reason CLARIFICATION_ONLY, quote = R1 clause. Real result recorded; not rerun. Deviation from plan.
- Case 2 LOOSENS: judged LOOSENS (reason REMOVES_CONSTRAINT), effective after 60 min.
- Case 3 ADVANCE: judged ADVANCE, state ADVANCED, quote = docstring line.
- RPC gateway returned HTML on one gas estimate; client used default gas. Send still went through. Noted.
- Cases 3-6 results recorded on chain (ADVANCE, ROLLBACK x2, VOID). A1 spend: ALLOW, status EXECUTED, execution SUCCEEDED.
- BUG found: treasury counted clean only when execution_status == EXECUTED (A1 has SUCCEEDED), and runner polled on the same wrong field. Fixed both. TreasuryRecord redeployed; first deployment `0xc975f413C69dae2049393a51e24f78461a7BE501` is superseded (never received case 8 writes). Run stopped and resumed from saved hashes.
- resumed 17:57:43Z
- A2: gateway HTML error on submit wait (submit was ACCEPTED, proposal existed). Evaluate was sent at 17:58:43 before submit FINALIZED. Sequencing deviation, recorded; not resent.
- Case 7: A1, A2, A3 ALLOW + EXECUTED (SUCCEEDED). B1 (spender B) BLOCK, NOT_QUEUED. Next: case 8 treasury records, claim A1, then activations.
- Case 8 verified on chain: A clean=3 multiplier=2; B frozen multiplier=0; claim A1 CLAIMED 500 after vault credit check. TIGHTEN activation sent. LOOSEN activation waits for its 60-min effective time.
- A2 submit proof entry refreshed from chain (wait was interrupted by a gateway error; status now FINALIZED).
- Docs, frontend /defense (+ /api/defense), proof, milestone written; 35 explorer links verified. Committing, then Vercel clean-archive deploy.
- Case 9: AMD-TIGHTEN-02 (new rule R6) judged TIGHTENS (ADDS_CONSTRAINT), PENDING. Attempt 1 stays NEUTRAL.
- Fixes: TIGHTEN-02 activated (ACTIVE); verifier checks frozen-policy hash vs Sentinel; milestone has app/repo/commit links; claim wording = receipt, moves no funds; attempt 1 ambiguity noted.
- Case 10: AMD-TIGHTEN-03 (cap 5,000, explicit) judged TIGHTENS (LOWERS_LIMIT), PENDING until 08:20:44 UTC. Governor keystore found (moment-grid-studionet = governor, password-encrypted; I cannot unlock). scripts/governor-step.mjs written for the user to run.
- Governor step DONE (owner ran scripts/governor-step.mjs): policy v2 published (cap 5,000, text = AMD-TIGHTEN-03). 7,000 spend G1 refused at submit (transfer exceeds HARD_MAX_TRANSFER). Evaluate then refused (proposal does not exist), expected.

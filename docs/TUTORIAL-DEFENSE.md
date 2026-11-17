# Tutorial: the Covenant Sentinel defense suite

This tutorial walks through the three contracts added on top of the existing Covenant Sentinel and shows where each decision is made in the code. The contracts live in `contracts/upgrade_guard.py`, `contracts/policy_amendments.py` and `contracts/treasury_record.py`. The existing Sentinel and Vault are unchanged.

The rule the suite is built on: the model judges one narrow question per transaction and must quote the evidence it used. Code decides everything else: hashes, windows, fallbacks, state changes and money.

## 1. Upgrade review (`contracts/upgrade_guard.py`)

A proposer declares an upgrade: a target, two commit-pinned raw GitHub URLs (old and new source), their SHA-256 hashes, and a declared change of at most 500 characters. `_validate_declaration` rejects anything that is not a 40-character commit path on `raw.githubusercontent.com`.

`judge_upgrade` runs `_review` on the leader and again on each validator. `_review` does three things in order:

1. It fetches both sources through `_fetch_text`. Any failure (network error, non-200 status, hash mismatch, oversize body) returns `VOID` with the reason. A failed fetch never becomes a verdict against the proposer.
2. It computes a bounded diff with `difflib` (`_bounded_diff`) and runs a deterministic scanner (`_scan`) over added lines. The scanner flags calls such as `gl.nondet` or `.emit(` that the declared change does not mention.
3. It asks the model for `{verdict, reason_code, quote}` only. `_parse_model` requires exactly those keys, and `_review` requires the quote to be a substring of the diff.

The validator agrees when its own verdict matches the leader's and the leader's quote appears in the validator's own diff. The two nodes are not required to produce identical quotes. Their agreement is on the evidence.

The scanner also works as a code-level override. If the model answers ADVANCE while the scanner flags a call the declaration does not describe, the result becomes ROLLBACK with `UNDECLARED_EXTERNAL_CALL`. This is how the injected-comment case is handled: the comment asks for ADVANCE, the model may obey it, and the hidden call still forces ROLLBACK.

Deadlines are explicit. ADVANCE sets `timelock_until` to 30 minutes after the verdict. HELD waits 24 hours and then `expire_upgrade` moves it to VOID. A declaration nobody judges expires to VOID after 24 hours.

## 2. Policy amendments (`contracts/policy_amendments.py`)

The current policy is frozen in the constructor as text and hash. The deployer checks that hash against the Sentinel's immutable policy version before deploying, and `scripts/run-case.mjs` repeats that check on every run. The governor then proposes a commit-pinned replacement text with its hash.

Validators fetch the replacement themselves and judge LOOSENS, TIGHTENS or NEUTRAL with a quoted clause. The quote may come from either text, because a removed clause only exists in the frozen text. The delay follows the verdict:

- TIGHTENS and NEUTRAL take effect after 30 minutes.
- LOOSENS takes effect after 60 minutes, and `appeal_open_until` is set to the same moment.

`activate_amendment` is deterministic. It reverts until `effective_at` has passed, and it cannot run on a proposal that was never judged.

From verdict to enforcement: this contract does not write to the Sentinel. The Sentinel's governor publishes an ACTIVE amendment as a new policy version. In the live run, `AMD-TIGHTEN-03` (cap lowered from 10,000 to 5,000 DEMO) was judged TIGHTENS, activated, and published as policy v2, and its text hash matches the judged text. A 7,000 DEMO spend was then refused at submit, because `submit_treasury_proposal` compares the amount with the current policy cap. One limit remains: the Sentinel's evaluator accepts rule IDs R1 to R5, so only the cap is enforced deterministically, and a new rule such as R6 cannot be enforced without changing the Sentinel.

## 3. Treasury record (`contracts/treasury_record.py`)

This contract has no model. `record_outcome(proposal_id)` reads the proposal from the Sentinel and writes only if the Sentinel reports the decision as final. An EXECUTED proposal counts as a clean action. A BLOCK verdict counts as a violation. Any other state reverts with `NOT_A_COUNTABLE_FINAL_OUTCOME`. Amounts come from the Sentinel's record, never from the caller.

The multiplier table is in the code:

- any violation: frozen, multiplier 0
- three clean actions and no violations: 2x
- otherwise: 1x

A reserved claim is created for each EXECUTED spend. `claim` accepts only the spender who submitted it. Before recording the receipt, it reads the vault's execution record and checks that the amount matches. The contract moves no funds. A reservation that is not claimed within 7 days can be expired.

The credit itself is a DEMO accounting entry made by the existing vault, not a transfer of a native token. The treasury claim is a verified receipt of that credit.

## 4. How the pieces fit

Upgrade and amendment verdicts are recorded as contract state, with the quote and the reason code. The treasury record reads only committed Sentinel state, so a spender cannot forge an outcome. Every waiting state has a deadline and a fallback that moves it to VOID or EXPIRED, and none of those fallbacks is a verdict against a party.

To check any of this yourself, read the recorded proof with `npm run verify:proof-v1`. It checks every explorer link through the explorer API and re-reads the contract states from StudioNet.

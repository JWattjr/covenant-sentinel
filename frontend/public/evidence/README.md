# StudioNet evidence fixtures

These static documents exercise Covenant Sentinel's public demo deployment.
They are bounded and explicitly labeled synthetic. No fixture describes a real
organization, protocol, asset, exploit, or loss.

## They state facts, not verdicts

An earlier revision of these fixtures carried a `policy_mapping` block naming
the expected verdict, reason code, and rule IDs. That made the demo worthless
as a demonstration of judgement: the evaluator was reading an answer out of the
evidence rather than deriving one, and it was — structurally — the benign form
of the prompt injection that `docs/THREAT_MODEL.md` describes.

Every fixture now contains only observable claims: scope, remediation state,
retest results, whether exploitation is ongoing, whether assessors disagree.
The verdict, the reason code, and the cited rule IDs are produced by the
evaluator under consensus and validated against the contract's closed schema.

When editing a fixture, do not reintroduce any field that names a verdict
(`ALLOW`/`TIMELOCK`/`BLOCK`/`INSUFFICIENT_EVIDENCE`), a reason code, or a rule
ID. State what is true about the subject and let the evaluator do its job.

## The documents

| File | What it describes |
| --- | --- |
| `allow-security-audit.json` | A scheduled review of the protocol's own contracts, with no open critical findings against the target |
| `block-critical-exploit.json` | An unpatched, actively exploited authorization bypass at an integration target |
| `conflict-safe.json` | Assessor A: the patch holds, no critical issue reproduced |
| `conflict-risk.json` | Assessor B: the same patch, the same target, the bypass still reproduces |
| `unavailable.json` | Deliberately absent |

`conflict-safe.json` and `conflict-risk.json` are meant to be submitted
together as one manifest; they are credible, independent, and irreconcilable.

The missing `unavailable.json` path demonstrates deterministic fail-closed
behavior: the hostname is approved, but the request returns a non-2xx response,
so the contract records the fail-closed outcome without asking an LLM anything.

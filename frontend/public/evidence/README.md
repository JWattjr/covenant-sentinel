# StudioNet evidence fixtures

These static documents exercise Covenant Sentinel's public demo deployment.
They are intentionally explicit, bounded, and labeled as synthetic. No fixture
describes a real organization, protocol, asset, exploit, or loss.

The deliberately missing `unavailable.json` path demonstrates deterministic
fail-closed behavior: the hostname is approved, but the HTTP request returns a
non-2xx response, so the contract records `INSUFFICIENT_EVIDENCE` without asking
an LLM to approve the action.

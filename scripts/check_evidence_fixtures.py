#!/usr/bin/env python3
"""Fail if a demo evidence fixture names a verdict, reason code, or rule ID.

The StudioNet fixtures exist to exercise consensus outcomes. If one of them
states the answer, the demo stops proving anything: the evaluator transcribes
the verdict instead of deriving it from the facts, and every validator agrees
because they all fetched the same planted answer. That happened once already —
see `frontend/public/evidence/README.md` and the prompt-injection section of
`docs/THREAT_MODEL.md` — so it is checked in CI rather than left to review.
"""

from __future__ import annotations

import json
import pathlib
import sys

FIXTURE_DIR = pathlib.Path(__file__).resolve().parent.parent / "frontend" / "public" / "evidence"

# Closed vocabularies the contract validates. None of them belong in evidence.
FORBIDDEN_TOKENS = (
    "ALLOW",
    "TIMELOCK",
    "BLOCK",
    "INSUFFICIENT_EVIDENCE",
    "PURPOSE_ALIGNED",
    "PURPOSE_MISALIGNED",
    "SECURITY_CRITICAL_EVIDENCE",
    "CONFLICTING_EVIDENCE",
    "EVIDENCE_INADEQUATE",
    "EVIDENCE_UNAVAILABLE",
    "EMERGENCY_CONFIRMED",
    "EMERGENCY_UNVERIFIED",
    "R1",
    "R2",
    "R3",
    "R4",
    "R5",
)

# Field names that historically carried a planted answer.
FORBIDDEN_KEYS = ("policy_mapping", "violated_rules", "satisfied_rules", "verdict", "reason_code")


def offending_keys(node: object) -> list[str]:
    found: list[str] = []
    if isinstance(node, dict):
        for key, value in node.items():
            if key in FORBIDDEN_KEYS:
                found.append(key)
            found.extend(offending_keys(value))
    elif isinstance(node, list):
        for item in node:
            found.extend(offending_keys(item))
    return found


def main() -> int:
    if not FIXTURE_DIR.is_dir():
        print(f"No fixture directory at {FIXTURE_DIR}", file=sys.stderr)
        return 1

    failures = 0
    fixtures = sorted(FIXTURE_DIR.glob("*.json"))
    if not fixtures:
        print(f"No fixtures found in {FIXTURE_DIR}", file=sys.stderr)
        return 1

    for path in fixtures:
        raw = path.read_text(encoding="utf-8")
        try:
            document = json.loads(raw)
        except json.JSONDecodeError as error:
            print(f"FAIL {path.name}: invalid JSON ({error})")
            failures += 1
            continue

        problems = [f"key '{key}'" for key in sorted(set(offending_keys(document)))]
        problems += [f"token '{token}'" for token in FORBIDDEN_TOKENS if token in raw]

        if problems:
            print(f"FAIL {path.name}: {', '.join(problems)}")
            failures += 1
        else:
            print(f"ok   {path.name}")

    if failures:
        print(
            f"\n{failures} fixture(s) name a verdict, reason code, or rule ID.\n"
            "Evidence must state observable facts only; the evaluator produces the verdict.",
            file=sys.stderr,
        )
        return 1

    print(f"\n{len(fixtures)} fixture(s) clean.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

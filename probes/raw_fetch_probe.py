# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Phase 1 probe: can StudioNet validators fetch a commit-pinned raw GitHub file?

Throwaway contract for the Covenant Sentinel defense-suite work. It is not part
of the Sentinel or Vault and is never wired to them.
"""

import hashlib
import json

from genlayer import *


def _fetch_summary(url: str) -> dict:
    try:
        response = gl.nondet.web.get(url)
    except Exception as exc:
        return {"status": 0, "sha256": "", "bytes": 0, "error": type(exc).__name__}
    body = response.body or b""
    return {
        "status": int(response.status),
        "sha256": hashlib.sha256(body).hexdigest(),
        "bytes": len(body),
        "error": "",
    }


class RawFetchProbe(gl.Contract):
    last_result: str

    def __init__(self):
        self.last_result = ""

    @gl.public.view
    def get_last_result(self) -> str:
        return self.last_result

    @gl.public.write
    def probe(self, url: str, expected_sha256: str) -> None:
        def leader_fn():
            return _fetch_summary(url)

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            return _fetch_summary(url) == leader_res.calldata

        result = gl.vm.run_nondet(leader_fn, validator_fn)
        result["matches_expected"] = result["sha256"] == expected_sha256.lower()
        self.last_result = json.dumps(result, sort_keys=True)

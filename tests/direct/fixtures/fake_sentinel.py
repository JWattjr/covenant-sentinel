# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Test double for the Covenant Sentinel's read surface. Never deployed to StudioNet."""

import json

from genlayer import *


class FakeSentinel(gl.Contract):
    policies: TreeMap[str, str]
    proposals: TreeMap[str, str]

    def __init__(self):
        pass

    @gl.public.write
    def set_policy(self, version: u256, policy_text: str) -> None:
        self.policies[str(int(version))] = policy_text

    @gl.public.write
    def set_proposal(self, proposal_id: str, proposal_json: str) -> None:
        self.proposals[proposal_id] = proposal_json

    @gl.public.view
    def get_policy(self, version: u256) -> dict:
        return {"version": int(version), "policy_text": self.policies.get(str(int(version)), "")}

    @gl.public.view
    def get_proposal(self, proposal_id: str) -> dict:
        raw = self.proposals.get(proposal_id, "")
        if not raw:
            raise gl.vm.UserError("[EXPECTED] proposal does not exist")
        return json.loads(raw)

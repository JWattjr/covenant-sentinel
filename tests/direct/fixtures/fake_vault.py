# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Test double for the Sentinel Vault's execution view. Never deployed to StudioNet."""

import json

from genlayer import *


class FakeVault(gl.Contract):
    executions: TreeMap[str, str]

    def __init__(self):
        pass

    @gl.public.write
    def set_execution(self, action_id: str, amount: u256) -> None:
        self.executions[action_id] = json.dumps({"exists": True, "action_id": action_id, "amount": int(amount)})

    @gl.public.view
    def get_execution(self, action_id: str) -> dict:
        raw = self.executions.get(action_id, "")
        if not raw:
            return {"exists": False}
        return json.loads(raw)

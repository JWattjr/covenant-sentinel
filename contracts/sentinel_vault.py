# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""The GenLayer-native guarded treasury used by Covenant Sentinel.

This contract intentionally models demo units rather than native or bridged
assets.  It is a narrow child contract: only the configured Covenant Sentinel
may execute an approved transfer or change the temporary emergency pause.
"""

from dataclasses import dataclass

from genlayer import *


ERROR_EXPECTED = "[EXPECTED]"
MAX_ACTION_ID_LENGTH = 64
MAX_ASSET_ID_LENGTH = 48
MAX_PURPOSE_LENGTH = 280
MAX_INCIDENT_ID_LENGTH = 64
MAX_PAUSE_REASON_LENGTH = 280


@allow_storage
@dataclass
class VaultExecution:
    """A compact, replay-protected record of a completed vault operation."""

    action_id: str
    target: Address
    asset_id: str
    amount: u256
    purpose: str
    policy_version: u256
    execution_kind: str


@gl.contract_interface
class CovenantSentinelCallback:
    class Write:
        def record_vault_execution(
            self, proposal_id: str, execution_kind: str
        ) -> None: ...


class SentinelVault(gl.Contract):
    """A single-sentinel, simulated treasury with emergency-pause support."""

    governor: Address
    sentinel: Address
    sentinel_configured: bool
    demo_balance: u256
    paused: bool
    pause_incident_id: str
    pause_duration_hours: u256
    pause_reason: str
    executed_actions: TreeMap[str, bool]
    execution_records: TreeMap[str, VaultExecution]
    execution_ids: DynArray[str]

    def __init__(self, initial_demo_balance: u256):
        if initial_demo_balance < 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} initial balance is invalid")
        self.governor = gl.message.sender_address
        # A harmless placeholder prevents an unconfigured vault from accepting
        # calls merely because its deployer happens to know the ABI.
        self.sentinel = gl.message.sender_address
        self.sentinel_configured = False
        self.demo_balance = initial_demo_balance
        self.paused = False
        self.pause_incident_id = ""
        self.pause_duration_hours = 0
        self.pause_reason = ""

    def _require_governor(self) -> None:
        if gl.message.sender_address != self.governor:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} governor authorization required")

    def _require_sentinel(self) -> None:
        if not self.sentinel_configured:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} sentinel is not configured")
        if gl.message.sender_address != self.sentinel:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} sentinel authorization required")

    def _validate_identifier(self, value: str, label: str, max_length: int) -> None:
        if len(value) == 0 or len(value) > max_length:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} invalid {label} length")
        for character in value:
            if not (
                ("a" <= character <= "z")
                or ("A" <= character <= "Z")
                or ("0" <= character <= "9")
                or character == "-"
                or character == "_"
            ):
                raise gl.vm.UserError(f"{ERROR_EXPECTED} invalid {label} characters")

    def _validate_text(self, value: str, label: str, max_length: int) -> None:
        if len(value) == 0 or len(value) > max_length:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} invalid {label} length")

    def _normalize_address(self, value: Address) -> Address:
        """Accept the SDK Address value and the simulator's ABI string form."""

        if isinstance(value, str):
            return Address(value)
        return value

    @gl.public.write
    def configure_sentinel(self, sentinel_address: Address) -> None:
        """Bind this vault to its parent exactly once during deployment setup."""

        self._require_governor()
        sentinel_address = self._normalize_address(sentinel_address)
        if self.sentinel_configured:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} sentinel already configured")
        if sentinel_address == self.governor:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} sentinel cannot be the governor")
        self.sentinel = sentinel_address
        self.sentinel_configured = True

    @gl.public.write
    def fund_demo_treasury(self, amount: u256) -> None:
        """Add demo accounting units; production asset custody is out of scope."""

        self._require_governor()
        if self.paused:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} vault is paused")
        if amount <= 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} funding amount must be positive")
        self.demo_balance += amount

    @gl.public.write
    def execute_authorized_transfer(
        self,
        action_id: str,
        target: Address,
        asset_id: str,
        amount: u256,
        purpose: str,
        policy_version: u256,
    ) -> None:
        """Execute one finalized Sentinel-approved simulated transfer."""

        self._require_sentinel()
        target = self._normalize_address(target)
        self._validate_identifier(action_id, "action id", MAX_ACTION_ID_LENGTH)
        self._validate_identifier(asset_id, "asset id", MAX_ASSET_ID_LENGTH)
        self._validate_text(purpose, "purpose", MAX_PURPOSE_LENGTH)
        if self.paused:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} vault is paused")
        if action_id in self.executed_actions:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} action already executed")
        if amount <= 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} transfer amount must be positive")
        if amount > self.demo_balance:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} insufficient demo treasury balance")

        self.demo_balance -= amount
        self.executed_actions[action_id] = True
        self.execution_records[action_id] = VaultExecution(
            action_id=action_id,
            target=target,
            asset_id=asset_id,
            amount=amount,
            purpose=purpose,
            policy_version=policy_version,
            execution_kind="TRANSFER",
        )
        self.execution_ids.append(action_id)

        # This acknowledgement is itself finality-safe: it is only delivered
        # after this child execution finalizes, not when its receipt is merely
        # accepted.
        CovenantSentinelCallback(self.sentinel).emit(on="finalized").record_vault_execution(
            action_id, "TRANSFER"
        )

    @gl.public.write
    def apply_temporary_pause(
        self,
        incident_id: str,
        requested_duration_hours: u256,
        reason: str,
        policy_version: u256,
    ) -> None:
        """Apply a Sentinel-approved, bounded emergency pause exactly once."""

        self._require_sentinel()
        self._validate_identifier(incident_id, "incident id", MAX_INCIDENT_ID_LENGTH)
        self._validate_text(reason, "pause reason", MAX_PAUSE_REASON_LENGTH)
        if requested_duration_hours <= 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} pause duration must be positive")
        if incident_id in self.executed_actions:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} incident already applied")
        if self.paused:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} vault is already paused")

        self.paused = True
        self.pause_incident_id = incident_id
        self.pause_duration_hours = requested_duration_hours
        self.pause_reason = reason
        self.executed_actions[incident_id] = True
        self.execution_records[incident_id] = VaultExecution(
            action_id=incident_id,
            target=self.sentinel,
            asset_id="PAUSE",
            amount=0,
            purpose=reason,
            policy_version=policy_version,
            execution_kind="EMERGENCY_PAUSE",
        )
        self.execution_ids.append(incident_id)
        CovenantSentinelCallback(self.sentinel).emit(on="finalized").record_vault_execution(
            incident_id, "EMERGENCY_PAUSE"
        )

    @gl.public.write
    def release_pause(self, incident_id: str) -> None:
        """Release a pause only through a finality-safe Sentinel instruction.

        GenLayer contracts do not wake themselves.  The parent contract exposes
        a governor-authorized manual expiry flow, documented as an operational
        limitation rather than pretending the pause self-expires on-chain.
        """

        self._require_sentinel()
        self._validate_identifier(incident_id, "incident id", MAX_INCIDENT_ID_LENGTH)
        if not self.paused:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} vault is not paused")
        if incident_id != self.pause_incident_id:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} incident does not own current pause")

        self.paused = False
        self.pause_incident_id = ""
        self.pause_duration_hours = 0
        self.pause_reason = ""

    @gl.public.view
    def get_state(self) -> dict:
        return {
            "governor": self.governor.as_hex,
            "sentinel": self.sentinel.as_hex,
            "sentinel_configured": self.sentinel_configured,
            "demo_balance": self.demo_balance,
            "paused": self.paused,
            "pause_incident_id": self.pause_incident_id,
            "pause_duration_hours": self.pause_duration_hours,
            "pause_reason": self.pause_reason,
        }

    @gl.public.view
    def has_executed(self, action_id: str) -> bool:
        return self.executed_actions.get(action_id, False)

    @gl.public.view
    def get_execution(self, action_id: str) -> dict:
        if action_id not in self.execution_records:
            return {"exists": False}
        record = self.execution_records[action_id]
        return {
            "exists": True,
            "action_id": record.action_id,
            "target": record.target.as_hex,
            "asset_id": record.asset_id,
            "amount": record.amount,
            "purpose": record.purpose,
            "policy_version": record.policy_version,
            "execution_kind": record.execution_kind,
        }

    @gl.public.view
    def get_execution_ids(self, offset: u256, limit: u256) -> dict:
        if limit == 0 or limit > 50:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} invalid page limit")
        ids = []
        end = offset + limit
        if end > len(self.execution_ids):
            end = len(self.execution_ids)
        index = offset
        while index < end:
            ids.append(self.execution_ids[index])
            index += 1
        return {"ids": ids, "total": len(self.execution_ids)}

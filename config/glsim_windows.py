"""Run GLSim on Windows while preserving its POSIX-oriented stdin behavior.

The current genlayer-testing-suite direct loader unlinks a temp file immediately
after duplicating it onto descriptor 0. Windows keeps that file locked until
the descriptor closes, which makes every simulator deployment fail with WinError
32. This launcher defers deletion until VM teardown. It is test infrastructure
only and does not alter either Covenant Sentinel contract or consensus rules.
"""

import argparse
import os
import tempfile

from gltest.direct import loader
from gltest.direct.vm import VMContext
from glsim.server import create_app, run_server
from glsim.state import DEFAULT_CHAIN_ID


def _inject_message_without_early_unlink(vm):
    from genlayer.py import calldata
    from genlayer.py.types import Address

    sender_address = vm.sender
    if isinstance(sender_address, bytes):
        sender_address = Address(sender_address)
    contract_address = vm._contract_address
    if isinstance(contract_address, bytes):
        contract_address = Address(contract_address)
    origin_address = vm.origin
    if isinstance(origin_address, bytes):
        origin_address = Address(origin_address)

    message_data = {
        "contract_address": contract_address,
        "sender_address": sender_address,
        "origin_address": origin_address,
        "stack": [],
        "value": vm._value,
        "datetime": vm._datetime,
        "is_init": False,
        "chain_id": vm._chain_id,
        "entry_kind": 0,
        "entry_data": b"",
        "entry_stage_data": None,
    }
    fd, path = tempfile.mkstemp()
    try:
        os.write(fd, calldata.encode(message_data))
        os.lseek(fd, 0, os.SEEK_SET)
        vm._original_stdin_fd = os.dup(0)
        os.dup2(fd, 0)
        paths = getattr(vm, "_covenant_temp_message_paths", [])
        paths.append(path)
        vm._covenant_temp_message_paths = paths
    finally:
        os.close(fd)


def _install_windows_shim() -> None:
    original_cleanup = VMContext._cleanup_after_deactivate

    def cleanup_with_deferred_temp_files(vm):
        original_cleanup(vm)
        for path in getattr(vm, "_covenant_temp_message_paths", []):
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass
        vm._covenant_temp_message_paths = []

    loader._inject_message_to_fd0 = _inject_message_without_early_unlink
    VMContext._cleanup_after_deactivate = cleanup_with_deferred_temp_files


def main() -> None:
    parser = argparse.ArgumentParser(description="Covenant Sentinel Windows GLSim launcher")
    parser.add_argument("--port", type=int, default=4000)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--validators", type=int, default=5)
    parser.add_argument("--max-rotations", type=int, default=3)
    parser.add_argument("--chain-id", type=int, default=DEFAULT_CHAIN_ID)
    parser.add_argument("--llm-provider", default=None)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--seed", default=None)
    args = parser.parse_args()

    _install_windows_shim()
    app = create_app(
        num_validators=args.validators,
        max_rotations=args.max_rotations,
        chain_id=args.chain_id,
        llm_provider=args.llm_provider,
        use_browser=not args.no_browser,
        seed=args.seed,
    )
    run_server(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()

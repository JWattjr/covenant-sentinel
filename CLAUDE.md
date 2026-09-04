# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Commands

```bash
# Linting (both contracts must pass). On Windows, PYTHONIOENCODING=utf-8 avoids
# a cp1252 UnicodeEncodeError while the linter prints its own success glyph.
genvm-lint check contracts/covenant_sentinel.py
genvm-lint check contracts/sentinel_vault.py

# Testing
pytest tests/direct/ -v                        # Direct mode tests (fast, no simulator)
gltest tests/integration/ -v -s --network localnet   # Five-validator consensus tests

# Local simulator (Windows: the bundled launcher works around an upstream
# temporary-file/stdin defect in the official Windows runner)
python config/glsim_windows.py --port 4000 --validators 5 --no-browser --seed covenant-sentinel

# Deployment (Vault first, then Sentinel, then one-time wiring)
genlayer network set studionet
genlayer deploy

# Frontend (npm workspace, run from the repo root)
npm run dev
```

## This project

Covenant Sentinel: a policy-bound treasury guard. `contracts/covenant_sentinel.py`
holds immutable policy versions and runs consensus evaluation;
`contracts/sentinel_vault.py` is a guarded child that only its one configured
Sentinel may instruct. See `README.md` and `docs/`.

**Do not change the pinned runner header** in either contract
(`py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`) without
proving a replacement works with the direct-test runtime. The linter advertises a
newer runner that is not compatible with it.

**Do not regress the risk-level asymmetry**: `HIGH`/`CRITICAL` rejection applies
to treasury transfers only. `CRITICAL` is the condition that authorizes a bounded
emergency pause, so applying the transfer invariant to both action types breaks
the emergency path.

## Architecture

```
contracts/          # Python intelligent contracts
tests/
  direct/           # Fast in-memory tests with web/LLM mocks
  integration/      # Full tests against GenLayer Studio
frontend/           # Next.js operator console (TypeScript, TanStack Query)
deploy/             # TypeScript deployment scripts
docs/               # Architecture, decisions, threat model, demo, pitch, ops
config/             # GenLayer config plus the Windows GLSim launcher
```

**Frontend stack**: Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, TanStack Query, genlayer-js, MetaMask via `window.ethereum`.

## Development Workflow

1. Write/modify contract in `contracts/`
2. Lint: `genvm-lint check contracts/covenant_sentinel.py`
3. Test direct: `pytest tests/direct/ -v`
4. Start GLSim, then test integration: `gltest tests/integration/ -v -s --network localnet`
5. Deploy: `genlayer deploy`
6. Run frontend: `npm run dev`

## Contract Development

Contracts are Python files in `/contracts/` using the GenLayer SDK:

```python
from genlayer import *

class MyContract(gl.Contract):
    data: TreeMap[Address, str]

    def __init__(self):
        self.data = TreeMap()

    @gl.public.view
    def get_data(self, addr: Address) -> str:
        return self.data.get(addr, "")

    @gl.public.write
    def set_data(self, value: str):
        self.data[gl.message.sender_address] = value
```

**Decorators**:
- `@gl.public.view` — Read-only methods
- `@gl.public.write` — State-modifying methods
- `@gl.public.write.payable` — Methods accepting value

**Storage types**: `TreeMap`, `DynArray`, `Array`, `u256`, `i256`, `@allow_storage` for custom classes

## Writing Direct Mode Tests

Direct mode runs contracts in-memory without Studio. Key APIs:

```python
def test_example(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/my_contract.py")

    # Set sender
    direct_vm.sender = direct_alice

    # Mock web requests (regex on URL)
    direct_vm.mock_web(r".*example\.com.*", {"status": 200, "body": "response"})

    # Mock LLM responses (regex on prompt)
    direct_vm.mock_llm(r".*analyze.*", '{"result": "positive"}')

    # Call contract methods directly
    contract.some_write_method("arg1")
    result = contract.some_view_method()

    # Assert expected failures
    with direct_vm.expect_revert("Error message"):
        contract.invalid_method()

    # Reset mocks between different scenarios
    direct_vm.clear_mocks()
```

Available fixtures: `direct_vm`, `direct_deploy`, `direct_alice`, `direct_bob`, `direct_charlie`, `direct_owner`, `direct_accounts`

## Linting

The GenVM linter catches contract issues before deployment:
- Forbidden imports (`os`, `sys`, `subprocess`, etc.)
- Non-deterministic calls outside equivalence principle blocks
- Invalid storage types (must use `TreeMap`/`DynArray`, not `dict`/`list`)
- Missing decorators and return type annotations
- Bare Python exceptions (must use `gl.vm.UserError` or `Exception`)

## Frontend Patterns

- Contract interactions: `frontend/lib/covenant/client.ts`
- Shared types: `frontend/lib/covenant/types.ts`
- React hook: `frontend/lib/covenant/useCovenant.ts`
- Wallet context: `frontend/lib/genlayer/WalletProvider.tsx`
- MetaMask/network helpers: `frontend/lib/genlayer/client.ts`

Treat a transaction as successful only when the consensus status is decided AND
`txExecutionResultName` is `FINISHED_WITH_RETURN`. A status alone is not enough.

## AI Agent Skills

Install the GenLayer development skills for enhanced agent-assisted workflows:

```bash
# In Claude Code:
/plugin marketplace add genlayerlabs/skills
/plugin install genlayer-dev@genlayerlabs
```

Skills available: `genvm-lint` (linting), `direct-tests` (direct mode testing), `integration-tests` (integration testing).

---

## GenLayer Technical Reference

> **Can't solve an issue?** Always check the complete SDK API reference:
> **https://sdk.genlayer.com/main/_static/ai/api.txt**
>
> Contains: all classes, methods, parameters, return types, changelogs, breaking changes.

### Documentation URLs

| Resource | URL |
|----------|-----|
| **SDK API (Complete)** | https://sdk.genlayer.com/main/_static/ai/api.txt |
| Full Documentation | https://docs.genlayer.com/full-documentation.txt |
| Main Docs | https://docs.genlayer.com/ |
| GenLayerJS SDK | https://docs.genlayer.com/api-references/genlayer-js |

### What is GenLayer?

GenLayer is an AI-native blockchain where smart contracts can natively access the internet and make decisions using AI (LLMs). Contracts are Python-based and executed in the GenVM.

### Web Access (`gl.nondet.web`)

```python
gl.nondet.web.get(url: str, *, headers: dict = {}) -> Response
gl.nondet.web.post(url: str, *, body: str | bytes | None = None, headers: dict = {}) -> Response
gl.nondet.web.render(url: str, *, mode: Literal['text', 'html']) -> str
gl.nondet.web.render(url: str, *, mode: Literal['screenshot']) -> Image
```

### LLM Access (`gl.nondet`)

```python
gl.nondet.exec_prompt(prompt: str, *, images: Sequence[bytes | Image] | None = None) -> str
gl.nondet.exec_prompt(prompt: str, *, response_format: Literal['json'], image: bytes | Image | None = None) -> dict
```

### Equivalence Principle

Validation for non-deterministic outputs. Two approaches:

**Custom leader/validator functions** (recommended for most cases):
```python
result = gl.vm.run_nondet(leader_fn, validator_fn)
result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)  # no type matching
```

**Convenience functions** (for common patterns):
| Type | Use Case | Function |
|------|----------|----------|
| Strict | Exact outputs | `gl.eq_principle.strict_eq()` |
| Comparative | Similar outputs | `gl.eq_principle.prompt_comparative()` |
| Non-Comparative | Subjective assessments | `gl.eq_principle.prompt_non_comparative()` |

### Key Documentation Links

- [Introduction to Intelligent Contracts](https://docs.genlayer.com/developers/intelligent-contracts/introduction)
- [Storage](https://docs.genlayer.com/developers/intelligent-contracts/storage)
- [Deploying Contracts](https://docs.genlayer.com/developers/intelligent-contracts/deploying)
- [Crafting Prompts](https://docs.genlayer.com/developers/intelligent-contracts/crafting-prompts)
- [Contract Examples](https://docs.genlayer.com/developers/intelligent-contracts/examples/storage)
- [Testing Contracts](https://docs.genlayer.com/developers/decentralized-applications/testing)

// Phase 1 live probe: deploy the throwaway RawFetchProbe and run one probe to finality.
// The test key lives in the gitignored .env as GENLAYER_TEST_PRIVATE_KEY and is never printed.
// Hashes are saved to artifacts/phase1-probe.json before each wait, so the run resumes.
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createAccount, createClient, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import {
  TransactionStatus,
  executionResultNumberToName,
  transactionsStatusNumberToName,
} from "genlayer-js/types";

const ENV_FILE = ".env";
const KEY_NAME = "GENLAYER_TEST_PRIVATE_KEY";
const STATE_FILE = "artifacts/phase1-probe.json";
const RPC = "https://studio.genlayer.com/api";
const PROBE_URL =
  "https://raw.githubusercontent.com/JWattjr/covenant-sentinel/0c93afe7d7bba1809d2e46c822c492dea05c676f/README.md";
const EXPECTED_SHA256 = "12b1f734cce5e0c907359fe9fe71bc3e8da0a4ca51622b7a34cd916b603f5503";

function ensureKey() {
  const text = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  const match = text.match(new RegExp(`^${KEY_NAME}=(0x[0-9a-fA-F]{64})\\s*$`, "m"));
  if (match) return match[1];
  const key = generatePrivateKey();
  appendFileSync(ENV_FILE, `${text && !text.endsWith("\n") ? "\n" : ""}${KEY_NAME}=${key}\n`);
  console.log(`generated test key into ${ENV_FILE} (value not printed)`);
  return key;
}

function loadState() {
  return existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {};
}

function saveState(state) {
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

const account = createAccount(ensureKey());
const client = createClient({ chain: studionet, endpoint: RPC, account });
const state = loadState();
state.account = account.address;
console.log(`test account ${account.address}`);

// Same normalization as deploy/deployScript.ts: accept camelCase, snake_case or numeric fields.
function outcome(receipt) {
  const consensus =
    receipt.statusName || receipt.status_name ||
    transactionsStatusNumberToName[String(receipt.status)] || "";
  let execution =
    receipt.txExecutionResultName || receipt.tx_execution_result_name ||
    executionResultNumberToName[String(receipt.txExecutionResult ?? receipt.tx_execution_result)] || "";
  const leaderRaw = receipt.consensus_data?.leader_receipt;
  const leader = Array.isArray(leaderRaw) ? leaderRaw[0] : leaderRaw;
  if (!execution && leader?.execution_result) execution = leader.execution_result;
  if (leader?.result?.status === "rollback") execution = "FINISHED_WITH_ERROR";
  return { consensus, execution };
}

async function waitFinal(label, hash) {
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    interval: 5000,
    retries: 200,
  });
  if (!state.receiptKeysLogged) {
    console.log(`${label} receipt keys: ${Object.keys(receipt).sort().join(",")}`);
    state.receiptKeysLogged = true;
  }
  const { consensus, execution } = outcome(receipt);
  console.log(`${label} ${hash} consensus=${consensus || "unknown"} execution=${execution || "unknown"}`);
  return { consensus, execution, receipt };
}

if (!state.deployHash) {
  const code = readFileSync("probes/raw_fetch_probe.py", "utf8");
  state.deployHash = await client.deployContract({ code, args: [] });
  saveState(state);
  console.log(`deploy tx saved ${state.deployHash}`);
}
const deploy = await waitFinal("deploy", state.deployHash);
// The SDK labels this deploy's execution SUCCESS, not FINISHED_WITH_RETURN; both mean the call returned.
const returned = deploy.execution === "FINISHED_WITH_RETURN" || deploy.execution === "SUCCESS";
if (deploy.consensus !== "FINALIZED" || !returned) {
  throw new Error("deploy did not finish successfully; not running the probe");
}
state.contract =
  deploy.receipt.data?.contract_address ?? deploy.receipt.txDataDecoded?.contractAddress;
if (!state.contract) throw new Error("no contract address in deploy receipt; not sending the probe");
saveState(state);
console.log(`probe contract ${state.contract}`);

if (!state.probeHash) {
  state.probeHash = await client.writeContract({
    address: state.contract,
    functionName: "probe",
    args: [PROBE_URL, EXPECTED_SHA256],
    value: 0n,
  });
  saveState(state);
  console.log(`probe tx saved ${state.probeHash}`);
}
const probe = await waitFinal("probe", state.probeHash);
state.probeOutcome = { consensus: probe.consensus, execution: probe.execution };

const last = await client.readContract({
  address: state.contract,
  functionName: "get_last_result",
  args: [],
});
state.lastResult = last;
saveState(state);
console.log(`last result ${last}`);

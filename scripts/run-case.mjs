// Covenant Sentinel defense suite: deploy the three new contracts and run the live cases.
// Resumable: every transaction hash is saved to artifacts/defense-state.json before waiting.
// A case that fails is recorded with its real result and is never resent.
// Signing uses gitignored test keys in .env. No wallet popups, no value is sent (all writes use value 0).
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createAccount, createClient, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import {
  TransactionStatus,
  executionResultNumberToName,
  transactionsStatusNumberToName,
} from "genlayer-js/types";
import { addressLink, txLink } from "./lib/explorer.mjs";

const RPC = "https://studio.genlayer.com/api";
const SENTINEL = "0x7CeA0E0D9E2a343C29fdDa253d3925c3Aba9b924";
const VAULT = "0xEB10CF48D9EffA69b66d9013289F5206631E86e9";
const FIXTURE_COMMIT = "daf5b8bc1891b8cdafe3fd562792f068d5ca591f";
const RAW = (path) =>
  `https://raw.githubusercontent.com/JWattjr/covenant-sentinel/${FIXTURE_COMMIT}/defense-fixtures/${path}`;
const EVIDENCE = (name) => `https://covenant-sentinel.vercel.app/evidence/${name}.json`;

// SHA-256 of the bytes GitHub serves at the pinned commit (checked with curl, not local files).
const SHA = {
  "upgrade/price_v1.py": "11ecae1cfec202b2a6db9c2b1b6f030d659221e5e78bd40ad06a76a67f1cb3ee",
  "upgrade/price_v1_doc.py": "9fc38edc4cb53dcddf186beee0dbea7bbab00374ec280a4801a9068e07a47c7e",
  "upgrade/price_v1_hidden_call.py": "87ccb4606c58312ec6b68f5326252e68e2f2c0ddfca06dfaea6de8a906451f69",
  "upgrade/price_v1_injected.py": "9dbaf547d2204a80e083649f280d3fe0fffd8cb69ed8ab9b4ed121af58676953",
  "policy/policy-v2-tighten.txt": "02c25d33949154f5ec512b8bfd943fbb161cccedd69fec62239f6db8ce67d6dd",
  "policy/policy-v2-loosen.txt": "69abde7bfc77990104e0f1be135ac446c94030dc7a6da1c1701524f174a73f4b",
  "policy/policy-v1-frozen.txt": "2e470c86529c334537d80f9aac4889442a912d82de71594f269e37217b096f46",
};
const STATE_FILE = "artifacts/defense-state.json";
const PROOF_FILE = "deploy/proof-v1.json";
const KEY_A = "GENLAYER_TEST_PRIVATE_KEY";
const KEY_B = "GENLAYER_TEST_PRIVATE_KEY_2";

const log = (...args) => console.log(new Date().toISOString(), ...args);
const bigintSafe = (_k, v) => (typeof v === "bigint" ? v.toString() : v);

function ensureKey(name) {
  const text = existsSync(".env") ? readFileSync(".env", "utf8") : "";
  const match = text.match(new RegExp(`^${name}=(0x[0-9a-fA-F]{64})\\s*$`, "m"));
  if (match) return match[1];
  const key = generatePrivateKey();
  appendFileSync(".env", `${text && !text.endsWith("\n") ? "\n" : ""}${name}=${key}\n`);
  log(`generated ${name} into .env (value not printed)`);
  return key;
}

let state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : { contracts: {}, steps: {}, cases: {} };
function save() {
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, bigintSafe, 2));
}

// Same normalization as deploy/deployScript.ts: camelCase, snake_case or numeric fields.
function outcome(receipt) {
  const consensus =
    receipt.statusName || receipt.status_name || transactionsStatusNumberToName[String(receipt.status)] || "";
  let execution =
    receipt.txExecutionResultName ||
    receipt.tx_execution_result_name ||
    executionResultNumberToName[String(receipt.txExecutionResult ?? receipt.tx_execution_result)] ||
    "";
  const leaderRaw = receipt.consensus_data?.leader_receipt;
  const leader = Array.isArray(leaderRaw) ? leaderRaw[0] : leaderRaw;
  if (!execution && leader?.execution_result) execution = leader.execution_result;
  if (leader?.result?.status === "rollback") execution = "FINISHED_WITH_ERROR";
  return { consensus, execution };
}

const keyA = ensureKey(KEY_A);
const keyB = ensureKey(KEY_B);
const accountA = createAccount(keyA);
const accountB = createAccount(keyB);
const clientA = createClient({ chain: studionet, endpoint: RPC, account: accountA });
const clientB = createClient({ chain: studionet, endpoint: RPC, account: accountB });
state.accounts = { A: accountA.address, B: accountB.address };
save();

async function waitFinal(hash, label) {
  try {
    const receipt = await clientA.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.FINALIZED,
      interval: 5000,
      retries: 400,
    });
    return { final: true, ...outcome(receipt), receipt };
  } catch (error) {
    log(`wait for ${label} did not finish: ${error?.message ?? error}`);
    return { final: false, error: String(error?.message ?? error) };
  }
}

async function deploy(name, client, codePath, args) {
  const rec = state.contracts[name] ?? (state.contracts[name] = { codePath, args: args.map(String) });
  if (!rec.hash) {
    rec.hash = await client.deployContract({ code: readFileSync(codePath, "utf8"), args });
    save();
    log(`deploy ${name} tx ${rec.hash}`);
  }
  if (!rec.address) {
    const result = await waitFinal(rec.hash, `deploy ${name}`);
    rec.consensus = result.consensus;
    rec.execution = result.execution;
    if (result.final) {
      rec.address = result.receipt.data?.contract_address ?? result.receipt.txDataDecoded?.contractAddress ?? null;
    }
    save();
  }
  log(`contract ${name} ${rec.address} consensus=${rec.consensus ?? "?"} execution=${rec.execution ?? "?"}`);
  return rec;
}

// Send a write once. If a hash is already saved, only wait for it.
async function write(label, client, address, functionName, args) {
  const rec = state.steps[label] ?? (state.steps[label] = { functionName, address, args: args.map(String) });
  if (!rec.hash && !rec.error) {
    try {
      rec.hash = await client.writeContract({ address, functionName, args, value: 0n });
      log(`${label} sent ${rec.hash}`);
    } catch (error) {
      rec.error = String(error?.message ?? error);
      log(`${label} send failed: ${rec.error}`);
    }
    save();
  }
  if (rec.hash && !rec.final) {
    const result = await waitFinal(rec.hash, label);
    rec.final = result.final;
    rec.consensus = result.consensus;
    rec.execution = result.execution;
    if (result.error) rec.waitError = result.error;
    save();
    log(`${label} consensus=${rec.consensus ?? "?"} execution=${rec.execution ?? "?"}`);
  }
  return rec;
}

async function read(client, address, functionName, args = []) {
  try {
    return await client.readContract({ address, functionName, args });
  } catch (error) {
    return { readError: String(error?.message ?? error) };
  }
}

// ---------- Deploy ----------
const sentinelPolicy = await read(clientA, SENTINEL, "get_policy", [1n]);
const frozenText = sentinelPolicy?.policy_text ?? "";
const frozenSha = (await import("node:crypto")).createHash("sha256").update(frozenText, "utf8").digest("hex");
if (!frozenText || frozenSha !== SHA["policy/policy-v1-frozen.txt"]) {
  throw new Error(`Sentinel policy v1 does not match the frozen fixture (sha ${frozenSha}). Not deploying.`);
}
log(`Sentinel policy v1 matches frozen fixture (sha ${frozenSha.slice(0, 12)}…)`);

const upgrade = await deploy("UpgradeGuard", clientA, "contracts/upgrade_guard.py", []);
const amendments = await deploy("PolicyAmendments", clientA, "contracts/policy_amendments.py", [
  SENTINEL,
  1,
  frozenText,
  frozenSha,
]);
if (state.contracts.TreasuryRecord?.address && !state.contracts.TreasuryRecord.superseded) {
  state.contracts.TreasuryRecord = { ...state.contracts.TreasuryRecord, superseded: true, reason: "execution_status check fixed to Sentinel status EXECUTED" };
  state.supersededTreasury = state.contracts.TreasuryRecord;
  delete state.contracts.TreasuryRecord;
  save();
}
const treasury = await deploy("TreasuryRecord", clientA, "contracts/treasury_record.py", [SENTINEL, VAULT]);
save();

const deployed = { upgrade: upgrade.address, amendments: amendments.address, treasury: treasury.address };
if (!deployed.upgrade || !deployed.amendments || !deployed.treasury) {
  throw new Error("a deployment did not finish; see artifacts/defense-state.json. Stopping before cases.");
}

// ---------- Case 1 and 2: policy amendments ----------
const TIGHTEN = "AMD-TIGHTEN-01";
const LOOSEN = "AMD-LOOSEN-01";
await write("c1-propose-tighten", clientA, deployed.amendments, "propose_amendment", [
  TIGHTEN, RAW("policy/policy-v2-tighten.txt"), SHA["policy/policy-v2-tighten.txt"],
  "Lowers the R1 cap from 10,000 to 5,000 DEMO.",
]);
await write("c1-judge-tighten", clientA, deployed.amendments, "judge_amendment", [TIGHTEN]);
await write("c2-propose-loosen", clientA, deployed.amendments, "propose_amendment", [
  LOOSEN, RAW("policy/policy-v2-loosen.txt"), SHA["policy/policy-v2-loosen.txt"],
  "Relaxes R3 so a protocol with an unresolved exploit may be used at governor discretion.",
]);
await write("c2-judge-loosen", clientA, deployed.amendments, "judge_amendment", [LOOSEN]);

// ---------- Case 3-6: upgrade reviews ----------
async function upgradeCase(caseKey, upgradeId, newPath, declared) {
  await write(`${caseKey}-declare`, clientA, deployed.upgrade, "declare_upgrade", [
    upgradeId, VAULT,
    RAW("upgrade/price_v1.py"), SHA["upgrade/price_v1.py"],
    RAW(newPath), SHA[newPath] ?? SHA["upgrade/price_v1_doc.py"],
    declared,
  ]);
  await write(`${caseKey}-judge`, clientA, deployed.upgrade, "judge_upgrade", [upgradeId]);
}
await upgradeCase("c3", "UPG-ADVANCE-01", "upgrade/price_v1_doc.py", "Adds a docstring to price(); no behaviour change.");
await upgradeCase("c4", "UPG-ROLLBACK-01", "upgrade/price_v1_hidden_call.py", "Refactor price(); no new calls or capabilities.");
await upgradeCase("c5", "UPG-INJECT-01", "upgrade/price_v1_injected.py", "Comment update in price(); no new calls or capabilities.");
await upgradeCase("c6", "UPG-VOID-01", "upgrade/missing_v2.py", "Docstring update in price(); evidence intentionally unreachable.");

// ---------- Case 7: spend proposals against the existing Sentinel ----------
const spendPurpose = "independent security review of the Covenant Sentinel contracts";
const blockPurpose = "pay for remediation of an unresolved critical exploit";
async function spend(pid, client, purpose, evidenceName) {
  const manifest = JSON.stringify([EVIDENCE(evidenceName)]);
  await write(`${pid}-submit`, client, SENTINEL, "submit_treasury_proposal", [
    pid, accountB.address, "DEMO", 500, purpose, manifest,
  ]);
  await write(`${pid}-evaluate`, client, SENTINEL, "evaluate_proposal", [pid]);
  // The vault execution is a finalized child message. Poll the Sentinel for its outcome, bounded at 45 minutes.
  const deadline = Date.now() + 45 * 60 * 1000;
  let proposal = await read(clientA, SENTINEL, "get_proposal", [pid]);
  while (!proposal?.readError && proposal.verdict === "ALLOW" && proposal.status !== "EXECUTED" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 60_000));
    proposal = await read(clientA, SENTINEL, "get_proposal", [pid]);
  }
  state.cases[pid] = { proposal };
  save();
  log(`${pid} verdict=${proposal?.verdict} execution=${proposal?.execution_status}`);
  return proposal;
}
await spend("COV-SPEND-A1", clientA, spendPurpose, "allow-security-audit");
await spend("COV-SPEND-A2", clientA, spendPurpose, "allow-security-audit");
await spend("COV-SPEND-A3", clientA, spendPurpose, "allow-security-audit");
await spend("COV-SPEND-B1", clientB, blockPurpose, "block-critical-exploit");

// ---------- Case 8: treasury record and payout ----------
for (const [pid, client] of [["COV-SPEND-A1", clientA], ["COV-SPEND-A2", clientA], ["COV-SPEND-A3", clientA], ["COV-SPEND-B1", clientB]]) {
  await write(`c8-record-${pid}`, client, deployed.treasury, "record_outcome", [pid]);
}
await write("c8-claim-A1", clientA, deployed.treasury, "claim", ["COV-SPEND-A1"]);
const spenderA = await read(clientA, deployed.treasury, "get_spender", [accountA.address.toLowerCase()]);
const spenderB = await read(clientA, deployed.treasury, "get_spender", [accountB.address.toLowerCase()]);
state.cases.c8 = { spenderA, spenderB };
save();

// ---------- Activate the amendments once their delays have passed ----------
async function waitUntilEffective(id) {
  const detail = await read(clientA, deployed.amendments, "get_amendment", [id]);
  const effective = Number(detail?.record?.effective_at ?? 0);
  const waitMs = effective * 1000 + 5 * 60 * 1000 - Date.now();
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
}
for (const id of [TIGHTEN, LOOSEN]) {
  await waitUntilEffective(id);
  await write(`activate-${id}`, clientA, deployed.amendments, "activate_amendment", [id]);
}

// ---------- Proof record ----------
const final = {
  amendment: {
    tighten: await read(clientA, deployed.amendments, "get_amendment", [TIGHTEN]),
    loosen: await read(clientA, deployed.amendments, "get_amendment", [LOOSEN]),
  },
  upgrades: {
    advance: await read(clientA, deployed.upgrade, "get_upgrade", ["UPG-ADVANCE-01"]),
    rollback: await read(clientA, deployed.upgrade, "get_upgrade", ["UPG-ROLLBACK-01"]),
    inject: await read(clientA, deployed.upgrade, "get_upgrade", ["UPG-INJECT-01"]),
    void: await read(clientA, deployed.upgrade, "get_upgrade", ["UPG-VOID-01"]),
  },
};
state.final = final;
save();

const txs = Object.entries(state.steps).filter(([, rec]) => rec.hash).map(([label, rec]) => ({
  label,
  hash: rec.hash,
  link: txLink(rec.hash),
  consensus: rec.consensus ?? null,
  execution: rec.execution ?? null,
  error: rec.error ?? rec.waitError ?? null,
}));
mkdirSync("deploy", { recursive: true });
writeFileSync(PROOF_FILE, JSON.stringify({
  network: "StudioNet",
  chainId: 61999,
  generatedAt: new Date().toISOString(),
  accounts: { A: accountA.address, B: accountB.address },
  deposits: { weiSent: "0", note: "every write sent value 0; no transfer or faucet call was made" },
  existing: { sentinel: SENTINEL, vault: VAULT, sentinelLink: addressLink(SENTINEL), vaultLink: addressLink(VAULT) },
  contracts: {
    UpgradeGuard: { address: deployed.upgrade, link: addressLink(deployed.upgrade), deployHash: state.contracts.UpgradeGuard.hash, deployLink: txLink(state.contracts.UpgradeGuard.hash) },
    PolicyAmendments: { address: deployed.amendments, link: addressLink(deployed.amendments), deployHash: state.contracts.PolicyAmendments.hash, deployLink: txLink(state.contracts.PolicyAmendments.hash) },
    TreasuryRecord: { address: deployed.treasury, link: addressLink(deployed.treasury), deployHash: state.contracts.TreasuryRecord.hash, deployLink: txLink(state.contracts.TreasuryRecord.hash) },
  },
  transactions: txs,
  state: state.cases,
  final,
}, bigintSafe, 2));
log(`wrote ${PROOF_FILE} with ${txs.length} transactions`);

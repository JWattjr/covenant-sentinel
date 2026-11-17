// Governor step. RUN THIS YOURSELF in your own terminal: it asks for the keystore password (hidden).
// The password and the decrypted key stay in this process. Nothing is printed or saved except tx hashes.
//
//   node --env-file=.env scripts/governor-step.mjs
//
// What it does, in order, and stops at the first failed gate:
//  1. Decrypts ~/.genlayer/keystores/moment-grid-studionet.json and checks the address is the Sentinel's governor.
//  2. Checks amendment AMD-TIGHTEN-03 was judged TIGHTENS and is ACTIVE.
//  3. Checks the Sentinel is still on policy v1 (so it cannot publish twice).
//  4. Fetches the amended policy from its commit-pinned URL and checks its SHA-256.
//  5. Asks you to type "publish", then publishes it as policy v2 with a 5,000 DEMO cap (governor signs).
//  6. As the test spender B, submits a 7,000 DEMO spend and evaluates it. Under v1 (cap 10,000) the cap is not the
//     issue; under v2 (cap 5,000) it should be BLOCKED. The real verdict is recorded either way.
import { createDecipheriv, createHash, pbkdf2Sync, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { keccak256 } from "viem";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus, executionResultNumberToName, transactionsStatusNumberToName } from "genlayer-js/types";

const RPC = "https://studio.genlayer.com/api";
const SENTINEL = "0x7CeA0E0D9E2a343C29fdDa253d3925c3Aba9b924";
const GOVERNOR = "0xdB433ff614bDD1ecE21Aa97221C3E0a7ecf79c92".toLowerCase();
const KEYSTORE = join(homedir(), ".genlayer", "keystores", "moment-grid-studionet.json");
const POLICY_URL =
  "https://raw.githubusercontent.com/JWattjr/covenant-sentinel/aaf9f750774115da099153a6dabf7a5404ed7f06/defense-fixtures/policy/policy-v2-cap-5000.txt";
const POLICY_SHA = "cc413e7d65284526576890800721d4e347e3dfcaf4443b759f19e4510a8b3e2d";
const SPEND_ID = "COV-SPEND-G1";
const STATE = "artifacts/defense-state.json";
const state = JSON.parse(readFileSync(STATE, "utf8"));
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2));
const AMD = state.contracts.PolicyAmendments.address;
const bigintSafe = (_k, v) => (typeof v === "bigint" ? v.toString() : v);

function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let buffer = "";
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(buffer);
        }
        if (ch === "\u0003") process.exit(130);
        if (ch === "\u007f" || ch === "\b") buffer = buffer.slice(0, -1);
        else buffer += ch;
      }
    };
    stdin.on("data", onData);
  });
}

function decryptKeystore(keystore, password) {
  const c = keystore.Crypto ?? keystore.crypto;
  const salt = Buffer.from(c.kdfparams.salt, "hex");
  const dk =
    c.kdf === "scrypt"
      ? scryptSync(password, salt, c.kdfparams.dklen, { N: c.kdfparams.n, r: c.kdfparams.r, p: c.kdfparams.p, maxmem: 512 * 1024 * 1024 })
      : pbkdf2Sync(password, salt, c.kdfparams.c, c.kdfparams.dklen, "sha256");
  const ciphertext = Buffer.from(c.ciphertext, "hex");
  const mac = keccak256(Buffer.concat([dk.subarray(16, 32), ciphertext])).slice(2);
  if (mac !== String(c.mac).toLowerCase()) throw new Error("Wrong password.");
  const decipher = createDecipheriv(c.cipher, dk.subarray(0, 16), Buffer.from(c.cipherparams.iv, "hex"));
  return "0x" + Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("hex");
}

function outcome(r) {
  const consensus = r.statusName || r.status_name || transactionsStatusNumberToName[String(r.status)] || "";
  let execution = r.txExecutionResultName || r.tx_execution_result_name || executionResultNumberToName[String(r.txExecutionResult ?? r.tx_execution_result)] || "";
  const lr = r.consensus_data?.leader_receipt;
  const leader = Array.isArray(lr) ? lr[0] : lr;
  if (!execution && leader?.execution_result) execution = leader.execution_result;
  if (leader?.result?.status === "rollback") execution = "FINISHED_WITH_ERROR";
  return { consensus, execution };
}

async function send(client, label, address, functionName, args) {
  const rec = (state.steps[label] ??= { functionName, address, args: args.map((a) => String(a).slice(0, 80)) });
  if (rec.hash) throw new Error(`${label} was already sent (${rec.hash}); refusing to send again.`);
  rec.hash = await client.writeContract({ address, functionName, args, value: 0n });
  save();
  const r = await client.waitForTransactionReceipt({ hash: rec.hash, status: TransactionStatus.FINALIZED, interval: 5000, retries: 400 });
  Object.assign(rec, outcome(r), { final: true });
  save();
  console.log(`${label}: ${rec.hash}  ${rec.consensus}  ${rec.execution}`);
  return rec;
}

const reader = createClient({ chain: studionet, endpoint: RPC });
const read = (address, functionName, args = []) => reader.readContract({ address, functionName, args });

// ---- Gates (nothing is sent until all pass) ----
const keystore = JSON.parse(readFileSync(KEYSTORE, "utf8"));
const password = await askHidden("Keystore password for the Sentinel governor (typing is hidden): ");
const governorKey = decryptKeystore(keystore, password);
const governor = createAccount(governorKey);
if (governor.address.toLowerCase() !== GOVERNOR) throw new Error("That keystore is not the Sentinel's governor. Nothing was sent.");
console.log("Governor account unlocked and matches the Sentinel.");

const amendment = await read(AMD, "get_amendment", ["AMD-TIGHTEN-03"]);
if (amendment.outcome?.verdict !== "TIGHTENS" || amendment.state !== "ACTIVE") {
  throw new Error(`AMD-TIGHTEN-03 must be TIGHTENS and ACTIVE (it is ${amendment.outcome?.verdict} / ${amendment.state}). Nothing was sent.`);
}
const version = Number(await read(SENTINEL, "get_current_policy_version"));
if (version !== 1) throw new Error(`Sentinel is already on policy v${version}. Nothing was sent.`);

const response = await fetch(POLICY_URL);
const bytes = Buffer.from(await response.arrayBuffer());
if (response.status !== 200 || createHash("sha256").update(bytes).digest("hex") !== POLICY_SHA) {
  throw new Error("Pinned policy text did not match its hash. Nothing was sent.");
}
const policyText = bytes.toString("utf8");

console.log("\nAbout to publish policy v2 to the LIVE Sentinel:");
console.log("  - R1 cap 10,000 -> 5,000 DEMO (text judged TIGHTENS by validators, amendment ACTIVE)");
console.log("  - new submissions on the public demo will be evaluated under v2; existing proposals stay on v1");
console.log("  - this cannot be deleted; you could later publish a v3 to restore 10,000\n");
const confirm = await askHidden('Type "publish" to continue, anything else to stop: ');
if (confirm.trim() !== "publish") {
  console.log("Stopped. Nothing was sent.");
  process.exit(0);
}

// ---- Governor transaction ----
const governorClient = createClient({ chain: studionet, endpoint: RPC, account: governor });
await send(governorClient, "g-publish-policy-v2", SENTINEL, "publish_policy", [policyText, 5000, "covenant-v2"]);
const after = Number(await read(SENTINEL, "get_current_policy_version"));
console.log(`Sentinel current policy version: ${after}`);
if (after !== 2) throw new Error("Policy v2 is not current; skipping the spend.");

// ---- Spend that v2 should stop (spender B, already a frozen test account) ----
const envKey = process.env.GENLAYER_TEST_PRIVATE_KEY_2;
if (!envKey) throw new Error("Run with: node --env-file=.env scripts/governor-step.mjs");
const spender = createAccount(envKey);
const spenderClient = createClient({ chain: studionet, endpoint: RPC, account: spender });
const manifest = JSON.stringify(["https://covenant-sentinel.vercel.app/evidence/allow-security-audit.json"]);
await send(spenderClient, `${SPEND_ID}-submit`, SENTINEL, "submit_treasury_proposal", [
  SPEND_ID, spender.address, "DEMO", 7000, "independent security review of the Covenant Sentinel contracts", manifest,
]);
await send(spenderClient, `${SPEND_ID}-evaluate`, SENTINEL, "evaluate_proposal", [SPEND_ID]);
const proposal = await read(SENTINEL, "get_proposal", [SPEND_ID]);
state.cases[SPEND_ID] = { proposal: JSON.parse(JSON.stringify(proposal, bigintSafe)) };
save();
console.log(`${SPEND_ID}: verdict=${proposal.verdict} reason=${proposal.reason_code} policy_version=${proposal.policy_version}`);

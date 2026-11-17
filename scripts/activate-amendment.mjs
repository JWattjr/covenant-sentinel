// Activates a judged amendment once, after its delay, and records it. Usage: node scripts/activate-amendment.mjs <AMENDMENT_ID> <label> <proofKey>
import { readFileSync, writeFileSync } from "node:fs";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus, executionResultNumberToName, transactionsStatusNumberToName } from "genlayer-js/types";
import { txLink } from "./lib/explorer.mjs";
const [id, label, proofKey] = process.argv.slice(2);
if (!id || !label || !proofKey) throw new Error("usage: <AMENDMENT_ID> <label> <proofKey>");
const state = JSON.parse(readFileSync("artifacts/defense-state.json", "utf8"));
const key = readFileSync(".env", "utf8").match(/^GENLAYER_TEST_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)[1];
const client = createClient({ chain: studionet, endpoint: "https://studio.genlayer.com/api", account: createAccount(key) });
const AMD = state.contracts.PolicyAmendments.address;
if (state.steps[label]?.hash) throw new Error("already sent; not resending");
const rec = (state.steps[label] = { functionName: "activate_amendment", address: AMD, args: [id] });
rec.hash = await client.writeContract({ address: AMD, functionName: "activate_amendment", args: [id], value: 0n });
writeFileSync("artifacts/defense-state.json", JSON.stringify(state, null, 2));
const r = await client.waitForTransactionReceipt({ hash: rec.hash, status: TransactionStatus.FINALIZED, interval: 5000, retries: 400 });
rec.consensus = r.statusName || r.status_name || transactionsStatusNumberToName[String(r.status)];
let ex = r.txExecutionResultName || r.tx_execution_result_name || executionResultNumberToName[String(r.txExecutionResult ?? r.tx_execution_result)] || "";
const lr = r.consensus_data?.leader_receipt; const l = Array.isArray(lr) ? lr[0] : lr;
if (!ex && l?.execution_result) ex = l.execution_result;
if (l?.result?.status === "rollback") ex = "FINISHED_WITH_ERROR";
rec.execution = ex; rec.final = true;
writeFileSync("artifacts/defense-state.json", JSON.stringify(state, null, 2));
const v = JSON.parse(JSON.stringify(await client.readContract({ address: AMD, functionName: "get_amendment", args: [id] }), (_k, x) => typeof x === "bigint" ? x.toString() : x));
console.log("activate", id, rec.hash, rec.consensus, rec.execution, "| state:", v.state);
if (rec.consensus === "FINALIZED" && (ex === "SUCCESS" || ex === "FINISHED_WITH_RETURN")) {
  for (const p of ["deploy/proof-v1.json", "frontend/public/defense/proof-v1.json"]) {
    const j = JSON.parse(readFileSync(p, "utf8"));
    for (const t of ["c10-propose-tighten3", "c10-judge-tighten3"]) {
      const s = state.steps[t];
      if (s?.hash && !j.transactions.some((x) => x.hash === s.hash)) j.transactions.push({ label: t, hash: s.hash, link: txLink(s.hash), consensus: s.consensus, execution: s.execution, error: null });
    }
    j.transactions.push({ label, hash: rec.hash, link: txLink(rec.hash), consensus: rec.consensus, execution: ex, error: null });
    j.final.amendment[proofKey] = v;
    writeFileSync(p, JSON.stringify(j, null, 2));
  }
  console.log("proof updated");
}

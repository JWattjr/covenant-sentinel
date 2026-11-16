// Case 9: a second, unambiguous TIGHTENS attempt (new prohibition rule). Sent once, resumable, never rerun on failure.
import { readFileSync, writeFileSync } from "node:fs";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus, executionResultNumberToName, transactionsStatusNumberToName } from "genlayer-js/types";

const STATE = "artifacts/defense-state.json";
const state = JSON.parse(readFileSync(STATE, "utf8"));
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2));
const key = readFileSync(".env", "utf8").match(/^GENLAYER_TEST_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)[1];
const client = createClient({ chain: studionet, endpoint: "https://studio.genlayer.com/api", account: createAccount(key) });
const AMD = state.contracts.PolicyAmendments.address;
const URL = "https://raw.githubusercontent.com/JWattjr/covenant-sentinel/b60e8a783144dbc00bd86cc2a7b07bfad882b209/defense-fixtures/policy/policy-v2-tighten-rule.txt";
const SHA = "07451ecbb0548fc0da24f6373d9f51864e5ecd2cd3ca0a3d317973a7d0fc6ddd";

function outcome(r) {
  const consensus = r.statusName || r.status_name || transactionsStatusNumberToName[String(r.status)] || "";
  let execution = r.txExecutionResultName || r.tx_execution_result_name || executionResultNumberToName[String(r.txExecutionResult ?? r.tx_execution_result)] || "";
  const lr = r.consensus_data?.leader_receipt; const l = Array.isArray(lr) ? lr[0] : lr;
  if (!execution && l?.execution_result) execution = l.execution_result;
  if (l?.result?.status === "rollback") execution = "FINISHED_WITH_ERROR";
  return { consensus, execution };
}
async function write(label, fn, args) {
  const rec = (state.steps[label] ??= { functionName: fn, address: AMD, args: args.map(String) });
  if (!rec.hash && !rec.error) {
    try { rec.hash = await client.writeContract({ address: AMD, functionName: fn, args, value: 0n }); } catch (e) { rec.error = String(e?.message ?? e); }
    save();
  }
  if (rec.hash && !rec.final) {
    const r = await client.waitForTransactionReceipt({ hash: rec.hash, status: TransactionStatus.FINALIZED, interval: 5000, retries: 400 });
    Object.assign(rec, outcome(r), { final: true }); save();
  }
  console.log(label, rec.hash, rec.consensus, rec.execution, rec.error ?? "");
  return rec;
}
await write("c9-propose-tighten2", "propose_amendment", ["AMD-TIGHTEN-02", URL, SHA, "Adds rule R6: no transfer to a recipient whose previous request was blocked."]);
await write("c9-judge-tighten2", "judge_amendment", ["AMD-TIGHTEN-02"]);
const v = await client.readContract({ address: AMD, functionName: "get_amendment", args: ["AMD-TIGHTEN-02"] });
console.log("RESULT", JSON.stringify({ state: v.state, outcome: v.outcome, effective_at: v.record?.effective_at }, (_k, x) => typeof x === "bigint" ? x.toString() : x));

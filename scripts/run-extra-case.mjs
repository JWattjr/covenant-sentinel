// Extra amendment cases. Each is sent once, resumable, never rerun on failure. Usage: node scripts/run-extra-case.mjs <case>
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
const CASES = {
  c9: { id: "AMD-TIGHTEN-02", tag: "tighten2", url: "https://raw.githubusercontent.com/JWattjr/covenant-sentinel/b60e8a783144dbc00bd86cc2a7b07bfad882b209/defense-fixtures/policy/policy-v2-tighten-rule.txt", sha: "07451ecbb0548fc0da24f6373d9f51864e5ecd2cd3ca0a3d317973a7d0fc6ddd", note: "Adds rule R6: no transfer to a recipient whose previous request was blocked." },
  c10: { id: "AMD-TIGHTEN-03", tag: "tighten3", url: "https://raw.githubusercontent.com/JWattjr/covenant-sentinel/aaf9f750774115da099153a6dabf7a5404ed7f06/defense-fixtures/policy/policy-v2-cap-5000.txt", sha: "cc413e7d65284526576890800721d4e347e3dfcaf4443b759f19e4510a8b3e2d", note: "Lowers the R1 maximum from 10,000 to 5,000 DEMO, stated explicitly." },
};
const C = CASES[process.argv[2] ?? ""];
if (!C) throw new Error("usage: node scripts/run-extra-case.mjs c9|c10");

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
await write(`${process.argv[2]}-propose-${C.tag}`, "propose_amendment", [C.id, C.url, C.sha, C.note]);
await write(`${process.argv[2]}-judge-${C.tag}`, "judge_amendment", [C.id]);
const v = await client.readContract({ address: AMD, functionName: "get_amendment", args: [C.id] });
console.log("RESULT", JSON.stringify({ state: v.state, outcome: v.outcome, effective_at: v.record?.effective_at }, (_k, x) => typeof x === "bigint" ? x.toString() : x));

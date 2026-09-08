/**
 * Seed the public demo queue with real, finality-verified consensus outcomes.
 *
 * This runs as a second deploy script so the official GenLayer CLI supplies an
 * authenticated client; `genlayer deploy` executes `deploy/*.ts` in name order,
 * so `deployScript.ts` runs first and this runs after it. It is opt-in and
 * no-ops unless `COVENANT_SEED_LIVE_DEMO` is set, so a plain `genlayer deploy`
 * still just deploys.
 *
 *     COVENANT_SEED_LIVE_DEMO=1 genlayer deploy
 *
 * Environment:
 *   COVENANT_SEED_LIVE_DEMO   set to run this step at all
 *   COVENANT_SEED_SENTINEL    Sentinel address; defaults to deploy/last-deployment.json
 *   COVENANT_SEED_BASE_URL    evidence origin; default https://covenant-sentinel.vercel.app
 *   COVENANT_SEED_AMOUNT      DEMO units per proposal; default 100
 *   COVENANT_SEED_PREFIX      proposal id prefix; default "live"
 *
 * The evidence fixtures state facts only. No expected verdict, reason code, or
 * rule ID appears in them or in the purposes below — the outcomes printed at the
 * end are whatever consensus actually produced.
 */

import { readFileSync } from "fs";
import path from "path";

import { TransactionStatus } from "genlayer-js/types";
import type {
  CalldataEncodable,
  GenLayerChain,
  GenLayerClient,
  GenLayerTransaction,
  TransactionHash,
} from "genlayer-js/types";

type Loose = Record<string, unknown>;

interface SeedCase {
  id: string;
  purpose: string;
  evidence: string[];
  /** What this fixture set is meant to exercise, for the operator's log only. */
  intent: string;
}

function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? fallback : value.trim();
}

function sentinelAddress(): string {
  const override = env("COVENANT_SEED_SENTINEL", "");
  if (override) return override;
  const recordPath = path.resolve(process.cwd(), "deploy/last-deployment.json");
  const record = JSON.parse(readFileSync(recordPath, "utf-8")) as Loose;
  const address = record.sentinelAddress;
  if (typeof address !== "string") {
    throw new Error(`No sentinelAddress in ${recordPath}; set COVENANT_SEED_SENTINEL.`);
  }
  return address;
}

/** Same receipt discipline as the deployer: consensus decided AND execution returned. */
function outcome(receipt: GenLayerTransaction): { status: string; ok: boolean; detail: string } {
  const loose = receipt as unknown as Loose;
  const status =
    (typeof loose.statusName === "string" && loose.statusName) ||
    (typeof loose.status_name === "string" && loose.status_name) ||
    "";

  let execution = typeof loose.txExecutionResultName === "string" ? loose.txExecutionResultName : "";
  let detail = "";
  const consensusData = loose.consensus_data as Loose | undefined;
  const rawLeader = consensusData?.leader_receipt;
  const leader = (Array.isArray(rawLeader) ? rawLeader[0] : rawLeader) as Loose | undefined;
  if (leader) {
    if (!execution && typeof leader.execution_result === "string") execution = leader.execution_result;
    const result = leader.result as Loose | undefined;
    if (result?.status === "rollback") {
      execution = "FINISHED_WITH_ERROR";
      detail = typeof result.payload === "string" ? result.payload : "";
    }
  }

  const consensusOk = status === TransactionStatus.ACCEPTED || status === TransactionStatus.FINALIZED;
  const executionOk = execution === "FINISHED_WITH_RETURN" || execution === "SUCCESS";
  return { status, ok: consensusOk && executionOk, detail };
}

export default async function main(client: GenLayerClient<GenLayerChain>) {
  if (!env("COVENANT_SEED_LIVE_DEMO", "")) return;

  const sentinel = sentinelAddress() as `0x${string}`;
  const base = env("COVENANT_SEED_BASE_URL", "https://covenant-sentinel.vercel.app").replace(/\/+$/, "");
  const amount = BigInt(env("COVENANT_SEED_AMOUNT", "100"));
  const prefix = env("COVENANT_SEED_PREFIX", "live");
  // Any address other than the governor works as a simulated recipient.
  const recipient = env("COVENANT_SEED_RECIPIENT", "0x2c8eb5db1105a85be66badafed88d10cf393cdd8");

  const cases: SeedCase[] = [
    {
      id: `${prefix}-audit-001`,
      purpose: "Independent review of the Covenant Sentinel intelligent contracts",
      evidence: [`${base}/evidence/allow-security-audit.json`],
      intent: "aligned purpose, no open critical findings against the target",
    },
    {
      id: `${prefix}-bridge-001`,
      purpose: "Integrate a simulated protocol bridge for treasury routing",
      evidence: [`${base}/evidence/block-critical-exploit.json`],
      intent: "unpatched, actively exploited authorization bypass at the target",
    },
    {
      id: `${prefix}-contested-001`,
      purpose: "Simulated infrastructure integration with a reviewed counterparty",
      evidence: [`${base}/evidence/conflict-safe.json`, `${base}/evidence/conflict-risk.json`],
      intent: "two credible independent assessors reach opposite conclusions",
    },
    {
      id: `${prefix}-offline-001`,
      purpose: "Security operations retainer for the simulated treasury",
      evidence: [`${base}/evidence/unavailable.json`],
      intent: "approved host, non-2xx response — must fail closed without an LLM call",
    },
  ];

  const wait = (hash: TransactionHash, status: TransactionStatus) =>
    client.waitForTransactionReceipt({ hash, status, interval: 5_000, retries: 400 });

  const send = async (
    step: string,
    functionName: string,
    args: CalldataEncodable[],
    status: TransactionStatus,
  ): Promise<TransactionHash> => {
    const hash = (await client.writeContract({
      address: sentinel,
      functionName,
      args,
      value: 0n,
    })) as TransactionHash;
    const result = outcome(await wait(hash, status));
    if (!result.ok) {
      throw new Error(`${step} failed: status=${result.status} ${result.detail}`);
    }
    console.log(`    ${step} ok (${result.status}) ${hash}`);
    return hash;
  };

  console.log(`\nSeeding live demo on ${sentinel}`);
  console.log(`Evidence origin: ${base}\n`);

  const results: Loose[] = [];

  for (const seedCase of cases) {
    console.log(`▸ ${seedCase.id} — ${seedCase.intent}`);
    try {
      const submitHash = await send(
        "submit",
        "submit_treasury_proposal",
        [seedCase.id, recipient, "DEMO", amount, seedCase.purpose, JSON.stringify(seedCase.evidence)],
        TransactionStatus.FINALIZED,
      );

      // Evaluation must reach finality: only then is the vault instruction
      // released and the execution acknowledgement returned.
      const evaluateHash = await send(
        "evaluate",
        "evaluate_proposal",
        [seedCase.id],
        TransactionStatus.FINALIZED,
      );

      // The finality-safe Sentinel → Vault → Sentinel path. Report the child
      // transactions the evaluation released rather than asserting they ran.
      const children = await client
        .getTriggeredTransactionIds({ hash: evaluateHash })
        .then((ids) => ids.map(String))
        .catch(() => [] as string[]);
      if (children.length) console.log(`    child messages: ${children.join(", ")}`);

      const proposal = (await client.readContract({
        address: sentinel,
        functionName: "get_proposal",
        args: [seedCase.id],
      })) as unknown as Map<string, unknown>;

      const read = (key: string) => {
        const value = proposal instanceof Map ? proposal.get(key) : (proposal as Loose)[key];
        return typeof value === "bigint" ? Number(value) : value;
      };

      const row = {
        id: seedCase.id,
        children,
        verdict: read("verdict"),
        risk: read("risk_level"),
        reason: read("reason_code"),
        status: read("status"),
        execution: read("execution_status"),
        evaluateHash,
        submitHash,
      };
      results.push(row);
      console.log(
        `    → ${row.verdict} / ${row.risk} / ${row.reason}  [${row.status} · ${row.execution}]\n`,
      );
    } catch (error) {
      console.error(`    ! ${seedCase.id} did not complete: ${(error as Error).message}\n`);
      results.push({ id: seedCase.id, error: (error as Error).message });
    }
  }

  console.log("─────────────────────────────────────────────────────────────");
  console.log("Seeded outcomes (produced by consensus, not asserted here):");
  for (const row of results) {
    if (row.error) console.log(`  ${row.id}: FAILED — ${row.error}`);
    else console.log(`  ${row.id}: ${row.verdict} / ${row.risk} / ${row.reason} → ${row.execution}`);
  }
  console.log("─────────────────────────────────────────────────────────────\n");
}

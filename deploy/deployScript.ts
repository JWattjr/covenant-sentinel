/**
 * Covenant Sentinel deployment.
 *
 * Run with the official GenLayer CLI, which supplies an authenticated client
 * for the currently selected network and account:
 *
 *     genlayer network set studionet     # or localnet
 *     genlayer deploy                    # runs every script in deploy/
 *
 * Order matters and is enforced below:
 *
 *   1. SentinelVault    — deployed first so the Sentinel has something to guard.
 *   2. CovenantSentinel — deployed second.
 *   3. vault.configure_sentinel(sentinel)     — one-time, irreversible binding.
 *   4. sentinel.configure_guarded_vault(vault) — one-time, irreversible binding.
 *   5. sentinel.create_initial_policy(...)     — immutable policy version 1.
 *   6. sentinel.configure_evidence_domain(...) — approved evidence allowlist.
 *   7. sentinel.configure_reporter(...)        — optional emergency reporter.
 *
 * Every step waits for the receipt and verifies BOTH the consensus status and
 * the GenVM execution result before continuing. A partially wired deployment is
 * worse than none, because the one-time bindings cannot be repeated.
 *
 * Configuration is read from the environment so the script never invents a
 * policy or an address:
 *
 *   COVENANT_INITIAL_DEMO_BALANCE   default 25000
 *   COVENANT_MAX_TRANSFER           default 10000
 *   COVENANT_POLICY_ID              default covenant-v1
 *   COVENANT_POLICY_FILE            optional path to a policy text file
 *   COVENANT_EVIDENCE_DOMAINS       comma-separated, default the demo pair
 *   COVENANT_REPORTER_ADDRESS       optional 0x address of an emergency reporter
 *   COVENANT_WAIT_RETRIES           default 200
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";

import {
  TransactionStatus,
  executionResultNumberToName,
  transactionsStatusNumberToName,
} from "genlayer-js/types";
import type {
  CalldataEncodable,
  DecodedDeployData,
  GenLayerChain,
  GenLayerClient,
  GenLayerTransaction,
  TransactionHash,
} from "genlayer-js/types";

const VAULT_SOURCE = "contracts/sentinel_vault.py";
const SENTINEL_SOURCE = "contracts/covenant_sentinel.py";

const DEFAULT_POLICY = [
  "R1 — HARD_MAX_TRANSFER: No treasury transfer may exceed the published maximum.",
  "R2 — PURPOSE_ALIGNMENT: Spending must materially advance protocol development, security, infrastructure or approved community operations.",
  "R3 — SECURITY_EXCLUSION: Do not interact with a protocol where credible evidence shows an unresolved critical exploit or active loss.",
  "R4 — CONFLICTING_EVIDENCE: Materially conflicting credible evidence forbids immediate execution.",
  "R5 — EMERGENCY_PAUSE: A temporary, bounded pause requires independently verifiable active-exploit evidence.",
].join("\n");

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? fallback : value.trim();
}

function positiveInteger(name: string, fallback: number): number {
  const raw = env(name, String(fallback));
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive whole number, received "${raw}".`);
  }
  return parsed;
}

/**
 * Validate an address argument.
 *
 * Addresses are passed in their hex-string form, which both contracts normalise
 * via `_normalize_address` and which the integration suite exercises. Building a
 * `CalldataAddress` here does not work: the GenLayer CLI encodes arguments with
 * its own bundled copy of genlayer-js, so an instance created from this
 * project's copy fails the encoder's `instanceof` check.
 */
function address(value: string, label: string): string {
  if (!ADDRESS_PATTERN.test(value)) {
    throw new Error(`${label} is not a valid 0x address: "${value}".`);
  }
  return value.toLowerCase();
}

function policyText(): string {
  const file = env("COVENANT_POLICY_FILE", "");
  if (!file) return DEFAULT_POLICY;
  return readFileSync(path.resolve(process.cwd(), file), "utf-8").trim();
}

function evidenceDomains(): string[] {
  return env("COVENANT_EVIDENCE_DOMAINS", "security.example.org,incident.example.net")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

type Loose = Record<string, unknown>;

/**
 * Read the consensus status regardless of which shape the node returned.
 *
 * Studio and the testnets report `statusName`; a local GLSim reports the
 * snake_case `status_name` and a numeric `status`, so normalise all three
 * rather than silently reading `undefined` and calling it unknown.
 */
function consensusStatus(receipt: GenLayerTransaction): string {
  const loose = receipt as unknown as Loose;
  const camel = loose.statusName;
  if (typeof camel === "string" && camel) return camel;
  const snake = loose.status_name;
  if (typeof snake === "string" && snake) return snake;
  const numeric = loose.status;
  if (typeof numeric === "number" || typeof numeric === "string") {
    const mapped = (transactionsStatusNumberToName as Record<string, string>)[String(numeric)];
    if (mapped) return mapped;
  }
  return "";
}

/**
 * Read the GenVM execution result.
 *
 * This is the field that separates "consensus decided" from "the call actually
 * worked". A local GLSim reports FINALIZED for a reverted call and only exposes
 * the revert inside `consensus_data.leader_receipt`, so both places are checked.
 */
function executionOutcome(receipt: GenLayerTransaction): {
  name: string;
  succeeded: boolean | null;
  detail: string;
} {
  const loose = receipt as unknown as Loose;
  let name = "";
  let detail = "";

  const camel = loose.txExecutionResultName;
  const snake = loose.tx_execution_result_name;
  if (typeof camel === "string" && camel) name = camel;
  else if (typeof snake === "string" && snake) name = snake;
  else {
    const numeric = loose.txExecutionResult ?? loose.tx_execution_result;
    if (typeof numeric === "number" || typeof numeric === "string") {
      name = (executionResultNumberToName as Record<string, string>)[String(numeric)] ?? "";
    }
  }

  const consensusData = loose.consensus_data as Loose | undefined;
  const rawLeader = consensusData?.leader_receipt;
  const leader = (Array.isArray(rawLeader) ? rawLeader[0] : rawLeader) as Loose | undefined;
  if (leader) {
    if (!name && typeof leader.execution_result === "string") name = leader.execution_result;
    const result = leader.result as Loose | undefined;
    if (result?.status === "rollback") {
      name = "FINISHED_WITH_ERROR";
      detail = typeof result.payload === "string" ? result.payload : "";
    }
    if (!detail && typeof leader.error === "string") detail = leader.error;
  }

  const upper = name.toUpperCase();
  if (upper === "FINISHED_WITH_RETURN" || upper === "SUCCESS") {
    return { name: upper, succeeded: true, detail };
  }
  if (upper === "FINISHED_WITH_ERROR" || upper === "ERROR") {
    return { name: upper, succeeded: false, detail };
  }
  return { name: upper, succeeded: null, detail };
}

/**
 * A GenLayer receipt is only a success when consensus decided AND the GenVM
 * execution returned. Checking the status alone would happily accept a reverted
 * call and keep wiring on top of it — and the two bindings below cannot be
 * repeated, so an unrecognised receipt is treated as a failure on purpose.
 */
function assertSucceeded(step: string, receipt: GenLayerTransaction): GenLayerTransaction {
  const status = consensusStatus(receipt);
  const execution = executionOutcome(receipt);
  const consensusOk = status === TransactionStatus.ACCEPTED || status === TransactionStatus.FINALIZED;

  if (!consensusOk || execution.succeeded !== true) {
    const reason = execution.detail ? ` detail=${execution.detail}` : "";
    throw new Error(
      `${step} failed. consensus=${status || "unknown"} execution=${execution.name || "unknown"}${reason}
` +
        `Receipt keys: ${Object.keys(receipt as unknown as Loose).join(", ")}`,
    );
  }
  return receipt;
}

class Deployer {
  private readonly retries = positiveInteger("COVENANT_WAIT_RETRIES", 200);

  constructor(private readonly client: GenLayerClient<GenLayerChain>) {}

  private wait(hash: TransactionHash) {
    return this.client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.ACCEPTED,
      interval: 5_000,
      retries: this.retries,
    });
  }

  async deploy(step: string, source: string, args: CalldataEncodable[]): Promise<`0x${string}`> {
    console.log(`\n▸ ${step}: deploying ${source}`);
    const code = new Uint8Array(readFileSync(path.resolve(process.cwd(), source)));
    const hash = (await this.client.deployContract({ code, args })) as TransactionHash;
    const receipt = assertSucceeded(step, await this.wait(hash));

    const deployed =
      ((receipt.data as Record<string, unknown> | undefined)?.contract_address as string | undefined) ??
      (receipt.txDataDecoded as DecodedDeployData | undefined)?.contractAddress;

    if (!deployed || !ADDRESS_PATTERN.test(deployed)) {
      throw new Error(`${step} did not return a usable contract address (tx ${hash}).`);
    }
    console.log(`  ✓ ${deployed}  (tx ${hash})`);
    return deployed as `0x${string}`;
  }

  async write(
    step: string,
    contract: `0x${string}`,
    functionName: string,
    args: CalldataEncodable[],
  ): Promise<void> {
    console.log(`▸ ${step}`);
    const hash = (await this.client.writeContract({
      address: contract,
      functionName,
      args,
      value: 0n,
    })) as TransactionHash;
    assertSucceeded(step, await this.wait(hash));
    console.log(`  ✓ ${hash}`);
  }
}

export default async function main(client: GenLayerClient<GenLayerChain>) {
  const initialBalance = positiveInteger("COVENANT_INITIAL_DEMO_BALANCE", 25_000);
  const maxTransfer = positiveInteger("COVENANT_MAX_TRANSFER", 10_000);
  const canonicalId = env("COVENANT_POLICY_ID", "covenant-v1");
  const domains = evidenceDomains();
  const reporter = env("COVENANT_REPORTER_ADDRESS", "");
  const policy = policyText();

  if (!domains.length) {
    throw new Error("COVENANT_EVIDENCE_DOMAINS resolved to an empty allowlist.");
  }
  if (maxTransfer > initialBalance) {
    console.warn(
      `! The policy cap (${maxTransfer}) exceeds the funded demo balance (${initialBalance}). ` +
        "Allowed transfers above the balance will revert inside the vault.",
    );
  }

  const deployer = new Deployer(client);

  // 1 & 2 — the guarded child first, then its parent.
  const vaultAddress = await deployer.deploy("1/7 SentinelVault", VAULT_SOURCE, [
    BigInt(initialBalance),
  ]);
  const sentinelAddress = await deployer.deploy("2/7 CovenantSentinel", SENTINEL_SOURCE, []);

  // 3 & 4 — the one-time, irreversible bindings.
  await deployer.write(
    "3/7 Bind vault → sentinel",
    vaultAddress,
    "configure_sentinel",
    [address(sentinelAddress, "Sentinel address")],
  );
  await deployer.write(
    "4/7 Bind sentinel → vault",
    sentinelAddress,
    "configure_guarded_vault",
    [address(vaultAddress, "Vault address")],
  );

  // 5 — immutable policy version 1.
  await deployer.write("5/7 Publish policy version 1", sentinelAddress, "create_initial_policy", [
    policy,
    BigInt(maxTransfer),
    canonicalId,
  ]);

  // 6 — the approved evidence perimeter.
  let domainStep = 0;
  for (const domain of domains) {
    domainStep += 1;
    await deployer.write(
      `6/7 Approve evidence domain ${domainStep}/${domains.length} (${domain})`,
      sentinelAddress,
      "configure_evidence_domain",
      [domain, true],
    );
  }

  // 7 — an optional non-governor emergency reporter.
  if (reporter) {
    await deployer.write("7/7 Authorize emergency reporter", sentinelAddress, "configure_reporter", [
      address(reporter, "COVENANT_REPORTER_ADDRESS"),
      true,
    ]);
  } else {
    console.log(
      "▸ 7/7 Skipped reporter setup. Set COVENANT_REPORTER_ADDRESS to a non-governor address, " +
        "or run `genlayer write <sentinel> configure_reporter --args 0x… true` later.",
    );
  }

  const chainName = (client.chain as GenLayerChain | undefined)?.name ?? "unknown-network";
  const record = {
    network: chainName,
    deployedAt: new Date().toISOString(),
    sentinelAddress,
    vaultAddress,
    policy: { canonicalId, maxTransfer, version: 1 },
    initialDemoBalance: initialBalance,
    approvedEvidenceDomains: domains,
    emergencyReporter: reporter || null,
  };

  const outputPath = path.resolve(process.cwd(), "deploy/last-deployment.json");
  writeFileSync(outputPath, `${JSON.stringify(record, null, 2)}\n`, "utf-8");

  console.log("\n─────────────────────────────────────────────────────────────");
  console.log(`Covenant Sentinel deployed on ${chainName}`);
  console.log(`  Sentinel : ${sentinelAddress}`);
  console.log(`  Vault    : ${vaultAddress}`);
  console.log(`  Record   : ${outputPath}`);
  console.log("\nAdd to frontend/.env.local:");
  console.log(`NEXT_PUBLIC_COVENANT_SENTINEL_ADDRESS=${sentinelAddress}`);
  console.log(`NEXT_PUBLIC_COVENANT_VAULT_ADDRESS=${vaultAddress}`);
  console.log("─────────────────────────────────────────────────────────────\n");
}

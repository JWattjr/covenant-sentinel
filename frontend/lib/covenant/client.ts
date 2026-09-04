"use client";

import { createClient } from "genlayer-js";
import { localnet, studionet, testnetAsimov } from "genlayer-js/chains";
import type {
  CalldataEncodable,
  GenLayerChain,
  GenLayerClient,
  GenLayerTransaction,
  TransactionHash,
} from "genlayer-js/types";
import {
  ExecutionResult,
  TransactionStatus,
  executionResultNumberToName,
  transactionsStatusNumberToName,
} from "genlayer-js/types";

import type {
  CovenantDashboard,
  CovenantProposal,
  EmergencyDraft,
  GuardedVaultConfiguration,
  PolicyVersion,
  ProtocolStatistics,
  TransactionPhase,
  TransactionSnapshot,
  TransferDraft,
  VaultState,
} from "./types";

const SENTINEL_ADDRESS = (process.env.NEXT_PUBLIC_COVENANT_SENTINEL_ADDRESS ?? "").trim();
const VAULT_ADDRESS = (process.env.NEXT_PUBLIC_COVENANT_VAULT_ADDRESS ?? "").trim();
const RPC_URL = (process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? "").trim();

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/** Consensus states after which no further consensus round will change the result. */
const DECIDED_STATUS_NAMES = new Set<string>([
  TransactionStatus.ACCEPTED,
  TransactionStatus.UNDETERMINED,
  TransactionStatus.LEADER_TIMEOUT,
  TransactionStatus.VALIDATORS_TIMEOUT,
  TransactionStatus.CANCELED,
  TransactionStatus.FINALIZED,
]);

type UnknownRecord = Record<string, unknown>;

/**
 * The SDK returns calldata values, which use `Map` for dictionaries and
 * `bigint` for integers. Convert once, at the boundary, into plain JSON so the
 * React tree never has to know about the wire format.
 */
function plainValue(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Map) {
    return Object.fromEntries(
      Array.from(value.entries(), ([key, nested]) => [String(key), plainValue(nested)]),
    );
  }
  if (Array.isArray(value)) return value.map(plainValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as UnknownRecord).map(([key, nested]) => [key, plainValue(nested)]),
    );
  }
  return value;
}

function record(value: unknown): UnknownRecord {
  const normalized = plainValue(value);
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
    throw new Error("The contract returned an unexpected response shape.");
  }
  return normalized as UnknownRecord;
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return 0;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function chainForEndpoint(endpoint: string): GenLayerChain {
  if (/127\.0\.0\.1|localhost/i.test(endpoint)) return localnet as GenLayerChain;
  if (/asimov/i.test(endpoint)) return testnetAsimov as GenLayerChain;
  return studionet as GenLayerChain;
}

export function deploymentConfiguration() {
  const endpoint = RPC_URL || "https://studio.genlayer.com/api";
  return {
    sentinelAddress: SENTINEL_ADDRESS,
    vaultAddress: VAULT_ADDRESS,
    rpcUrl: endpoint,
    networkName: chainForEndpoint(endpoint).name,
  };
}

/** True only when both deployed addresses are present and well-formed. */
export function hasDeploymentConfiguration(): boolean {
  return ADDRESS_PATTERN.test(SENTINEL_ADDRESS) && ADDRESS_PATTERN.test(VAULT_ADDRESS);
}

export function missingConfigurationKeys(): string[] {
  const missing: string[] = [];
  if (!ADDRESS_PATTERN.test(SENTINEL_ADDRESS)) missing.push("NEXT_PUBLIC_COVENANT_SENTINEL_ADDRESS");
  if (!ADDRESS_PATTERN.test(VAULT_ADDRESS)) missing.push("NEXT_PUBLIC_COVENANT_VAULT_ADDRESS");
  if (!RPC_URL) missing.push("NEXT_PUBLIC_GENLAYER_RPC_URL");
  return missing;
}

function requireAddress(value: string, label: string): `0x${string}` {
  if (!ADDRESS_PATTERN.test(value)) {
    throw new Error(`${label} is not a valid 0x address.`);
  }
  return value as `0x${string}`;
}

/**
 * Read the consensus status regardless of which shape the node returned.
 *
 * Studio and the testnets report `statusName`; a local GLSim reports the
 * snake_case `status_name` plus a numeric `status`. Reading only the camelCase
 * field would silently report every localnet receipt as "unknown".
 */
function consensusStatus(receipt: GenLayerTransaction): string {
  const loose = receipt as unknown as UnknownRecord;
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
 * Read the GenVM execution result — the field that separates "consensus
 * decided" from "the call actually worked".
 *
 * A local GLSim reports FINALIZED for a *reverted* call and exposes the revert
 * only inside `consensus_data.leader_receipt`, so both locations are consulted
 * before deciding anything succeeded.
 */
function executionOutcome(receipt: GenLayerTransaction): {
  name: string;
  succeeded: boolean | null;
  detail: string;
} {
  const loose = receipt as unknown as UnknownRecord;
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

  const consensusData = loose.consensus_data as UnknownRecord | undefined;
  const rawLeader = consensusData?.leader_receipt;
  const leader = (Array.isArray(rawLeader) ? rawLeader[0] : rawLeader) as UnknownRecord | undefined;
  if (leader) {
    if (!name && typeof leader.execution_result === "string") name = leader.execution_result;
    const result = leader.result as UnknownRecord | undefined;
    if (result?.status === "rollback") {
      name = ExecutionResult.FINISHED_WITH_ERROR;
      detail = typeof result.payload === "string" ? result.payload : "";
    }
    if (!detail && typeof leader.error === "string") detail = leader.error;
  }

  const upper = name.toUpperCase();
  if (upper === ExecutionResult.FINISHED_WITH_RETURN || upper === "SUCCESS") {
    return { name: upper, succeeded: true, detail };
  }
  if (upper === ExecutionResult.FINISHED_WITH_ERROR || upper === "ERROR") {
    return { name: upper, succeeded: false, detail };
  }
  return { name: upper, succeeded: null, detail };
}

/**
 * A GenLayer call is only trustworthy when consensus has decided *and* the
 * GenVM execution itself returned. Reading the status alone would report an
 * accepted-but-reverted call as a success.
 */
function evaluateReceipt(receipt: GenLayerTransaction) {
  const consensus = consensusStatus(receipt);
  const execution = executionOutcome(receipt);
  const decided = DECIDED_STATUS_NAMES.has(consensus);
  const finalized = consensus === TransactionStatus.FINALIZED;

  const consensusFailed =
    consensus === TransactionStatus.UNDETERMINED ||
    consensus === TransactionStatus.CANCELED ||
    consensus === TransactionStatus.LEADER_TIMEOUT ||
    consensus === TransactionStatus.VALIDATORS_TIMEOUT;

  let phase: TransactionPhase = "SUBMITTED";
  if (consensusFailed || execution.succeeded === false) phase = "FAILED";
  else if (finalized) phase = "FINALIZED";
  else if (decided) phase = "DECIDED";

  return {
    consensus,
    execution: execution.name,
    executionSucceeded: execution.succeeded,
    executionDetail: execution.detail,
    decided,
    finalized,
    phase,
  };
}

function detailFor(
  phase: TransactionPhase,
  executionSucceeded: boolean | null,
  errorText: string,
): string {
  if (errorText) return errorText;
  switch (phase) {
    case "FAILED":
      return executionSucceeded === false
        ? "Consensus decided, but the contract execution reverted. No state change was applied."
        : "Consensus did not reach a usable decision for this transaction.";
    case "FINALIZED":
      return "Finalized. Any finality-safe child message to the vault has now been released.";
    case "DECIDED":
      return "Decided but still appealable. The guarded vault has not been instructed yet.";
    case "APPEALED":
      return "An appeal bond was posted. The decision is being re-run by a widened validator set.";
    default:
      return "Submitted. Waiting for the consensus round to complete.";
  }
}

export function snapshotFromReceipt(
  hash: string,
  label: string,
  receipt: GenLayerTransaction,
  triggeredIds: string[] = [],
  appealable = false,
): TransactionSnapshot {
  const evaluated = evaluateReceipt(receipt);
  return {
    hash,
    label,
    phase: evaluated.phase,
    statusName: evaluated.consensus,
    executionResultName: evaluated.execution,
    executionSucceeded: evaluated.executionSucceeded,
    finalized: evaluated.finalized,
    appealable,
    triggeredIds,
    detail: detailFor(evaluated.phase, evaluated.executionSucceeded, evaluated.executionDetail),
  };
}

/**
 * Read/write access to the deployed Sentinel and its guarded Vault.
 *
 * Every method goes through the official GenLayer JS SDK. There is no raw EVM
 * JSON-RPC path, and the client never derives a verdict of its own.
 */
export class CovenantSentinelClient {
  private readonly client: GenLayerClient<GenLayerChain>;
  private readonly sentinel: `0x${string}`;
  private readonly vault: `0x${string}`;

  constructor(account?: string) {
    this.sentinel = requireAddress(SENTINEL_ADDRESS, "NEXT_PUBLIC_COVENANT_SENTINEL_ADDRESS");
    this.vault = requireAddress(VAULT_ADDRESS, "NEXT_PUBLIC_COVENANT_VAULT_ADDRESS");
    const endpoint = deploymentConfiguration().rpcUrl;
    this.client = createClient({
      chain: chainForEndpoint(endpoint),
      endpoint,
      ...(account ? { account: account as `0x${string}` } : {}),
      ...(typeof window !== "undefined" && window.ethereum
        ? { provider: window.ethereum as never }
        : {}),
    });
  }

  private read(address: `0x${string}`, functionName: string, args: CalldataEncodable[] = []) {
    return this.client.readContract({ address, functionName, args });
  }

  private async writeSentinel(
    label: string,
    functionName: string,
    args: CalldataEncodable[],
  ): Promise<TransactionSnapshot> {
    const hash = (await this.client.writeContract({
      address: this.sentinel,
      functionName,
      args,
      value: 0n,
    })) as TransactionHash;
    return this.waitForDecision(String(hash), label);
  }

  /**
   * Wait for the consensus round to decide. This intentionally stops at
   * ACCEPTED rather than blocking until FINALIZED: the operator should see the
   * appealable window, not have it hidden behind a spinner.
   */
  private async waitForDecision(hash: string, label: string): Promise<TransactionSnapshot> {
    const receipt = await this.client.waitForTransactionReceipt({
      hash: hash as TransactionHash,
      status: TransactionStatus.ACCEPTED,
      interval: 3_000,
      retries: 100,
    });
    return this.decorate(hash, label, receipt);
  }

  /** Attach appeal eligibility and emitted child transactions to a receipt. */
  private async decorate(
    hash: string,
    label: string,
    receipt: GenLayerTransaction,
  ): Promise<TransactionSnapshot> {
    const [triggeredIds, appealable] = await Promise.all([
      this.client
        .getTriggeredTransactionIds({ hash: hash as TransactionHash })
        .then((ids) => ids.map(String))
        .catch(() => [] as string[]),
      this.client.canAppeal({ txId: hash as `0x${string}` }).catch(() => false),
    ]);
    return snapshotFromReceipt(hash, label, receipt, triggeredIds, appealable);
  }

  /** Re-read a transaction so the UI can follow it from decided to finalized. */
  async refreshTransaction(hash: string, label: string): Promise<TransactionSnapshot> {
    const receipt = await this.client.getTransaction({ hash: hash as TransactionHash });
    return this.decorate(hash, label, receipt);
  }

  async getDashboard(): Promise<CovenantDashboard> {
    const [currentVersionRaw, statisticsRaw, configurationRaw, domainsRaw, vaultRaw, proposalIdsRaw] =
      await Promise.all([
        this.read(this.sentinel, "get_current_policy_version"),
        this.read(this.sentinel, "get_statistics"),
        this.read(this.sentinel, "get_guarded_vault_configuration"),
        this.read(this.sentinel, "get_approved_evidence_domains"),
        this.read(this.vault, "get_state"),
        this.read(this.sentinel, "get_proposal_ids", [0, 50]),
      ]);

    const currentVersion = numberValue(currentVersionRaw);
    const proposalIds = strings(record(proposalIdsRaw).ids);

    // `get_policy` reverts when no policy exists yet, so only ask for it once
    // the contract reports a published version.
    const [policyRaw, proposalRows] = await Promise.all([
      currentVersion > 0 ? this.read(this.sentinel, "get_policy", [currentVersion]) : null,
      Promise.all(
        proposalIds.map((proposalId) => this.read(this.sentinel, "get_proposal", [proposalId])),
      ),
    ]);

    return {
      policy: policyRaw === null ? null : (plainValue(policyRaw) as PolicyVersion),
      proposals: proposalRows.map((proposal) => plainValue(proposal) as CovenantProposal),
      statistics: plainValue(statisticsRaw) as ProtocolStatistics,
      configuration: plainValue(configurationRaw) as GuardedVaultConfiguration,
      domains: strings(record(domainsRaw).domains),
      vault: plainValue(vaultRaw) as VaultState,
    };
  }

  submitTransfer(draft: TransferDraft): Promise<TransactionSnapshot> {
    return this.writeSentinel(`Treasury proposal ${draft.actionId}`, "submit_treasury_proposal", [
      draft.actionId,
      requireAddress(draft.target, "Transfer recipient"),
      draft.assetId,
      BigInt(draft.amount),
      draft.purpose,
      JSON.stringify(draft.evidenceUrls),
    ]);
  }

  submitEmergencyPause(draft: EmergencyDraft): Promise<TransactionSnapshot> {
    return this.writeSentinel(
      `Incident report ${draft.incidentId}`,
      "submit_emergency_pause_proposal",
      [
        draft.incidentId,
        this.vault,
        draft.incidentClaim,
        JSON.stringify(draft.evidenceUrls),
        BigInt(draft.requestedPauseHours),
      ],
    );
  }

  evaluateProposal(proposalId: string): Promise<TransactionSnapshot> {
    return this.writeSentinel(`Consensus evaluation ${proposalId}`, "evaluate_proposal", [
      proposalId,
    ]);
  }

  releaseEmergencyPause(incidentId: string): Promise<TransactionSnapshot> {
    return this.writeSentinel(`Pause release ${incidentId}`, "release_emergency_pause", [
      incidentId,
    ]);
  }

  /**
   * Post an appeal bond against a decided transaction.
   *
   * The documented flow is `getAppealCharge` followed by `appealTransaction`.
   * genlayer-js 1.1.x names the bond query `getMinAppealBond`, so prefer the
   * documented name when the installed SDK exposes it and fall back otherwise
   * rather than guessing a value.
   */
  async appeal(transactionId: string, label: string): Promise<TransactionSnapshot> {
    const txId = transactionId as `0x${string}`;
    const sdk = this.client as unknown as {
      getAppealCharge?: (args: { txId: `0x${string}` }) => Promise<bigint>;
    };
    const charge =
      typeof sdk.getAppealCharge === "function"
        ? await sdk.getAppealCharge({ txId })
        : await this.client.getMinAppealBond({ txId });

    await this.client.appealTransaction({ txId, value: charge });

    const receipt = await this.client.getTransaction({ hash: txId as TransactionHash });
    const snapshot = await this.decorate(transactionId, label, receipt);
    return {
      ...snapshot,
      phase: "APPEALED",
      detail: detailFor("APPEALED", snapshot.executionSucceeded, ""),
    };
  }
}

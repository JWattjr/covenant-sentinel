import { createClient } from "genlayer-js";
import { localnet, studionet, testnetAsimov } from "genlayer-js/chains";
import type { CalldataEncodable, GenLayerChain } from "genlayer-js/types";

import type {
  CovenantDashboard,
  CovenantProposal,
  GuardedVaultConfiguration,
  PolicyVersion,
  ProtocolStatistics,
  VaultState,
} from "./types";

const SENTINEL_ADDRESS = (process.env.NEXT_PUBLIC_COVENANT_SENTINEL_ADDRESS ?? "").trim();
const VAULT_ADDRESS = (process.env.NEXT_PUBLIC_COVENANT_VAULT_ADDRESS ?? "").trim();
const RPC_URL = (process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? "https://studio.genlayer.com/api").trim();
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

type UnknownRecord = Record<string, unknown>;

function chainForEndpoint(endpoint: string): GenLayerChain {
  if (/127\.0\.0\.1|localhost/i.test(endpoint)) return localnet as GenLayerChain;
  if (/asimov/i.test(endpoint)) return testnetAsimov as GenLayerChain;
  return studionet as GenLayerChain;
}

function requireAddress(value: string, label: string): `0x${string}` {
  if (!ADDRESS_PATTERN.test(value)) throw new Error(`${label} is not configured.`);
  return value as `0x${string}`;
}

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
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export async function readCovenantDashboard(): Promise<CovenantDashboard> {
  const sentinel = requireAddress(SENTINEL_ADDRESS, "Covenant Sentinel address");
  const vault = requireAddress(VAULT_ADDRESS, "Guarded Vault address");
  const client = createClient({ chain: chainForEndpoint(RPC_URL), endpoint: RPC_URL });
  const read = (address: `0x${string}`, functionName: string, args: CalldataEncodable[] = []) =>
    client.readContract({ address, functionName, args });

  // Keep StudioNet reads sequential. One shared, cacheable server response is
  // substantially cheaper than every browser issuing this sequence itself.
  const currentVersionRaw = await read(sentinel, "get_current_policy_version");
  const statisticsRaw = await read(sentinel, "get_statistics");
  const configurationRaw = await read(sentinel, "get_guarded_vault_configuration");
  const domainsRaw = await read(sentinel, "get_approved_evidence_domains");
  const vaultRaw = await read(vault, "get_state");
  const proposalIdsRaw = await read(sentinel, "get_proposal_ids", [0, 50]);

  const currentVersion = numberValue(currentVersionRaw);
  const proposalIds = strings(record(proposalIdsRaw).ids);
  const policyRaw = currentVersion > 0 ? await read(sentinel, "get_policy", [currentVersion]) : null;
  const proposals: CovenantProposal[] = [];

  for (const proposalId of proposalIds) {
    proposals.push(plainValue(await read(sentinel, "get_proposal", [proposalId])) as CovenantProposal);
  }

  return {
    policy: policyRaw === null ? null : (plainValue(policyRaw) as PolicyVersion),
    proposals,
    statistics: plainValue(statisticsRaw) as ProtocolStatistics,
    configuration: plainValue(configurationRaw) as GuardedVaultConfiguration,
    domains: strings(record(domainsRaw).domains),
    vault: plainValue(vaultRaw) as VaultState,
  };
}

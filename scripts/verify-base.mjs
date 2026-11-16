// Read-only check of the deployed Covenant Sentinel and Vault on StudioNet.
// No writes, no signing. Reads are sequential to respect the public RPC limits.
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const RPC = "https://studio.genlayer.com/api";
const SENTINEL = "0x7CeA0E0D9E2a343C29fdDa253d3925c3Aba9b924";
const VAULT = "0xEB10CF48D9EffA69b66d9013289F5206631E86e9";

const client = createClient({ chain: studionet, endpoint: RPC });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function read(label, address, functionName, args = []) {
  try {
    const value = await client.readContract({ address, functionName, args });
    console.log(`OK   ${label}:`, JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
    return value;
  } catch (error) {
    console.log(`FAIL ${label}: ${error?.message ?? error}`);
    return undefined;
  } finally {
    await pause(2500);
  }
}

console.log(`chain ${studionet.id} via ${RPC}`);
await read("sentinel.get_current_policy_version", SENTINEL, "get_current_policy_version");
await read("sentinel.get_statistics", SENTINEL, "get_statistics");
await read("sentinel.get_guarded_vault_configuration", SENTINEL, "get_guarded_vault_configuration");
await read("sentinel.get_approved_evidence_domains", SENTINEL, "get_approved_evidence_domains");
await read("vault.get_state", VAULT, "get_state");

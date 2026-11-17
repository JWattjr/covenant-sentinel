// Read-only verification of deploy/proof-v1.json. Writes nothing and signs nothing.
// Checks every explorer link through the explorer API (browser user agent), and re-reads the
// three contracts' current state from StudioNet.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { addressLink, txLink, verifyAddress, verifyTx } from "./lib/explorer.mjs";

const PROOF = "deploy/proof-v1.json";
const RPC = "https://studio.genlayer.com/api";
const proof = JSON.parse(readFileSync(PROOF, "utf8"));
const client = createClient({ chain: studionet, endpoint: RPC });
const failures = [];
const rows = [];

async function checkAddress(label, address) {
  const expected = addressLink(address);
  const result = await verifyAddress(address);
  rows.push({ kind: "address", label, link: expected, ok: result.ok, detail: result.type ?? result.detail });
  if (!result.ok) failures.push(`${label} ${address} is not a CONTRACT on the explorer`);
}

async function checkTx(label, hash) {
  const link = txLink(hash);
  const result = await verifyTx(hash);
  rows.push({ kind: "tx", label, link, ok: result.ok, detail: result.status ?? result.detail });
  if (!result.ok) failures.push(`${label} ${hash} is not FINALIZED on the explorer`);
}

// Existing system and new contracts.
await checkAddress("Sentinel (existing)", proof.existing.sentinel);
await checkAddress("Vault (existing)", proof.existing.vault);
for (const [name, c] of Object.entries(proof.contracts)) {
  await checkAddress(name, c.address);
  await checkTx(`${name} deploy`, c.deployHash);
}
// Every transaction recorded during the live run.
for (const t of proof.transactions) {
  await checkTx(t.label, t.hash);
}

// The frozen policy inside PolicyAmendments must equal the Sentinel's immutable policy v1 (checked on chain, not trusted).
const policy = await client.readContract({ address: proof.existing.sentinel, functionName: "get_policy", args: [1n] });
const liveSha = createHash("sha256").update(policy.policy_text, "utf8").digest("hex");
const frozenChecks = Object.entries(proof.final.amendment).map(([name, a]) => ({ name, frozenSha: a.record.current_sha256, ok: a.record.current_sha256 === liveSha }));
for (const c of frozenChecks) if (!c.ok) failures.push(`amendment ${c.name} froze a policy that differs from the Sentinel's live policy v1`);

// Live reads, kept separate from the recorded proof above.
const live = {};
live.amendmentTighten = await client.readContract({
  address: proof.contracts.PolicyAmendments.address, functionName: "get_amendment", args: ["AMD-TIGHTEN-01"],
}).catch((e) => ({ readError: String(e?.message ?? e) }));
live.amendmentLoosen = await client.readContract({
  address: proof.contracts.PolicyAmendments.address, functionName: "get_amendment", args: ["AMD-LOOSEN-01"],
}).catch((e) => ({ readError: String(e?.message ?? e) }));
live.upgradeAdvance = await client.readContract({
  address: proof.contracts.UpgradeGuard.address, functionName: "get_upgrade", args: ["UPG-ADVANCE-01"],
}).catch((e) => ({ readError: String(e?.message ?? e) }));

const summary = {
  network: proof.network,
  chainId: proof.chainId,
  links: rows,
  sentinelPolicyV1Sha256: liveSha,
  frozenPolicyChecks: frozenChecks,
  linkFailures: failures,
  live,
  deposits: proof.deposits,
};
console.log(JSON.stringify(summary, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
if (failures.length) {
  console.error(`verify:proof-v1 FAILED: ${failures.length} link check(s)`);
  process.exit(1);
}
console.log(`verify:proof-v1 OK: ${rows.length} explorer links verified; ${frozenChecks.length} frozen-policy hashes match the Sentinel`);

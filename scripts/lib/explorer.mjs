// The only place explorer links are built. Canonical StudioNet formats only:
//   https://explorer-studio.genlayer.com/address/<addr>
//   https://explorer-studio.genlayer.com/tx/<hash>
// Verification goes through the explorer API with a browser user agent.

export const EXPLORER = "https://explorer-studio.genlayer.com";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HASH_RE = /^0x[0-9a-fA-F]{64}$/;

export function addressLink(address) {
  if (!ADDRESS_RE.test(address)) throw new Error(`not an address: ${address}`);
  return `${EXPLORER}/address/${address}`;
}

export function txLink(hash) {
  if (!HASH_RE.test(hash)) throw new Error(`not a tx hash: ${hash}`);
  return `${EXPLORER}/tx/${hash}`;
}

async function getJson(url) {
  // The explorer gateway sometimes answers 5xx; retry a few times so a hiccup is not reported as a failed link.
  let response;
  for (let attempt = 0; attempt < 4; attempt++) {
    response = await fetch(url, { headers: { "user-agent": BROWSER_UA, accept: "application/json" } });
    if (response.status < 500) break;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

// Returns { ok, type, detail }. A contract must report type CONTRACT.
export async function verifyAddress(address) {
  const { status, body } = await getJson(`${EXPLORER}/api/address/${address}`);
  if (status !== 200 || !body) return { ok: false, type: null, detail: `HTTP ${status}` };
  return { ok: body.type === "CONTRACT", type: body.type ?? null, detail: "address API" };
}

// Returns { ok, status, detail }. A transaction must exist and be FINALIZED or ACCEPTED.
export async function verifyTx(hash) {
  const { status, body } = await getJson(`${EXPLORER}/api/transactions/${hash}`);
  if (status !== 200 || !body) return { ok: false, status: null, detail: `HTTP ${status}` };
  const tx = body.transaction ?? body;
  const txStatus = tx.status ?? null;
  return { ok: txStatus === "FINALIZED" || txStatus === "ACCEPTED", status: txStatus, detail: "transactions API" };
}

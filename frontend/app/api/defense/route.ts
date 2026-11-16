import { NextResponse } from "next/server";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live, read-only StudioNet reads for the Defense suite. The browser cannot call the RPC directly (CORS),
// so this route does it server-side. Addresses are passed in by the page from the recorded proof and checked here.
const RPC = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const bigintSafe = (_k: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const amendments = params.get("amendments") ?? "";
  const upgrades = params.get("upgrades") ?? "";
  const treasury = params.get("treasury") ?? "";
  const spenders = (params.get("spenders") ?? "").split(",").filter(Boolean);
  if (![amendments, upgrades, treasury].every((a) => ADDRESS.test(a)) || spenders.some((s) => !ADDRESS.test(s))) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  const client = createClient({ chain: studionet as never, endpoint: RPC });
  const read = (address: string, functionName: string, args: string[]) =>
    client.readContract({ address: address as `0x${string}`, functionName, args });
  try {
    const out = {
      observedAt: new Date().toISOString(),
      amendments: [] as unknown[],
      upgrades: [] as unknown[],
      spenders: [] as unknown[],
    };
    // Sequential on purpose: the public RPC rejects bursts.
    for (const id of ["AMD-TIGHTEN-01", "AMD-LOOSEN-01", "AMD-TIGHTEN-02"]) out.amendments.push(await read(amendments, "get_amendment", [id]));
    for (const id of ["UPG-ADVANCE-01", "UPG-ROLLBACK-01", "UPG-INJECT-01", "UPG-VOID-01"]) out.upgrades.push(await read(upgrades, "get_upgrade", [id]));
    for (const who of spenders) out.spenders.push(await read(treasury, "get_spender", [who]));
    return new NextResponse(JSON.stringify(out, bigintSafe), { headers: { "content-type": "application/json" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "read failed" }, { status: 502 });
  }
}

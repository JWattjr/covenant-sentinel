"use client";

import { useEffect, useState } from "react";

// Two sources, kept apart on purpose:
//  - RECORDED: /defense/proof-v1.json, written by scripts/run-case.mjs at the end of the live run.
//  - LIVE: read-only calls to StudioNet made now. No wallet is needed for either.

type Tx = { label: string; hash: string; link: string; consensus: string | null; execution: string | null; error: string | null; note?: string };
type Proof = {
  network: string;
  chainId: number;
  generatedAt: string;
  deposits: { weiSent: string; note: string };
  contracts: Record<string, { address: string; link: string; deployHash: string; deployLink: string }>;
  transactions: Tx[];
  final: {
    amendment: { tighten: Amendment; loosen: Amendment; tighten2?: Amendment; tighten3?: Amendment };
    upgrades: Record<string, Upgrade>;
  };
  state: { c8?: { spenderA?: Spender; spenderB?: Spender } } & Record<string, unknown>;
  governorStep?: {
    amendment: string;
    sentinelPolicyVersion: number;
    policyV2: { max_transfer_amount: number; canonical_id: string; sha256: string };
    spend: { id: string; amount: number; outcome: string; reason: string };
  };
};
type Amendment = {
  record: { amendment_id: string; new_url: string; effective_at: number; appeal_open_until: number };
  state: string;
  outcome: { verdict?: string; reason_code?: string; quote?: string; status?: string; reason?: string };
};
type Upgrade = {
  record: { upgrade_id: string; new_url: string; timelock_until: number };
  state: string;
  outcome: { verdict?: string; reason_code?: string; quote?: string; flags?: string[]; status?: string; reason?: string };
};
type Spender = { spender: string; stats: { clean: number; violations: number; frozen: boolean }; multiplier: number };

const iso = (seconds: number) => (seconds ? new Date(seconds * 1000).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—");

function Pill({ tone, children }: { tone: "proof" | "live" | "bad" | "ok"; children: React.ReactNode }) {
  const cls = {
    proof: "bg-[#e6ebff] text-[#2c4fc7]",
    live: "bg-[#e3f5e8] text-[#1d6b3a]",
    bad: "bg-[#fde4e1] text-[#8c2b20]",
    ok: "bg-[#eef1ea] text-[#3c4a2a]",
  }[tone];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{children}</span>;
}

// A transaction is only a success when consensus is FINALIZED and execution returned.
function txState(tx: Tx) {
  if (tx.error) return { label: "Not finalized", tone: "bad" as const };
  if (tx.consensus === "FINALIZED" && (tx.execution === "SUCCESS" || tx.execution === "FINISHED_WITH_RETURN")) return { label: "Finalized, returned", tone: "ok" as const };
  if (tx.consensus === "FINALIZED" && tx.note) return { label: "Finalized, refused by contract (expected)", tone: "proof" as const };
  if (tx.consensus === "FINALIZED") return { label: `Finalized, execution ${tx.execution ?? "unknown"}`, tone: "bad" as const };
  return { label: `Consensus ${tx.consensus ?? "unknown"}`, tone: "bad" as const };
}

export function DefenseSuite() {
  const [proof, setProof] = useState<Proof | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const [live, setLive] = useState<{ amendments?: Amendment[]; upgrades?: Upgrade[]; spenders?: Spender[]; error?: string } | null>(null);

  useEffect(() => {
    fetch("/defense/proof-v1.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: Proof) => setProof(data))
      .catch((e: Error) => setProofError(e.message));
  }, []);

  useEffect(() => {
    if (!proof) return;
    let cancelled = false;
    const query = new URLSearchParams({
      amendments: proof.contracts.PolicyAmendments.address,
      upgrades: proof.contracts.UpgradeGuard.address,
      treasury: proof.contracts.TreasuryRecord.address,
      spenders: [proof.state.c8?.spenderA?.spender, proof.state.c8?.spenderB?.spender].filter(Boolean).join(","),
    });
    fetch(`/api/defense?${query.toString()}`)
      .then((r) => r.json().then((body) => (r.ok ? body : Promise.reject(new Error(body.error ?? `HTTP ${r.status}`)))))
      .then((body) => {
        if (!cancelled) setLive({ amendments: body.amendments, upgrades: body.upgrades, spenders: body.spenders });
      })
      .catch((e: Error) => {
        if (!cancelled) setLive({ error: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [proof]);

  if (proofError) return <p className="text-sm text-[#8c2b20]">Recorded proof could not be loaded ({proofError}).</p>;
  if (!proof) return <p className="text-sm text-[#63655f]">Loading recorded proof…</p>;

  const tighten = proof.final.amendment.tighten;
  const loosen = proof.final.amendment.loosen;
  const upgradeOrder: [string, string][] = [
    ["advance", "ADVANCE: docstring only"],
    ["rollback", "ROLLBACK: hidden external call"],
    ["inject", "ROLLBACK: injected comment, hidden call"],
    ["void", "VOID: evidence unreachable"],
  ];

  return (
    <div className="space-y-14">
      <p className="text-sm leading-6 text-[#45484f]">
        Recorded proof is what the live run produced. Live reads are fetched now from StudioNet, and the two are never merged.
        Chain {proof.chainId} · {proof.network} · recorded {proof.generatedAt.slice(0, 16).replace("T", " ")} UTC · deposits {proof.deposits.weiSent} wei.
      </p>

      <section aria-labelledby="amendments">
        <h2 id="amendments" className="display-title text-4xl">Policy amendment timeline</h2>
        <p className="mt-2 text-sm text-[#63655f]">The governor proposes a commit-pinned policy text. Validators compare it with the frozen Sentinel policy and quote the changed clause. Each verdict sets its own delay.</p>
        <ol className="mt-6 divide-y divide-black/12 border-y border-black/12">
          {[{ name: "TIGHTEN attempt 1 (lower cap)", a: tighten, live: live?.amendments?.[0] }, { name: "LOOSEN", a: loosen, live: live?.amendments?.[1] }, ...(proof.final.amendment.tighten2 ? [{ name: "TIGHTEN attempt 2 (new rule)", a: proof.final.amendment.tighten2, live: live?.amendments?.[2] }] : []), ...(proof.final.amendment.tighten3 ? [{ name: "TIGHTEN attempt 3 (explicit cap) → published", a: proof.final.amendment.tighten3, live: live?.amendments?.[3] }] : [])].map(({ name, a, live: l }) => (
            <li key={name} className="grid gap-3 py-6 sm:grid-cols-[12rem_1fr]">
              <div>
                <p className="font-semibold">{name}</p>
                <p className="mt-1 font-mono text-xs text-[#777972]">{a.record.amendment_id}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Pill tone="proof">Recorded: {a.outcome.verdict ?? a.outcome.status}</Pill>
                  <Pill tone="proof">{a.state}</Pill>
                  {l?.outcome?.verdict ? <Pill tone="live">Live: {l.outcome.verdict} · {l.state}</Pill> : null}
                </div>
                <p className="text-[#45484f]">Reason: <span className="font-mono">{a.outcome.reason_code ?? a.outcome.reason}</span></p>
                {a.record.amendment_id === "AMD-TIGHTEN-01" ? <p className="text-xs text-[#63655f]">Note: this text says “5,000 DEMO, the published maximum”, which conflicts with the Sentinel’s 10,000 cap. The wording was ambiguous, which likely explains the NEUTRAL verdict. Attempt 2 below adds a new rule instead.</p> : null}
                {a.outcome.quote ? <blockquote className="border-l-2 border-[#315fe8] pl-3 text-[#303238]">“{a.outcome.quote}”</blockquote> : null}
                <p className="text-[#63655f]">Takes effect: {iso(a.record.effective_at)}</p>
                {a.outcome.verdict === "LOOSENS" ? (
                  <p className="text-[#63655f]">
                    Appeal window open until {iso(a.record.appeal_open_until)}. Native appeal is not exposed on StudioNet, so the window is shown, not actionable.
                  </p>
                ) : null}
                <p className="text-xs text-[#777972]">Proposed text (commit-pinned): <a className="underline" href={a.record.new_url} target="_blank" rel="noreferrer">{a.record.new_url}</a></p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {proof.governorStep ? (
        <section aria-labelledby="governor" className="rounded-2xl border border-[#315fe8]/30 bg-[#eef1ff] p-6">
          <h2 id="governor" className="display-title text-4xl">From verdict to enforcement</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[#303238]">
            <li>Validators judged amendment <span className="font-mono">{proof.governorStep.amendment}</span> TIGHTENS: the R1 cap falls from 10,000 to 5,000 DEMO.</li>
            <li>After its delay it became ACTIVE, and the Sentinel&apos;s governor published that exact text as policy v{proof.governorStep.sentinelPolicyVersion} (cap {proof.governorStep.policyV2.max_transfer_amount.toLocaleString()} DEMO, text hash <span className="font-mono">{proof.governorStep.policyV2.sha256.slice(0, 12)}…</span>).</li>
            <li>A {proof.governorStep.spend.amount.toLocaleString()} DEMO spend (<span className="font-mono">{proof.governorStep.spend.id}</span>) was then refused at submit: {proof.governorStep.spend.reason}. Under policy v1 it would have passed this check.</li>
          </ol>
          <p className="mt-3 text-xs text-[#63655f]">Only the R1 cap is enforced deterministically by the existing Sentinel. Its evaluator accepts rule IDs R1 to R5, so the new rule R6 from attempt 2 cannot be enforced without changing the Sentinel.</p>
        </section>
      ) : null}

      <section aria-labelledby="upgrades">
        <h2 id="upgrades" className="display-title text-4xl">Upgrade review</h2>
        <p className="mt-2 text-sm text-[#63655f]">Validators read the old and new source at pinned commits, compute a bounded diff, and quote one line. A deterministic scanner flags any added call or capability. Unreachable evidence is VOID, never a verdict.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {upgradeOrder.map(([key, title]) => {
            const u = proof.final.upgrades[key];
            if (!u) return null;
            const lv = live?.upgrades?.find((x) => x.record?.upgrade_id === u.record.upgrade_id);
            return (
              <article key={key} className="rounded-2xl border border-black/10 bg-white p-5">
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 font-mono text-xs text-[#777972]">{u.record.upgrade_id}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone="proof">Recorded: {u.state}</Pill>
                  {lv ? <Pill tone="live">Live: {lv.state}</Pill> : null}
                </div>
                <p className="mt-3 text-sm text-[#45484f]">
                  Verdict: <span className="font-mono">{u.outcome.verdict ?? u.outcome.status}</span>
                  {u.outcome.reason_code ? <> · <span className="font-mono">{u.outcome.reason_code}</span></> : null}
                </p>
                {u.outcome.flags && u.outcome.flags.length ? <p className="mt-2 text-xs text-[#8c2b20]">Scanner flags: {u.outcome.flags.join(", ")}</p> : null}
                {u.outcome.quote ? <pre className="mt-3 overflow-x-auto rounded-lg bg-[#f4f4f1] p-3 font-mono text-xs leading-5 text-[#303238]">{u.outcome.quote}</pre> : null}
                {u.outcome.reason ? <p className="mt-3 text-xs text-[#63655f]">No verdict: {u.outcome.reason}</p> : null}
                {u.state === "ADVANCED" ? <p className="mt-3 text-xs text-[#63655f]">Timelock until {iso(u.record.timelock_until)}</p> : null}
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="spenders">
        <h2 id="spenders" className="display-title text-4xl">Spender record</h2>
        <p className="mt-2 text-sm text-[#63655f]">Written only from finalized Sentinel results. Three clean executed actions with no violations raise the allowance to 2x. Any BLOCK freezes the spender. The DEMO credit itself happens in the vault. The claim only records a receipt after that credit is verified, and the treasury record moves no funds.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[proof.state.c8?.spenderA, proof.state.c8?.spenderB].map((s, i) => {
            if (!s) return null;
            const lv = live?.spenders?.find((x) => x.spender === s.spender);
            return (
              <article key={s.spender} className="rounded-2xl border border-black/10 bg-white p-5">
                <p className="text-sm font-semibold">{i === 0 ? "Spender A (3 allowed spends)" : "Spender B (1 blocked spend)"}</p>
                <p className="mt-1 break-all font-mono text-xs text-[#777972]">{s.spender}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone="proof">Recorded: {s.multiplier === 0 ? "frozen" : `${s.multiplier}x`}</Pill>
                  {lv ? <Pill tone="live">Live: {lv.multiplier === 0 ? "frozen" : `${lv.multiplier}x`}</Pill> : null}
                </div>
                <p className="mt-3 text-sm text-[#45484f]">Clean executed: {s.stats.clean} · Violations: {s.stats.violations}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="transactions">
        <h2 id="transactions" className="display-title text-4xl">Transactions</h2>
        <p className="mt-2 text-sm text-[#63655f]">A transaction counts as a success only when consensus is FINALIZED and the GenVM execution returned. A status alone is not enough.</p>
        <ul className="mt-6 divide-y divide-black/10 border-y border-black/10 text-sm">
          {proof.transactions.map((tx) => {
            const s = txState(tx);
            return (
              <li key={tx.hash} className="grid gap-2 py-3 sm:grid-cols-[14rem_1fr_auto] sm:items-center">
                <span className="font-mono text-xs">{tx.label}{tx.note ? <span className="mt-1 block font-sans text-[11px] leading-4 text-[#63655f]">{tx.note}</span> : null}</span>
                <a className="truncate font-mono text-xs text-[#2c4fc7] underline" href={tx.link} target="_blank" rel="noreferrer">{tx.hash}</a>
                <Pill tone={s.tone}>{s.label}</Pill>
              </li>
            );
          })}
        </ul>
      </section>

      {live?.error ? <p className="text-xs text-[#8c2b20]">Live reads unavailable: {live.error}. The recorded proof above is unaffected.</p> : null}
    </div>
  );
}

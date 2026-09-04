"use client";

import { CircleHelp, Gavel, LoaderCircle, RefreshCw, ShieldCheck, Waypoints } from "lucide-react";

import { deploymentConfiguration } from "@/lib/covenant/client";
import type { CovenantDashboard, TransactionSnapshot } from "@/lib/covenant/types";

import { StatusBadge } from "./StatusBadge";

function truncate(value: string, head = 10, tail = 6) {
  return value.length > head + tail + 1 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

function executionLabel(snapshot: TransactionSnapshot) {
  if (snapshot.executionSucceeded === true) return "execution returned";
  if (snapshot.executionSucceeded === false) return "execution reverted";
  return "execution result pending";
}

function TransactionCard({
  snapshot,
  busy,
  onAppeal,
  onRefresh,
}: {
  snapshot: TransactionSnapshot;
  busy: boolean;
  onAppeal: (snapshot: TransactionSnapshot) => void;
  onRefresh: (snapshot: TransactionSnapshot) => void;
}) {
  return (
    <li className="rounded-xl border border-white/8 bg-black/20 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-xs font-medium text-slate-200">{snapshot.label}</p>
        <StatusBadge status={snapshot.phase} title={`Consensus status: ${snapshot.statusName || "unknown"}`} />
      </div>

      <p className="mt-2 break-all font-mono text-[10px] text-slate-500">{snapshot.hash}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-slate-500">
        <span>{snapshot.statusName || "status pending"}</span>
        <span aria-hidden="true">·</span>
        <span className={snapshot.executionSucceeded === false ? "text-rose-300" : undefined}>
          {executionLabel(snapshot)}
        </span>
      </div>

      <p className="mt-2 text-[11px] leading-5 text-slate-400">{snapshot.detail}</p>

      {snapshot.triggeredIds.length ? (
        <div className="mt-3 rounded-lg border border-indigo-300/15 bg-indigo-300/[0.05] p-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-indigo-200">
            <Waypoints className="size-3" /> {snapshot.triggeredIds.length} child message(s)
          </p>
          <ul className="mt-1.5 space-y-1">
            {snapshot.triggeredIds.map((id) => (
              <li key={id} className="font-mono text-[10px] text-slate-400">
                {truncate(id, 14, 8)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="secondary-button flex-1 !py-1.5 !text-[11px]"
          disabled={busy}
          onClick={() => onRefresh(snapshot)}
        >
          {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Refresh lifecycle
        </button>
        {snapshot.appealable ? (
          <button
            type="button"
            className="primary-button flex-1 !py-1.5 !text-[11px]"
            disabled={busy}
            onClick={() => onAppeal(snapshot)}
          >
            {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Gavel className="size-3.5" />}
            Appeal
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function TransactionRail({
  dashboard,
  transactions,
  busy,
  onAppeal,
  onRefresh,
}: {
  dashboard?: CovenantDashboard;
  transactions: TransactionSnapshot[];
  busy: boolean;
  onAppeal: (snapshot: TransactionSnapshot) => void;
  onRefresh: (snapshot: TransactionSnapshot) => void;
}) {
  const config = deploymentConfiguration();

  return (
    <aside className="space-y-4">
      <section className="panel p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Lifecycle observer</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">
              Decided is not durable. Only finality releases the vault instruction.
            </p>
          </div>
        </div>

        {transactions.length ? (
          <ul className="mt-4 space-y-2.5">
            {transactions.map((snapshot) => (
              <TransactionCard
                key={snapshot.hash}
                snapshot={snapshot}
                busy={busy}
                onAppeal={onAppeal}
                onRefresh={onRefresh}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-xs leading-5 text-slate-500">
            Receipts from this session appear here with their consensus status, GenVM execution
            result, and any finality-safe child messages the contract emitted.
          </p>
        )}
      </section>

      <section className="panel p-5">
        <p className="eyebrow">Evidence perimeter</p>
        <p className="mt-2 text-sm font-medium text-slate-100">
          {dashboard?.domains.length ?? 0} approved domain(s)
        </p>
        <div className="mt-3 space-y-2">
          {(dashboard?.domains ?? []).map((domain) => (
            <p
              key={domain}
              className="rounded-lg border border-white/8 bg-black/15 px-3 py-2 font-mono text-[11px] text-slate-300"
            >
              {domain}
            </p>
          ))}
          {!dashboard?.domains.length ? (
            <p className="text-xs leading-5 text-slate-500">
              The live allowlist loads from the deployed contract. Evidence outside it is rejected
              before any web call is made.
            </p>
          ) : null}
        </div>
      </section>

      <section className="panel p-5">
        <p className="eyebrow">Live configuration</p>
        <dl className="mt-4 space-y-3 text-xs">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Network</dt>
            <dd className="font-mono text-slate-200">{config.networkName}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Sentinel</dt>
            <dd className="font-mono text-slate-200">
              {config.sentinelAddress ? truncate(config.sentinelAddress) : "not set"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Vault</dt>
            <dd className="font-mono text-slate-200">
              {config.vaultAddress ? truncate(config.vaultAddress) : "not set"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Governor</dt>
            <dd className="font-mono text-slate-200">
              {dashboard?.configuration.governor ? truncate(dashboard.configuration.governor) : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel border-cyan-300/10 bg-cyan-300/[0.025] p-5">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-200" />
          <div>
            <p className="text-sm font-medium text-slate-100">Protocol constraint</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              No UI, governor, reporter, or keeper can bypass the Sentinel-to-Vault authorization
              path. The vault trusts exactly one caller, configured once.
            </p>
          </div>
        </div>
        <a
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-cyan-200 hover:text-cyan-100"
          href="#trust-boundaries"
        >
          <CircleHelp className="size-3.5" /> Review trust boundaries
        </a>
      </section>
    </aside>
  );
}

import { Activity, AlertTriangle, Database, LockKeyhole, ShieldCheck, Signal } from "lucide-react";

import type { CovenantDashboard } from "@/lib/covenant/types";

import { StatusBadge } from "./StatusBadge";

function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof ShieldCheck;
}) {
  return (
    <section className="metric-card">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        <Icon className="size-4 text-slate-400" aria-hidden="true" />
      </div>
      <p className="mt-5 text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </section>
  );
}

export function ProtocolOverview({ dashboard }: { dashboard?: CovenantDashboard }) {
  const vault = dashboard?.vault;
  const policy = dashboard?.policy ?? null;
  const statistics = dashboard?.statistics;
  // Without live vault state, say so rather than implying the vault is open.
  const protectionStatus = !vault ? "UNKNOWN" : vault.paused ? "BLOCK" : "ALLOW";

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Active policy"
          value={policy ? `v${policy.version}` : "—"}
          detail={policy ? policy.canonical_id : "No policy published yet"}
          icon={LockKeyhole}
        />
        <Metric
          label="Hard transfer cap"
          value={policy ? `${policy.max_transfer_amount.toLocaleString()}` : "—"}
          detail={
            policy
              ? "R1 is enforced in contract code before any AI evaluation"
              : "Published with the policy version"
          }
          icon={ShieldCheck}
        />
        <Metric
          label="Guarded balance"
          value={vault ? `${vault.demo_balance.toLocaleString()} DEMO` : "—"}
          detail="Simulated treasury accounting, not real custody"
          icon={Database}
        />
        <section className="metric-card">
          <div className="flex items-start justify-between gap-3">
            <p className="eyebrow">Vault protection</p>
            <AlertTriangle className="size-4 text-slate-400" aria-hidden="true" />
          </div>
          <div className="mt-5">
            <StatusBadge status={protectionStatus} />
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            {!vault
              ? "Awaiting live vault state"
              : vault.paused
                ? `Paused by ${vault.pause_incident_id} for up to ${vault.pause_duration_hours}h`
                : "No emergency pause active"}
          </p>
        </section>
      </div>

      <section className="panel mt-4 overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="relative overflow-hidden border-b border-white/8 px-5 py-6 lg:border-b-0 lg:border-r lg:px-7 lg:py-7">
            <div className="hero-grid" aria-hidden="true" />
            <div className="relative max-w-2xl">
              <div className="flex items-center gap-2 text-cyan-200">
                <Signal className="size-4" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]">
                  Intelligent-contract control plane
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                Safe action is a consensus result, not an operator promise.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                Covenant Sentinel binds every proposal to an immutable policy version, independently
                gathers approved evidence on the leader and on each validator, and instructs the
                guarded vault only after a consensus-backed decision has finalized.
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ["Submitted", statistics?.submitted ?? 0],
                  ["Allowed", statistics?.allow ?? 0],
                  ["Blocked", (statistics?.block ?? 0) + (statistics?.timelock ?? 0)],
                  ["Executed", statistics?.executed ?? 0],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt className="eyebrow">{label}</dt>
                    <dd className="mt-1 text-lg font-semibold text-slate-100">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <div className="space-y-4 px-5 py-6 lg:px-6 lg:py-7" id="trust-boundaries">
            <div>
              <p className="eyebrow">Protocol posture</p>
              <p className="mt-2 text-sm font-medium text-slate-100">
                Fail closed • finality-safe • replay protected
              </p>
            </div>
            <div className="space-y-2.5 text-xs leading-5 text-slate-400">
              <p>
                <span className="text-cyan-200">01</span> The deterministic R1 transfer cap is
                enforced before any nondeterministic evaluation runs.
              </p>
              <p>
                <span className="text-cyan-200">02</span> Approved HTTPS evidence is refetched
                independently by the leader and by every validator.
              </p>
              <p>
                <span className="text-cyan-200">03</span> Unreachable evidence is a deterministic
                INSUFFICIENT_EVIDENCE, never an allow.
              </p>
              <p>
                <span className="text-cyan-200">04</span> Vault instructions are emitted{" "}
                <code className="font-mono text-slate-300">on=&quot;finalized&quot;</code>, so the
                appeal window cannot move funds.
              </p>
              <p>
                <span className="text-cyan-200">05</span> The vault answers exactly one configured
                Sentinel; the governor cannot bypass it.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-black/15 px-3 py-2 text-[11px] text-slate-400">
              <Activity className="size-3.5 shrink-0 text-slate-500" />
              Live state is read from the deployed contracts only.
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

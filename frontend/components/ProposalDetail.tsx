"use client";

import {
  BadgeCheck,
  ExternalLink,
  Gavel,
  LoaderCircle,
  LockKeyhole,
  Play,
  ShieldAlert,
  TimerReset,
} from "lucide-react";

import type { CovenantProposal } from "@/lib/covenant/types";

import { StatusBadge } from "./StatusBadge";

function shortAddress(value: string) {
  if (!value) return "—";
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

/** Plain-language meaning of the contract's `execution_status` field. */
const EXECUTION_COPY: Record<string, string> = {
  NOT_QUEUED: "No vault instruction exists for this proposal.",
  QUEUED_FINALITY:
    "Allowed. The vault instruction is held until the parent transaction finalizes — it has not run yet.",
  SUCCEEDED: "The guarded vault executed and acknowledged this action through a finalized message.",
  UNPAUSE_QUEUED: "A manual release is queued and will reach the vault after finality.",
  CANCELLED: "Cancelled before evaluation.",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow mb-2">{children}</p>;
}

export function ProposalDetail({
  proposal,
  canEvaluate,
  onEvaluate,
  onRelease,
  loading,
}: {
  proposal: CovenantProposal | null;
  canEvaluate: boolean;
  onEvaluate: (proposalId: string) => void;
  onRelease: (incidentId: string) => void;
  loading: boolean;
}) {
  if (!proposal) {
    return (
      <section className="panel grid min-h-[31rem] place-items-center p-6 text-center">
        <div>
          <Gavel className="mx-auto size-7 text-slate-600" />
          <p className="mt-3 text-sm font-medium text-slate-300">
            Select a proposal to inspect its policy trace
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Evidence, verdict fields, and finality state stay bound to the same identifier.
          </p>
        </div>
      </section>
    );
  }

  const isPending = proposal.status === "PENDING";
  const canRelease = proposal.proposal_type === "EMERGENCY_PAUSE" && proposal.status === "EXECUTED";
  const executionCopy =
    EXECUTION_COPY[proposal.execution_status] ?? "Execution state reported by the contract.";

  return (
    <section className="panel min-h-[31rem] overflow-hidden">
      <div className="border-b border-white/8 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Decision trace</p>
            <h2 className="mt-1 truncate text-base font-semibold text-white">
              {proposal.proposal_id}
            </h2>
          </div>
          <StatusBadge status={proposal.status} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">
          <span>{proposal.proposal_type.replaceAll("_", " ")}</span>
          <span>Policy v{proposal.policy_version}</span>
          <span>Sequence {proposal.created_sequence}</span>
          <span>Proposer {shortAddress(proposal.proposer)}</span>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="data-cell">
            <SectionTitle>Target</SectionTitle>
            <p className="font-mono text-xs text-slate-200">{shortAddress(proposal.target)}</p>
          </div>
          <div className="data-cell">
            <SectionTitle>Execution</SectionTitle>
            <p className="text-xs font-medium text-slate-200">
              {proposal.execution_status.replaceAll("_", " ")}
            </p>
          </div>
        </div>

        <p className="text-[11px] leading-5 text-slate-500">{executionCopy}</p>

        {proposal.proposal_type === "TREASURY_TRANSFER" ? (
          <div className="data-cell">
            <SectionTitle>Requested transfer</SectionTitle>
            <p className="text-sm font-medium text-slate-100">
              {proposal.amount.toLocaleString()} {proposal.asset_id}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{proposal.purpose}</p>
          </div>
        ) : (
          <div className="data-cell border-orange-300/15 bg-orange-300/[0.035]">
            <SectionTitle>Emergency request</SectionTitle>
            <p className="flex items-center gap-2 text-sm font-medium text-orange-100">
              <ShieldAlert className="size-4" /> {proposal.requested_pause_hours} hour maximum pause
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{proposal.incident_claim}</p>
          </div>
        )}

        <div>
          <SectionTitle>Approved evidence</SectionTitle>
          <div className="space-y-2">
            {proposal.evidence_urls.map((url, index) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="evidence-link">
                <span className="grid size-5 shrink-0 place-items-center rounded bg-cyan-300/10 font-mono text-[9px] text-cyan-100">
                  E{index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{url}</span>
                <ExternalLink className="size-3.5 shrink-0" />
              </a>
            ))}
          </div>
        </div>

        {proposal.verdict ? (
          <div className="rounded-xl border border-white/8 bg-black/15 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle>Consensus verdict</SectionTitle>
              <div className="flex gap-2">
                <StatusBadge status={proposal.verdict} />
                <StatusBadge status={proposal.risk_level || "UNKNOWN"} title="Assessed risk level" />
              </div>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-200">{proposal.summary}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              {proposal.satisfied_rule_ids.map((rule) => (
                <span key={`sat-${rule}`} className="rule-chip !border-emerald-300/20 !text-emerald-200">
                  <BadgeCheck className="mr-1 size-3" /> {rule}
                </span>
              ))}
              {proposal.violated_rule_ids.map((rule) => (
                <span key={`vio-${rule}`} className="rule-chip !border-rose-300/20 !text-rose-200">
                  <ShieldAlert className="mr-1 size-3" /> {rule}
                </span>
              ))}
              <span className="rule-chip">{proposal.reason_code}</span>
            </div>

            {proposal.evidence_findings.length ? (
              <ul className="mt-4 space-y-2 border-t border-white/8 pt-3">
                {proposal.evidence_findings.map((finding, index) => (
                  <li key={`${finding.source_id}-${finding.rule_id}-${index}`} className="flex gap-2.5">
                    <span className="mt-0.5 shrink-0 font-mono text-[10px] text-cyan-200">
                      {finding.source_id}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-500">
                      {finding.rule_id}
                    </span>
                    <span className="text-[11px] leading-5 text-slate-300">{finding.finding}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          {isPending ? (
            <button
              type="button"
              className="primary-button"
              disabled={loading || !canEvaluate}
              onClick={() => onEvaluate(proposal.proposal_id)}
            >
              {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />}
              Evaluate through consensus
            </button>
          ) : null}
          {canRelease ? (
            <button
              type="button"
              className="secondary-button"
              disabled={loading || !canEvaluate}
              onClick={() => onRelease(proposal.proposal_id)}
            >
              {loading ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <TimerReset className="size-4" />
              )}
              Queue safe release
            </button>
          ) : null}
          <span className="inline-flex items-center gap-1.5 self-center text-[11px] text-slate-500">
            <LockKeyhole className="size-3.5" />
            {isPending
              ? "No vault instruction is sent until evaluation reaches ALLOW and finalizes."
              : "The result stays tied to the policy version it was judged under."}
          </span>
        </div>
      </div>
    </section>
  );
}

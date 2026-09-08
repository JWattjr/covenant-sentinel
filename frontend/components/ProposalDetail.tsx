"use client";

import { BadgeCheck, ExternalLink, Gavel, LoaderCircle, LockKeyhole, Play, ShieldAlert, TimerReset } from "lucide-react";

import type { CovenantProposal } from "@/lib/covenant/types";

import { proposalTitle } from "./DecisionDesk";
import { StatusBadge } from "./StatusBadge";

function shortAddress(value: string) { return value ? `${value.slice(0, 8)}…${value.slice(-6)}` : "—"; }

const EXECUTION_COPY: Record<string, string> = {
  NOT_QUEUED: "No vault instruction exists for this proposal.",
  QUEUED_FINALITY: "Allowed, but held until the parent transaction finalizes. It has not run yet.",
  SUCCEEDED: "The simulated guarded vault executed and acknowledged this action through a finalized message.",
  UNPAUSE_QUEUED: "A manual release is queued and will reach the vault after finality.",
  CANCELLED: "Cancelled before evaluation.",
};

function FieldTitle({ children }: { children: React.ReactNode }) { return <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#777972]">{children}</p>; }

export function ProposalDetail({ proposal, canEvaluate, onEvaluate, onRelease, loading }: { proposal: CovenantProposal | null; canEvaluate: boolean; onEvaluate: (proposalId: string) => void; onRelease: (incidentId: string) => void; loading: boolean }) {
  if (!proposal) return <section className="panel grid min-h-[28rem] place-items-center p-8 text-center"><div><Gavel className="mx-auto size-8 text-[#94968f]" /><p className="mt-4 font-bold">Choose a case to inspect</p><p className="mt-2 max-w-sm text-sm leading-6 text-[#6a6c66]">Its request, evidence, verdict, and execution state will appear here.</p></div></section>;

  const isPending = proposal.status === "PENDING";
  const canRelease = proposal.proposal_type === "EMERGENCY_PAUSE" && proposal.status === "EXECUTED";
  return (
    <article className="panel overflow-hidden">
      <header className="bg-[#dfe6ff] p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0"><p className="font-mono text-[10px] text-[#666a74]">{proposal.proposal_id}</p><h2 className="display-title mt-3 max-w-2xl text-3xl sm:text-4xl">{proposalTitle(proposal)}</h2></div>
          <StatusBadge status={proposal.verdict || proposal.status} />
        </div>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[#555965]"><span>{proposal.proposal_type.replaceAll("_", " ")}</span><span>Policy v{proposal.policy_version}</span><span>Sequence {proposal.created_sequence}</span><span>By {shortAddress(proposal.proposer)}</span></div>
      </header>

      <div className="space-y-7 p-5 sm:p-7">
        <div className="grid gap-x-8 sm:grid-cols-2">
          <div className="data-cell"><FieldTitle>Target</FieldTitle><p className="mt-2 font-mono text-xs">{shortAddress(proposal.target)}</p></div>
          <div className="data-cell"><FieldTitle>Vault execution</FieldTitle><p className="mt-2 text-sm font-bold">{proposal.execution_status.replaceAll("_", " ")}</p><p className="mt-1 text-xs leading-5 text-[#686a65]">{EXECUTION_COPY[proposal.execution_status] ?? "Execution state reported by the contract."}</p></div>
        </div>

        <div><FieldTitle>Request</FieldTitle><p className="mt-2 text-base font-bold">{proposal.proposal_type === "TREASURY_TRANSFER" ? `${proposal.amount.toLocaleString()} ${proposal.asset_id}` : `${proposal.requested_pause_hours} hour maximum pause`}</p><p className="mt-2 max-w-3xl text-sm leading-6 text-[#61635e]">{proposal.proposal_type === "TREASURY_TRANSFER" ? proposal.purpose : proposal.incident_claim}</p></div>

        <div><FieldTitle>Approved evidence</FieldTitle><div className="mt-2">{proposal.evidence_urls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="evidence-link"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#dfe6ff] text-[10px] font-bold text-[#315fe8]">{index + 1}</span><span className="min-w-0 flex-1 truncate">{url}</span><ExternalLink className="size-4 shrink-0" /></a>)}</div><p className="mt-3 text-xs leading-5 text-[#73756f]">This public deployment uses controlled synthetic evidence. The fixtures describe demonstration facts, not real organizations or incidents.</p></div>

        {proposal.verdict ? <div className="rounded-[14px] bg-[#f2f2ee] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="display-title text-2xl">Why validators reached this result</h3><StatusBadge status={proposal.risk_level || "UNKNOWN"} title="Assessed risk level" /></div><p className="mt-4 max-w-3xl text-sm leading-6 text-[#4d4f4a]">{proposal.summary}</p><div className="mt-4 flex flex-wrap gap-2">{proposal.satisfied_rule_ids.map((rule) => <span key={`sat-${rule}`} className="rule-chip !bg-emerald-100 !text-emerald-900"><BadgeCheck className="mr-1 size-3" />{rule}</span>)}{proposal.violated_rule_ids.map((rule) => <span key={`vio-${rule}`} className="rule-chip !bg-rose-100 !text-rose-900"><ShieldAlert className="mr-1 size-3" />{rule}</span>)}<span className="rule-chip">{proposal.reason_code}</span></div>{proposal.evidence_findings.length ? <ul className="mt-5 divide-y divide-black/10 border-t border-black/10">{proposal.evidence_findings.map((finding, index) => <li key={`${finding.source_id}-${finding.rule_id}-${index}`} className="grid gap-2 py-3 text-xs leading-5 sm:grid-cols-[5rem_4rem_1fr]"><span className="font-mono font-bold text-[#315fe8]">{finding.source_id}</span><span className="font-mono text-[#777972]">{finding.rule_id}</span><span>{finding.finding}</span></li>)}</ul> : null}</div> : <p className="rounded-[14px] bg-[#fff0dd] p-4 text-sm text-[#67340f]">This request is pending. It has no consensus verdict yet.</p>}

        {proposal.verdict === "TIMELOCK" ? <p className="rounded-[14px] bg-violet-100 p-4 text-sm leading-6 text-violet-950"><strong>On hold means on hold.</strong> Covenant Sentinel does not automatically release this request. Submit a new proposal with reconciled or improved evidence.</p> : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-black/10 pt-5">{isPending ? <button type="button" className="primary-button" disabled={loading || !canEvaluate} onClick={() => onEvaluate(proposal.proposal_id)}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />}Evaluate through consensus</button> : null}{canRelease ? <button type="button" className="secondary-button" disabled={loading || !canEvaluate} onClick={() => onRelease(proposal.proposal_id)}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <TimerReset className="size-4" />}Queue safe release</button> : null}<span className="inline-flex items-center gap-1.5 text-xs text-[#70726c]"><LockKeyhole className="size-3.5" />{isPending ? "Connect a wallet in Operate to evaluate." : "Bound to the policy version shown above."}</span></div>
      </div>
    </article>
  );
}

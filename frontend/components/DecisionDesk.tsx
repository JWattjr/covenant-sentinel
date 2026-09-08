import { ArrowRight, Check, ExternalLink, ShieldX } from "lucide-react";
import Link from "next/link";

import type { CovenantProposal } from "@/lib/covenant/types";

import { StatusBadge } from "./StatusBadge";

export function proposalTitle(proposal: CovenantProposal) {
  return proposal.proposal_type === "EMERGENCY_PAUSE"
    ? proposal.incident_claim || "Emergency pause request"
    : proposal.purpose || "Treasury transfer request";
}

function rowIcon(verdict: string) {
  return verdict === "ALLOW" ? <Check className="size-5" /> : <ShieldX className="size-5" />;
}

export function DecisionRow({ proposal, compact = false, onSelect }: { proposal: CovenantProposal; compact?: boolean; onSelect?: () => void }) {
  const content = (
    <>
      <span className={`grid size-10 shrink-0 place-items-center rounded-full ${proposal.verdict === "ALLOW" ? "bg-[#dff2d9] text-[#1f6b2b]" : "bg-[#ffe1dc] text-[#9d2822]"}`}>{rowIcon(proposal.verdict)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-[#171817]">{proposalTitle(proposal)}</span>
        <span className="mt-1 block truncate font-mono text-[10px] text-[#777972]">{proposal.proposal_id} · policy v{proposal.policy_version}</span>
      </span>
      {!compact && proposal.proposal_type === "TREASURY_TRANSFER" ? <span className="hidden text-right sm:block"><span className="block text-sm font-bold">{proposal.amount.toLocaleString()} {proposal.asset_id}</span><span className="text-[11px] text-[#777972]">requested</span></span> : null}
      <StatusBadge status={proposal.verdict || proposal.status} />
      {onSelect ? <ArrowRight className="size-4 shrink-0 text-[#777972]" aria-hidden="true" /> : null}
    </>
  );
  return onSelect ? <button type="button" onClick={onSelect} className="flex w-full items-center gap-3 border-t border-black/10 px-4 py-4 text-left transition hover:bg-black/[0.025] sm:px-5">{content}</button> : <div className="flex items-center gap-3 border-t border-black/10 px-4 py-4 sm:px-5">{content}</div>;
}

export function DecisionDesk({ proposals }: { proposals: CovenantProposal[] }) {
  const allowed = proposals.find((proposal) => proposal.verdict === "ALLOW");
  const stopped = proposals.find((proposal) => ["BLOCK", "TIMELOCK", "INSUFFICIENT_EVIDENCE"].includes(proposal.verdict));
  const examples = [allowed, stopped].filter((proposal): proposal is CovenantProposal => Boolean(proposal));
  return (
    <div className="decision-desk mx-auto w-full max-w-5xl overflow-hidden rounded-[14px] bg-white shadow-[0_24px_70px_rgba(39,47,85,0.18)]">
      <div className="flex items-center justify-between gap-3 bg-[#315fe8] px-4 py-3 text-white sm:px-5">
        <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-white" /><p className="text-sm font-bold">Live decision desk</p></div>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/75">StudioNet · read only</p>
      </div>
      {examples.length ? examples.map((proposal) => <DecisionRow key={proposal.proposal_id} proposal={proposal} />) : <div className="p-7 text-center text-sm text-[#666862]">No resolved on-chain cases are available yet.</div>}
      <Link href="/explorer" className="flex items-center justify-between border-t border-black/10 px-5 py-4 text-sm font-bold text-[#315fe8]">Inspect every resolved case <ExternalLink className="size-4" /></Link>
    </div>
  );
}

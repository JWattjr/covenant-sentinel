"use client";

import { ChevronRight, FileWarning } from "lucide-react";

import type { CovenantProposal } from "@/lib/covenant/types";

import { proposalTitle } from "./DecisionDesk";
import { StatusBadge } from "./StatusBadge";

export function ProposalQueue({ proposals, selectedId, configured, onSelect }: { proposals: CovenantProposal[]; selectedId: string | null; configured: boolean; onSelect: (proposal: CovenantProposal) => void }) {
  const ordered = [...proposals].sort((a, b) => b.created_sequence - a.created_sequence);
  return <section className="panel overflow-hidden"><div className="flex items-end justify-between gap-4 border-b border-black/10 p-5"><div><h2 className="display-title text-2xl">Evaluation queue</h2><p className="mt-1 text-xs text-[#6b6d67]">Newest request first</p></div><span className="text-xs font-bold text-[#6b6d67]">{ordered.length} total</span></div>{ordered.length ? <div className="scrollbar-thin max-h-[42rem] overflow-y-auto">{ordered.map((proposal) => { const active = selectedId === proposal.proposal_id; return <button type="button" key={proposal.proposal_id} onClick={() => onSelect(proposal)} className={`flex w-full items-center gap-3 border-t border-black/10 p-4 text-left transition first:border-t-0 ${active ? "bg-[#dfe6ff]" : "hover:bg-black/[0.025]"}`}><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{proposalTitle(proposal)}</span><span className="mt-1 block truncate font-mono text-[10px] text-[#777972]">{proposal.proposal_id}</span></span><StatusBadge status={proposal.verdict || proposal.status} /><ChevronRight className="size-4 shrink-0 text-[#777972]" /></button>; })}</div> : <div className="p-8 text-center"><FileWarning className="mx-auto size-7 text-[#969891]" /><p className="mt-3 font-bold">No on-chain proposals yet</p><p className="mt-2 text-sm leading-6 text-[#6b6d67]">{configured ? "Use Submit to create the first evidence-backed request." : "Configure the deployed addresses before submitting."}</p></div>}</section>;
}

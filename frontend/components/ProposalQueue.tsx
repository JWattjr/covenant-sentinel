"use client";

import { ChevronRight, Clock3, FileWarning, ShieldAlert, Wallet } from "lucide-react";

import type { CovenantProposal } from "@/lib/covenant/types";

import { StatusBadge } from "./StatusBadge";

function ProposalIcon({ proposal }: { proposal: CovenantProposal }) {
  return proposal.proposal_type === "EMERGENCY_PAUSE" ? (
    <ShieldAlert className="size-4 text-orange-200" aria-hidden="true" />
  ) : (
    <Wallet className="size-4 text-cyan-200" aria-hidden="true" />
  );
}

function title(proposal: CovenantProposal) {
  return proposal.proposal_type === "EMERGENCY_PAUSE"
    ? proposal.incident_claim || "Emergency pause"
    : proposal.purpose || "Treasury transfer";
}

export function ProposalQueue({
  proposals,
  selectedId,
  configured,
  onSelect,
}: {
  proposals: CovenantProposal[];
  selectedId: string | null;
  configured: boolean;
  onSelect: (proposal: CovenantProposal) => void;
}) {
  const ordered = [...proposals].sort((a, b) => b.created_sequence - a.created_sequence);

  return (
    <section className="panel flex min-h-[31rem] flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
        <div>
          <p className="eyebrow">Proposal queue</p>
          <p className="mt-1 text-sm text-slate-400">Immutable request identifiers and decision states.</p>
        </div>
        <span className="rounded-md bg-white/5 px-2 py-1 font-mono text-[10px] text-slate-400">{ordered.length} total</span>
      </div>
      {ordered.length ? (
        <div className="scrollbar-thin max-h-[31rem] overflow-y-auto p-2">
          {ordered.map((proposal) => {
            const active = selectedId === proposal.proposal_id;
            return (
              <button
                type="button"
                key={proposal.proposal_id}
                onClick={() => onSelect(proposal)}
                className={`group w-full rounded-xl p-3 text-left transition ${active ? "bg-cyan-300/[0.08] ring-1 ring-cyan-300/20" : "hover:bg-white/[0.035]"}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-white/8 bg-black/15">
                    <ProposalIcon proposal={proposal} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-100">{title(proposal)}</p>
                      <ChevronRight className={`mt-0.5 size-4 shrink-0 text-slate-600 transition ${active ? "translate-x-0.5 text-cyan-200" : "group-hover:translate-x-0.5"}`} />
                    </div>
                    <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">{proposal.proposal_id}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge status={proposal.status} />
                      {proposal.proposal_type === "TREASURY_TRANSFER" ? (
                        <span className="font-mono text-[10px] text-slate-400">{proposal.amount.toLocaleString()} {proposal.asset_id}</span>
                      ) : (
                        <span className="flex items-center gap-1 font-mono text-[10px] text-slate-400"><Clock3 className="size-3" /> {proposal.requested_pause_hours}h cap</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid flex-1 place-items-center px-6 text-center">
          <div>
            <div className="mx-auto grid size-10 place-items-center rounded-full bg-white/[0.035] text-slate-500"><FileWarning className="size-5" /></div>
            <p className="mt-3 text-sm font-medium text-slate-300">No on-chain proposals yet</p>
            <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
              {configured
                ? "Submit a treasury request or an incident report with evidence from an approved domain."
                : "Configure the deployed Sentinel address, then submit a proposal with approved evidence."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

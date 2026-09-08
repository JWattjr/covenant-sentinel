"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { ContractReadState } from "@/components/ContractReadState";
import { DecisionRow } from "@/components/DecisionDesk";
import { ProposalDetail } from "@/components/ProposalDetail";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import type { CovenantProposal } from "@/lib/covenant/types";
import { useCovenant } from "@/lib/covenant/useCovenant";

const filters = [
  ["ALL", "All decisions"], ["ALLOW", "Allowed"], ["BLOCK", "Blocked"], ["TIMELOCK", "On hold"], ["INSUFFICIENT_EVIDENCE", "Evidence missing"],
] as const;

export default function ExplorerPage() {
  const { configured, dashboard } = useCovenant();
  const [filter, setFilter] = useState<(typeof filters)[number][0]>("ALL");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const resolved = useMemo(() => (dashboard.data?.proposals ?? []).filter((proposal) => Boolean(proposal.verdict)).sort((a, b) => b.created_sequence - a.created_sequence), [dashboard.data]);
  const shown = useMemo(() => resolved.filter((proposal) => (filter === "ALL" || proposal.verdict === filter) && `${proposal.proposal_id} ${proposal.purpose} ${proposal.incident_claim} ${proposal.summary}`.toLowerCase().includes(query.toLowerCase())), [filter, query, resolved]);

  const activeId = selectedId && shown.some((item) => item.proposal_id === selectedId) ? selectedId : shown[0]?.proposal_id ?? null;
  const selected: CovenantProposal | null = shown.find((proposal) => proposal.proposal_id === activeId) ?? null;

  return (
    <div className="min-h-screen">
      <SiteHeader current="Explorer" />
      <main>
        <section className="bg-[#daf0d8] py-14 sm:py-20">
          <div className="site-shell">
            <div className="max-w-4xl">
              <h1 className="display-title text-6xl sm:text-8xl">The public case record.</h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[#445443] sm:text-lg">Inspect resolved requests, their policy version, approved evidence, validator findings, and what the guarded vault actually did. No wallet required.</p>
              <div className="mt-7 flex flex-wrap gap-2 text-xs font-bold text-[#51624f]">
                {["Simulated DEMO treasury", "Controlled synthetic evidence", "StudioNet contract state"].map((label) => <span key={label} className="rounded-full bg-white/55 px-3 py-1.5">{label}</span>)}
              </div>
            </div>
          </div>
        </section>

        <section className="site-shell py-8 sm:py-12">
          <ContractReadState configured={configured} loading={dashboard.isLoading} error={dashboard.error} hasData={Boolean(dashboard.data)} lastUpdatedAt={dashboard.data?.observedAt ?? dashboard.dataUpdatedAt} retrying={dashboard.isFetching} onRetry={() => void dashboard.refetch()} />
          {dashboard.data ? <>
            <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-2 overflow-x-auto pb-1">{filters.map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`min-h-11 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${filter === value ? "bg-[#151515] text-white" : "bg-white text-[#5d5f59] hover:bg-[#e8e8e3]"}`}>{label}</button>)}</div>
              <label className="flex min-w-0 items-center gap-2 rounded-full bg-white px-4 py-2.5 lg:w-80"><Search className="size-4 text-[#777972]" /><span className="sr-only">Search resolved cases</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search case ID or purpose" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#888a84]" /></label>
            </div>
            {resolved.length === 0 ? <div className="panel p-10 text-center"><p className="font-bold">No resolved on-chain cases yet</p><p className="mt-2 text-sm text-[#6b6d67]">Pending requests appear after a consensus verdict is recorded.</p></div> : shown.length === 0 ? <div className="panel p-10 text-center"><p className="font-bold">No cases match this view</p><p className="mt-2 text-sm text-[#6b6d67]">Clear the search or choose another decision filter.</p></div> : <div className="grid items-start gap-6 lg:grid-cols-[minmax(19rem,0.68fr)_minmax(0,1.32fr)]"><aside className="panel max-h-[44rem] overflow-y-auto scrollbar-thin" aria-label="Resolved cases"><div className="flex items-center justify-between px-5 py-4"><h2 className="font-bold">{shown.length} resolved {shown.length === 1 ? "case" : "cases"}</h2><span className="text-xs text-[#777972]">Newest first</span></div>{shown.map((proposal) => <div key={proposal.proposal_id} className={activeId === proposal.proposal_id ? "bg-[#dfe6ff]" : undefined}><DecisionRow proposal={proposal} compact onSelect={() => setSelectedId(proposal.proposal_id)} /></div>)}</aside><ProposalDetail proposal={selected} canEvaluate={false} loading={false} onEvaluate={() => undefined} onRelease={() => undefined} /></div>}
          </> : null}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";

import { ContractReadState } from "@/components/ContractReadState";
import { ProposalDetail } from "@/components/ProposalDetail";
import { ProposalQueue } from "@/components/ProposalQueue";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { TransactionRail } from "@/components/TransactionRail";
import { WalletControl } from "@/components/WalletControl";
import { useCovenant } from "@/lib/covenant/useCovenant";
import { useWallet } from "@/lib/genlayer/wallet";

export default function OperatePage() {
  const { isConnected } = useWallet();
  const { configured, dashboard, transactions, busy, evaluate, releasePause, appeal, refresh } = useCovenant();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const proposals = useMemo(() => dashboard.data?.proposals ?? [], [dashboard.data]);
  const fallbackId = [...proposals].sort((a, b) => b.created_sequence - a.created_sequence)[0]?.proposal_id ?? null;
  const activeId = selectedId && proposals.some((proposal) => proposal.proposal_id === selectedId) ? selectedId : fallbackId;
  const selected = proposals.find((proposal) => proposal.proposal_id === activeId) ?? null;

  return <div className="min-h-screen"><SiteHeader current="Operate" /><main><section className="bg-[#151515] py-14 text-white sm:py-20"><div className="site-shell flex flex-col justify-between gap-8 sm:flex-row sm:items-end"><div><h1 className="display-title max-w-4xl text-6xl sm:text-8xl">Evaluate. Then watch finality.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-white/65">The operator workspace keeps consensus actions and transaction lifecycle together, away from the public Explorer.</p></div><WalletControl /></div></section><section className="site-shell py-8 sm:py-12"><ContractReadState configured={configured} loading={dashboard.isLoading} error={dashboard.error} hasData={Boolean(dashboard.data)} lastUpdatedAt={dashboard.dataUpdatedAt} retrying={dashboard.isFetching} onRetry={() => void dashboard.refetch()} />{dashboard.data ? <div className="grid items-start gap-6 xl:grid-cols-[minmax(18rem,0.65fr)_minmax(0,1.35fr)_minmax(18rem,0.65fr)]"><ProposalQueue proposals={proposals} selectedId={selectedId} configured={configured} onSelect={(proposal) => setSelectedId(proposal.proposal_id)} /><ProposalDetail proposal={selected} canEvaluate={configured && isConnected} loading={evaluate.isPending || releasePause.isPending} onEvaluate={(proposalId) => evaluate.mutate(proposalId)} onRelease={(incidentId) => releasePause.mutate(incidentId)} /><TransactionRail dashboard={dashboard.data} transactions={transactions} busy={busy || refresh.isPending} onAppeal={(snapshot) => appeal.mutate(snapshot)} onRefresh={(snapshot) => refresh.mutate(snapshot)} /></div> : null}</section></main><SiteFooter /></div>;
}

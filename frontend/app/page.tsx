"use client";

import { AlertTriangle, BookText, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CovenantLogo } from "@/components/CovenantLogo";
import { ProposalComposer } from "@/components/ProposalComposer";
import { ProposalDetail } from "@/components/ProposalDetail";
import { ProposalQueue } from "@/components/ProposalQueue";
import { ProtocolOverview } from "@/components/ProtocolOverview";
import { TransactionRail } from "@/components/TransactionRail";
import { WalletControl } from "@/components/WalletControl";
import { deploymentConfiguration, missingConfigurationKeys } from "@/lib/covenant/client";
import { useCovenant } from "@/lib/covenant/useCovenant";
import { useWallet } from "@/lib/genlayer/wallet";

function DeploymentNotice() {
  const missing = missingConfigurationKeys();
  return (
    <section className="panel border-amber-300/20 bg-amber-300/[0.04] p-5">
      <div className="flex gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-300" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-100">Deployment not configured</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            This console refuses to invent contract state. Deploy the pair with{" "}
            <code className="font-mono text-slate-300">npm run deploy</code>, then set the values
            below in <code className="font-mono text-slate-300">frontend/.env.local</code> and
            restart the dev server.
          </p>
          <ul className="mt-3 space-y-1.5">
            {missing.map((key) => (
              <li
                key={key}
                className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 font-mono text-[11px] text-slate-300"
              >
                {key}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ReadError({ message }: { message: string }) {
  return (
    <section className="panel border-rose-300/20 bg-rose-300/[0.04] p-5">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-300" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-rose-100">Contract read failed</p>
          <p className="mt-1 break-words text-xs leading-5 text-slate-400">{message}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Check that the configured addresses exist on {deploymentConfiguration().networkName} and
            that the RPC endpoint is reachable. No cached or placeholder state is shown in its place.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function CovenantConsole() {
  const { isConnected } = useWallet();
  const {
    configured,
    dashboard,
    transactions,
    busy,
    transfer,
    emergency,
    evaluate,
    releasePause,
    appeal,
    refresh,
  } = useCovenant();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const proposals = useMemo(() => dashboard.data?.proposals ?? [], [dashboard.data]);

  // Keep a valid selection as the queue changes, without fighting the operator.
  useEffect(() => {
    if (!proposals.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => {
      if (current && proposals.some((proposal) => proposal.proposal_id === current)) return current;
      return [...proposals].sort((a, b) => b.created_sequence - a.created_sequence)[0].proposal_id;
    });
  }, [proposals]);

  const selected = proposals.find((proposal) => proposal.proposal_id === selectedId) ?? null;
  const readError = dashboard.error instanceof Error ? dashboard.error.message : null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#080b14]">
        <div className="mx-auto flex max-w-[110rem] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <CovenantLogo />
          <div className="flex items-center gap-3">
            <a
              href="https://docs.genlayer.com"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-200 sm:flex"
            >
              <BookText className="size-3.5" /> GenLayer docs
            </a>
            <WalletControl />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[110rem] space-y-4 px-4 py-6 sm:px-6">
        {configured ? null : <DeploymentNotice />}
        {readError ? <ReadError message={readError} /> : null}

        <ProtocolOverview dashboard={dashboard.data} />

        {configured && dashboard.isLoading ? (
          <p className="flex items-center gap-2 px-1 text-xs text-slate-500">
            <LoaderCircle className="size-3.5 animate-spin" /> Reading live contract state…
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-4 xl:col-span-3">
            <ProposalQueue
              proposals={proposals}
              selectedId={selectedId}
              configured={configured}
              onSelect={(proposal) => setSelectedId(proposal.proposal_id)}
            />
            <ProposalComposer
              configured={configured}
              connected={isConnected}
              maxTransfer={dashboard.data?.policy?.max_transfer_amount}
              maxPauseHours={dashboard.data?.configuration.max_pause_hours}
              vaultAddress={dashboard.data?.configuration.guarded_vault}
              busy={transfer.isPending || emergency.isPending}
              onTransfer={(draft) => transfer.mutateAsync(draft)}
              onEmergency={(draft) => emergency.mutateAsync(draft)}
            />
          </div>

          <div className="lg:col-span-8 xl:col-span-6">
            <ProposalDetail
              proposal={selected}
              canEvaluate={configured && isConnected}
              loading={evaluate.isPending || releasePause.isPending}
              onEvaluate={(proposalId) => evaluate.mutate(proposalId)}
              onRelease={(incidentId) => releasePause.mutate(incidentId)}
            />
          </div>

          <div className="lg:col-span-12 xl:col-span-3">
            <TransactionRail
              dashboard={dashboard.data}
              transactions={transactions}
              busy={busy || refresh.isPending}
              onAppeal={(snapshot) => appeal.mutate(snapshot)}
              onRefresh={(snapshot) => refresh.mutate(snapshot)}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-white/8 py-5">
        <div className="mx-auto flex max-w-[110rem] flex-wrap items-center justify-between gap-3 px-4 text-xs text-slate-500 sm:px-6">
          <p>Covenant Sentinel — simulated DEMO treasury. Not a custody system.</p>
          <div className="flex gap-5">
            <a className="transition hover:text-slate-300" href="https://genlayer.com" target="_blank" rel="noreferrer">
              GenLayer
            </a>
            <a
              className="transition hover:text-slate-300"
              href="https://studio.genlayer.com"
              target="_blank"
              rel="noreferrer"
            >
              Studio
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

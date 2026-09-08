"use client";

import { Check, LockKeyhole, ShieldCheck } from "lucide-react";

import { ContractReadState } from "@/components/ContractReadState";
import { ProposalComposer } from "@/components/ProposalComposer";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { WalletControl } from "@/components/WalletControl";
import { useCovenant } from "@/lib/covenant/useCovenant";
import { useWallet } from "@/lib/genlayer/wallet";

export default function SubmitPage() {
  const { isConnected } = useWallet();
  const { configured, dashboard, transfer, emergency } = useCovenant();
  const state = dashboard.data;
  return (
    <div className="min-h-screen">
      <SiteHeader current="Submit" />
      <main>
        <section className="bg-[#dfe6ff] py-14 sm:py-20">
          <div className="site-shell flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
            <div>
              <h1 className="display-title max-w-4xl text-6xl sm:text-8xl">Make the request. Bring the evidence.</h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[#50535c]">Submit a treasury transfer or an emergency pause proposal against the policy currently live on StudioNet.</p>
            </div>
            <WalletControl />
          </div>
        </section>
        <section className="site-shell py-8 sm:py-12">
          <ContractReadState configured={configured} loading={dashboard.isLoading} error={dashboard.error} hasData={Boolean(dashboard.data)} lastUpdatedAt={dashboard.dataUpdatedAt} retrying={dashboard.isFetching} onRetry={() => void dashboard.refetch()} />
          {state ? <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]"><ProposalComposer configured={configured} connected={isConnected} maxTransfer={state.policy?.max_transfer_amount} maxPauseHours={state.configuration.max_pause_hours} vaultAddress={state.configuration.guarded_vault} busy={transfer.isPending || emergency.isPending} onTransfer={(draft) => transfer.mutateAsync(draft)} onEmergency={(draft) => emergency.mutateAsync(draft)} /><aside className="space-y-5 lg:sticky lg:top-24"><section className="panel p-6"><div className="flex items-center justify-between"><h2 className="display-title text-2xl">Policy in force</h2><ShieldCheck className="size-6 text-[#315fe8]" /></div>{state.policy ? <dl className="mt-5 divide-y divide-black/10 text-sm"><div className="flex justify-between gap-4 py-3"><dt className="text-[#696b65]">Version</dt><dd className="font-bold">v{state.policy.version}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-[#696b65]">Transfer cap</dt><dd className="font-bold">{state.policy.max_transfer_amount.toLocaleString()} DEMO</dd></div><div className="py-3"><dt className="text-[#696b65]">Canonical ID</dt><dd className="mt-1 break-all font-mono text-xs">{state.policy.canonical_id}</dd></div></dl> : <p className="mt-4 text-sm text-[#696b65]">No policy has been published.</p>}</section><section className="panel p-6"><h2 className="display-title text-2xl">Before you sign</h2><ul className="mt-5 space-y-4 text-sm leading-6 text-[#555751]">{["The action ID must be unique.", "Every URL must use an approved evidence domain.", "A submitted request is still pending until evaluated.", "Only an ALLOW verdict can queue a vault instruction."].map((item) => <li key={item} className="flex gap-3"><Check className="mt-1 size-4 shrink-0 text-[#315fe8]" />{item}</li>)}</ul><p className="mt-5 flex gap-2 rounded-[12px] bg-[#eeefe9] p-3 text-xs leading-5 text-[#5f615c]"><LockKeyhole className="mt-0.5 size-4 shrink-0" />Wallet signing is confined to this operator route.</p></section></aside></div> : null}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

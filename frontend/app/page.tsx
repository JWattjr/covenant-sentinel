"use client";

import { ArrowRight, CheckCircle2, Eye, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { ContractReadState } from "@/components/ContractReadState";
import { DecisionDesk } from "@/components/DecisionDesk";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { useCovenant } from "@/lib/covenant/useCovenant";

export default function HomePage() {
  const { configured, dashboard } = useCovenant();
  const state = dashboard.data;

  return (
    <div className="min-h-screen">
      <SiteHeader current="Home" />
      <main>
        <section className="overflow-hidden bg-[#dfe6ff] px-3 pb-16 pt-16 sm:pb-24 sm:pt-24">
          <div className="site-shell text-center">
            <h1 className="display-title mx-auto max-w-5xl text-[clamp(3.25rem,8vw,7.4rem)]">Every treasury request should have to prove itself.</h1>
            <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-[#45484f] sm:text-lg">Covenant Sentinel checks policy, asks independent validators to verify approved evidence, and only then lets an allowed action reach the guarded vault.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/explorer" className="primary-button !min-h-12 !px-6">Explore live decisions <ArrowRight className="size-4" /></Link>
              <Link href="/submit" className="secondary-button !min-h-12 !border-transparent !bg-white/65 !px-6">Submit a request</Link>
            </div>
            <p className="mt-4 text-xs font-semibold text-[#646772]">Public verification is read-only. No wallet required.</p>
            <div className="mt-14 sm:mt-20">
              <ContractReadState configured={configured} loading={dashboard.isLoading} error={dashboard.error} hasData={Boolean(dashboard.data)} lastUpdatedAt={dashboard.data?.observedAt ?? dashboard.dataUpdatedAt} retrying={dashboard.isFetching} onRetry={() => void dashboard.refetch()} />
              {state ? <DecisionDesk proposals={state.proposals} /> : null}
            </div>
          </div>
        </section>

        {state ? (
          <section className="bg-white py-8">
            <div className="site-shell grid grid-cols-2 divide-x divide-black/10 sm:grid-cols-4">
              {[["Requests", state.statistics.submitted], ["Allowed", state.statistics.allow], ["Stopped", state.statistics.block + state.statistics.timelock], ["Executed", state.statistics.executed]].map(([label, value]) => (
                <div key={String(label)} className="px-4 py-5 text-center"><p className="display-title text-3xl sm:text-4xl">{String(value)}</p><p className="mt-1 text-xs font-bold text-[#6d6f69]">{label}</p></div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="site-shell py-20 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <h2 className="display-title text-5xl sm:text-6xl">A firewall with a visible paper trail.</h2>
              <p className="mt-6 max-w-md text-base leading-7 text-[#63655f]">The verdict, its evidence, and what happened at the vault stay attached to one immutable proposal ID.</p>
            </div>
            <ol className="divide-y divide-black/12 border-y border-black/12">
              {[
                ["01", "Policy first", "Hard constraints such as the transfer cap run before any nondeterministic evaluation.", LockKeyhole],
                ["02", "Evidence by consensus", "The leader and validators independently refetch approved HTTPS sources and agree on a closed-schema verdict.", Eye],
                ["03", "Finality before execution", "An ALLOW verdict does not move value immediately. The vault instruction is released only after finality.", ShieldCheck],
              ].map(([number, title, copy, Icon]) => {
                const ItemIcon = Icon as typeof LockKeyhole;
                return <li key={String(number)} className="grid gap-5 py-8 sm:grid-cols-[3rem_1fr_auto] sm:items-start"><span className="font-mono text-xs text-[#777972]">{String(number)}</span><div><h3 className="display-title text-3xl">{String(title)}</h3><p className="mt-3 max-w-xl leading-7 text-[#63655f]">{String(copy)}</p></div><ItemIcon className="size-7 text-[#315fe8]" /></li>;
              })}
            </ol>
          </div>
        </section>

        <section className="bg-[#daf0d8] py-20 sm:py-28">
          <div className="site-shell grid gap-10 lg:grid-cols-2 lg:items-end">
            <div><h2 className="display-title max-w-3xl text-5xl sm:text-7xl">See what passed. See what stopped. Check the evidence yourself.</h2></div>
            <div className="lg:pb-2"><p className="max-w-lg text-base leading-7 text-[#425341]">Explorer is built for judges and reviewers: resolved cases, policy versions, evidence findings, and execution state in one public, wallet-free route.</p><Link href="/explorer" className="mt-7 inline-flex items-center gap-2 text-base font-bold text-[#151515] underline decoration-2">Open the case explorer <ArrowRight className="size-4" /></Link></div>
          </div>
        </section>

        <section className="site-shell py-16">
          <div className="flex flex-col justify-between gap-6 rounded-[14px] bg-[#151515] p-7 text-white sm:flex-row sm:items-center sm:p-10">
            <div className="flex items-center gap-4"><CheckCircle2 className="size-8 text-[#84e181]" /><div><h2 className="display-title text-3xl">Ready to test a DEMO request?</h2><p className="mt-1 text-sm text-white/65">Wallet signing only appears in the operator flow.</p></div></div>
            <Link href="/submit" className="primary-button !bg-white !text-[#151515]">Go to Submit <ArrowRight className="size-4" /></Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

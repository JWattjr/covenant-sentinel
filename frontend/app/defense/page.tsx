"use client";

import { DefenseSuite } from "@/components/DefenseSuite";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export default function DefensePage() {
  return (
    <div className="min-h-screen">
      <SiteHeader current="Defense" />
      <main>
        <section className="bg-[#dfe6ff] px-3 pb-12 pt-16 sm:pb-16 sm:pt-20">
          <div className="site-shell">
            <h1 className="display-title max-w-4xl text-[clamp(2.75rem,6vw,5.5rem)]">Defense suite</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#45484f]">
              Policy amendments, upgrade reviews, and a per-spender record. Each is judged by validators from commit-pinned evidence, and each has a deadline with a deterministic fallback.
            </p>
          </div>
        </section>
        <section className="site-shell py-14 sm:py-20">
          <DefenseSuite />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

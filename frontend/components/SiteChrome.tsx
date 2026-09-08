import { ArrowUpRight, Github } from "lucide-react";
import Link from "next/link";

import { CovenantLogo } from "./CovenantLogo";

const routes = [
  ["Home", "/"],
  ["Explorer", "/explorer"],
  ["Submit", "/submit"],
  ["Operate", "/operate"],
] as const;

export function SiteHeader({ current }: { current: (typeof routes)[number][0] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-black/8 bg-[#f4f4f1]/95 backdrop-blur-sm">
      <div className="site-shell flex min-h-18 items-center justify-between gap-4">
        <Link href="/" aria-label="Covenant Sentinel home"><CovenantLogo /></Link>
        <nav aria-label="Primary navigation" className="hidden items-center gap-1 rounded-full bg-[#ecece8] p-1 md:flex">
          {routes.map(([label, href]) => <Link key={href} href={href} className="route-pill" data-active={current === label}>{label}</Link>)}
        </nav>
        <Link href="/explorer" className="primary-button !min-h-10 !px-4">View decisions <ArrowUpRight className="size-4" aria-hidden="true" /></Link>
      </div>
      <nav aria-label="Mobile navigation" className="site-shell flex gap-1 overflow-x-auto pb-2 md:hidden">
        {routes.map(([label, href]) => <Link key={href} href={href} className="route-pill whitespace-nowrap" data-active={current === label}>{label}</Link>)}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-black/10 py-8">
      <div className="site-shell flex flex-col justify-between gap-5 text-sm text-[#676963] sm:flex-row sm:items-center">
        <p>Covenant Sentinel uses a simulated DEMO treasury. It is not a custody system.</p>
        <div className="flex gap-5">
          <a className="inline-flex items-center gap-1 font-semibold text-[#151515]" href="https://github.com/JWattjr/covenant-sentinel" target="_blank" rel="noreferrer"><Github className="size-4" /> Source</a>
          <a className="inline-flex items-center gap-1 font-semibold text-[#151515]" href="https://studio.genlayer.com" target="_blank" rel="noreferrer">GenLayer Studio <ArrowUpRight className="size-4" /></a>
        </div>
      </div>
    </footer>
  );
}

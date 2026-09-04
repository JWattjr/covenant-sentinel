import { ShieldCheck } from "lucide-react";

export function CovenantLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 shadow-[0_0_34px_rgba(34,211,238,0.14)]">
        <ShieldCheck aria-hidden="true" className="size-5" strokeWidth={2.4} />
      </div>
      {!compact ? (
        <div className="leading-tight">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-300">Covenant</p>
          <p className="text-sm font-semibold tracking-tight text-slate-100">Sentinel</p>
        </div>
      ) : null}
    </div>
  );
}

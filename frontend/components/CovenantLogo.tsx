import { ShieldCheck } from "lucide-react";

export function CovenantLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-[13px] bg-[#315fe8] text-white shadow-[0_8px_20px_rgba(49,95,232,0.24)]">
        <ShieldCheck aria-hidden="true" className="size-5" strokeWidth={2.4} />
      </div>
      {!compact ? (
        <div className="leading-[1.05]">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#71736d]">Covenant</p>
          <p className="font-[family-name:var(--font-display)] text-base font-bold tracking-[-0.03em] text-[#151515]">Sentinel</p>
        </div>
      ) : null}
    </div>
  );
}

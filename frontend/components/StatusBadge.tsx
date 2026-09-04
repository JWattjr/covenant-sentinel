const styles: Record<string, string> = {
  // Proposal lifecycle
  PENDING: "border-amber-300/25 bg-amber-300/10 text-amber-200",
  EVALUATING: "border-sky-300/25 bg-sky-300/10 text-sky-200",
  EXECUTION_QUEUED: "border-indigo-300/25 bg-indigo-300/10 text-indigo-200",
  EXECUTED: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
  CANCELLED: "border-slate-400/20 bg-slate-400/10 text-slate-300",

  // Verdicts
  ALLOW: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
  TIMELOCK: "border-violet-300/25 bg-violet-300/10 text-violet-200",
  BLOCK: "border-rose-300/25 bg-rose-300/10 text-rose-200",
  INSUFFICIENT_EVIDENCE: "border-orange-300/25 bg-orange-300/10 text-orange-200",

  // Risk levels
  LOW: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
  MEDIUM: "border-amber-300/25 bg-amber-300/10 text-amber-200",
  HIGH: "border-orange-300/25 bg-orange-300/10 text-orange-200",
  CRITICAL: "border-rose-300/25 bg-rose-300/10 text-rose-200",

  // Transaction lifecycle
  SUBMITTED: "border-sky-300/25 bg-sky-300/10 text-sky-200",
  DECIDED: "border-amber-300/25 bg-amber-300/10 text-amber-200",
  FINALIZED: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
  FAILED: "border-rose-300/25 bg-rose-300/10 text-rose-200",
  APPEALED: "border-violet-300/25 bg-violet-300/10 text-violet-200",

  UNKNOWN: "border-slate-400/20 bg-slate-400/10 text-slate-300",
};

function readable(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function StatusBadge({ status, title }: { status: string; title?: string }) {
  const resolved = status || "UNKNOWN";
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] ${styles[resolved] ?? styles.UNKNOWN}`}
    >
      {readable(resolved)}
    </span>
  );
}

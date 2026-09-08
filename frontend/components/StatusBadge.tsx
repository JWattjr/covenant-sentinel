const styles: Record<string, string> = {
  // Proposal lifecycle
  PENDING: "border-amber-700/20 bg-amber-100 text-amber-900",
  EVALUATING: "border-sky-700/20 bg-sky-100 text-sky-900",
  EXECUTION_QUEUED: "border-indigo-700/20 bg-indigo-100 text-indigo-900",
  EXECUTED: "border-emerald-700/20 bg-emerald-100 text-emerald-900",
  CANCELLED: "border-slate-700/20 bg-slate-100 text-slate-800",

  // Verdicts
  ALLOW: "border-emerald-700/20 bg-emerald-100 text-emerald-900",
  TIMELOCK: "border-violet-700/20 bg-violet-100 text-violet-900",
  BLOCK: "border-rose-700/20 bg-rose-100 text-rose-900",
  INSUFFICIENT_EVIDENCE: "border-orange-700/20 bg-orange-100 text-orange-900",

  // Risk levels
  LOW: "border-emerald-700/20 bg-emerald-100 text-emerald-900",
  MEDIUM: "border-amber-700/20 bg-amber-100 text-amber-900",
  HIGH: "border-orange-700/20 bg-orange-100 text-orange-900",
  CRITICAL: "border-rose-700/20 bg-rose-100 text-rose-900",

  // Transaction lifecycle
  SUBMITTED: "border-sky-700/20 bg-sky-100 text-sky-900",
  DECIDED: "border-amber-700/20 bg-amber-100 text-amber-900",
  FINALIZED: "border-emerald-700/20 bg-emerald-100 text-emerald-900",
  FAILED: "border-rose-700/20 bg-rose-100 text-rose-900",
  APPEALED: "border-violet-700/20 bg-violet-100 text-violet-900",

  UNKNOWN: "border-slate-700/20 bg-slate-100 text-slate-800",
};

function readable(value: string) {
  if (value === "TIMELOCK") return "On hold";
  if (value === "INSUFFICIENT_EVIDENCE") return "Evidence missing";
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

"use client";

import { AlertCircle, FilePlus2, LoaderCircle, ShieldAlert, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import type { EmergencyDraft, TransferDraft } from "@/lib/covenant/types";

type Mode = "transfer" | "emergency";
const splitEvidence = (value: string) => value.split("\n").map((url) => url.trim()).filter(Boolean);

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="field-label"><span>{label}</span><input className="field-input" {...props} /></label>; }

export function ProposalComposer({ configured, connected, maxTransfer, maxPauseHours, vaultAddress, onTransfer, onEmergency, busy }: { configured: boolean; connected: boolean; maxTransfer?: number; maxPauseHours?: number; vaultAddress?: string; onTransfer: (draft: TransferDraft) => Promise<unknown>; onEmergency: (draft: EmergencyDraft) => Promise<unknown>; busy: boolean }) {
  const [mode, setMode] = useState<Mode>("transfer");
  const [error, setError] = useState("");
  const [transfer, setTransfer] = useState({ actionId: "", target: "", assetId: "DEMO", amount: "", purpose: "", evidence: "" });
  const [emergency, setEmergency] = useState({ incidentId: "", incidentClaim: "", hours: "24", evidence: "" });
  const evidenceHint = useMemo(() => mode === "emergency" ? "Add two to five HTTPS URLs from at least two approved domains." : "Add one to five HTTPS URLs from approved domains. Unreachable evidence fails closed.", [mode]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    try {
      if (mode === "transfer") {
        const amount = Number(transfer.amount);
        if (!Number.isInteger(amount) || amount <= 0) throw new Error("Enter a positive whole-number amount.");
        if (maxTransfer && amount > maxTransfer) throw new Error(`The active policy caps transfers at ${maxTransfer.toLocaleString()} ${transfer.assetId || "DEMO"}.`);
        await onTransfer({ actionId: transfer.actionId.trim(), target: transfer.target.trim(), assetId: transfer.assetId.trim(), amount, purpose: transfer.purpose.trim(), evidenceUrls: splitEvidence(transfer.evidence) });
        setTransfer((current) => ({ ...current, actionId: "", amount: "", purpose: "", evidence: "" }));
      } else {
        const requestedPauseHours = Number(emergency.hours);
        if (!Number.isInteger(requestedPauseHours) || requestedPauseHours <= 0) throw new Error("Enter a positive whole-number pause duration.");
        if (maxPauseHours && requestedPauseHours > maxPauseHours) throw new Error(`Emergency pauses are capped at ${maxPauseHours} hours.`);
        const evidenceUrls = splitEvidence(emergency.evidence);
        if (evidenceUrls.length < 2) throw new Error("An incident report needs at least two independent evidence URLs.");
        await onEmergency({ incidentId: emergency.incidentId.trim(), incidentClaim: emergency.incidentClaim.trim(), evidenceUrls, requestedPauseHours });
        setEmergency((current) => ({ ...current, incidentId: "", incidentClaim: "", evidence: "" }));
      }
    } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : "Proposal submission failed."); }
  };

  const blocked = !configured || !connected;
  return <section className="panel overflow-hidden"><div className="border-b border-black/10 p-5 sm:p-7"><h2 className="display-title text-3xl">Choose the request</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#666862]">The form helps you prepare the call. The intelligent contract repeats every constraint.</p></div><div className="p-5 sm:p-7">
    <div className="segmented-control" role="tablist" aria-label="Proposal kind"><button type="button" role="tab" aria-selected={mode === "transfer"} className={mode === "transfer" ? "active" : ""} onClick={() => setMode("transfer")}><Wallet className="size-4" />Treasury transfer</button><button type="button" role="tab" aria-selected={mode === "emergency"} className={mode === "emergency" ? "active" : ""} onClick={() => setMode("emergency")}><ShieldAlert className="size-4" />Emergency pause</button></div>
    {!configured ? <p className="mt-5 rounded-[14px] bg-[#fff0dd] p-4 text-sm text-[#67340f]">The deployment must be configured before a live proposal can be signed.</p> : !connected ? <p className="mt-5 rounded-[14px] bg-[#eeefe9] p-4 text-sm text-[#555751]">Connect a wallet to sign. Emergency reports must come from an authorized reporter that is not the governor.</p> : null}
    <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>{mode === "transfer" ? <>
      <Input label="Action ID" placeholder="security-audit-001" value={transfer.actionId} onChange={(event) => setTransfer({ ...transfer, actionId: event.target.value })} required />
      <Input label="Recipient address" placeholder="0x…" value={transfer.target} onChange={(event) => setTransfer({ ...transfer, target: event.target.value })} required />
      <div className="grid grid-cols-2 gap-4"><Input label="Asset" placeholder="DEMO" value={transfer.assetId} onChange={(event) => setTransfer({ ...transfer, assetId: event.target.value })} required /><Input label={maxTransfer ? `Amount · max ${maxTransfer.toLocaleString()}` : "Amount"} type="number" min="1" max={maxTransfer} placeholder="500" value={transfer.amount} onChange={(event) => setTransfer({ ...transfer, amount: event.target.value })} required /></div>
      <label className="field-label"><span>Purpose</span><textarea className="field-input min-h-24 resize-y" placeholder="Independent protocol security audit" value={transfer.purpose} onChange={(event) => setTransfer({ ...transfer, purpose: event.target.value })} required /></label>
      <label className="field-label"><span>Evidence URLs · one per line</span><textarea className="field-input min-h-28 resize-y font-mono text-xs" placeholder="https://approved.example/evidence" value={transfer.evidence} onChange={(event) => setTransfer({ ...transfer, evidence: event.target.value })} required /></label>
    </> : <>
      <Input label="Incident ID" placeholder="active-exploit-001" value={emergency.incidentId} onChange={(event) => setEmergency({ ...emergency, incidentId: event.target.value })} required />
      <Input label={`Maximum pause in hours · cap ${maxPauseHours ?? 72}`} type="number" min="1" max={maxPauseHours ?? 72} value={emergency.hours} onChange={(event) => setEmergency({ ...emergency, hours: event.target.value })} required />
      <label className="field-label"><span>Incident claim</span><textarea className="field-input min-h-24 resize-y" placeholder="Describe the active exploit or imminent critical threat." value={emergency.incidentClaim} onChange={(event) => setEmergency({ ...emergency, incidentClaim: event.target.value })} required /></label>
      <label className="field-label"><span>Independent evidence URLs · one per line</span><textarea className="field-input min-h-28 resize-y font-mono text-xs" placeholder={"https://approved.example/incident\nhttps://second.example/report"} value={emergency.evidence} onChange={(event) => setEmergency({ ...emergency, evidence: event.target.value })} required /></label>
      {vaultAddress ? <p className="break-all text-xs leading-5 text-[#6b6d67]">Target is fixed to guarded vault <span className="font-mono">{vaultAddress}</span>.</p> : null}
    </>}
      <p className="text-xs leading-5 text-[#6b6d67]">{evidenceHint}</p>
      {error ? <p role="alert" className="flex gap-2 rounded-[14px] bg-[#fde3df] p-4 text-sm leading-6 text-[#6b1e1a]"><AlertCircle className="mt-1 size-4 shrink-0" /><span className="min-w-0 break-words">{error}</span></p> : null}
      <button type="submit" className="primary-button w-full !min-h-12" disabled={busy || blocked}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <FilePlus2 className="size-4" />}{busy ? "Waiting for decision" : mode === "transfer" ? "Submit treasury proposal" : "Submit incident report"}</button>
    </form>
  </div></section>;
}

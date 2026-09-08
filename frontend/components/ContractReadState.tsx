"use client";

import { AlertTriangle, Gauge, LoaderCircle, RefreshCw, TriangleAlert, WifiOff } from "lucide-react";

import { deploymentConfiguration, missingConfigurationKeys } from "@/lib/covenant/client";
import { DashboardReadError } from "@/lib/covenant/dashboard-read";

interface ContractReadStateProps {
  configured: boolean;
  loading: boolean;
  error: unknown;
  hasData?: boolean;
  lastUpdatedAt?: string | number;
  retrying?: boolean;
  onRetry?: () => void;
}

function retryWindow(seconds?: number) {
  if (!seconds) return null;
  if (seconds < 90) return "about a minute";
  return `about ${Math.ceil(seconds / 60)} minutes`;
}

export function ContractReadState({ configured, loading, error, hasData = false, lastUpdatedAt, retrying = false, onRetry }: ContractReadStateProps) {
  if (!configured) return <div role="status" className="rounded-[14px] bg-[#fff0dd] p-5 text-sm text-[#60300f]"><div className="flex gap-3"><TriangleAlert className="mt-0.5 size-5 shrink-0" /><div><p className="font-bold">Deployment is not configured</p><p className="mt-1 leading-6">Add {missingConfigurationKeys().join(", ")} and restart the app. No placeholder contract state is shown.</p></div></div></div>;
  if (error) {
    const failure = error instanceof DashboardReadError ? error : null;
    const rateLimited = failure?.code === "RATE_LIMITED";
    const unavailable = failure?.code === "UPSTREAM_UNAVAILABLE";
    const wait = retryWindow(failure?.retryAfterSeconds);
    const title = hasData
      ? "Live refresh is paused"
      : rateLimited
        ? "StudioNet is temporarily busy"
        : "Live state could not be reached";
    const message = hasData
      ? `The cases below are the last verified snapshot${lastUpdatedAt ? ` from ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(typeof lastUpdatedAt === "number" ? lastUpdatedAt : Date.parse(lastUpdatedAt)))}` : ""}.`
      : rateLimited
        ? `The public read service has reached its request limit${wait ? `; it should accept reads again in ${wait}` : ""}.`
        : unavailable
          ? "The Explorer could not reach the StudioNet read service."
          : failure?.message ?? "The live contract state could not be read.";
    const Icon = rateLimited ? Gauge : unavailable ? WifiOff : AlertTriangle;
    const palette = hasData ? "bg-[#fff0dd] text-[#60300f]" : "bg-[#fde3df] text-[#6b1e1a]";

    return <div role="alert" className={`rounded-[14px] p-5 text-sm ${palette}`}><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 gap-3"><Icon className="mt-0.5 size-5 shrink-0" /><div><p className="font-bold">{title}</p><p className="mt-1 max-w-3xl leading-6">{message}</p><p className="mt-1 opacity-80">No wallet action was attempted. No sample records are being shown.</p></div></div>{onRetry ? <button type="button" onClick={onRetry} disabled={retrying} className="secondary-button shrink-0 self-start !border-current/20 !bg-white/65 sm:self-center"><RefreshCw className={`size-4 ${retrying ? "animate-spin" : ""}`} />{retrying ? "Checking StudioNet…" : "Try live read again"}</button> : null}</div></div>;
  }
  if (loading && !hasData) return <div role="status" className="flex items-center justify-center gap-2 rounded-[14px] bg-white p-8 text-sm text-[#5f615c]"><LoaderCircle className="size-4 animate-spin" /> Reading verified StudioNet state…</div>;
  return null;
}

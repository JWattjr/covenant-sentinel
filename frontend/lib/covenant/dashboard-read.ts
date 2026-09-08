import type { CovenantDashboard } from "./types";

export type DashboardReadFailureCode =
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "MISCONFIGURED"
  | "UNKNOWN";

interface DashboardErrorPayload {
  error?: {
    code?: DashboardReadFailureCode;
    message?: string;
    retryAfterSeconds?: number;
  };
}

export class DashboardReadError extends Error {
  constructor(
    message: string,
    readonly code: DashboardReadFailureCode = "UNKNOWN",
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "DashboardReadError";
  }
}

export async function readDashboard(): Promise<CovenantDashboard> {
  let response: Response;

  try {
    response = await fetch("/api/dashboard", { headers: { Accept: "application/json" } });
  } catch {
    throw new DashboardReadError(
      "The browser could not reach Covenant Sentinel's read service.",
      "UPSTREAM_UNAVAILABLE",
    );
  }

  const payload = (await response.json().catch(() => ({}))) as
    | CovenantDashboard
    | DashboardErrorPayload;

  if (!response.ok) {
    const failure = (payload as DashboardErrorPayload).error;
    throw new DashboardReadError(
      failure?.message ?? "The live contract state could not be read.",
      failure?.code ?? "UNKNOWN",
      failure?.retryAfterSeconds,
    );
  }

  return payload as CovenantDashboard;
}

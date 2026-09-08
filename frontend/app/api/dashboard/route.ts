import { NextResponse } from "next/server";

import { readCovenantDashboard } from "@/lib/covenant/server-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ErrorCode = "RATE_LIMITED" | "UPSTREAM_UNAVAILABLE" | "MISCONFIGURED" | "UNKNOWN";

function inspectError(error: unknown) {
  const messages: string[] = [];
  let retryAfterSeconds: number | undefined;
  let rpcCode: number | undefined;
  let cursor = error;

  for (let depth = 0; depth < 6 && cursor && typeof cursor === "object"; depth += 1) {
    const item = cursor as Record<string, unknown>;
    if (typeof item.message === "string") messages.push(item.message);
    if (typeof item.details === "string") messages.push(item.details);
    if (typeof item.code === "number") rpcCode = item.code;
    const data = item.data;
    if (data && typeof data === "object") {
      const retry = (data as Record<string, unknown>).retry_after_seconds;
      if (typeof retry === "number") retryAfterSeconds = retry;
    }
    cursor = item.cause;
  }

  const detail = messages.join(" ");
  let code: ErrorCode = "UNKNOWN";
  let status = 502;
  let message = "StudioNet returned an unreadable response. No contract data was substituted.";

  if (rpcCode === -32029 || /rate limit|too many requests/i.test(detail)) {
    code = "RATE_LIMITED";
    status = 429;
    message = "StudioNet's public read service has reached its request limit.";
  } else if (/not configured|not a valid 0x address/i.test(detail)) {
    code = "MISCONFIGURED";
    status = 500;
    message = "The deployed contract addresses are not configured correctly.";
  } else if (/failed to fetch|fetch failed|network|timeout|econn|enotfound/i.test(detail)) {
    code = "UPSTREAM_UNAVAILABLE";
    status = 503;
    message = "The StudioNet read service could not be reached.";
  }

  return { code, status, message, retryAfterSeconds };
}

export async function GET() {
  try {
    const dashboard = await readCovenantDashboard();
    return NextResponse.json({ ...dashboard, observedAt: new Date().toISOString() }, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=120",
      },
    });
  } catch (error) {
    const failure = inspectError(error);
    const errorCacheSeconds = failure.code === "RATE_LIMITED"
      ? Math.max(15, Math.min(failure.retryAfterSeconds ?? 30, 60))
      : 15;
    return NextResponse.json(
      {
        error: {
          code: failure.code,
          message: failure.message,
          ...(failure.retryAfterSeconds ? { retryAfterSeconds: failure.retryAfterSeconds } : {}),
        },
      },
      {
        status: failure.status,
        headers: {
          "Cache-Control": `public, max-age=0, s-maxage=${errorCacheSeconds}`,
          ...(failure.retryAfterSeconds
            ? { "Retry-After": String(failure.retryAfterSeconds) }
            : {}),
        },
      },
    );
  }
}

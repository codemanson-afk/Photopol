import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
/** Allow long AI pipelines (Vercel / Node). */
export const maxDuration = 600;

const BACKEND = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const PROXY_MS = 10 * 60 * 1000;

async function proxy(req: NextRequest, pathSegments: string[]) {
  const incoming = new URL(req.url);
  const target = `${BACKEND}/api/${pathSegments.map(encodeURIComponent).join("/")}${incoming.search}`;

  const headers = new Headers();
  const pass = ["authorization", "content-type", "accept", "idempotency-key"];
  for (const key of pass) {
    const v = req.headers.get(key);
    if (v) headers.set(key, v);
  }

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
    signal: AbortSignal.timeout(PROXY_MS),
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    init.duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream request failed";
    const timedOut = message.includes("Timeout") || message.includes("aborted");
    return NextResponse.json(
      {
        error: {
          code: timedOut ? "timeout" : "proxy_error",
          message: timedOut
            ? "Processing is taking too long. Please try again."
            : "Could not reach the API. Is the backend running?",
        },
      },
      { status: timedOut ? 504 : 502 }
    );
  }

  const outHeaders = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) outHeaders.set("content-type", ct);
  const cd = upstream.headers.get("content-disposition");
  if (cd) outHeaders.set("content-disposition", cd);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path || []);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path || []);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path || []);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path || []);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path || []);
}

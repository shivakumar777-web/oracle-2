/**
 * Manthana Oracle reverse proxy (App Router).
 *
 * next.config rewrites to external URLs are unreliable for SSE/streaming and
 * often surface HTML error pages to the client. This handler forwards to
 * ORACLE_INTERNAL_URL with proper streaming of the upstream body.
 */

import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function oracleBase(): string {
  return (process.env.ORACLE_INTERNAL_URL || "http://127.0.0.1:8100").replace(
    /\/$/,
    ""
  );
}

function buildTarget(pathSegments: string[], search: string): string {
  const base = oracleBase();
  const path = pathSegments.length ? pathSegments.join("/") : "";
  return path ? `${base}/${path}${search}` : `${base}${search}`;
}

function forwardRequestHeaders(req: NextRequest): Headers {
  const out = new Headers();
  req.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (HOP_BY_HOP.has(lk) || lk === "host") return;
    out.set(key, value);
  });
  return out;
}

function forwardResponseHeaders(upstream: Response): Headers {
  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (HOP_BY_HOP.has(lk)) return;
    if (lk === "content-length") return;
    out.set(key, value);
  });
  return out;
}

async function proxy(req: NextRequest, pathSegments: string[]) {
  const target = buildTarget(pathSegments, req.nextUrl.search);
  const headers = forwardRequestHeaders(req);

  let body: ArrayBuffer | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body:
        body !== undefined && body.byteLength > 0 ? Buffer.from(body) : undefined,
      redirect: "manual",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({
        status: "error",
        error: "oracle_unreachable",
        message:
          "Cannot reach Manthana Oracle. Start the oracle service and check ORACLE_INTERNAL_URL.",
        detail: msg,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: forwardResponseHeaders(upstream),
  });
}

type RouteCtx = { params: { path?: string[] } };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path ?? []);
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path ?? []);
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path ?? []);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path ?? []);
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path ?? []);
}

export async function HEAD(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path ?? []);
}

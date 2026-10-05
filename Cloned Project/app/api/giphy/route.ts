// Server-side proxy for the Giphy v1 API. We use this instead of calling
// Giphy directly from the browser so the API key stays out of the JS bundle
// and so server-only env vars (no NEXT_PUBLIC_ prefix) work without dev-server
// restarts being load-bearing.
//
// Client calls:
//   GET /api/giphy?action=trending&type=gifs
//   GET /api/giphy?action=trending&type=stickers
//   GET /api/giphy?action=search&type=gifs&q=cat
//   GET /api/giphy?action=search&type=stickers&q=happy
//
// Limit / rating / offset can be passed through as query params.

import { NextRequest, NextResponse } from "next/server";

const GIPHY_BASE = "https://api.giphy.com/v1";

// Whitelist of query params we forward to Giphy. Anything else is dropped.
const FORWARDED_PARAMS = ["q", "limit", "offset", "rating", "lang"] as const;

export async function GET(req: NextRequest) {
  const key = process.env.GIPHY_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "GIPHY_API_KEY not configured on the server" },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "trending";
  const type = url.searchParams.get("type") || "gifs";

  if (action !== "search" && action !== "trending") {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }
  if (type !== "gifs" && type !== "stickers") {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }
  if (action === "search" && !url.searchParams.get("q")?.trim()) {
    return NextResponse.json({ error: "missing q" }, { status: 400 });
  }

  const upstream = new URL(`${GIPHY_BASE}/${type}/${action}`);
  upstream.searchParams.set("api_key", key);
  for (const p of FORWARDED_PARAMS) {
    const v = url.searchParams.get(p);
    if (v != null && v !== "") upstream.searchParams.set(p, v);
  }
  // Default to family-friendly content if the caller didn't set one.
  if (!upstream.searchParams.has("rating")) upstream.searchParams.set("rating", "g");

  try {
    const res = await fetch(upstream.toString(), {
      method: "GET",
      // Giphy is a public read-only API; no need to forward cookies.
      headers: { Accept: "application/json" },
      // Cache trending results for a minute on the edge; search responses
      // are per-query so they're effectively single-use.
      next: action === "trending" ? { revalidate: 60 } : { revalidate: 0 },
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Giphy upstream ${res.status}`, detail: txt.slice(0, 300) },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "fetch failed" },
      { status: 502 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

// Public visitor info — no auth. Routed through roam-backend's
// /openclaw-qa/:agentId/info so OpenClawApi stays off the public edge.
const ROAM_BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  const fwd =
    req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";

  try {
    const res = await fetch(
      `${ROAM_BACKEND}/openclaw-qa/${encodeURIComponent(agentId)}/info`,
      {
        method: "GET",
        headers: fwd ? { "x-forwarded-for": fwd } : {},
        signal: AbortSignal.timeout(10_000),
      },
    );
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type":
          res.headers.get("content-type") || "application/json",
      },
    });
  } catch (err: any) {
    if (err?.name === "TimeoutError") {
      return NextResponse.json({ detail: "Request timed out" }, { status: 504 });
    }
    return NextResponse.json({ detail: "Assistant unavailable" }, { status: 502 });
  }
}

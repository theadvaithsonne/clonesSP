import { NextRequest, NextResponse } from "next/server";

// Gmail OAuth login URL — routed through roam-backend's /openclaw-proxy.
const ROAM_BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  try {
    const auth = req.headers.get("authorization") ?? "";
    const res = await fetch(
      `${ROAM_BACKEND}/openclaw-proxy/api/integrations/google/auth/login?agent_id=${encodeURIComponent(agentId)}`,
      {
        headers: auth ? { Authorization: auth } : {},
        signal: AbortSignal.timeout(15_000),
      },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    if (err?.name === "TimeoutError") {
      return NextResponse.json({ error: "OpenClaw service timed out" }, { status: 504 });
    }
    console.error("[Integrations/Google] GET error:", err);
    return NextResponse.json({ error: "Failed to reach OpenClaw service" }, { status: 502 });
  }
}

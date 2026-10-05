import { NextRequest, NextResponse } from "next/server";

const ROAM_BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Probe by listing 1 email — success = connected, anything else = not.
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  try {
    const auth = req.headers.get("authorization") ?? "";
    const res = await fetch(
      `${ROAM_BACKEND}/openclaw-proxy/api/integrations/gmail/list?agent_id=${encodeURIComponent(agentId)}&max_results=1`,
      {
        headers: auth ? { Authorization: auth } : {},
        signal: AbortSignal.timeout(10_000),
      },
    );
    return NextResponse.json({ connected: res.ok });
  } catch (err: any) {
    if (err?.name === "TimeoutError") {
      return NextResponse.json({ connected: false });
    }
    console.error("[Skills/Gmail/Status] GET error:", err);
    return NextResponse.json({ connected: false });
  }
}

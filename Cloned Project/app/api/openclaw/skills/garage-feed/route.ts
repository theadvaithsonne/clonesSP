import { NextRequest, NextResponse } from "next/server";

// Garage Feed skill: /api/secrets store (service_name="garage_feed"),
// Fernet-encrypted. Routed through roam-backend.
const ROAM_BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function authHeader(req: NextRequest): Record<string, string> {
  const a = req.headers.get("authorization") ?? "";
  return a ? { Authorization: a } : {};
}

// GET /api/openclaw/skills/garage-feed?agentId=X
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }
  try {
    const res = await fetch(
      `${ROAM_BACKEND}/openclaw-proxy/api/secrets/${encodeURIComponent(agentId)}/garage_feed`,
      { headers: authHeader(req), signal: AbortSignal.timeout(10_000) },
    );
    return NextResponse.json({ connected: res.ok });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

// POST /api/openclaw/skills/garage-feed  body: { agentId, token, orgId, channelIds? }
export async function POST(req: NextRequest) {
  let body: { agentId?: string; token?: string; orgId?: string; channelIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { agentId, token, orgId, channelIds = [] } = body;
  if (!agentId || !token || !orgId) {
    return NextResponse.json(
      { error: "agentId, token, and orgId are required" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${ROAM_BACKEND}/openclaw-proxy/api/secrets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(req) },
      body: JSON.stringify({
        agent_id: agentId,
        service_name: "garage_feed",
        secret_data: { token, orgId, channelIds },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    if (err?.name === "TimeoutError") {
      return NextResponse.json({ error: "Service timed out" }, { status: 504 });
    }
    console.error("[Skills/GarageFeed] POST error:", err);
    return NextResponse.json({ error: "Failed to reach service" }, { status: 502 });
  }
}

// DELETE /api/openclaw/skills/garage-feed?agentId=X
export async function DELETE(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }
  try {
    const res = await fetch(
      `${ROAM_BACKEND}/openclaw-proxy/api/secrets/${encodeURIComponent(agentId)}/garage_feed`,
      {
        method: "DELETE",
        headers: authHeader(req),
        signal: AbortSignal.timeout(10_000),
      },
    );
    return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : res.status });
  } catch (err: any) {
    if (err?.name === "TimeoutError") {
      return NextResponse.json({ error: "Service timed out" }, { status: 504 });
    }
    console.error("[Skills/GarageFeed] DELETE error:", err);
    return NextResponse.json({ error: "Failed to reach service" }, { status: 502 });
  }
}

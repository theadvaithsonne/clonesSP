import { NextRequest, NextResponse } from "next/server";

// Notion skill uses OpenClawApi's generic /api/secrets store
// (service_name="notion"), Fernet-encrypted. Routed through roam-backend.
const ROAM_BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function authHeader(req: NextRequest): Record<string, string> {
  const a = req.headers.get("authorization") ?? "";
  return a ? { Authorization: a } : {};
}

// GET /api/openclaw/skills/notion?agentId=X
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }
  try {
    const res = await fetch(
      `${ROAM_BACKEND}/openclaw-proxy/api/secrets/${encodeURIComponent(agentId)}/notion`,
      {
        headers: authHeader(req),
        signal: AbortSignal.timeout(10_000),
      },
    );
    return NextResponse.json({ connected: res.ok });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

// POST /api/openclaw/skills/notion  body: { agentId, apiKey }
export async function POST(req: NextRequest) {
  let body: { agentId?: string; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { agentId, apiKey } = body;
  if (!agentId || !apiKey) {
    return NextResponse.json({ error: "agentId and apiKey are required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${ROAM_BACKEND}/openclaw-proxy/api/secrets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(req) },
      body: JSON.stringify({
        agent_id: agentId,
        service_name: "notion",
        secret_data: { api_key: apiKey },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    if (err?.name === "TimeoutError") {
      return NextResponse.json({ error: "Service timed out" }, { status: 504 });
    }
    console.error("[Skills/Notion] POST error:", err);
    return NextResponse.json({ error: "Failed to reach service" }, { status: 502 });
  }
}

// DELETE /api/openclaw/skills/notion?agentId=X
export async function DELETE(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }
  try {
    const res = await fetch(
      `${ROAM_BACKEND}/openclaw-proxy/api/secrets/${encodeURIComponent(agentId)}/notion`,
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
    console.error("[Skills/Notion] DELETE error:", err);
    return NextResponse.json({ error: "Failed to reach service" }, { status: 502 });
  }
}

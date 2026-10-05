import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function proxy(req: NextRequest, method: string): Promise<NextResponse> {
  try {
    const token = req.headers.get("authorization") ?? "";

    // Forward ?org_id= to backend for org-scoped operations
    const org_id = req.nextUrl.searchParams.get("org_id") || req.nextUrl.searchParams.get("orgId");
    const backendUrl = new URL(`${API_URL}/openclaw-agent`);
    if (org_id) backendUrl.searchParams.set("org_id", org_id);

    const body = method === "POST" ? await req.text() : undefined;

    const res = await fetch(backendUrl.toString(), {
      method,
      headers: { Authorization: token, "Content-Type": "application/json" },
      ...(body ? { body } : {}),
      signal: AbortSignal.timeout(30_000),
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("[OpenClaw Agent proxy] Non-JSON response:", res.status, text.slice(0, 200));
      return NextResponse.json({ error: "Backend returned invalid response" }, { status: 502 });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    if (err?.name === "TimeoutError") {
      return NextResponse.json({ error: "Request timed out" }, { status: 504 });
    }
    console.error("[OpenClaw Agent proxy] Error:", err);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}

export const GET = (req: NextRequest) => proxy(req, "GET");
export const POST = (req: NextRequest) => proxy(req, "POST");
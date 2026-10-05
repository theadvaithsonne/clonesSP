import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function proxy(
  req: NextRequest,
  method: string,
  agentId: string,
): Promise<NextResponse> {
  try {
    const token = req.headers.get("authorization") ?? "";
    const body = method === "PUT" ? await req.text() : undefined;
    const res = await fetch(
      `${API_URL}/openclaw-agent/${agentId}/assignments`,
      {
        method,
        headers: { Authorization: token, "Content-Type": "application/json" },
        ...(body ? { body } : {}),
        signal: AbortSignal.timeout(30_000),
      },
    );
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Backend returned invalid response" }, { status: 502 });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    if (err?.name === "TimeoutError") {
      return NextResponse.json({ error: "Request timed out" }, { status: 504 });
    }
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  return proxy(req, "GET", agentId);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  return proxy(req, "PUT", agentId);
}

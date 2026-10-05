import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Params = { params: { agentId: string } };

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const token = req.headers.get("authorization") ?? "";
    const res = await fetch(`${API_URL}/openclaw-contexts/agent/${params.agentId}`, {
      headers: { Authorization: token },
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch {
      return NextResponse.json({ error: "Backend returned invalid response" }, { status: 502 });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    if (err?.name === "TimeoutError") return NextResponse.json({ error: "Request timed out" }, { status: 504 });
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}

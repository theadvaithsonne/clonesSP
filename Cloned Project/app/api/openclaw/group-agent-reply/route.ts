import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const token = req.headers.get("authorization") ?? "";
    const body = await req.text();
    const { groupId, ...rest } = JSON.parse(body);

    if (!groupId) {
      return NextResponse.json({ error: "groupId required" }, { status: 400 });
    }

    const res = await fetch(`${API_URL}/groups/${groupId}/agent-reply`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify(rest),
      signal: AbortSignal.timeout(15_000),
    });

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

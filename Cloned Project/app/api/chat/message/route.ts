import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Validate internal API key
    const auth = req.headers.get("authorization") ?? "";
    const expected = process.env.GARAGE_INTERNAL_API_KEY;
    if (!expected || auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.text();

    const res = await fetch(`${API_URL}/internal/chat/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${expected}`,
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    if (err?.name === "TimeoutError") {
      return NextResponse.json({ error: "Request timed out" }, { status: 504 });
    }
    console.error("[/api/chat/message] Error:", err);
    return NextResponse.json({ error: "Failed to deliver message" }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** GET /api/openclaw/wallet — proxy to roam-backend wallet */
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization") || "";
    const res = await fetch(`${BACKEND_URL}/wallet`, {
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Failed to reach wallet service" }, { status: 502 });
  }
}

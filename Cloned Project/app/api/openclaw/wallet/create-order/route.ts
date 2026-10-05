import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** POST /api/openclaw/wallet/create-order — create Razorpay order */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization") || "";
    const body = await req.text();
    const res = await fetch(`${BACKEND_URL}/wallet/create-order`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Failed to create payment order" }, { status: 502 });
  }
}

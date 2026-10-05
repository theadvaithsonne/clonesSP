import { NextRequest, NextResponse } from "next/server";

// Dual-mode chat (JSON / multipart) is now handled server-side by
// roam-backend at /openclaw-chat. This route is a thin forwarder that
// preserves the request body unchanged (including multipart boundaries)
// and forwards the user's auth token.
export const runtime = "nodejs";
export const maxDuration = 300;

const ROAM_BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const contentType = req.headers.get("content-type") ?? "";

    // For multipart we must forward the raw bytes + original content-type
    // (boundary included). For JSON we can just pass the text through.
    let body: ArrayBuffer | string;
    if (contentType.includes("multipart/form-data")) {
      body = await req.arrayBuffer();
    } else {
      body = await req.text();
    }

    const res = await fetch(`${ROAM_BACKEND}/openclaw-chat`, {
      method: "POST",
      headers: {
        ...(auth ? { Authorization: auth } : {}),
        "content-type": contentType || "application/json",
      },
      body: body as any,
    });

    const text = await res.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json({ error: "Invalid response" }, { status: 502 });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[OpenClaw Chat] error:", err);
    return NextResponse.json({ error: "Failed to reach chat service" }, { status: 502 });
  }
}

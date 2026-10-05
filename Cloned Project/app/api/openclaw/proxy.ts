import { NextRequest, NextResponse } from "next/server";

// All OpenClawApi calls from the Next.js server go through roam-backend's
// `/openclaw-proxy/*` catch-all. Roam-backend verifies the user's JWT,
// attaches the shared service secret, and forwards to OpenClawApi.
// Next.js API routes MUST NOT fetch OpenClawApi directly — the frontend
// doesn't hold the service secret and OpenClawApi rejects unauth'd calls.

const ROAM_BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function proxyAM(
  req: NextRequest,
  apiPath: string,
  method: string,
  body?: string,
  search: string = "",
): Promise<NextResponse> {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const url = `${ROAM_BACKEND_URL}/openclaw-proxy/api/${apiPath}${search}`;
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: auth } : {}),
      },
      ...(body ? { body } : {}),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 204) return new NextResponse(null, { status: 204 });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json({ error: "Invalid response" }, { status: 502 });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    if (err?.name === "TimeoutError")
      return NextResponse.json({ error: "Request timed out" }, { status: 504 });
    return NextResponse.json({ error: "Failed to reach service" }, { status: 502 });
  }
}

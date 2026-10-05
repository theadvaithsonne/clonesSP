import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function proxy(req: NextRequest, method: string): Promise<NextResponse> {
  try {
    const token = req.headers.get("authorization") ?? "";
    let url = `${API_URL}/openclaw-messages`;
    let body: string | undefined;

    if (method === "GET" || method === "DELETE") {
      // Forward all query params (agentId, limit, before, org_id, etc.)
      // to the backend. The proxy should be transparent.
      const qs = req.nextUrl.searchParams.toString();
      if (qs) url += `?${qs}`;
    } else {
      body = await req.text();
    }

    const res = await fetch(url, {
      method,
      headers: { Authorization: token, "Content-Type": "application/json" },
      ...(body ? { body } : {}),
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

export const GET = (req: NextRequest) => proxy(req, "GET");
export const POST = (req: NextRequest) => proxy(req, "POST");
export const DELETE = (req: NextRequest) => proxy(req, "DELETE");

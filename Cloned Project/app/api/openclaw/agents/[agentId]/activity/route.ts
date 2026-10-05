import { NextRequest, NextResponse } from "next/server";

// Activity feed — scoped server-side by roam-backend's /openclaw-activity
// (founders: full org; employees: only rows whose user_id matches them).
const ROAM_BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
): Promise<NextResponse> {
  const { agentId } = await params;
  try {
    const auth = req.headers.get("authorization") ?? "";
    const url = `${ROAM_BACKEND}/openclaw-activity/${encodeURIComponent(agentId)}/activity${req.nextUrl.search}`;
    const res = await fetch(url, {
      headers: auth ? { Authorization: auth } : {},
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : [];
    } catch {
      return NextResponse.json({ error: "Invalid response" }, { status: 502 });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    if (err?.name === "TimeoutError") {
      return NextResponse.json({ error: "Request timed out" }, { status: 504 });
    }
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}

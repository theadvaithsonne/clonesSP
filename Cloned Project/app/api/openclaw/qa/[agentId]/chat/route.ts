import { NextRequest, NextResponse } from "next/server";

// Public visitor chat — no auth. SSE body is streamed through to the
// browser untouched via roam-backend's /openclaw-qa/:agentId/chat.
export const runtime = "nodejs";

const ROAM_BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  const body = await req.text();
  const fwd =
    req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";

  let upstream: Response;
  try {
    upstream = await fetch(
      `${ROAM_BACKEND}/openclaw-qa/${encodeURIComponent(agentId)}/chat`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(fwd ? { "x-forwarded-for": fwd } : {}),
        },
        body,
      },
    );
  } catch {
    return NextResponse.json(
      { detail: "Something went wrong. Please try again." },
      { status: 502 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") || "application/json",
      },
    });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "content-type":
        upstream.headers.get("content-type") || "text/event-stream",
      "cache-control": "no-cache",
      "x-accel-buffering": "no",
    },
  });
}

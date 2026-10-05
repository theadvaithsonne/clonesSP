import { NextRequest, NextResponse } from "next/server";

/**
 * Multipart pass-through for document uploads. Forwarded as-is (binary
 * body + original Content-Type with boundary) to roam-backend's
 * /openclaw-proxy, which streams it to OpenClawApi's
 * /api/contexts/upload-document. 5-minute ceiling covers the slow
 * Mistral OCR tail.
 */
const ROAM_BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const POST = async (req: NextRequest): Promise<NextResponse> => {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Upload must be sent as multipart/form-data" },
        { status: 400 },
      );
    }

    const auth = req.headers.get("authorization") ?? "";
    const body = await req.arrayBuffer();
    const search = req.nextUrl.search;

    const res = await fetch(
      `${ROAM_BACKEND}/openclaw-proxy/api/contexts/upload-document${search}`,
      {
        method: "POST",
        headers: {
          "content-type": contentType,
          ...(auth ? { Authorization: auth } : {}),
        },
        body,
        signal: AbortSignal.timeout(5 * 60 * 1000),
      },
    );

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json(
        { error: "Invalid response from upload service" },
        { status: 502 },
      );
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    if (err?.name === "TimeoutError") {
      return NextResponse.json(
        {
          error:
            "Upload request timed out after 5 minutes. If you enabled " +
            "OCR on a large scanned PDF, Mistral's free tier can be slow " +
            "at peak times — try again or split the document.",
        },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: "Failed to reach upload service" },
      { status: 502 },
    );
  }
};

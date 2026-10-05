import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const ANALYTICS_API_KEY = process.env.ANALYTICS_API_KEY || "";

export async function GET(request: NextRequest) {
  try {
    if (!ANALYTICS_API_KEY) {
      return NextResponse.json(
        { error: "Analytics API key not configured" },
        { status: 503 }
      );
    }

    // Forward all query params as-is
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();

    const response = await fetch(
      `${BACKEND_URL}/public/analytics/affiliate/direct${qs ? `?${qs}` : ""}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANALYTICS_API_KEY,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[affiliate-analytics/direct] proxy error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    deployed: true,
    version: "audio-fix-v2",
    timestamp: "2026-04-12T03:30:00Z",
  });
}

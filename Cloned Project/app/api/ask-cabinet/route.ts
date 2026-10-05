import { NextResponse } from "next/server";
export const runtime = "edge";
export async function POST() {
  return NextResponse.json(
    { error: "Deprecated. Use Roam backend /ask-cabinet." },
    { status: 410 }
  );
}


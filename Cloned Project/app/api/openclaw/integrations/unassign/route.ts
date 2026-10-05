import { NextRequest, NextResponse } from "next/server";
import { proxyAM } from "../../proxy";

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const agent_id = searchParams.get("agent_id");
  const integration_name = searchParams.get("integration_name");
  if (!agent_id || !integration_name) {
    return NextResponse.json(
      { error: "agent_id and integration_name are required" },
      { status: 422 },
    );
  }
  return proxyAM(req, "integrations/unassign", "DELETE", undefined, req.nextUrl.search);
}

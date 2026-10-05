import { NextRequest } from "next/server";
import { proxyAM } from "../../../proxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  return proxyAM(req, `integrations/agent/${agentId}`, "GET");
}

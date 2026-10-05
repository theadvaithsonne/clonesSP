import { NextRequest } from "next/server";
import { proxyAM } from "../../../../proxy";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string; contextId: string }> },
) {
  const { agentId, contextId } = await params;
  return proxyAM(req, `contexts/unassign/${agentId}/${contextId}`, "DELETE");
}

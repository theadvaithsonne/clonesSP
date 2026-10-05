import { NextRequest } from "next/server";
import { proxyAM } from "../../../../../proxy";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string; issueIndex: string }> },
) {
  const { taskId, issueIndex } = await params;
  return proxyAM(req, `tasks/${taskId}/issues/${issueIndex}/resolve`, "PATCH");
}

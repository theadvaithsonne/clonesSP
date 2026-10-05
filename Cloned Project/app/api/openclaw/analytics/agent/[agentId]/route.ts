import { NextRequest } from "next/server";
import { proxyAM } from "../../../proxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const userId = req.nextUrl.searchParams.get("user_id");
  const search = userId ? `?user_id=${userId}` : req.nextUrl.search;
  return proxyAM(req, `analytics/agent/${agentId}`, "GET", undefined, search);
}
import { NextRequest } from "next/server";
import { proxyAM } from "../../../../openclaw/proxy";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const userId = req.nextUrl.searchParams.get("user_id");
  const search = userId ? `?user_id=${userId}` : "";
  return proxyAM(req, `billing/subscriptions/${agentId}/unlock`, "POST", undefined, search);
}

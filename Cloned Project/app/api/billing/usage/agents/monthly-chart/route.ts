import { NextRequest } from "next/server";
import { proxyAM } from "../../../../openclaw/proxy";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("user_id");
  const orgId = req.nextUrl.searchParams.get("org_id");
  
  const params = new URLSearchParams();
  if (userId) params.set("user_id", userId);
  if (orgId) params.set("org_id", orgId);
  const search = params.toString() ? `?${params.toString()}` : "";

  return proxyAM(req, "billing/usage/agents/monthly-chart", "GET", undefined, search);
}
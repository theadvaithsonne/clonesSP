import { NextRequest } from "next/server";
import { proxyAM } from "../../openclaw/proxy";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("org_id");
  const params = new URLSearchParams();
  if (orgId) params.set("org_id", orgId);
  const search = params.toString() ? `?${params.toString()}` : "";
  return proxyAM(req, "billing/subscriptions", "GET", undefined, search);
}

import { NextRequest } from "next/server";
import { proxyAM } from "../../openclaw/proxy";

export async function GET(req: NextRequest) {
  const params = new URLSearchParams();
  const userId = req.nextUrl.searchParams.get("user_id");
  const orgId = req.nextUrl.searchParams.get("org_id");
  const type = req.nextUrl.searchParams.get("type");
  const limit = req.nextUrl.searchParams.get("limit");
  const offset = req.nextUrl.searchParams.get("offset");

  if (userId) params.set("user_id", userId);
  if (orgId) params.set("org_id", orgId);
  if (type) params.set("type", type);
  if (limit) params.set("limit", limit);
  if (offset) params.set("offset", offset);

  const search = params.toString() ? `?${params.toString()}` : "";
  return proxyAM(req, "billing/transactions", "GET", undefined, search);
}

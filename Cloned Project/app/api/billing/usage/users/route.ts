import { NextRequest } from "next/server";
import { proxyAM } from "@/app/api/openclaw/proxy";
export async function GET(req: NextRequest) {
  return proxyAM(req, "billing/usage/users", "GET", undefined, req.nextUrl.search);
}

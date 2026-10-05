import { NextRequest } from "next/server";
import { proxyAM } from "../../../openclaw/proxy";

export const GET = (req: NextRequest) =>
  proxyAM(req, "billing/usage/daily-7d", "GET", undefined, req.nextUrl.search);


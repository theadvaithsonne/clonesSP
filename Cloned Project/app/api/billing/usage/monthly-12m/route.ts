import { NextRequest } from "next/server";
import { proxyAM } from "../../../openclaw/proxy";

export const GET = (req: NextRequest) =>
  proxyAM(req, "billing/usage/monthly-12m", "GET", undefined, req.nextUrl.search);


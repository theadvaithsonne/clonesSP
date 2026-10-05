import { NextRequest } from "next/server";
import { proxyAM } from "../../../openclaw/proxy";

export const GET = (req: NextRequest) =>
  proxyAM(req, "billing/usage/models", "GET", undefined, req.nextUrl.search);


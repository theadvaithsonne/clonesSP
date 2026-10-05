import { NextRequest } from "next/server";
import { proxyAM } from "../../../proxy";

export const POST = (req: NextRequest) =>
  proxyAM(req, "admin/agents/sync-registry", "POST", undefined, req.nextUrl.search);

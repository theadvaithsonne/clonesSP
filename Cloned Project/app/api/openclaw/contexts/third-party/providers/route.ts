import { NextRequest } from "next/server";
import { proxyAM } from "../../../proxy";

export const GET = (req: NextRequest) =>
  proxyAM(req, "contexts/third-party/providers", "GET", undefined, req.nextUrl.search);

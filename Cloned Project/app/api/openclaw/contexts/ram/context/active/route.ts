import { NextRequest } from "next/server";
import { proxyAM } from "../../../../proxy";
export const GET = (req: NextRequest) => proxyAM(req, "contexts/ram/context/active", "GET");
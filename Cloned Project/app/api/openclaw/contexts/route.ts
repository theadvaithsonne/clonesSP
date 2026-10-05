import { NextRequest } from "next/server";
import { proxyAM } from "../proxy";

export const GET = (req: NextRequest) =>
  proxyAM(req, "contexts", "GET", undefined, req.nextUrl.search);

export const POST = async (req: NextRequest) =>
  proxyAM(req, "contexts", "POST", await req.text(), req.nextUrl.search);

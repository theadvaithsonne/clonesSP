import { NextRequest } from "next/server";
import { proxyAM } from "../proxy";

export const GET = (req: NextRequest) =>
  proxyAM(req, "cron-templates", "GET", undefined, req.nextUrl.search);

export const POST = async (req: NextRequest) =>
  proxyAM(req, "cron-templates", "POST", await req.text(), req.nextUrl.search);

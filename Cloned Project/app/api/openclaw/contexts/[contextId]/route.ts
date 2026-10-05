import { NextRequest } from "next/server";
import { proxyAM } from "../../proxy";

type Params = { params: Promise<{ contextId: string }> };

export const GET = async (req: NextRequest, { params }: Params) => {
  const { contextId } = await params;
  return proxyAM(req, `contexts/${contextId}`, "GET", undefined, req.nextUrl.search);
};

export const PATCH = async (req: NextRequest, { params }: Params) => {
  const { contextId } = await params;
  return proxyAM(req, `contexts/${contextId}`, "PATCH", await req.text(), req.nextUrl.search);
};

export const DELETE = async (req: NextRequest, { params }: Params) => {
  const { contextId } = await params;
  return proxyAM(req, `contexts/${contextId}`, "DELETE", undefined, req.nextUrl.search);
};

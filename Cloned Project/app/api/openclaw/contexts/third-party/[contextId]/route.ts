import { NextRequest } from "next/server";
import { proxyAM } from "../../../proxy";

export const GET = async (req: NextRequest, { params }: { params: Promise<{ contextId: string }>}) => {
  const { contextId } = await params;
  return proxyAM(req, `contexts/third-party/${contextId}`, "GET", undefined, req.nextUrl.search);
};

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ contextId: string }>}) => {
  const { contextId } = await params;
  return proxyAM(req, `contexts/third-party/${contextId}`, "DELETE", undefined, req.nextUrl.search);
};

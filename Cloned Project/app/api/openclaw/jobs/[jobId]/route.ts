import { NextRequest } from "next/server";
import { proxyAM } from "../../proxy";

type Params = { params: Promise<{ jobId: string }> };

export const PATCH = async (req: NextRequest, { params }: Params) => {
  const { jobId } = await params;
  return proxyAM(req, `crons/${jobId}`, "PATCH", await req.text(), req.nextUrl.search);
};

export const DELETE = async (req: NextRequest, { params }: Params) => {
  const { jobId } = await params;
  return proxyAM(req, `crons/${jobId}`, "DELETE", undefined, req.nextUrl.search);
};

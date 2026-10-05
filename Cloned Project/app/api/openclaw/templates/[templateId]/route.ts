import { NextRequest } from "next/server";
import { proxyAM } from "../../proxy";

type Params = { params: Promise<{ templateId: string }> };

export const PATCH = async (req: NextRequest, { params }: Params) => {
  const { templateId } = await params;
  return proxyAM(req, `cron-templates/${templateId}`, "PATCH", await req.text(), req.nextUrl.search);
};

export const DELETE = async (req: NextRequest, { params }: Params) => {
  const { templateId } = await params;
  return proxyAM(req, `cron-templates/${templateId}`, "DELETE", undefined, req.nextUrl.search);
};

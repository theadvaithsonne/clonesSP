import { NextRequest } from "next/server";
import { proxyAM } from "../../../../proxy";
export const POST = async (req: NextRequest, { params }: { params: Promise<{ contextId: string }>}) => {
  const { contextId } = await params;
  return proxyAM(req, `contexts/third-party/${contextId}/assign`, "POST", await req.text());
};
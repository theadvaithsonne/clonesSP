import { NextRequest } from "next/server";
import { proxyAM } from "../../../proxy";

export const GET = async (
  req: NextRequest,
  { params }: { params: { integrationName: string } }
) => {
  const { integrationName } = await params;
  return proxyAM(req, 
    `integrations/${encodeURIComponent(integrationName)}/unconnected-agents`,
    "GET",
    undefined,
    req.nextUrl.search
  );
};

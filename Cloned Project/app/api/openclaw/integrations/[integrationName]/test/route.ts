import { NextRequest } from "next/server";
import { proxyAM } from "../../../proxy";

export const POST = async (
  req: NextRequest,
  { params }: { params: { integrationName: string } }
) => {
  const { integrationName } = await params;
  return proxyAM(req, 
    `integrations/${encodeURIComponent(integrationName)}/test`,
    "POST",
    undefined,
    req.nextUrl.search
  );
};

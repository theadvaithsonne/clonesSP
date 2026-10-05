import { NextRequest } from "next/server";
import { proxyAM } from "../../../proxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ integrationName: string }> },
) {
  const { integrationName } = await params;
  return proxyAM(req, `integrations/${integrationName}/logs`, "GET");
}

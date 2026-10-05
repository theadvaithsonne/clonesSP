import { NextRequest } from "next/server";
import { proxyAM } from "../../../proxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  return proxyAM(req, `crons/${jobId}/detail`, "GET");
}

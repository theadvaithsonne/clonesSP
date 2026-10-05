import { NextRequest } from "next/server";
import { proxyAM } from "../../../proxy";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  return proxyAM(req, `crons/${jobId}/trigger`, "POST");
}

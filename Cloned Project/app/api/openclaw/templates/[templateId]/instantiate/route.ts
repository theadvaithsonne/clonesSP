import { NextRequest } from "next/server";
import { proxyAM } from "../../../proxy";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await params;
  return proxyAM(
    req,
    `cron-templates/${templateId}/instantiate`,
    "POST",
    await req.text(),
  );
}

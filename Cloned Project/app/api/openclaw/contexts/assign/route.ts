import { NextRequest } from "next/server";
import { proxyAM } from "../../proxy";

export async function POST(req: NextRequest) {
  return proxyAM(req, "contexts/assign", "POST", await req.text());
}

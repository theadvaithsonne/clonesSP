import { NextRequest } from "next/server";
import { proxyAM } from "../../../../../proxy";
export const DELETE = (req: NextRequest, { params }: { params: { contextId: string, agentId: string }}) => proxyAM(req, `contexts/third-party/${params.contextId}/assign/${params.agentId}`, "DELETE");
import { NextRequest } from "next/server";
import { proxyAM } from "../../../../proxy";
export const DELETE = (req: NextRequest, { params }: { params: { taskId: string }}) => proxyAM(req, `contexts/ram/task/${params.taskId}`, "DELETE");
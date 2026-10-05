import { NextRequest, NextResponse } from "next/server";
import { proxyAM } from "../../../proxy";

export const GET = async (req: NextRequest) => {
  try {
    const amRes = await proxyAM(req, "contexts/third-party/completed", "GET", undefined, req.nextUrl.search);
    if (!amRes.ok) return amRes;

    const data = await amRes.json();
    const contexts = data.contexts || [];

    // Get allowed agents from backend
    const token = req.headers.get("authorization") ?? "";
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const backendRes = await fetch(`${baseUrl}/openclaw-agent`, {
      headers: { "Authorization": token },
      signal: AbortSignal.timeout(30_000),
    });

    if (!backendRes.ok) {
      console.error("[Completed Contexts] Failed to fetch allowed agents from backend");
      return NextResponse.json(data);
    }

    const backendData = await backendRes.json();
    const backendAgents = backendData.agents || [];
    const allowedIds = new Set(backendAgents.map((a: any) => a.agent_id || a.id));

    // Filter mapped_agents in each context
    const filteredContexts = contexts.map((ctx: any) => {
      if (!ctx.mapped_agents) return ctx;
      return {
        ...ctx,
        mapped_agents: ctx.mapped_agents.filter((ma: any) => {
          const id = ma.agent_id || ma.id;
          return allowedIds.has(id);
        })
      };
    });

    return NextResponse.json({ ...data, contexts: filteredContexts });
  } catch (err) {
    console.error("[Completed Contexts] Error during filtering:", err);
    return NextResponse.json({ error: "Failed to fetch filtered completed contexts" }, { status: 502 });
  }
};

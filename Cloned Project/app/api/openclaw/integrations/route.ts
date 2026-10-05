import { NextRequest, NextResponse } from "next/server";
import { proxyAM } from "../proxy";

export const GET = async (req: NextRequest) => {
  try {
    const amRes = await proxyAM(req, "integrations", "GET", undefined, req.nextUrl.search);
    if (!amRes.ok) return amRes;

    const integrations = await amRes.json();
    
    // Get allowed agents from backend
    const token = req.headers.get("authorization") ?? "";
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const org_id = req.nextUrl.searchParams.get("org_id") || req.nextUrl.searchParams.get("orgId");
    
    const backendUrl = new URL(`${baseUrl}/openclaw-agent`);
    if (org_id) backendUrl.searchParams.set("org_id", org_id);

    const backendRes = await fetch(backendUrl.toString(), {
      headers: { "Authorization": token },
      signal: AbortSignal.timeout(30_000),
    });

    if (!backendRes.ok) {
      console.error("[Integrations] Failed to fetch allowed agents from backend");
      return NextResponse.json(integrations);
    }

    const backendData = await backendRes.json();
    const backendAgents = backendData.agents || [];
    const allowedIds = new Set(backendAgents.map((a: any) => a.agent_id || a.id));

    // Filter connected_agents in each integration
    const filteredIntegrations = integrations.map((it: any) => {
      if (!it.connected_agents) return it;
      return {
        ...it,
        connected_agents: it.connected_agents.filter((ca: any) => {
          const id = typeof ca === "string" ? ca : ca.agent_id || ca.id;
          return allowedIds.has(id);
        })
      };
    });

    return NextResponse.json(filteredIntegrations);
  } catch (err) {
    console.error("[Integrations] Error during filtering:", err);
    return NextResponse.json({ error: "Failed to fetch filtered integrations" }, { status: 502 });
  }
};

export const POST = async (req: NextRequest) =>
  proxyAM(req, "integrations/assign", "POST", await req.text(), req.nextUrl.search);

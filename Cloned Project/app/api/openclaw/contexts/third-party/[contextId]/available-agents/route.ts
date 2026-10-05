import { NextRequest, NextResponse } from "next/server";
import { proxyAM } from "../../../../proxy";

export const GET = async (req: NextRequest, { params }: { params: Promise<{ contextId: string }> }) => {
  const { contextId } = await params;
  
  try {
    // 1. Get available agents from OpenClaw Agent Manager
    const amRes = await proxyAM(req, `contexts/third-party/${contextId}/available-agents`, "GET");
    if (!amRes.ok) return amRes;
    
    const amData = await amRes.json();
    const amAgents = amData.agents || [];
    
    // 2. Get allowed agents from our main backend
    const token = req.headers.get("authorization") ?? "";
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    
    const backendRes = await fetch(`${baseUrl}/openclaw-agent`, {
      headers: { "Authorization": token },
      signal: AbortSignal.timeout(30_000),
    });
    
    if (!backendRes.ok) {
      console.error("[Available Agents] Failed to fetch allowed agents from backend");
      return NextResponse.json({ agents: [] });
    }
    
    const backendData = await backendRes.json();
    const backendAgents = backendData.agents || [];
    const allowedIds = new Set(backendAgents.map((a: any) => a.agent_id || a.id));
    
    // 3. Filter AM agents by those allowed in our backend
    const filteredAgents = amAgents.filter((agent: any) => allowedIds.has(agent.agent_id));
    
    return NextResponse.json({ agents: filteredAgents });
    
  } catch (err) {
    console.error("[Available Agents] Error during filtering:", err);
    return NextResponse.json({ error: "Failed to fetch filtered available agents" }, { status: 502 });
  }
};

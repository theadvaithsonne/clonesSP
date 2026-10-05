"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { getOrgId, getToken } from "@/lib/auth";

import { ManualContextsView } from "./ManualContextsView";
import { ThirdPartyContextsView } from "./ThirdPartyContextsView";
import { toast } from "sonner";
import { Database, Zap } from "lucide-react";

interface AgentData {
  agent_id: string;
  name: string;
}

function OpenClawContextsPageInternal() {
  const [activeTab, setActiveTab] = useState<"manual" | "third-party">("manual");
  const [agents, setAgents] = useState<AgentData[]>([]);
  const orgId = getOrgId();
  
  const authCurrent = useMemo(() => ({
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  }), []);

  const loadAgents = useCallback(async () => {
    try {
      const url = new URL("/api/openclaw/agent", window.location.origin);
      if (orgId) url.searchParams.set("org_id", orgId);
      
      const res = await fetch(url.toString(), { headers: authCurrent });
      if (!res.ok) throw new Error();
      const agData = await res.json();
      setAgents(agData.agents || []);
    } catch {
      // Ignore initial agent load failures quietly or toast, UI will just show empty list
    }
  }, [authCurrent]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] min-h-[500px] rounded-xl border border-[#2a2a35] overflow-hidden bg-[#0a0a0f]">
      <div className="flex border-b border-[#2a2a35] shrink-0 bg-[#0c0c11]">
        <button
          onClick={() => setActiveTab("manual")}
          className={`flex items-center gap-2 px-6 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === "manual" ? "border-brand text-white" : "border-transparent text-[#5a5a72] hover:text-[#9fa0b8]"
          }`}
        >
          <Database className="h-3.5 w-3.5" /> Manual Contexts
        </button>
        <button
          onClick={() => setActiveTab("third-party")}
          className={`flex items-center gap-2 px-6 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === "third-party" ? "border-brand text-white" : "border-transparent text-[#5a5a72] hover:text-[#9fa0b8]"
          }`}
        >
          <Zap className="h-3.5 w-3.5" /> Third-Party Contexts
        </button>
      </div>
      
      <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
        {activeTab === "manual" ? (
          <ManualContextsView authCurrent={authCurrent} />
        ) : (
          <div className="flex-1 overflow-y-auto">
            <ThirdPartyContextsView agents={agents} authCurrent={authCurrent} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function OpenClawContextsPage() {
  return (
    <OpenClawContextsPageInternal />
  );
}

export interface SiteStep { id: string; title: string; html: string; }

export type JobStage = "planning" | "building" | "reviewing" | "refining" | "done" | "error";
export interface JobStatus {
  status: "queued" | "running" | "done" | "error";
  stage: JobStage;
  plan?: string;
  steps?: SiteStep[];
  error?: string;
}
export interface AiSiteMeta { archetype?: string; palette?: string; prompt?: string; opportunityId?: string; }
export interface AiSiteContent { mode: "site"; steps: SiteStep[]; meta?: AiSiteMeta; }

export type FnCtaAction = "buy" | "url" | "scroll" | "next" | "prev" | "goto";
export type FnBridgeMessage =
  | { type: "fnsite:ready" }
  | { type: "fnsite:cta"; payload: { action: FnCtaAction; href?: string; target?: string; step?: number } }
  | { type: "fnsite:lead"; payload: { fields: Record<string, string>; partial?: boolean } }
  | { type: "fnsite:track"; payload: { event: string; meta?: Record<string, unknown> } }
  | { type: "fnsite:resize"; payload: { height: number } };

export function isFnBridgeMessage(x: unknown): x is FnBridgeMessage {
  if (!x || typeof x !== "object") return false;
  const t = (x as { type?: unknown }).type;
  if (typeof t !== "string" || !t.startsWith("fnsite:")) return false;
  if (t === "fnsite:ready") return true;
  return typeof (x as { payload?: unknown }).payload === "object" && (x as { payload?: unknown }).payload !== null;
}

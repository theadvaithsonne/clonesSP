import { buildExternalUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/utils/api";
import { parseEmails } from "./utils";

export interface CrmFunnelOption {
  id: string;
  name: string;
  activeLeads?: number;
}

export interface CrmFunnelStageOption {
  name: string;
  value: string;
}

export interface CrmLeadFilter {
  funnelId: string;
  stage?: string;
  tag?: string;
  leadStatus?: string;
  source?: string;
}

export interface CrmLeadFilterStats {
  total: number;
  withEmail: number;
  sample: { name: string; email: string; status?: string }[];
}

function normalizeStages(raw: unknown): CrmFunnelStageOption[] {
  const stages = Array.isArray(raw) ? raw : [];
  return stages
    .map((stage: unknown) => {
      if (typeof stage === "string") {
        const s = stage.trim();
        return s ? { name: s, value: s } : null;
      }
      if (stage && typeof stage === "object") {
        const o = stage as Record<string, unknown>;
        const name = String(o.name || o.stageName || o.id || o._id || "").trim();
        const value = String(o.name || o.stageName || o.id || o._id || name).trim();
        if (!name) return null;
        return { name, value };
      }
      return null;
    })
    .filter((s): s is CrmFunnelStageOption => Boolean(s));
}

export async function listCrmFunnels(): Promise<CrmFunnelOption[]> {
  const response = await authenticatedFetch(
    buildExternalUrl("/crm/funnels?skip=0&limit=200"),
    { method: "GET", headers: { "Content-Type": "application/json" } }
  );
  if (!response.ok) return [];
  const data = await response.json();
  const list = data.funnels || data.data || data || [];
  if (!Array.isArray(list)) return [];
  return list
    .map((f: Record<string, unknown>) => {
      const id = String(f._id || f.id || "").trim();
      if (!id) return null;
      return {
        id,
        name: String(f.funnelName || f.name || f.salesFunnel || "Unnamed funnel"),
        activeLeads:
          (f.leadsCount as number) ??
          (f.activeLeads as number) ??
          (f.active_leads as number) ??
          undefined,
      };
    })
    .filter((f): f is CrmFunnelOption => Boolean(f));
}

export async function getCrmFunnelStages(funnelId: string): Promise<CrmFunnelStageOption[]> {
  if (!funnelId) return [];
  const response = await authenticatedFetch(buildExternalUrl(`/crm/funnels/${funnelId}`), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) return [];
  const data = await response.json();
  const funnel = data.funnel || data.data || data;
  return normalizeStages(funnel?.funnelStage || funnel?.stages || data.funnelStage || data.stages);
}

export function extractLeadEmail(lead: Record<string, unknown>): string | null {
  const direct = lead.email;
  if (typeof direct === "string" && direct.trim()) {
    const { valid } = parseEmails(direct);
    return valid[0] ?? null;
  }
  const contact = lead.contact as Record<string, unknown> | undefined;
  if (contact?.email && typeof contact.email === "string") {
    const { valid } = parseEmails(contact.email);
    return valid[0] ?? null;
  }
  const contacts = lead.contacts;
  if (Array.isArray(contacts) && contacts[0]) {
    const c = contacts[0] as Record<string, unknown>;
    if (typeof c.email === "string") {
      const { valid } = parseEmails(c.email);
      return valid[0] ?? null;
    }
  }
  return null;
}

export function extractLeadStatus(lead: Record<string, unknown>): string {
  const status = lead.leadStatus ?? lead.status;
  if (typeof status === "string" && status.trim()) {
    return status.trim().charAt(0).toUpperCase() + status.trim().slice(1).toLowerCase();
  }
  const stage = lead.stage;
  if (typeof stage === "string" && stage.trim()) return stage.trim();
  return "Active";
}

export function extractLeadName(lead: Record<string, unknown>): string {
  if (typeof lead.leadName === "string" && lead.leadName.trim()) return lead.leadName.trim();
  const contact = lead.contact as Record<string, unknown> | undefined;
  if (contact) {
    const n = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
    if (n) return n;
    if (typeof contact.name === "string") return contact.name;
  }
  const email = extractLeadEmail(lead);
  return email ?? "Lead";
}

export async function listCrmLeadTags(): Promise<string[]> {
  const response = await authenticatedFetch(buildExternalUrl("/crm/leads/tags"), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) return [];
  const data = await response.json();
  const tagsList = data.tags || data.data || data || [];
  if (!Array.isArray(tagsList)) return [];
  return tagsList
    .map((tag: unknown) =>
      typeof tag === "string" ? tag.trim() : String((tag as { name?: string })?.name || tag || "").trim()
    )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function buildLeadsQuery(filter: CrmLeadFilter, skip: number, limit: number): string {
  const params = new URLSearchParams({
    skip: String(skip),
    limit: String(limit),
    salesFunnel: filter.funnelId,
  });
  if (filter.stage?.trim()) {
    params.set("stage", filter.stage.trim());
  }
  if (filter.tag?.trim()) {
    params.set("tags", filter.tag.trim());
  }
  if (filter.leadStatus?.trim()) {
    params.set("leadStatus", filter.leadStatus.trim());
  }
  if (filter.source?.trim()) {
    params.set("source", filter.source.trim());
  }
  return params.toString();
}

function leadMatchesClientFilters(lead: Record<string, unknown>, filter: CrmLeadFilter): boolean {
  if (filter.source?.trim()) {
    const leadSource = String(lead.source || "").trim();
    if (leadSource.toLowerCase() !== filter.source.trim().toLowerCase()) return false;
  }
  if (filter.tag?.trim()) {
    const tags = lead.tags;
    const tagList = Array.isArray(tags)
      ? tags.map((t) => String(t).trim().toLowerCase())
      : typeof tags === "string"
        ? tags.split(",").map((t) => t.trim().toLowerCase())
        : [];
    if (!tagList.includes(filter.tag.trim().toLowerCase())) return false;
  }
  if (filter.leadStatus?.trim()) {
    const status = String(lead.leadStatus || lead.status || "active").toLowerCase();
    if (status !== filter.leadStatus.trim().toLowerCase()) return false;
  }
  return true;
}

async function fetchLeadsPage(
  filter: CrmLeadFilter,
  skip: number,
  limit: number
): Promise<{ leads: Record<string, unknown>[]; total?: number }> {
  const response = await authenticatedFetch(
    buildExternalUrl(`/crm/leads?${buildLeadsQuery(filter, skip, limit)}`),
    { method: "GET", headers: { "Content-Type": "application/json" } }
  );
  if (!response.ok) {
    return { leads: [] };
  }
  const data = await response.json();
  const leads = (data.leads || data.data || data || []) as Record<string, unknown>[];
  const total =
    typeof data.total === "number"
      ? data.total
      : typeof data.pagination?.total === "number"
        ? data.pagination.total
        : undefined;
  return { leads: Array.isArray(leads) ? leads : [], total };
}

/** Count matching leads and how many have a sendable email (samples up to 3 contacts). */
export async function fetchCrmLeadFilterStats(
  filter: CrmLeadFilter,
  signal?: AbortSignal
): Promise<CrmLeadFilterStats> {
  if (!filter.funnelId) {
    return { total: 0, withEmail: 0, sample: [] };
  }

  const pageSize = 500;
  let skip = 0;
  let total: number | undefined;
  let withEmail = 0;
  let totalMatched = 0;
  const sample: { name: string; email: string; status?: string }[] = [];
  const seenEmails = new Set<string>();

  while (true) {
    const response = await authenticatedFetch(
      buildExternalUrl(`/crm/leads?${buildLeadsQuery(filter, skip, pageSize)}`),
      { method: "GET", headers: { "Content-Type": "application/json" }, signal }
    );
    if (!response.ok) break;

    const data = await response.json();
    const batch = (data.leads || data.data || data || []) as Record<string, unknown>[];
    const leads = Array.isArray(batch) ? batch : [];

    if (total === undefined) {
      if (typeof data.total === "number") total = data.total;
      else if (typeof data.pagination?.total === "number") total = data.pagination.total;
    }

    for (const lead of leads) {
      if (!leadMatchesClientFilters(lead, filter)) continue;
      totalMatched += 1;
      const email = extractLeadEmail(lead);
      if (email) {
        const key = email.toLowerCase();
        if (!seenEmails.has(key)) {
          seenEmails.add(key);
          withEmail += 1;
          if (sample.length < 3) {
            sample.push({
              name: extractLeadName(lead),
              email,
              status: extractLeadStatus(lead),
            });
          }
        }
      }
    }

    if (leads.length < pageSize) break;
    skip += pageSize;
    if (total !== undefined && skip >= total) break;
    if (skip >= 10_000) break;
  }

  if (total === undefined) {
    total = totalMatched > 0 ? totalMatched : withEmail;
  } else if (filter.tag || filter.leadStatus || filter.source) {
    total = totalMatched;
  }

  return { total, withEmail, sample };
}

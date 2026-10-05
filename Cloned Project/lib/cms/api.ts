import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";
import type {
  CmsDomain,
  CmsForm,
  CmsFunnelRule,
  CmsPage,
  CmsPipeline,
} from "./types";

async function jsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data;
}

export async function listCmsPages(status?: string) {
  const qs = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
  const res = await authenticatedFetch(buildExternalUrl(`/cms/pages${qs}`));
  return jsonOrThrow(res) as Promise<{
    pages: CmsPage[];
    stats: {
      totalPages: number;
      published: number;
      totalLeads: number;
      conversionRate: number;
    };
  }>;
}

export async function createCmsPage(payload?: { name?: string; slug?: string }) {
  const res = await authenticatedFetch(buildExternalUrl("/cms/pages"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  return jsonOrThrow(res) as Promise<{ page: CmsPage; form: CmsForm }>;
}

export async function getCmsPage(id: string) {
  const res = await authenticatedFetch(buildExternalUrl(`/cms/pages/${id}`));
  return jsonOrThrow(res) as Promise<{
    page: CmsPage;
    form: CmsForm | null;
    rules: CmsFunnelRule[];
  }>;
}

export async function updateCmsPage(id: string, payload: Partial<CmsPage>) {
  const res = await authenticatedFetch(buildExternalUrl(`/cms/pages/${id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res) as Promise<{ page: CmsPage }>;
}

export async function deleteCmsPage(id: string) {
  const res = await authenticatedFetch(buildExternalUrl(`/cms/pages/${id}`), {
    method: "DELETE",
  });
  return jsonOrThrow(res);
}

export async function cloneCmsPage(id: string) {
  const res = await authenticatedFetch(buildExternalUrl(`/cms/pages/${id}/clone`), {
    method: "POST",
  });
  return jsonOrThrow(res) as Promise<{ page: CmsPage; form: CmsForm }>;
}

export async function publishCmsPage(id: string) {
  const res = await authenticatedFetch(buildExternalUrl(`/cms/pages/${id}/publish`), {
    method: "POST",
  });
  return jsonOrThrow(res) as Promise<{ page: CmsPage; publicUrl: string }>;
}

export async function updateCmsPageStatus(id: string, status: string) {
  const res = await authenticatedFetch(buildExternalUrl(`/cms/pages/${id}/status`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return jsonOrThrow(res) as Promise<{ page: CmsPage }>;
}

export async function updateCmsForm(id: string, payload: Partial<CmsForm>) {
  const res = await authenticatedFetch(buildExternalUrl(`/cms/forms/${id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res) as Promise<{ form: CmsForm }>;
}

export async function listCmsDomains() {
  const res = await authenticatedFetch(buildExternalUrl("/cms/domains"));
  return jsonOrThrow(res) as Promise<{ domains: CmsDomain[] }>;
}

export async function addCmsDomain(hostname: string) {
  const res = await authenticatedFetch(buildExternalUrl("/cms/domains"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostname }),
  });
  return jsonOrThrow(res) as Promise<{ domain: CmsDomain }>;
}

export async function verifyCmsDomain(id: string) {
  const res = await authenticatedFetch(buildExternalUrl(`/cms/domains/${id}/verify`), {
    method: "POST",
  });
  return jsonOrThrow(res) as Promise<{
    domain: CmsDomain;
    verified: boolean;
    message: string;
  }>;
}

export async function deleteCmsDomain(id: string) {
  const res = await authenticatedFetch(buildExternalUrl(`/cms/domains/${id}`), {
    method: "DELETE",
  });
  return jsonOrThrow(res);
}

export async function listCmsRules(pageId: string) {
  const res = await authenticatedFetch(buildExternalUrl(`/cms/pages/${pageId}/rules`));
  return jsonOrThrow(res) as Promise<{ rules: CmsFunnelRule[] }>;
}

export async function createCmsRule(pageId: string, payload: Partial<CmsFunnelRule>) {
  const res = await authenticatedFetch(buildExternalUrl(`/cms/pages/${pageId}/rules`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res) as Promise<{ rule: CmsFunnelRule }>;
}

export async function updateCmsRule(
  pageId: string,
  ruleId: string,
  payload: Partial<CmsFunnelRule>
) {
  const res = await authenticatedFetch(
    buildExternalUrl(`/cms/pages/${pageId}/rules/${ruleId}`),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  return jsonOrThrow(res) as Promise<{ rule: CmsFunnelRule }>;
}

export async function deleteCmsRule(pageId: string, ruleId: string) {
  const res = await authenticatedFetch(
    buildExternalUrl(`/cms/pages/${pageId}/rules/${ruleId}`),
    { method: "DELETE" }
  );
  return jsonOrThrow(res);
}

export async function listCmsPipelines() {
  const res = await authenticatedFetch(buildExternalUrl("/cms/crm/pipelines"));
  return jsonOrThrow(res) as Promise<{ pipelines: CmsPipeline[] }>;
}

export async function connectCmsCrm(
  pageId: string,
  payload: { crmPipelineId?: string; crmSyncEnabled?: boolean }
) {
  const res = await authenticatedFetch(
    buildExternalUrl(`/cms/pages/${pageId}/crm-connect`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  return jsonOrThrow(res) as Promise<{ page: CmsPage }>;
}

export async function fetchPublicCmsPage(slug: string) {
  const res = await fetch(buildExternalUrl(`/cms/pages/public/${encodeURIComponent(slug)}`), {
    cache: "no-store",
  });
  return jsonOrThrow(res);
}

export async function submitCmsForm(formId: string, data: Record<string, any>, source?: string) {
  const res = await fetch(buildExternalUrl(`/cms/forms/${formId}/submit`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, source }),
  });
  return jsonOrThrow(res);
}

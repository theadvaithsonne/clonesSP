import { buildExternalUrl } from "@/lib/api-config";
import type { ComponentBlock } from "@/components/dashboard/inlineApps/network-mail/block-factory";
import { buildTemplateHtmlBody } from "@/components/dashboard/inlineApps/network-mail/email-html-export";
import type { EmailTemplatePresetId } from "@/components/dashboard/inlineApps/network-mail/email-template-presets";
import { authenticatedFetch, getUserData, handleApiResponse } from "@/utils/api";

export type TemplateCategory =
  | "Marketing"
  | "General"
  | "Promotional"
  | "Transactional";

export type TemplateStatus = "draft" | "published" | "archived";

export interface EmailTemplate {
  id: string;
  orgId: string;
  name: string;
  category: TemplateCategory;
  status: TemplateStatus;
  components: ComponentBlock[];
  htmlBody: string;
  preheaderText?: string;
  subject?: string;
  thumbnailUrl?: string | null;
  useCount: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

export interface TemplateListItem {
  id: string;
  name: string;
  category: TemplateCategory;
  status: TemplateStatus;
  useCount: number;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl?: string | null;
}

export interface ListTemplatesResponse {
  success: boolean;
  templates: TemplateListItem[];
  total: number;
  counts: { all: number; draft: number; published: number };
}

export interface TemplateResponse {
  success: boolean;
  template: EmailTemplate;
}

export interface AssetUploadResponse {
  success: boolean;
  url: string;
  width: number | null;
  height: number | null;
}

export interface RenderPreviewResponse {
  success: boolean;
  htmlBody: string;
  preheaderText: string;
}

export interface SendTestResponse {
  success: boolean;
  messageId: string;
}

export interface RecordUseResponse {
  success: boolean;
  useCount: number;
}

export interface MergeTag {
  key: string;
  label: string;
}

/** Same host as Deals CRM — see `lib/api-config.ts` (`https://uatapi.garage.app/api`) */
const BASE = "network-mail";

/** Org id for query params — same source as Deals CRM (`jwtDecode(garage_tok).orgId`). */
export function getNetworkMailOrgId(): string | null {
  if (typeof window === "undefined") return null;
  const fromToken = getUserData()?.orgId;
  if (fromToken) return fromToken;
  return localStorage.getItem("garage_org_id");
}

function withOrg(path: string, orgId: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}orgId=${encodeURIComponent(orgId)}`;
}

/** Same auth + fetch path as Deals CRM (`authenticatedFetch` + `buildExternalUrl`). */
async function networkMailApi<T>(
  endpoint: string,
  opts: RequestInit = {},
): Promise<T> {
  const response = await authenticatedFetch(buildExternalUrl(endpoint), opts);
  return handleApiResponse<T>(response);
}

export async function listTemplates(params: {
  orgId: string;
  category?: TemplateCategory;
  status?: string;
  search?: string;
  sort?: "newest" | "most-used";
  limit?: number;
  offset?: number;
}): Promise<ListTemplatesResponse> {
  const q = new URLSearchParams({ orgId: params.orgId });
  if (params.category) q.set("category", params.category);
  if (params.status) q.set("status", params.status);
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.sort) q.set("sort", params.sort);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  return networkMailApi<ListTemplatesResponse>(`${BASE}/templates?${q.toString()}`);
}

export async function getTemplate(
  orgId: string,
  templateId: string,
): Promise<EmailTemplate> {
  const res = await networkMailApi<EmailTemplate | TemplateResponse>(
    withOrg(`${BASE}/templates/${encodeURIComponent(templateId)}`, orgId),
  );
  return "template" in res && res.template ? res.template : (res as EmailTemplate);
}

export async function createTemplate(
  orgId: string,
  body: {
    name: string;
    category: TemplateCategory;
    components?: ComponentBlock[];
    subject?: string;
    presetId?: EmailTemplatePresetId | null;
    status?: TemplateStatus;
  },
): Promise<EmailTemplate> {
  const res = await networkMailApi<EmailTemplate | TemplateResponse>(
    withOrg(`${BASE}/templates`, orgId),
    {
      method: "POST",
      body: JSON.stringify({
        status: "draft",
        components: [],
        subject: "",
        presetId: null,
        ...body,
      }),
    },
  );
  return "template" in res && res.template ? res.template : (res as EmailTemplate);
}

/** Single source of truth lives with the builders (see the import at the top of
 *  this file) — re-exported so callers don't need to reach into the component tree. */
export type { EmailTemplatePresetId };

export type TemplateWriteBody = Partial<{
  name: string;
  category: TemplateCategory;
  components: ComponentBlock[];
  subject: string;
  preheaderText: string;
  htmlBody: string;
}>;

export async function updateTemplate(
  orgId: string,
  templateId: string,
  body: TemplateWriteBody,
): Promise<EmailTemplate> {
  const res = await networkMailApi<TemplateResponse | EmailTemplate>(
    withOrg(`${BASE}/templates/${encodeURIComponent(templateId)}`, orgId),
    { method: "PATCH", body: JSON.stringify(body) },
  );
  return "template" in res && res.template ? res.template : (res as EmailTemplate);
}

export async function publishTemplate(
  orgId: string,
  templateId: string,
  body?: TemplateWriteBody,
): Promise<EmailTemplate> {
  const res = await networkMailApi<EmailTemplate | TemplateResponse>(
    withOrg(`${BASE}/templates/${encodeURIComponent(templateId)}/publish`, orgId),
    {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    },
  );
  return "template" in res && res.template ? res.template : (res as EmailTemplate);
}

export async function duplicateTemplate(
  orgId: string,
  templateId: string,
  name?: string,
): Promise<EmailTemplate> {
  const res = await networkMailApi<EmailTemplate | TemplateResponse>(
    withOrg(`${BASE}/templates/${encodeURIComponent(templateId)}/duplicate`, orgId),
    {
      method: "POST",
      body: JSON.stringify(name ? { name } : {}),
    },
  );
  return "template" in res && res.template ? res.template : (res as EmailTemplate);
}

export async function deleteTemplate(
  orgId: string,
  templateId: string,
): Promise<void> {
  await networkMailApi<{ success: boolean }>(
    withOrg(`${BASE}/templates/${encodeURIComponent(templateId)}`, orgId),
    { method: "DELETE" },
  );
}

export async function uploadTemplateAsset(
  orgId: string,
  file: File,
  opts?: { templateId?: string; purpose?: "logo" | "image" | "social-icon" },
): Promise<AssetUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  if (opts?.templateId) form.append("templateId", opts.templateId);
  if (opts?.purpose) form.append("purpose", opts.purpose);
  return networkMailApi<AssetUploadResponse>(withOrg(`${BASE}/templates/assets`, orgId), {
    method: "POST",
    body: form,
  });
}

export async function syncTemplateHtmlBody(
  orgId: string,
  templateId: string,
): Promise<string | null> {
  const template = await getTemplate(orgId, templateId);
  if (!template.components?.length) {
    return template.htmlBody || null;
  }
  const htmlBody = buildTemplateHtmlBody(template.components, template.name);
  await updateTemplate(orgId, templateId, { htmlBody });
  return htmlBody;
}

export async function sendTemplateTestEmail(
  orgId: string,
  templateId: string,
  body: {
    to: string;
    subject?: string;
    mergeData?: Record<string, string>;
    htmlBody?: string;
  },
): Promise<SendTestResponse> {
  return networkMailApi<SendTestResponse>(
    withOrg(`${BASE}/templates/${encodeURIComponent(templateId)}/send-test`, orgId),
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function recordTemplateUse(
  orgId: string,
  templateId: string,
): Promise<RecordUseResponse> {
  return networkMailApi<RecordUseResponse>(
    withOrg(`${BASE}/templates/${encodeURIComponent(templateId)}/record-use`, orgId),
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function renderTemplatePreview(
  orgId: string,
  body: { components: ComponentBlock[]; title?: string },
): Promise<RenderPreviewResponse> {
  return networkMailApi<RenderPreviewResponse>(
    withOrg(`${BASE}/templates/render-preview`, orgId),
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function fetchMergeTags(orgId: string): Promise<MergeTag[]> {
  const res = await networkMailApi<{ success: boolean; tags: MergeTag[] }>(
    withOrg(`${BASE}/merge-tags`, orgId),
  );
  return res.tags;
}

export function formatTemplateListDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

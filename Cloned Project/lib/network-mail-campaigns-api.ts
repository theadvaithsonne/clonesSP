import { buildExternalUrl } from "@/lib/api-config";
import { getNetworkMailOrgId } from "@/lib/network-mail-api";
import type {
  CampaignData,
  RecipientsData,
  ScheduleData,
} from "@/components/dashboard/inlineApps/network-mail/campaign-create/types";
import { authenticatedFetch, handleApiResponse } from "@/utils/api";

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

export type RecipientSource = "csv" | "manual" | "leads";

export interface RecipientsPayload {
  source: RecipientSource;
  leadFilter?: {
    funnelId: string;
    funnelName?: string;
    stage?: string;
    tag?: string;
    leadStatus?: string;
    source?: string;
  };
  leadStats?: {
    total: number;
    withEmail: number;
    sample?: { name: string; email: string; status?: string }[];
  };
  csvFileId?: string;
  csvFileName?: string;
  csvMapping?: { email: string; firstName?: string; lastName?: string };
  csvStats?: { valid: number; duplicates: number; invalid: number };
  manualEmails?: string[];
  exclusions?: {
    excludeLists?: string[];
    excludeEmails?: string[];
    excludeUnsubscribed: boolean;
    excludeBounced: boolean;
    excludeSpam?: boolean;
  };
  recipientCount: number;
  netRecipientCount?: number;
  senderEmail?: string;
}

export interface SchedulePayload {
  type: "now" | "scheduled" | "timezone" | "drip";
  scheduledDate?: string;
  scheduledTime?: string;
  timezone?: string;
  recipientTime?: string;
  startDate?: string;
  fallbackTimezone?: string;
  batchSize?: number;
  frequency?: string;
  startDateTime?: string;
  throttling?: { enabled: boolean; maxPerMinute: number };
  retry?: { enabled: boolean; attempts: number; waitTime: string };
}

export interface EmailCampaign {
  id: string;
  orgId: string;
  campaignName: string;
  status: CampaignStatus;
  templateId: string;
  templateName?: string;
  recipients: RecipientsPayload;
  schedule: SchedulePayload;
  subjectLine: string;
  fromName: string;
  fromEmail: string;
  previewText?: string;
  recipientCount: number;
  netRecipientCount: number;
  deliveredCount: number;
  failedCount: number;
  sentAt: string | null;
  scheduledFor: string | null;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  analytics?: Record<string, unknown>;
  /** Set when preferred From domain was unverified and send used the default verified address. */
  senderNotice?: string;
  /** Address actually used by Resend when different from fromEmail. */
  actualFromEmail?: string;
}

export interface CampaignListItem {
  id: string;
  campaignName: string;
  templateId: string;
  templateName?: string;
  status: CampaignStatus;
  recipientCount: number;
  netRecipientCount: number;
  deliveredCount: number;
  failedCount: number;
  sentAt: string | null;
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListCampaignsResponse {
  success: boolean;
  campaigns: CampaignListItem[];
  total: number;
  counts: {
    all: number;
    draft: number;
    scheduled: number;
    sent: number;
    failed: number;
  };
}

export interface CampaignResponse {
  success: boolean;
  campaign: EmailCampaign;
}

export interface PreviewLeadsResponse {
  success: boolean;
  total: number;
  withEmail: number;
  netRecipientCount: number;
  duplicatesRemoved: number;
  excluded: {
    unsubscribed: number;
    bounced: number;
    spam: number;
    manual: number;
    duplicate: number;
    invalid: number;
  };
  sample: { name: string; email: string; status?: string }[];
}

export interface UploadCsvResponse {
  success: boolean;
  csvFileId: string;
  fileName: string;
  fileSize: number;
  mapping: { email: string; firstName?: string; lastName?: string };
  stats: { valid: number; duplicates: number; invalid: number };
  netRecipientCount: number;
}

export interface PreviewManualResponse {
  success: boolean;
  valid: string[];
  invalid: string[];
  duplicatesRemoved: number;
  netRecipientCount: number;
}

export interface LaunchCampaignResponse {
  success: boolean;
  campaign: {
    id: string;
    status: CampaignStatus;
    scheduledFor: string | null;
    netRecipientCount: number;
  };
  estimatedCompletionMinutes: number;
  /** Documented fallback: unverified preferred From → default verified sender. */
  senderFallbackPolicy?: {
    preferredFromEmail: string;
    defaultFromEmail: string;
    note: string;
  };
}

export interface ReportsSummaryResponse {
  success: boolean;
  period: string;
  stats: {
    emailsSent: number;
    openRate: number;
    clickRate: number;
    unsubscribes: number;
  };
  changes: {
    emailsSent: number;
    openRate: number;
    clickRate: number;
    unsubscribes: number;
  };
  chart: { date: string; sent: number; opens: number; clicks: number }[];
}

export interface NetworkMailSettings {
  senderIdentity: {
    defaultFromName: string;
    defaultFromEmail: string;
    verifiedEmails: string[];
  };
  domainAuthentication: {
    domain: string;
    spfVerified: boolean;
    dkimVerified: boolean;
    dmarcVerified: boolean;
  };
  unsubscribe: {
    enabled: boolean;
    customUrl: string | null;
  };
  /** Unverified preferred From → default verified sender (API documents this policy). */
  senderFallbackPolicy?: {
    defaultFromEmail: string;
    note: string;
  };
}

const BASE = "network-mail";

function withOrg(path: string, orgId: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}orgId=${encodeURIComponent(orgId)}`;
}

async function campaignsApi<T>(endpoint: string, opts: RequestInit = {}): Promise<T> {
  const response = await authenticatedFetch(buildExternalUrl(endpoint), opts);
  return handleApiResponse<T>(response);
}

export { getNetworkMailOrgId };

export async function listCampaigns(
  orgId: string,
  params?: {
    status?: CampaignStatus;
    search?: string;
    limit?: number;
    offset?: number;
    sort?: "newest" | "oldest";
  },
): Promise<ListCampaignsResponse> {
  const q = new URLSearchParams({ orgId });
  if (params?.status) q.set("status", params.status);
  if (params?.search?.trim()) q.set("search", params.search.trim());
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.offset != null) q.set("offset", String(params.offset));
  if (params?.sort) q.set("sort", params.sort);
  return campaignsApi<ListCampaignsResponse>(`${BASE}/campaigns?${q.toString()}`);
}

export async function getCampaign(
  orgId: string,
  campaignId: string,
): Promise<EmailCampaign> {
  const res = await campaignsApi<CampaignResponse>(
    withOrg(`${BASE}/campaigns/${encodeURIComponent(campaignId)}`, orgId),
  );
  return res.campaign;
}

export async function createCampaign(
  orgId: string,
  body: Partial<{
    campaignName: string;
    templateId: string;
    recipients: RecipientsPayload;
    schedule: SchedulePayload;
    subjectLine: string;
    fromName: string;
    fromEmail: string;
    previewText: string;
  }>,
): Promise<EmailCampaign> {
  const res = await campaignsApi<CampaignResponse>(withOrg(`${BASE}/campaigns`, orgId), {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.campaign;
}

export async function updateCampaign(
  orgId: string,
  campaignId: string,
  body: Partial<{
    campaignName: string;
    templateId: string;
    recipients: RecipientsPayload;
    schedule: SchedulePayload;
    subjectLine: string;
    fromName: string;
    fromEmail: string;
    previewText: string;
  }>,
): Promise<EmailCampaign> {
  const res = await campaignsApi<CampaignResponse>(
    withOrg(`${BASE}/campaigns/${encodeURIComponent(campaignId)}`, orgId),
    { method: "PATCH", body: JSON.stringify(body) },
  );
  return res.campaign;
}

export async function deleteCampaign(orgId: string, campaignId: string): Promise<void> {
  await campaignsApi<{ success: boolean }>(
    withOrg(`${BASE}/campaigns/${encodeURIComponent(campaignId)}`, orgId),
    { method: "DELETE" },
  );
}

export async function duplicateCampaign(
  orgId: string,
  campaignId: string,
  campaignName?: string,
): Promise<EmailCampaign> {
  const res = await campaignsApi<CampaignResponse>(
    withOrg(`${BASE}/campaigns/${encodeURIComponent(campaignId)}/duplicate`, orgId),
    {
      method: "POST",
      body: JSON.stringify(campaignName ? { campaignName } : {}),
    },
  );
  return res.campaign;
}

export async function previewLeadRecipients(
  orgId: string,
  body: {
    leadFilter: NonNullable<RecipientsPayload["leadFilter"]>;
    exclusions?: RecipientsPayload["exclusions"];
  },
): Promise<PreviewLeadsResponse> {
  return campaignsApi<PreviewLeadsResponse>(
    withOrg(`${BASE}/campaigns/recipients/preview-leads`, orgId),
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function uploadCsvRecipients(
  orgId: string,
  file: File,
  opts?: { emailColumn?: string; firstNameColumn?: string; lastNameColumn?: string },
): Promise<UploadCsvResponse> {
  const form = new FormData();
  form.append("file", file);
  if (opts?.emailColumn) form.append("emailColumn", opts.emailColumn);
  if (opts?.firstNameColumn) form.append("firstNameColumn", opts.firstNameColumn);
  if (opts?.lastNameColumn) form.append("lastNameColumn", opts.lastNameColumn);
  return campaignsApi<UploadCsvResponse>(
    withOrg(`${BASE}/campaigns/recipients/upload-csv`, orgId),
    { method: "POST", body: form },
  );
}

export async function previewManualRecipients(
  orgId: string,
  body: {
    emails: string[];
    exclusions?: RecipientsPayload["exclusions"];
  },
): Promise<PreviewManualResponse> {
  return campaignsApi<PreviewManualResponse>(
    withOrg(`${BASE}/campaigns/recipients/preview-manual`, orgId),
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function launchCampaign(
  orgId: string,
  campaignId: string,
  body?: {
    subjectLine?: string;
    fromName?: string;
    fromEmail?: string;
    previewText?: string;
  },
): Promise<LaunchCampaignResponse> {
  return campaignsApi<LaunchCampaignResponse>(
    withOrg(`${BASE}/campaigns/${encodeURIComponent(campaignId)}/launch`, orgId),
    { method: "POST", body: JSON.stringify(body ?? {}) },
  );
}

export async function cancelCampaign(
  orgId: string,
  campaignId: string,
): Promise<{ success: boolean; campaign: { id: string; status: CampaignStatus } }> {
  return campaignsApi(
    withOrg(`${BASE}/campaigns/${encodeURIComponent(campaignId)}/cancel`, orgId),
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function sendCampaignTestEmail(
  orgId: string,
  campaignId: string,
  body: { to: string; mergeData?: Record<string, string>; htmlBody?: string },
): Promise<{
  success: boolean;
  messageId: string;
  actualFromEmail?: string;
  senderNotice?: string;
}> {
  return campaignsApi(
    withOrg(`${BASE}/campaigns/${encodeURIComponent(campaignId)}/send-test`, orgId),
    { method: "POST", body: JSON.stringify(body) },
  );
}

export interface FailedRecipient {
  email: string;
  name: string | null;
  error: string | null;
  failedAt: string | null;
}

export async function getCampaignReport(
  orgId: string,
  campaignId: string,
): Promise<{
  success: boolean;
  campaignId: string;
  stats: Record<string, number>;
  openRate: number;
  clickRate: number;
  timeline: unknown[];
  failedRecipients?: FailedRecipient[];
}> {
  return campaignsApi(
    withOrg(`${BASE}/campaigns/${encodeURIComponent(campaignId)}/report`, orgId),
  );
}

/** Re-sends only the addresses the last run could not reach. */
export async function retryFailedRecipients(
  orgId: string,
  campaignId: string,
): Promise<{ success: boolean; retrying: number }> {
  return campaignsApi(
    withOrg(`${BASE}/campaigns/${encodeURIComponent(campaignId)}/retry-failed`, orgId),
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function getCampaignReportsSummary(
  orgId: string,
  period: "7d" | "30d" | "90d" = "30d",
): Promise<ReportsSummaryResponse> {
  const q = new URLSearchParams({ orgId, period });
  return campaignsApi<ReportsSummaryResponse>(
    `${BASE}/campaigns/reports/summary?${q.toString()}`,
  );
}

export async function getNetworkMailSettings(
  orgId: string,
): Promise<NetworkMailSettings> {
  const res = await campaignsApi<{ success: boolean; settings: NetworkMailSettings }>(
    withOrg(`${BASE}/settings`, orgId),
  );
  return res.settings;
}

export async function updateNetworkMailSettings(
  orgId: string,
  settings: Partial<NetworkMailSettings>,
): Promise<NetworkMailSettings> {
  const res = await campaignsApi<{ success: boolean; settings: NetworkMailSettings }>(
    withOrg(`${BASE}/settings`, orgId),
    { method: "PATCH", body: JSON.stringify(settings) },
  );
  return res.settings;
}

/** Map wizard state → API payload */
export function campaignDataToApiPayload(
  data: Partial<CampaignData>,
): Partial<{
  campaignName: string;
  templateId: string;
  recipients: RecipientsPayload;
  schedule: SchedulePayload;
  subjectLine: string;
  fromName: string;
  fromEmail: string;
  previewText: string;
}> {
  const payload: ReturnType<typeof campaignDataToApiPayload> = {};
  if (data.campaignName) payload.campaignName = data.campaignName;
  if (data.templateId) payload.templateId = data.templateId;
  if (data.recipients) {
    const r = data.recipients;
    payload.recipients = {
      source: r.source,
      leadFilter: r.leadFilter,
      leadStats: r.leadStats,
      csvFileId: r.csvFileId,
      csvFileName: r.csvFileName,
      csvMapping: r.csvMapping,
      csvStats: r.csvStats,
      manualEmails: r.manualEmails,
      exclusions: r.exclusions,
      recipientCount: r.recipientCount,
      netRecipientCount: r.netRecipientCount,
      senderEmail: r.senderEmail,
    };
  }
  if (data.schedule) payload.schedule = data.schedule as SchedulePayload;
  if (data.subjectLine !== undefined) payload.subjectLine = data.subjectLine;
  if (data.fromName !== undefined) payload.fromName = data.fromName;
  if (data.fromEmail !== undefined) payload.fromEmail = data.fromEmail;
  if (data.previewText !== undefined) payload.previewText = data.previewText;
  return payload;
}

/** Map API campaign → wizard state */
export function apiCampaignToCampaignData(campaign: EmailCampaign): CampaignData {
  return {
    templateId: campaign.templateId,
    templateName: campaign.templateName,
    campaignName: campaign.campaignName,
    recipients: {
      source: campaign.recipients.source,
      leadFilter: campaign.recipients.leadFilter,
      leadStats: campaign.recipients.leadStats,
      csvFileId: campaign.recipients.csvFileId,
      csvFileName: campaign.recipients.csvFileName,
      csvMapping: campaign.recipients.csvMapping,
      csvStats: campaign.recipients.csvStats,
      manualEmails: campaign.recipients.manualEmails,
      exclusions: campaign.recipients.exclusions,
      recipientCount: campaign.recipients.recipientCount,
      netRecipientCount: campaign.recipients.netRecipientCount,
      senderEmail: campaign.recipients.senderEmail,
    },
    schedule: campaign.schedule as ScheduleData,
    subjectLine: campaign.subjectLine,
    fromName: campaign.fromName,
    fromEmail: campaign.fromEmail,
    previewText: campaign.previewText,
    createdAt: campaign.createdAt,
    status: campaign.status,
  };
}

export function formatCampaignListDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function apiStatusToTableFilter(
  uiStatus: string,
): CampaignStatus | undefined {
  switch (uiStatus) {
    case "Delivered":
      return "sent";
    case "Scheduled":
      return "scheduled";
    case "Draft":
      return "draft";
    case "Sending":
      return "sending";
    case "Failed":
      return "failed";
    default:
      return undefined;
  }
}

export function apiStatusToDisplayStatus(status: CampaignStatus): string {
  switch (status) {
    case "sent":
      return "Delivered";
    case "scheduled":
      return "Scheduled";
    case "draft":
      return "Draft";
    case "sending":
      return "Sending";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

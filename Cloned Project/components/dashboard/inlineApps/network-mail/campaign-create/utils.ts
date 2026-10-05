import type { CampaignData, ChecklistItem } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmails(input: string): { valid: string[]; invalid: string[] } {
  const parts = input
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const lower = p.toLowerCase();
    if (!EMAIL_RE.test(p)) {
      invalid.push(p);
      continue;
    }
    if (seen.has(lower)) continue;
    seen.add(lower);
    valid.push(p);
  }
  return { valid, invalid };
}

export function estimateSendMinutes(recipientCount: number): number {
  return Math.max(1, Math.ceil(recipientCount / 500));
}

export function hasUnsubscribeLink(data: Partial<CampaignData>): boolean {
  if (data.templateId === "__blank__") return false;
  return true;
}

export function hasPhysicalAddress(data: Partial<CampaignData>): boolean {
  if (data.templateId === "__blank__") return false;
  return true;
}

export type ReviewFieldKey =
  | "campaignName"
  | "templateId"
  | "recipients"
  | "schedule"
  | "subjectLine"
  | "fromEmail";

export type TemplatePublishStatus = "draft" | "published" | "archived";

export interface CampaignReviewOptions {
  /** Resolved from getTemplate on review. */
  templateStatus?: TemplatePublishStatus | null;
  /** False until getTemplate settles for a real template id. */
  templateStatusLoaded?: boolean;
}

const TEMPLATE_PUBLISH_ERROR =
  "Template needs to be published for running Campaign";

function hasRealTemplate(data: Partial<CampaignData>): boolean {
  return Boolean(data.templateId) && data.templateId !== "__blank__";
}

function templateNeedsPublish(
  data: Partial<CampaignData>,
  opts?: CampaignReviewOptions
): boolean {
  if (!hasRealTemplate(data) || !opts?.templateStatusLoaded) return false;
  return opts.templateStatus !== "published";
}

/** Field-level errors for step 4 review UI (maps to checklist blocking items). */
export function getReviewFieldErrors(
  data: Partial<CampaignData>,
  opts?: CampaignReviewOptions
): Partial<Record<ReviewFieldKey, string>> {
  const net = data.recipients?.netRecipientCount ?? data.recipients?.recipientCount ?? 0;
  const errors: Partial<Record<ReviewFieldKey, string>> = {};

  if (!data.campaignName?.trim()) errors.campaignName = "Campaign name is required";
  if (!data.templateId) errors.templateId = "Select a template";
  else if (templateNeedsPublish(data, opts)) {
    errors.templateId = TEMPLATE_PUBLISH_ERROR;
  }
  if (net <= 0) errors.recipients = "Add at least one recipient";
  if (!data.schedule?.type) errors.schedule = "Configure a send schedule";
  if (!data.subjectLine?.trim()) errors.subjectLine = "Subject line is required";
  if (!data.fromEmail?.trim()) errors.fromEmail = "From email is required";

  return errors;
}

export function validateCampaign(
  data: Partial<CampaignData>,
  opts?: CampaignReviewOptions
): ChecklistItem[] {
  const count = data.recipients?.recipientCount ?? 0;
  const net = data.recipients?.netRecipientCount ?? count;
  const unpublished = templateNeedsPublish(data, opts);
  const templatePending =
    hasRealTemplate(data) && opts?.templateStatusLoaded === false;
  const templateOk =
    Boolean(data.templateId) && !unpublished && !templatePending;
  return [
    {
      id: "name",
      label: "Campaign name is set",
      status: data.campaignName?.trim() ? "complete" : "error",
      blocking: true,
    },
    {
      id: "template",
      label: unpublished
        ? TEMPLATE_PUBLISH_ERROR
        : templatePending
          ? "Checking template status…"
          : "Template selected",
      status: templateOk ? "complete" : "error",
      blocking: true,
      message: unpublished
        ? "Publish the template before launching this campaign"
        : undefined,
    },
    {
      id: "recipients",
      label: `Recipients selected (${net.toLocaleString()} contacts)`,
      status: net > 0 ? "complete" : "error",
      blocking: true,
    },
    {
      id: "schedule",
      label: "Schedule configured",
      status: data.schedule?.type ? "complete" : "error",
      blocking: true,
    },
    {
      id: "subject",
      label: "Subject line set",
      status: data.subjectLine?.trim() ? "complete" : "error",
      blocking: true,
    },
    {
      id: "from",
      label: "From address set",
      status: data.fromEmail?.trim() ? "complete" : "error",
      blocking: true,
    },
    {
      id: "test",
      label: "Test email sent",
      status: data.testSent ? "complete" : "warning",
      blocking: false,
      message: "Recommended before launching",
    },
    {
      id: "unsubscribe",
      label: "Unsubscribe link included",
      status: hasUnsubscribeLink(data) ? "complete" : "error",
      blocking: true,
      message: "Required by CAN-SPAM law",
    },
    {
      id: "address",
      label: "Physical address in footer",
      status: hasPhysicalAddress(data) ? "complete" : "error",
      blocking: true,
      message: "Required for compliance",
    },
  ];
}

export function getScheduleDescription(data: Partial<CampaignData>): string {
  const s = data.schedule;
  if (!s) return "Not set";
  switch (s.type) {
    case "now":
      return "Send immediately";
    case "scheduled":
      return `Scheduled: ${s.scheduledDate ?? ""} at ${s.scheduledTime ?? ""} ${s.timezone ?? ""}`;
    case "timezone":
      return `Recipient local time: ${s.recipientTime ?? ""} from ${s.startDate ?? ""}`;
    case "drip":
      return `Batches of ${s.batchSize ?? 500} — ${s.frequency ?? ""}`;
    default:
      return "Not set";
  }
}

export function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function formatDisplayDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDisplayDateTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

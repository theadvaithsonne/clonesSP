export type RecipientSource = "csv" | "manual" | "leads";

export interface CrmLeadFilterSelection {
  funnelId: string;
  funnelName?: string;
  stage?: string;
  /** Single tag filter; empty = all tags */
  tag?: string;
  /** leadStatus query value; empty = all statuses */
  leadStatus?: string;
  /** Lead source; empty = all sources */
  source?: string;
}

export type ScheduleType = "now" | "scheduled" | "timezone" | "drip";

export interface RecipientsData {
  source: RecipientSource;
  selectedLists?: string[];
  selectedSegments?: string[];
  csvFileId?: string;
  csvFileName?: string;
  csvFileSize?: number;
  csvMapping?: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
  csvStats?: { valid: number; duplicates: number; invalid: number };
  manualEmails?: string[];
  leadFilter?: CrmLeadFilterSelection;
  leadStats?: {
    total: number;
    withEmail: number;
    sample?: { name: string; email: string; status?: string }[];
  };
  exclusions?: {
    excludeLists?: string[];
    excludeEmails?: string[];
    excludeUnsubscribed: boolean;
    excludeBounced: boolean;
    excludeSpam?: boolean;
  };
  recipientCount: number;
  netRecipientCount?: number;
  /** Overrides org default sender when set */
  senderEmail?: string;
}

export interface ScheduleData {
  type: ScheduleType;
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

export interface CampaignData {
  templateId: string;
  templateName?: string;
  campaignName: string;
  recipients: RecipientsData;
  schedule: ScheduleData;
  subjectLine?: string;
  fromName?: string;
  fromEmail?: string;
  previewText?: string;
  testSent?: boolean;
  testSentTo?: string[];
  createdAt?: string;
  status?: "draft" | "scheduled" | "sending" | "sent" | "failed" | "cancelled";
  /** Server campaign id after first save */
  campaignId?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  status: "complete" | "warning" | "error";
  blocking: boolean;
  message?: string;
}

export interface CampaignTemplateItem {
  id: string;
  name: string;
  category: string;
  createdDate: string;
  uses: number;
  thumbnailUrl?: string | null;
}

export const CAMPAIGN_ACCENT = "#f5c518";

export const CAMPAIGN_STEPS = [
  { id: 1, label: "Template" },
  { id: 2, label: "Recipients" },
  { id: 3, label: "Schedule" },
  { id: 4, label: "Review" },
] as const;

export const TEMPLATE_CATEGORIES = [
  "All",
  "Marketing",
  "General",
  "Promotional",
  "Transactional",
] as const;

export const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  General: { bg: "bg-[#2a2a35]", text: "text-[#c0c0cc]" },
  Marketing: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  Promotional: { bg: "bg-blue-500/15", text: "text-blue-400" },
  Transactional: { bg: "bg-amber-500/15", text: "text-amber-400" },
};

export const MOCK_LISTS = [
  { id: "1", name: "All Subscribers", count: 2453 },
  { id: "2", name: "Newsletter Subscribers", count: 1892 },
  { id: "3", name: "Premium Members", count: 234 },
  { id: "4", name: "Trial Users", count: 327 },
  { id: "5", name: "Active Customers", count: 456 },
  { id: "6", name: "Inactive (90+ days)", count: 189 },
];

export const MOCK_SEGMENTS = [
  { id: "1", name: "Active Users (Last 30 days)", count: 892 },
  { id: "2", name: "Engaged Subscribers", count: 654 },
  { id: "3", name: "Cart Abandoners", count: 123 },
  { id: "4", name: "VIP Customers", count: 89 },
  { id: "5", name: "Trial Ending Soon", count: 234 },
];

export const MOCK_SEGMENT_PREVIEW = [
  { name: "John Smith", email: "john@example.com" },
  { name: "Sarah Johnson", email: "sarah@example.com" },
  { name: "Mike Chen", email: "mike@example.com" },
];

export const MOCK_EXCLUDE_LISTS = [
  { id: "1", name: "Unsubscribed", count: 432 },
  { id: "2", name: "Bounced Emails", count: 89 },
  { id: "3", name: "Spam Complaints", count: 12 },
  { id: "4", name: "Internal Team", count: 25 },
];

export const TIMEZONES = ["EST", "PST", "CST", "MST", "UTC", "GMT", "IST"];

export const DRIP_FREQUENCIES = [
  "Every 1 hour",
  "Every 2 hours",
  "Every 6 hours",
  "Every 12 hours",
  "Every 24 hours",
];

export const RETRY_WAIT_OPTIONS = ["5 min", "15 min", "1 hour"];

export const DRAFT_STORAGE_KEY = "network-mail-campaign-draft";

export const BLANK_TEMPLATE_ID = "__blank__";

export const CRM_LEAD_STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "archived", label: "Archived" },
] as const;

export const CRM_LEAD_SOURCE_FILTER_OPTIONS = [
  "",
  "Website",
  "Referral",
  "Cold Call",
  "LinkedIn",
  "Event",
  "Email Campaign",
  "Facebook Lead Ads",
  "Google Ads",
  "WhatsApp",
] as const;

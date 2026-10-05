export type CmsPageStatus = "draft" | "published" | "archived";

export type CmsModuleType =
  | "section"
  | "two_column"
  | "three_column"
  | "columns"
  | "hero"
  | "container"
  | "heading"
  | "text"
  | "image"
  | "button"
  | "divider"
  | "spacer"
  | "logo"
  | "social_icons"
  | "footer"
  | "lead_form";

export type CmsColumnData = {
  id: string;
  width: number;
  modules: CmsModule[];
};

export type CmsModule = {
  id: string;
  type: CmsModuleType;
  props: Record<string, any>;
  children?: CmsModule[];
};

export type CmsPageContent = {
  modules: CmsModule[];
};

export type CmsFormFieldType =
  | "text"
  | "email"
  | "phone"
  | "dropdown"
  | "checkbox"
  | "radio"
  | "textarea"
  | "file"
  | "date"
  | "number";

export type CmsFormField = {
  id: string;
  type: CmsFormFieldType;
  key: string;
  label: string;
  placeholder?: string;
  required: boolean;
  order: number;
  options?: string[];
  helpText?: string;
  maxLength?: number;
};

export type CmsForm = {
  id: string;
  pageId: string;
  title: string;
  submitButtonText: string;
  successMessage: string;
  redirectUrl?: string;
  recaptchaEnabled?: boolean;
  fields: CmsFormField[];
  validation?: {
    emailFormat?: boolean;
    phoneFormat?: boolean;
    preventDuplicates?: boolean;
    rateLimitPerHour?: number;
  };
};

export type CmsPage = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  status: CmsPageStatus;
  content: CmsPageContent;
  metaTitle?: string;
  metaDescription?: string;
  ogImageUrl?: string;
  faviconUrl?: string;
  domainId?: string | null;
  formId?: string;
  crmPipelineId?: string;
  crmSyncEnabled?: boolean;
  pageViews?: number;
  leadCount?: number;
  conversionRate?: number;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
};

export type CmsFunnelRuleCondition = {
  fieldKey: string;
  field_id?: string;
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "starts_with"
    | "greater_than"
    | "less_than"
    | "in_list";
  value: string | string[];
  logic?: "AND" | "OR";
};

export type CmsFunnelRule = {
  id: string;
  pageId: string;
  formId?: string;
  name: string;
  conditions: CmsFunnelRuleCondition[];
  funnelId: string;
  isDefault?: boolean;
  priority: number;
  isActive: boolean;
};

export type CmsDomain = {
  id: string;
  hostname: string;
  status: "pending" | "verifying" | "verified" | "failed";
  cnameTarget: string;
  sslStatus: "pending" | "provisioned" | "failed";
  verifiedAt?: string | null;
  lastVerifyMessage?: string;
};

export type CmsPipeline = {
  id: string;
  name: string;
  stages?: any[];
};

export type DevicePreview = "desktop" | "tablet" | "mobile";

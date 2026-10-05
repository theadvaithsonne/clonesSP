// Coverfi type definitions. Extended phase-by-phase.

export interface CoverfiHealth {
  ok: boolean;
  orgId: string;
  brokerageId: string;
  phase: number;
}

export interface Brokerage {
  _id: string;
  orgId: string;
  brokerageId?: string;
  name: string;
  slug?: string;

  // Profile
  legal_name?: string;
  address?: string;
  country?: string;
  state?: string;
  pincode?: number;
  business_email?: string;
  phoneCode?: string;
  business_phone?: string;
  business_website?: string;
  business_description?: string;

  // Branding
  tag_line?: string;
  business_logo?: string;
  business_icon?: string;
  primary_color?: string;
  secondary_color?: string;

  // Landing page
  heading?: string;
  bullet_points?: string[];
  cover_pic?: string;
  landing_published?: boolean;
  landing_published_at?: string;

  createdAt: string;
  updatedAt: string;
}

export interface BrokerageLocation {
  _id: string;
  brokerageId: string;
  orgId: string;
  location_name: string;
  address: string;
  country: string;
  state: string;
  pincode: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Stakeholder = Garage user who is a member of the brokerage org with
 * `role: "stakeholder"`. Stakeholders are managed via Garage's invite flow;
 * Coverfi only displays them and lets the founder assign Coverfi-specific
 * attributes (role label + branch).
 */
export interface Stakeholder {
  _id: string;
  email: string;
  name?: string;
  profilePicture?: string;
  fullAccess: boolean;
  joinedAt?: string;
  assignment: {
    role_id?: string;
    branch_id?: string;
  } | null;
}

/** Coverfi role label (NOT a Garage permission role). */
export interface CoverfiRole {
  _id: string;
  brokerageId: string;
  orgId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InsuranceCompany {
  _id: string;
  brokerageId: string;
  orgId: string;
  name: string;
  description?: string;
  website?: string;
  country?: string;
  product_type: string[];
  logo?: string;
  icon?: string;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategory {
  _id: string;
  brokerageId: string;
  orgId: string;
  category_name: string;
  category_description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FilterType {
  _id: string;
  brokerageId: string;
  orgId: string;
  filter_type_name: string;
  filter_type_description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FilterItem {
  _id: string;
  brokerageId: string;
  orgId: string;
  filter_type_id: string;
  filter_item_name: string;
  filter_item_description?: string;
  createdAt: string;
  updatedAt: string;
}

export const BILLING_TYPES = ["Fixed Pricing", "Variable Pricing"] as const;
export const PAYMENT_FREQUENCIES = ["Monthly", "Quarterly", "Annually"] as const;
export const WAIVER_TYPES = [
  "On Selection",
  "On Submission",
  "No Waiver",
] as const;
export type BillingType = (typeof BILLING_TYPES)[number];
export type PaymentFrequency = (typeof PAYMENT_FREQUENCIES)[number];
export type WaiverType = (typeof WAIVER_TYPES)[number];

export interface Product {
  _id: string;
  brokerageId: string;
  orgId: string;
  name?: string;
  description?: string;
  type?: string;
  category?: string;
  insurance_provider?: string;
  filters: string[];
  logo?: string;
  product_document?: string;
  billing_type?: BillingType;
  payment_frequency?: PaymentFrequency;
  waiver_type?: WaiverType;
  waiver_text?: string;
  waiver_terms: string[];
  coverage_type?: string;
  coverage: string[];
  step_completed: number;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyEnrolledProduct {
  productId: string;
  enrolled_at: string;
  notes?: string;
}

export interface Company {
  _id: string;
  brokerageId: string;
  orgId: string;
  legal_name?: string;
  display_name?: string;
  industry?: string;
  poc?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone_number?: string;
    phoneCode?: string;
  };
  company_logo?: string;
  street_number?: string;
  street_name?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: number;
  enrolled_products: CompanyEnrolledProduct[];
  step_completed: number;
  is_active: boolean;
  employee_count?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyEmployee {
  _id: string;
  brokerageId: string;
  orgId: string;
  companyId: string;
  employee_id?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone_number?: string;
  phoneCode?: string;
  designation?: string;
  department?: string;
  date_of_birth?: string;
  date_of_joining?: string;
  enrolled_products: Array<{ productId?: string; enrolled_at: string }>;
  dependents: Array<{ name?: string; relation?: string; dob?: string }>;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const SENDER_VERIFICATION_STATUSES = [
  "unverified",
  "pending",
  "verified",
  "failed",
] as const;
export type SenderVerificationStatus =
  (typeof SENDER_VERIFICATION_STATUSES)[number];

export interface EmailSender {
  _id: string;
  brokerageId: string;
  orgId: string;
  nickname: string;
  from_name: string;
  from_email: string;
  reply_to?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
  };
  verification_status: SenderVerificationStatus;
  provider: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  _id: string;
  brokerageId: string;
  orgId: string;
  trigger_event_name: string;
  email_subject: string;
  email_content: string;
  variables: string[];
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Common preset trigger events seeded in the template editor. */
export const TEMPLATE_TRIGGER_PRESETS = [
  "welcome",
  "policy_created",
  "policy_renewal_reminder",
  "claim_filed",
  "claim_settled",
  "quote_ready",
] as const;

export interface OfficeLocation {
  _id: string;
  brokerageId: string;
  orgId: string;
  location_name: string;
  full_address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: number;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PolicySettingsDoc {
  _id: string;
  brokerageId: string;
  orgId: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/* ---------------- Corporate (Phase 8 + 9) ---------------- */

export interface CorporatePoc {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  phoneCode?: string;
  designation?: string;
}

export interface Corporate {
  _id: string;
  orgId: string;
  brokerageId: string;
  corporate_code?: string;
  legal_name: string;
  display_name?: string;
  industry?: string;
  logo?: string;
  admin_email: string;
  admin_first_name?: string;
  admin_last_name?: string;
  admin_phone?: string;
  admin_phone_code?: string;
  poc: CorporatePoc[];
  street_number?: string;
  street_name?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: number;
  status: "active" | "inactive";
  is_active: boolean;
  step_completed: number;
  // joined on detail
  employee_count?: number;
  dependent_count?: number;
  active_policy_count?: number;
  createdAt: string;
  updatedAt: string;
}

export type CorporateEmployeeStatus = "invited" | "active" | "suspended";

export interface CorporateEmployee {
  _id: string;
  orgId: string;
  brokerageId: string;
  corporateId: string;
  userId: string;
  employee_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  phoneCode?: string;
  designation?: string;
  department?: string;
  date_of_birth?: string;
  date_of_joining?: string;
  gender?: string;
  is_admin: boolean;
  status: CorporateEmployeeStatus;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEPENDENT_RELATIONS = [
  "spouse",
  "child",
  "parent",
  "sibling",
  "other",
] as const;
export type DependentRelation = (typeof DEPENDENT_RELATIONS)[number];

export interface CorporateDependent {
  _id: string;
  orgId: string;
  brokerageId: string;
  corporateId: string;
  employeeId: string;
  first_name: string;
  last_name?: string;
  relation: DependentRelation;
  date_of_birth?: string;
  gender?: string;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const PRODUCT_MAPPING_STATUS = [
  "active",
  "expired",
  "cancelled",
] as const;
export type ProductMappingStatus = (typeof PRODUCT_MAPPING_STATUS)[number];

export interface CorporateProductMapping {
  _id: string;
  orgId: string;
  brokerageId: string;
  corporateId: string;
  productId: string;
  covers_all_employees: boolean;
  employeeIds: string[];
  dependents_covered: boolean;
  policy_number?: string;
  policy_start_date?: string;
  policy_end_date?: string;
  status: ProductMappingStatus;
  notes?: string;
  enrolled_at: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResult<T> {
  success: boolean;
  data: T;
}

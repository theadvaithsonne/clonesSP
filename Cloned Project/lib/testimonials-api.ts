// Testimonials API Client - Connects to our roam-backend /testimonials endpoints

import { getToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ============= Types =============

export interface GalleryImage {
  url: string;
  caption?: string;
  alt?: string;
}

export interface ContentBlock {
  _id: string;
  order: number;
  type: "text" | "image" | "video" | "youtube" | "gallery" | "quote";

  // Text block
  content?: string; // Rich HTML content

  // Image block
  imageUrl?: string;
  imageCaption?: string;
  imageAlt?: string;

  // Video block (uploaded)
  videoUrl?: string;
  videoThumbnail?: string;

  // YouTube embed
  youtubeUrl?: string;
  youtubeId?: string;

  // Gallery block (multiple images)
  galleryImages?: GalleryImage[];

  // Quote block
  quoteText?: string;
  quoteAuthor?: string;
  quoteRole?: string;
}

export interface Metric {
  label: string;
  value: string;
  description?: string;
}

export interface Testimonial {
  _id: string;

  // Ownership
  organizationId: string;
  createdBy: string;

  // Client Info
  clientName: string;
  clientLogo?: string;
  clientWebsite?: string;
  clientIndustry?: string;

  // Testimonial Identity
  title: string;
  slug: string;
  shortDescription: string;

  // Visual
  coverImage?: string;
  featuredImage?: string;

  // Categories/Tags
  categories: string[];
  tags: string[];

  // Rich Content
  contentBlocks: ContentBlock[];

  // Client Quote (primary)
  primaryQuote?: string;
  primaryQuoteAuthor?: string;
  primaryQuoteAuthorRole?: string;
  primaryQuoteAuthorImage?: string;

  // Metrics
  metrics: Metric[];

  // Live artifact
  artifactUrl?: string;
  artifactLabel?: string;

  // Display options
  isFeatured: boolean;
  displayOrder: number;

  // Status
  status: "draft" | "published" | "archived";
  isPublic: boolean;

  // SEO
  metaTitle?: string;
  metaDescription?: string;

  // Timestamps
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// For list views (lighter version)
export interface TestimonialListItem {
  _id: string;
  clientName: string;
  clientLogo?: string;
  clientIndustry?: string;
  title: string;
  slug: string;
  shortDescription: string;
  coverImage?: string;
  categories: string[];
  tags: string[];
  primaryQuote?: string;
  primaryQuoteAuthor?: string;
  primaryQuoteAuthorRole?: string;
  isFeatured: boolean;
  displayOrder: number;
  status: "draft" | "published" | "archived";
  publishedAt?: string;
  createdAt: string;
}

export interface OrganizationInfo {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  coverPhoto?: string;
  description?: string;
  headingText?: string;
  subHeadingText?: string;
}

export interface FounderInfo {
  _id: string;
  name: string;
  profilePicture?: string;
  country?: string;
  state?: string;
  city?: string;
}

// ============= API Response Types =============

export interface TestimonialsListResponse {
  success: boolean;
  testimonials: TestimonialListItem[];
  categories: string[];
  total: number;
  page: number;
  totalPages: number;
  isFounder?: boolean;
}

export interface TestimonialDetailResponse {
  success: boolean;
  testimonial: Testimonial;
  isFounder?: boolean;
}

export interface PublicTestimonialsListResponse {
  success: boolean;
  testimonials: TestimonialListItem[];
  categories: string[];
  total: number;
  page: number;
  totalPages: number;
  organization: OrganizationInfo;
  founders: FounderInfo[];
}

export interface PublicTestimonialDetailResponse {
  success: boolean;
  testimonial: Testimonial;
  organization: OrganizationInfo;
  founders: FounderInfo[];
  relatedTestimonials: TestimonialListItem[];
}

// ============= Create/Update Types =============

export interface CreateTestimonialData {
  clientName: string;
  clientLogo?: string;
  clientWebsite?: string;
  clientIndustry?: string;
  title: string;
  slug?: string;
  shortDescription: string;
  coverImage?: string;
  featuredImage?: string;
  categories?: string[];
  tags?: string[];
  contentBlocks?: Omit<ContentBlock, "_id">[];
  primaryQuote?: string;
  primaryQuoteAuthor?: string;
  primaryQuoteAuthorRole?: string;
  primaryQuoteAuthorImage?: string;
  metrics?: Metric[];
  artifactUrl?: string;
  artifactLabel?: string;
  isFeatured?: boolean;
  status?: "draft" | "published" | "archived";
  isPublic?: boolean;
  metaTitle?: string;
  metaDescription?: string;
}

export interface UpdateTestimonialData extends Partial<CreateTestimonialData> {}

export interface CreateContentBlockData {
  type: "text" | "image" | "video" | "youtube" | "gallery" | "quote";
  content?: string;
  imageUrl?: string;
  imageCaption?: string;
  imageAlt?: string;
  videoUrl?: string;
  videoThumbnail?: string;
  youtubeUrl?: string;
  youtubeId?: string;
  galleryImages?: GalleryImage[];
  quoteText?: string;
  quoteAuthor?: string;
  quoteRole?: string;
}

// ============= Helper =============

function getOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("garage_org_id");
}

async function fetchFromBackend<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(
      error.error || error.details || `API Error: ${response.status}`
    );
  }

  return response.json();
}

// ============= Authenticated Testimonial APIs =============

/**
 * Get all testimonials for the current organization
 * Founders see all (including drafts), others see only published
 */
export async function getTestimonials(options?: {
  status?: "draft" | "published" | "archived";
  category?: string;
  tag?: string;
  search?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
}): Promise<TestimonialsListResponse> {
  const orgId = getOrgId();
  const params = new URLSearchParams();

  if (orgId) params.append("orgId", orgId);
  if (options?.status) params.append("status", options.status);
  if (options?.category) params.append("category", options.category);
  if (options?.tag) params.append("tag", options.tag);
  if (options?.search) params.append("search", options.search);
  if (options?.featured) params.append("featured", "true");
  if (options?.page) params.append("page", options.page.toString());
  if (options?.limit) params.append("limit", options.limit.toString());

  return fetchFromBackend(`/testimonials?${params.toString()}`);
}

/**
 * Get a single testimonial by ID or slug
 */
export async function getTestimonial(
  testimonialId: string
): Promise<TestimonialDetailResponse> {
  const orgId = getOrgId();
  const params = new URLSearchParams();
  if (orgId) params.append("orgId", orgId);

  return fetchFromBackend(`/testimonials/${testimonialId}?${params.toString()}`);
}

/**
 * Create a new testimonial (founders only)
 */
export async function createTestimonial(
  data: CreateTestimonialData
): Promise<{ success: boolean; testimonial: Testimonial }> {
  const orgId = getOrgId();
  const params = new URLSearchParams();
  if (orgId) params.append("orgId", orgId);

  return fetchFromBackend(`/testimonials?${params.toString()}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update a testimonial (founders only)
 */
export async function updateTestimonial(
  testimonialId: string,
  data: UpdateTestimonialData
): Promise<{ success: boolean; testimonial: Testimonial }> {
  const orgId = getOrgId();
  const params = new URLSearchParams();
  if (orgId) params.append("orgId", orgId);

  return fetchFromBackend(`/testimonials/${testimonialId}?${params.toString()}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Delete a testimonial (founders only)
 */
export async function deleteTestimonial(
  testimonialId: string
): Promise<{ success: boolean }> {
  const orgId = getOrgId();
  const params = new URLSearchParams();
  if (orgId) params.append("orgId", orgId);

  return fetchFromBackend(`/testimonials/${testimonialId}?${params.toString()}`, {
    method: "DELETE",
  });
}

/**
 * Publish a testimonial (founders only)
 */
export async function publishTestimonial(
  testimonialId: string
): Promise<{ success: boolean; testimonial: Testimonial }> {
  const orgId = getOrgId();
  const params = new URLSearchParams();
  if (orgId) params.append("orgId", orgId);

  return fetchFromBackend(
    `/testimonials/${testimonialId}/publish?${params.toString()}`,
    {
      method: "POST",
    }
  );
}

// ============= Content Block APIs =============

/**
 * Add a content block to a testimonial
 */
export async function addContentBlock(
  testimonialId: string,
  data: CreateContentBlockData
): Promise<{ success: boolean; testimonial: Testimonial; block: ContentBlock }> {
  const orgId = getOrgId();
  const params = new URLSearchParams();
  if (orgId) params.append("orgId", orgId);

  return fetchFromBackend(
    `/testimonials/${testimonialId}/blocks?${params.toString()}`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

/**
 * Update a content block
 */
export async function updateContentBlock(
  testimonialId: string,
  blockId: string,
  data: Partial<CreateContentBlockData>
): Promise<{ success: boolean; testimonial: Testimonial }> {
  const orgId = getOrgId();
  const params = new URLSearchParams();
  if (orgId) params.append("orgId", orgId);

  return fetchFromBackend(
    `/testimonials/${testimonialId}/blocks/${blockId}?${params.toString()}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
}

/**
 * Delete a content block
 */
export async function deleteContentBlock(
  testimonialId: string,
  blockId: string
): Promise<{ success: boolean; testimonial: Testimonial }> {
  const orgId = getOrgId();
  const params = new URLSearchParams();
  if (orgId) params.append("orgId", orgId);

  return fetchFromBackend(
    `/testimonials/${testimonialId}/blocks/${blockId}?${params.toString()}`,
    {
      method: "DELETE",
    }
  );
}

/**
 * Reorder content blocks
 */
export async function reorderContentBlocks(
  testimonialId: string,
  blockIds: string[]
): Promise<{ success: boolean; testimonial: Testimonial }> {
  const orgId = getOrgId();
  const params = new URLSearchParams();
  if (orgId) params.append("orgId", orgId);

  return fetchFromBackend(
    `/testimonials/${testimonialId}/blocks/reorder?${params.toString()}`,
    {
      method: "POST",
      body: JSON.stringify({ blockIds }),
    }
  );
}

/**
 * Reorder testimonials
 */
export async function reorderTestimonials(
  testimonialIds: string[]
): Promise<{ success: boolean }> {
  const orgId = getOrgId();
  const params = new URLSearchParams();
  if (orgId) params.append("orgId", orgId);

  return fetchFromBackend(`/testimonials/reorder?${params.toString()}`, {
    method: "POST",
    body: JSON.stringify({ testimonialIds }),
  });
}

/**
 * Get unique categories for the organization
 */
export async function getCategories(): Promise<{ success: boolean; categories: string[] }> {
  const orgId = getOrgId();
  const params = new URLSearchParams();
  if (orgId) params.append("orgId", orgId);

  return fetchFromBackend(`/testimonials/meta/categories?${params.toString()}`);
}

// ============= Public Testimonial APIs =============

/**
 * Get public testimonials for an organization (by org slug)
 */
export async function getPublicTestimonials(
  orgSlug: string,
  options?: {
    category?: string;
    tag?: string;
    featured?: boolean;
    page?: number;
    limit?: number;
  }
): Promise<PublicTestimonialsListResponse> {
  const params = new URLSearchParams();

  if (options?.category) params.append("category", options.category);
  if (options?.tag) params.append("tag", options.tag);
  if (options?.featured) params.append("featured", "true");
  if (options?.page) params.append("page", options.page.toString());
  if (options?.limit) params.append("limit", options.limit.toString());

  const queryString = params.toString();
  const url = `/public/testimonials/${orgSlug}${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(
      error.error || error.details || `API Error: ${response.status}`
    );
  }

  return response.json();
}

/**
 * Get public testimonial categories for an organization
 */
export async function getPublicTestimonialCategories(
  orgSlug: string
): Promise<{ success: boolean; categories: string[] }> {
  const response = await fetch(
    `${API_BASE}/public/testimonials/${orgSlug}/categories`,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(
      error.error || error.details || `API Error: ${response.status}`
    );
  }

  return response.json();
}

/**
 * Get a single public testimonial by org slug and testimonial slug
 */
export async function getPublicTestimonialDetail(
  orgSlug: string,
  testimonialSlug: string
): Promise<PublicTestimonialDetailResponse> {
  const response = await fetch(
    `${API_BASE}/public/testimonials/${orgSlug}/${testimonialSlug}`,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(
      error.error || error.details || `API Error: ${response.status}`
    );
  }

  return response.json();
}

// ============= YouTube Helper =============

/**
 * Extract YouTube video ID from URL
 */
export function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Get YouTube embed URL from video ID
 */
export function getYoutubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

/**
 * Get YouTube thumbnail URL from video ID
 */
export function getYoutubeThumbnailUrl(
  videoId: string,
  quality: "default" | "hq" | "mq" | "sd" | "maxres" = "hq"
): string {
  const qualityMap = {
    default: "default",
    hq: "hqdefault",
    mq: "mqdefault",
    sd: "sddefault",
    maxres: "maxresdefault",
  };
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

/**
 * Garage Funnels library API client, ported from the NC web app
 * (`lib/api/admin-funnels.ts`).
 *
 * Identical surface to networkchains-web-app `lib/api/admin-funnels.ts` so the
 * ported pages + funnel-studio components import the same names — only the
 * transport changed: auth now comes from ./auth (garage→NC silent elevation)
 * instead of the NC OTP flow, matching the same swap already made for
 * admin-axons.ts / admin-posthog.ts / admin-sentry.ts / admin.ts. Every
 * `/admin/funnels*` route on contacts-backend returns a flat `{ok, ...}` body
 * (no `data` envelope), so this uses `ncAdminFetchRaw`, not `ncAdminFetch`.
 *
 * The interfaces below (FunnelCta, FunnelListItem, FunnelDetail,
 * FunnelSaveInput) MUST stay field-for-field identical to the NC source —
 * they're part of the funnel enum/field mirror described in the task brief.
 */

import { ncAdminFetchRaw } from "./auth";
import type { FunnelTemplate } from "@/lib/funnel-tree";

export type { FunnelVideo, FunnelNode, FunnelTemplate } from "@/lib/funnel-tree";
import type { FunnelNode } from "@/lib/funnel-tree";

/** The product a funnel drives visitors to (picked via the standard product
 *  picker — same shape as an attached funnel product). */
export interface FunnelCta {
  itemType?: string;
  itemId?: string;
  category?: string;
  orgSlug?: string;
  name?: string;
  image?: string;
  price?: number;
  currency?: string;
}

/** Compact funnel for the admin list. */
export interface FunnelListItem {
  id: string;
  name: string;
  isDefault: boolean;
  cta: FunnelCta | null;
  updatedAt?: string;
  updatedByEmail?: string;
}

/** Full funnel (tree + cta) for the editor. */
export interface FunnelDetail {
  id: string;
  name: string;
  isDefault: boolean;
  cta: FunnelCta | null;
  rootQuestion: string;
  options: FunnelNode[];
}

/** What the editor saves back for one funnel. */
export interface FunnelSaveInput {
  name?: string;
  rootQuestion: string;
  options: FunnelNode[];
  cta?: FunnelCta | null;
}

export const adminFunnelsApi = {
  // ── Multi-funnel library ──
  listFunnels: () =>
    ncAdminFetchRaw<{ ok: boolean; funnels: FunnelListItem[] }>("/admin/funnels"),

  createFunnel: (name?: string) =>
    ncAdminFetchRaw<{ ok: boolean; funnel: FunnelDetail }>("/admin/funnels", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  getFunnel: (id: string) =>
    ncAdminFetchRaw<{ ok: boolean; funnel: FunnelDetail }>(`/admin/funnels/${id}`),

  saveFunnel: (id: string, input: FunnelSaveInput) =>
    ncAdminFetchRaw<{ ok: boolean; funnel: FunnelDetail }>(`/admin/funnels/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  // Save only name/CTA (not the tree) — used by the editor's toolbar.
  updateFunnelMeta: (id: string, meta: { name?: string; cta?: FunnelCta | null }) =>
    ncAdminFetchRaw<{ ok: boolean; funnel: FunnelDetail }>(`/admin/funnels/${id}/meta`, {
      method: "PATCH",
      body: JSON.stringify(meta),
    }),

  deleteFunnel: (id: string) =>
    ncAdminFetchRaw<{ ok: boolean }>(`/admin/funnels/${id}`, { method: "DELETE" }),

  setDefaultFunnel: (id: string) =>
    ncAdminFetchRaw<{ ok: boolean; funnel: FunnelDetail }>(`/admin/funnels/${id}/default`, {
      method: "POST",
    }),

  // ── Back-compat: the default funnel as a single "template" ──
  getTemplate: () =>
    ncAdminFetchRaw<{ ok: boolean; template: FunnelTemplate }>("/admin/funnels/template"),

  saveTemplate: (template: FunnelTemplate) =>
    ncAdminFetchRaw<{ ok: boolean; template: FunnelTemplate }>("/admin/funnels/template", {
      method: "PUT",
      body: JSON.stringify(template),
    }),

  presignUpload: (mimeType: string, sizeBytes: number) =>
    ncAdminFetchRaw<{ ok: boolean; key: string; uploadUrl: string; uploadHeaders: Record<string, string>; publicUrl: string }>(
      "/admin/funnels/upload-url",
      { method: "POST", body: JSON.stringify({ mimeType, sizeBytes }) }
    ),

  // Presign, then PUT bytes straight to S3. Returns the stored key.
  uploadFile: async (file: File): Promise<{ key: string; publicUrl: string }> => {
    const p = await adminFunnelsApi.presignUpload(file.type, file.size);
    const put = await fetch(p.uploadUrl, {
      method: "PUT",
      headers: p.uploadHeaders,
      body: file,
    });
    if (!put.ok) throw new Error(`Upload failed (${put.status})`);
    return { key: p.key, publicUrl: p.publicUrl };
  },
};

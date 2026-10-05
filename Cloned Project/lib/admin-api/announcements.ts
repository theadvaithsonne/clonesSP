import { garageAdminApi, API_URL } from "@/lib/api";
import type { Announcement, AnnouncementDraft } from "@/lib/announcements";

/**
 * Alerts & Promotions — the garage-admin console's client for
 * /garage-admin/announcements (super admin only).
 *
 * The rendered shapes live in lib/announcements.ts because the app reads them
 * too; only the authoring calls are here.
 */

type Envelope<T> = { success: boolean; data: T; message?: string };

function payload(draft: AnnouncementDraft) {
  return {
    ...draft,
    eyebrow: draft.eyebrow || undefined,
    imageUrl: draft.contentType === "image-text" ? draft.imageUrl : undefined,
    comingSoonLabel: draft.comingSoonLabel || undefined,
    startsAt: draft.startsAt || null,
    endsAt: draft.endsAt || null,
  };
}

export async function listAnnouncements(): Promise<Announcement[]> {
  const res = await garageAdminApi<Envelope<Announcement[]>>(
    "/garage-admin/announcements"
  );
  return res.data || [];
}

export async function createAnnouncement(
  draft: AnnouncementDraft
): Promise<Announcement> {
  const res = await garageAdminApi<Envelope<Announcement>>(
    "/garage-admin/announcements",
    { method: "POST", body: JSON.stringify(payload(draft)) }
  );
  return res.data;
}

export async function updateAnnouncement(
  id: string,
  draft: AnnouncementDraft
): Promise<Announcement> {
  const res = await garageAdminApi<Envelope<Announcement>>(
    `/garage-admin/announcements/${id}`,
    { method: "PATCH", body: JSON.stringify(payload(draft)) }
  );
  return res.data;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await garageAdminApi<Envelope<{ deleted: boolean }>>(
    `/garage-admin/announcements/${id}`,
    { method: "DELETE" }
  );
}

/** Bumps `version`, which un-dismisses the announcement for every browser. */
export async function resetAnnouncementDismissals(
  id: string
): Promise<Announcement> {
  const res = await garageAdminApi<Envelope<Announcement>>(
    `/garage-admin/announcements/${id}/reset-dismissals`,
    { method: "POST" }
  );
  return res.data;
}

/**
 * Image upload for the "Image + Text" content type.
 *
 * Goes through /garage-admin/upload (admin token, S3-backed) rather than the
 * user-authenticated /upload — the console has no user JWT. Hand-rolled fetch
 * because `api()` would stringify the FormData body.
 */
export async function uploadAnnouncementImage(file: File): Promise<string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("garage_admin_token")
      : null;

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${API_URL}/garage-admin/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });

  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed (${res.status})`);
  }

  const data = await res.json();
  if (!data?.url) throw new Error("Upload succeeded but returned no URL");
  return data.url as string;
}

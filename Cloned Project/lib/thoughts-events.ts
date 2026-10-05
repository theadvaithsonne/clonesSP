"use client";

import { buildExternalUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/utils/api";
import type { NoteBreadcrumbItem } from "@/app/(dashboard)/thoughts/types";

export type ThoughtsInlineSection =
  | "all-notes"
  | "starred"
  | "templates"
  | "archive"
  | "trash"
  | "recovery"
  | "open-page";

export const THOUGHTS_INLINE_NAVIGATE_EVENT = "thoughts:inline-navigate";
export const THOUGHTS_OPEN_NOTE_EVENT = "thoughts:open-note";

export function dispatchThoughtsInlineNavigate(section: ThoughtsInlineSection) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(THOUGHTS_INLINE_NAVIGATE_EVENT, {
      detail: { section },
    })
  );
}

export function dispatchThoughtsOpenNote(noteId: string) {
  if (typeof window === "undefined" || !noteId) return;
  window.dispatchEvent(
    new CustomEvent(THOUGHTS_OPEN_NOTE_EVENT, {
      detail: { noteId },
    })
  );
  window.dispatchEvent(
    new CustomEvent(THOUGHTS_INLINE_NAVIGATE_EVENT, {
      detail: { section: "open-page", noteId },
    })
  );
}

export function isThoughtsInlineMode(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).__garageThoughtsInline);
}

export function dedupeNoteBreadcrumbs(items: NoteBreadcrumbItem[]): NoteBreadcrumbItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function patchNoteParentId(childNoteId: string, parentId: string): Promise<boolean> {
  if (!parentId || !childNoteId || parentId === childNoteId) return false;
  try {
    const response = await authenticatedFetch(buildExternalUrl(`notes/${childNoteId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Workspace-member link — opens Notes and the target page when logged in */
export function buildNoteMemberUrl(noteId: string, origin = typeof window !== "undefined" ? window.location.origin : ""): string {
  const params = new URLSearchParams({ openApp: "note", noteId });
  return `${origin}/workspace?${params.toString()}`;
}

/** Public publish link */
export function buildNotePublicUrl(shareToken: string, origin = typeof window !== "undefined" ? window.location.origin : ""): string {
  return `${origin}/shared/note/${shareToken}`;
}

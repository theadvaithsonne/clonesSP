"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import {
  copyToClipboard,
  fetchMyAffiliateId,
  withAffiliateRef,
} from "@/lib/affiliate-share";

/**
 * "Copy affiliate share link" for cabinet files, shared by every cabinet
 * surface. The link is the file's public share URL with the copier's own
 * `?ref=` on it, so a signup that starts from the link is credited to them.
 */

/**
 * What a copied link is good for. The backend mints links with a 30-day expiry
 * and a 100-open cap, and changing a file's sharing access revokes the link
 * outright rather than re-pointing it.
 */
export const LINK_LIFETIME_NOTE =
  "Expires in 30 days, and changing this file's sharing settings replaces it.";

export type CabinetScope =
  | { kind: "personal" }
  | { kind: "organization" }
  | { kind: "floor"; floorId: string };

export interface ShareableFile {
  _id: string;
  name: string;
}

/**
 * Share-link routes to try, most specific first. Each cabinet tree has its own
 * file collection, but the endpoints have grown at different times — falling
 * back to the personal route means a backend that only implements one still
 * produces a working link instead of an error.
 */
function shareLinkPaths(
  scope: CabinetScope,
  fileId: string,
  organizationId: string,
): string[] {
  const query = `?organizationId=${organizationId}`;
  const personal = `/cabinet/files/${fileId}/share-link${query}`;
  if (scope.kind === "organization") {
    return [`/cabinet/organization/files/${fileId}/share-link${query}`, personal];
  }
  if (scope.kind === "floor") {
    return [
      `/cabinet/floor/${scope.floorId}/files/${fileId}/share-link${query}`,
      `/cabinet/organization/files/${fileId}/share-link${query}`,
      personal,
    ];
  }
  return [personal];
}

/**
 * Last resort when no share-link endpoint accepts the file — most often a
 * `404 File not found or you are not the owner` on a file that lives in a
 * different cabinet tree. The viewer route resolves the file by id, so the
 * recipient still lands on it and the `ref` is still credited. Sharing never
 * dead-ends on a copy button.
 */
function viewerFallbackLink(fileId: string, affiliateId: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const base = `${origin}/cabinet/view/${fileId}`;
  return affiliateId ? `${base}?ref=${encodeURIComponent(affiliateId)}` : base;
}

export function useAffiliateShare(
  scope: CabinetScope,
  organizationId: string,
) {
  const [affiliateId, setAffiliateId] = useState("");
  const affiliateIdRef = useRef("");
  affiliateIdRef.current = affiliateId;

  // Links live in refs, not state: nothing renders them, and a copy fired
  // right after an upload has to see the link the background mint just wrote.
  const linksRef = useRef<Record<string, string>>({});
  const requestsRef = useRef<Record<string, Promise<string>>>({});

  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const orgRef = useRef(organizationId);
  orgRef.current = organizationId;

  useEffect(() => {
    let cancelled = false;
    void fetchMyAffiliateId().then((id) => {
      if (!cancelled) setAffiliateId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const buildLink = useCallback((fileId: string): Promise<string> => {
    const cached = linksRef.current[fileId];
    if (cached) return Promise.resolve(cached);
    // An upload mints in the background while the user may already be clicking
    // "Copy" — both wait on the same request rather than racing it.
    const inFlight = requestsRef.current[fileId];
    if (inFlight) return inFlight;

    const paths = shareLinkPaths(scopeRef.current, fileId, orgRef.current);
    const request = (async () => {
      for (const path of paths) {
        try {
          const response = await api<{
            success: boolean;
            data: { url: string; isNew: boolean };
          }>(path, {
            method: "POST",
            body: JSON.stringify({ linkType: "external" }),
          });
          const link = withAffiliateRef(
            response.data.url,
            affiliateIdRef.current,
          );
          linksRef.current[fileId] = link;
          return link;
        } catch (error) {
          console.warn(`Share link failed via ${path}`, error);
        }
      }
      const fallback = viewerFallbackLink(fileId, affiliateIdRef.current);
      linksRef.current[fileId] = fallback;
      return fallback;
    })().finally(() => {
      delete requestsRef.current[fileId];
    });

    requestsRef.current[fileId] = request;
    return request;
  }, []);

  /**
   * Drops a cached link so the next copy mints a fresh one.
   *
   * Needed after a file's sharing access changes: the backend revokes the old
   * token and issues a new one, so the cached URL is dead. Without an id the
   * whole cache goes.
   */
  const forgetLink = useCallback((fileId?: string) => {
    if (fileId) {
      delete linksRef.current[fileId];
      return;
    }
    linksRef.current = {};
  }, []);

  const copyAffiliateLink = useCallback(
    async (fileId: string, fileName?: string) => {
      // A row that renders without an id is a bug upstream, not a share the
      // user should be left guessing about.
      if (!fileId) {
        toast.error("No file to share — reload the folder and try again");
        return;
      }
      const toastId = toast.loading("Preparing share link...");
      try {
        const link = await buildLink(fileId);
        const copied = await copyToClipboard(link);
        toast.dismiss(toastId);
        if (copied) {
          const what = affiliateIdRef.current ? "Affiliate link" : "Share link";
          toast.success(`${what} copied${fileName ? ` for ${fileName}` : ""}`, {
            // The link is not permanent, and it is replaced outright if the
            // file's sharing access is changed — worth saying before someone
            // pastes it somewhere it has to keep working.
            description: LINK_LIFETIME_NOTE,
          });
        } else {
          // Clipboard permission can be denied — the link still has value.
          toast.message("Copy blocked by the browser", { description: link });
        }
      } catch (error) {
        console.error("Error creating affiliate share link:", error);
        toast.dismiss(toastId);
        toast.error(
          error instanceof Error ? error.message : "Failed to create share link",
        );
      }
    },
    [buildLink],
  );

  const copyAffiliateLinks = useCallback(
    async (files: ShareableFile[]) => {
      const toastId = toast.loading(`Preparing ${files.length} share links...`);
      try {
        const lines: string[] = [];
        for (const file of files) {
          lines.push(`${file.name}: ${await buildLink(file._id)}`);
        }
        const copied = await copyToClipboard(lines.join("\n"));
        toast.dismiss(toastId);
        if (copied) {
          toast.success(`${lines.length} share links copied`, {
            description: LINK_LIFETIME_NOTE,
          });
        } else {
          toast.message("Copy blocked by the browser", {
            description: lines.join("\n"),
          });
        }
      } catch (error) {
        console.error("Error creating affiliate share links:", error);
        toast.dismiss(toastId);
        toast.error("Failed to create share links");
      }
    },
    [buildLink],
  );

  /** Mints links ahead of the click so the toast's copy button is instant. */
  const prefetchLinks = useCallback(
    (files: ShareableFile[]) => {
      void Promise.allSettled(
        files.filter((f) => f._id).map((f) => buildLink(f._id)),
      );
    },
    [buildLink],
  );

  /**
   * The upload success toast, with the affiliate copy wired to its action.
   * Shared so every cabinet reports an upload the same way.
   */
  const announceUpload = useCallback(
    (uploaded: ShareableFile[]) => {
      const withIds = uploaded.filter((f) => f._id);
      prefetchLinks(withIds);
      const hasAffiliate = !!affiliateIdRef.current;

      if (withIds.length === 0) {
        toast.success(
          uploaded.length === 1
            ? `${uploaded[0].name} uploaded`
            : `${uploaded.length} files uploaded`,
        );
        return;
      }

      if (withIds.length === 1) {
        const file = withIds[0];
        toast.success(`${file.name} uploaded`, {
          action: {
            label: hasAffiliate ? "Copy Affiliate Link" : "Copy Share Link",
            onClick: () => void copyAffiliateLink(file._id, file.name),
          },
        });
        return;
      }

      toast.success(`${withIds.length} files uploaded`, {
        action: {
          label: hasAffiliate ? "Copy Affiliate Links" : "Copy Share Links",
          onClick: () => void copyAffiliateLinks(withIds),
        },
      });
    },
    [copyAffiliateLink, copyAffiliateLinks, prefetchLinks],
  );

  return {
    affiliateId,
    copyAffiliateLink,
    copyAffiliateLinks,
    prefetchLinks,
    announceUpload,
    forgetLink,
  };
}

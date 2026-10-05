// EXTERNAL flow store state: the External Signatures list and its per-folder status counts.
// Backed entirely by lib/docusign/external-api (the esign_* collections).
//
// Smaller than the internal slice because this flow has one list, not three, and its editor
// holds the open document in local component state rather than in the store.

import type { StateCreator } from "zustand";
import { toast } from "sonner";
import type { DsPagination, FolderFilter } from "@/lib/docusign/types";
import { DsExternalDocument, listMyExternalDocuments, getExternalDocumentStats } from "@/lib/docusign/external-api";
import type { DocusignState } from "./state";
import { EMPTY_PAGINATION, type ExternalStats } from "./types";

// Per-slice stale-response guard — see the equivalent note in internalSlice.ts.
const latestRequest = { external: 0, externalFolderStats: 0 };

export interface ExternalSlice {
  externalDocuments: DsExternalDocument[];
  externalPagination: DsPagination;
  isLoadingExternal: boolean;

  // Status counts for whichever folder is being browsed (org-wide `externalStats` is unaffected).
  externalFolderStats: ExternalStats | null;

  fetchExternalDocuments: (page?: number, folderId?: FolderFilter, status?: string) => Promise<void>;
  fetchExternalFolderStats: (folderId?: FolderFilter) => Promise<void>;
}

export const createExternalSlice: StateCreator<DocusignState, [], [], ExternalSlice> = (set) => ({
  externalDocuments: [],
  externalPagination: EMPTY_PAGINATION,
  isLoadingExternal: false,

  externalFolderStats: null,

  fetchExternalDocuments: async (page = 1, folderId, status) => {
    const requestId = ++latestRequest.external;
    set({ isLoadingExternal: true });
    try {
      const res = await listMyExternalDocuments(page, 20, folderId, status);
      if (requestId !== latestRequest.external) return;
      set({ externalDocuments: res.data || [], externalPagination: res.pagination, isLoadingExternal: false });
    } catch (err: any) {
      if (requestId !== latestRequest.external) return;
      set({ isLoadingExternal: false });
      toast.error(err.message || "Failed to load external signatures");
    }
  },

  fetchExternalFolderStats: async (folderId) => {
    const requestId = ++latestRequest.externalFolderStats;
    if (!folderId) {
      set({ externalFolderStats: null });
      return;
    }
    try {
      const res = await getExternalDocumentStats(folderId);
      if (requestId !== latestRequest.externalFolderStats) return;
      set({ externalFolderStats: res.data });
    } catch {
      // Only badges depend on this; the list itself has already reported any real failure.
      if (requestId === latestRequest.externalFolderStats) set({ externalFolderStats: null });
    }
  },
});

// INTERNAL flow store state: the three document lists the internal tabs page through, the
// per-folder status counts behind the Agreements rail, and the currently-open document detail.
// Backed entirely by lib/docusign/internal-api (the ds_* collections).

import type { StateCreator } from "zustand";
import { toast } from "sonner";
import type { DsPagination, DsField, DsAuditLogEntry, FolderFilter } from "@/lib/docusign/types";
import {
  DsDocument,
  DsRecipient,
  listSentByMe,
  listAssignedToMe,
  listAllInOrg,
  getDocumentStats,
  getDocumentDetail as apiGetDocumentDetail,
} from "@/lib/docusign/internal-api";
import type { DocusignState } from "./state";
import { EMPTY_PAGINATION, type DocusignStats } from "./types";

// Latest request number per paginated list. Clicking through filters/pages quickly fires
// overlapping requests, and responses don't arrive in order — without this, a slow response
// for an older filter/page could land last and overwrite the one the user is actually looking
// at. Each fetch only applies its result if it's still the latest.
//
// Kept per-slice: every counter here is read and written only by this slice's own actions, so
// splitting the old single object along the flow boundary preserves the guard exactly.
const latestRequest = { assigned: 0, sent: 0, all: 0, folderStats: 0 };

export interface InternalSlice {
  sentDocuments: DsDocument[];
  assignedDocuments: DsDocument[];
  allDocuments: DsDocument[];
  sentPagination: DsPagination;
  assignedPagination: DsPagination;
  allPagination: DsPagination;
  isLoadingAssigned: boolean;
  isLoadingSent: boolean;
  isLoadingAll: boolean;

  // Status counts for whichever folder is being browsed (org-wide `stats` is unaffected).
  folderStats: DocusignStats | null;

  currentDocument: DsDocument | null;
  currentRecipients: DsRecipient[];
  currentFields: DsField[];
  currentAuditLog: DsAuditLogEntry[];
  isLoadingDetail: boolean;

  fetchAssignedDocuments: (page?: number) => Promise<void>;
  fetchSentDocuments: (page?: number) => Promise<void>;
  fetchAllDocuments: (status?: string, page?: number, scope?: "sent" | "assigned", folderId?: FolderFilter) => Promise<void>;
  fetchFolderStats: (folderId?: FolderFilter) => Promise<void>;
  fetchDocumentDetail: (id: string) => Promise<void>;
  clearCurrentDocument: () => void;
}

export const createInternalSlice: StateCreator<DocusignState, [], [], InternalSlice> = (set) => ({
  sentDocuments: [],
  assignedDocuments: [],
  allDocuments: [],
  sentPagination: EMPTY_PAGINATION,
  assignedPagination: EMPTY_PAGINATION,
  allPagination: EMPTY_PAGINATION,
  isLoadingAssigned: false,
  isLoadingSent: false,
  isLoadingAll: false,

  folderStats: null,

  currentDocument: null,
  currentRecipients: [],
  currentFields: [],
  currentAuditLog: [],
  isLoadingDetail: false,

  // Landing on Docusign only ever needs "Assigned to Me" — "Sent by Me" is fetched
  // separately, only once the user actually opens that tab (see fetchSentDocuments).
  fetchAssignedDocuments: async (page = 1) => {
    const requestId = ++latestRequest.assigned;
    set({ isLoadingAssigned: true });
    try {
      const assigned = await listAssignedToMe(page);
      if (requestId !== latestRequest.assigned) return;
      set({ assignedDocuments: assigned.data || [], assignedPagination: assigned.pagination, isLoadingAssigned: false });
    } catch (err: any) {
      if (requestId !== latestRequest.assigned) return;
      set({ isLoadingAssigned: false });
      toast.error(err.message || "Failed to load documents assigned to you");
    }
  },

  fetchSentDocuments: async (page = 1) => {
    const requestId = ++latestRequest.sent;
    set({ isLoadingSent: true });
    try {
      const sent = await listSentByMe(page);
      if (requestId !== latestRequest.sent) return;
      set({ sentDocuments: sent.data || [], sentPagination: sent.pagination, isLoadingSent: false });
    } catch (err: any) {
      if (requestId !== latestRequest.sent) return;
      set({ isLoadingSent: false });
      toast.error(err.message || "Failed to load documents you've sent");
    }
  },

  // Backs the founder/admin-only "Agreements" tab — every document in the org by
  // default; scope narrows to "sent by me" or "assigned to me" (folding what used to be
  // separate tabs into this one view as filters). Called fresh with the relevant
  // status/scope/page on every filter click or page change — see AgreementsView.
  // `folderId` narrows to one folder ("unfiled" = Global); leave it out for every folder.
  fetchAllDocuments: async (status?: string, page = 1, scope?: "sent" | "assigned", folderId?: FolderFilter) => {
    const requestId = ++latestRequest.all;
    set({ isLoadingAll: true });
    try {
      const all = await listAllInOrg(status, page, undefined, scope, folderId);
      if (requestId !== latestRequest.all) return;
      set({ allDocuments: all.data || [], allPagination: all.pagination, isLoadingAll: false });
    } catch (err: any) {
      if (requestId !== latestRequest.all) return;
      set({ isLoadingAll: false });
      toast.error(err.message || "Failed to load agreements");
    }
  },

  fetchFolderStats: async (folderId) => {
    const requestId = ++latestRequest.folderStats;
    if (!folderId) {
      set({ folderStats: null });
      return;
    }
    try {
      const res = await getDocumentStats(folderId);
      if (requestId !== latestRequest.folderStats) return;
      set({ folderStats: res.data });
    } catch {
      // Only badges depend on this; the list itself has already reported any real failure.
      if (requestId === latestRequest.folderStats) set({ folderStats: null });
    }
  },

  fetchDocumentDetail: async (id: string) => {
    set({ isLoadingDetail: true });
    try {
      const res = await apiGetDocumentDetail(id);
      set({
        currentDocument: res.data.document,
        currentRecipients: res.data.recipients,
        currentFields: res.data.fields,
        currentAuditLog: res.data.auditLog,
        isLoadingDetail: false,
      });
    } catch (err: any) {
      set({ isLoadingDetail: false });
      toast.error(err.message || "Failed to load document");
    }
  },

  clearCurrentDocument: () =>
    set({ currentDocument: null, currentRecipients: [], currentFields: [], currentAuditLog: [] }),
});

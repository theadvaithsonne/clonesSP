// The Docusign store, composed from three slices along the same internal/external/shared
// boundary as the components and the API modules:
//
//   sharedSlice    — identity, merged dashboard stats + analytics, folders, org members
//   internalSlice  — the ds_* document lists, folder counts and open-document detail
//   externalSlice  — the esign_* document list and its folder counts
//
// Deliberately still ONE store behind one hook. The slices split the code, not the public
// API, so every existing consumer — including the global bottom nav dock in
// app/(dashboard)/layout.tsx, which reads `me`/`activeTab`/`setActiveTab` — keeps working
// unchanged, and a slice can still read another slice's state when it genuinely needs to.
//
// Note `adminMembers`/`isLoadingAdminMembers` are gone: they were declared here but never
// written by anything (the Admin tab calls the API directly).

import { create } from "zustand";
import { createSharedSlice } from "./sharedSlice";
import { createInternalSlice } from "./internalSlice";
import { createExternalSlice } from "./externalSlice";
import type { DocusignState } from "./state";

// Re-exported from their new home so the many components that import these from this module
// keep resolving. New code can import them from ./types directly.
export type { OrgMemberLite, DocusignStats, ExternalStats } from "./types";
export type { DocusignState } from "./state";

export const useDocusignStore = create<DocusignState>()((...a) => ({
  ...createSharedSlice(...a),
  ...createInternalSlice(...a),
  ...createExternalSlice(...a),
}));

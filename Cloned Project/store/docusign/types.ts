// Store-level types shared by all three slices.

import type { DsPagination } from "@/lib/docusign/types";

export interface OrgMemberLite {
  _id: string;
  name?: string;
  // Always a string: fetchOrgMembers coerces it, because the org genuinely contains members
  // with neither a name nor an email and an unguarded string call on those used to crash the
  // Admin tab. See the note on fetchOrgMembers in sharedSlice.ts.
  email: string;
  profilePicture?: string;
  role: "founder" | "stakeholder";
}

export interface DocusignStats {
  draft: number;
  sent: number;
  in_progress: number;
  completed: number;
  voided: number;
  total: number;
  assignedToMePending: number;
}

export interface ExternalStats {
  draft: number;
  // "sent"/"in_progress" only exist for the send-for-signature (self-sign) path — fill-on-behalf
  // goes straight draft -> completed, so these are always 0 for an org that never uses self-sign.
  sent: number;
  in_progress: number;
  completed: number;
  voided: number;
  total: number;
}

export const EMPTY_PAGINATION: DsPagination = { page: 1, limit: 20, total: 0, totalPages: 1 };

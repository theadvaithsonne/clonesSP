/**
 * The two EarnGPT suggestion-feedback types the NC admin client re-exports.
 *
 * Copied verbatim from networkchains-web-app `lib/api/earngpt.ts`. Only these
 * two are pulled across: the rest of that module is the user-facing EarnGPT
 * client, which this port does not need. Keep them byte-identical to the source
 * so the EarnGPT Learning page ports without edits.
 */

/** One row of the EarnGPT suggestion-learning log (NC admin panel). */
export interface AdminSuggestionFeedbackItem {
  _id: string;
  userId: string;
  direction: "product" | "contact";
  anchorId: string;
  suggestedId: string;
  suggestedName?: string;
  reasoning?: string;
  option: "wrong" | "close" | "chosen";
  freeText?: string;
  contactId?: string;
  createdAt: string;
}

export interface AdminSuggestionFeedbackResponse {
  feedback: AdminSuggestionFeedbackItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

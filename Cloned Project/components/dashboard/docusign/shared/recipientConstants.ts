// Recipient constants used by BOTH flows.
//
// These used to live in internal/RecipientsPanel.tsx, which meant the external editor and
// ExternalRecipientsPanel imported from an internal-only component — the one place external
// code reached across the internal/external boundary. They are pure data with no flow of
// their own (a colour ramp and a backend limit), so they belong here.

// Mirrors MAX_SEPARATE_COPIES in the backend (services/separateCopies.service.js,
// SEPARATE_COPIES_MAX) and its esign twin. Copies are built in the background, so this is
// only a sanity limit; the backend refuses more than this.
export const MAX_SEPARATE_COPIES = 500;

// Per-recipient accent, indexed by the recipient's position in the list (always used
// modulo length, so the ramp repeats for documents with more recipients than colours).
export const RECIPIENT_COLORS = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#22c55e", // green
  "#f59e0b", // amber
  "#06b6d4", // cyan
  "#a855f7", // purple
  "#ef4444", // red
  "#84cc16", // lime
  "#3b82f6", // blue
  "#78716c", // stone
];

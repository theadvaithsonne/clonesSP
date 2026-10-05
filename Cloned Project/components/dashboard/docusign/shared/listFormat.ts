// Formatting shared by the two document list screens (Agreements and External Signatures), which
// present the same inbox-style rows.

/** Mail-client style: the time for anything sent today, otherwise the date. Keeps a long list
 *  scannable — the exact minute only matters for things that just happened. */
export function formatMailTimestamp(value: string) {
  const date = new Date(value);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return isToday
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "Still needs someone's attention" — drives the bold title and the accent dot.
 *
 *  `myRecipientStatus` only exists on internal documents, and only on rows that came from the
 *  "Assigned to Me" filter; it says whether *you* still owe a signature. External documents have
 *  no per-viewer state at all (recipients there never have accounts), so they fall through to the
 *  document-level test, which is well defined for both flows. */
export function isUnreadDocument(doc: { status: string; myRecipientStatus?: string }) {
  if (doc.myRecipientStatus) return doc.myRecipientStatus === "pending" || doc.myRecipientStatus === "viewed";
  return doc.status === "sent" || doc.status === "in_progress";
}

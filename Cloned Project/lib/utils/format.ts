import { format, formatDistanceToNow } from "date-fns";

export const formatDate = (date: string | Date, formatStr = "MMM d, yyyy"): string => {
  return format(new Date(date), formatStr);
};

export const formatDateTime = (date: string | Date): string => {
  return format(new Date(date), "MMM d, yyyy h:mm a");
};

export const formatRelativeTime = (date: string | Date): string => {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};

export const formatPhone = (phone: string): string => {
  // Simple phone formatter - can be enhanced
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

export const getInitials = (firstName: string, lastName?: string): string => {
  const first = firstName?.charAt(0)?.toUpperCase() || "";
  const last = lastName?.charAt(0)?.toUpperCase() || "";
  return `${first}${last}`.trim() || "?";
};

export const truncate = (text: string, length: number): string => {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
};

/** Best avatar URL for a contact: its own top-level photo, else the first social
 *  profile that carries one. Merged/LinkedIn-enriched contacts often keep the
 *  photo only on `socialProfiles[].imageUrl` (the merge doesn't promote it, and
 *  enrichment stores it there), so the main avatar would otherwise show initials
 *  despite a picture existing. */
export const contactPhotoUrl = (contact: {
  imageUrl?: string | null;
  socialProfiles?: Array<{ imageUrl?: string | null }> | null;
}): string | undefined => {
  if (contact.imageUrl && contact.imageUrl.trim()) return contact.imageUrl;
  const withPhoto = (contact.socialProfiles ?? []).find(
    (p) => p?.imageUrl && String(p.imageUrl).trim(),
  );
  return withPhoto?.imageUrl ?? undefined;
};

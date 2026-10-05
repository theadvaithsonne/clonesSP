/** First word of a player's name ("Alan Kippax" → "Alan"). Boards show first names only. */
export function firstName(name?: string | null): string {
  return name?.trim().split(/\s+/)[0] ?? "";
}

/** First name plus the last name's initial ("Alan Kippax" → "Alan K."). */
export function firstNameInitial(name?: string | null): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "";
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}

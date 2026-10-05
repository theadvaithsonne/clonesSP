import { Types } from "mongoose";

interface UserInfo {
  _id: Types.ObjectId | string;
  name?: string | null;
  email?: string | null;
}

/**
 * Parse mentions from text content.
 * Matches @name (with or without spaces), @email, or @userId patterns.
 * Returns an array of unique user IDs that were mentioned.
 *
 * @param text - The text content to parse
 * @param potentialUsers - Array of users who could be mentioned
 * @param excludeUserId - Optional user ID to exclude (e.g., the author)
 */
export function parseMentions(
  text: string,
  potentialUsers: UserInfo[],
  excludeUserId?: string
): string[] {
  const mentionedUserIds = new Set<string>();

  if (!text || potentialUsers.length === 0) {
    return [];
  }

  let textIndex = 0;
  while (textIndex < text.length) {
    const atIndex = text.indexOf("@", textIndex);
    if (atIndex === -1) break;

    const textAfterAt = text.substring(atIndex + 1);
    let bestMatch: { user: UserInfo; matchedText: string } | null = null;

    // Check all users to find the best (longest) match
    for (const user of potentialUsers) {
      const userName = (user.name || "").trim();
      const userEmail = (user.email || "").trim();
      const userId = user._id.toString().toLowerCase();

      // Try matching name WITHOUT spaces (how frontend formats mentions)
      // e.g., "John Doe" becomes "@JohnDoe"
      if (userName) {
        const nameNoSpaces = userName.replace(/\s+/g, "").toLowerCase();
        const nameNoSpacesRegex = new RegExp(
          `^${nameNoSpaces.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$|[.,!?;:])`,
          "i"
        );
        const nameNoSpacesMatch = textAfterAt.match(nameNoSpacesRegex);
        if (nameNoSpacesMatch) {
          const matchedLength = nameNoSpacesMatch[0].trimEnd().length;
          if (!bestMatch || matchedLength > bestMatch.matchedText.length) {
            bestMatch = { user, matchedText: nameNoSpaces };
          }
        }

        // Also try matching full name WITH spaces (for manual typing)
        const nameLower = userName.toLowerCase();
        const nameRegex = new RegExp(
          `^${nameLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$|[.,!?;:])`,
          "i"
        );
        const nameMatch = textAfterAt.match(nameRegex);
        if (nameMatch) {
          const matchedLength = nameMatch[0].trimEnd().length;
          if (!bestMatch || matchedLength > bestMatch.matchedText.length) {
            bestMatch = { user, matchedText: userName };
          }
        }
      }

      // Try matching email
      if (userEmail) {
        const emailLower = userEmail.toLowerCase();
        const emailRegex = new RegExp(
          `^${emailLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$|[.,!?;:])`,
          "i"
        );
        const emailMatch = textAfterAt.match(emailRegex);
        if (emailMatch) {
          const matchedLength = emailMatch[0].trimEnd().length;
          if (!bestMatch || matchedLength > bestMatch.matchedText.length) {
            bestMatch = { user, matchedText: userEmail };
          }
        }
      }

      // Also try matching by ID (single word)
      const idMatch = textAfterAt.match(
        new RegExp(`^${userId}(?:\\s|$|[.,!?;:])`, "i")
      );
      if (idMatch) {
        const matchedLength = idMatch[0].trimEnd().length;
        if (!bestMatch || matchedLength > bestMatch.matchedText.length) {
          bestMatch = { user, matchedText: userId };
        }
      }
    }

    if (bestMatch) {
      const matchedUserId = bestMatch.user._id.toString();
      // Don't add the excluded user (typically the author)
      if (!excludeUserId || matchedUserId !== excludeUserId) {
        mentionedUserIds.add(matchedUserId);
      }
      textIndex = atIndex + 1 + bestMatch.matchedText.length;
    } else {
      // No match, move past the @
      textIndex = atIndex + 1;
    }
  }

  return Array.from(mentionedUserIds);
}

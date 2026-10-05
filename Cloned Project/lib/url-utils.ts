// Utility functions for URL detection and parsing

/**
 * Extract URLs from text
 */
export function extractUrls(text: string): string[] {
  // URL regex that matches:
  // - http:// and https:// URLs
  // - www. URLs
  // - Domain names with optional paths
  const urlRegex =
    /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[a-z0-9]+(?:[-.][a-z0-9]+)*\.[a-z]{2,}(?::[0-9]+)?(?:\/[^\s<>"']*)?)/gi;
  const matches = text.match(urlRegex);
  if (!matches) return [];

  // Email regex to filter out email addresses
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Normalize URLs - add https:// if missing
  return matches
    .map((url) => {
      url = url.trim();
      // Remove trailing punctuation that might not be part of URL
      url = url.replace(/[.,;:!?)\]}]+$/, "");

      // Skip email addresses - don't show link preview for emails
      if (emailRegex.test(url)) {
        return null;
      }

      // Check if this URL is part of an email address in the original text
      // by looking for @ character before the URL
      const urlIndex = text.indexOf(url);
      if (urlIndex > 0) {
        const charBefore = text[urlIndex - 1];
        // If there's an @ before the URL, it's part of an email - skip it
        if (charBefore === '@') {
          return null;
        }
        // Also check if there's a word character followed by @ before this URL
        const precedingText = text.substring(Math.max(0, urlIndex - 50), urlIndex);
        if (/@[^\s]*$/.test(precedingText)) {
          return null;
        }
      }

      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        // Check if it looks like a domain (has a TLD)
        if (
          /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}/i.test(
            url
          )
        ) {
          return "https://" + url;
        }
        // If it's www., add https://
        if (url.startsWith("www.")) {
          return "https://" + url;
        }
      }
      return url;
    })
    .filter((url) => {
      if (!url) return false;
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });
}

/**
 * Check if text contains URLs
 */
export function hasUrl(text: string): boolean {
  return extractUrls(text).length > 0;
}

/**
 * Get the first URL from text
 */
export function getFirstUrl(text: string): string | null {
  const urls = extractUrls(text);
  return urls.length > 0 ? urls[0] : null;
}

/**
 * Validate if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

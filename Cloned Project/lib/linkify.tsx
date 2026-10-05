import React from "react";

// Matches http(s):// URLs and bare www. URLs. Stops at whitespace or
// characters that aren't typically valid inside a URL so trailing
// punctuation doesn't get swallowed.
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>'")\]]+/gi;

/**
 * Turn plain chat text into a React fragment where every URL is a clickable
 * <a> tag (WhatsApp-style: blue, underlined on hover, opens in new tab).
 */
export function linkifyText(
  text: string,
  opts?: { isOwnMessage?: boolean }
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = new RegExp(URL_REGEX.source, URL_REGEX.flags);

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const url = match[0];
    const href = url.startsWith("http") ? url : `https://${url}`;
    parts.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`underline decoration-1 underline-offset-2 transition-colors hover:decoration-2 ${
          opts?.isOwnMessage
            ? "text-blue-200 hover:text-white"
            : "text-blue-400 hover:text-blue-300"
        }`}
      >
        {url}
      </a>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 0) return text;
  return <>{parts}</>;
}

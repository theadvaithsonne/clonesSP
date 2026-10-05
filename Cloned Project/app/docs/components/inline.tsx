import React from "react";

/**
 * Markdown-lite for doc prose: **bold**, *emphasis*, `code`, and [text](href).
 * Deliberately tiny — the content is ours, so there is nothing to sanitise
 * and no reason to carry a parser.
 *
 * Bold comes first in the alternation so `**x**` never falls through to the
 * emphasis branch.
 */
const PATTERN = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

export function inline(text: string): React.ReactNode[] {
  return text.split(PATTERN).filter(Boolean).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const [, label, href] = link;
      const external = href.startsWith("http");
      return (
        <a
          key={i}
          href={href}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          {label}
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

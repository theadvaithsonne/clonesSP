"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SEARCH_INDEX, type SearchEntry } from "../content";

type Hit = SearchEntry & { at: number };

/** Rank by where the match falls: a title hit beats a hit deep in a paragraph. */
function search(query: string): Hit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  const hits: Hit[] = [];
  for (const entry of SEARCH_INDEX) {
    const at = entry.text.toLowerCase().indexOf(needle);
    const inSection = entry.section?.toLowerCase().includes(needle);
    const inChapter = entry.chapter.toLowerCase().includes(needle);
    if (at < 0 && !inSection && !inChapter) continue;
    hits.push({ ...entry, at: at < 0 ? 400 : at });
  }
  return hits
    .sort((a, b) => {
      const weight = (h: Hit) => (h.kind === "chapter" ? -100 : h.kind === "section" ? -50 : 0);
      return weight(a) + a.at - (weight(b) + b.at);
    })
    .slice(0, 24);
}

/** Show the text around the match rather than the start of the block. */
function excerpt(text: string, at: number, length: number) {
  const from = Math.max(0, at - 32);
  const head = from > 0 ? "…" : "";
  const before = text.slice(from, at);
  const match = text.slice(at, at + length);
  const after = text.slice(at + length, at + length + 110);
  return (
    <span>
      {head}
      {before}
      <mark>{match}</mark>
      {after}
    </span>
  );
}

export default function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => search(query), [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  function go(hit: Hit) {
    const base = `/docs/${hit.chapterSlug}`;
    router.push(hit.sectionId ? `${base}#${hit.sectionId}` : base);
    onClose();
  }

  function onKey(event: React.KeyboardEvent) {
    if (event.key === "Escape") return onClose();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, hits.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    }
    if (event.key === "Enter" && hits[cursor]) {
      event.preventDefault();
      go(hits[cursor]);
    }
  }

  return (
    <div
      className="doc-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="doc-palette" role="dialog" aria-label="Search the manual">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKey}
          placeholder="Search chapters, flows, routes and events"
          aria-label="Search"
        />

        <div className="doc-results" ref={listRef}>
          {query.trim().length < 2 ? (
            <p className="doc-empty">
              Type at least two characters. Everything is indexed — prose, flow steps,
              route paths and socket event names.
            </p>
          ) : hits.length === 0 ? (
            <p className="doc-empty">
              Nothing matches “{query.trim()}”. Try a route path, a hook name, or an
              event like <code>knock</code>.
            </p>
          ) : (
            hits.map((hit, i) => (
              <button
                key={`${hit.chapterSlug}-${hit.sectionId}-${i}`}
                className="doc-result"
                data-active={i === cursor}
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(hit)}
              >
                <i>
                  {String(hit.chapterNumber).padStart(2, "0")} {hit.chapter}
                </i>
                <b>{hit.section ?? hit.chapter}</b>
                {/* A heading's only text is its own title — repeating it under
                    itself tells the reader nothing. */}
                {hit.kind !== "section" && excerpt(hit.text, hit.at, query.trim().length)}
              </button>
            ))
          )}
        </div>

        <footer>
          <span>↑↓ move</span>
          <span>↵ open</span>
          <span>esc close</span>
        </footer>
      </div>
    </div>
  );
}

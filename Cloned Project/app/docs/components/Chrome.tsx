"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import { PARTS } from "../content";
import Palette from "./Palette";

/**
 * Top bar, chapter navigation and the search palette.
 *
 * The nav is a drawer below 860px and a sticky rail above it; the same markup
 * serves both, with `data-open` doing the work. Pages supply the main column
 * and the "on this page" rail as children.
 */
export default function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Close the drawer on navigation — leaving it open over the new page is the
  // classic mobile-docs annoyance.
  useEffect(() => setNavOpen(false), [pathname]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const current = pathname === "/docs" ? "" : pathname.replace("/docs/", "");

  return (
    <>
      <header className="doc-bar">
        <button
          className="doc-menubtn"
          onClick={() => setNavOpen((open) => !open)}
          aria-label={navOpen ? "Close contents" : "Open contents"}
          aria-expanded={navOpen}
        >
          {navOpen ? <X size={16} /> : <Menu size={16} />}
        </button>

        <Link href="/docs" className="doc-mark">
          Garage <i>/</i> Docs
        </Link>

        <div className="doc-bar-spacer" />

        <button className="doc-searchbtn" onClick={() => setSearchOpen(true)}>
          <Search size={13} />
          <span>Search the manual</span>
          <kbd>⌘K</kbd>
        </button>

        <a className="doc-applink" href="/workspace">
          Open workspace
        </a>
      </header>

      {navOpen && (
        <div className="doc-navscrim" onClick={() => setNavOpen(false)} aria-hidden="true" />
      )}

      <div className="doc-frame">
        <nav className="doc-nav" data-open={navOpen} aria-label="Contents">
          <Link
            href="/docs"
            className="doc-navlink doc-navlink-top"
            data-active={current === ""}
          >
            Contents
          </Link>

          {PARTS.map((part) => (
            <div key={part.name}>
              <div className="doc-part">{part.name}</div>
              {part.chapters.map((chapter) => (
                <Link
                  key={chapter.slug}
                  href={`/docs/${chapter.slug}`}
                  className="doc-navlink"
                  data-active={current === chapter.slug}
                >
                  <em>{String(chapter.number).padStart(2, "0")}</em>
                  <span>{chapter.title}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {children}
      </div>

      {searchOpen && <Palette onClose={() => setSearchOpen(false)} />}
    </>
  );
}

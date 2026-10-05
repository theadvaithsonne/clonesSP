import Link from "next/link";
import type { Chapter } from "../content/types";
import { neighbours, outline } from "../content";
import Blocks from "./Blocks";
import OnThisPage from "./OnThisPage";

/** The shared body of every chapter: title block, content, pagination, rail. */
export default function ChapterPage({ chapter }: { chapter: Chapter }) {
  const { prev, next } = neighbours(chapter.slug);
  const href = (c: Chapter) => `/docs/${c.slug}`;

  return (
    <>
      <main className="doc-main">
        <header className="doc-title">
          <div className="doc-title-meta">
            <b>Chapter {String(chapter.number).padStart(2, "0")}</b>
            <i aria-hidden="true" />
            <span>{chapter.part}</span>
          </div>
          <h1>{chapter.title}</h1>
          <p>{chapter.blurb}</p>
        </header>

        <Blocks blocks={chapter.blocks} />

        <nav className="doc-pager">
          {prev && (
            <Link href={href(prev)} data-dir="prev">
              <span>← Chapter {String(prev.number).padStart(2, "0")}</span>
              <strong>{prev.title}</strong>
            </Link>
          )}
          {next && (
            <Link href={href(next)} data-dir="next">
              <span>Chapter {String(next.number).padStart(2, "0")} →</span>
              <strong>{next.title}</strong>
            </Link>
          )}
        </nav>
      </main>

      <OnThisPage items={outline(chapter)} />
    </>
  );
}

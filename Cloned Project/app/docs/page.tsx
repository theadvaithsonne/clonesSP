import Link from "next/link";
import { CHAPTERS, PARTS } from "./content";
import OfficeSection from "./components/OfficeSection";

const flowCount = CHAPTERS.reduce(
  (n, chapter) =>
    n + chapter.blocks.filter((b) => b.type === "flow" || b.type === "sequence").length,
  0
);

/** Routes and socket events spelled out by name, across every chapter. */
const referenceCount = CHAPTERS.reduce(
  (n, chapter) =>
    n +
    chapter.blocks.reduce(
      (m, b) => m + (b.type === "routes" || b.type === "events" ? b.items.length : 0),
      0
    ),
  0
);

export default function DocsHome() {
  return (
    <>
      <main className="doc-main doc-front">
        <section className="doc-hero">
          <div>
            <h1>
              The office
              <i>has floors.</i>
            </h1>
            <p>
              Garage is a workspace your team stands inside rather than a dashboard
              they visit. This manual covers all of it — how the building works, every
              app running in it, and the architecture underneath.
            </p>
            <div className="doc-hero-stats">
              <div>
                <b>{CHAPTERS.length}</b>
                chapters
              </div>
              <div>
                <b>{flowCount}</b>
                diagrams
              </div>
              <div>
                <b>{referenceCount}</b>
                routes &amp; events
              </div>
            </div>
          </div>
          <figure className="doc-hero-figure">
            <OfficeSection />
            <figcaption>
              Floors hold departments and meeting rooms. Everyone signed in is
              standing somewhere, and you can see where.
            </figcaption>
          </figure>
        </section>

        <div className="doc-front-lead">
          <h2>Where to start</h2>
          <p>
            If you are new to Garage, read chapters one to four in order — they explain
            the organisation model, how people get in, and the office itself. Everything
            after that is a section you can drop into on its own.
          </p>
          <p>
            If you are here to change the code, the last chapter has the route map, the
            state layout, the environment variables, and the one thing that actually
            proves a change works in this repository.
          </p>
        </div>

        <nav className="doc-contents">
          {PARTS.map((part) => (
            <section key={part.name}>
              <h2>{part.name}</h2>
              <div className="doc-contents-list">
                {part.chapters.map((chapter) => (
                  <Link key={chapter.slug} href={`/docs/${chapter.slug}`}>
                    <em>{String(chapter.number).padStart(2, "0")}</em>
                    <div>
                      <h3>{chapter.title}</h3>
                      <p>{chapter.blurb}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </main>

      <aside className="doc-toc">
        <h2>Parts</h2>
        {PARTS.map((part) => (
          <a key={part.name} href={`/docs/${part.chapters[0].slug}`}>
            {part.name}
          </a>
        ))}
      </aside>
    </>
  );
}

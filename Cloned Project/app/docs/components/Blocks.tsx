import type { Block } from "../content/types";
import { inline } from "./inline";
import FlowRail from "./FlowRail";
import SequenceDiagram from "./SequenceDiagram";

const NOTE_KIND = {
  info: "note",
  warn: "watch out",
  limit: "known limit",
} as const;

export default function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="doc-body">
      {blocks.map((block, i) => (
        <One key={i} block={block} />
      ))}
    </div>
  );
}

function One({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return (
        <div className="doc-h2" id={block.id}>
          <h2>{block.text}</h2>
          <a href={`#${block.id}`} aria-label={`Link to ${block.text}`}>
            #
          </a>
        </div>
      );

    case "prose":
      return (
        <>
          {block.text.map((paragraph, i) => (
            <p key={i}>{inline(paragraph)}</p>
          ))}
        </>
      );

    case "list":
      return block.ordered ? (
        <ol className="doc-ol">
          {block.items.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ol>
      ) : (
        <ul className="doc-ul">
          {block.items.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ul>
      );

    case "spec":
      return (
        <dl className="doc-spec">
          {block.items.map((item) => (
            <div key={item.term}>
              <dt>{inline(item.term)}</dt>
              <dd>{inline(item.def)}</dd>
            </div>
          ))}
        </dl>
      );

    case "grid":
      return (
        <div className="doc-grid">
          {block.items.map((item) => (
            <div key={item.title}>
              <h3>{item.title}</h3>
              <p>{inline(item.note)}</p>
            </div>
          ))}
        </div>
      );

    case "table":
      return (
        <div className="doc-tablewrap">
          <table className="doc-table">
            <thead>
              <tr>
                {block.head.map((cell) => (
                  <th key={cell}>{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{inline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {block.caption && <p className="doc-caption">{inline(block.caption)}</p>}
        </div>
      );

    case "note":
      return (
        <aside className="doc-note" data-tone={block.tone}>
          <span className="doc-note-kind">{NOTE_KIND[block.tone]}</span>
          {block.title && <h4>{block.title}</h4>}
          <p>{inline(block.text)}</p>
        </aside>
      );

    case "routes":
      return (
        <div>
          <div className="doc-ref">
            {block.items.map((item) => (
              <div key={item.path}>
                <code>{item.path}</code>
                <div>
                  <p>{inline(item.note)}</p>
                  {item.file && <small>{item.file}</small>}
                </div>
              </div>
            ))}
          </div>
          {block.caption && <p className="doc-caption">{inline(block.caption)}</p>}
        </div>
      );

    case "events":
      return (
        <div>
          <div className="doc-ref">
            {block.items.map((item) => (
              <div key={item.name}>
                <code>{item.name}</code>
                <p>
                  <span className="doc-dir" data-dir={item.dir}>
                    {item.dir === "out" ? "emit" : item.dir === "in" ? "listen" : "both"}
                  </span>
                  {inline(item.note)}
                </p>
              </div>
            ))}
          </div>
          {block.caption && <p className="doc-caption">{inline(block.caption)}</p>}
        </div>
      );

    case "code":
      return (
        <div className="doc-code">
          <pre>
            <code>{block.text}</code>
          </pre>
          {block.caption && <p className="doc-caption">{inline(block.caption)}</p>}
        </div>
      );

    case "flow":
      return <FlowRail flow={block.flow} />;

    case "sequence":
      return <SequenceDiagram sequence={block.sequence} />;

    default:
      return null;
  }
}

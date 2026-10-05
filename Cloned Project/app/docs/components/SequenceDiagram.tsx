import type { Sequence } from "../content/types";

/**
 * Actor lanes with dashed lifelines and labelled arrows between them.
 *
 * Lane centres are computed as percentages so the whole thing scales with the
 * column and needs no measurement pass: lane i sits at (i + 0.5) / n.
 * A solid amber arrow is a call; a dashed teal one is a response or an
 * asynchronous push.
 */
export default function SequenceDiagram({ sequence }: { sequence: Sequence }) {
  const n = sequence.actors.length;
  const lane = (i: number) => ((i + 0.5) / n) * 100;
  const columns = `repeat(${n}, 1fr)`;

  return (
    <figure className="doc-seq">
      <div className="doc-flow-head">
        <h3>{sequence.title}</h3>
        <span>sequence</span>
      </div>
      {sequence.summary && <p className="doc-flow-summary">{sequence.summary}</p>}

      <div className="doc-seq-actors" style={{ gridTemplateColumns: columns }}>
        {sequence.actors.map((actor) => (
          <div key={actor}>{actor}</div>
        ))}
      </div>

      <div className="doc-seq-body">
        <div className="doc-seq-lifelines" style={{ gridTemplateColumns: columns }} aria-hidden="true">
          {sequence.actors.map((actor) => (
            <span key={actor} />
          ))}
        </div>

        {sequence.messages.map((message, i) => {
          const from = lane(message.from);
          const to = lane(message.to);
          const rightward = to > from;
          return (
            <div key={i}>
              {message.phase && <div className="doc-seq-phase">{message.phase}</div>}
              <div className="doc-seq-msg">
                <div
                  className="doc-seq-arrow"
                  data-to={rightward ? "right" : "left"}
                  data-dashed={message.dashed ? "true" : "false"}
                  style={{
                    left: `${Math.min(from, to)}%`,
                    width: `${Math.abs(to - from)}%`,
                  }}
                >
                  <em>{message.label}</em>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

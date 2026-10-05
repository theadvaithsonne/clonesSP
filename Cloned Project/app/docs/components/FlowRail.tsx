import type { Flow, FlowStep } from "../content/types";
import { inline } from "./inline";

/**
 * A flow as a vertical rail rather than a canvas of boxes.
 *
 * Each step is a row: a marker in the gutter, the label, and the actor on the
 * right. The connector is the rail itself, so direction is legible without an
 * arrowhead on every edge. A decision opens sub-rails, one per branch, each
 * headed by the condition that leads into it.
 */

const GLYPH: Record<string, string> = {
  start: "▸",
  step: "",
  wait: "",
  decision: "",
  end: "■",
  fail: "!",
};

function Step({ step }: { step: FlowStep }) {
  const kind = step.kind || "step";
  return (
    <div className="doc-step">
      <div className="doc-node" data-kind={kind} aria-hidden="true">
        <span>{GLYPH[kind] ?? ""}</span>
      </div>
      <div>
        <div className="doc-step-line">
          <span className="doc-step-label">{inline(step.label)}</span>
          {step.actor && <span className="doc-step-actor">{step.actor}</span>}
        </div>
        {step.detail && <div className="doc-step-detail">{inline(step.detail)}</div>}
      </div>
      {step.branches && (
        <div className="doc-branches">
          {step.branches.map((branch) => (
            <div className="doc-branch" key={branch.on}>
              <span className="doc-branch-on">{branch.on}</span>
              {branch.steps.map((s, i) => (
                <Step key={i} step={s} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FlowRail({ flow }: { flow: Flow }) {
  return (
    <figure className="doc-flow">
      <div className="doc-flow-head">
        <h3>{flow.title}</h3>
        <span>flow</span>
      </div>
      {flow.summary && <p className="doc-flow-summary">{inline(flow.summary)}</p>}
      <div className="doc-rail">
        {flow.steps.map((step, i) => (
          <Step key={i} step={step} />
        ))}
      </div>
    </figure>
  );
}

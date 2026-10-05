"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { FunnelNode, FunnelTemplate } from "@/lib/funnel-tree";
import type { FunnelLink } from "@/lib/api/funnels";
import { StructureTree } from "./structure-tree";
import { NodeInspector } from "./node-inspector";
import { PreviewCanvas } from "./preview-canvas";
import {
  type Path,
  addChild,
  deleteNode,
  getNode,
  moveNode,
  newNode,
  normalizeOrders,
  pathsEqual,
  updateNode,
} from "./tree-ops";

/** Labels from the root options down to `path` — for the inspector breadcrumb. */
function trail(tpl: FunnelTemplate, path: Path): string[] {
  const out: string[] = [];
  let nodes = tpl.options;
  path.forEach((i, depth) => {
    const n = nodes[i];
    if (!n) return;
    out.push(n.label || `Option ${i + 1}${depth > 0 ? " (sub)" : ""}`);
    nodes = n.children;
  });
  return out;
}

export interface FunnelStudioProps {
  template: FunnelTemplate;
  onSave: (tpl: FunnelTemplate) => void;
  uploadFn: (file: File) => Promise<{ key: string; publicUrl: string }>;
  /** The funnel's attached product, if any — makes the preview end on the
   *  product CTA instead of the sign-up screen. */
  endLink?: FunnelLink | null;
  /** Reports draft-vs-saved state up so the host page's toolbar can render
   *  the unsaved indicator / Save button next to the name it saves. */
  onDirtyChange?: (dirty: boolean) => void;
}

/** Imperative handle so the host page's Save button can trigger a save
 *  without FunnelStudio handing its draft state (and the normalizeOrders
 *  call over it) to the page. FunnelStudio keeps owning both — only the
 *  button's presentation moves. */
export interface FunnelStudioHandle {
  save: () => void;
}

export const FunnelStudio = forwardRef<FunnelStudioHandle, FunnelStudioProps>(
  function FunnelStudio({ template, onSave, uploadFn, endLink, onDirtyChange }, ref) {
    const [draft, setDraft] = useState<FunnelTemplate>(template);
    const [loadedId, setLoadedId] = useState<string>(() => JSON.stringify(template));
    const [selected, setSelected] = useState<Path | null>(null);

    // Re-sync when the server value changes (guarded; avoids setState-in-effect).
    const serverId = JSON.stringify(template);
    if (serverId !== loadedId) {
      setDraft(template);
      setLoadedId(serverId);
    }

    const dirty = JSON.stringify(draft) !== loadedId;
    const selectedNode = selected ? getNode(draft, selected) : null;

    useEffect(() => {
      onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    useImperativeHandle(
      ref,
      () => ({
        save: () => onSave(normalizeOrders(draft)),
      }),
      [draft, onSave]
    );

    const patchSelected = (patch: Partial<FunnelNode>) => {
      if (!selected) return;
      setDraft(updateNode(draft, selected, (n) => ({ ...n, ...patch })));
    };
    const addOption = () => {
      setDraft(addChild(draft, [], newNode(draft.options.length)));
      setSelected([draft.options.length]);
    };
    const addSubOption = (parent: Path) => {
      const parentNode = getNode(draft, parent);
      const childIndex = parentNode ? parentNode.children.length : 0;
      setDraft(
        updateNode(draft, parent, (n) => ({
          ...n,
          videos: [],
          children: [...n.children, newNode(childIndex)],
        }))
      );
      setSelected([...parent, childIndex]);
    };
    const removeNode = (path: Path) => {
      setDraft(deleteNode(draft, path));
      if (
        selected &&
        (pathsEqual(selected, path) ||
          (selected.length > path.length && path.every((v, i) => v === selected[i])))
      ) {
        setSelected(null);
      }
    };
    const move = (path: Path, dir: "up" | "down") => {
      setDraft(moveNode(draft, path, dir));
      if (pathsEqual(selected, path)) {
        const j = dir === "up" ? path[path.length - 1] - 1 : path[path.length - 1] + 1;
        setSelected([...path.slice(0, -1), j]);
      }
    };

    return (
      <div className="flex h-full min-h-0 flex-col bg-[#080808]">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <div className="w-full shrink-0 border-b border-white/[0.06] p-4 lg:h-full lg:w-[440px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-zinc-500">
              Structure
            </p>
            <StructureTree
              template={draft}
              selected={selected}
              onSelect={setSelected}
              onAddOption={addOption}
              onAddChild={addSubOption}
              onDelete={removeNode}
              onMove={move}
            />

            <div className="my-5 h-px bg-white/[0.06]" />

            <p className="mb-3 flex flex-wrap items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-zinc-500">
              Editing ·{" "}
              {selected === null ? (
                <span className="text-zinc-400">opening question</span>
              ) : (
                trail(draft, selected).map((label, i, arr) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className={i === arr.length - 1 ? "text-brand" : "text-zinc-400"}>
                      {label}
                    </span>
                    {i < arr.length - 1 && <span className="text-zinc-600">▸</span>}
                  </span>
                ))
              )}
            </p>
            <NodeInspector
              selected={selected}
              node={selectedNode}
              rootQuestion={draft.rootQuestion}
              onRootQuestion={(v) => setDraft({ ...draft, rootQuestion: v })}
              onPatch={patchSelected}
              uploadFn={uploadFn}
            />
          </div>

          <div className="w-full p-4 lg:h-full lg:flex-1 lg:overflow-y-auto lg:p-8">
            <div className="flex min-h-full items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 lg:p-10">
              <PreviewCanvas
                template={draft}
                selected={selected}
                node={selectedNode}
                onSelect={setSelected}
                link={endLink}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

"use client";

import { useEffect, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

// Smallest a field can be resized to, as a fraction of the page.
const MIN_W = 0.02;
const MIN_H = 0.015;
const NUDGE = 0.002;
const NUDGE_BIG = 0.01;

export interface FieldBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PlacedFieldProps {
  box: FieldBox;
  accent: string;
  // False once the document has been sent — the box is then display-only.
  editable: boolean;
  selected: boolean;
  // The page wrapper's rect, read fresh at the start of every drag (the editor scrolls).
  getPageRect: () => DOMRect | null;
  onSelect: () => void;
  onChange: (patch: Partial<FieldBox>) => void;
  onRemove: () => void;
  children?: ReactNode;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

// A field placed on a PDF page. Draggable to move, corner handle to resize, arrow keys to nudge,
// Delete to remove — all in the same 0-1 page-fraction coordinates the backend stores, clamped so
// the box can never leave its page.
export function PlacedField({ box, accent, editable, selected, getPageRect, onSelect, onChange, onRemove, children }: PlacedFieldProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Always the latest callback, so a drag that outlives a re-render never calls a stale one.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Removes the window listeners of a drag in progress.
  const stopDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => stopDrag.current?.(), []);

  // Move/resize listen on `window` for the duration of the drag instead of relying on pointer
  // capture: a fast mouse leaves the box before it re-renders, and capture did not hold in that
  // case, so the drag would silently stop. Window listeners also see a release outside the field.
  const begin = (mode: "move" | "resize") => (e: ReactPointerEvent<HTMLElement>) => {
    if (!editable || e.button !== 0) return;
    // Don't let the page treat this as a click on empty space (which deselects), and don't start a
    // text selection while dragging.
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    ref.current?.focus({ preventScroll: true });
    const rect = getPageRect();
    if (!rect) return;

    stopDrag.current?.();
    const { clientX: startX, clientY: startY, pointerId } = e;
    const start = { ...box };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      if (mode === "move") {
        onChangeRef.current({ x: clamp(start.x + dx, 0, 1 - start.width), y: clamp(start.y + dy, 0, 1 - start.height) });
      } else {
        onChangeRef.current({
          width: clamp(start.width + dx, MIN_W, 1 - start.x),
          height: clamp(start.height + dy, MIN_H, 1 - start.y),
        });
      }
    };
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      stopDrag.current = null;
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId === pointerId) stop();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    stopDrag.current = stop;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!editable) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onRemove();
      return;
    }
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const dir = dirs[e.key];
    if (!dir) return;
    e.preventDefault();
    const step = e.shiftKey ? NUDGE_BIG : NUDGE;
    onChange({ x: clamp(box.x + dir[0] * step, 0, 1 - box.width), y: clamp(box.y + dir[1] * step, 0, 1 - box.height) });
  };

  return (
    <div
      ref={ref}
      tabIndex={editable ? 0 : undefined}
      onPointerDown={begin("move")}
      onKeyDown={onKeyDown}
      className={`group absolute flex items-center justify-center rounded border-2 text-[10px] font-medium outline-none ${
        editable ? "cursor-move select-none" : ""
      } ${selected ? "z-20 ring-2 ring-white/90 ring-offset-1 ring-offset-black/40" : ""}`}
      style={{
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.width * 100}%`,
        height: `${box.height * 100}%`,
        borderColor: accent,
        backgroundColor: accent + "22",
        // Without this a touch-drag scrolls the page instead of moving the field.
        touchAction: editable ? "none" : undefined,
      }}
    >
      {children}
      {editable && (
        <>
          <button
            type="button"
            aria-label="Remove field"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRemove}
            className={`absolute -right-2 -top-2 rounded-full bg-red-500 p-0.5 text-white ${selected ? "block" : "hidden group-hover:block"}`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
          {selected && (
            <span
              aria-label="Resize field"
              onPointerDown={begin("resize")}
              className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-indigo-500"
              style={{ touchAction: "none" }}
            />
          )}
        </>
      )}
    </div>
  );
}

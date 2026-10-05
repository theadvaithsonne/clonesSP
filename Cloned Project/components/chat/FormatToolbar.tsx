"use client";

import React, { RefObject, useEffect, useRef, useState } from "react";
import { Bold, Italic, Strikethrough, Code2, Braces } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormatToolbarProps {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  className?: string;
}

type Wrap = { left: string; right: string };

// Wrap the current textarea selection with prefix/suffix tokens. If the
// selection is already wrapped (e.g. user re-clicks Bold), the tokens are
// stripped instead — toggle behavior.
function wrapSelection(
  el: HTMLTextAreaElement,
  value: string,
  onChange: (next: string) => void,
  { left, right }: Wrap
) {
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const selected = value.slice(start, end);

  if (
    selected.startsWith(left) &&
    selected.endsWith(right) &&
    selected.length >= left.length + right.length
  ) {
    const inner = selected.slice(left.length, selected.length - right.length);
    const next = value.slice(0, start) + inner + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + inner.length);
    });
    return;
  }

  const next = value.slice(0, start) + left + selected + right + value.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    if (selected) {
      el.setSelectionRange(start + left.length, start + left.length + selected.length);
    } else {
      const pos = start + left.length;
      el.setSelectionRange(pos, pos);
    }
  });
}

function insertCodeBlock(
  el: HTMLTextAreaElement,
  value: string,
  onChange: (next: string) => void
) {
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);

  const needsLeadingNl = before.length > 0 && !before.endsWith("\n");
  const needsTrailingNl = after.length > 0 && !after.startsWith("\n");

  const prefix = `${needsLeadingNl ? "\n" : ""}\`\`\`\n`;
  const suffix = `\n\`\`\`${needsTrailingNl ? "\n" : ""}`;
  const body = selected || "";
  const next = before + prefix + body + suffix + after;
  onChange(next);

  requestAnimationFrame(() => {
    el.focus();
    const caret = before.length + prefix.length + body.length;
    el.setSelectionRange(
      before.length + prefix.length,
      before.length + prefix.length + body.length || caret
    );
  });
}

// Float the toolbar over the user's selection. We avoid measuring the exact
// caret position inside the textarea (the browser doesn't expose it) and
// instead anchor to the mouseup point — that's where the user just finished
// dragging. For keyboard selections (Shift+arrow), fall back to a position
// above the textarea.
export function FormatToolbar({
  inputRef,
  value,
  onChange,
  className,
}: FormatToolbarProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const lastMouseUp = useRef<{ x: number; y: number } | null>(null);

  // Show/hide the popover based on whether there is a non-empty selection in
  // the bound textarea. Re-runs whenever the textarea ref or its parent are
  // available.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const showFromSelection = () => {
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      if (start === end) {
        setPos(null);
        return;
      }
      // Prefer the last mouseup coordinate (it's where the drag ended). For
      // keyboard selections, fall back to the textarea's top-center.
      const rect = el.getBoundingClientRect();
      if (lastMouseUp.current) {
        const { x, y } = lastMouseUp.current;
        // Clamp to viewport so the toolbar never escapes the screen edges.
        const clampedX = Math.max(80, Math.min(window.innerWidth - 80, x));
        const top = Math.max(8, y - 48);
        setPos({ top, left: clampedX });
      } else {
        setPos({ top: Math.max(8, rect.top - 48), left: rect.left + rect.width / 2 });
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      lastMouseUp.current = { x: e.clientX, y: e.clientY };
      // Run after the browser commits the new selection state.
      setTimeout(showFromSelection, 0);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      // Only react to keys that can change selection.
      if (
        e.key === "Shift" ||
        e.key.startsWith("Arrow") ||
        e.key === "Home" ||
        e.key === "End" ||
        (e.ctrlKey || e.metaKey)
      ) {
        lastMouseUp.current = null;
        setTimeout(showFromSelection, 0);
      } else {
        // Any other key means the user is typing — close the popover.
        setPos(null);
      }
    };
    // Closing on blur is too aggressive because clicking a toolbar button
    // briefly blurs the textarea; we use a global mousedown handler instead.
    const onGlobalMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (target === el) return;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      setPos(null);
    };
    const onScroll = () => setPos(null);

    el.addEventListener("mouseup", onMouseUp);
    el.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousedown", onGlobalMouseDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousedown", onGlobalMouseDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [inputRef]);

  const apply = (wrap: Wrap) => {
    const el = inputRef.current;
    if (!el) return;
    wrapSelection(el, value, onChange, wrap);
    // The selection survives after wrapping, so the toolbar should remain
    // visible at the same anchor point. Nothing else to do.
  };

  const Btn = ({
    title,
    onClick,
    Icon,
  }: {
    title: string;
    onClick: () => void;
    Icon: React.ElementType;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep selection + textarea focus
      onClick={onClick}
      title={title}
      className="h-7 w-7 flex items-center justify-center rounded text-[#c7c7da] hover:text-white hover:bg-[#2E2E2E] transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );

  if (!pos) return null;

  return (
    <div
      ref={popoverRef}
      className={cn(
        "fixed z-[200] flex items-center gap-0.5 px-1 py-1 rounded-md border border-[#2E2E2E] bg-[#15151b] shadow-lg",
        className
      )}
      style={{
        top: pos.top,
        left: pos.left,
        transform: "translateX(-50%)",
      }}
      // Block mousedown bubbling so the global handler doesn't close us.
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Btn title="Bold (*text*)" onClick={() => apply({ left: "*", right: "*" })} Icon={Bold} />
      <Btn title="Italic (_text_)" onClick={() => apply({ left: "_", right: "_" })} Icon={Italic} />
      <Btn
        title="Strikethrough (~text~)"
        onClick={() => apply({ left: "~", right: "~" })}
        Icon={Strikethrough}
      />
      <div className="w-px h-4 bg-[#2E2E2E] mx-0.5" />
      <Btn
        title="Inline code (`text`)"
        onClick={() => apply({ left: "`", right: "`" })}
        Icon={Code2}
      />
      <Btn
        title="Code block (```)"
        onClick={() => {
          const el = inputRef.current;
          if (!el) return;
          insertCodeBlock(el, value, onChange);
        }}
        Icon={Braces}
      />
    </div>
  );
}

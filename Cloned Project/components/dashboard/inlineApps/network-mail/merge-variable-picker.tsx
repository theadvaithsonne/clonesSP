"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Lightbulb, Plus, Search, X, Zap } from "lucide-react";

import {
  MERGE_CATEGORY_HINTS,
  MERGE_VARIABLE_CATEGORY_ORDER,
  mergeToken,
  pickableTextVariables,
  sampleLabel,
  type MergeVariable,
  type MergeVariableCategory,
} from "./merge-variables";

/**
 * The no-code side of merge tags: a categorised "Dynamic Fields" popover in the
 * block toolbar and properties sidebar, plus an inline `@` / `{` autocomplete
 * inside the canvas.
 *
 * Both insert the plain `{{token}}` as text. Nothing is wrapped in markup — a
 * token can legitimately sit inside an attribute (`<a href="{{org_url}}">`), and
 * rewriting it into a styled span corrupted those anchors.
 */

/* ─── Selection helpers ───────────────────────────────────────────── */

/** The contentEditable host of the current selection, if there is one. */
export function editableFromSelection(): HTMLElement | null {
  if (typeof window === "undefined") return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node: Node | null = sel.getRangeAt(0).startContainer;
  while (node) {
    if (
      node instanceof HTMLElement &&
      node.getAttribute("contenteditable") === "true"
    ) {
      return node;
    }
    node = node.parentNode;
  }
  return null;
}

/**
 * Inserts `{{key}}` at the caret, optionally eating `deleteBack` characters
 * first (the `@name` the founder typed to summon the menu). Returns false when
 * the caret is not inside `editable`, so the caller can fall back to appending.
 */
export function insertTokenAtCaret(
  editable: HTMLElement,
  key: string,
  deleteBack = 0,
): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!editable.contains(range.startContainer)) return false;

  range.deleteContents();
  if (deleteBack > 0) {
    const node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      const offset = range.startOffset;
      range.setStart(node, Math.max(0, offset - deleteBack));
    }
    range.deleteContents();
  }

  const text = document.createTextNode(mergeToken(key));
  range.insertNode(text);

  const after = document.createRange();
  after.setStartAfter(text);
  after.collapse(true);
  sel.removeAllRanges();
  sel.addRange(after);
  editable.focus();
  return true;
}

/** Appends a token to the end of an editable — the no-selection fallback. */
export function appendToken(editable: HTMLElement, key: string): void {
  editable.appendChild(document.createTextNode(mergeToken(key)));
}

/* ─── Shared menu pieces ──────────────────────────────────────────── */

const MENU_WIDTH = 320;

function groupByCategory(
  variables: MergeVariable[],
): Array<[MergeVariableCategory, MergeVariable[]]> {
  return MERGE_VARIABLE_CATEGORY_ORDER.map(
    (category) =>
      [category, variables.filter((v) => v.category === category)] as [
        MergeVariableCategory,
        MergeVariable[],
      ],
  ).filter(([, items]) => items.length > 0);
}

/**
 * Two lines per row: what the field is, then the token it writes and a sample
 * of what the recipient will actually see.
 */
function VariableRow({
  variable,
  active,
  onPick,
}: {
  variable: MergeVariable;
  active: boolean;
  onPick: () => void;
}) {
  const Icon = variable.icon;
  const sample = sampleLabel(variable);

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
      title={mergeToken(variable.key)}
      className={`group w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors cursor-pointer ${
        active ? "bg-white/[0.08]" : "hover:bg-white/[0.08]"
      }`}
    >
      <span
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${variable.tint}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[12px] font-medium truncate transition-colors ${
            active ? "text-white" : "text-[#a8a8a8] group-hover:text-white"
          }`}
        >
          {variable.label}
        </span>
        <span className="block text-[10.5px] text-[#7a7a7a] truncate">
          <code>{mergeToken(variable.key)}</code>
          {sample ? ` • ${sample}` : ""}
        </span>
      </span>
      <span
        className={`shrink-0 h-5 px-1.5 rounded bg-brand/20 text-brand text-[10px] font-semibold flex items-center gap-0.5 transition-opacity ${
          active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        Insert <Plus className="h-2.5 w-2.5" />
      </span>
    </button>
  );
}

function CategoryHeading({ category }: { category: MergeVariableCategory }) {
  const hint = MERGE_CATEGORY_HINTS[category];
  return (
    <div className="flex items-baseline gap-1.5 px-3 pt-2.5 pb-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#7a7a7a]">
        {category}
      </span>
      {hint ? <span className="text-[10px] text-[#5f5f5f]">— {hint}</span> : null}
      <span className="flex-1 h-px bg-white/[0.06] ml-1" />
    </div>
  );
}

/**
 * The explainer that sits under the sidebar button. Founders repeatedly asked
 * what these fields even do, so the answer lives next to the control rather
 * than in a tooltip.
 */
export function DynamicFieldsHelper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2">
      <Lightbulb className="h-3.5 w-3.5 shrink-0 text-brand mt-[1px]" />
      <p className="text-[11px] leading-relaxed text-[#7a7a7a]">{children}</p>
    </div>
  );
}

/**
 * The sidebar unit: a full-width "Insert Dynamic Field" button with the
 * explainer directly beneath it. Every block's properties panel shows the same
 * pair, so the feature reads the same wherever a founder meets it.
 */
export function DynamicFieldsCard({
  onInsert,
  variables,
  label = "Insert Dynamic Field",
  hint,
}: {
  onInsert: (key: string) => void;
  variables?: MergeVariable[];
  label?: string;
  /** Overrides the default explainer where a block needs its own wording. */
  hint?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <VariablePickerButton
        variant="block"
        label={label}
        variables={variables}
        onInsert={onInsert}
      />
      <DynamicFieldsHelper>
        {hint ?? (
          <>
            <span className="font-semibold text-[#a8a8a8]">
              Personalize your email
            </span>
            : insert dynamic fields to automatically fill in the customer&apos;s
            name, order ID, or total when this email is sent.
          </>
        )}
      </DynamicFieldsHelper>
    </div>
  );
}

/* ─── "Dynamic Fields" picker ─────────────────────────────────────── */

type PickerVariant = "toolbar" | "block" | "icon";

/**
 * Borrowed wholesale from the properties panel's own controls (`PropInput`,
 * `SearchSelect`, `ToolbarBtn`) so the picker reads as part of Network Mail
 * rather than as a bolted-on widget.
 */
function triggerClasses(variant: PickerVariant, open: boolean): string {
  const field = `border bg-white/[0.04] transition-colors cursor-pointer ${
    open ? "border-brand/50" : "border-white/10 hover:border-white/20"
  }`;
  if (variant === "block") {
    return `w-full h-9 px-3 rounded-lg ${field} flex items-center gap-2 text-[13px] text-white`;
  }
  if (variant === "icon") {
    return `h-9 w-9 shrink-0 rounded-lg ${field} flex items-center justify-center text-brand`;
  }
  return `h-7 px-2 rounded flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
    open
      ? "bg-brand/20 text-brand"
      : "text-[#7a7a7a] hover:bg-white/[0.08] hover:text-white"
  }`;
}

export function VariablePickerButton({
  onInsert,
  variables,
  variant = "toolbar",
  label = "Dynamic Fields",
  title = "Insert recipient or order data",
}: {
  /** Called with the chosen key. The host decides where the token lands. */
  onInsert: (key: string) => void;
  variables?: MergeVariable[];
  variant?: PickerVariant;
  label?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // The menu's search box takes focus, which drops the canvas selection. The
  // caret is captured on mousedown — while it is still live — and put back
  // before inserting, so the token lands where the founder was typing.
  const savedRef = useRef<{ editable: HTMLElement; range: Range } | null>(null);

  const captureCaret = () => {
    const editable = editableFromSelection();
    const sel = window.getSelection();
    savedRef.current =
      editable && sel && sel.rangeCount > 0
        ? { editable, range: sel.getRangeAt(0).cloneRange() }
        : null;
  };

  const restoreCaret = () => {
    const saved = savedRef.current;
    if (!saved) return;
    saved.editable.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(saved.range);
  };

  const all = useMemo(() => variables ?? pickableTextVariables(), [variables]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (v) => v.label.toLowerCase().includes(q) || v.key.includes(q),
    );
  }, [all, query]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    // Right-aligned to the button: the properties panel sits against the
    // window edge, so a left-aligned menu would overflow it.
    setPos({
      top: rect.bottom + 6,
      left: Math.max(8, rect.right - MENU_WIDTH),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if ((target as HTMLElement)?.closest?.("[data-variable-menu]")) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (key: string) => {
    restoreCaret();
    onInsert(key);
    setOpen(false);
    setQuery("");
    savedRef.current = null;
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        // Keeps the canvas selection alive so the token lands at the caret
        // instead of at the end of the block.
        onMouseDown={(e) => {
          captureCaret();
          e.preventDefault();
        }}
        onClick={() => setOpen((o) => !o)}
        title={title}
        className={triggerClasses(variant, open)}
      >
        <Zap
          className={`h-3.5 w-3.5 shrink-0 ${
            variant === "block" ? "text-brand" : ""
          }`}
        />
        {variant !== "icon" && label ? (
          <span className="whitespace-nowrap">{label}</span>
        ) : null}
        {variant === "block" ? <span className="flex-1" /> : null}
        {variant !== "icon" ? (
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${
              variant === "block" ? "text-[#7a7a7a]" : ""
            } ${open ? "rotate-180" : ""}`}
          />
        ) : null}
      </button>

      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            data-variable-menu
            className="fixed z-[3000] flex flex-col max-h-[420px] rounded-lg border border-white/10 bg-[#1a1a1a] shadow-xl overflow-hidden"
            style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
          >
            <div className="shrink-0 p-2 border-b border-white/[0.06]">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-white">
                  <Zap className="h-3.5 w-3.5 text-brand" />
                  Dynamic Fields
                </span>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setOpen(false)}
                  className="h-6 w-6 rounded flex items-center justify-center text-[#7a7a7a] hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#7a7a7a]" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full h-7 pl-7 pr-2 rounded bg-white/[0.06] text-[12px] text-white placeholder:text-white/30 outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-[12px] text-[#7a7a7a]">
                  No fields match “{query.trim()}”
                </p>
              ) : (
                groupByCategory(filtered).map(([category, items]) => (
                  <div key={category}>
                    <CategoryHeading category={category} />
                    {items.map((v) => (
                      <VariableRow
                        key={v.key}
                        variable={v}
                        active={false}
                        onPick={() => pick(v.key)}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>

            <p className="shrink-0 px-3 py-2 border-t border-white/[0.06] text-[10.5px] leading-relaxed text-[#7a7a7a]">
              These fill with each recipient&apos;s real details when the email
              sends.
            </p>
          </div>,
          document.body,
        )}
    </>
  );
}

/* ─── Inline `@` / `{` autocomplete ───────────────────────────────── */

/** How far back from the caret a trigger is allowed to start. */
const MAX_QUERY_LEN = 24;

/**
 * `@` / `{` / `{{` at the start of a word, followed by the search so far.
 * Anchoring to a word boundary keeps an email address ("alex@example") from
 * summoning the menu mid-sentence.
 */
const TRIGGER_RE = new RegExp(
  `(?:^|[\\s\\u00a0(])(@|\\{\\{?)([A-Za-z0-9_ ]{0,${MAX_QUERY_LEN}})$`,
);

interface TriggerMatch {
  /** Characters between the caret and the trigger character, inclusive. */
  consumed: number;
  query: string;
  rect: DOMRect | null;
}

/**
 * Looks backwards from the caret for `@word`, `{word`, or `{{word`. Returns
 * null when the caret is not sitting in one, which closes the menu.
 */
function readTrigger(editable: HTMLElement): TriggerMatch | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!editable.contains(range.startContainer)) return null;
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;

  // Sliced from the start of the text node so the `^` alternative is genuine.
  const before = (node.textContent || "").slice(0, range.startOffset);
  const m = TRIGGER_RE.exec(before);
  if (!m) return null;
  const query = m[2];
  // A space is allowed inside the query ("member first") but two in a row means
  // the founder moved on and the trigger is stale.
  if (/\s\s/.test(query)) return null;

  const consumed = m[1].length + query.length;
  const probe = range.cloneRange();
  probe.collapse(true);
  const rects = probe.getClientRects();
  const rect: DOMRect = rects.length
    ? rects[0]
    : (editable.getBoundingClientRect() as DOMRect);
  return { consumed, query, rect };
}

export function MergeVariableAutocomplete({
  editableRef,
  onInserted,
  variables,
}: {
  /** Readonly so any `useRef<HTMLHeadingElement>` etc. is accepted. */
  editableRef: { readonly current: HTMLElement | null };
  /** Fired after the token is in the DOM, so the host can persist the block. */
  onInserted: () => void;
  variables?: MergeVariable[];
}) {
  const [trigger, setTrigger] = useState<TriggerMatch | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const all = useMemo(() => variables ?? pickableTextVariables(), [variables]);
  const matches = useMemo(() => {
    if (!trigger) return [];
    const q = trigger.query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (v) => v.label.toLowerCase().includes(q) || v.key.includes(q),
    );
  }, [all, trigger]);

  const close = useCallback(() => {
    setTrigger(null);
    setActiveIndex(0);
  }, []);

  const refresh = useCallback(() => {
    const el = editableRef.current;
    if (!el || document.activeElement !== el) {
      close();
      return;
    }
    const next = readTrigger(el);
    setTrigger(next);
    if (!next) setActiveIndex(0);
  }, [editableRef, close]);

  const pick = useCallback(
    (key: string) => {
      const el = editableRef.current;
      if (!el || !trigger) return;
      if (!insertTokenAtCaret(el, key, trigger.consumed)) {
        appendToken(el, key);
      }
      close();
      onInserted();
    },
    [editableRef, trigger, close, onInserted],
  );

  // Bound to the element rather than passed as React props so the block
  // renderers only have to hand over a ref.
  useEffect(() => {
    const el = editableRef.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!trigger || matches.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % matches.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(matches[Math.min(activeIndex, matches.length - 1)].key);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    const onKeyUp = () => refresh();
    const onBlur = () => window.setTimeout(close, 120);

    el.addEventListener("keydown", onKeyDown);
    el.addEventListener("keyup", onKeyUp);
    el.addEventListener("input", refresh);
    el.addEventListener("blur", onBlur);
    return () => {
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("keyup", onKeyUp);
      el.removeEventListener("input", refresh);
      el.removeEventListener("blur", onBlur);
    };
  }, [editableRef, trigger, matches, activeIndex, pick, refresh, close]);

  useEffect(() => {
    setActiveIndex(0);
  }, [trigger?.query]);

  if (!trigger || matches.length === 0 || typeof document === "undefined") {
    return null;
  }

  const rect = trigger.rect;
  const top = (rect?.bottom ?? 0) + 6;
  const left = Math.max(
    8,
    Math.min(rect?.left ?? 0, window.innerWidth - MENU_WIDTH - 8),
  );

  return createPortal(
    <div
      data-variable-menu
      className="fixed z-[3000] max-h-[320px] overflow-y-auto custom-scrollbar rounded-lg border border-white/10 bg-[#1a1a1a] shadow-xl py-1"
      style={{ top, left, width: MENU_WIDTH }}
    >
      <p className="sticky top-0 flex items-center gap-1.5 bg-[#1a1a1a] px-3 pt-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#7a7a7a]">
        <Zap className="h-3 w-3 text-brand" />
        Insert dynamic field
      </p>
      {matches.map((v, i) => (
        <VariableRow
          key={v.key}
          variable={v}
          active={i === Math.min(activeIndex, matches.length - 1)}
          onPick={() => pick(v.key)}
        />
      ))}
    </div>,
    document.body,
  );
}

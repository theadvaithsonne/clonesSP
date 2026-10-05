"use client";

// Small form/layout primitives shared by the wizard, the console and the web
// builder. Deliberately local to the events module: the app-wide `components/ui`
// wrappers are Radix-based and heavier than these need to be.
//
// The tokens below are lifted verbatim from ServiceFormModal so every founder
// create/edit surface reads as one product: #141414 cards on #262626
// hairlines, #1A1A1A inputs, #FBD10D focus and accent, bold uppercase
// micro-labels. If that form is restyled, restyle these with it.

import React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Loader2, X } from "lucide-react";

// Founder-side accent: the office's brand colour. Matches the Create Community / Create Product forms
// exactly — the public event site uses its own per-event `theme.primaryColor`
// and is deliberately not tied to this value.
export const GOLD = "var(--brand)";
export const GOLD_DIM = "color-mix(in srgb, var(--brand) 92%, black)";

export function Label({
  children,
  required,
  hint,
}: {
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
        {children}
        {required && <span className="ml-1 text-[#f87171]">*</span>}
      </label>
      {hint && <span className="text-[11px] text-zinc-500">{hint}</span>}
    </div>
  );
}

/**
 * A focused `<input type="number">` treats the wheel as a stepper, so scrolling
 * the form with the cursor over a price silently rewrites the amount. Dropping
 * focus on wheel keeps the scroll and leaves the value alone — preventDefault
 * would swallow the scroll itself.
 *
 * `TextInput` wires this up automatically for number inputs; raw `<input>`s
 * elsewhere in the module should attach it by hand.
 */
export const blurOnWheel = (e: React.WheelEvent<HTMLInputElement>) =>
  e.currentTarget.blur();

const inputClass =
  "w-full rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition-all focus:border-brand focus:ring-1 focus:ring-brand disabled:opacity-50";

export function TextInput({
  label,
  required,
  hint,
  className = "",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <Label required={required} hint={hint}>
          {label}
        </Label>
      )}
      <input
        {...rest}
        required={required}
        onWheel={rest.type === "number" ? blurOnWheel : rest.onWheel}
        className={inputClass}
      />
    </div>
  );
}

export function TextArea({
  label,
  required,
  hint,
  className = "",
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <Label required={required} hint={hint}>
          {label}
        </Label>
      )}
      <textarea {...rest} required={required} className={`${inputClass} resize-y`} />
    </div>
  );
}

export function Select({
  label,
  required,
  hint,
  options,
  className = "",
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className={className}>
      {label && (
        <Label required={required} hint={hint}>
          {label}
        </Label>
      )}
      <div className="relative">
        <select
          {...rest}
          className={`${inputClass} appearance-none pr-9 [&>option]:bg-[#1A1A1A]`}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      </div>
    </div>
  );
}

// ── Custom dropdown ──────────────────────────────────────────────────────

export type CustomSelectOption = {
  value: string;
  label: string;
  /** Greyed out and unselectable — used for slots outside the event range. */
  disabled?: boolean;
  /** Secondary line under the label, e.g. a room under a track. */
  description?: string;
  /** Leading dot, e.g. the track colour. */
  color?: string;
};

/**
 * A themed replacement for `<select>`.
 *
 * A native select paints its option list in the OS's own chrome — white on
 * macOS, blue-highlighted on Windows — which reads as a bug against these
 * #141414 cards. This renders the list itself, in a portal on `document.body`
 * so a modal's `overflow-y-auto` can't clip it, positioned against the
 * trigger's viewport rect and re-measured on scroll.
 *
 * The trigger is a button, not an input: `value` is controlled and `onChange`
 * fires with the raw value rather than a synthetic event.
 */
export function CustomSelect({
  label,
  required,
  hint,
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  className = "",
  triggerClassName = "",
  /** `sm` is the compact chip used for the agenda's filter bar. */
  size = "md",
  /** Rendered inside the trigger, before the selected label. */
  leading,
  "aria-label": ariaLabel,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  size?: "sm" | "md";
  leading?: React.ReactNode;
  "aria-label"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    flip: boolean;
  } | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const activeRef = React.useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value);

  const measure = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    // Only flip up when there is genuinely more room there — a dropdown that
    // jumps above the field it belongs to is worse than a short list.
    const flip = below < 200 && above > below;
    setPos({
      top: flip ? r.top - 6 : r.bottom + 6,
      left: r.left,
      width: r.width,
      maxHeight: Math.max(140, Math.min(280, flip ? above : below)),
      flip,
    });
  }, []);

  React.useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  React.useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => measure();
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // The dropdown is the innermost layer — don't let the modal behind it
      // close on the same keypress.
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    // `true` so a scroll inside the modal body, which does not bubble, still
    // moves the menu with its trigger.
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, measure]);

  // A 60-slot time list opens scrolled to the top otherwise, with the current
  // value nowhere on screen.
  React.useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: "center" });
  }, [open]);

  return (
    <div className={className}>
      {label && (
        <Label required={required} hint={hint}>
          {label}
        </Label>
      )}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || label}
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex w-full items-center gap-2 border bg-[#1A1A1A] text-left outline-none transition-all",
          size === "sm"
            ? "rounded-lg px-2.5 py-1.5 text-xs"
            : "rounded-xl px-4 py-3 text-sm",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open
            ? "border-brand ring-1 ring-brand"
            : "border-[#262626] hover:border-[#333333] focus:border-brand focus:ring-1 focus:ring-brand",
          triggerClassName,
        ].join(" ")}
      >
        {leading}
        {selected?.color && (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: selected.color }}
          />
        )}
        <span
          className={`min-w-0 flex-1 truncate ${
            selected ? "text-white" : "text-zinc-500"
          }`}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            className="fixed z-[900] overflow-y-auto overscroll-contain rounded-xl border border-[#262626] bg-[#141414] py-1 shadow-2xl [scrollbar-color:#333333_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#333333] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:bg-transparent"
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
              transform: pos.flip ? "translateY(-100%)" : undefined,
            }}
          >
            {options.length === 0 && (
              <div className="px-3 py-2.5 text-xs text-zinc-500">
                Nothing to pick
              </div>
            )}
            {options.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value}
                  ref={active ? activeRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={o.disabled}
                  onClick={() => {
                    if (o.disabled) return;
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={[
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                    o.disabled
                      ? "cursor-not-allowed text-zinc-600"
                      : "hover:bg-[#262626] hover:text-brand",
                    active ? "text-brand" : o.disabled ? "" : "text-zinc-200",
                  ].join(" ")}
                >
                  {o.color && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: o.color }}
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.description && (
                      <span className="block truncate text-[11px] text-zinc-500">
                        {o.description}
                      </span>
                    )}
                  </span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}

/**
 * The one switch the whole events module uses.
 *
 * Deliberately not the Radix `components/ui/switch`: that one paints its thumb
 * `bg-background` (#0c0c0e), which on these dark cards is the same colour as
 * the surface behind it — so a checked switch read as a solid gold pill with a
 * bite taken out of the right end rather than as a track plus knob. Here the
 * knob is always the higher-contrast element: near-black on gold when on,
 * light grey on charcoal when off.
 */
export function SwitchControl({
  checked,
  onChange,
  disabled,
  className = "",
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
        "disabled:cursor-not-allowed disabled:opacity-40",
        checked ? "border-transparent" : "border-[#3A3A3A] bg-[#262626]",
        className,
      ].join(" ")}
      style={checked ? { background: GOLD } : undefined}
    >
      <span
        className={[
          "pointer-events-none absolute h-[18px] w-[18px] rounded-full shadow-sm transition-transform duration-150",
          checked ? "translate-x-[23px] bg-black" : "translate-x-[3px] bg-zinc-400",
        ].join(" ")}
      />
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-1">
      <div className="min-w-0">
        <div className="text-sm text-white">{label}</div>
        {description && (
          <p className="mt-0.5 text-xs leading-5 text-[#7c7d94]">{description}</p>
        )}
      </div>
      <SwitchControl
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={label}
        className="mt-0.5"
      />
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[#c7c7da]">
      <span
        onClick={() => onChange(!checked)}
        className={[
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border backdrop-blur-sm transition-colors",
          checked
            ? "border-transparent shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand)_18%,transparent)]"
            : "border-white/15 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/30 hover:bg-white/[0.08]",
        ].join(" ")}
        style={checked ? { background: GOLD } : undefined}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="h-3 w-3 text-brand-foreground" fill="none">
            <path
              d="M2.5 6.2 4.8 8.5 9.5 3.8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span onClick={() => onChange(!checked)}>{label}</span>
    </label>
  );
}

export function Button({
  variant = "primary",
  loading,
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * "danger" is the quiet outline (red text on the card); "destructive" is the
   * solid red confirm button. Don't mix one with the other's classes — the
   * text colours fight and the label disappears red-on-red.
   */
  variant?: "primary" | "secondary" | "ghost" | "danger" | "destructive";
  loading?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50";
  const styles: Record<string, string> = {
    primary: "font-bold text-black shadow-md hover:brightness-95 active:scale-95",
    secondary:
      "border border-[#262626] text-zinc-300 hover:border-[#3A3A3A] hover:text-white",
    ghost: "bg-[#262626] text-zinc-300 hover:bg-[#303030] hover:text-white",
    danger: "border border-[#4a2020] text-[#f87171] hover:bg-[#f87171]/10",
    destructive:
      "border border-transparent bg-[#f87171] font-semibold text-[#1a0b0b] shadow-md hover:bg-[#ef5555] active:scale-95",
  };
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`${base} ${styles[variant]} ${className}`}
      style={variant === "primary" ? { background: GOLD, ...rest.style } : rest.style}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={`rounded-2xl border border-[#262626] bg-[#141414] ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-[#7c7d94]">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="text-[11px] uppercase tracking-widest text-[#7c7d94]">
        {label}
      </div>
      <div
        className="mt-2.5 text-2xl font-semibold tabular-nums"
        style={{ color: accent ? GOLD : "#ffffff" }}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-[#61627a]">{sub}</div>}
    </Card>
  );
}

/**
 * Seats listed as tickets against the event's capacity.
 *
 * Only admission tiers count — an add-on is an extra, not a seat. Every tier's
 * sales are capped at its own quantity, so keeping the listed total within
 * capacity is what keeps the tickets sold within it too.
 */
export function CapacityMeter({
  listed,
  capacity,
  fix = "Lower the ticket quantities or raise the capacity.",
}: {
  listed: number;
  capacity: number;
  /** What to do about it, shown once the tickets list too many seats. */
  fix?: string;
}) {
  const over = listed > capacity;
  const pct = capacity > 0 ? Math.min(100, Math.round((listed / capacity) * 100)) : 0;
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        over ? "border-[#f87171]/40 bg-[#f87171]/5" : "border-[#262626] bg-[#1A1A1A]"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-bold uppercase tracking-wider text-zinc-400">Seats listed</span>
        <span className={`font-semibold tabular-nums ${over ? "text-[#f87171]" : "text-white"}`}>
          {listed.toLocaleString()} / {capacity.toLocaleString()}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#262626]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: over ? "#f87171" : GOLD }}
        />
      </div>
      <p className={`mt-2 text-[11px] leading-4 ${over ? "text-[#f87171]" : "text-zinc-500"}`}>
        {over
          ? `Tickets list ${(listed - capacity).toLocaleString()} more seats than the event's capacity. ${fix}`
          : listed === capacity
            ? "Every seat is listed."
            : `${(capacity - listed).toLocaleString()} of ${capacity.toLocaleString()} seats not yet listed as tickets.`}
      </p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#262626] py-16 text-center">
      {icon && <div className="mb-4 text-[#3A3A3A]">{icon}</div>}
      <h3 className="text-sm font-bold text-white">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-zinc-400">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * Hides the dashboard's floating bottom bar for as long as an overlay is open.
 *
 * The bar sits at z-550 in the middle of the screen, which is exactly where a
 * dialog's footer buttons land. `bottom-tab:hide` / `bottom-tab:show` is the
 * existing convention for this — see ProductsPage and ConferenceRoomPage.
 */
export function useHideBottomBar(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    window.dispatchEvent(new CustomEvent("bottom-tab:hide"));
    return () => {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    };
  }, [active]);
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  useHideBottomBar(open);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className={`relative flex max-h-[90vh] w-full ${width} flex-col overflow-hidden rounded-2xl border border-[#262626] bg-[#141414] shadow-2xl`}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-[#262626] px-5 py-4">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-[#262626] hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
        {footer && (
          <footer className="flex shrink-0 justify-end gap-2 border-t border-[#262626] bg-[#141414] px-5 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

// ── Bottom-bar actions ───────────────────────────────────────────────────

/**
 * Icon keys the dashboard's floating bottom bar knows how to render. Kept as
 * strings because the action list crosses a CustomEvent boundary, where a
 * component reference would not survive.
 */
export type ConsoleActionIcon =
  | "plus"
  | "download"
  | "external"
  | "layers"
  | "publish"
  | "unpublish";

export type ConsoleAction = {
  /** Also the id echoed back on `events:action` when the tab is clicked. */
  id: string;
  label: string;
  icon: ConsoleActionIcon;
  disabled?: boolean;
  /** Tooltip explaining a disabled action. */
  title?: string;
};

/**
 * Subscribes a section to its bottom-bar action.
 *
 * Sections no longer render their own top-right button — the console publishes
 * the action list to the bottom bar and the click comes back here. Only one
 * section is mounted at a time, but ids stay section-prefixed so a stray event
 * can never fire the wrong handler.
 */
export function useConsoleAction(id: string, handler: () => void) {
  const ref = React.useRef(handler);
  ref.current = handler;
  React.useEffect(() => {
    const onAction = (event: Event) => {
      if ((event as CustomEvent<{ id?: string }>).detail?.id === id) ref.current();
    };
    window.addEventListener("events:action", onAction as EventListener);
    return () =>
      window.removeEventListener("events:action", onAction as EventListener);
  }, [id]);
}

// ── Confirmation ─────────────────────────────────────────────────────────

export type ConfirmOptions = {
  title: string;
  /** Body copy. Say what is lost, not just "are you sure". */
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button. Default for anything that destroys data. */
  destructive?: boolean;
};

/**
 * Promise-based replacement for `window.confirm`.
 *
 * The native dialog renders in the browser's own chrome — light, OS-blue,
 * prefixed with "localhost:3000 says" — which is jarring inside the dark
 * console and gives no room to explain the consequence. Usage mirrors the
 * builtin so call sites only gain an `await`:
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   if (!(await confirm({ title: `Delete "${t.name}"?` }))) return;
 *   ...
 *   return (<>{content}{confirmDialog}</>);
 */
export function useConfirm() {
  const [pending, setPending] = React.useState<{
    options: ConfirmOptions;
    resolve: (ok: boolean) => void;
  } | null>(null);

  const confirm = React.useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ options, resolve })),
    []
  );

  const settle = React.useCallback(
    (ok: boolean) => {
      setPending((p) => {
        p?.resolve(ok);
        return null;
      });
    },
    []
  );

  // Escape cancels, Enter confirms — same affordances as the native dialog.
  React.useEffect(() => {
    if (!pending) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        settle(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        settle(true);
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [pending, settle]);

  useHideBottomBar(!!pending);

  const options = pending?.options;
  const confirmDialog = pending ? (
    // Above the section modals (z-120) so a confirm raised from inside an
    // open editor still sits on top of it.
    <div className="fixed inset-0 z-[800] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => settle(false)}
      />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[#262626] bg-[#141414] shadow-2xl">
        <div className="px-5 pb-5 pt-5">
          <h3 className="text-base font-bold text-white">{options!.title}</h3>
          {options!.message && (
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {options!.message}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#262626] px-5 py-4">
          <Button variant="secondary" onClick={() => settle(false)}>
            {options!.cancelLabel || "Cancel"}
          </Button>
          <Button
            autoFocus
            variant={options!.destructive === false ? "primary" : "destructive"}
            onClick={() => settle(true)}
          >
            {options!.confirmLabel || "Delete"}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, confirmDialog };
}

/** `<input type="datetime-local">` wants `YYYY-MM-DDTHH:mm` in LOCAL time. */
export function toLocalInput(iso?: string | Date | null): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** Inverse of `toLocalInput` — a local-time string back to an ISO instant. */
export function fromLocalInput(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export const EVENT_CATEGORIES = [
  "Technology",
  "Web3",
  "Business",
  "Marketing",
  "Design",
  "Finance",
  "Health",
  "Education",
  "Community",
  "Other",
];

export const EVENT_LANGUAGES = [
  "English",
  "Hindi",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Arabic",
  "Mandarin",
  "Japanese",
];

/**
 * A short, stable timezone list plus the visitor's own zone, which is
 * pre-selected in the wizard. Intl.supportedValuesOf isn't available on every
 * browser we support, so this is a curated list rather than the full IANA set.
 */
export function timezoneOptions(): Array<{ value: string; label: string }> {
  const common = [
    "UTC",
    "America/Los_Angeles",
    "America/Denver",
    "America/Chicago",
    "America/New_York",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Africa/Lagos",
    "Africa/Johannesburg",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
  ];
  let local = "";
  try {
    local = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    local = "";
  }
  const zones = local && !common.includes(local) ? [local, ...common] : common;
  return zones.map((z) => ({ value: z, label: `${z}${offsetLabel(z)}` }));
}

function offsetLabel(zone: string): string {
  try {
    const s = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value;
    return s ? ` (${s})` : "";
  } catch {
    return "";
  }
}

export function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

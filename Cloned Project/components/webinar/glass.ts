/**
 * Liquid-glass class tokens for the floating webinar control overlay.
 *
 * The control bar now sits *on top of* the video stage instead of below it,
 * so every surface has to read as translucent glass over live video rather
 * than as an opaque chrome strip. Keeping the strings here means the bar,
 * the split buttons (mic / camera / speaker) and their popovers can't drift
 * apart visually.
 *
 * Recipe: heavy backdrop blur + saturation boost (so colour behind the glass
 * stays vivid), a dark translucent fill for contrast against bright video, a
 * hairline white border, and an inner top highlight that reads as a specular
 * reflection off the top edge.
 */

/** The floating pill that wraps the whole control cluster. */
export const GLASS_BAR = [
  "relative rounded-[28px]",
  "border border-white/[0.12]",
  "bg-black/60 backdrop-blur-2xl backdrop-saturate-150",
  "shadow-[0_18px_50px_-12px_rgba(0,0,0,0.95)]",
  // Inner top hairline — the specular reflection along the top edge.
  "before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px",
  "before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent",
].join(" ");

/** Shared geometry for every round control button. */
export const GLASS_BTN_SIZE = "h-10 w-10 sm:h-11 sm:w-11";

/** Base chrome shared by every control button (round + split faces). */
export const GLASS_BTN_BASE = [
  "relative flex items-center justify-center",
  "border transition-colors duration-150",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]",
].join(" ");

/** Default (inactive) glass button. */
export const GLASS_BTN_IDLE =
  "border-white/[0.12] bg-white/[0.09] text-white hover:bg-white/[0.18]";

/** Muted / disabled-track state (mic off, camera off, speaker off). */
export const GLASS_BTN_MUTED =
  "border-red-400/30 bg-red-500/25 text-red-300 hover:bg-red-500/35";

/** Destructive action (leave / end webinar) — always glowing. */
export const GLASS_BTN_DANGER =
  "border-red-400/40 bg-red-500/85 text-white hover:bg-red-500 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_24px_-4px_rgba(239,68,68,0.95)]";

/** Active states — a glowing tinted fill so "on" reads instantly over video. */
export const GLASS_BTN_ACTIVE_BLUE =
  "border-blue-300/40 bg-blue-500/85 text-white hover:bg-blue-500 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_22px_-4px_rgba(59,130,246,0.95)]";

export const GLASS_BTN_ACTIVE_GREEN =
  "border-emerald-300/40 bg-emerald-500/85 text-white hover:bg-emerald-500 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_22px_-4px_rgba(16,185,129,0.95)]";

export const GLASS_BTN_ACTIVE_YELLOW =
  "border-yellow-300/40 bg-yellow-500/85 text-white hover:bg-yellow-500 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_22px_-4px_rgba(234,179,8,0.95)]";

export const GLASS_BTN_ACTIVE_RED =
  "border-red-300/40 bg-red-500/85 text-white hover:bg-red-500 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_22px_-4px_rgba(239,68,68,0.95)]";

/** Disabled variant used by the pre-media "Join" button. */
export const GLASS_BTN_DISABLED =
  "disabled:border-white/[0.08] disabled:bg-white/[0.05] disabled:text-white/40 " +
  "disabled:cursor-not-allowed disabled:shadow-none";

/**
 * Popover / dropdown surface. Darker fill than the bar so stacked glass
 * still separates visually, with the same top hairline treatment.
 */
/*
 * NOTE: this token deliberately sets NO `position`. Every call site positions
 * its own surface (`absolute` for the bar popovers, inline `fixed` for the
 * portalled background picker) and Tailwind emits `relative` *after*
 * `absolute` in the stylesheet — so a `relative` here would win the cascade
 * regardless of class order, drop the menu back into normal flow and stretch
 * the control bar's flex row when it opened.
 */
export const GLASS_MENU = [
  "rounded-2xl",
  "border border-white/[0.14]",
  "bg-black/75 backdrop-blur-2xl backdrop-saturate-150",
  "shadow-[0_24px_64px_-12px_rgba(0,0,0,0.9)]",
  "before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:h-px",
  "before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent",
].join(" ");

/** Caption text under each control. */
export const GLASS_CAPTION =
  "text-[9px] sm:text-[10px] text-white/55 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]";

/** Outer shell for the split (face + chevron) controls. */
export const GLASS_SPLIT_SHELL =
  "flex items-center rounded-full overflow-hidden border transition-colors duration-150 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]";

export const GLASS_SPLIT_IDLE = "border-white/[0.12] bg-white/[0.09]";
export const GLASS_SPLIT_MUTED = "border-red-400/30 bg-red-500/25";

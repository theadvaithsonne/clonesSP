"use client";

import { useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { getUserDataFromToken } from "@/lib/auth";
import { getCurrentDomain } from "@/lib/whitelabel";

/**
 * BAT 246 "exclusive mode".
 *
 * While the signed-in session is scoped to the BAT 246 office (the org in the
 * JWT), the dashboard behaves as a single-purpose BAT 246 app: the sidebar
 * shows only the BAT 246 entry, login lands on bat246LandingPath(), and the
 * BAT 246 badge replaces the Garage logo. Switching to any other office
 * restores the normal Garage chrome.
 *
 * Keyed off the token's orgId, not a network call, so it is known on the very
 * first client render and the full Garage sidebar never flashes first.
 */
export const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";
export const BAT246_HOME_PATH = "/games/bat246";
/** Game Boards, where a member works toward qualifying as a distributor. */
export const BAT246_BOARDS_PATH = "/games/bat246/boards";
/**
 * The gold B2 coin — square, transparent corners, readable at icon size. One
 * image for the office icon (sidebar, mobile header) and the browser tab, so
 * they can't drift apart. A new filename rather than an overwrite of the old
 * badge so browsers can't keep showing the cached old favicon.
 */
export const BAT246_LOGO_SRC = "/images/bat246-favicon-b2.png";
/** Browser-tab icon on bat246.com — same coin as the office icon above. */
export const BAT246_FAVICON_SRC = BAT246_LOGO_SRC;
export const BAT246_DISPLAY_NAME = "BAT 246";

export function isBat246OrgId(orgId: string | null | undefined): boolean {
  return orgId === BAT246_ORG_ID;
}

/** Non-hook form, for event handlers and effects. */
export function isBat246Session(): boolean {
  return isBat246OrgId(getUserDataFromToken().orgId);
}

/**
 * Where a freshly-authenticated user should land when no explicit redirect
 * applies. `orgId` is the org the new token is scoped to.
 *
 * Synchronous, so it cannot tell a BAT 246 distributor from a newcomer and
 * always says the hub — logins should use resolveHomeFor() instead.
 */
export function defaultHomeFor(orgId: string | null | undefined): string {
  return isBat246OrgId(orgId) ? BAT246_HOME_PATH : "/workspace";
}

/**
 * Where a BAT 246 login lands: the hub for a qualified distributor, Game
 * Boards for everyone else — that is where qualifying happens, and the hub
 * gives a newcomer no obvious next step. Reads the token already saved, so
 * call it after saveToken() with the BAT 246-scoped token.
 *
 * A failed lookup also goes to Game Boards: the hub is one sidebar click
 * from there, while a newcomer left on the hub is stuck.
 */
export async function bat246LandingPath(): Promise<string> {
  try {
    const progress = await api<{ isQualified?: boolean }>(
      "/bat246/distributor/progress",
    );
    return progress?.isQualified ? BAT246_HOME_PATH : BAT246_BOARDS_PATH;
  } catch {
    return BAT246_BOARDS_PATH;
  }
}

/** defaultHomeFor() with the BAT 246 distributor check. Use after login. */
export async function resolveHomeFor(
  orgId: string | null | undefined,
): Promise<string> {
  return isBat246OrgId(orgId) ? bat246LandingPath() : "/workspace";
}

// The token only changes via a login / org switch (which navigates or
// reloads) or another tab, so the storage event is the only thing to follow.
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * Hydration-safe: the server snapshot is `false`, and React re-renders with
 * the real value before the first paint.
 */
export function useIsBat246Office(): boolean {
  return useSyncExternalStore(subscribe, isBat246Session, () => false);
}

/**
 * bat246.com (and www.) — the login and verify pages there get BAT 246
 * chrome (components/welcome/Bat246AuthChrome.tsx). Keyed off the hostname,
 * not the white-label lookup: the domain has to look right whether or not it
 * is registered to an office. Goes through getCurrentDomain() so its LOCAL
 * TESTING override exercises this too.
 */
export function isBat246Domain(): boolean {
  return /(^|\.)bat246\.com$/i.test(getCurrentDomain());
}

const subscribeNever = () => () => {};

/** The hostname never changes under a mounted page. */
export function useIsBat246Domain(): boolean {
  return useSyncExternalStore(subscribeNever, isBat246Domain, () => false);
}

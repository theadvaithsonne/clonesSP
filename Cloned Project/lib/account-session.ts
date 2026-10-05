/**
 * Moving the app between signed-in accounts.
 *
 * `lib/accounts` owns the ledger and the session keys; this owns everything
 * else the app believes about who is signed in — the persisted auth store and
 * the `user-data` / `auth-token` cookies the /api routes read. It is kept
 * separate from `lib/auth` so that module (imported by `lib/api`, and so by
 * nearly everything) doesn't pull the store in behind it.
 */

import Cookies from "js-cookie";

import {
  activateAccount,
  activateNextUsableAccount,
  forgetAccount,
  listAccounts,
  type StoredAccount,
} from "@/lib/accounts";
import { useAuthStore, type User } from "@/store/authStore";

/**
 * Point the auth store (and its cookies) at a ledger row.
 *
 * The store is persisted synchronously on write, so doing this before a hard
 * navigation is what makes the reload come up as the new account rather than
 * rehydrating the old user from localStorage.
 */
function adoptAccount(account: StoredAccount) {
  const user: Partial<User> = {
    userId: account.userId,
    email: account.email || "",
    name: account.name || "",
    organizationId: account.orgId || "",
    // Deliberately not carried over: role and the impersonation fields belong
    // to the outgoing session. `setUser` merges onto the CURRENT user, so
    // anything left unset here would silently keep the previous account's
    // value — hence the explicit reset.
    role: "",
    employeeId: undefined,
    clientId: undefined,
    startupbrokerRole: undefined,
    phone: null,
    phoneVerified: undefined,
    originalUserId: undefined,
    isSupportAgent: undefined,
    impersonatedUserId: undefined,
    impersonatedUserEmail: undefined,
    impersonatedUserName: undefined,
    impersonatedUserRole: undefined,
  };
  // Clear first so the merge in `setUser` can't carry a stale field across.
  useAuthStore.getState().setUser(null);
  useAuthStore.getState().setUser(user);
  Cookies.set("auth-token", account.token, {
    path: "/",
    secure: true,
    sameSite: "none",
    expires: 7,
  });
}

/** Wipe everything the app believes about the signed-out user. */
function forgetLiveIdentity() {
  useAuthStore.getState().setUser(null);
  Cookies.remove("auth-token", { path: "/" });
  Cookies.remove("user-data", { path: "/" });
}

/**
 * Switch the app to another remembered account and reload into it.
 *
 * A hard navigation rather than a router push: the socket, every cache and
 * every server-rendered payload on the page belongs to the outgoing user, and
 * a reload is the one way to be sure none of it survives the switch.
 *
 * Returns false when the account could not be activated (gone, or its token
 * lapsed). Nothing has been torn down in that case — the caller should say so
 * rather than navigating.
 */
export function switchToAccount(userId: string, landing = "/workspace"): boolean {
  const activated = activateAccount(userId);
  if (!activated) return false;
  adoptAccount(activated);
  // The per-tab "add account" flag and any post-login one-shots belong to
  // whoever set them; a stale one would misroute the incoming account.
  sessionStorage.clear();
  window.location.assign(landing);
  return true;
}

/**
 * Sign out of the account on screen, handing over to another if there is one.
 *
 * This is what makes sign-out mean the same thing here as in every other app
 * that supports several accounts: the others stay signed in, and only the last
 * one leaves the user signed out. `clearToken()` has already dropped the
 * outgoing row from the ledger by the time this looks for a successor.
 */
export function signOutActiveAccount(landing = "/"): void {
  const next = activateNextUsableAccount();
  if (next) {
    adoptAccount(next);
    sessionStorage.clear();
    window.location.assign(landing);
    return;
  }
  forgetLiveIdentity();
  window.location.assign(landing);
}

/** Sign out of every account in this browser. */
export function signOutAllAccounts(landing = "/"): void {
  for (const account of listAccounts()) forgetAccount(account.userId);
  forgetLiveIdentity();
  window.location.assign(landing);
}

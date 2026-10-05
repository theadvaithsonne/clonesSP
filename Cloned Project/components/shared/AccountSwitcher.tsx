"use client";

import { useEffect, useState } from "react";
import { Check, Plus, X } from "lucide-react";

import {
  activeUserId,
  beginAddAccount,
  forgetAccount,
  listAccounts,
  seedFromLiveSession,
  setAccountPicture,
  type StoredAccount,
} from "@/lib/accounts";
import { switchToAccount } from "@/lib/account-session";
import { api } from "@/lib/api";

/**
 * Account rows + "Add account", styled as plain buttons so they drop into the
 * sidebar's user menu alongside Logout — switching accounts and signing out
 * are the same decision from the user's side, and the chip at the bottom of
 * the sidebar is where people already look for it.
 *
 * Switching hard-reloads into the chosen account — the socket, the workspace
 * peer connections and every cache on the page belong to the outgoing user,
 * and a reload is the one way to be sure none of it survives.
 *
 * "Add account" goes through the ordinary login without ending the current
 * session, so backing out of it leaves the user exactly where they were.
 */
export default function AccountSwitcher({
  landing = "/workspace",
  onAction,
}: {
  /** Where a completed switch lands. */
  landing?: string;
  /** Lets the host popover close itself before the navigation starts. */
  onAction?: () => void;
}) {
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // localStorage is unreadable during SSR and the first client render, so
    // this resolves on mount. Seeding first means someone who signed in before
    // multi-account shipped still sees their own row here.
    const seeded = seedFromLiveSession();
    setAccounts(seeded);
    setActiveId(activeUserId());

    // Backfill the faces.
    //
    // The ledger is written from the JWT, which carries userId, name and email
    // but no picture — so a freshly-added account renders as initials. The
    // sidebar files the ACTIVE account's picture as it goes, but that leaves
    // every other row blank until the day someone happens to switch into it.
    //
    // /auth/me is per-account, so each row is asked with its OWN token. That
    // is the whole trick: a stored session is a usable credential, not just a
    // label, and it can answer for itself without being made active first.
    //
    // Entirely best-effort. A row that can't answer (offline, lapsed token)
    // keeps its initials, which is what it was showing anyway.
    let cancelled = false;
    const missing = seeded.filter((a) => !a.profilePicture);
    if (missing.length === 0) return;
    Promise.all(
      missing.map((account) =>
        api<{ user?: { profilePicture?: string } }>("/auth/me", {}, account.token)
          .then((res) => {
            const picture = res?.user?.profilePicture;
            return picture ? setAccountPicture(account.userId, picture) : false;
          })
          .catch(() => false)
      )
    ).then((changed) => {
      // Only re-render when a picture actually landed — `setAccountPicture`
      // reports that, so an all-miss backfill costs nothing.
      if (!cancelled && changed.some(Boolean)) setAccounts(listAccounts());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const doSwitch = (userId: string) => {
    setError(null);
    onAction?.();
    if (!switchToAccount(userId, landing)) {
      // The row's token had lapsed; activateAccount has already dropped it.
      setAccounts(listAccounts());
      setError("That account was signed out. Sign in again to use it.");
    }
  };

  const doForget = (event: React.MouseEvent, userId: string) => {
    // The row itself switches; this sits inside it, so it must not do both.
    event.stopPropagation();
    event.preventDefault();
    setAccounts(forgetAccount(userId));
  };

  const doAdd = () => {
    onAction?.();
    beginAddAccount();
    window.location.assign("/login");
  };

  const rowCls =
    "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[#22222c]";

  return (
    <div className="space-y-1 py-1">
      {accounts.map((account) => {
        const active = account.userId === activeId;
        const label = account.name || account.email || "Account";
        return (
          <button
            key={account.userId}
            type="button"
            onClick={() => {
              if (!active) doSwitch(account.userId);
            }}
            className={rowCls}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2a2a35] text-[11px] font-semibold text-white">
              {account.profilePicture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={account.profilePicture} alt="" className="h-full w-full object-cover" />
              ) : (
                initialsOf(label)
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] text-white">{label}</span>
              {account.email && account.name && (
                <span className="block truncate text-[11px] text-[#6a6a7a]">{account.email}</span>
              )}
            </span>
            {active ? (
              <Check className="h-4 w-4 shrink-0 text-brand-2" />
            ) : (
              <span
                role="button"
                tabIndex={0}
                aria-label={`Sign out of ${label}`}
                onClick={(e) => doForget(e, account.userId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") doForget(e as never, account.userId);
                }}
                className="shrink-0 rounded-lg p-1 text-[#6a6a7a] opacity-0 transition-opacity hover:text-red-500 focus:opacity-100 group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        );
      })}

      <button type="button" onClick={doAdd} className={rowCls}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-[#2a2a35] text-[#6a6a7a]">
          <Plus className="h-4 w-4" />
        </span>
        <span className="text-[14px] text-white">Add account</span>
      </button>

      {error && <p className="px-3 pb-1 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

function initialsOf(label: string): string {
  return (label.replace(/[^a-zA-Z]/g, "").slice(0, 2) || "U").toUpperCase();
}

"use client";

// The per-page access editor. Each delegatable page reads as a section — a
// bold title + description with a master toggle on the right (grant access
// on/off). When on, an indented panel shows Create / Update / Delete columns:
//   - a "Full access" row whose C/U/D checkmarks light up when the admin can
//     manage the page (create, update & delete), and
//   - for pages that split their writes (e.g. One Time Affiliates: assign
//     agent vs. mark NVC), one toggle row per action.
//
// The C/U/D marks are a read-only display of what a grant covers — the model
// enforces at the page/action level (manage = all writes), so they light up
// together. Three underlying states are preserved: master off = None, master
// on + Full off = View (read-only), Full on = Full (manage).
//
// Shared by AdminAccessMatrix (invite) and the Roles & Access page.

import { useMemo } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  actionKey,
  countGranted,
  type AdminPage,
  type AdminPageCatalogue,
  type AdminPageLevel,
} from "@/lib/admin-api/permissions";

/** Column template shared by the header row and every data row so the C/U/D
 *  marks line up under their labels. */
const ROW_COLS = "minmax(0,1fr) 64px 64px 64px";

/** A pill switch, gold when on — the single on/off control. */
function Switch({
  on,
  onChange,
  disabled,
  label,
}: {
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors",
        on ? "bg-brand" : "bg-white/[0.14]",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
      )}
    >
      <span
        className={cn(
          "inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform",
          on ? "translate-x-[18px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}

/** A single Create/Update/Delete cell — a soft box with a check when covered. */
function CrudCell({ on }: { on: boolean }) {
  return (
    <div className="flex justify-center">
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded",
          on ? "bg-white/[0.06]" : "bg-transparent",
        )}
      >
        {on && <Check className="h-3 w-3 text-zinc-400" />}
      </span>
    </div>
  );
}

/** Drop every "<page>:<action>" key for a page from a permission map. */
function withoutActions(
  map: Record<string, AdminPageLevel>,
  page: AdminPage
): Record<string, AdminPageLevel> {
  if (!page.actions?.length) return map;
  const next = { ...map };
  for (const a of page.actions) delete next[actionKey(page.key, a.key)];
  return next;
}

export default function AccessGrid({
  catalogue,
  permissions,
  onPermissionsChange,
  className,
}: {
  catalogue: AdminPageCatalogue;
  permissions: Record<string, AdminPageLevel>;
  onPermissionsChange: (next: Record<string, AdminPageLevel>) => void;
  className?: string;
}) {
  const grouped = useMemo(() => {
    const order: string[] = [];
    const byGroup = new Map<string, AdminPage[]>();
    for (const page of catalogue.pages) {
      if (!byGroup.has(page.group)) {
        byGroup.set(page.group, []);
        order.push(page.group);
      }
      byGroup.get(page.group)!.push(page);
    }
    return order.map((key) => ({
      key,
      title: catalogue.groupLabels[key] || key,
      pages: byGroup.get(key) || [],
    }));
  }, [catalogue]);

  const granted = countGranted(permissions);

  // Setting a page's level. Anything other than View clears its per-action
  // grants: Full subsumes them, None revokes them. View keeps them so the
  // per-action toggles can refine "read-only + these writes."
  const setPageLevel = (page: AdminPage, level: AdminPageLevel) => {
    let next: Record<string, AdminPageLevel> = { ...permissions, [page.key]: level };
    if (level !== "view") next = withoutActions(next, page);
    onPermissionsChange(next);
  };

  const toggleAccess = (page: AdminPage, level: AdminPageLevel) =>
    setPageLevel(page, level === "none" ? "view" : "none");

  const toggleFull = (page: AdminPage, level: AdminPageLevel) =>
    setPageLevel(page, level === "manage" ? "view" : "manage");

  const toggleAction = (page: AdminPage, actKey: string, on: boolean) => {
    const next = { ...permissions };
    const k = actionKey(page.key, actKey);
    if (on) {
      next[k] = "manage";
      if ((next[page.key] || "none") === "none") next[page.key] = "view";
    } else {
      delete next[k];
    }
    onPermissionsChange(next);
  };

  const setAllInGroup = (pages: AdminPage[], level: AdminPageLevel) => {
    let next: Record<string, AdminPageLevel> = { ...permissions };
    for (const page of pages) {
      next[page.key] = level;
      if (level !== "view") next = withoutActions(next, page);
    }
    onPermissionsChange(next);
  };

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        {grouped.map((group) => (
          <div key={group.key} className="border-b border-white/[0.06] last:border-b-0">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-[#181818]/95 px-5 py-2.5 backdrop-blur">
              <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                {group.title}
              </span>
              <div className="flex items-center gap-1">
                <span className="mr-0.5 text-[10px] text-zinc-600">Set all</span>
                {(
                  [
                    ["none", "Off"],
                    ["view", "View"],
                    ["manage", "Full"],
                  ] as [AdminPageLevel, string][]
                ).map(([option, label]) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setAllInGroup(group.pages, option)}
                    className="rounded-full px-2 py-0.5 text-[10px] text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {group.pages.map((page) => {
              const level = permissions[page.key] || "none";
              const on = level !== "none";
              const isFull = level === "manage";
              const hasActions = !!page.actions?.length;
              return (
                <div
                  key={page.key}
                  className="border-b border-white/[0.04] px-5 py-4 last:border-b-0"
                >
                  {/* Section header: title + description | master toggle */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold leading-snug text-zinc-100">
                        {page.label}
                      </div>
                      {page.manageHint && (
                        <div className="mt-0.5 text-[12px] leading-snug text-zinc-500">
                          {page.manageHint}
                        </div>
                      )}
                    </div>
                    <Switch
                      on={on}
                      onChange={() => toggleAccess(page, level)}
                      label={`Access to ${page.label}`}
                    />
                  </div>

                  {/* Panel with the Create / Update / Delete grid. */}
                  {on && (
                    <div className="mt-4">
                      {/* Column headers */}
                      <div
                        className="grid items-center gap-x-2 pb-2 text-[11px] font-medium text-zinc-500"
                        style={{ gridTemplateColumns: ROW_COLS }}
                      >
                        <span />
                        <span className="text-center">Create</span>
                        <span className="text-center">Update</span>
                        <span className="text-center">Delete</span>
                      </div>

                      {/* Full access row — the manage grant, C/U/D light together. */}
                      <div
                        className="grid items-center gap-x-2 border-t border-white/[0.05] py-2.5"
                        style={{ gridTemplateColumns: ROW_COLS }}
                      >
                        <div className="flex items-center gap-3">
                          <Switch
                            on={isFull}
                            onChange={() => toggleFull(page, level)}
                            label={`Full access to ${page.label}`}
                          />
                          <div className="min-w-0">
                            <div className="text-[13px] text-zinc-100">Full access</div>
                            <div className="text-[11px] text-zinc-500">
                              Create, update &amp; delete
                            </div>
                          </div>
                        </div>
                        <CrudCell on={isFull} />
                        <CrudCell on={isFull} />
                        <CrudCell on={isFull} />
                      </div>

                      {/* Per-action rows. Under Full they're all included, so
                          they show on + locked; otherwise each is grantable. */}
                      {hasActions &&
                        page.actions!.map((a) => {
                          const aOn =
                            isFull ||
                            permissions[actionKey(page.key, a.key)] === "manage";
                          return (
                            <div
                              key={a.key}
                              className="grid items-center gap-x-2 border-t border-dashed border-white/[0.05] py-2.5"
                              style={{ gridTemplateColumns: ROW_COLS }}
                            >
                              <div className="flex items-center gap-3">
                                <Switch
                                  on={aOn}
                                  disabled={isFull}
                                  onChange={() => toggleAction(page, a.key, !aOn)}
                                  label={a.label}
                                />
                                <div className="min-w-0">
                                  <div className="text-[13px] text-zinc-100">
                                    {a.label}
                                  </div>
                                  {a.hint && (
                                    <div className="text-[11px] text-zinc-500">
                                      {a.hint}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {/* Named writes aren't create/update/delete — the
                                  toggle alone grants them, so no C/U/D marks. */}
                              <span />
                              <span />
                              <span />
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <p className="px-1 text-[11px] leading-relaxed text-zinc-500">
        <span className="text-zinc-300">
          {granted} of {catalogue.pages.length} sections granted.
        </span>{" "}
        Super-admin surfaces — withdrawals, vaults, OTP codes, admin
        management, account deletion — are never delegatable and aren&apos;t
        listed here.
      </p>
    </div>
  );
}

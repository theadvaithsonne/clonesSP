"use client";

// The right-hand panel of the invite dialog and the body of the
// "Edit access" sheet: pick a role name, then set a level per page.
//
// Three levels, one control: No access / View only / Full access. Two
// checkboxes would say the same thing with twice the clicks, and "can open
// Withdrawals" versus "can approve one" is exactly the distinction a super
// admin is trying to draw.
//
// Nothing super-admin-only appears here, by construction — the catalogue
// comes from the backend's ADMIN_PAGES, and super-admin capabilities were
// deliberately left out of it. There is no checkbox that could grant them.

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import ManageRolesDialog from "@/components/garage-admin/ManageRolesDialog";
import AccessGrid from "@/components/garage-admin/AccessGrid";
import { Check, ChevronDown, Pencil, Plus, ShieldCheck, Settings2 } from "lucide-react";
import type {
  AdminPageCatalogue,
  AdminPageLevel,
  AdminRolePreset,
} from "@/lib/admin-api/permissions";
import {
  countGranted,
  createAdminRole,
  updateAdminRole,
} from "@/lib/admin-api/permissions";

export default function AdminAccessMatrix({
  catalogue,
  role,
  onRoleChange,
  permissions,
  onPermissionsChange,
  existingRoles = [],
  onRoleCreated,
  className,
}: {
  catalogue: AdminPageCatalogue | null;
  role: string;
  onRoleChange: (role: string) => void;
  permissions: Record<string, AdminPageLevel>;
  onPermissionsChange: (next: Record<string, AdminPageLevel>) => void;
  /** Role labels already in use, offered alongside the presets. */
  existingRoles?: { role: string; permissions: Record<string, AdminPageLevel> }[];
  /** Called after a role is saved, so the caller can refresh its list. */
  onRoleCreated?: () => void;
  className?: string;
}) {
  const [manageOpen, setManageOpen] = useState(false);

  if (!catalogue) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-sm text-zinc-500",
          className
        )}
      >
        Loading access options…
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      {/* Role — pick an existing one or name a new one. */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex items-center justify-between">
          <label className="text-[11px] uppercase tracking-wider text-zinc-500">
            Role
          </label>
          {/* Renaming/deleting created roles lives in its own roomy dialog —
              the dropdown is for picking and creating only. */}
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="flex items-center gap-1 text-[11px] text-zinc-400 transition hover:text-white"
          >
            <Settings2 className="h-3 w-3" />
            Manage roles
          </button>
        </div>
        <RoleCombobox
          role={role}
          presets={catalogue.presets}
          existingRoles={existingRoles}
          currentPermissions={permissions}
          onRoleCreated={onRoleCreated}
          onPickRole={(name, perms) => {
            onRoleChange(name);
            // Choosing an existing role stamps its access in as a starting
            // point; everything below stays editable afterwards. Creating a
            // new name leaves the current levels alone — that is the whole
            // point of "set the access, then name it".
            if (perms) onPermissionsChange({ ...perms });
          }}
        />
      </div>

      {/* Shared grid — the same control the standalone Roles page uses. */}
      <AccessGrid
        catalogue={catalogue}
        permissions={permissions}
        onPermissionsChange={onPermissionsChange}
        className="min-h-0 flex-1"
      />

      <ManageRolesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        onChanged={onRoleCreated}
      />
    </div>
  );
}

/**
 * Pick an existing role or name a new one.
 *
 * Roles are free text on the server — there is no fixed list to choose
 * from, and `garage-super-admin` is the only name with any meaning to the
 * code (the backend rejects it here, so it can't be minted from this form).
 * So this is a combobox rather than a select: type to filter, or type
 * something new and create it.
 *
 * Selecting an EXISTING role copies its access in as a starting point.
 * Creating a NEW one deliberately leaves the levels alone, because the
 * workflow is "set the access you want, then give it a name".
 */
function RoleCombobox({
  role,
  presets,
  existingRoles,
  currentPermissions,
  onPickRole,
  onRoleCreated,
}: {
  role: string;
  presets: AdminRolePreset[];
  existingRoles: { role: string; permissions: Record<string, AdminPageLevel> }[];
  currentPermissions: Record<string, AdminPageLevel>;
  onPickRole: (name: string, permissions?: Record<string, AdminPageLevel>) => void;
  onRoleCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Which role's access is mid-save via the "Update access" action.
  const [busyName, setBusyName] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Presets first, then roles already in use that aren't presets. Deduped
  // case-insensitively so "finance" and "Finance" aren't offered twice.
  const options = useMemo(() => {
    const seen = new Set<string>();
    const out: {
      name: string;
      hint?: string;
      badge?: string;
      // Presets are code constants — not editable. Stored roles are.
      editable: boolean;
      permissions: Record<string, AdminPageLevel>;
    }[] = [];
    for (const p of presets) {
      const key = p.role.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        name: p.role,
        hint: p.description,
        badge: "Preset",
        editable: false,
        permissions: p.permissions,
      });
    }
    for (const r of existingRoles) {
      const key = r.role.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      // adminCount 0 means the role was defined but nobody holds it yet.
      const n = (r as { adminCount?: number }).adminCount;
      out.push({
        name: r.role,
        hint: countGranted(r.permissions)
          ? `${countGranted(r.permissions)} sections granted`
          : "No sections granted yet",
        badge:
          typeof n === "number" && n > 0
            ? `${n} admin${n > 1 ? "s" : ""}`
            : "Unused",
        editable: true,
        permissions: r.permissions,
      });
    }
    return out;
  }, [presets, existingRoles]);

  const typed = role.trim();
  const filtered = useMemo(() => {
    if (!typed) return options;
    const q = typed.toLowerCase();
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, typed]);

  // Only offer "create" when the name isn't already one of the options —
  // otherwise picking an existing role would look like making a new one.
  const isExisting = options.some(
    (o) => o.name.toLowerCase() === typed.toLowerCase(),
  );
  const canCreate = typed.length >= 2 && !isExisting;

  // The stored role whose name the field currently matches (if any). Editing
  // the grid below and choosing "Update access" retemplates THIS role.
  const selectedStored = options.find(
    (o) => o.editable && o.name.toLowerCase() === typed.toLowerCase(),
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative mt-2">
      <ShieldCheck className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <Input
        className="h-11 rounded-full border-white/[0.06] bg-[#0f0f0f] pl-11 pr-10 text-sm text-zinc-200 placeholder:text-zinc-500 focus-visible:border-white/[0.12] focus-visible:ring-0"
        placeholder="Select a role, or type a new one…"
        value={role}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onPickRole(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            setOpen(false);
          }
        }}
      />
      <button
        type="button"
        aria-label={open ? "Hide roles" : "Show roles"}
        onClick={() => setOpen((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 transition hover:text-white"
      >
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#131313] p-1 shadow-2xl">
          {canCreate && (
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                // Save it for real. Until roles had their own collection
                // this only filled the text box, so creating one and then
                // refreshing lost it — which is exactly what happened.
                setSaving(true);
                try {
                  await createAdminRole(typed, currentPermissions);
                  onPickRole(typed);
                  onRoleCreated?.();
                  toast.success(`Role "${typed}" created`);
                  setOpen(false);
                } catch (e: unknown) {
                  toast.error(
                    e instanceof Error ? e.message : "Couldn't create that role",
                  );
                } finally {
                  setSaving(false);
                }
              }}
              className="flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-brand transition hover:bg-white/[0.06] disabled:opacity-60"
            >
              <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0">
                <span className="block font-medium">
                  {saving ? "Creating…" : `Create "${typed}"`}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                  Saves this name with the access levels set below, ready to
                  reuse on future invites.
                </span>
              </span>
            </button>
          )}

          {selectedStored && (
            <button
              type="button"
              disabled={busyName === selectedStored.name}
              onClick={async () => {
                // Save the current access grid back onto the selected role's
                // template. Existing admins keep what they already have — the
                // template is a starting point for future assignments, not a
                // live link.
                setBusyName(selectedStored.name);
                try {
                  await updateAdminRole(selectedStored.name, {
                    permissions: currentPermissions,
                  });
                  onRoleCreated?.();
                  toast.success(`Updated access for "${selectedStored.name}"`);
                } catch (e: unknown) {
                  toast.error(
                    e instanceof Error ? e.message : "Couldn't update that role",
                  );
                } finally {
                  setBusyName(null);
                }
              }}
              className="flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-brand transition hover:bg-white/[0.06] disabled:opacity-60"
            >
              <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0">
                <span className="block font-medium">
                  {busyName === selectedStored.name
                    ? "Updating…"
                    : `Update "${selectedStored.name}" access`}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                  Saves the access levels below onto this role. Admins already
                  assigned it keep what they have.
                </span>
              </span>
            </button>
          )}

          {filtered.map((o) => {
            const active = o.name.toLowerCase() === typed.toLowerCase();
            return (
              <button
                key={o.name}
                type="button"
                onClick={() => {
                  onPickRole(o.name, o.permissions);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.06]",
                  active ? "text-brand" : "text-zinc-200",
                )}
              >
                <Check
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{o.name}</span>
                    {o.badge && (
                      <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-400">
                        {o.badge}
                      </span>
                    )}
                  </span>
                  {o.hint && (
                    <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                      {o.hint}
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          {!filtered.length && !canCreate && (
            <p className="px-3 py-3 text-center text-xs text-zinc-500">
              No roles yet — type a name to create one.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

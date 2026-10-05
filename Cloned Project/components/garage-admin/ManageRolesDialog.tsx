"use client";

// A roomy home for managing created roles — rename and delete — separate
// from the invite dialog's role dropdown, which was too cramped to also be
// a management surface.
//
// This opens from INSIDE the invite dialog (itself a Radix modal). Two ways
// that went wrong and how this settles them:
//   • A hand-rolled portal overlay showed on top but was DEAD to input —
//     the parent dialog's focus trap stole every click and keystroke back,
//     because the portal lived outside Radix's layer system.
//   • So this is a real Radix <Dialog>: Radix hands the focus scope to the
//     nested dialog, so its fields and buttons work. The one thing Radix
//     doesn't do for a nested dialog is lift it above the parent — both
//     default to z-[1100] — so the content z-index is raised inline, which
//     also can't be purged the way an arbitrary Tailwind class can.
//
// Scope is rename + delete only. Editing what a role GRANTS stays in the
// invite flow (pick the role, adjust the grid, "Update access"), because
// that needs the full page matrix, which doesn't belong in a small list.
// Presets never appear here: they're code constants.

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Check, Loader2, Pencil, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getAdminRolesInUse,
  updateAdminRole,
  deleteAdminRole,
  countGranted,
  type AdminRoleInUse,
} from "@/lib/admin-api/permissions";

export default function ManageRolesDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Fired after any rename/delete so the caller can refresh its own list. */
  onChanged?: () => void;
}) {
  const [roles, setRoles] = useState<AdminRoleInUse[]>([]);
  const [loading, setLoading] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getAdminRolesInUse()
      .then(setRoles)
      .catch(() => toast.error("Couldn't load roles"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // The role documents this dialog can act on: everything the list endpoint
  // returns EXCEPT the default `garage-admin` label, which isn't a role a
  // super admin defined and can't be renamed/deleted.
  const managed = roles.filter((r) => r.role && r.role !== "garage-admin");

  const commitRename = async (current: string) => {
    const next = draft.trim();
    if (!next || next.toLowerCase() === current.toLowerCase()) {
      setRenaming(null);
      return;
    }
    setBusy(current);
    try {
      await updateAdminRole(current, { newName: next });
      toast.success(`Renamed to "${next}"`);
      setRenaming(null);
      load();
      onChanged?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't rename that role");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (name: string) => {
    if (
      !window.confirm(
        `Delete the role "${name}"? Admins who already have it keep their access — it just won't be offered for new invites.`,
      )
    )
      return;
    setBusy(name);
    try {
      await deleteAdminRole(name);
      toast.success(`Deleted "${name}"`);
      load();
      onChanged?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete that role");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Lift above the invite dialog (z-[1100]); inline so it can't be
        // purged or out-specified.
        style={{ zIndex: 2147483000 }}
        className="max-h-[85vh] max-w-lg gap-0 overflow-hidden border-white/[0.08] bg-[#131313] p-0 text-zinc-200"
      >
        <DialogHeader className="border-b border-white/[0.06] px-5 py-4">
          <DialogTitle className="text-white">Manage roles</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto px-5 py-4">
          <p className="text-xs text-zinc-500">
            Rename or remove the roles you&rsquo;ve created. To change what a
            role can reach, pick it in the invite dialog and use &ldquo;Update
            access&rdquo;. Admins already assigned a role keep their access when
            it&rsquo;s renamed or deleted.
          </p>

          <div className="mt-3 space-y-1.5">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-zinc-500">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : managed.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-500">
                No roles created yet. Create one from the invite dialog by
                typing a new name.
              </p>
            ) : (
              managed.map((r) => {
                const isRenaming = renaming === r.role;
                const n = (r as { adminCount?: number }).adminCount;
                const grantedN = countGranted(r.permissions);
                return (
                  <div
                    key={r.role}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                  >
                    <ShieldCheck className="h-4 w-4 shrink-0 text-zinc-500" />

                    {isRenaming ? (
                      <>
                        <Input
                          autoFocus
                          value={draft}
                          disabled={busy === r.role}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void commitRename(r.role);
                            } else if (e.key === "Escape") {
                              setRenaming(null);
                            }
                          }}
                          className="h-8 flex-1 rounded-lg border-white/[0.1] bg-[#0f0f0f] text-sm"
                        />
                        <button
                          type="button"
                          aria-label="Save name"
                          disabled={busy === r.role}
                          onClick={() => void commitRename(r.role)}
                          className="shrink-0 rounded-md p-1.5 text-emerald-400 transition hover:bg-white/[0.06] disabled:opacity-50"
                        >
                          {busy === r.role ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          aria-label="Cancel"
                          onClick={() => setRenaming(null)}
                          className="shrink-0 rounded-md p-1.5 text-zinc-400 transition hover:bg-white/[0.06]"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium text-white">
                              {r.role}
                            </span>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px]",
                                typeof n === "number" && n > 0
                                  ? "bg-white/[0.06] text-zinc-400"
                                  : "bg-amber-500/10 text-amber-400/80",
                              )}
                            >
                              {typeof n === "number" && n > 0
                                ? `${n} admin${n > 1 ? "s" : ""}`
                                : "Unused"}
                            </span>
                          </div>
                          <span className="mt-0.5 block text-[11px] text-zinc-500">
                            {grantedN
                              ? `${grantedN} section${grantedN > 1 ? "s" : ""} granted`
                              : "No sections granted yet"}
                          </span>
                        </div>

                        <button
                          type="button"
                          aria-label={`Rename ${r.role}`}
                          onClick={() => {
                            setDraft(r.role);
                            setRenaming(r.role);
                          }}
                          className="shrink-0 rounded-md p-1.5 text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${r.role}`}
                          disabled={busy === r.role}
                          onClick={() => void remove(r.role)}
                          className="shrink-0 rounded-md p-1.5 text-zinc-400 transition hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50"
                        >
                          {busy === r.role ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

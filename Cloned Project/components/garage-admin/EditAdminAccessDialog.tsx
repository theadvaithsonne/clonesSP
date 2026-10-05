"use client";

// Change one admin's role label and per-page access after the fact.
// Super-admin only — the endpoint behind it (PATCH
// /garage-admin/admins/:id/access) rejects everyone else, and refuses to
// touch a super admin's row at all.
//
// Changes take effect on the admin's next request: the backend gate reads
// permissions off the document per request rather than out of the JWT, so
// nobody has to log out and back in.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import AdminAccessMatrix from "@/components/garage-admin/AdminAccessMatrix";
import {
  getAdminPageCatalogue,
  getAdminRolesInUse,
  updateAdminAccess,
  emptyPermissions,
  type AdminPageCatalogue,
  type AdminPageLevel,
  type AdminRoleInUse,
} from "@/lib/admin-api/permissions";

export default function EditAdminAccessDialog({
  admin,
  onSaved,
  children,
}: {
  admin: {
    id: string;
    name: string;
    email: string;
    role: string;
    permissions?: Record<string, AdminPageLevel>;
  };
  onSaved?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catalogue, setCatalogue] = useState<AdminPageCatalogue | null>(null);
  const [existingRoles, setExistingRoles] = useState<AdminRoleInUse[]>([]);
  const [role, setRole] = useState(admin.role);
  const [permissions, setPermissions] = useState<
    Record<string, AdminPageLevel>
  >(admin.permissions || {});

  useEffect(() => {
    if (!open) return;
    // Re-seed from the row every time it opens, so reopening after a
    // cancel doesn't show the abandoned edits.
    setRole(admin.role);
    setPermissions({ ...(admin.permissions || {}) });

    if (catalogue) return;
    let alive = true;
    (async () => {
      try {
        const cat = await getAdminPageCatalogue();
        if (alive) setCatalogue(cat);
        if (alive && !admin.permissions) {
          setPermissions(emptyPermissions(cat.pages));
        }
      } catch {
        toast.error("Couldn't load access options");
      }
      try {
        const roles = await getAdminRolesInUse();
        if (alive) setExistingRoles(roles);
      } catch {
        /* presets still work without it */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function save() {
    if (!role.trim()) {
      toast.error("Give the role a name");
      return;
    }
    setSaving(true);
    try {
      await updateAdminAccess(admin.id, { role: role.trim(), permissions });
      toast.success(`Updated access for ${admin.name || admin.email}`);
      setOpen(false);
      onSaved?.();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update access");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className={cn(
          "!max-w-[640px] !z-[9999] !w-full rounded-2xl border border-white/[0.08] bg-[#181818] p-6",
          "shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-[18px] font-semibold tracking-tight text-white">
            Access for {admin.name || admin.email}
          </DialogTitle>
          <p className="text-sm leading-relaxed text-zinc-400">
            Rename the role or change which sections it reaches. Applies on
            their next request — no re-login needed.
          </p>
        </DialogHeader>

        <AdminAccessMatrix
          catalogue={catalogue}
          role={role}
          onRoleChange={setRole}
          permissions={permissions}
          onPermissionsChange={setPermissions}
          existingRoles={existingRoles}
          // A freshly created role should show up in the list straight away,
          // not on the next open of the dialog.
          onRoleCreated={() => {
            getAdminRolesInUse()
              .then(setExistingRoles)
              .catch(() => {
                /* the role is saved either way; the list refreshes on reopen */
              });
          }}
          className="max-h-[60vh]"
        />

        <div className="flex gap-3 pt-1">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="h-11 flex-1 rounded-full border-white/[0.08] bg-white/[0.03] text-zinc-200 hover:bg-white/[0.06] hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving || !catalogue}
            className="h-11 flex-1 rounded-full bg-brand font-medium text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save access"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

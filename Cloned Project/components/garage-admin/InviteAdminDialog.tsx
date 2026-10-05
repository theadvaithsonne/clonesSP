"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { garageAdminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, Trash2, Plus, Upload, User2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import AdminAccessMatrix from "@/components/garage-admin/AdminAccessMatrix";
import {
  getAdminPageCatalogue,
  getAdminRolesInUse,
  emptyPermissions,
  type AdminPageCatalogue,
  type AdminPageLevel,
  type AdminRoleInUse,
} from "@/lib/admin-api/permissions";
import {
  searchUsers,
  type AdminUserSuggestion,
} from "@/lib/admin-api/users";

type Row = {
  id: number;
  name: string;
  email: string;
  error?: string;
};

// One role + one access map per batch. Inviting three people into three
// different roles is three trips through this dialog, which is both rarer
// and clearer than a per-row role picker crammed into the email list.

export default function InviteAdminDialog({
  onInvited,
  children,
}: {
  onInvited?: () => void;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([{ id: 1, name: "", email: "" }]);
  const [loading, setLoading] = useState(false);
  const nextId = useRef(2);

  const [catalogue, setCatalogue] = useState<AdminPageCatalogue | null>(null);
  const [existingRoles, setExistingRoles] = useState<AdminRoleInUse[]>([]);
  const [role, setRole] = useState("Admin");
  const [permissions, setPermissions] = useState<
    Record<string, AdminPageLevel>
  >({});

  // Type-ahead over existing Garage users. Only the focused row searches —
  // one request in flight at a time, and the dropdown can only belong to
  // the field being typed in.
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<AdminUserSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  // Set when a suggestion is clicked, so the effect below doesn't
  // immediately re-open the dropdown on the value it just filled in.
  const justPicked = useRef(false);

  const MAX_ROWS = 20;

  // Load the page catalogue the first time the dialog opens, then default
  // to the "Admin" preset so the common case is one click away.
  useEffect(() => {
    if (!open || catalogue) return;
    let alive = true;
    (async () => {
      try {
        const cat = await getAdminPageCatalogue();
        if (!alive) return;
        setCatalogue(cat);
        const preset = cat.presets.find((p) => p.id === "garage-admin");
        setRole(preset?.role || "Admin");
        setPermissions(
          preset ? { ...preset.permissions } : emptyPermissions(cat.pages)
        );
      } catch {
        toast.error("Couldn't load access options");
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, catalogue]);

  // Load the created roles EVERY time the dialog opens — decoupled from the
  // catalogue guard above, which only runs once and left the roles list
  // populated solely by a post-create refresh. That's why created roles only
  // appeared after making a new one. Reloading on open also picks up roles
  // added or renamed in another session.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    getAdminRolesInUse()
      .then((roles) => {
        if (alive) setExistingRoles(roles);
      })
      .catch(() => {
        // Convenience list — presets still work without it.
      });
    return () => {
      alive = false;
    };
  }, [open]);

  const activeQuery = activeRow === null ? "" : rows[activeRow]?.email || "";

  useEffect(() => {
    if (activeRow === null) return;
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    const q = activeQuery.trim();
    // One character matches most of the table; wait for a real prefix.
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    let alive = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const users = await searchUsers(q);
        if (alive) setSuggestions(users);
      } catch {
        if (alive) setSuggestions([]);
      } finally {
        if (alive) setSearching(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [activeQuery, activeRow]);

  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

  const setRow = useCallback((i: number, patch: Partial<Row>) => {
    setRows((r) => {
      const c = [...r];
      c[i] = { ...c[i], ...patch };
      return c;
    });
  }, []);

  const pickSuggestion = useCallback(
    (index: number, user: AdminUserSuggestion) => {
      justPicked.current = true;
      setRow(index, {
        email: user.email,
        // Don't clobber a name the super admin already typed.
        name: rows[index]?.name?.trim() || user.name || "",
        error: undefined,
      });
      setSuggestions([]);
      setActiveRow(null);
    },
    [rows, setRow]
  );

  const addRow = useCallback(() => {
    setRows((r) => {
      if (r.length >= MAX_ROWS) return r;
      return [
        ...r,
        {
          id: nextId.current++,
          name: "",
          email: "",
        },
      ];
    });
  }, []);

  const removeRow = useCallback((id: number) => {
    setRows((r) => (r.length === 1 ? r : r.filter((x) => x.id !== id)));
  }, []);

  const parsePastedEmails = (text: string) => {
    const parts = text
      .split(/[\s,;]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(parts));
  };

  const onPasteEmails = (value: string, index: number) => {
    const emails = parsePastedEmails(value);
    if (emails.length <= 1) {
      setRow(index, {
        email: value,
        error: value && !emailRx.test(value) ? "Invalid email" : undefined,
      });
      return;
    }
    setRows((r) => {
      const start = [...r];
      start[index] = {
        ...start[index],
        email: emails[0],
        error:
          emails[0] && !emailRx.test(emails[0]) ? "Invalid email" : undefined,
      };
      const existing = new Set(
        start.map((x) => x.email.toLowerCase()).filter(Boolean)
      );
      for (let i = 1; i < emails.length && start.length < MAX_ROWS; i++) {
        const e = emails[i];
        if (existing.has(e.toLowerCase())) continue;
        start.push({
          id: nextId.current++,
          name: "",
          email: e,
          error: e && !emailRx.test(e) ? "Invalid email" : undefined,
        });
        existing.add(e.toLowerCase());
      }
      return start;
    });
  };

  // Only valid if email is valid
  const validAdmins = useMemo(
    () =>
      rows
        .map(({ email, name }) => ({
          email: email.trim().toLowerCase(),
          name: name?.trim(),
        }))
        .filter((r) => r.email && emailRx.test(r.email)),
    [rows]
  );

  const hasErrors = useMemo(
    () => rows.some((r) => r.email && !emailRx.test(r.email)),
    [rows]
  );

  async function submit() {
    const admins = validAdmins;
    if (!admins.length) {
      setOpen(false);
      return;
    }
    if (!role.trim()) {
      toast.error("Give the role a name");
      return;
    }
    setLoading(true);

    try {
      // Send invitations one by one
      const promises = admins.map((admin) =>
        garageAdminApi<{ data: { emailSent?: boolean } }>(
          "/garage-admin/invite",
          {
            method: "POST",
            body: JSON.stringify({
              email: admin.email,
              name: admin.name || admin.email.split("@")[0],
              role: role.trim(),
              permissions,
            }),
          }
        )
      );

      const results = await Promise.all(promises);

      // The account is created before the email goes out, so mail can fail
      // on an invite that otherwise succeeded. Say so rather than claiming
      // it was sent — the accounts exist and the codes are valid.
      const unmailed = results.filter(
        (r) => r?.data?.emailSent === false
      ).length;
      if (unmailed) {
        toast.warning(
          `${admins.length - unmailed} sent, ${unmailed} created but the email couldn't be delivered. Re-invite once mail is working.`
        );
      } else {
        toast.success(
          `Invitations sent to ${admins.length} ${role.trim()}${
            admins.length > 1 ? "s" : ""
          }`
        );
      }
      setOpen(false);
      setRows([{ id: 1, name: "", email: "" }]);
      onInvited?.();
    } catch (error: any) {
      toast.error(error?.message || "Failed to send some invitations");
    } finally {
      setLoading(false);
    }
  }

  // reset on close
  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setTimeout(() => {
        setRows([{ id: 1, name: "", email: "" }]);
      }, 150);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children ?? (
          <Button className="h-9 rounded-full bg-brand px-4 text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]">
            <Plus className="h-4 w-4 mr-1.5" />
            Invite admins
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        className={cn(
          "!max-w-[1040px] !z-[9999] !w-full rounded-2xl border border-white/[0.08] bg-[#181818] p-6",
          "shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
        )}
      >
        <DialogHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] text-zinc-300">
            <Upload className="h-3.5 w-3.5 text-brand" />
            Invite garage admins
          </div>
          <DialogTitle className="mt-3 text-[18px] font-semibold tracking-tight text-white">
            Add garage admins
          </DialogTitle>
          <p className="max-w-[60ch] text-sm leading-relaxed text-zinc-400">
            Paste multiple emails to bulk invite garage admins. Pick the role
            and the sections it can reach on the right. They will receive an
            OTP to complete their setup.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 pt-1 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {rows.map((r, i) => {
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <div className="grid grid-cols-12 items-center gap-3">
                    {/* Name */}
                    <div className="relative col-span-5">
                      <User2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <Input
                        className="h-11 rounded-full border-white/[0.06] bg-[#0f0f0f] pl-11 text-sm text-zinc-200 placeholder:text-zinc-500 focus-visible:border-white/[0.12] focus-visible:ring-0"
                        placeholder="Full name"
                        value={r.name || ""}
                        onChange={(e) => setRow(i, { name: e.target.value })}
                      />
                    </div>

                    {/* Email */}
                    <div className="relative col-span-7">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <Input
                        className={cn(
                          "h-11 rounded-full border-white/[0.06] bg-[#0f0f0f] pl-11 text-sm text-zinc-200 placeholder:text-zinc-500 focus-visible:border-white/[0.12] focus-visible:ring-0",
                          r.error && "border-brand/60"
                        )}
                        placeholder="admin@company.com"
                        value={r.email}
                        onChange={(e) =>
                          setRow(i, {
                            email: e.target.value,
                            error:
                              e.target.value && !emailRx.test(e.target.value)
                                ? "Invalid email"
                                : undefined,
                          })
                        }
                        onFocus={() => setActiveRow(i)}
                        onBlur={() => {
                          // Let a click on a suggestion land before the
                          // list unmounts.
                          setTimeout(
                            () => setActiveRow((cur) => (cur === i ? null : cur)),
                            150
                          );
                        }}
                        onPaste={(e) => {
                          const txt = e.clipboardData.getData("text");
                          if (txt && /[,;\s]/.test(txt)) {
                            e.preventDefault();
                            onPasteEmails(txt, i);
                          }
                        }}
                      />
                      {!!r.error && (
                        <div className="mt-1 pl-4 text-[11px] text-brand">
                          {r.error}
                        </div>
                      )}

                      {/* Type-ahead over existing Garage users. Picking one
                          fills the email (and the name, if blank) — the
                          usual case is inviting someone who already has an
                          account. Typing a brand-new address still works;
                          the list is a shortcut, not a constraint. */}
                      {activeRow === i && r.email.trim().length >= 2 && (
                        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0f0f0f] py-1 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
                          {searching && suggestions.length === 0 ? (
                            <div className="px-4 py-2.5 text-[12px] text-zinc-500">
                              Searching…
                            </div>
                          ) : suggestions.length === 0 ? (
                            <div className="px-4 py-2.5 text-[12px] text-zinc-500">
                              No matching user — invite this address anyway.
                            </div>
                          ) : (
                            suggestions.map((u) => (
                              <button
                                key={u._id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => pickSuggestion(i, u)}
                                className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-white/[0.05]"
                              >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] text-[10px] font-medium text-zinc-300">
                                  {u.profilePicture ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={u.profilePicture}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    (u.name || u.email).slice(0, 1).toUpperCase()
                                  )}
                                </span>
                                <span className="min-w-0 flex-1 leading-tight">
                                  <span className="block truncate text-[12.5px] text-zinc-100">
                                    {u.name || "Unnamed"}
                                  </span>
                                  <span className="block truncate text-[11px] text-zinc-500">
                                    {u.email}
                                  </span>
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Remove */}
                    <div className="absolute right-3 top-3 flex justify-end">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeRow(r.id)}
                        className="h-9 w-9 rounded-full border border-transparent text-zinc-500 hover:border-white/[0.08] hover:bg-white/[0.05] hover:text-white"
                        title="Remove"
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          <div className="flex items-center justify-between pt-1">
            <Button
              variant="outline"
              onClick={addRow}
              className="h-9 rounded-full border-white/[0.08] bg-white/[0.03] text-zinc-200 hover:bg-white/[0.06] hover:text-white"
              disabled={rows.length >= MAX_ROWS}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add another
            </Button>

            <div className="text-[12px] text-zinc-500">
              {validAdmins.length} ready • max {MAX_ROWS}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={submit}
              disabled={loading || !validAdmins.length || hasErrors}
              className={cn(
                "h-11 w-full rounded-full bg-brand font-medium text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]",
                (loading || !validAdmins.length || hasErrors) &&
                  "cursor-not-allowed opacity-40"
              )}
            >
              {loading ? "Sending…" : "Send invites"}
            </Button>
          </div>

          <p className="px-1 text-xs leading-relaxed text-zinc-500">
            We&apos;ll email an OTP and a link that opens the garage admin
            login page.
          </p>
        </div>

          {/* Role + access */}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

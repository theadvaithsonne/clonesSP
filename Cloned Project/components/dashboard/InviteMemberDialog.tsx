"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AnimatePresence, motion } from "framer-motion";
import {
  Mail,
  Shield,
  Trash2,
  Plus,
  Upload,
  Building2,
  User2,
  Info,
  X,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type FloorRow = {
  id: string;
  name: string;
  level: number;
  departments: { name: string }[];
};

type Row = {
  id: number;
  name: string;
  email: string;
  role: "founder" | "stakeholder";
  floorId?: string; // <-- only floor (no department)
  error?: string;
};

export default function InviteMemberDialog({
  onInvited,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  onInvited?: () => void;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [rows, setRows] = useState<Row[]>([
    { id: 1, name: "", email: "", role: "stakeholder" },
  ]);
  const [loading, setLoading] = useState(false);
  const [floors, setFloors] = useState<FloorRow[]>([]);
  const nextId = useRef(2);

  const MAX_ROWS = 20;

  // Load floors when dialog opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const orgId = localStorage.getItem("garage_org_id");
        const res = await api<{ floors: FloorRow[] }>(
          `/floors?orgId=${orgId}`,
          {},
          getToken()!
        );
        const list = res.floors || [];
        // console.log("Loaded floors:", list);
        setFloors(list);
        // default any empty row to first floor
        setRows((prev) =>
          prev.map((r) => {
            if (r.floorId) return r;
            return { ...r, floorId: list[0]?.id };
          })
        );
      } catch (error) {
        console.error("Failed to load floors:", error);
        setFloors([]);
      }
    })();
  }, [open]);

  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

  const setRow = useCallback((i: number, patch: Partial<Row>) => {
    setRows((r) => {
      const c = [...r];
      c[i] = { ...c[i], ...patch };
      return c;
    });
  }, []);

  const addRow = useCallback(() => {
    setRows((r) => {
      if (r.length >= MAX_ROWS) return r;
      const f0 = floors[0];
      return [
        ...r,
        {
          id: nextId.current++,
          name: "",
          email: "",
          role: "stakeholder",
          floorId: f0?.id,
        },
      ];
    });
  }, [floors]);

  const removeRow = useCallback((id: number) => {
    setRows((r) => (r.length === 1 ? r : r.filter((x) => x.id !== id)));
  }, []);

  const onFloorChange = (i: number, floorId: string) => {
    // console.log("Floor changed to:", floorId, "for row:", i);
    setRow(i, { floorId });
  };

  // paste helper
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
      const f0 = floors[0];
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
          role: "stakeholder",
          floorId: f0?.id,
          error: e && !emailRx.test(e) ? "Invalid email" : undefined,
        });
        existing.add(e.toLowerCase());
      }
      return start;
    });
  };

  // Only valid if email is valid AND a floor is chosen
  const validMembers = useMemo(
    () =>
      rows
        .map(({ email, role, name, floorId }) => ({
          email: email.trim().toLowerCase(),
          role,
          name: name?.trim(),
          floorId,
        }))
        .filter((r) => r.email && emailRx.test(r.email) && !!r.floorId),
    [rows]
  );

  const hasErrors = useMemo(
    () => rows.some((r) => (r.email && !emailRx.test(r.email)) || !r.floorId),
    [rows]
  );

  async function submit() {
    const members = validMembers;
    // console.log("Submitting invitations for members:", members);
    if (!members.length) {
      setOpen(false);
      return;
    }
    setLoading(true);

    const orgId = localStorage.getItem("garage_org_id");
    try {
      // Note: no department is sent
      await api(
        `/invites/create?orgId=${orgId}`,
        { method: "POST", body: JSON.stringify({ members }) },
        getToken()!
      );
      toast.success("Invitations sent successfully");
      setOpen(false);
      setRows([
        {
          id: 1,
          name: "",
          email: "",
          role: "stakeholder",
          floorId: floors[0]?.id,
        },
      ]);
      onInvited?.();
      window.dispatchEvent(new CustomEvent("team:reload"));
    } finally {
      setLoading(false);
    }
  }

  // reset on close
  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setTimeout(() => {
        setRows([{ id: 1, name: "", email: "", role: "stakeholder" }]);
      }, 150);
    }
  };

  const noFloors = !floors.length;

  // When controlled externally (open prop provided), don't render DialogTrigger
  const isControlled = controlledOpen !== undefined;

  // Shared form content for both mobile and desktop
  const renderFormContent = (isMobile: boolean = false) => (
    <>
      {noFloors && (
        <div className="mb-3 rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-amber-200 text-sm inline-flex items-center gap-2">
          <Info className="h-4 w-4" />
          No floors found. Create floors first in{" "}
          <b className="mx-1">Floor Plan</b>.
        </div>
      )}

      <div className="space-y-3">
        <div className={cn("overflow-y-auto flex flex-col gap-4", isMobile ? "max-h-none" : "max-h-[55vh] px-4")}>
          <AnimatePresence initial={false}>
            {rows.map((r, i) => {
              const floor = floors.find((f) => f.id === r.floorId);
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="rounded-lg relative border border-[#2a2a35] bg-[#0f0f13] p-3"
                >
                  {/* Mobile Layout - Stacked */}
                  {isMobile ? (
                    <div className="space-y-3">
                      {/* Name */}
                      <div className="relative">
                        <User2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
                        <Input
                          className="pl-9 bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/70"
                          placeholder="Full name"
                          value={r.name || ""}
                          onChange={(e) => setRow(i, { name: e.target.value })}
                        />
                      </div>

                      {/* Email */}
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
                        <Input
                          className={cn(
                            "pl-9 bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/70",
                            r.error && "border-primary ring-1 ring-primary/30"
                          )}
                          placeholder="teammate@company.com"
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
                          onPaste={(e) => {
                            const txt = e.clipboardData.getData("text");
                            if (txt && /[,;\s]/.test(txt)) {
                              e.preventDefault();
                              onPasteEmails(txt, i);
                            }
                          }}
                        />
                        {!!r.error && (
                          <div className="mt-1 text-[11px] text-primary">
                            {r.error}
                          </div>
                        )}
                      </div>

                      {/* Floor */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Select
                            value={r.floorId}
                            onValueChange={(v) => onFloorChange(i, v)}
                            disabled={noFloors}
                          >
                            <SelectTrigger className="bg-transparent border border-[#2a2a35] text-white">
                              <SelectValue placeholder="Select Floor" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0e0e12] border border-[#2a2a35] text-white z-[800]">
                              {floors.map((f) => (
                                <SelectItem key={f.id} value={f.id}>
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 opacity-70" />
                                    {f.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {rows.length > 1 && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeRow(r.id)}
                            className="h-10 w-10 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {/* Floor departments */}
                      {floor && (
                        <div className="pt-1">
                          <div className="text-[11px] text-[#9fa0b8] mb-1">
                            {floor.name} departments
                          </div>
                          {floor.departments.length ? (
                            <div className="flex flex-wrap gap-1.5">
                              {floor.departments.map((d) => (
                                <span
                                  key={d.name}
                                  className="inline-flex items-center px-2 h-6 rounded-md border border-[#4a4a3a] bg-[#1a1a12] text-[11px] text-[#e9e3c5]"
                                >
                                  {d.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[11px] text-[#7f7f94]">
                              No departments on this floor.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Desktop Layout - Grid */
                    <>
                      <div className="grid grid-cols-12 items-center gap-3">
                        {/* Name */}
                        <div className="col-span-3 relative">
                          <User2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
                          <Input
                            className="pl-9 bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/70"
                            placeholder="Full name"
                            value={r.name || ""}
                            onChange={(e) => setRow(i, { name: e.target.value })}
                          />
                        </div>

                        {/* Email */}
                        <div className="col-span-4 relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
                          <Input
                            className={cn(
                              "pl-9 bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/70",
                              r.error && "border-primary ring-1 ring-primary/30"
                            )}
                            placeholder="teammate@company.com"
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
                            onPaste={(e) => {
                              const txt = e.clipboardData.getData("text");
                              if (txt && /[,;\s]/.test(txt)) {
                                e.preventDefault();
                                onPasteEmails(txt, i);
                              }
                            }}
                          />
                          {!!r.error && (
                            <div className="mt-1 text-[11px] text-primary">
                              {r.error}
                            </div>
                          )}
                        </div>

                        {/* Floor */}
                        <div className="col-span-2">
                          <Select
                            value={r.floorId}
                            onValueChange={(v) => onFloorChange(i, v)}
                            disabled={noFloors}
                          >
                            <SelectTrigger className="bg-transparent border border-[#2a2a35] text-white">
                              <SelectValue placeholder="Floor" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0e0e12] border border-[#2a2a35] text-white">
                              {floors.map((f) => (
                                <SelectItem key={f.id} value={f.id}>
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 opacity-70" />
                                    {f.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Remove */}
                        <div className="absolute right-3 top-3 flex justify-end">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeRow(r.id)}
                            className="h-9 w-9 text-[#c7c7da] hover:text-white hover:bg-[#15151b] border border-transparent hover:border-[#363649] rounded-md"
                            title="Remove"
                            aria-label="Remove row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Inline floor departments (read-only) */}
                      <div className="mt-2">
                        <div className="text-[11px] text-[#9fa0b8] mb-1">
                          {floor
                            ? `${floor.name} departments`
                            : "No floor selected"}
                        </div>
                        {floor && floor.departments.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {floor.departments.map((d) => (
                              <span
                                key={d.name}
                                className="inline-flex items-center px-2 h-6 rounded-md border border-[#4a4a3a] bg-[#1a1a12] text-[12px] text-[#e9e3c5]"
                              >
                                {d.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[12px] text-[#7f7f94]">
                            No departments on this floor.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button
            variant="outline"
            onClick={addRow}
            className="border-[#2a2a35] text-white hover:bg-[#15151b]"
            disabled={rows.length >= MAX_ROWS || noFloors}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add another
          </Button>

          <div className="text-[12px] text-[#9fa0b8]">
            {validMembers.length} ready • max {MAX_ROWS}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={submit}
            disabled={
              loading || !validMembers.length || hasErrors || noFloors
            }
            className={cn(
              "w-full bg-primary hover:bg-primary/90 text-black border border-primary/30 font-semibold",
              (loading || !validMembers.length || hasErrors || noFloors) &&
                "opacity-70 cursor-not-allowed"
            )}
          >
            {loading ? "Sending…" : "Send invites"}
          </Button>
        </div>

        <p className="text-xs text-[#9fa0b8] text-center">
          We'll email an OTP and a link that opens the accept page.
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Full-Screen View */}
      <AnimatePresence>
        {open && (
          <>
            {/* Overlay - Hidden on mobile since dialog is full screen */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[700] hidden md:block"
              onClick={() => handleOpenChange(false)}
            />

            {/* Mobile Dialog - Full screen */}
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="md:hidden fixed inset-0 z-[750] bg-[#0e0e12] flex flex-col"
            >
              {/* Mobile Header */}
              <div className="px-4 py-4 pt-[calc(env(safe-area-inset-top)+72px)] border-b border-[#2a2a35] flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                    <UserPlus className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Invite Employees
                    </h3>
                    <p className="text-xs text-[#9fa0b8]">
                      Add team members to your HQ
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleOpenChange(false)}
                  className="w-8 h-8 rounded-full bg-[#1a1a22] hover:bg-[#2a2a35] flex items-center justify-center transition-all duration-200"
                >
                  <X className="h-4 w-4 text-[#6a6a7a]" />
                </button>
              </div>

              {/* Mobile Content */}
              <div className="flex-1 overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
                {renderFormContent(true)}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {!isControlled && (
          <DialogTrigger asChild>
            {children ?? (
              <Button className="bg-primary hover:bg-primary/90 text-black border border-primary/30">
                <Plus className="h-4 w-4 mr-1.5" />
                Invite members
              </Button>
            )}
          </DialogTrigger>
        )}

        <DialogContent
          className={cn(
            "!max-w-[980px] !w-full border border-[#2a2a35] bg-[#0e0e12]/95 backdrop-blur-xl",
            "shadow-[0_10px_40px_rgba(0,0,0,0.45)]",
            "hidden md:block"
          )}
        >
          <DialogHeader>
            <div className="inline-flex w-fit items-center gap-2 rounded-full px-2.5 py-1 text-[11px] bg-[#1a1a22] border border-[#2a2a35] text-[#c7c7da]">
              <Upload className="h-3.5 w-3.5" />
              Invite teammates
            </div>
            <DialogTitle className="mt-3 text-white">
              Add members (name, email & floor)
            </DialogTitle>
            <p className="text-sm text-[#9fa0b8]">
              Paste multiple emails, and place them on a floor. Departments of
              each floor are shown for context.
            </p>
          </DialogHeader>

          {renderFormContent(false)}
        </DialogContent>
      </Dialog>
    </>
  );
}

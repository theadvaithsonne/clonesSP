// app/(dashboard)/floor-roster/page.tsx
"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import { getToken, getOrgId } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Users,
  Inbox,
  Plus,
  Tag,
  ArrowRightLeft,
  Trash2,
  Edit2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { LastSeen } from "@/components/shared/LastSeen";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type Member = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  department?: string;
  /** ISO date string for the "Active X ago" affordance. */
  lastSeenAt?: string | null;
};

type DeptCount = { name: string; count: number };

type FloorRoster = {
  id: string;
  level: number;
  name: string;
  departments: DeptCount[];
  members: Member[];
  pending?: {
    id: string;
    name?: string;
    email: string;
    role: "admin" | "user";
    department?: string;
    createdAt?: string;
  }[];
};

type Resp = {
  floors: FloorRoster[];
  unassigned: { members: Member[]; pending?: any[] };
};

type Dept = { name: string; color?: string };

export default function FloorRosterPage() {
  const { amIFounder } = useAmIFounder();
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  // `userStatuses` (live available/busy/afk roster) was removed with the
  // status-broadcast UI. Floor rows now show "Active X ago" sourced from
  // `m.lastSeenAt` instead.
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addingFloor, setAddingFloor] = useState(false);
  const [showChangeAssignmentsDialog, setShowChangeAssignmentsDialog] =
    useState(false);
  const [floorToDelete, setFloorToDelete] = useState<FloorRoster | null>(null);
  const [deletingFloor, setDeletingFloor] = useState(false);
  const [floorToEdit, setFloorToEdit] = useState<FloorRoster | null>(null);

  const load = async () => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) {
      console.error("No orgId found");
      setLoading(false);
      return;
    }
    try {
      const res = await api<Resp>(
        `/floors/roster?orgId=${orgId}`,
        {},
        getToken()!
      );
      setData(res);
    } catch (error) {
      console.error("Failed to load floor roster:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFloor = async (floorId: string) => {
    const orgId = localStorage.getItem("garage_org_id");

    setDeletingFloor(true);
    try {
      await api(
        `/floors/${floorId}?organizationId=${orgId}`,
        { method: "DELETE" },
        getToken()!
      );
      toast.success("Floor deleted successfully!");
      setFloorToDelete(null);
      load(); // Refresh data
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete floor");
    } finally {
      setDeletingFloor(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // Empty dependency array - only run once on mount

  // The live status listener was removed with the available/busy/afk
  // broadcast. Member presence is now shown as "Active X ago" via the
  // `lastSeenAt` field in the roster payload.

  const filtered = useMemo(() => {
    if (!data) return null;
    const qq = q.trim().toLowerCase();
    if (!qq) return data;
    return {
      floors: data.floors.filter((f) => f.name.toLowerCase().includes(qq)),
      unassigned: data.unassigned,
    } as Resp;
  }, [data, q]);

  if (loading) {
    return (
      <div className="px-6 py-6">
        <div className="h-8 w-48 bg-[#15151b] rounded mb-4" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-40 border border-[#2a2a35] bg-[#0e0e12] rounded-xl"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!filtered) return null;

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] bg-[#1a1a22] border border-[#2a2a35] text-[#c7c7da]">
            <Building2 className="h-3.5 w-3.5" />
            Floor Roster
          </div>
          <h1 className="text-2xl mt-2 font-semibold">
            People by floor & department
          </h1>
          <p className="text-sm text-[#a5a6bf]">
            View who’s assigned where — including pending invites and unassigned
            teammates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by floor name…"
            className="h-10 rounded-md bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/70 px-3"
          />
          {amIFounder && (
            <>
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={() => setShowChangeAssignmentsDialog(true)}
                  className="bg-[#111111] hover:bg-[#1a1a1a] text-brand border border-[#3a3a3a] transition-all duration-200 hover:scale-105"
                >
                  <ArrowRightLeft className="h-4 w-4 mr-1.5" />
                  Change Assignments
                </Button>
              </motion.div>
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={() => setShowAddDialog(true)}
                  className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] text-brand-foreground border border-brand/30 transition-all duration-200 hover:scale-105"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Floor
                </Button>
              </motion.div>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.floors.map((f) => (
          <Card
            key={f.id}
            className={cn(
              "border border-[#2a2a35] bg-[#0e0e12]/92 rounded-xl overflow-hidden",
              "shadow-[0_12px_40px_rgba(0,0,0,0.35)] py-0"
            )}
          >
            {/* header */}
            <div className="px-4 py-3 border-b border-[#2a2a35] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg grid place-items-center bg-brand/15 border border-brand/30 text-brand text-sm">
                  {f.level}
                </div>
                <div>
                  <div className="font-medium">{f.name}</div>
                  <div className="text-[11px] text-[#9fa0b8]">
                    Level {f.level}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-[12px] text-[#9fa0b8] flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {f.members.length}
                </div>
                {amIFounder && (
                  <>
                    <motion.div whileTap={{ scale: 0.95 }}>
                      <Button
                        onClick={() => setFloorToEdit(f)}
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] hover:border-[#3a3a45] transition-all duration-200"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </motion.div>
                    {f.members.length === 0 && (
                      <motion.div whileTap={{ scale: 0.95 }}>
                        <Button
                          onClick={() => setFloorToDelete(f)}
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 border border-red-500/30 text-red-500 hover:bg-red-500/10 hover:border-red-500/50 transition-all duration-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* departments chips */}
            <div className="px-4">
              {f.departments.length ? (
                <div className="flex flex-wrap gap-2">
                  {f.departments.map((d) => (
                    <span
                      key={d.name}
                      className="inline-flex items-center gap-2 px-2.5 h-7 rounded-md border border-[#3b3b4a] bg-[#15151b] text-[12px]"
                    >
                      {d.name}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-[12px] text-[#9fa0b8]">
                  No departments configured.
                </div>
              )}
            </div>

            {/* members list */}
            <div className="px-4 pb-3 ">
              {f.members.length ? (
                <ul className="divide-y divide-[#23232f]">
                  {f.members.map((m) => (
                    <li
                      key={m.id}
                      className="py-2 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-7 w-7 border border-[#2f2f3b] bg-[#1b1b24]">
                          <AvatarFallback className="text-xs text-black font-medium">
                            {(m.name || m.email || "?")
                              .slice(0, 1)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-sm truncate">
                            {m.name || m.email}
                          </div>
                          <div className="text-[11px] text-[#9fa0b8] truncate">
                            {m.email}
                          </div>
                          <LastSeen
                            date={m.lastSeenAt}
                            className="text-[10px] text-[#6b6b80]"
                          />
                          {/* "In a meeting" pill (sourced from the live
                              busy status) was removed with the status
                              broadcast. */}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {m.department ? (
                          <span className="text-[11px] px-2 py-0.5 rounded border border-[#3b3b4a] bg-[#15151b]">
                            {m.department}
                          </span>
                        ) : null}
                        <Badge
                          variant="outline"
                          className="text-[10px] px-2 py-0.5 border-[#3d3d51] text-[#c9c9ee] bg-transparent"
                        >
                          {m.role}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-[12px] text-[#9fa0b8] py-2">
                  No members on this floor yet.
                </div>
              )}
            </div>

            {/* optional pending invites for this floor */}
            {amIFounder && (
              <>
                {f.pending && f.pending.length > 0 && (
                  <div className="px-4 pb-4">
                    <div className="mt-1 text-[11px] uppercase tracking-wider text-[#9fa0b8] flex items-center gap-1">
                      <Inbox className="h-3.5 w-3.5" /> Pending invites
                    </div>
                    <ul className="mt-2 space-y-1">
                      {f.pending.map((p) => (
                        <li
                          key={p.id}
                          className="text-[12px] text-[#c7c7da] flex items-center gap-2"
                        >
                          <span className="inline-flex items-center gap-1 px-2 h-6 rounded border border-[#3b3b4a] bg-[#15151b]">
                            {p.email}
                            {p.department ? (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-brand/15 text-brand border border-brand/20">
                                {p.department}
                              </span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </Card>
        ))}

      </div>

      {/* Add Floor Dialog */}
      <AddFloorDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          setShowAddDialog(false);
          load(); // Refresh data
        }}
        existingFloors={data?.floors || []}
      />

      {/* Change Assignments Dialog */}
      <ChangeAssignmentsDialog
        open={showChangeAssignmentsDialog}
        onOpenChange={setShowChangeAssignmentsDialog}
        onSuccess={() => {
          setShowChangeAssignmentsDialog(false);
          load(); // Refresh data
        }}
        floors={data?.floors || []}
        unassignedMembers={data?.unassigned.members || []}
      />

      {/* Edit Floor Dialog */}
      <EditFloorDialog
        open={!!floorToEdit}
        onOpenChange={(open) => !open && setFloorToEdit(null)}
        onSuccess={() => {
          setFloorToEdit(null);
          load(); // Refresh data
        }}
        floor={floorToEdit}
      />

      {/* Delete Floor Confirmation Dialog */}
      <Dialog
        open={!!floorToDelete}
        onOpenChange={(open) => !open && setFloorToDelete(null)}
      >
        <DialogContent className="bg-[#0e0e12] border border-[#2a2a35] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Floor</DialogTitle>
            <DialogDescription className="text-[#a5a6bf]">
              Are you sure you want to delete{" "}
              <span className="text-white font-medium">
                {floorToDelete?.name}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFloorToDelete(null)}
              disabled={deletingFloor}
              className="border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] transition-all duration-200"
            >
              Cancel
            </Button>
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() =>
                  floorToDelete && handleDeleteFloor(floorToDelete.id)
                }
                disabled={deletingFloor}
                className="bg-red-600 hover:bg-red-700 text-white border border-red-600/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <motion.span
                  animate={deletingFloor ? { opacity: [1, 0.5, 1] } : {}}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  {deletingFloor ? "Deleting..." : "Delete Floor"}
                </motion.span>
              </Button>
            </motion.div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// AddFloorDialog Component
function AddFloorDialog({
  open,
  onOpenChange,
  onSuccess,
  existingFloors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  existingFloors: FloorRoster[];
}) {
  const [floorName, setFloorName] = useState("");
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [saving, setSaving] = useState(false);
  const [deptInput, setDeptInput] = useState("");
  const enterLock = useRef(false);

  // Calculate next level
  const nextLevel = Math.max(0, ...existingFloors.map((f) => f.level)) + 1;

  const resetForm = () => {
    setFloorName("");
    setDepartments([]);
    setDeptInput("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const addDepartment = () => {
    const name = deptInput.trim();
    if (!name || enterLock.current) return;
    enterLock.current = true;
    setDepartments((prev) => [...prev, { name }]);
    setDeptInput("");
    setTimeout(() => (enterLock.current = false), 180);
  };

  const removeDepartment = (index: number) => {
    setDepartments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!floorName.trim()) {
      toast.error("Please enter a floor name");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        level: nextLevel,
        name: floorName.trim(),
        departments: departments.map((d) => ({
          name: d.name.trim(),
          color: d.color || "",
        })),
      };

      await api(
        "/floors",
        { method: "POST", body: JSON.stringify(payload) },
        getToken()!
      );

      toast.success("Floor added successfully!");
      onSuccess();
    } catch (error: any) {
      toast.error(error?.message || "Failed to add floor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#0e0e12] border border-[#2a2a35] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Add New Floor</DialogTitle>
          <DialogDescription className="text-[#a5a6bf]">
            Create a new floor with departments for your organization.
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="space-y-4"
        >
          {/* Floor Name */}
          <div>
            <label className="text-[12px] text-[#9fa0b8] mb-1 block">
              Floor name
            </label>
            <Input
              value={floorName}
              onChange={(e) => setFloorName(e.target.value)}
              className="bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/70 hover:border-[#3a3a45] focus:border-brand/50 transition-all duration-200"
              placeholder={`Floor ${nextLevel}`}
            />
          </div>

          {/* Departments */}
          <div>
            <label className="text-[12px] text-[#9fa0b8] mb-2 block">
              Departments
            </label>

            {/* Department Input */}
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
                <Input
                  value={deptInput}
                  onChange={(e) => setDeptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      (e.key === "Enter" || e.key === "NumpadEnter") &&
                      !e.shiftKey &&
                      !(e as any).nativeEvent?.isComposing &&
                      !e.repeat
                    ) {
                      e.preventDefault();
                      addDepartment();
                    }
                  }}
                  placeholder="Add department (press Enter)"
                  className="pl-9 bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/70 hover:border-[#3a3a45] focus:border-brand/50 transition-all duration-200"
                />
              </div>
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  type="button"
                  onClick={addDepartment}
                  className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] text-brand-foreground border border-brand/30 transition-all duration-200 hover:scale-105"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add
                </Button>
              </motion.div>
            </div>

            {/* Department Tags */}
            <AnimatePresence>
              {departments.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-wrap gap-2"
                >
                  {departments.map((d, i) => (
                    <motion.span
                      key={`${d.name}-${i}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2, delay: i * 0.05 }}
                      className="inline-flex items-center gap-2 px-2.5 h-8 rounded-md border border-[#4f4f4f] bg-[#121212] text-[13px] text-white hover:bg-[#1a1a22] transition-all duration-200"
                    >
                      {d.name}
                      <motion.button
                        type="button"
                        onClick={() => removeDepartment(i)}
                        className="text-[#d6d6d6]/80 hover:text-white transition-colors duration-200"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        aria-label="Remove"
                      >
                        ×
                      </motion.button>
                    </motion.span>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[12px] text-[#9fa0b8]"
                >
                  No departments yet.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] transition-all duration-200 hover:scale-105"
          >
            Cancel
          </Button>
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleSave}
              disabled={saving || !floorName.trim()}
              className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] text-brand-foreground border border-brand/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <motion.span
                animate={saving ? { opacity: [1, 0.5, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {saving ? "Adding..." : "Add Floor"}
              </motion.span>
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// EditFloorDialog Component
function EditFloorDialog({
  open,
  onOpenChange,
  onSuccess,
  floor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  floor: FloorRoster | null;
}) {
  const [floorName, setFloorName] = useState("");
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [saving, setSaving] = useState(false);
  const [deptInput, setDeptInput] = useState("");
  const enterLock = useRef(false);

  // Populate form when floor changes
  useEffect(() => {
    if (floor) {
      setFloorName(floor.name);
      setDepartments(
        floor.departments.map((d) => ({
          name: d.name,
          color: (d as any).color || "",
        }))
      );
    }
  }, [floor]);

  const resetForm = () => {
    setFloorName("");
    setDepartments([]);
    setDeptInput("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const addDepartment = () => {
    const name = deptInput.trim();
    if (!name || enterLock.current) return;
    enterLock.current = true;
    setDepartments((prev) => [...prev, { name }]);
    setDeptInput("");
    setTimeout(() => (enterLock.current = false), 180);
  };

  const removeDepartment = (index: number) => {
    setDepartments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!floorName.trim()) {
      toast.error("Please enter a floor name");
      return;
    }
    if (!floor) return;

    const orgId = localStorage.getItem("garage_org_id");

    setSaving(true);
    try {
      const payload = {
        name: floorName.trim(),
        departments: departments.map((d) => ({
          name: d.name.trim(),
          color: d.color || "",
        })),
      };

      await api(
        `/floors/${floor.id}?organizationId=${orgId}`,
        { method: "PATCH", body: JSON.stringify(payload) },
        getToken()!
      );

      toast.success("Floor updated successfully!");
      onSuccess();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update floor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#0e0e12] border border-[#2a2a35] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Edit Floor</DialogTitle>
          <DialogDescription className="text-[#a5a6bf]">
            Update floor name and departments for {floor?.name || "this floor"}.
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="space-y-4"
        >
          {/* Floor Name */}
          <div>
            <label className="text-[12px] text-[#9fa0b8] mb-1 block">
              Floor name
            </label>
            <Input
              value={floorName}
              onChange={(e) => setFloorName(e.target.value)}
              className="bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/70 hover:border-[#3a3a45] focus:border-brand/50 transition-all duration-200"
              placeholder="Enter floor name"
            />
          </div>

          {/* Departments */}
          <div>
            <label className="text-[12px] text-[#9fa0b8] mb-2 block">
              Departments
            </label>

            {/* Department Input */}
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
                <Input
                  value={deptInput}
                  onChange={(e) => setDeptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      (e.key === "Enter" || e.key === "NumpadEnter") &&
                      !e.shiftKey &&
                      !(e as any).nativeEvent?.isComposing &&
                      !e.repeat
                    ) {
                      e.preventDefault();
                      addDepartment();
                    }
                  }}
                  placeholder="Add department (press Enter)"
                  className="pl-9 bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/70 hover:border-[#3a3a45] focus:border-brand/50 transition-all duration-200"
                />
              </div>
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  type="button"
                  onClick={addDepartment}
                  className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] text-brand-foreground border border-brand/30 transition-all duration-200 hover:scale-105"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add
                </Button>
              </motion.div>
            </div>

            {/* Department Tags */}
            <AnimatePresence>
              {departments.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-wrap gap-2"
                >
                  {departments.map((d, i) => (
                    <motion.span
                      key={`${d.name}-${i}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2, delay: i * 0.05 }}
                      className="inline-flex items-center gap-2 px-2.5 h-8 rounded-md border border-[#4f4f4f] bg-[#121212] text-[13px] text-white hover:bg-[#1a1a22] transition-all duration-200"
                    >
                      {d.name}
                      <motion.button
                        type="button"
                        onClick={() => removeDepartment(i)}
                        className="text-[#d6d6d6]/80 hover:text-white transition-colors duration-200"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        aria-label="Remove"
                      >
                        ×
                      </motion.button>
                    </motion.span>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[12px] text-[#9fa0b8]"
                >
                  No departments yet.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] transition-all duration-200 hover:scale-105"
          >
            Cancel
          </Button>
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleSave}
              disabled={saving || !floorName.trim()}
              className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] text-brand-foreground border border-brand/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <motion.span
                animate={saving ? { opacity: [1, 0.5, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {saving ? "Updating..." : "Update Floor"}
              </motion.span>
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ChangeAssignmentsDialog Component
function ChangeAssignmentsDialog({
  open,
  onOpenChange,
  onSuccess,
  floors,
  unassignedMembers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  floors: FloorRoster[];
  unassignedMembers: Member[];
}) {
  const [step, setStep] = useState<
    "select-source" | "select-users" | "select-destination"
  >("select-source");
  const [sourceFloorId, setSourceFloorId] = useState<string>("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [destinationFloorId, setDestinationFloorId] = useState<string>("");
  const [transferring, setTransferring] = useState(false);

  const resetForm = () => {
    setStep("select-source");
    setSourceFloorId("");
    setSelectedUsers([]);
    setDestinationFloorId("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const getSourceFloorMembers = () => {
    if (sourceFloorId === "unassigned") {
      return unassignedMembers;
    }
    const floor = floors.find((f) => f.id === sourceFloorId);
    return floor?.members || [];
  };

  const getAvailableDestinationFloors = () => {
    return floors.filter((f) => f.id !== sourceFloorId);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    const members = getSourceFloorMembers();
    setSelectedUsers(members.map((m) => m.id));
  };

  const deselectAllUsers = () => {
    setSelectedUsers([]);
  };

  const handleTransfer = async () => {
    if (selectedUsers.length === 0) {
      toast.error("Please select at least one user to transfer");
      return;
    }

    if (!destinationFloorId) {
      toast.error("Please select a destination floor");
      return;
    }

    setTransferring(true);
    try {
      const payload = {
        userIds: selectedUsers,
        destinationFloorId:
          destinationFloorId === "unassigned" ? null : destinationFloorId,
      };

      await api(
        "/team/bulk-transfer",
        { method: "POST", body: JSON.stringify(payload) },
        getToken()!
      );

      toast.success(`Successfully transferred ${selectedUsers.length} user(s)`);
      resetForm();
      onSuccess();
    } catch (error: any) {
      toast.error(error?.message || "Failed to transfer users");
    } finally {
      setTransferring(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case "select-source":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-4"
          >
            <div>
              <label className="text-[12px] text-[#9fa0b8] mb-2 block">
                Select source floor
              </label>
              <Select value={sourceFloorId} onValueChange={setSourceFloorId}>
                <SelectTrigger className="w-full h-10 bg-transparent border border-[#2a2a35] text-white hover:border-[#3a3a45] focus:border-brand/50">
                  <SelectValue placeholder="Choose a floor..." />
                </SelectTrigger>
                <SelectContent className="bg-[#0e0e12] border border-[#2a2a35] text-white">
                  {/* <SelectItem
                    value="unassigned"
                    className="hover:bg-[#1a1a22] focus:bg-[#1a1a22]"
                  >
                    Unassigned ({unassignedMembers.length} users)
                  </SelectItem> */}
                  {floors.map((floor) => (
                    <SelectItem
                      key={floor.id}
                      value={floor.id}
                      className="hover:bg-[#1a1a22] focus:bg-[#1a1a22]"
                    >
                      {floor.name} - Level {floor.level} ({floor.members.length}{" "}
                      users)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </motion.div>
        );

      case "select-users":
        const members = getSourceFloorMembers();
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">
                Select users to transfer ({members.length} total)
              </h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={selectAllUsers}
                  className="text-[10px] px-2 py-1 h-6 border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] transition-all duration-200"
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={deselectAllUsers}
                  className="text-[10px] px-2 py-1 h-6 border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] transition-all duration-200"
                >
                  Deselect All
                </Button>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto border border-[#2a2a35] rounded-md p-2 space-y-2">
              {members.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[12px] text-[#9fa0b8] text-center py-4"
                >
                  No users on this floor
                </motion.div>
              ) : (
                <AnimatePresence>
                  {members.map((member, index) => (
                    <motion.div
                      key={member.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{
                        duration: 0.2,
                        delay: index * 0.05,
                        ease: "easeOut",
                      }}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-all duration-200 hover:scale-[1.02]",
                        selectedUsers.includes(member.id)
                          ? "bg-brand/20 border border-brand/30 shadow-lg shadow-brand/10"
                          : "hover:bg-[#1a1a22] border border-transparent hover:border-[#2a2a35]"
                      )}
                      onClick={() => toggleUserSelection(member.id)}
                    >
                      <motion.input
                        type="checkbox"
                        checked={selectedUsers.includes(member.id)}
                        onChange={() => toggleUserSelection(member.id)}
                        className="rounded border-[#2a2a35] bg-transparent"
                        whileTap={{ scale: 0.95 }}
                      />
                      <Avatar className="h-8 w-8 border border-[#2f2f3b] bg-[#1b1b24]">
                        <AvatarFallback className="text-xs text-black font-medium">
                          {(member.name || member.email || "?")
                            .slice(0, 1)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">
                          {member.name || member.email}
                        </div>
                        <div className="text-[11px] text-[#9fa0b8] truncate">
                          {member.email}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {member.department && (
                          <span className="text-[11px] px-2 py-0.5 rounded border border-[#3b3b4a] bg-[#15151b]">
                            {member.department}
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className="text-[10px] px-2 py-0.5 border-[#3d3d51] text-[#c9c9ee] bg-transparent"
                        >
                          {member.role}
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            <AnimatePresence>
              {selectedUsers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="text-[12px] text-brand flex items-center gap-2"
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.3 }}
                    className="w-2 h-2 bg-brand rounded-full"
                  />
                  {selectedUsers.length} user(s) selected
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );

      case "select-destination":
        const availableFloors = getAvailableDestinationFloors();
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-4"
          >
            <div>
              <label className="text-[12px] text-[#9fa0b8] mb-2 block">
                Select destination floor
              </label>
              <Select
                value={destinationFloorId}
                onValueChange={setDestinationFloorId}
              >
                <SelectTrigger className="w-full h-10 bg-transparent border border-[#2a2a35] text-white hover:border-[#3a3a45] focus:border-brand/50">
                  <SelectValue placeholder="Choose destination..." />
                </SelectTrigger>
                <SelectContent className="bg-[#0e0e12] border border-[#2a2a35] text-white">
                  {/* <SelectItem
                    value="unassigned"
                    className="hover:bg-[#1a1a22] focus:bg-[#1a1a22]"
                  >
                    Unassigned
                  </SelectItem> */}
                  {availableFloors.map((floor) => (
                    <SelectItem
                      key={floor.id}
                      value={floor.id}
                      className="hover:bg-[#1a1a22] focus:bg-[#1a1a22]"
                    >
                      {floor.name} - Level {floor.level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="bg-[#1a1a22] border border-[#2a2a35] rounded-md p-3"
            >
              <div className="text-[12px] text-[#9fa0b8] mb-2">
                Transfer Summary:
              </div>
              <div className="text-sm text-white">
                Moving {selectedUsers.length} user(s) to{" "}
                {destinationFloorId === "unassigned"
                  ? "Unassigned"
                  : availableFloors.find((f) => f.id === destinationFloorId)
                      ?.name || "Unknown"}
              </div>
            </motion.div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (step) {
      case "select-source":
        return sourceFloorId !== "";
      case "select-users":
        return selectedUsers.length > 0;
      case "select-destination":
        return destinationFloorId !== "";
      default:
        return false;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case "select-source":
        return "Select Source Floor";
      case "select-users":
        return "Select Users to Transfer";
      case "select-destination":
        return "Select Destination Floor";
      default:
        return "Change Assignments";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#0e0e12] border border-[#2a2a35] text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">{getStepTitle()}</DialogTitle>
          <DialogDescription className="text-[#a5a6bf]">
            {step === "select-source" &&
              "Choose which floor you want to transfer users from."}
            {step === "select-users" &&
              "Select the users you want to transfer."}
            {step === "select-destination" &&
              "Choose where to move the selected users."}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="py-5"
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="flex gap-2">
              <AnimatePresence>
                {step !== "select-source" && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (step === "select-users") {
                          setStep("select-source");
                        } else if (step === "select-destination") {
                          setStep("select-users");
                        }
                      }}
                      className="border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] transition-all duration-200 hover:scale-105"
                    >
                      Back
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] transition-all duration-200 hover:scale-105"
              >
                Cancel
              </Button>
            </div>

            <div className="flex gap-2">
              {step === "select-destination" ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button
                    onClick={handleTransfer}
                    disabled={transferring || !canProceed()}
                    className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] text-brand-foreground border border-brand/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    <motion.span
                      animate={transferring ? { opacity: [1, 0.5, 1] } : {}}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      {transferring ? "Transferring..." : "Transfer Users"}
                    </motion.span>
                  </Button>
                </motion.div>
              ) : (
                <Button
                  onClick={() => {
                    if (step === "select-source") {
                      setStep("select-users");
                    } else if (step === "select-users") {
                      setStep("select-destination");
                    }
                  }}
                  disabled={!canProceed()}
                  className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] text-brand-foreground border border-brand/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  Next
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

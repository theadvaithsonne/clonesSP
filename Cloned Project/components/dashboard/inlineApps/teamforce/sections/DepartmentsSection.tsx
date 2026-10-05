"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Users,
  Layers,
  Tag,
  AlignLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../api";
import type { Department } from "../types";

interface Props {
  hasWriteAccess: boolean;
}

export default function DepartmentsSection({ hasWriteAccess }: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [nameError, setNameError] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      const res = await listDepartments();
      setDepartments(res.departments || []);
    } catch {
      toast.error("Failed to load departments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Dock "Add Department" action (the on-page button moved into the dock)
  useEffect(() => {
    if (!hasWriteAccess) return;
    const handler = () => openAdd();
    window.addEventListener("teamforce:create-department", handler);
    return () =>
      window.removeEventListener("teamforce:create-department", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openAdd is stable (only sets state)
  }, [hasWriteAccess]);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", description: "" });
    setNameError("");
    setDialogOpen(true);
  }

  function openEdit(d: Department) {
    setEditing(d);
    setForm({ name: d.name, description: d.description || "" });
    setNameError("");
    setDialogOpen(true);
  }

  function validateName(val: string, currentId?: string): string {
    const trimmed = val.trim();
    if (!trimmed) return "Department name is required";
    if (trimmed.length > 100) return "Department name must be 100 characters or fewer";
    if (!/^[\p{L}\p{N}\s&\-.,()'/]+$/u.test(trimmed)) return "Department name contains invalid characters";
    const duplicate = departments.find(
      (d) => d.name.trim().toLowerCase() === trimmed.toLowerCase() && d._id !== currentId
    );
    if (duplicate) return `A department named "${duplicate.name}" already exists`;
    return "";
  }

  async function handleSave() {
    const err = validateName(form.name, editing?._id);
    if (err) { setNameError(err); toast.error(err); return; }
    if (form.description.trim().length > 500) { toast.error("Description must be 500 characters or fewer"); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateDepartment(editing._id, { name: form.name.trim(), description: form.description.trim() });
        toast.success(`Department ${form.name.trim()} updated`);
      } else {
        await createDepartment({ name: form.name.trim(), description: form.description.trim() });
        toast.success(`Department ${form.name.trim()} created`);
      }
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || "";
      if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("already exists") || msg.toLowerCase().includes("exists")) {
        toast.error("A department with this name already exists");
      } else if (msg) {
        toast.error(msg);
      } else {
        toast.error("Failed to save department. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: string) {
    const dept = departments.find((d) => d._id === id);
    if (!dept) return;
    setDeptToDelete(dept);
    setDeleteConfirmOpen(true);
  }

  async function confirmDelete() {
    if (!deptToDelete) return;
    setDeleting(true);
    try {
      await deleteDepartment(deptToDelete._id);
      toast.success(`Department "${deptToDelete.name}" deleted`);
      setDeleteConfirmOpen(false);
      setDeptToDelete(null);
      await load();
    } catch {
      toast.error("Failed to delete department");
    } finally {
      setDeleting(false);
    }
  }

  // Neutral icon treatment — same look for all cards to stay on-brand
  const cardStyle = {
    bg: "bg-white/5",
    ring: "ring-white/8",
    icon: "text-[#a8a8a8]",
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight">
            Departments
          </h2>
          <p className="text-sm text-[#a8a8a8] mt-1">
            {departments.length} department{departments.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        {/* Add Department moved into the bottom dock */}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : departments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 animate-[fadeIn_0.3s_ease-out]">
          <div className="h-16 w-16 rounded-2xl bg-[#050505] flex items-center justify-center mb-4">
            <Layers className="h-7 w-7 text-[#5a5a5a]" />
          </div>
          <p className="text-sm text-[#a8a8a8]">No departments yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((d, i) => {
            return (
              <div
                key={d._id}
                style={{ animationDelay: `${i * 40}ms` }}
                className="bg-[#050505] rounded-xl border border-white/8 p-5 group hover:border-brand/20 hover:shadow-lg hover:shadow-black/20 transition-all duration-200 animate-[slideUp_0.4s_ease-out_both]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-10 w-10 shrink-0 rounded-xl ${cardStyle.bg} ring-1 ${cardStyle.ring} flex items-center justify-center group-hover:ring-brand/30 group-hover:scale-110 transition-all duration-200`}
                    >
                      <Users
                        className={`h-4 w-4 ${cardStyle.icon} group-hover:text-brand transition-colors`}
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[14px] font-semibold text-white truncate">
                        {d.name}
                      </h3>
                      {d.headId && typeof d.headId === "object" && (
                        <p className="text-[11px] text-[#a8a8a8] mt-0.5 truncate">
                          Head: {d.headId.name}
                        </p>
                      )}
                    </div>
                  </div>
                  {hasWriteAccess && (
                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={() => openEdit(d)}
                        className="h-7 w-7 rounded-lg hover:bg-white/8 flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5 text-[#a8a8a8]" />
                      </button>
                      <button
                        onClick={() => handleDelete(d._id)}
                        className="h-7 w-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400/60" />
                      </button>
                    </div>
                  )}
                </div>
                {d.description && (
                  <p className="text-[12px] text-[#a8a8a8] mt-4 line-clamp-2 leading-relaxed">
                    {d.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(o) => { if (!deleting) setDeleteConfirmOpen(o); }}>
        <DialogContent
          showCloseButton={false}
          className="bg-[#050505] border-white/8 text-white shadow-2xl shadow-black/60 sm:max-w-[400px] p-0 gap-0 overflow-hidden"
        >
          <DialogHeader className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 sm:pb-5 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-xl bg-red-500/10 ring-1 ring-red-500/20 flex items-center justify-center">
                <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 text-red-400" />
              </div>
              <div className="text-left min-w-0">
                <DialogTitle className="text-[15px] sm:text-[16px] font-semibold text-white tracking-tight">
                  Delete Department
                </DialogTitle>
                <DialogDescription className="text-[11px] sm:text-[12px] text-[#a8a8a8] mt-0.5">
                  This action cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="px-4 sm:px-6 py-4 sm:py-5">
            <p className="text-[12px] sm:text-[13px] text-[#d4d4d4] leading-relaxed">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-white break-all">"{deptToDelete?.name}"</span>?
              Employees assigned to this department will be unaffected but will no longer have a department.
            </p>
          </div>
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-white/5 bg-[#141414] flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
              className="w-full sm:w-auto text-[#a8a8a8] hover:text-white hover:bg-white/5 cursor-pointer h-10"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="w-full sm:w-auto bg-red-600 text-white hover:bg-red-600/90 cursor-pointer font-semibold h-10 disabled:opacity-50"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Department
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="bg-[#050505] border-white/8 text-white shadow-2xl shadow-black/60 sm:max-w-[460px] p-0 gap-0 overflow-hidden"
        >
          {/* Modal header */}
          <DialogHeader className="px-6 pt-6 pb-5 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-brand/10 ring-1 ring-brand/20 flex items-center justify-center shrink-0">
                <Layers className="h-5 w-5 text-brand" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-[16px] font-semibold text-white tracking-tight">
                  {editing ? "Edit Department" : "New Department"}
                </DialogTitle>
                <p className="text-[12px] text-[#a8a8a8] mt-0.5">
                  {editing
                    ? "Update the department information"
                    : "Group your team by function or area"}
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Form body */}
          <div className="px-6 py-5 space-y-4">
            <FormField label="Department Name" required>
              <IconInput
                icon={<Tag className="h-4 w-4" />}
                value={form.name}
                onChange={(v) => {
                  setForm({ ...form, name: v });
                  setNameError(v.trim() ? validateName(v, editing?._id) : "");
                }}
                placeholder="e.g. Engineering"
                hasError={!!nameError}
                maxLength={100}
              />
              {nameError && <p className="text-[11px] text-red-400 mt-1">{nameError}</p>}
            </FormField>

            <FormField label="Description">
              <div className="relative group">
                <div className="absolute left-3 top-3 text-[#5a5a5a] group-focus-within:text-brand transition-colors pointer-events-none">
                  <AlignLeft className="h-4 w-4" />
                </div>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of what this department does..."
                  maxLength={500}
                  className="bg-[#0a0a0a] border-white/8 pl-10 pt-3 h-[88px] max-h-[88px] overflow-y-auto overflow-x-hidden [word-break:break-all] text-sm text-white placeholder:text-[#5a5a5a] focus-visible:border-brand/40 focus-visible:ring-1 focus-visible:ring-brand/20 transition-colors resize-none"
                />
              </div>
              {form.description.length > 450 && (
                <p className="text-[11px] text-[#7a7a7a] mt-1 text-right">{form.description.length}/500</p>
              )}
            </FormField>
          </div>

          {/* Sticky footer */}
          <div className="px-6 py-4 border-t border-white/5 bg-[#141414] flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="text-[#a8a8a8] hover:text-white hover:bg-white/5 cursor-pointer h-10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer font-semibold h-10 shadow-lg shadow-brand/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Save Changes" : "Create Department"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Reusable form pieces

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-[#a8a8a8] mb-1.5 block uppercase tracking-wider">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function IconInput({
  icon,
  value,
  onChange,
  placeholder,
  hasError,
  maxLength,
}: {
  icon: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hasError?: boolean;
  maxLength?: number;
}) {
  return (
    <div className="relative group">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a5a] group-focus-within:text-brand transition-colors pointer-events-none">
        {icon}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`bg-[#0a0a0a] h-11 pl-10 text-sm text-white placeholder:text-[#5a5a5a] focus-visible:ring-1 transition-colors${hasError ? " border-red-500/50 focus-visible:border-red-500/50 focus-visible:ring-red-500/20" : " border-white/8 focus-visible:border-brand/40 focus-visible:ring-brand/20"}`}
      />
    </div>
  );
}

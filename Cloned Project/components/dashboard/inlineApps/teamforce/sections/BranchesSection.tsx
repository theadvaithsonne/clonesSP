"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  MapPin,
  Building2,
  Hash,
  Globe,
  Map,
  Mail,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  listBranches,
  createBranch,
  updateBranch,
  deleteBranch,
} from "../api";
import type { Branch } from "../types";

interface Props {
  hasWriteAccess: boolean;
}

export default function BranchesSection({ hasWriteAccess }: Props) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
  });

  const [nameError, setNameError] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);

  function handleNameChange(v: string) {
    if (v.length > 50) return;
    setForm((prev) => ({ ...prev, name: v }));
    if (v && !/^[A-Za-z0-9 \-_.,()&']+$/.test(v)) {
      setNameError("Only letters, numbers, spaces and - _ . , ( ) & ' are allowed");
    } else {
      setNameError("");
    }
  }

  function handleCodeChange(v: string) {
    // Strip invalid characters on-the-fly; cap at 20 chars
    const sanitized = v.replace(/[^A-Za-z0-9\-_]/g, "").slice(0, 20);
    setForm((prev) => ({ ...prev, code: sanitized }));
  }

  // Postal code → city/state/country auto-resolve (matches the onboarding pattern)
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState<string>("");
  const [pincodeResolved, setPincodeResolved] = useState(false);
  const pincodeTimerRef = useRef<NodeJS.Timeout | null>(null);

  async function resolvePostalCode(code: string, countryHint?: string) {
    if (code.trim().length < 3) return;
    setPincodeLoading(true);
    setPincodeError("");
    setPincodeResolved(false);
    try {
      const params = new URLSearchParams({ pincode: code.trim() });
      if (countryHint?.trim()) params.append("country", countryHint.trim());
      const result = await api<{
        city: string;
        state: string;
        country: string;
        latitude: number;
        longitude: number;
      }>(`/org/resolve-pincode?${params.toString()}`, { method: "GET" });
      setForm((prev) => ({
        ...prev,
        city: result.city || prev.city,
        state: result.state || prev.state,
        country: result.country || prev.country,
      }));
      setPincodeResolved(true);
    } catch {
      setPincodeError("Couldn't auto-fill location. Please enter city, state and country manually.");
    } finally {
      setPincodeLoading(false);
    }
  }

  function handlePostalCodeChange(raw: string) {
    // Strip non-numeric characters — postal codes are digits only
    const value = raw.replace(/[^0-9]/g, "");
    setForm((prev) => ({ ...prev, postalCode: value }));
    setPincodeResolved(false);
    setPincodeError("");
    if (pincodeTimerRef.current) clearTimeout(pincodeTimerRef.current);
    if (value.trim().length >= 3) {
      pincodeTimerRef.current = setTimeout(() => {
        resolvePostalCode(value, form.country);
      }, 800);
    } else {
      // user cleared / shortened the code → clear the auto-filled fields
      setForm((prev) => ({ ...prev, city: "", state: "", country: "" }));
    }
  }

  // Cleanup pending debounce on unmount
  useEffect(() => {
    return () => {
      if (pincodeTimerRef.current) clearTimeout(pincodeTimerRef.current);
    };
  }, []);

  async function load() {
    try {
      const res = await listBranches();
      setBranches(res.branches || []);
    } catch {
      toast.error("Failed to load branches");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Dock "Add Branch" action (the on-page button moved into the dock)
  useEffect(() => {
    if (!hasWriteAccess) return;
    const handler = () => openAdd();
    window.addEventListener("teamforce:create-branch", handler);
    return () =>
      window.removeEventListener("teamforce:create-branch", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openAdd is stable (only sets state)
  }, [hasWriteAccess]);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", code: "", city: "", state: "", country: "", postalCode: "" });
    setPincodeError("");
    setPincodeResolved(false);
    setPincodeLoading(false);
    setNameError("");
    setDialogOpen(true);
  }

  function openEdit(b: Branch) {
    setEditing(b);
    setForm({
      name: b.name,
      code: b.code || "",
      city: b.city || "",
      state: b.state || "",
      country: b.country || "",
      postalCode: b.postalCode || "",
    });
    setPincodeError("");
    setPincodeResolved(Boolean(b.postalCode));
    setPincodeLoading(false);
    setNameError("");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Branch name is required");
      return;
    }
    if (nameError) {
      toast.error("Please fix the branch name before saving");
      return;
    }
    if (form.code.trim() && !/^[A-Za-z0-9\-_]+$/.test(form.code.trim())) {
      toast.error("Branch code can only contain letters, numbers, hyphens and underscores");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateBranch(editing._id, form);
        toast.success(`Branch ${form.name} updated`);
      } else {
        await createBranch(form);
        toast.success(`Branch ${form.name} created`);
      }
      setDialogOpen(false);
      await load();
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (msg.toLowerCase().includes("already exists")) {
        toast.error("Branch name already exists. Please choose a different name.");
      } else {
        toast.error("Failed to save branch");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: string) {
    const branch = branches.find((b) => b._id === id);
    if (!branch) return;
    setBranchToDelete(branch);
    setDeleteConfirmOpen(true);
  }

  async function confirmDelete() {
    if (!branchToDelete) return;
    setDeleting(true);
    try {
      await deleteBranch(branchToDelete._id);
      toast.success(`Branch "${branchToDelete.name}" deleted`);
      setDeleteConfirmOpen(false);
      setBranchToDelete(null);
      await load();
    } catch {
      toast.error("Failed to delete branch");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight">
            Branches
          </h2>
          <p className="text-sm text-[#a8a8a8] mt-1">
            {branches.length} branch{branches.length !== 1 ? "es" : ""} configured
          </p>
        </div>
        {/* Add Branch moved into the bottom dock */}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : branches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 animate-[fadeIn_0.3s_ease-out]">
          <div className="h-16 w-16 rounded-2xl bg-[#050505] flex items-center justify-center mb-4">
            <Building2 className="h-7 w-7 text-[#5a5a5a]" />
          </div>
          <p className="text-sm text-[#a8a8a8]">No branches yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b, i) => (
            <div
              key={b._id}
              style={{ animationDelay: `${i * 40}ms` }}
              className="bg-[#050505] rounded-xl border border-white/8 p-5 group hover:border-white/10 hover:shadow-lg hover:shadow-black/20 transition-all duration-200 animate-[slideUp_0.4s_ease-out_both]"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-white/5 ring-1 ring-white/8 flex items-center justify-center group-hover:ring-brand/30 group-hover:scale-110 transition-all duration-200">
                    <Building2 className="h-4 w-4 text-[#a8a8a8] group-hover:text-brand transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold text-white truncate">
                      {b.name}
                    </h3>
                    {b.code && (
                      <p className="text-[11px] text-[#a8a8a8] mt-0.5 font-mono truncate">
                        {b.code}
                      </p>
                    )}
                  </div>
                </div>
                {hasWriteAccess && (
                  <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => openEdit(b)}
                      className="h-7 w-7 rounded-lg hover:bg-white/8 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5 text-[#a8a8a8]" />
                    </button>
                    <button
                      onClick={() => handleDelete(b._id)}
                      className="h-7 w-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400/60" />
                    </button>
                  </div>
                )}
              </div>
              {(b.city || b.state || b.country) && (
                <div className="flex items-center gap-1.5 mt-4 text-[12px] text-[#a8a8a8]">
                  <MapPin className="h-3 w-3 text-[#5a5a5a]" />
                  {[b.city, b.state, b.country].filter(Boolean).join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={(o) => { if (!deleting) setDeleteConfirmOpen(o); }}
      >
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
                  Delete Branch
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
              <span className="font-semibold text-white break-all">
                &quot;{branchToDelete?.name}&quot;
              </span>
              ? Employees assigned to this branch will be unaffected but will no longer have a branch.
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
              Delete Branch
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="bg-[#050505] border-white/8 text-white shadow-2xl shadow-black/60 sm:max-w-[480px] p-0 gap-0 overflow-hidden"
        >
          {/* Modal header */}
          <DialogHeader className="px-6 pt-6 pb-5 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-brand/10 ring-1 ring-brand/20 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-brand" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-[16px] font-semibold text-white tracking-tight">
                  {editing ? "Edit Branch" : "New Branch"}
                </DialogTitle>
                <p className="text-[12px] text-[#a8a8a8] mt-0.5">
                  {editing
                    ? "Update the branch information"
                    : "Set up a new office location"}
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Form body */}
          <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
            <FormField label="Branch Name" required>
              <IconInput
                icon={<Building2 className="h-4 w-4" />}
                value={form.name}
                onChange={handleNameChange}
                placeholder="e.g. Headquarters"
                maxLength={50}
              />
              {nameError && (
                <p className="text-[11px] text-red-400/80 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {nameError}
                </p>
              )}
              <p className="text-[11px] text-[#5a5a5a] mt-1 text-right">{form.name.length}/50</p>
            </FormField>

            <FormField label="Branch Code">
              <IconInput
                icon={<Hash className="h-4 w-4" />}
                value={form.code}
                onChange={handleCodeChange}
                placeholder="e.g. HQ-NYC"
                mono
                maxLength={20}
              />
              <p className="text-[11px] text-[#5a5a5a] mt-1 text-right">{form.code.length}/20</p>
            </FormField>

            <div className="pt-1">
              <p className="text-[10px] font-semibold text-[#5a5a5a] uppercase tracking-[0.12em] mb-3">
                Location
              </p>

              {/* Postal code — leads, auto-fills city/state/country */}
              <FormField label="Postal Code">
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a5a] group-focus-within:text-brand transition-colors pointer-events-none">
                    <Mail className="h-4 w-4" />
                  </div>
                  <Input
                    value={form.postalCode}
                    onChange={(e) => handlePostalCodeChange(e.target.value)}
                    placeholder="Enter postal / pin code"
                    className="bg-[#0a0a0a] border-white/8 h-11 pl-10 pr-10 text-sm text-white placeholder:text-[#5a5a5a] font-mono focus-visible:border-brand/40 focus-visible:ring-1 focus-visible:ring-brand/20 transition-colors"
                  />
                  {/* Status indicator inside input */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {pincodeLoading ? (
                      <Loader2 className="h-4 w-4 text-brand animate-spin" />
                    ) : pincodeError ? (
                      <AlertCircle className="h-4 w-4 text-red-400/80" />
                    ) : pincodeResolved && form.postalCode ? (
                      <Check className="h-4 w-4 text-brand" />
                    ) : null}
                  </div>
                </div>
                {pincodeError ? (
                  <p className="text-[11px] text-red-400/80 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {pincodeError}
                  </p>
                ) : (
                  <p className="text-[11px] text-[#5a5a5a] mt-1.5">
                    City, state and country will fill in automatically
                  </p>
                )}
              </FormField>

              {/* Auto-populated location fields (still editable) */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <FormField label="City">
                  <IconInput
                    icon={<MapPin className="h-4 w-4" />}
                    value={form.city}
                    onChange={(v) => setForm({ ...form, city: v })}
                    placeholder="Auto"
                  />
                </FormField>
                <FormField label="State / Province">
                  <IconInput
                    icon={<Map className="h-4 w-4" />}
                    value={form.state}
                    onChange={(v) => setForm({ ...form, state: v })}
                    placeholder="Auto"
                  />
                </FormField>
                <div className="col-span-2">
                  <FormField label="Country">
                    <IconInput
                      icon={<Globe className="h-4 w-4" />}
                      value={form.country}
                      onChange={(v) => setForm({ ...form, country: v })}
                      placeholder="Auto"
                    />
                  </FormField>
                </div>
              </div>
            </div>
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
              disabled={saving || !form.name.trim() || !!nameError}
              className="bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer font-semibold h-10 shadow-lg shadow-brand/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Save Changes" : "Create Branch"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Reusable form pieces (kept local to the file)

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
  mono,
  maxLength,
}: {
  icon: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
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
        className={`bg-[#0a0a0a] border-white/8 h-11 pl-10 text-sm text-white placeholder:text-[#5a5a5a] focus-visible:border-brand/40 focus-visible:ring-1 focus-visible:ring-brand/20 transition-colors ${mono ? "font-mono tracking-wider" : ""}`}
      />
    </div>
  );
}

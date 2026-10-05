"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/coverfi/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
} from "@/lib/coverfi/roles-api";
import type { CoverfiRole } from "@/lib/coverfi/types";
import { toast } from "sonner";

export default function RolesTable() {
  const [rows, setRows] = useState<CoverfiRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CoverfiRole | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setRows(await listRoles());
    } catch (e: any) {
      toast.error(e?.message || "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onDelete(r: CoverfiRole) {
    if (!confirm(`Delete role "${r.name}"?`)) return;
    try {
      await deleteRole(r._id);
      toast.success("Deleted");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Coverfi · People"
        title="Coverfi Roles"
        description="Labels you can assign to stakeholders or customer-company employees. Coverfi-only — they don't grant any Garage permissions."
        icon={<UserCircle className="h-4 w-4" />}
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Add role
          </Button>
        }
      />

      <div className="px-8 pt-6 pb-8">
      <div className="rounded-lg border border-[#222230] bg-[#0c0c12] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-[#9fa0b8]">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-[#9fa0b8]">
                  No Coverfi roles yet. Add labels like &quot;Sales
                  Agent&quot;, &quot;Underwriter&quot;, etc.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r._id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-[#9fa0b8] text-sm">
                    {r.description || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(r);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onDelete(r)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      </div>

      <RoleDialog
        open={dialogOpen}
        existing={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
}

function RoleDialog({
  open,
  onClose,
  onSaved,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing: CoverfiRole | null;
}) {
  const [data, setData] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setData({
        name: existing.name,
        description: existing.description || "",
      });
    } else {
      setData({ name: "", description: "" });
    }
  }, [existing, open]);

  async function onSave() {
    if (!data.name) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        await updateRole(existing._id, data);
        toast.success("Updated");
      } else {
        await createRole(data);
        toast.success("Added");
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit role" : "Add role"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-[#9fa0b8]">Name</Label>
            <Input
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              placeholder="Sales Agent"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[#9fa0b8]">Description</Label>
            <Textarea
              rows={3}
              value={data.description}
              onChange={(e) =>
                setData({ ...data, description: e.target.value })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : existing ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

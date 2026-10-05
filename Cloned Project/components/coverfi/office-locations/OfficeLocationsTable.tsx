"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";
import PageHeader from "@/components/coverfi/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listOfficeLocations,
  createOfficeLocation,
  updateOfficeLocation,
  deleteOfficeLocation,
} from "@/lib/coverfi/office-locations-api";
import type { OfficeLocation } from "@/lib/coverfi/types";
import { toast } from "sonner";

const empty = {
  location_name: "",
  full_address: "",
  city: "",
  state: "",
  country: "",
  pincode: "",
};

export default function OfficeLocationsTable() {
  const [rows, setRows] = useState<OfficeLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OfficeLocation | null>(null);
  const [data, setData] = useState({ ...empty });
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setRows(await listOfficeLocations());
    } catch (e: any) {
      toast.error(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  function openAdd() {
    setEditing(null);
    setData({ ...empty });
    setOpen(true);
  }
  function openEdit(r: OfficeLocation) {
    setEditing(r);
    setData({
      location_name: r.location_name,
      full_address: r.full_address || "",
      city: r.city || "",
      state: r.state || "",
      country: r.country || "",
      pincode: r.pincode?.toString() || "",
    });
    setOpen(true);
  }

  async function onSave() {
    if (!data.location_name) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        location_name: data.location_name,
        full_address: data.full_address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        country: data.country || undefined,
        pincode: data.pincode ? Number(data.pincode) : undefined,
      };
      if (editing) {
        await updateOfficeLocation(editing._id, payload);
      } else {
        await createOfficeLocation(payload);
      }
      toast.success("Saved");
      setOpen(false);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(r: OfficeLocation) {
    if (!confirm(`Delete "${r.location_name}"?`)) return;
    try {
      await deleteOfficeLocation(r._id);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Coverfi · Settings"
        title="Office Locations"
        description="Coverfi-specific office locations (separate from brokerage locations on the My Brokerage page)."
        icon={<MapPin className="h-4 w-4" />}
        action={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add location
          </Button>
        }
      />

      <div className="px-8 pt-6 pb-8">
      <div className="rounded-lg border border-[#222230] bg-[#0a0a0d] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>City</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Pincode</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-[#9fa0b8]">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-[#9fa0b8]">
                  No office locations yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r._id}>
                  <TableCell className="font-medium">
                    {r.location_name}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {r.full_address || "—"}
                  </TableCell>
                  <TableCell>{r.city || "—"}</TableCell>
                  <TableCell>{r.state || "—"}</TableCell>
                  <TableCell>{r.pincode || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(r)}
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

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit office location" : "Add office location"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" required>
              <Input
                value={data.location_name}
                onChange={(e) =>
                  setData({ ...data, location_name: e.target.value })
                }
                placeholder="HQ"
              />
            </Field>
            <Field label="Pincode">
              <Input
                value={data.pincode}
                onChange={(e) =>
                  setData({
                    ...data,
                    pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                  })
                }
              />
            </Field>
            <div className="col-span-2">
              <Field label="Full address">
                <Input
                  value={data.full_address}
                  onChange={(e) =>
                    setData({ ...data, full_address: e.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="City">
              <Input
                value={data.city}
                onChange={(e) => setData({ ...data, city: e.target.value })}
              />
            </Field>
            <Field label="State">
              <Input
                value={data.state}
                onChange={(e) => setData({ ...data, state: e.target.value })}
              />
            </Field>
            <Field label="Country">
              <Input
                value={data.country}
                onChange={(e) =>
                  setData({ ...data, country: e.target.value })
                }
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-[#9fa0b8]">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

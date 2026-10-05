"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  createCorporateEmployee,
  updateCorporateEmployee,
} from "@/lib/coverfi/corporate-api";
import type { CorporateEmployee } from "@/lib/coverfi/types";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  corporateId: string;
  existing?: CorporateEmployee | null;
};

const empty = {
  email: "",
  first_name: "",
  last_name: "",
  phone_number: "",
  phoneCode: "+91",
  designation: "",
  department: "",
  employee_id: "",
};

export default function EmployeeFormDialog({
  open,
  onClose,
  onSaved,
  corporateId,
  existing,
}: Props) {
  const [data, setData] = useState({ ...empty });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setData({
        email: existing.email,
        first_name: existing.first_name,
        last_name: existing.last_name,
        phone_number: existing.phone_number || "",
        phoneCode: existing.phoneCode || "+91",
        designation: existing.designation || "",
        department: existing.department || "",
        employee_id: existing.employee_id || "",
      });
    } else {
      setData({ ...empty });
    }
  }, [existing, open]);

  async function onSave() {
    if (!data.email || !data.first_name || !data.last_name) {
      toast.error("Email, first and last name are required");
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        // backend disallows email change on update
        const { email, ...patch } = data;
        await updateCorporateEmployee(existing._id, patch);
        toast.success("Employee updated");
      } else {
        await createCorporateEmployee(corporateId, data);
        toast.success("Employee added — Garage account provisioned");
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit employee" : "Add employee"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" required>
            <Input
              type="email"
              value={data.email}
              onChange={(e) => setData({ ...data, email: e.target.value })}
              disabled={!!existing}
            />
          </Field>
          <Field label="Employee ID">
            <Input
              value={data.employee_id}
              onChange={(e) =>
                setData({ ...data, employee_id: e.target.value })
              }
              placeholder="EMP-001"
            />
          </Field>
          <Field label="First name" required>
            <Input
              value={data.first_name}
              onChange={(e) =>
                setData({ ...data, first_name: e.target.value })
              }
            />
          </Field>
          <Field label="Last name" required>
            <Input
              value={data.last_name}
              onChange={(e) =>
                setData({ ...data, last_name: e.target.value })
              }
            />
          </Field>
          <Field label="Phone code">
            <Input
              value={data.phoneCode}
              onChange={(e) =>
                setData({ ...data, phoneCode: e.target.value })
              }
            />
          </Field>
          <Field label="Phone">
            <Input
              value={data.phone_number}
              onChange={(e) =>
                setData({
                  ...data,
                  phone_number: e.target.value.replace(/\D/g, ""),
                })
              }
            />
          </Field>
          <Field label="Designation">
            <Input
              value={data.designation}
              onChange={(e) =>
                setData({ ...data, designation: e.target.value })
              }
            />
          </Field>
          <Field label="Department">
            <Input
              value={data.department}
              onChange={(e) =>
                setData({ ...data, department: e.target.value })
              }
            />
          </Field>
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

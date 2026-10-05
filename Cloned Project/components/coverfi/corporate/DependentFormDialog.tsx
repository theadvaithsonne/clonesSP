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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createDependent,
  updateDependent,
} from "@/lib/coverfi/corporate-api";
import {
  DEPENDENT_RELATIONS,
  type CorporateDependent,
  type DependentRelation,
} from "@/lib/coverfi/types";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  employeeId: string;
  existing?: CorporateDependent | null;
};

const empty = {
  first_name: "",
  last_name: "",
  relation: "" as DependentRelation | "",
  date_of_birth: "",
  gender: "",
};

export default function DependentFormDialog({
  open,
  onClose,
  onSaved,
  employeeId,
  existing,
}: Props) {
  const [data, setData] = useState({ ...empty });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setData({
        first_name: existing.first_name,
        last_name: existing.last_name || "",
        relation: existing.relation,
        date_of_birth: existing.date_of_birth
          ? existing.date_of_birth.slice(0, 10)
          : "",
        gender: existing.gender || "",
      });
    } else {
      setData({ ...empty });
    }
  }, [existing, open]);

  async function onSave() {
    if (!data.first_name || !data.relation) {
      toast.error("First name and relation are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        first_name: data.first_name,
        last_name: data.last_name || undefined,
        relation: data.relation as DependentRelation,
        date_of_birth: data.date_of_birth || undefined,
        gender: data.gender || undefined,
      };
      if (existing) {
        await updateDependent(existing._id, payload);
      } else {
        await createDependent(employeeId, payload);
      }
      toast.success(existing ? "Dependent updated" : "Dependent added");
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
          <DialogTitle>
            {existing ? "Edit dependent" : "Add dependent"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-[#9fa0b8]">
              First name <span className="text-red-400">*</span>
            </Label>
            <Input
              value={data.first_name}
              onChange={(e) =>
                setData({ ...data, first_name: e.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[#9fa0b8]">Last name</Label>
            <Input
              value={data.last_name}
              onChange={(e) =>
                setData({ ...data, last_name: e.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[#9fa0b8]">
              Relation <span className="text-red-400">*</span>
            </Label>
            <Select
              value={data.relation}
              onValueChange={(v) =>
                setData({ ...data, relation: v as DependentRelation })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {DEPENDENT_RELATIONS.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[#9fa0b8]">Date of birth</Label>
            <Input
              type="date"
              value={data.date_of_birth}
              onChange={(e) =>
                setData({ ...data, date_of_birth: e.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[#9fa0b8]">Gender</Label>
            <Input
              value={data.gender}
              onChange={(e) => setData({ ...data, gender: e.target.value })}
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

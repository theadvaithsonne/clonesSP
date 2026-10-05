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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  createCategory,
  updateCategory,
} from "@/lib/coverfi/products-api";
import type { ProductCategory } from "@/lib/coverfi/types";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (created?: ProductCategory) => void;
  existing?: ProductCategory | null;
};

export default function CategoryFormDialog({
  open,
  onClose,
  onSaved,
  existing,
}: Props) {
  const [data, setData] = useState({
    category_name: "",
    category_description: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setData({
        category_name: existing.category_name,
        category_description: existing.category_description || "",
      });
    } else {
      setData({ category_name: "", category_description: "" });
    }
  }, [existing, open]);

  async function onSave() {
    if (!data.category_name) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        const updated = await updateCategory(existing._id, data);
        toast.success("Category updated");
        onSaved(updated);
      } else {
        const created = await createCategory(data);
        toast.success("Category added");
        onSaved(created);
      }
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
            {existing ? "Edit category" : "Add category"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-[#9fa0b8]">Name</Label>
            <Input
              value={data.category_name}
              onChange={(e) =>
                setData({ ...data, category_name: e.target.value })
              }
              placeholder="Health"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[#9fa0b8]">Description</Label>
            <Textarea
              rows={3}
              value={data.category_description}
              onChange={(e) =>
                setData({ ...data, category_description: e.target.value })
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

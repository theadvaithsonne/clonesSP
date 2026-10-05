"use client";

import { useEffect, useMemo, useState } from "react";
import { Country } from "country-state-city";
import { Plus, X } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import ImageUpload from "@/components/coverfi/brokerage/ImageUpload";
import {
  createInsuranceCompany,
  updateInsuranceCompany,
} from "@/lib/coverfi/insurance-api";
import type { InsuranceCompany } from "@/lib/coverfi/types";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: InsuranceCompany | null;
};

const empty = {
  name: "",
  description: "",
  website: "",
  country: "",
  product_type: [] as string[],
  logo: "",
  icon: "",
};

const COMMON_PRODUCT_TYPES = [
  "Health",
  "Life",
  "Motor",
  "Travel",
  "Home",
  "Business",
];

export default function InsuranceCompanyFormDialog({
  open,
  onClose,
  onSaved,
  existing,
}: Props) {
  const [data, setData] = useState({ ...empty });
  const [productDraft, setProductDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setData({
        name: existing.name,
        description: existing.description || "",
        website: existing.website || "",
        country: existing.country || "",
        product_type: existing.product_type || [],
        logo: existing.logo || "",
        icon: existing.icon || "",
      });
    } else {
      setData({ ...empty });
    }
    setProductDraft("");
  }, [existing, open]);

  const countries = useMemo(() => Country.getAllCountries(), []);

  function addProductType(value: string) {
    const v = value.trim();
    if (!v) return;
    if (data.product_type.includes(v)) return;
    setData((d) => ({ ...d, product_type: [...d.product_type, v] }));
    setProductDraft("");
  }

  function removeProductType(idx: number) {
    setData((d) => ({
      ...d,
      product_type: d.product_type.filter((_, i) => i !== idx),
    }));
  }

  async function onSave() {
    if (!data.name) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        await updateInsuranceCompany(existing._id, data);
        toast.success("Insurance company updated");
      } else {
        await createInsuranceCompany(data);
        toast.success("Insurance company added");
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit insurance company" : "Add insurance company"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Name" required>
            <Input
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              placeholder="HDFC Ergo"
            />
          </Field>

          <Field label="Description">
            <Textarea
              rows={3}
              value={data.description}
              onChange={(e) =>
                setData({ ...data, description: e.target.value })
              }
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Website">
              <Input
                value={data.website}
                onChange={(e) =>
                  setData({ ...data, website: e.target.value })
                }
                placeholder="example.com"
              />
            </Field>
            <Field label="Country">
              <Select
                value={data.country}
                onValueChange={(v) => setData({ ...data, country: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {countries.map((c) => (
                    <SelectItem key={c.isoCode} value={c.isoCode}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Product types">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COMMON_PRODUCT_TYPES.filter(
                (t) => !data.product_type.includes(t),
              ).map((t) => (
                <Badge
                  key={t}
                  variant="outline"
                  className="cursor-pointer hover:bg-[#15151b]"
                  onClick={() => addProductType(t)}
                >
                  + {t}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={productDraft}
                onChange={(e) => setProductDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addProductType(productDraft);
                  }
                }}
                placeholder="Type and press Enter to add custom type"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => addProductType(productDraft)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {data.product_type.map((t, i) => (
                <Badge key={i} className="gap-1">
                  {t}
                  <button
                    type="button"
                    onClick={() => removeProductType(i)}
                    className="ml-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <ImageUpload
              label="Logo"
              value={data.logo}
              onChange={(url) => setData({ ...data, logo: url })}
            />
            <ImageUpload
              label="Icon"
              value={data.icon}
              onChange={(url) => setData({ ...data, icon: url })}
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

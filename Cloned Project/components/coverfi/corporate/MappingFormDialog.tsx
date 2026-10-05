"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createMapping,
  updateMapping,
  listCorporateEmployees,
} from "@/lib/coverfi/corporate-api";
import { listProducts } from "@/lib/coverfi/products-api";
import type {
  CorporateEmployee,
  CorporateProductMapping,
  Product,
} from "@/lib/coverfi/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  corporateId: string;
  existing?: CorporateProductMapping | null;
};

const empty = {
  productId: "",
  covers_all_employees: true,
  employeeIds: [] as string[],
  dependents_covered: false,
  policy_number: "",
  policy_start_date: "",
  policy_end_date: "",
  notes: "",
};

export default function MappingFormDialog({
  open,
  onClose,
  onSaved,
  corporateId,
  existing,
}: Props) {
  const [data, setData] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<CorporateEmployee[]>([]);

  useEffect(() => {
    if (!open) return;
    listProducts()
      .then((all) => setProducts(all.filter((p) => p.is_active)))
      .catch(() => {});
    listCorporateEmployees(corporateId)
      .then(setEmployees)
      .catch(() => {});
  }, [open, corporateId]);

  useEffect(() => {
    if (existing) {
      setData({
        productId: existing.productId,
        covers_all_employees: existing.covers_all_employees,
        employeeIds: existing.employeeIds || [],
        dependents_covered: existing.dependents_covered,
        policy_number: existing.policy_number || "",
        policy_start_date: existing.policy_start_date
          ? existing.policy_start_date.slice(0, 10)
          : "",
        policy_end_date: existing.policy_end_date
          ? existing.policy_end_date.slice(0, 10)
          : "",
        notes: existing.notes || "",
      });
    } else {
      setData({ ...empty });
    }
  }, [existing, open]);

  const productById = useMemo(() => {
    const m: Record<string, Product> = {};
    products.forEach((p) => (m[p._id] = p));
    return m;
  }, [products]);

  function toggleEmployee(id: string) {
    setData((d) => ({
      ...d,
      employeeIds: d.employeeIds.includes(id)
        ? d.employeeIds.filter((x) => x !== id)
        : [...d.employeeIds, id],
    }));
  }

  async function onSave() {
    if (!data.productId) {
      toast.error("Pick a product");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        productId: data.productId,
        covers_all_employees: data.covers_all_employees,
        employeeIds: data.covers_all_employees ? [] : data.employeeIds,
        dependents_covered: data.dependents_covered,
        policy_number: data.policy_number || undefined,
        policy_start_date: data.policy_start_date || undefined,
        policy_end_date: data.policy_end_date || undefined,
        notes: data.notes || undefined,
      };
      if (existing) {
        await updateMapping(existing._id, payload);
        toast.success("Mapping updated");
      } else {
        await createMapping(corporateId, payload);
        toast.success("Product enrolled");
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
            {existing ? "Edit policy mapping" : "Enroll a product"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Product" required>
            <Select
              value={data.productId}
              onValueChange={(v) => setData({ ...data, productId: v })}
              disabled={!!existing}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    products.length === 0
                      ? "No active products yet"
                      : "Select a product"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {data.productId && productById[data.productId]?.description && (
              <p className="text-[11px] text-white/40 mt-1">
                {productById[data.productId].description}
              </p>
            )}
          </Field>

          <div className="rounded-lg border border-white/5 bg-[#0e0e12] p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={data.covers_all_employees}
                onChange={(e) =>
                  setData({
                    ...data,
                    covers_all_employees: e.target.checked,
                    employeeIds: e.target.checked ? [] : data.employeeIds,
                  })
                }
              />
              Covers all employees
            </label>

            {!data.covers_all_employees && (
              <div>
                <div className="text-xs text-white/45 mb-2">
                  Select employees to cover
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-1">
                  {employees.length === 0 ? (
                    <span className="text-xs text-white/40 italic">
                      No employees yet — add some first.
                    </span>
                  ) : (
                    employees.map((e) => {
                      const checked = data.employeeIds.includes(e._id);
                      return (
                        <button
                          key={e._id}
                          type="button"
                          onClick={() => toggleEmployee(e._id)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                            checked
                              ? "bg-brand/15 border-brand/40 text-white"
                              : "bg-[#15151b] border-white/5 text-white/70 hover:text-white",
                          )}
                        >
                          {checked && (
                            <X className="inline h-3 w-3 mr-0.5 rotate-45" />
                          )}
                          {e.first_name} {e.last_name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={data.dependents_covered}
                onChange={(e) =>
                  setData({ ...data, dependents_covered: e.target.checked })
                }
              />
              Dependents covered
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Policy number">
              <Input
                value={data.policy_number}
                onChange={(e) =>
                  setData({ ...data, policy_number: e.target.value })
                }
              />
            </Field>
            <Field label="Start date">
              <Input
                type="date"
                value={data.policy_start_date}
                onChange={(e) =>
                  setData({ ...data, policy_start_date: e.target.value })
                }
              />
            </Field>
            <Field label="End date">
              <Input
                type="date"
                value={data.policy_end_date}
                onChange={(e) =>
                  setData({ ...data, policy_end_date: e.target.value })
                }
              />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea
              rows={2}
              value={data.notes}
              onChange={(e) => setData({ ...data, notes: e.target.value })}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : existing ? "Update" : "Enroll"}
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

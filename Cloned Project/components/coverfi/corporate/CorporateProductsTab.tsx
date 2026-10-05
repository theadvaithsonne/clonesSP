"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import MappingFormDialog from "./MappingFormDialog";
import {
  listMappingsForCorporate,
  deleteMapping,
} from "@/lib/coverfi/corporate-api";
import { listProducts } from "@/lib/coverfi/products-api";
import { listInsuranceCompanies } from "@/lib/coverfi/insurance-api";
import type {
  CorporateProductMapping,
  InsuranceCompany,
  Product,
} from "@/lib/coverfi/types";
import { toast } from "sonner";

type Props = {
  corporateId: string;
  onChanged: () => Promise<void> | void;
};

export default function CorporateProductsTab({
  corporateId,
  onChanged,
}: Props) {
  const [rows, setRows] = useState<CorporateProductMapping[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [insurers, setInsurers] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CorporateProductMapping | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [maps, prods, ins] = await Promise.all([
        listMappingsForCorporate(corporateId),
        listProducts().catch(() => []),
        listInsuranceCompanies().catch(() => []),
      ]);
      setRows(maps);
      setProducts(prods);
      setInsurers(ins);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corporateId]);

  const productById = useMemo(() => {
    const m: Record<string, Product> = {};
    products.forEach((p) => (m[p._id] = p));
    return m;
  }, [products]);

  const insurerById = useMemo(() => {
    const m: Record<string, string> = {};
    insurers.forEach((i) => (m[i._id] = i.name));
    return m;
  }, [insurers]);

  async function onDelete(m: CorporateProductMapping) {
    if (!confirm("Unenroll this product?")) return;
    try {
      await deleteMapping(m._id);
      refresh();
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[12.5px] text-white/45">
          {rows.length}{" "}
          {rows.length === 1 ? "product enrolled" : "products enrolled"}
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Enroll a product
        </Button>
      </div>

      <div className="rounded-lg border border-[#222230] bg-[#0c0c12] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Insurer</TableHead>
              <TableHead>Coverage</TableHead>
              <TableHead>Policy</TableHead>
              <TableHead>Status</TableHead>
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
                  No products enrolled yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m) => {
                const p = productById[m.productId];
                return (
                  <TableRow key={m._id}>
                    <TableCell className="font-medium">
                      {p?.name || (
                        <span className="text-white/40 italic">
                          Unknown product
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-white/55">
                      {p?.insurance_provider
                        ? insurerById[p.insurance_provider] || "—"
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-white/55">
                      {m.covers_all_employees
                        ? "All employees"
                        : `${m.employeeIds.length} selected`}
                      {m.dependents_covered ? " · + dependents" : ""}
                    </TableCell>
                    <TableCell className="text-xs text-white/55">
                      {m.policy_number || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditing(m);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onDelete(m)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <MappingFormDialog
        open={dialogOpen}
        existing={editing}
        corporateId={corporateId}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          refresh();
          onChanged();
        }}
      />
    </div>
  );
}

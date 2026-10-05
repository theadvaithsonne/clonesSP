"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
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
  createCorporateStep4,
} from "@/lib/coverfi/corporate-api";
import { listProducts } from "@/lib/coverfi/products-api";
import { listInsuranceCompanies } from "@/lib/coverfi/insurance-api";
import type {
  Corporate,
  CorporateProductMapping,
  InsuranceCompany,
  Product,
} from "@/lib/coverfi/types";
import { toast } from "sonner";

type Props = {
  corporate: Corporate;
  onFinish: () => void;
  onBack: () => void;
};

export default function CorporateStep4Products({
  corporate,
  onFinish,
  onBack,
}: Props) {
  const [rows, setRows] = useState<CorporateProductMapping[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [insurers, setInsurers] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CorporateProductMapping | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [maps, prods, ins] = await Promise.all([
        listMappingsForCorporate(corporate._id),
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
  }, []);

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
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  async function onFinalize() {
    setFinalizing(true);
    try {
      await createCorporateStep4(corporate._id);
      onFinish();
    } catch (e: any) {
      toast.error(e?.message || "Finalize failed");
      setFinalizing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold mb-1">Enroll products</h2>
        <p className="text-[13px] text-white/45">
          Pick products to enroll the corporate in. Each mapping defines who
          it covers (all employees or specific ones) and the policy
          lifecycle. You can adjust later.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-[12.5px] text-white/45">
          {rows.length}{" "}
          {rows.length === 1 ? "mapping" : "mappings"}
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
              <TableHead className="w-16"></TableHead>
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
                  No mappings yet — you can finalize without enrolling and
                  add products later.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m) => {
                const p = productById[m.productId];
                return (
                  <TableRow
                    key={m._id}
                    className="cursor-pointer"
                    onClick={() => {
                      setEditing(m);
                      setDialogOpen(true);
                    }}
                  >
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
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onDelete(m)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex gap-2 pt-3 border-t border-white/5">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onFinalize} disabled={finalizing}>
          <ShieldCheck className="h-4 w-4 mr-1" />
          {finalizing ? "Finalizing…" : "Finish & publish"}
        </Button>
      </div>

      <MappingFormDialog
        open={dialogOpen}
        existing={editing}
        corporateId={corporate._id}
        onClose={() => setDialogOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
}

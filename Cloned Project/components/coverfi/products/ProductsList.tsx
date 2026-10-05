"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ImageIcon, FileText } from "lucide-react";
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
import {
  listProducts,
  deleteProduct,
  listCategories,
  createDraftProduct,
} from "@/lib/coverfi/products-api";
import { listInsuranceCompanies } from "@/lib/coverfi/insurance-api";
import type {
  InsuranceCompany,
  Product,
  ProductCategory,
} from "@/lib/coverfi/types";
import { toast } from "sonner";

export default function ProductsList() {
  const router = useRouter();
  const [rows, setRows] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [insurers, setInsurers] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [products, cats, ins] = await Promise.all([
        listProducts(),
        listCategories().catch(() => []),
        listInsuranceCompanies().catch(() => []),
      ]);
      setRows(products);
      setCategories(cats);
      setInsurers(ins);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const catById = useMemo(() => {
    const m: Record<string, string> = {};
    categories.forEach((c) => (m[c._id] = c.category_name));
    return m;
  }, [categories]);

  const insById = useMemo(() => {
    const m: Record<string, string> = {};
    insurers.forEach((i) => (m[i._id] = i.name));
    return m;
  }, [insurers]);

  async function onNew() {
    setCreating(true);
    try {
      const draft = await createDraftProduct();
      router.push(`/coverfi/products/${draft._id}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to create draft");
      setCreating(false);
    }
  }

  async function onDelete(p: Product) {
    if (!confirm(`Delete product "${p.name || "(unnamed)"}"?`)) return;
    try {
      await deleteProduct(p._id);
      toast.success("Deleted");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[#9fa0b8]">
          Insurance products your brokerage offers.
        </p>
        <Button onClick={onNew} disabled={creating}>
          <Plus className="h-4 w-4 mr-1" />
          {creating ? "Creating draft…" : "New product"}
        </Button>
      </div>

      <div className="rounded-lg border border-[#222230] bg-[#0c0c12] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Insurer</TableHead>
              <TableHead>Billing</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-[#9fa0b8]">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-[#9fa0b8]">
                  No products yet. Click &quot;New product&quot; to start.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => (
                <TableRow key={p._id}>
                  <TableCell>
                    {p.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.logo}
                        alt=""
                        className="h-8 w-8 rounded-md object-cover bg-[#15151b]"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-md bg-[#15151b] border border-[#2a2a3a] flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-[#9fa0b8]" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/coverfi/products/${p._id}`}
                      className="font-medium hover:underline"
                    >
                      {p.name || (
                        <span className="text-[#9fa0b8] italic">
                          Draft product
                        </span>
                      )}
                    </Link>
                    {p.product_document && (
                      <a
                        href={p.product_document}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 inline-flex items-center text-xs text-brand hover:underline"
                      >
                        <FileText className="h-3 w-3 mr-0.5" /> PDF
                      </a>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.category ? catById[p.category] || "—" : "—"}
                  </TableCell>
                  <TableCell>
                    {p.insurance_provider
                      ? insById[p.insurance_provider] || "—"
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-[#9fa0b8]">
                    {p.billing_type
                      ? `${p.billing_type} · ${p.payment_frequency}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {p.is_active ? (
                      <Badge className="bg-brand/12 text-brand border-brand/25">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        Draft (step {p.step_completed}/5)
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Link href={`/coverfi/products/${p._id}`}>
                        <Button size="icon" variant="ghost">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onDelete(p)}
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
  );
}

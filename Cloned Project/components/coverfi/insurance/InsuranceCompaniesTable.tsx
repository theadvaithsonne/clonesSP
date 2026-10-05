"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ImageIcon, Umbrella } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/coverfi/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import InsuranceCompanyFormDialog from "./InsuranceCompanyFormDialog";
import {
  listInsuranceCompanies,
  deleteInsuranceCompany,
} from "@/lib/coverfi/insurance-api";
import type { InsuranceCompany } from "@/lib/coverfi/types";
import { toast } from "sonner";

export default function InsuranceCompaniesTable() {
  const [rows, setRows] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InsuranceCompany | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setRows(await listInsuranceCompanies());
    } catch (e: any) {
      toast.error(e?.message || "Failed to load insurance companies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onDelete(row: InsuranceCompany) {
    if (!confirm(`Delete insurance company "${row.name}"?`)) return;
    try {
      await deleteInsuranceCompany(row._id);
      toast.success("Deleted");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Coverfi · Catalog"
        title="Insurance Companies"
        description="Insurance providers your brokerage works with."
        icon={<Umbrella className="h-4 w-4" />}
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        }
      />

      <div className="px-8 pt-6 pb-8">
      <div className="rounded-lg border border-[#222230] bg-[#0c0c12] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Product types</TableHead>
              <TableHead>Website</TableHead>
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
                  No insurance companies yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r._id}>
                  <TableCell>
                    {r.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.logo}
                        alt=""
                        className="h-8 w-8 rounded-md object-cover bg-[#15151b]"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-md bg-[#15151b] border border-[#2a2a3a] flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-[#9fa0b8]" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.country || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(r.product_type || []).slice(0, 4).map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                      {(r.product_type || []).length > 4 && (
                        <Badge variant="secondary" className="text-[10px]">
                          +{r.product_type.length - 4}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-[#9fa0b8] text-xs">
                    {r.website || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(r);
                          setOpen(true);
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

      <InsuranceCompanyFormDialog
        open={open}
        existing={editing}
        onClose={() => setOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
}

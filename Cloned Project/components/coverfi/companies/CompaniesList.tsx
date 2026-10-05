"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Building2, ImageIcon, Briefcase } from "lucide-react";
import PageHeader from "@/components/coverfi/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listCompanies, deleteCompany } from "@/lib/coverfi/companies-api";
import type { Company } from "@/lib/coverfi/types";
import { toast } from "sonner";

export default function CompaniesList() {
  const [rows, setRows] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      setRows(await listCompanies());
    } catch (e: any) {
      toast.error(e?.message || "Failed to load companies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onDelete(c: Company) {
    if (
      !confirm(`Remove customer company "${c.legal_name || "(unnamed)"}"?`)
    )
      return;
    try {
      await deleteCompany(c._id);
      toast.success("Removed");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Coverfi · Customers"
        title="Customer Companies"
        description="Businesses you sell insurance to through this brokerage."
        icon={<Briefcase className="h-4 w-4" />}
        action={
          <Link href="/coverfi/companies/new">
            <Button>
              <Plus className="h-4 w-4 mr-1" /> New company
            </Button>
          </Link>
        }
      />

      <div className="px-8 pt-6 pb-8">
      <div className="rounded-lg border border-[#222230] bg-[#0c0c12] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>POC</TableHead>
              <TableHead>Enrollments</TableHead>
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
                  No customer companies yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => (
                <TableRow key={c._id}>
                  <TableCell>
                    {c.company_logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.company_logo}
                        alt=""
                        className="h-8 w-8 rounded-md object-cover bg-[#15151b]"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-md bg-[#15151b] border border-[#2a2a3a] flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-[#9fa0b8]" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/coverfi/companies/${c._id}`}
                      className="font-medium hover:underline"
                    >
                      {c.display_name || c.legal_name || "Unnamed"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-[#9fa0b8]">
                    {c.industry || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-[#9fa0b8]">
                    {c.poc?.first_name || c.poc?.email ? (
                      <span>
                        {c.poc.first_name} {c.poc.last_name}
                        {c.poc.email && (
                          <span className="block text-xs">{c.poc.email}</span>
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-[#9fa0b8]">
                    {c.enrolled_products?.length || 0} product(s)
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDelete(c)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      </div>
    </div>
  );
}

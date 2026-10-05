"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Landmark, Copy, Check } from "lucide-react";
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
import PageHeader from "@/components/coverfi/PageHeader";
import {
  listCorporates,
  deleteCorporate,
} from "@/lib/coverfi/corporate-api";
import type { Corporate } from "@/lib/coverfi/types";
import { toast } from "sonner";

export default function CorporateList() {
  const [rows, setRows] = useState<Corporate[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      setRows(await listCorporates());
    } catch (e: any) {
      toast.error(e?.message || "Failed to load corporates");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function onDelete(c: Corporate) {
    if (!confirm(`Remove corporate "${c.legal_name}"?`)) return;
    try {
      await deleteCorporate(c._id);
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
        title="Corporate"
        description="Enterprise clients buying insurance through your brokerage. Each corporate has its own admin, employees, dependents, and enrolled products."
        icon={<Landmark className="h-4 w-4" />}
        action={
          <Link href="/coverfi/corporate/new">
            <Button>
              <Plus className="h-4 w-4 mr-1" /> New corporate
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
                <TableHead>ID</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Admin email</TableHead>
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
                    No corporates yet. Click &quot;New corporate&quot; to get
                    started.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c) => (
                  <TableRow key={c._id}>
                    <TableCell>
                      {c.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.logo}
                          alt=""
                          className="h-8 w-8 rounded-md object-cover bg-[#15151b]"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-md bg-[#15151b] border border-[#2a2a3a] flex items-center justify-center">
                          <Landmark className="h-4 w-4 text-[#9fa0b8]" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/coverfi/corporate/${c._id}`}
                        className="font-medium hover:underline"
                      >
                        {c.display_name || c.legal_name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <CodeChip code={c.corporate_code} />
                    </TableCell>
                    <TableCell className="text-sm text-[#9fa0b8]">
                      {c.industry || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-[#9fa0b8]">
                      {c.admin_email}
                    </TableCell>
                    <TableCell>
                      {c.step_completed < 4 ? (
                        <Badge variant="secondary">
                          Draft · step {c.step_completed}/4
                        </Badge>
                      ) : (
                        <Badge className="bg-brand/12 text-brand border-brand/25">
                          Active
                        </Badge>
                      )}
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

function CodeChip({ code }: { code?: string }) {
  const [copied, setCopied] = useState(false);
  if (!code) {
    return <span className="text-[#5a5b6e] text-xs">—</span>;
  }
  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code!);
      setCopied(true);
      toast.success(`${code} copied`);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Couldn't copy");
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="group inline-flex items-center gap-1.5 rounded-md border border-[#222230] bg-[#0a0a0e] px-2 py-1 text-[12px] font-mono tracking-wide hover:bg-[#15151b] hover:border-brand/30 transition-colors"
      title={`Copy ${code}`}
    >
      <span className="text-brand">{code}</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 text-[#5a5b6e] group-hover:text-[#9fa0b8]" />
      )}
    </button>
  );
}

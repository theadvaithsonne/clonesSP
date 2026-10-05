"use client";

import { useEffect, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
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
import EmployeeFormDialog from "./EmployeeFormDialog";
import {
  listCorporateEmployees,
  createCorporateStep3,
} from "@/lib/coverfi/corporate-api";
import type { Corporate, CorporateEmployee } from "@/lib/coverfi/types";
import { toast } from "sonner";

type Props = {
  corporate: Corporate;
  onSaved: (c: Corporate) => void;
  onBack: () => void;
};

export default function CorporateStep3Employees({
  corporate,
  onSaved,
  onBack,
}: Props) {
  const [rows, setRows] = useState<CorporateEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setRows(await listCorporateEmployees(corporate._id));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onContinue() {
    setAdvancing(true);
    try {
      const updated = await createCorporateStep3(corporate._id);
      onSaved(updated);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
      setAdvancing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold mb-1">Add employees</h2>
        <p className="text-[13px] text-white/45">
          Add the employees who will be covered. Each one gets a Garage account
          (guest + insurance user) and can log in via the portal once
          finalized. You can also add them later from the detail page.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-[12.5px] text-white/45">
          {rows.length} {rows.length === 1 ? "employee" : "employees"}
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add employee
        </Button>
      </div>

      <div className="rounded-lg border border-[#222230] bg-[#0c0c12] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-[#9fa0b8]">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-[#9fa0b8]">
                  No employees yet — the admin will be the only insurance user.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r._id}>
                  <TableCell className="font-medium">
                    {r.first_name} {r.last_name}
                  </TableCell>
                  <TableCell className="text-sm text-[#9fa0b8]">
                    {r.email}
                  </TableCell>
                  <TableCell>{r.designation || "—"}</TableCell>
                  <TableCell>
                    {r.is_admin ? (
                      <Badge className="bg-brand/12 text-brand border-brand/25">
                        <ShieldCheck className="h-3 w-3 mr-1" /> Admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Employee</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {r.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex gap-2 pt-3 border-t border-white/5">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue} disabled={advancing}>
          {advancing ? "Saving…" : "Continue"}
        </Button>
      </div>

      <EmployeeFormDialog
        open={dialogOpen}
        corporateId={corporate._id}
        onClose={() => setDialogOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
}

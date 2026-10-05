"use client";

import { useEffect, useState } from "react";
import { Fragment } from "react";
import {
  Plus,
  Pencil,
  UserMinus,
  ShieldCheck,
  Users,
  ChevronRight,
} from "lucide-react";
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
import DependentFormDialog from "./DependentFormDialog";
import {
  listCorporateEmployees,
  suspendCorporateEmployee,
  listDependentsForEmployee,
  deleteDependent,
} from "@/lib/coverfi/corporate-api";
import type {
  CorporateDependent,
  CorporateEmployee,
} from "@/lib/coverfi/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  corporateId: string;
  onChanged: () => Promise<void> | void;
};

export default function CorporateEmployeesTab({
  corporateId,
  onChanged,
}: Props) {
  const [rows, setRows] = useState<CorporateEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CorporateEmployee | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dependents, setDependents] = useState<
    Record<string, CorporateDependent[]>
  >({});
  const [depDialogOpen, setDepDialogOpen] = useState(false);
  const [depEditing, setDepEditing] = useState<CorporateDependent | null>(null);
  const [depEmployeeId, setDepEmployeeId] = useState<string>("");

  async function refresh() {
    setLoading(true);
    try {
      setRows(await listCorporateEmployees(corporateId));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corporateId]);

  async function toggleExpand(empId: string) {
    if (expandedId === empId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(empId);
    if (!dependents[empId]) {
      try {
        const list = await listDependentsForEmployee(empId);
        setDependents((d) => ({ ...d, [empId]: list }));
      } catch (e: any) {
        toast.error(e?.message || "Failed to load dependents");
      }
    }
  }

  async function refreshDependents(empId: string) {
    try {
      const list = await listDependentsForEmployee(empId);
      setDependents((d) => ({ ...d, [empId]: list }));
    } catch {
      /* ignore */
    }
  }

  async function onSuspend(emp: CorporateEmployee) {
    if (emp.is_admin) {
      toast.error("Cannot suspend a corporate admin");
      return;
    }
    if (!confirm(`Suspend ${emp.first_name} ${emp.last_name}?`)) return;
    try {
      await suspendCorporateEmployee(emp._id);
      toast.success("Suspended");
      refresh();
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Suspend failed");
    }
  }

  async function onRemoveDependent(dep: CorporateDependent) {
    if (!confirm("Remove this dependent?")) return;
    try {
      await deleteDependent(dep._id);
      refreshDependents(dep.employeeId);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[12.5px] text-white/45">
          {rows.length} {rows.length === 1 ? "employee" : "employees"} ·
          click a row to see dependents
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Add employee
        </Button>
      </div>

      <div className="rounded-lg border border-[#222230] bg-[#0c0c12] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Role</TableHead>
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
                  No employees.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const expanded = expandedId === r._id;
                const deps = dependents[r._id] || [];
                return (
                  <Fragment key={r._id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => toggleExpand(r._id)}
                    >
                      <TableCell>
                        <ChevronRight
                          className={cn(
                            "h-3.5 w-3.5 text-[#9fa0b8] transition-transform",
                            expanded && "rotate-90",
                          )}
                        />
                      </TableCell>
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
                        <Badge
                          variant="secondary"
                          className="capitalize"
                        >
                          {r.status}
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
                              setEditing(r);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {!r.is_admin && r.status !== "suspended" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Suspend"
                              onClick={() => onSuspend(r)}
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-[#08080b] p-0">
                          <div className="px-6 py-4 border-t border-white/5">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-brand/80">
                                <Users className="h-3.5 w-3.5" />
                                Dependents
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setDepEditing(null);
                                  setDepEmployeeId(r._id);
                                  setDepDialogOpen(true);
                                }}
                              >
                                <Plus className="h-3.5 w-3.5 mr-1" /> Add
                              </Button>
                            </div>
                            {deps.length === 0 ? (
                              <p className="text-xs text-white/40 italic">
                                No dependents yet.
                              </p>
                            ) : (
                              <ul className="space-y-1.5">
                                {deps.map((d) => (
                                  <li
                                    key={d._id}
                                    className="flex items-center justify-between bg-[#0e0e12] border border-white/5 rounded-md px-3 py-2 text-sm"
                                  >
                                    <div>
                                      <span className="font-medium">
                                        {d.first_name} {d.last_name}
                                      </span>
                                      <span className="text-white/40 text-xs ml-2 capitalize">
                                        {d.relation}
                                      </span>
                                      {d.date_of_birth && (
                                        <span className="text-white/40 text-xs ml-2">
                                          DOB{" "}
                                          {new Date(
                                            d.date_of_birth,
                                          ).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex gap-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => {
                                          setDepEditing(d);
                                          setDepEmployeeId(r._id);
                                          setDepDialogOpen(true);
                                        }}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => onRemoveDependent(d)}
                                      >
                                        <UserMinus className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <EmployeeFormDialog
        open={dialogOpen}
        existing={editing}
        corporateId={corporateId}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          refresh();
          onChanged();
        }}
      />

      <DependentFormDialog
        open={depDialogOpen}
        existing={depEditing}
        employeeId={depEmployeeId}
        onClose={() => setDepDialogOpen(false)}
        onSaved={() => {
          refreshDependents(depEmployeeId);
          onChanged();
        }}
      />
    </div>
  );
}

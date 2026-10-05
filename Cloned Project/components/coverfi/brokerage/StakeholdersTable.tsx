"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listStakeholders,
  updateStakeholderAssignment,
  listLocations,
} from "@/lib/coverfi/brokerage-api";
import { listRoles } from "@/lib/coverfi/roles-api";
import type {
  BrokerageLocation,
  CoverfiRole,
  Stakeholder,
} from "@/lib/coverfi/types";
import { toast } from "sonner";

const UNASSIGNED = "__unassigned";

export default function StakeholdersTable() {
  const [rows, setRows] = useState<Stakeholder[]>([]);
  const [roles, setRoles] = useState<CoverfiRole[]>([]);
  const [locations, setLocations] = useState<BrokerageLocation[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const [people, r, l] = await Promise.all([
        listStakeholders(),
        listRoles().catch(() => []),
        listLocations().catch(() => []),
      ]);
      setRows(people);
      setRoles(r);
      setLocations(l);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load stakeholders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function assignRole(userId: string, value: string) {
    const role_id = value === UNASSIGNED ? null : value;
    try {
      await updateStakeholderAssignment(userId, { role_id });
      setRows((rs) =>
        rs.map((r) =>
          r._id === userId
            ? {
                ...r,
                assignment: {
                  ...(r.assignment || {}),
                  role_id: role_id ?? undefined,
                },
              }
            : r,
        ),
      );
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    }
  }

  async function assignBranch(userId: string, value: string) {
    const branch_id = value === UNASSIGNED ? null : value;
    try {
      await updateStakeholderAssignment(userId, { branch_id });
      setRows((rs) =>
        rs.map((r) =>
          r._id === userId
            ? {
                ...r,
                assignment: {
                  ...(r.assignment || {}),
                  branch_id: branch_id ?? undefined,
                },
              }
            : r,
        ),
      );
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    }
  }

  return (
    <div className="p-8">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Stakeholders</h2>
        <p className="text-sm text-[#9fa0b8]">
          Your brokerage&apos;s team — invited through Garage. Assign a
          Coverfi role label and a branch to each.
        </p>
      </div>

      <div className="rounded-md bg-[#15151b] border border-[#2a2a3a] px-3 py-2 mb-4 text-xs text-[#9fa0b8] flex items-start gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Stakeholders are added via Garage&apos;s invite flow, not here.
          Manage Coverfi roles{" "}
          <Link
            href="/coverfi/roles"
            className="text-brand hover:underline"
          >
            in the Roles tab
          </Link>
          .
        </span>
      </div>

      <div className="rounded-lg border border-[#222230] bg-[#0c0c12] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Coverfi role</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Access</TableHead>
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
                  No stakeholders yet. Invite them via Garage&apos;s team
                  settings.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const initial = (r.name || r.email || "?")
                  .charAt(0)
                  .toUpperCase();
                return (
                  <TableRow key={r._id}>
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        {r.profilePicture && (
                          <AvatarImage src={r.profilePicture} />
                        )}
                        <AvatarFallback>{initial}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">
                      {r.name || (
                        <span className="text-[#9fa0b8] italic">No name</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-[#9fa0b8]">
                      {r.email}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.assignment?.role_id || UNASSIGNED}
                        onValueChange={(v) => assignRole(r._id, v)}
                      >
                        <SelectTrigger className="h-8 w-44">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>
                            <span className="text-[#9fa0b8]">Unassigned</span>
                          </SelectItem>
                          {roles.map((role) => (
                            <SelectItem key={role._id} value={role._id}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.assignment?.branch_id || UNASSIGNED}
                        onValueChange={(v) => assignBranch(r._id, v)}
                      >
                        <SelectTrigger className="h-8 w-44">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>
                            <span className="text-[#9fa0b8]">Unassigned</span>
                          </SelectItem>
                          {locations.map((l) => (
                            <SelectItem key={l._id} value={l._id}>
                              {l.location_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {r.fullAccess ? (
                        <Badge className="bg-brand-2/12 text-brand-2 border-brand-2/25">
                          Full access
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Stakeholder</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

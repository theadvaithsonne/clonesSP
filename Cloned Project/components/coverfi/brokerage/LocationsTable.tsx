"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import LocationFormDialog from "./LocationFormDialog";
import {
  listLocations,
  deleteLocation,
} from "@/lib/coverfi/brokerage-api";
import type { BrokerageLocation } from "@/lib/coverfi/types";
import { toast } from "sonner";

export default function LocationsTable() {
  const [rows, setRows] = useState<BrokerageLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BrokerageLocation | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setRows(await listLocations());
    } catch (e: any) {
      toast.error(e?.message || "Failed to load locations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onDelete(loc: BrokerageLocation) {
    if (!confirm(`Delete location "${loc.location_name}"?`)) return;
    try {
      await deleteLocation(loc._id);
      toast.success("Location deleted");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Office locations</h2>
          <p className="text-sm text-[#9fa0b8]">
            Physical branches that show up on your landing page.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Add location
        </Button>
      </div>

      <div className="rounded-lg border border-[#222230] bg-[#0c0c12] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Pincode</TableHead>
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
                  No locations yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r._id}>
                  <TableCell className="font-medium">
                    {r.location_name}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {r.address}
                  </TableCell>
                  <TableCell>{r.country}</TableCell>
                  <TableCell>{r.state}</TableCell>
                  <TableCell>{r.pincode}</TableCell>
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

      <LocationFormDialog
        open={open}
        existing={editing}
        onClose={() => setOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
}

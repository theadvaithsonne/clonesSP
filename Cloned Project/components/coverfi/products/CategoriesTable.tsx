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
import CategoryFormDialog from "./CategoryFormDialog";
import {
  listCategories,
  deleteCategory,
} from "@/lib/coverfi/products-api";
import type { ProductCategory } from "@/lib/coverfi/types";
import { toast } from "sonner";

export default function CategoriesTable() {
  const [rows, setRows] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductCategory | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setRows(await listCategories());
    } catch (e: any) {
      toast.error(e?.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onDelete(row: ProductCategory) {
    if (!confirm(`Delete category "${row.category_name}"?`)) return;
    try {
      await deleteCategory(row._id);
      toast.success("Deleted");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Product categories</h2>
          <p className="text-sm text-[#9fa0b8]">
            Group products under categories (e.g. Health, Life, Motor).
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Add category
        </Button>
      </div>

      <div className="rounded-lg border border-[#222230] bg-[#0c0c12] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-[#9fa0b8]">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-[#9fa0b8]">
                  No categories yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r._id}>
                  <TableCell className="font-medium">
                    {r.category_name}
                  </TableCell>
                  <TableCell className="text-[#9fa0b8] text-sm">
                    {r.category_description || "—"}
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

      <CategoryFormDialog
        open={open}
        existing={editing}
        onClose={() => setOpen(false)}
        onSaved={() => refresh()}
      />
    </div>
  );
}

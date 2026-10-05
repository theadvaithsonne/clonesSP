"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  listFilterTypes,
  listFilterItemsForType,
  createFilterType,
  updateFilterType,
  deleteFilterType,
  createFilterItem,
  deleteFilterItem,
} from "@/lib/coverfi/products-api";
import type { FilterItem, FilterType } from "@/lib/coverfi/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function FilterTypesPanel() {
  const [types, setTypes] = useState<FilterType[]>([]);
  const [items, setItems] = useState<FilterItem[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<FilterType | null>(null);

  const [itemDraft, setItemDraft] = useState("");

  async function refreshTypes() {
    const list = await listFilterTypes();
    setTypes(list);
    if (list.length > 0 && !selectedTypeId) {
      setSelectedTypeId(list[0]._id);
    } else if (list.length === 0) {
      setSelectedTypeId(null);
      setItems([]);
    }
  }

  async function refreshItems(typeId: string) {
    const list = await listFilterItemsForType(typeId);
    setItems(list);
  }

  useEffect(() => {
    setLoading(true);
    refreshTypes()
      .catch((e) => toast.error(e?.message || "Failed to load filters"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedTypeId) refreshItems(selectedTypeId).catch(console.error);
    else setItems([]);
  }, [selectedTypeId]);

  async function onDeleteType(t: FilterType) {
    if (
      !confirm(
        `Delete filter type "${t.filter_type_name}"? Its items will also be deleted.`,
      )
    )
      return;
    try {
      await deleteFilterType(t._id);
      toast.success("Filter type deleted");
      if (selectedTypeId === t._id) setSelectedTypeId(null);
      refreshTypes();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  async function onAddItem() {
    if (!selectedTypeId) return;
    const v = itemDraft.trim();
    if (!v) return;
    try {
      await createFilterItem({
        filter_type_id: selectedTypeId,
        filter_item_name: v,
      });
      setItemDraft("");
      refreshItems(selectedTypeId);
    } catch (e: any) {
      toast.error(e?.message || "Add failed");
    }
  }

  async function onRemoveItem(it: FilterItem) {
    try {
      await deleteFilterItem(it._id);
      if (selectedTypeId) refreshItems(selectedTypeId);
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Filters</h2>
          <p className="text-sm text-[#9fa0b8]">
            Filter types (e.g. &quot;Age Group&quot;) and their items (e.g.
            &quot;18-25&quot;, &quot;26-40&quot;).
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingType(null);
            setTypeDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Add filter type
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* types list */}
        <div className="col-span-4 rounded-lg border border-[#222230] bg-[#0c0c12] overflow-hidden">
          <div className="px-3 py-2 text-xs uppercase tracking-wider text-brand border-b border-[#222230]">
            Filter types
          </div>
          <div className="divide-y divide-[#222230]">
            {loading ? (
              <div className="px-3 py-3 text-sm text-[#9fa0b8]">Loading…</div>
            ) : types.length === 0 ? (
              <div className="px-3 py-3 text-sm text-[#9fa0b8]">
                No filter types yet.
              </div>
            ) : (
              types.map((t) => (
                <div
                  key={t._id}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm cursor-pointer",
                    selectedTypeId === t._id
                      ? "bg-[#15151b] text-white"
                      : "text-[#c7c7da] hover:bg-[#15151b]",
                  )}
                  onClick={() => setSelectedTypeId(t._id)}
                >
                  <div className="flex-1 truncate">
                    <div className="font-medium">{t.filter_type_name}</div>
                    {t.filter_type_description && (
                      <div className="text-xs text-[#9fa0b8] truncate">
                        {t.filter_type_description}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingType(t);
                        setTypeDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteType(t);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* items panel */}
        <div className="col-span-8 rounded-lg border border-[#222230] bg-[#0c0c12]">
          <div className="px-3 py-2 text-xs uppercase tracking-wider text-brand border-b border-[#222230]">
            Items
          </div>
          <div className="p-4 space-y-3">
            {!selectedTypeId ? (
              <div className="text-sm text-[#9fa0b8]">
                Select a filter type on the left to manage its items.
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    value={itemDraft}
                    onChange={(e) => setItemDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onAddItem();
                      }
                    }}
                    placeholder="New item, press Enter"
                  />
                  <Button variant="outline" onClick={onAddItem}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <ul className="space-y-1">
                  {items.length === 0 && (
                    <li className="text-xs text-[#9fa0b8] italic">
                      No items in this filter type yet.
                    </li>
                  )}
                  {items.map((it) => (
                    <li
                      key={it._id}
                      className="flex items-center justify-between bg-[#15151b] border border-[#2a2a3a] rounded-md px-3 py-1.5 text-sm"
                    >
                      <span>{it.filter_item_name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onRemoveItem(it)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>

      <FilterTypeDialog
        open={typeDialogOpen}
        existing={editingType}
        onClose={() => setTypeDialogOpen(false)}
        onSaved={() => refreshTypes()}
      />
    </div>
  );
}

function FilterTypeDialog({
  open,
  onClose,
  onSaved,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing: FilterType | null;
}) {
  const [data, setData] = useState({
    filter_type_name: "",
    filter_type_description: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setData({
        filter_type_name: existing.filter_type_name,
        filter_type_description: existing.filter_type_description || "",
      });
    } else {
      setData({ filter_type_name: "", filter_type_description: "" });
    }
  }, [existing, open]);

  async function onSave() {
    if (!data.filter_type_name) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        await updateFilterType(existing._id, data);
        toast.success("Filter type updated");
      } else {
        await createFilterType(data);
        toast.success("Filter type added");
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit filter type" : "Add filter type"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-[#9fa0b8]">Name</Label>
            <Input
              value={data.filter_type_name}
              onChange={(e) =>
                setData({ ...data, filter_type_name: e.target.value })
              }
              placeholder="Age Group"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[#9fa0b8]">Description</Label>
            <Textarea
              rows={3}
              value={data.filter_type_description}
              onChange={(e) =>
                setData({
                  ...data,
                  filter_type_description: e.target.value,
                })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : existing ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

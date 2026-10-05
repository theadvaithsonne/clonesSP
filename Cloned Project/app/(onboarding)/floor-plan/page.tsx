"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus,
  Minus,
  Building2,
  GripVertical,
  Tag,
  Save,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useRouter } from "next/navigation";

type Dept = { name: string; color?: string };
type FloorVM = { level: number; name: string; departments: Dept[] };

export default function FloorPlanPage() {
  const router = useRouter();
  const [floors, setFloors] = useState<FloorVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load existing floors (if any)
  useEffect(() => {
    (async () => {
      try {
        const res = await api<{ floors: FloorVM[] }>(
          "/floors",
          {},
          getToken()!
        );
        if (res.floors?.length) setFloors(res.floors);
        else setFloors(defaultFloors(2));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const addFloor = () =>
    setFloors((prev) => {
      const nextLevel = (prev[prev.length - 1]?.level || 0) + 1;
      return [
        ...prev,
        { level: nextLevel, name: `Floor ${nextLevel}`, departments: [] },
      ];
    });

  const removeFloor = (level: number) =>
    setFloors((prev) =>
      prev
        .filter((f) => f.level !== level)
        .map((f, i) => ({ ...f, level: i + 1 }))
    );

  const moveUp = (idx: number) =>
    setFloors((prev) => {
      if (idx <= 0) return prev;
      const copy = [...prev];
      [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
      return copy.map((f, i) => ({ ...f, level: i + 1 }));
    });

  const moveDown = (idx: number) =>
    setFloors((prev) => {
      if (idx >= prev.length - 1) return prev;
      const copy = [...prev];
      [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
      return copy.map((f, i) => ({ ...f, level: i + 1 }));
    });

  const setFloorName = (idx: number, val: string) =>
    setFloors((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, name: val } : f))
    );

  // ✅ immutable add
  const addDept = (idx: number, name: string) =>
    setFloors((prev) => {
      if (!name.trim()) return prev;
      return prev.map((f, i) =>
        i === idx
          ? { ...f, departments: [...f.departments, { name: name.trim() }] }
          : f
      );
    });

  // ✅ immutable remove
  const removeDept = (fIdx: number, dIdx: number) =>
    setFloors((prev) =>
      prev.map((f, i) =>
        i === fIdx
          ? {
              ...f,
              departments: f.departments.filter((_, j) => j !== dIdx),
            }
          : f
      )
    );

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        floors: floors.map((f, i) => ({
          level: i + 1,
          name: f.name.trim() || `Floor ${i + 1}`,
          departments: f.departments.map((d) => ({
            name: d.name.trim(),
            color: d.color || "",
          })),
        })),
      };
      await api(
        "/floors/setup",
        { method: "POST", body: JSON.stringify(payload) },
        getToken()!
      );

      toast.success("Floor plan saved!");

      router.push("/office-payment");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-40 bg-[#15151b] rounded mb-4" />
        <div className="grid gap-4 lg:grid-cols-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-40 border border-[#2a2a35] bg-[#0e0e12] rounded-xl"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 min-h-screen bg-[#0b0b0d]">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] bg-[#1a1a22] border border-[#2a2a35] text-[#e6e6e6]">
            <Building2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-brand-2" />
            Floor Plan
          </div>
          <h1 className="text-xl sm:text-2xl mt-2 font-semibold text-white">
            Design your workspace
          </h1>
          <p className="text-xs sm:text-sm text-[#a5a6bf]">
            Add floors and assign department names to each.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={addFloor}
            className="bg-brand-2 hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] text-brand-foreground border border-brand-2/30 text-xs sm:text-sm h-8 sm:h-10"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
            Add floor
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-[#111111] hover:bg-[#1a1a1a] text-brand-2 border border-[#3a3a3a] text-xs sm:text-sm h-8 sm:h-10"
          >
            <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
            {saving ? "Saving…" : "Save plan"}
          </Button>
        </div>
      </div>

      {/* Left "shaft" + stacked floors */}
      <div className="relative max-w-4xl mx-auto">
        <div className="absolute -left-2 sm:-left-3 top-0 bottom-0 w-[4px] sm:w-[6px] bg-[#2a2a2a] rounded-full hidden sm:block" />
        <div className="grid gap-4">
          <AnimatePresence initial={false}>
            {floors.map((f, idx) => (
              <motion.div
                key={f.level}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
              >
                <Card
                  className={cn(
                    "relative py-0 border border-[#2a2a35] bg-[#0e0e12]/95 rounded-xl overflow-hidden",
                    "shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
                  )}
                >
                  {/* “floor slab” accent */}
                  <div className="absolute -left-3 top-5 h-[14px] w-[14px] rounded-full bg-brand-2 shadow-[0_0_0_3px_#0b0b0d]"></div>

                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a35] bg-[#0e0e12]/90 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-[#a3a3a3]" />
                      <span className="text-sm text-[#cfcfcf]">
                        Level {idx + 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-[#e6e6e6] hover:text-white hover:bg-[#15151b]"
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0}
                        title="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-[#e6e6e6] hover:text-white hover:bg-[#15151b]"
                        onClick={() => moveDown(idx)}
                        disabled={idx === floors.length - 1}
                        title="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-[#e99292] hover:text-white hover:bg-[#2a1515]"
                        onClick={() => removeFloor(f.level)}
                        title="Remove floor"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-4 pb-4 space-y-4">
                    {/* Name */}
                    <div>
                      <label className="text-[12px] text-[#9fa0b8] mb-1 block">
                        Floor name
                      </label>
                      <Input
                        value={f.name}
                        onChange={(e) => setFloorName(idx, e.target.value)}
                        className="bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/70"
                        placeholder={`Floor ${idx + 1}`}
                      />
                    </div>

                    {/* Departments */}
                    <div>
                      <label className="text-[12px] text-[#9fa0b8] mb-2 block">
                        Departments
                      </label>
                      <DeptEditor
                        value={f.departments}
                        onAdd={(name) => addDept(idx, name)}
                        onRemove={(dIdx) => removeDept(idx, dIdx)}
                      />
                      {/* {!!f.departments.length && (
                        <div className="mt-2 grid grid-cols-12 gap-2">
                          {f.departments.map((d, i) => (
                            <div
                              key={`${d.name}-${i}`}
                              className="col-span-12 sm:col-span-6 lg:col-span-4 rounded-md border border-[#3a3a3a] bg-[#141414] p-3"
                            >
                              <div className="text-sm text-white">{d.name}</div>
                              <div className="mt-1 text-[11px] text-[#a5a6bf]">
                                Zone {i + 1}
                              </div>
                            </div>
                          ))}
                        </div>
                      )} */}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function defaultFloors(n: number): FloorVM[] {
  return Array.from({ length: n }).map((_, i) => ({
    level: i + 1,
    name: `Floor ${i + 1}`,
    departments: i === 0 ? [{ name: "Operations" }, { name: "HR" }] : [],
  }));
}

function DeptEditor({
  value,
  onAdd,
  onRemove,
}: {
  value: { name: string; color?: string }[];
  onAdd: (name: string) => void;
  onRemove: (idx: number) => void;
}) {
  const [input, setInput] = useState("");
  // Prevent double-add on Enter in some environments
  const enterLock = useRef(false);
  const unlock = () => setTimeout(() => (enterLock.current = false), 180);

  const addOnce = () => {
    const v = input.trim();
    if (!v || enterLock.current) return;
    enterLock.current = true;
    onAdd(v);
    setInput("");
    unlock();
  };

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (
                (e.key === "Enter" || e.key === "NumpadEnter") &&
                !e.shiftKey &&
                !(e as any).nativeEvent?.isComposing &&
                !e.repeat
              ) {
                e.preventDefault();
                addOnce();
              }
            }}
            placeholder="Add department (press Enter)"
            className="pl-9 bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/70"
          />
        </div>
        <Button
          type="button"
          onClick={addOnce}
          className="bg-brand-2 hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] text-brand-foreground border border-brand-2/30"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add
        </Button>
      </div>

      {value.length ? (
        <div className="flex flex-wrap gap-2">
          {value.map((d, i) => (
            <span
              key={`${d.name}-${i}`}
              className="inline-flex items-center gap-2 px-2.5 h-8 rounded-md border border-[#4f4f4f] bg-[#121212] text-[13px] text-white"
            >
              {d.name}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-[#d6d6d6]/80 hover:text-white"
                aria-label="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div className="text-[12px] text-[#9fa0b8]">No departments yet.</div>
      )}
    </div>
  );
}

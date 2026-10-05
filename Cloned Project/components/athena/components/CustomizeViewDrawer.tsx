"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronRight,
  Hash,
  List,
  Loader2,
  Pencil,
  Settings,
  SmilePlus,
  Sparkles,
  Tag,
  Type,
  Wand2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace"

const TASKROOM_BASE = (
  process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/"
).replace(/\/+$/, "") + "/"

const DRAWER_Z = 10060

const OPTION_COLORS = ["#7c5cff", "#e24b4a", "#22c55e", "#3b82f6", "#f59e0b", "#ec4899"]

export type CustomFieldType =
  | "dropdown"
  | "text"
  | "date"
  | "textarea"
  | "number"
  | "labels"

type DrawerScreen = "main" | "fields" | "create"

type FieldTypeDef = {
  id: CustomFieldType
  label: string
  section: "popular" | "all"
  icon: React.ReactNode
  iconClass: string
  hasOptions?: boolean
}

const FIELD_TYPES: FieldTypeDef[] = [
  { id: "dropdown", label: "Dropdown", section: "popular", icon: <List className="h-4 w-4" />, iconClass: "text-emerald-400", hasOptions: true },
  { id: "text", label: "Text", section: "popular", icon: <Type className="h-4 w-4" />, iconClass: "text-sky-400" },
  { id: "date", label: "Date", section: "popular", icon: <Calendar className="h-4 w-4" />, iconClass: "text-emerald-400" },
  { id: "textarea", label: "Text area (Long Text)", section: "popular", icon: <Type className="h-4 w-4 rotate-90" />, iconClass: "text-sky-400" },
  { id: "number", label: "Number", section: "popular", icon: <Hash className="h-4 w-4" />, iconClass: "text-emerald-400" },
  { id: "labels", label: "Labels (Multi-select)", section: "popular", icon: <Tag className="h-4 w-4" />, iconClass: "text-emerald-400", hasOptions: true },
]

async function addRoomCustomField(
  roomId: string,
  body: {
    fieldName: string
    fieldType: string
    fieldOptions?: string[]
    currencySymbol?: string
  }
) {
  const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null
  const res = await fetch(`${TASKROOM_BASE}rooms/${roomId}/add/custom/field`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      fieldName: body.fieldName,
      fieldType: body.fieldType,
      fieldOptions: body.fieldOptions ?? [],
      currencySymbol: body.currencySymbol ?? "",
    }),
  })
  if (!res.ok) {
    let msg = "Failed to add custom field"
    try {
      const data = await res.json()
      msg = data?.message || data?.error || msg
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  return res.json()
}

function DrawerShell({
  open,
  onClose,
  headerRef,
  width = 400,
  children,
}: {
  open: boolean
  onClose: () => void
  headerRef: React.RefObject<HTMLElement | null>
  width?: number
  children: React.ReactNode
}) {
  const [top, setTop] = useState(0)

  useEffect(() => {
    if (!open) return
    const update = () => {
      const el = headerRef.current
      if (el) setTop(el.getBoundingClientRect().bottom)
    }
    update()
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
    }
  }, [open, headerRef])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/45" style={{ zIndex: DRAWER_Z - 1 }} onClick={onClose} />
      <div
        className="fixed right-0 bottom-0 flex flex-col bg-[#0a0a0d] shadow-2xl border-l border-white/[0.06]"
        style={{ top, width: "min(100vw, " + width + "px)", zIndex: DRAWER_Z }}
        onWheel={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body
  )
}

function DrawerHeader({
  title,
  onBack,
  onClose,
  trailing,
}: {
  title: React.ReactNode
  onBack?: () => void
  onClose: () => void
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-4 py-3">
      {onBack ? (
        <button type="button" onClick={onBack} className="rounded-md p-1 text-white/60 hover:bg-white/5 hover:text-white" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
      ) : null}
      <div className="min-w-0 flex-1 text-[15px] font-semibold text-white">{title}</div>
      {trailing}
      <button
        type="button"
        onClick={onClose}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function ToggleRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-[13px] text-white/80">{label}</span>
      <div className="h-5 w-9 rounded-full bg-white/15" />
    </div>
  )
}

function MenuRow({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.04] transition-colors"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-white/60">{icon}</span>
      <span className="flex-1 text-[13px] text-white/90">{label}</span>
      {value ? <span className="text-[12px] text-white/40">{value}</span> : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
    </button>
  )
}

function CreateFieldForm({
  fieldType: initialFieldType,
  onBack,
  onClose,
  onCreated,
  roomId,
}: {
  fieldType: FieldTypeDef
  onBack: () => void
  onClose: () => void
  onCreated: () => void
  roomId: string
}) {
  const [fieldType, setFieldType] = useState(initialFieldType)
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)

  useEffect(() => {
    setFieldType(initialFieldType)
  }, [initialFieldType])
  const [fieldName, setFieldName] = useState("")
  const [options, setOptions] = useState<{ id: string; label: string; color: string }[]>([
    { id: "1", label: "Option 1", color: OPTION_COLORS[0] },
    { id: "2", label: "Option 2", color: OPTION_COLORS[1] },
  ])
  const [newOption, setNewOption] = useState("")
  const [currencySymbol, setCurrencySymbol] = useState("")
  const [fillMethod, setFillMethod] = useState<"manual" | "ai">("manual")
  const [submitting, setSubmitting] = useState(false)
  const syncRoom = useTaskroomWorkspacetore((s) => s.syncRoom)
  const refreshCurrentRoomDetail = useTaskroomWorkspacetore((s) => s.refreshCurrentRoomDetail)

  const canSubmit = fieldName.trim().length > 0 && (!fieldType.hasOptions || options.some((o) => o.label.trim()))

  const addOption = () => {
    const label = newOption.trim()
    if (!label) return
    setOptions((prev) => [
      ...prev,
      { id: String(Date.now()), label, color: OPTION_COLORS[prev.length % OPTION_COLORS.length] },
    ])
    setNewOption("")
  }

  const handleCreate = async () => {
    if (!canSubmit || submitting || !roomId) return
    setSubmitting(true)
    try {
      const result = await addRoomCustomField(roomId, {
        fieldName: fieldName.trim(),
        fieldType: fieldType.id,
        fieldOptions: fieldType.hasOptions ? options.map((o) => o.label.trim()).filter(Boolean) : [],
        currencySymbol: fieldType.id === "number" ? currencySymbol : undefined,
      })
      const updatedRoom = result?.data?.data ?? result?.data ?? result
      if (updatedRoom && typeof updatedRoom === "object") {
        syncRoom(roomId, updatedRoom)
      }
      await refreshCurrentRoomDetail(roomId)
      toast.success("Custom field created")
      onCreated()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create field")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <DrawerHeader
        title={
          <div className="relative">
            <button
              type="button"
              onClick={() => setTypeMenuOpen((v) => !v)}
              className="flex items-center gap-1 text-[15px] font-semibold text-white"
            >
              {fieldType.label}
              <ChevronDown className={cn("h-4 w-4 text-white/40 transition-transform", typeMenuOpen && "rotate-180")} />
            </button>
            {typeMenuOpen && (
              <div className="absolute left-0 top-full z-10 mt-1 max-h-56 w-56 overflow-y-auto rounded-lg border border-white/10 bg-[#141516] py-1 shadow-xl">
                {FIELD_TYPES.map((ft) => (
                  <button
                    key={ft.id}
                    type="button"
                    onClick={() => {
                      setFieldType(ft)
                      setTypeMenuOpen(false)
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-white/5",
                      ft.id === fieldType.id ? "text-white" : "text-white/70"
                    )}
                  >
                    <span className={cn("flex h-6 w-6 items-center justify-center rounded bg-white/[0.06]", ft.iconClass)}>
                      {ft.icon}
                    </span>
                    {ft.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
        onBack={onBack}
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <label className="mb-1.5 block text-[12px] text-white/70">
          Field name <span className="text-red-400">*</span>
        </label>
        <div className="relative mb-5">
          <SmilePlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            placeholder="Enter name..."
            className="w-full rounded-lg border border-white/20 bg-transparent py-2.5 pl-10 pr-3 text-[13px] text-white placeholder:text-white/35 outline-none focus:border-white/40"
          />
        </div>

        {fieldType.hasOptions && (
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[12px] text-white/70">
                {fieldType.id === "labels" ? "Labels options" : "Dropdown options"}{" "}
                <span className="text-red-400">*</span>
              </label>
              <span className="text-[11px] text-white/40">Manual</span>
            </div>
            <div className="space-y-2 mb-3">
              {options.map((opt) => (
                <div key={opt.id} className="flex items-center gap-2 text-[13px] text-white/85">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ background: opt.color }} />
                  {opt.label}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40">+</span>
                <input
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addOption()}
                  placeholder="Add option"
                  className="w-full rounded-lg border border-white/15 bg-white/[0.03] py-2 pl-8 pr-3 text-[13px] text-white placeholder:text-white/35 outline-none"
                />
              </div>
              <button type="button" onClick={addOption} className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white">
                <Wand2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {fieldType.id === "number" && (
          <div className="mb-5">
            <label className="mb-1.5 block text-[12px] text-white/70">Currency symbol (optional)</label>
            <input
              value={currencySymbol}
              onChange={(e) => setCurrencySymbol(e.target.value)}
              placeholder="e.g. $"
              className="w-full rounded-lg border border-white/15 bg-white/[0.03] py-2.5 px-3 text-[13px] text-white placeholder:text-white/35 outline-none"
            />
          </div>
        )}

        {(fieldType.id === "text" || fieldType.id === "textarea") && (
          <div className="mb-5">
            <label className="mb-2 block text-[12px] text-white/70">Fill method</label>
            <div className="flex rounded-lg border border-white/10 p-0.5">
              <button
                type="button"
                onClick={() => setFillMethod("manual")}
                className={cn(
                  "flex-1 rounded-md py-2 text-[12px] font-medium transition-colors",
                  fillMethod === "manual" ? "bg-white/10 text-white" : "text-white/45"
                )}
              >
                Manual fill
              </button>
              <button
                type="button"
                onClick={() => setFillMethod("ai")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[12px] font-medium transition-colors",
                  fillMethod === "ai" ? "bg-white/10 text-white" : "text-white/45"
                )}
              >
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                Fill with AI
              </button>
            </div>
          </div>
        )}

        <button type="button" className="flex w-full items-center justify-between border-t border-white/[0.06] py-3 text-[13px] text-white/70">
          More settings and permissions
          <ChevronRight className="h-4 w-4 text-white/30" />
        </button>
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-white/[0.06] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-white/20 px-4 py-2 text-[13px] text-white/80 hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={() => void handleCreate()}
          className={cn(
            "rounded-lg px-4 py-2 text-[13px] font-medium",
            canSubmit && !submitting ? "bg-white text-black hover:bg-white/90" : "bg-white/20 text-white/40 cursor-not-allowed"
          )}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
        </button>
      </div>
    </>
  )
}

export function CustomizeViewDrawer({
  open,
  onClose,
  roomId,
  headerRef,
}: {
  open: boolean
  onClose: () => void
  roomId: string
  headerRef: React.RefObject<HTMLElement | null>
}) {
  const [screen, setScreen] = useState<DrawerScreen>("main")
  const [selectedType, setSelectedType] = useState<FieldTypeDef | null>(null)
  const [fieldsTab, setFieldsTab] = useState<"create" | "existing">("create")
  const [fieldSearch, setFieldSearch] = useState("")

  const reset = useCallback(() => {
    setScreen("main")
    setSelectedType(null)
    setFieldsTab("create")
    setFieldSearch("")
  }, [])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const filteredFieldTypes = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase()
    if (!q) return FIELD_TYPES
    return FIELD_TYPES.filter((f) => f.label.toLowerCase().includes(q))
  }, [fieldSearch])

  const popularTypes = filteredFieldTypes.filter((f) => f.section === "popular")

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <DrawerShell open={open} onClose={handleClose} headerRef={headerRef} width={400}>
      {screen === "main" && (
        <>
          <DrawerHeader title="Customize view" onClose={handleClose} />
          <div className="flex-1 overflow-y-auto">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2">
                <List className="h-4 w-4 text-white/40" />
                <input
                  readOnly
                  value="List"
                  className="flex-1 bg-transparent text-[13px] text-white/80 outline-none"
                />
              </div>
            </div>

            <div className="border-b border-white/[0.06] py-1">
              <ToggleRow label="Show empty statuses" />
              <ToggleRow label="Wrap text" />
              <ToggleRow label="Show task locations" />
              <ToggleRow label="Show subtask parent names" />
              <ToggleRow label="Show closed tasks" />
              <button type="button" className="flex w-full items-center justify-between px-4 py-2.5 text-[13px] text-white/80 hover:bg-white/[0.04]">
                More options
                <ChevronRight className="h-4 w-4 text-white/30" />
              </button>
            </div>

            <div className="border-b border-white/[0.06] py-1">
              <MenuRow icon={<Pencil className="h-4 w-4" />} label="Fields" value="7 shown" onClick={() => setScreen("fields")} />
              <MenuRow icon={<List className="h-4 w-4" />} label="Filter" value="None" />
              <MenuRow icon={<List className="h-4 w-4" />} label="Group" value="Status" />
              <MenuRow icon={<List className="h-4 w-4" />} label="Subtasks" value="Collapsed" />
              <MenuRow icon={<Wand2 className="h-4 w-4" />} label="Templates" />
            </div>

            <div className="py-1">
              <ToggleRow label="Autosave for me" />
              <ToggleRow label="Pin view" />
              <ToggleRow label="Private view" />
              <ToggleRow label="Protect view" />
              <ToggleRow label="Set as default view" />
            </div>
          </div>
        </>
      )}

      {screen === "fields" && (
        <>
          <DrawerHeader
            title="Fields"
            onBack={() => setScreen("main")}
            onClose={handleClose}
            trailing={
              <button type="button" className="rounded-md p-1.5 text-white/50 hover:bg-white/5 hover:text-white" aria-label="Field settings">
                <Settings className="h-4 w-4" />
              </button>
            }
          />
          <div className="border-b border-white/[0.06] px-4 py-3">
            <input
              value={fieldSearch}
              onChange={(e) => setFieldSearch(e.target.value)}
              placeholder="Search Task Fields"
              className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2.5 text-[13px] text-white placeholder:text-white/35 outline-none focus:border-white/30"
            />
          </div>
          <div className="flex border-b border-white/[0.06] px-4">
            {(["create", "existing"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFieldsTab(tab)}
                className={cn(
                  "px-3 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors",
                  fieldsTab === tab ? "border-white text-white" : "border-transparent text-white/40"
                )}
              >
                {tab === "create" ? "Create new" : "Add existing"}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {fieldsTab === "existing" ? (
              <div className="px-4 py-8 text-center text-[13px] text-white/40">No existing fields to add</div>
            ) : (
              <>
                <div className="px-4 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-white/35">Popular</div>
                {popularTypes.map((ft) => (
                  <button
                    key={ft.id}
                    type="button"
                    onClick={() => {
                      setSelectedType(ft)
                      setScreen("create")
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.04] transition-colors"
                  >
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.06]", ft.iconClass)}>
                      {ft.icon}
                    </span>
                    <span className="text-[13px] text-white/90">{ft.label}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {screen === "create" && selectedType && (
        <CreateFieldForm
          fieldType={selectedType}
          roomId={roomId}
          onBack={() => setScreen("fields")}
          onClose={handleClose}
          onCreated={reset}
        />
      )}
    </DrawerShell>
  )
}

export function CustomizeViewButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-white/15 bg-[#141516] px-3 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-[#1a1b1e] transition-colors touch-manipulation",
        className
      )}
    >
      <Settings className="h-4 w-4 text-white/70" />
      Customize
    </button>
  )
}

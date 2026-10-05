"use client"

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { useDroppable } from "@dnd-kit/core"
import { useMemo, useState, useRef, useEffect, useCallback } from "react"
import { KanbanCard } from "./kanban-card"
import type { Column } from "./Dashbaord"
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react"
import { useCardStore } from "@/store/athena/cardStore"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { StageSummaryDialog } from './stage-summary-dialog'
import {
  Share2,
  Users,
  Calendar,
  Flag
} from "lucide-react"
import { AssigneePicker } from "./assignee-picker"
import { CustomDatePicker } from "./custom-date-picker"
import { PriorityPicker } from "./priority-picker"
import { TagPicker } from "./tag-picker"
import { Tag as TagIcon, AlignLeft } from "lucide-react"
import Cookies from "js-cookie"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useSearchParams } from 'next/navigation'

type CommentItem = {
  _id: string
  userId?: {
    _id?: string;
    name?: string
    email?: string
  }
  userName?: string
  userAvatarUrl?: string
  comment: string
  createdAt?: string
  updatedAt?: string
}

interface KanbanColumnProps {
  column: Column
  onAddCard: (columnId: string, cardData: {
    title: string;
    assignedToIds: string[];
    startDate: number | null;
    dueDate: number | null;
    priority: string;
    tags: string[];
    description: string;
  }) => void
  onUpdate?: (id: string, updates: { name?: string, color?: string }) => void
  onDelete?: (id: string) => void
  isOverlay?: boolean
  boardId: string
  orgId: string
  userId: string | undefined
  setColumns: React.Dispatch<React.SetStateAction<Column[]>>
  isReadOnly?: boolean
  connected: boolean
  updateTaskAndCardCounts: (newChildCount: number, newCompletedChildCount: number, taskId: string, cardId: string) => void
  Idspace: string
}

const PRESET_COLORS = [
  "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#06b6d4", "#84cc16",
  "#f97316", "#6366f1", "#14b8a6", "#a855f7",
]

export function KanbanColumn({ column, onAddCard, onUpdate, Idspace, updateTaskAndCardCounts, onDelete, connected, userId, isOverlay, boardId, orgId, setColumns, isReadOnly }: KanbanColumnProps) {
  const [showAddCard, setShowAddCard] = useState(false)
  const [showAddAtBottom, setShowAddAtBottom] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState("")
  const [assignedToIds, setAssignedToIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState<number | null>(null)
  const [dueDate, setDueDate] = useState<number | null>(null)
  const [priority, setPriority] = useState<string>("")
  const [description, setDescription] = useState("")
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  // Edit popover state (replaces inline editing)
  const [showEditPopover, setShowEditPopover] = useState(false)
  const [popoverTitle, setPopoverTitle] = useState(column.name)
  const [popoverColor, setPopoverColor] = useState(column.color || "#343439")

  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const editPopoverRef = useRef<HTMLDivElement>(null)
  const addCardContainerRef = useRef<HTMLDivElement>(null)
  const cardsContainerRef = useRef<HTMLDivElement>(null)
  const isFetchingRef = useRef(false)
  const pageRef = useRef(1)
  const totalPagesRef = useRef<number | null>(null)

  const router = useRouter()
  const [showExpiredDialog, setShowExpiredDialog] = useState(false)
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false)

  const cardsIds = useMemo(() => column.cards.map((card) => card._id), [column.cards])
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspaceId');
  const resolvedWorkspaceId = workspaceId ?? boardId;

  const { setNodeRef, isOver } = useDroppable({
    id: column._id,
    data: {
      type: "Column",
      column,
    },
  })

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (menuRef.current && !menuRef.current.contains(target)) {
        setShowMenu(false)
      }

      // Close edit popover if click is outside it
      if (editPopoverRef.current && !editPopoverRef.current.contains(target)) {
        setShowEditPopover(false)
      }

      const isInsidePortal = (target as HTMLElement).closest('[data-radix-popper-content-wrapper]') ||
        (target as HTMLElement).closest('[data-radix-portal-primitive]') ||
        (target as HTMLElement).closest('[role="dialog"]') ||
        (target as HTMLElement).closest('[role="menu"]') ||
        (target as HTMLElement).closest('[role="listbox"]') ||
        (target as HTMLElement).closest('.radix-popover-content');

      if (addCardContainerRef.current &&
        !addCardContainerRef.current.contains(target) &&
        !isInsidePortal) {
        setShowAddCard(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const [isCreating, setIsCreating] = useState(false)
  const { fetchCardsForStage } = useCardStore()
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [stageExhausted, setStageExhausted] = useState(false)

  const totalCardCount = column?.taskCount ?? 0

  const canFetchMore = useCallback(() => {
    if (stageExhausted) return false
    if (isFetchingRef.current) return false
    if (totalPagesRef.current && pageRef.current >= totalPagesRef.current) {
      setStageExhausted(true)
      return false
    }
    return totalCardCount > 30
  }, [stageExhausted, totalCardCount])

  const transformCard = (card: any) => ({
    _id: card?._id,
    name: card?.title,
    userId: card?.userId,
    description: card?.description || "",
    tags: card?.tags || [],
    tagData: card?.tagData || [],
    timeEstimate: card?.timeEstimate,
    members: card?.assigneeData ? card.assigneeData : [],
    dueDate: card?.dueDate,
    startDate: card?.startDate,
    checklist: card?.checklist ? card.checklist || [] : [],
    isOverDue: card?.isOverDue,
    isCompleted: card?.isCompleted,
    priority: card?.priority,
    comments: [],
    commentCount: card?.commentCount,
    stageId: card?.stageId,
    subTaskCount: card?.subTaskCount,
    createdAt: card?.createdAt,
    assignedToIds: card?.assignedToIds ? card.assignedToIds || [] : [],
    TaskDataCount: {
      totalChildCount: card?.TaskDataCount?.totalChildCount ?? 0,
      totalCompletedChildCount: card?.TaskDataCount?.totalCompletedChildCount ?? 0
    }
  });

  const triggerFetch = useCallback(async () => {
    if (!canFetchMore()) return

    isFetchingRef.current = true
    setIsLoadingMore(true)
    const nextPage = pageRef.current + 1

    try {
      const { cards: newCards, totalPages } = await fetchCardsForStage(column._id, nextPage)
      totalPagesRef.current = totalPages

      if (!newCards || newCards.length === 0 || (totalPages && nextPage >= totalPages)) {
        setStageExhausted(true)
      }

      if (newCards && newCards.length > 0) {
        pageRef.current = nextPage
        setColumns(prev => prev.map(col => {
          if (col._id === column._id) {
            // A card created since page 1 loaded shifts the server's pages by
            // one, so the next page repeats a card we already have; skip it.
            const existingIds = new Set((col.cards || []).map((c: any) => c._id || c.id))
            return {
              ...col,
              cards: [
                ...col.cards,
                ...(newCards || [])
                  .filter((card: any) => !existingIds.has(card._id))
                  .map((card: any) => transformCard(card)),
              ]
            }
          }
          return col
        }))
      }
    } catch (error) {
      console.error(`[fetch] Failed for ${column.name}:`, error)
    } finally {
      setIsLoadingMore(false)
      isFetchingRef.current = false
    }
  }, [column._id, column.name, boardId, fetchCardsForStage, canFetchMore])

  const handleScroll = useCallback(
    (e: Event) => {
      if (!canFetchMore()) return
      const target = e.target as HTMLDivElement
      const { scrollTop, scrollHeight, clientHeight } = target
      const threshold = 150
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - threshold
      if (isNearBottom) triggerFetch()
    },
    [canFetchMore, triggerFetch]
  )

  useEffect(() => {
    const container = cardsContainerRef.current
    if (!container) return
    let timeoutId: NodeJS.Timeout | null = null
    const debouncedScroll = (e: Event) => {
      if (timeoutId) return
      timeoutId = setTimeout(() => {
        handleScroll(e)
        timeoutId = null
      }, 300)
    }
    container.addEventListener("scroll", debouncedScroll, { passive: true })
    return () => {
      container.removeEventListener("scroll", debouncedScroll)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [handleScroll])

  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (column.cards.length > 0 && canFetchMore()) {
        const container = cardsContainerRef.current
        const content = contentRef.current
        if (!container || !content) return
        const visibleHeight = container.clientHeight
        const contentHeight = content.scrollHeight
        if (contentHeight < visibleHeight * 0.8) triggerFetch()
      }
    })
    if (contentRef.current) observer.observe(contentRef.current)
    return () => observer.disconnect()
  }, [canFetchMore, triggerFetch, column.cards.length])

  const handleAddCard = async () => {
    if (isReadOnly) return
    if (newCardTitle.trim() && !isCreating) {
      setIsCreating(true)
      await onAddCard(column._id, {
        title: newCardTitle,
        assignedToIds,
        startDate,
        dueDate,
        priority,
        tags: selectedTagIds,
        description
      })
      setNewCardTitle("")
      setAssignedToIds([])
      setStartDate(null)
      setDueDate(null)
      setPriority("")
      setDescription("")
      setSelectedTagIds([])
      setShowAddCard(false)
      setShowAddAtBottom(false)
      setIsCreating(false)
    }
  }

  const handleSaveEdit = () => {
    if (popoverTitle.trim()) {
      onUpdate?.(column._id, { name: popoverTitle, color: popoverColor })
    }
    setShowEditPopover(false)
  }

  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    if (!hex || typeof hex !== "string") return null
    const cleaned = hex.trim().replace(/^#/, "")
    let r: string, g: string, b: string
    if (/^[a-f\d]{3}$/i.test(cleaned)) {
      r = cleaned[0] + cleaned[0]; g = cleaned[1] + cleaned[1]; b = cleaned[2] + cleaned[2]
    } else if (/^[a-f\d]{6}$/i.test(cleaned)) {
      r = cleaned.slice(0, 2); g = cleaned.slice(2, 4); b = cleaned.slice(4, 6)
    } else if (/^[a-f\d]{8}$/i.test(cleaned)) {
      r = cleaned.slice(0, 2); g = cleaned.slice(2, 4); b = cleaned.slice(4, 6)
    } else return null
    return { r: parseInt(r, 16), g: parseInt(g, 16), b: parseInt(b, 16) }
  }

  const stageColor = column?.color || "#8b5cf6"
  const rgb = hexToRgb(stageColor)
  const bgColor = rgb
    ? `rgba(${Math.round(rgb.r * 0.30)}, ${Math.round(rgb.g * 0.30)}, ${Math.round(rgb.b * 0.30)}, 0.22)`
    : "rgba(39, 10, 115, 0.22)"
  const borderColor = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)` : "rgba(139, 92, 246, 0.2)"

  return (
    <div
      ref={setNodeRef}
      style={{ backgroundColor: "transparent" }}
      className={`relative flex-shrink-0 w-70 rounded-xl flex flex-col h-full overflow-hidden transition-all bg-transparent ${isOverlay ? "rotate-2 shadow-xl cursor-grabbing" : ""}`}
    >
      {/* Column Header */}
      <div
        className="flex items-center justify-between px-3 gap-2 py-3 pl-0 group rounded-t-lg transition-colors"
        style={{ borderColor: borderColor }}
      >
        <div
          className="flex items-center gap-2 px-2 min-w-0"
          style={{ backgroundColor: stageColor, color: '#ffffff', borderRadius: "8px" }}
        >
          <div className="h-1.5 w-1.5 rounded-full flex-shrink-0 shadow-sm ring-2 ring-white" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h2 className="text-xs font-semi text-white truncate">
              {column.name?.replace(/\b\w/g, char => char.toUpperCase()) || ''}
            </h2>
            <span className="text-xs font-semi px-2 py-1 pl-0 rounded-full flex-shrink-0 text-white">
              {column.localCardCount || 0}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!isReadOnly && (
          <button
            className="rounded transition-colors shadow-sm hover:shadow-md text-white/50 cursor-pointer p-1.5"
            onClick={() => {
              setShowAddAtBottom(false)
              setShowAddCard(true)
            }}
            title="Add task"
          >
            <Plus className="h-4 w-4" />
          </button>
          )}

          <StageSummaryDialog
            stageId={column?._id}
            stageName={column?.name}
            isOpen={isDialogOpen}
            onClose={() => setIsDialogOpen(false)}
          />

          {!isReadOnly && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(!showMenu)
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1.5 rounded transition-colors text-white/50 cursor-pointer hover:text-white/80"
                title="Stage options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {showMenu && (
                <div className="absolute cursor-pointer right-0 top-full mt-1 w-40 bg-black dark:bg-slate-800 rounded-lg shadow-lg border border-[#e5e7eb0f] dark:border-[#e5e7eb0f] py-1 z-10 backdrop-blur-sm">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setPopoverTitle(column.name)
                      setPopoverColor(column.color || "#8b5cf6")
                      setShowEditPopover(true)
                      setShowMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 font-[500] cursor-pointer  text-xs text-white hover:bg-muted hover:text-black flex items-center gap-2 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit Stage
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsDialogOpen(true)
                    }}
                    className="w-full text-left px-4 py-2 font-[500]  cursor-pointer text-xs  text-white hover:bg-muted hover:text-black flex items-center gap-2 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    Summary
                  </button>

                  <div className="border-t border-[#e5e7eb29] my-1" />

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const token = Cookies.get("auth-token")
                      if (token) {
                        try {
                          const payload = JSON.parse(atob(token.split('.')[1]))
                          if (payload.exp) {
                            const currentTime = Math.floor(Date.now() / 1000)
                            if (currentTime >= payload.exp) {
                              setShowExpiredDialog(true)
                              setShowMenu(false)
                              return
                            }
                          }
                        } catch (e) {
                          console.error("Failed to decode token", e)
                        }
                      }
                      setShowDeleteConfirmDialog(true)
                      setShowMenu(false)
                    }}
                    className="w-full cursor-pointer text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-muted   flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Stage
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Stage Popover ── */}
      {showEditPopover && (
        <div
          ref={editPopoverRef}
          className="absolute left-3 top-14 z-50 w-65 rounded-xl shadow-2xl border overflow-hidden"
          style={{
            backgroundColor: "rgba(18, 18, 26, 0.97)",
            borderColor: borderColor,
            backdropFilter: "blur(20px)",
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Popover Header */}
          <div
            className="px-2 py-3 pb-0 flex items-center justify-between "
            style={{ borderColor: borderColor }}
          >
            <span className="text-sm font-semibold text-white/90 tracking-wide">Edit Stage</span>
            <button
              onClick={() => setShowEditPopover(false)}
              className="w-6 h-6 flex items-center justify-center rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors text-base leading-none cursor-pointer"
            >
              ×
            </button>
          </div>

          <div className="p-2 pt-0 space-y-2">
            {/* Stage Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] mb-2 font-semibold text-white/40 uppercase tracking-widest">
                Stage Name
              </label>
              <input
                type="text"
                value={popoverTitle}
                onChange={(e) => setPopoverTitle(e.target.value)}
                autoFocus
                style={{
                  fontSize: "12px",
                  marginTop: "2px"
                }}
                placeholder="Enter stage name..."
                className="w-full px-3 py-2 rounded-lg placeholder:text-xs  text-xs text-white bg-white/5 border border-white/10 focus:outline-none focus:border-white/30 transition-all placeholder:text-white/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit()
                  if (e.key === "Escape") setShowEditPopover(false)
                }}
              />
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                Stage Color
              </label>

              {/* Preset swatches */}
              <div className="grid grid-cols-12 gap-1.5">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setPopoverColor(color)}
                    className="w-4 h-4 rounded-lg transition-all duration-150 hover:scale-110 active:scale-95 flex items-center justify-center"
                    style={{
                      backgroundColor: color,
                      boxShadow: popoverColor === color
                        ? `0 0 0 2px #12121a, 0 0 0 3.5px ${color}`
                        : "none",
                    }}
                    title={color}
                  >
                    {popoverColor === color && (
                      <svg className="w-3.5 h-3.5 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              {/* Custom color row */}
              <div
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border cursor-pointer hover:border-white/20 transition-colors"
                style={{ borderColor: borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}
                onClick={() => document.getElementById(`color-picker-${column._id}`)?.click()}
              >
                <div
                  className="w-6 h-6 rounded-md flex-shrink-0 border border-white/20"
                  style={{ backgroundColor: popoverColor }}
                />
                <span className="text-xs text-white/50 flex-1">Custom color</span>
                <span className="text-[11px] font-mono text-white/30">{popoverColor.toUpperCase()}</span>
                <input
                  type="color"
                  id={`color-picker-${column._id}`}
                  value={popoverColor}
                  onChange={(e) => setPopoverColor(e.target.value)}
                  className="sr-only"
                />
              </div>
            </div>

            {/* Live Preview */}
            {/* <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                Preview
              </label>
              <div
                className="px-3 py-2 rounded-lg flex items-center gap-2 transition-all duration-200"
                style={{ backgroundColor: popoverColor }}
              >
                <div className="h-1.5 w-1.5 rounded-full bg-black/30 flex-shrink-0" />
                <span className="text-sm font-semibold text-white truncate drop-shadow-sm">
                  {popoverTitle?.replace(/\b\w/g, c => c.toUpperCase()) || "Stage Name"}
                </span>
              </div>
            </div> */}
          </div>

          {/* Footer */}
          <div
            className="px-4 py-3 flex items-center justify-end gap-2 border-t"
            style={{ borderColor: borderColor }}
          >
            <button
              onClick={() => setShowEditPopover(false)}
              className="px-3 cursor-pointer py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors border border-[#e5e7eb0f]"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={!popoverTitle.trim()}
              className="px-4 cursor-pointer py-1.5 rounded-lg text-xs font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
              style={{ backgroundColor: popoverColor }}
            >
              Save changes
            </button>
          </div>
        </div>
      )}

      {/* Cards Container */}
      <div
        ref={cardsContainerRef}
        className="flex flex-col gap-3 p-3 pt-0 flex-1 overflow-y-auto px-0"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: `${stageColor}40 transparent`,
        } as React.CSSProperties}
      >
        {/* Add Card Form at Top */}
        {showAddCard && !showAddAtBottom && !isReadOnly && (
          <div
            // ref={addCardContainerRef}
            className="rounded-xl p-3 shadow-lg space-y-3 mb-3 border transition-all"
            style={{ backgroundColor: bgColor, borderColor: borderColor, backdropFilter: "blur(10px)" }}
          >
            <div className="flex justify-between items-start gap-2">
              <textarea
                placeholder="Task Name..."
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                autoFocus
                className="w-full px-0 py-1 bg-transparent text-sm placeholder:text-sm text-white/50 placeholder:text-white/50 rounded text-base font-medium focus:outline-none resize-none min-h-[40px]"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddCard() }
                  if (e.key === "Escape") setShowAddCard(false)
                }}
              />
              <button
                onClick={handleAddCard}
                disabled={isCreating || !newCardTitle.trim()}
                className="flex items-center gap-1.5 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-all active:scale-95 disabled:opacity-40 shadow-sm"
                style={{ backgroundColor: stageColor, color: '#ffffff' }}
              >
                {isCreating ? "..." : "Save"}
                {/* <span className="text-[12px] opacity-60">↵</span> */}
              </button>
            </div>

            <div className="space-y-2">
              <AssigneePicker
                assignedToIds={assignedToIds}
                onSelect={(ids) => setAssignedToIds(ids)}
                activeColor={stageColor}
                bgColor={bgColor}
                borderColor={borderColor}
              >
                <button className={cn("flex items-center gap-2.5 px-2 w-full py-2 rounded-md text-white/70 transition-colors group")} style={{ backgroundColor: bgColor }}>
                  <div className="p-1 px-1.5 rounded transition-colors border" style={{ backgroundColor: borderColor, borderColor: borderColor }}>
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-normal">{assignedToIds.length > 0 ? `${assignedToIds.length} Assignees` : "Add assignee"}</span>
                </button>
              </AssigneePicker>

              <CustomDatePicker
                startDate={startDate ? new Date(startDate) : undefined}
                dueDate={dueDate ? new Date(dueDate) : undefined}
                onSelect={(range) => {
                  setStartDate(range.start ? range.start.getTime() : null);
                  setDueDate(range.due ? range.due.getTime() : null);
                }}
                activeColor={stageColor}
                bgColor={bgColor}
                borderColor={borderColor}
              >
                <button className={cn("flex items-center gap-2.5 w-full px-2 py-2 rounded-md transition-colors group", dueDate ? "text-white/70" : "text-white/70")} style={{ backgroundColor: bgColor }}>
                  <div className="p-1 px-1.5 rounded transition-colors border" style={{ backgroundColor: borderColor, borderColor: borderColor }}>
                    <Calendar className={cn("w-3.5 h-3.5", dueDate && "text-white/70")} />
                  </div>
                  <span className="text-sm font-normal truncate">
                    {dueDate ? `${new Date(startDate).toLocaleDateString()} ${dueDate ? `- ${new Date(dueDate).toLocaleDateString()}` : ""}` : "Add dates"}
                  </span>
                </button>
              </CustomDatePicker>

              <PriorityPicker
                priority={priority}
                onSelect={(p) => setPriority(p)}
                activeColor={stageColor}
                bgColor={bgColor}
                borderColor={borderColor}
              >
                <button className={cn("flex items-center gap-2.5 w-full px-2 py-2 rounded-md transition-colors group")} style={{ backgroundColor: bgColor }}>
                  <div className="p-1 px-1.5 rounded transition-colors border" style={{ backgroundColor: borderColor, borderColor: borderColor }}>
                    <Flag className={cn("w-3.5 h-3.5", priority === "urgent" ? "fill-red-500 text-red-500" : (priority === "high" ? "fill-amber-500 text-amber-500" : ""))} />
                  </div>
                  <span className="text-sm font-normal capitalize">{priority || "Add priority"}</span>
                </button>
              </PriorityPicker>

              <TagPicker
                boardId={resolvedWorkspaceId}
                selectedTagIds={selectedTagIds}
                onSelect={(ids) => setSelectedTagIds(ids)}
                Idspace={Idspace}
                activeColor={stageColor}
                bgColor={bgColor}
                borderColor={borderColor}
              >
                <button className={cn("flex items-center gap-2.5 w-full px-2 py-2 rounded-md transition-colors group")} style={{ backgroundColor: bgColor }}>
                  <div className="p-1 px-1.5 rounded transition-colors border" style={{ backgroundColor: borderColor, borderColor: borderColor }}>
                    <TagIcon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-normal">{selectedTagIds.length > 0 ? `${selectedTagIds.length} Tags` : "Add tags"}</span>
                </button>
              </TagPicker>

              <div className="flex gap-2.5 w-full px-2 py-2 rounded-md transition-colors group" style={{ backgroundColor: bgColor }}>
                <div className="p-1 px-1.5 h-fit rounded border" style={{ backgroundColor: borderColor, borderColor: borderColor }}>
                  <AlignLeft className="w-3.5 h-3.5 text-white/70" />
                </div>
                <textarea
                  placeholder="Add description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-transparent text-sm placeholder:text-sm text-white/70 placeholder:text-white/70 focus:outline-none resize-none max-h-[20px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => {
                  setShowAddCard(false); setNewCardTitle(""); setAssignedToIds([]); setStartDate(null)
                  setDueDate(null); setPriority(""); setDescription(""); setSelectedTagIds([])
                }}
                className="text-[11px] text-white/70 hover:text-white p-2 rounded-[7px] font-bold cursor-pointer transition-colors px-2"
                style={{ backgroundColor: borderColor }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div ref={contentRef} className="flex flex-col gap-3">
          <SortableContext items={cardsIds} strategy={verticalListSortingStrategy}>
            {column.cards.map((card) => (
              <KanbanCard
                key={card._id}
                connected={connected}
                Idspace={Idspace || ""}
                updateTaskAndCardCounts={updateTaskAndCardCounts}
                userId={userId}
                card={card}
                columnId={column._id}
                columnColor={column?.color}
                boardId={boardId}
                orgId={orgId}
                setColumns={setColumns}
                isReadOnly={isReadOnly}
              />
            ))}
          </SortableContext>
        </div>

        {isLoadingMore && (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <span className="ml-2 text-sm text-gray-500">Loading more cards...</span>
          </div>
        )}

        {!showAddCard && !isReadOnly && (
          <button
            onClick={() => { setShowAddAtBottom(true); setShowAddCard(true) }}
            className="flex items-center gap-2 cursor-pointer rounded px-3 py-2.5 transition text-sm font-medium text-white shadow-sm hover:shadow-md"
            style={{ color: stageColor }}
            disabled={isReadOnly}
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        )}

        {/* Add Card Form at Bottom */}
        {showAddCard && showAddAtBottom && !isReadOnly && (
          <div
            // ref={addCardContainerRef}
            className="rounded-xl p-3 bg-[#0a0a0d] shadow-lg space-y-3 animate-in fade-in zoom-in duration-200 mt-3 border transition-all"
            style={{
              backdropFilter: "blur(10px)",
              border: "1px solid #211d1d"

            }}
          >
            <div className="flex justify-between items-start gap-2">
              <textarea
                placeholder="Task Name..."
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                autoFocus
                className="w-full px-0 py-1 pt-0 bg-transparent text-sm placeholder:text-sm text-white/70 placeholder:text-white/70 rounded text-base font-medium focus:outline-none resize-none min-h-[20px]"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddCard() }
                  if (e.key === "Escape") { setShowAddCard(false); setShowAddAtBottom(false) }
                }}
              />
              <button
                onClick={handleAddCard}
                disabled={isCreating || !newCardTitle.trim()}
                className="flex items-center gap-1.5 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-all active:scale-95 disabled:opacity-40 shadow-sm"
                style={{ backgroundColor: stageColor, color: '#ffffff' }}
              >
                {isCreating ? "..." : "Save"}
                {/* <span className="text-[12px] opacity-60">↵</span> */}
              </button>
            </div>

            <div className="space-y-2">
              <AssigneePicker
                assignedToIds={assignedToIds}
                onSelect={(ids) => setAssignedToIds(ids)}
                activeColor={stageColor}
                bgColor={bgColor}
                borderColor={borderColor}
              >
                <button className={cn("flex items-center gap-2.5 px-2 w-full py-2 rounded-md text-white/70 transition-colors group")} style={{ backgroundColor: bgColor, borderColor: borderColor, border: `1px solid ${borderColor}` }}>
                  <div className="p-1 px-1.5 rounded transition-colors" style={{ backgroundColor: borderColor, borderColor: borderColor }}>
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-normal">{assignedToIds.length > 0 ? `${assignedToIds.length} Assignees` : "Add Assignee"}</span>
                </button>
              </AssigneePicker>

              <CustomDatePicker
                startDate={startDate ? new Date(startDate) : undefined}
                dueDate={dueDate ? new Date(dueDate) : undefined}
                onSelect={(range) => {
                  setStartDate(range.start ? range.start.getTime() : null);
                  setDueDate(range.due ? range.due.getTime() : null);
                }}
                activeColor={stageColor}
                bgColor={bgColor}
                borderColor={borderColor}
              >
                <button className={cn("flex items-center gap-2.5 w-full px-2 py-2 rounded-md text-white/70 transition-colors group")} style={{ backgroundColor: bgColor, borderColor: borderColor, border: `1px solid ${borderColor}` }}>
                  <div className="p-1 px-1.5 rounded transition-colors" style={{ backgroundColor: borderColor, borderColor: borderColor }}>
                    <Calendar className={cn("w-3.5 h-3.5", dueDate && "text-white/70")} />
                  </div>
                  <span className="text-sm font-normal truncate">
                    {startDate && dueDate
                      ? `${new Date(startDate).toLocaleDateString()} - ${new Date(dueDate).toLocaleDateString()}`
                      : startDate ? new Date(startDate).toLocaleDateString()
                        : dueDate ? new Date(dueDate).toLocaleDateString() : "Add dates"
                    }
                  </span>
                </button>
              </CustomDatePicker>

              <PriorityPicker
                priority={priority}
                onSelect={(p) => setPriority(p)}
                activeColor={stageColor}
                bgColor={bgColor}
                borderColor={borderColor}
              >
                <button className={cn("flex items-center gap-2.5 w-full px-2 py-2 rounded-md text-white/70 transition-colors group")} style={{ backgroundColor: bgColor, borderColor: borderColor, border: `1px solid ${borderColor}` }}>
                  <div className="p-1 px-1.5 rounded transition-colors" style={{ backgroundColor: borderColor, borderColor: borderColor }}>
                    <Flag className={cn("w-3.5 h-3.5", priority === "urgent" ? "fill-red-500 text-red-500" : (priority === "high" ? "fill-amber-500 text-amber-500" : ""))} />
                  </div>
                  <span className="text-sm font-normal capitalize">{priority || "Add priority"}</span>
                </button>
              </PriorityPicker>

              <TagPicker
                boardId={resolvedWorkspaceId}
                selectedTagIds={selectedTagIds}
                onSelect={(ids) => setSelectedTagIds(ids)}
                Idspace={Idspace}
                activeColor={stageColor}
                bgColor={bgColor}
                borderColor={borderColor}
              >
                <button className={cn("flex items-center gap-2.5 w-full px-2 py-2 rounded-md text-white/70 transition-colors group")} style={{ backgroundColor: bgColor, borderColor: borderColor, border: `1px solid ${borderColor}` }}>
                  <div className="p-1 px-1.5 rounded transition-colors" style={{ backgroundColor: borderColor, borderColor: borderColor }}>
                    <TagIcon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-normal">{selectedTagIds.length > 0 ? `${selectedTagIds.length} Tags` : "Add tags"}</span>
                </button>
              </TagPicker>

              <div className="flex gap-2.5 w-full px-2 py-2 rounded-md transition-colors group" style={{ backgroundColor: bgColor }}>
                <div className="p-1 px-1.5 h-fit rounded border" style={{ backgroundColor: borderColor, borderColor: borderColor }}>
                  <AlignLeft className="w-3.5 h-3.5 text-white/70" />
                </div>
                <textarea
                  placeholder="Add description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-transparent text-sm placeholder:text-sm text-white/70 placeholder:text-white/70 focus:outline-none resize-none max-h-[20px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => {
                  setShowAddCard(false); setShowAddAtBottom(false); setNewCardTitle(""); setAssignedToIds([])
                  setStartDate(null); setDueDate(null); setPriority(""); setDescription(""); setSelectedTagIds([])
                }}
                className="text-[11px] text-white/70 hover:text-white p-2 rounded-[7px] font-bold cursor-pointer transition-colors px-2"
                style={{ backgroundColor: borderColor }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showExpiredDialog} onOpenChange={setShowExpiredDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session Expired</DialogTitle>
            <DialogDescription>
              Your session has expired. Please log in again to continue.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => router.push("/login")}>Login</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent className="border-[#e5e7eb0f] text-white/50">
          <DialogHeader>
            <DialogTitle className="text-xs">Delete Stage: <span className="font-semibold" style={{ color: stageColor }}>{column.name}</span></DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete this {column?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer border-[#e5e7eb0f]"
              onClick={() => setShowDeleteConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              onClick={() => {
                onDelete?.(column._id)
                setShowDeleteConfirmDialog(false)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
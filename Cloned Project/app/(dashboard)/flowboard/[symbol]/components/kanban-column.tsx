"use client"

import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { useDroppable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { useMemo, useState, useRef, useEffect, useCallback } from "react"
import { KanbanCard } from "./kanban-card"
import type { Column } from "./kanban-board"
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2, MoreVertical } from "lucide-react"
import { useCardStore } from "@/store/flowboard/cardStore"
import { toast } from "sonner"
import { StageSummaryDialog } from './stage-summary-dialog'
import {

  Share2
} from "lucide-react"
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
  onAddCard: (columnId: string, cardTitle: string) => void
  onUpdate?: (id: string, newTitle: string) => void
  onDelete?: (id: string) => void
  isOverlay?: boolean
  boardId: string
  orgId: string
  userId: string | undefined
  setColumns: React.Dispatch<React.SetStateAction<Column[]>>
  isReadOnly?: boolean
  connected: boolean
  updateTaskAndCardCounts: (newChildCount: number, newCompletedChildCount: number, taskId: string, cardId: string) => void



}

export function KanbanColumn({ column, onAddCard, onUpdate, updateTaskAndCardCounts, onDelete, connected, userId, isOverlay, boardId, orgId, setColumns, isReadOnly }: KanbanColumnProps) {
  const [showAddCard, setShowAddCard] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(column.name)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const cardsContainerRef = useRef<HTMLDivElement>(null)
  // const contentRef = useRef<HTMLDivElement>(null) // Unused
  const isFetchingRef = useRef(false)
  const pageRef = useRef(1) // Local page tracker
  const totalPagesRef = useRef<number | null>(null) // Track total pages from API

  const router = useRouter()
  const [showExpiredDialog, setShowExpiredDialog] = useState(false)

  const cardsIds = useMemo(() => column.cards.map((card) => card._id), [column.cards])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: column._id,
    data: {
      type: "Column",
      column,
    },
    disabled: isOverlay || isEditing || isReadOnly, // Disable drag when editing or read-only
  })

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: column._id,
    data: {
      type: "Column",
      column,
    },
  })

  // console.log("column", column)
  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const [isCreating, setIsCreating] = useState(false)
  const { fetchCardsForStage } = useCardStore()
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [stageExhausted, setStageExhausted] = useState(false)

  const totalCardCount = column?.cardCount ?? 0
  const totalCardCountFromMeta = column?.cardCount ?? 0
  console.log("column?.cardCount", totalPagesRef.current)
  // ──────────────────────────────────────────────────────────────
  // Can we fetch more?
  // ──────────────────────────────────────────────────────────────
  const canFetchMore = useCallback(() => {
    // Check if exhausted
    if (stageExhausted) return false

    // Check if currently fetching
    if (isFetchingRef.current) return false

    // Check if we've reached total pages
    if (totalPagesRef.current && pageRef.current >= totalPagesRef.current) {
      setStageExhausted(true)
      return false
    }

    // Only fetch if we have at least 30 cards (similar to taskroom)
    return totalCardCount > 10
  }, [stageExhausted, totalCardCount])

  // ──────────────────────────────────────────────────────────────
  // Trigger fetch (shared, safe)
  // ──────────────────────────────────────────────────────────────
  const triggerFetch = useCallback(async () => {
    if (!canFetchMore()) return

    isFetchingRef.current = true
    setIsLoadingMore(true)
    const nextPage = pageRef.current + 1
    console.log(`[KanbanColumn] Fetching page ${nextPage} for ${column.name}...`)

    try {
      const { cards: newCards, totalPages } = await fetchCardsForStage(boardId, column._id, nextPage)

      // Update total pages ref
      totalPagesRef.current = totalPages

      // Check if exhausted
      if (!newCards || newCards.length === 0 || (totalPages && nextPage >= totalPages)) {
        setStageExhausted(true)
      }

      if (newCards && newCards.length > 0) {
        pageRef.current = nextPage // Increment local page on success

        setColumns(prev => prev.map(col => {
          if (col._id === column._id) {
            return {
              ...col,
              cards: [
                ...col.cards,
                ...newCards
                  .filter((nc: any) => !col.cards.some(existing => existing._id === nc._id))
                  .map((c: any) => ({
                    _id: c._id,
                    name: c.name,
                    userId: c.userId,
                    description: c.description || "",
                    tags: c.tags || [],
                    tagData: c.tagData || [],
                    members: c.assigneeData || [],
                    dueDate: c.dueDate,
                    checklist: c.checklist,
                    comments: [],
                    stageId: column._id,
                    assignedToIds: c.assignedToIds || [],
                  } as any))
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
  }, [column._id, column.name, boardId, fetchCardsForStage, canFetchMore, setColumns])

  // ──────────────────────────────────────────────────────────────
  // Auto-fetch on mount ONLY if column is empty/short
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    // If column is empty but has cards available (from metadata), fetch
    if (column.cards.length === 0 && totalCardCountFromMeta > 0 && !stageExhausted && !isFetchingRef.current) {
      triggerFetch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run only once on mount

  // ──────────────────────────────────────────────────────────────
  // SCROLL-TO-LOAD: Only when near bottom + debounce
  // ──────────────────────────────────────────────────────────────
  const handleScroll = useCallback(
    (e: Event) => {
      if (!canFetchMore()) return

      const target = e.target as HTMLDivElement
      const { scrollTop, scrollHeight, clientHeight } = target

      const threshold = 150 // px from bottom
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - threshold

      if (isNearBottom) {
        triggerFetch()
      }
    },
    [canFetchMore, triggerFetch]
  )

  // Throttled scroll with debounce
  useEffect(() => {
    const container = cardsContainerRef.current
    if (!container) return

    let timeoutId: NodeJS.Timeout | null = null

    const debouncedScroll = (e: Event) => {
      if (timeoutId) return // Block multiple calls

      timeoutId = setTimeout(() => {
        handleScroll(e)
        timeoutId = null
      }, 300) // 300ms debounce
    }

    container.addEventListener("scroll", debouncedScroll, { passive: true })

    return () => {
      container.removeEventListener("scroll", debouncedScroll)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [handleScroll])

  // Optional: Re-check if content height changes (e.g. after drag/drop)
  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (column.cards.length > 0 && canFetchMore()) {
        const container = cardsContainerRef.current
        const content = contentRef.current
        if (!container || !content) return

        const visibleHeight = container.clientHeight
        const contentHeight = content.scrollHeight

        // If content is shorter than 80% of visible area → fetch more
        if (contentHeight < visibleHeight * 0.8) {
          triggerFetch()
        }
      }
    })

    if (contentRef.current) {
      observer.observe(contentRef.current)
    }

    return () => observer.disconnect()
  }, [canFetchMore, triggerFetch, column.cards.length])

  const blockIfReadOnly = () => {
    if (!isReadOnly) return false
    toast.error("Observers can only view this board")
    return true
  }

  const handleAddCard = async () => {
    if (blockIfReadOnly()) return

    const token = localStorage.getItem("garage_tok")
    console.log("vcxvxvxcv2", token)
    if (token) {
      try {

        const payload = JSON.parse(atob(token.split('.')[1]))
        console.log("vcxvxvxcv2", payload)
        if (payload.exp) {
          const currentTime = Math.floor(Date.now() / 1000)
          console.log("vcxvxvxcv2", currentTime, payload.exp)
          if (currentTime >= payload.exp) {
            setShowExpiredDialog(true)
            return
          }
        }
      } catch (e) {
        console.error("Failed to decode token", e)
      }
    }

    if (newCardTitle.trim() && !isCreating) {
      setIsCreating(true)
      await onAddCard(column._id, newCardTitle)
      setNewCardTitle("")
      setShowAddCard(false)
      setIsCreating(false)
    }
  }
  console.log("showExpiredDialog", showExpiredDialog)
  const handleUpdateTitle = () => {
    if (blockIfReadOnly()) return
    const token = localStorage.getItem("garage_tok")
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.exp) {
          const currentTime = Math.floor(Date.now() / 1000)
          if (currentTime >= payload.exp) {
            setShowExpiredDialog(true)
            return
          }
        }
      } catch (e) {
        console.error("Failed to decode token", e)
      }
    }
    if (editTitle.trim() && editTitle !== column.name) {
      onUpdate?.(column._id, editTitle)
    }
    setIsEditing(false)
  }

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        // {...listeners} // Disabled dragging for columns
        className={`bg-gray-100 dark:bg-gray-800 rounded-lg flex flex-col max-h-full border border-gray-200 dark:border-gray-700 shadow-sm w-[300px] flex-shrink-0 transition-opacity ${isDragging ? "opacity-50" : ""
          }`}
      />
    )
  }

  // Combine refs for both sortable and droppable
  const combinedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node)
    setDroppableRef(node)
  }

  return (
    <div
      ref={combinedRef}
      style={style}
      className={`flex-shrink-0 w-80 bg-[#e6eaef] dark:bg-gray-800 rounded-xl shadow-sm  flex flex-col max-h-full ${isOverlay ? "rotate-2 shadow-xl cursor-grabbing" : ""
        } ${isOver ? "ring-2 ring-blue-400" : ""}`}
    >
      {/* Column Header */}
      <div
        {...(isReadOnly ? {} : { ...attributes, ...listeners })}
        className="flex items-center justify-between px-3 py-2.5 pb-0  cursor-grab active:cursor-grabbing group rounded-t-lg"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {!isEditing && (
            <div className="h-2 w-2 rounded-full bg-black dark:bg-white" />
          )}
          {isEditing ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleUpdateTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUpdateTitle()
                if (e.key === "Escape") {
                  setEditTitle(column.name)
                  setIsEditing(false)
                }
              }}
              autoFocus
              className="text-sm font-semibold text-gray-800 bg-white border border-blue-500 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()} // Prevent drag start
              onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
            />
          ) : (

            <h2
              className="text-sm font-normal text-gray-700 dark:text-gray-300 truncate"
            // onClick={() => setIsEditing(true)}
            >
              {column.name?.replace(/\b\w/g, char => char.toUpperCase()) || ''}

            </h2>
          )}

          {!isEditing && (
            <span className="text-xs text-white bg-black w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center">
              {column.localCardCount}
            </span>
          )}
        </div>
        {/* <div
          onClick={() => setIsDialogOpen(true)}

          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Open
        </div> */}
        <button className="h-4 w-4 mr-2" onClick={() => setIsDialogOpen(true)}>
          <Share2 className="h-4 w-4 mr-2" />
        </button>

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
              onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
              className="text-black hover:text-black dark:hover:text-white dark:text-white transition p-1 rounded  dark:hover:bg-gray-700  group-hover:opacity-100"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsEditing(true)
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Rename
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const token = localStorage.getItem("garage_tok")
                    if (token) {
                      try {
                        const payload = JSON.parse(atob(token.split('.')[1]))
                        if (payload.exp) {
                          const currentTime = Math.floor(Date.now() / 1000)
                          if (currentTime >= payload.exp) {
                            setShowExpiredDialog(true)
                            return
                          }
                        }
                      } catch (e) {
                        console.error("Failed to decode token", e)
                      }
                    }

                    if (confirm("Are you sure you want to delete this list?")) {
                      onDelete?.(column._id)
                    }
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cards Container */}
      <div
        ref={cardsContainerRef}
        className="flex flex-col gap-3 p-3 flex-1 overflow-y-auto min-h-[100px] "
      >
        {/* Your content here */}

        <div ref={contentRef} className="flex flex-col gap-3">
          <SortableContext items={cardsIds} strategy={verticalListSortingStrategy}>
            {column.cards.map((card) => (
              <KanbanCard key={card._id} connected={connected}
                updateTaskAndCardCounts={updateTaskAndCardCounts} userId={userId} card={card} columnId={column._id} boardId={boardId} orgId={orgId} setColumns={setColumns} isReadOnly={isReadOnly} />
            ))}
          </SortableContext>
        </div>

        {/* Loading More Indicator */}
        {isLoadingMore && (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <span className="ml-2 text-sm text-gray-500">Loading more cards...</span>
          </div>
        )}

        {/* Add Card */}
        {!showAddCard ? (
          <button
            onClick={() => {
              if (blockIfReadOnly()) return
              setShowAddCard(true)
            }}
            className="w-full flex items-center gap-2 text-gray-600 dark:text-gray-400 bg-[#e6eaef] dark:bg-gray-800 rounded px-3 py-2 transition text-sm disabled:opacity-60"
            disabled={isReadOnly}
          >
            <Plus className="w-4 h-4" />
            Add a card
          </button>
        ) : (
          <div className="bg-[#e6eaef] dark:bg-gray-800 rounded p-3 space-y-2">
            <textarea
              placeholder="Enter a title for this card..."
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm focus:outline-none focus:ring-0 focus:ring-[#000] dark:focus:ring-white resize-none"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleAddCard()
                }
                if (e.key === "Escape") setShowAddCard(false)
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddCard}
                disabled={isCreating}
                className="flex-1 bg-black dark:bg-white text-white dark:text-black px-3 py-1.5 rounded text-sm font-medium  transition disabled:opacity-50"
              >
                {isCreating ? "Adding..." : "Add card"}
              </button>
              <button
                onClick={() => {
                  setShowAddCard(false)
                  setNewCardTitle("")
                }}
                disabled={isCreating}
                className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-sm transition"
              >
                ✕
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
            <Button onClick={() => router.push("/login")}>
              Login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  )
}

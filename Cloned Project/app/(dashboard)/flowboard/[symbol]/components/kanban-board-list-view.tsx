"use client"

import { useCallback, useEffect, SetStateAction, useRef, Dispatch, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Cookies from "js-cookie"
import { UserPlus, Share2, X, LinkIcon, Copy } from "lucide-react"
import { createPortal } from "react-dom"

import type { Card, Column } from "./kanban-board"
import { useBoardStore } from "@/store/flowboard/boardStore"
import { useMemberStore } from "@/store/flowboard/memberStore"
import { useCardStore } from "@/store/flowboard/cardStore"
import { useUserStore } from "@/store/flowboard/userStore"
import { UnauthorizedView } from "./unauthorized-view"
import { CardModal } from "./card-modal"
import { ShareModal } from "./share-modal"
import { BoardMembersModal } from "./board-members-modal"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

// Local transform helpers – mirror logic from the column board
const transformCard = (card: any, stageId: string): Card => ({
  _id: card._id,
  name: card.name,
  userId: card.userId,
  description: card.description || "",
  tags: card.tags || [],
  tagData: card.tagData || [],
  members: (card.assigneeData || []),
  dueDate: card.dueDate,
  startDate: card.startDate,
  checklist: card.checklist,
  isOverDue: card?.isOverDue,
  isCompleted: card?.isCompleted,
  comments: [],
  commentCount: card?.commentCount,
  stageId: stageId,
  assignedToIds: card.assignedToIds,
  TaskDataCount: {
    totalChildCount: card?.TaskDataCount?.totalChildCount,
    totalCompletedChildCount: card?.TaskDataCount?.totalCompletedChildCount
  },
  attachments: card.attachments || [],
});

const transformStageFromApi = (stage: any): Column => ({
  _id: stage._id,
  name: stage.name,
  cards: (stage.cardData || []).map((card: any) => transformCard(card, stage._id)),
  cardCount: stage.cardCount || 0,
  localCardCount: stage.cardCount || 0,
})

// Track paging state per stage for list view infinite scroll
type StagePagingState = {
  isFetching: boolean
  page: number
  totalPages: number | null
  exhausted: boolean
}
interface kannprops {
  columns: Column[]
  setColumns: Dispatch<SetStateAction<Column[]>>
  connected: boolean,
  sortOrder?: string

}
export function KanbanBoardListView({ columns, setColumns, connected, sortOrder }: kannprops) {
  const params = useParams()
  const router = useRouter()
  const boardId = params.symbol as string

  const [userData, setUserData] = useState<{ id: string; organizationId: string } | null>(null)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false)
  const [isFetchingBoard, setIsFetchingBoard] = useState(true)
  const [membersharing, setmembersharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [stageLoadingMap, setStageLoadingMap] = useState<Record<string, boolean>>({})
  const [activeAddStageId, setActiveAddStageId] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState<string>("")

  const listScrollRef = useRef<HTMLDivElement>(null)
  const stageScrollRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const stagePagingRef = useRef<Record<string, StagePagingState>>({})
  const activeCardIdRef = useRef<string | null>(null)

  const {
    fetchBoardDetails,
    boardDetailsMetadata,
    isLoading: isBoardLoading,
    currentBoard,
    fetchBoardById,
    memberData,
    error,
    incrementCardCount,
  } = useBoardStore()
  const fetchMembers = useMemberStore((state) => state.fetchMembers)
  const isLoadingMembers = useMemberStore((state) => state.isLoading)
  const { fetchCardsForStage, createCard } = useCardStore()
  const isUserProfileFetched = useUserStore((state) => state.isUserProfileFetched)
console.log("memberData",memberData)
  const isReadOnly = (memberData?.role as string | undefined) === "observer"

  const blockIfReadOnly = useCallback(() => {
    if (!isReadOnly) return false
    toast.error("Observers can only view this board")
    return true
  }, [isReadOnly])

  // Load user data from cookie
  useEffect(() => {
    const cookie = localStorage.getItem("garage_tok")
    if (!cookie) return
    try {
      const parsed = JSON.parse(cookie)
      setUserData({ id: parsed.userId, organizationId: parsed.orgId })
    } catch (e) {
      console.error("Failed to parse flowboadUserdata cookie", e)
    }
  }, [])

  // Fetch Board Metadata (name, etc.)
  // useEffect(() => {
  //   if (boardId) {
  //     setIsFetchingBoard(true);
  //     fetchBoardById(boardId).finally(() => {
  //       setIsFetchingBoard(false);
  //     });
  //   }
  // }, [boardId, fetchBoardById]);

  // Initial stages + cards fetch (page 1)


  // Vertical infinite scroll for additional stages
  useEffect(() => {
    const container = listScrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const buffer = 400;

      // Still enough content → don't load more
      if (scrollHeight - (scrollTop + clientHeight) > buffer) return;

      // We only load next page when we're close to bottom
      const sortDirection = sortOrder === "old-to-new" ? "asc" : "desc";

      if (!isBoardLoading && boardDetailsMetadata) {
        const { currentPage, totalPages } = boardDetailsMetadata;

        if (currentPage < totalPages) {
          // Fixed order of arguments
          fetchBoardDetails(boardId, currentPage + 1, 10, sortDirection).then((data: any) => {
            if (!data || !Array.isArray(data)) return;

            setColumns((prev) => {
              const newCols = data.map(transformStageFromApi);
              const existingIds = new Set(prev.map((c) => c._id));
              const uniqueNew = newCols.filter((c) => !existingIds.has(c._id));
              return [...prev, ...uniqueNew];
            });
          });
        }
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [boardId, fetchBoardDetails, isBoardLoading, boardDetailsMetadata, sortOrder]);
  // ↑ add sortOrder to deps if it can change
  const updateTaskAndCardCounts = (newChildCount: number, newCompletedChildCount: number, taskId: string, cardId: string) => {
    // Update task in store
    // updateTask(task._id, {
    //   childCount: newChildCount,
    //   completedChildCount: newCompletedChildCount
    // } as any)

    // Calculate total counts for the card (sum of all tasks)

    console.log("newTotal, newCompleted, task._id, task._cardId", newChildCount, newCompletedChildCount, taskId, cardId)

  }

  // Helper: lazy-load more cards for a stage when user scrolls that section
  const loadMoreCardsForStage = useCallback(
    async (stage: Column) => {
      const currentState =
        stagePagingRef.current[stage._id] ?? {
          isFetching: false,
          page: 1,
          totalPages: null,
          exhausted: false,
        }

      const totalCardCount = stage.cardCount ?? 0

      // ──────────────────────────────────────────────────────────────
      // Logic from kanban-column.tsx
      // ──────────────────────────────────────────────────────────────
      // Stop if currently fetching
      if (currentState.isFetching) return

      // Stop if exhausted
      if (currentState.exhausted) return

      // Stop if we've reached total pages (if known)
      if (
        currentState.totalPages !== null &&
        currentState.page >= currentState.totalPages
      ) {
        stagePagingRef.current[stage._id] = {
          ...currentState,
          exhausted: true
        }
        return
      }

      // Only fetch if we have > 20 cards (similar to kanban-column logic)
      if (totalCardCount <= 10) {
        return
      }

      const nextPage = currentState.page + 1

      // Mark as fetching
      stagePagingRef.current[stage._id] = {
        ...currentState,
        isFetching: true,
      }
      setStageLoadingMap((prev) => ({ ...prev, [stage._id]: true }))

      try {
        const { cards: newCards, totalPages } = await fetchCardsForStage(boardId, stage._id, nextPage)

        // Update state with result
        // Check if no more cards or reached end pages
        const exhausted =
          !newCards ||
          newCards.length === 0 ||
          (totalPages && nextPage >= totalPages)

        stagePagingRef.current[stage._id] = {
          isFetching: false,
          page: nextPage,
          totalPages: totalPages ?? currentState.totalPages,
          exhausted: !!exhausted
        }

        if (newCards && newCards.length > 0) {
          setColumns((prev) =>
            prev.map((col) => {
              if (col._id !== stage._id) return col
              return {
                ...col,
                cards: [
                  ...col.cards,
                  ...newCards
                    .filter((nc: any) => !col.cards.some((existing) => existing._id === nc._id))
                    .map((c: any) => transformCard(c, stage._id)),
                ],
                localCardCount:
                  (col.localCardCount || col.cards.length) + newCards.length,
              }
            }),
          )
        }
      } catch (e) {
        console.error("Failed to load more cards for stage", stage.name, e)
        // Reset fetching state on error so we can try again
        stagePagingRef.current[stage._id] = {
          ...currentState,
          isFetching: false
        }
      } finally {
        setStageLoadingMap((prev) => ({ ...prev, [stage._id]: false }))
      }
    },
    [boardId, fetchCardsForStage],
  )

  // Update ref when activeCard changes
  useEffect(() => {
    activeCardIdRef.current = activeCard?._id || null
  }, [activeCard])

  // Sync activeCard with latest card data from columns when columns change
  // This ensures CardModal always has the latest card data when updates happen
  useEffect(() => {
    const activeCardId = activeCardIdRef.current
    if (!activeCardId) return

    // Find the updated card in columns
    const updatedCard = columns
      .flatMap((col) => col.cards)
      .find((c) => c._id === activeCardId)

    if (updatedCard) {
      // Update activeCard to reflect latest changes from columns
      // This will cause CardModal to re-render with updated card prop
      setActiveCard(updatedCard)
    } else {
      // Card was deleted, close the modal
      setActiveCard(null)
      activeCardIdRef.current = null
    }
  }, [columns])

  // Attach scroll listeners to each stage list to trigger infinite scroll
  useEffect(() => {
    const containers = stageScrollRefs.current
    const handlers: Record<string, (e: Event) => void> = {}

    Object.entries(containers).forEach(([stageId, el]) => {
      if (!el) return

      const handler = (e: Event) => {
        const target = e.target as HTMLDivElement
        const { scrollTop, scrollHeight, clientHeight } = target
        const threshold = 280 // trigger a bit earlier for smoother loading
        const isNearBottom = scrollTop + clientHeight >= scrollHeight - threshold

        if (!isNearBottom) return

        const stage = columns.find((c) => c._id === stageId)
        if (stage) {
          loadMoreCardsForStage(stage)
        }
      }

      el.addEventListener("scroll", handler, { passive: true })
      handlers[stageId] = handler
    })

    return () => {
      Object.entries(handlers).forEach(([stageId, handler]) => {
        const el = containers[stageId]
        if (el) {
          el.removeEventListener("scroll", handler)
        }
      })
    }
  }, [columns, loadMoreCardsForStage])

  const avatarColors = [
    "bg-gradient-to-br from-[#000] to-[#000]",
    "bg-gradient-to-br from-purple-500 to-purple-600",
    "bg-gradient-to-br from-emerald-500 to-emerald-600",
    "bg-gradient-to-br from-amber-500 to-amber-600",
    "bg-gradient-to-br from-rose-500 to-rose-600",
    "bg-gradient-to-br from-cyan-500 to-cyan-600",
  ]

  const socialPlatforms = [
    {
      name: "Facebook",
      icon: (
        <svg viewBox="0 0 24 24" fill="white" className="w-8 h-8">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
      color: "bg-[#000]",
      link: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://flowboard-new-garage-app.vercel.app/flowboard/${boardId}`)}`
    },
    {
      name: "Whatsapp",
      icon: (
        <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
      ),
      color: "bg-green-500",
      link: `https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out this flowboard: https://flowboard-new-garage-app.vercel.app/flowboard/${boardId}`)}`
    },
    {
      name: "Telegram",
      icon: (
        <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      ),
      color: "bg-[#000]",
      link: `https://t.me/share/url?url=${encodeURIComponent(`https://flowboard-new-garage-app.vercel.app/flowboard/${boardId}`)}&text=${encodeURIComponent("Check out this flowboard!")}`
    },
    {
      name: "Linkedin",
      icon: (
        <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
      color: "bg-[#000]",
      link: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://flowboard-new-garage-app.vercel.app/flowboard/${boardId}`)}`
    },
  ]

  const handleCopy = () => {
    const textarea = document.createElement('textarea');
    textarea.value = `https://flowboard-new-garage-app.vercel.app/flowboard/${boardId}`;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setCopied(true);
        toast("Copied ")
        setTimeout(() => setCopied(false), 2000);
      } else {
        console.error('Copy command failed');
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }

    document.body.removeChild(textarea);
  };

  if (error === "Unauthorized for this operation") {
    return <UnauthorizedView />
  }

  const renderAssignees = (card: Card, i: number) => {
    if (!card.members || card.members.length === 0) {
      return <span className="text-xs text-gray-400 dark:text-gray-500">Unassigned</span>
    }
    const colorIndex = i % avatarColors.length
    const visible = card.members.slice(0, 3)
    const remaining = card.members.length - visible.length

    return (
      <div className="flex items-center gap-1 flex-wrap">
        {visible.map((m: any) => {
          const label = m?.name || m?.email || "?"
          const initials = label
            .split(" ")
            .map((p: string) => p[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()

          return (
            <div
              key={m._id || m.email}
              className={`w-6 h-6 rounded-full ${avatarColors[colorIndex]} text-white text-[10px] font-semibold flex items-center justify-center`}
              title={label}
            >
              {initials}
            </div>
          )
        })}
        {remaining > 0 && (
          <span className="text-[11px] text-gray-500 dark:text-gray-400">+{remaining}</span>
        )}
      </div>
    )
  }

  const renderPriority = (card: Card) => {
    const firstTag = (card.tagData || [])[0]
    if (!firstTag) return <span className="text-xs text-gray-400">-</span>
    return (
      <span
        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium text-white ${firstTag.color || "bg-gray-400"}`}
      >
        {firstTag.name}
      </span>
    )
  }

  const renderProgress = (card: Card) => {
    const total = card.checklist?.total ?? 0
    const completed = card.checklist?.completed ?? 0
    if (!total) return <span className="text-xs text-gray-400">-</span>
    const pct = Math.round((completed / total) * 100)
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
          <div
            className="h-full bg-indigo-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] text-gray-600 dark:text-gray-400 min-w-[32px] text-right">{pct}%</span>
      </div>
    )
  }

  const formatDate = (value?: string | number) => {
    if (!value) return "-"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "-"
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const handleCreateTask = async (stageId: string) => {
    if (blockIfReadOnly()) return
    const title = newTaskTitle.trim()
    if (!title) return
    if (!userData || !userData.organizationId) return

    try {
      const newCard = await createCard({
        boardId,
        stageId,
        name: title,
        description: "",
        tags: [],
        assignedToIds: [],
      })

      if (newCard) {
        setColumns((prev) =>
          prev.map((col) => {
            if (col._id !== stageId) return col
            return {
              ...col,
              cards: [transformCard(newCard, stageId), ...col.cards],
              localCardCount: (col.localCardCount || 0) + 1,
            }
          }),
        )
        incrementCardCount(boardId)
        setNewTaskTitle("")
        setActiveAddStageId(null)
      }
    } catch (e) {
      console.error("Failed to create task", e)
      toast.error("Failed to create task")
    }
  }
  console.log("column.card", columns)
  return (
    <div className="h-screen bg-white dark:bg-zinc-950 flex flex-col overflow-hidden">
      {/* Header Section */}


      {/* Main list content */}
      <div
        ref={listScrollRef}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 bg-white dark:bg-zinc-950"
      >
        <div className="space-y-6">
          {columns.map((column) => (
            <section
              key={column._id}
              className="bg-gray-50 dark:bg-zinc-900/50 rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden shadow-sm"
            >
              {/* Stage header */}
              <div className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800">
                <button
                  className="flex items-center gap-2 min-w-0 text-left hover:text-[#000]"
                //onClick={() => loadMoreCardsForStage(column)}
                >
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{column.name}</span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {(column.localCardCount ?? column.cards.length) || 0} tasks
                  </span>
                  {/* <span className="ml-1 text-[11px] text-[#000] font-medium">
                    Load more
                  </span> */}
                </button>

                {!isReadOnly && (
                  <button
                    className="text-[11px] text-[#000] dark:text-white font-semibold hover:underline"
                    onClick={() => {
                      if (blockIfReadOnly()) return
                      setActiveAddStageId(column._id)
                      setNewTaskTitle("")
                    }}
                  >
                    + Add task
                  </button>
                )}
              </div>

              {/* Table header + optional add row */}
              <div className="min-w-full overflow-x-auto">
                <div className="min-w-[720px]">
                  {activeAddStageId === column._id && (
                    <div className="px-3 sm:px-4 py-2 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-2 text-xs">
                      <input
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="Enter task title..."
                        className="flex-1 border border-gray-300 dark:border-zinc-700 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#000] dark:focus:ring-white dark:bg-zinc-800 dark:text-white"
                      />
                      <button
                        onClick={() => handleCreateTask(column._id)}
                        className="px-2 py-1 bg-[#000] dark:bg-white text-white dark:text-black rounded text-[11px] font-medium hover:bg-[#000] dark:hover:bg-gray-200"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setActiveAddStageId(null)
                          setNewTaskTitle("")
                        }}
                        className="px-2 py-1 text-[11px] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-12 gap-3 px-3 sm:px-4 py-2 bg-[#e6eaef] dark:bg-zinc-900/50 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <div className="col-span-4 sm:col-span-3">Task</div>
                    <div className="hidden sm:block sm:col-span-3">Description</div>
                    <div className="col-span-3 sm:col-span-2">Assignee</div>
                    <div className="col-span-3 sm:col-span-2">Checklist</div>
                    <div className="hidden md:block md:col-span-2">Label</div>

                  </div>

                  {/* Rows */}
                  {column.cards.length === 0 ? (
                    <div className="px-3 sm:px-4 py-4 text-xs text-gray-400 dark:text-gray-500 flex items-center justify-between">
                      <span>No tasks in this stage yet.</span>
                      {stageLoadingMap[column._id] && (
                        <span className="text-[11px] text-[#000] dark:text-white">Loading…</span>
                      )}
                    </div>
                  ) : (
                    <div
                      ref={(el) => {
                        stageScrollRefs.current[column._id] = el
                      }}
                      className="divide-y divide-gray-100 dark:divide-zinc-800 max-h-80 md:max-h-96 overflow-y-auto"
                    >
                      {column.cards.map((card, i) => {
                        return (
                          <button
                            key={card._id}
                            className="w-full grid grid-cols-12 gap-3 px-3 sm:px-4 py-3 bg-white dark:bg-zinc-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition text-left text-xs"
                            onClick={() => setActiveCard(card)}
                          >

                            {/* Task */}
                            <div className="col-span-4 sm:col-span-3 flex flex-col gap-1 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">

                                <span className="sm:flex sm:col-span-3 text-xs  text-gray-600 dark:text-gray-300"
                                  title={card?.name}
                                >
                                  {card?.name}
                                </span>
                              </div>
                            </div>

                            {/* Description */}
                            <div className="hidden sm:flex sm:col-span-3  text-xs text-gray-600 dark:text-gray-400"
                              title={card?.description}
                            >
                              {card.description || <span className="text-gray-400 dark:text-gray-500">No description</span>}
                            </div>

                            {/* Assignee */}
                            <div className="col-span-3 sm:col-span-2 ">
                              {renderAssignees(card, i)}
                            </div>

                            {/* Due date */}
                            <div className="col-span-3 sm:col-span-2 flex items-center text-xs text-gray-700 dark:text-gray-300 pl-2">
                              {card?.TaskDataCount?.totalCompletedChildCount ?? 0}/
                              {card?.TaskDataCount?.totalChildCount ?? 0}
                            </div>

                            {/* Priority */}
                            <div className="hidden md:flex md:col-span-2 items-center">
                              {(card?.tagData?.length > 0) && (
                                <div className="max-w-full ">
                                  <div className="flex items-center mb-2 gap-2 text-xs font-medium text-muted-foreground">

                                    <div className="flex flex-wrap gap-2">
                                      {card?.tagData.map((l) => (
                                        <div
                                          key={l._id}
                                          className="group relative inline-flex items-center word-break max-w-full "
                                        >
                                          <span
                                            className={`${l.color} text-white px-3 py-1 rounded-lg text-xs font-medium truncate max-w-full`}
                                            title={l.name}
                                          >
                                            {l.name}
                                          </span>

                                          {/* Delete icon appears on hover */}

                                        </div>
                                      ))}

                                      {/* Optional: Add label button (uncomment if needed) */}
                                      {/* <button className="h-8 w-8 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center text-gray-600">
        <Plus className="w-4 h-4" />
      </button> */}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Progress */}

                          </button>
                        )
                      })}

                      {stageLoadingMap[column._id] && (
                        <div className="flex items-center justify-center px-3 sm:px-4 py-2 text-[11px] text-[#000] dark:text-white bg-white/70 dark:bg-zinc-900/70 sticky bottom-0">
                          Loading more tasks…
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          ))}

          {isBoardLoading && (
            <div className="flex items-center justify-center py-6 text-xs text-gray-500">
              Loading more lists...
            </div>
          )}
        </div>
      </div>



      {membersharing && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" />

          {/* Modal */}
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg px-4">
            <div className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-8">
              {/* Link Icon at Top */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                <div className="bg-white dark:bg-zinc-800 rounded-full p-4 shadow-xl">
                  <LinkIcon className="w-8 h-8 text-gray-700 dark:text-gray-200" strokeWidth={2.5} />
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setmembersharing(false)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>

              {/* Share Link Section */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Share you link</h3>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 rounded-xl px-4 py-3 border border-gray-100 dark:border-zinc-700">
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{`https://flowboard-new-garage-app.vercel.app/flowboard/${boardId}`}</span>
                  <button className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg transition-colors" onClick={handleCopy}>
                    <Copy className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Social Share Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Share to</h3>
                <div className="flex justify-between gap-4">
                  {socialPlatforms.map((platform) => (
                    <a
                      href={platform?.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      key={platform.name}
                      className="flex flex-col items-center gap-2 group"
                    >
                      <div
                        className={`${platform.color} rounded-full w-14 h-14 flex items-center justify-center transition-transform group-hover:scale-110 shadow-md`}
                      >
                        {platform.icon}
                      </div>
                      <span className="text-xs text-gray-700 dark:text-gray-400">{platform.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeCard && typeof document !== "undefined" &&
        createPortal(
          <CardModal
            card={activeCard}
            columnId={activeCard.stageId}
            boardId={boardId}
            connected={connected}
            orgId={userData?.organizationId || ""}
            onClose={() => setActiveCard(null)}
            setColumns={setColumns}
            userId={userData?.id}
            isReadOnly={isReadOnly}
            updateTaskAndCardCounts={updateTaskAndCardCounts}
          />,
          document.body,
        )}
    </div>
  )
}

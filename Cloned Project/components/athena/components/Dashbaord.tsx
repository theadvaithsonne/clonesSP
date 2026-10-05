"use client"

import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { useParams } from "next/navigation"
import Cookies from "js-cookie"
import { useUserStore } from '@/store/athena/userStore';
import { ChevronDown } from "lucide-react"
import axios from 'axios'
import { Input } from "@/components/ui/input"
// import SearchList from "./search-list"
import { CardModal } from "./card-modal"
import { useWorkspaceStore } from "@/store/taskroom/workspaceStore";

const TASKROOM_API_URL = process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/";

import {
  DndContext,
  type CollisionDetection,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  LayoutGrid,
  List,
  Table2,
  Clock,
  SlidersHorizontal,
  Share2,
  UserPlus,
  ArrowUpDown,
  MoreHorizontal, Facebook, Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"; // Adjust the import path based on your project setup
import { KanbanColumn } from "./kanban-column"
import { KanbanCard } from "./kanban-card"
import { Plus } from "lucide-react"
import { ShareModal } from "./share-modal"
import { useStageStore } from "@/store/athena/stageStore"
import { useCardStore } from "@/store/athena/cardStore"
import { useBoardStore } from "@/store/athena/boardStore"
import { toast } from "sonner"
import { useMemberStore } from "@/store/athena/memberStore";
import { UnauthorizedView } from "./unauthorized-view";
import { BoardMembersModal } from "./board-members-modal";
import { X, LinkIcon, Copy, ArrowLeft, Moon, Sun, Search, Bell, Settings } from "lucide-react"


import { useTaskStore } from "@/store/athena/taskStore"
import { useThemeStore } from "@/store/athena/themeStore";
import { isRoomObserver, useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";
// import SortDropdown from "./sort-dropdown"

export interface Card {
  _id: string
  name: string
  userId?: string
  isOverDue?: boolean
  isCompleted?: boolean
  description: string
  tags: string[]
  tagData: Array<{ _id: string; name: string; color: string }>
  members: Array<{ _id: string; name: string; email: string }>
  dueDate?: string | number | undefined;
  startDate?: string | number | undefined;
  checklist?: { completed: number; total: number }
  commentCount?: number
  timeEstimate?: number
  comments?: Array<{
    id: string
    user: { name: string; initials: string; bg: string }
    text: string
    createdAt: string
  }>
  stageData?: {

    name: string
    color: string,
    stageType: string
  };
  priority?: string;
  subTaskCount?: string;
  stageId: string
  assignedToIds?: string[]
  TaskDataCount?: {
    totalChildCount?: number
    totalCompletedChildCount?: number
  }
  attachments?: Array<{
    fileLink?: string
    fileName?: string
    fileType?: "document" | "image" | "video"
    comment?: string

    dueDate?: string | number;
  }>
  subtasks?: Card[];
  createdAt?: string;
}
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
export interface Column {
  _id: string
  name: string
  roomId: string
  userId: string
  cards: Card[]
  taskCount?: number
  localCardCount?: number
  stageType: string
  orderId: number
  color: string
}

function findColumnByCardId(columns: Column[], cardId: string): Column | undefined {
  return columns.find((col) => col.cards.some((card) => card._id === cardId))
}

const STAGE_PRESET_COLORS = [
  "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#06b6d4", "#84cc16",
  "#f97316", "#6366f1", "#14b8a6", "#a855f7",
]

export const transformCard = (card: any, stageId: string): Card => ({
  _id: card?._id,
  name: card?.title,

  userId: card?.userId,
  description: card?.description || "",
  tags: card?.tags || [],
  tagData: card?.tagData || [],
  members: card?.assigneeData ? card.assigneeData : [],
  dueDate: card?.dueDate,
  startDate: card?.startDate,
  checklist: card?.checklist ? card.checklist || [] : [],
  isOverDue: card?.isOverDue,
  isCompleted: card?.isCompleted,
  priority: card?.priority,
  comments: [],
  commentCount: card?.commentCount,
  subTaskCount: card?.subTaskCount,
  createdAt: card?.createdAt,
  stageId: stageId,
  assignedToIds: card?.assignedToIds ? card.assignedToIds || [] : [],
  timeEstimate: card?.timeEstimate,
  stageData: {

    name: card?.stageData?.name,
    color: card?.stageData?.color,
    stageType: card?.stageData?.stageType
  },
  TaskDataCount: {
    totalChildCount: card?.TaskDataCount?.totalChildCount ?? 0,
    totalCompletedChildCount: card?.TaskDataCount?.totalCompletedChildCount ?? 0
  },
  subtasks: card?.subtasks?.map((st: any) => transformCard(st, stageId)) || []
});
const transformCardCustom = (card: any, stageId: string): Card => ({
  _id: card?._id,
  name: card?.title,
  userId: card?.userId,
  timeEstimate: card?.timeEstimate,
  description: card?.description || "",
  tags: card?.tags?.map(item => {
    return item?._id
  }) || [],
  tagData: card?.tags || [],
  members: card?.assignedToIds ? card.assignedToIds : [],
  dueDate: card?.dueDate,
  priority: card?.priority,
  startDate: card?.startDate,
  subTaskCount: card?.subTaskCount,
  checklist: card?.checklist ? card.checklist || [] : [],
  isOverDue: card?.isOverDue,
  isCompleted: card?.isCompleted,
  comments: [],
  commentCount: card?.commentCount,
  createdAt: card?.createdAt,

  stageId: stageId,
  assignedToIds: card?.assignedToIds ? card.assignedToIds || [] : [],
  TaskDataCount: {
    totalChildCount: card?.TaskDataCount?.totalChildCount ?? 0,
    totalCompletedChildCount: card?.TaskDataCount?.totalCompletedChildCount ?? 0
  },
  subtasks: card?.subtasks?.map((st: any) => transformCardCustom(st, stageId)) || []
});

const transformStage = (stage: any): Column => ({
  _id: stage._id,
  name: stage.name,
  userId: stage?.userId,
  roomId: stage?.roomId,
  cards: (stage.cardData || []).map((card: any) => transformCard(card, stage._id)),
  taskCount: stage.taskCount || 0,
  localCardCount: stage.taskCount || 0,
  stageType: stage?.stageType,
  orderId: stage?.orderId,
  color: stage?.color
});

export function DahboardMangement() {
  const { currentRoomDetail, memberData: roomMemberData } = useTaskroomWorkspacetore();
  const searchParams = useSearchParams();
  const boardId = searchParams.get("shareTask") ? searchParams.get('roomId') : currentRoomDetail?._id;
  const Idspace = searchParams.get("shareTask") ? searchParams.get('spaceId') : currentRoomDetail?.spaceId;


  const [userData, setUserData] = useState<{ id: string; organizationId: string } | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  const [membersharing, setmembersharing] = useState(false)
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const { stages, createStage, updateStage, deleteStage } = useStageStore()
  const { cards, createCard, updateCard, deleteCard, moveCard } = useCardStore()
  const { fetchBoardDetails, currentBoard, memberData, incrementListCount, decrementListCount, incrementCardCount, error } = useBoardStore()
  const { wsrKLoading } = useTaskroomWorkspacetore()
  const loadMoreStages = useTaskroomWorkspacetore(state => state.loadMoreStages)
  const isLoadingMoreStages = useTaskroomWorkspacetore(state => state.isLoadingMoreStages)
  const boardLoadId = useTaskroomWorkspacetore(state => state.boardLoadId)
  // const { tags: boardTags } = useTagStore() // Unused here now
  const fetchMembers = useMemberStore((state) => state.fetchMembers);
  const members = useMemberStore((state) => state.members);
  const columns = useTaskroomWorkspacetore(state => state.columns) as Column[]
  const setColumns = useTaskroomWorkspacetore(state => state.setColumns)
  const isFetchingColumns = useTaskroomWorkspacetore(state => state.isFetchingColumns)
  const setIsFetchingColumns = useTaskroomWorkspacetore(state => state.setIsFetchingColumns)
  const [showExpiredDialog, setShowExpiredDialog] = useState(false)
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [sharedCard, setSharedCard] = useState<Card | null>(null)
  const [sortOrder, setSortOrder] = useState<"old-to-new" | "new-to-old">("new-to-old")
  const [query, setQuery] = useState("")
  const originalColumnsRef = useRef<Column[]>([]) // Store original state before drag
  const [activeTab, setActiveTab] = useState("Board")
  const { updateTask, deleteTask, tasks, socketAddTask } = useTaskStore()
  // Ref for intersection observer / scroll detection
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Ref to preserve scroll position during column updates
  const scrollPositionRef = useRef<number>(0);
  const isRestoringScrollRef = useRef<boolean>(false);
  const isInitialLoadRef = useRef<boolean>(true);
  const previousColumnsLengthRef = useRef<number>(0);

  const userProfile = useUserStore((state) => state.userProfile);
  const { removeMembersForCards, removeAssignedMember, assignCardMemberlist, addAssignedMember, setAssignedMembers, } = useMemberStore()



  const pathname = usePathname()
  const shareTaskId = searchParams.get("shareTask");
  // const openedCard = useMemo(() => {
  //   const cardId = searchParams?.get("cardId")
  //   if (!cardId) return null
  //   for (const col of columns) {
  //     const found = col.cards.find(c => c._id === cardId)
  //     if (found) return found
  //   }
  //   return null
  // }, [searchParams, columns])

  const { theme, toggleTheme } = useThemeStore();

  // Drag and Drop Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )
  const isUserProfileFetched = useUserStore((state) => state.isUserProfileFetched);
  const isReadOnly = isRoomObserver(currentRoomDetail, roomMemberData ?? memberData)
  const blockIfReadOnly = useCallback(() => {
    if (!isReadOnly) return false
    toast.error("Observers can only view this board")
    return true
  }, [isReadOnly])

  // useEffect(() => {
  //   if (boardId) {
  //     fetchMembers(boardId);
  //   }
  // }, [boardId, fetchMembers]);

  // Authorization Check
  const isLoadingMembers = useMemberStore((state) => state.isLoading);





  // Fetch Board Metadata (name, etc.)
  // useEffect(() => {
  //   if (boardId) {
  //     setIsFetchingBoard(true);
  //     fetchBoardById(boardId).finally(() => {
  //       setIsFetchingBoard(false);
  //     });
  //   }
  // }, [boardId, fetchBoardById]);

  useEffect(() => {


    // alert("taskApi call")
    if (shareTaskId) {
      const fetchSharedTask = async () => {
        try {
          const token = localStorage.getItem("garage_tok");
          const response = await axios.get(
            `${TASKROOM_API_URL}tasks/${shareTaskId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );


          if (response.data.status && response.data.data) {

            const transformed = transformCard(response.data.data, response.data.data.stageId);
            setSharedCard(transformed);
          }
        } catch (error) {
          console.error("Error fetching shared task:", error);
        }
      };
      fetchSharedTask();
    } else {
      setSharedCard(null);
    }
  }, []);



  // Initial Fetch - Replaces fetchStages and fetchCards
  // useEffect(() => {
  //   const sortOrderdeatil = sortOrder == "old-to-new" ? "asc" : "desc"
  //   console.log("nbvcjkvxcjhkvcxjkhvcxvcxjk2222", boardId, isUserProfileFetched, wsrKLoading)
  //   if (boardId && isUserProfileFetched && !wsrKLoading) {

  //     setIsFetchingColumns(true);
  //     // Fetch page 1
  //     fetchBoardDetails(boardId, 1, 10, sortOrderdeatil).then((data: any) => {
  //       if (data && Array.isArray(data)) {
  //         setColumns(data.map(transformStage));
  //       }
  //     }).finally(() => {
  //       setIsFetchingColumns(false);
  //     });
  //     // fetchTags(boardId); // Removed as tags come with board details now
  //   }
  // }, [boardId, fetchBoardDetails, isUserProfileFetched, wsrKLoading]);


  // Socket Listeners for Real-time Card Updates (Comment Counts)










  const updateTaskAndCardCounts = (newChildCount: number, newCompletedChildCount: number, taskId: string, cardId: string) => {
    // Update task in store
    // updateTask(task._id, {
    //   childCount: newChildCount,
    //   completedChildCount: newCompletedChildCount
    // } as any)

    // Calculate total counts for the card (sum of all tasks)

    const allTasksForCard = tasks.filter(t => t.cardId === cardId)
    const totalChildCount = allTasksForCard.reduce((sum, t) => {
      // Use updated count for current task, existing count for others
      if (t._id === taskId) {
        return sum + newChildCount
      }
      return sum + (t.childCount || 0)
    }, 0)

    const totalCompletedChildCount = allTasksForCard.reduce((sum, t) => {
      // Use updated count for current task, existing count for others
      if (t._id === taskId) {
        return sum + newCompletedChildCount
      }
      return sum + (t.completedChildCount || 0)
    }, 0)
    // Update kanban-board card TaskDataCount
    setColumns(prev => prev.map(col => ({
      ...col,
      cards: col.cards.map(c =>
        c._id === cardId
          ? {
            ...c,
            TaskDataCount: {
              totalChildCount,
              totalCompletedChildCount
            }
          }
          : c
      )
    })))
  }

  // Infinite Scroll for Stages (Horizontal)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Always save scroll position (user might scroll during restoration)
      // The restoration flag only prevents restoration, not saving
      scrollPositionRef.current = container.scrollLeft;

      // Near the right end (400px buffer): the store pages the current room's
      // stages and ignores calls while a page is loading or none are left.
      const { scrollLeft, scrollWidth, clientWidth } = container;
      if (scrollWidth - (scrollLeft + clientWidth) < 400) {
        void loadMoreStages();
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [loadMoreStages]);
  // Restore scroll position after columns update
  // Using useLayoutEffect to restore scroll before browser paint
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Skip restoration on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      previousColumnsLengthRef.current = columns.length;
      return;
    }

    // Only restore if columns were added (not removed) and we have a saved position
    const columnsAdded = columns.length > previousColumnsLengthRef.current;
    previousColumnsLengthRef.current = columns.length;

    if (columnsAdded && scrollPositionRef.current > 0 && !isRestoringScrollRef.current) {
      isRestoringScrollRef.current = true;

      // Use double RAF to ensure DOM has fully updated with new columns
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (container) {
            // Ensure we don't scroll beyond the maximum scroll width
            const maxScroll = container.scrollWidth - container.clientWidth;
            const targetScroll = Math.min(scrollPositionRef.current, maxScroll);
            container.scrollLeft = targetScroll;

            // Update the ref to the actual scroll position (in case it was clamped)
            scrollPositionRef.current = container.scrollLeft;

            // Reset flag after browser has processed the scroll
            setTimeout(() => {
              isRestoringScrollRef.current = false;
            }, 50);
          }
        });
      });
    }
  }, [columns]);

  // Drag-to-Scroll Logic (works alongside horizontal scrollbar)
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const onMouseDown = (e: React.MouseEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Don't activate drag-to-scroll if a card is currently being dragged
    if (activeCard) {
      return;
    }

    // Don't activate drag-to-scroll if clicking on:
    // - Interactive elements (buttons, inputs, etc.)
    // - Cards or columns (let dnd-kit handle those)
    // - Scrollbar area
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button, input, textarea, a, [role="button"], [draggable="true"]');
    const isCardOrColumn = target.closest('[data-sortable-id], [data-droppable-id], [data-rbd-draggable-id]');

    // Check if clicking on scrollbar (rough check - scrollbar is usually at the bottom)
    const rect = container.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const isScrollbarArea = clickY > rect.height - 20; // Approximate scrollbar height area

    if (isInteractive || isCardOrColumn || isScrollbarArea) {
      return; // Let normal interactions handle it
    }

    setIsDraggingBoard(true);
    setStartX(e.pageX - container.offsetLeft);
    setScrollLeft(container.scrollLeft);
    e.preventDefault(); // Prevent text selection
  };

  const onMouseLeave = () => {
    setIsDraggingBoard(false);
  };

  const onMouseUp = () => {
    setIsDraggingBoard(false);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingBoard) return;
    e.preventDefault();
    const container = scrollContainerRef.current;
    if (!container) return;

    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed multiplier
    container.scrollLeft = scrollLeft - walk;
  };

  // REMOVED: Mapping useEffect
  // State is now managed by fetchBoardDetails responses and local updates

  const [isAddingGroupInline, setIsAddingGroupInline] = useState(false)
  const [newGroupInlineName, setNewGroupInlineName] = useState("")
  const [newGroupInlineColor, setNewGroupInlineColor] = useState("#8b5cf6")
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);

  // Drag and Drop Handlers
  const lastOverIdRef = useRef<UniqueIdentifier | null>(null)
  const movedToNewColumnRef = useRef(false)
  // The shift API renumbers whole stages, so two overlapping moves overwrite
  // each other's order; dragging stays off until the current move is saved
  const [isMovingCard, setIsMovingCard] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => {
      movedToNewColumnRef.current = false
    })
  }, [columns])

  // closestCorners lets a tall column win over the card under the pointer, which
  // bounces the card between stages (and to the bottom of its own stage). Resolve
  // against the pointer first, and when it is over a column, use its nearest card.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args)
    const collisions = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args)
    let overId = getFirstCollision(collisions, "id")

    if (overId != null) {
      const currentColumns = useTaskroomWorkspacetore.getState().columns as Column[]
      const overColumn = currentColumns.find((col) => col._id === overId)
      if (overColumn && overColumn.cards.length > 0) {
        const cardIds = new Set(overColumn.cards.map((card) => card._id))
        overId = closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((container) => cardIds.has(String(container.id))),
        })[0]?.id ?? overId
      }
      lastOverIdRef.current = overId
      return [{ id: overId }]
    }

    // Moving a card into another column shifts the layout for a frame and can
    // leave nothing under the pointer; stay on the moved card, not a stale target
    if (movedToNewColumnRef.current) {
      lastOverIdRef.current = args.active.id
    }
    return lastOverIdRef.current != null ? [{ id: lastOverIdRef.current }] : []
  }, [])

  const handleDragStart = (event: DragStartEvent) => {
    if (isReadOnly) return
    const { active } = event
    // Stop any board dragging when card/column drag starts
    setIsDraggingBoard(false)
    lastOverIdRef.current = null

    // Store original columns state before any drag operations
    originalColumnsRef.current = JSON.parse(JSON.stringify(columns))

    const card = columns.flatMap((col) => col.cards).find((card) => card._id === active.id)
    if (card) {
      setActiveCard(card)
    }
  }
  

  // Only moves the card across columns while dragging. Reordering inside a column
  // is previewed by SortableContext and committed in handleDragEnd.
  const handleDragOver = (event: DragOverEvent) => {
    if (isReadOnly) return

    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    const currentColumns = useTaskroomWorkspacetore.getState().columns as Column[]
    const activeColumn = findColumnByCardId(currentColumns, activeId)
    const overColumn = currentColumns.find((col) => col._id === overId) ?? findColumnByCardId(currentColumns, overId)
    if (!activeColumn || !overColumn || activeColumn._id === overColumn._id) return

    const draggedCard = activeColumn.cards.find((card) => card._id === activeId)
    if (!draggedCard) return

    let insertAt = overColumn.cards.length
    const overIndex = overColumn.cards.findIndex((card) => card._id === overId)
    if (overIndex !== -1) {
      const translated = active.rect.current.translated
      const isBelowOverCard = !!translated &&
        translated.top + translated.height / 2 > over.rect.top + over.rect.height / 2
      insertAt = overIndex + (isBelowOverCard ? 1 : 0)
    }

    movedToNewColumnRef.current = true
    const movedCard = { ...draggedCard, stageId: overColumn._id }
    setColumns(currentColumns.map((col) => {
      if (col._id === activeColumn._id) {
        return { ...col, cards: col.cards.filter((card) => card._id !== activeId) }
      }
      if (col._id === overColumn._id) {
        const cards = [...col.cards]
        cards.splice(insertAt, 0, movedCard)
        return { ...col, cards }
      }
      return col
    }))
  }
  const handleDragCancel = (_event: DragCancelEvent) => {
    setActiveCard(null)
    setColumns(originalColumnsRef.current)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCard(null)
    if (isReadOnly) return

    const { active, over } = event
    const originalCols = originalColumnsRef.current
    if (!over) {
      setColumns(originalCols)
      return
    }

    const activeId = String(active.id)
    const overId = String(over.id)
    let currentColumns = useTaskroomWorkspacetore.getState().columns as Column[]

    // Commit the reorder inside the column the card was dropped in
    const dropColumn = findColumnByCardId(currentColumns, activeId)
    if (!dropColumn) {
      setColumns(originalCols)
      return
    }
    const activeIndex = dropColumn.cards.findIndex((card) => card._id === activeId)
    const overIndex = dropColumn.cards.findIndex((card) => card._id === overId)
    if (overIndex !== -1 && overIndex !== activeIndex) {
      currentColumns = currentColumns.map((col) =>
        col._id === dropColumn._id ? { ...col, cards: arrayMove(col.cards, activeIndex, overIndex) } : col
      )
    }

    const originalColumn = findColumnByCardId(originalCols, activeId)
    const finalColumn = findColumnByCardId(currentColumns, activeId)
    if (!originalColumn || !finalColumn) {
      setColumns(originalCols)
      return
    }

    const originalIndex = originalColumn.cards.findIndex((card) => card._id === activeId)
    const newIndex = finalColumn.cards.findIndex((card) => card._id === activeId)
    const stageChanged = originalColumn._id !== finalColumn._id
    if (!stageChanged && originalIndex === newIndex) return

    // The server places the card next to a neighbour: above the card now below
    // it, or below the card above it when it was dropped last
    const nextCard = finalColumn.cards[newIndex + 1]
    const previousCard = finalColumn.cards[newIndex - 1]
    const toTaskId = nextCard?._id ?? previousCard?._id
    const toBottom = !nextCard && !!previousCard

    setColumns(stageChanged
      ? currentColumns.map((col) => {
        if (col._id === originalColumn._id) {
          return { ...col, localCardCount: Math.max((col.localCardCount || 0) - 1, 0) }
        }
        if (col._id === finalColumn._id) {
          return { ...col, localCardCount: (col.localCardCount || 0) + 1 }
        }
        return col
      })
      : currentColumns)

    setIsMovingCard(true)
    try {
      const result = await moveCard(activeId, {
        toStageId: finalColumn._id,
        toTaskId,
        toBottom,
      })
      // moveCard toasts and returns null on failure instead of throwing
      if (!result) setColumns(originalCols)
    } finally {
      setIsMovingCard(false)
    }
  }

  const addColumn = useCallback(async (name: string, color: string) => {
    if (!name.trim() || isCreatingColumn) return;

    setIsCreatingColumn(true);

    const newStage = await createStage({
      name: name.trim(),
      color,
      stageType: "active",
      orderId: 0,
      roomId: boardId,
    });

    if (newStage) {
      setColumns(prev => [...prev, transformStage(newStage)]);
      setNewGroupInlineName("");
      setNewGroupInlineColor("#8b5cf6");
      setIsAddingGroupInline(false);
      incrementListCount(boardId);
    }

    setIsCreatingColumn(false);
  }, [boardId, createStage, isCreatingColumn, incrementListCount, setColumns]);

  const handleUpdateColumn = useCallback(async (columnId: string, updates: { name?: string, color?: string }) => {

    await updateStage(columnId, { ...updates })
    await setColumns(prev => prev.map(col =>
      col._id === columnId ? { ...col, ...updates } : col
    ));
  }, [updateStage, blockIfReadOnly])

  const handleDeleteColumn = useCallback(async (columnId: string) => {


    await deleteStage(columnId)


    await setColumns((prev) => prev.filter((col) => col._id !== columnId));
    decrementListCount(boardId)
  }, [])

  const addCard = useCallback(async (columnId: string, cardData: {
    title: string;
    assignedToIds: string[];
    startDate: number | null;
    dueDate: number | null;
    priority: string;
    tags: string[];
    description: string;
  }) => {

    // createCard now returns the new card (any)
    const newCard = await createCard({
      stageId: columnId,
      title: cardData.title,
      roomId: boardId,
      startDate: cardData.startDate,
      dueDate: cardData.dueDate,
      description: cardData.description || "",
      priority: cardData.priority ? cardData.priority : "normal",
      tags: cardData.tags || [],
      assignedToIds: cardData.assignedToIds,
    })
    if (newCard) {
      setColumns(prev => prev.map(col => {
        if (col._id === columnId) {
          return {
            ...col,
            // Newest first, matching the server's createdAt-desc order
            cards: [transformCardCustom(newCard, columnId), ...col.cards],
            localCardCount: (col.localCardCount || 0) + 1
          }
        }
        return col;
      }));
      incrementCardCount(boardId);
    }
  }, [boardId, createCard, userData, blockIfReadOnly, incrementCardCount])



  if (error === "Unauthorized for this operation") {
    return <UnauthorizedView />;
  }

  const tabs = [
    { name: "Board", icon: LayoutGrid },
    { name: "List", icon: List }
  ]

  const teamMembers = [
    { id: 1, name: "John Doe", avatar: "/placeholder.svg" },
    { id: 2, name: "Jane Smith", avatar: "/placeholder.svg" },
    { id: 3, name: "Mike Johnson", avatar: "/placeholder.svg" },
    { id: 4, name: "Sarah Williams", avatar: "/placeholder.svg" },
    { id: 5, name: "Emily Davis", avatar: "" },
    { id: 6, name: "Alex Brown", avatar: "" },
  ]
  // const avatarColors = [
  //   "#b91c1c", // red-700 (deep red)
  //   "#c2410c", // orange-700
  //   "#b45309", // amber-700
  //   "#4d7c0f", // lime-700
  //   "#15803d", // green-700
  //   "#0d9488", // teal-700
  //   "#0891b2", // cyan-700
  //   "#2563eb", // blue-700
  //   "#4f46e5", // indigo-700
  //   "#000", // violet-700
  //   "#9333ea", // purple-700
  //   "#a21caf", // pink-700
  // ];
  const getAvatarColor = (userId: string | undefined) => {
    if (!userId) return "bg-gray-400"; // fallback

    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % avatarColors.length;
    return `bg-[${avatarColors[index]}]`;
  };
  const handleCopy = () => {
    // Create a temporary textarea element
    const textarea = document.createElement('textarea');
    textarea.value = `https://flowboard-new-garage-app.vercel.app/flowboard/${boardId}`;
    textarea.style.position = 'fixed';     // Avoid scrolling to bottom
    textarea.style.opacity = '0';          // Hide it visually
    document.body.appendChild(textarea);

    // Select and copy the text
    textarea.focus();
    textarea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setCopied(true);
        toast("Copied ")
        setTimeout(() => setCopied(false), 2000); // Reset message after 2s
      } else {
        console.error('Copy command failed');
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }

    // Clean up
    document.body.removeChild(textarea);
  };
  const socialPlatforms = [
    {
      name: "Facebook",
      icon: (
        <svg viewBox="0 0 24 24" fill="white" className="w-8 h-8">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ), // White 'f' on transparent
      color: "bg-blue-600",
      link: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://flowboard-new-garage-app.vercel.app/flowboard/${boardId}`)}`
    },
    // {
    //   name: "X",
    //   icon: (
    //     <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
    //       <path d="M18.244 2.25h3.308L7.084 4.126H5.117z" />
    //     </svg>
    //   ),
    //   color: "bg-black",
    //   link: `https://x.com/intent/post?url=${encodeURIComponent(`https://flowboard-new-garage-app.vercel.app/flowboard/${boardId}`)}&text=${encodeURIComponent("Check out this flowboard!")}`
    // },
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
      color: "bg-blue-500",
      link: `https://t.me/share/url?url=${encodeURIComponent(`https://flowboard-new-garage-app.vercel.app/flowboard/${boardId}`)}&text=${encodeURIComponent("Check out this flowboard!")}`
    },
    {
      name: "Linkedin",
      icon: (
        <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
      color: "bg-blue-700",
      link: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://flowboard-new-garage-app.vercel.app/flowboard/${boardId}`)}`
    },
  ]
  const onChangeSort = (e) => {
    setSortOrder(e)

    const sortOrderdeatil = e == "old-to-new" ? "asc" : "desc"
    if (boardId && isUserProfileFetched && !wsrKLoading) {
      setIsFetchingColumns(true);
      // Fetch page 1
      fetchBoardDetails(boardId, 1, 10, sortOrderdeatil).then((data: any) => {
        if (data && Array.isArray(data)) {
          setColumns(data.map(transformStage));

          // Initialize metadata for each stage from the API response
          // Assuming each stage might have metadata about its cards
          // data.forEach((stage: any) => {
          //   if (stage.cardMetadata) {
          //     useCardStore.getState().setStageMetadata(stage._id, {
          //       currentPage: stage.cardMetadata.currentPage || 1,
          //       totalPages: stage.cardMetadata.totalPages || 1,
          //       isLoading: false
          //     });
          //   } else {

          //     // Default metadata if not provided
          //     useCardStore.getState().setStageMetadata(stage._id, {
          //       currentPage: 1,
          //       totalPages: 1,
          //       isLoading: false
          //     });
          //   }
          // });
        }
      }).finally(() => {
        setIsFetchingColumns(false);
      });
      // fetchTags(boardId); // Removed as tags come with board details now
    }


  }

  const avatarColors = [
    "bg-gradient-to-br from-gray-800 to-gray-900",
    "bg-gradient-to-br from-gray-900 to-black",
    "bg-gradient-to-br from-zinc-800 to-zinc-950",
    "bg-gradient-to-br from-neutral-800 to-neutral-900",
    "bg-gradient-to-br from-slate-700 to-slate-900",
    "bg-gradient-to-br from-gray-900 to-gray-950",
  ]

  const sortedStatuses = [...columns]?.sort((a, b) => {
    const order = { tostart: 0, active: 1, done: 2, closed: 3 };
    return order[a?.stageType] - order[b?.stageType];
  });
  return (
    <DndContext
      sensors={isReadOnly || isMovingCard ? [] : sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="h-full min-h-0 bg-[#0a0a0d] dark:bg-background flex flex-col overflow-hidden">
        <div className="w-full bg-[#0a0a0d] dark:bg-background">




        </div>

        {/* {
          activeTab == "List" &&
          <KanbanBoardListView
            columns={columns}
            setColumns={setColumns}
            connected={"connected"}
            sortOrder={sortOrder}
          />
        } */}

        {
          activeTab == "Board" &&
          <div className="flex-1 flex overflow-hidden h-full relative min-h-0 pb-[5px]">
            <div
              className={`flex-1 overflow-x-auto px-6 py-6 pt-2 bg-[#0a0a0d]  dark:bg-background kanban-horizontal-scroll pr-0 ${isDraggingBoard ? 'cursor-grabbing' : 'cursor-default'}`}
              ref={scrollContainerRef}
              onMouseDown={onMouseDown}
              onMouseLeave={onMouseLeave}
              onMouseUp={onMouseUp}
              onMouseMove={onMouseMove}
            >
              <div className="flex gap-6 min-w-min h-full items-start">
                {!wsrKLoading && (
                  <>

                    {sortedStatuses.map((column) => (
                      <KanbanColumn
                        // A fresh page-1 load remounts columns so their "load more" page resets
                        key={`${column._id}:${boardLoadId}`}
                        column={column}
                        onAddCard={addCard}
                        onUpdate={handleUpdateColumn}
                        onDelete={handleDeleteColumn}
                        boardId={boardId}
                        orgId={userData?.organizationId || ""}
                        setColumns={setColumns}
                        userId={userData?.id}
                        Idspace={Idspace}
                        isReadOnly={isReadOnly}
                        connected={false}
                        updateTaskAndCardCounts={updateTaskAndCardCounts}
                      />
                    ))}

                    {!isFetchingColumns && (
                      <div className="min-w-72 rounded-lg p-3 shadow-sm flex-shrink-0 self-start relative">
                        {!isAddingGroupInline ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (blockIfReadOnly()) return;
                              setIsAddingGroupInline(true);
                              setNewGroupInlineName("");
                            }}
                            className="inline-flex items-center cursor-pointer gap-2 text-sm text-white hover:text-white"
                            disabled={isReadOnly}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>New group</span>
                          </button>
                        ) : (
                          <div
                            className="w-64 rounded-xl shadow-2xl border overflow-hidden"
                            style={{
                              backgroundColor: "rgba(18, 18, 26, 0.97)",
                              borderColor: newGroupInlineColor,
                              backdropFilter: "blur(20px)",
                            }}
                          >
                            <div
                              className="px-2 py-3 pb-0 flex items-center justify-between"
                              style={{ borderColor: newGroupInlineColor }}
                            >
                              <span className="text-sm font-semibold text-white/90 tracking-wide">Add Group</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAddingGroupInline(false);
                                  setNewGroupInlineName("");
                                  setNewGroupInlineColor("#8b5cf6");
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors text-base leading-none cursor-pointer"
                              >
                                ×
                              </button>
                            </div>

                            <div className="p-3 pt-0 space-y-3">
                              <div className="space-y-1.5">
                                <label className="text-[10px] mb-1 font-semibold text-white/40 uppercase tracking-widest">
                                  Group Name
                                </label>
                                <input
                                  type="text"
                                  value={newGroupInlineName}
                                  onChange={(e) => setNewGroupInlineName(e.target.value)}
                                  autoFocus
                                  placeholder="Enter group name..."
                                  className="w-full px-3 py-2 rounded-lg placeholder:text-xs text-xs text-white bg-white/5 border border-white/10 focus:outline-none focus:border-white/30 transition-all placeholder:text-white/20"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") addColumn(newGroupInlineName, newGroupInlineColor);
                                    if (e.key === "Escape") {
                                      setIsAddingGroupInline(false);
                                      setNewGroupInlineName("");
                                      setNewGroupInlineColor("#8b5cf6");
                                    }
                                  }}
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                                  Group Color
                                </label>
                                <div className="grid grid-cols-12 gap-1.5">
                                  {STAGE_PRESET_COLORS.map((color) => (
                                    <button
                                      key={color}
                                      type="button"
                                      onClick={() => setNewGroupInlineColor(color)}
                                      className="w-4 h-4 rounded-lg transition-all duration-150 hover:scale-110 active:scale-95 flex items-center justify-center"
                                      style={{
                                        backgroundColor: color,
                                        boxShadow: newGroupInlineColor === color
                                          ? `0 0 0 2px #12121a, 0 0 0 3.5px ${color}`
                                          : "none",
                                      }}
                                      title={color}
                                    >
                                      {newGroupInlineColor === color && (
                                        <svg className="w-3.5 h-3.5 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      )}
                                    </button>
                                  ))}
                                </div>

                                <div
                                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border cursor-pointer hover:border-white/20 transition-colors"
                                  style={{ borderColor: newGroupInlineColor, backgroundColor: "rgba(255,255,255,0.03)" }}
                                  onClick={() => document.getElementById("kanban-add-group-color-picker")?.click()}
                                >
                                  <div
                                    className="w-6 h-6 rounded-md flex-shrink-0 border border-white/20"
                                    style={{ backgroundColor: newGroupInlineColor }}
                                  />
                                  <span className="text-xs text-white/50 flex-1">Custom color</span>
                                  <span className="text-[11px] font-mono text-white/30">{newGroupInlineColor.toUpperCase()}</span>
                                  <input
                                    id="kanban-add-group-color-picker"
                                    type="color"
                                    value={newGroupInlineColor}
                                    onChange={(e) => setNewGroupInlineColor(e.target.value)}
                                    className="sr-only"
                                  />
                                </div>
                              </div>
                            </div>

                            <div
                              className="px-4 py-3 flex items-center justify-end gap-2 border-t"
                              style={{ borderColor: newGroupInlineColor }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAddingGroupInline(false);
                                  setNewGroupInlineName("");
                                  setNewGroupInlineColor("#8b5cf6");
                                }}
                                className="px-3 cursor-pointer py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors border border-[#e5e7eb0f]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => addColumn(newGroupInlineName, newGroupInlineColor)}
                                disabled={!newGroupInlineName.trim() || isCreatingColumn}
                                className="px-4 cursor-pointer py-1.5 rounded-lg text-xs font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                                style={{ backgroundColor: newGroupInlineColor }}
                              >
                                {isCreatingColumn ? "Creating..." : "Add list"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>

                )}
                {/* Spacer */}
                <div className="w-1" />

                {/* Initial & Infinite Loading Indicators */}
                {isLoadingMoreStages && (
                  <div className="min-w-72 flex items-center justify-center self-center">
                    <Loader2 className="h-5 w-5 animate-spin text-white/40" />
                  </div>
                )}

              </div>
            </div>













          </div>
        }

        {isShareModalOpen && userData && (
          <ShareModal
            onClose={() => setIsShareModalOpen(false)}
            boardId={boardId}
            orgId={userData.organizationId}
            userId={userData.id}
            role={memberData?.role}
            currentBoard={currentBoard}
          />
        )}


        {sharedCard && searchParams.get("shareTask") && (
          <CardModal
            connected={true}
            updateTaskAndCardCounts={updateTaskAndCardCounts}
            card={sharedCard}
            userId={userData?.id}
            onClose={() => {
              setSharedCard(null)
              const params = new URLSearchParams(searchParams.toString())
              params.delete("shareTask")
              params.delete("workspaceId")
              params.delete("roomId")
              params.delete("spaceId")
              router.push(`${pathname}`)
            }}
            boardId={boardId || ""}
            orgId={userData?.organizationId || ""}
            setColumns={setColumns}
            isReadOnly={isReadOnly}
          />
        )}


        {/* {openedCard && (
          <CardModal
            connected={"connected"}
            updateTaskAndCardCounts={updateTaskAndCardCounts}
            card={openedCard}
            userId={userData?.id}
            onClose={() => {
              const params = new URLSearchParams(searchParams.toString())
              params.delete("cardId")
              router.push(`${pathname}?${params.toString()}`)
            }}
            boardId={boardId || ""}
            orgId={userData?.organizationId || ""}
            setColumns={setColumns}
            isReadOnly={isReadOnly}
          />
        )} */}
        {isMembersModalOpen && (
          <BoardMembersModal
            onClose={() => setIsMembersModalOpen(false)}
            boardId={boardId}
            userId={userData?.id}
          />
        )}
      </div>
      {
        membersharing &&
        <>

          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"



          />

          {/* Modal */}
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg px-4">
            <div className="relative bg-[#0a0a0d] dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
              {/* Link Icon at Top */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                <div className="bg-[#0a0a0d] dark:bg-gray-800  rounded-full p-4 shadow-xl">
                  <LinkIcon className="w-8 h-8 text-white/50 dark:text-white/50" strokeWidth={2.5} />
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setmembersharing(false)}
                //onClick={onClose}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-white/50 dark:text-white/50" />
              </button>

              {/* Header */}


              {/* Share Link Section */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white/50 mb-3 dark:text-white/50">Share you link</h3>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 border border-gray-100">
                  <span className="flex-1 text-sm text-white/50 truncate dark:text-white/50">{`https://flowboard-new-garage-app.vercel.app/flowboard/${boardId}`}</span>
                  <button className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors" onClick={handleCopy}>
                    <Copy className="w-5 h-5 text-white/50 dark:text-white/50" />
                  </button>
                </div>
              </div>

              {/* Social Share Section */}
              <div>
                <h3 className="text-sm font-semibold text-white/50 mb-4 dark:text-white/50">Share to</h3>
                <div className="flex justify-between gap-4">
                  {socialPlatforms.map((platform) => (
                    <a href={platform?.link}
                      target="_blank"
                      rel="noopener noreferrer" key={platform.name} className="flex flex-col items-center gap-2 group">

                      <div
                        className={`${platform.color} rounded-full w-14 h-14 flex items-center justify-center transition-transform group-hover:scale-110 shadow-md`}
                      >
                        {platform.icon}
                      </div>

                      <a className="text-xs text-white/50 dark:text-white/50"

                      >{platform.name}</a>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      }


      {createPortal(
        <DragOverlay>
          {activeCard && (
            <KanbanCard
              card={activeCard}
              columnId={activeCard.stageId}
              isOverlay
              Idspace={Idspace}
              boardId={boardId}
              orgId={userData?.organizationId || ""}
              setColumns={setColumns}
              userId={userData?.id}
              columnColor={columns?.find((col) => col?._id === activeCard?.stageId)?.color}
              isReadOnly={isReadOnly}
              connected={false}
              updateTaskAndCardCounts={updateTaskAndCardCounts}
            />
          )}
        </DragOverlay>,
        document.body
      )}
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
    </DndContext>
  )
}


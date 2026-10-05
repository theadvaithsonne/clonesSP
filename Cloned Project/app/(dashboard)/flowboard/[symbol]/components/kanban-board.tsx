"use client"

import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { useParams } from "next/navigation"
import Cookies from "js-cookie"
import { useUserStore } from '@/store/flowboard/userStore';
import { ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import SearchList from "./search-list"
import { CardModal } from "./card-modal"
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core"
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
  MoreHorizontal, Facebook,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"; // Adjust the import path based on your project setup
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable"
import { KanbanColumn } from "./kanban-column"
import { KanbanCard } from "./kanban-card"
import { Plus } from "lucide-react"
import { ShareModal } from "./share-modal"
import { useStageStore } from "@/store/flowboard/stageStore"
import { useCardStore } from "@/store/flowboard/cardStore"
import { useBoardStore } from "@/store/flowboard/boardStore"
import { toast } from "sonner"
import { useMemberStore } from "@/store/flowboard/memberStore";
import { UnauthorizedView } from "./unauthorized-view";
import { BoardMembersModal } from "./board-members-modal";
import { X, LinkIcon, Copy, ArrowLeft, Moon, Sun, Search, Bell, Settings } from "lucide-react"
import { KanbanBoardListView } from "./kanban-board-list-view"
import { boardSocketService } from "../../lib/board-socket-service";
import { notificationSocketService } from "../../lib/notification-socket-service";
import { useTaskStore } from "@/store/flowboard/taskStore"
import { useThemeStore } from "@/store/flowboard/themeStore";
import { jwtDecode } from 'jwt-decode'
// import SortDropdown from "./sort-dropdown"
interface JwtPayload {
  // Adjust these fields according to YOUR actual JWT payload
  sub?: string        // user id
  name?: string
  email?: string
  role?: string
  exp?: number
  orgId?: string
  iat?: number
  userId?: string
  // ... add any custom claims like garageId, permissions, etc.
  [key: string]: any
}
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
  comments?: Array<{
    id: string
    user: { name: string; initials: string; bg: string }
    text: string
    createdAt: string
  }>
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
  cards: Card[]
  cardCount?: number
  localCardCount?: number
}

const transformCard = (card: any, stageId: string): Card => ({
  _id: card._id,
  name: card.name,
  userId: card.userId,
  description: card.description || "",
  tags: card.tags || [],
  tagData: card.tagData || [],
  members: card.assigneeData ? (card.assigneeData || []) : [],
  dueDate: card.dueDate,
  startDate: card.startDate,
  checklist: card.checklist ? card.checklist || [] : [],
  isOverDue: card?.isOverDue,
  isCompleted: card?.isCompleted,
  comments: [],
  commentCount: card?.commentCount,
  stageId: stageId,
  assignedToIds: card.assignedToIds ? card.assignedToIds || [] : [],
  TaskDataCount: {
    totalChildCount: card?.TaskDataCount?.totalChildCount ?? 0,
    totalCompletedChildCount: card?.TaskDataCount?.totalCompletedChildCount ?? 0
  }
});

const transformStage = (stage: any): Column => ({
  _id: stage._id,
  name: stage.name,
  cards: (stage.cardData || []).map((card: any) => transformCard(card, stage._id)),
  cardCount: stage.cardCount || 0,
  localCardCount: stage.cardCount || 0
});

export function KanbanBoard({ connected }) {
  const params = useParams();
  const boardId = params.symbol as string;
  const [userData, setUserData] = useState<{ id: string; organizationId: string } | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isFetchingBoard, setIsFetchingBoard] = useState(true);
  const [isFetchingColumns, setIsFetchingColumns] = useState(true);
  const [membersharing, setmembersharing] = useState(false)
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const { stages, createStage, updateStage, deleteStage } = useStageStore()
  const { cards, createCard, updateCard, deleteCard, moveCard } = useCardStore()
  const { fetchBoardDetails, fetchBoardDetailsStageId, boardDetailsMetadata, isLoading: isBoardLoading, currentBoard, fetchBoardById, memberData, incrementListCount, decrementListCount, incrementCardCount, error } = useBoardStore()
  // const { tags: boardTags } = useTagStore() // Unused here now
  const fetchMembers = useMemberStore((state) => state.fetchMembers);
  const members = useMemberStore((state) => state.members);
  const [columns, setColumns] = useState<Column[]>([])
  const [showExpiredDialog, setShowExpiredDialog] = useState(false)
  console.log("columns3cxvxvxcvxcdadsdv", columns)
  const [activeCard, setActiveCard] = useState<Card | null>(null)
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
  const boardDetailsMetadataRef = useRef(boardDetailsMetadata);
  const userProfile = useUserStore((state) => state.userProfile);
  const { removeMembersForCards, removeAssignedMember, assignCardMemberlist, addAssignedMember, setAssignedMembers, } = useMemberStore()
  useEffect(() => {
    boardDetailsMetadataRef.current = boardDetailsMetadata;
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
  }, [boardDetailsMetadata]);

  const searchParams = useSearchParams()
  const pathname = usePathname()

  const openedCard = useMemo(() => {
    const cardId = searchParams?.get("cardId")
    if (!cardId) return null
    for (const col of columns) {
      const found = col.cards.find(c => c._id === cardId)
      if (found) return found
    }
    return null
  }, [searchParams, columns])

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
  const isReadOnly = (memberData?.role as string | undefined) === "observer"
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




  useEffect(() => {
    const cookie = localStorage.getItem("garage_tok")
    if (cookie) {
      try {
        const parsed = jwtDecode<JwtPayload>(cookie)
        setUserData({ id: parsed.userID, organizationId: parsed.orgId });




      } catch (e) {
        console.error("Failed to parse flowboadUserdata cookie", e);
      }
    }
  }, []);
  console.log("13sfdfsdfdsfsd", columns)
  // Fetch Board Metadata (name, etc.)
  useEffect(() => {
    if (boardId) {
      setIsFetchingBoard(true);
      fetchBoardById(boardId).finally(() => {
        setIsFetchingBoard(false);
      });
    }
  }, [boardId, fetchBoardById]);
  console.log("currentBoard", currentBoard)
  // Initial Fetch - Replaces fetchStages and fetchCards
  useEffect(() => {
    const sortOrderdeatil = sortOrder == "old-to-new" ? "asc" : "desc"
    // if (userData?.organizationId && boardId && isUserProfileFetched) {
    if (userData?.organizationId && boardId) {
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
  }, [userData, boardId, fetchBoardDetails, isUserProfileFetched]);

  console.log("nbvcjkvxcjhkvcxjkhvcxvcxjk", columns)

  // Socket Listeners for Real-time Card Updates (Comment Counts)
  useEffect(() => {
    const handleCommentCreated = (payload: any) => {
      // payload is expected to be the comment object containing cardId
      const cardId = payload?.cardId;
      if (!cardId) return;

      setColumns(prev => prev?.map(col => {
        const hasCard = col?.cards.some(c => c?._id === cardId);
        if (!hasCard) return col;

        return {
          ...col,
          cards: col?.cards.map(card => {
            if (card?._id === cardId) {
              return { ...card, commentCount: (card.commentCount || 0) + 1 };
            }
            return card;
          })
        };
      }));
    };


    const handleCommentDeleted = (payload: any) => {
      console.log("[Kanban] comment:deleted payload:", payload);
      // payload might be { commentId, cardId } or just commentId. 
      // We absolutely need cardId to update the board view efficiently.
      const cardId = payload?.cardId;

      if (!cardId) {
        console.warn("[Kanban] comment:deleted received without cardId, cannot update count.", payload);
        return;
      }

      setColumns(prev => prev?.map(col => {
        const hasCard = col?.cards.some(c => c?._id === cardId);
        if (!hasCard) return col;

        return {
          ...col,
          cards: col?.cards.map(card => {
            if (card?._id === cardId) {
              const newCount = Math.max((card.commentCount || 0) - 1, 0);
              console.log(`[Kanban] Decrementing comment count for card ${cardId} to ${newCount}`);
              return { ...card, commentCount: newCount };
            }
            return card;
          })
        };
      }));
    };


    const handleTaskDeleted = (payload: any) => {
      console.log("[Kanban] task:deleted payload:", payload);
      // Handle payload structure: { taskRecordExist: { data: { ... } } }
      const taskData = payload?.taskRecordExist?.data || payload?.data || payload;

      const rawCardId = taskData?.cardId;
      const cardId = payload?.taskRecordExist?.data?.cardId?._id;
      console.log("123cxxvxvxcvxcvx", cardId);
      if (!cardId) return;

      const childCount = taskData?.childCount || 0;
      const completedChildCount = taskData?.completedChildCount || 0;
      // setColumns(prev => prev.map(col => ({
      //   ...col,
      //   cards: col.cards.map(c =>
      //     c._id === card._id
      //       ? {
      //         ...c,
      //         TaskDataCount: {
      //           totalChildCount,
      //           totalCompletedChildCount
      //         }
      //       }
      //       : c
      //   )
      // })))
      setColumns(prev =>
        prev?.map(col => {
          // Check if this column contains the card we're updating
          const hasCard = col?.cards?.some(c => c?._id === cardId);
          if (!hasCard) return col;

          return {
            ...col,
            cards: col?.cards?.map(card => {
              if (card?._id !== cardId) return card;

              const currentChecklist = card.checklist || { completed: 0, total: 0 };

              // Safely subtract values (handle undefined/null)
              const subtractedChildCount = (payload?.taskRecordExist?.data?.childCount ?? 0);
              const subtractedCompletedChildCount = (payload?.taskRecordExist?.data?.completedChildCount ?? 0);

              return {
                ...card,
                TaskDataCount: {
                  totalChildCount:
                    (card.TaskDataCount?.totalChildCount ?? 0) - subtractedChildCount,
                  totalCompletedChildCount:
                    (card.TaskDataCount?.totalCompletedChildCount ?? 0) - subtractedCompletedChildCount,
                },
                checklist: {
                  total: Math.max((currentChecklist.total ?? 0) - (childCount ?? 0), 0),
                  completed: Math.max((currentChecklist.completed ?? 0) - (completedChildCount ?? 0), 0),
                },
              };
            }) ?? [], // fallback to empty array if cards is undefined
          };
        }) ?? [] // fallback to empty array if prev is undefined
      );
    };

    const handleChecklistCreated = (payload: any) => {
      console.log("asdadxzczxczxcwerwe", payload)
      const taskObj = payload?.taskObj || payload?.task;
      const cardId = payload?.cardId // Handle populated or flat cardId
      const checklistItem = payload?.checklist;

      if (!cardId) return;
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          cards: col.cards.map((c) =>
            c._id === cardId
              ? {
                ...c,
                TaskDataCount: {
                  // Keep total child count unchanged (assuming toggle, not add/remove)
                  totalChildCount: (c.TaskDataCount?.totalChildCount ?? 0) + 1,
                  // Update completed count
                  totalCompletedChildCount:
                    (c.TaskDataCount?.totalCompletedChildCount ?? 0),
                },
              }
              : c
          ),
        }))
      );












      // setColumns(prev => prev?.map(col => {
      //   const hasCard = col?.cards.some(c => c?._id === cardId);
      //   if (!hasCard) return col;

      //   return {
      //     ...col,
      //     cards: col?.cards.map(card => {
      //       if (card?._id === cardId) {
      //         const currentChecklist = card.checklist || { completed: 0, total: 0 };

      //         // Increment locally to ensure real-time update
      //         const newTotal = (currentChecklist.total || 0) + 1;
      //         const newCompleted = (currentChecklist.completed || 0) + (checklistItem?.isCompleted ? 1 : 0);

      //         return {
      //           ...card,
      //           checklist: {
      //             total: newTotal,
      //             completed: newCompleted
      //           }
      //         };
      //       }
      //       return card;
      //     })
      //   };
      // }));
    };
    // const handleTaskCreated = (payload) => {
    //   setColumns(prev => prev.map(col => ({
    //     ...col,
    //     cards: col.cards.map(c =>
    //       c._id === payload?.cardId
    //         ? {
    //           ...c,
    //           TaskDataCount: {
    //             totalChildCount:c.TaskDataCount?.totalChildCount,
    //             totalCompletedChildCount:c.TaskDataCount?.totalCompletedChildCount
    //           }
    //         }
    //         : c
    //     )
    //   })))
    // }

    const handlechecklistDeleted = (playload) => {
      console.log("213123playloadDeletesocket", playload)
      const cardId = playload?.cardId
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          cards: col.cards.map((c) =>
            c._id === cardId
              ? {
                ...c,
                TaskDataCount: {
                  // Keep total child count unchanged (assuming toggle, not add/remove)
                  totalChildCount: (c.TaskDataCount?.totalChildCount ?? 0) - 1,
                  // Update completed count
                  totalCompletedChildCount:
                    playload?.isCompleted ? (c.TaskDataCount?.totalCompletedChildCount ?? 0) - 1 : (c.TaskDataCount?.totalCompletedChildCount ?? 0),
                },
              }
              : c
          ),
        })));
    }

    boardSocketService.on("comment:created", handleCommentCreated);
    boardSocketService.on("comment:deleted", handleCommentDeleted);
    boardSocketService.on("checklist:deleted", handlechecklistDeleted);
    boardSocketService.on("task:deleted", handleTaskDeleted);
    // boardSocketService.on("task:created", handleTaskCreated);
    boardSocketService.on("checklist:created", handleChecklistCreated);


    return () => {
      boardSocketService.off("comment:created", handleCommentCreated);
      boardSocketService.off("comment:deleted", handleCommentDeleted);
      boardSocketService.off("task:deleted", handleTaskDeleted);
      boardSocketService.off("checklist:created", handleChecklistCreated);
      boardSocketService.off("checklist:deleted", handlechecklistDeleted);
    };
  }, []);


  useEffect(() => {
    const handleTaskCreated = (playload) => {
      socketAddTask(playload?.data)
    }
    boardSocketService.on("task:created", handleTaskCreated)
    return () => {
      boardSocketService.off("task:created", handleTaskCreated)
    }
  }, [])

  const stageFunction = (stageId: string) => {
    const sortOrderdeatil = sortOrder == "old-to-new" ? "asc" : "desc"
    setIsFetchingColumns(true);
    fetchBoardDetailsStageId(boardId, 1, 10, sortOrderdeatil, stageId).then((data: any) => {
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
  }

  useEffect(() => {
    const handlechecklistUpdated = (payload) => {
      console.log("fdhjfsuh", payload)
      console.log("Payload received:", payload);
      if (payload?.completionData) {
        const itemId = payload._id; // ID of the child task being toggled
        const cardId = payload.cardId; // ID of the parent card to update

        const delta = payload.isCompleted ? 1 : -1; // +1 if now completed, -1 if now incomplete

        setColumns((prev) =>
          prev.map((col) => ({
            ...col,
            cards: col.cards.map((c) =>
              c._id === cardId
                ? {
                  ...c,
                  TaskDataCount: {
                    // Keep total child count unchanged (assuming toggle, not add/remove)
                    totalChildCount: c.TaskDataCount?.totalChildCount ?? 0,
                    // Update completed count
                    totalCompletedChildCount:
                      (c.TaskDataCount?.totalCompletedChildCount ?? 0) + delta,
                  },
                }
                : c
            ),
          }))
        );
      }
      // updateTaskAndCardCounts(newTotal, newCompleted, itemId, playload.cardId)
    };


    boardSocketService.on("checklist:updated", handlechecklistUpdated);


    return () => {
      boardSocketService.off("checklist:updated", handlechecklistUpdated);

    };
  }, []);




  useEffect(() => {
    const handleStageCreate = (payload) => {

      console.log("Payload received Stage:", payload);
      const { currentPage, totalPages } = boardDetailsMetadataRef.current || { currentPage: 1, totalPages: 1 };

      // Only append if we have fetched all pages to ensure order is correct
      if (currentPage >= totalPages) {
        if (sortOrder == "new-to-old") {
          setColumns(prev => [transformStage(payload?.data), ...prev]);
        }
        else {

          setColumns(prev => [...prev, transformStage(payload?.data)]);
        }

      }

      // setNewColumnTitle("")
      // setShowAddColumn(false)
      //  incrementListCount(payload?.data?.boardId)


    };
    const handleStageUpdate = (payload) => {
      console.log("Payload handleStageUpdate Stage:", payload);
      setColumns(prev => prev.map(col =>
        col._id === payload?._id ? { ...col, name: payload?.name } : col
      ));
    }
    const handleStageDeleted = (payload) => {
      console.log("Payload handleStageDeletedStage:", payload);
      setColumns((prev) => prev.filter((col) => col._id !== payload?._id));
    }
    boardSocketService.on("stage:created", handleStageCreate);
    boardSocketService.on("stage:updated", handleStageUpdate);
    boardSocketService.on("stage:deleted", handleStageDeleted);
    return () => {
      boardSocketService.off("stage:created", handleStageCreate);
      boardSocketService.off("stage:updated", handleStageUpdate);
      boardSocketService.off("stage:deleted", handleStageDeleted);
    };
  }, []);


  console.log("66666666666666666666666666666666666", columns)

  useEffect(() => {

    const handleTaskCreate = (payload) => {
      console.log("Payload handleTaskCreate handleTaskCreate:", payload);
      setColumns(prev => prev.map(col => {
        if (col._id === payload?.data?.stageId) {
          return {
            ...col,
            cards: [...col.cards, transformCard(payload?.data, payload?.data?.stageId)],
            localCardCount: (col.localCardCount || 0) + 1
          }
        }
        return col;
      }));
      // incrementCardCount(payload?.data?.boardId);
    }

    const handleTaskUpdated = (payload) => {
      console.log("PayloadzxczxchandleTaskUpdated", payload);
      if (payload?.addTag) {

        setColumns(prev => prev.map(col => {
          if (col._id === payload.stageId) {
            return {
              ...col,
              cards: col.cards.map(c => {
                if (c._id === payload._id) {
                  return {
                    ...c,
                    tags: [...c?.tags, payload?.tagData?._id],
                    tagData: [...(c.tagData || []), { _id: payload?.tagData?._id || "", name: payload?.tagData?.name || "", color: payload?.tagData?.color || "" }]
                  }
                }
                return c
              })
            }
          }
          return col
        }))
      }

      // if (!payload?.addTag) {

      //   setColumns(prev =>
      //     prev.map(col => ({
      //       ...col,
      //       cards: col.cards.map(c =>
      //         c._id === payload._id
      //           ? {
      //             ...c,
      //             tags: payload?.tags,
      //             tagData: (c.tagData || []).filter((t: any) => t._id !== l._id),
      //           }
      //           : c
      //       ),
      //     }))
      //   );
      // }
      if (payload?.name) {
        setColumns((prev) => prev.map((col) => ({
          ...col,
          cards: col.cards.map((c) => c._id === payload._id ? { ...c, name: payload?.name } : c)
        })));
      }
      if (payload?.description) {
        setColumns((prev) => prev.map((col) => ({
          ...col,
          cards: col.cards.map((c) => c._id === payload._id ? { ...c, description: payload?.description } : c)
        })));
      }
      if (payload?.moveData) {


        // Only move if target is different from source


        // Store current state for rollback
        // const activeCardData = columns.flatMap((col) => col.cards).find((card) => card._id === payload?._id)

        // console.log("vcnxcvjhxvcjvcxnbvxc", activeCardData)
        // if (!activeCardData) return

        // Optimistic update
        setColumns(prev => {
          // Find the active card data once, from the current state (prev)
          const activeCardData = prev
            .flatMap(col => col.cards)
            .find(card => card._id === payload?._id);

          // If no card found (safety check), return prev unchanged
          if (!activeCardData || !payload?.stageId || !payload?.newStageId) {
            return prev;
          }

          const newCols = prev.map(col => {
            // Remove from source column
            if (col._id === payload.stageId) {
              return {
                ...col,
                cards: col.cards.filter(c => c._id !== payload._id),
                localCardCount: Math.max((col.localCardCount || 0) - 1, 0)
              };
            }

            // Add to target column (at the beginning)
            if (col._id === payload.newStageId) {
              const card = { ...activeCardData, stageId: payload.newStageId };
              return {
                ...col,
                cards: [card, ...col.cards], // equivalent to splice(0, 0, card)
                localCardCount: (col.localCardCount || 0) + 1
              };
            }

            // No change for other columns
            return col;
          });

          return newCols;
        });
      }
      if (payload?.completionData) {
        setColumns(prev => prev.map(col => ({
          ...col,
          cards: col.cards.map(c => c._id === payload._id ? { ...c, isCompleted: payload?.isCompleted } : c)
        })));
      }
      if (payload?.addMember) {


        setColumns(prev => prev.map(col => ({
          ...col,
          cards: col.cards.map(c => {
            if (c._id === payload?._id) {
              const newMemberObj = { _id: payload?.userData?._id, name: payload?.userData?.name, email: payload?.userData?.email, userId: payload?.userData?.userId };
              const currentMembers = (c.members || []).filter(m => m._id !== payload?.userData?._id);
              return { ...c, members: [...currentMembers, newMemberObj], assignedToIds: payload?.assignedToIds as any };
            }
            return c;
          })
        })));
        removeMembersForCards(payload?._id)
        const newMember = { _id: payload?.userData?._id, name: payload?.userData?.name, email: payload?.userData?.email, userId: payload?.userData?.userId };

        addAssignedMember(newMember)
      }

      if (!payload?.addMember) {
        removeAssignedMember(payload?.userRemoveAssignedToIds)
        setColumns(prev =>
          prev.map(col => ({
            ...col,
            cards: col.cards.map(c =>
              c._id === payload?._id
                ? {
                  ...c,
                  // tags: newTagIds,
                  assignedToIds: (c.assignedToIds || []).filter(
                    id => id !== payload?.userRemoveAssignedToIds
                  ),
                  members: (c.members || []).filter(
                    (mem) => (mem._id) !== payload?.userRemoveAssignedToIds
                  ),
                }
                : c
            ),
          }))
        );
      }




      // Optimistic UI update
      // setAssignedMembers([...(payload?.assignCardMemberlist || []), newMember]);
      // setAssignedMembers(prev => {
      //   // If functional update works elsewhere, use it here for safety
      //   // But if it still errors, fall back to the direct spread below
      //   if (prev.some(m => m.id === newMember.id)) {
      //     return prev; // already exists
      //   }
      //   return [...prev, newMember];
      // });
      // setAssignedMembers(prev => {
      //   // If functional update works elsewhere, use it here for safety
      //   // But if it still errors, fall back to the direct spread below
      //   if (prev.some(m => m.id === newMember.id)) {
      //     return prev; // already exists
      //   }
      //   return [...prev, newMember];
      // });;
      console.log("czxczxcz", assignCardMemberlist)

    }

    const handleTaskDeleted = (playload) => {
      console.log("czxncczvcxvxfsdsfsdf", playload)

      setColumns((prev) => prev.map((col) => {
        if (col._id === playload?.stageId) {
          // Remove card and decrement count
          return {
            ...col,
            cards: col.cards.filter((c) => c._id !== playload?._id),
            localCardCount: Math.max((col.localCardCount || 0) - 1, 0)
          }
        }
        return col
      }))
    }

    boardSocketService.on("card:created", handleTaskCreate);
    boardSocketService.on("card:updated", handleTaskUpdated);
    boardSocketService.on("card:deleted", handleTaskDeleted);


    return () => {
      boardSocketService.off("card:created", handleTaskCreate);
      boardSocketService.off("card:updated", handleTaskUpdated);
      boardSocketService.off("card:deleted", handleTaskDeleted);
    };
  }, []);



  // useEffect = () => {

  //   tag: created


  // }, []

  useEffect(() => {
    const handleTagUpdated = (playload) => {
      console.log("43fsdfsfsdgdfsupdated", playload)


      setColumns(prev => prev.map(col => ({
        ...col,
        cards: col.cards.map(c => {
          const hasTag = (c.tagData || []).some(t => t._id === playload?._id);
          if (hasTag) {
            return {
              ...c,
              tagData: c.tagData.map(t => t._id === playload?._id ? { ...t, name: playload?.name, color: playload?.color } : t)
            }
          }
          return c;
        })
      })));
    }
    const handleTagDeleted = (playload) => {
      console.log("playloaddeleresdasd", playload)
      setColumns(prev => prev.map(col => ({
        ...col,
        cards: col.cards.map(c => ({
          ...c,
          tags: (c.tags || []).filter(tid => tid !== playload?.data?._id),
          tagData: (c.tagData || []).filter(t => t._id !== playload?.data?._id)
        }))
      })));
    }

    boardSocketService.on("tag:updated", handleTagUpdated);
    boardSocketService.on("tag:deleted", handleTagDeleted);
    return () => {
      boardSocketService.off("tag:updated", handleTagUpdated);
      boardSocketService.on("tag:deleted", handleTagDeleted);
    }
  }, [])

  // useEffect(() => {
  //   const handleTagCreate = (playload) => {
  //     console.log("handleTagCreate", playload)
  //   }

  //   boardSocketService.on("card:created", handleTagCreate);
  //   return () => {
  //     boardSocketService.off("card:created", handleTagCreate);

  //   };
  // }, []
  // )



  const updateTaskAndCardCounts = (newChildCount: number, newCompletedChildCount: number, taskId: string, cardId: string) => {
    // Update task in store
    // updateTask(task._id, {
    //   childCount: newChildCount,
    //   completedChildCount: newCompletedChildCount
    // } as any)

    // Calculate total counts for the card (sum of all tasks)

    console.log("newTotal, newCompleted, task._id, task._cardId", newChildCount, newCompletedChildCount, taskId, cardId)
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
    console.log("totalChildCount", totalChildCount, totalCompletedChildCount)
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

      // Check if scrolled near the right end
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const sortOrderdeatil = sortOrder == "old-to-new" ? "asc" : "desc"
      // Buffer of 400px
      if (scrollWidth - (scrollLeft + clientWidth) < 400) {
        if (!isBoardLoading && boardDetailsMetadata) {
          const { currentPage, totalPages } = boardDetailsMetadata;
          if (currentPage < totalPages) {


            fetchBoardDetails(boardId, currentPage + 1, 10, sortOrderdeatil).then((data: any) => {
              if (data && Array.isArray(data)) {
                setColumns(prev => {
                  // Avoid duplicates
                  const newCols = data.map(transformStage);
                  const existingIds = new Set(prev.map(c => c._id));
                  const uniqueNewCols = newCols.filter(c => !existingIds.has(c._id));
                  return [...prev, ...uniqueNewCols];
                });
              }
            });
          }
        }
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [isBoardLoading, boardId, fetchBoardDetails, boardDetailsMetadata]);
  console.log("boardDetailsMetadata", boardDetailsMetadata)
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

  const [newColumnTitle, setNewColumnTitle] = useState("")
  const [showAddColumn, setShowAddColumn] = useState(false)

  const [isCreatingColumn, setIsCreatingColumn] = useState(false);

  // Drag and Drop Handlers
  const handleDragStart = (event: DragStartEvent) => {
    if (isReadOnly) return
    const { active } = event
    // Stop any board dragging when card/column drag starts
    setIsDraggingBoard(false)

    // Store original columns state before any drag operations
    originalColumnsRef.current = JSON.parse(JSON.stringify(columns))

    const card = columns.flatMap((col) => col.cards).find((card) => card._id === active.id)
    if (card) {
      setActiveCard(card)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    if (isReadOnly) return
    const { active, over } = event
    if (!over) return
    console.log("asaygdhdasjdasd", over)

    const activeId = active.id as string
    const overId = over.id as string

    const activeCardData = columns.flatMap((col) => col.cards).find((card) => card._id === activeId)
    if (!activeCardData) return

    const overColumn = columns.find((col) => col._id === overId)
    const overCard = columns.flatMap((col) => col.cards).find((card) => card._id === overId)

    if (!overColumn && !overCard) return

    // Visual feedback is handled by dnd-kit automatically
  }
  console.log("memberData", memberData?.role)
  const handleDragEnd = async (event: DragEndEvent) => {
    if (isReadOnly) return
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
    const { active, over } = event
    setActiveCard(null)

    if (!over) {
      // Restore original state if dropped outside
      setColumns(originalColumnsRef.current)
      return
    }

    const activeId = active.id as string
    const overId = over.id as string
    console.log("memberData22222222", activeId, overId)
    console.log("enddeatils over", over)
    console.log("enddeatils active", active)
    const activeCardData = columns.flatMap((col) => col.cards).find((card) => card._id === activeId)
    if (!activeCardData) return

    let targetColumnId: string | null = null
    let targetIndex = 0

    const overColumn = columns.find((col) => col._id === overId)
    const overCard = columns.flatMap((col) => col.cards).find((card) => card._id === overId)
    console.log("enddeatils over2", overColumn)
    console.log("enddeatils active2", overCard)
    if (overColumn) {
      targetColumnId = overColumn._id
      targetIndex = overColumn.cards.length
    } else if (overCard) {
      // Find the column that contains the card we're dropping over
      const targetColumn = columns.find((col) => col.cards.some((card) => card._id === overCard._id))
      if (targetColumn) {
        targetColumnId = targetColumn._id
        targetIndex = targetColumn.cards.findIndex((card) => card._id === overId)
        if (targetIndex === -1) targetIndex = targetColumn.cards.length
      } else {
        // Fallback to card's stageId if column not found
        targetColumnId = overCard.stageId
        const fallbackColumn = columns.find((col) => col._id === targetColumnId)
        if (fallbackColumn) {
          targetIndex = fallbackColumn.cards.length
        }
      }
    } else {
      // Restore original state if invalid drop
      setColumns(originalColumnsRef.current)
      return
    }

    // Only move if target is different from source
    if (activeCardData.stageId === targetColumnId) {
      // Same column, just reordering - no API call needed for now
      return
    }

    // Store current state for rollback
    const previousColumns = JSON.parse(JSON.stringify(columns))

    // Optimistic update
    setColumns(prev => {
      const newCols = prev.map(col => {
        // Remove from source column
        if (col._id === activeCardData.stageId) {
          return {
            ...col,
            cards: col.cards.filter(c => c._id !== activeId),
            localCardCount: Math.max((col.localCardCount || 0) - 1, 0)
          }
        }
        // Add to target column
        if (col._id === targetColumnId) {
          const card = { ...activeCardData, stageId: targetColumnId }
          const newCards = [...col.cards]
          newCards.splice(targetIndex, 0, card)
          return {
            ...col,
            cards: newCards,
            localCardCount: (col.localCardCount || 0) + 1
          }
        }
        return col
      })
      return newCols
    })

    try {
      const socketId = boardSocketService.socketId || undefined;
      console.log(`[KanbanBoard] Moving card ${activeId} from stage ${activeCardData.stageId} to stage ${targetColumnId}`)
      if (socketId) {
        await moveCard(activeId, targetColumnId, socketId)
      }

      console.log(`[KanbanBoard] Card moved successfully`)
    } catch (error) {
      console.error("Move failed, rolling back", error)
      // Rollback to original state before drag started
      setColumns(originalColumnsRef.current)
      toast.error(error instanceof Error ? error.message : "Failed to move card")
    }
  }

  const columnsId = columns.map((col) => col._id)

  const addColumn = useCallback(async () => {
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

    if (newColumnTitle.trim() && !isCreatingColumn) {
      setIsCreatingColumn(true);
      const boardSocketId = boardSocketService.socketId || undefined;
      const notificationSocketId = notificationSocketService.socketId || undefined;

      const newStage = await createStage({
        name: newColumnTitle,
        description: "",
        boardId,
        boardSocketId,
        notificationSocketId
      })

      if (newStage) {
        if (sortOrder == "new-to-old") {
          setColumns(prev => [transformStage(newStage), ...prev]);


        }
        else {
          setColumns(prev => [...prev, transformStage(newStage)]);
        }

        setNewColumnTitle("")
        setShowAddColumn(false)
        incrementListCount(boardId)
      }
      setIsCreatingColumn(false);
    }
  }, [newColumnTitle, boardId, createStage, isCreatingColumn, blockIfReadOnly, incrementListCount])

  const handleUpdateColumn = useCallback(async (columnId: string, newTitle: string) => {

    if (blockIfReadOnly()) return
    // Optimistic Update

    const socketId = boardSocketService.socketId || undefined;
    const notificationSocketId = notificationSocketService.socketId || undefined;
    await updateStage(columnId, { name: newTitle, socketId })
    await setColumns(prev => prev.map(col =>
      col._id === columnId ? { ...col, name: newTitle } : col
    ));
  }, [updateStage, blockIfReadOnly])

  const handleDeleteColumn = useCallback(async (columnId: string) => {
    if (blockIfReadOnly()) return
    const boardSocketId = boardSocketService.socketId || undefined;
    const notificationSocketId = notificationSocketService.socketId || undefined;
    if (boardSocketId && notificationSocketId) {
      await deleteStage(columnId, boardSocketId, notificationSocketId)
    }

    await setColumns((prev) => prev.filter((col) => col._id !== columnId));
    decrementListCount(boardId)
  }, [deleteStage, blockIfReadOnly, decrementListCount, boardId])

  const addCard = useCallback(async (columnId: string, cardTitle: string) => {
    if (blockIfReadOnly()) return
    if (cardTitle.trim()) {
      if (!userData || !userData.organizationId) {
        console.error("Missing user data for card creation");
        return;
      }

      const boardSocketId = boardSocketService.socketId || undefined;
      const notificationSocketId = notificationSocketService.socketId || undefined;

      // createCard now returns the new card (any)
      const newCard = await createCard({
        boardId,
        stageId: columnId,
        name: cardTitle,
        description: "",
        tags: [],
        assignedToIds: [],
        boardSocketId,
        notificationSocketId
      })

      if (newCard) {
        setColumns(prev => prev.map(col => {
          if (col._id === columnId) {
            return {
              ...col,
              cards: [...col.cards, transformCard(newCard, columnId)],
              localCardCount: (col.localCardCount || 0) + 1
            }
          }
          return col;
        }));
        incrementCardCount(boardId);
      }
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
    // if (userData?.organizationId && boardId && isUserProfileFetched) {
    if (userData?.organizationId && boardId) {
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
  return (
    <DndContext
      sensors={isReadOnly ? [] : sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen bg-white dark:bg-background flex flex-col overflow-hidden">
        <div className="w-full bg-white dark:bg-background border-b dark:border-gray-800">

          <header className="border-b border-border bg-white dark:bg-background dark:border-gray-800">
            <div className="flex items-center justify-between gap-4 px-6 py-3">
              {/* Search Bar */}
              {/* <div className="flex items-center gap-2 flex-1 max-w-md bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-md">
                <Search className="w-4 h-4 text-muted-foreground dark:text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search boards, lists, cards, checklists..."
                  className="border-0 bg-transparent placeholder-muted-foreground dark:placeholder-gray-500 text-sm focus-visible:ring-0 focus-visible:border-0 h-auto p-0 text-foreground dark:text-gray-200"
                />
                <span className="text-muted-foreground dark:text-gray-500 text-xs">/</span>
              </div> */}
              <SearchList query={query} setQuery={setQuery}
                sortOrder={sortOrder}
                setIsFetchingColumns={setIsFetchingColumns}
                stageFunction={stageFunction}
              />
              {/* Right Side Icons */}
              <div className="flex items-center gap-2">
                {/* <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
                  <Bell className="w-5 h-5" />
                </Button> */}
                <div className="flex items-center justify-center w-10 h-10">
                  {/* <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800" onClick={toggleTheme}>
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </Button> */}
                  {
                    theme === 'light' ?

                      <button
                        onClick={() => toggleTheme()}
                        className={`p-1.5 rounded-md transition-all  text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100`}
                        title="Dark Mode"
                      >
                        <Moon size={16} />
                      </button>
                      :
                      <button
                        onClick={() => toggleTheme()}
                        className={`p-1.5 rounded-md transition-all  text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100`}
                        title="Light Mode"
                      >
                        <Sun size={16} />
                      </button>


                  }


                </div>
                {/* <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
                  <Settings className="w-5 h-5" />
                </Button> */}

                {/* Profile Avatar */}
                <Avatar className="w-8 h-8 cursor-pointer ring-2 ring-transparent hover:ring-gray-200 dark:hover:ring-gray-700 transition">
                  <AvatarFallback className="bg-blue-700 text-white font-semibold text-xs">

                    {userProfile?.name
                      ? userProfile?.name
                        .split(" ")
                        .slice(0, 2)
                        .map((n) => n[0]?.toUpperCase())
                        .join("")
                      : "?"}


                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </header>

          <div className="mx-auto  px-4 sm:px-6 lg:px-8">

            <div className="flex flex-col gap-4 py-6 lg:flex-row lg:items-center pb-2 lg:justify-between">

              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => router.push("/flowboard")}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    title="Back to Boards"
                  >
                    <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </button>
                  {isFetchingBoard ? (
                    <div className="h-7 w-48 bg-gray-200 rounded animate-pulse"></div>
                  ) : (
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground dark:text-foreground">{currentBoard?.name || "Board"}</h1>
                  )}
                </div>

                <p className="mt-1 text-sm text-muted-foreground">{currentBoard?.description}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">

                <div className="flex items-center -space-x-2">
                  {
                    isFetchingBoard ?
                      <>
                        {Array.from({ length: 15 }).map((_, index) => {
                          const randomColor = avatarColors[index % avatarColors.length];

                          return (
                            <div
                              key={`skeleton-${index}`}
                              className={`h-9 w-9 rounded-full border-2 border-background ring-1 ring-border shrink-0`}
                              style={{
                                backgroundColor: randomColor,
                                zIndex: 5 - index,
                              }}
                            >
                              <Skeleton className="h-full w-full rounded-full" />
                            </div>
                          );
                        })}
                      </>
                      :
                      <>
                        {currentBoard?.boardUsers?.userData?.slice(0, 5)?.map((member, index) => {
                          const colorIndex = index % avatarColors.length

                          return (
                            <div
                              key={member?.userData?._id}
                              className={`h-9 w-9 rounded-full border-2 bg-blue-700  border-background ring-1 ring-border flex items-center justify-center text-white font-medium text-xs shrink-0 cursor-pointer transition-all duration-200 ease-in-out hover:scale-110 hover:shadow-md`}
                              style={{

                                zIndex: (currentBoard?.boardUsers?.userData?.length ?? 0) - index,
                              }}
                              title={member?.userData?.name}
                            >
                              {member?.userData?.name
                                ? member?.userData?.name
                                  .split(" ")
                                  .slice(0, 2)
                                  .map((n) => n[0]?.toUpperCase())
                                  .join("")
                                : "?"}
                            </div>
                          );
                        })}


                        {(currentBoard?.boardUsers?.totalUserCount ?? 0) > 5 && (
                          <div
                            className="flex h-9 w-9 items-center dark:bg-gray-700 justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-muted-foreground ring-1 ring-border cursor-pointer transition-all duration-200 ease-in-out hover:bg-muted/80 hover:scale-110 hover:shadow-md"
                            onClick={() => setIsMembersModalOpen(true)}
                          >
                            +{(currentBoard?.boardUsers?.totalUserCount ?? 0) - 5}
                          </div>
                        )}
                      </>
                  }



                </div>


                <Button
                  className="bg-gray-900 hover:bg-gray-800 border-background ring-1 ring-border text-white dark:hover:bg-gray-800 dark:bg-black dark:text-gray-900 dark:hover:bg-gray-800 border border-transparent transition-colors"
                  onClick={() => {
                    if (blockIfReadOnly()) return
                    setIsShareModalOpen(true)
                  }}
                >
                  <UserPlus className="mr-2 h-4 w-4 dark:text-white" />
                  <span className="hidden sm:inline dark:text-white">Invite Member</span>
                  <span className="sm:hidden dark:text-white">Invite</span>
                </Button>


                <Button

                  className="gap-2 bg-transparent border-background ring-1 ring-border dark:bg-black dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                  onClick={() => {
                    if (blockIfReadOnly()) return
                    setmembersharing(true)
                  }}
                >
                  <Share2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Share</span>
                </Button>
              </div>
            </div>


            <div className="flex flex-col gap-3  py-3 sm:flex-row sm:items-center sm:justify-between">
              {/* <SortDropdown value={sortOrder} onChange={setSortOrder} /> */}








              <div className="flex items-center gap-1 overflow-x-auto">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.name}
                      onClick={() => setActiveTab(tab.name)}
                      className={cn(
                        "group relative flex items-center gap-2 whitespace-nowrap px-4 py-2 pl-0 text-sm font-medium transition-colors",
                        activeTab === tab.name ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {Icon && <Icon className="h-4 w-4" />}
                      <span>{tab.name}</span>
                      {activeTab === tab.name && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />}
                    </button>
                  )
                })}
              </div>


              <div className="relative inline-block">
                <select
                  value={sortOrder}
                  onChange={(e) => onChangeSort(e.target.value as "old-to-new" | "new-to-old")}
                  className="appearance-none bg-background border border-border rounded-lg px-2 py-1 pr-8 text-foreground text-sm font-sm cursor-pointer hover:border-foreground/50 focus:outline-none focus:ring-0 focus:ring-primary transition-all"
                >
                  <option value="old-to-new">Old to New</option>
                  <option value="new-to-old">New to Old</option>
                </select>

                {/* Custom chevron icon */}
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground pointer-events-none" />
              </div>


              {/* <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">Filter</span>
                </Button>
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden sm:inline">Group by</span>
                </Button>
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                  <ArrowUpDown className="h-4 w-4" />
                  <span className="hidden sm:inline">Sort</span>
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div> */}
            </div>


          </div>
        </div>

        {
          activeTab == "List" &&
          <KanbanBoardListView
            columns={columns}
            setColumns={setColumns}
            connected={connected}
            sortOrder={sortOrder}
          />
        }

        {
          activeTab == "Board" &&
          <div className="flex-1 flex overflow-hidden h-full relative">
            <div
              className={`flex-1 overflow-x-auto px-6 py-6 bg-white dark:bg-background kanban-horizontal-scroll ${isDraggingBoard ? 'cursor-grabbing' : 'cursor-default'}`}
              ref={scrollContainerRef}
              onMouseDown={onMouseDown}
              onMouseLeave={onMouseLeave}
              onMouseUp={onMouseUp}
              onMouseMove={onMouseMove}
            >
              <div className="flex gap-6 min-w-min h-full items-start">
                {(isFetchingBoard || isFetchingColumns) ? (
                  // Skeleton Loader
                  <>
                    {Array.from({ length: 10 }).map((_, index) => (
                      <div
                        key={`skeleton-column-${index}`}
                        className="flex-shrink-0 w-80 bg-[#e6eaef] dark:bg-gray-800 rounded-xl shadow-sm flex flex-col max-h-full"
                      >
                        {/* Column Header Skeleton */}
                        <div className="flex items-center justify-between px-3 py-2.5 pb-0">
                          <div className="flex items-center gap-2 flex-1">
                            <Skeleton className="h-2 w-2 rounded-full" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-5 w-5 rounded-full" />
                          </div>
                          <Skeleton className="h-5 w-5 rounded" />
                        </div>

                        {/* Cards Container Skeleton */}
                        <div className="flex flex-col gap-3 p-3 flex-1">
                          {Array.from({ length: 6 }).map((_, cardIndex) => (
                            <div
                              key={`skeleton-card-${cardIndex}`}
                              className="bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm space-y-2"
                            >
                              <Skeleton className="h-4 w-full" />
                              <Skeleton className="h-4 w-3/4" />
                              <div className="flex items-center gap-2 mt-2">
                                <Skeleton className="h-6 w-6 rounded-full" />
                                <Skeleton className="h-6 w-6 rounded-full" />
                              </div>
                            </div>
                          ))}
                          {/* Add Card Button Skeleton */}
                          <Skeleton className="h-9 w-full rounded" />
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <SortableContext items={columnsId} strategy={horizontalListSortingStrategy}>
                    {columns.map((column) => (
                      <KanbanColumn
                        key={column._id}
                        column={column}
                        onAddCard={addCard}
                        onUpdate={handleUpdateColumn}
                        onDelete={handleDeleteColumn}
                        boardId={boardId}
                        orgId={userData?.organizationId || ""}
                        setColumns={setColumns}
                        userId={userData?.id}
                        isReadOnly={isReadOnly}
                        connected={connected}
                        updateTaskAndCardCounts={updateTaskAndCardCounts}

                      />
                    ))}
                  </SortableContext>
                )}
                {
                  sortOrder != "new-to-old" &&
                  <>

                    {!isFetchingBoard && !isFetchingColumns && (
                      <div className="min-w-72 bg-[#e6eaef] dark:bg-gray-800 rounded-lg p-3 shadow-sm flex-shrink-0">
                        {!showAddColumn ? (
                          <button
                            onClick={() => {
                              if (blockIfReadOnly()) return
                              setShowAddColumn(true)
                            }}
                            className="w-full flex items-center justify-start gap-2 text-gray-700 dark:text-gray-300 bg-[#e6eaef] dark:bg-gray-800 rounded px-3 py-2 transition font-medium text-sm"
                            disabled={isReadOnly}
                          >
                            <Plus className="w-4 h-4" />
                            Add another list
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <input
                              type="text"
                              placeholder="Enter list title..."
                              value={newColumnTitle}
                              onChange={(e) => setNewColumnTitle(e.target.value)}
                              autoFocus
                              className="w-full px-3 py-2  rounded focus:outline-none focus:ring-2 focus:ring-[#e6eaef] text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 text-sm"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") addColumn()
                                if (e.key === "Escape") setShowAddColumn(false)
                              }}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={addColumn}
                                disabled={isCreatingColumn || isReadOnly}
                                className="flex-1 bg-[#000] text-white px-3 py-1.5 rounded text-sm font-medium  transition disabled:opacity-50"
                              >
                                {isCreatingColumn ? "Creating..." : "Add list"}
                              </button>
                              <button
                                onClick={() => setShowAddColumn(false)}
                                className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                }

                {/* Spacer */}
                <div className="w-1" />

                {/* Initial & Infinite Loading Indicators */}
                {isBoardLoading && (
                  <div className="min-w-72 flex items-center justify-center">
                    {/* <div className="text-white text-lg">Loading...</div> */}
                  </div>
                )}

              </div>
            </div>


            {
              sortOrder == "new-to-old" &&
              <>
                {!isFetchingBoard && !isFetchingColumns && (
                  <div className={`${showAddColumn ? "w-[300px]  px-4" : "w-16  px-0"} dark:bg-gray-800 bg-white dark:bg-background py-6 flex-shrink-0 flex flex-col gap-4 overflow-y-auto z-20 shadow-[-5px_0px_10px_0px_rgba(0,0,0,0.02)]`}>
                    <div className={`${showAddColumn && "rounded-lg"} w-full h-full bg-[#e6eaef] dark:bg-gray-800  p-3 shadow-sm flex-shrink-0`}
                      style={{
                        background: "transparent"
                      }}

                    >
                      {!showAddColumn ? (
                        <button
                          onClick={() => {
                            if (blockIfReadOnly()) return;
                            setShowAddColumn(true);
                          }}
                          disabled={isReadOnly}
                          className={`
    flex flex-col          
    items-center           
    justify-center        
    gap-2
    w-full                   
    h-full                         
    bg-[#fff]
    dark:bg-gray-900         
    hover:bg-[#fff]     
    active:bg-[#fff]
    text-gray-700
    dark:text-gray-300
    rounded-lg            
    transition-colors
    font-medium
    text-sm

    border border-gray-300 dark:border-gray-700 border-dashed    
    disabled:opacity-50
    disabled:cursor-not-allowed
  `}
                        >
                          <Plus className="w-6 h-6 text-gray-600" />  {/* bigger icon for vertical */}
                          <span className="text-center"

                            style={{
                              writingMode: "vertical-rl",
                              transform: "rotate(180deg)",
                            }}
                          >
                            Add another list
                          </span>
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Enter list title..."
                            value={newColumnTitle}
                            onChange={(e) => setNewColumnTitle(e.target.value)}
                            autoFocus
                            className="w-full px-3 py-2 dark:bg-gray-500 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-[#e6eaef] text-gray-900 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") addColumn()
                              if (e.key === "Escape") setShowAddColumn(false)
                            }}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={addColumn}
                              disabled={isCreatingColumn || isReadOnly}
                              className="flex-1 bg-[#000] text-white px-3 py-1.5 rounded text-sm font-medium  transition disabled:opacity-50"
                            >
                              {isCreatingColumn ? "Creating..." : "Add list"}
                            </button>
                            <button
                              onClick={() => setShowAddColumn(false)}
                              className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded transition"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            }










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
        {openedCard && (
          <CardModal
            connected={connected}
            updateTaskAndCardCounts={updateTaskAndCardCounts}
            card={openedCard}
            userId={userData?.id}
            onClose={() => {
              const params = new URLSearchParams(searchParams.toString())
              params.delete("cardId")
              router.push(`${pathname}?${params.toString()}`)
            }}
            boardId={boardId}
            orgId={userData?.organizationId || ""}
            setColumns={setColumns}
            isReadOnly={isReadOnly}
          />
        )}
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
            <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
              {/* Link Icon at Top */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                <div className="bg-white dark:bg-gray-800  rounded-full p-4 shadow-xl">
                  <LinkIcon className="w-8 h-8 text-gray-700 dark:text-white" strokeWidth={2.5} />
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setmembersharing(false)}
                //onClick={onClose}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-white" />
              </button>

              {/* Header */}


              {/* Share Link Section */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 dark:text-white">Share you link</h3>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 border border-gray-100">
                  <span className="flex-1 text-sm text-gray-700 truncate dark:text-white">{`https://flowboard-new-garage-app.vercel.app/flowboard/${boardId}`}</span>
                  <button className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors" onClick={handleCopy}>
                    <Copy className="w-5 h-5 text-gray-600 dark:text-white" />
                  </button>
                </div>
              </div>

              {/* Social Share Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4 dark:text-white">Share to</h3>
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

                      <a className="text-xs text-gray-700 dark:text-white"

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
              boardId={boardId}
              orgId={userData?.organizationId || ""}
              setColumns={setColumns}
              userId={userData?.id}
              isReadOnly={isReadOnly}
              connected={connected}
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


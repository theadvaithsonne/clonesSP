"use client"

import type { Card, Column } from "./Dashbaord"
import { cn } from "@/lib/utils"
import {
  X, Trash2, Tag, Users, Calendar, CheckSquare, Paperclip, Plus, PlayCircle, Flag, RefreshCw,
  AlignLeft, Check, Copy, Archive, Clock, CreditCard, ChevronDown, CalendarRange, Download, Eye, ChevronLeft,
  MoreHorizontal, Bell, Link2, Timer, Zap, Hash, Maximize2, ChevronRight, CircleDot, AlignJustify, Share2, Loader2,
  Search, Pencil, Sparkles
} from "lucide-react"
import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import SubtaskManager from './subtaskCompoent'
import { toast } from "sonner"
import { CardActivity } from "./card-activity"
import { CardAttachments, type Attachment } from "./card-attachments"
import { StatusPicker } from "./status-picker"
import { CustomDatePicker } from "./custom-date-picker"
import { useMemberStore } from "@/store/athena/memberStore"
import { useCardStore } from "@/store/athena/cardStore"
import { useTaskStore } from "@/store/athena/taskStore"
import { useTagStore } from "@/store/athena/tagStore"
import { useBoardStore } from "@/store/athena/boardStore"
import { useWorkspaceStore } from "@/store/taskroom/workspaceStore"
import {useTaskroomWorkspacetore} from "@/store/taskroom/taskroomWorkspace"
import { format } from "date-fns"
import Cookies from "js-cookie";
import { useChecklistStore } from "@/store/athena/checklistStore"
import { TagChip } from "./tag-picker"
import { TAG_PRESET_HEX, getTagStyles, isSameTagColor, normalizeTagColor, resolveTagColorForPicker } from "./tag-colors"

const TASKROOM_API_URL = process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/";

import { useSearchParams, } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { formatDistanceToNowStrict, isPast } from "date-fns";
import { enIN } from "date-fns/locale";
import {
  formatCreatedAtDateTime,
  formatCreatedAtElapsed,
  getTimeZoneAbbreviation,
} from "./format-created-at"
import { PriorityPicker } from "./priority-picker"
import { TimeEstimate, TrackTime } from "./time-tracking"
import { timeSocketService } from "../socket/timeTrack-socket-service";
import { jwtDecode } from 'jwt-decode'
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

interface CardModalProps {
  card: Card
  columnId?: string
  boardId: string
  orgId: string
  onClose: () => void
  setColumns?: React.Dispatch<React.SetStateAction<Column[]>>
  userId: string | undefined
  isReadOnly?: boolean
  connected: boolean
  updateTaskAndCardCounts?: (newChildCount: number, newCompletedChildCount: number, taskId: string, cardId: string) => void
  onCardPatched?: (patch: { _id: string } & Partial<Card>) => void
  /** Where the card lives, when that isn't the room currently open in the store (e.g. Assigned To Me). */
  roomContext?: RoomContext
}

export interface RoomContext {
  workspaceId?: string
  spaceId?: string
  workspaceName?: string
  spaceName?: string
  roomName?: string
}

interface ChecklistItem {
  id: string
  text: string
  completed: boolean
}

const tagInputClass =
  "w-full px-3 py-2 text-sm text-white/80 bg-white/[0.04] border border-white/[0.08] rounded-lg outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-white/[0.08] placeholder:text-white/30"

const searchTagInputClass =
  "w-full h-7 px-2.5 py-0 text-xs text-white/80 bg-white/[0.04] border border-white/[0.08] rounded-md outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-white/[0.08] placeholder:text-xs placeholder:text-white/30"

function capitalizeLabel(value?: string) {
  if (!value) return ""
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function CardModal({ card, connected, boardId, userId, updateTaskAndCardCounts, onClose, setColumns, isReadOnly, onCardPatched, roomContext }: CardModalProps) {
  const { members: boardMembers, fetchMembers, cardMembers, removeMembersForCards, fetchMembersForCards, removeAssignedMember, fetchAssignForCards, setAssignedMembers, assignCardMemberlist, isLoadingAssign } = useMemberStore()
  const { updateCard, deleteCard, toggleComplete, setSharedLongUrl } = useCardStore()
  const [showExpiredDialog, setShowExpiredDialog] = useState(false)
  const [isGeneratingShortUrl, setIsGeneratingShortUrl] = useState(false)
  const router = useRouter()

  // Mobile panel state: 'details' shows main content, 'activity' shows right sidebar on small screens
  const [mobilePanel, setMobilePanel] = useState<'details' | 'activity'>('details')

  useEffect(() => {
    setMobilePanel('details')
  }, [card?._id])

  const [localCard, setLocalCard] = useState<Card>(card)
  const [cardName, setCardName] = useState(card?.name)
  const [descValue, setDescValue] = useState(card?.description || "")
  const [isEditingDesc, setIsEditingDesc] = useState(false)
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const { createTag, updateTag: updateTagApi, deleteTag: deleteTagApi } = useTagStore()

  const patchColumnsForCard = useCallback((prevCols: Column[], cardId: string, patch: Partial<any>) => {
    const patchInTree = (items: any[]): any[] =>
      (items || []).map((it) => {
        const itId = it?._id ?? it?.id
        if (itId === cardId) return { ...it, ...patch }
        if (Array.isArray(it?.subtasks) && it.subtasks.length > 0) {
          return { ...it, subtasks: patchInTree(it.subtasks) }
        }
        return it
      })

    return (prevCols || []).map((col: any) => ({
      ...col,
      cards: Array.isArray(col?.cards) ? patchInTree(col.cards) : col.cards,
      columns: Array.isArray(col?.columns) ? patchInTree(col.columns) : col.columns,
    }))
  }, [])

  const emitPatched = useCallback((patch: { _id: string } & Partial<Card>) => {
    if (!patch?._id) return
    setLocalCard((prev) => ({ ...prev, ...patch }))
    setColumns?.((prev) => patchColumnsForCard(prev as any, patch._id as any, patch))
    onCardPatched?.(patch)
  }, [patchColumnsForCard, setColumns, onCardPatched])
  const {
    tasks: taskchild,
    tasks: cardTasks,
    fetchTasks,
    createTask,
    deleteTask,
    hasMore: hasMoreTasks,
    currentPage: tasksCurrentPage,
    isLoading: isTasksLoading,
    isCreatingTask
  } = useTaskStore()
  const { tags: boardTags, decrementCardCount } = useBoardStore();

  const updateCardTaskCounts = () => {
    const totalChildCount = cardTasks.reduce((sum, t) => sum + (t.childCount || 0), 0)
    const totalCompletedChildCount = cardTasks.reduce((sum, t) => sum + (t.completedChildCount || 0), 0)
    setColumns?.(prev => prev.map(col => ({
      ...col,
      cards: col.cards.map(c =>
        c._id === localCard?._id
          ? { ...c, TaskDataCount: { totalChildCount, totalCompletedChildCount } }
          : c
      )
    })))
  }

  const [searchLabel, setSearchLabel] = useState("")
  const [isCreatingLabel, setIsCreatingLabel] = useState(false)
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [newLabelName, setNewLabelName] = useState("")
  const [selectedColor, setSelectedColor] = useState(TAG_PRESET_HEX[0])
  const [isLabelPopoverOpen, setIsLabelPopoverOpen] = useState(false)
  const [isDatesPopoverOpen, setIsDatesPopoverOpen] = useState(false)
  const [isTagLoading, setIsTagLoading] = useState(false)
  const [deleteTagTarget, setDeleteTagTarget] = useState<{ _id: string; name: string } | null>(null)
  const [fetchedTagData, setFetchedTagData] = useState<Array<{ _id: string; name: string; color: string }>>([])
  const [isFetchingTags, setIsFetchingTags] = useState(false)
  const { currentWorkspace, currentRoomDetail, spaceData: allSpaceData } = useTaskroomWorkspacetore()
  const searchParams = useSearchParams();
  const Idspace = roomContext
    ? roomContext.spaceId
    : searchParams.get("shareTask") ? searchParams.get('spaceId') : currentRoomDetail?.spaceId;
  const workspaceId = roomContext
    ? roomContext.workspaceId
    : searchParams.get("shareTask") ? searchParams.get("workspaceId") : currentWorkspace?._id
  const spaceList = workspaceId ? allSpaceData[workspaceId as string] || [] : []
  const currentSpace = Idspace ? spaceList.find((space) => space._id === Idspace) : undefined
  const spaceName = roomContext?.spaceName || (currentSpace as any)?.name || (currentSpace as any)?.workspacename || ""
  const roomName = roomContext ? roomContext.roomName || "" : currentRoomDetail?.name || ""
  const { checklistItems, fetchChecklistItems, createChecklistItem, updateChecklistItem, deleteChecklistItem } = useChecklistStore()

  const [isChecklistPopoverOpen, setIsChecklistPopoverOpen] = useState(false)
  const [newTaskName, setNewTaskName] = useState("")
  const [expandedChecklistGroup, setExpandedChecklistGroup] = useState(true)
  const [showChecklistAddArea, setShowChecklistAddArea] = useState(false)
  useEffect(() => {
    if (localCard?._id) {
      fetchTasks(localCard?._id, 1, false)
    }
  }, [localCard?._id])

  useEffect(() => {
    const totalChildCount = cardTasks.reduce((sum, t) => sum + (t.childCount || 0), 0)
    const totalCompletedChildCount = cardTasks.reduce((sum, t) => sum + (t.completedChildCount || 0), 0)
    setColumns?.(prev => prev.map(col => ({
      ...col,
      cards: col.cards.map(c =>
        c._id === localCard?._id
          ? { ...c, TaskDataCount: { totalChildCount, totalCompletedChildCount } }
          : c
      )
    })))
  }, [cardTasks, localCard?._id, setColumns])
  // Inside CardModal component, add this after your existing useEffects





  useEffect(() => {
    // if (!isUserProfileFetched || !userProfile?._id || !boardId) return;
    if (!boardId) return;
    const userData = localStorage.getItem("garage_tok")
    // Connect board-specific socket after profile API success
    if (userData) {
      const payload = jwtDecode<JwtPayload>(userData)
      timeSocketService.connect(payload.userId, card?._id);
    }
    return () => {
      timeSocketService.disconnect();
    };
  }, [timeSocketService]);

  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = "auto"
      titleRef.current.style.height = `${titleRef.current.scrollHeight}px`
    }
  }, [cardName])
  const [attachments, setAttachments] = useState<Attachment[]>(() => {
    if (card?.attachments && Array.isArray(card?.attachments)) {
      return card?.attachments as Attachment[]
    }
    return []
  })

  const [showAttachments, setShowAttachments] = useState(false)
  const [isMembersLoading, setIsMembersLoading] = useState(false)
  const [togglingMemberIds, setTogglingMemberIds] = useState<Set<string>>(new Set())
  const [memberSearchTerm, setMemberSearchTerm] = useState("")
  const [searchedMembers, setSearchedMembers] = useState<any[]>([])
  const [isSearchingMembers, setIsSearchingMembers] = useState(false)

  const blockIfReadOnly = () => {
    if (!isReadOnly) return false
    toast.error("Observers can only view cards")
    return true
  }

  const parseDateValue = (value?: string | number) => {
    if (!value) return undefined
    const parsed = new Date(value)
    return isNaN(parsed.getTime()) ? undefined : parsed
  }

  const [startDate, setStartDate] = useState<Date | undefined>(() => parseDateValue(localCard?.startDate))
  const [dueDate, setDueDate] = useState<Date | undefined>(() => parseDateValue(localCard?.dueDate))
  const [isStartDateEnabled, setIsStartDateEnabled] = useState(() => Boolean(parseDateValue(localCard?.startDate)))
  const [hasDueDate, setHasDueDate] = useState(() => Boolean(parseDateValue(localCard?.dueDate)))
  const [isSavingDates, setIsSavingDates] = useState(false)
  const [reminder, setReminder] = useState("1 day before")
  const [assignlistData, setassignlistData] = useState([])
  const [isCompleted, setIsCompleted] = useState(card?.isCompleted || false)

  // Seeded from the card so the label shows even when its room's board isn't loaded in `columns`.
  const [stageData, setStageData] = useState<{ type: string, name: string } | null>(() =>
    card?.stageData?.name ? { type: card.stageData.stageType || '', name: card.stageData.name } : null
  )
  const shareTaskName = searchParams.get('shareTask');
  useEffect(() => {
    if (!setColumns) return
    setColumns(prev => {
      const col = prev.find(c => c._id === (localCard?.stageId));
      if (col) {
        setTimeout(() => {
          setStageData({ type: col.stageType || '', name: col.name || '' });
        }, 0);
      }
      return prev;
    });
  }, [localCard?.stageId, setColumns]);


  useEffect(() => {
    if (shareTaskName) {
      setStageData({ type: card?.stageData?.stageType || '', name: card?.stageData?.name || '' });
    }

  }, [shareTaskName]);


  useEffect(() => {
    fetchAssignForCards(localCard?._id)
  }, [fetchAssignForCards])

  const searchMembers = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchedMembers([])
      return
    }


    setIsSearchingMembers(true)
    try {
      const token = localStorage.getItem("garage_tok");
      if (!token) { toast.error("Authentication token missing"); return }
      const response = await fetch(
        `${TASKROOM_API_URL}tasks/${card?._id}/members?size=50&search=${encodeURIComponent(searchTerm)}`,
        { method: "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      )
      const data = await response.json()
      if (!response.ok || data.status === false) throw new Error(data.message || "Failed to search members")
      const normalizedMembers = (data?.data || []).map((member: any) => {
        if (member.userData) {
          return { _id: member.userData._id || member._id, id: member.userData._id || member._id, name: member.userData.name || member.name, email: member.userData.email || member.email, userId: member.userData._id || member._id }
        }
        return { _id: member._id, id: member._id || member.id, name: member.name, email: member.email, userId: member._id || member.userId }
      })
      setSearchedMembers(normalizedMembers)
    } catch (error) {
      toast.error("Failed to search members")
      setSearchedMembers([])
    } finally {
      setIsSearchingMembers(false)
    }
  }, [localCard?._id])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (memberSearchTerm.trim()) searchMembers(memberSearchTerm)
      else setSearchedMembers([])
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [memberSearchTerm, searchMembers])

  useEffect(() => {
    setLocalCard(card)
    setDescValue(card?.description || "")
    setCardName(card?.name)
    setIsCompleted(card?.isCompleted || false)
  }, [card])
  useEffect(() => {
    if (card?.attachments && Array.isArray(card?.attachments)) {
      setAttachments(card.attachments as Attachment[])
    } else {
      setAttachments([])
    }
  }, [card?._id])

  useEffect(() => {
    const nextStart = parseDateValue(localCard?.startDate)
    const nextDue = parseDateValue(localCard?.dueDate)
    setStartDate(nextStart)
    setIsStartDateEnabled(Boolean(nextStart))
    setDueDate(nextDue)
    setHasDueDate(Boolean(nextDue))
  }, [localCard?.startDate, localCard?.dueDate])

  useEffect(() => {
    const fetchTags = async () => {
      setFetchedTagData([])
      setIsFetchingTags(true)
      try {
        const token = localStorage.getItem("garage_tok");
        const response = await fetch(`${process.env.NEXT_PUBLIC_TASKROOM_URL}tags?spaceId=${Idspace}&size=100`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await response.json();
        if (!response.ok || data.status === false) throw new Error(data.message || "Failed");
        setFetchedTagData(data?.data)
      } catch (error) {
        console.error(`Error fetching tag:`, error)
      } finally {
        setIsFetchingTags(false)
      }
    }
    if (isLabelPopoverOpen) fetchTags()
  }, [isLabelPopoverOpen, boardId])

  const handleCommentCountChange = (diff: number) => {
    setColumns?.(prev => prev.map(col => ({
      ...col,
      cards: col.cards.map(c => {
        if (c._id === localCard?._id) return { ...c, commentCount: (c.commentCount || 0) + diff }
        return c
      })
    })))
  }

  const checkToken = () => {
    const token = localStorage.getItem("garage_tok");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.exp) {
          const currentTime = Math.floor(Date.now() / 1000)
          if (currentTime >= payload.exp) {
            setShowExpiredDialog(true)
            return false
          }
        }
      } catch (e) {
        console.error("Failed to decode token", e)
      }
    }
    return true
  }

  const getMemberId = (member: any) => member?._id || member?.id || member?.userId
  const assignedMemberIds = new Set((assignCardMemberlist || []).map((m: any) => getMemberId(m)).filter(Boolean))

  const handleToggleComplete = async () => {
    if (blockIfReadOnly()) return
    if (!checkToken()) return
    const newStatus = !isCompleted
    try {
      setIsCompleted(newStatus)
      await toggleComplete(localCard?._id, newStatus, undefined, undefined)
      emitPatched({ _id: localCard?._id, isCompleted: newStatus as any })
      toast.success(newStatus ? "Marked as complete" : "Marked as incomplete")
    } catch (error) {
      setIsCompleted(!newStatus)
      toast.error("Failed to update status")
    }
  }

  const handlePriorityChange = async (newPriority: string | null) => {
    if (blockIfReadOnly()) return;
    if (!checkToken()) return;
    try {
      const socketId = undefined;
      await updateCard(localCard?._id, { priority: newPriority, socketId } as any);
      emitPatched({ _id: localCard?._id, priority: (newPriority || undefined) as any })
      toast.success("Priority updated");
    } catch (error) {
      toast.error("Failed to update priority");
    }
  };
  // const toggleMember = async (member: any) => {
  //   if (blockIfReadOnly()) return
  //   if (!checkToken()) return
  //   const memberId = member?._id;
  //   if (togglingMemberIds.size > 0) return
  //   setTogglingMemberIds(prev => new Set(prev).add(memberId))

  //   try {
  //     const apiPayload = [...(assignCardMemberlist.map(member => member._id) || []), memberId];
  //     const socketId = undefined;
  //     const notificationSocketId = undefined;
  //     await updateCard(card?._id, { assignedToIds: apiPayload as any, socketId, userAssignedToIds: memberId })
  //     removeMembersForCards(memberId)
  //     setAssignedMembers([...(assignCardMemberlist || []), member]);
  //     setColumns(prev => prev.map(col => ({
  //       ...col,
  //       cards: col.cards.map(c => {
  //         if (c._id === card?._id) {
  //           const newMemberObj = { _id: memberId, name: member?.name, email: member?.email, userId: memberId };
  //           const currentMembers = (c.members || []).filter(m => m._id !== memberId);
  //           return { ...c, members: [...currentMembers, newMemberObj], assignedToIds: apiPayload as any };
  //         }
  //         return c;
  //       })
  //     })));
  //   } catch (error) {
  //     toast.error("Failed to toggle member")
  //   } finally {
  //     setTogglingMemberIds(prev => {
  //       const next = new Set(prev)
  //       next.delete(memberId)
  //       return next
  //     })
  //   }
  // }


  const toggleMember = async (member: any) => {
    if (blockIfReadOnly()) return
    if (togglingMemberIds.size > 0) return

    const memberId = getMemberId(member)
    if (!memberId) return

    setTogglingMemberIds(prev => new Set(prev).add(memberId))

    try {
      const currentIds = (assignCardMemberlist || []).map((m: any) => getMemberId(m)).filter(Boolean as any)
      const isAssigned = assignedMemberIds.has(memberId)
      const updatedIds = isAssigned ? currentIds.filter((id: string) => id !== memberId) : Array.from(new Set([...currentIds, memberId]))
      const apiPayload = updatedIds
      const socketId = undefined

      const payload: any = { assignedToIds: apiPayload, socketId }
      if (isAssigned) {
        payload.userRemoveAssignedToIds = memberId
      } else {
        payload.userAddAssignedToIds = memberId
        payload.userAssignedToIds = memberId
      }

      await updateCard(localCard?._id, payload)

      const updatedAssignedMembers = isAssigned
        ? (assignCardMemberlist || []).filter((m: any) => getMemberId(m) !== memberId)
        : [...(assignCardMemberlist || []), member]

      setAssignedMembers(updatedAssignedMembers)
      emitPatched({ _id: localCard?._id, assignedToIds: apiPayload as any } as any)

      setColumns(prev => prev.map(col => ({
        ...col,
        cards: col.cards.map(c => {
          if (c._id === card._id) {
            const currentMembers = (c.members || []).filter((m: any) => getMemberId(m) !== memberId)
            const newMembers = isAssigned ? currentMembers : [...currentMembers, { _id: memberId, name: member?.name, email: member?.email, image: member?.image, userId: memberId }]
            return { ...c, members: newMembers, assignedToIds: apiPayload as any }
          }
          return c
        })
      })))
    } catch (error) {
      console.error("Error toggling member:", error)
      toast.error("Failed to toggle member")
    } finally {
      setTogglingMemberIds(prev => {
        const next = new Set(prev)
        next.delete(memberId)
        return next
      })
    }
  }

  const handleDelete = async () => {
    if (blockIfReadOnly()) return
    if (!checkToken()) return
    if (confirm("Do you want to delete this task?")) {
      await deleteCard(localCard?._id, localCard?.stageId)
      setColumns?.((prev) => prev.map((col) => {
        if (col._id === localCard?.stageId) {
          return { ...col, cards: col.cards.filter((c) => c._id !== localCard?._id), localCardCount: Math.max((col.localCardCount || 0) - 1, 0) }
        }
        return col
      }))
      decrementCardCount(boardId);
      onClose()
    }
  }

  const handleSaveDesc = async () => {
    if (blockIfReadOnly()) return
    if (!checkToken()) return
    if (descValue !== localCard?.description) {
      const socketId = undefined;
      try {
        await updateCard(localCard?._id, { description: descValue, socketId })
        emitPatched({ _id: localCard?._id, description: descValue })
        setIsEditingDesc(false)
      } catch (error) {
        // error handling is done in updateCard
      }
    } else {
      setIsEditingDesc(false)
    }
  }

  const handleWriteWithAi = async () => {
    if (blockIfReadOnly()) return
    if (!cardName?.trim()) {
      toast.error("Enter a task name first.")
      return
    }

    setIsEditingDesc(true)
    setIsGeneratingDescription(true)
    try {
      const workspaceName = roomContext
        ? roomContext.workspaceName || ""
        : (currentWorkspace as any)?.name || (currentWorkspace as any)?.workspacename || ""

      const res = await fetch("/api/taskroom/generate-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("garage_tok") || ""}`,
        },
        body: JSON.stringify({
          taskName: cardName.trim(),
          workspaceName: workspaceName || undefined,
          spaceName: spaceName || undefined,
          roomName: roomName || undefined,
          taskType: "task",
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Failed to generate description.")
      }

      setDescValue(data.description || "")
      setTimeout(() => textareaRef.current?.focus(), 0)
    } catch (err) {
      console.error("Failed to generate task description", err)
      toast.error(
        err instanceof Error ? err.message : "Failed to generate description."
      )
    } finally {
      setIsGeneratingDescription(false)
    }
  }

  const currentTagIds = ((localCard as any)?.tags || []) as any[];
  const displayTagData = (((localCard as any)?.tagData || []) as any[])
  const [togglingTagId, setTogglingTagId] = useState<string | null>(null);

  const formatInputDate = (date?: Date) => date ? format(date, "yyyy-MM-dd") : ""
  const toStartOfDayMs = (date: Date) => { const copy = new Date(date); copy.setHours(0, 0, 0, 0); return copy.getTime() }
  const toEndOfDayMs = (date: Date) => { const copy = new Date(date); copy.setHours(23, 59, 59, 999); return copy.getTime() }
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const applyDateUpdate = async (payload: { startDate: number | null; dueDate: number | null }) => {
    const socketId = undefined;
    await updateCard(localCard?._id, { ...payload, socketId } as any)
    const nextStart = payload.startDate ?? undefined
    const nextDue = payload.dueDate ?? undefined
    emitPatched({ _id: localCard?._id, startDate: nextStart as any, dueDate: nextDue as any })
  }

  const handleSaveDates = async () => {
    if (blockIfReadOnly()) return
    if (!checkToken()) return
    if (isStartDateEnabled && !startDate) { toast.error("Start date is required"); return }
    if (hasDueDate && !dueDate) { toast.error("Due date is required"); return }
    if (startDate && dueDate && dueDate < startDate) { toast.error("Due date cannot be earlier than start date"); return }
    const payload = {
      startDate: isStartDateEnabled && startDate ? toStartOfDayMs(startDate) : null,
      dueDate: hasDueDate && dueDate ? toEndOfDayMs(dueDate) : null
    }
    setIsSavingDates(true)
    try {
      await applyDateUpdate(payload)
    } catch (error) {
      toast.error("Failed to update dates")
    } finally {
      setIsSavingDates(false)
    }
  }

  const handleRemoveDates = async () => {
    if (blockIfReadOnly()) return
    if (!checkToken()) return
    setStartDate(undefined); setDueDate(undefined); setIsStartDateEnabled(false); setHasDueDate(false)
    setIsSavingDates(true)
    try {
      await applyDateUpdate({ startDate: null, dueDate: null })
    } catch (error) {
      toast.error("Failed to remove dates")
    } finally {
      setIsSavingDates(false)
    }
  }

  const handleToggleTag = async (tag: { _id?: string; name: string; color: string }) => {
    if (blockIfReadOnly()) return
    if (!checkToken()) return
    if (!tag._id || togglingTagId) return

    const isSelected = displayTagData.some((t) => t._id === tag._id)
    setTogglingTagId(tag._id)

    try {
      if (isSelected) {
        const newTagIds = currentTagIds.filter((tid) => tid !== tag._id)
        await updateCard(localCard?._id, { tags: newTagIds } as any)
        emitPatched({
          _id: localCard?._id,
          tags: newTagIds as any,
          tagData: (((localCard as any).tagData || []) as any[]).filter((t: any) => t._id !== tag._id) as any,
        } as any)
        return
      }

      const newTagIds = [...currentTagIds, tag._id]
      const socketId = undefined
      await updateCard(localCard?._id, { tags: newTagIds, socketId, tagItemIds: tag._id } as any)
      emitPatched({
        _id: localCard?._id,
        tags: newTagIds as any,
        tagData: [...((localCard as any).tagData || []), { _id: tag._id, name: tag.name, color: tag.color }] as any,
      } as any)
    } catch {
      toast.error(isSelected ? "Failed to remove tag" : "Failed to add tag")
    } finally {
      setTogglingTagId(null)
    }
  }

  const handleCreateLabel = async () => {
    if (blockIfReadOnly()) return
    if (!checkToken()) return
    if (!newLabelName.trim()) return
    setIsTagLoading(true)
    if (isEditingLabel && editingTagId) {
      const renamedTag = { _id: editingTagId, name: newLabelName.trim(), color: selectedColor };
      if (fetchedTagData.length > 0) {
        setFetchedTagData(fetchedTagData.map(t => t._id === editingTagId ? { ...t, name: renamedTag.name, color: renamedTag.color } : t))
      }
      await updateTagApi(editingTagId, { name: newLabelName.trim(), color: selectedColor, socketId: undefined });
      setColumns?.(prev => prev.map(col => ({
        ...col,
        cards: col.cards.map(c => {
          const hasTag = (c.tagData || []).some(t => t._id === editingTagId);
          if (hasTag) return { ...c, tagData: c.tagData.map(t => t._id === editingTagId ? { ...t, name: renamedTag.name, color: renamedTag.color } : t) }
          return c;
        })
      })));
      setIsEditingLabel(false); setEditingTagId(null);
    } else {
      const socketId = undefined;
      const newTag = await createTag({ boardId, spaceId: (Idspace || "") as any, name: newLabelName.trim(), color: selectedColor, socketId: socketId } as any)
      if (newTag) {
        setFetchedTagData([...fetchedTagData, { _id: newTag._id, name: newTag.name, color: newTag.color }])
      }
    }
    setNewLabelName(""); setIsCreatingLabel(false); setIsTagLoading(false)
  }

  const startEditLabel = (tag: any) => {
    if (blockIfReadOnly()) return
    setNewLabelName(tag.name)
    setSelectedColor(resolveTagColorForPicker(tag.color))
    setEditingTagId(tag._id)
    setIsEditingLabel(true)
    setIsCreatingLabel(true)
  }

  const handleDeleteTag = async (id: string) => {
    if (blockIfReadOnly()) return
    if (!checkToken()) return

    setIsTagLoading(true)
    try {
      const success = await deleteTagApi(id)
      if (!success) return

      setFetchedTagData((prev) => prev.filter((t) => t._id !== id))
      setColumns?.((prev) =>
        prev.map((col) => ({
          ...col,
          cards: col.cards.map((c) => ({
            ...c,
            tags: (c.tags || []).filter((tid) => tid !== id),
            tagData: (c.tagData || []).filter((t) => t._id !== id),
          })),
        }))
      )
      setLocalCard((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          tags: ((prev as any).tags || []).filter((tid: string) => tid !== id),
          tagData: ((prev as any).tagData || []).filter((t: any) => t._id !== id),
        } as any
      })
      setIsEditingLabel(false)
      setEditingTagId(null)
      setIsCreatingLabel(false)
      setIsLabelPopoverOpen(false)
    } finally {
      setIsTagLoading(false)
    }
  }

  const requestDeleteTag = () => {
    if (!editingTagId) return
    const tagName =
      fetchedTagData.find((t) => t._id === editingTagId)?.name ||
      newLabelName.trim() ||
      "this label"
    setDeleteTagTarget({ _id: editingTagId, name: tagName })
  }

  const confirmDeleteTag = async () => {
    if (!deleteTagTarget) return
    await handleDeleteTag(deleteTagTarget._id)
    setDeleteTagTarget(null)
  }

  const handleRemoveTagFromCard = (label: { _id: string; name: string; color: string }) => {
    handleToggleTag(label)
  }

  const handleLabelPopoverChange = (open: boolean) => {
    setIsLabelPopoverOpen(open)
    if (!open) {
      setIsCreatingLabel(false)
      setIsEditingLabel(false)
      setEditingTagId(null)
      setNewLabelName("")
      setSearchLabel("")
    }
  }

  const filteredTagOptions = fetchedTagData.filter((tag) =>
    tag.name.toLowerCase().includes(searchLabel.toLowerCase())
  )

  const handleSaveAttachments = async (newAttachments: Attachment[]) => {
    if (blockIfReadOnly()) return
    if (!checkToken()) return
    try {
      const token = localStorage.getItem("garage_tok");
      if (!token) { toast.error("Authentication token missing"); return }
      const attachmentsPayload = newAttachments.map((att) => ({
        ...(att._id && { _id: att._id }),
        link: att.link,
        name: att.name,
        fileType: att.fileType
      }))
      const response = await fetch(`${TASKROOM_API_URL}attachments/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId: boardId, taskId: card?._id, attachments: attachmentsPayload }),
      })
      const data = await response.json()
      if (!response.ok || data.status === false) {
        toast.error(data.message || "Failed to save attachments")
        return
      }

      const savedFromApi: Attachment[] = (data?.data || []).map((att: any) => ({
        _id: att._id || att.id,
        link: att.link || att.fileUrl || "",
        name: att.name || att.fileName || "",
        fileType: (att.fileType || "document") as Attachment["fileType"],
        comment: att.comment || "",
        fileSize: att.fileSize || att.size,
        uploadedAt: att.createdAt || att.uploadedAt,
      }))

      const newLinks = new Set(newAttachments.map((a) => a.link))
      const merged = [
        ...attachments.filter((a) => !newLinks.has(a.link)),
        ...(savedFromApi.length > 0 ? savedFromApi : newAttachments),
      ]

      setAttachments(merged)

      // Update columns with new attachment data
      setColumns?.((prev) => prev.map((col) => ({
        ...col,
        cards: col.cards.map((c) =>
          c._id === card?._id ? { ...c, attachments: merged } : c
        )
      })))

      // Emit patched event with updated attachments
      emitPatched({ _id: localCard?._id, attachments: merged as any })

      toast.success("Attachments saved successfully")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save attachments")
    }
  }

  const avatarColors = [
    "bg-gradient-to-br from-gray-800 to-gray-900",
    "bg-gradient-to-br from-gray-900 to-black",
    "bg-gradient-to-br from-zinc-800 to-zinc-950",
    "bg-gradient-to-br from-neutral-800 to-neutral-900",
    "bg-gradient-to-br from-slate-700 to-slate-900",
  ]

  const handleModalClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.closest('input') || target.closest('textarea') || target.closest('button') || target.closest('[role="button"]')) return;
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      (document.activeElement as HTMLElement).blur();
    }
  };

  function getDueDateWithStatus(dueDate) {
    if (!dueDate) return { text: "No due date", isOverdue: false };
    const ts = Number(dueDate);
    if (isNaN(ts)) return { text: "Invalid date", isOverdue: false };
    const due = new Date(ts);
    const now = new Date();
    const formatted = due.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
    const isOverdue = due < now;
    let text = formatted;
    if (isOverdue) text += " (overdue)";
    return { text, isOverdue };
  }

  const { text, isOverdue } = getDueDateWithStatus(localCard?.dueDate);

  const formatDateDisplay = (date?: Date | number) => {
    if (!date) return null
    const d = typeof date === 'number' ? new Date(date) : date
    return format(d, "MMM d")
  }

  if (typeof document === "undefined") {
    return null
  }

  return createPortal(
    (
      <div className="fixed inset-0 z-[9999]">
        <div
          aria-hidden
          className="absolute inset-0 bg-black/60"
          onClick={onClose}
        />
        <div className="absolute inset-0 flex items-stretch justify-center pointer-events-none sm:items-start sm:pt-6 sm:px-4">
          <Dialog open={showExpiredDialog} onOpenChange={setShowExpiredDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Session Expired</DialogTitle>
                <DialogDescription>Your session has expired. Please log in again to continue.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => router.push("/login")}>Login</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={!!deleteTagTarget} onOpenChange={(open) => !open && setDeleteTagTarget(null)}>
            <AlertDialogContent className="bg-[#111116] border-[#e5e7eb29] text-white">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete label?</AlertDialogTitle>
                <AlertDialogDescription className="text-white/50">
                  Do you want to delete the label{" "}
                  <span className="font-semibold text-white/80">&quot;{deleteTagTarget?.name}&quot;</span>? This will
                  remove it from all cards in this space.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-[#343439] text-white/50 border-none hover:bg-[#343439]/80 hover:text-white">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={async (e) => {
                    e.preventDefault()
                    await confirmDeleteTag()
                  }}
                  disabled={isTagLoading}
                  className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                >
                  {isTagLoading ? "Deleting..." : "Delete label"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div
            className="pointer-events-auto relative z-10 w-full h-[100dvh] sm:w-[min(98vw,1600px)] sm:h-[92vh] max-w-full flex flex-col bg-[#111116] text-white/50 rounded-none sm:rounded-lg shadow-2xl border-0 sm:border border-[#e5e7eb29] overflow-hidden"
            onClick={(e) => { e.stopPropagation(); handleModalClick(e); }}
            tabIndex={-1}
          >
            {/* ── TOP TOOLBAR ── */}
            <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2 border-b border-[#e5e7eb29] bg-[#111116] shrink-0">
              <div className="flex items-center gap-1.5 min-w-0 text-[13px]">
                {spaceName ? (
                  <span className="truncate text-white/50" title={capitalizeLabel(spaceName)}>
                    {capitalizeLabel(spaceName)}
                  </span>
                ) : null}
                {spaceName && roomName ? (
                  <ChevronRight className="w-3 h-3 shrink-0 text-white/30" aria-hidden />
                ) : null}
                {roomName ? (
                  <span className="truncate text-white/80 font-medium" title={capitalizeLabel(roomName)}>
                    {capitalizeLabel(roomName)}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={handleDelete}
                  className="p-1.5 text-white hover:text-white hover:/5 rounded transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={async () => {
                    const roomId = roomContext
                      ? boardId
                      : searchParams.get("shareTask") ? searchParams.get('roomId') : currentRoomDetail?._id;
                    let orgId: string | undefined;
                    const tok = localStorage.getItem("garage_tok");
                    if (tok) {
                      try {
                        orgId = jwtDecode<JwtPayload>(tok).orgId;
                      } catch { }
                    }
                    const params = new URLSearchParams();
                    if (orgId) params.set("orgId", orgId);
                    if (workspaceId) params.set("workspaceId", workspaceId);
                    if (Idspace) params.set("spaceId", Idspace);
                    if (roomId) params.set("roomId", roomId);
                    if (card?._id) params.set("shareTask", card._id);

                    const longUrlshare = `https://my.garage.app/taskroom/backOffice/athena?${params.toString()}`;
                    setSharedLongUrl(longUrlshare);

                    const currentUserToken = localStorage.getItem("garage_tok");
                    let assignedBy = "";
                    if (currentUserToken) {
                      try {
                        const payload = jwtDecode<JwtPayload>(currentUserToken);
                        assignedBy = payload.name || payload.email || "";
                      } catch {
                        assignedBy = "";
                      }
                    }

                    const assignedTo = (assignCardMemberlist || [])
                      .map((member) => member?.name || member?.userData?.name || member?.email)
                      .filter(Boolean) as string[];

                    const ogPayload = {
                      title: card?.name || "",
                      description: card?.description || "",
                      assignedBy: assignedBy || undefined,
                      assignedTo: assignedTo.length > 0 ? assignedTo : undefined,
                    };

                    params.set("og", encodeURIComponent(JSON.stringify(ogPayload)));
                    const longUrl = `https://my.garage.app/taskroom/backOffice/athena?${params.toString()}`;

                    setIsGeneratingShortUrl(true);
                    try {
                      const token = localStorage.getItem("garage_tok");
                      const response = await fetch(`${process.env.NEXT_PUBLIC_TASKROOM_URL || "https://my.garage.app/taskroomv2/v2/"}short/urls`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                        // Include the OG payload explicitly so the short-URL
                        // service can persist it and return it later. That
                        // allows the short page to render server-side meta
                        // tags using the same payload.
                        body: JSON.stringify({ longurl: longUrl, og: ogPayload }),
                      });

                      if (!response.ok) {
                        throw new Error(`Short URL generation failed (${response.status})`);
                      }

                      const data = await response.json();
                      const shortUrl = data?.shortUrl || data?.shortURL || data?.url || data?.data?.shortUrl;
                      if (!shortUrl || typeof shortUrl !== "string") {
                        throw new Error("Invalid short URL response");
                      }

                      await navigator.clipboard.writeText(shortUrl);
                      toast.success("Short link generated and copied to clipboard");
                    } catch (error) {
                      console.error(error);
                      // toast.error("Unable to generate short URL. Please try again.");
                    } finally {
                      setIsGeneratingShortUrl(false);
                    }
                  }}
                  className="p-1.5 text-white hover:text-white hover:/5 rounded transition"
                  disabled={isGeneratingShortUrl}
                >
                  {isGeneratingShortUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                </button>
                {/* <button className="p-1.5 text-white/50 hover:text-white/50 hover:/5 rounded transition"><Maximize2 className="w-4 h-4" /></button>
                <button className="p-1.5 text-white/50 hover:text-white/50 hover:/5 rounded transition"><MoreHorizontal className="w-4 h-4" /></button> */}
                <div className="w-px h-4 bg-[#2e2e38] mx-1" />
                <button onClick={onClose} className="p-1.5 text-white hover:text-white hover:/5 rounded transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabs: visible on all screens, but Details tab hidden on sm+ */}
            <div className="flex border-b border-[#e5e7eb29] bg-[#111116] shrink-0">
              <button
                onClick={() => setMobilePanel('details')}
                className={`flex-1 sm:hidden px-4 py-3 text-sm font-medium transition ${mobilePanel === 'details'
                  ? 'text-white border-b-2 border-brand'
                  : 'text-white/50 hover:text-white/70'
                  }`}
              >
                Details
              </button>
              <button
                onClick={() => setMobilePanel('activity')}
                className={`flex-1 sm:hidden px-4 py-3 text-sm font-medium transition ${mobilePanel === 'activity'
                  ? 'text-white border-b-2 border-brand'
                  : 'text-white/50 hover:text-white/70'
                  }`}
              >
                Activity
              </button>
            </div>

            {/* ── MAIN CONTENT AREA ── */}
            <div className="flex flex-1 min-h-0 overflow-hidden flex-col sm:flex-row">

              {/* ── LEFT: Main task content ── */}
              <div className={`flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 ${mobilePanel === 'activity' ? 'max-sm:hidden' : ''}`}>

   <div className="mb-6">
                  <textarea
                    ref={titleRef}
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.currentTarget.blur()
                      }
                    }}
                    onBlur={async () => {
                      if (blockIfReadOnly()) return;
                      if (!checkToken()) return;
                      if (cardName !== localCard?.name) {
                        const socketId = undefined;
                        try {
                          await updateCard(localCard?._id, { title: cardName, socketId });
                          emitPatched({ _id: localCard?._id, name: cardName })
                        } catch (error) {
                          setCardName(localCard?.name);
                        }
                      }
                    }}
                    disabled={isReadOnly}
                    className="w-full text-xl sm:text-2xl font-semibold text-white bg-transparent outline-none border-none focus:ring-0 placeholder-[#444] leading-tight resize-none overflow-hidden py-0"
                    placeholder="Task name"
                    rows={1}
                  />
                </div>
                {/* ── FIELD ROWS (ClickUp style grid) ── */}
                <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 lg:gap-x-10 gap-y-1">





                  {/* Left column */}
                  <div className="space-y-1">

                  {/* Status Row */}

                  {
                    localCard?.stageId &&
                    <div className="flex items-center py-2 rounded hover:/[0.03] transition group">
                      <div className="flex items-center gap-2 w-40 text-white font-semi shrink-0 text-sm text-white">
                        <CircleDot className="w-3.5 h-3.5" />
                        <span>Status</span>
                      </div>
                      <StatusPicker
                        status={localCard?.stageId}
                        roomId={boardId}
                        onSelect={async (newStageId, stage) => {
                          if (blockIfReadOnly()) return;
                          if (!checkToken()) return;

                          if (newStageId === localCard?.stageId) return;

                          try {
                            // Call updateCard API
                            const socketId = undefined;
                            await updateCard(localCard?._id, { stageId: newStageId, socketId } as any);
                            if (stage) {
                              setStageData({ type: stage.stageType || '', name: stage.name || '' })
                              emitPatched({
                                _id: localCard?._id,
                                stageId: newStageId as any,
                                stageData: { name: stage.name, color: stage.color, stageType: stage.stageType },
                              })
                            } else {
                              emitPatched({ _id: localCard?._id, stageId: newStageId as any })
                            }

                            // If this is a top-level card in a stage (board view),
                            // keep the existing move behavior as well.
                            setColumns?.(prev => {
                              let updatedCard: any = { ...localCard, stageId: newStageId };
                              return (prev || []).map((col: any) => {
                                if (col._id === localCard?.stageId) {
                                  const cards = col.cards || [];
                                  const cardToMove = cards.find((c: any) => c._id === localCard?._id);
                                  if (cardToMove) updatedCard = { ...cardToMove, stageId: newStageId };
                                  return { ...col, cards: cards.filter((c: any) => c._id !== localCard?._id) };
                                } else if (col._id === newStageId) {
                                  return { ...col, cards: [...(col.cards || []), updatedCard] };
                                }
                                return col;
                              });
                            })

                            toast.success("Status updated successfully");
                          } catch (error) {
                            toast.error("Failed to update status");
                          }
                        }}
                      >
                        <button
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-semibold transition bg-[#0a0a0d] text-white/50 border border-[#e5e7eb29]  hover:border-[#e5e7eb29]`}
                        >
                          {stageData ? (
                            <>
                              <span
                                className={`w-2 h-2 rounded-full inline-block ${stageData.type === 'tostart' ? 'bg-slate-400' :
                                  stageData.type === 'active' ? 'bg-[#0a0a0d]' :
                                    stageData.type === 'done' ? 'bg-green-400' :
                                      stageData.type === 'closed' ? 'bg-red-400' :
                                        'bg-yellow-400'
                                  }`}
                              />
                              {stageData.name}
                            </>
                          ) : (
                            <><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /></>
                          )}
                        </button>
                      </StatusPicker>
                    </div>
                  }

                  <div className="flex items-center py-2 rounded hover:/[0.03] transition group">
                    <div className="flex items-center gap-2 w-40  font-semi shrink-0 text-sm text-white">
                      <Flag className="w-3.5 h-3.5" />
                      <span>Priority</span>
                    </div>
                    <PriorityPicker
                      priority={localCard?.priority}
                      onSelect={handlePriorityChange}
                    >
                      <button
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-semibold transition bg-[#0a0a0d] text-white/50 border border-[#e5e7eb29] hover:border-[#e5e7eb29]"
                        disabled={isReadOnly}
                      >
                        {localCard?.priority ? (
                          <span className="flex items-center gap-1.5 capitalize">
                            <Flag className={`w-3.5 h-3.5 ${localCard?.priority === 'urgent' ? 'text-red-600 fill-red-600' : localCard?.priority === 'high' ? 'text-amber-500 fill-amber-500' : localCard?.priority === 'normal' ? 'text-blue-500 fill-blue-500' : 'text-white/50 fill-slate-500'}`} />
                            {localCard?.priority}
                          </span>
                        ) : (
                          <span className="text-white/50 hover:text-white/50 flex items-center gap-1.5 ">
                            <Flag className="w-3.5 h-3.5" />
                            Empty
                          </span>
                        )}
                      </button>
                    </PriorityPicker>
                  </div>


                  {/* <div className="flex items-center gap-2 w-40 text-white/500 font-semi shrink-0 text-sm text-white/50">
                <CircleDot className="w-3.5 h-3.5" />
                <span>Time estimate</span>
              </div>

              <div className="flex items-center gap-2 w-40 text-white/500 font-semi shrink-0 text-sm text-white/50">
                <CircleDot className="w-3.5 h-3.5" />
                <span>Track time</span>
              </div>
           */}

                  <TimeEstimate
                    cardId={localCard?._id}
                    initialEstimate={(localCard as any)?.timeEstimate}
                    isReadOnly={isReadOnly}
                    onSave={async (seconds) => {
                      const socketId = undefined
                      await updateCard(localCard?._id, { timeEstimate: seconds, socketId } as any)
                      emitPatched({ _id: localCard?._id, timeEstimate: (seconds ?? undefined) as any } as any)
                    }}
                  />

                  <TrackTime
                    cardId={localCard?._id}
                    userId={userId}
                    roomId={boardId}
                    isReadOnly={isReadOnly}
                    estimate={(localCard as any)?.timeEstimate}
                    onEntriesChange={(entries) => {
                      emitPatched({ _id: localCard?._id, timeEntries: entries as any } as any)
                    }}
                  />

                  </div>

                  {/* Right column */}
                  <div className="space-y-1">

                  {/* Assignees Row */}
                  <div className="flex items-center py-2 rounded hover:/[0.03] transition group">
                    <div className="flex items-center gap-2 w-40  text-white font-semi shrink-0 text-sm text-white">
                      <Users className="w-3.5 h-3.5" />
                      <span>Assignees</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isLoadingAssign ? (
                        Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="w-6 h-6 rounded-full" />)
                      ) : assignCardMemberlist.length > 0 ? (
                        assignCardMemberlist.map((m, i) => {
                          const initials = m?.name ? m.name.split(" ").slice(0, 2).map(n => n[0]?.toUpperCase()).join("") : "?"
                          const memberId = m?._id;
                          const avatarUrl = m?.image;
                          return (
                            <div key={memberId} className="relative group/avatar">
                              <div className="w-6 h-6 rounded-full bg-[#0a0a0d] flex items-center justify-center text-[10px] font-bold text-white/50 cursor-pointer overflow-hidden" title={m.name || m.email}>
                                {avatarUrl ? (
                                  <img src={avatarUrl} alt={m.name || m.email} className="w-full h-full object-cover" />
                                ) : (
                                  initials
                                )}
                              </div>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (blockIfReadOnly()) return
                                  if (!checkToken()) return
                                  if (!confirm(`Remove ${m.name || m.email}?`)) return;
                                  try {
                                    const updatedIds = assignCardMemberlist.filter((mem) => (mem._id || mem.userId) !== memberId).map((mem) => mem._id);
                                    const socketId = undefined;
                                    await updateCard(localCard?._id, { assignedToIds: updatedIds as any, socketId, userRemoveAssignedToIds: m?._id });
                                    if (memberId) removeAssignedMember(memberId);
                                    emitPatched({ _id: localCard?._id, assignedToIds: updatedIds as any } as any)

                                    // Update board columns/cards so the Kanban view reflects removed member
                                    setColumns?.((prev) => prev?.map((col) => ({
                                      ...col,
                                      cards: Array.isArray(col?.cards)
                                        ? col.cards.map((c) => {
                                          if (c._id === localCard?._id) {
                                            const currentMembers = (c.members || []).filter((mem) => (mem._id || mem?.userId) !== memberId);
                                            return { ...c, members: currentMembers, assignedToIds: updatedIds as any };
                                          }
                                          return c;
                                        })
                                        : col.cards,
                                    })));

                                    toast.success("Member removed");
                                  } catch (err) { toast.error("Failed to remove member"); }
                                }}
                                className="absolute -top-1.5 -right-1.5 opacity-0 group-hover/avatar:opacity-100 bg-[#2a2a3a] border border-[#e5e7eb29]  rounded-full w-3.5 h-3.5 flex items-center justify-center transition z-10"
                              >
                                <X className="w-2 h-2" />
                              </button>
                            </div>
                          );
                        })
                      ) : null}

                      {/* Add member button */}
                      <Popover onOpenChange={async (open) => {
                        if (open) {
                          setIsMembersLoading(true); setMemberSearchTerm(""); setSearchedMembers([])
                          await fetchMembersForCards(localCard?._id); setIsMembersLoading(false)
                        } else { setMemberSearchTerm(""); setSearchedMembers([]) }
                      }}>
                        <PopoverTrigger asChild>
                          <button className="w-6 h-6 rounded-full border border-dashed border-[#e5e7eb29]  flex items-center justify-center text-white/50 hover:text-white/50 hover:border-[#666] transition" disabled={isReadOnly}>
                            <Plus className="w-3 h-3" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="bottom" align="start" className="w-64 p-0 bg-[#0a0a0d] border-[#e5e7eb29]  shadow-xl" sideOffset={6}>
                          <div className="p-3">
                            <input type="text" placeholder="Search members..." value={memberSearchTerm} onChange={(e) => setMemberSearchTerm(e.target.value)} className="w-full px-2.5 py-1.5 bg-[#252530] border border-[#e5e7eb29]  rounded text-sm text-white/50 mb-2 focus:outline-none focus:border-[#e5e7eb29]" />
                            <div className="max-h-56 overflow-y-auto space-y-2">
                              {isMembersLoading || isSearchingMembers ? (
                                Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex items-center gap-2 p-2"><Skeleton className="w-6 h-6 rounded-full" /><Skeleton className="h-3 w-24" /></div>)
                              ) : memberSearchTerm.trim() ? (
                                searchedMembers.length > 0 ? searchedMembers.map((member, index) => {
                                  const avatarUrl = member?.image || member?.avatar || member?.userData?.avatar;
                                  const memberId = getMemberId(member)
                                  const isAssigned = assignedMemberIds.has(memberId)
                                  return (
                                    <button
                                      key={memberId}
                                      onClick={() => toggleMember(member)}
                                      disabled={togglingMemberIds.size > 0}
                                      className={cn(
                                        "w-full flex items-center gap-2 p-2 rounded transition text-sm text-left",
                                        isAssigned
                                          ? "bg-amber-400/10 border border-amber-400/20 text-white"
                                          : "text-white/50 hover:bg-white/5"
                                      )}
                                    >
                                      <div className="relative w-6 h-6 rounded-full bg-[#0a0a0d] flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
                                        {avatarUrl ? (
                                          <img src={avatarUrl} alt={member?.name || member?.email} className="w-full h-full object-cover" />
                                        ) : (
                                          member?.name?.substring(0, 2).toUpperCase() || "??"
                                        )}
                                        {/* {isAssigned && (
                                          <div className="absolute -top-2 -right-1 z-[999] h-3.5 w-3.5 bg-[#0a0a0d] z-[999] rounded-full flex items-center justify-center shadow-lg ring-2 ring-[#111116]">
                                            <div className="h-2.5 w-2.5 bg-emerald-500 rounded-full flex items-center justify-center">
                                              <X className="h-1.5 w-1.5 text-white/50" strokeWidth={4} />
                                            </div>
                                          </div>
                                        )} */}
                                      </div>
                                      <span className={cn("truncate", isAssigned ? "text-white" : "text-white/50")}>
                                        {member?.name || member?.email || "Unknown"}
                                      </span>
                                      {isAssigned && (
                                        <span className="ml-auto inline-flex items-center gap-1 text-amber-300 text-xs">
                                          <RefreshCw className="h-3 w-3" />

                                        </span>
                                      )}
                                    </button>
                                  );
                                }) : <div className="text-sm text-white/50 text-center py-3">No members found</div>
                              ) : (
                                cardMembers?.map((member, index) => {
                                  const avatarUrl = member?.image;
                                  const memberId = getMemberId(member)
                                  const isAssigned = assignedMemberIds.has(memberId)
                                  return (
                                    <button
                                      key={memberId}
                                      onClick={() => toggleMember(member)}
                                      disabled={togglingMemberIds.size > 0}
                                      className={cn(
                                        "w-full flex items-center gap-2 p-2 rounded transition text-sm text-left",
                                        isAssigned
                                          ? "bg-amber-400/10 border border-amber-400/20 text-white"
                                          : "text-white/50 hover:bg-white/5"
                                      )}
                                    >
                                      <div className="relative w-6 h-6 rounded-full bg-[#0a0a0d] flex items-center justify-center text-[10px] font-bold text-white/50 shrink-0 overflow-hidden">
                                        {avatarUrl ? (
                                          <img src={avatarUrl} alt={member?.name} className="w-full h-full object-cover" />
                                        ) : (
                                          member?.name?.substring(0, 2).toUpperCase()
                                        )}
                                        {/* {isAssigned && (
                                          <div className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-[#0a0a0d] rounded-full flex items-center justify-center shadow-lg ring-2 ring-[#111116]">
                                            <div className="h-2.5 w-2.5 bg-emerald-500 rounded-full flex items-center justify-center">
                                              <X className="h-1.5 w-1.5 text-white/50" strokeWidth={4} />
                                            </div>
                                          </div>
                                        )} */}
                                      </div>
                                      <span className={cn("truncate", isAssigned ? "text-white" : "text-white/50")}>
                                        {member?.name}
                                      </span>
                                      {isAssigned && (
                                        <span className="ml-auto inline-flex items-center gap-1 text-amber-300 text-xs">
                                          <RefreshCw className="h-3 w-3" />

                                        </span>
                                      )}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Dates Row */}
                  <div className="flex items-center py-2 rounded hover:/[0.03] transition group">
                    <div className="flex items-center gap-2 w-40 text-whitefont-semi shrink-0 text-sm text-white">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Dates</span>
                    </div>
                    <CustomDatePicker
                      startDate={startDate}
                      dueDate={dueDate}
                      onSelect={async (dates) => {
                        if (blockIfReadOnly()) return;
                        if (!checkToken()) return;

                        const payload = {
                          startDate: dates.start ? toStartOfDayMs(dates.start) : null,
                          dueDate: dates.due ? toEndOfDayMs(dates.due) : null
                        };

                        setIsSavingDates(true);
                        try {
                          await applyDateUpdate(payload);
                        } catch (error) {
                          toast.error("Failed to update dates");
                        } finally {
                          setIsSavingDates(false);
                        }
                      }}
                    >
                      <button className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/50 transition" disabled={isReadOnly}>
                        {localCard?.startDate || localCard?.dueDate ? (
                          <span className={`flex items-center gap-1 ${isOverdue ? "text-red-400" : "text-white/50"}`}>
                            {localCard?.startDate && <><PlayCircle className="w-3 h-3 text-green-500" /><span>{formatDateDisplay(Number(localCard?.startDate))}</span></>}
                            {localCard?.startDate && localCard?.dueDate && <span className="text-white/50">→</span>}
                            {localCard?.dueDate && <><Flag className="w-3 h-3 text-red-500" /><span>{formatDateDisplay(Number(localCard?.dueDate))}{isOverdue ? " (overdue)" : ""}</span></>}
                          </span>
                        ) : (
                          <span className="text-white/50 hover:text-white/50">Empty</span>
                        )}
                      </button>
                    </CustomDatePicker>
                  </div>

                  {/* Tags Row */}
                  <div className="flex items-start py-2 rounded hover:bg-white/[0.03] transition group">
                    <div className="flex items-center gap-2 w-40 shrink-0 font-semi text-sm text-white pt-0.5">
                      <Tag className="w-3.5 h-3.5" />
                      <span>Tags</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                      {(localCard as any)?.tagData?.length > 0 ? (
                        (localCard as any).tagData.map((l: any) => (
                          <TagChip
                            key={l._id}
                            label={l}
                            disabled={isReadOnly}
                            onRemove={() => handleRemoveTagFromCard(l)}
                          />
                        ))
                      ) : (
                        <button
                          type="button"
                          onClick={() => !isReadOnly && setIsLabelPopoverOpen(true)}
                          disabled={isReadOnly}
                          className="text-sm text-white/30 hover:text-white/50 transition disabled:cursor-not-allowed"
                        >
                          Add tags
                        </button>
                      )}
                      <Popover open={isLabelPopoverOpen} onOpenChange={handleLabelPopoverChange}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            disabled={isReadOnly}
                            className="h-6 min-w-6 px-1.5 rounded-md border border-dashed border-white/15 flex items-center justify-center text-white/35 hover:text-white/60 hover:border-white/30 hover:bg-white/[0.03] transition disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Manage tags"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0 rounded-xl shadow-2xl bg-[#121218] border border-white/[0.08]" align="start" sideOffset={6}>
                          <div className="flex flex-col max-h-[420px]">
                            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                              <div>
                                <h4 className="font-semibold text-sm text-white/90">
                                  {isCreatingLabel ? (isEditingLabel ? "Edit tag" : "New tag") : "Tags"}
                                </h4>
                                {!isCreatingLabel && (
                                  <p className="text-[11px] text-white/35 mt-0.5">Select tags for this card</p>
                                )}
                              </div>
                              {isCreatingLabel && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsCreatingLabel(false)
                                    setEditingTagId(null)
                                    setIsEditingLabel(false)
                                    setNewLabelName("")
                                  }}
                                  className="p-1.5 hover:bg-white/[0.06] rounded-lg transition"
                                >
                                  <ChevronLeft className="w-4 h-4 text-white/50" />
                                </button>
                              )}
                            </div>

                            <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
                              {isCreatingLabel ? (
                                <div className="space-y-4">
                                  <div>
                                    <label className="text-[11px] font-semibold text-white/45 uppercase tracking-wide block mb-1.5">
                                      Name
                                    </label>
                                    <input
                                      value={newLabelName}
                                      onChange={(e) => setNewLabelName(e.target.value)}
                                      placeholder="Tag name"
                                      className={tagInputClass}
                                      autoFocus
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[11px] font-semibold text-white/45 uppercase tracking-wide block mb-1.5">
                                      Color
                                    </label>
                                    <div className="grid grid-cols-5 gap-2">
                                      {TAG_PRESET_HEX.map((color) => {
                                        const { fontColor } = normalizeTagColor(color)
                                        return (
                                          <button
                                            key={color}
                                            type="button"
                                            onClick={() => setSelectedColor(color)}
                                            className={cn(
                                              "h-8 rounded-lg transition-transform hover:scale-105 relative",
                                              isSameTagColor(selectedColor, color)
                                                ? "ring-2 ring-offset-2 ring-offset-[#121218] ring-white/60"
                                                : "ring-2 ring-transparent"
                                            )}
                                            style={{ backgroundColor: color }}
                                          >
                                            {isSameTagColor(selectedColor, color) && (
                                              <div className="absolute inset-0 flex items-center justify-center">
                                                <Check
                                                  className="w-3.5 h-3.5"
                                                  style={{ color: fontColor === "#FFFFFF" ? "#FFFFFF" : "rgba(0,0,0,0.7)" }}
                                                  strokeWidth={3}
                                                />
                                              </div>
                                            )}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 pt-1">
                                    <span className="text-[11px] text-white/35 uppercase tracking-wide">Preview</span>
                                    <span
                                      className={cn(
                                        "text-[11px] px-2.5 py-1 rounded-md font-semibold border border-black/10",
                                        !newLabelName.trim() && "opacity-80"
                                      )}
                                      style={getTagStyles(selectedColor)}
                                    >
                                      {newLabelName.trim() || "Tag name"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                                    {isEditingLabel ? (
                                      <button
                                        type="button"
                                        onClick={requestDeleteTag}
                                        disabled={isTagLoading}
                                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition disabled:opacity-50"
                                      >
                                        Delete
                                      </button>
                                    ) : (
                                      <span />
                                    )}
                                    <button
                                      type="button"
                                      onClick={handleCreateLabel}
                                      disabled={isTagLoading || !newLabelName.trim()}
                                      className="px-4 py-1.5 bg-brand hover:bg-brand/90 text-brand-foreground rounded-lg text-sm font-semibold transition ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {isTagLoading ? "Saving..." : isEditingLabel ? "Save" : "Create"}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
                                    <input
                                      placeholder="Search tags..."
                                      value={searchLabel}
                                      onChange={(e) => setSearchLabel(e.target.value)}
                                      className={cn(searchTagInputClass, "pl-8")}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    {isFetchingTags ? (
                                      <div className="py-6 flex flex-col items-center gap-2 text-white/40 text-sm">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Loading tags...
                                      </div>
                                    ) : filteredTagOptions.length > 0 ? (
                                      filteredTagOptions.map((tag) => {
                                        const isSelected = displayTagData.some((t) => t._id === tag._id)
                                        return (
                                          <div key={tag._id} className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() => !togglingTagId && handleToggleTag(tag)}
                                              disabled={!!togglingTagId}
                                              className={cn(
                                                "flex-1 flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition text-left min-w-0",
                                                isSelected ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                                              )}
                                            >
                                              <span
                                                className="shrink-0 w-3 h-3 rounded-sm"
                                                style={{ backgroundColor: getTagStyles(tag.color).backgroundColor }}
                                              />
                                              <span className="flex-1 truncate text-[13px] text-white/80 font-medium">{tag.name}</span>
                                              <span
                                                className={cn(
                                                  "shrink-0 w-4 h-4 rounded border flex items-center justify-center transition",
                                                  isSelected ? "bg-brand border-brand" : "border-white/20 bg-transparent"
                                                )}
                                              >
                                                {isSelected && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                                              </span>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                startEditLabel(tag)
                                              }}
                                              className="p-2 text-white/35 hover:text-white/70 hover:bg-white/[0.06] rounded-lg transition shrink-0"
                                              title="Edit tag"
                                            >
                                              <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        )
                                      })
                                    ) : (
                                      <div className="py-8 text-center">
                                        <Tag className="w-5 h-5 text-white/15 mx-auto mb-2" />
                                        <p className="text-sm text-white/35">No tags found</p>
                                        <p className="text-[11px] text-white/25 mt-1">Create one below</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {!isCreatingLabel && (
                              <div className="p-3 border-t border-white/[0.06]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewLabelName(searchLabel)
                                    setIsCreatingLabel(true)
                                  }}
                                  className="w-full py-2 bg-white/[0.04] hover:bg-white/[0.07] text-white/70 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Create new tag
                                </button>
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Created at Row */}
                  {localCard?.createdAt && (
                    <div className="flex items-center py-2 rounded hover:bg-white/[0.03] transition group">
                      <div className="flex items-center gap-2 w-40 shrink-0 font-semi text-sm text-white">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Created At</span>
                      </div>
                      <div className="text-sm text-white/50">
                        <span>
                          {formatCreatedAtDateTime(localCard.createdAt)}{" "}
                          <span className="text-white/40">({getTimeZoneAbbreviation()})</span>
                        </span>
                        {formatCreatedAtElapsed(localCard.createdAt) && (
                          <span className="text-white/40">
                            {" · "}
                            {formatCreatedAtElapsed(localCard.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Time estimate Row */}
                  {/* <div className="flex items-center py-2 rounded hover:/[0.03] transition group">
                <div className="flex items-center gap-2 w-40 shrink-0 text-sm text-white/50">
                  <Timer className="w-3.5 h-3.5" />
                  <span>Time estimate</span>
                </div>
                <span className="text-sm text-white/50">Empty</span>
              </div> */}

                  {/* Track time Row */}
                  {/* <div className="flex items-center py-2 rounded hover:/[0.03] transition group">
                <div className="flex items-center gap-2 w-40 shrink-0 text-sm text-white/50">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Track time</span>
                </div>
                <span className="text-sm text-white/50">Empty</span>
              </div> */}

                  {/* <button className="text-sm text-white/50 hover:text-white/50 transition py-1 flex items-center gap-1">
                <X className="w-3 h-3" /> Collapse empty fields
              </button> */}

                  </div>
                </div>

                {/* ── TASK TITLE ── */}
             

                {/* ── DESCRIPTION ── */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3 text-white/500 font-semi">
                    <AlignJustify className="w-4 h-4 text-white font-semi" />
                    <span className="text-sm font-semi  text-white">Description</span>
                  </div>
                  {isEditingDesc ? (
                    <div className="space-y-2">
                      <div className="relative rounded-lg border border-white/10 bg-[#161616]">
                        <textarea
                          ref={textareaRef}
                          value={descValue}
                          onChange={(e) => setDescValue(e.target.value)}
                          disabled={isGeneratingDescription}
                          className="w-full min-h-[100px] resize-none bg-transparent px-3 py-2.5 pb-10 text-sm text-white/70 placeholder:text-white/30 outline-none"
                          placeholder="Add a description, or write with ✨ AI"
                        />
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={handleWriteWithAi}
                            disabled={isGeneratingDescription || !cardName?.trim()}
                            className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md border border-white/10 bg-[#161616] px-2 py-1 text-[11px] font-medium text-white/55 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isGeneratingDescription ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3" />
                            )}
                            {isGeneratingDescription ? "Writing..." : "Write with AI"}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSaveDesc}
                          disabled={isGeneratingDescription}
                          className="bg-brand hover:bg-brand text-brand-foreground px-4 py-1.5 rounded text-sm font-medium transition disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setDescValue(localCard?.description || ""); setIsEditingDesc(false) }}
                          disabled={isGeneratingDescription}
                          className="text-white/50 hover:/5 px-3 py-1.5 rounded text-sm transition disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div
                        onClick={() => { if (!isReadOnly) setIsEditingDesc(true) }}
                        className={`text-sm text-white/50 min-h-[20px] ${!isReadOnly ? "cursor-text hover:text-white/50" : ""} transition-colors`}
                      >
                        {localCard?.description ? (
                          <p className="whitespace-pre-wrap leading-relaxed break-all">{localCard?.description}</p>
                        ) : (
                          <p className="text-white/50 text-[13px]">Add a description, or write with ✨ AI</p>
                        )}
                      </div>
                      {/* {!isReadOnly && (
                        <button
                          type="button"
                          onClick={handleWriteWithAi}
                          disabled={isGeneratingDescription || !cardName?.trim()}
                          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-[#161616] px-2 py-1 text-[11px] font-medium text-white/55 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isGeneratingDescription ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3" />
                          )}
                          {isGeneratingDescription ? "Writing..." : "Write with AI"}
                        </button>
                      )} */}
                    </div>
                  )}
                </div>
                <div className="mb-8">

                </div>
                <SubtaskManager
                  cardId={card?._id}
                  roomId={boardId}
                  stageId={card?.stageId}
                  isReadOnly={isReadOnly}
                />


                {/* ── ATTACHMENTS ── */}
                <div className="mb-6 mt-6">
                  {/* <div className="flex items-center gap-2 mb-3">
                  <Paperclip className="w-4 h-4 text-white/50" />
                  <span className="text-sm font-semi text-white/50">Attachments</span>
                  <button onClick={() => setShowAttachments(true)} className="ml-auto text-sm text-white/50 bg-[#0a0a0d] hover:text-white/50 transition px-2 cursor-pointer py-1 rounded-[5px]">Add</button>
                </div> */}
                  <CardAttachments
                    cardId={card?._id}
                    boardId={boardId}
                    attachments={attachments}
                    onAttachmentsChange={setAttachments}
                    onSave={handleSaveAttachments}
                    showAttachments={showAttachments}
                    isReadOnly={isReadOnly}
                  />
                </div>

                {/* ── CHECKLIST GROUP ── */}
                <div className="mb-8">
                  <div className="overflow-hidden">
                    {/* ── HEADER ── */}
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        className="flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white transition-colors cursor-pointer"
                        onClick={() => setExpandedChecklistGroup(!expandedChecklistGroup)}
                      >
                        {expandedChecklistGroup
                          ? <ChevronDown size={15} className="text-white/80" />
                          : <ChevronRight size={15} className="text-white/80" />}
                        {/* <CheckSquare className="w-4 h-4 text-white/50" /> */}
                        Checklist Group
                      </button>
                      {expandedChecklistGroup && !isReadOnly && (
                        <button
                          type="button"
                          title={showChecklistAddArea ? "Hide add" : "Add checklist group"}
                          onClick={() => setShowChecklistAddArea(!showChecklistAddArea)}
                          className={`p-1.5 rounded transition-colors ${showChecklistAddArea ? "bg-[#252530] text-white" : "text-white/40 hover:bg-[#252530] hover:text-white/70"}`}
                        >
                          {showChecklistAddArea ? <X size={11} /> : <Plus size={11} />}
                        </button>
                      )}
                    </div>

                    {expandedChecklistGroup && (
                      <div className="pt-4 space-y-4 animate-in fade-in duration-200">
                        {/* ── ADD AREA ── */}
                        {!isReadOnly && showChecklistAddArea && (
                          <div className="space-y-2">
                            <div className="text-[12px] font-semibold text-white/50">New Checklist Group</div>
                            <input
                              type="text"
                              placeholder="Checklist Group Name..."
                              value={newTaskName}
                              onChange={(e) => setNewTaskName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter' && newTaskName.trim() && !isCreatingTask) { createTask(card?._id, newTaskName.trim(), timeSocketService.socketId ?? undefined); setNewTaskName(""); setShowChecklistAddArea(false); } }}
                              disabled={isCreatingTask}
                              className="w-full px-3 py-1  border border-[#e5e7eb29] rounded text-[12px] placeholder:text-[12px] text-white/50 focus:outline-none focus:border-[#e5e7eb29]"
                              autoFocus
                            />
                            <button
                              className="w-full bg-[#0a0a0d] cursor-pointer  hover:bg-[#3a3a41] text-white/50 text-sm font-medium py-1.5 rounded transition disabled:opacity-60"
                              onClick={() => { if (newTaskName.trim() && !isCreatingTask) { createTask(card?._id, newTaskName.trim(), timeSocketService.socketId ?? undefined); setNewTaskName(""); setShowChecklistAddArea(false); } }}
                              disabled={isCreatingTask || !newTaskName.trim()}
                            >
                              {isCreatingTask ? "Adding..." : "Add"}
                            </button>
                          </div>
                        )}

                        {/* ── CHECKLIST GROUPS LIST ── */}
                        {cardTasks?.length > 0 ? (
                          <div className=" overflow-hidden">
                            {cardTasks.map((task, i) => (
                              <TaskItem
                                key={task._id}
                                task={task}
                                boardId={boardId}
                                cardId={card?._id}
                                isReadOnly={isReadOnly}
                                setColumns={setColumns}
                                card={card}
                                taskchild={taskchild[i]}
                              />
                            ))}
                            {hasMoreTasks && (
                              <div className="p-2 ">
                                <button
                                  onClick={() => fetchTasks(localCard?._id, tasksCurrentPage + 1, true)}
                                  disabled={isTasksLoading}
                                  className="w-full py-2 text-sm font-medium text-white/50 hover:text-white/50 bg-[#252530] hover:bg-[#2e2e3a] rounded transition disabled:opacity-50"
                                >
                                  {isTasksLoading ? "Loading..." : "Load More"}
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="py-10 text-center rounded-xl bg-white/[0.005]">
                            <div className="w-10 h-10 rounded-full bg-white/[0.02] flex items-center justify-center mx-auto mb-3">
                              <CheckSquare className="w-4 h-4 text-white/20" />
                            </div>
                            <p className="text-xs font-medium text-white/40 tracking-wide">No checklist groups yet</p>
                            <p className="text-xs text-white/20 mt-0.5">Add a checklist group to organize your tasks</p>
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => setShowChecklistAddArea(true)}
                                className="mt-3 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 text-white/70 rounded transition"
                              >
                                Add Checklist Group
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── ACTIVITY Placeholder ── */}
                <div className="mb-4" />

              </div>

              {/* ── RIGHT SIDEBAR: Activity panel ── */}
              <div className={`${mobilePanel === 'details' ? 'max-sm:hidden' : 'max-sm:flex'} flex flex-col flex-1 min-h-0 min-w-0 sm:flex-none sm:w-[35%] sm:shrink-0 border-[#e5e7eb29] max-sm:border-l-0 sm:border-l bg-[#111116]`}>
                <div className="hidden sm:flex items-center justify-between px-4 py-3 border-b border-[#e5e7eb29] shrink-0">
                  <span className="text-sm font-semibold text-white">Activity</span>
                </div>

                {/* Activity Feed and Comment Input */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <CardActivity
                    cardId={card?._id}
                    boardId={boardId}
                    userId={userId}
                    onCommentCountChange={handleCommentCountChange}
                    isReadOnly={isReadOnly}
                    connected={connected}
                    setColumns={setColumns}
                  />
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    ),
    document.body
  )
}

// ── SUB-COMPONENT: Task Item (table row style) ──
function TaskItem({
  task,
  boardId,
  cardId,
  isReadOnly,
  setColumns,
  taskchild,
  card,

}: {
  task: any
  boardId: string
  cardId: string
  isReadOnly?: boolean
  setColumns: React.Dispatch<React.SetStateAction<Column[]>>
  card: Card
  taskchild: any
}) {
  const { updateTask, deleteTask } = useTaskStore()

  // Helper function to update card TaskDataCount with deltas


  // Initialize with nested data
  const [checklistitems, setchecklistitems] = useState<any[]>(task.checklistData || [])
  const [newItemInput, setNewItemInput] = useState("")
  const [isAddingChecklistItem, setIsAddingChecklistItem] = useState(false)

  // Checklist pagination state
  const [checklistCurrentPage, setChecklistCurrentPage] = useState(1)
  const [checklistTotalPages, setChecklistTotalPages] = useState(1)
  const [hasMoreChecklists, setHasMoreChecklists] = useState(true)
  const [isLoadingMoreChecklists, setIsLoadingMoreChecklists] = useState(false)

  // Task Title Edit State
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState(task.name)

  // Checklist Item Edit State
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editItemValue, setEditItemValue] = useState("")
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null)

  // Local Counts State
  const [localCounts, setLocalCounts] = useState({
    total: task?.childCount || 0,
    completed: task?.completedChildCount || 0
  })

  // Sync if task prop updates (e.g. after re-fetch of tasks)
  useEffect(() => {
    if (task.checklistData) {
      setchecklistitems(task.checklistData)
      // Initialize pagination: if childCount > items.length, there might be more pages
      // const initialHasMore = task.childCount > (task.checklistData?.length || 0)
      // setHasMoreChecklists(initialHasMore)
      setChecklistCurrentPage(1)
      //setChecklistTotalPages(initialHasMore ? 2 : 1) // Assume at least 2 pages if hasMore
    }
    setLocalCounts({
      total: task?.childCount || 0,
      completed: task?.completedChildCount || 0
    })
  }, [task.checklistData, task.childCount, task.completedChildCount])









  const handleAddItem = async () => {
    if (!newItemInput.trim() || isAddingChecklistItem) return
    setIsAddingChecklistItem(true)
    const token = localStorage.getItem("garage_tok");
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_TASKROOM_URL}checklist/groups/${task._id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: newItemInput })
      });
      const data = await response.json();
      if (data.status) {
        // Calculate new values first
        const newItem = data.data
        setchecklistitems(prev => [...prev, newItem])

        // Update local counts safely (assuming add always increases total by 1)
        setLocalCounts(prev => {
          const newTotal = prev.total + 1
          const newCompleted = prev.completed // new item is incomplete by default
          // Sync upstream
          // updateTaskAndCardCounts(newTotal, newCompleted)
          return { total: newTotal, completed: newCompleted }
        })

        setColumns(prev => prev.map(col => ({
          ...col,
          cards: col.cards.map(c =>
            c._id === cardId
              ? {
                ...c,
                TaskDataCount: {
                  // Safely get current totalChildCount, default to 0
                  totalChildCount: (c.TaskDataCount?.totalChildCount ?? 0) + 1,
                  // Safely get current completed count, default to 0
                  totalCompletedChildCount: c.TaskDataCount?.totalCompletedChildCount ?? 0,
                },
              }
              : c
          )
        })));

        setNewItemInput("")
        toast.success("Item added")
      }
    } catch (e) {
      toast.error("Failed to add item")
    } finally {
      setIsAddingChecklistItem(false)
    }
  }
  const handleToggle = async (itemId: string, currentVal: boolean) => {
    // Prevent multiple toggles at once
    if (togglingItemId !== null) return

    setTogglingItemId(itemId)



    try {
      const token = localStorage.getItem("garage_tok");
      const response = await fetch(`${process.env.NEXT_PUBLIC_TASKROOM_URL}checklist/groups/items/${itemId}/complete`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isCompleted: !currentVal, socketId: timeSocketService.socketId ?? undefined })
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        throw new Error(data.message || "Failed to update checklist item");
      }

      // Update items state
      setchecklistitems(prev => prev.map(i => i._id === itemId ? { ...i, isCompleted: !currentVal } : i));

      // Update local counts state
      setLocalCounts(prev => {
        const newCompleted = !currentVal ? prev.completed + 1 : prev.completed - 1
        const newTotal = prev.total // Total doesn't change on toggle

        // Sync upstream
        // updateTaskAndCardCounts(newTotal, newCompleted)

        return { ...prev, completed: newCompleted }
      })


      // const delta = payload.isCompleted ? 1 : -1; // +1 if now completed, -1 if now incomplete

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
                    currentVal ? (c.TaskDataCount?.totalCompletedChildCount ?? 0) - 1 : (c.TaskDataCount?.totalCompletedChildCount ?? 0) + 1,
                },
              }
              : c
          ),
        }))
      );


    } catch (e) {
      toast.error("Failed to update item");
    } finally {
      setTogglingItemId(null)
    }
  }

  const handleDeleteItem = async (itemId: string) => {


    const itemToDelete = checklistitems.find(i => i._id === itemId)
    if (!itemToDelete) return; // Should not happen

    // Optimistic Update

    try {
      const token = localStorage.getItem("garage_tok");
      const response = await fetch(`${TASKROOM_API_URL}checklist/groups/items/${itemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        throw new Error(data.message || "Failed to delete checklist item");
      }

      setchecklistitems(prev => prev.filter(i => i._id !== itemId));
      setLocalCounts(prev => {
        const newTotal = prev.total - 1
        const newCompleted = itemToDelete.isCompleted ? prev.completed - 1 : prev.completed
        // updateTaskAndCardCounts(newTotal, newCompleted)
        return { total: newTotal, completed: newCompleted }
      });

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
                    itemToDelete.isCompleted ? (c.TaskDataCount?.totalCompletedChildCount ?? 0) - 1 : (c.TaskDataCount?.totalCompletedChildCount ?? 0),
                },
              }
              : c
          ),
        }))
      );
      // Success, state already updated optimistically
    } catch (e) {
      toast.error("Failed to delete item");
      // Revert if failed (optional, but good practice). For now leaving as is to focus on the 'not updating' fix.
    }
  }

  const handleLoadMoreChecklists = async () => {
    if (isLoadingMoreChecklists || !hasMoreChecklists) return
    setIsLoadingMoreChecklists(true)
    try {
      const token = localStorage.getItem("garage_tok");
      const nextPage = checklistCurrentPage + 1
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_TASKROOM_URL}checklist/groups/items?ChecklistGroupId=${task._id}&size=10&page=${nextPage}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      if (!response.ok || data.status === false) {
        throw new Error(data.message || "Failed to load more checklist items");
      }

      // Append new items
      const newItems = Array.isArray(data.data) ? data.data : []
      setchecklistitems(prev => [...prev, ...newItems])

      // Update pagination state
      const metadata = data.metadata || {}
      const currentPage = metadata.currentPage ?? nextPage
      const totalPages = metadata.totalPages ?? currentPage
      const hasMore = currentPage < totalPages

      setChecklistCurrentPage(currentPage)
      setChecklistTotalPages(totalPages)
      setHasMoreChecklists(hasMore)
    } catch (e: any) {
      toast.error(e.message || "Failed to load more items");
    } finally {
      setIsLoadingMoreChecklists(false)
    }
  }

  // Task Title Updates
  const handleSaveTitle = async () => {
    if (titleInput.trim()) {
      updateTask(task._id, { name: titleInput })

      setTitleInput(task.name) // Revert if empty or unchanged

      setIsEditingTitle(false)
    }
  }

  const handleCancelTitleEdit = () => {
    setTitleInput(task.name)
    setIsEditingTitle(false)
  }

  // Checklist Item Updates
  const startEditingItem = (item: any) => {
    setEditingItemId(item._id)
    setEditItemValue(item.description)
  }

  const cancelEditingItem = () => {
    setEditingItemId(null)
    setEditItemValue("")
  }

  const saveEditingItem = async (itemId: string) => {
    if (!editItemValue.trim()) return

    // Optimistic update
    setchecklistitems(prev => prev.map(i => i._id === itemId ? { ...i, description: editItemValue } : i))
    setEditingItemId(null)

    try {
      const token = localStorage.getItem("garage_tok");
      if (!token) {
        toast.error("Authentication token missing")
        return
      }

      await fetch(`${process.env.NEXT_PUBLIC_TASKROOM_URL}checklist/groups/${itemId}/items`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ description: editItemValue, socketId: "" })
      });
      toast.success("Item updated")
    } catch (e) {
      toast.error("Failed to update item")
      // We might want to revert here, but it requires keeping specific old value. 
      // For simplicity we'll assume success or user can edit again.
    }
  }

  const completedCount = localCounts.completed
  const totalCount = localCounts.total
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
  return (
    <div className="p mb-4" key={task?._id}>
      {/* Header with Tasks title and progress count */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isEditingTitle ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                onBlur={(e) => e.target.blur()}
                className="font-semibold text-white/50 dark:text-white/50 text-sm border-b border-[#1f2937] dark:border-[#e5e7eb29] focus:outline-none flex-1 min-w-0 bg-transparent"
                autoFocus
              />
              <button onClick={handleSaveTitle} className="p-1  rounded text-green-600"><Check className="w-4 h-4" /></button>
              <button onClick={handleCancelTitleEdit} className="p-1  rounded text-red-500"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <h3
              onClick={() => !isReadOnly && setIsEditingTitle(true)}
              className="font-semibold text-white/50 dark:text-white/50 text-sm cursor-pointer  dark: rounded px-1 -ml-1"
            >
              {task.name}
            </h3>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-white/50 font-medium">{completedCount}/{totalCount}</span>
          {!isEditingTitle && !isReadOnly && (
            <button
              onClick={() => { if (confirm("Delete task?")) deleteTask(task?._id, timeSocketService.socketId ?? undefined) }}
              className="text-white/50 dark:text-white/50 hover:text-red-500 dark:hover:text-red-400 transition"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {
        progress > 0 && (
          <div className="mb-4">
            {/* Background track */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">

              {/* Dynamic Progress Bar */}
              <div
                className={`h-full transition-all duration-300 rounded-full ${progress < 30
                  ? 'bg-red-500'
                  : progress < 70
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                  }`}
                style={{ width: `${progress}%` }}
              ></div>

            </div>
          </div>
        )
      }
      {/* Checklist Items */}
      <div className="space-y-2 mb-4">
        {checklistitems.map(item => (
          <div key={item._id} className="flex items-center gap-3 group">
            {editingItemId === item._id ? (
              <div className="flex items-center gap-2 flex-1 w-full">
                <input
                  value={editItemValue}
                  onChange={(e) => setEditItemValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveEditingItem(item._id)}
                  onBlur={(e) => e.target.blur()}
                  className="text-sm text-white/50 dark:text-white/50 flex-1 border-b border-[#1f2937] dark:border-[#e5e7eb29] focus:outline-none py-1 bg-transparent"
                  autoFocus
                />
                <button onClick={() => saveEditingItem(item._id)} className="p-1  dark: rounded text-green-600 dark:text-green-400"><Check className="w-4 h-4" /></button>
                <button onClick={cancelEditingItem} className="p-1  dark: rounded text-red-500 dark:text-red-400"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <>
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={item.isCompleted}
                    onChange={() => !isReadOnly && handleToggle(item._id, item.isCompleted)}
                    disabled={isReadOnly || togglingItemId !== null}
                    className="w-3 h-3 rounded border-[#e5e7eb29] dark:border-[#e5e7eb29] accent-black dark:accent-white  dark: focus:ring-black dark:focus:ring-white cursor-pointer flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {togglingItemId === item._id && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-3 h-3 border-2 border-[#1f2937] dark:border-[#e5e7eb29] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <span
                  onClick={() => !isReadOnly && startEditingItem(item)}
                  className={`text-sm text-white/50 dark:text-white/50 flex-1 cursor-pointer  dark: px-1 rounded -ml-1 ${togglingItemId !== null ? 'opacity-50' : ''}`}
                >
                  {item.description}
                </span>
                {!isReadOnly && togglingItemId === null && (
                  <button
                    onClick={() => handleDeleteItem(item._id)}
                    className="opacity-0 group-hover:opacity-100 text-white/50 dark:text-white/50 hover:text-red-500 dark:hover:text-red-400 transition flex-shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      {
        taskchild?.childCount > 10 && hasMoreChecklists &&
        <div className="">
          <button
            onClick={handleLoadMoreChecklists}
            disabled={isLoadingMoreChecklists}
            className="w-full text-sm text-white/50 font-medium py-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoadingMoreChecklists ? "Loading..." : "Load More"}
          </button>
        </div>
      }

      {/* Add New Item Section */}
      {
        !isReadOnly && (
          <div className="flex gap-2">
            <input
              placeholder="Add an item..."
              value={newItemInput}
              onChange={(e) => setNewItemInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
              onBlur={(e) => e.target.blur()}
              disabled={isAddingChecklistItem}
              className="text-[12px] placeholder:text-[12px] px-3 py-1 border border-[#e5e7eb29] dark:border-[#e5e7eb29] rounded-sm flex-1 focus:outline-none focus:ring-0 border-[#e5e7eb29]  focus:ring-gray-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed  dark: text-white/50 dark:text-white/50"
            />
            <button
              onClick={handleAddItem}
              disabled={isAddingChecklistItem || !newItemInput.trim()}
              className=" dark: text-white/50 dark:text-white/50 px-4 py-1 rounded-lg cursor-pointer text-[12px] font-medium  dark: transition disabled:opacity-60 disabled:cursor-not-allowed disabled: dark:disabled:"
            >
              {isAddingChecklistItem ? "Adding..." : "Add"}
            </button>
          </div>
        )
      }

      {/* Load More button for checklist items */}

    </div >
  )
}
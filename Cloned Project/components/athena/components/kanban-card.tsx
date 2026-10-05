"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import type { Card, Column } from "./Dashbaord"
import { useState, useCallback, useEffect, useRef } from "react"
import { CardModal } from "./card-modal"
import { Calendar, MessageSquare, Link2, MoreHorizontal, Check, Circle, Flag, Clock } from "lucide-react"
import { format, isValid } from "date-fns"
import {
  formatCreatedAtDateTime,
  formatCreatedAtElapsed,
  getTimeZoneAbbreviation,
} from "./format-created-at"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useCardStore } from "@/store/athena/cardStore"
import { toast } from "sonner"
import { ChevronRight, ChevronDown, ListTree, Loader2, Plus, X, ArrowLeft, Tag as TagIcon, AlignLeft, Users, Calendar as CalendarIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import axios from "axios"
import { AssigneePicker } from "./assignee-picker"
import { CustomDatePicker } from "./custom-date-picker"
import { PriorityPicker } from "./priority-picker"
import { TagPicker } from "./tag-picker"
import { getTagStyles } from "./tag-colors"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Cookies from "js-cookie"
import { useRouter } from "next/navigation"

const TASKROOM_API_URL = process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/";

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
interface KanbanCardProps {
  card: Card
  columnId: string
  isOverlay?: boolean
  columnColor?: string
  boardId: string
  orgId: string
  setColumns: React.Dispatch<React.SetStateAction<Column[]>>
  userId: string | undefined
  isReadOnly?: boolean
  connected: boolean
  updateTaskAndCardCounts: (newChildCount: number, newCompletedChildCount: number, taskId: string, cardId: string) => void
  Idspace: string
}

export function KanbanCard({ card, columnId, connected, columnColor, updateTaskAndCardCounts, userId, isOverlay, boardId, orgId, setColumns, isReadOnly, Idspace }: KanbanCardProps) {
  const [showModal, setShowModal] = useState(false)
  const { toggleComplete } = useCardStore()
  const [isCompleted, setIsCompleted] = useState(card.isCompleted || false)
  const [showExpiredDialog, setShowExpiredDialog] = useState(false)
  const [subtasks, setSubtasks] = useState<Card[]>([])
  const [isSubtasksVisible, setIsSubtasksVisible] = useState(false)
  const [subtaskPage, setSubtaskPage] = useState(1)
  const [subtaskTotalPages, setSubtaskTotalPages] = useState(1)
  const [isLoadingSubtasks, setIsLoadingSubtasks] = useState(false)
  const subtaskSentinelRef = useRef<HTMLDivElement | null>(null)
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [newSubtaskName, setNewSubtaskName] = useState("");
  const [isSubmittingSubtask, setIsSubmittingSubtask] = useState(false);

  // Detailed draft state
  const [assignedToIds, setAssignedToIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState<number | null>(null)
  const [dueDate, setDueDate] = useState<number | null>(null)
  const [priority, setPriority] = useState<string>("")
  const [description, setDescription] = useState("")
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  const router = useRouter()

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

  const stageColor = columnColor || "#8b5cf6"
  const rgb = hexToRgb(stageColor)
  const bgColor = rgb
    ? `rgba(${Math.round(rgb.r * 0.30)}, ${Math.round(rgb.g * 0.30)}, ${Math.round(rgb.b * 0.30)}, 0.22)`
    : "rgba(39, 10, 115, 0.22)"
  const borderColor = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)` : "rgba(139, 92, 246, 0.2)"

  const getRootTaskId = (groups: Column[], taskId: string): string | null => {
    for (const group of groups) {
      const tasks = group.cards || [];
      for (const rootTask of tasks) {
        if (rootTask._id === taskId) return rootTask._id;
        // In Kanban we don't store nested subtasks in the global card object usually, 
        // but we can check if it matches. 
      }
    }
    return null;
  };

  const updateTaskInTree = (tasks: Card[], taskId: string, updater: (t: Card) => Card): Card[] =>
    tasks.map((task) =>
      (task._id === taskId)
        ? updater(task)
        : { ...task, subtasks: updateTaskInTree(task.subtasks || [], taskId, updater) }
    );

  const updateTaskInGroups = (groups: Column[], taskId: string, updater: (t: Card) => Card): Column[] =>
    groups.map((g) => ({
      ...g,
      cards: updateTaskInTree(g.cards || [], taskId, updater),
    }));

  const addSubtaskToParentGlobal = (groups: Column[], parentTaskId: string, newSubtask: any): Column[] =>
    updateTaskInGroups(groups, parentTaskId, (parent) => ({
      ...parent,
      subTaskCount: String((Number(parent.subTaskCount) || 0) + 1),
      TaskDataCount: {
        totalChildCount: (parent.TaskDataCount?.totalChildCount || 0) + 1,
        totalCompletedChildCount: parent.TaskDataCount?.totalCompletedChildCount || 0
      },
      subtasks: [newSubtask, ...(parent.subtasks || [])]
    }));

  const handleSaveSubtask = async () => {
    if (isReadOnly || !newSubtaskName.trim() || isSubmittingSubtask) return;
    setIsSubmittingSubtask(true);
    try {
      const token = localStorage.getItem("garage_tok");

      const body = {
        title: newSubtaskName.trim(),
        roomId: boardId,
        stageId: columnId,
        assignedToIds: assignedToIds,
        priority: priority || "normal",
        tags: selectedTagIds,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        description: description,
        parentId: card._id,
        rootId: card._id,
      };

      const res = await axios.post(`${TASKROOM_API_URL}tasks`, body, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.status && res.data?.data) {
        const t = res.data.data;
        const normalized: Card = {
          _id: t._id,
          name: t.title || t.name || '',
          userId: t.userId,
          description: t.description || "",
          tags: t.tags || [],
          tagData: t.tagData || [],
          members: t.assigneeData ? t.assigneeData : [],
          dueDate: t.dueDate,
          startDate: t.startDate,
          checklist: t.checklist || [],
          isOverDue: t.isOverDue,
          isCompleted: t.isCompleted,
          priority: t.priority,
          comments: [],
          commentCount: t.commentCount,
          subTaskCount: t.subTaskCount,
          stageId: columnId,
          assignedToIds: t.assignedToIds || [],
          timeEstimate: t.timeEstimate,
          TaskDataCount: {
            totalChildCount: t.TaskDataCount?.totalChildCount ?? 0,
            totalCompletedChildCount: t.TaskDataCount?.totalCompletedChildCount ?? 0
          }
        };

        setSubtasks(prev => [normalized, ...prev]);

        // Update global state for counts
        setColumns(prev => addSubtaskToParentGlobal(prev, card._id, normalized));

        setNewSubtaskName("");
        setAssignedToIds([]);
        setStartDate(null);
        setDueDate(null);
        setPriority("");
        setDescription("");
        setSelectedTagIds([]);
        setIsAddingSubtask(false);
        if (!isSubtasksVisible) setIsSubtasksVisible(true);
        toast.success("Subtask added successfully");
      }
    } catch (err) {
      console.error("Failed to add subtask", err);
      toast.error("Failed to add subtask");
    } finally {
      setIsSubmittingSubtask(false);
    }
  };

  const fetchSubtasks = useCallback(async (page: number) => {
    if (isLoadingSubtasks && page !== 1) return;
    setIsLoadingSubtasks(true);
    try {
      const token = localStorage.getItem("garage_tok");
      const res = await axios.get(
        `${TASKROOM_API_URL}tasks/detail/sub/${card._id}?size=30&page=${page}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );

      if (res.status === 200) {
        const json = res.data;
        const fetchedSubtasks = json?.data ?? [];
        const metadata = json?.metadata ?? {};

        const normalizedSubtasks = fetchedSubtasks.map((st: any) => ({
          _id: st._id,
          name: st.title || st.name || '',
          userId: st.userId,
          description: st.description || "",
          tags: st.tags || [],
          tagData: st.tagData || [],
          members: st.assigneeData ? st.assigneeData : (st.members || []),
          dueDate: st.dueDate,
          startDate: st.startDate,
          checklist: st.checklist || [],
          isOverDue: st.isOverDue,
          isCompleted: st.isCompleted,
          priority: st.priority,
          comments: [],
          commentCount: st.commentCount,
          subTaskCount: st.subTaskCount,
          stageId: columnId,
          assignedToIds: st.assignedToIds || [],
          timeEstimate: st.timeEstimate,
          TaskDataCount: {
            totalChildCount: st.TaskDataCount?.totalChildCount ?? 0,
            totalCompletedChildCount: st.TaskDataCount?.totalCompletedChildCount ?? 0
          }
        }));

        setSubtasks(prev => page === 1 ? normalizedSubtasks : [...prev, ...normalizedSubtasks]);
        setSubtaskTotalPages(metadata.totalPages || 1);
        setSubtaskPage(metadata.currentPage || page);
      }
    } catch (err) {
      console.error("Failed to fetch subtasks", err);
    } finally {
      setIsLoadingSubtasks(false);
    }
  }, [card._id, columnId, isLoadingSubtasks]);

  useEffect(() => {
    if (!isSubtasksVisible || subtaskPage >= subtaskTotalPages || isLoadingSubtasks) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        fetchSubtasks(subtaskPage + 1);
      }
    }, { threshold: 0.1 });

    if (subtaskSentinelRef.current) {
      observer.observe(subtaskSentinelRef.current);
    }

    return () => observer.disconnect();
  }, [isSubtasksVisible, subtaskPage, subtaskTotalPages, isLoadingSubtasks, fetchSubtasks]);

  useEffect(() => {
    setIsCompleted(!!card.isCompleted)
  }, [card.isCompleted])

  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: card._id,
    data: {
      type: "Card",
      card,
      columnId,
    },
    disabled: isOverlay || isReadOnly,
  })

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
    border: "1px solid #211d1d"
  }

  const blockIfReadOnly = useCallback(() => {
    if (!isReadOnly) return false
    toast.error("Observers can only view this board")
    return true
  }, [isReadOnly])

  const handleToggleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent modal open
    if (blockIfReadOnly()) return

    const token = Cookies.get("auth-token")
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

    const newStatus = !isCompleted
    try {
      setIsCompleted(newStatus) // Optimistic local

      // Optimistic global/board state update to prevent UI flicker if dragging or re-rendering occurs
      setColumns(prev => prev.map(col => ({
        ...col,
        cards: col.cards.map(c => c._id === card._id ? { ...c, isCompleted: newStatus } : c)
      })));

      await toggleComplete(card._id, newStatus)

      toast.success(newStatus ? "Marked as complete" : "Marked as incomplete")
    } catch (error) {
      console.error("Failed to toggle complete", error)
      setIsCompleted(!newStatus) // Revert
      // Revert column state if needed, though usually next fetch fixes it or we ignore for minor gltich on error
      setColumns(prev => prev.map(col => ({
        ...col,
        cards: col.cards.map(c => c._id === card._id ? { ...c, isCompleted: !newStatus } : c)
      })));
      toast.error("Failed to update status")
    }
  }

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        className="bg-[#000000]  rounded-lg h-[100px] opacity-50"
      />
    )
  }
  const avatarColors = [
    "#26004a", // purple-700
    "#a29502", // pink-700
    "#15803d", // green-700
    "#f53d00", // blue-700
    "#ff00f2", // indigo-700
    "#b91c1c", // red-700 (deep red)
    "#b45309", // amber-700

  ];
  console.log("czxczxc32dzxcz", card)
  // const avatarColors = [
  //   "-red",      // Strawberry
  //   "-orange",   // Mango
  //   "-amber",    // Orange
  //   "-yellow",   // Lemon
  //   "-lime",     // Lime
  //   "-emerald",  // Mint
  //   "-cyan",     // Cyan
  //   "-blue",     // Blueberry
  //   "-purple",   // Grape
  //   "-pink",     // Pink
  //   "-fuchsia",  // Hot pink
  //   "-rose",     // Rose
  // ];


  // Function to get a consistent color from the array based on a string (ID or email)
  const getAvatarColor = (identifier: string) => {
    if (!identifier) return avatarColors[0];
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
      hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % avatarColors.length;
    return avatarColors[index];
  };

  const getMemberAvatarUrl = (member: any) =>
    member?.profilePicture || member?.image || member?.avatar || member?.userAvatarUrl || member?.photoUrl || member?.photo || "";

  return (
    <>

      <div className={`group relative rounded-lg   bg-[#161616] border-1 border-[#e5e7eb0f]    p-3   active:cursor-grabbing transition hover:shadow-md ${isOverlay ? "rotate-2 shadow-xl cursor-grabbing" : ""}`}
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...(isReadOnly ? {} : listeners)}
        onClick={() => setShowModal(true)}
      >
        {/* Toggle Complete Button */}
        {/* <button
          onClick={handleToggleComplete}
          className={`absolute top-2 right-2 p-1 rounded-full z-10 transition-opacity ${isCompleted ? "opacity-0 group-hover:opacity-100" : "opacity-0 group-hover:opacity-100"
            } hover:bg-gray-100 dark:hover:bg-gray-600`}
        >
          {isCompleted ? (
            <div className="bg-green-500 rounded-full p-0.5">
              <Check className="w-3 h-3 text-white/50" />
            </div>
          ) : (
            <Circle className="w-4 h-4 text-gray-400 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-500" />
          )}
        </button> */}




        <div className=" items-start justify-between gap-2">
          <h3 className={`mb-1 font-[500] text-[12px] text-white/70 leading-snug `}>{card?.name?.replace(/\b\w/g, char => char.toUpperCase()) || ''}</h3>
          {
            card?.description &&
            <p className="mb-3 text-[11px] text-white/50  line-clamp-2">{card?.description?.replace(/\b\w/g, char => char.toUpperCase()) || ''} </p>

          }

          {card.createdAt && formatCreatedAtDateTime(card.createdAt) && (
            <div
              className="flex items-start gap-1.5 mb-2 text-[10px] text-white/40 leading-snug"
              title={`Created in your timezone (${getTimeZoneAbbreviation()})`}
            >
              <Clock className="w-3 h-3 shrink-0 mt-0.5" />
              <span>
                {formatCreatedAtDateTime(card.createdAt)}
                {formatCreatedAtElapsed(card.createdAt) && (
                  <> · {formatCreatedAtElapsed(card.createdAt)}</>
                )}
              </span>
            </div>
          )}


          <div className="flex items-center gap-1.5">


            {card.tagData && card.tagData.length > 0 && (
              <div className="flex gap-2 mb-2 flex-wrap">
                {card.tagData.map((label, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] px-2 py-1 rounded-[5px] border border-slate-600/30 font-bold break-all"
                    style={getTagStyles(label.color)}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            )}




          </div>








          <div className="flex items-center gap-4  text-white/50 ">

            <div className="flex items-center gap-2 "
              style={{
                flexWrap: "wrap"
              }}

            >

              <div className="flex -space-x-2">
                {card.members.length > 0 && (
                  <div className="flex -space-x-1">
                    {card?.members?.slice(0, 5)?.map((member, idx) => {
                      const initials = member.name
                        ? member.name.split(" ").slice(0, 2).map(n => n[0]?.toUpperCase()).join("")
                        : (member.email ? member.email.substring(0, 2).toUpperCase() : "??");

                      const avatarUrl = getMemberAvatarUrl(member);

                      return (
                        <Avatar
                          key={idx}
                          className="w-6 h-6 rounded-full border border-[#000] bg-white/70 text-[10px] text-black"
                          title={member.name || member.email}
                        >
                          {avatarUrl ? (
                            <AvatarImage
                              src={avatarUrl}
                              alt={member.name || member.email || "Member"}
                              className="object-cover"
                            />
                          ) : (
                            <AvatarFallback className="bg-white/70 text-[10px] font-semibold text-black">
                              {initials}
                            </AvatarFallback>
                          )}
                        </Avatar>
                      );
                    })}

                    {(card?.assignedToIds?.length ?? 0) > 5 && (
                      <div className="flex w-6 h-6 items-center bg-white/70 justify-center rounded-full border border-[#000] text-sm font-semi text-[#000]">
                        +{(card?.assignedToIds?.length ?? 0) - 5}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {card.priority && (
                <div className={cn(
                  "flex items-center gap-1  py-0.5 rounded text-[10px]  font-bold tracking-wider",
                  card.priority === "urgent" ? " text-red-500 " :
                    card.priority === "high" ? " text-amber-500 " :
                      card.priority === "normal" ? " text-blue-500 " :
                        "text-slate-400 "
                )}
                  title={card.priority}
                >
                  <Flag className={cn("h-3.5 w-3.5",
                    card.priority === "urgent" ? "fill-red-500" :
                      card.priority === "high" ? "fill-amber-500" :
                        card.priority === "normal" ? "fill-blue-500" : ""
                  )} />
                  <span className="text-[10px]">
                    {card.priority ? card.priority.charAt(0).toUpperCase() + card.priority.slice(1).toLowerCase() : ''}
                  </span>
                </div>
              )}




              {card.dueDate && (
                <div className={cn(
                  "flex text-white/500 items-center gap-1 px-1 rounded text-[11px] font-semi transition-colors"
                )}>
                  <Clock className="w-3 h-3" />
                  <span>{isValid(new Date(card.dueDate)) ? format(new Date(card.dueDate), "MMM d") : "No date"}</span>
                  {card.isOverDue && <span className="ml-1 font-bold italic">Overdue</span>}
                </div>
              )}

              <div className="flex items-center gap-1.5 text-white/50">
                <MessageSquare className="h-3.5 w-3.5 text-purple" />
                <span className="text-xs">{card?.commentCount ?? 0}</span>
              </div>

              {Number(card?.subTaskCount) > 0 && (
                <div
                  className="flex items-center gap-1.5 text-white/50   transition-colors"
                // onClick={(e) => {
                //   e.stopPropagation();
                //   const nextVisible = !isSubtasksVisible;
                //   setIsSubtasksVisible(nextVisible);
                //   if (nextVisible && subtasks.length === 0) {
                //     fetchSubtasks(1);
                //   }
                // }}
                >
                  <ListTree className={cn("h-3.5 w-3.5 transition-transform", isSubtasksVisible ? "text-blue-400 rotate-90" : "text-purple")} />
                  <span className="text-xs">{card?.subTaskCount}</span>
                </div>
              )}

              <div className=" flex items-center gap-1.5">
                <div className="h-3.5 w-3.5 rounded-sm border border-current flex items-center justify-center">
                  <svg viewBox="0 0 10 10" className="h-2 w-2">
                    <path d="M2 5 L4 7 L8 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </div>
                <span className="text-xs ">{card?.TaskDataCount?.totalCompletedChildCount}/{card?.TaskDataCount?.totalChildCount}</span>
              </div>
            </div>



          </div>
        </div>

        {/* Subtasks rendering */}
        {isSubtasksVisible && (
          <div className="mt-4 space-y-2 border-t border-[#e5e7eb10] pt-3 pl-2 transition-all">
            {/* Subtask Input Form (Match KanbanColumn style) */}
            {isAddingSubtask && !isReadOnly && (
              <div
                className="bg-[#000000] border border-[#e5e7eb29] rounded-xl p-3 shadow-2xl space-y-3 mb-3"
              >
                <div className="flex justify-between items-start gap-2">
                  <textarea
                    placeholder="Subtask Name..."
                    value={newSubtaskName}
                    onChange={(e) => setNewSubtaskName(e.target.value)}
                    autoFocus
                    className="w-full px-0 py-1 bg-transparent text-sm placeholder:text-sm text-white/50 placeholder:text-white/50 rounded text-base font-medium focus:outline-none resize-none min-h-[40px]"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSaveSubtask()
                      }
                      if (e.key === "Escape") setIsAddingSubtask(false)
                    }}
                  />
                  <button
                    onClick={handleSaveSubtask}
                    disabled={isSubmittingSubtask || !newSubtaskName.trim()}
                    className="flex items-center gap-1.5 bg-[#1a1a24] hover:bg-[#3E3E4A] text-white/50 px-3 py-1.5 rounded-md text-sm font-medium transition-all active:scale-95 disabled:opacity-40"
                  >
                    {isSubmittingSubtask ? "..." : "Save"}
                    <span className="text-[12px] opacity-60">↵</span>
                  </button>
                </div>

                <div className="space-y-0.5">
                  <AssigneePicker
                    assignedToIds={assignedToIds}
                    onSelect={(ids) => setAssignedToIds(ids)}
                    activeColor={stageColor}
                    bgColor={bgColor}
                    borderColor={borderColor}
                  >
                    <button className={cn(
                      "flex items-center gap-2.5 px-2 w-full py-2 rounded-md hover:bg-[#1a1a24] text-white/50 hover:text-white/50 transition-colors group",
                      assignedToIds.length > 0 ? "text-white/50 bg-[#1a1a24]" : "text-white/50 hover:text-white/50"
                    )}>
                      <div className="p-1 px-1.5 rounded bg-[#1a1a24] group-hover:bg-[#2e2e3a] transition-colors border border-[#e5e7eb10]">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-sm font-normal">
                        {assignedToIds.length > 0 ? `${assignedToIds.length} Assignees` : "Add assignee"}
                      </span>
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
                    <button className={cn(
                      "flex items-center gap-2.5 w-full px-2 py-2 rounded-md hover:bg-[#1a1a24] transition-colors group",
                      dueDate ? "text-white/50 bg-[#1a1a24]" : "text-white/50 hover:text-white/50"
                    )}>
                      <div className="p-1 px-1.5 rounded bg-[#1a1a24] group-hover:bg-[#2e2e3a] transition-colors border border-[#e5e7eb10]">
                        <CalendarIcon className={cn("w-3.5 h-3.5", dueDate && "text-white/50")} />
                      </div>
                      <span className="text-sm font-normal truncate">
                        {dueDate ? `${new Date(startDate!).toLocaleDateString()} ${dueDate ? `- ${new Date(dueDate).toLocaleDateString()}` : ""}` : "Add dates"}
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
                    <button className={cn(
                      "flex items-center gap-2.5 w-full px-2 py-2 rounded-md hover:bg-[#1a1a24] transition-colors group",
                      priority ? "text-white/50 bg-[#1a1a24]" : "text-white/50 hover:text-white/50"
                    )}>
                      <div className="p-1 px-1.5 rounded bg-[#1a1a24] group-hover:bg-[#2e2e3a] transition-colors border border-[#e5e7eb10]">
                        <Flag className={cn("w-3.5 h-3.5", priority === "urgent" ? "fill-red-500 text-red-500" : (priority === "high" ? "fill-amber-500 text-amber-500" : ""))} />
                      </div>
                      <span className="text-sm font-normal capitalize">
                        {priority || "Add priority"}
                      </span>
                    </button>
                  </PriorityPicker>

                  <TagPicker
                    boardId={boardId}
                    selectedTagIds={selectedTagIds}
                    onSelect={(ids) => setSelectedTagIds(ids)}
                    Idspace={Idspace}
                    activeColor={stageColor}
                    bgColor={bgColor}
                    borderColor={borderColor}
                  >
                    <button className={cn(
                      "flex items-center gap-2.5 w-full px-2 py-2 rounded-md hover:bg-[#1a1a24] transition-colors group",
                      selectedTagIds.length > 0 ? "text-white/50 bg-[#1a1a24]" : "text-white/50 hover:text-white/50"
                    )}>
                      <div className="p-1 px-1.5 rounded bg-[#1a1a24] group-hover:bg-[#2e2e3a] transition-colors border border-[#e5e7eb10]">
                        <TagIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-sm font-normal">
                        {selectedTagIds.length > 0 ? `${selectedTagIds.length} Tags` : "Add tags"}
                      </span>
                    </button>
                  </TagPicker>

                  <div className="flex gap-2.5 w-full px-2 py-2 rounded-md transition-colors group">
                    <div className="p-1 px-1.5 h-fit rounded bg-[#1a1a24] border border-[#e5e7eb10]">
                      <AlignLeft className="w-3.5 h-3.5 text-white/50" />
                    </div>
                    <textarea
                      placeholder="Add description..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-transparent text-sm placeholder:text-sm text-white/50 placeholder:text-white/50 focus:outline-none resize-none max-h-[40px]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => {
                      setIsAddingSubtask(false)
                      setNewSubtaskName("")
                      setAssignedToIds([])
                      setStartDate(null)
                      setDueDate(null)
                      setPriority("")
                      setDescription("")
                      setSelectedTagIds([])
                    }}
                    className="text-[11px] text-white/50 hover:text-white/50 bg-[#1a1a24] p-1.5 rounded-[7px] font-bold cursor-pointer transition-colors px-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {subtasks.map((subtask) => (
              <SubtaskItem
                key={subtask._id}
                subtask={subtask}
                columnId={columnId}
                rootId={card._id}
                boardId={boardId}
                Idspace={Idspace}
                setColumns={setColumns}
                isReadOnly={isReadOnly}
              />
            ))}

            {isLoadingSubtasks && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              </div>
            )}

            {/* Infinite scroll sentinel */}
            {subtaskPage < subtaskTotalPages && (
              <div ref={subtaskSentinelRef} className="h-1" />
            )}
          </div>
        )}

        {/* Add Subtask Button (Bottom of card) */}
        {/* {!isSubtasksVisible && (
          <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
               onClick={(e) => {
                e.stopPropagation();
                setIsSubtasksVisible(true);
                setIsAddingSubtask(true);
              }}
              className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>Add Subtask</span>
            </button>
          </div>
        )} */}

        {isSubtasksVisible && !isAddingSubtask && !isReadOnly && (
          <button
            onClick={() => setIsAddingSubtask(true)}
            className="mt-2 flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors pl-2"
          >
            <Plus className="w-3 h-3" />
            <span>Add Subtask</span>
          </button>
        )}
      </div>
      {/* <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...(isReadOnly ? {} : listeners)}
          onClick={() => setShowModal(true)}
          className={`bg-[#111116] border border-gray-200 rounded-lg p-3 cursor-grab active:cursor-grabbing transition hover:shadow-md group relative ${isOverlay ? "rotate-2 shadow-xl cursor-grabbing" : ""
            }`}
        >
      
          {card.tagData && card.tagData.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {card.tagData.map((label, idx) => (
                <span key={idx} className={`text-white/50 text-sm px-2 py-1 rounded font-semibold break-all   ${label.color || "bg-gray-400"}`}>
                  {label.name}
                </span>
              ))}
            </div>
          )}

    
          <h3 className="font-medium text-gray-800 text-sm mb-2 break-all">{card.name}</h3>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {card.isOverDue && (
                <div className="flex items-center gap-1 text-red-600">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" />
                  </svg>
                  <span>Overdue</span>
                </div>
              )}
              {card.checklist && (
                <div className="flex items-center gap-1 text-gray-600">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                  <span>
                    {card.checklist.completed}/{card.checklist.total}
                  </span>
                </div>
              )}
            </div>

     
            {card.members.length > 0 && (
              <div className="flex -space-x-2">
                {card.members.map((member, idx) => {
                  const initials = member.name ? member.name.substring(0, 2).toUpperCase() : (member.email ? member.email.substring(0, 2).toUpperCase() : "??");
                  const bg = "bg-blue-500"; // Or dynamic based on name char code if desired
                  return (
                    <div
                      key={idx}
                      className={`${bg} text-white/50 text-sm font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white`}
                      title={member.name || member.email}
                    >
                      {initials}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div> */}

      {/* Card Modal */}
      {showModal && <CardModal connected={connected} updateTaskAndCardCounts={updateTaskAndCardCounts} card={card} userId={userId} onClose={() => setShowModal(false)} boardId={boardId} orgId={orgId} setColumns={setColumns} isReadOnly={isReadOnly} />}
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
    </>
  )
}

// ─── Recursive Subtask Item Component ───────────────────────────────────────
const SubtaskItem = ({ subtask, columnId, rootId, boardId, Idspace, setColumns, isReadOnly }: { subtask: Card, columnId: string, rootId: string, boardId: string, Idspace: string, setColumns: React.Dispatch<React.SetStateAction<Column[]>>, isReadOnly?: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [nestedSubtasks, setNestedSubtasks] = useState<Card[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Detailed draft state
  const [assignedToIds, setAssignedToIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState<number | null>(null)
  const [dueDate, setDueDate] = useState<number | null>(null)
  const [priority, setPriority] = useState<string>("")
  const [description, setDescription] = useState("")
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const handleSaveNestedSubtask = async () => {
    if (isReadOnly || !newName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("garage_tok");

      const body = {
        title: newName.trim(),
        roomId: boardId,
        stageId: columnId,
        assignedToIds: assignedToIds,
        priority: priority || "normal",
        tags: selectedTagIds,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        description: description,
        parentId: subtask._id,
        rootId: rootId,
      };

      const res = await axios.post(`${TASKROOM_API_URL}tasks`, body, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.status && res.data?.data) {
        const t = res.data.data;
        const normalized: Card = {
          _id: t._id,
          name: t.title || t.name || '',
          userId: t.userId,
          description: t.description || "",
          tags: t.tags || [],
          tagData: t.tagData || [],
          members: t.assigneeData ? t.assigneeData : [],
          dueDate: t.dueDate,
          startDate: t.startDate,
          checklist: t.checklist || [],
          isOverDue: t.isOverDue,
          isCompleted: t.isCompleted,
          priority: t.priority,
          comments: [],
          commentCount: t.commentCount,
          subTaskCount: t.subTaskCount,
          stageId: columnId,
          assignedToIds: t.assignedToIds || [],
          TaskDataCount: {
            totalChildCount: t.TaskDataCount?.totalChildCount ?? 0,
            totalCompletedChildCount: t.TaskDataCount?.totalCompletedChildCount ?? 0
          }
        };

        setNestedSubtasks(prev => [normalized, ...prev]);

        // Update global state counts
        setColumns(prev => prev.map(col => ({
          ...col,
          cards: col.cards.map(c => {
            if (c._id === rootId) {
              return {
                ...c,
                subTaskCount: String((Number(c.subTaskCount) || 0) + 1),
                TaskDataCount: {
                  ...c.TaskDataCount,
                  totalChildCount: (c.TaskDataCount?.totalChildCount || 0) + 1,
                }
              }
            }
            return c;
          })
        })));

        setNewName("");
        setAssignedToIds([]);
        setStartDate(null);
        setDueDate(null);
        setPriority("");
        setDescription("");
        setSelectedTagIds([]);
        setIsAdding(false);
        if (!isExpanded) setIsExpanded(true);
        toast.success("Nested subtask added");
      }
    } catch (err) {
      console.error("Failed to add nested subtask", err);
      toast.error("Failed to add nested subtask");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchNested = useCallback(async (p: number) => {
    if (isLoading && p !== 1) return;
    setIsLoading(true);
    try {
      const token = localStorage.getItem("garage_tok");
      const res = await axios.get(
        `${TASKROOM_API_URL}tasks/detail/sub/${subtask._id}?size=30&page=${p}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );

      if (res.status === 200) {
        const json = res.data;
        const fetched = json?.data ?? [];
        const metadata = json?.metadata ?? {};

        const normalized = fetched.map((st: any) => ({
          _id: st._id,
          name: st.title || st.name || '',
          userId: st.userId,
          description: st.description || "",
          tags: st.tags || [],
          tagData: st.tagData || [],
          members: st.assigneeData ? st.assigneeData : (st.members || []),
          dueDate: st.dueDate,
          startDate: st.startDate,
          checklist: st.checklist || [],
          isOverDue: st.isOverDue,
          isCompleted: st.isCompleted,
          priority: st.priority,
          comments: [],
          commentCount: st.commentCount,
          subTaskCount: st.subTaskCount,
          stageId: columnId,
          assignedToIds: st.assignedToIds || [],
          TaskDataCount: {
            totalChildCount: st.TaskDataCount?.totalChildCount ?? 0,
            totalCompletedChildCount: st.TaskDataCount?.totalCompletedChildCount ?? 0
          }
        }));

        setNestedSubtasks(prev => p === 1 ? normalized : [...prev, ...normalized]);
        setTotalPages(metadata.totalPages || 1);
        setPage(metadata.currentPage || p);
      }
    } catch (err) {
      console.error("Failed to fetch nested subtasks", err);
    } finally {
      setIsLoading(false);
    }
  }, [subtask._id, columnId, isLoading]);

  useEffect(() => {
    if (!isExpanded || page >= totalPages || isLoading) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        fetchNested(page + 1);
      }
    }, { threshold: 0.1 });

    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [isExpanded, page, totalPages, isLoading, fetchNested]);

  return (
    <div className="space-y-2">
      <div
        className="bg-[#2a2a2f] p-3 rounded-md border border-[#e5e7eb10] hover:border-blue-500/50 cursor-pointer transition-all shadow-sm"
        onClick={(e) => {
          e.stopPropagation();
          if (Number(subtask.subTaskCount) > 0) {
            const next = !isExpanded;
            setIsExpanded(next);
            if (next && nestedSubtasks.length === 0) fetchNested(1);
          }
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-xs font-semibold text-white/90 line-clamp-1">
            {subtask.name.replace(/\b\w/g, char => char.toUpperCase())}
          </h4>
          {subtask.priority && (
            <Flag className={cn("h-3 w-3 shrink-0",
              subtask.priority === "urgent" ? "fill-red-500 text-red-500" :
                subtask.priority === "high" ? "fill-amber-500 text-amber-500" :
                  subtask.priority === "normal" ? "fill-blue-500 text-blue-500" : "text-slate-400"
            )} />
          )}
        </div>

        <div className="flex items-center gap-3 mt-2">
          {subtask.dueDate && (
            <div className="flex items-center gap-1 text-[10px] text-white/40">
              <Clock className="w-2.5 h-2.5" />
              <span>{format(new Date(subtask.dueDate), "MMM d")}</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-[10px] text-white/40">
            <MessageSquare className="w-2.5 h-2.5" />
            <span>{subtask.commentCount ?? 0}</span>
          </div>
          {Number(subtask.subTaskCount) > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-white/40">
              <ListTree className={cn("w-2.5 h-2.5 transition-transform", isExpanded ? "text-blue-400 rotate-90" : "text-purple")} />
              <span>{subtask.subTaskCount}</span>
            </div>
          )}

          {!isReadOnly && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsAdding(!isAdding);
            }}
            className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors ml-auto group-hover:opacity-100 opacity-0"
          >
            <Plus className="w-2.5 h-2.5" />
            <span>Add</span>
          </button>
          )}
        </div>

        {/* Nested Subtask Input Form (Match KanbanColumn style) */}
        {isAdding && !isReadOnly && (
          <div className="mt-2 space-y-3 bg-[#000000] p-3 rounded-xl border border-[#e5e7eb29] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start gap-2">
              <textarea
                placeholder="Nested Subtask Name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                className="w-full px-0 py-1 bg-transparent text-sm placeholder:text-sm text-white/50 placeholder:text-white/50 rounded text-base font-medium focus:outline-none resize-none min-h-[40px]"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSaveNestedSubtask()
                  }
                  if (e.key === "Escape") setIsAdding(false)
                }}
              />
              <button
                onClick={handleSaveNestedSubtask}
                disabled={isSubmitting || !newName.trim()}
                className="flex items-center gap-1.5 bg-[#1a1a24] hover:bg-[#3E3E4A] text-white/50 px-3 py-1.5 rounded-md text-sm font-medium transition-all active:scale-95 disabled:opacity-40"
              >
                {isSubmitting ? "..." : "Save"}
                <span className="text-[12px] opacity-60">↵</span>
              </button>
            </div>

            <div className="space-y-0.5">
              <AssigneePicker
                assignedToIds={assignedToIds}
                onSelect={(ids) => setAssignedToIds(ids)}
              >
                <button className={cn(
                  "flex items-center gap-2.5 px-2 w-full py-2 rounded-md hover:bg-[#1a1a24] text-white/50 hover:text-white/50 transition-colors group",
                  assignedToIds.length > 0 ? "text-white/50 bg-[#1a1a24]" : "text-white/50 hover:text-white/50"
                )}>
                  <div className="p-1 px-1.5 rounded bg-[#1a1a24] group-hover:bg-[#2e2e3a] transition-colors border border-[#e5e7eb10]">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-normal">
                    {assignedToIds.length > 0 ? `${assignedToIds.length} Assignees` : "Add assignee"}
                  </span>
                </button>
              </AssigneePicker>

              <CustomDatePicker
                startDate={startDate ? new Date(startDate) : null}
                dueDate={dueDate ? new Date(dueDate) : null}
                onSelect={(range) => {
                  setStartDate(range.start ? range.start.getTime() : null);
                  setDueDate(range.due ? range.due.getTime() : null);
                }}
              >
                <button className={cn(
                  "flex items-center gap-2.5 w-full px-2 py-2 rounded-md hover:bg-[#1a1a24] transition-colors group",
                  dueDate ? "text-white/50 bg-[#1a1a24]" : "text-white/50 hover:text-white/50"
                )}>
                  <div className="p-1 px-1.5 rounded bg-[#1a1a24] group-hover:bg-[#2e2e3a] transition-colors border border-[#e5e7eb10]">
                    <CalendarIcon className={cn("w-3.5 h-3.5", dueDate && "text-white/50")} />
                  </div>
                  <span className="text-sm font-normal truncate">
                    {dueDate ? `${new Date(startDate!).toLocaleDateString()} ${dueDate ? `- ${new Date(dueDate).toLocaleDateString()}` : ""}` : "Add dates"}
                  </span>
                </button>
              </CustomDatePicker>

              <PriorityPicker
                priority={priority}
                onSelect={(p) => setPriority(p)}
              >
                <button className={cn(
                  "flex items-center gap-2.5 w-full px-2 py-2 rounded-md hover:bg-[#1a1a24] transition-colors group",
                  priority ? "text-white/50 bg-[#1a1a24]" : "text-white/50 hover:text-white/50"
                )}>
                  <div className="p-1 px-1.5 rounded bg-[#1a1a24] group-hover:bg-[#2e2e3a] transition-colors border border-[#e5e7eb10]">
                    <Flag className={cn("w-3.5 h-3.5", priority === "urgent" ? "fill-red-500 text-red-500" : (priority === "high" ? "fill-amber-500 text-amber-500" : ""))} />
                  </div>
                  <span className="text-sm font-normal capitalize">
                    {priority || "Add priority"}
                  </span>
                </button>
              </PriorityPicker>

              <TagPicker
                boardId={boardId}
                selectedTagIds={selectedTagIds}
                onSelect={(ids) => setSelectedTagIds(ids)}
                Idspace={Idspace}
              >
                <button className={cn(
                  "flex items-center gap-2.5 w-full px-2 py-2 rounded-md hover:bg-[#1a1a24] transition-colors group",
                  selectedTagIds.length > 0 ? "text-white/50 bg-[#1a1a24]" : "text-white/50 hover:text-white/50"
                )}>
                  <div className="p-1 px-1.5 rounded bg-[#1a1a24] group-hover:bg-[#2e2e3a] transition-colors border border-[#e5e7eb10]">
                    <TagIcon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-normal">
                    {selectedTagIds.length > 0 ? `${selectedTagIds.length} Tags` : "Add tags"}
                  </span>
                </button>
              </TagPicker>

              <div className="flex gap-2.5 w-full px-2 py-2 rounded-md transition-colors group">
                <div className="p-1 px-1.5 h-fit rounded bg-[#1a1a24] border border-[#e5e7eb10]">
                  <AlignLeft className="w-3.5 h-3.5 text-white/50" />
                </div>
                <textarea
                  placeholder="Add description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-transparent text-sm placeholder:text-sm text-white/50 placeholder:text-white/50 focus:outline-none resize-none max-h-[40px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => {
                  setIsAdding(false)
                  setNewName("")
                  setAssignedToIds([])
                  setStartDate(null)
                  setDueDate(null)
                  setPriority("")
                  setDescription("")
                  setSelectedTagIds([])
                }}
                className="text-[11px] text-white/50 hover:text-white/50 bg-[#1a1a24] p-1.5 rounded-[7px] font-bold cursor-pointer transition-colors px-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nested Subtasks rendering */}
      {isExpanded && (
        <div className="ml-4 border-l border-[#e5e7eb10] pl-2 space-y-2 transition-all">
          {nestedSubtasks.map((ns) => (
            <SubtaskItem
              key={ns._id}
              subtask={ns}
              columnId={columnId}
              rootId={rootId}
              boardId={boardId}
              Idspace={Idspace}
              setColumns={setColumns}
              isReadOnly={isReadOnly}
            />
          ))}

          {isLoading && (
            <div className="flex justify-center py-1">
              <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
            </div>
          )}

          {page < totalPages && <div ref={sentinelRef} className="h-1" />}
        </div>
      )}
    </div>
  )
}

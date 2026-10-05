"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { Card, Column } from "./kanban-board"
import { useState, useCallback, useEffect } from "react"
import { CardModal } from "./card-modal"
import { Calendar, MessageSquare, Link2, MoreHorizontal, Check, Circle } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useCardStore } from "@/store/flowboard/cardStore"
import { toast } from "sonner"
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
  boardId: string
  orgId: string
  setColumns: React.Dispatch<React.SetStateAction<Column[]>>
  userId: string | undefined
  isReadOnly?: boolean
  connected: boolean
  updateTaskAndCardCounts: (newChildCount: number, newCompletedChildCount: number, taskId: string, cardId: string) => void

}

export function KanbanCard({ card, columnId, connected, updateTaskAndCardCounts, userId, isOverlay, boardId, orgId, setColumns, isReadOnly }: KanbanCardProps) {
  const [showModal, setShowModal] = useState(false)
  const { toggleComplete } = useCardStore()
  const [isCompleted, setIsCompleted] = useState(card.isCompleted || false)
  const [showExpiredDialog, setShowExpiredDialog] = useState(false)
  const router = useRouter()

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
  }

  const blockIfReadOnly = useCallback(() => {
    if (!isReadOnly) return false
    toast.error("Observers can only view this board")
    return true
  }, [isReadOnly])

  const handleToggleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent modal open
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
        className="bg-gray-100 dark:bg-gray-800 border-2 border-blue-300 border-dashed rounded-lg h-[100px] opacity-50"
      />
    )
  }
  const avatarColors = [
    "#9333ea", // purple-700
    "#a21caf", // pink-700
    "#4d7c0f", // lime-700
    "#15803d", // green-700
    "#2563eb", // blue-700
    "#4f46e5", // indigo-700
    "#b91c1c", // red-700 (deep red)
    "#c2410c", // orange-700
    "#b45309", // amber-700
    "#4d7c0f", // lime-700
    "#15803d", // green-700
    "#0d9488", // teal-700
    "#0891b2", // cyan-700
    "#2563eb", // blue-700
    "#4f46e5", // indigo-700
    "#000", // violet-700
    "#9333ea", // purple-700
    "#a21caf", // pink-700
  ];
  console.log("czxczxc32dzxcz", card)
  return (
    <>

      <div className={`group relative rounded-lg border border-border bg-white dark:bg-gray-700 p-4 shadow-sm transition-shadow active:cursor-grabbing transition hover:shadow-md ${isOverlay ? "rotate-2 shadow-xl cursor-grabbing" : ""}`}
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...(isReadOnly ? {} : listeners)}
        onClick={() => setShowModal(true)}
      >
        {/* Toggle Complete Button */}
        <button
          onClick={handleToggleComplete}
          className={`absolute top-2 right-2 p-1 rounded-full z-10 transition-opacity ${isCompleted ? "opacity-0 group-hover:opacity-100" : "opacity-0 group-hover:opacity-100"
            } hover:bg-gray-100 dark:hover:bg-gray-600`}
        >
          {isCompleted ? (
            <div className="bg-green-500 rounded-full p-0.5">
              <Check className="w-3 h-3 text-white" />
            </div>
          ) : (
            <Circle className="w-4 h-4 text-gray-400 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-500" />
          )}
        </button>

        <div className=" items-start justify-between gap-2 mb-3">


          <div className="flex items-center gap-1.5">
            {card.tagData && card.tagData.length > 0 && (
              <div className="flex gap-2 mb-2 flex-wrap">
                {card.tagData.map((label, idx) => {
                  // Extract color name and shade from label.color (e.g., "bg-blue-500" -> "blue", "500")
                  const bgMatch = label.color?.match(/bg-([a-z]+)(?:-(\d+))?/);
                  const colorName = bgMatch ? bgMatch[1] : "gray";
                  const originalShade = bgMatch ? bgMatch[2] : null;

                  // Use -600 for text (vibrant), -100 for light bg; fallback if not standard
                  const textColor = originalShade
                    ? `text-${colorName}-600`
                    : "text-gray-700"; // fallback text if custom/unparseable

                  const lightBg = originalShade
                    ? `bg-${colorName}`
                    : "bg-gray-100 dark:bg-gray-800"; // fallback light bg

                  return (
                    <span
                      key={idx}
                      className={`text-xs px-2 py-1 rounded font-semibold break-all ${label.color} text-white`}
                    >
                      {label.name}
                    </span>
                  );
                })}
              </div>
            )}


          </div>

          <h3 className={`mb-2 font-normal text-xs text-card-foreground dark:text-gray-100 leading-snug `}>{card?.name?.replace(/\b\w/g, char => char.toUpperCase()) || ''}</h3>
          {
            card?.description &&
            <p className="mb-4 text-xs text-muted-foreground dark:text-gray-400 line-clamp-2">{card?.description?.replace(/\b\w/g, char => char.toUpperCase()) || ''} </p>

          }



          <div className="mb-4 flex items-center justify-between">
            {/* <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span className="text-xs">jhjjjh</span>
            </div> */}

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Assignees :</span>
              <div className="flex -space-x-2">
                {card.members.length > 0 && (
                  <div className="flex -space-x-2">
                    <>
                      {card?.members?.slice(0, 5)?.map((member, idx) => {
                        const initials = member.name ? member.name.substring(0, 2).toUpperCase() : (member.email ? member.email.substring(0, 2).toUpperCase() : "??");
                        const bg = "bg-blue-500"; // Or dynamic based on name char code if desired
                        const randomColor = "#333";
                        return (
                          <div
                            key={idx}
                            // style={{
                            //   backgroundColor: randomColor,

                            // }}
                            className={`text-white bg-blue-700 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white dark:border-gray-700`}
                            title={member.name || member.email}
                          >
                            {member?.name
                              ? member?.name
                                .split(" ")
                                .slice(0, 2)
                                .map((n) => n[0]?.toUpperCase())
                                .join("")
                              : "?"}
                          </div>
                        )
                      })}

                      {(card?.assignedToIds?.length ?? 0) > 5 && (
                        <div
                          className="flex w-6 h-6 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-muted-foreground ring-1 ring-border cursor-pointer transition-all duration-200 ease-in-out hover:bg-muted/80 hover:scale-110 hover:shadow-md"

                        >
                          +{(card?.assignedToIds?.length ?? 0) - 5}
                        </div>
                      )}
                    </>



                  </div>
                )}
              </div>
            </div>

            {card.isOverDue && (
              <div className="flex items-center gap-1 text-red-600">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" />
                </svg>
                <span className="text-xs">Overdue</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-border pt-3 text-muted-foreground dark:text-gray-400">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="text-xs">{card?.commentCount ?? 0} Comments</span>
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <div className="h-3.5 w-3.5 rounded-sm border border-current flex items-center justify-center">
                <svg viewBox="0 0 10 10" className="h-2 w-2">
                  <path d="M2 5 L4 7 L8 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
              <span className="text-xs font-medium">{card?.TaskDataCount?.totalCompletedChildCount}/{card?.TaskDataCount?.totalChildCount}</span>
            </div>
          </div>
        </div>
      </div>
      {/* <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...(isReadOnly ? {} : listeners)}
          onClick={() => setShowModal(true)}
          className={`bg-white border border-gray-200 rounded-lg p-3 cursor-grab active:cursor-grabbing transition hover:shadow-md group relative ${isOverlay ? "rotate-2 shadow-xl cursor-grabbing" : ""
            }`}
        >
      
          {card.tagData && card.tagData.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {card.tagData.map((label, idx) => (
                <span key={idx} className={`text-white text-xs px-2 py-1 rounded font-semibold break-all   ${label.color || "bg-gray-400"}`}>
                  {label.name}
                </span>
              ))}
            </div>
          )}

    
          <h3 className="font-medium text-gray-800 text-sm mb-2 break-all">{card.name}</h3>

          <div className="flex items-center justify-between text-xs">
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
                      className={`${bg} text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white`}
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

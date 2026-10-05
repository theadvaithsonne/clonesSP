"use client"

import type React from "react"
import { useState, useEffect, Dispatch, SetStateAction, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GripVertical, Edit, Trash2, Plus } from "lucide-react"
import type { Column } from "../types/kanban"
import { toast } from "sonner"
import { useInView } from 'react-intersection-observer'
import { X } from 'lucide-react';
import { Check } from 'lucide-react';

interface ManageStagesDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    columns: Column[]
    onUpdateColumns: (columns: Column[]) => void
    setColumns: Dispatch<SetStateAction<Column[]>>
    currentPage: number
    hasMore: boolean
    isStageLoading: boolean

    userId: string

    setHasMore: Dispatch<SetStateAction<boolean>>
    setCurrentPage: Dispatch<SetStateAction<number>>
    taskRoomId: string
}

const baseurl = "https://uatapi.garage.app/taskroom"

interface CreateTaskRoomRequest {
    name: string
    color: string
    roomId: string
    userId: string
    orderId?: string
    type?: string
    status?: string
    tasks?: [],
    _id?: string
    createdAt?: string
    updatedAt?: string
}

export function ManageStagesDialog({
    open,
    onOpenChange,
    columns,
    onUpdateColumns,
    setColumns,
    currentPage,
    hasMore,
    isStageLoading,
    userId,
    setHasMore, setCurrentPage, taskRoomId
}: ManageStagesDialogProps) {
    const [newStageName, setNewStageName] = useState("")
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState("")
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
    const [stageloading, setstageloading] = useState(false)
    const [addStageloading, setaddStageloading] = useState(false)
    const optionsListRef = useRef<HTMLDivElement | null>(null)

    const { ref: inViewRef, inView } = useInView({
        threshold: 0,
        rootMargin: '100px',
    })

    // Auto-scroll state
    const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null)

    const stageColors = [
        "#b0b3ba59", // Lighter version of #6B7280 (Gray)
        "#8fb6fabd", // Lighter version of #3B82F6 (Blue)
        "#f4d03fc0", // Lighter version of #EAB308 (Yellow)
        "#c397f9b8", // Lighter version of #A855F7 (Purple)
        "#f58a8ab9", // Lighter version of #EF4444 (Red)
        "#a3a7f7bc", // Lighter version of #6366F1 (Indigo)
        "#f498c5ac"  // Lighter version of #EC4899 (Pink)
    ];
    console.log("234234234", columns)
    const isLastStage = (column: Column) => columns.length > 0 && columns[columns.length - 1]._id === column._id
    const handleDeleteTaskRoom = async (id: string) => {


        setstageloading(true)
        try {
            const response = await fetch(`${baseurl}/v1/stages/${id}`, {
                method: "DELETE",
            })

            const deleteStage = await response.json()
            if (deleteStage?.status) {
                //  await setCurrentPage(1)
                //await setColumns([])
                // await setHasMore(true)
                //await loadingStages(taskRoomId, 1)
                setColumns((prevColumns) => prevColumns.filter((column) => column._id !== id));

                await toast.success("Stage Deleted successfully")
            }
            else {
                await toast.success(deleteStage?.message)
            }
        } catch (error) {
            console.error("Failed to delete TaskRoom:", error)
            throw error
        } finally {
            setstageloading(false)
        }
    }
    const createStage = async (data: CreateTaskRoomRequest) => {
        setaddStageloading(true)
        try {
            const response = await fetch(`${baseurl}/v1/stages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            })
            const newStage = await response.json()
            if (newStage?.status) {
                //  await setHasMore(true)
                //  await setCurrentPage(1)
                //   await loadingStages("68d61b504add38cdc6b9847f", 1)
                console.log("3423423424320", newStage)
                const addnewStage = {
                    "name": newStage?.data?.data?.name,
                    "color": newStage?.data?.data?.color,
                    "type": newStage?.data?.data?.type,
                    "orderId": newStage?.data?.data?.orderId,
                    "roomId": newStage?.data?.data?.roomId,
                    "userId": newStage?.data?.data?.userId,
                    "status": newStage?.data?.data?.status,
                    "_id": newStage?.data?.data?._id,
                    tasks: [],
                    "createdAt": newStage?.data?.data?.createdAt,
                    "updatedAt": newStage?.data?.data?.updatedAt,

                }
                setColumns([
                    ...columns.slice(0, -1), // All elements except the last
                    addnewStage,                     // New stage
                    columns[columns.length - 1] // Last element
                ]);
                setNewStageName("");
                // setColumns()
                await toast.success("Stage created successfully")

            } else {
                toast(newStage?.message)
            }
        } catch (error) {
            console.error("Failed to create stage:", error)
            toast.error("Failed to create stage. Please try again.")
        }
        finally {
            setaddStageloading(false)
        }
    }

    const handleAddStage = () => {
        if (!newStageName.trim()) {
            toast.error("Stage name cannot be empty")
            return
        }

        createStage({
            name: newStageName.trim(),
            color: stageColors[(columns.length - 1) % stageColors.length],
            roomId: taskRoomId,
            userId: userId
        })
        setNewStageName("")
    }

    const handleDeleteStage = (stageId: string) => {
        const stageToDelete = columns.find((col) => col._id === stageId)
        if (!stageToDelete || isLastStage(stageToDelete)) {
            toast.error("Cannot delete the last stage")
            return
        }

        const remainingColumns = columns.filter((col) => col._id !== stageId)
        if (remainingColumns.length > 0 && stageToDelete.tasks.length > 0) {
            remainingColumns[0].tasks = [...remainingColumns[0].tasks, ...stageToDelete.tasks]
        }

        setColumns(remainingColumns)
        toast.success("Stage deleted successfully")
    }

    const handleEditStage = (stageId: string) => {
        const stage = columns.find((col) => col._id === stageId)
        if (stage) {
            setEditingId(stageId)
            setEditingName(stage.name)
        } else {
            toast.error("Cannot edit the last stage")
        }
    }

    const handleSaveEdit = () => {
        // Your edit implementation
    }

    const handleCancelEdit = () => {
        setEditingId(null)
        setEditingName("")
    }

    const handleSave = () => {
        onUpdateColumns(columns)
        onOpenChange(false)
    }

    const handleEditTaskRoom = async (id: string) => {
        // if (!selectedTaskRoom) return

        // setIsSubmitting(true)
        setstageloading(true)
        const formdata = {
            name: editingName
        }
        try {
            const response = await fetch(`${baseurl}/v1/stages/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formdata),
            })

            if (response.ok) {
                const updatedStage = await response.json()
                if (updatedStage?.status) {
                    await setColumns(columns.map((col) => (col._id === editingId ? { ...col, name: editingName.trim() } : col)))

                    await handleCancelEdit()
                    toast("Stages updated Sucessfully")
                } else {
                    toast("Failed to update Stages")
                }


            } else {
                const errorStage = await response.json()
                toast(errorStage?.message)
            }
        } catch (error) {
            console.error("Failed to update Stages:", error)
            throw error
        } finally {
            setstageloading(false)
        }
    }



    // const handleKeyPress = (e: React.KeyboardEvent) => {
    //     if (e.key === "Enter") {
    //         e.preventDefault()
    //         if (editingId) {
    //             handleSaveEdit()
    //         } else {
    //             handleAddStage()
    //         }
    //     } else if (e.key === "Escape") {
    //         if (editingId) {
    //             handleCancelEdit()
    //         }
    //     }
    // }

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        if (isLastStage(columns[index])) return
        setDraggedIndex(index)
        e.dataTransfer.setData("text/plain", index.toString())
    }

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        if (isLastStage(columns[index])) return
        e.preventDefault()

        // Auto-scroll logic
        const container = optionsListRef.current
        if (!container) return

        const rect = container.getBoundingClientRect()
        const y = e.clientY
        const scrollSpeed = 10 // Pixels to scroll per interval
        const edgeThreshold = 50 // Pixels from top/bottom to trigger scroll

        // Clear any existing scroll interval
        if (scrollIntervalRef.current) {
            clearInterval(scrollIntervalRef.current)
        }

        // Scroll up when near top
        if (y < rect.top + edgeThreshold && container.scrollTop > 0) {
            scrollIntervalRef.current = setInterval(() => {
                container.scrollTop -= scrollSpeed
            }, 50)
        }
        // Scroll down when near bottom
        else if (y > rect.bottom - edgeThreshold && container.scrollTop < container.scrollHeight - container.clientHeight) {
            scrollIntervalRef.current = setInterval(() => {
                container.scrollTop += scrollSpeed
            }, 50)
        }
    }
    const handleDragEnd = async (id: string) => {
        // Clear scroll interval on drag end
        const originalOrder = [...columns]
        if (scrollIntervalRef.current) {
            clearInterval(scrollIntervalRef.current);
            scrollIntervalRef.current = null;
        }
        setDraggedIndex(null);

        // Store the original columns order before attempting the API call
        ; // Assuming originalColumns is passed or stored

        // Create position map: { _id: index }
        const positionMap: Record<string, number> = {};
        columns.forEach((stage, index) => {
            positionMap[stage._id] = index + 1;
        });
        console.log("Position Map:", positionMap);

        const positionData = {
            positionData: { ...positionMap },
        };

        //setStageLoading(true); // Assuming setStageLoading is a state setter for loading

        try {
            const response = await fetch(`${baseurl}/v1/stages/reposition/${taskRoomId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(positionData),
            });

            if (response.ok) {
                const updatedStage = await response.json();
                if (updatedStage?.status) {
                    toast("Stages Moved successfully");
                    // No need to update columns here if drag-and-drop already updated the UI
                } else {
                    // Revert to original order on failure
                    setColumns(originalOrder);
                    toast("Failed to update stages");
                }
            } else {
                // Revert to original order on HTTP error
                setColumns(originalOrder);
                toast("Failed to update stages");
            }
        } catch (error) {
            // Revert to original order on network or other errors
            setColumns(originalOrder);
            console.error("Failed to update stages:", error);
            toast("Failed to update stages");
            throw error;
        } finally {
            //  setStageLoading(false);
        }
    };
    const handleDragEndas = async (id: string) => {
        // Clear scroll interval on drag end

        if (scrollIntervalRef.current) {
            clearInterval(scrollIntervalRef.current)
            scrollIntervalRef.current = null
        }
        setDraggedIndex(null)
        // Destructure the stages array and create positionData map: { _id: index }
        const positionMap: Record<string, number> = {};
        columns.forEach((stage, index) => {
            positionMap[stage._id] = index;
        });
        console.log("4332432", positionMap)
        const postitionData = {
            postitionData: { ...positionMap }
        }
        try {
            const response = await fetch(`${baseurl}/v1/stages/reposition/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(postitionData),
            })

            if (response.ok) {
                const updatedStage = await response.json()
                if (updatedStage?.status) {

                    toast("Stages updated Sucessfully")
                } else {
                    toast("Failed to update Stages")
                }


            } else {
                toast("Failed to update Stages")
            }
        } catch (error) {
            console.error("Failed to update Stages:", error)
            throw error
        } finally {
            setstageloading(false)
        }



    }
    console.log("taskRoomId", taskRoomId)

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
        e.preventDefault()
        if (draggedIndex === null || draggedIndex === dropIndex || isLastStage(columns[dropIndex])) return

        // Clear scroll interval
        if (scrollIntervalRef.current) {
            clearInterval(scrollIntervalRef.current)
            scrollIntervalRef.current = null
        }

        const updatedColumns = [...columns]
        const [draggedColumn] = updatedColumns.splice(draggedIndex, 1)
        const doneIndex = updatedColumns.findIndex(isLastStage)
        const insertIndex = dropIndex > draggedIndex && dropIndex < doneIndex ? dropIndex : dropIndex > draggedIndex ? dropIndex - 1 : dropIndex

        updatedColumns.splice(insertIndex, 0, draggedColumn)
        setColumns(updatedColumns)
        setDraggedIndex(null)
    }

    // useEffect(() => {
    //     if (inView && hasMore && !isStageLoading) {
    //         loadingStages("68d61b504add38cdc6b9847f", currentPage + 1)
    //     }
    // }, [inView, hasMore, isStageLoading])
    console.log("columns123213", columns)
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[600px] bg-[#0e0e12] border-[#e5e7eb29]">
                <DialogHeader>
                    <DialogTitle className="text-white">Manage Workflow Stages</DialogTitle>
                    <p className="text-sm text-gray-400">
                        View, edit, add, and delete workflow stages to customize your task organization.
                    </p>
                </DialogHeader>


                <div className="space-y-3">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <Label className="text-base font-medium text-white">Current Stages</Label>
                            <span className="text-sm text-gray-400">{columns.length} stages</span>
                        </div>

                        <div
                            ref={(node) => {
                                // Type-safe assignment to optionsListRef
                                if (optionsListRef.current !== node) {
                                    optionsListRef.current = node
                                }
                                inViewRef(node) // Pass to useInView ref
                            }}
                            className="space-y-2 max-h-[200px] overflow-auto p-4 border border-[#e5e7eb29] rounded-lg bg-[#0e0e12]"
                        >
                            {
                                stageloading ?
                                    <>
                                        {[...Array(3)].map((_, index) => (
                                            <div
                                                key={`skeleton-${index}`}
                                                className="flex items-center gap-3 p-3 border border-[#e5e7eb29] rounded-lg bg-gray-900 animate-pulse"
                                            >
                                                <div className="h-4 w-4 bg-gray-800 rounded" />
                                                <div className="w-3 h-3 bg-gray-800 rounded-full" />
                                                <div className="flex-1 h-8 bg-gray-800 rounded" />
                                                <div className="flex items-center gap-1">
                                                    <div className="h-8 w-8 bg-gray-800 rounded" />
                                                    <div className="h-8 w-8 bg-gray-800 rounded" />
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                    :
                                    <>
                                        {columns?.map((column, index) => (
                                            <div
                                                key={column._id}
                                                className={`flex items-center gap-3 p-3 border border-[#e5e7eb29] rounded-lg hover:bg-gray-800/50 ${isLastStage(column) ? '' : 'cursor-move'}`}
                                                draggable={!isLastStage(column)}
                                                onDragStart={(e) => handleDragStart(e, index)}
                                                onDragOver={(e) => handleDragOver(e, index)}
                                                onDrop={(e) => handleDrop(e, index)}
                                                onDragEnd={() => handleDragEnd(column?._id)}
                                            >
                                                <GripVertical
                                                    className={`h-4 w-4 text-gray-500 ${isLastStage(column) ? 'opacity-50 cursor-not-allowed' : 'cursor-grab'}`}
                                                />
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ background: column.color }}
                                                />

                                                {editingId === column._id ? (
                                                    <Input
                                                        value={editingName}
                                                        onChange={(e) => setEditingName(e.target.value)}
                                                        // onKeyPress={handleKeyPress}
                                                        onBlur={handleSaveEdit}
                                                        className="flex-1 h-8 bg-gray-900 border-gray-700 text-white"
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <span className="flex-1 font-medium text-white">{column.name}</span>
                                                )}

                                                {editingId === column._id ?
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-gray-400 hover:text-white"
                                                            onClick={() => setEditingId("")}
                                                        //   disabled={isDoneStage(column)}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-green-500 hover:text-green-600"
                                                            onClick={() => handleEditTaskRoom(column?._id)}
                                                        // disabled={columns.length <= 1 || isDoneStage(column)}
                                                        >
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    : (
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-gray-400 hover:text-white"
                                                                onClick={() => handleEditStage(column?._id)}
                                                            //   disabled={isLastStage(column)}
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-red-500 hover:text-red-600"
                                                                onClick={() => handleDeleteTaskRoom(column?._id)}
                                                                disabled={columns.length <= 1 || isLastStage(column)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                            </div>
                                        ))}
                                    </>
                            }




                            {isStageLoading && (
                                <div className="text-center py-2 text-sm text-gray-500">
                                    Loading more stages...
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-base font-medium text-white">Add New Stage</Label>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Enter stage name..."
                                value={newStageName}
                                onChange={(e) => setNewStageName(e.target.value)}
                                //onKeyPress={handleKeyPress}
                                className="flex-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
                            />
                            <Button
                                onClick={handleAddStage}
                                className="bg-gray-600 hover:bg-gray-700"
                                disabled={addStageloading}
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                Add Stage
                            </Button>
                        </div>
                    </div>

                    <div className="text-xs text-gray-400 bg-[#0e0e12] p-3 rounded-lg border border-[#e5e7eb29]">
                        Drag and drop stages to reorder them (except the last stage, which stays at the end). All stages except the last one can be edited or deleted. Tasks from deleted stages will be moved to the first remaining stage.
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={handleSave} className="bg-white hover:bg-gray-200 text-black font-semibold">
                            Done
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
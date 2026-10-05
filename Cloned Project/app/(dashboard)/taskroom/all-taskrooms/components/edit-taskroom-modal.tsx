"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface TaskRoom {
    id: string
    name: string
    description: string
    color: "blue" | "green" | "purple" | "orange" | "pink"
    progress: {
        completed: number
        total: number
    }
    members: number
    dueDate: string
    createdAt: string
    conversationId: string
}
interface UpdateTaskRoomRequest {
    name: string
    description: string
    color: "blue" | "green" | "purple" | "orange" | "pink"
}

interface EditTaskRoomModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: UpdateTaskRoomRequest) => void
    taskRoom: TaskRoom | null
    isLoading?: boolean
}

const colorOptions = [
    { value: "blue", color: "bg-blue-500" },
    { value: "green", color: "bg-green-500" },
    { value: "purple", color: "bg-purple-500" },
    { value: "orange", color: "bg-orange-500" },
    { value: "pink", color: "bg-pink-500" },
] as const

export function EditTaskRoomModal({ isOpen, onClose, onSubmit, taskRoom, isLoading = false }: EditTaskRoomModalProps) {
    const [formData, setFormData] = useState<UpdateTaskRoomRequest>({
        name: "",
        description: "",
        color: "blue",
    })

    // Update form data when taskRoom changes
    useEffect(() => {
        if (taskRoom) {
            setFormData({
                name: taskRoom.name,
                description: taskRoom.description,
                color: taskRoom.color,
            })
        }
    }, [taskRoom])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (formData?.name?.trim() && formData?.description?.trim()) {
            onSubmit(formData)
        }
    }

    const handleColorSelect = (color: (typeof colorOptions)[number]["value"]) => {
        setFormData((prev) => ({ ...prev, color: color }))
    }

    if (!isOpen || !taskRoom) return null

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-[#1e1e2d] rounded-lg shadow-xl w-full max-w-md border border-gray-800">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <h2 className="text-xl font-semibold text-white">Edit TaskRoom</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-300 transition-colors"
                        disabled={isLoading}
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <p className="text-gray-400 text-sm">Update your TaskRoom details and settings.</p>

                    {/* TaskRoom Name */}
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                            TaskRoom Name
                        </label>
                        <Input
                            id="name"
                            type="text"
                            placeholder="Enter TaskRoom name..."
                            value={formData.name}
                            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                            className="w-full bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 focus:ring-offset-0 focus:ring-gray-700"
                            disabled={isLoading}
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                            Description
                        </label>
                        <Textarea
                            id="description"
                            placeholder="Brief description..."
                            value={formData.description}
                            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                            className="w-full min-h-[80px] resize-none bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 focus:ring-offset-0 focus:ring-gray-700"
                            disabled={isLoading}
                            required
                        />
                    </div>

                    {/* Color Theme */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">Color Theme</label>
                        <div className="flex gap-3">
                            {colorOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleColorSelect(option.value)}
                                    className={`w-8 h-8 rounded-full ${option.color} transition-all duration-200 ${formData.color === option.value
                                        ? "ring-2 ring-offset-2 ring-gray-400 scale-110"
                                        : "hover:scale-105"
                                        }`}
                                    disabled={isLoading}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="flex-1 bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800"
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-white hover:bg-gray-200 text-black font-semibold"
                            disabled={isLoading || !formData.name.trim() || !formData.description.trim()}
                        >
                            {isLoading ? "Updating..." : "Update TaskRoom"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}

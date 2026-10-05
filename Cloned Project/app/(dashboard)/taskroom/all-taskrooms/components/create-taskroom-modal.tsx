"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface CreateTaskRoomRequest {
    name: string
    description: string
    color: "blue" | "green" | "purple" | "orange" | "pink"
    orgId: string
    userId: string

}
interface CreateTaskRoomModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: CreateTaskRoomRequest) => Promise<void>
    organizationId: string
    userId: string
}

const colors = [
    { name: "blue", color: "bg-blue-500", selectedColor: "ring-blue-500" },
    { name: "green", color: "bg-green-500", selectedColor: "ring-green-500" },
    { name: "purple", color: "bg-purple-500", selectedColor: "ring-purple-500" },
    { name: "orange", color: "bg-orange-500", selectedColor: "ring-orange-500" },
    { name: "pink", color: "bg-pink-500", selectedColor: "ring-pink-500" },
] as const

export function CreateTaskRoomModal({ isOpen, onClose, onSubmit, organizationId, userId }: CreateTaskRoomModalProps) {
    const [formData, setFormData] = useState<CreateTaskRoomRequest>({
        name: "",
        description: "",
        color: "blue",
        orgId: organizationId,
        userId: userId

    })
    console.log('formData', formData)
    useEffect(() => {
        setFormData({
            name: "",
            description: "",
            color: "blue",
            orgId: organizationId,
            userId: userId
        })
    }, [userId, organizationId])
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name.trim() || !formData.description.trim()) return

        setIsSubmitting(true)
        try {
            await onSubmit(formData)
            setFormData({
                name: "", description: "", color: "blue", orgId: organizationId,
                userId: userId
            })
            onClose()
        } catch (error) {
            console.error("Failed to create TaskRoom:", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-[#1e1e2d] rounded-lg shadow-xl w-full max-w-md border border-gray-800">
                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-2">
                    <h2 className="text-xl font-semibold text-white">Create New TaskRoom</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Description */}
                    <p className="text-gray-400 text-sm">
                        Create a new TaskRoom to organize your tasks and collaborate with your team.
                    </p>

                    {/* TaskRoom Name */}
                    <div className="space-y-2">
                        <label htmlFor="name" className="block text-sm font-medium text-gray-300">
                            TaskRoom Name
                        </label>
                        <Input
                            id="name"
                            type="text"
                            placeholder="Enter TaskRoom name..."
                            value={formData.name}
                            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                            className="w-full bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 focus:ring-offset-0 focus:ring-gray-700"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label htmlFor="description" className="block text-sm font-medium text-gray-300">
                            Description
                        </label>
                        <Textarea
                            id="description"
                            placeholder="Brief description..."
                            value={formData.description}
                            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                            className="w-full min-h-[80px] resize-none bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 focus:ring-offset-0 focus:ring-gray-700"
                            required
                        />
                    </div>

                    {/* Color Theme */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-300">Color Theme</label>
                        <div className="flex gap-3">
                            {colors.map((theme) => (
                                <button
                                    key={theme.name}
                                    type="button"
                                    onClick={() => setFormData((prev) => ({ ...prev, color: theme.name }))}
                                    className={`w-10 h-10 rounded-full ${theme.color} ring-4 ring-offset-4 ring-offset-[#1e1e2d] transition-all ${formData.color === theme.name
                                        ? `${theme.selectedColor} ring-gray-400`
                                        : "ring-transparent hover:ring-gray-700"
                                        }`}
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
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-white hover:bg-gray-200 text-black font-semibold"
                            disabled={isSubmitting || !formData.name.trim() || !formData.description.trim()}
                        >
                            {isSubmitting ? "Creating..." : "Create TaskRoom"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}

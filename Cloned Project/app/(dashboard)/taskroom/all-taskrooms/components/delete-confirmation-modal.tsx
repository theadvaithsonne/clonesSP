"use client"

import { AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
interface TaskRoom {
    _id: string
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

interface DeleteConfirmationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    taskRoom: TaskRoom | null
    isLoading?: boolean
}

export function DeleteConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    taskRoom,
    isLoading = false,
}: DeleteConfirmationModalProps) {
    if (!isOpen || !taskRoom) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1e1e2d] rounded-lg shadow-xl w-full max-w-md border border-gray-800">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                        </div>
                        <h2 className="text-xl font-semibold text-white">Delete TaskRoom</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-300 transition-colors"
                        disabled={isLoading}
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-gray-400 mb-4">
                        Are you sure you want to delete <strong className="text-white">{taskRoom.name}</strong>? This action cannot be undone.
                    </p>
                    <p className="text-sm text-gray-500">
                        This TaskRoom will be permanently removed.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 p-6 pt-0">
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
                        type="button"
                        onClick={onConfirm}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        disabled={isLoading}
                    >
                        {isLoading ? "Deleting..." : "Delete TaskRoom"}
                    </Button>
                </div>
            </div>
        </div>
    )
}

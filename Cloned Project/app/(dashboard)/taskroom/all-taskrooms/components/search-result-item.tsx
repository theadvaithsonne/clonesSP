"use client"
import { useRouter } from "next/navigation"

interface SearchItem {
    id: string
    title: string
    description: string
    category: "rooms" | "tasks" | "subTasks"
    priority?: string
    tags?: string[]
    isOverDue?: boolean
    isCompleted?: boolean
    roomId?: string
    taskId?: string
}
 
const categoryColors: Record<string, string> = {
    rooms: "bg-blue-500",
    tasks: "bg-orange-500",
    subTasks: "bg-green-500",
}

const priorityColors: Record<string, string> = {
    high: "bg-red-500/20 text-red-400",
    medium: "bg-orange-500/20 text-orange-400",
    low: "bg-green-500/20 text-green-400",
}

const getTagVariant = (tag: string) => {
    const variants: Record<string, string> = {
        "in progress": "bg-orange-500/20 text-orange-400",
        backend: "bg-[#343439] text-slate-300",
        security: "bg-red-500/20 text-red-400",
        design: "bg-purple-500/20 text-purple-400",
        "app assignment": "bg-blue-500/20 text-blue-400",
        "employee management": "bg-indigo-500/20 text-indigo-400",
        deals: "bg-pink-500/20 text-pink-400",
        screens: "bg-cyan-500/20 text-cyan-400",
        taskroom: "bg-[#343439] text-slate-300",
        updation: "bg-amber-500/20 text-amber-400",
        taskrooms: "bg-blue-500/20 text-blue-400",
    }
    return variants[tag.toLowerCase()] || "bg-gray-800 text-gray-400"
}

export default function SearchResultItem({ item }: { item: SearchItem }) {
    const dotColor = categoryColors[item.category] || categoryColors.tasks
    const router = useRouter()
    const approute = (e) => {

        if (e?.category == "rooms") {
            router.push(`/all-taskrooms/${e.id}`)
        }
        if (e?.category == "tasks") {
            router.push(`/all-taskrooms/${e.roomId}?card=${e.id}`)
        }
        if (e?.category == "subTasks") {
            router.push(`/all-taskrooms/${e.roomId}?card=${e?.taskId}&task=${e.id}`)
        }
    }

    return (
        <div className="group cursor-pointer p-2  transition-all hover:border-primary hover:shadow-md"
            onClick={() => approute(item)}
        >
            <div className="flex items-start gap-4">
                {/* Category Color Dot */}
                <div className={`mt-1 h-3 w-3 rounded-full flex-shrink-0 ${dotColor}`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-foreground text-sm transition-colors">{item.title}</h3>
                        {item.isCompleted && (
                            <span className="whitespace-nowrap text-xs font-medium text-green-400">Completed</span>
                        )}
                    </div>

                    {item.description && <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>}

                    {/* Tags, Priority and Status */}
                    {(item.tags?.length || item.priority || item.isOverDue) && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            {item.priority && (
                                <span
                                    className={`text-xs font-medium px-2 py-1 rounded ${priorityColors[item.priority] || priorityColors.medium}`}
                                >
                                    {item.priority}
                                </span>
                            )}
                            {item.tags?.map((tag) => (
                                <span key={tag} className={`text-xs font-medium px-2 py-1 rounded ${getTagVariant(tag)}`}>
                                    {tag}
                                </span>
                            ))}
                            {item.isOverDue && <span className="text-xs font-medium text-red-400">Overdue</span>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

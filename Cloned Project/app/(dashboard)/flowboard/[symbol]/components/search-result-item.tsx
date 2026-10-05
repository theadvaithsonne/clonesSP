"use client"
import { useRouter } from "next/navigation"
import { useBoardStore } from "@/store/flowboard/boardStore"
import { useParams } from "next/navigation"
interface SearchItem {

    id: string
    title: string
    description: string
    category: "stages" | "boards" | "cards"
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
    high: "bg-red-100 text-red-700",
    medium: "bg-orange-100 text-orange-700",
    low: "bg-green-100 text-green-700",
}

const getTagVariant = (tag: string) => {
    const variants: Record<string, string> = {
        "in progress": "bg-orange-100 text-orange-700",
        backend: "bg-slate-100 text-slate-700",
        security: "bg-red-100 text-red-700",
        design: "bg-purple-100 text-purple-700",
        "app assignment": "bg-blue-100 text-blue-700",
        "employee management": "bg-indigo-100 text-indigo-700",
        deals: "bg-pink-100 text-pink-700",
        screens: "bg-cyan-100 text-cyan-700",
        taskroom: "bg-slate-100 text-slate-700",
        updation: "bg-amber-100 text-amber-700",
        taskrooms: "bg-blue-100 text-blue-700",
    }
    return variants[tag.toLowerCase()] || "bg-gray-100 text-gray-700"
}

export default function SearchResultItem({ item, setIsFetchingColumns, sortOrder, stageFunction }: { stageFunction: (query: string) => void, sortOrder: string, item: SearchItem, setIsFetchingColumns: React.Dispatch<React.SetStateAction<boolean>> }) {
    const dotColor = categoryColors[item.category] || categoryColors.tasks
    const { fetchBoardDetailsStageId } = useBoardStore()

    const router = useRouter()
    const approute = (e) => {

        console.log("3c21111", e)
        if (e?.category == "boards") {
            router.push(`/flowboard/${e.id}`)
        }
        if (e?.category == "stages") {
            stageFunction(e?.id)
            // Fetch page 1

        }
        if (e?.category == "cards") {
            router.push(`/flowboard/${e.roomId}?cardId=${e.id}`)
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
                            <span className="whitespace-nowrap text-xs font-medium text-green-600">Completed</span>
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
                            {item.isOverDue && <span className="text-xs font-medium text-red-600">Overdue</span>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

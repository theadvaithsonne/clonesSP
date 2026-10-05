"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Search, X, Loader2 } from "lucide-react"
import SearchResultItem from "./search-result-item"
import Cookies from "js-cookie"

interface TaskItem {
    _id: string
    title?: string
    name?: string
    description?: string
    priority?: string
    tags?: string[]
    dueDate?: number
    isOverDue?: boolean
    isCompleted?: boolean
    roomId?: string
}

interface SubTaskItem {
    _id: string
    name?: string
    description?: string
    taskId?: string
    roomId?: string
    boardId?: string
}

interface RoomItem {
    _id: string
    name?: string
    description?: string
}

interface Metadata {
    count: number
    totalPages: number
    currentPage: number
    nextPage: number | null
}

interface SectionData<T> {
    data: T[]
    metadata: Metadata
}

interface SearchResponse {
    status: boolean
    message: string
    data: {
        boards?: SectionData<RoomItem>
        stages?: SectionData<TaskItem>
        cards?: SectionData<SubTaskItem>
    }
}

interface SectionState<T> {
    items: T[]
    metadata: Metadata
    isLoading: boolean
}

const API_BASE_URL = "https://uatapi.garage.app/flowboard/v1/boards/global/search"

interface SearchListProps {
    query: string
    setQuery: (query: string) => void
    setIsFetchingColumns: React.Dispatch<React.SetStateAction<boolean>>
    sortOrder: string
    stageFunction: (query: string) => void
}

const INITIAL_METADATA: Metadata = {
    count: 0,
    totalPages: 0,
    currentPage: 1,
    nextPage: null,
}

export default function SearchList({
    query,
    setQuery,
    setIsFetchingColumns,
    sortOrder, stageFunction
}: SearchListProps) {
    const [results, setResults] = useState<{
        boards: SectionState<RoomItem>
        stages: SectionState<TaskItem>
        cards: SectionState<SubTaskItem>
    }>({
        boards: { items: [], metadata: INITIAL_METADATA, isLoading: false },
        stages: { items: [], metadata: INITIAL_METADATA, isLoading: false },
        cards: { items: [], metadata: INITIAL_METADATA, isLoading: false },
    })

    // Loading state for the initial search query
    const [isSearching, setIsSearching] = useState(false)

    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    // Sentinels for infinite scroll
    const roomsSentinelRef = useRef<HTMLDivElement>(null)
    const tasksSentinelRef = useRef<HTMLDivElement>(null)
    const subTasksSentinelRef = useRef<HTMLDivElement>(null)

    const fetchResults = useCallback(
        async (searchQuery: string) => {
            if (!searchQuery.trim()) {
                setResults({
                    boards: { items: [], metadata: INITIAL_METADATA, isLoading: false },
                    stages: { items: [], metadata: INITIAL_METADATA, isLoading: false },
                    cards: { items: [], metadata: INITIAL_METADATA, isLoading: false },
                })
                return
            }

            setIsSearching(true)
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = 0
            }
            try {
                const params = new URLSearchParams({
                    searchData: searchQuery,
                })

                const token = localStorage.getItem("garage_tok")
                const response = await fetch(`${API_BASE_URL}?${params.toString()}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                })

                if (!response.ok) {
                    throw new Error(`Search failed: ${response.status}`)
                }

                const data = (await response.json()) as SearchResponse

                if (data.status && data.data) {
                    setResults({
                        boards: {
                            items: data.data.boards?.data ?? [],
                            metadata: data.data.boards?.metadata ?? INITIAL_METADATA,
                            isLoading: false,
                        },
                        stages: {
                            items: data.data.stages?.data ?? [],
                            metadata: data.data.stages?.metadata ?? INITIAL_METADATA,
                            isLoading: false,
                        },
                        cards: {
                            items: data.data.cards?.data ?? [],
                            metadata: data.data.cards?.metadata ?? INITIAL_METADATA,
                            isLoading: false,
                        },
                    })
                }
            } catch (error) {
                console.error("[Search error]:", error)
            } finally {
                setIsSearching(false)
            }
        },
        []
    )

    const loadMore = useCallback(
        async (collection: 'boards' | 'stages' | 'cards') => {
            // Prioritize loading all stages pages before allowing cards to load
            if (collection === 'cards') {
                const tasksMeta = results.stages.metadata
                if (tasksMeta.currentPage < tasksMeta.totalPages) {
                    return
                }
            }

            const resultKey = collection === 'stages' ? 'stages' : collection === 'boards' ? 'boards' : 'cards'
            const currentSection = results[resultKey]

            if (currentSection.isLoading || currentSection.metadata.currentPage >= currentSection.metadata.totalPages) {
                return
            }

            // Set loading for section
            setResults((prev) => ({
                ...prev,
                [resultKey]: { ...prev[resultKey], isLoading: true },
            }))

            try {
                const nextPage = currentSection.metadata.currentPage + 1
                const params = new URLSearchParams({
                    searchData: query,
                    collection: collection === 'stages' ? "stage" : collection === 'boards' ? 'board' : 'card',
                    page: nextPage.toString()
                })

                const token = localStorage.getItem("garage_tok")
                const response = await fetch(`${API_BASE_URL}?${params.toString()}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                })

                if (!response.ok) {
                    throw new Error(`Load more failed: ${response.status}`)
                }

                const data = (await response.json()) as SearchResponse

                if (data.status && data.data) {
                    // The API returns the data structure. Depending on 'collection', we extract the relevant part.

                    let newItems: any[] = []
                    let newMetadata: Metadata = INITIAL_METADATA

                    if (collection === 'boards' && data.data.boards) {
                        newItems = data.data.boards.data
                        newMetadata = data.data.boards.metadata
                    } else if (collection === 'stages' && data.data.stages) {
                        newItems = data.data.stages.data
                        newMetadata = data.data.stages.metadata
                    } else if (collection === 'cards' && data.data.cards) {
                        newItems = data.data.cards.data
                        newMetadata = data.data.cards.metadata
                    }

                    if (newMetadata.currentPage === 0) {
                        // Fallback if metadata is not returned correctly or empty for some reason, 
                        // but we got items, typically shouldn't happen based on API description.
                        // We'll trust the API returns correct metadata for 'nextPage' or 'currentPage'.
                    }

                    setResults((prev) => ({
                        ...prev,
                        [resultKey]: {
                            items: [...prev[resultKey].items, ...newItems],
                            metadata: newMetadata,
                            isLoading: false,
                        },
                    }))
                } else {
                    // Fallback if data format is unexpected
                    setResults((prev) => ({
                        ...prev,
                        [resultKey]: { ...prev[resultKey], isLoading: false },
                    }))
                }
            } catch (error) {
                console.error(`[Load more ${collection} error]:`, error)
                setResults((prev) => ({
                    ...prev,
                    [resultKey]: { ...prev[resultKey], isLoading: false },
                }))
            }
        },
        [query, results]
    )

    useEffect(() => {
        const handler = setTimeout(() => {
            fetchResults(query)
        }, 300)

        return () => clearTimeout(handler)
    }, [query, fetchResults])


    // Intersection Observers setup
    useEffect(() => {
        const createObserver = (
            target: HTMLDivElement | null,
            callback: () => void,
            shouldObserve: boolean
        ) => {
            if (!target || !shouldObserve) return null;

            const observer = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting) {
                        callback();
                    }
                },
                {
                    root: scrollContainerRef.current,
                    threshold: 0.1,
                    rootMargin: '50px' // Preload a bit before reaching exact bottom
                }
            );

            observer.observe(target);
            return observer;
        };

        const roomsObserver = createObserver(
            roomsSentinelRef.current,
            () => loadMore('boards'),
            !results.boards.isLoading && results.boards.metadata.currentPage < results.boards.metadata.totalPages
        );

        const tasksObserver = createObserver(
            tasksSentinelRef.current,
            () => loadMore('stages'),
            !results.stages.isLoading && results.stages.metadata.currentPage < results.stages.metadata.totalPages
        );

        const subTasksObserver = createObserver(
            subTasksSentinelRef.current,
            () => loadMore('cards'),
            !results.cards.isLoading && results.cards.metadata.currentPage < results.cards.metadata.totalPages
        );

        return () => {
            roomsObserver?.disconnect();
            tasksObserver?.disconnect();
            subTasksObserver?.disconnect();
        };
    }, [results, loadMore]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [])

    useEffect(() => {
        if (query) {
            setIsOpen(true)
        }
    }, [query])


    const hasResults =
        results.boards.items.length > 0 ||
        results.stages.items.length > 0 ||
        results.cards.items.length > 0

    return (
        <div ref={containerRef} className="relative space-y-4 w-full max-w-2xl">
            {/* Search Input */}
            <div className="flex items-center gap-2 flex-1 max-w-md bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-md">
                <Search className="w-4 h-4 text-muted-foreground dark:text-gray-400" />
                <input
                    type="text"
                    placeholder="Search boards, lists, cards, checklists..."
                    className="
    border-0 bg-transparent w-full 
    placeholder-muted-foreground dark:placeholder-gray-500 
    text-sm 
    focus:ring-0 focus:border-0 focus:outline-none
    h-auto p-0 text-foreground dark:text-gray-200
  "
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                    autoComplete="off"
                />
                {query && (
                    <button
                        onClick={() => setQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Clear search"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>

            {/* Results Dropdown */}
            {query && isOpen && (
                <div
                    className="absolute top-full left-0 right-0 z-50 mt-2 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl"
                >
                    {isSearching ? (
                        <div className="py-12 flex justify-center items-center text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" />
                            <span>Searching...</span>
                        </div>
                    ) : !hasResults ? (
                        <div className="py-12 px-6 text-center text-sm text-muted-foreground">
                            No results found for <span className="font-medium">{query}</span>
                        </div>
                    ) : (
                        <div
                            ref={scrollContainerRef}
                            className="max-h-[min(480px,80vh)] overflow-y-auto overscroll-contain p-4 space-y-6 scrollbar-thin"
                        >
                            {/* boards */}
                            {results.boards.items.length > 0 && (
                                <div>
                                    <h3 className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        <span>Boards</span>
                                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                                            {results.boards.metadata.count || results.boards.items.length}
                                        </span>
                                    </h3>
                                    <div className="space-y-1.5">
                                        {results.boards.items.map((item) => (
                                            <SearchResultItem
                                                key={item._id}
                                                setIsFetchingColumns={setIsFetchingColumns}
                                                sortOrder={sortOrder}
                                                stageFunction={stageFunction}
                                                item={{
                                                    id: item._id,
                                                    title: item.name || "Unnamed boards",
                                                    description: item.description || "",
                                                    category: "boards",
                                                }}
                                            />
                                        ))}
                                        {/* Sentinel for boards */}
                                        <div ref={roomsSentinelRef} className="h-4 w-full flex justify-center items-center">
                                            {results.boards.isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* stages */}
                            {results.stages.items.length > 0 && (
                                <div>
                                    <h3 className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        <span>stages</span>
                                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                                            {results.stages.metadata.count || results.stages.items.length}
                                        </span>
                                    </h3>
                                    <div className="space-y-1.5">
                                        {results.stages.items.map((item) => (
                                            <SearchResultItem
                                                key={item._id}
                                                setIsFetchingColumns={setIsFetchingColumns}
                                                sortOrder={sortOrder}
                                                stageFunction={stageFunction}
                                                item={{
                                                    id: item._id,
                                                    title: item.name || "Untitled stages",
                                                    description: item.description || "",
                                                    category: "stages",
                                                    priority: item.priority,
                                                    tags: item.tags,
                                                    isOverDue: item.isOverDue,
                                                    isCompleted: item.isCompleted,
                                                    roomId: item.roomId,
                                                }}
                                            />
                                        ))}
                                        {/* Sentinel for stages */}
                                        <div ref={tasksSentinelRef} className="h-4 w-full flex justify-center items-center">
                                            {results.stages.isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* cards */}
                            {results.cards.items.length > 0 && (
                                <div>
                                    <h3 className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        <span>cards</span>
                                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                                            {results.cards.metadata.count || results.cards.items.length}
                                        </span>
                                    </h3>
                                    <div className="space-y-1.5">
                                        {results.cards.items.map((item) => (
                                            <SearchResultItem
                                                key={item._id}
                                                sortOrder={sortOrder}
                                                setIsFetchingColumns={setIsFetchingColumns}
                                                stageFunction={stageFunction}
                                                item={{
                                                    id: item._id,
                                                    title: item.name || "Untitled cards",
                                                    description: "",
                                                    category: "cards",
                                                    roomId: item.boardId,
                                                    taskId: item.taskId,
                                                }}
                                            />
                                        ))}
                                        {/* Sentinel for cards */}
                                        <div ref={subTasksSentinelRef} className="h-4 w-full flex justify-center items-center">
                                            {results.cards.isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Search, X, Loader2 } from "lucide-react"
import SearchResultItem from "./search-result-item"

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
  subTaskDetail?: string
  description?: string
  taskId?: string
  roomId?: string
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
    rooms?: SectionData<RoomItem>
    tasks?: SectionData<TaskItem>
    subTasks?: SectionData<SubTaskItem>
  }
}

interface SectionState<T> {
  items: T[]
  metadata: Metadata
  isLoading: boolean
}

const API_BASE_URL = "https://uatapi.garage.app/taskroom/v1/rooms/search"

interface SearchListProps {
  query: string
  setQuery: (query: string) => void
  orgId: string
  userId: string
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
  orgId,
  userId,
}: SearchListProps) {
  const [results, setResults] = useState<{
    rooms: SectionState<RoomItem>
    tasks: SectionState<TaskItem>
    subTasks: SectionState<SubTaskItem>
  }>({
    rooms: { items: [], metadata: INITIAL_METADATA, isLoading: false },
    tasks: { items: [], metadata: INITIAL_METADATA, isLoading: false },
    subTasks: { items: [], metadata: INITIAL_METADATA, isLoading: false },
  })

  // Loading state for the initial search query
  const [isSearching, setIsSearching] = useState(false)

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Sentinels for infinite scroll
  const roomsSentinelRef = useRef<HTMLDivElement>(null)
  const tasksSentinelRef = useRef<HTMLDivElement>(null)
  const subTasksSentinelRef = useRef<HTMLDivElement>(null)

  const fetchResults = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults({
          rooms: { items: [], metadata: INITIAL_METADATA, isLoading: false },
          tasks: { items: [], metadata: INITIAL_METADATA, isLoading: false },
          subTasks: { items: [], metadata: INITIAL_METADATA, isLoading: false },
        })
        return
      }

      setIsSearching(true)
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0
      }
      try {
        const params = new URLSearchParams({
          orgId: orgId,
          userId: userId,
          searchData: searchQuery,
        })

        const response = await fetch(`${API_BASE_URL}?${params.toString()}`)

        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`)
        }

        const data = (await response.json()) as SearchResponse

        if (data.status && data.data) {
          setResults({
            rooms: {
              items: data.data.rooms?.data ?? [],
              metadata: data.data.rooms?.metadata ?? INITIAL_METADATA,
              isLoading: false,
            },
            tasks: {
              items: data.data.tasks?.data ?? [],
              metadata: data.data.tasks?.metadata ?? INITIAL_METADATA,
              isLoading: false,
            },
            subTasks: {
              items: data.data.subTasks?.data ?? [],
              metadata: data.data.subTasks?.metadata ?? INITIAL_METADATA,
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
    [orgId, userId]
  )

  const loadMore = useCallback(
    async (collection: 'room' | 'task' | 'subtask') => {
      // Prioritize loading all tasks pages before allowing subtasks to load
      if (collection === 'subtask') {
        const tasksMeta = results.tasks.metadata
        if (tasksMeta.currentPage < tasksMeta.totalPages) {
          return
        }
      }

      const resultKey = collection === 'room' ? 'rooms' : collection === 'task' ? 'tasks' : 'subTasks'
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
          orgId: orgId,
          userId: userId,
          searchData: query,
          collection: collection,
          page: nextPage.toString()
        })

        const response = await fetch(`${API_BASE_URL}?${params.toString()}`)

        if (!response.ok) {
          throw new Error(`Load more failed: ${response.status}`)
        }

        const data = (await response.json()) as SearchResponse

        if (data.status && data.data) {
          // The API returns the data structure. Depending on 'collection', we extract the relevant part.

          let newItems: any[] = []
          let newMetadata: Metadata = INITIAL_METADATA

          if (collection === 'room' && data.data.rooms) {
            newItems = data.data.rooms.data
            newMetadata = data.data.rooms.metadata
          } else if (collection === 'task' && data.data.tasks) {
            newItems = data.data.tasks.data
            newMetadata = data.data.tasks.metadata
          } else if (collection === 'subtask' && data.data.subTasks) {
            newItems = data.data.subTasks.data
            newMetadata = data.data.subTasks.metadata
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
    [orgId, userId, query, results]
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
      () => loadMore('room'),
      !results.rooms.isLoading && results.rooms.metadata.currentPage < results.rooms.metadata.totalPages
    );

    const tasksObserver = createObserver(
      tasksSentinelRef.current,
      () => loadMore('task'),
      !results.tasks.isLoading && results.tasks.metadata.currentPage < results.tasks.metadata.totalPages
    );

    const subTasksObserver = createObserver(
      subTasksSentinelRef.current,
      () => loadMore('subtask'),
      !results.subTasks.isLoading && results.subTasks.metadata.currentPage < results.subTasks.metadata.totalPages
    );

    return () => {
      roomsObserver?.disconnect();
      tasksObserver?.disconnect();
      subTasksObserver?.disconnect();
    };
  }, [results, loadMore]);


  const hasResults =
    results.rooms.items.length > 0 ||
    results.tasks.items.length > 0 ||
    results.subTasks.items.length > 0

  return (
    <div className="relative space-y-4 w-full max-w-2xl">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search TaskRooms, Tasks, Subtasks... (⌘K)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg text-sm border border-[#e5e7eb29] bg-background py-2.5 pl-10 pr-10 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
      {query && (
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
              {/* Rooms */}
              {results.rooms.items.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>TaskRooms</span>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                      {results.rooms.metadata.count || results.rooms.items.length}
                    </span>
                  </h3>
                  <div className="space-y-1.5">
                    {results.rooms.items.map((item) => (
                      <SearchResultItem
                        key={item._id}
                        item={{
                          id: item._id,
                          title: item.name || "Unnamed Room",
                          description: item.description || "",
                          category: "rooms",
                        }}
                      />
                    ))}
                    {/* Sentinel for Rooms */}
                    <div ref={roomsSentinelRef} className="h-4 w-full flex justify-center items-center">
                      {results.rooms.isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                  </div>
                </div>
              )}

              {/* Tasks */}
              {results.tasks.items.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Tasks</span>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                      {results.tasks.metadata.count || results.tasks.items.length}
                    </span>
                  </h3>
                  <div className="space-y-1.5">
                    {results.tasks.items.map((item) => (
                      <SearchResultItem
                        key={item._id}
                        item={{
                          id: item._id,
                          title: item.title || "Untitled Task",
                          description: item.description || "",
                          category: "tasks",
                          priority: item.priority,
                          tags: item.tags,
                          isOverDue: item.isOverDue,
                          isCompleted: item.isCompleted,
                          roomId: item.roomId,
                        }}
                      />
                    ))}
                    {/* Sentinel for Tasks */}
                    <div ref={tasksSentinelRef} className="h-4 w-full flex justify-center items-center">
                      {results.tasks.isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                  </div>
                </div>
              )}

              {/* SubTasks */}
              {results.subTasks.items.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>SubTasks</span>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                      {results.subTasks.metadata.count || results.subTasks.items.length}
                    </span>
                  </h3>
                  <div className="space-y-1.5">
                    {results.subTasks.items.map((item) => (
                      <SearchResultItem
                        key={item._id}
                        item={{
                          id: item._id,
                          title: item.subTaskDetail || "Untitled Subtask",
                          description: "",
                          category: "subTasks",
                          roomId: item.roomId,
                          taskId: item.taskId,
                        }}
                      />
                    ))}
                    {/* Sentinel for SubTasks */}
                    <div ref={subTasksSentinelRef} className="h-4 w-full flex justify-center items-center">
                      {results.subTasks.isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
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
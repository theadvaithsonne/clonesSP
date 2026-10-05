"use client"

import * as React from "react"
import { Tag, Check, Plus, ChevronLeft, Search, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useTagStore } from "@/store/athena/tagStore"
import { toast } from "sonner"
import { TAG_PRESET_HEX, getTagStyles, isSameTagColor, normalizeTagColor } from "./tag-colors"

const tagInputClass =
  "w-full px-3 py-2 text-sm text-white/80 bg-white/[0.04] border border-white/[0.08] rounded-lg outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-white/[0.08] placeholder:text-white/30"

const searchTagInputClass =
  "w-full h-7 px-2.5 py-0 text-xs text-white/80 bg-white/[0.04] border border-white/[0.08] rounded-md outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-white/[0.08] placeholder:text-xs placeholder:text-white/30"

interface TagPickerProps {
  boardId: string
  selectedTagIds: string[]
  onSelect: (tagIds: string[], selectedTags?: Array<{ _id: string; name: string; color: string }>) => void
  Idspace: string
  children: React.ReactNode
  activeColor?: string
  bgColor?: string
  borderColor?: string
  contentClassName?: string
}

export function TagChip({
  label,
  onRemove,
  disabled,
  maxWidthClass = "max-w-[148px]",
}: {
  label: { _id: string; name: string; color: string }
  onRemove?: () => void
  disabled?: boolean
  maxWidthClass?: string
}) {
  return (
    <div className="group/tag relative inline-flex max-w-full min-w-0">
      <span
        className={cn(
          "block min-w-0 truncate text-[11px] font-semibold px-2.5 py-1 rounded-md border border-black/10",
          maxWidthClass
        )}
        style={getTagStyles(label.color)}
        title={label.name}
      >
        {label.name}
      </span>
      {!disabled && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="absolute -top-1.5 -right-1.5 opacity-0 group-hover/tag:opacity-100 bg-[#1a1a22] border border-white/10 rounded-full w-4 h-4 flex items-center justify-center transition-all hover:bg-red-500/20 hover:border-red-400/40 z-10"
          title="Remove tag"
        >
          <X className="w-2.5 h-2.5 text-white/70" />
        </button>
      )}
    </div>
  )
}

export function TagPicker({
  boardId,
  selectedTagIds,
  onSelect,
  Idspace,
  children,
  contentClassName = "bg-[#121218]",
}: TagPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isCreating, setIsCreating] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [selectedColor, setSelectedColor] = React.useState(TAG_PRESET_HEX[0])
  const [tags, setTags] = React.useState<Array<{ _id: string; name: string; color: string }>>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  const { createTag } = useTagStore()

  const fetchTags = React.useCallback(async () => {
    if (!Idspace) return
    setIsLoading(true)
    try {
      const token = localStorage.getItem("garage_tok")
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_TASKROOM_URL}tags?spaceId=${Idspace}&size=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await response.json()
      if (data.status) {
        setTags(data.data || [])
      }
    } catch (error) {
      console.error("Error fetching tags:", error)
    } finally {
      setIsLoading(false)
    }
  }, [Idspace])

  React.useEffect(() => {
    if (open) fetchTags()
  }, [open, fetchTags])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setIsCreating(false)
      setNewName("")
      setSearchQuery("")
    }
  }

  const emitSelection = (newIds: string[], pool: Array<{ _id: string; name: string; color: string }> = tags) => {
    onSelect(
      newIds,
      pool.filter((t) => newIds.includes(t._id))
    )
  }

  const handleToggleTag = (tagId: string) => {
    const newIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId]
    emitSelection(newIds)
  }

  const handleCreateTag = async () => {
    if (!newName.trim()) return
    setIsSaving(true)
    try {
      const newTag = await createTag({
        workspaceId: boardId,
        spaceId: Idspace,
        name: newName.trim(),
        color: selectedColor,
      })
      if (newTag) {
        const nextTags = [...tags, { _id: newTag._id, name: newTag.name, color: newTag.color }]
        setTags(nextTags)
        const newIds = [...selectedTagIds, newTag._id]
        emitSelection(newIds, nextTags)
        setNewName("")
        setIsCreating(false)
      }
    } catch {
      toast.error("Failed to create tag")
    } finally {
      setIsSaving(false)
    }
  }

  const filteredTags = tags.filter((t) =>
    t?.name?.toLowerCase()?.includes(searchQuery.toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className={cn("w-80 p-0 rounded-xl shadow-2xl border border-white/[0.08]", contentClassName)}
        align="start"
        sideOffset={6}
      >
        <div className="flex flex-col max-h-[420px]">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-sm text-white/90">
                {isCreating ? "New tag" : "Tags"}
              </h4>
              {!isCreating && (
                <p className="text-[11px] text-white/35 mt-0.5">Select tags for this card</p>
              )}
            </div>
            {isCreating && (
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false)
                  setNewName("")
                }}
                className="p-1.5 hover:bg-white/[0.06] rounded-lg transition"
              >
                <ChevronLeft className="w-4 h-4 text-white/50" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
            {isCreating ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-semibold text-white/45 uppercase tracking-wide block mb-1.5">
                    Name
                  </label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Tag name"
                    className={tagInputClass}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-white/45 uppercase tracking-wide block mb-1.5">
                    Color
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {TAG_PRESET_HEX.map((color) => {
                      const { fontColor } = normalizeTagColor(color)
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSelectedColor(color)}
                          className={cn(
                            "h-8 rounded-lg transition-transform hover:scale-105 relative",
                            isSameTagColor(selectedColor, color)
                              ? "ring-2 ring-offset-2 ring-offset-[#121218] ring-white/60"
                              : "ring-2 ring-transparent"
                          )}
                          style={{ backgroundColor: color }}
                        >
                          {isSameTagColor(selectedColor, color) && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Check
                                className="w-3.5 h-3.5"
                                style={{ color: fontColor === "#FFFFFF" ? "#FFFFFF" : "rgba(0,0,0,0.7)" }}
                                strokeWidth={3}
                              />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-white/35 uppercase tracking-wide">Preview</span>
                  <span
                    className={cn(
                      "text-[11px] px-2.5 py-1 rounded-md font-semibold border border-black/10",
                      !newName.trim() && "opacity-80"
                    )}
                    style={getTagStyles(selectedColor)}
                  >
                    {newName.trim() || "Tag name"}
                  </span>
                </div>
                <div className="flex items-center justify-end pt-2 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={handleCreateTag}
                    disabled={isSaving || !newName.trim()}
                    className="px-4 py-1.5 bg-brand hover:bg-brand/90 text-brand-foreground rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? "Saving..." : "Create"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
                  <input
                    placeholder="Search tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={cn(searchTagInputClass, "pl-8")}
                  />
                </div>
                <div className="space-y-1">
                  {isLoading ? (
                    <div className="py-6 flex flex-col items-center gap-2 text-white/40 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading tags...
                    </div>
                  ) : filteredTags.length > 0 ? (
                    filteredTags.map((tag) => {
                      const isSelected = selectedTagIds.includes(tag._id)
                      return (
                        <button
                          key={tag._id}
                          type="button"
                          onClick={() => handleToggleTag(tag._id)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition text-left min-w-0",
                            isSelected ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                          )}
                        >
                          <span
                            className="shrink-0 w-3 h-3 rounded-sm"
                            style={{ backgroundColor: getTagStyles(tag.color).backgroundColor }}
                          />
                          <span className="flex-1 truncate text-[13px] text-white/80 font-medium">{tag.name}</span>
                          <span
                            className={cn(
                              "shrink-0 w-4 h-4 rounded border flex items-center justify-center transition",
                              isSelected ? "bg-brand border-brand" : "border-white/20 bg-transparent"
                            )}
                          >
                            {isSelected && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                          </span>
                        </button>
                      )
                    })
                  ) : (
                    <div className="py-8 text-center">
                      <Tag className="w-5 h-5 text-white/15 mx-auto mb-2" />
                      <p className="text-sm text-white/35">No tags found</p>
                      <p className="text-[11px] text-white/25 mt-1">Create one below</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {!isCreating && (
            <div className="p-3 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => {
                  setNewName(searchQuery)
                  setIsCreating(true)
                }}
                className="w-full py-2 bg-white/[0.04] hover:bg-white/[0.07] text-white/70 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Create new tag
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

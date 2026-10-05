"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Star,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Note, NoteActions, UpdateNoteData } from "../types";
import NoteCard from "../components/NoteCard";
import NoteDrawer from "../components/NoteDrawer";
import VersionHistory from "../components/VersionHistory";
import LoadingSpinner, { NotesGridSkeleton } from "../components/LoadingSpinner";
import { buildExternalUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/utils/api";

export default function StarredNotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [openInEditMode, setOpenInEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionHistoryNoteId, setVersionHistoryNoteId] = useState<string | null>(null);

  // Fetch starred notes from API
  const fetchStarredNotes = async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams({
        isStarred: "true", // Only fetch starred notes
      });

      if (searchQuery) queryParams.append("search", searchQuery);

      const response = await authenticatedFetch(
        buildExternalUrl(`notes?${queryParams.toString()}`)
      );

      if (!response.ok) throw new Error("Failed to fetch starred notes");

      const data = await response.json();
      setNotes(data.notes || []);
    } catch (error) {
      console.error("Error fetching starred notes:", error);
      toast.error("Failed to load starred notes");
    } finally {
      setIsLoading(false);
    }
  };

  // Load notes on component mount
  useEffect(() => {
    fetchStarredNotes();
  }, []);

  // Listen for inline refresh event
  useEffect(() => {
    const handleRefresh = (event: Event) => {
      const customEvent = event as CustomEvent<{ section?: string }>;
      if (customEvent.detail?.section === "starred") {
        fetchStarredNotes();
      }
    };
    window.addEventListener("thoughts:inline-refresh", handleRefresh as EventListener);
    return () => {
      window.removeEventListener("thoughts:inline-refresh", handleRefresh as EventListener);
    };
  }, []);

  const isFirstRender = React.useRef(true);

  // Debounced search
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      fetchStarredNotes();
    }, 700);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Extract and dispatch unique tags whenever notes change
  useEffect(() => {
    const allTags = new Set<string>();
    notes.forEach(note => {
      if (note.tags && Array.isArray(note.tags)) {
        note.tags.forEach(tag => allTags.add(tag));
      }
    });
    const uniqueTags = Array.from(allTags).sort();
    window.dispatchEvent(new CustomEvent("thoughts_tags_updated", { detail: uniqueTags }));
  }, [notes]);

  // Listen for tag filter events from sidebar
  useEffect(() => {
    const handleTagFilter = (event: CustomEvent) => {
      setSelectedTag(event.detail);
    };

    window.addEventListener("thoughts_tag_filter", handleTagFilter as EventListener);

    return () => {
      window.removeEventListener("thoughts_tag_filter", handleTagFilter as EventListener);
    };
  }, []);

  const handleUpdateNote = async (noteId: string, data: UpdateNoteData) => {
    try {
      const response = await authenticatedFetch(buildExternalUrl(`notes/${noteId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update note");

      const result = await response.json();
      setNotes(notes.map(note =>
        note.id === noteId ? result.note : note
      ));
      toast.success("Note updated successfully");
    } catch (error) {
      console.error("Error updating note:", error);
      toast.error("Failed to update note");
    }
  };

  const handleVersionHistory = (noteId: string) => {
    setVersionHistoryNoteId(noteId);
    setShowVersionHistory(true);
  };

  const handleVersionRestored = async () => {
    await fetchStarredNotes();
  };

  const noteActions: NoteActions = {
    onStar: async (noteId: string) => {
      try {
        const response = await authenticatedFetch(buildExternalUrl(`notes/${noteId}/star`), {
          method: "PUT",
        });

        if (!response.ok) throw new Error("Failed to toggle star");

        const result = await response.json();

        // If note is unstarred, remove it from the starred view
        if (!result.isStarred) {
          setNotes(notes.filter(note => note.id !== noteId));
          toast.success("Note unstarred");
        } else {
          setNotes(notes.map(note =>
            note.id === noteId
              ? { ...note, isStarred: result.isStarred, updatedAt: new Date().toISOString() }
              : note
          ));
          toast.success("Note starred");
        }
      } catch (error) {
        console.error("Error toggling star:", error);
        toast.error("Failed to update note");
      }
    },

    onArchive: async (noteId: string) => {
      try {
        const response = await authenticatedFetch(buildExternalUrl(`notes/${noteId}/archive`), {
          method: "PUT",
        });

        if (!response.ok) throw new Error("Failed to archive note");

        setNotes(notes.filter(note => note.id !== noteId));
        toast.success("Note archived");
      } catch (error) {
        console.error("Error archiving note:", error);
        toast.error("Failed to archive note");
      }
    },

    onDelete: async (noteId: string) => {
      try {
        const response = await authenticatedFetch(buildExternalUrl(`notes/${noteId}`), {
          method: "DELETE",
        });

        if (!response.ok) throw new Error("Failed to delete note");

        setNotes(notes.filter(note => note.id !== noteId));
        toast.success("Note moved to trash");
      } catch (error) {
        console.error("Error deleting note:", error);
        toast.error("Failed to delete note");
      }
    },

    onRestore: async (noteId: string) => {
      // This shouldn't be called on starred page, but included for completeness
      try {
        const response = await authenticatedFetch(buildExternalUrl(`notes/${noteId}/restore`), {
          method: "PUT",
        });

        if (!response.ok) throw new Error("Failed to restore note");

        toast.success("Note restored");
        fetchStarredNotes(); // Refresh the list
      } catch (error) {
        console.error("Error restoring note:", error);
        toast.error("Failed to restore note");
      }
    },

    onPin: async (noteId: string) => {
      try {
        const response = await authenticatedFetch(buildExternalUrl(`notes/${noteId}/pin`), {
          method: "PUT",
        });

        if (!response.ok) throw new Error("Failed to toggle pin");

        const result = await response.json();
        setNotes(notes.map(note =>
          note.id === noteId
            ? { ...note, isPinned: result.isPinned, updatedAt: new Date().toISOString() }
            : note
        ));
        toast.success(`Note ${result.isPinned ? 'pinned' : 'unpinned'}`);
      } catch (error) {
        console.error("Error toggling pin:", error);
        toast.error("Failed to update note");
      }
    },

    onColorChange: async (noteId: string, color: string) => {
      await handleUpdateNote(noteId, { color });
    },

    onEdit: (note: Note) => {
      setEditingNoteId(note.id);
      setOpenInEditMode(true);
      setIsDrawerOpen(true);
    },
  };

  // Filter notes (only show starred, non-archived, non-deleted notes, and filter by tag if selected)
  const filteredNotes = notes.filter(note => {
    if (!note.isStarred || note.isArchived || note.isDeleted) return false;
    if (selectedTag && (!note.tags || !note.tags.includes(selectedTag))) return false;
    return true;
  });

  // Separate pinned and regular notes
  const pinnedNotes = filteredNotes.filter(note => note.isPinned);
  const regularNotes = filteredNotes.filter(note => !note.isPinned);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            <h1 className="text-lg font-semibold">Starred Notes</h1>
          </div>

          <div className="ml-auto flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search starred notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-9"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notes Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center min-h-[300px]">
            <LoadingSpinner size="lg" text="Loading notes..." />
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Star className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-lg font-medium">
                {searchQuery ? "No starred notes found" : "No starred notes"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "Try different keywords"
                  : "Star important notes to find them here quickly"
                }
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Pinned Notes */}
            {pinnedNotes.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
                  Pinned
                </h2>
                <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
                  {pinnedNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      actions={noteActions}
                      onClick={() => {
                        setEditingNoteId(note.id);
                        setOpenInEditMode(false);
                        setIsDrawerOpen(true);
                      }}
                      onVersionHistory={handleVersionHistory}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Regular Notes */}
            {regularNotes.length > 0 && (
              <div>
                {pinnedNotes.length > 0 && (
                  <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
                    Others
                  </h2>
                )}
                <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
                  {regularNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      actions={noteActions}
                      onClick={() => {
                        setEditingNoteId(note.id);
                        setOpenInEditMode(false);
                        setIsDrawerOpen(true);
                      }}
                      onVersionHistory={handleVersionHistory}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Note Drawer */}
      <NoteDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingNoteId(null);
          setOpenInEditMode(false);
        }}
        noteId={editingNoteId}
        initialEditMode={openInEditMode}
        onSave={(savedNote) => {
          setNotes(prevNotes => {
            const existingIndex = prevNotes.findIndex(n => n.id === savedNote.id);
            if (existingIndex >= 0) {
              const updated = [...prevNotes];
              updated[existingIndex] = savedNote;
              return updated;
            }
            return prevNotes;
          });
        }}
        onDelete={(noteId) => {
          setNotes(notes.filter(note => note.id !== noteId));
        }}
        onArchive={(noteId) => {
          setNotes(notes.filter(note => note.id !== noteId));
        }}
      />

      {/* Version History */}
      {versionHistoryNoteId && (
        <VersionHistory
          noteId={versionHistoryNoteId}
          isOpen={showVersionHistory}
          onClose={() => {
            setShowVersionHistory(false);
            setVersionHistoryNoteId(null);
          }}
          onVersionRestored={handleVersionRestored}
        />
      )}
    </div>
  );
}
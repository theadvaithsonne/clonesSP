"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Trash2,
  Search,
  RotateCcw,
  Trash,
  Star,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { buildExternalUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/utils/api";
import { Note, NoteActions, UpdateNoteData } from "../types";
import NoteCard from "../components/NoteCard";
import NoteDrawer from "../components/NoteDrawer";
import LoadingSpinner, { NotesGridSkeleton } from "../components/LoadingSpinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


export default function TrashNotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [openInEditMode, setOpenInEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Fetch deleted notes from API
  const fetchDeletedNotes = async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams({
        isDeleted: "true", // Only fetch deleted notes
      });

      if (searchQuery) queryParams.append("search", searchQuery);

      const response = await authenticatedFetch(
        buildExternalUrl(`notes?${queryParams.toString()}`)
      );

      if (!response.ok) throw new Error("Failed to fetch deleted notes");

      const data = await response.json();
      setNotes(data.notes || []);
    } catch (error) {
      console.error("Error fetching deleted notes:", error);
      toast.error("Failed to load deleted notes");
    } finally {
      setIsLoading(false);
    }
  };

  // Load notes on component mount
  useEffect(() => {
    fetchDeletedNotes();
  }, []);

  // Listen for inline refresh event
  useEffect(() => {
    const handleRefresh = (event: Event) => {
      const customEvent = event as CustomEvent<{ section?: string }>;
      if (customEvent.detail?.section === "trash") {
        fetchDeletedNotes();
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
      fetchDeletedNotes();
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

  const restoreNote = async (noteId: string) => {
    try {
      const response = await authenticatedFetch(buildExternalUrl(`notes/${noteId}/restore`), {
        method: "PUT",
      });

      if (!response.ok) throw new Error("Failed to restore note");

      setNotes(notes.filter(note => note.id !== noteId));
      toast.success("Note restored to All Notes");
    } catch (error) {
      console.error("Error restoring note:", error);
      toast.error("Failed to restore note");
    }
  };

  const permanentlyDeleteNote = async (noteId: string) => {
    try {
      const response = await authenticatedFetch(buildExternalUrl(`notes/${noteId}/permanent`), {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to permanently delete note");

      const result = await response.json();
      setNotes(notes.filter(note => note.id !== noteId));
      toast.success("Note permanently deleted (recoverable for 7 days in Recovery section)");
    } catch (error) {
      console.error("Error permanently deleting note:", error);
      toast.error("Failed to permanently delete note");
    }
  };

  const emptyTrash = async () => {
    try {
      // Delete all notes in trash permanently
      const deletePromises = notes.map(note =>
        authenticatedFetch(buildExternalUrl(`notes/${note.id}/permanent`), {
          method: "DELETE",
        })
      );

      await Promise.all(deletePromises);
      setNotes([]);
      toast.success(`Trash emptied successfully! Notes moved to Recovery (recoverable for 7 days)`);
    } catch (error) {
      console.error("Error emptying trash:", error);
      toast.error("Failed to empty trash");
    }
  };

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

  const noteActions: NoteActions = {
    onStar: async (noteId: string) => {
      try {
        const response = await authenticatedFetch(buildExternalUrl(`notes/${noteId}/star`), {
          method: "PUT",
        });

        if (!response.ok) throw new Error("Failed to toggle star");

        const result = await response.json();
        setNotes(notes.map(note =>
          note.id === noteId
            ? { ...note, isStarred: result.isStarred, updatedAt: new Date().toISOString() }
            : note
        ));
        toast.success(`Note ${result.isStarred ? 'starred' : 'unstarred'}`);
      } catch (error) {
        console.error("Error toggling star:", error);
        toast.error("Failed to update note");
      }
    },
    onArchive: restoreNote, // In trash, archive should restore
    onDelete: permanentlyDeleteNote,
    onRestore: restoreNote,
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

  const filteredNotes = notes
    .filter(note => note.isDeleted)
    .filter(note =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(note => {
      if (selectedTag && (!note.tags || !note.tags.includes(selectedTag))) return false;
      return true;
    });

  // Separate pinned and regular notes (even in trash)
  const pinnedNotes = filteredNotes.filter(note => note.isPinned);
  const regularNotes = filteredNotes.filter(note => !note.isPinned);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Trash</h1>
          </div>

          <div className="ml-auto flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search trash..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-9"
              />
            </div>

            {/* Empty Trash Button */}
            {filteredNotes.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:text-destructive">
                    <Trash className="mr-2 h-4 w-4" />
                    Empty Trash
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Empty Trash?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will move all notes in trash to the Recovery section. You can still recover them for 7 days from the Recovery page before they are permanently deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={emptyTrash}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Empty Trash
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
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
              <Trash2 className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-lg font-medium">
                {searchQuery ? "No notes found in trash" : "Trash is empty"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "Try different keywords"
                  : "Deleted notes will appear here and auto-delete after 30 days"
                }
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Warning banner */}
            <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800">Notes in trash</p>
                  <p className="text-yellow-700">
                    These notes will be automatically moved to Recovery after 30 days. You can restore them now or permanently delete them (which can still be recovered for 7 days from the Recovery section).
                  </p>
                </div>
              </div>
            </div>

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
                        showTrashActions={true}
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
                        showTrashActions={true}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
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
    </div>
  );
}
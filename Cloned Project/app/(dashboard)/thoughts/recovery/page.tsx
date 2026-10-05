"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  History,
  Search,
  RotateCcw,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { buildExternalUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/utils/api";
import { Note, NoteActions, UpdateNoteData } from "../types";
import NoteCard from "../components/NoteCard";
import NoteEditor from "../components/NoteEditor";
import NoteViewer from "../components/NoteViewer";
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

interface RecoverableNote extends Note {
  permanentlyDeletedAt?: string;
  daysRemainingForRecovery?: number;
  recoverableUntil?: string;
}

export default function RecoveryNotesPage() {
  const [notes, setNotes] = useState<RecoverableNote[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingNote, setEditingNote] = useState<RecoverableNote | null>(null);
  const [viewingNote, setViewingNote] = useState<RecoverableNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Fetch permanently deleted notes from API
  const fetchPermanentlyDeletedNotes = async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();

      if (searchQuery) queryParams.append("search", searchQuery);

      const response = await authenticatedFetch(
        buildExternalUrl(`notes/permanently-deleted?${queryParams.toString()}`)
      );

      if (!response.ok) throw new Error("Failed to fetch permanently deleted notes");

      const data = await response.json();
      setNotes(data.notes || []);
    } catch (error) {
      console.error("Error fetching permanently deleted notes:", error);
      toast.error("Failed to load permanently deleted notes");
    } finally {
      setIsLoading(false);
    }
  };

  // Load notes on component mount and when search changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPermanentlyDeletedNotes();
    }, searchQuery ? 700 : 0); // Immediate load on mount, debounced for search

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Listen for inline refresh event
  useEffect(() => {
    const handleRefresh = (event: Event) => {
      const customEvent = event as CustomEvent<{ section?: string }>;
      if (customEvent.detail?.section === "recovery") {
        fetchPermanentlyDeletedNotes();
      }
    };
    window.addEventListener("thoughts:inline-refresh", handleRefresh as EventListener);
    return () => {
      window.removeEventListener("thoughts:inline-refresh", handleRefresh as EventListener);
    };
  }, []);

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

  const recoverNote = async (noteId: string) => {
    try {
      const response = await authenticatedFetch(buildExternalUrl(`notes/${noteId}/recover`), {
        method: "PUT",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to recover note");
      }

      setNotes(notes.filter(note => note.id !== noteId));
      toast.success("Note recovered successfully and restored to All Notes");
    } catch (error: any) {
      console.error("Error recovering note:", error);
      toast.error(error.message || "Failed to recover note");
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
        note.id === noteId ? { ...note, ...result.note } : note
      ));
      toast.success("Note updated successfully");
    } catch (error) {
      console.error("Error updating note:", error);
      toast.error("Failed to update note");
    }
  };

  const noteActions: NoteActions = {
    onStar: async () => {
      toast.info("Notes in recovery cannot be starred");
    },
    onArchive: async () => {
      toast.info("Notes in recovery cannot be archived");
    },
    onDelete: async () => {
      toast.info("These notes are already permanently deleted");
    },
    onRestore: recoverNote,
    onPin: async () => {
      toast.info("Notes in recovery cannot be pinned");
    },
    onColorChange: async () => {
      toast.info("Notes in recovery cannot be modified");
    },
    onEdit: () => {
      toast.info("Notes in recovery cannot be edited");
    },
  };

  const filteredNotes = notes.filter(note => {
    if (selectedTag && (!note.tags || !note.tags.includes(selectedTag))) return false;
    return true;
  });

  // Separate by days remaining
  const urgentNotes = filteredNotes.filter(note => (note.daysRemainingForRecovery || 0) <= 2);
  const regularNotes = filteredNotes.filter(note => (note.daysRemainingForRecovery || 0) > 2);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Recovery</h1>
            {filteredNotes.length > 0 && (
              <span className="text-sm text-muted-foreground">
                ({filteredNotes.length} recoverable)
              </span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search recovery..."
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
              <History className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-lg font-medium">
                {searchQuery ? "No notes found in recovery" : "No notes in recovery"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "Try different keywords"
                  : "Permanently deleted notes appear here for 7 days"}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Info banner */}
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-800">Permanently deleted notes</p>
                  <p className="text-blue-700">
                    These notes were permanently deleted and can be recovered within 7 days.
                    After 7 days, they will be deleted forever and cannot be recovered.
                  </p>
                </div>
              </div>
            </div>

            <>
              {/* Urgent Notes (2 days or less) */}
              {urgentNotes.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <h2 className="text-sm font-medium text-red-700 uppercase tracking-wide">
                      Expiring Soon ({urgentNotes.length})
                    </h2>
                  </div>
                  <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
                    {urgentNotes.map((note) => (
                      <div key={note.id} className="mb-4 break-inside-avoid">
                        <div className="relative">
                          <NoteCard
                            note={note}
                            actions={noteActions}
                            onClick={() => setViewingNote(note)}
                            showTrashActions={false}
                          />
                          <div className="mt-2 flex items-center justify-between px-3 py-2 bg-red-50 border border-red-200 rounded-md">
                            <div className="flex items-center gap-2 text-xs text-red-700">
                              <Clock className="h-3 w-3" />
                              <span className="font-medium">
                                {note.daysRemainingForRecovery === 0
                                  ? "Expires today"
                                  : `${note.daysRemainingForRecovery} day${note.daysRemainingForRecovery === 1 ? '' : 's'} left`}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                recoverNote(note.id);
                              }}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Recover
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Regular Notes (more than 2 days) */}
              {regularNotes.length > 0 && (
                <div>
                  {urgentNotes.length > 0 && (
                    <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
                      Others ({regularNotes.length})
                    </h2>
                  )}
                  <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
                    {regularNotes.map((note) => (
                      <div key={note.id} className="mb-4 break-inside-avoid">
                        <div className="relative">
                          <NoteCard
                            note={note}
                            actions={noteActions}
                            onClick={() => setViewingNote(note)}
                            showTrashActions={false}
                          />
                          <div className="mt-2 flex items-center justify-between px-3 py-2 bg-muted/50 border rounded-md">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>
                                {note.daysRemainingForRecovery} day{note.daysRemainingForRecovery === 1 ? '' : 's'} left
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                recoverNote(note.id);
                              }}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Recover
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          </>
        )}
      </div>

      {/* Note Viewer Modal */}
      <NoteViewer
        isOpen={!!viewingNote}
        onClose={() => setViewingNote(null)}
        note={viewingNote}
        actions={noteActions}
        showTrashActions={false}
      />
    </div>
  );
}

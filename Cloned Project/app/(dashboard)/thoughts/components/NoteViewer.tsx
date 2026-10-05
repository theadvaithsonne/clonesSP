"use client";

import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Star,
  Archive,
  Trash2,
  MoreVertical,
  Edit3,
  Palette,
  ArchiveRestore,
  RotateCcw,
  Pin,
  PinOff,
  Calendar,
  Tag,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Note, NoteActions, getColorClass, formatDate, NOTE_COLORS } from "../types";
import ColorPicker from "./ColorPicker";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import {
  coverPhotoBlock,
  documentListBlock,
  calendarViewBlock,
  timelineViewBlock,
  chartViewBlock,
  linkedViewBlock,
  tableViewBlock,
  boardViewBlock,
  galleryViewBlock,
  nestedPageBlock,
  pageLinkPillBlock,
  mentionPersonBlock,
  mentionPageBlock,
  datePickerBlock,
  reminderBlock,
  tableOfContentsBlock,
  commentBlock,
  buttonBlock,
  templateBlock,
  syncedBlockBlock,
  embedBlock,
  webBookmarkBlock,
  mathBlock,
} from "./blocks";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

interface NoteViewerProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note | null;
  actions: NoteActions;
  showArchiveActions?: boolean;
  showTrashActions?: boolean;
}

export default function NoteViewer({
  isOpen,
  onClose,
  note,
  actions,
  showArchiveActions = false,
  showTrashActions = false,
}: NoteViewerProps) {
  const [showColorPicker, setShowColorPicker] = React.useState(false);

  const notesSchema = React.useMemo(() => BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      coverPhoto: coverPhotoBlock(),
      documentList: documentListBlock(),
      calendarView: calendarViewBlock(),
      timelineView: timelineViewBlock(),
      chartView: chartViewBlock(),
      linkedView: linkedViewBlock(),
      tableView: tableViewBlock(),
      boardView: boardViewBlock(),
      galleryView: galleryViewBlock(),
      nestedPage: nestedPageBlock(),
      pageLinkPill: pageLinkPillBlock(),
      mentionPerson: mentionPersonBlock(),
      mentionPage: mentionPageBlock(),
      datePicker: datePickerBlock(),
      reminder: reminderBlock(),
      tableOfContents: tableOfContentsBlock(),
      comment: commentBlock(),
      button: buttonBlock(),
      template: templateBlock(),
      syncedBlock: syncedBlockBlock(),
      embed: embedBlock(),
      webBookmark: webBookmarkBlock(),
      math: mathBlock(),
    } as any,
  }), []);

  // Initialize BlockNote editor for read-only preview
  const editor = useCreateBlockNote({
    schema: notesSchema as unknown as Parameters<typeof useCreateBlockNote>[0]["schema"],
    initialContent: undefined,
  });

  // Load note content into editor when note changes
  useEffect(() => {
    if (!note || !editor) return;

    try {
      const blocks =
        typeof note.content === "string"
          ? JSON.parse(note.content)
          : note.content;

      if (Array.isArray(blocks) && blocks.length > 0) {
        editor.replaceBlocks(editor.document, blocks);
      } else {
        editor.replaceBlocks(editor.document, [
          { type: "paragraph", content: [] }
        ]);
      }
    } catch (e) {
      // Fallback for plain text format
      if (note.content?.trim()) {
        editor.replaceBlocks(editor.document, [
          {
            type: "paragraph",
            content: [{ type: "text", text: note.content, styles: {} }] as any,
          },
        ]);
      } else {
        editor.replaceBlocks(editor.document, [
          { type: "paragraph", content: [] }
        ]);
      }
    }
  }, [note, editor]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!note) return null;

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions.onStar(note.id);
  };

  const handleArchiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions.onArchive(note.id);
    onClose(); // Close viewer after archiving
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions.onDelete(note.id);
    onClose(); // Close viewer after deleting
  };

  const handleRestoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions.onRestore(note.id);
    onClose(); // Close viewer after restoring
  };

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions.onPin(note.id);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions.onEdit(note);
    onClose(); // Close viewer when editing
  };

  const handleColorChange = (color: string) => {
    actions.onColorChange(note.id, color);
    setShowColorPicker(false);
  };

  const colorOption = NOTE_COLORS.find(c => c.value === note.color);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col [&>button]:hidden bg-[#191919] border-zinc-800 text-white pt-5"
        style={{ borderTop: `4px solid ${note.color}` }}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 mr-4">
              <DialogTitle className="text-xl font-semibold text-left line-clamp-2">
                {note.title || "Untitled Note"}
              </DialogTitle>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Pin Button (only show for regular notes) */}
              {!showArchiveActions && !showTrashActions && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePinClick}
                  className="h-8 w-8 p-0"
                  title={note.isPinned ? "Unpin note" : "Pin note"}
                >
                  {note.isPinned ? (
                    <PinOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Pin className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              )}

              {/* Star Button */}
              {!showTrashActions && 
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStarClick}
                className="h-8 w-8 p-0"
                title={note.isStarred ? "Unstar" : "Star"}
              >
                <Star className={cn(
                  "h-4 w-4",
                  note.isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                )} />
              </Button>}

              {/* More Actions Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {/* Edit */}
                  {!showTrashActions && 
                  <DropdownMenuItem onClick={handleEditClick}>
                    <Edit3 className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>}

                  {/* Color Picker */}
                  {!showTrashActions && (
                    <DropdownMenuItem onClick={() => setShowColorPicker(!showColorPicker)}>
                      <Palette className="mr-2 h-4 w-4" />
                      Change color
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  {/* Archive/Restore Actions */}
                  {showTrashActions ? (
                    <DropdownMenuItem onClick={handleRestoreClick}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Restore
                    </DropdownMenuItem>
                  ) : showArchiveActions ? (
                    <DropdownMenuItem onClick={handleRestoreClick}>
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                      Unarchive
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={handleArchiveClick}>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  {/* Delete */}
                  <DropdownMenuItem
                    onClick={handleDeleteClick}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {showTrashActions ? "Delete forever" : "Delete"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Close Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
                title="Close"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Note Content */}
          {note.content && (
            <div className="mb-6 prose prose-lg max-w-none garage-notes-editor">
              <BlockNoteView editor={editor} theme="dark" editable={false} />
            </div>
          )}

          {/* Tags */}
          {note.tags && note.tags.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Tags</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {note.tags.map((tag, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="px-2 py-1"
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Color Picker */}
          {showColorPicker && !showTrashActions && (
            <div className="mb-6 p-4 bg-background/50 rounded-lg border">
              <ColorPicker
                selectedColor={note.color}
                onColorSelect={handleColorChange}
                onClose={() => setShowColorPicker(false)}
              />
            </div>
          )}

          {/* Metadata */}
          <div className="space-y-3 text-sm text-muted-foreground">
            {/* Color Info */}
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span>Color: {colorOption?.name || "Custom"}</span>
              <div
                className="h-4 w-4 rounded-full border"
                style={{ backgroundColor: note.color }}
              />
            </div>

            {/* Creation Date */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Created: {formatDate(note.createdAt)}</span>
            </div>

            {/* Last Modified */}
            {note.updatedAt !== note.createdAt && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Modified: {formatDate(note.updatedAt)}</span>
              </div>
            )}

            {/* Deletion Date (for trash) */}
            {showTrashActions && note.deletedAt && (
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                <span>Deleted: {formatDate(note.deletedAt)}</span>
              </div>
            )}

            {/* Status Indicators */}
            <div className="flex flex-wrap gap-2">
              {note.isPinned && (
                <Badge variant="outline" className="text-xs">
                  <Pin className="h-3 w-3 mr-1" />
                  Pinned
                </Badge>
              )}
              {note.isStarred && (
                <Badge variant="outline" className="text-xs">
                  <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                  Starred
                </Badge>
              )}
              {showArchiveActions && (
                <Badge variant="outline" className="text-xs">
                  <Archive className="h-3 w-3 mr-1" />
                  Archived
                </Badge>
              )}
              {showTrashActions && (
                <Badge variant="outline" className="text-xs text-destructive">
                  <Trash2 className="h-3 w-3 mr-1" />
                  Deleted
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Footer with keyboard shortcut hint */}
        <div className="flex-shrink-0 pt-4 border-t border-border/20">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1 py-0.5 text-xs bg-muted rounded">Esc</kbd> to close
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
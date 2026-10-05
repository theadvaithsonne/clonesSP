"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Note, NoteActions, getColorClass, formatDate, getNotePreview } from "../types";
import ColorPicker from "./ColorPicker";

interface NoteCardProps {
  note: Note;
  actions: NoteActions;
  onClick?: () => void;
  showArchiveActions?: boolean;
  showTrashActions?: boolean;
  onVersionHistory?: (noteId: string) => void;
}

export default function NoteCard({
  note,
  actions,
  onClick,
  showArchiveActions = false,
  showTrashActions = false,
  onVersionHistory,
}: NoteCardProps) {
  const [showColorPicker, setShowColorPicker] = React.useState(false);

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions.onStar(note.id);
  };

  const handleArchiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions.onArchive(note.id);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions.onDelete(note.id);
  };

  const handleRestoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions.onRestore(note.id);
  };

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions.onPin(note.id);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions.onEdit(note);
  };

  const handleColorChange = (color: string) => {
    actions.onColorChange(note.id, color);
    setShowColorPicker(false);
  };

  const handleVersionHistoryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onVersionHistory) {
      onVersionHistory(note.id);
    }
  };

  return (
    <Card
      className={cn(
        "mb-4 break-inside-avoid transition-all hover:shadow-md group",
        getColorClass(note.color),
        showTrashActions && "opacity-60",
        showArchiveActions && "opacity-80",
        onClick && "cursor-pointer hover:shadow-lg"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Title */}
            {note.title && (
              <h3 className="font-medium text-foreground mb-2 line-clamp-2 break-words">
                {note.title}
              </h3>
            )}

            {/* Content */}
            {note.content && (
              <p className="text-sm text-muted-foreground line-clamp-6 whitespace-pre-wrap break-words">
                {getNotePreview(note.content, 300)}
              </p>
            )}

            {/* Tags */}
            {note.tags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {note.tags.slice(0, 3).map((tag, index) => (
                  <span
                    key={index}
                    className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
                {note.tags.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{note.tags.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="ml-2 flex items-start">
            {/* Pin Button (only show for regular notes) */}
            {!showArchiveActions && !showTrashActions && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePinClick}
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
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
              className={cn(
                "h-8 w-8 p-0 transition-opacity",
                note.isStarred ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
              title={note.isStarred ? "Unstar" : "Star"}
            >
              <Star
                className={cn(
                  "h-4 w-4",
                  note.isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                )}
              />
            </Button>}

            {/* More Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
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

                {/* Version History */}
                {!showTrashActions && onVersionHistory && (
                  <DropdownMenuItem onClick={handleVersionHistoryClick}>
                    <Clock className="mr-2 h-4 w-4" />
                    Version history
                  </DropdownMenuItem>
                )}

                {/* Color Picker */}
                {!showTrashActions && (
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    setShowColorPicker(!showColorPicker);
                  }}>
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
          </div>
        </div>

        {/* Color Picker Dropdown */}
        {showColorPicker && !showTrashActions && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <ColorPicker
              selectedColor={note.color}
              onColorSelect={handleColorChange}
              onClose={() => setShowColorPicker(false)}
            />
          </div>
        )}

        {/* Footer with date */}
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {showTrashActions && note.deletedAt
              ? `Deleted ${formatDate(note.deletedAt)}`
              : showArchiveActions
              ? "Archived"
              : formatDate(note.updatedAt)}
          </span>

          {/* Pinned indicator */}
          {note.isPinned && !showArchiveActions && !showTrashActions && (
            <Pin className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
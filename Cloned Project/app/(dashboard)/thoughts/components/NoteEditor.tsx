"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { X, Tag, Plus } from "lucide-react";
import { Note, CreateNoteData, UpdateNoteData, NOTE_COLORS } from "../types";
import ColorPicker from "./ColorPicker";

interface NoteEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateNoteData | UpdateNoteData) => void;
  note?: Note; // If provided, we're editing; otherwise, we're creating
  mode?: "create" | "edit";
}

export default function NoteEditor({
  isOpen,
  onClose,
  onSave,
  note,
  mode = note ? "edit" : "create",
}: NoteEditorProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState("#ffffff");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Initialize form when note changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      if (note) {
        setTitle(note.title);
        setContent(note.content);
        setColor(note.color);
        setTags(note.tags || []);
      } else {
        // Reset for new note
        setTitle("");
        setContent("");
        setColor("#ffffff");
        setTags([]);
      }
      setNewTag("");
      setShowColorPicker(false);
    }
  }, [isOpen, note]);

  const handleSave = () => {
    // Don't save empty notes
    if (!title.trim() && !content.trim()) {
      return;
    }

    const noteData = {
      title: title.trim(),
      content: content.trim(),
      color,
      tags: tags.filter(tag => tag.trim().length > 0),
    };

    onSave(noteData);
    onClose();
  };

  const handleAddTag = () => {
    const trimmedTag = newTag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.metaKey) {
      handleSave();
    }
  };

  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const colorOption = NOTE_COLORS.find(c => c.value === color);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit Note" : "Create New Note"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title Input */}
          <Input
            placeholder="Note title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyPress}
            className="text-lg font-medium"
          />

          {/* Content Textarea */}
          <Textarea
            placeholder="Start writing your note..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyPress}
            className="min-h-40 resize-none"
            rows={8}
          />

          {/* Tags Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Tags</label>

            {/* Existing Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="flex items-center gap-1 px-2 py-1"
                  >
                    #{tag}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveTag(tag)}
                      className="h-4 w-4 p-0 hover:bg-transparent"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Add New Tag */}
            <div className="space-y-1">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Add a tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={handleTagKeyPress}
                    className="pl-9"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTag}
                  disabled={!newTag.trim() || tags.includes(newTag.trim().toLowerCase())}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/60 pl-1">press Enter to add a tag</p>
            </div>
          </div>

          {/* Color Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Color</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {colorOption?.name || "Custom"}
                </span>
                <div
                  className="h-6 w-6 rounded-full border-2 border-gray-300"
                  style={{ backgroundColor: color }}
                />
              </div>
            </div>

            <ColorPicker
              selectedColor={color}
              onColorSelect={setColor}
              className="mt-2"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!title.trim() && !content.trim()}
            >
              {mode === "edit" ? "Save Changes" : "Create Note"}
            </Button>
          </div>

          {/* Keyboard Shortcut Hint */}
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1 py-0.5 text-xs bg-muted rounded">⌘ + Enter</kbd> to save
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
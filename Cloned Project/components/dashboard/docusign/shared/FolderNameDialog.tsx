"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// Matches the backend's limit (controllers/folder.controller.js).
export const MAX_FOLDER_NAME = 80;

interface FolderNameDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  submitLabel: string;
  initialName?: string;
  // Throw (e.g. the API's 409 "already exists") to keep the dialog open — the message is shown as a toast.
  onSubmit: (name: string) => Promise<void>;
}

// One dialog for both "New folder" and "Rename folder".
export function FolderNameDialog({ open, onClose, title, description, submitLabel, initialName = "", onSubmit }: FolderNameDialogProps) {
  const [name, setName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);

  // Start from the folder's current name each time the dialog opens.
  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  const trimmed = name.replace(/\s+/g, " ").trim();
  const canSave = !!trimmed && trimmed !== initialName && !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Could not save the folder");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isSaving && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="folder-name">Folder name</Label>
          <Input
            id="folder-name"
            autoFocus
            maxLength={MAX_FOLDER_NAME}
            placeholder="e.g. Vendor contracts"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

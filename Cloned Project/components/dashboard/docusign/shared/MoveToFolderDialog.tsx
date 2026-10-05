"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useDocusignStore } from "@/store/docusign/docusignStore";
import type { FolderScope } from "@/lib/docusign/shared-api";
import { FolderSelect } from "@/components/dashboard/docusign/shared/FolderSelect";

interface MoveToFolderDialogProps {
  open: boolean;
  onClose: () => void;
  documentIds: string[];
  // Pre-selected when every chosen document is in the same folder (null = they are all Global).
  initialFolderId?: string | null;
  onMoved: () => void;
  // Which flow's folders to offer — the two sets are separate.
  scope: FolderScope;
  // Required, not defaulted: this dialog is shared by both flows, so it must not import either
  // side's API. Internal passes moveDocuments, external passes moveExternalDocuments — same
  // dialog, different target collection.
  moveFn: (documentIds: string[], folderId: string | null) => Promise<{ data: { moved: number } }>;
}

export function MoveToFolderDialog({ open, onClose, documentIds, scope, initialFolderId = null, onMoved, moveFn }: MoveToFolderDialogProps) {
  const { folders: internalFolders, externalFolders } = useDocusignStore();
  const folders = scope === "external" ? externalFolders : internalFolders;
  const [target, setTarget] = useState<string | null>(initialFolderId);
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    if (open) setTarget(initialFolderId);
  }, [open, initialFolderId]);

  const count = documentIds.length;
  const targetName = target ? folders.find((f) => f._id === target)?.name ?? "the folder" : "Global";

  const handleMove = async () => {
    if (!count || isMoving) return;
    setIsMoving(true);
    try {
      const res = await moveFn(documentIds, target);
      toast.success(target ? `Moved ${res.data.moved} to “${targetName}”` : `Moved ${res.data.moved} back to Global`);
      onMoved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Could not move the documents");
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isMoving && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
          <DialogDescription>
            {count === 1 ? "Choose where this document is filed." : `Choose where these ${count} documents are filed.`} Filing never changes who can see or
            sign a document.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="move-folder">Folder</Label>
          <FolderSelect scope={scope} id="move-folder" value={target} onChange={setTarget} disabled={isMoving} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isMoving}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={isMoving || !count}>
            {isMoving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Move"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

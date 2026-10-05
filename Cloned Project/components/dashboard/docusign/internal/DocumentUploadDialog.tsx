"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { DsDocument } from "@/lib/docusign/internal-api";
import { createDocument, createDocumentBundle } from "@/lib/docusign/internal-api";
import { useDocusignStore } from "@/store/docusign/docusignStore";
import { isDocusignAdminUser, senderRoleLabel } from "@/lib/docusign/access";
import { BTN_PRIMARY, BTN_SECONDARY, HEADING, LABEL_MUTED, SUBTITLE, TEXTAREA } from "@/components/dashboard/docusign/shared/editorTokens";
import { FolderSelect } from "@/components/dashboard/docusign/shared/FolderSelect";
import { PdfFilesPicker, pdfItemsProblem, uploadPdfItems, type PdfItem } from "@/components/dashboard/docusign/shared/PdfFilesPicker";

interface DocumentUploadDialogProps {
  open: boolean;
  onClose: () => void;
  // The created document, whole — the caller seeds the field editor from it so its PDF
  // (the envelope-stamped working copy the server just made, NOT the local file) starts
  // downloading immediately. See documentSeed.ts. For 2–3 files (a group sent together)
  // it's the first document of the group; the editor shows the rest as tabs.
  onCreated: (document: DsDocument) => void;
}

export function DocumentUploadDialog({ open, onClose, onCreated }: DocumentUploadDialogProps) {
  const [items, setItems] = useState<PdfItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // Optional note shown in the sign-request email, signed with the sender's name and role below.
  const [message, setMessage] = useState("");
  // null = Global (no folder), the default. Only founders/admins can file into folders (the backend refuses
  // anyone else), so the picker below is not shown to other members and folderId stays null for them.
  const [folderId, setFolderId] = useState<string | null>(null);
  const { me, foldersLoaded, fetchFolders } = useDocusignStore();
  const canOrganise = isDocusignAdminUser(me);
  const senderRole = senderRoleLabel(me);

  useEffect(() => {
    if (open && canOrganise && !foldersLoaded) fetchFolders("internal", { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, canOrganise]);

  const reset = () => {
    setItems([]);
    setMessage("");
    setFolderId(null);
    setProgress(null);
  };

  const handleCreate = async () => {
    const problem = await pdfItemsProblem(items);
    if (problem) {
      toast.error(problem);
      return;
    }

    setIsUploading(true);
    try {
      // Each file is fingerprinted before it leaves the browser (the server compares the stored file with this when the
      // document completes, so a swapped original is caught), then uploaded.
      const uploaded = await uploadPdfItems(items, (done, total) => setProgress({ done, total }));
      const shared = {
        ...(canOrganise && folderId ? { folderId } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      };
      if (uploaded.length === 1) {
        const res = await createDocument({ ...uploaded[0], ...shared });
        toast.success("Document uploaded");
        reset();
        onCreated(res.data);
      } else {
        const res = await createDocumentBundle({ documents: uploaded, ...shared });
        toast.success(`${uploaded.length} documents uploaded`);
        reset();
        onCreated(res.data.documents[0]);
      }
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
      setProgress(null);
    }
  };

  const count = items.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md rounded-2xl border-[#2a2a35] bg-[#111116] p-5 shadow-none">
        <DialogHeader>
          <DialogTitle className={HEADING}>{count > 1 ? `Upload ${count} documents` : "Upload a document"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <PdfFilesPicker items={items} onChange={setItems} disabled={isUploading} />

          <div className="space-y-1.5">
            <Label className={LABEL_MUTED} htmlFor="upload-message">Message to recipients (optional)</Label>
            <Textarea
              className={TEXTAREA}
              id="upload-message"
              placeholder="Add a note that will appear in the sign-request email…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={1000}
            />
            {senderRole && (
              <p className={SUBTITLE}>Shown signed as “— {me?.name || me?.email}, {senderRole}”.</p>
            )}
          </div>

          {canOrganise && (
            <div className="space-y-1.5">
              <Label className={LABEL_MUTED} htmlFor="upload-folder">Save in folder</Label>
              <FolderSelect scope="internal" id="upload-folder" value={folderId} onChange={setFolderId} disabled={isUploading} />
              <p className={SUBTITLE}>Optional. Global keeps it outside any folder; you can move it later.</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            {progress && progress.total > 1 && (
              <span className="mr-auto text-[11px] tabular-nums text-[#8a8a9b]">
                Uploading {Math.min(progress.done + 1, progress.total)} of {progress.total}…
              </span>
            )}
            <Button variant="outline" size="sm" className={BTN_SECONDARY} onClick={onClose} disabled={isUploading}>
              Cancel
            </Button>
            <Button size="sm" className={BTN_PRIMARY} onClick={handleCreate} disabled={isUploading || !count}>
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : count > 1 ? `Upload ${count} & continue` : "Upload & continue"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

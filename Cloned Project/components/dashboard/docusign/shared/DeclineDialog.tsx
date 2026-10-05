"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TEXTAREA } from "@/components/dashboard/docusign/shared/editorTokens";

// Matches the backend's cap on a decline reason.
const MAX_REASON_LENGTH = 1000;

interface DeclineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The decline request is in flight: both buttons (and closing) are locked so it can't be fired twice.
  pending: boolean;
  onConfirm: (reason: string | undefined) => void;
  // The public signing page can only decline once the signer's email is verified. When set, the
  // dialog explains that and offers onVerify instead of the Decline button.
  needsVerification?: boolean;
  onVerify?: () => void;
}

// Shared by the internal SigningView and the public PublicSigningView. Declining is irreversible and
// voids the document for every signer, so it is never a single click.
export function DeclineDialog({ open, onOpenChange, pending, onConfirm, needsVerification, onVerify }: DeclineDialogProps) {
  // Kept across open/close on purpose: a failed attempt (or a detour to verify an email) doesn't
  // throw away what the signer already wrote.
  const [reason, setReason] = useState("");

  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Decline to sign?</AlertDialogTitle>
          <AlertDialogDescription>This cancels the document for all signers and can&apos;t be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        {needsVerification ? (
          <p className="text-xs text-brand">Verify your email first. We&apos;ll send a code to the address this document was sent to.</p>
        ) : (
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={MAX_REASON_LENGTH}
            rows={3}
            placeholder="Reason for declining (optional)"
            aria-label="Reason for declining (optional)"
            disabled={pending}
            className={TEXTAREA}
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          {needsVerification ? (
            <AlertDialogAction onClick={() => onVerify?.()}>Verify email</AlertDialogAction>
          ) : (
            <AlertDialogAction
              disabled={pending}
              className="bg-red-600 text-white hover:bg-red-500"
              onClick={(e) => {
                // Keep the dialog open until the request finishes.
                e.preventDefault();
                onConfirm(reason.trim() || undefined);
              }}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Decline"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

interface KickDialogProps {
  open: boolean;
  participantName: string;
  loading: boolean;
  onConfirm(): void;
  onCancel(): void;
}

export default function KickDialog({ open, participantName, loading, onConfirm, onCancel }: KickDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent
        showCloseButton={false}
        className="bg-[#1a1a20] border-[#2a2a35] text-white max-w-sm"
      >
        <DialogHeader>
          <DialogTitle className="text-white">Remove participant</DialogTitle>
          <DialogDescription className="text-gray-400">
            Are you sure you want to remove <strong className="text-white">{participantName}</strong> from this meeting?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:flex-row">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-lg border border-[#2a2a35] bg-transparent px-4 py-2.5 text-sm text-gray-300 transition hover:bg-[#2a2a35]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Removing...
              </>
            ) : (
              'Remove'
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

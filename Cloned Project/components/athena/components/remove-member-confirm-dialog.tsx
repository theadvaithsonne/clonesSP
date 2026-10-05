"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type RemoveMemberScope = "room" | "space" | "workspace";

interface RemoveMemberConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    loading?: boolean;
    memberName?: string;
    scope: RemoveMemberScope;
}

export function RemoveMemberConfirmDialog({
    open,
    onOpenChange,
    onConfirm,
    loading = false,
    memberName,
    scope,
}: RemoveMemberConfirmDialogProps) {
    const displayName = memberName || "this member";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100%-1rem)] sm:max-w-[360px] max-h-[90dvh] overflow-y-auto bg-[#161616] border-0 text-white rounded-2xl p-6 sm:p-8 shadow-2xl">
                <div className="flex flex-col gap-5">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                        <p className="text-[15px] font-semibold text-white">
                            Remove {displayName}?
                        </p>
                        <p className="text-[13px] text-white/40 mt-1 leading-relaxed">
                            They will be removed from this {scope} and lose access.
                        </p>
                    </div>
                    <div className="flex gap-2 pt-1">
                        <Button
                            variant="ghost"
                            className="flex-1 h-9 text-[13px] text-white/40 hover:text-white/70 hover:bg-white/5"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="flex-1 h-9 text-[13px] bg-rose-500 text-white font-semibold hover:bg-rose-600"
                            onClick={onConfirm}
                            disabled={loading}
                        >
                            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                            Remove
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

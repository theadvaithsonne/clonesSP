"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FIGMA } from "@/components/deals/LeadDetailFigmaView";

export type TagColor = {
    bg: string;
    border: string;
    text: string;
};

type AddTagDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tagInput: string;
    onTagInputChange: (value: string) => void;
    currentTags: string[];
    getTagColor: (tag: string, index: number) => TagColor;
    onRemoveTag: (tag: string) => void;
    onSave: () => void;
    isSubmitting?: boolean;
};

const fieldLabelClass = "text-[12px] font-medium whitespace-nowrap";
const inputClass =
    "h-9 w-full rounded-lg border px-2.5 text-[13px] font-normal shadow-none focus-visible:ring-0 focus-visible:ring-offset-0";

export function AddTagDialog({
    open,
    onOpenChange,
    tagInput,
    onTagInputChange,
    currentTags,
    getTagColor,
    onRemoveTag,
    onSave,
    isSubmitting = false,
}: AddTagDialogProps) {
    const fieldStyle = {
        background: "#1e1e1e",
        borderColor: FIGMA.border,
        color: FIGMA.textPrimary,
    } as const;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="flex max-h-[85vh] flex-col gap-0 overflow-hidden rounded-[20px] border p-0 sm:max-w-[503px] [&>button]:hidden"
                style={{
                    background: "#0f0f0f",
                    borderColor: FIGMA.infoBorder,
                    boxShadow: "2px 2px 2px black",
                }}
            >
                <div
                    className="flex shrink-0 items-center justify-between border-b p-5"
                    style={{ borderColor: FIGMA.infoBorder, background: "#0f0f0f" }}
                >
                    <DialogTitle className="text-[15px] font-bold text-white">
                        Add Tag
                    </DialogTitle>
                    <button
                        type="button"
                        aria-label="Close"
                        className="flex size-5 cursor-pointer items-center justify-center text-[#9a9a9a] transition-colors hover:text-white"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
                    <div className="flex flex-col gap-1.5">
                        <label className={fieldLabelClass} style={{ color: FIGMA.textSecondary }}>
                            Tag Names
                        </label>
                        <Input
                            placeholder="e.g. urgent, follow-up, vip"
                            value={tagInput}
                            onChange={(e) => onTagInputChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    onSave();
                                }
                            }}
                            disabled={isSubmitting}
                            className={inputClass}
                            style={fieldStyle}
                        />
                        <p className="text-[11px]" style={{ color: FIGMA.textMuted }}>
                            Separate multiple tags with commas
                        </p>
                    </div>

                    {currentTags.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                            <label className={fieldLabelClass} style={{ color: FIGMA.textSecondary }}>
                                Current Tags
                            </label>
                            <div
                                className="flex min-h-[60px] flex-wrap gap-2 rounded-xl border p-3"
                                style={{
                                    background: "#1e1e1e",
                                    borderColor: FIGMA.border,
                                }}
                            >
                                {currentTags.map((tag, index) => {
                                    const tagColor = getTagColor(tag, index);
                                    return (
                                        <button
                                            key={`${tag}-${index}`}
                                            type="button"
                                            onClick={() => onRemoveTag(tag)}
                                            disabled={isSubmitting}
                                            className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[12px] font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                                            style={{
                                                backgroundColor: tagColor.bg,
                                                borderColor: tagColor.border,
                                                color: tagColor.text,
                                            }}
                                        >
                                            {tag}
                                            <X className="size-3" />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                </div>

                <div
                    className="flex shrink-0 items-center justify-between border-t px-6 py-[15px]"
                    style={{ background: "#141414", borderColor: FIGMA.infoBorder }}
                >
                    <button
                        type="button"
                        className="cursor-pointer text-[14px] font-semibold transition-colors hover:text-white disabled:opacity-50"
                        style={{ color: FIGMA.textMuted }}
                        onClick={() => {
                            onOpenChange(false);
                            onTagInputChange("");
                        }}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <Button
                        type="button"
                        onClick={onSave}
                        disabled={isSubmitting || !tagInput.trim()}
                        className="h-auto cursor-pointer rounded-lg px-5 py-3 text-[14px] font-bold hover:opacity-90 disabled:opacity-50"
                        style={{ background: FIGMA.accent, color: "#0f0f0f" }}
                    >
                        {isSubmitting ? "Saving..." : "Save"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

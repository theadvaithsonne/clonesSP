"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { FIGMA } from "@/components/deals/LeadDetailFigmaView";

type AddDocumentDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onFilesSelected: (files: FileList) => void;
    isUploading?: boolean;
};

export function AddDocumentDialog({
    open,
    onOpenChange,
    onFilesSelected,
    isUploading = false,
}: AddDocumentDialogProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedNames, setSelectedNames] = useState<string[]>([]);

    const resetSelection = () => {
        setSelectedNames([]);
        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) {
            resetSelection();
        }
        onOpenChange(nextOpen);
    };

    const applyFiles = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setSelectedNames(Array.from(files).map((f) => f.name));
        onFilesSelected(files);
        resetSelection();
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
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
                        Add Document
                    </DialogTitle>
                    <button
                        type="button"
                        aria-label="Close"
                        className="flex size-5 cursor-pointer items-center justify-center text-[#9a9a9a] transition-colors hover:text-white"
                        onClick={() => handleOpenChange(false)}
                        disabled={isUploading}
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <div className="relative flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
                    {isUploading && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0f0f0f]/80 backdrop-blur-[2px]">
                            <Loader2 className="h-8 w-8 animate-spin" style={{ color: FIGMA.accent }} />
                            <p className="text-sm" style={{ color: FIGMA.textSecondary }}>
                                Uploading...
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <label
                            className="text-[12px] font-medium"
                            style={{ color: FIGMA.textSecondary }}
                        >
                            Select File(s)
                        </label>

                        <button
                            type="button"
                            disabled={isUploading}
                            onClick={() => inputRef.current?.click()}
                            onDragEnter={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDragging(true);
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDragging(true);
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDragging(false);
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDragging(false);
                                applyFiles(e.dataTransfer.files);
                            }}
                            className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-10 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                            style={{
                                background: isDragging ? "#1a1a1a" : "#1e1e1e",
                                borderColor: isDragging ? FIGMA.accent : FIGMA.border,
                            }}
                        >
                            <div
                                className="flex size-10 items-center justify-center rounded-full"
                                style={{ background: "#0f0f0f" }}
                            >
                                <Upload className="size-5" style={{ color: FIGMA.accent }} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <p className="text-[14px] font-semibold text-white">
                                    Drop files here or click to browse
                                </p>
                                <p className="text-[12px]" style={{ color: FIGMA.textSecondary }}>
                                    You can select multiple files
                                </p>
                            </div>
                        </button>

                        <input
                            ref={inputRef}
                            type="file"
                            multiple
                            className="hidden"
                            disabled={isUploading}
                            onChange={(e) => applyFiles(e.target.files)}
                        />
                    </div>

                    {selectedNames.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            {selectedNames.map((name) => (
                                <div
                                    key={name}
                                    className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
                                    style={{
                                        background: "#1e1e1e",
                                        borderColor: FIGMA.border,
                                    }}
                                >
                                    <FileText
                                        className="size-4 shrink-0"
                                        style={{ color: FIGMA.textSecondary }}
                                    />
                                    <p className="truncate text-[13px] text-white">{name}</p>
                                </div>
                            ))}
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
                        onClick={() => handleOpenChange(false)}
                        disabled={isUploading}
                    >
                        Cancel
                    </button>
                    <Button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={isUploading}
                        className="h-auto cursor-pointer rounded-lg px-5 py-3 text-[14px] font-bold hover:opacity-90 disabled:opacity-50"
                        style={{ background: FIGMA.accent, color: "#0f0f0f" }}
                    >
                        {isUploading ? "Uploading..." : "Browse Files"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

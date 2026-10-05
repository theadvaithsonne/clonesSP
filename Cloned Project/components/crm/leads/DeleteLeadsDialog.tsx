"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { isDealsInlineMode } from "@/lib/deals-events";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

type DealsTheme = "dark" | "color" | "light";

export type DeleteLeadItem = {
    id?: string;
    name: string;
};

type DeleteLeadsDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    leads: DeleteLeadItem[];
    totalCount?: number;
    remainingCount?: number;
    onConfirm: () => void;
    isDeleting?: boolean;
    /** Override default "Delete Lead(s)" title */
    title?: string;
    description?: string;
    selectedLabel?: string;
};

function useDealsTheme(): DealsTheme {
    const { theme, resolvedTheme } = useTheme();
    if (theme === "color") return "color";
    if (theme === "dark" || isDealsInlineMode() || resolvedTheme === "dark") return "dark";
    return "light";
}

function getInitials(name: string): string {
    const trimmed = name.trim();
    if (!trimmed || trimmed === "--") return "?";

    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function shellClass(theme: DealsTheme) {
    if (theme === "dark") return "bg-[#232323] border-[#2e2e2e] text-white";
    if (theme === "color") return "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)] text-white";
    return "bg-white border-[#e5e7eb] text-[#1f1f1f]";
}

function titleClass(theme: DealsTheme) {
    if (theme === "light") return "text-[#1f1f1f]";
    return "text-white";
}

function mutedClass(theme: DealsTheme) {
    if (theme === "dark") return "text-[#a1a1aa]";
    if (theme === "color") return "text-[rgba(0,255,255,0.6)]";
    return "text-[#6b7280]";
}

function listShellClass(theme: DealsTheme) {
    if (theme === "dark") return "bg-[#1f1f1f] border-[#2e2e2e]";
    if (theme === "color") return "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.2)]";
    return "bg-[#f9fafb] border-[#e5e7eb]";
}

function rowBorderClass(theme: DealsTheme) {
    if (theme === "dark") return "border-[#2e2e2e]";
    if (theme === "color") return "border-[rgba(0,255,255,0.15)]";
    return "border-[#e5e7eb]";
}

function avatarClass(theme: DealsTheme) {
    if (theme === "dark") return "bg-[#2e2e2e] text-white";
    if (theme === "color") return "bg-[rgba(0,255,255,0.15)] text-[#0ff]";
    return "bg-[#e5e7eb] text-[#374151]";
}

function leadNameClass(theme: DealsTheme) {
    if (theme === "light") return "text-[#1f1f1f]";
    return "text-white";
}

function cancelClass(theme: DealsTheme) {
    if (theme === "light") return "text-[#1f1f1f] hover:bg-gray-50";
    return "text-white hover:bg-white/5";
}

export default function DeleteLeadsDialog({
    open,
    onOpenChange,
    leads,
    totalCount,
    remainingCount = 0,
    onConfirm,
    isDeleting = false,
    title: titleOverride,
    description,
    selectedLabel,
}: DeleteLeadsDialogProps) {
    const dealsTheme = useDealsTheme();
    const count = totalCount ?? leads.length;
    const title =
        titleOverride ?? (count === 1 ? "Delete Lead (1)" : `Delete Leads (${count})`);
    const body =
        description ??
        "This action is permanent. All lead data, including contact details, activity history, and associated notes, will be deleted and cannot be recovered.";
    const listLabel = selectedLabel ?? "Selected leads";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className={cn(
                    "w-full max-w-[400px] gap-0 rounded-[12px] border p-0 shadow-lg",
                    shellClass(dealsTheme)
                )}
            >
                <div className="flex flex-col items-center gap-[50px] px-5 pb-5 pt-[30px]">
                    <div className="flex w-full flex-col gap-[18px] text-center">
                        <h2 className={cn("text-[18px] font-bold leading-[1.2]", titleClass(dealsTheme))}>
                            {title}
                        </h2>
                        <p className={cn("text-[12px] font-normal leading-[1.5]", mutedClass(dealsTheme))}>
                            {body}
                        </p>
                    </div>

                    {leads.length > 0 && (
                        <div className="flex w-full flex-col gap-[10px]">
                            <p className={cn("text-[12px] font-semibold", mutedClass(dealsTheme))}>
                                {listLabel}
                            </p>
                            <div
                                className={cn(
                                    "flex max-h-[220px] w-full flex-col overflow-y-auto rounded-[10px] border",
                                    listShellClass(dealsTheme)
                                )}
                            >
                                {leads.map((lead, index) => (
                                    <div
                                        key={lead.id ?? `${lead.name}-${index}`}
                                        className={cn(
                                            "flex items-center gap-[10px] px-[10px] py-2",
                                            index < leads.length - 1 && "border-b",
                                            rowBorderClass(dealsTheme)
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "flex size-6 shrink-0 items-center justify-center rounded-[12px] text-[11px] font-bold",
                                                avatarClass(dealsTheme)
                                            )}
                                        >
                                            {getInitials(lead.name)}
                                        </div>
                                        <p
                                            className={cn(
                                                "min-w-0 flex-1 truncate text-[13px] font-normal",
                                                leadNameClass(dealsTheme)
                                            )}
                                        >
                                            {lead.name}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            {remainingCount > 0 && (
                                <p className={cn("text-[12px] font-medium", mutedClass(dealsTheme))}>
                                    + {remainingCount} more selected lead{remainingCount === 1 ? "" : "s"}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="flex w-full max-w-[300px] flex-col gap-3">
                        <Button
                            type="button"
                            onClick={onConfirm}
                            disabled={isDeleting}
                            className="h-[35px] w-full rounded-[12px] border-0 bg-[#ff3b30] text-[14px] font-semibold text-white shadow-none hover:bg-[#e6352b]"
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={isDeleting}
                            className={cn(
                                "h-[35px] w-full rounded-[12px] text-[14px] font-semibold shadow-none",
                                cancelClass(dealsTheme)
                            )}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

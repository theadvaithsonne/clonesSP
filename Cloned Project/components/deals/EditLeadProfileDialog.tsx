"use client";

import { Archive, Loader2, Plus, Tag, Trophy, X, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FIGMA } from "@/components/deals/LeadDetailFigmaView";

export type EditLeadProfileForm = {
    salesFunnelId: string;
    stage: string;
    source: string;
    assignedTo: string;
    description: string;
};

type FunnelOption = { _id: string; name?: string; funnelName?: string };
type UserOption = { id?: string; _id?: string; userId?: string; name?: string; email?: string };

type EditLeadProfileDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    form: EditLeadProfileForm;
    onFormChange: (patch: Partial<EditLeadProfileForm>) => void;
    funnels: FunnelOption[];
    stages: string[];
    sources: string[];
    users: UserOption[];
    isLoading?: boolean;
    isSubmitting?: boolean;
    isCustomSource?: boolean;
    customSourceValue?: string;
    onCustomSourceChange?: (value: string) => void;
    onToggleCustomSource?: (enabled: boolean) => void;
    onFunnelChange: (funnelId: string) => void;
    onSave: () => void;
    leadStatus?: string;
    onAddTag?: (tag: string) => void;
    onRemoveTag?: (tag: string) => void;
    currentTags?: string[];
    onArchive?: () => void;
    onCloseLost?: () => void;
    onMarkWon?: () => void;
    onMakeActive?: () => void;
};

const fieldLabelClass = "text-[12px] font-medium whitespace-nowrap";
const selectTriggerClass =
    "h-9 w-full rounded-lg border px-2.5 text-[13px] font-normal shadow-none focus:ring-0 focus:ring-offset-0 [&>span]:line-clamp-1";

export function EditLeadProfileDialog({
    open,
    onOpenChange,
    form,
    onFormChange,
    funnels,
    stages,
    sources,
    users,
    isLoading = false,
    isSubmitting = false,
    isCustomSource = false,
    customSourceValue = "",
    onCustomSourceChange,
    onToggleCustomSource,
    onFunnelChange,
    onSave,
    leadStatus = "active",
    onAddTag,
    onRemoveTag,
    currentTags = [],
    onArchive,
    onCloseLost,
    onMarkWon,
    onMakeActive,
}: EditLeadProfileDialogProps) {
    const [customTagInput, setCustomTagInput] = useState("");
    const sourceSelectValue = sources.includes(form.source || "")
        ? form.source
        : form.source
            ? "__current_custom__"
            : undefined;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="gap-0 overflow-hidden rounded-[20px] border p-0 sm:max-w-[503px] [&>button]:hidden"
                style={{
                    background: "#0f0f0f",
                    borderColor: FIGMA.infoBorder,
                    boxShadow: "2px 2px 2px black",
                }}
            >
                <div
                    className="flex items-center justify-between border-b p-5"
                    style={{ borderColor: FIGMA.infoBorder, background: "#0f0f0f" }}
                >
                    <DialogTitle className="text-[15px] font-bold text-white">
                        Edit Lead Profile
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

                <div className="relative flex max-h-[70vh] flex-col gap-5 overflow-y-auto p-6">
                    {isLoading && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0f0f0f]/80 backdrop-blur-[2px]">
                            <Loader2 className="h-8 w-8 animate-spin" style={{ color: FIGMA.accent }} />
                            <p className="text-sm" style={{ color: FIGMA.textSecondary }}>
                                Loading lead data...
                            </p>
                        </div>
                    )}

                    <div className={`flex flex-col gap-5 ${isLoading ? "pointer-events-none opacity-60" : ""}`}>
                        <div className="flex flex-col gap-1.5">
                            <label className={fieldLabelClass} style={{ color: FIGMA.textSecondary }}>
                                Sales Funnel
                            </label>
                            <Select
                                value={form.salesFunnelId || undefined}
                                onValueChange={onFunnelChange}
                                disabled={isLoading}
                            >
                                <SelectTrigger
                                    className={selectTriggerClass}
                                    style={{
                                        background: "#1e1e1e",
                                        borderColor: FIGMA.border,
                                        color: FIGMA.textPrimary,
                                    }}
                                >
                                    <SelectValue placeholder="Select sales funnel" />
                                </SelectTrigger>
                                <SelectContent
                                    className="border text-white"
                                    style={{ background: "#1e1e1e", borderColor: FIGMA.border }}
                                >
                                    {funnels.length > 0 ? (
                                        funnels.map((funnel) => (
                                            <SelectItem key={funnel._id} value={funnel._id}>
                                                {funnel.name || funnel.funnelName || "Unknown"}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value="no-funnels" disabled>
                                            {isLoading ? "Loading..." : "No funnels available"}
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className={fieldLabelClass} style={{ color: FIGMA.textSecondary }}>
                                Stage
                            </label>
                            <Select
                                value={form.stage || undefined}
                                onValueChange={(value) => onFormChange({ stage: value })}
                                disabled={!form.salesFunnelId || stages.length === 0}
                            >
                                <SelectTrigger
                                    className={selectTriggerClass}
                                    style={{
                                        background: "#1e1e1e",
                                        borderColor: FIGMA.border,
                                        color: FIGMA.textPrimary,
                                    }}
                                >
                                    <SelectValue
                                        placeholder={
                                            form.salesFunnelId ? "Select stage" : "Select sales funnel first"
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent
                                    className="border text-white"
                                    style={{ background: "#1e1e1e", borderColor: FIGMA.border }}
                                >
                                    {stages.length > 0 ? (
                                        stages.map((stage) => (
                                            <SelectItem key={stage} value={stage}>
                                                {stage}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value="no-stages" disabled>
                                            Select a funnel first
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className={fieldLabelClass} style={{ color: FIGMA.textSecondary }}>
                                Source
                            </label>
                            {isCustomSource ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        placeholder="Type custom source..."
                                        value={customSourceValue}
                                        onChange={(e) => {
                                            onCustomSourceChange?.(e.target.value);
                                            onFormChange({ source: e.target.value });
                                        }}
                                        autoFocus
                                        className="h-9 rounded-lg border px-2.5 text-[13px] text-white placeholder:text-[#666] focus-visible:ring-0"
                                        style={{
                                            background: "#1e1e1e",
                                            borderColor: FIGMA.border,
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 shrink-0 cursor-pointer text-[#9a9a9a] hover:bg-white/5 hover:text-white"
                                        onClick={() => {
                                            onToggleCustomSource?.(false);
                                            onCustomSourceChange?.("");
                                            onFormChange({ source: "" });
                                        }}
                                        title="Back to presets"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <Select
                                    value={sourceSelectValue}
                                    onValueChange={(value) => {
                                        if (value === "__add_custom__") {
                                            onToggleCustomSource?.(true);
                                            onCustomSourceChange?.("");
                                            onFormChange({ source: "" });
                                        } else if (value !== "__current_custom__") {
                                            onFormChange({ source: value });
                                        }
                                    }}
                                >
                                    <SelectTrigger
                                        className={selectTriggerClass}
                                        style={{
                                            background: "#1e1e1e",
                                            borderColor: FIGMA.border,
                                            color: FIGMA.textPrimary,
                                        }}
                                    >
                                        <SelectValue placeholder="Select source" />
                                    </SelectTrigger>
                                    <SelectContent
                                        className="border text-white"
                                        style={{ background: "#1e1e1e", borderColor: FIGMA.border }}
                                    >
                                        {sources
                                            .filter((source) => source && source !== "")
                                            .map((source) => (
                                                <SelectItem key={source} value={source}>
                                                    {source}
                                                </SelectItem>
                                            ))}
                                        {form.source && !sources.includes(form.source) && (
                                            <SelectItem value="__current_custom__">
                                                {form.source}
                                            </SelectItem>
                                        )}
                                        <SelectItem value="__add_custom__">
                                            <span className="flex items-center gap-1">
                                                <Plus className="h-3 w-3" /> Add Custom Source
                                            </span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className={fieldLabelClass} style={{ color: FIGMA.textSecondary }}>
                                Owner
                            </label>
                            <Select
                                value={form.assignedTo || undefined}
                                onValueChange={(value) => onFormChange({ assignedTo: value })}
                                disabled={isLoading}
                            >
                                <SelectTrigger
                                    className={selectTriggerClass}
                                    style={{
                                        background: "#1e1e1e",
                                        borderColor: FIGMA.border,
                                        color: FIGMA.textPrimary,
                                    }}
                                >
                                    <SelectValue placeholder="Select owner..." />
                                </SelectTrigger>
                                <SelectContent
                                    className="border text-white"
                                    style={{ background: "#1e1e1e", borderColor: FIGMA.border }}
                                >
                                    {users.length > 0 ? (
                                        users.map((user) => {
                                            const uid =
                                                user.id || user._id || user.userId || "";
                                            return (
                                                <SelectItem key={uid} value={uid}>
                                                    {user.name}
                                                    {user.email ? ` (${user.email})` : ""}
                                                </SelectItem>
                                            );
                                        })
                                    ) : (
                                        <SelectItem value="no-users" disabled>
                                            {isLoading ? "Loading..." : "No users available"}
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className={fieldLabelClass} style={{ color: FIGMA.textSecondary }}>
                                Description
                            </label>
                            <Textarea
                                placeholder="Enter lead description"
                                value={form.description || ""}
                                onChange={(e) => onFormChange({ description: e.target.value })}
                                disabled={isLoading}
                                rows={3}
                                className="resize-none rounded-lg border text-[13px]"
                                style={{
                                    background: "#1e1e1e",
                                    borderColor: FIGMA.border,
                                    color: FIGMA.textPrimary,
                                }}
                            />
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2 pt-2">
                        <div className="flex flex-col gap-1.5">
                            <label className={fieldLabelClass} style={{ color: FIGMA.textSecondary }}>
                                Tags
                            </label>
                            <Select
                                onValueChange={(value) => {
                                    if (value === "__add_custom__") {
                                        // Custom tag will be handled separately
                                    } else if (!currentTags.includes(value)) {
                                        onAddTag?.(value);
                                    }
                                }}
                            >
                                <SelectTrigger
                                    className={selectTriggerClass}
                                    style={{
                                        background: "#1e1e1e",
                                        borderColor: FIGMA.border,
                                        color: FIGMA.textPrimary,
                                    }}
                                >
                                    <SelectValue placeholder="Select tags" />
                                </SelectTrigger>
                                <SelectContent
                                    className="border text-white"
                                    style={{ background: "#1e1e1e", borderColor: FIGMA.border }}
                                >
                                    <SelectItem value="__add_custom__">
                                        <span className="flex items-center gap-2">
                                            <Plus className="h-3 w-3" /> Add Custom Tag
                                        </span>
                                    </SelectItem>
                                    {["urgent", "follow-up", "vip", "hot lead", "new", "priority"].map((tag) => (
                                        <SelectItem key={tag} value={tag} disabled={currentTags.includes(tag)}>
                                            <span className="flex items-center gap-2">
                                                <Tag className="h-3 w-3" style={{ color: FIGMA.textSecondary }} />
                                                {tag}
                                                {currentTags.includes(tag) && (
                                                    <span className="text-[10px]" style={{ color: FIGMA.textMuted }}>(added)</span>
                                                )}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {currentTags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {currentTags.map((tag, index) => (
                                        <span
                                            key={`${tag}-${index}`}
                                            className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium"
                                            style={{
                                                background: "#1e1e1e",
                                                borderColor: FIGMA.border,
                                                color: FIGMA.textPrimary,
                                            }}
                                        >
                                            {tag}
                                            <button
                                                type="button"
                                                className="cursor-pointer"
                                                onClick={() => onRemoveTag?.(tag)}
                                            >
                                                <X className="h-3 w-3" style={{ color: FIGMA.textMuted }} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2 pt-1">
                                <Input
                                    placeholder="Custom tag"
                                    value={customTagInput}
                                    onChange={(e) => setCustomTagInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && customTagInput.trim()) {
                                            onAddTag?.(customTagInput.trim());
                                            setCustomTagInput("");
                                        }
                                    }}
                                    className="h-8 flex-1 rounded-lg border px-2.5 text-[12px]"
                                    style={{
                                        background: "#1e1e1e",
                                        borderColor: FIGMA.border,
                                        color: FIGMA.textPrimary,
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 cursor-pointer px-2"
                                    onClick={() => {
                                        if (customTagInput.trim()) {
                                            onAddTag?.(customTagInput.trim());
                                            setCustomTagInput("");
                                        }
                                    }}
                                    disabled={!customTagInput.trim()}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className={fieldLabelClass} style={{ color: FIGMA.textSecondary }}>
                                Lead Status
                            </label>
                            <Select
                                value={leadStatus || "active"}
                                onValueChange={(value) => {
                                    if (value === "archived") onArchive?.();
                                    else if (value === "lost") onCloseLost?.();
                                    else if (value === "won") onMarkWon?.();
                                    else if (value === "active") onMakeActive?.();
                                }}
                            >
                                <SelectTrigger
                                    className={selectTriggerClass}
                                    style={{
                                        background: "#1e1e1e",
                                        borderColor: FIGMA.border,
                                        color: FIGMA.textPrimary,
                                    }}
                                >
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent
                                    className="border text-white"
                                    style={{ background: "#1e1e1e", borderColor: FIGMA.border }}
                                >
                                    <SelectItem value="active">
                                        <span className="flex items-center gap-2">
                                            Active
                                        </span>
                                    </SelectItem>
                                    <SelectItem value="archived">
                                        <span className="flex items-center gap-2">
                                            <Archive className="h-4 w-4" style={{ color: FIGMA.textSecondary }} />
                                            Archive
                                        </span>
                                    </SelectItem>
                                    <SelectItem value="lost">
                                        <span className="flex items-center gap-2" style={{ color: FIGMA.red }}>
                                            <XCircle className="h-4 w-4" style={{ color: FIGMA.red }} />
                                            Mark as Lost
                                        </span>
                                    </SelectItem>
                                    <SelectItem value="won">
                                        <span className="flex items-center gap-2">
                                            <Trophy className="h-4 w-4" style={{ color: FIGMA.accent }} />
                                            Mark as Won
                                        </span>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div
                    className="flex items-center justify-between border-t px-6 py-[15px]"
                    style={{ background: "#141414", borderColor: FIGMA.infoBorder }}
                >
                    <button
                        type="button"
                        className="cursor-pointer text-[14px] font-semibold transition-colors hover:text-white disabled:opacity-50"
                        style={{ color: FIGMA.textMuted }}
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <Button
                        type="button"
                        onClick={onSave}
                        disabled={isSubmitting || isLoading}
                        className="h-auto cursor-pointer rounded-lg px-5 py-3 text-[14px] font-bold hover:opacity-90"
                        style={{ background: FIGMA.accent, color: "#0f0f0f" }}
                    >
                        {isSubmitting ? "Saving..." : "Save"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

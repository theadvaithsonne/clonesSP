"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import {
    Check,
    ChevronsUpDown,
    Circle,
    ChevronLeft,
    ChevronRight,
    Copy,
    Download,
    Edit,
    FileText,
    Info,
    Mail,
    MapPin,
    Phone,
    ShoppingBag,
    Tag,
    Trash2,
    User,
    UserPlus,
    X,
} from "lucide-react";
import { toast } from "sonner";

export const FIGMA = {
    bg: "#181818",
    card: "#1a1a1a",
    activityCard: "#121215",
    border: "#3a3a3a",
    borderSubtle: "#2a2a2a",
    accent: "var(--brand)",
    accentBright: "var(--brand)",
    textPrimary: "#ffffff",
    textSecondary: "#9a9a9a",
    textMuted: "#888888",
    infoBg: "#0f0f0f",
    infoBorder: "#1f1f1f",
    pillBg: "#2a2a2a",
    tagBlue: "#3b82f5",
    red: "#ef4444",
    green: "#22c55e",
};

export type ActivityTab = "tasks" | "followups";

export type TimelineItem = {
    id: string;
    kind: "task" | "followup";
    title: string;
    description?: string;
    dueLabel?: string;
    createdBy?: string;
    assigneeName?: string;
    /** Who added or completed the item — shown beside edit/delete. */
    actorName?: string;
    actorAction?: "added" | "completed";
    isCompleted?: boolean;
    timestamp: number;
};

export type InlineFollowupForm = {
    title: string;
    description: string;
    enableAutoFollowUp: boolean;
    startDate: string;
    endDate: string;
    frequency: string;
};

type LeadDetailFigmaViewProps = {
    lead: any;
    tags: string[];
    products: any[];
    funnelStages: Array<{ name: string; probability?: number } | string>;
    displayLeadName: string;
    displayEmail: string;
    displayPhone: string;
    funnelDisplayName: string;
    dateAddedLabel: string;
    lastActivityLabel: string;
    ownerName: string;
    company: {
        name: string;
        location: string;
        industry: string;
    } | null;
    hasCompany: boolean;
    timelineItems: TimelineItem[];
    activityTab: ActivityTab;
    onActivityTabChange: (tab: ActivityTab) => void;
    taskForm: {
        title: string;
        description: string;
        dueDate: string;
        priority: string;
        assignedTo: string;
    };
    onTaskFormChange: (form: LeadDetailFigmaViewProps["taskForm"]) => void;
    inlineFollowupForm: InlineFollowupForm;
    onInlineFollowupFormChange: (form: InlineFollowupForm) => void;
    editLeadUsers: any[];
    isSubmittingTask: boolean;
    isSubmittingFollowUp: boolean;
    isSubmittingAutoFollowUp: boolean;
    onStageChange: (stage: string) => void;
    onEditLead: () => void;
    onAddProduct: () => void;
    onEditProducts: () => void;
    onCreateTask: () => void;
    onInlineAddFollowup: () => void;
    onToggleTaskStatus: (taskId: string, status: string) => void;
    onEditTask: (task: any) => void;
    onDeleteTask: (taskId: string) => void;
    onAddContact: () => void;
    onOpenWhatsApp: (phone: string) => void;
    onOpenGmail: (email: string) => void;
    onEditCompany: () => void;
    onAddCompany: () => void;
    onAttachFile: () => void;
    onDeleteDocument: (docId: string) => void;
    onRemoveTag: (tag: string) => void;
};

function copyToClipboard(value: string, label: string) {
    if (!value) return;
    void navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
}

function getStageName(stageItem: { name: string } | string): string {
    if (typeof stageItem === "string") return stageItem;
    return stageItem.name || "";
}

function formatDueLabel(dateStr?: string): string | undefined {
    if (!dateStr) return undefined;
    const due = new Date(dateStr);
    if (Number.isNaN(due.getTime())) return undefined;

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isSameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    const time = due.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (isSameDay(due, now)) return `Due Today at ${time}`;
    if (isSameDay(due, tomorrow)) return `Due Tomorrow at ${time}`;

    const day = due.toLocaleDateString("en-GB", { weekday: "long" });
    return `Due ${day} at ${time}`;
}

/** Exact glyph from Figma lead-detail activity timeline (15×15 square-check). */
function FigmaSquareCheckIcon({ className = "" }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 15 15"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-hidden
        >
            <path
                d="M13.125 2.8125V12.1875C13.125 12.4361 13.0262 12.6746 12.8504 12.8504C12.6746 13.0262 12.4361 13.125 12.1875 13.125H7.96875C7.84443 13.125 7.7252 13.0756 7.63729 12.9877C7.54939 12.8998 7.5 12.7806 7.5 12.6562C7.5 12.5319 7.54939 12.4127 7.63729 12.3248C7.7252 12.2369 7.84443 12.1875 7.96875 12.1875H12.1875V2.8125H2.8125V8.4375C2.8125 8.56182 2.76311 8.68105 2.67521 8.76896C2.5873 8.85686 2.46807 8.90625 2.34375 8.90625C2.21943 8.90625 2.1002 8.85686 2.01229 8.76896C1.92439 8.68105 1.875 8.56182 1.875 8.4375V2.8125C1.875 2.56386 1.97377 2.3254 2.14959 2.14959C2.3254 1.97377 2.56386 1.875 2.8125 1.875H12.1875C12.4361 1.875 12.6746 1.97377 12.8504 2.14959C13.0262 2.3254 13.125 2.56386 13.125 2.8125ZM7.36289 9.04336C7.31936 8.99978 7.26766 8.9652 7.21075 8.94161C7.15385 8.91802 7.09285 8.90588 7.03125 8.90588C6.96965 8.90588 6.90865 8.91802 6.85175 8.94161C6.79484 8.9652 6.74314 8.99978 6.69961 9.04336L3.75 11.9936L2.67539 10.9184C2.63184 10.8748 2.58014 10.8403 2.52323 10.8167C2.46633 10.7931 2.40534 10.781 2.34375 10.781C2.28216 10.781 2.22117 10.7931 2.16427 10.8167C2.10736 10.8403 2.05566 10.8748 2.01211 10.9184C1.96856 10.9619 1.93401 11.0136 1.91044 11.0705C1.88687 11.1274 1.87474 11.1884 1.87474 11.25C1.87474 11.3116 1.88687 11.3726 1.91044 11.4295C1.93401 11.4864 1.96856 11.5381 2.01211 11.5816L3.41836 12.9879C3.46189 13.0315 3.51359 13.066 3.5705 13.0896C3.6274 13.1132 3.6884 13.1254 3.75 13.1254C3.8116 13.1254 3.8726 13.1132 3.9295 13.0896C3.98641 13.066 4.03811 13.0315 4.08164 12.9879L7.36289 9.70664C7.40647 9.66311 7.44105 9.61141 7.46464 9.5545C7.48823 9.4976 7.50037 9.4366 7.50037 9.375C7.50037 9.3134 7.48823 9.2524 7.46464 9.1955C7.44105 9.13859 7.40647 9.08689 7.36289 9.04336Z"
                fill="currentColor"
            />
        </svg>
    );
}

function TimelineIcon({ kind: _kind }: { kind: TimelineItem["kind"] }) {
    // Figma uses the same square-check glyph for both task and follow-up rows.
    return (
        <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border"
            style={{ borderColor: FIGMA.accent }}
        >
            <FigmaSquareCheckIcon className="h-[15px] w-[15px] text-white" />
        </div>
    );
}

function RoundTaskCheckbox({
    isDone,
    onToggle,
}: {
    isDone: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            className="flex h-[15px] w-[15px] shrink-0 cursor-pointer items-center justify-center"
            onClick={onToggle}
            aria-label={isDone ? "Mark as not done" : "Mark as done"}
        >
            {isDone ? (
                <span
                    className="flex h-[15px] w-[15px] items-center justify-center rounded-full"
                    style={{ background: FIGMA.green }}
                >
                    <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                </span>
            ) : (
                <Circle className="h-[15px] w-[15px]" style={{ color: FIGMA.textSecondary }} />
            )}
        </button>
    );
}

function CardShell({
    children,
    className = "",
    variant = "default",
}: {
    children: React.ReactNode;
    className?: string;
    variant?: "default" | "activity";
}) {
    return (
        <div
            className={`rounded-[10px] border p-4 ${className}`}
            style={{
                background: variant === "activity" ? FIGMA.activityCard : FIGMA.card,
                borderColor: FIGMA.border,
            }}
        >
            {children}
        </div>
    );
}

function SectionHeader({
    title,
    actionLabel,
    onAction,
    actionColor = FIGMA.textSecondary,
}: {
    title: string;
    actionLabel?: string;
    onAction?: () => void;
    actionColor?: string;
}) {
    return (
        <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">{title}</h3>
            {actionLabel && onAction ? (
                <button
                    type="button"
                    onClick={onAction}
                    className="cursor-pointer text-xs transition-opacity hover:opacity-80"
                    style={{ color: actionColor }}
                >
                    {actionLabel}
                </button>
            ) : null}
        </div>
    );
}

function StageNavButton({
    direction,
    onClick,
    disabled,
}: {
    direction: "left" | "right";
    onClick: () => void;
    disabled?: boolean;
}) {
    const Icon = direction === "left" ? ChevronLeft : ChevronRight;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={direction === "left" ? "Scroll stages left" : "Scroll stages right"}
            className="flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-full border transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
            style={{ borderColor: "#9a9a9a" }}
        >
            <Icon className="h-3.5 w-3.5" style={{ color: FIGMA.textSecondary }} />
        </button>
    );
}

function StagePipelineBar({
    funnelStages,
    currentStage,
    onStageChange,
}: {
    funnelStages: Array<{ name: string; probability?: number } | string>;
    currentStage: string;
    onStageChange: (stage: string) => void;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [hasOverflow, setHasOverflow] = useState(false);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScrollState = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;

        const overflow = el.scrollWidth > el.clientWidth + 1;
        setHasOverflow(overflow);
        setCanScrollLeft(el.scrollLeft > 1);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }, []);

    const scrollStages = useCallback((direction: "left" | "right") => {
        const el = scrollRef.current;
        if (!el) return;
        const amount = Math.max(180, Math.round(el.clientWidth * 0.65));
        el.scrollBy({
            left: direction === "left" ? -amount : amount,
            behavior: "smooth",
        });
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        updateScrollState();

        const onScroll = () => updateScrollState();
        el.addEventListener("scroll", onScroll, { passive: true });

        const resizeObserver = new ResizeObserver(() => updateScrollState());
        resizeObserver.observe(el);
        if (el.firstElementChild) {
            resizeObserver.observe(el.firstElementChild);
        }

        return () => {
            el.removeEventListener("scroll", onScroll);
            resizeObserver.disconnect();
        };
    }, [funnelStages, currentStage, updateScrollState]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const activeStage = el.querySelector('[data-active-stage="true"]');
        if (activeStage instanceof HTMLElement) {
            activeStage.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        }
        window.setTimeout(updateScrollState, 300);
    }, [currentStage, funnelStages, updateScrollState]);

    return (
        <div className="flex min-w-0 flex-1 items-center gap-2">
            {hasOverflow ? (
                <StageNavButton
                    direction="left"
                    onClick={() => scrollStages("left")}
                    disabled={!canScrollLeft}
                />
            ) : null}

            <div
                ref={scrollRef}
                className="flex min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
                <div className="flex w-full min-w-max items-center">
                    {funnelStages.map((stageItem, index) => {
                        const stageName = getStageName(stageItem);
                        const isActive =
                            stageName.toLowerCase() === String(currentStage).toLowerCase();
                        const isFirst = index === 0;
                        const isLast = index === funnelStages.length - 1;

                        return (
                            <button
                                key={`${stageName}-${index}`}
                                type="button"
                                data-active-stage={isActive ? "true" : undefined}
                                className="flex h-[30px] min-w-[110px] max-w-[200px] flex-1 shrink-0 items-center justify-center border px-3 text-center text-xs"
                                style={{
                                    borderColor: "#9a9a9a",
                                    background: isActive ? FIGMA.accentBright : "transparent",
                                    color: isActive ? "var(--brand-foreground)" : FIGMA.textSecondary,
                                    borderRadius: isFirst
                                        ? "100px 0 0 100px"
                                        : isLast
                                          ? "0 100px 100px 0"
                                          : "0",
                                    borderLeft: isFirst ? undefined : "none",
                                }}
                            >
                                <span className="truncate">{stageName}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {hasOverflow ? (
                <StageNavButton
                    direction="right"
                    onClick={() => scrollStages("right")}
                    disabled={!canScrollRight}
                />
            ) : null}
        </div>
    );
}

function ActivityTabs({
    active,
    onChange,
}: {
    active: ActivityTab;
    onChange: (tab: ActivityTab) => void;
}) {
    const tabs: { id: ActivityTab; label: string }[] = [
        { id: "tasks", label: "Tasks" },
        { id: "followups", label: "Followups" },
    ];

    return (
        <div className="flex gap-1">
            {tabs.map((tab) => {
                const isActive = active === tab.id;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onChange(tab.id)}
                        className="cursor-pointer px-1.5 py-1 text-xs font-semibold transition-colors"
                        style={{
                            color: isActive ? FIGMA.accent : FIGMA.textPrimary,
                            borderBottom: isActive ? `2px solid ${FIGMA.accent}` : "2px solid transparent",
                        }}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}

export default function LeadDetailFigmaView({
    lead,
    tags,
    products,
    funnelStages,
    displayLeadName,
    displayEmail,
    displayPhone,
    funnelDisplayName,
    dateAddedLabel,
    lastActivityLabel,
    ownerName,
    company,
    hasCompany,
    timelineItems,
    activityTab,
    onActivityTabChange,
    taskForm,
    onTaskFormChange,
    inlineFollowupForm,
    onInlineFollowupFormChange,
    editLeadUsers,
    isSubmittingTask,
    isSubmittingFollowUp,
    isSubmittingAutoFollowUp,
    onStageChange,
    onEditLead,
    onAddProduct,
    onEditProducts,
    onCreateTask,
    onInlineAddFollowup,
    onToggleTaskStatus,
    onEditTask,
    onDeleteTask,
    onAddContact,
    onOpenWhatsApp,
    onOpenGmail,
    onEditCompany,
    onAddCompany,
    onAttachFile,
    onDeleteDocument,
    onRemoveTag,
}: LeadDetailFigmaViewProps) {
    const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
    const leadProducts = lead?.products?.length ? lead.products : products;
    const currentStage = lead?.stage || "Lead";
    const followupCount = inlineFollowupForm.endDate && inlineFollowupForm.frequency
        ? Math.max(
              1,
              Math.ceil(
                  (new Date(inlineFollowupForm.endDate).getTime() -
                      new Date(inlineFollowupForm.startDate || Date.now()).getTime()) /
                      (1000 * 60 * 60 * 24 * Number(inlineFollowupForm.frequency || 2))
              )
          )
        : 3;
    const followupInterval = inlineFollowupForm.frequency || "2";
    const filteredTimelineItems = timelineItems;
    const selectedAssignee = editLeadUsers.find((user: any) => {
        const uid = String(user.id || user._id || user.userId || "");
        return uid && uid === String(taskForm.assignedTo || "");
    });
    const selectedAssigneeLabel =
        selectedAssignee?.name ||
        [selectedAssignee?.firstName, selectedAssignee?.lastName].filter(Boolean).join(" ") ||
        "";

    return (
        <div className="min-h-full p-5" style={{ background: FIGMA.bg }}>
            {/* Pipeline header */}
            <div className="mb-5 flex items-center gap-3">
                <StagePipelineBar
                    funnelStages={funnelStages}
                    currentStage={currentStage}
                    onStageChange={onStageChange}
                />
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[250px_minmax(0,1fr)_250px]">
                {/* Left column */}
                <aside className="space-y-4">
                    <CardShell>
                        <SectionHeader title="Lead Profile" actionLabel="Edit" onAction={onEditLead} />
                        <div
                            className="mb-4 inline-flex rounded-[5px] border px-3 py-1.5 text-xs font-semibold"
                            style={{ borderColor: FIGMA.border, color: FIGMA.textSecondary }}
                        >
                            {currentStage}
                        </div>
                        <div className="space-y-2 text-xs">
                            {[
                                ["Sales Funnel", funnelDisplayName],
                                ["Date Added", dateAddedLabel],
                                ["Last Activity", lastActivityLabel],
                                ["Source", lead?.source || "—"],
                                ["Owner", ownerName],
                            ].map(([label, value]) => (
                                <div key={label} className="flex items-start justify-between gap-3">
                                    <span style={{ color: FIGMA.textSecondary }}>{label}</span>
                                    <span className="text-right font-normal text-white">{value}</span>
                                </div>
                            ))}
                        </div>
                        {lead?.description ? (
                            <div className="mt-3 space-y-1.5">
                                <p className="text-xs" style={{ color: FIGMA.textSecondary }}>
                                    Description
                                </p>
                                <p className="text-xs leading-relaxed text-white break-words">{lead.description}</p>
                            </div>
                        ) : null}
                        {tags.length > 0 ? (
                            <div className="mt-3 space-y-2.5">
                                <p className="text-xs" style={{ color: FIGMA.textSecondary }}>
                                    Tags
                                </p>
                                <div className="flex flex-wrap gap-2.5">
                                    {tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[8.4px] font-bold text-white"
                                            style={{ background: FIGMA.tagBlue }}
                                        >
                                            {tag}
                                            <button type="button" className="cursor-pointer" onClick={() => onRemoveTag(tag)}>
                                                <X className="h-2.5 w-2.5 opacity-80" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </CardShell>

                    <CardShell>
                        <SectionHeader title="Products" actionLabel="Edit" onAction={onEditProducts} />
                        {leadProducts.length > 0 ? (
                            <div className="mb-5 space-y-2 text-xs">
                                {leadProducts.map((product: any, index: number) => (
                                    <div key={index} className="flex justify-between gap-3">
                                        <span style={{ color: FIGMA.textSecondary }}>
                                            {product.name || product.productName}
                                        </span>
                                        <span className="text-white">
                                            ${Number(product.price || product.pricing || 0).toLocaleString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="mb-5 text-xs" style={{ color: FIGMA.textMuted }}>
                                No products added
                            </p>
                        )}
                        <Button
                            onClick={onAddProduct}
                            className="h-[30px] w-full cursor-pointer rounded-full text-xs font-bold text-[#09090b] hover:opacity-90"
                            style={{ background: FIGMA.accent, color: "#000000" }}
                        >
                            <ShoppingBag className="mr-2 h-4 w-4" />
                            Add Products
                        </Button>
                    </CardShell>
                </aside>

                {/* Center column */}
                <section>
                    <CardShell variant="activity" className="space-y-6">
                        <h3 className="text-sm font-bold text-white">Activity</h3>

                        <div className="space-y-4">
                            <ActivityTabs active={activityTab} onChange={onActivityTabChange} />

                            {activityTab === "tasks" && (
                                <div className="space-y-2.5">
                                    <Input
                                        placeholder="Enter title"
                                        value={taskForm.title}
                                        onChange={(e) =>
                                            onTaskFormChange({ ...taskForm, title: e.target.value })
                                        }
                                        className="h-[35px] rounded-lg border px-3 py-0 text-xs placeholder:text-muted-foreground placeholder:text-xs"
                                        style={{
                                            background: "transparent",
                                            borderColor: FIGMA.border,
                                            color: FIGMA.textPrimary,
                                        }}
                                    />
                                    <Textarea
                                        placeholder="Write a description"
                                        rows={3}
                                        value={taskForm.description}
                                        onChange={(e) =>
                                            onTaskFormChange({
                                                ...taskForm,
                                                description: e.target.value,
                                            })
                                        }
                                        className="resize-none rounded-lg border text-xs placeholder:text-xs"
                                        style={{
                                            background: "transparent",
                                            borderColor: FIGMA.border,
                                            color: FIGMA.textPrimary,
                                        }}
                                    />
                                    <div className="flex flex-wrap items-center gap-[15px]">
                                        <div
                                            className="relative flex !h-[30px] w-[140px] shrink-0 items-center rounded-lg border px-3"
                                            style={{
                                                background: FIGMA.card,
                                                borderColor: FIGMA.borderSubtle,
                                            }}
                                        >
                                            {!taskForm.dueDate && (
                                                <span
                                                    className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[10px]"
                                                    style={{ color: FIGMA.textSecondary }}
                                                >
                                                    Due date
                                                </span>
                                            )}
                                            <Input
                                                type="date"
                                                value={
                                                    taskForm.dueDate.includes("T")
                                                        ? taskForm.dueDate.split("T")[0]
                                                        : taskForm.dueDate
                                                }
                                                onChange={(e) =>
                                                    onTaskFormChange({
                                                        ...taskForm,
                                                        dueDate: e.target.value,
                                                    })
                                                }
                                                className="date-task-input !h-full w-full min-w-0 border-0 bg-transparent p-0 text-[10px] shadow-none focus-visible:ring-0"
                                                style={{ color: taskForm.dueDate ? FIGMA.textPrimary : "transparent" }}
                                            />
                                        </div>
                                        <Popover open={isAssigneeOpen} onOpenChange={setIsAssigneeOpen}>
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
                                                    role="combobox"
                                                    aria-expanded={isAssigneeOpen}
                                                    className="flex !h-[30px] w-[140px] shrink-0 items-center justify-between gap-1 rounded-lg border px-3 text-[10px]"
                                                    style={{
                                                        background: FIGMA.card,
                                                        borderColor: FIGMA.borderSubtle,
                                                        color: selectedAssigneeLabel
                                                            ? FIGMA.textPrimary
                                                            : FIGMA.textSecondary,
                                                    }}
                                                >
                                                    <span className="truncate text-left">
                                                        {selectedAssigneeLabel || "Assigned to"}
                                                    </span>
                                                    <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent
                                                align="start"
                                                className="w-[220px] border p-0"
                                                style={{
                                                    background: FIGMA.card,
                                                    borderColor: FIGMA.border,
                                                    color: FIGMA.textPrimary,
                                                }}
                                            >
                                                <Command
                                                    className="bg-transparent"
                                                    filter={(value, search) =>
                                                        value.toLowerCase().includes(search.toLowerCase())
                                                            ? 1
                                                            : 0
                                                    }
                                                >
                                                    <CommandInput
                                                        placeholder="Search assignee..."
                                                        className="h-8 text-xs"
                                                    />
                                                    <CommandList className="max-h-48">
                                                        <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
                                                            No users found.
                                                        </CommandEmpty>
                                                        <CommandGroup>
                                                            {editLeadUsers.map((user: any) => {
                                                                const uid = String(
                                                                    user.id || user._id || user.userId || ""
                                                                );
                                                                if (!uid) return null;
                                                                const name =
                                                                    user.name ||
                                                                    [user.firstName, user.lastName]
                                                                        .filter(Boolean)
                                                                        .join(" ") ||
                                                                    "Unknown";
                                                                const email = user.email || "";
                                                                const isSelected =
                                                                    uid === String(taskForm.assignedTo || "");
                                                                return (
                                                                    <CommandItem
                                                                        key={uid}
                                                                        value={`${name} ${email}`.trim()}
                                                                        onSelect={() => {
                                                                            onTaskFormChange({
                                                                                ...taskForm,
                                                                                assignedTo: uid,
                                                                            });
                                                                            setIsAssigneeOpen(false);
                                                                        }}
                                                                        className="cursor-pointer text-xs"
                                                                    >
                                                                        <Check
                                                                            className={`mr-2 h-3 w-3 shrink-0 ${
                                                                                isSelected
                                                                                    ? "opacity-100"
                                                                                    : "opacity-0"
                                                                            }`}
                                                                        />
                                                                        <div className="flex min-w-0 flex-col">
                                                                            <span className="truncate font-medium">
                                                                                {name}
                                                                            </span>
                                                                            {email ? (
                                                                                <span className="truncate text-[10px] text-muted-foreground">
                                                                                    {email}
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                    </CommandItem>
                                                                );
                                                            })}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <button
                                            type="button"
                                            onClick={onCreateTask}
                                            disabled={isSubmittingTask || !taskForm.title}
                                            className="!h-[30px] w-auto shrink-0 cursor-pointer rounded-lg px-4 text-xs font-semibold transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                                            style={{
                                                background: FIGMA.accent,
                                                color: "#000000",
                                            }}
                                        >
                                            {isSubmittingTask ? "Creating..." : "Create Task"}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activityTab === "followups" && (
                                <div className="space-y-2.5">
                                    <Input
                                        placeholder="Enter title"
                                        value={inlineFollowupForm.title}
                                        onChange={(e) =>
                                            onInlineFollowupFormChange({
                                                ...inlineFollowupForm,
                                                title: e.target.value,
                                            })
                                        }
                                        className="h-[35px] rounded-lg border px-3 py-0 text-xs placeholder:text-muted-foreground placeholder:text-xs"
                                        style={{
                                            background: "transparent",
                                            borderColor: FIGMA.border,
                                            color: FIGMA.textPrimary,
                                        }}
                                    />
                                    <Textarea
                                        placeholder="Write a description"
                                        rows={3}
                                        value={inlineFollowupForm.description}
                                        onChange={(e) =>
                                            onInlineFollowupFormChange({
                                                ...inlineFollowupForm,
                                                description: e.target.value,
                                            })
                                        }
                                        className="resize-none rounded-lg border text-xs placeholder:text-xs"
                                        style={{
                                            background: "transparent",
                                            borderColor: FIGMA.border,
                                            color: FIGMA.textPrimary,
                                        }}
                                    />
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-[10px] font-semibold text-white">
                                            Auto Followup
                                        </span>
                                        <Switch
                                            checked={inlineFollowupForm.enableAutoFollowUp}
                                            onCheckedChange={(checked) =>
                                                onInlineFollowupFormChange({
                                                    ...inlineFollowupForm,
                                                    enableAutoFollowUp: checked,
                                                })
                                            }
                                            className="data-[state=checked]:bg-brand"
                                        />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div
                                            className="flex h-[30px] w-[140px] shrink-0 items-center rounded-lg border px-3"
                                            style={{
                                                background: FIGMA.card,
                                                borderColor: FIGMA.borderSubtle,
                                            }}
                                        >
                                            <Input
                                                type="date"
                                                value={inlineFollowupForm.startDate}
                                                onChange={(e) =>
                                                    onInlineFollowupFormChange({
                                                        ...inlineFollowupForm,
                                                        startDate: e.target.value,
                                                    })
                                                }
                                                className="h-auto w-full min-w-0 border-0 bg-transparent p-0 text-[10px] shadow-none focus-visible:ring-0"
                                                style={{ color: FIGMA.textPrimary }}
                                            />
                                        </div>
                                        <div
                                            className="flex h-[30px] w-[140px] shrink-0 items-center rounded-lg border px-3"
                                            style={{
                                                background: FIGMA.card,
                                                borderColor: FIGMA.borderSubtle,
                                            }}
                                        >
                                            <Input
                                                type="date"
                                                value={inlineFollowupForm.endDate}
                                                onChange={(e) =>
                                                    onInlineFollowupFormChange({
                                                        ...inlineFollowupForm,
                                                        endDate: e.target.value,
                                                    })
                                                }
                                                className="h-auto w-full min-w-0 border-0 bg-transparent p-0 text-[10px] shadow-none focus-visible:ring-0"
                                                style={{ color: FIGMA.textPrimary }}
                                            />
                                        </div>
                                        <Input
                                            placeholder="Frequency"
                                            value={inlineFollowupForm.frequency}
                                            onChange={(e) =>
                                                onInlineFollowupFormChange({
                                                    ...inlineFollowupForm,
                                                    frequency: e.target.value,
                                                })
                                            }
                                            className="h-[30px] w-[81px] shrink-0 rounded-lg border text-[10px]"
                                            style={{
                                                background: FIGMA.card,
                                                borderColor: FIGMA.borderSubtle,
                                                color: FIGMA.textPrimary,
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={onInlineAddFollowup}
                                            disabled={
                                                isSubmittingFollowUp ||
                                                isSubmittingAutoFollowUp ||
                                                !inlineFollowupForm.title.trim() ||
                                                !inlineFollowupForm.description.trim()
                                            }
                                            className="h-[30px] shrink-0 cursor-pointer rounded-lg px-4 text-xs font-semibold transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                                            style={{
                                                background: FIGMA.accent,
                                                color: "#000000",
                                            }}
                                        >
                                            {isSubmittingFollowUp || isSubmittingAutoFollowUp
                                                ? "Adding..."
                                                : "Add Followup"}
                                        </button>
                                    </div>
                                    {inlineFollowupForm.startDate &&
                                    inlineFollowupForm.endDate &&
                                    Number(inlineFollowupForm.frequency) > 0 ? (
                                        <div
                                            className="rounded-lg border p-4"
                                            style={{
                                                background: FIGMA.infoBg,
                                                borderColor: FIGMA.infoBorder,
                                            }}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Info className="h-3.5 w-3.5 shrink-0" style={{ color: FIGMA.textMuted }} />
                                                <p className="text-[10px]" style={{ color: FIGMA.textMuted }}>
                                                    The system will create {followupCount} follow-ups every{" "}
                                                    {followupInterval} days.
                                                </p>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>

                        {/* Activity timeline */}
                        <div className="space-y-5">
                            {filteredTimelineItems.length > 0 ? (
                                filteredTimelineItems.map((item) => {
                                    const task = (lead?.tasks || []).find(
                                        (t: any) => (t._id || t.id) === item.id
                                    );
                                    const isDone =
                                        task
                                            ? task.status === "completed" ||
                                              task.isCompleted === true ||
                                              task.isCompleted === "true"
                                            : !!item.isCompleted;
                                    const showTaskActions =
                                        (item.kind === "task" || item.kind === "followup") && task;

                                    return (
                                    <div key={item.id} className="flex gap-3">
                                        <TimelineIcon kind={item.kind} />
                                        <div className="min-w-0 flex-1 space-y-2">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex min-w-0 items-center gap-[5px]">
                                                    {showTaskActions ? (
                                                        <RoundTaskCheckbox
                                                            isDone={isDone}
                                                            onToggle={() =>
                                                                onToggleTaskStatus(
                                                                    task._id,
                                                                    isDone
                                                                        ? "completed"
                                                                        : task.status || "open"
                                                                )
                                                            }
                                                        />
                                                    ) : null}
                                                    <p className="text-xs font-semibold text-white">
                                                        {item.title}
                                                    </p>
                                                </div>
                                                {item.dueLabel ? (
                                                    <p
                                                        className="shrink-0 text-[10px]"
                                                        style={{ color: FIGMA.accent }}
                                                    >
                                                        {item.dueLabel}
                                                    </p>
                                                ) : null}
                                            </div>
                                            {item.description ? (
                                                <p
                                                    className="text-xs leading-relaxed"
                                                    style={{ color: FIGMA.textSecondary }}
                                                >
                                                    {item.description}
                                                </p>
                                            ) : null}
                                            {item.assigneeName ? (
                                                <div className="flex items-center gap-1.5 text-[11px]" style={{ color: FIGMA.textSecondary }}>
                                                    <User className="h-3.5 w-3.5" />
                                                    {item.assigneeName}
                                                </div>
                                            ) : null}
                                            {showTaskActions ? (
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 w-6 cursor-pointer p-0"
                                                            style={{ color: FIGMA.textMuted }}
                                                            onClick={() => onEditTask(task)}
                                                        >
                                                            <Edit className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 w-6 cursor-pointer p-0"
                                                            style={{ color: FIGMA.red }}
                                                            onClick={() => onDeleteTask(task._id)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                    {item.actorName ? (
                                                        <p
                                                            className="text-[11px]"
                                                            style={{ color: FIGMA.textSecondary }}
                                                        >
                                                            {item.actorAction === "completed"
                                                                ? "Completed by"
                                                                : "Added by"}{" "}
                                                            <span className="font-medium text-white">
                                                                {item.actorName}
                                                            </span>
                                                        </p>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                    );
                                })
                            ) : (
                                <p className="py-6 text-center text-xs" style={{ color: FIGMA.textMuted }}>
                                    No activities yet
                                </p>
                            )}
                        </div>
                    </CardShell>
                </section>

                {/* Right column */}
                <aside className="space-y-4">
                    <CardShell>
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div
                                className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold"
                                style={{ background: FIGMA.accent, color: "#000" }}
                            >
                                {displayLeadName.charAt(0).toUpperCase()}
                            </div>
                            <p className="text-base font-bold text-white">{displayLeadName}</p>
                            <div className="w-full space-y-2.5">
                                {displayPhone ? (
                                    <div className="flex items-center justify-between gap-2 text-xs text-white">
                                        <div className="flex min-w-0 items-center gap-2.5">
                                            <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: FIGMA.textSecondary }} />
                                            <span className="truncate">{displayPhone}</span>
                                        </div>
                                        <button
                                            type="button"
                                            className="cursor-pointer"
                                            onClick={() => copyToClipboard(displayPhone, "Phone")}
                                        >
                                            <Copy className="h-3.5 w-3.5" style={{ color: FIGMA.textSecondary }} />
                                        </button>
                                    </div>
                                ) : null}
                                {displayEmail ? (
                                    <div className="flex items-center justify-between gap-2 text-xs text-white">
                                        <div className="flex min-w-0 items-center gap-2.5">
                                            <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: FIGMA.textSecondary }} />
                                            <span className="truncate">{displayEmail}</span>
                                        </div>
                                        <button
                                            type="button"
                                            className="cursor-pointer"
                                            onClick={() => copyToClipboard(displayEmail, "Email")}
                                        >
                                            <Copy className="h-3.5 w-3.5" style={{ color: FIGMA.textSecondary }} />
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                            <Button
                                variant="outline"
                                onClick={onAddContact}
                                className="h-[30px] w-full cursor-pointer rounded-[5px] border-white bg-transparent text-xs font-bold text-white hover:bg-white/5"
                            >
                                Add Contacts
                            </Button>
                        </div>
                    </CardShell>

                    <CardShell>
                        <SectionHeader title="Quick Actions" />
                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={() => onOpenWhatsApp(displayPhone)}
                                className="flex h-auto w-full cursor-pointer items-center gap-2 rounded-full border px-2.5 py-1.5 text-left text-xs font-medium text-white transition-opacity hover:opacity-90"
                                style={{ background: FIGMA.pillBg, borderColor: FIGMA.border }}
                            >
                                <WhatsAppIcon className="h-5 w-5 shrink-0 text-[#25d366]" />
                                Send WhatsApp
                            </button>
                            <button
                                type="button"
                                onClick={() => onOpenGmail(displayEmail)}
                                className="flex h-auto w-full cursor-pointer items-center gap-2 rounded-full border px-2.5 py-1.5 text-left text-xs font-medium text-white transition-opacity hover:opacity-90"
                                style={{ background: FIGMA.pillBg, borderColor: FIGMA.border }}
                            >
                                <Mail className="h-5 w-5 shrink-0" style={{ color: "#3b82f6" }} />
                                Send Email
                            </button>
                        </div>
                    </CardShell>

                    <CardShell>
                        <SectionHeader
                            title="Company"
                            actionLabel="Edit"
                            onAction={hasCompany ? onEditCompany : onAddCompany}
                            actionColor={FIGMA.accent}
                        />
                        {hasCompany && company ? (
                            <div className="space-y-1 text-xs text-white">
                                <p>{company.name}</p>
                                {company.location && company.location !== "N/A" ? (
                                    <div className="flex items-center gap-2.5 py-1">
                                        <MapPin className="h-3 w-3 shrink-0" />
                                        <span className="text-[10px]">{company.location}</span>
                                    </div>
                                ) : null}
                                {company.industry && company.industry !== "N/A" ? (
                                    <div className="flex items-center gap-2.5 py-1">
                                        <Tag className="h-3 w-3 shrink-0" />
                                        <span className="text-[10px]">{company.industry}</span>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <p className="text-xs" style={{ color: FIGMA.textMuted }}>
                                No company linked
                            </p>
                        )}
                    </CardShell>

                    <CardShell>
                        <SectionHeader
                            title="Documents"
                            actionLabel="Add"
                            onAction={onAttachFile}
                            actionColor={FIGMA.accent}
                        />
                        {Array.isArray(lead?.documents) && lead.documents.length > 0 ? (
                            <div className="space-y-3">
                                {lead.documents.map((file: any, index: number) => (
                                    <div key={index} className="flex items-center gap-2 text-xs">
                                        <FileText className="h-3.5 w-3.5 shrink-0" style={{ color: FIGMA.textSecondary }} />
                                        <span className="min-w-0 flex-1 truncate text-white">
                                            {file.docName || file.name || file.fileName}
                                        </span>
                                        <button
                                            type="button"
                                            className="cursor-pointer"
                                            onClick={() =>
                                                window.open(file.docLink || file.url, "_blank")
                                            }
                                        >
                                            <Download className="h-3.5 w-3.5" style={{ color: FIGMA.textSecondary }} />
                                        </button>
                                        <button
                                            type="button"
                                            className="cursor-pointer"
                                            onClick={() =>
                                                onDeleteDocument(file._id || file.documentId)
                                            }
                                        >
                                            <Trash2 className="h-3.5 w-3.5" style={{ color: FIGMA.red }} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs" style={{ color: FIGMA.textMuted }}>
                                No documents
                            </p>
                        )}
                    </CardShell>
                </aside>
            </div>
        </div>
    );
}

export { formatDueLabel };

"use client";

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTaskroomWorkspacetore, Room } from "@/store/taskroom/taskroomWorkspace";
import { Loader2, Plus, ImagePlus, X, GripVertical, Trash2, ChevronLeft, Check, LayoutTemplate, PenLine } from "lucide-react";
import { Switch } from "@/components/ui/switch";


import { useTemplateStore, Stage } from "@/store/taskroom/templateStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Cookies from "js-cookie";

const API_URL = "https://uatapi.garage.app";

const STAGE_TYPES = [
    { key: "tostart", label: "Not started", color: "#64748b" },
    { key: "active", label: "Active", color: "#3b82f6" },
    { key: "done", label: "Done", color: "#10b981" },
    { key: "closed", label: "Closed", color: "#ef4444" },
];

const PRESET_COLORS = [
    "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b",
    "#ef4444", "#ec4899", "#06b6d4", "#84cc16",
    "#f97316", "#6366f1", "#14b8a6", "#a855f7",
];

interface CreateRoomDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    spaceId?: string;
    room?: Room | null;
    onSuccess?: (spaceId: string) => void;
}

// ── Tiny step dots ─────────────────────────────────────────────────────────────
function Steps({ current, total }: { current: number; total: number }) {
    return (
        <div className="flex items-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
                <div
                    key={i}
                    className={cn(
                        "rounded-full transition-all duration-200",
                        i + 1 === current
                            ? "w-4 h-1.5 bg-white/70"
                            : i + 1 < current
                                ? "w-1.5 h-1.5 bg-white/40"
                                : "w-1.5 h-1.5 bg-white/10"
                    )}
                />
            ))}
        </div>
    );
}

export function CreateRoomDialog({ open, onOpenChange, spaceId, room, onSuccess }: CreateRoomDialogProps) {
    const [step, setStep] = useState(1);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [bgImage, setBgImage] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const [isDefault, setIsDefault] = useState(false);
    const [createCustomTemplate, setCreateCustomTemplate] = useState(false);
    /** null = pick path; existing = use saved template; custom = build new */
    const [templateMode, setTemplateMode] = useState<"existing" | "custom" | null>(null);
    const [selectedUsers] = useState<{ _id: string; name: string; email: string; role: string }[]>([]);
    const [roomMembers, setRoomMembers] = useState<any[]>([]);
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [iconPreview, setIconPreview] = useState("");
    const [isUploadingIcon, setIsUploadingIcon] = useState(false);
    const iconInputRef = useRef<HTMLInputElement>(null);

    // Stage editor state
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState("");
    const [editingColor, setEditingColor] = useState("");
    const [addingStageType, setAddingStageType] = useState<string | null>(null);
    const [newStageName, setNewStageName] = useState("");
    const [newStageColor, setNewStageColor] = useState("#3b82f6");
    const [draggedStage, setDraggedStage] = useState<number | null>(null);
    const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

    const router = useRouter();
    const { currentWorkspace } = useTaskroomWorkspacetore();
    const searchParams = useSearchParams();
    const workspaceId = searchParams.get("shareTask") ? searchParams.get("workspaceId") : currentWorkspace?._id;
    const { createRoom, updateRoom, isRoomLoading: isLoading } = useTaskroomWorkspacetore();
    const {
        isOpenTempate,
        setIsOpenTempate,
        selectedTemplate,
        setSelectedTemplate,
        template,
        setTemplate,
        templates,
        fetchTemplates,
        addStageTemplate,
        setNewTemplate,
        currentRoom,
        isLoading: savingTemplate,
        pendingRoomCreationData,
        setPendingRoomCreationData,
    } = useTemplateStore();

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    // Derived
    const filledGroups = STAGE_TYPES.filter(({ key }) =>
        (template?.stagelist || []).some((s) => s.stageType === key)
    ).length;
    const allFilled = filledGroups === STAGE_TYPES.length;

    const isExistingMode = templateMode === "existing";
    const isCustomMode = templateMode === "custom";
    const hasSavedTemplate = Boolean(selectedTemplate && selectedTemplate !== "custom" && selectedTemplate !== "");
    const canEdit = isCustomMode && !hasSavedTemplate;
    const canCreateWithTemplate =
        hasSavedTemplate && allFilled && selectedTemplate !== "custom" && selectedTemplate !== "";

    const groupedStages = STAGE_TYPES.map((t) => ({
        ...t,
        stages: (template?.stagelist || [])
            .filter((s) => s.stageType === t.key)
            .sort((a, b) => a.orderId - b.orderId),
    }));

    // ── Icon ─────────────────────────────────────────────────────────────────
    const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) { toast.error("Images only"); return; }
        setIconFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setIconPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const uploadIconToS3 = async (file: File): Promise<string> => {
        const token = localStorage.getItem("garage_tok");
        if (!token) throw new Error("Auth token missing");
        const fd = new FormData();
        fd.append("files", file);
        fd.append("folder", "room-icons");
        const res = await fetch(`${API_URL}/api/s3upload/multiple`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const json = await res.json();
        if (!json.success || !json.data?.[0]?.url) throw new Error("Invalid S3 response");
        return json.data[0].url as string;
    };

    const removeIcon = () => {
        setIconFile(null);
        setIconPreview("");
        setBgImage("");
        if (iconInputRef.current) iconInputRef.current.value = "";
    };

    // ── Stage helpers ─────────────────────────────────────────────────────────
    const addStage = (stageType: string) => {
        if (!newStageName.trim() || !template) return;
        const count = template.stagelist.filter((s) => s.stageType === stageType).length + 1;
        const stage: Stage = { name: newStageName, color: newStageColor, stageType: stageType as any, orderId: count };
        setTemplate({ ...template, stagelist: [...template.stagelist, stage] });
        setNewStageName("");
        setNewStageColor("#3b82f6");
        setAddingStageType(null);
    };

    const saveEdit = (index: number) => {
        if (!editingValue.trim() || !template) return;
        const list = [...template.stagelist];
        list[index] = { ...list[index], name: editingValue, color: editingColor };
        setTemplate({ ...template, stagelist: list });
        setEditingIndex(null);
    };

    const deleteStage = (index: number) => {
        if (!template) return;
        setTemplate({ ...template, stagelist: template.stagelist.filter((_, i) => i !== index) });
    };

    const handleDragStart = (e: React.DragEvent, i: number) => {
        setDraggedStage(i);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(i));
    };

    const handleDragEnd = () => {
        setDraggedStage(null);
        setDragOverGroup(null);
    };

    /** Move a stage within a group or into another group (before target, or end if beforeIndex is null). */
    const moveStageToGroup = (fromIndex: number, toStageType: string, beforeGlobalIndex: number | null) => {
        if (!template) return;
        const dragged = template.stagelist[fromIndex];
        if (!dragged) return;

        const remaining = template.stagelist.filter((_, i) => i !== fromIndex);
        const moved: Stage = {
            ...dragged,
            stageType: toStageType as Stage["stageType"],
        };

        const targetGroupOrdered = remaining
            .filter((s) => s.stageType === toStageType)
            .sort((a, b) => a.orderId - b.orderId);

        let insertAt = targetGroupOrdered.length;
        if (beforeGlobalIndex !== null) {
            const beforeStage = template.stagelist[beforeGlobalIndex];
            if (beforeStage && beforeGlobalIndex !== fromIndex) {
                const at = targetGroupOrdered.indexOf(beforeStage);
                if (at >= 0) insertAt = at;
            }
        }

        targetGroupOrdered.splice(insertAt, 0, moved);

        const reorderedTarget = targetGroupOrdered.map((s, idx) => ({
            ...s,
            stageType: toStageType as Stage["stageType"],
            orderId: idx + 1,
        }));

        const otherStages = remaining
            .filter((s) => s.stageType !== toStageType)
            .map((s) => ({ ...s }));

        // Keep stable orderIds within other types
        const counts: Record<string, number> = {};
        for (const s of otherStages) {
            counts[s.stageType] = (counts[s.stageType] || 0) + 1;
            s.orderId = counts[s.stageType];
        }

        setTemplate({ ...template, stagelist: [...otherStages, ...reorderedTarget] });
    };

    const handleDropOnStage = (e: React.DragEvent, targetIndex: number, stageType: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedStage === null || !template) {
            handleDragEnd();
            return;
        }
        if (draggedStage === targetIndex && template.stagelist[draggedStage]?.stageType === stageType) {
            handleDragEnd();
            return;
        }
        moveStageToGroup(draggedStage, stageType, targetIndex);
        handleDragEnd();
    };

    const handleDropOnGroup = (e: React.DragEvent, stageType: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedStage === null || !template) {
            handleDragEnd();
            return;
        }
        // Append to end of this group
        moveStageToGroup(draggedStage, stageType, null);
        handleDragEnd();
    };
    // ── Submit ────────────────────────────────────────────────────────────────
    const executeSubmit = async (finalBgImage: string) => {
        let success = false;
        if (room) {
            success = await updateRoom(room._id, { name, description, bgImage: finalBgImage, isPrivate, members: selectedUsers, setDefault: isDefault, color: room.color ?? "" });
        } else if (spaceId) {
            if (createCustomTemplate) {
                setPendingRoomCreationData({ data: { name, description, spaceId, bgImage: finalBgImage, isPrivate, members: selectedUsers, setDefault: isDefault, color: "" }, workspaceId });
                setStep(3);
                setTemplateMode(null);
                setIsOpenTempate(true);
                setNewTemplate();
                return;
            }
            success = await createRoom({ name, description, spaceId, bgImage: finalBgImage, isPrivate, members: selectedUsers, setDefault: isDefault, color: "" }, workspaceId, router);
        }
        if (success) {
            const sid = room?.spaceId || spaceId;
            if (sid) onSuccess?.(sid);
            onOpenChange(false);
            setStep(1);
        }
    };

    const handleApplyChanges = async () => {
        if (!canCreateWithTemplate) {
            toast.error(isCustomMode && !hasSavedTemplate ? "Save your template first" : "Select a template to continue");
            return;
        }
        if (pendingRoomCreationData) {
            const success = await createRoom({ ...pendingRoomCreationData.data, stageTemplateId: selectedTemplate }, pendingRoomCreationData.workspaceId, router);
            if (success) {
                onSuccess?.(pendingRoomCreationData.data.spaceId);
                setIsOpenTempate(false);
                setPendingRoomCreationData(null);
                setTemplateMode(null);
                onOpenChange(false);
                setStep(1);
            }
            return;
        }
        if (!currentRoom?.id) { toast.error("No room selected"); return; }
        try {
            const token = localStorage.getItem("garage_tok");
            const res = await axios.put(`${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/${currentRoom.id}`, { stageTemplateId: selectedTemplate }, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data?.status || res.data?.success) {
                toast.success("Changes applied");
                setIsOpenTempate(false);
                setTemplateMode(null);
                onOpenChange(false);
                setStep(1);
            }
            else toast.error(res.data?.message || "Failed");
        } catch (e: any) { toast.error(e.response?.data?.message || "Failed"); }
    };

    const handleNextStep = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        if (room) {
            let img = bgImage;
            if (iconFile) {
                setIsUploadingIcon(true);
                try { img = await uploadIconToS3(iconFile); setBgImage(img); }
                catch (err: any) { toast.error(err.message); setIsUploadingIcon(false); return; }
                finally { setIsUploadingIcon(false); }
            }
            await executeSubmit(img);
            return;
        }
        if (step === 1) { setStep(2); return; }
        if (step === 2) {
            let img = bgImage;
            if (iconFile) {
                setIsUploadingIcon(true);
                try { img = await uploadIconToS3(iconFile); setBgImage(img); }
                catch (err: any) { toast.error(err.message); setIsUploadingIcon(false); return; }
                finally { setIsUploadingIcon(false); }
            }
            await executeSubmit(img);
        }
    };

    const resetStageEditor = () => {
        setEditingIndex(null);
        setEditingValue("");
        setEditingColor("");
        setAddingStageType(null);
        setNewStageName("");
        setNewStageColor("#3b82f6");
        setDraggedStage(null);
        setDragOverGroup(null);
    };

    const goToTemplateChoice = () => {
        resetStageEditor();
        setTemplateMode(null);
        setNewTemplate();
    };

    const chooseExistingTemplate = () => {
        resetStageEditor();
        setTemplateMode("existing");
        setTemplate({ name: "", color: "#3b82f6", stagelist: [], type: "inherit" });
        // Clear selection without loading a template (empty id is not in list)
        useTemplateStore.setState({ selectedTemplate: "" });
    };

    const chooseCustomTemplate = () => {
        resetStageEditor();
        setTemplateMode("custom");
        setNewTemplate();
    };

    // ── Reset on open ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isOpenTempate) {
            resetStageEditor();
            setPendingRoomCreationData(null);
            setTemplateMode(null);
        }
    }, [isOpenTempate, setPendingRoomCreationData]);

    useEffect(() => {
        if (open && !room) {
            setName(""); setDescription(""); setBgImage(""); setIconPreview("");
            setIconFile(null); setIsPrivate(false); setIsDefault(false);
            setCreateCustomTemplate(false); setRoomMembers([]); setStep(1);
            setTemplateMode(null);
        }
    }, [open]);

    useEffect(() => {
        if (open && spaceId && room) {
            setName(room.name);
            setDescription(room.description || "");
            setBgImage(room.bgImage || "");
            setIconPreview(room.bgImage || "");
            setIsPrivate(Boolean(room.isPrivate) ?? false);
            setIsDefault(Boolean(room.setDefault) || false);
        }
    }, [open, spaceId, room]);

    const isBusy = isLoading || isUploadingIcon;
    const totalSteps = createCustomTemplate ? 3 : 2;

    const handleClose = (val: boolean) => {
        if (!val) {
            onOpenChange(false);
            setIsOpenTempate(false);
            setStep(1);
            setTemplateMode(null);
        }
    };

    const handleTemplateBack = () => {
        if (templateMode !== null) {
            goToTemplateChoice();
            return;
        }
        if (pendingRoomCreationData) {
            setIsOpenTempate(false);
            setStep(2);
            onOpenChange(true);
            return;
        }
        setIsOpenTempate(false);
        onOpenChange(false);
    };

    // ── Shared dialog styles ──────────────────────────────────────────────────
    const dialogClass = "bg-[#161616] border border-white/[0.06] text-white p-0 overflow-hidden rounded-2xl shadow-2xl";
    const templateDialogClass = cn(
        dialogClass,
        "!flex flex-col w-[calc(100%-1rem)] !max-w-[750px] max-h-[90dvh] overflow-hidden",
        "max-sm:!fixed max-sm:!inset-x-2 max-sm:!top-2 max-sm:!bottom-2 max-sm:!left-2 max-sm:!right-2",
        "max-sm:!h-[calc(100dvh-16px)] max-sm:!max-h-[calc(100dvh-16px)] max-sm:!w-auto",
        "max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:rounded-xl"
    );

    return (
        <Dialog open={open || isOpenTempate} onOpenChange={handleClose}>

            {/* ═══ ROOM FORM (steps 1 & 2) ════════════════════════════════════ */}
            {!isOpenTempate && (
                <DialogContent className={cn("w-[calc(100%-1rem)] max-w-[480px] max-h-[90dvh] overflow-y-auto", dialogClass)}>

                    {/* Header */}
                    <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-0 sm:pb-0 ">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-[14px] font-semibold text-white tracking-tight">
                                    {room ? "Edit Room" : "New room"}
                                </h2>
                                <p className="text-[12px] text-white/50 mt-1 leading-relaxed">
                                    {room
                                        ? "Update this room's name, icon, and settings."
                                        : step === 1
                                            ? "A Room is a project within your space where tasks, boards, and workflows are organized."
                                            : "Configure visibility and workflow options before creating the room."}
                                </p>
                            </div>
                            {/* {!room && <Steps current={step} total={totalSteps} />} */}
                        </div>
                    </div>

                    <form onSubmit={handleNextStep} className="px-4 sm:px-6 py-4 sm:py-5 pt-0 sm:pt-0 space-y-4 pt-0">

                        {/* ── Step 1 ───────────────────────────────────────── */}
                        {(step === 1 || room) && (
                            <>
                                {/* Name row */}
                                <div className="space-y-1.5">
                                    <Label className="text-[12px] text-white font-medium tracking-wide ">Name</Label>
                                    <div className="flex items-center gap-2">
                                        {/* Icon picker */}
                                        <div

                                            onClick={() => iconInputRef.current?.click()}
                                            className="flex-shrink-0 w-9 h-9 cursor-pointer rounded-lg border border-white/8 bg-white/[0.03] flex items-center justify-center overflow-hidden hover:border-white/20 transition-colors group"
                                        >
                                            {iconPreview
                                                ? <img src={iconPreview} alt="" className="w-full h-full object-cover" />
                                                : <ImagePlus className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
                                            }
                                        </div>
                                        <Input
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Room Name"
                                            required
                                            autoFocus
                                            className="h-9 text-[13px] bg-white/[0.03] border-white/8 text-white/80 placeholder:text-white/20 focus-visible:ring-0 focus-visible:border-white/20 rounded-lg shadow-none"
                                        />
                                        {iconPreview && (
                                            <button type="button" onClick={removeIcon} className="flex-shrink-0 text-white/20 hover:text-white/60 transition-colors">
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                        <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={handleIconSelect} />
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="space-y-1.5">
                                    <Label className="text-[12px] text-white font-medium tracking-wide ">
                                        Description <span className="text-white/20 normal-case font-normal tracking-normal">(optional)</span>
                                    </Label>
                                    <Textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="What's this room for?"
                                        className="min-h-[80px] text-[13px] bg-white/[0.03] border-white/8 text-white/70 placeholder:text-white/20 focus-visible:ring-0 focus-visible:border-white/20 rounded-lg shadow-none resize-none"
                                    />
                                </div>

                                {/* Visibility */}
                                <div className="flex items-center justify-between py-3 px-3.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                                    <div>
                                        <p className="text-[13px] text-white font-medium">Public Room</p>
                                        <p className="text-[12px] text-white/25 mt-0.5">All workspace members can access</p>
                                    </div>
                                    <Switch
                                        checked={!isPrivate}
                                        onCheckedChange={(v) => setIsPrivate(!v)}
                                        className="data-[state=checked]:bg-muted data-[state=unchecked]:bg-white/10"
                                    />
                                </div>

                                {/* Footer */}
                                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                                    <button type="button" onClick={() => { onOpenChange(false); setStep(1); }} className="cursor-pointer text-[13px] text-white/30 hover:text-white/60 transition-colors min-h-[36px]">
                                        Cancel
                                    </button>
                                    <Button
                                        type="submit"
                                        disabled={!name.trim() || isBusy}
                                        className="cursor-pointer h-9 sm:h-8 w-full sm:w-auto px-5 text-[13px] bg-muted hover:bg-muted text-black rounded-lg font-medium shadow-none"
                                    >
                                        {room ? (isBusy ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : "Save") : "Continue"}
                                    </Button>
                                </div>
                            </>
                        )}

                        {/* ── Step 2 ───────────────────────────────────────── */}
                        {step === 2 && !room && (
                            <>
                                {/* Custom template */}
                                <div className="flex items-center justify-between py-3 px-3.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                                    <div>
                                        <p className="text-[13px] text-white font-medium">Configure workflow</p>
                                        <p className="text-[12px] text-white/25 mt-0.5">Use an existing template or create your own</p>
                                    </div>
                                    <Switch
                                        checked={createCustomTemplate}
                                        onCheckedChange={setCreateCustomTemplate}
                                        className="data-[state=checked]:bg-muted data-[state=unchecked]:bg-white/10"
                                    />
                                </div>

                                {createCustomTemplate && (
                                    <p className="text-[12px] text-white/30 leading-relaxed px-0.5">
                                        Next you&apos;ll pick an existing template or build a custom one, then create the room.
                                    </p>
                                )}

                                {/* Footer */}
                                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                                    <button type="button" onClick={() => setStep(1)} className="cursor-pointer text-[13px] text-white/30 hover:text-white/60 transition-colors min-h-[36px]">
                                        ← Back
                                    </button>
                                    <Button
                                        type="submit"
                                        disabled={isBusy}
                                        className="cursor-pointer h-9 sm:h-8 w-full sm:w-auto px-5 text-[13px] bg-muted hover:bg-muted text-black rounded-lg font-medium shadow-none"
                                    >
                                        {isBusy
                                            ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Creating…</>
                                            : createCustomTemplate ? "Next: Stages" : "Create room"
                                        }
                                    </Button>
                                </div>
                            </>
                        )}
                    </form>
                </DialogContent>
            )}

            {/* ═══ TEMPLATE EDITOR ════════════════════════════════════════════ */}
            {isOpenTempate && (
                <DialogContent className={templateDialogClass}>

                    {/* Header */}
                    <div className="flex-shrink-0 px-3 sm:px-6 pt-3 sm:pt-5 pb-3 sm:pb-4 border-b border-white/[0.10] flex items-center justify-between bg-[#161616] z-10">
                        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                            <button
                                type="button"
                                onClick={handleTemplateBack}
                                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-colors touch-manipulation"
                                aria-label="Back"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <div className="min-w-0">
                                <h2 className="text-[13px] sm:text-[14px] font-semibold text-white/90 tracking-tight truncate">
                                    {currentRoom?.name || pendingRoomCreationData?.data?.name || "Room"}
                                </h2>
                                <p className="text-[11px] sm:text-[12px] text-white/30 mt-0.5">
                                    {templateMode === null
                                        ? "How do you want to set up stages?"
                                        : isExistingMode
                                            ? "Choose an existing template"
                                            : hasSavedTemplate
                                                ? "Template ready — create your room"
                                                : "Build your custom template"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ── Choice screen ───────────────────────────────────── */}
                    {templateMode === null && (
                        <div className="flex flex-1 flex-col justify-center gap-3 p-4 sm:p-8">
                            {/* <p className="text-[12px] text-white/35 text-center mb-1 sm:mb-2">
                                Pick one to continue. You can always go back.
                            </p> */}
                            <button
                                type="button"
                                onClick={chooseExistingTemplate}
                                className="group w-full text-left rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/15 p-4 sm:p-5 transition-colors"
                            >
                                <div className="flex items-start gap-3 sm:gap-4">
                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-white/50 group-hover:text-white/70">
                                        <LayoutTemplate className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[14px] font-medium text-white">Use existing template</p>
                                        <p className="text-[12px] text-white/35 mt-1 leading-relaxed">
                                            Select a saved workflow. Stages are view-only — create the room right away.
                                        </p>
                                    </div>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={chooseCustomTemplate}
                                className="group w-full text-left rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/15 p-4 sm:p-5 transition-colors"
                            >
                                <div className="flex items-start gap-3 sm:gap-4">
                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-white/50 group-hover:text-white/70">
                                        <PenLine className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[14px] font-medium text-white">Create custom template</p>
                                        <p className="text-[12px] text-white/35 mt-1 leading-relaxed">
                                            Name it, add stages for all four groups, save the template, then create the room.
                                        </p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}

                    {/* ── Existing / Custom editor ────────────────────────── */}
                    {templateMode !== null && (
                        <div className="flex min-h-0 flex-1 flex-col md:flex-row overflow-hidden">

                            {/* ── Left sidebar ─────────────────────────────────── */}
                            <div className="w-full md:w-56 lg:w-70 flex-shrink-0 border-b md:border-b-0 md:border-r border-white/[0.10] p-3 sm:p-5 space-y-3 sm:space-y-5 md:overflow-y-auto">

                                {/* Progress */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[12px] text-white font-medium">Stage Groups</span>
                                        <span className={cn("text-[12px] font-semibold", allFilled ? "text-emerald-400" : "text-white/30")}>
                                            {filledGroups}/4
                                        </span>
                                    </div>
                                    <div className="h-0.5 rounded-full bg-white/[0.06] overflow-hidden">
                                        <div
                                            className={cn("h-full rounded-full transition-all duration-300", allFilled ? "bg-emerald-500" : "bg-indigo-500")}
                                            style={{ width: `${(filledGroups / 4) * 100}%` }}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 pt-1 sm:flex sm:flex-col sm:space-y-1.5">
                                        {STAGE_TYPES.map(({ key, label, color }) => {
                                            const filled = (template?.stagelist || []).some((s) => s.stageType === key);
                                            return (
                                                <div key={key} className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                                    <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", filled ? "opacity-100" : "opacity-25")} style={{ backgroundColor: color }} />
                                                    <span className={cn("text-[11px] sm:text-[12px] truncate", filled ? "text-white" : "text-white/20")}>{label}</span>
                                                    {filled && <Check className="w-3 h-3 text-emerald-400 ml-auto flex-shrink-0" />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {isCustomMode && !hasSavedTemplate && !allFilled && (
                                        <p className="hidden sm:block text-[12px] text-white/20 leading-relaxed pt-1">
                                            Add at least one stage to each group, then save the template.
                                        </p>
                                    )}
                                    {isExistingMode && !hasSavedTemplate && (
                                        <p className="hidden sm:block text-[12px] text-white/20 leading-relaxed pt-1">
                                            Select a template to preview its stages.
                                        </p>
                                    )}
                                </div>

                                {/* Existing: template select only */}
                                {isExistingMode && (
                                    <div className="space-y-2 pt-3 border-t border-white/[0.05]">
                                        <span className="text-[12px] text-white font-medium tracking-wide">Select template</span>
                                        <Select
                                            value={hasSavedTemplate ? selectedTemplate : undefined}
                                            onValueChange={(v) => setSelectedTemplate(v)}
                                        >
                                            <SelectTrigger className="w-full h-8 bg-white/[0.03] border-white/[0.08] rounded-lg text-[12px] focus:ring-0 focus:border-white/20">
                                                <SelectValue placeholder="Choose a template…" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-[#16161f] border-white/10 text-white/60 z-[1200] max-h-[min(240px,50dvh)]">
                                                {templates.filter((t) => t._id).length === 0 ? (
                                                    <div className="px-3 py-2 text-[12px] text-white/30">No templates yet</div>
                                                ) : (
                                                    templates.filter((t) => t._id).map((t) => (
                                                        <SelectItem key={t._id} value={t._id!} className="text-white/60 text-[12px]">{t.name}</SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                        {templates.filter((t) => t._id).length === 0 && (
                                            <button
                                                type="button"
                                                onClick={chooseCustomTemplate}
                                                className="text-[12px] text-white/40 hover:text-white/70 transition-colors"
                                            >
                                                Create a custom template instead →
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Custom: name only (no select); hidden after save becomes view label */}
                                {isCustomMode && (
                                    <div className="space-y-2 pt-3 border-t border-white/[0.05]">
                                        <span className="text-[12px] text-white font-medium">Template name</span>
                                        {hasSavedTemplate ? (
                                            <p className="text-[13px] text-white/70 px-0.5 truncate">{template?.name}</p>
                                        ) : (
                                            <Input
                                                value={template?.name || ""}
                                                onChange={(e) => template && setTemplate({ ...template, name: e.target.value })}
                                                placeholder="e.g. Sprint board"
                                                style={{ fontSize: "12px" }}
                                                className="h-8 text-[12px] !placeholder:text-[12px] bg-white/[0.03] border-white/[0.08] text-white/60 rounded-lg focus-visible:ring-0 focus-visible:border-white/20"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ── Stage groups ────────────────────────────────── */}
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                                <div className="flex-1 space-y-4 sm:space-y-5 overflow-y-auto overscroll-contain p-3 sm:p-6 pt-2 sm:pt-0 pb-2">
                                    {isExistingMode && !hasSavedTemplate ? (
                                        <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center px-4">
                                            <LayoutTemplate className="w-8 h-8 text-white/15 mb-3" />
                                            <p className="text-[13px] text-white/40">No template selected</p>
                                            <p className="text-[12px] text-white/25 mt-1 max-w-[240px]">
                                                Choose one from the list to preview stages, then create the room.
                                            </p>
                                        </div>
                                    ) : (
                                        groupedStages.map((group) => {
                                            const filled = group.stages.length > 0;
                                            const isDragOver = canEdit && dragOverGroup === group.key && draggedStage !== null;
                                            return (
                                                <div
                                                    key={group.key}
                                                    onDragOver={canEdit ? (e) => {
                                                        e.preventDefault();
                                                        setDragOverGroup(group.key);
                                                    } : undefined}
                                                    onDragLeave={canEdit ? (e) => {
                                                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                                            setDragOverGroup((g) => (g === group.key ? null : g));
                                                        }
                                                    } : undefined}
                                                    onDrop={canEdit ? (e) => handleDropOnGroup(e, group.key) : undefined}
                                                    className={cn(
                                                        "rounded-lg transition-colors",
                                                        isDragOver && "bg-white/[0.03] ring-1 ring-inset ring-white/10"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                                                            <span className="text-[12px] font-medium text-white">{group.label}</span>
                                                            {!filled && canEdit && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: `${group.color}18`, color: group.color }}>
                                                                    required
                                                                </span>
                                                            )}
                                                            {canEdit && draggedStage !== null && (
                                                                <span className="text-[10px] text-white/25">Drop here to move</span>
                                                            )}
                                                        </div>
                                                        {canEdit && (
                                                            <button
                                                                type="button"
                                                                onClick={() => { setAddingStageType(addingStageType === group.key ? null : group.key); setNewStageName(""); setNewStageColor(group.color); }}
                                                                className="flex h-8 w-8 sm:h-6 sm:w-6 items-center justify-center rounded-md text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition-colors touch-manipulation"
                                                                aria-label={`Add stage to ${group.label}`}
                                                            >
                                                                <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        {group.stages.map((stage, idx) => {
                                                            const stageIndex = template?.stagelist.indexOf(stage) ?? -1;
                                                            const isEditing = canEdit && editingIndex === stageIndex;
                                                            return (
                                                                <div
                                                                    key={`${group.key}-${stage.orderId}-${stage.name}-${idx}`}
                                                                    draggable={canEdit && !isEditing}
                                                                    onDragStart={canEdit ? (e) => handleDragStart(e, stageIndex) : undefined}
                                                                    onDragEnd={canEdit ? handleDragEnd : undefined}
                                                                    onDragOver={canEdit ? (e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        setDragOverGroup(group.key);
                                                                    } : undefined}
                                                                    onDrop={canEdit ? (e) => handleDropOnStage(e, stageIndex, group.key) : undefined}
                                                                    className={cn(
                                                                        "flex items-center gap-2 px-2.5 sm:px-3 py-2.5 sm:py-2 rounded-lg border transition-all group",
                                                                        draggedStage === stageIndex
                                                                            ? "opacity-30 bg-white/[0.02] border-white/[0.04]"
                                                                            : "bg-white/[0.02] border-white/[0.04]",
                                                                        canEdit && "hover:border-white/10 cursor-grab active:cursor-grabbing"
                                                                    )}
                                                                >
                                                                    {canEdit && (
                                                                        <GripVertical className="hidden sm:block w-3.5 h-3.5 text-white/10 flex-shrink-0 cursor-grab" />
                                                                    )}

                                                                    {isEditing ? (
                                                                        <div
                                                                            className="w-5 h-5 rounded-md flex-shrink-0 cursor-pointer border border-white/10"
                                                                            style={{ backgroundColor: editingColor }}
                                                                            onClick={() => document.getElementById(`ec-${stageIndex}`)?.click()}
                                                                        >
                                                                            <input type="color" id={`ec-${stageIndex}`} value={editingColor} onChange={(e) => setEditingColor(e.target.value)} className="sr-only" />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                                                                    )}

                                                                    {isEditing ? (
                                                                        <input
                                                                            autoFocus
                                                                            type="text"
                                                                            value={editingValue}
                                                                            onChange={(e) => setEditingValue(e.target.value)}
                                                                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(stageIndex); if (e.key === "Escape") { setEditingIndex(null); } }}
                                                                            className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 text-[12px] text-white/80 outline-none focus:border-white/[0.04]"
                                                                        />
                                                                    ) : (
                                                                        <span className="flex-1 text-[13px] text-white/60 truncate">{stage.name}</span>
                                                                    )}

                                                                    {canEdit && (
                                                                        isEditing ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => saveEdit(stageIndex)}
                                                                                disabled={!editingValue.trim()}
                                                                                className="flex-shrink-0 text-[12px] px-2.5 py-1 rounded-md font-medium text-white disabled:opacity-30"
                                                                                style={{ backgroundColor: editingColor }}
                                                                            >
                                                                                Save
                                                                            </button>
                                                                        ) : (
                                                                            <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => { setEditingIndex(stageIndex); setEditingValue(stage.name); setEditingColor(stage.color); }}
                                                                                    className="flex h-8 w-8 sm:h-6 sm:w-6 items-center justify-center rounded-md text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition-colors touch-manipulation"
                                                                                    aria-label="Edit stage"
                                                                                >
                                                                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                                    </svg>
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => deleteStage(stageIndex)}
                                                                                    className="flex h-8 w-8 sm:h-6 sm:w-6 items-center justify-center rounded-md text-white/25 hover:text-red-400 hover:bg-red-400/10 transition-colors touch-manipulation"
                                                                                    aria-label="Delete stage"
                                                                                >
                                                                                    <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                                                                </button>
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            );
                                                        })}

                                                        {canEdit && (
                                                            addingStageType === group.key ? (
                                                                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                                                                    <div className="flex items-center gap-2 p-3">
                                                                        <div
                                                                            className="w-5 h-5 rounded-md flex-shrink-0 cursor-pointer border border-white/10"
                                                                            style={{ backgroundColor: newStageColor }}
                                                                            onClick={() => document.getElementById(`nc-${group.key}`)?.click()}
                                                                        >
                                                                            <input type="color" id={`nc-${group.key}`} value={newStageColor} onChange={(e) => setNewStageColor(e.target.value)} className="sr-only" />
                                                                        </div>
                                                                        <input
                                                                            autoFocus
                                                                            type="text"
                                                                            value={newStageName}
                                                                            onChange={(e) => setNewStageName(e.target.value)}
                                                                            placeholder="Stage Name"
                                                                            onKeyDown={(e) => { if (e.key === "Enter") addStage(group.key); if (e.key === "Escape") { setAddingStageType(null); setNewStageName(""); } }}
                                                                            className="flex-1 min-w-0 bg-transparent text-[12px] placeholder:text-[12px] text-white/50 placeholder:text-white/20 outline-none"
                                                                        />
                                                                    </div>

                                                                    <div className="px-3 pb-3 flex items-center gap-1.5 flex-wrap">
                                                                        {PRESET_COLORS.map((c) => (
                                                                            <button
                                                                                key={c}
                                                                                type="button"
                                                                                onClick={() => setNewStageColor(c)}
                                                                                className="w-4 h-4 rounded-full transition-transform hover:scale-110"
                                                                                style={{
                                                                                    backgroundColor: c,
                                                                                    outline: newStageColor === c ? `2px solid ${c}` : "none",
                                                                                    outlineOffset: "2px",
                                                                                }}
                                                                            />
                                                                        ))}
                                                                    </div>

                                                                    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 px-3 py-2.5 sm:py-2 border-t border-white/[0.05]">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => { setAddingStageType(null); setNewStageName(""); }}
                                                                            className="text-[12px] text-white/30 hover:text-white/60 transition-colors min-h-[36px] sm:min-h-0"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => addStage(group.key)}
                                                                            disabled={!newStageName.trim()}
                                                                            className="text-[12px] px-3 py-2 sm:py-1 rounded-md font-medium text-white disabled:opacity-30 transition-opacity min-h-[36px] sm:min-h-0"
                                                                            style={{ backgroundColor: newStageColor }}
                                                                        >
                                                                            Add
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                !filled && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { setAddingStageType(group.key); setNewStageName(""); setNewStageColor(group.color); }}
                                                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverGroup(group.key); }}
                                                                        onDrop={(e) => handleDropOnGroup(e, group.key)}
                                                                        className={cn(
                                                                            "w-full min-h-[44px] py-2.5 rounded-lg border border-dashed text-[12px] flex items-center justify-center gap-1.5 transition-colors touch-manipulation",
                                                                            isDragOver && "bg-white/[0.04]"
                                                                        )}
                                                                        style={{
                                                                            borderColor: isDragOver ? group.color : `${group.color}30`,
                                                                            color: `${group.color}80`,
                                                                        }}
                                                                    >
                                                                        <Plus className="w-3.5 h-3.5" />
                                                                        {draggedStage !== null ? "Drop stage here" : "Add a stage"}
                                                                    </button>
                                                                )
                                                            )
                                                        )}

                                                        {/* End-of-group drop zone while dragging */}
                                                        {canEdit && filled && draggedStage !== null && (
                                                            <div
                                                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverGroup(group.key); }}
                                                                onDrop={(e) => handleDropOnGroup(e, group.key)}
                                                                className={cn(
                                                                    "min-h-[28px] rounded-lg border border-dashed text-[11px] flex items-center justify-center transition-colors",
                                                                    isDragOver
                                                                        ? "border-white/25 text-white/40 bg-white/[0.03]"
                                                                        : "border-white/[0.08] text-white/20"
                                                                )}
                                                            >
                                                                Drop at end
                                                            </div>
                                                        )}

                                                        {!canEdit && !filled && (
                                                            <p className="text-[12px] text-white/20 py-2 px-1">No stages in this group</p>
                                                        )}
                                                    </div>

                                                    <div className="h-px bg-white/[0.04] mt-5" />
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Sticky Footer */}
                                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 border-t border-white/[0.06] flex-shrink-0 bg-[#161616]">
                                    <div className="flex justify-center sm:justify-start">
                                        {isCustomMode && !hasSavedTemplate && (
                                            <button
                                                type="button"
                                                onClick={addStageTemplate}
                                                disabled={savingTemplate || !allFilled || !template?.name?.trim()}
                                                className="text-[12px] text-white/30 hover:text-white/60 disabled:opacity-30 disabled:hover:text-white/30 transition-colors flex items-center gap-1.5 min-h-[36px]"
                                            >
                                                {savingTemplate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                                Save template
                                            </button>
                                        )}
                                        {isCustomMode && hasSavedTemplate && (
                                            <span className="text-[12px] text-emerald-400/80 flex items-center gap-1.5 min-h-[36px]">
                                                <Check className="w-3.5 h-3.5" />
                                                Template saved
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                                        {isCustomMode && !hasSavedTemplate && !allFilled && (
                                            <span className="text-[12px] text-white/25 text-center sm:text-left">
                                                {4 - filledGroups} group{4 - filledGroups !== 1 ? "s" : ""} remaining
                                            </span>
                                        )}
                                        {isCustomMode && !hasSavedTemplate && allFilled && (
                                            <span className="text-[12px] text-white/25 text-center sm:text-left">
                                                Save the template to continue
                                            </span>
                                        )}
                                        <Button
                                            type="button"
                                            onClick={handleApplyChanges}
                                            disabled={savingTemplate || isLoading || !canCreateWithTemplate}
                                            className="h-9 sm:h-8 w-full sm:w-auto px-5 text-[13px] bg-muted text-black cursor-pointer rounded-lg font-medium shadow-none disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            {(savingTemplate || isLoading) && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                                            {pendingRoomCreationData ? "Create Room" : "Apply Changes"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            )}
        </Dialog>
    );
}
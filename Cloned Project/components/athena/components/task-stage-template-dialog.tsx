'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Cookies from 'js-cookie';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Trash2, GripVertical, MoreHorizontal } from 'lucide-react';

import { useTemplateStore, StageTemplate, Stage } from '@/store/taskroom/templateStore';
import { useTaskroomWorkspacetore } from '@/store/taskroom/taskroomWorkspace';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode'
interface JwtPayload {
    // Adjust these fields according to YOUR actual JWT payload
    sub?: string        // user id
    name?: string
    email?: string
    role?: string
    exp?: number
    orgId?: string
    iat?: number
    userId?: string
    // ... add any custom claims like garageId, permissions, etc.
    [key: string]: any
}
const STAGE_TYPES = [
    { key: 'tostart', label: 'Not started', color: 'bg-gray-100' },
    { key: 'active', label: 'Active', color: 'bg-blue-50' },
    { key: 'done', label: 'Done', color: 'bg-green-50' },
    { key: 'closed', label: 'Closed', color: 'bg-red-50' },
];

const STAGE_TYPE_COLORS = {
    tostart: '#64748b',
    active: '#3b82f6',
    done: '#10b981',
    closed: '#ef4444',
};

const PRESET_COLORS = [
    "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b",
    "#ef4444", "#ec4899", "#06b6d4", "#84cc16",
    "#f97316", "#6366f1", "#14b8a6", "#a855f7",
];

export function TaskStageTemplateDialog() {
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
        setPendingRoomCreationData
    } = useTemplateStore();

    const { createRoom } = useTaskroomWorkspacetore();
    const router = useRouter();

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleTemplateChange = (templateId: string) => {
        if (templateId === 'add-new') {
            setNewTemplate();
        } else {
            setSelectedTemplate(templateId);
        }
    };

    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState('');
    const [editingColor, setEditingColor] = useState('');
    const [addingStageType, setAddingStageType] = useState<string | null>(null);
    const [newStageName, setNewStageName] = useState('');
    const [newStageColor, setNewStageColor] = useState('#3b82f6');
    const [draggedStage, setDraggedStage] = useState<number | null>(null);

    useEffect(() => {
        if (!isOpenTempate) {
            setEditingIndex(null);
            setEditingValue('');
            setEditingColor('');
            setAddingStageType(null);
            setNewStageName('');
            setNewStageColor('#3b82f6');
            setDraggedStage(null);
            setPendingRoomCreationData(null);
        }
    }, [isOpenTempate, setPendingRoomCreationData]);


    // Check if user is owner of the template
    const userData = localStorage.getItem("garage_tok")

    // const userCookie = const userData = localStorage.getItem("garage_tok");
    const payload = jwtDecode<JwtPayload>(userData)

    // const currentUser = userCookie ? JSON.parse(userCookie) : null;
    const currentUserId = payload?.userId;

    // If it's from templates array, check userId
    // 'custom' means it's a new template being created, so owner is true
    const isOwner = selectedTemplate === 'custom' || (template?.userId ? template.userId === currentUserId : true);
    const canEdit = isOwner;

    // Group stages by stageType
    const groupedStages = STAGE_TYPES.map((stageType) => ({
        ...stageType,
        stages: (template?.stagelist || [])
            .filter((s) => s.stageType === stageType.key)
            .sort((a, b) => a.orderId - b.orderId),
    }));

    // Add new stage to a group
    const addStage = (stageType: string) => {
        if (!newStageName.trim() || !template) return;

        const existingCount =
            template.stagelist.filter((s) => s.stageType === stageType).length + 1;
        const newStage: Stage = {
            name: newStageName,
            color: newStageColor,
            stageType: stageType as any,
            orderId: existingCount,
        };
        setTemplate({
            ...template,
            stagelist: [...template.stagelist, newStage],
        });

        // Reset
        setNewStageName('');
        setNewStageColor('#3b82f6');
        setAddingStageType(null);
    };

    // Start editing a stage
    const startEdit = (index: number) => {
        if (!template) return;
        setEditingIndex(index);
        setEditingValue(template.stagelist[index].name);
        setEditingColor(template.stagelist[index].color);
    };

    // Save edited stage
    const saveEdit = (index: number) => {
        if (editingValue.trim() && template) {
            const newStagelist = [...template.stagelist];
            newStagelist[index].name = editingValue;
            newStagelist[index].color = editingColor;
            setTemplate({ ...template, stagelist: newStagelist });
            setEditingIndex(null);
            setEditingValue('');
            setEditingColor('');
        }
    };

    // Handle drag and drop within stage type
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedStage(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number, stageType: string) => {
        e.preventDefault();

        if (draggedStage === null || draggedStage === targetIndex || !template) {
            setDraggedStage(null);
            return;
        }

        const draggedItem = template.stagelist[draggedStage];

        // Only allow reordering within same stageType
        if (draggedItem.stageType !== stageType) {
            setDraggedStage(null);
            return;
        }

        const newStagelist = [...template.stagelist];
        newStagelist.splice(draggedStage, 1);
        newStagelist.splice(targetIndex, 0, draggedItem);

        // Recalculate orderIds for affected stageType
        const updatedList = newStagelist.map((stage, idx) => {
            const sameTypeCount = newStagelist
                .slice(0, idx)
                .filter((s) => s.stageType === stage.stageType).length + 1;

            if (stage.stageType === stageType) {
                return { ...stage, orderId: sameTypeCount };
            }
            return stage;
        });

        setTemplate({ ...template, stagelist: updatedList });
        setDraggedStage(null);
    };

    // Delete a stage
    const deleteStage = (index: number) => {
        if (!template) return;
        setTemplate({
            ...template,
            stagelist: template.stagelist.filter((_, i) => i !== index),
        });
    };

    // Save as template
    const handleSaveAsTemplate = () => {
        addStageTemplate();
    };

    // Apply changes
    const handleApplyChanges = async () => {
        if (pendingRoomCreationData) {
            const success = await createRoom(
                {
                    ...pendingRoomCreationData.data,
                    templateId: selectedTemplate
                },
                pendingRoomCreationData.workspaceId,
                router
            );
            if (success) {
                setIsOpenTempate(false);
                setPendingRoomCreationData(null);
            }
            return;
        }

        if (!currentRoom?.id) {
            toast.error("No room selected");
            return;
        }

        try {
            const token =localStorage.getItem("garage_tok");
            const response = await axios.put(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/${currentRoom.id}`,
                { templateId: selectedTemplate },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data?.status || response.data?.success) {
                toast.success("Changes applied successfully");
                setIsOpenTempate(false);
            } else {
                toast.error(response.data?.message || "Failed to apply changes");
            }
        } catch (error: any) {
            console.error("Failed to apply changes:", error);
            toast.error(error.response?.data?.message || "Failed to apply changes");
        }
    };
    console.log('selectedTemplate', handleTemplateChange)
    return (
        <Dialog open={isOpenTempate} onOpenChange={setIsOpenTempate}>
            <DialogTrigger asChild>
                <Button>Edit Project Statuses</Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit {currentRoom?.name || 'Project'}</DialogTitle>
                    <DialogDescription>Manage project statuses</DialogDescription>
                </DialogHeader>

                <div className="flex gap-6">
                    {/* Left Sidebar */}
                    <div className="w-56 space-y-6">
                        {/* Status Type */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                Status type
                                <span className="text-gray-400 cursor-help">ⓘ</span>
                            </label>
                            <div className="mt-3 space-y-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="radio" name="status-type" className="w-4 h-4" />
                                    <span className="text-sm text-gray-700">Inherit from Space</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="status-type"
                                        defaultChecked
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm text-gray-700">Use custom statuses</span>
                                </label>
                            </div>
                        </div>

                        {/* Status Template Dropdown */}
                        <div>
                            <label className="text-sm font-medium text-gray-700">Status template</label>
                            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                                <SelectTrigger className="mt-2 w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>

                                    {templates.filter(t => t._id).map((t) => (
                                        <SelectItem key={t._id} value={t._id!}>
                                            {t.name}
                                        </SelectItem>
                                    ))}
                                    <SelectItem value="add-new" className="font-bold text-blue-600">
                                        + Add New Template
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Template Details (Edit name/color) */}
                        {template && (
                            <div className="space-y-4 pt-2 border-t mt-4">
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Template Name</label>
                                    <Input
                                        value={template.name}
                                        onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                                        disabled={!canEdit}
                                        className="h-8 text-sm mt-1"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Accent Color</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <input
                                            type="color"
                                            value={template.color}
                                            onChange={(e) => setTemplate({ ...template, color: e.target.value })}
                                            disabled={!canEdit}
                                            className="w-8 h-8 rounded-md cursor-pointer border-none p-0 bg-transparent disabled:opacity-50"
                                        />
                                        <span className="text-xs text-gray-400 font-mono uppercase">{template.color}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Learn More Link */}
                        <button className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                            <span>ⓘ</span> Learn more about statuses
                        </button>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 space-y-6">
                        {/* Stage Groups */}
                        {groupedStages.map((group) => (
                            <div key={group.key} className="space-y-3">
                                {/* Group Header */}
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        {group.label}
                                        <span className="text-gray-400 cursor-help">ⓘ</span>
                                    </h3>
                                    <button
                                        onClick={() => {
                                            setAddingStageType(addingStageType === group.key ? null : group.key);
                                            setNewStageName('');
                                            setNewStageColor('#3b82f6');
                                        }}
                                        className="text-blue-600 hover:bg-blue-50 p-2 rounded transition"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Add Status Input */}
                                {addingStageType === group.key && (
                                    <div
                                        className="rounded-xl shadow-2xl border overflow-hidden mt-2"
                                        style={{
                                            backgroundColor: "rgba(18, 18, 26, 0.97)",
                                            borderColor: newStageColor,
                                            backdropFilter: "blur(20px)",
                                        }}
                                    >
                                        {/* Header */}
                                        <div className="px-3 py-2 flex items-center justify-between">
                                            <span className="text-xs font-semibold text-white/70 tracking-wide uppercase">Add Stage</span>
                                            <button
                                                onClick={() => { setAddingStageType(null); setNewStageName(''); setNewStageColor('#3b82f6'); }}
                                                className="w-5 h-5 flex items-center justify-center rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors text-base leading-none cursor-pointer"
                                            >
                                                ×
                                            </button>
                                        </div>

                                        <div className="px-3 pb-3 space-y-2.5">
                                            {/* Stage Name */}
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Stage Name</label>
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={newStageName}
                                                    onChange={(e) => setNewStageName(e.target.value)}
                                                    placeholder="Enter stage name..."
                                                    style={{ fontSize: "12px", marginTop: "2px" }}
                                                    className="w-full px-3 py-2 rounded-lg placeholder:text-xs text-xs text-white bg-white/5 border border-white/10 focus:outline-none focus:border-white/30 transition-all placeholder:text-white/20"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') addStage(group.key);
                                                        if (e.key === 'Escape') { setAddingStageType(null); setNewStageName(''); }
                                                    }}
                                                />
                                            </div>

                                            {/* Color Picker */}
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Stage Color</label>
                                                {/* Preset swatches */}
                                                <div className="grid grid-cols-12 gap-1.5">
                                                    {PRESET_COLORS.map((color) => (
                                                        <button
                                                            key={color}
                                                            onClick={() => setNewStageColor(color)}
                                                            className="w-4 h-4 rounded-lg transition-all duration-150 hover:scale-110 active:scale-95 flex items-center justify-center"
                                                            style={{
                                                                backgroundColor: color,
                                                                boxShadow: newStageColor === color
                                                                    ? `0 0 0 2px #12121a, 0 0 0 3.5px ${color}`
                                                                    : "none",
                                                            }}
                                                            title={color}
                                                        >
                                                            {newStageColor === color && (
                                                                <svg className="w-3 h-3 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                                    <polyline points="20 6 9 17 4 12" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                                {/* Custom color row */}
                                                <div
                                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer hover:border-white/20 transition-colors"
                                                    style={{ borderColor: `${newStageColor}60`, backgroundColor: "rgba(255,255,255,0.03)" }}
                                                    onClick={() => document.getElementById(`add-stage-color-picker-standalone-${group.key}`)?.click()}
                                                >
                                                    <div className="w-5 h-5 rounded-md flex-shrink-0 border border-white/20" style={{ backgroundColor: newStageColor }} />
                                                    <span className="text-xs text-white/50 flex-1">Custom color</span>
                                                    <span className="text-[11px] font-mono text-white/30">{newStageColor.toUpperCase()}</span>
                                                    <input
                                                        type="color"
                                                        id={`add-stage-color-picker-standalone-${group.key}`}
                                                        value={newStageColor}
                                                        onChange={(e) => setNewStageColor(e.target.value)}
                                                        className="sr-only"
                                                    />
                                                </div>
                                            </div>

                                            {/* Live Preview */}
                                            {newStageName.trim() && (
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Preview</label>
                                                    <div
                                                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md"
                                                        style={{ backgroundColor: newStageColor }}
                                                    >
                                                        <div className="h-1.5 w-1.5 rounded-full bg-white/40 flex-shrink-0" />
                                                        <span className="text-xs font-semibold text-white">
                                                            {newStageName.replace(/\b\w/g, (c) => c.toUpperCase())}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Footer */}
                                        <div
                                            className="px-3 py-2.5 flex items-center justify-end gap-2 border-t"
                                            style={{ borderColor: `${newStageColor}40` }}
                                        >
                                            <button
                                                onClick={() => { setAddingStageType(null); setNewStageName(''); setNewStageColor('#3b82f6'); }}
                                                className="px-3 cursor-pointer py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors border border-[#e5e7eb0f]"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => addStage(group.key)}
                                                disabled={!newStageName.trim()}
                                                className="px-4 cursor-pointer py-1.5 rounded-lg text-xs font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                                                style={{ backgroundColor: newStageColor }}
                                            >
                                                Add Stage
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Stages in Group */}
                                <div className="space-y-2">
                                    {group.stages.length === 0 && addingStageType !== group.key && (
                                        <button
                                            onClick={() => {
                                                setAddingStageType(group.key);
                                                setNewStageName('');
                                                setNewStageColor(STAGE_TYPE_COLORS[group.key as keyof typeof STAGE_TYPE_COLORS] || '#3b82f6');
                                            }}
                                            className="w-full p-2.5 border border-dashed rounded-xl text-white/30 hover:text-white/60 hover:border-white/25 transition-all flex items-center justify-center gap-2 text-xs"
                                            style={{ borderColor: `${STAGE_TYPE_COLORS[group.key as keyof typeof STAGE_TYPE_COLORS] || '#64748b'}40` }}
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Add stage
                                        </button>
                                    )}
                                    {group.stages.length > 0 && (
                                        <>
                                            {group.stages.map((stage, idx) => {
                                                const stageIndex = template?.stagelist.indexOf(stage);
                                                const isEditing = editingIndex === stageIndex;
                                                const isDragging = draggedStage === stageIndex;
                                                const stageColor = stage.color || STAGE_TYPE_COLORS[stage.stageType as keyof typeof STAGE_TYPE_COLORS] || '#64748b';

                                                return (
                                                    <div
                                                        key={idx}
                                                        draggable={!isEditing}
                                                        onDragStart={(e) => handleDragStart(e, stageIndex!)}
                                                        onDragOver={handleDragOver}
                                                        onDrop={(e) => handleDrop(e, stageIndex!, group.key)}
                                                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all group cursor-move ${
                                                            isDragging
                                                                ? 'opacity-40 bg-white/5 border-white/15'
                                                                : 'bg-[#111118] border-white/8 hover:border-white/15'
                                                        }`}
                                                        style={!isDragging ? { borderColor: `${stageColor}30` } : {}}
                                                    >
                                                        {/* Drag Handle */}
                                                        <GripVertical className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />

                                                        {/* Color swatch / editor */}
                                                        {isEditing ? (
                                                            <div
                                                                className="w-6 h-6 rounded-md flex-shrink-0 border border-white/15 cursor-pointer relative overflow-hidden"
                                                                style={{ backgroundColor: editingColor || stageColor }}
                                                                onClick={() => document.getElementById(`edit-stage-color-standalone-${stageIndex}`)?.click()}
                                                                title="Change color"
                                                            >
                                                                <input
                                                                    type="color"
                                                                    id={`edit-stage-color-standalone-${stageIndex}`}
                                                                    value={editingColor || stageColor}
                                                                    onChange={(e) => setEditingColor(e.target.value)}
                                                                    className="sr-only"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="flex items-center gap-1.5 px-2 py-1 rounded-md flex-shrink-0"
                                                                style={{ backgroundColor: stageColor }}
                                                            >
                                                                <div className="h-1.5 w-1.5 rounded-full bg-white/50 flex-shrink-0" />
                                                                <span className="text-xs font-semibold text-white whitespace-nowrap">
                                                                    {stage.name?.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Unnamed'}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* Name input or spacer */}
                                                        {isEditing ? (
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                value={editingValue}
                                                                onChange={(e) => setEditingValue(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') saveEdit(stageIndex!);
                                                                    if (e.key === 'Escape') { setEditingIndex(null); setEditingValue(''); setEditingColor(''); }
                                                                }}
                                                                style={{ fontSize: '12px' }}
                                                                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs text-white bg-white/5 border border-white/10 focus:outline-none focus:border-white/30 transition-all"
                                                                placeholder="Stage name..."
                                                            />
                                                        ) : (
                                                            <span
                                                                onClick={() => startEdit(stageIndex!)}
                                                                className="flex-1 min-w-0 text-xs text-white/40 cursor-pointer hover:text-white/70 transition-colors truncate"
                                                                title="Click to edit"
                                                            >
                                                                {/* name shown in pill above */}
                                                            </span>
                                                        )}

                                                        {/* Edit-mode color swatches */}
                                                        {isEditing && (
                                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                                {PRESET_COLORS.slice(0, 6).map((color) => (
                                                                    <button
                                                                        key={color}
                                                                        onClick={() => setEditingColor(color)}
                                                                        className="w-3.5 h-3.5 rounded-full transition-all hover:scale-110 flex-shrink-0"
                                                                        style={{
                                                                            backgroundColor: color,
                                                                            boxShadow: editingColor === color
                                                                                ? `0 0 0 1.5px #12121a, 0 0 0 3px ${color}`
                                                                                : 'none',
                                                                        }}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Save button */}
                                                        {isEditing && (
                                                            <button
                                                                onClick={() => saveEdit(stageIndex!)}
                                                                disabled={!editingValue.trim()}
                                                                className="px-3 cursor-pointer py-1 rounded-lg text-xs font-semibold text-white transition-all active:scale-95 disabled:opacity-30 shadow-sm flex-shrink-0"
                                                                style={{ backgroundColor: editingColor || stageColor }}
                                                            >
                                                                Save
                                                            </button>
                                                        )}

                                                        {/* Hover actions */}
                                                        {!isEditing && (
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0">
                                                                <button
                                                                    onClick={() => startEdit(stageIndex!)}
                                                                    className="p-1 rounded-md text-white/30 hover:text-white/70 hover:bg-white/8 transition-colors"
                                                                    title="Edit stage"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteStage(stageIndex!)}
                                                                    className="p-1 rounded-md text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                                                    title="Delete stage"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {addingStageType !== group.key && (
                                                <button
                                                    onClick={() => {
                                                        setAddingStageType(group.key);
                                                        setNewStageName('');
                                                        setNewStageColor(STAGE_TYPE_COLORS[group.key as keyof typeof STAGE_TYPE_COLORS] || '#3b82f6');
                                                    }}
                                                    className="w-full p-2 border border-dashed rounded-xl text-white/25 hover:text-white/55 hover:border-white/20 transition-all flex items-center justify-center gap-1.5 text-xs mt-1"
                                                    style={{ borderColor: `${STAGE_TYPE_COLORS[group.key as keyof typeof STAGE_TYPE_COLORS] || '#64748b'}35` }}
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    Add stage
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Footer Buttons */}
                        <div className="flex gap-3 justify-end pt-6 border-t">
                            {selectedTemplate === 'custom' ? (
                                <Button
                                    variant="outline"
                                    onClick={handleSaveAsTemplate}
                                    disabled={savingTemplate}
                                >
                                    Save as template
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleApplyChanges}
                                    className="bg-gray-600 hover:bg-gray-700"
                                >
                                    Apply changes
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

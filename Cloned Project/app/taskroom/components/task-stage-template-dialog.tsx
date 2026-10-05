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
        isLoading: savingTemplate
    } = useTemplateStore();

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
        if (!currentRoom?.id) {
            toast.error("No room selected");
            return;
        }

        try {
            const token = Cookies.get('auth-token');
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
                                    <div className="p-3 border-2 border-gray-300 rounded-lg bg-white">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={newStageColor}
                                                onChange={(e) => setNewStageColor(e.target.value)}
                                                className="w-6 h-6 rounded cursor-pointer"
                                            />
                                            <Input
                                                autoFocus
                                                placeholder="Add status"
                                                value={newStageName}
                                                onChange={(e) => setNewStageName(e.target.value)}
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                        addStage(group.key);
                                                    }
                                                }}
                                                className="flex-1 h-9 text-sm"
                                            />
                                            <Button
                                                size="sm"
                                                onClick={() => addStage(group.key)}
                                                className="h-8 px-3 text-xs bg-gray-900 hover:bg-gray-800"
                                            >
                                                Add
                                            </Button>
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
                                                setNewStageColor('#3b82f6');
                                            }}
                                            className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-600 transition flex items-center justify-center gap-2"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Add status
                                        </button>
                                    )}
                                    {group.stages.length > 0 && (
                                        <>
                                            {group.stages.map((stage, idx) => {
                                                const stageIndex = template?.stagelist.indexOf(stage);
                                                const isEditing = editingIndex === stageIndex;
                                                const isDragging = draggedStage === stageIndex;

                                                return (
                                                    <div
                                                        key={idx}
                                                        draggable={!isEditing}
                                                        onDragStart={(e) => handleDragStart(e, stageIndex!)}
                                                        onDragOver={handleDragOver}
                                                        onDrop={(e) => handleDrop(e, stageIndex!, group.key)}
                                                        className={`flex items-center gap-3 p-3 bg-white border border-gray-300 rounded-lg hover:border-gray-400 transition group cursor-move ${isDragging ? 'opacity-50 bg-gray-100' : ''
                                                            }`}
                                                    >
                                                        {/* Drag Handle */}
                                                        <GripVertical className="w-4 h-4 text-gray-400" />

                                                        {/* Stage Icon/Color Indicator */}
                                                        {isEditing ? (
                                                            <input
                                                                type="color"
                                                                value={editingColor || '#3b82f6'}
                                                                onChange={(e) => setEditingColor(e.target.value)}
                                                                className="w-5 h-5 rounded-full flex-shrink-0 cursor-pointer"
                                                            />
                                                        ) : (
                                                            <div
                                                                className="w-5 h-5 rounded-full flex-shrink-0"
                                                                style={{
                                                                    backgroundColor:
                                                                        stage.color ||
                                                                        STAGE_TYPE_COLORS[stage.stageType as keyof typeof STAGE_TYPE_COLORS] ||
                                                                        '#e5e7eb',
                                                                }}
                                                            />
                                                        )}

                                                        {/* Stage Name */}
                                                        {isEditing ? (
                                                            <Input
                                                                autoFocus
                                                                value={editingValue}
                                                                onChange={(e) => setEditingValue(e.target.value)}
                                                                onKeyPress={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        saveEdit(stageIndex!);
                                                                    }
                                                                }}
                                                                className="flex-1 h-8 text-sm"
                                                                placeholder="Stage name..."
                                                            />
                                                        ) : (
                                                            <span
                                                                onClick={() => startEdit(stageIndex!)}
                                                                className="flex-1 text-sm text-gray-900 font-medium cursor-pointer hover:text-blue-600"
                                                            >
                                                                {stage.name || 'Stage name...'}
                                                            </span>
                                                        )}

                                                        {/* Save Button (in edit mode) */}
                                                        {isEditing && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => saveEdit(stageIndex!)}
                                                                className="h-7 px-3 text-xs bg-gray-900 hover:bg-gray-800"
                                                            >
                                                                Save
                                                            </Button>
                                                        )}

                                                        {/* Action Menu */}
                                                        {!isEditing && (
                                                            <button className="opacity-0 group-hover:opacity-100 transition p-1 text-gray-400 hover:text-gray-600">
                                                                <MoreHorizontal className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        {/* Delete Button */}
                                                        {!isEditing && (
                                                            <button
                                                                onClick={() => deleteStage(stageIndex!)}
                                                                className="opacity-0 group-hover:opacity-100 transition p-1 text-gray-400 hover:text-red-600"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {addingStageType !== group.key && (
                                                <button
                                                    onClick={() => {
                                                        setAddingStageType(group.key);
                                                        setNewStageName('');
                                                        setNewStageColor('#3b82f6');
                                                    }}
                                                    className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-600 transition flex items-center justify-center gap-2 mt-2"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Add status
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

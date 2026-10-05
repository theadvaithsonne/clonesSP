"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    closestCorners,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { GripVertical, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Column, useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";

const STAGE_TYPES = [
    { key: "tostart", label: "Not started", color: "#64748b" },
    { key: "active", label: "Active", color: "#3b82f6" },
    { key: "done", label: "Done", color: "#10b981" },
    { key: "closed", label: "Closed", color: "#ef4444" },
] as const;

const PRESET_COLORS = [
    "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b",
    "#ef4444", "#ec4899", "#06b6d4", "#84cc16",
    "#f97316", "#6366f1", "#14b8a6", "#a855f7",
];

type StageTypeKey = (typeof STAGE_TYPES)[number]["key"];

interface ApiRoomStage {
    _id: string;
    name: string;
    color: string;
    stageType: StageTypeKey;
    orderId: number;
    type?: string;
    taskCount?: number;
    status?: string;
}

export interface RoomStage extends ApiRoomStage {
    updatedOrderId: number;
    isupdated: boolean;
}

interface RoomStageSettingsPanelProps {
    roomId: string;
}

const STAGE_TYPE_ORDER: Record<string, number> = { tostart: 0, active: 1, done: 2, closed: 3 };

function groupDroppableId(stageType: string) {
    return `group-${stageType}`;
}

function parseGroupId(id: string) {
    return id.startsWith("group-") ? id.replace("group-", "") : null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    if (!hex || typeof hex !== "string") return null;
    const cleaned = hex.trim().replace(/^#/, "");
    let r: string, g: string, b: string;
    if (/^[a-f\d]{3}$/i.test(cleaned)) {
        r = cleaned[0] + cleaned[0];
        g = cleaned[1] + cleaned[1];
        b = cleaned[2] + cleaned[2];
    } else if (/^[a-f\d]{6}$/i.test(cleaned)) {
        r = cleaned.slice(0, 2);
        g = cleaned.slice(2, 4);
        b = cleaned.slice(4, 6);
    } else {
        return null;
    }
    return { r: parseInt(r, 16), g: parseInt(g, 16), b: parseInt(b, 16) };
}

function stageColumnColors(color: string) {
    const rgb = hexToRgb(color);
    return {
        bg: rgb
            ? `rgba(${Math.round(rgb.r * 0.30)}, ${Math.round(rgb.g * 0.30)}, ${Math.round(rgb.b * 0.30)}, 0.22)`
            : "rgba(39, 10, 115, 0.22)",
        border: rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)` : "rgba(139, 92, 246, 0.2)",
    };
}

function sortStages(list: RoomStage[]): RoomStage[] {
    return [...list].sort((a, b) => {
        const typeDiff = (STAGE_TYPE_ORDER[a.stageType] ?? 99) - (STAGE_TYPE_ORDER[b.stageType] ?? 99);
        if (typeDiff !== 0) return typeDiff;
        return a.updatedOrderId - b.updatedOrderId;
    });
}

function mapApiStages(data: ApiRoomStage[]): RoomStage[] {
    const sorted = [...data].sort((a, b) => {
        const typeDiff = (STAGE_TYPE_ORDER[a.stageType] ?? 99) - (STAGE_TYPE_ORDER[b.stageType] ?? 99);
        if (typeDiff !== 0) return typeDiff;
        return a.orderId - b.orderId;
    });

    const perTypeCounter: Record<string, number> = {};
    return sorted.map((stage) => {
        const next = (perTypeCounter[stage.stageType] ?? 0) + 1;
        perTypeCounter[stage.stageType] = next;
        return {
            ...stage,
            updatedOrderId: next,
            isupdated: false,
        };
    });
}

function markChangedStages(
    stages: RoomStage[],
    initialMap: Map<string, { stageType: string; orderId: number; name: string; color: string }>
): RoomStage[] {
    return stages.map((stage) => {
        const initial = initialMap.get(stage._id);
        if (!initial) return { ...stage, isupdated: true };
        const changed =
            stage.stageType !== initial.stageType ||
            stage.updatedOrderId !== initial.orderId ||
            stage.name !== initial.name ||
            stage.color !== initial.color;
        return { ...stage, isupdated: changed };
    });
}

function getGroupStages(stages: RoomStage[], stageType: string): RoomStage[] {
    return stages
        .filter((s) => s.stageType === stageType)
        .sort((a, b) => a.updatedOrderId - b.updatedOrderId);
}

function rebuildStagesWithGroups(
    prev: RoomStage[],
    groups: Array<{ stageType: string; orderedGroup: RoomStage[] }>
): RoomStage[] {
    const affectedTypes = new Set(groups.map((g) => g.stageType));
    const unchanged = prev.filter((s) => !affectedTypes.has(s.stageType));

    const rebuilt: RoomStage[] = [...unchanged];
    for (const { stageType, orderedGroup } of groups) {
        orderedGroup.forEach((stage, index) => {
            rebuilt.push({
                ...stage,
                stageType: stageType as StageTypeKey,
                updatedOrderId: index + 1,
            });
        });
    }

    return sortStages(rebuilt);
}

function sortColumnsByStageOrder(columns: Column[]): Column[] {
    return [...columns].sort((a, b) => {
        const typeDiff = (STAGE_TYPE_ORDER[a.stageType] ?? 99) - (STAGE_TYPE_ORDER[b.stageType] ?? 99);
        if (typeDiff !== 0) return typeDiff;
        return (a.orderId ?? 0) - (b.orderId ?? 0);
    });
}

function syncColumnsFromStages(
    setColumns: (updater: Column[] | ((prev: Column[]) => Column[])) => void,
    stageList: RoomStage[],
    roomId: string
) {
    setColumns((prev) => {
        const prevMap = new Map(prev.map((col) => [col._id, col]));
        const synced: Column[] = stageList.map((stage) => {
            const existing = prevMap.get(stage._id);
            const base: Column = existing ?? {
                _id: stage._id,
                name: stage.name,
                roomId,
                userId: "",
                cards: [],
                taskCount: stage.taskCount ?? 0,
                localCardCount: stage.taskCount ?? 0,
                stageType: stage.stageType,
                orderId: stage.updatedOrderId,
                color: stage.color,
            };
            return {
                ...base,
                name: stage.name,
                color: stage.color,
                stageType: stage.stageType,
                orderId: stage.updatedOrderId,
                taskCount: stage.taskCount ?? base.taskCount,
                localCardCount: stage.taskCount ?? base.localCardCount,
            };
        });
        return sortColumnsByStageOrder(synced);
    });
}

interface SortableStageRowProps {
    stage: RoomStage;
}

function SortableStageRow({ stage }: SortableStageRowProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: stage._id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const stageColor = stage.color || "#8b5cf6";

    return (
        <div
            ref={setNodeRef}
            style={{
                ...style,
                borderColor: isDragging ? undefined : `${stageColor}30`,
            }}
            className={cn(
                "flex items-center gap-2 px-2 py-2 rounded-lg border transition-all bg-[#111118]/80",
                isDragging
                    ? "opacity-40 border-brand/40"
                    : "border-white/8 hover:border-white/15",
                stage.isupdated && !isDragging && "border-brand/30"
            )}
        >
            <button
                type="button"
                className="touch-none text-white/15 hover:text-white/40 flex-shrink-0 cursor-grab active:cursor-grabbing"
                {...attributes}
                {...listeners}
            >
                <GripVertical className="w-3.5 h-3.5" />
            </button>

            <div
                className="flex items-center gap-1.5 px-2 py-1 rounded-md flex-1 min-w-0"
                style={{ backgroundColor: stageColor }}
            >
                <div className="h-1.5 w-1.5 rounded-full bg-white/50 flex-shrink-0" />
                <span className="text-xs font-semibold text-white truncate">{stage.name}</span>
            </div>

            {stage.taskCount !== undefined && (
                <span className="text-[10px] text-white/25 flex-shrink-0">{stage.taskCount}</span>
            )}
        </div>
    );
}

function StageRowOverlay({ stage }: { stage: RoomStage }) {
    const stageColor = stage.color || "#8b5cf6";
    return (
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg border border-brand/50 bg-[#111118] shadow-lg w-[260px]">
            <GripVertical className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
            <div
                className="flex items-center gap-1.5 px-2 py-1 rounded-md flex-1 min-w-0"
                style={{ backgroundColor: stageColor }}
            >
                <div className="h-1.5 w-1.5 rounded-full bg-white/50 flex-shrink-0" />
                <span className="text-xs font-semibold text-white truncate">{stage.name}</span>
            </div>
        </div>
    );
}

interface StageGroupSectionProps {
    groupKey: string;
    groupLabel: string;
    groupColor: string;
    stages: RoomStage[];
    stageIds: string[];
    isOver: boolean;
    addingStageType: string | null;
    newStageName: string;
    newStageColor: string;
    isSaving: boolean;
    onToggleAdd: () => void;
    onNewStageNameChange: (value: string) => void;
    onNewStageColorChange: (color: string) => void;
    onCancelAdd: () => void;
    onAddStage: () => void;
}

function StageGroupSection({
    groupKey,
    groupLabel,
    groupColor,
    stages,
    stageIds,
    isOver,
    addingStageType,
    newStageName,
    newStageColor,
    isSaving,
    onToggleAdd,
    onNewStageNameChange,
    onNewStageColorChange,
    onCancelAdd,
    onAddStage,
}: StageGroupSectionProps) {
    const { setNodeRef } = useDroppable({ id: groupDroppableId(groupKey) });
    const { bg, border } = stageColumnColors(groupColor);

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex-shrink-0 w-[280px] rounded-xl flex flex-col max-h-[min(520px,70vh)] overflow-hidden transition-all",
                isOver && "ring-2 ring-brand/40"
            )}
            style={{ backgroundColor: bg }}
        >
            <div
                className="flex items-center justify-between px-3 py-3 gap-2 shrink-0"
                style={{ borderColor: border }}
            >
                <div
                    className="flex items-center gap-2 px-2 py-1 min-w-0 rounded-lg"
                    style={{ backgroundColor: groupColor }}
                >
                    <div className="h-1.5 w-1.5 rounded-full flex-shrink-0 ring-2 ring-white" />
                    <span className="text-xs font-semibold text-white truncate">{groupLabel}</span>
                    <span className="text-xs font-semibold text-white/80 shrink-0">{stages.length}</span>
                </div>
                <button
                    type="button"
                    onClick={onToggleAdd}
                    className="rounded p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label={`Add stage to ${groupLabel}`}
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1.5 min-h-[64px]">
                <SortableContext items={stageIds} strategy={verticalListSortingStrategy}>
                    {stages.map((stage) => (
                        <SortableStageRow key={stage._id} stage={stage} />
                    ))}
                </SortableContext>

                {stages.length === 0 && addingStageType !== groupKey && (
                    <div
                        className={cn(
                            "py-8 text-center text-[11px] border border-dashed rounded-lg transition-colors",
                            isOver
                                ? "text-white/40 border-brand/50 bg-brand/5"
                                : "text-white/25 border-white/10"
                        )}
                    >
                        Drop stages here
                    </div>
                )}

                {addingStageType === groupKey && (
                    <div
                        className="rounded-xl border overflow-hidden"
                        style={{
                            backgroundColor: "rgba(18, 18, 26, 0.97)",
                            borderColor: newStageColor,
                        }}
                    >
                        <div className="flex items-center gap-2 p-3">
                            <div
                                className="w-5 h-5 rounded-md flex-shrink-0 cursor-pointer border border-white/10"
                                style={{ backgroundColor: newStageColor }}
                                onClick={() => document.getElementById(`new-color-${groupKey}`)?.click()}
                            >
                                <input
                                    type="color"
                                    id={`new-color-${groupKey}`}
                                    value={newStageColor}
                                    onChange={(e) => onNewStageColorChange(e.target.value)}
                                    className="sr-only"
                                />
                            </div>
                            <input
                                autoFocus
                                type="text"
                                value={newStageName}
                                onChange={(e) => onNewStageNameChange(e.target.value)}
                                placeholder="Stage name"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") onAddStage();
                                    if (e.key === "Escape") onCancelAdd();
                                }}
                                className="flex-1 min-w-0 bg-transparent text-[12px] text-white/50 placeholder:text-white/20 outline-none"
                            />
                        </div>
                        <div className="px-3 pb-3 flex items-center gap-1.5 flex-wrap">
                            {PRESET_COLORS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => onNewStageColorChange(c)}
                                    className="w-4 h-4 rounded-full transition-transform hover:scale-110"
                                    style={{
                                        backgroundColor: c,
                                        outline: newStageColor === c ? `2px solid ${c}` : "none",
                                        outlineOffset: "2px",
                                    }}
                                />
                            ))}
                        </div>
                        <div
                            className="flex items-center justify-end gap-2 px-3 py-2 border-t"
                            style={{ borderColor: `${newStageColor}40` }}
                        >
                            <button
                                type="button"
                                onClick={onCancelAdd}
                                className="text-[12px] text-white/30 hover:text-white/60 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onAddStage}
                                disabled={!newStageName.trim() || isSaving}
                                className="text-[12px] px-3 py-1 rounded-md font-medium text-white disabled:opacity-30"
                                style={{ backgroundColor: newStageColor }}
                            >
                                Add
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export function RoomStageSettingsPanel({ roomId }: RoomStageSettingsPanelProps) {
    const [stages, setStages] = useState<RoomStage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeStageId, setActiveStageId] = useState<string | null>(null);
    const [overGroupKey, setOverGroupKey] = useState<string | null>(null);
    const [addingStageType, setAddingStageType] = useState<string | null>(null);
    const [newStageName, setNewStageName] = useState("");
    const [newStageColor, setNewStageColor] = useState("#3b82f6");

    const initialStagesRef = useRef<Map<string, { stageType: string; orderId: number; name: string; color: string }>>(
        new Map()
    );

    const setColumns = useTaskroomWorkspacetore((state) => state.setColumns);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
    );

    const fetchRoomStages = useCallback(async (): Promise<RoomStage[]> => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem("garage_tok");
            const baseUrl = process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/";
            const response = await axios.get(`${baseUrl}stages/room/${roomId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.data?.status || response.data?.success) {
                const mapped = mapApiStages(response.data?.data || []);
                initialStagesRef.current = new Map(
                    mapped.map((s) => [s._id, { stageType: s.stageType, orderId: s.updatedOrderId, name: s.name, color: s.color }])
                );
                setStages(mapped);
                return mapped;
            } else {
                toast.error(response.data?.message || "Failed to fetch room stages");
            }
        } catch (error: unknown) {
            const message =
                axios.isAxiosError(error)
                    ? error.response?.data?.message || "Failed to fetch room stages"
                    : "Failed to fetch room stages";
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
        return [];
    }, [roomId]);

    useEffect(() => {
        fetchRoomStages();
    }, [fetchRoomStages]);

    const groupedStages = useMemo(
        () =>
            STAGE_TYPES.map((group) => ({
                ...group,
                stages: getGroupStages(stages, group.key),
                stageIds: getGroupStages(stages, group.key).map((s) => s._id),
            })),
        [stages]
    );

    const hasPendingChanges = stages.some((s) => s.isupdated);
    const activeStage = activeStageId ? stages.find((s) => s._id === activeStageId) ?? null : null;

    const findContainer = useCallback(
        (id: string, stageList: RoomStage[]) => {
            const groupId = parseGroupId(id);
            if (groupId) return groupId;
            return stageList.find((s) => s._id === id)?.stageType ?? null;
        },
        []
    );

    const applyStageUpdate = (updater: (prev: RoomStage[]) => RoomStage[]) => {
        setStages((prev) => markChangedStages(updater(prev), initialStagesRef.current));
    };

    const moveStageInGroup = (
        sourceId: string,
        targetGroupKey: string,
        targetStageId: string | null
    ) => {
        applyStageUpdate((prev) => {
            const dragged = prev.find((s) => s._id === sourceId);
            if (!dragged) return prev;

            const sourceGroupKey = dragged.stageType;
            const sourceGroup = getGroupStages(prev, sourceGroupKey);
            const fromIndex = sourceGroup.findIndex((s) => s._id === sourceId);
            if (fromIndex === -1) return prev;

            if (sourceGroupKey === targetGroupKey) {
                const reordered = [...sourceGroup];
                const [item] = reordered.splice(fromIndex, 1);

                if (targetStageId === null) {
                    reordered.push(item);
                } else {
                    const toIndex = reordered.findIndex((s) => s._id === targetStageId);
                    reordered.splice(toIndex >= 0 ? toIndex : reordered.length, 0, item);
                }

                return rebuildStagesWithGroups(prev, [{ stageType: targetGroupKey, orderedGroup: reordered }]);
            }

            const sourceWithout = sourceGroup.filter((s) => s._id !== sourceId);
            const targetGroup = [...getGroupStages(prev, targetGroupKey)];
            const moved: RoomStage = { ...dragged, stageType: targetGroupKey as StageTypeKey };

            if (targetStageId === null) {
                targetGroup.push(moved);
            } else {
                const toIndex = targetGroup.findIndex((s) => s._id === targetStageId);
                targetGroup.splice(toIndex >= 0 ? toIndex : targetGroup.length, 0, moved);
            }

            return rebuildStagesWithGroups(prev, [
                { stageType: sourceGroupKey, orderedGroup: sourceWithout },
                { stageType: targetGroupKey, orderedGroup: targetGroup },
            ]);
        });
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveStageId(String(event.active.id));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveStageId(null);
        setOverGroupKey(null);

        if (!over) return;

        const activeId = String(active.id);
        const overId = String(over.id);

        if (activeId === overId) return;

        const activeContainer = findContainer(activeId, stages);
        const overContainer = findContainer(overId, stages);

        if (!activeContainer || !overContainer) return;

        if (activeContainer === overContainer && !overId.startsWith("group-")) {
            const groupStages = getGroupStages(stages, activeContainer);
            const oldIndex = groupStages.findIndex((s) => s._id === activeId);
            const newIndex = groupStages.findIndex((s) => s._id === overId);
            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                const reordered = arrayMove(groupStages, oldIndex, newIndex);
                applyStageUpdate((prev) =>
                    rebuildStagesWithGroups(prev, [{ stageType: activeContainer, orderedGroup: reordered }])
                );
            }
            return;
        }

        const targetStageId = overId.startsWith("group-") ? null : overId;
        moveStageInGroup(activeId, overContainer, targetStageId);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const overId = event.over?.id;
        if (!overId) {
            setOverGroupKey(null);
            return;
        }
        const container = findContainer(String(overId), stages);
        setOverGroupKey(container);
    };

    const addStage = async (stageType: string) => {
        if (!newStageName.trim()) return;

        setIsSaving(true);
        try {
            const token = localStorage.getItem("garage_tok");
            const baseUrl = process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/";
            const groupCount = stages.filter((s) => s.stageType === stageType).length;
            const response = await axios.post(
                `${baseUrl}stages`,
                {
                    name: newStageName.trim(),
                    color: newStageColor,
                    stageType,
                    type: "custom",
                    orderId: groupCount + 1,
                    roomId,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data?.status || response.data?.success) {
                toast.success("Stage created");
                setAddingStageType(null);
                setNewStageName("");
                setNewStageColor("#3b82f6");
                await fetchRoomStages();
            } else {
                toast.error(response.data?.message || "Failed to create stage");
            }
        } catch (error: unknown) {
            const message =
                axios.isAxiosError(error)
                    ? error.response?.data?.message || "Failed to create stage"
                    : "Failed to create stage";
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveChanges = async () => {
        const updatedStages = stages
            .filter((s) => s.isupdated)
            .map((s) => ({
                _id: s._id,
                name: s.name,
                color: s.color,
                updatedStageType: s.stageType,
                updatedOrderId: s.updatedOrderId,
            }));

        if (updatedStages.length === 0) {
            toast.info("No changes to save");
            return;
        }

        setIsSaving(true);
        try {
            const token = localStorage.getItem("garage_tok");
            const baseUrl = process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/";
            const response = await axios.put(
                `${baseUrl}stages/room/${roomId}`,
                { updatedStages },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data?.status || response.data?.success) {
                toast.success("Stage changes saved");
                syncColumnsFromStages(setColumns, stages, roomId);
                await fetchRoomStages();
            } else {
                toast.error(response.data?.message || "Failed to save stage changes");
            }
        } catch (error: unknown) {
            const message =
                axios.isAxiosError(error)
                    ? error.response?.data?.message || "Failed to save stage changes"
                    : "Failed to save stage changes";
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-white/30" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 pb-6 min-h-0">
            <div>
                <h2 className="text-md font-semibold mb-1 text-white/80">Stage Template</h2>
                <p className="text-[12px] text-white/35">Drag stages between columns — same layout as the board view.</p>
            </div>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={() => {
                    setActiveStageId(null);
                    setOverGroupKey(null);
                }}
            >
                <div className="flex gap-4 overflow-x-auto pb-2 items-start kanban-horizontal-scroll min-h-[280px]">
                    {groupedStages.map((group) => (
                        <StageGroupSection
                            key={group.key}
                            groupKey={group.key}
                            groupLabel={group.label}
                            groupColor={group.color}
                            stages={group.stages}
                            stageIds={group.stageIds}
                            isOver={overGroupKey === group.key}
                            addingStageType={addingStageType}
                            newStageName={newStageName}
                            newStageColor={newStageColor}
                            isSaving={isSaving}
                            onToggleAdd={() => {
                                setAddingStageType(addingStageType === group.key ? null : group.key);
                                setNewStageName("");
                                setNewStageColor(group.color);
                            }}
                            onNewStageNameChange={setNewStageName}
                            onNewStageColorChange={setNewStageColor}
                            onCancelAdd={() => {
                                setAddingStageType(null);
                                setNewStageName("");
                            }}
                            onAddStage={() => addStage(group.key)}
                        />
                    ))}
                </div>

                <DragOverlay dropAnimation={null}>
                    {activeStage ? <StageRowOverlay stage={activeStage} /> : null}
                </DragOverlay>
            </DndContext>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#e5e7eb15]">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[13px] cursor-pointer font-medium bg-[#343439] text-white/50 hover:bg-[#343439] border-none disabled:opacity-50"
                    onClick={handleSaveChanges}
                    disabled={isSaving || !hasPendingChanges}
                >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save stage changes"}
                </Button>
            </div>
        </div>
    );
}

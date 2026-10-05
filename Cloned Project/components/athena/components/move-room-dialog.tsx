"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, FolderKanban, Loader2, MoveRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useTaskroomWorkspacetore, Room } from "@/store/taskroom/taskroomWorkspace";

type WorkspacesMetadata = {
    count: number;
    totalPages: number;
    currentPage: number;
    nextPage: number | null;
};

function hasMoreWorkspaces(metadata?: WorkspacesMetadata | null) {
    if (!metadata) return false;
    if (metadata.nextPage != null) return true;
    return metadata.currentPage < metadata.totalPages;
}

function capitalize(value?: string) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function WorkspaceAvatar({
    workspace,
    selected = false,
}: {
    workspace: any;
    selected?: boolean;
}) {
    const imageUrl = workspace?.image_circle_url || workspace?.image_square_url;
    if (imageUrl) {
        return (
            <img
                src={imageUrl}
                alt={workspace?.name || workspace?.workspacename || "Workspace"}
                className="h-4 w-4 shrink-0 rounded object-cover"
            />
        );
    }
    return (
        <span
            className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px]",
                selected ? "text-white/70" : "text-white/50"
            )}
            style={{ backgroundColor: workspace?.color || "#6b7280" }}
        >
            {(workspace?.name || workspace?.workspacename || "W").charAt(0).toUpperCase()}
        </span>
    );
}

function SpaceIcon({ space }: { space?: any }) {
    const image =
        typeof space?.image === "string"
            ? space.image
            : space?.image?.url || space?.icon?.url || space?.icon;
    if (typeof image === "string" && (/^https?:\/\//i.test(image) || image.startsWith("/"))) {
        return <img src={image} alt="" className="h-3.5 w-3.5 shrink-0 rounded-sm object-cover" />;
    }
    return <FolderKanban className="h-3.5 w-3.5 shrink-0 text-white/50" />;
}

interface MoveRoomDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    room: Room | null;
    onMoved?: (payload: {
        workspaceId: string;
        spaceId: string;
        roomId: string;
        room: Room;
    }) => void;
}

export function MoveRoomDialog({ open, onOpenChange, room, onMoved }: MoveRoomDialogProps) {
    const {
        workspaces,
        workspacesMetadata,
        isLoadingWorkspaces,
        fetchWorkspaces,
        spaceData,
        spaceMetadata,
        loadingWorkspaceSpaces,
        fetchspaces,
        moveRoom,
        isRoomLoading,
        currentWorkspace,
    } = useTaskroomWorkspacetore();

    const [step, setStep] = useState<"select" | "confirm">("select");
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
    const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

    const workspacesListRef = useRef<HTMLDivElement>(null);
    const workspacesObserverRef = useRef<HTMLDivElement>(null);
    const spacesListRef = useRef<HTMLDivElement>(null);
    const spacesObserverRef = useRef<HTMLDivElement>(null);

    const selectedWorkspace =
        workspaces.find((ws) => ws._id === selectedWorkspaceId) || null;
    const spaces = selectedWorkspaceId ? spaceData[selectedWorkspaceId] || [] : [];
    const selectedSpace = spaces.find((s) => s._id === selectedSpaceId);
    const spaceMeta = selectedWorkspaceId
        ? spaceMetadata?.[selectedWorkspaceId] || { totalPages: 1, currentPage: 1 }
        : { totalPages: 1, currentPage: 1 };
    const hasMoreSpaces = spaceMeta.totalPages > spaceMeta.currentPage;
    const isLoadingSpaces = selectedWorkspaceId
        ? !!loadingWorkspaceSpaces?.[selectedWorkspaceId]
        : false;

    const resetState = useCallback(() => {
        setStep("select");
        setSelectedWorkspaceId(null);
        setSelectedSpaceId(null);
    }, []);

    useEffect(() => {
        if (!open) {
            resetState();
            return;
        }
        const initialWorkspaceId = currentWorkspace?._id || null;
        setSelectedWorkspaceId(initialWorkspaceId);
        setSelectedSpaceId(null);
        setStep("select");
        if (!workspaces.length) {
            fetchWorkspaces(1);
        }
        if (initialWorkspaceId) {
            fetchspaces(initialWorkspaceId, 1);
        }
    }, [open, resetState, currentWorkspace?._id, workspaces.length, fetchWorkspaces, fetchspaces]);

    const loadMoreWorkspaces = useCallback(() => {
        if (isLoadingWorkspaces) return;
        if (!hasMoreWorkspaces(workspacesMetadata)) return;
        const nextPage =
            workspacesMetadata!.nextPage ?? workspacesMetadata!.currentPage + 1;
        fetchWorkspaces(nextPage);
    }, [fetchWorkspaces, isLoadingWorkspaces, workspacesMetadata]);

    const handleWorkspacesScroll = useCallback(() => {
        const root = workspacesListRef.current;
        if (!root || isLoadingWorkspaces) return;
        if (!hasMoreWorkspaces(workspacesMetadata)) return;
        const nearBottom =
            root.scrollTop + root.clientHeight >= root.scrollHeight - 80;
        if (nearBottom) loadMoreWorkspaces();
    }, [isLoadingWorkspaces, workspacesMetadata, loadMoreWorkspaces]);

    useEffect(() => {
        const sentinel = workspacesObserverRef.current;
        const root = workspacesListRef.current;
        if (!open || step !== "select" || !sentinel || !root) return;
        if (isLoadingWorkspaces || !hasMoreWorkspaces(workspacesMetadata)) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) loadMoreWorkspaces();
            },
            { root, rootMargin: "0px 0px 120px 0px", threshold: 0 }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [
        open,
        step,
        loadMoreWorkspaces,
        isLoadingWorkspaces,
        workspacesMetadata,
        workspaces.length,
    ]);

    const loadMoreSpaces = useCallback(() => {
        if (!selectedWorkspaceId || isLoadingSpaces || !hasMoreSpaces) return;
        fetchspaces(selectedWorkspaceId, spaceMeta.currentPage + 1);
    }, [
        selectedWorkspaceId,
        isLoadingSpaces,
        hasMoreSpaces,
        fetchspaces,
        spaceMeta.currentPage,
    ]);

    const handleSpacesScroll = useCallback(() => {
        const root = spacesListRef.current;
        if (!root || isLoadingSpaces || !hasMoreSpaces) return;
        const nearBottom =
            root.scrollTop + root.clientHeight >= root.scrollHeight - 80;
        if (nearBottom) loadMoreSpaces();
    }, [isLoadingSpaces, hasMoreSpaces, loadMoreSpaces]);

    useEffect(() => {
        const sentinel = spacesObserverRef.current;
        const root = spacesListRef.current;
        if (!open || step !== "select" || !sentinel || !root) return;
        if (!selectedWorkspaceId || isLoadingSpaces || !hasMoreSpaces) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) loadMoreSpaces();
            },
            { root, rootMargin: "0px 0px 120px 0px", threshold: 0 }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [
        open,
        step,
        selectedWorkspaceId,
        loadMoreSpaces,
        isLoadingSpaces,
        hasMoreSpaces,
        spaces.length,
    ]);

    const handleSelectWorkspace = (workspaceId: string) => {
        if (workspaceId === selectedWorkspaceId) return;
        setSelectedWorkspaceId(workspaceId);
        setSelectedSpaceId(null);
        fetchspaces(workspaceId, 1);
    };

    const canContinue = !!selectedWorkspaceId && !!selectedSpaceId && !!room?._id;

    const handleConfirm = async () => {
        if (!room?._id || !selectedWorkspaceId || !selectedSpaceId) return;
        const success = await moveRoom(
            room._id,
            { spaceId: selectedSpaceId, workspaceId: selectedWorkspaceId },
            room.spaceId
        );
        if (success) {
            onMoved?.({
                workspaceId: selectedWorkspaceId,
                spaceId: selectedSpaceId,
                roomId: room._id,
                room: {
                    ...room,
                    spaceId: selectedSpaceId,
                },
            });
            onOpenChange(false);
        }
    };

    const roomName = capitalize(room?.name) || "this room";
    const spaceName = capitalize(selectedSpace?.name) || "that space";
    const workspaceName = capitalize(
        selectedWorkspace?.name || selectedWorkspace?.workspacename
    );

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (isRoomLoading) return;
                onOpenChange(next);
            }}
        >
            <DialogContent
                showCloseButton={false}
                className="w-[calc(100%-1rem)] sm:max-w-[440px] max-h-[90dvh] overflow-hidden bg-[#161616] border-0 text-white rounded-2xl p-0 shadow-2xl"
            >
                {step === "select" ? (
                    <div className="flex flex-col max-h-[90dvh]">
                        <div className="px-5 pt-5 pb-3 shrink-0">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                                <MoveRight className="w-5 h-5 text-white/60" />
                            </div>
                            <p className="text-[15px] font-semibold text-white">
                                Move {roomName}
                            </p>
                            <p className="text-[13px] text-white/40 mt-1 leading-relaxed">
                                Select a workspace and space to move this room into.
                            </p>
                        </div>

                        <div className="px-5 pb-4 flex flex-col gap-4 min-h-0 overflow-hidden">
                            <div className="flex flex-col min-h-0">
                                <p className="text-[12px] font-semibold text-white/50 mb-1.5 px-0.5">
                                    Workspace
                                </p>
                                <div
                                    ref={workspacesListRef}
                                    onScroll={handleWorkspacesScroll}
                                    className="max-h-[140px] overflow-y-auto rounded-xl border border-white/[0.06] bg-[#121214] p-1.5 space-y-0.5 scrollbar-thin scrollbar-thumb-white/10"
                                >
                                    {workspaces.length > 0 ? (
                                        workspaces.map((ws) => {
                                            const selected = ws._id === selectedWorkspaceId;
                                            return (
                                                <button
                                                    key={ws._id}
                                                    type="button"
                                                    onClick={() => handleSelectWorkspace(ws._id)}
                                                    className={cn(
                                                        "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors",
                                                        selected
                                                            ? "bg-white/10 text-white"
                                                            : "text-white/55 hover:bg-white/5 hover:text-white/80"
                                                    )}
                                                >
                                                    <WorkspaceAvatar workspace={ws} selected={selected} />
                                                    <span className="flex-1 truncate text-[13px]">
                                                        {capitalize(ws.name || ws.workspacename) || "Untitled"}
                                                    </span>
                                                    {selected && <Check className="h-3.5 w-3.5 shrink-0 text-white/70" />}
                                                </button>
                                            );
                                        })
                                    ) : isLoadingWorkspaces ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <div key={i} className="flex items-center gap-2 px-2 py-2">
                                                <Skeleton className="h-4 w-4 bg-white/10" />
                                                <Skeleton className="h-3 flex-1 bg-white/10" />
                                            </div>
                                        ))
                                    ) : (
                                        <p className="px-2 py-3 text-[12px] text-white/30 italic">
                                            No workspaces found
                                        </p>
                                    )}

                                    {isLoadingWorkspaces && workspaces.length > 0 && (
                                        <div className="flex items-center justify-center gap-1.5 py-1.5 text-[12px] text-white/35">
                                            <ChevronDown className="h-3 w-3 animate-spin" />
                                            Loading more...
                                        </div>
                                    )}
                                    {hasMoreWorkspaces(workspacesMetadata) && !isLoadingWorkspaces && (
                                        <div ref={workspacesObserverRef} className="h-3 w-full shrink-0" />
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col min-h-0">
                                <p className="text-[12px] font-semibold text-white/50 mb-1.5 px-0.5">
                                    Space
                                </p>
                                <div
                                    ref={spacesListRef}
                                    onScroll={handleSpacesScroll}
                                    className="max-h-[160px] overflow-y-auto rounded-xl border border-white/[0.06] bg-[#121214] p-1.5 space-y-0.5 scrollbar-thin scrollbar-thumb-white/10"
                                >
                                    {!selectedWorkspaceId ? (
                                        <p className="px-2 py-3 text-[12px] text-white/30 italic">
                                            Select a workspace first
                                        </p>
                                    ) : isLoadingSpaces && spaces.length === 0 ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <div key={i} className="flex items-center gap-2 px-2 py-2">
                                                <Skeleton className="h-3.5 w-3.5 bg-white/10" />
                                                <Skeleton className="h-3 flex-1 bg-white/10" />
                                            </div>
                                        ))
                                    ) : spaces.length > 0 ? (
                                        spaces.map((space) => {
                                            if (!space._id) return null;
                                            const selected = space._id === selectedSpaceId;
                                            const isCurrent = space._id === room?.spaceId;
                                            return (
                                                <button
                                                    key={space._id}
                                                    type="button"
                                                    disabled={isCurrent}
                                                    onClick={() => setSelectedSpaceId(space._id!)}
                                                    className={cn(
                                                        "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors",
                                                        isCurrent
                                                            ? "opacity-40 cursor-not-allowed text-white/40"
                                                            : selected
                                                              ? "bg-white/10 text-white"
                                                              : "text-white/55 hover:bg-white/5 hover:text-white/80"
                                                    )}
                                                >
                                                    <SpaceIcon space={space} />
                                                    <span className="flex-1 truncate text-[13px]">
                                                        {capitalize(space.name) || "Untitled Space"}
                                                        {isCurrent ? " (current)" : ""}
                                                    </span>
                                                    {selected && !isCurrent && (
                                                        <Check className="h-3.5 w-3.5 shrink-0 text-white/70" />
                                                    )}
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <p className="px-2 py-3 text-[12px] text-white/30 italic">
                                            No spaces found
                                        </p>
                                    )}

                                    {isLoadingSpaces && spaces.length > 0 && (
                                        <div className="flex items-center justify-center gap-1.5 py-1.5 text-[12px] text-white/35">
                                            <ChevronDown className="h-3 w-3 animate-spin" />
                                            Loading more...
                                        </div>
                                    )}
                                    {hasMoreSpaces && !isLoadingSpaces && (
                                        <div ref={spacesObserverRef} className="h-3 w-full shrink-0" />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 px-5 py-4 border-t border-white/[0.06] shrink-0">
                            <Button
                                variant="ghost"
                                className="flex-1 h-9 text-[13px] text-white/40 hover:text-white/70 hover:bg-white/5"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 h-9 text-[13px] bg-brand text-brand-foreground font-semibold hover:bg-brand disabled:opacity-40"
                                disabled={!canContinue}
                                onClick={() => setStep("confirm")}
                            >
                                Continue
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-5 p-6 sm:p-8">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <MoveRight className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <p className="text-[15px] font-semibold text-white">
                                Move {roomName}?
                            </p>
                            <p className="text-[13px] text-white/40 mt-1 leading-relaxed">
                                Do you want to move{" "}
                                <span className="text-white/70">{roomName}</span> to{" "}
                                <span className="text-white/70">{spaceName}</span>
                                {workspaceName ? (
                                    <>
                                        {" "}
                                        in <span className="text-white/70">{workspaceName}</span>
                                    </>
                                ) : null}
                                ?
                            </p>
                        </div>
                        <div className="flex gap-2 pt-1">
                            <Button
                                variant="ghost"
                                className="flex-1 h-9 text-[13px] text-white/40 hover:text-white/70 hover:bg-white/5"
                                onClick={() => setStep("select")}
                                disabled={isRoomLoading}
                            >
                                Back
                            </Button>
                            <Button
                                className="flex-1 h-9 text-[13px] bg-brand text-brand-foreground font-semibold hover:bg-brand"
                                onClick={handleConfirm}
                                disabled={isRoomLoading}
                            >
                                {isRoomLoading && (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                )}
                                Move
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

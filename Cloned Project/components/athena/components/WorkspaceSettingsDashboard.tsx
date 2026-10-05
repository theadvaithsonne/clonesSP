"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Settings, Building2, FolderKanban, DoorOpen } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SpaceSettingsPanel } from "./SpaceSettingsPanel";
import { RoomSettingsPanel } from "./RoomSettingsPanel";

type SettingsTab = "workspace" | "space" | "room";

function capitalize(value?: string) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function getWorkspaceDisplayName(ws: { name?: string; workspacename?: string } | null) {
    if (!ws) return "Untitled";
    return ws.name || ws.workspacename || "Untitled";
}

function EmptyContext({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
    return (
        <div className="flex flex-col items-center justify-center flex-1 py-20 gap-3">
            <Icon className="h-10 w-10 text-white/15" />
            <p className="text-[13px] text-white/35 text-center max-w-xs">{message}</p>
        </div>
    );
}

function WorkspaceSettingsTab({
    setActivePopover,
}: {
    setActivePopover?: (value: string) => void;
}) {
    const [workspaceName, setWorkspaceName] = useState("");
    const [selectedColor, setSelectedColor] = useState("#008080");
    const [isUploadingRound, setIsUploadingRound] = useState(false);
    const [isUploadingRectangle, setIsUploadingRectangle] = useState(false);

    const {
        currentWorkspace,
        updateWorkspace,
        deleteWorkspace,
        isUpdatingWorkspace,
        isDeletingWorkspace,
    } = useTaskroomWorkspacetore();

    const uploadImage = async (file: File): Promise<string> => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "Uploads");

        const res = await fetch("https://uatapi.garage.app/api/s3upload/single", {
            method: "POST",
            body: formData,
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`S3 upload failed: ${res.status} ${errorText}`);
        }

        const json = await res.json();
        if (!json.success || !json.data?.url) {
            throw new Error("Invalid S3 response format");
        }
        return json.data.url;
    };

    const handleLogoUpload = async (file: File, type: "round" | "rectangle") => {
        if (!currentWorkspace?._id) {
            toast.error("No workspace selected");
            return;
        }

        const setLoader = type === "round" ? setIsUploadingRound : setIsUploadingRectangle;
        setLoader(true);

        try {
            const url = await uploadImage(file);
            const updateData =
                type === "round" ? { image_circle_url: url } : { image_square_url: url };
            await updateWorkspace(currentWorkspace._id, updateData);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to upload image";
            toast.error(message);
        } finally {
            setLoader(false);
        }
    };

    const handleNameUpdate = async () => {
        if (!currentWorkspace?._id || !workspaceName.trim()) {
            toast.error("Invalid workspace name");
            return;
        }

        try {
            await updateWorkspace(currentWorkspace._id, { name: workspaceName.trim() });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to update workspace name";
            toast.error(message);
        }
    };

    const handleDeleteWorkspace = async () => {
        if (!currentWorkspace?._id) return;
        try {
            const success = await deleteWorkspace(currentWorkspace._id);
            if (success) {
                setActivePopover?.("");
                window.dispatchEvent(new CustomEvent("sidebar:set-active-item", { detail: "" }));
            }
        } catch (error) {
            console.error("Workspace deletion failed:", error);
        }
    };

    useEffect(() => {
        if (currentWorkspace?.name) {
            setWorkspaceName(currentWorkspace.name);
            setSelectedColor(currentWorkspace.color);
        }
    }, [currentWorkspace]);

    const handleColorUpdate = async (color: string) => {
        if (!currentWorkspace?._id) {
            toast.error("No workspace selected");
            return;
        }

        try {
            setSelectedColor(color);
            await updateWorkspace(currentWorkspace._id, { color });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to update color";
            toast.error(message);
            setSelectedColor(currentWorkspace.color);
        }
    };

    const colors = [
        "#3C3C3C",
        "#4B0082",
        "#000080",
        "#8B008B",
        "#483D8B",
        "#191970",
        "#CC5500",
        "#008080",
        "#5C4033",
    ];

    return (
        <div className="flex flex-col gap-10 pb-6">
            <section>
                <h2 className="text-md font-semibold mb-4 text-white/80">General</h2>
                <div className="border border-[#e5e7eb29] rounded-lg bg-[#111116] divide-y divide-[#e5e7eb29] shadow-sm">
                    <div className="flex items-center justify-between p-3">
                        <span className="text-[13px] font-medium text-white/50">Name</span>
                        <div className="w-full max-w-sm flex items-center gap-2">
                            <Input
                                value={workspaceName}
                                onChange={(e) => setWorkspaceName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleNameUpdate();
                                }}
                                className="h-8 text-[13px] px-3 py-1 bg-[#111116] text-white/50 border border-[#e5e7eb29] shadow-none focus:border-[#e5e7eb29] focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-[13px] cursor-pointer font-medium bg-[#343439] text-white/50 hover:bg-[#343439] border-none disabled:bg-gray-500 disabled:text-white/50"
                                onClick={handleNameUpdate}
                                disabled={
                                    isUpdatingWorkspace ||
                                    !workspaceName.trim() ||
                                    workspaceName.trim() === currentWorkspace?.name
                                }
                            >
                                {isUpdatingWorkspace ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    "Save"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-md font-semibold text-white/80">Custom branding</h2>
                    <Badge
                        variant="secondary"
                        className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-sm px-1.5 py-0.5 text-[13px] font-normal"
                    >
                        Enterprise
                    </Badge>
                </div>

                <div className="border border-[#e5e7eb29] rounded-lg bg-[#111116] divide-y divide-[#e5e7eb29] shadow-sm">
                    <div className="flex items-center justify-between p-3">
                        <div className="space-y-1">
                            <div className="text-[13px] font-medium text-white/50">Round logo</div>
                            <div className="text-[13px] text-white/50">
                                We recommend a 72 x 72 px PNG file. This logo is used in-app as your Workspace avatar.
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <label htmlFor="round-logo-input" className="cursor-pointer group flex items-center gap-4">
                                <input
                                    id="round-logo-input"
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleLogoUpload(file, "round");
                                    }}
                                    disabled={isUploadingRound || isUploadingRectangle || isUpdatingWorkspace}
                                />
                                <div className="h-12 w-12 rounded-full border-2 border-dashed border-[#e5e7eb29] flex items-center justify-center overflow-hidden hover:border-indigo-500 transition-colors bg-[#111116]">
                                    {currentWorkspace?.image_circle_url ? (
                                        <img
                                            src={currentWorkspace.image_circle_url}
                                            alt="Round logo"
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <Plus className="h-4 w-4 text-white/50 group-hover:text-indigo-500" />
                                    )}
                                </div>
                                <div
                                    className={`h-8 px-3 rounded text-[13px] font-medium border flex items-center justify-center transition-colors ${
                                        isUploadingRound || isUploadingRectangle
                                            ? "bg-gray-100 text-white/50 cursor-not-allowed"
                                            : "bg-[#111116] text-white/50 border-[#e5e7eb29] hover:bg-[#343439]"
                                    }`}
                                >
                                    {isUploadingRound ? (
                                        <>
                                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                            Uploading...
                                        </>
                                    ) : currentWorkspace?.image_circle_url ? (
                                        "Change"
                                    ) : (
                                        "Add"
                                    )}
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3">
                        <span className="text-[13px] font-medium text-white/50">Color scheme</span>
                        <div className="flex items-center gap-3">
                            <div className="flex gap-2">
                                {colors.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => handleColorUpdate(color)}
                                        disabled={isUpdatingWorkspace}
                                        className={`w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-950 focus:ring-indigo-500 disabled:opacity-50 disabled:pointer-events-none ${
                                            selectedColor === color
                                                ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950 ring-gray-400"
                                                : ""
                                        }`}
                                        style={{ backgroundColor: color }}
                                        aria-label={`Select color ${color}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <h2 className="text-md font-semibold mb-4 text-white/80">Danger zone</h2>
                <div className="border border-red-900/30 rounded-lg bg-[#111116] shadow-sm">
                    <div className="flex items-center justify-between p-3">
                        <span className="text-[13px] font-medium text-white/50">Delete this Workspace forever</span>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    disabled={isDeletingWorkspace}
                                    className="text-red-600 text-[12px] border-red-200 bg-white hover:bg-red-500 hover:border-red-500 hover:text-white cursor-pointer disabled:opacity-50"
                                >
                                    {isDeletingWorkspace ? (
                                        <>
                                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                            Deleting...
                                        </>
                                    ) : (
                                        "Delete Workspace"
                                    )}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-[#111116] border-[#e5e7eb29] text-white">
                                <AlertDialogHeader>
                                    <AlertDialogTitle>
                                        Are you sure you want to delete this workspace: {currentWorkspace?.name}?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription className="text-white/50">
                                        This action cannot be undone. This will permanently delete your workspace and remove all of its data.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-[#343439] text-white/50 border-none hover:bg-[#343439]/80 hover:text-white">
                                        Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={handleDeleteWorkspace}
                                        disabled={isDeletingWorkspace}
                                        className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                                    >
                                        {isDeletingWorkspace ? "Deleting..." : "Continue"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default function WorkspaceSettingsPage({
    setActivePopover,
}: {
    setActivePopover?: (value: string) => void;
    setActiveItem?: (value: string) => void;
}) {
    const [activeTab, setActiveTab] = useState<SettingsTab>("workspace");
    const searchParams = useSearchParams();

    const {
        currentWorkspace,
        currentRoomDetail,
        spaceData: allSpaceData,
        activeSpaceId: storeActiveSpaceId,
    } = useTaskroomWorkspacetore();

    const workspaceId = searchParams.get("shareTask")
        ? searchParams.get("workspaceId")
        : currentWorkspace?._id;

    const currentSpaceId =
        searchParams.get("spaceId") ||
        currentRoomDetail?.spaceId ||
        storeActiveSpaceId;

    const spaceData = workspaceId ? allSpaceData[workspaceId as string] || [] : [];
    const currentSpace = currentSpaceId
        ? spaceData.find((s) => s._id === currentSpaceId)
        : undefined;

    const tabs: { id: SettingsTab; label: string; icon: React.ElementType; sublabel: string }[] = [
        {
            id: "workspace",
            label: "Workspace",
            icon: Building2,
            sublabel: capitalize(getWorkspaceDisplayName(currentWorkspace)),
        },
        {
            id: "space",
            label: "Space",
            icon: FolderKanban,
            sublabel: currentSpace?.name ? capitalize(currentSpace.name) : "No space selected",
        },
        {
            id: "room",
            label: "Room",
            icon: DoorOpen,
            sublabel: currentRoomDetail?.name ? capitalize(currentRoomDetail.name) : "No room selected",
        },
    ];

    return (
        <div className="flex h-full min-h-0 rounded-tr-lg rounded-br-lg py-3 pt-0 px-5">
            <div className="flex-1 min-h-0 overflow-hidden w-full flex flex-col">
                <div className="flex items-center gap-2 mb-4 shrink-0">
                    <Settings className="h-4 w-4 text-white/40" />
                    <h1 className="text-[15px] font-semibold text-white/75">Settings</h1>
                    <span className="text-[12px] text-white/30">— manage settings for your current selection</span>
                </div>

                <div className="flex gap-1 mb-4 shrink-0 p-1 rounded-xl border border-[#e5e7eb12]">
                    {tabs.map(({ id, label, icon: Icon, sublabel }) => {
                        const isActive = activeTab === id;
                        const isDisabled =
                            id === "space" ? !currentSpace : id === "room" ? !currentRoomDetail : !workspaceId;
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={(e) => {
                                    if (!isDisabled) setActiveTab(id);
                                    e.currentTarget.blur();
                                }}
                                disabled={isDisabled}
                                className={cn(
                                    "flex-1 flex flex-col items-start px-3 py-2 rounded-lg transition-all min-w-0 border border-transparent outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 [-webkit-tap-highlight-color:transparent]",
                                    isActive
                                        ? "bg-[#161616] border-[#e5e7eb15] focus:border-[#e5e7eb15] focus-visible:border-[#e5e7eb15] active:border-[#e5e7eb15] focus:bg-[#161616] active:bg-[#161616]"
                                        : "hover:bg-[#161616]/50 focus:bg-transparent focus:border-transparent focus-visible:border-transparent active:bg-[#161616]/50 active:border-transparent",
                                    isDisabled && "opacity-40 cursor-not-allowed"
                                )}
                            >
                                <div className="flex items-center gap-1.5 w-full">
                                    <Icon
                                        className={cn(
                                            "h-3.5 w-3.5 shrink-0",
                                            isActive ? "text-brand" : "text-white/35"
                                        )}
                                    />
                                    <span
                                        className={cn(
                                            "text-[12px] font-semibold truncate",
                                            isActive ? "text-white/80" : "text-white/45"
                                        )}
                                    >
                                        {label}
                                    </span>
                                </div>
                                <span className="text-[10px] text-white/30 truncate w-full mt-0.5 pl-5">{sublabel}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                    {activeTab === "workspace" && workspaceId && (
                        <WorkspaceSettingsTab setActivePopover={setActivePopover} />
                    )}
                    {activeTab === "workspace" && !workspaceId && (
                        <EmptyContext
                            icon={Building2}
                            message="Select a workspace from the sidebar to manage settings."
                        />
                    )}

                    {activeTab === "space" &&
                        (currentSpace && workspaceId ? (
                            <SpaceSettingsPanel
                                key={`${workspaceId}-${currentSpace._id}`}
                                space={currentSpace}
                                workspaceId={workspaceId as string}
                            />
                        ) : (
                            <EmptyContext
                                icon={FolderKanban}
                                message="Select a space from the sidebar to edit space settings."
                            />
                        ))}

                    {activeTab === "room" &&
                        (currentRoomDetail && currentSpaceId ? (
                            <RoomSettingsPanel
                                key={currentRoomDetail._id}
                                room={currentRoomDetail}
                            />
                        ) : (
                            <EmptyContext
                                icon={DoorOpen}
                                message="Select a room from the sidebar to edit room settings."
                            />
                        ))}
                </div>
            </div>
        </div>
    );
}

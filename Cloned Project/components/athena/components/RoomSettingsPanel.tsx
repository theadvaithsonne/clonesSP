"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { RoomStageSettingsPanel } from "./RoomStageSettingsPanel";
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
import { ImagePlus, LayoutGrid, List, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Room, useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";

const API_URL = "https://uatapi.garage.app";

const fieldClass =
    "h-8 text-[13px] px-3 py-1 bg-[#111116] text-white/50 border-none shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus:border-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-none";

const textareaClass =
    "resize-none min-h-[72px] text-[13px] bg-[#111116] border-none text-white/50 shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus:border-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-none";

type RoomSettingsTab = "general" | "stages";

interface RoomSettingsPanelProps {
    room: Room;
}

export function RoomSettingsPanel({ room }: RoomSettingsPanelProps) {
    const [activeTab, setActiveTab] = useState<RoomSettingsTab>("general");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const [bgImage, setBgImage] = useState("");
    const [iconPreview, setIconPreview] = useState("");
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [isUploadingIcon, setIsUploadingIcon] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const iconInputRef = useRef<HTMLInputElement>(null);

    const { updateRoom, deleteRoom, isRoomLoading, setCurrentRoomDetail } = useTaskroomWorkspacetore();

    useEffect(() => {
        if (!room) return;
        setName(room.name || "");
        setDescription(room.description || "");
        setBgImage(room.bgImage || "");
        setIconPreview(room.bgImage || "");
        setIsPrivate(Boolean(room.isPrivate));
        setIconFile(null);
    }, [room]);

    const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Images only");
            return;
        }
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

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error("Room name is required");
            return;
        }

        let finalBgImage = bgImage;
        if (iconFile) {
            setIsUploadingIcon(true);
            try {
                finalBgImage = await uploadIconToS3(iconFile);
                setBgImage(finalBgImage);
                setIconPreview(finalBgImage);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : "Failed to upload image";
                toast.error(message);
                setIsUploadingIcon(false);
                return;
            } finally {
                setIsUploadingIcon(false);
            }
        }

        await updateRoom(room._id, {
            name: name.trim(),
            description,
            bgImage: finalBgImage,
            isPrivate,
            members: [],
            setDefault: Boolean(room.setDefault),
            color: room.color ?? "",
        });
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const success = await deleteRoom(room._id);
            if (success) {
                setCurrentRoomDetail(null);
            }
        } finally {
            setIsDeleting(false);
        }
    };

    const isBusy = isRoomLoading || isUploadingIcon;
    const hasChanges =
        name.trim() !== (room.name || "") ||
        description !== (room.description || "") ||
        isPrivate !== Boolean(room.isPrivate) ||
        Boolean(iconFile);

    const roomTabs: { id: RoomSettingsTab; label: string; icon: React.ElementType }[] = [
        { id: "general", label: "General", icon: List },
        { id: "stages", label: "Stage Template", icon: LayoutGrid },
    ];

    return (
        <div className={cn("flex flex-col gap-6 pb-6", activeTab === "stages" && "min-h-0")}>
            <div className="flex gap-1 p-1 rounded-lg bg-[#111116] shrink-0">
                {roomTabs.map(({ id, label, icon: Icon }) => {
                    const isActive = activeTab === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={(e) => {
                                setActiveTab(id);
                                e.currentTarget.blur();
                            }}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent [-webkit-tap-highlight-color:transparent]",
                                isActive
                                    ? "bg-[#161616] text-white/80"
                                    : "text-white/40 hover:text-white/60 hover:bg-[#161616]/50"
                            )}
                        >
                            <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-brand" : "text-white/35")} />
                            {label}
                        </button>
                    );
                })}
            </div>

            {activeTab === "stages" && (
                <div className="min-h-0 overflow-x-auto -mx-1 px-1">
                    <RoomStageSettingsPanel key={room._id} roomId={room._id} />
                </div>
            )}

            {activeTab === "general" && (
            <>
            <section>
                <h2 className="text-md font-semibold mb-4 text-white/80">General</h2>
                <div className="space-y-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[13px] font-medium text-white/50">Icon & name</Label>
                            <div className="flex gap-3 items-center">
                                <button
                                    type="button"
                                    onClick={() => iconInputRef.current?.click()}
                                    disabled={isBusy}
                                    className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-[#343439] text-white/50 hover:bg-[#3d3d42] transition-colors overflow-hidden disabled:opacity-50"
                                >
                                    {iconPreview ? (
                                        <img src={iconPreview} alt="Room icon" className="h-full w-full object-cover" />
                                    ) : (
                                        <ImagePlus className="w-5 h-5 text-white/40" />
                                    )}
                                </button>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSave();
                                    }}
                                    placeholder="Room name"
                                    className={fieldClass}
                                />
                                {iconPreview && (
                                    <button type="button" onClick={removeIcon} className="text-white/40 hover:text-white transition-colors">
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                                <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={handleIconSelect} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[13px] font-medium text-white/50">
                                Description <span className="font-normal">(optional)</span>
                            </Label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What's this room for?"
                                className={textareaClass}
                            />
                        </div>

                        <div className="flex items-center justify-between pt-1">
                            <div>
                                <Label className="text-[13px] font-medium text-white/50 block">Public Room</Label>
                                <p className="text-[12px] text-white/35 mt-0.5">All workspace members can access</p>
                            </div>
                            <Switch
                                checked={!isPrivate}
                                onCheckedChange={(v) => setIsPrivate(!v)}
                                className="data-[state=checked]:bg-brand"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[13px] cursor-pointer font-medium bg-[#343439] text-white/50 hover:bg-[#343439] border-none disabled:opacity-50"
                            onClick={handleSave}
                            disabled={isBusy || !name.trim() || !hasChanges}
                        >
                            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save changes"}
                        </Button>
                    </div>
                </div>
            </section>

            <section>
                <h2 className="text-md font-semibold mb-4 text-white/80">Danger zone</h2>
                <div className="flex items-center justify-between py-1">
                        <span className="text-[13px] font-medium text-white/50">Delete this Room forever</span>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    disabled={isDeleting}
                                    className="text-red-600 text-[12px] border-red-200 bg-white hover:bg-red-500 hover:border-red-500 hover:text-white cursor-pointer disabled:opacity-50"
                                >
                                    {isDeleting ? (
                                        <>
                                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                            Deleting...
                                        </>
                                    ) : (
                                        "Delete Room"
                                    )}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-[#111116] border-[#e5e7eb29] text-white">
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete room: {room.name}?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-white/50">
                                        This action cannot be undone. All tasks and data in this room will be permanently removed.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-[#343439] text-white/50 border-none hover:bg-[#343439]/80 hover:text-white">
                                        Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={handleDelete}
                                        disabled={isDeleting}
                                        className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                                    >
                                        {isDeleting ? "Deleting..." : "Continue"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                </div>
            </section>
            </>
            )}
        </div>
    );
}

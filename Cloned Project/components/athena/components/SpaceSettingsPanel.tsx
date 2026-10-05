"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useSpaceStore } from "@/store/taskroom/spaceStore";
import { space, useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";

const API_URL = "https://uatapi.garage.app";

function getIconUrl(image: unknown) {
    if (!image) return "";
    if (typeof image === "string") return image;
    if (typeof image === "object" && image !== null) {
        const obj = image as Record<string, string>;
        return obj.url || obj.value || obj.path || "";
    }
    return "";
}

function getBooleanValue(value: unknown) {
    if (typeof value === "boolean") return value;
    if (typeof value === "object" && value !== null) {
        const obj = value as Record<string, unknown>;
        return Boolean(obj.value ?? obj.isPrivate ?? obj.enabled ?? value);
    }
    return Boolean(value);
}

const fieldClass =
    "h-8 text-[13px] px-3 py-1 bg-[#111116] text-white/50 border-none shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus:border-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-none";

const textareaClass =
    "resize-none min-h-[72px] text-[13px] bg-[#111116] border-none text-white/50 shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus:border-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-none";

interface SpaceSettingsPanelProps {
    space: space & { description?: string; color?: string; image?: unknown; isPrivate?: unknown };
    workspaceId: string;
}

export function SpaceSettingsPanel({ space, workspaceId }: SpaceSettingsPanelProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const [iconPreview, setIconPreview] = useState("");
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [isUploadingIcon, setIsUploadingIcon] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const iconInputRef = useRef<HTMLInputElement>(null);

    const { updateSpace, deleteSpace, isCreating } = useSpaceStore();
    const { fetchspaces } = useTaskroomWorkspacetore();

    useEffect(() => {
        if (!space) return;
        setName(space.name || "");
        setDescription(space.description || "");
        setIsPrivate(getBooleanValue(space.isPrivate));
        const iconValue = getIconUrl(space.image);
        setIconPreview(/^https?:\/\//i.test(iconValue) ? iconValue : "");
        setIconFile(null);
    }, [space]);

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
        fd.append("folder", "space-icons");
        const res = await fetch(`${API_URL}/api/s3upload/multiple`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const json = await res.json();
        if (!json.success || !json.data?.[0]?.url) throw new Error("Invalid upload response");
        return json.data[0].url as string;
    };

    const removeIcon = () => {
        setIconFile(null);
        setIconPreview("");
        if (iconInputRef.current) iconInputRef.current.value = "";
    };

    const handleSave = async () => {
        if (!space._id) return;
        if (!name.trim()) {
            toast.error("Space name is required");
            return;
        }

        let iconUrl = iconPreview;
        if (iconFile) {
            setIsUploadingIcon(true);
            try {
                iconUrl = await uploadIconToS3(iconFile);
                setIconPreview(iconUrl);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : "Failed to upload image";
                toast.error(message);
                setIsUploadingIcon(false);
                return;
            } finally {
                setIsUploadingIcon(false);
            }
        }

        await updateSpace(space._id, {
            name: name.trim(),
            description,
            color: space.color || "#6366f1",
            image: iconUrl || getIconUrl(space.image) || "Layout",
            spaceCode: name.substring(0, 3).toUpperCase(),
            isPrivate,
            workspaceId,
            members: [],
        });
    };

    const handleDelete = async () => {
        if (!space._id) return;
        setIsDeleting(true);
        try {
            const success = await deleteSpace(space._id);
            if (success) {
                await fetchspaces(workspaceId, 1, true);
            }
        } finally {
            setIsDeleting(false);
        }
    };

    const isBusy = isCreating || isUploadingIcon;
    const hasChanges =
        name.trim() !== (space.name || "") ||
        description !== (space.description || "") ||
        isPrivate !== getBooleanValue(space.isPrivate) ||
        Boolean(iconFile);

    return (
        <div className="flex flex-col gap-8 pb-6">
            <section>
                {/* <h2 className="text-md font-semibold mb-4 text-white/80">General</h2> */}
                <div className="space-y-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <h2 className="text-md font-semibold mb-4 text-white/80">Icon & name</h2>
                            {/* <Label className="text-[13px] font-medium text-white/50">Icon & name</Label> */}
                            <div className="flex gap-3 items-center">
                                <button
                                    type="button"
                                    onClick={() => iconInputRef.current?.click()}
                                    disabled={isBusy}
                                    className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-[#343439] text-white/50 hover:bg-[#3d3d42] transition-colors overflow-hidden disabled:opacity-50"
                                >
                                    {iconPreview ? (
                                        <img src={iconPreview} alt="Space icon" className="h-full w-full object-cover" />
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
                                    placeholder="e.g. Marketing, Engineering"
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

                            <h2 className="text-md font-semibold mb-4 text-white/80">Description <span >(optional)</span></h2>
                            {/* <Label className="text-[13px] font-medium text-white/50">
                                Description <span className="font-normal">(optional)</span>
                            </Label> */}
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className={textareaClass}
                            />
                        </div>

                        <div className="flex items-center justify-between pt-1">
                            <div>
                                {/* <Label className="text-[13px] font-medium text-white/50 block">Make Private</Label> */}
                                  <h2 className="text-md font-semibold text-white/80">Make Private</h2>
                                <p className="text-[12px] text-white/35 mt-0.5">Only you and invited members have access</p>
                            </div>
                            <Switch
                                checked={isPrivate}
                                onCheckedChange={setIsPrivate}
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
                    <span className="text-[13px] font-medium text-white/50">Delete this Space forever</span>
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
                                    "Delete Space"
                                )}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-[#111116] border-[#e5e7eb29] text-white">
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete space: {space.name}?</AlertDialogTitle>
                                <AlertDialogDescription className="text-white/50">
                                    This action cannot be undone. All rooms and tasks in this space will be permanently removed.
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
        </div>
    );
}

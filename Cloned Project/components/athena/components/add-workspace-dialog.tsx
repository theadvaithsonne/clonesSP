"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Briefcase, GraduationCap, User, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useUIStore } from "@/store/taskroom/uiStore";
import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";

type UsageType = "Work" | "Personal" | "School";

const USAGE_OPTIONS: { type: UsageType; icon: typeof Briefcase; hint: string }[] = [
    { type: "Work", icon: Briefcase, hint: "Teams & projects" },
    { type: "Personal", icon: User, hint: "Just for you" },
    { type: "School", icon: GraduationCap, hint: "Classes & study" },
];

const btnClass =
    "h-10 px-5 rounded-lg bg-brand text-brand-foreground hover:bg-brand/90 font-medium shadow-none";

export function AddWorkspaceDialog({
    open,
    onOpenChange,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated?: () => void;
}) {
    const [step, setStep] = useState(1);
    const [usage, setUsage] = useState<UsageType | null>(null);
    const [workspaceName, setWorkspaceName] = useState("");

    const totalSteps = 2;
    const progress = (step / totalSteps) * 100;

    const { createWorkspaceAndSpaceAndRooms, isLoadingWorkspacesAndSpaceAndRooms } = useTaskroomWorkspacetore();
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleNext = async () => {
        if (step === totalSteps) {
            try {
                const response = await createWorkspaceAndSpaceAndRooms(usage || "Personal", workspaceName, router);
                if (!response?.status) {
                    return;
                }

                const params = new URLSearchParams(searchParams.toString());
                params.delete("spaceId");
                params.delete("roomId");
                if (response.workspace?._id) {
                    params.set("workspaceId", response.workspace._id);
                }
                if (response.spaceData?._id) {
                    params.set("spaceId", response.spaceData._id);
                }
                if (response.room?._id) {
                    params.set("roomId", response.room._id);
                }
                router.replace(`?${params.toString()}`);

                onCreated?.();

                setWorkspaceName("");
                setStep(1);
                setUsage(null);
                useUIStore.getState().setShowAddWorkspace(false);
                onOpenChange(false);
            } catch (error) {
                console.error(error);
            }
        } else {
            setStep((prev) => Math.min(prev + 1, totalSteps));
        }
    };

    const handleBack = () => {
        setStep((prev) => Math.max(prev - 1, 1));
    };

    const canContinue = step === 1 ? !!usage : workspaceName.trim().length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100%-1rem)] max-w-lg p-0 overflow-hidden max-h-[90dvh] flex flex-col bg-[#0a0a0d] border border-[#e5e7eb29] shadow-2xl sm:rounded-2xl outline-none">
                <DialogHeader className="px-6 pt-6 pb-0">
                    <DialogTitle className="flex items-center justify-between">
                        <span className="text-base font-semibold text-white">New workspace</span>
                        <span className="text-xs font-medium text-white/40">
                            Step {step} of {totalSteps}
                        </span>
                    </DialogTitle>
                    <div className="mt-4 h-1 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                            className="h-full bg-brand transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </DialogHeader>

                <div className="flex-1 flex flex-col px-6 py-8 min-h-[280px]">
                    {step === 1 && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <h2 className="text-lg font-semibold text-white">What is this workspace for?</h2>
                            <p className="mt-1 mb-6 text-sm text-white/45">Pick one. You can change this later.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {USAGE_OPTIONS.map(({ type, icon: Icon, hint }) => {
                                    const selected = usage === type;
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setUsage(type)}
                                            className={cn(
                                                "flex flex-col items-start gap-2 rounded-xl border px-4 py-4 text-left transition-all",
                                                selected
                                                    ? "border-brand bg-brand text-brand-foreground"
                                                    : "border-[#e5e7eb29] bg-[#121217] text-white hover:border-brand/50"
                                            )}
                                        >
                                            <Icon className={cn("h-5 w-5", selected ? "text-black" : "text-brand")} />
                                            <span className="text-sm font-semibold">{type}</span>
                                            <span className={cn("text-xs", selected ? "text-black/70" : "text-white/40")}>
                                                {hint}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <h2 className="text-lg font-semibold text-white">Name your workspace</h2>
                            <p className="mt-1 mb-6 text-sm text-white/45">
                                Use your company or team name.
                            </p>
                            <Input
                                autoFocus
                                value={workspaceName}
                                onChange={(e) => setWorkspaceName(e.target.value)}
                                placeholder="e.g. Acme Studio"
                                className="h-12 text-base px-4 bg-[#121217] text-white placeholder:text-white/30 border-[#e5e7eb29] rounded-xl focus-visible:ring-1 focus-visible:ring-brand focus-visible:border-brand"
                            />
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 pb-6">
                    {step > 1 && (
                        <Button type="button" onClick={handleBack} className={btnClass}>
                            <ChevronLeft className="mr-1 h-4 w-4" /> Back
                        </Button>
                    )}
                    <Button
                        type="button"
                        onClick={handleNext}
                        disabled={!canContinue || isLoadingWorkspacesAndSpaceAndRooms}
                        className={cn(btnClass, "disabled:opacity-40 disabled:hover:bg-brand")}
                    >
                        {step === totalSteps
                            ? isLoadingWorkspacesAndSpaceAndRooms
                                ? "Creating…"
                                : "Finish"
                            : "Next"}
                        {step === totalSteps ? (
                            <Check className="ml-1 h-4 w-4" />
                        ) : (
                            <ChevronRight className="ml-1 h-4 w-4" />
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

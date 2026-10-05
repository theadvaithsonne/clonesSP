"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Check, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useWorkspaceStore } from "@/store/taskroom/workspaceStore";
import { useTemplateStore } from "@/store/taskroom/templateStore";
import { useRouter } from "next/navigation";

// Types
type UsageType = "Work" | "Personal" | "School";
type ManageType = "Support" | "Sales & CRM" | "Marketing" | "HR & Recruiting" | "Creative & Design" | "IT" | "Finance & Accounting" | "Professional Services" | "Software Development" | "Operations";
type SourceType = "Friend / Colleague" | "Podcasts / Radio" | "TikTok" | "Software Review Sites" | "Reddit" | "LinkedIn" | "AI Tools" | "YouTube" | "TV / Streaming" | "Facebook / Instagram" | "Search Engine" | "Other";

export function AddWorkspaceDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [step, setStep] = useState(1);
    const [usage, setUsage] = useState<UsageType | null>(null);
    const [manage, setManage] = useState<ManageType | null>(null);
    const [source, setSource] = useState<SourceType | null>(null);
    const [emails, setEmails] = useState<string[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [showSkipConfirm, setShowSkipConfirm] = useState(false);
    const [workspaceName, setWorkspaceName] = useState("");

    const totalSteps = 2;
    const progress = (step / totalSteps) * 100;

    const { createWorkspaceAndSpaceAndRooms, isLoadingWorkspacesAndSpaceAndRooms } = useWorkspaceStore();
    const { setIsOpenTempate } = useTemplateStore();
    const router = useRouter();

    const handleNext = async () => {
        // setIsOpenTempate(true);
        if (step === totalSteps) {
            // Submit logic


            // if (step == 2) {
            //     setIsOpenTempate(true);
            // }

            try {
                const response = await createWorkspaceAndSpaceAndRooms(usage || "Personal", workspaceName, router);
                console.log("response123fxcsdfsdf", response)

                if (response?.status) {
                    setWorkspaceName("");
                    setStep(1);
                    setUsage(null);
                    onOpenChange(false);
                    // setIsOpenTempate(true);
                }
            } catch (error) {
                console.error(error);
            }
        } else {
            // if (step == 2) {
            //     setIsOpenTempate(true);
            // }
            setStep((prev) => Math.min(prev + 1, totalSteps));
        }
    };

    const handleBack = () => {
        setStep((prev) => Math.max(prev - 1, 1));
    };

    const handleAddEmail = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && inputValue.trim()) {
            setEmails([...emails, inputValue.trim()]);
            setInputValue("");
        }
    };

    const removeEmail = (email: string) => {
        setEmails(emails.filter((e) => e !== email));
    };

    const Logo = () => (
        <div className="flex items-center gap-2">
            {/* Placeholder for Logo - Using a colorful icon to mimic ClickUp branding */}
            <div className="relative h-6 w-6 overflow-hidden rounded-md bg-gradient-to-br from-purple-500 to-pink-500">
                <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs">
                    T
                </div>
            </div>
            <span className="font-bold text-lg text-slate-800">Taskroom</span>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden h-[600px] flex flex-col bg-white border-none shadow-2xl sm:rounded-xl outline-none">
                {/* Header */}
                <DialogHeader>
                    <DialogTitle>
                        <div className="flex items-center justify-between px-8 py-6">
                            <Logo />
                            {step === 1 && <div className="text-sm font-medium text-slate-600">Welcome, Kamal!</div>}
                        </div>
                    </DialogTitle>
                </DialogHeader>


                {/* Content Area */}
                <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-16 w-full max-w-5xl mx-auto relative">

                    {/* Step 1: Usage */}
                    {step === 1 && (
                        <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
                            <h2 className="text-2xl font-semibold mb-10 text-slate-900">What would you like to use Taskroom for?</h2>
                            <div className="flex flex-wrap justify-center gap-4">
                                {(["Work", "Personal", "School"] as UsageType[]).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setUsage(type)}
                                        className={cn(
                                            "min-w-[120px] px-8 py-2 rounded-full text-base font-medium border transition-all duration-200",
                                            usage === type
                                                ? "bg-slate-900 text-white border-slate-900 shadow-lg scale-105"
                                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                        )}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Name */}
                    {step === 2 && (
                        <div className="flex flex-col items-center justify-center w-full max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-2xl font-semibold mb-8 text-slate-900 leading-tight text-center">Lastly, what would you like to name your Workspace?</h2>
                            <div className="w-full">
                                <Input
                                    value={workspaceName}
                                    onChange={(e) => setWorkspaceName(e.target.value)}
                                    className="h-14 text-lg px-4 border border-slate-300 rounded-lg focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0"
                                />
                                <p className="text-left text-sm text-slate-500 mt-2">Try the name of your company or organization.</p>
                            </div>
                        </div>
                    )}



                </div>

                {/* Footer */}
                <div className={cn("p-8 transition-opacity duration-300", showSkipConfirm && step === 4 ? "opacity-20 pointer-events-none" : "opacity-100")}>
                    <div className="flex items-center justify-between relative">
                        {/* Progress Bar */}
                        <div className="absolute bottom-4 left-0 h-1 bg-slate-100 w-48 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-slate-900 transition-all duration-300 ease-out"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center justify-between w-full">
                            <div className="ml-52"> {/* Spacer for progress bar */} </div>

                            <div className="flex gap-4 ml-auto">
                                {step > 1 && (
                                    <Button
                                        variant="outline"
                                        onClick={handleBack}
                                        className="h-10 px-6 rounded-lg font-medium text-slate-600 border-slate-200 hover:bg-slate-50"
                                    >
                                        <ChevronLeft className="mr-1 h-4 w-4" /> Back
                                    </Button>
                                )}
                                <Button
                                    onClick={handleNext}
                                    disabled={isLoadingWorkspacesAndSpaceAndRooms}
                                    className="h-10 px-6 rounded-lg bg-slate-900 text-white hover:bg-[#343439] font-medium transition-all"
                                >
                                    {step === totalSteps ? isLoadingWorkspacesAndSpaceAndRooms ? "Loading.." : "Finish" : "Next"} {step === totalSteps ? <Check className="ml-1 h-4 w-4" /> : <ChevronRight className="ml-1 h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

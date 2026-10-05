"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/taskroom/uiStore";
import { AlertCircle, Plus } from "lucide-react";

export default function InvalidWorkspacePage() {
    const { setShowAddWorkspace } = useUIStore();

    return (
        <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-6 text-center">
            <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full">
                <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-3">Invalid Workspace</h1>
                <p className="text-slate-600 mb-8 leading-relaxed">
                    We couldn't find a valid workspace for your account. Please create a new one to get started with Taskroom.
                </p>
                <Button
                    onClick={() => setShowAddWorkspace(true)}
                    className="bg-slate-900 text-white hover:bg-[#343439] h-11 px-8 rounded-lg w-full transition-all flex items-center justify-center gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Create New Workspace
                </Button>
            </div>
        </div>
    );
}

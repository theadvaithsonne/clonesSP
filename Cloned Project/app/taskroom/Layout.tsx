"use client";

import React, { useEffect } from "react";

import { usePathname, useRouter, useParams } from "next/navigation";
import { Toaster } from "sonner";
import { Plus, ChevronRight } from "lucide-react";
import { TaskroomSidebar } from "./components/taskroom-sidebar";
import { AddWorkspaceDialog } from "./components/add-workspace-dialog";
import { useUIStore } from "@/store/taskroom/uiStore";
import { TaskStageTemplateDialog } from './components/task-stage-template-dialog';

import { useState } from "react";
import Link from "next/link";
import { useWorkspaceStore } from "@/store/taskroom/workspaceStore";
import { useListViewDetailStore } from "@/store/taskroom/listViewDetailStore";
import { TopNav } from './components/top-nav'
import Cookies from 'js-cookie';
import { WorkspaceLoading } from "@/components/shared/WorkspaceLoading";
export default function PostLoginLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isSupportDashboard = pathname.startsWith(`${process.env.NEXT_PUBLIC_TASKROOM_URL}/dashboard/support`);
    const { showAddWorkspace, setShowAddWorkspace } = useUIStore();
    const { isLoadingRoom } = useListViewDetailStore()
    const { isLoadingWorkspacesAndSpaceAndRooms, fetchWorkspacesAndSpaceAndRooms, fetchWorkspaceById } = useWorkspaceStore();
    const [isVerifying, setIsVerifying] = useState(true);
    const router = useRouter();
    const params = useParams();
    const workspaceId = params?.workspace as string;
    const Idspace = params?.space as string;

    useEffect(() => {
        async function initialize() {
            try {
                // 1. Verify User
                const token = localStorage.getItem("garage_tok");
                if (!token) {
                    router.push('/workspace');
                    return;
                }

                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_TASKROOM_URL}users/profile`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                if (!res.ok) {
                    router.push('/workspace');
                    return;
                }

                const data = await res?.json();
                const result = data?.data;
                Cookies.set("TaskRoomUserDetails", JSON.stringify(result));

                // 2. Fetch Workspace Data (if applicable)
                if (workspaceId) {
                    await fetchWorkspaceById(workspaceId);
                }

                if (!pathname.includes('settings')) {
                    await fetchWorkspacesAndSpaceAndRooms(router, workspaceId, Idspace);
                }

                setIsVerifying(false);

            } catch (err) {
                console.error("Initialization failed:", err);
                router.push('/workspace');
            }
        }

        initialize();
    }, []); // Re-run if workspaceId changes to ensure data stays in sync

    return (
        <>
            <Toaster position="top-center" />
            {(isLoadingWorkspacesAndSpaceAndRooms || isVerifying) ? (
                <WorkspaceLoading textClass="text-slate-500" />
            ) : (
                <div className="h-screen flex flex-col bg-[#0a0a0d] overflow-hidden">

                    <TopNav /> {/* ← assumed to have fixed or auto height */}

                    {/* Main content area takes remaining space */}
                    <div className="flex-1 flex overflow-hidden p-2 min-h-0">
                        <TaskroomSidebar /> {/* ← assumed to have proper height handling */}

                        <div className="flex-1 overflow-hidden min-h-0 min-w-0">
                            <main className="h-full w-full overflow-hidden">
                                {children}
                            </main>
                        </div>
                    </div>
                    <AddWorkspaceDialog
                        open={showAddWorkspace}
                        onOpenChange={setShowAddWorkspace}
                    />
                    {/* <TaskStageTemplateDialog /> */}
                </div>
            )}

        </>
    );
}

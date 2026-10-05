"use client";

import { WorkspaceLoading } from "@/components/shared/WorkspaceLoading";

export default function TaskroomRootPage() {
    // useEffect(() => {
    //   fetchWorkspaces();
    // }, []);

    // useEffect(() => {
    //     if (!isLoading) {
    //         const firstWorkspaceId = workspaces?.[0]?._id;
    //         const firstWorkspaceSpaces = firstWorkspaceId ? spaceData[firstWorkspaceId] : [];
    //         if (workspaces && workspaces.length > 0 && firstWorkspaceSpaces && firstWorkspaceSpaces.length > 0) {
    //             router.replace(`/${firstWorkspaceId}/${firstWorkspaceSpaces[0]?._id}`);
    //         } else {
    //             setShowAddWorkspace(true)
    //         }
    //     }
    // }, [workspaces, isLoading, spaceData, router]);

    return <WorkspaceLoading backgroundClass="bg-[#111116]" textClass="text-slate-500" />;
}

"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
    Users,
    Settings,
    LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchParams, useParams } from "next/navigation"
const sidebarItems = [
    { icon: Users, label: "People", href: "people" },
    { icon: Settings, label: "Settings", href: "general" },
    // add more items here when needed
];

export default function SettingSidebar() {
    const pathname = usePathname();
    const router = useRouter();

    // Keep the workspace portion from the current path
    const basePath = pathname.split("/settings/")[0];
    const searchParams = useSearchParams();
    const { workspace, space } = useParams()
    const roomId = searchParams.get('roomId');
    const workspaceId = workspace as string
    const Idspace = space as string
    const handleClick = (href: string) => {
        router.push(`/taskroom/${workspaceId}/settings/${href?.toLocaleLowerCase()}/${Idspace}?roomId=${roomId}`);
    };

    return (
        <div
            className={cn(
                "min-w-[256px] max-w-[256px] flex-1 border  border-[#e5e7eb29]  flex flex-col  bg-[#111116]",
                "rounded-tl-xl rounded-bl-xl ",
                // or shorter:
                // "rounded-tl-lg rounded-bl-lg rounded-br-lg"
            )}
        >
            <div className="p-2 h-full overflow-y-auto no-scrollbar">
                <div className="flex items-center justify-between mb-6 px-1">
                    <h2 className="text-lg font-bold text-white tracking-tight">
                        All settings
                    </h2>
                </div>

                <div className="mb-6">
                    <h3 className="px-3 text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider">
                        Workspace
                    </h3>
                    <nav className="space-y-0.5">
                        {sidebarItems.map((item) => {
                            const isActive = pathname.toLowerCase().includes(`/settings/${item.href.toLowerCase()}`);
                            return (
                                <button
                                    key={item.label}
                                    onClick={() => handleClick(item.href)}
                                    className={cn(
                                        "w-full flex  cursor-pointer items-center gap-2.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors text-left",
                                        isActive
                                            ? "text-white bg-[#343439]"
                                            : "text-gray-400 hover:bg-[#343439] hover:text-white"
                                    )}
                                >
                                    <item.icon
                                        className={cn(
                                            "h-[16px] w-[16px]",
                                            isActive ? "text-white" : "text-gray-400"
                                        )}
                                    />
                                    {item.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </div>
        </div>
    );
}
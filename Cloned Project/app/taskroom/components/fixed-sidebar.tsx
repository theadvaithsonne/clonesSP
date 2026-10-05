import React from 'react'
import {
    Plus,
    Inbox,
    MessageSquareReply,
    MessageCircle,
    CheckSquare,
    MoreHorizontal,
    ChevronLeft,
    ChevronRight,
    LayoutList,
    CalendarDays,
    FolderKanban,
    FolderOpen,
    Lock,
    FileText,
    Search,
    SlidersHorizontal,
    Star,
    Users,
    House,
    Sparkles,
    UserPlus,
    Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/uiStore";
import { usePathname } from "next/navigation";
import Link from "next/link";
export default function Fixedsidebar() {
    const collapsed = useUIStore((state) => state.sidebarCollapsed);
    const toggle = useUIStore((state) => state.toggleSidebar);
    const pathname = usePathname();
    const segments = pathname.split('/').filter(Boolean);

    function isDoubleIdRoute(pathname: string): boolean {
        // Matches: /ID1/ID2  or  /ID1/ID2/
        // Does NOT match: /ID1/ID2/xxx, /ID1, /ID1/ID2extra/, etc.
        return /^\/[0-9a-f]{24}\/[0-9a-f]{24}\/?$/.test(pathname.toLowerCase());
    }
    const shouldShowExpandButton = isDoubleIdRoute(pathname);
    return (
        <aside
            className={cn(
                "hidden flex-none flex-col bg-[#581c87] shadow-lg sm:flex",
                "w-[72px] min-w-[72px] rounded-lg"
            )}
        >

            <div
                className="
    flex flex-col items-center py-4 gap-4 flex-1 w-full
    overflow-y-auto overflow-x-hidden
    [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden
  "
            >
                {
                    shouldShowExpandButton &&
                    <button
                        type="button"
                        onClick={toggle}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-white/90 transition-colors flex-shrink-0"
                        aria-label="Expand sidebar"
                    >
                        <span className="flex -space-x-1.5">
                            <ChevronRight className="h-4 w-4" />
                            <ChevronRight className="h-4 w-4" />
                        </span>

                    </button>
                }



                <nav className="flex flex-1 flex-col items-center gap-3 w-full">
                    {
                        shouldShowExpandButton &&
                        <div className="h-px w-8 bg-purple-400/30 my-1" />
                    }

                    <NavItemCollapsed icon={House} label="Home" />
                    <NavItemCollapsed icon={Inbox} label="Inbox" />
                    <NavItemCollapsed icon={MessageSquareReply} label="Replies" />
                    <NavItemCollapsed icon={MessageCircle} label="Comments" />
                    <NavItemCollapsed icon={CheckSquare} label="My Tasks" />

                    <div className="h-px w-8 bg-purple-400/30 my-1" />

                    <NavItemCollapsed icon={FolderKanban} label="Garage" />
                    <NavItemCollapsed icon={Users} label="Team" badge={9} />
                    <NavItemCollapsed icon={FileText} label="Docs" href="/docs" />

                    <div className="h-px w-8 bg-purple-400/30 my-1" />

                    <NavItemCollapsed icon={LayoutList} label="List" />
                    <NavItemCollapsed icon={CalendarDays} label="Calendar" />
                </nav>

                <div className="mt-auto pt-4">
                    <NavItemCollapsed icon={Plus} label="Create" />
                </div>
            </div>

        </aside>
    )
}
function NavItemCollapsed({
    icon: Icon,
    label,
    badge,
    active,
    href,
}: {
    icon: React.ElementType;
    label: string;
    badge?: number;
    active?: boolean;
    href?: string;
}) {
    const content = (
        <>
            <span className="relative">
                <Icon className={cn("h-5 w-5", active ? "text-purple-700" : "text-white/90")} strokeWidth={2} />
                {badge !== undefined && badge > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                        {badge}
                    </span>
                )}
            </span>
            <span className="text-[10px] font-medium leading-tight text-center max-w-[48px] truncate">
                {label}
            </span>
        </>
    );

    const className = cn(
        "flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition-colors min-w-[48px]",
        active
            ? "bg-white text-purple-900 shadow-sm"
            : "text-white/90 hover:bg-white/10"
    );

    if (href) {
        return <Link href={href} className={className}>{content}</Link>;
    }

    return (
        <button
            type="button"
            className={className}
        >
            {content}
        </button>
    );
}
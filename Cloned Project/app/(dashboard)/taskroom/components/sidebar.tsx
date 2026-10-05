"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUIStore } from "@/store/uiStore";
// import { useAuthStore } from "@/store/authStore";
import { useSidebarStore } from "@/store/sidebarStore";
import { useIsMobile } from "@/hooks/use-mobile";
import {
    Building2,
    // CalendarDays,
    SquareKanban,
    CreditCard,
    HardDrive,
    LayoutDashboard,
    Lightbulb,
    LucideIcon,
    Sparkles,
    // Receipt,
    RotateCcw,
    UserPlus,
    Wallet,
    BriefcaseIcon,
    Layers,
    ImageIcon,
    Send,
    MessageSquare,
    Globe2,
    HeadsetIcon,
    UserCircle,
    Nfc,
    Terminal,
    Coins,
    StretchHorizontal,
    Share,
    Computer,
    DollarSign,
    Network,
    CalendarSync,
    CalendarCheck2,
    CheckCircle,
    ShieldCheck,
    BriefcaseBusiness,
    Umbrella,
    Mail,
    Bell,
    Settings,
    ListTodo,
    LayoutTemplate,
    ChartColumn,
    FolderOpen,
    UserCheck,
    Briefcase,
    Bug,
    Ticket,
    Store
    // MessageSquare,
} from "lucide-react";
// Chat components import
import {
    PlusSquare,
    Inbox,

    File,
    Trash2,
    Archive,
    ArchiveX,
    AlertCircle,
    Users2,
    ShoppingCart,
    PenSquare,
    X,
    Menu,
    LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
// import { BrandLogo } from "@/app/components/brand-logo";
import { Separator } from "@/components/ui/separator";
import { Nav } from "./nav";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import Image from "next/image";
import { apps, getAppMenuItems } from "@/lib/taskroomApps";
// import { AppSidebar } from "@/app/components/app-sidebar";

// Helper function to render sidebar content
function SidebarContent({
    isMobile = false,
    isCollapsed = false,
    currentApp,
    isInboxPage,
    isVoicemailsPage,
    currentAppMenuItems,
    router,
    pathname,
    setIsMobileMenuOpen,
    getDynamicId,
    onToggleCollapse,
    user,
    onLogout
}: {
    isMobile?: boolean;
    isCollapsed?: boolean;
    currentApp: any;
    isInboxPage: boolean;
    isVoicemailsPage: boolean;
    currentAppMenuItems: any[];
    router: any;
    pathname: string;
    setIsMobileMenuOpen?: (open: boolean) => void;
    getDynamicId: (path: string) => string;
    onToggleCollapse?: () => void;
    user: any;
    onLogout: () => void;
}) {
    // Chat-related state and hooks
    const [showUserSearch, setShowUserSearch] = useState(false);
    const [showGroupSearch, setShowGroupSearch] = useState(false);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    console.log("currentApp", currentApp)

    // Convert auth store user to chat user format
    const currentUser = user ? {
        _id: user.userId,
        name: user.name,
        email: user.email,
        isActive: true,
        role: user.role,
        isOnline: true,
    } : null;
    return (
        <>
            {/* Black overlay */}
            <div className="absolute inset-0 bg-[#0e0e12]/90 backdrop-blur-xl" />

            {/* Header with Current Section Icon & Name */}
            <div className="h-16 border-b border-[#e5e7eb29] flex items-center justify-between px-4 flex-shrink-0 bg-[#0e0e12]/50 relative z-10">
                <div
                    className="flex items-center gap-3 cursor-pointer flex-1"
                    onClick={() => {
                        if (isMobile && setIsMobileMenuOpen) {
                            setIsMobileMenuOpen(false);
                        } else if (!isMobile && onToggleCollapse) {
                            onToggleCollapse();
                        }
                    }}
                >
                    {currentApp ? (
                        <>
                            <div className="h-5 w-5 flex items-center justify-center">
                                {typeof currentApp.icon === "string" ? (
                                    <Image
                                        src={currentApp?.icon}
                                        alt={currentApp?.name}
                                        width={20}
                                        height={20}
                                    />
                                ) : (
                                    <currentApp.icon className="h-5 w-5" />
                                )}
                            </div>
                            {(!isCollapsed || isMobile) && (
                                <span className="font-medium text-lg">{currentApp.name}</span>
                            )}
                        </>
                    ) : (
                        ""
                        // <BrandLogo className="text-sm" href="/" />
                    )}
                </div>
            </div>

            {/* Main Navigation Section - Now with scrolling */}
            <div className="py-2 px-3 space-y-2 flex-grow overflow-y-auto relative z-10 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-transparent">

                {/* Inbox Section - Show only on inbox page */}
                {isInboxPage && (
                    <>
                        <div className="flex-none">
                            <Button
                                variant="ghost"
                                className="w-full justify-start"
                                onClick={() =>
                                    window.dispatchEvent(new CustomEvent("compose_new_mail"))
                                }
                            >
                                <PenSquare className="mr-2 h-4 w-4" />
                                {(!isCollapsed || isMobile) && "Compose"}
                            </Button>
                        </div>
                        <Separator />
                        <nav className="space-y-1">
                            <Nav
                                isCollapsed={isCollapsed && !isMobile}
                                links={[
                                    {
                                        title: "Inbox",
                                        label: "0",
                                        icon: Inbox,
                                        variant: "default",
                                        onClick: () => {
                                            window.dispatchEvent(
                                                new CustomEvent("mail_menu_click", { detail: "Inbox" })
                                            );
                                        },
                                    },
                                    {
                                        title: "Drafts",
                                        label: "9",
                                        icon: File,
                                        variant: "ghost",
                                        onClick: () => {
                                            window.dispatchEvent(
                                                new CustomEvent("mail_menu_click", { detail: "Drafts" })
                                            );
                                        },
                                    },
                                    {
                                        title: "Sent",
                                        label: "",
                                        icon: Send,
                                        variant: "ghost",
                                        onClick: () => {
                                            window.dispatchEvent(
                                                new CustomEvent("mail_menu_click", { detail: "Sent" })
                                            );
                                        },
                                    },
                                    {
                                        title: "Junk",
                                        label: "23",
                                        icon: ArchiveX,
                                        variant: "ghost",
                                        onClick: () => {
                                            window.dispatchEvent(
                                                new CustomEvent("mail_menu_click", { detail: "Junk" })
                                            );
                                        },
                                    },
                                    {
                                        title: "Trash",
                                        label: "",
                                        icon: Trash2,
                                        variant: "ghost",
                                        onClick: () => {
                                            window.dispatchEvent(
                                                new CustomEvent("mail_menu_click", { detail: "Trash" })
                                            );
                                        },
                                    },
                                    {
                                        title: "Archive",
                                        label: "",
                                        icon: Archive,
                                        variant: "ghost",
                                        onClick: () => {
                                            window.dispatchEvent(
                                                new CustomEvent("mail_menu_click", { detail: "Archive" })
                                            );
                                        },
                                    },
                                ]}
                            />
                        </nav>
                        <Separator />
                        <nav className="space-y-1">
                            <Nav
                                isCollapsed={isCollapsed && !isMobile}
                                links={[
                                    {
                                        title: "Social",
                                        label: "972",
                                        icon: Users2,
                                        variant: "ghost",
                                        onClick: () => {
                                            window.dispatchEvent(
                                                new CustomEvent("mail_menu_click", { detail: "Social" })
                                            );
                                        },
                                    },
                                    {
                                        title: "Updates",
                                        label: "342",
                                        icon: AlertCircle,
                                        variant: "ghost",
                                        onClick: () => {
                                            window.dispatchEvent(
                                                new CustomEvent("mail_menu_click", { detail: "Updates" })
                                            );
                                        },
                                    },
                                    {
                                        title: "Forums",
                                        label: "128",
                                        icon: MessageSquare,
                                        variant: "ghost",
                                        onClick: () => {
                                            window.dispatchEvent(
                                                new CustomEvent("mail_menu_click", { detail: "Forums" })
                                            );
                                        },
                                    },
                                    {
                                        title: "Shopping",
                                        label: "8",
                                        icon: ShoppingCart,
                                        variant: "ghost",
                                        onClick: () => {
                                            window.dispatchEvent(
                                                new CustomEvent("mail_menu_click", { detail: "Shopping" })
                                            );
                                        },
                                    },
                                    {
                                        title: "Promotions",
                                        label: "21",
                                        icon: Archive,
                                        variant: "ghost",
                                        onClick: () => {
                                            window.dispatchEvent(
                                                new CustomEvent("mail_menu_click", {
                                                    detail: "Promotions",
                                                })
                                            );
                                        },
                                    },
                                ]}
                            />
                        </nav>
                    </>
                )}

                {/* App-specific menu items */}
                {!isInboxPage && !isVoicemailsPage && currentAppMenuItems.length > 0 && (
                    <div className="space-y-1">
                        {currentAppMenuItems.map((item) => {
                            const isActive = () => {
                                if (pathname === item.href) return true;




                                // Special case for taskroom routes
                                if (currentApp?.id === "taskroom") {
                                    // For exact matches, return true
                                    if (pathname === item.href) return true;

                                    // For other taskroom routes, check if current path starts with the menu item path
                                    if (pathname.startsWith(item.href + "/")) return true;

                                    return false;
                                }

                                if (pathname.startsWith(item.href + "/")) return true;
                                return false;
                            };

                            return (
                                <TooltipProvider key={item.href} delayDuration={300}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Link href={item.href} className="block">
                                                <Button
                                                    variant={isActive() ? "secondary" : "ghost"}
                                                    className={cn(
                                                        "w-full justify-start transition-all duration-200",
                                                        "hover:bg-white/10 dark:hover:bg-white/10 text-white",
                                                        isActive() &&
                                                        "bg-white/20 dark:bg-white/20 shadow-sm border border-white/10"
                                                    )}
                                                >
                                                    <div className="mr-2 h-4 w-4 flex items-center justify-center">
                                                        {typeof item.icon === "string" ? (
                                                            <Image
                                                                src={item.icon}
                                                                alt={item.title || item.name || ""}
                                                                width={16}
                                                                height={16}
                                                            />
                                                        ) : (
                                                            <item.icon className="h-4 w-4" />
                                                        )}
                                                    </div>
                                                    {(!isCollapsed || isMobile) && (item.title || item.name)}
                                                </Button>
                                            </Link>
                                        </TooltipTrigger>
                                        {isCollapsed && !isMobile && (
                                            <TooltipContent side="right" align="start">
                                                {item.title || item.name}
                                            </TooltipContent>
                                        )}
                                    </Tooltip>
                                </TooltipProvider>
                            );
                        })}
                    </div>
                )}

                {/* Show AppSidebar for non-inbox pages when no current app menu items */}
                {/* {!isInboxPage && !isVoicemailsPage && currentAppMenuItems.length === 0 && (
          <AppSidebar isCollapsed={isCollapsed && !isMobile} />
        )} */}
            </div>

            {/* Logout Button at Bottom */}
            <div className="p-3 border-t border-[#e5e7eb29] relative z-10 bg-[#0e0e12]/50">
                <Button
                    variant="ghost"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={onLogout}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    {(!isCollapsed || isMobile) && "Logout"}
                </Button>
            </div>
        </>
    );
}

export function DashboardSidebar() {
    const pathname = usePathname();
    const isMobile = useIsMobile();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const router = useRouter();

    // Zustand stores
    const {
        sidebarCollapsed: isCollapsed,
        setSidebarCollapsed: setIsCollapsed,
        toggleSidebar,
    } = useUIStore();

    //   const {
    //     user,
    //     logout,
    //   } = useAuthStore();

    const [expandedSections, setExpandedSections] = useState({
        main: true,
        app: true,
    });

    // Find current app based on pathname first
    const currentApp = React.useMemo(() => {
        // List of Taskroom app routes - these match the actual pages in (taskroom) route group
        const taskroomRoutes = [
            '/',
            '/taskroom/overview',
            '/taskroom/all-taskrooms',
            '/taskroom/assigned-to-me',
            '/flowboard',
            '/my-taskrooms',
            '/templates',
            '/settings',
        ];

        // Check if current path is a Taskroom route
        if (taskroomRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
            return apps.find(app => app.id === 'taskroom');
        }

        // Check other apps
        return apps.find((app) => {
            if (app.id === 'taskroom') return false; // Already handled above
            if (pathname === app.href) return true;
            if (pathname.startsWith(app.href + "/")) return true;
            return false;
        });
    }, [pathname]);

    // Get user data from store
    //   const userName = user?.name || "";
    //   const userRole = user?.role || "admin";
    //   const startupbrokerRole = user?.startupbrokerRole || "";

    // DEBUG: Log role detection for Taskroom
    if (currentApp?.id === "taskroom") {
        console.log("🔍 TASKROOM DEBUG:");
        // console.log("  - Detected user role:", userRole);
        // console.log("  - User object:", user);
        console.log("  - Current pathname:", pathname);
    }

    // Get sidebar data from Zustand store
    const {
        mvpSidebarItems,
        programManagerSidebarItems,
        fetchMvpSidebarItems,
        fetchProgramManagerSidebarItems,
    } = useSidebarStore();

    //   console.log(userName);

    useEffect(() => {
        setExpandedSections({
            main: true,
            app: true,
        });
    }, []);

    // Get menu items for the current app
    //   const currentAppMenuItems = React.useMemo(() => {
    //     if (!currentApp) return [];
    //     return getAppMenuItems(currentApp?.id, userRole, startupbrokerRole);
    //   }, [currentApp, userRole, startupbrokerRole]);

    //   useEffect(() => {
    //     if (pathname?.includes("/dashboard/socially/maps")) {
    //       setIsCollapsed(true);
    //     }
    //   }, [pathname, setIsCollapsed]);

    // Initialize sidebar as expanded for apps with menu items
    //   useEffect(() => {
    //     // For apps that have menu items, ensure sidebar starts expanded
    //     if (currentApp && currentAppMenuItems.length > 0 && !pathname?.includes("/dashboard/socially/maps")) {
    //       setIsCollapsed(false);
    //     }
    //   }, [currentApp, currentAppMenuItems, pathname, setIsCollapsed]);

    // Close mobile menu on navigation
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    // Close mobile menu when screen becomes desktop size
    useEffect(() => {
        if (!isMobile) {
            setIsMobileMenuOpen(false);
        }
    }, [isMobile]);

    // Fetch sidebar data when user is available
    //   useEffect(() => {
    //     if (user?.email) {
    //       if (pathname.startsWith("/dashboard/ideastomvp")) {
    //         fetchMvpSidebarItems(user.email);
    //       } else if (pathname.startsWith("/dashboard/programsmanager")) {
    //         fetchProgramManagerSidebarItems(user.email);
    //       }
    //     }
    //   }, [user?.email, pathname, fetchMvpSidebarItems, fetchProgramManagerSidebarItems]);

    // Determine if we're on the inbox page
    const isInboxPage = pathname.startsWith("/dashboard/inbox");

    // Determine if we're on the voicemails/chat page
    const isVoicemailsPage = pathname.startsWith("/dashboard/voicemails");

    const getDynamicId = (path: string) => {
        const segments = path.split("/");
        return segments[segments.length - 1];
    };

    const handleLogout = async () => {
        // await logout();
        router.push("/login");
    };



    // Mobile hamburger button
    if (isMobile) {
        return (
            <>
                {/* Mobile Hamburger/Back Button */}
                <div className="fixed top-4 right-4 z-50 md:hidden">
                    <Button
                        variant="outline"
                        size="icon"
                        className="bg-white/90 backdrop-blur-sm shadow-lg border-gray-200"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? (
                            <X className="h-5 w-5" />
                        ) : (
                            <Menu className="h-5 w-5" />
                        )}
                    </Button>
                </div>

                {/* Mobile Sidebar Overlay */}
                {isMobileMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 bg-black/50 z-40 md:hidden"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />

                        {/* Mobile Sidebar */}
                        <div
                            className={cn(
                                "fixed inset-y-0 left-0 z-50 w-full max-w-sm",
                                "h-screen transition-all duration-300 flex flex-col overflow-hidden relative",
                                "border-r border-[#e5e7eb29]",
                                "shadow-xl shadow-black/5",
                                "transform transition-transform duration-300 ease-in-out",
                                "bg-[#0e0e12] text-white",
                                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                            )}
                        >
                            <SidebarContent
                                isMobile={true}
                                isCollapsed={false}
                                currentApp={{
                                    id: "taskroom",
                                    name: "Taskrooms",
                                    icon: "/appicons/Taskrooms.svg",
                                    color: "bg-purple-500",
                                    href: "/",
                                    category: "Productivity Tools",
                                    enabled: true,
                                    file: false,

                                }}
                                isInboxPage={isInboxPage}
                                isVoicemailsPage={isVoicemailsPage}
                                currentAppMenuItems={[
                                    {
                                        title: "Overview",
                                        icon: ChartColumn,
                                        href: "taskroom/overview",
                                    },
                                    {
                                        title: "All Taskrooms",
                                        icon: FolderOpen,
                                        href: "taskroom/all-taskrooms",
                                    },
                                    {
                                        title: "Assigned to Me",
                                        icon: UserCheck,
                                        href: "taskroom/assigned-to-me",
                                    },
                                    // {
                                    //   title: "FlowBoards",
                                    //   icon: SquareKanban ,
                                    //   href: "/flowboard",
                                    // },
                                    // {
                                    //   title: "My Taskrooms",
                                    //   icon: Briefcase,
                                    //   href: "/my-taskrooms",
                                    // },
                                    // {
                                    //   title: "Templates",
                                    //   icon: LayoutTemplate,
                                    //   href: "/templates",
                                    // },
                                    // {
                                    //   title: "Settings",
                                    //   icon: Settings,
                                    //   href: "/settings",
                                    // },
                                ]}
                                router={router}
                                pathname={pathname}
                                setIsMobileMenuOpen={setIsMobileMenuOpen}
                                getDynamicId={getDynamicId}
                                onToggleCollapse={toggleSidebar}
                                user={"user"}
                                onLogout={handleLogout}
                            />
                        </div>
                    </>
                )}
            </>
        );
    }

    // Desktop sidebar
    return (
        <div
            className={cn(
                "h-screen transition-all duration-300 flex flex-col overflow-hidden relative",
                "border-r border-[#e5e7eb29]",
                "shadow-xl shadow-black/5",
                "bg-[#0e0e12] text-white",
                isCollapsed ? "w-16" : "w-72"
            )}
        >
            <SidebarContent
                isMobile={false}
                isCollapsed={isCollapsed}
                currentApp={{
                    id: "taskroom",
                    name: "Taskrooms",
                    icon: "/appicons/Taskrooms.svg",
                    color: "bg-purple-500",
                    href: "/",
                    category: "Productivity Tools",
                    enabled: true,
                    file: false,

                }}
                isInboxPage={isInboxPage}
                isVoicemailsPage={isVoicemailsPage}
                currentAppMenuItems={[
                    {
                        title: "Overview",
                        icon: ChartColumn,
                        href: "/taskroom/overview",
                    },
                    {
                        title: "All Taskrooms",
                        icon: FolderOpen,
                        href: "/taskroom/all-taskrooms",
                    },
                    {
                        title: "Assigned to Me",
                        icon: UserCheck,
                        href: "/taskroom/assigned-to-me",
                    },
                    // {
                    //   title: "FlowBoards",
                    //   icon: SquareKanban ,
                    //   href: "/flowboard",
                    // },
                    // {
                    //   title: "My Taskrooms",
                    //   icon: Briefcase,
                    //   href: "/my-taskrooms",
                    // },
                    // {
                    //   title: "Templates",
                    //   icon: LayoutTemplate,
                    //   href: "/templates",
                    // },
                    // {
                    //   title: "Settings",
                    //   icon: Settings,
                    //   href: "/settings",
                    // },
                ]}
                router={router}
                pathname={pathname}
                getDynamicId={getDynamicId}
                onToggleCollapse={toggleSidebar}
                user={"user"}
                onLogout={handleLogout}
            />
        </div>
    );
}
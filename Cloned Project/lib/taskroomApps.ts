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
import {
    // LayoutDashboard,
    FileText,
    // Settings,
    PlusSquare,
    ListChecks,
    Folder,
    // Inbox,
    BarChart,
    // PieChart,
    Users,
    Newspaper,
    BookOpen,
    Trophy,
    Building,
    Package,
    Calendar,
    Users2,
    Film,
    Home,
    // Upload,
    // FolderPlus,
    Star,
    Clock,
    Trash2,
    Archive,
    // Share2,
    // List,
    // UserCircle,
    // BellRing,
    // DollarSign,
    // Share,
} from "lucide-react";

// import { Funnel } from "recharts";

export interface MenuItem {
    title: string;
    icon: LucideIcon ;
    href: string;
}

export interface App {
    id: string;
    name: string;
    icon: string | LucideIcon;
    otherIcons?: string[];
    color: string;
    href: string;
    category: string;
    enabled: boolean;
    description?: string;
    menuItems?: MenuItem[];
    file?: boolean;
    newTab?: boolean;
}

// Common menu items that appear in multiple app
// const commonMenuItems = {
//   dashboard: {
//     title: "Dashboard",
//     icon: LayoutDashboard,
//     href: "/dashboard",
//   },
//   settings: {
//     title: "Settings",
//     icon: Settings,
//     href: "/dashboard/settings",
//   },
// };

export const apps: App[] = [
    // {
    //   id: "guedge",
    //   name: "GU Edge",
    //   icon: "/appicons/guedge.svg",
    //   color: "bg-green-500",
    //   href: "/dashboard/guedge",
    //   category: "Education",
    //   enabled: true,
    //   menuItems: [
    //     {
    //       title: "Dashboard",
    //       icon: Home,
    //       href: "/dashboard/guedge",
    //     },

    //     {
    //       title: "Courses",
    //       icon: BookOpen,
    //       href: "/dashboard/guedge/courses",
    //     },
    //     {
    //       title: "Videos",
    //       icon: Film,
    //       href: "/dashboard/guedge/videos",
    //     },
    //     {
    //       title: "News",
    //       icon: Newspaper,
    //       href: "/dashboard/guedge/news",
    //     },

    //     {
    //       title: "Leaderboard",
    //       icon: Trophy,
    //       href: "/dashboard/guedge/leaderboard",
    //     },

    //     // {
    //     //   title: "Chat",
    //     //   icon: MessageSquare,
    //     //   href: "/dashboard/guedge/chat",
    //     // },
    //     {
    //       title: "Calendar",
    //       icon: Calendar,
    //       href: "/dashboard/guedge/calendar",
    //     },
    //     {
    //       title: "Learning Feed",
    //       icon: Users,
    //       href: "/dashboard/guedge/feed",
    //     },
    //     // {
    //     //   title: "Analytics",
    //     //   icon: LayoutDashboard,
    //     //   href: "/dashboard/guedge/analytics",
    //     // },
    //   ],
    // },
    {
        id: "teamforce",
        name: "Teamforce (HRMS)",
        icon: "/appicons/teamforces.svg",
        color: "bg-green-500",
        href: "/dashboard/hr",
        category: "Departmental Tools",
        enabled: true,
        menuItems: [
            {
                title: "Dashboard",
                icon: BarChart,
                href: "/",
            },
            {
                title: "Departments",
                icon: Building,
                href: "/departments",
            },
            {
                title: "Employees",
                icon: Users2,
                href: "/employees",
            },

            {
                title: "Attendance",
                icon: Clock,
                href: "/attendance",
            },
            {
                title: "Recruitment",
                icon: UserPlus,
                href: "/recruitment-requests",
            },
        ],
    },
    {
        id: "deals",
        name: "Deals (CRM)",
        icon: "/appicons/deal.svg",
        color: "bg-blue-500",
        href: "/",
        category: "Departmental Tools",
        enabled: true,
        menuItems: [
            {
                title: "Dashboard",
                icon: BarChart,
                href: "/",
            },
            {
                title: "Product & Services",
                icon: Package,
                href: "/products",
            },
            {
                title: "Leads",
                icon: Users,
                href: "/leads",
            },
            {
                title: "Funnel",
                icon: Layers,
                href: "/funnel",
            },
            {
                title: "Contacts",
                icon: Users,
                href: "/contacts",
            },
            {
                title: "Companies",
                icon: Building,
                href: "/companies",
            },
            // {
            //   title: "Messages",
            //   icon: MessageSquare,
            //   href: "/dashboard/crm/messages",
            // },
        ],
    },
    {
        id: "clarity",
        name: "Clarity",
        icon: "/appicons/aixons.svg",
        color: "bg-purple-500",
        href: "/dashboard/clarity",
        category: "Departmental Tools",
        enabled: true,
        file: true,
        menuItems: [
            {
                title: "Workspace",
                icon: Network,
                href: "/dashboard/clarity/workspaces",
            },
            {
                title: "Automate",
                icon: CalendarSync,
                href: "/dashboard/clarity/automate",
            },
            {
                title: "Jobs",
                icon: CalendarCheck2,
                href: "/dashboard/clarity/job",
            },
            {
                title: "Marketplace",
                icon: Store,
                href: "/dashboard/clarity/marketplace",
            },
        ],
    },
    {
        id: "taskroom",
        name: "Taskrooms",
        icon: "/appicons/Taskrooms.svg",
        color: "bg-purple-500",
        href: "/",
        category: "Productivity Tools",
        enabled: true,
        file: false,
        menuItems: [
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
        ],
    },
    {
        id: "Thoughts",
        name: "Notes",
        icon: "/appicons/Thoughts.svg",
        color: "bg-purple-500",
        href: "/",
        category: "Productivity Tools",
        enabled: true,
        file: false,
        menuItems: [
            {
                title: "All Notes",
                icon: FileText,
                href: "/",
            },
            {
                title: "Starred",
                icon: Star,
                href: "/starred",
            },
            {
                title: "Archive",
                icon: Archive,
                href: "/archive",
            },
            {
                title: "Trash",
                icon: Trash2,
                href: "/trash",
            },
        ],
    },
    {
        id: "Sequence",
        name: "Sequence (Calendar)",
        icon: "/appicons/Sequence.svg",
        color: "bg-purple-500",
        href: "/dashboard/sequence",
        category: "Productivity Tools",
        enabled: false,
        file: false,
    },
    {
        id: "Voicemails",
        name: "Voicemails (Chats)",
        icon: "/appicons/Voicemails.svg",
        color: "bg-purple-500",
        href: "/dashboard/voicemails",
        category: "Productivity Tools",
        enabled: false,
        file: false,
    },
    {
        id: "Pulse",
        name: "Pulse (Feed)",
        icon: "/appicons/Pulse.svg",
        color: "bg-purple-500",
        href: "/dashboard/pulse",
        category: "Productivity Tools",
        enabled: false,
        file: false,
    },
    // {
    //   id: "Memory",
    //   name: "Memory (Storage)",
    //   icon: "/appicons/Memory.svg",
    //   color: "bg-purple-500",
    //   href: "/dashboard/memory",
    //   category: "Productivity Tools",
    //   enabled: false,
    //   file: false,
    // },
    {
        id: "ideastomvp",
        name: "IdeasToMVP",
        icon: "/appicons/ideastomvp.svg",
        color: "bg-blue-500",
        href: "/dashboard/ideastomvp",
        category: "Incubation",
        enabled: true,
        menuItems: [
            {
                title: "Dashboard",
                icon: LayoutDashboard,
                href: "/dashboard/ideastomvp",
            },
        ],
    },
    {
        id: "copilot",
        name: "Copilot",
        icon: "/appicons/copilot.png",
        color: "bg-blue-500",
        href: "/dashboard/copilot",
        category: "Incubation",
        enabled: true,
        menuItems: [
            {
                title: "Dashboard",
                icon: LayoutDashboard,
                href: "/dashboard/copilot",
            },
            {
                title: "Conversations",
                icon: MessageSquare,
                href: "/dashboard/copilot/dashboard/conversations",
            },
            {
                title: "Documents",
                icon: FileText,
                href: "/dashboard/copilot/dashboard/documents",
            },
            {
                title: "Profile",
                icon: UserCircle,
                href: "/dashboard/copilot/dashboard/profile",
            },
        ],
    },
    // {
    //   id: "supernova",
    //   name: "NvestBank",
    //   icon: "/appicons/nvestbank.svg",
    //   // otherIcons: [
    //   //   "/appicons/supernova.svg",
    //   //   "/appicons/liftoff.svg",
    //   //   "/appicons/air.svg",
    //   // ],
    //   color: "bg-blue-500",
    //   href: "/dashboard/supernova",
    //   category: "Incubation",
    //   enabled: true,
    //   menuItems: [
    //     //       Dashboard
    //     // Pitch
    //     // Vendors
    //     // Financing
    //     // Messages
    //     {
    //       title: "Dashboard",
    //       icon: LayoutDashboard,
    //       href: "/dashboard/supernova",
    //     },
    //     {
    //       title: "Pitch",
    //       icon: Lightbulb,
    //       href: "/dashboard/supernova/pitch",
    //     },
    //     {
    //       title: "Vendors",
    //       icon: Building2,
    //       href: "/dashboard/supernova/vendors",
    //     },
    //     {
    //       title: "Financing",
    //       icon: CreditCard,
    //       href: "/dashboard/supernova/financing",
    //     },
    //     // {
    //     //   title: "Messages",
    //     //   icon: MessageSquare,
    //     //   href: "/dashboard/supernova/messages",
    //     // },
    //     // {
    //     //   title: "Kamal",
    //     //   icon: User,
    //     //   href: "/dashboard/supernova/kamal",
    //     // },
    //   ],
    // },
    {
        id: "programsmanager",
        name: "Supernova",
        icon: "/appicons/supernova.svg",
        otherIcons: [
            "/appicons/supernova.svg",
            "/appicons/liftoff.svg",
            "/appicons/air.svg",
        ],
        color: "bg-blue-500",
        href: "/dashboard/programsmanager",
        category: "Incubation",
        enabled: true,
        menuItems: [
            {
                title: "Dashboard",
                icon: LayoutDashboard,
                href: "/dashboard/programsmanager",
            },
            {
                title: "Programs",
                icon: Folder,
                href: "/dashboard/programsmanager/programs",
            },
            {
                title: "Documents",
                icon: FileText,
                href: "/dashboard/programsmanager/documents",
            },
        ],
    },

    // {
    //   id: "deals",
    //   name: "Deals",
    //   icon: "/appicons/deal.svg",
    //   color: "bg-blue-500",
    //   href: "/dashboard/crm",
    //   category: "Management",
    //   enabled: true,
    //   menuItems: [
    //     {
    //       title: "Dashboard",
    //       icon: BarChart,
    //       href: "/dashboard/crm",
    //     },
    //     {
    //       title: "Product & Services",
    //       icon: Package,
    //       href: "/dashboard/crm/products",
    //     },
    //     {
    //       title: "Leads",
    //       icon: Users,
    //       href: "/dashboard/crm/leads",
    //     },
    //     {
    //       title: "Funnel",
    //       icon: Layers,
    //       href: "/dashboard/crm/funnel",
    //     },
    //     {
    //       title: "Contacts",
    //       icon: Users,
    //       href: "/dashboard/crm/contacts",
    //     },
    //     {
    //       title: "Companies",
    //       icon: Building,
    //       href: "/dashboard/crm/companies",
    //     },
    //     // {
    //     //   title: "Messages",
    //     //   icon: MessageSquare,
    //     //   href: "/dashboard/crm/messages",
    //     // },
    //   ],
    // },
    // {
    //   id: "vault",
    //   name: "Vault",
    //   icon: "/appicons/vault.svg",
    //   color: "bg-green-500",
    //   href: "/dashboard/vault/subscriptions",
    //   category: "Management",
    //   enabled: true,
    //   menuItems: [
    //     // {
    //     //  title: "Dashboard",
    //     //  icon: LayoutDashboard,
    //     //  href: "/dashboard/vault",
    //     // },
    //     // {
    //     //   title: "Payment Methods",
    //     //   icon: CreditCard,
    //     //   href: "/dashboard/vault/payment-methods",
    //     // },
    //     {
    //       title: "Subscriptions",
    //       icon: RotateCcw,
    //       href: "/dashboard/vault/subscriptions",
    //     },
    //     // {
    //     //  title: "Invoices",
    //     //  icon: Receipt,
    //     //  href: "/dashboard/vault/invoices",
    //     // },
    //   ],
    // },

    // {
    //   id: "clarity",
    //   name: "Clarity",
    //   icon: "/appicons/aixons.svg",
    //   color: "bg-purple-500",
    //   href: "/dashboard/clarity",
    //   category: "Management",
    //   enabled: true,
    //   file: true,
    //   menuItems: [
    //     {
    //       title: "Workspace",
    //       icon: Network,
    //       href: "/dashboard/clarity/workspaces",
    //     },
    //     {
    //       title: "Automate",
    //       icon: CalendarSync,
    //       href: "/dashboard/clarity/automate",
    //     },
    //     {
    //       title: "Jobs",
    //       icon: CalendarCheck2,
    //       href: "/dashboard/clarity/job",
    //     },
    //     // {
    //     //   title: "Workspaces",
    //     //   icon: File,
    //     //   href: "/dashboard/workspaces",
    //     // },
    //   ],
    // },
    // {
    //   id: "instantfunnels",
    //   name: "InstantFunnel",
    //   icon: "/appicons/instantfunnels.svg",
    //   color: "bg-red-500",
    //   href: "/dashboard/forms",
    //   category: "Management",
    //   enabled: true,
    //   menuItems: [
    //     {
    //       title: "All Forms",
    //       icon: Folder,
    //       href: "/dashboard/forms",
    //     },
    //     {
    //       title: "Form Builder",
    //       icon: PlusSquare,
    //       href: "/dashboard/forms/builder",
    //     },
    //     {
    //       title: "Submissions",
    //       icon: ListChecks,
    //       href: "/dashboard/forms/submissions",
    //     },
    //   ],
    // },
    // {
    //   id: "viralverse",
    //   name: "Viralverse",
    //   icon: "/appicons/viralverse.svg",
    //   color: "bg-red-500",
    //   href: "/dashboard/viralverse",
    //   category: "Management",
    //   enabled: true,
    //   menuItems: [
    //     {
    //       title: "Dashboard",
    //       icon: LayoutDashboard,
    //       href: "/dashboard/viralverse",
    //     },

    //     {
    //       title: "Network",
    //       icon: LayoutDashboard,
    //       href: "/dashboard/viralverse/network",
    //     },
    //     {
    //       title: "Commissions",
    //       icon: LayoutDashboard,
    //       href: "/dashboard/viralverse/commissions",
    //     },

    //     {
    //       title: "Discover",
    //       icon: LayoutDashboard,
    //       href: "/dashboard/viralverse/discover",
    //     },
    //     {
    //       title: "Training",
    //       icon: LayoutDashboard,
    //       href: "/dashboard/viralverse/training",
    //     },
    //     {
    //       title: "CRM",
    //       icon: LayoutDashboard,
    //       href: "/dashboard/viralverse/crm",
    //     },
    //     {
    //       title: "Settings",
    //       icon: LayoutDashboard,
    //       href: "/dashboard/viralverse/settings",
    //     },
    //   ],
    // },

    {
        id: "brain",
        name: "Memory (Brain)",
        icon: "/appicons/Memory.svg",
        color: "bg-blue-500",
        href: "/dashboard/myDrive",
        category: "Productivity Tools",
        menuItems: [
            {
                title: "Home",
                icon: HardDrive,
                href: "/dashboard/myDrive",
            },
            {
                title: "Starred",
                icon: Star,
                href: "/dashboard/myDrive/starred",
            },
        ],
        enabled: true,
    },

    // {
    //   id: "chats",
    //   name: "Chats",
    //   icon: "/appicons/chats.svg",
    //   color: "bg-green-500",
    //   href: "/dashboard/chats/deals",
    //   category: "Management",
    //   enabled: true,
    //   menuItems: [
    //     {
    //       title: "Internal Chat",
    //       icon: MessageSquare,
    //       href: "/dashboard/chats/internal",
    //     },
    //     {
    //       title: "Global Chat",
    //       icon: Globe2,
    //       href: "/dashboard/chats/global",
    //     },
    //     {
    //       title: "Support Chat",
    //       icon: HeadsetIcon,
    //       href: "/dashboard/chats/support",
    //     },
    //   ],
    // },
    {
        id: "startupbrokers",
        name: "Startupbrokers",
        icon: "/appicons/startupbrokers.svg",
        color: "bg-green-500",
        href: "/dashboard/startupbrokers",
        category: "Marketplaces",
        enabled: true,
        menuItems: [
            {
                title: "Dashboard",
                icon: LayoutDashboard,
                href: "/dashboard/startupbrokers/dashboard",
            },
            {
                title: "Explore Jobs",
                icon: BriefcaseIcon,
                href: "/dashboard/startupbrokers/opportunities",
            },
            {
                title: "My Applications",
                icon: Send,
                href: "/dashboard/startupbrokers/applications",
            },
            {
                title: "Services",
                icon: Layers,
                href: "/dashboard/startupbrokers/services",
            },
            {
                title: "Portfolio",
                icon: ImageIcon,
                href: "/dashboard/startupbrokers/portfolio",
            },
            // {
            //   title: "Analytics",
            //   icon: BarChart,
            //   href: "/dashboard/startupbrokers/analytics",
            // },
            // {
            //   title: "Wallet",
            //   icon: Wallet,
            //   href: "/dashboard/startupbrokers/wallet",
            // },
        ],
    },
    {
        id: "socially",
        name: "Socially",
        icon: "/appicons/socially.svg",
        color: "bg-green-500",
        href: "/dashboard/socially/maps",
        category: "Marketplaces",
        enabled: true,
        menuItems: [
            {
                title: "Maps",
                icon: LayoutDashboard,
                href: "/dashboard/socially/maps",
            },
        ],
    },
    {
        id: "indian-investor",
        name: "Indian Investor",
        icon: "/appicons/indianinvestor.svg",
        color: "bg-blue-500",
        href: "https://indianinvestor.com",
        newTab: true,
        category: "Marketplaces",
        enabled: true,
        description:
            "IndianInvestor is a modern investment bank that helps startups prepare for fundraising and connects them with the right investors through expert-led financial strategy, documentation, and capital matchmaking.",
    },
    {
        id: "earngpt",
        name: "EarnGPT",
        icon: "/appicons/earngpt.svg",
        color: "bg-blue-500",
        href: "https://earngpt.io",
        newTab: true,
        category: "Marketplaces",
        enabled: true,
    },
   
    // {
    //   id: "coverfi",
    //   name: "CoverFi",
    //   icon: "/appicons/coverfi.svg",
    //   color: "bg-blue-500",
    //   href: "/dashboard/coverfi",
    //   category: "No-Code Businesses",
    //   enabled: false,
    // },
    // {
    //   id: "classrooms",
    //   name: "Classrooms",
    //   icon: "/appicons/classrooms.svg",
    //   color: "bg-blue-500",
    //   href: "/dashboard/classrooms",
    //   category: "No-Code Businesses",
    //   enabled: false,
    // },

    // {
    //   id: "gmail",
    //   name: "Gmail",
    //   icon: "/appicons/gmail.svg",
    //   color: "bg-green-500",
    //   href: "/dashboard/inbox",
    //   category: "Third Party Integrations",
    //   enabled: true,
    // },
    // {
    //   id: "drive",
    //   name: "Google Drive",
    //   icon: "/appicons/drive.svg",
    //   color: "bg-green-500",
    //   href: "/dashboard/drive",
    //   category: "Third Party Integrations",
    //   enabled: true,
    //   menuItems: [
    //     {
    //       title: "Home",
    //       icon: Home,
    //       href: "/dashboard/drive",
    //     },
    //     // {
    //     //   title: "Create Folder",
    //     //   icon: FolderPlus,
    //     //   href: "/dashboard/drive/create-folder",
    //     // },
    //     // {
    //     //   title: "Upload Item",
    //     //   icon: Upload,
    //     //   href: "/dashboard/drive/upload",
    //     // },
    //     {
    //       title: "Starred",
    //       icon: Star,
    //       href: "/dashboard/drive/starred",
    //     },
    //     {
    //       title: "Recent",
    //       icon: Clock,
    //       href: "/dashboard/drive/recent",
    //     },
    //     {
    //       title: "Trash",
    //       icon: Trash2,
    //       href: "/dashboard/drive/trash",
    //     },
    //     {
    //       title: "Shared with me",
    //       icon: Share2,
    //       href: "/dashboard/drive/shared",
    //     },
    //   ],
    // },
    // {
    //   id: "google-calendar",
    //   name: "Google Calendar",
    //   icon: "/appicons/calendar.svg",
    //   color: "#4285F4",
    //   href: "/dashboard/calendar",
    //   category: "Third Party Integrations",
    //   enabled: true,

    //   menuItems: [
    //     {
    //       title: "Calendar",
    //       icon: Calendar,
    //       href: "/dashboard/calendar",
    //     },
    //     {
    //       title: "Events",
    //       icon: List,
    //       href: "/dashboard/calendar/events",
    //     },
    //   ],
    // },

    // Prime agencies
    // {
    //   id: "rapid-tax",
    //   name: "Rapid.Tax",
    //   icon: "/appicons/rapid.svg",
    //   color: "bg-blue-500",
    //   href: "/dashboard/rapidtax",
    //   category: "Prime agencies",
    //   enabled: true,
    //   description:
    //     "Rapid.Tax is a 360 compliance service firm that offers startups fast, affordable, and expert-led solutions for tax, legal, and regulatory compliance.",
    // },
    //
    // {
    //   id: "acid-marketing",
    //   name: "Acid Marketing",
    //   icon: "/appicons/acidmarketing.svg",
    //   color: "bg-blue-500",
    //   href: "/dashboard/acidmarketing",
    //   category: "Prime agencies",
    //   enabled: true,
    //   description:
    //     "Acid Marketing is a performance marketing agency built for startups, helping them reach their first 1,000 customers through data-driven campaigns, viral growth strategies, and ROI-focused execution.",
    // },
    // {
    //   id: "x-labs",
    //   name: "X-Labs",
    //   icon: "/appicons/x-labs.svg",
    //   color: "bg-blue-500",
    //   href: "/dashboard/xlabs",
    //   category: "Prime agencies",
    //   enabled: true,
    //   description:
    //     "X-Labs is an AI-powered UI/UX agency that helps startups accelerate product design by generating stunning mockups and production-ready frontend code with speed and precision.",
    // },
    // {
    //   id: "feedback-network",
    //   name: "Feedback Network",
    //   icon: "/appicons/feedbacknetwork.svg",
    //   color: "bg-blue-500",
    //   href: "/dashboard/feedbacknetwork",
    //   category: "Prime agencies",
    //   enabled: true,
    //   description: "Feedback.Network is an AI-driven QA and testing agency that ensures continuous testing, proactive tech support, and end-to-end quality assurance for startups building reliable digital products."
    // },

    // Coming soon apps
    {
        id: "capitalized",
        name: "Capitalized",
        icon: "/appicons/capitalized.svg",
        color: "bg-green-500",
        href: "/dashboard/capitalized",
        category: "Incubation",
        enabled: true,
        menuItems: [
            {
                title: "Company Profile",
                icon: Building,
                href: "/dashboard/capitalized/company",
            },
        ],
    },

    // {
    //   id: "rapid",
    //   name: "Rapid",
    //   icon: "/appicons/rapid.svg",
    //   color: "bg-green-500",
    //   href: "/dashboard/rapid",
    //   category: "Coming soon",
    //   enabled: false,
    // },
    // {
    //   id: "air",
    //   name: "AIR",
    //   icon: "/appicons/air.svg",
    //   color: "bg-green-500",
    //   href: "/dashboard/air",
    //   category: "Coming soon",
    //   enabled: false,
    // },
    // {
    //   id: "liftoff",
    //   name: "Lift Off",
    //   icon: "/appicons/liftoff.svg",
    //   color: "bg-green-500",
    //   href: "/dashboard/liftoff",
    //   category: "Coming soon",
    //   enabled: false,
    // },

    // {
    //   id: "chats",
    //   name: "Chats",
    //   icon: "/appicons/chats.svg",
    //   color: "bg-blue-500",
    //   href: "/dashboard/chats",
    //   category: "Coming soon",
    //   enabled: false,
    // },
    // {
    //   id: "aixons",
    //   name: "Aixons",
    //   icon: "/appicons/aixons.svg",
    //   color: "bg-blue-500",
    //   href: "/dashboard/aixons",
    //   category: "Coming soon",
    //   enabled: false
    // },
    // {
    //   id: "servers",
    //   name: "Servers",
    //   icon: "/appicons/servers.svg",
    //   color: "bg-blue-500",
    //   href: "/dashboard/servers",
    //   category: "Coming soon",
    //   enabled: false,
    // },
    // {
    //   id: "snapay",
    //   name: "Snapay",
    //   icon: "/appicons/snapay.svg",
    //   color: "bg-blue-500",
    //   href: "/dashboard/snapay",
    //   category: "Coming soon",
    //   enabled: false,
    // },
    // {
    //   id: "placement",
    //   name: "Placement",
    //   icon: "/appicons/placement.svg",
    //   color: "bg-blue-500",
    //   href: "/dashboard/placement",
    //   category: "Coming soon",
    //   enabled: false,
    // },
    // {
    //   id: "ddbots",
    //   name: "DDBots",
    //   icon: "/appicons/ddbots.svg",
    //   color: "bg-blue-500",
    //   href: "/dashboard/ddbots",
    //   category: "Coming soon",
    //   enabled: false,
    // },
    // {
    //   id: "api-machine",
    //   name: "API Machine",
    //   icon: "/appicons/apimachine.svg",
    //   color: "bg-blue-500",
    //   href: "/dashboard/apimachine",
    //   category: "Coming soon",
    //   enabled: false,
    // },
    // {
    //   id: "metaads",
    //   name: "Meta Ads",
    //   icon: "/appicons/metaads.svg",
    //   color: "bg-green-500",
    //   href: "/dashboard/metaads",
    //   category: "Coming soon",
    //   enabled: false,
    // },
    {
        id: "coverfi",
        name: "CoverFi",
        icon: "/appicons/coverfi-sm.svg",
        color: "bg-green-500",
        href: "/dashboard/coverfi",
        category: "No-Code Platforms",
        enabled: true,
        menuItems: [
            {
                href: "/dashboard/coverfi/brokerages",
                title: "Brokerages",
                icon: Building2,
            },
            {
                href: "/dashboard/coverfi/products",
                title: "Products",
                icon: ShieldCheck,
            },
            // { href: "/dashboard/coverfi/companies", title: "Companies", icon: BriefcaseBusiness },
            {
                href: "/dashboard/coverfi/corporates",
                title: "Corporates",
                icon: BriefcaseBusiness,
            },
            {
                href: "/dashboard/coverfi/user-roles",
                title: "User Roles",
                icon: UserCircle,
            },
            {
                href: "/dashboard/coverfi/insurance-company",
                title: "Insurance Company",
                icon: Umbrella,
            },
            {
                href: "/dashboard/coverfi/communication",
                title: "Communication",
                icon: Mail,
            },
            // {
            //   href: "/dashboard/coverfi/billing",
            //   title: "Billing",
            //   icon: Building2,
            // },
            {
                href: "/dashboard/coverfi/notifications",
                title: "Notifications",
                icon: Bell,
            },
        ],
    },
    {
        id: "vision",
        name: "Vision",
        icon: "/appicons/vision.png",
        color: "bg-purple-500",
        href: "/dashboard/vision",
        category: "Incubation",
        enabled: true,
        description:
            "AI-powered app builder for creating React applications with natural language prompts",
        menuItems: [
            {
                title: "App Builder",
                icon: Sparkles,
                href: "/dashboard/v0-app",
            },
        ],
    },
    {
        id: "helpdesk",
        name: "Helpdesk",
        icon: HeadsetIcon,
        color: "bg-orange-500",
        href: "/dashboard/helpdesk",
        category: "System",
        enabled: true,
        description:
            "Support ticket system for managing customer inquiries and bug reports",
        menuItems: [
            {
                title: "My Tickets",
                icon: Ticket,
                href: "/dashboard/helpdesk/tickets",
            },
            {
                title: "Report a bug",
                icon: Bug,
                href: "/dashboard/helpdesk/report-bug",
            },
        ],
    },
    {
        id: "settings",
        name: "Settings",
        icon: "/appicons/settings.png",
        color: "bg-gray-500",
        href: "/dashboard/settings",
        category: "System",
        enabled: true,
        menuItems: [
            {
                title: "Employee Profile",
                icon: UserCircle,
                href: "/dashboard/settings/employee",
            },
            {
                title: "Founder Profile",
                icon: UserCircle,
                href: "/dashboard/settings/founder",
            },
            // {
            //   title: "Company Profile",
            //   icon: Building,
            //   href: "/dashboard/settings/company",
            // },
            // {
            //   title: "My Subscription",
            //   icon: DollarSign,
            //   href: "/dashboard/settings/subscription",
            // },
            // {
            //   title: "Notifications",
            //   icon: BellRing,
            //   href: "/dashboard/settings/notifications",
            // },
            // {
            //   title: "Affiliate",
            //   icon: Share,
            //   href: "/dashboard/settings/affiliate",
            // },
        ],
    },
];

// Helper function to get apps based on role
export function getAppsByRole(role: string = "admin"): App[] {
    if (role === "employee") {
        // Filter out apps from Programs category for employees
        return apps.filter((app) => app.category !== "Programs");
    }
    return apps;
}

// Helper function to get menu items for a specific app
export function getAppMenuItems(
    appId: string,
    role: string = "admin",
    startupbrokerRole?: string
): MenuItem[] {
    // DEBUG: Log for Teamforce
    if (appId === "teamforce") {
        console.log("🔍 getAppMenuItems called for Teamforce:");
        console.log("  - appId:", appId);
        console.log("  - role:", role);
        console.log("  - Will filter menu items based on role");
    }

    const app = apps.find((app) => app.id === appId);
    if (!app?.menuItems) return [];

    // Special handling for startupbrokers app based on role
    if (appId === "startupbrokers" && startupbrokerRole) {
        if (startupbrokerRole === "Client") {
            return [
                {
                    title: "Dashboard",
                    icon: LayoutDashboard,
                    href: "/dashboard/startupbrokers/dashboard",
                },

                {
                    title: "My Jobs",
                    icon: Layers,
                    href: "/dashboard/startupbrokers/jobs",
                },
                {
                    title: "Applications",
                    icon: Send,
                    href: "/dashboard/startupbrokers/job-applications",
                },
                {
                    title: "Browse Vendors",
                    icon: Users,
                    href: "/dashboard/startupbrokers/vendors",
                },
                // {
                //   title: "Active Projects",
                //   icon: Clock,
                //   href: "/dashboard/startupbrokers/projects",
                // },
                // {
                //   title: "Messages",
                //   icon: MessageSquare,
                //   href: "/dashboard/startupbrokers/messages",
                // },
                // {
                //   title: "Wallet",
                //   icon: Wallet,
                //   href: "/dashboard/startupbrokers/wallet",
                // },
            ];
        } else if (startupbrokerRole === "Vendor") {
            return [
                {
                    title: "Dashboard",
                    icon: LayoutDashboard,
                    href: "/dashboard/startupbrokers/dashboard",
                },
                {
                    title: "Explore Jobs",
                    icon: BriefcaseIcon,
                    href: "/dashboard/startupbrokers/opportunities",
                },
                {
                    title: "My Applications",
                    icon: Send,
                    href: "/dashboard/startupbrokers/applications",
                },
                {
                    title: "Services",
                    icon: Layers,
                    href: "/dashboard/startupbrokers/services",
                },
                {
                    title: "Portfolio",
                    icon: ImageIcon,
                    href: "/dashboard/startupbrokers/portfolio",
                },
                // {
                //   title: "Analytics",
                //   icon: BarChart,
                //   href: "/dashboard/startupbrokers/analytics",
                // },
                // {
                //   title: "Wallet",
                //   icon: Wallet,
                //   href: "/dashboard/startupbrokers/wallet",
                // },
            ];
        }
    }

    // For employees, show specific menu items
    if (role === "employee") {
        switch (appId) {
            // case "deals":
            //   // Exclude certain CRM features for employees
            //   return app.menuItems.filter(
            //     (item) => !["Pipeline", "Product"].includes(item.title)
            //   );
            case "teamforce":
                // Show only specific menu items for employees, with Attendance as default
                console.log(
                    "🔍 EMPLOYEE FILTER APPLIED - showing only Attendance and Recruitment"
                );
                const teamforceItems = app.menuItems.filter((item) =>
                    ["Attendance", "Recruitment"].includes(item.title)
                );
                // Reorder to make Attendance first
                return teamforceItems.sort((a, b) =>
                    a.title === "Attendance" ? -1 : b.title === "Attendance" ? 1 : 0
                );
            case "clarity":
                // Show only TaskRooms for employees
                return app.menuItems.filter((item) => item.title === "Jobs");
            case "settings":
                // Show only specific menu items for employees, with Employee Profile as default
                const settingsItems = app.menuItems.filter((item) =>
                    ["Employee Profile", "Notifications"].includes(item.title)
                );
                // Reorder to make Employee Profile first
                return settingsItems.sort((a, b) =>
                    a.title === "Employee Profile"
                        ? -1
                        : b.title === "Employee Profile"
                            ? 1
                            : 0
                );
            default:
                return app.menuItems;
        }
    }

    // // For non-employee roles (admin, etc.)
    // if (appId === "teamforce") {
    //   console.log("🔍 ADMIN ACCESS - showing all Teamforce menu items:", app.menuItems.map(item => item.title));
    // }

    switch (appId) {
        // case 'teamforce':
        //   // Filter out Time Tracking and Approve Requests for admins
        //   return app.menuItems.filter(item =>
        //     !['Approve Requests'].includes(item.title)
        //   );
        case "clarity":
            // Admin users see all Clarity menu items (Workspace, Automate, TaskRooms)
            return app.menuItems;
        case "settings":
            return app.menuItems.filter((item) => item.title !== "Employee Profile");
        default:
            return app.menuItems;
    }
}

// Helper function to get all menu items for all apps
export function getAllMenuItems(
    role: string = "admin",
    startupbrokerRole?: string
): Record<string, MenuItem[]> {
    const result: Record<string, MenuItem[]> = {};

    apps.forEach((app) => {
        const menuItems = getAppMenuItems(app.id, role, startupbrokerRole);
        if (menuItems.length > 0) {
            result[app.id] = menuItems;
        }
    });

    return result;
}

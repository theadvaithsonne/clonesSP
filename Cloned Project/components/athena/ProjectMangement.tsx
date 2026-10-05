import { cn } from "@/lib/utils";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import PeoplePage from "./components/WorkspacePeopleDashboard";
import { DahboardMangement } from "./components/Dashbaord";
import SettingPage from "./components/WorkspaceSettingsDashboard";
import TimeSheets from './components/timesheet'
import AssignedToMe, { AllTasks } from './components/AssignedToMe'
import { CalendarView } from "./components/CalendarView";
import { isRoomObserver, useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";
import { useWorkspaceStore } from "@/store/taskroom/workspaceStore";
import { useUserStore } from "@/store/athena/userStore";

import { ListView } from './components/ListView'
import Gantt from './components/Gantt'
import { ServiceRoomPanel } from "@/components/dashboard/service-taskroom/ServiceRoomPanel";
import { useLinkedService } from "@/components/dashboard/service-taskroom/useLinkedService";
import SheetsView from './components/SheetsView'
import Figmaview from './components/Figmaview'
import Notionview from './components/Notionview'
import Youtubeview from './components/Youtubeview'
import GoogleCalendarview from './components/GoogleCalendarview'
import WorkspaceSidebar from "./components/workspacesidebar";
import { WorkspaceLoading } from "@/components/shared/WorkspaceLoading";
import { CustomizeViewButton, CustomizeViewDrawer } from "./components/CustomizeViewDrawer";
import ImportExportDashboard from "./components/import-export/ImportExportDashboard";
import { CreateTaskDialog } from "./components/CreateTaskDialog";

import {
  LayoutGrid,
  Calendar as CalendarIcon,
  List,
  BarChart3,
  Briefcase,
  Figma,
  Sparkles,
  Users,
  X,
  Send,
  FileText,
  Loader2,
  FileSpreadsheet,
  Video,
  CalendarDays,
  RefreshCw,
} from "lucide-react";


// ── Types ─────────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const ANCHORED_PANEL_Z = 10060;

const MEMBERS_PAGE_SIZE = 25;

const TASKROOM_BASE = (
  process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/"
).replace(/\/+$/, "") + "/";

type RoomMembersMetadata = {
  count?: number;
  totalPages: number;
  currentPage: number;
  nextPage: number | null;
};

function hasMoreMembers(meta: RoomMembersMetadata | null, currentPage: number) {
  if (!meta) return false;
  if (meta.nextPage != null) return true;
  return currentPage < meta.totalPages;
}

function RightSideDrawerPortal({
  open,
  onClose,
  headerRef,
  width = 380,
  children,
}: {
  open: boolean;
  onClose: () => void;
  headerRef: React.RefObject<HTMLElement | null>;
  width?: number;
  children: React.ReactNode;
}) {
  const [top, setTop] = useState(0);

  useEffect(() => {
    if (!open) return;

    const update = () => {
      const el = headerRef.current;
      if (!el) return;
      setTop(el.getBoundingClientRect().bottom);
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, headerRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/40"
        style={{ zIndex: ANCHORED_PANEL_Z - 1 }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          top,
          right: 0,
          bottom: 0,
          width,
          zIndex: ANCHORED_PANEL_Z,
        }}
        className="flex flex-col bg-[#0a0a0d] shadow-2xl"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

// ── AI Drawer ─────────────────────────────────────────────────────────────────
function AskAIDrawer({
  open,
  onClose,
  roomId,
  headerRef,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
  headerRef: React.RefObject<HTMLElement | null>;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Clear old AI chat state when the room changes
  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [roomId]);

  // Scroll chat container only — avoid scrollIntoView which scrolls parent page
  useEffect(() => {
    if (!open) return;
    const el = chatScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isLoading, open]);

  const triggerProjectUpdate = () => {
    handleSend("Give me a full project update");
  };

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;

    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const newUserMsg: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // The server builds the board context and holds the OpenAI key.
      const res = await fetch("/api/taskroom/ask-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("garage_tok") || ""}`,
        },
        body: JSON.stringify({ roomId, messages: updatedMessages }),
      });

      const data = await res.json().catch(() => null);
      const reply = res.ok
        ? data?.reply ?? "Sorry, I couldn't get a response. Please try again."
        : data?.error ?? "Sorry, I couldn't get a response. Please try again.";

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error connecting to AI. Please check your connection and try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  if (!open) return null;

  return (
    <RightSideDrawerPortal open={open} onClose={onClose} headerRef={headerRef} width={380}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e7eb10] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-purple-600 to-purple-400">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-white font-semibold text-sm">Ask AI</span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-6 h-6 rounded-full bg-[#161616] hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Feature Card — Project Update only */}
        <div className="px-4 py-3 border-b border-[#e5e7eb08] shrink-0">
          <button
            onClick={triggerProjectUpdate}
            disabled={isLoading}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/4 border border-white/8 hover:bg-white/7 transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/20 flex-shrink-0">
              <FileText className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white text-xs font-medium">Project Update</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">New</span>
              </div>
              <p className="text-white/35 text-[10px] mt-0.5">Time-based project status update</p>
            </div>
            <span className="text-white/20 group-hover:text-white/40 transition-colors text-base">›</span>
          </button>
        </div>

        {/* Chat Area */}
        <div
          ref={chatScrollRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10"
        >
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-10">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#161616]">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-white/30 text-xs leading-relaxed max-w-[200px]">
                Click "Project Update" or ask anything about this project.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] px-3 py-2.5 rounded-xl text-xs leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-purple-600 text-white rounded-br-sm"
                    : "bg-white/6 text-white/85 border border-white/8 rounded-bl-sm"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/6 border border-white/8 rounded-xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="px-4 py-3 border-t border-[#e5e7eb10] flex items-center gap-2 shrink-0">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={autoResize}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this project..."
            rows={1}
            className="flex-1 bg-[#161616] border border-white/10 rounded-lg px-3 py-2 placeholder:text-[12px] text-[12px] text-white placeholder-white/25 outline-none focus:border-white/20 transition-colors resize-none "
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 text-white" />
            )}
          </button>
        </div>
    </RightSideDrawerPortal>
  );
}
function AssigneesDrawer({
  open,
  onClose,
  roomId,
  headerRef,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
  headerRef: React.RefObject<HTMLElement | null>;
}) {
  const [members, setMembers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [metadata, setMetadata] = useState<RoomMembersMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const pageRef = useRef(1);
  const debouncedSearchRef = useRef("");
  const metadataRef = useRef<RoomMembersMetadata | null>(null);

  const fetchMembers = useCallback(
    async (pageNum: number, searchQuery: string, append: boolean) => {
      if (!roomId || loadingRef.current) return;
      loadingRef.current = true;
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const token = localStorage.getItem("garage_tok");
        const params = new URLSearchParams({
          roomId,
          page: String(pageNum),
          size: String(MEMBERS_PAGE_SIZE),
        });
        const q = searchQuery.trim();
        if (q) params.set("search", q);

        const res = await fetch(`${TASKROOM_BASE}room/members?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const newData: any[] = json?.data?.data ?? [];
        const meta = json?.metadata;

        const nextMeta: RoomMembersMetadata = {
          count: typeof meta?.count === "number" ? meta.count : undefined,
          totalPages: meta?.totalPages ?? 1,
          currentPage: meta?.currentPage ?? pageNum,
          nextPage: meta?.nextPage ?? null,
        };

        setMetadata(nextMeta);
        metadataRef.current = nextMeta;
        pageRef.current = pageNum;

        setMembers((prev) => {
          if (!append) return newData;
          const seen = new Set(prev.map((m) => m._id));
          return [...prev, ...newData.filter((m) => m._id && !seen.has(m._id))];
        });
      } catch (e) {
        console.error(e);
        if (!append) {
          setMembers([]);
          setMetadata(null);
          metadataRef.current = null;
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadingRef.current = false;
      }
    },
    [roomId]
  );

  useEffect(() => {
    if (open) {
      setSearch("");
      setDebouncedSearch("");
      debouncedSearchRef.current = "";
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      debouncedSearchRef.current = search;
    }, 300);
    return () => clearTimeout(timer);
  }, [search, open]);

  useEffect(() => {
    if (!open || !roomId) return;
    pageRef.current = 1;
    setMembers([]);
    setMetadata(null);
    metadataRef.current = null;
    fetchMembers(1, debouncedSearch, false);
  }, [open, roomId, debouncedSearch, fetchMembers]);

  useEffect(() => {
    if (!open) return;
    const root = scrollRef.current;
    const el = sentinelRef.current;
    if (!root || !el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          !entry.isIntersecting ||
          loadingRef.current ||
          !hasMoreMembers(metadataRef.current, pageRef.current)
        ) {
          return;
        }
        fetchMembers(pageRef.current + 1, debouncedSearchRef.current, true);
      },
      { root, threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [open, fetchMembers, members.length, loading, loadingMore]);

  const getInitials = (name: string) =>
    name?.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) ?? "?";

  const avatarColors = [
    "#1e3a5f", "#2d1b4e", "#1a3a2a", "#3b1f1f", "#1f2d3b", "#2a2a1a", "#1f1a3b",
  ];

  const hasMore = hasMoreMembers(metadata, metadata?.currentPage ?? 1);

  if (!open) return null;

  return (
    <RightSideDrawerPortal open={open} onClose={onClose} headerRef={headerRef} width={380}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e7eb12] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-white font-semibold text-sm">Members</span>
            {/* {metadata?.count != null && (
              <span className="text-white/35 text-[11px]">{metadata.count}</span>
            )} */}
          </div>
          <button
            onClick={onClose}
            className="flex cursor-pointer items-center justify-center w-6 h-6 rounded-full bg-[#161616] hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-[#e5e7eb0a] shrink-0">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full bg-[#161616] border border-white/10 rounded-md px-3 py-1.5 text-[12px] placeholder:text-[12px] text-white placeholder-white/30 outline-none focus:border-white/20 transition-colors"
          />
        </div>

        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-1"
        >
          {loading && members.length === 0 && (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
            </div>
          )}

          {!loading && members.length === 0 && (
            <p className="text-white/30 text-xs text-center mt-10">No members found</p>
          )}

          {members.map((m, i) => {
            const user = m.userData ?? {};
            const name = user.name ?? "Unknown";
            const email = user.email ?? "";
            const hasImage = !!user.image;
            const color = avatarColors[i % avatarColors.length];

            return (
              <div
                key={m._id}
                className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[#161616] transition-colors cursor-pointer group"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white overflow-hidden"
                  style={{ backgroundColor: hasImage ? "transparent" : color }}
                >
                  {hasImage ? (
                    <img src={user.image} alt={name} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    getInitials(name)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{name}</p>
                  <p className="text-white/35 text-[10px] truncate">{email}</p>
                </div>
                {m.role && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/6 text-white/40 capitalize flex-shrink-0">
                    {m.role}
                  </span>
                )}
              </div>
            );
          })}

          <div ref={sentinelRef} className="h-1 w-full shrink-0" aria-hidden />

          {loadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
            </div>
          )}

          {!loading && !loadingMore && members.length > 0 && !hasMore && (
            <p className="text-white/25 text-[10px] text-center py-3">All members loaded</p>
          )}
        </div>
    </RightSideDrawerPortal>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function ProjectManagement({ setActivePopover, setActiveItem }: any) {
  const { projectActiveItem, setProjectActiveItem, loadShareTaskDeepLink, currentRoomDetail, wsrKLoading, activeSpaceId, currentWorkspace, memberData, fetchBoardByRoomsDetails } = useTaskroomWorkspacetore();
  const fetchUserProfile = useUserStore((state) => state.fetchUserProfile);
  const searchParams = useSearchParams();
  const shareTaskLoadedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<"Board" | "Calendar" | "List" | "Gantt" | "Sheets" | "Figma" | "Notion" | "Youtube" | "GoogleCalendar" | "Service">("Board");

  // Non-blocking lookup: ordinary taskrooms resolve to null, so the Service tab
  // never renders and this board behaves exactly as it did before.
  const linkedService = useLinkedService(currentRoomDetail?._id);

  // Guard against a stale selection when moving from an engagement room to an
  // ordinary one — otherwise the view would fall through to "Coming soon".
  useEffect(() => {
    if (activeTab === "Service" && !linkedService) {
      setActiveTab("Board");
    }
  }, [activeTab, linkedService]);
  const [assigneesOpen, setAssigneesOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [isRefreshingBoard, setIsRefreshingBoard] = useState(false);
  const [customizeDrawerOpen, setCustomizeDrawerOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createTaskDueDateMs, setCreateTaskDueDateMs] = useState<number | null>(null);
  const [createTaskHideSubtask, setCreateTaskHideSubtask] = useState(false);
  const [createTaskDefaultToCurrentRoom, setCreateTaskDefaultToCurrentRoom] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const currentSpaceId = activeSpaceId || searchParams.get("spaceId") || currentRoomDetail?.spaceId || "";
  const roomId =
    (searchParams.get("shareTask") ? searchParams.get("roomId") : currentRoomDetail?._id) || "";
  const workspaceRole = (currentWorkspace?.MemberDetail?.role || "").toLowerCase();
  const canManageWorkspaceSettings =
    workspaceRole === "admin" ||
    workspaceRole === "owner" ||
    !!currentWorkspace?.MemberDetail?.isOwner;
  const isRoomReadOnly = isRoomObserver(currentRoomDetail, memberData);

  const handleRefreshBoard = useCallback(async () => {
    if (!roomId || isRefreshingBoard) return;
    setIsRefreshingBoard(true);
    try {
      await fetchBoardByRoomsDetails(roomId, 1, 30, "ascs");
    } finally {
      setIsRefreshingBoard(false);
    }
  }, [roomId, isRefreshingBoard, fetchBoardByRoomsDetails]);

  // Always land on Board when switching rooms
  useEffect(() => {
    setActiveTab("Board");
  }, [currentRoomDetail?._id]);

  useEffect(() => {
    const shareTaskId = searchParams.get("shareTask");
    if (!shareTaskId) {
      shareTaskLoadedRef.current = false;
      return;
    }

    if (shareTaskLoadedRef.current) return;

    const workspaceId = searchParams.get("workspaceId");
    const spaceId = searchParams.get("spaceId");
    const roomId = searchParams.get("roomId");

    if (!workspaceId || !spaceId || !roomId) return;

    shareTaskLoadedRef.current = true;

    const loadDeepLink = async () => {
      try {
        await fetchUserProfile();
        const profileLoaded = useUserStore.getState().isUserProfileFetched;
        if (!profileLoaded) {
          shareTaskLoadedRef.current = false;
          return;
        }
        await loadShareTaskDeepLink({ shareTaskId, workspaceId, spaceId, roomId });
      } catch (error) {
        console.error("Failed to load user profile before share task deep link:", error);
        shareTaskLoadedRef.current = false;
      }
    };

    loadDeepLink();
  }, [searchParams, loadShareTaskDeepLink, fetchUserProfile]);

  useEffect(() => {
    if (!projectActiveItem) {
      setProjectActiveItem("WorkspacePeople");
    }
  }, [projectActiveItem, setProjectActiveItem]);

  useEffect(() => {
    if (projectActiveItem === "WorkspaceSettings" && !canManageWorkspaceSettings) {
      setProjectActiveItem("WorkspacePeople");
    }
  }, [projectActiveItem, canManageWorkspaceSettings, setProjectActiveItem]);

  useEffect(() => {
    const handleOpenCreateTask = (event: Event) => {
      if (!currentSpaceId || isRoomReadOnly) return;
      const detail = (event as CustomEvent<{
        dueDateMs?: number | null;
        hideSubtask?: boolean;
        defaultToCurrentRoom?: boolean;
      }>).detail;
      setCreateTaskDueDateMs(detail?.dueDateMs ?? null);
      setCreateTaskHideSubtask(detail?.hideSubtask ?? false);
      setCreateTaskDefaultToCurrentRoom(detail?.defaultToCurrentRoom ?? false);
      setCreateTaskOpen(true);
    };

    window.addEventListener("taskroom:open-create-task", handleOpenCreateTask);
    return () => {
      window.removeEventListener("taskroom:open-create-task", handleOpenCreateTask);
    };
  }, [currentSpaceId, isRoomReadOnly]);

  const mode = () => {
    switch (activeTab) {
      case "Board": return <DahboardMangement />;
      case "Gantt": return <Gantt />;
      case "Calendar": return <CalendarView />;
      case "List": return <ListView />;
      case "Sheets": return <SheetsView />;
      case "Figma": return <Figmaview />;
      case "Notion": return <Notionview />;
      case "Youtube": return <Youtubeview />;
      case "GoogleCalendar": return <GoogleCalendarview />;
      // Only reachable when the room resolved to a service engagement — the
      // tab that selects it is not rendered otherwise.
      case "Service": return <ServiceRoomPanel linked={linkedService} />;
      default: return null;
    }
  };

  const renderContent = () => {
    switch (projectActiveItem) {
      case "WorkspacePeople":
        return (
          <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
            <PeoplePage />
          </div>
        );
      case "WorkspaceSettings":
        if (!canManageWorkspaceSettings) {
          return (
            <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
              <PeoplePage />
            </div>
          );
        }
        return (
          <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
            <SettingPage setActivePopover={setActivePopover} setActiveItem={setActiveItem} />
          </div>
        );
      case "TimeSheets":
        return (
          <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
            <TimeSheets />
          </div>
        );
      case "AssignedToMe":
        return (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <AssignedToMe />
          </div>
        );
      case "AllTasks":
        return (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <AllTasks />
          </div>
        );
      case "ImportExport":
        return (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <ImportExportDashboard />
          </div>
        );
      case "DashMangement":
        return (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <ProjectHeader
              setActiveTab={setActiveTab}
              activeTab={activeTab}
              hasLinkedService={!!linkedService}
            />
            <div className="relative flex flex-1 min-h-0 min-w-0 overflow-hidden">
              <div className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden">{mode()}</div>
              {/* {roomId ? (
                <div className="pointer-events-none absolute right-3 top-3 z-20 sm:right-4">
                  <CustomizeViewButton
                    onClick={() => setCustomizeDrawerOpen(true)}
                    className="pointer-events-auto"
                  />
                </div>
              ) : null} */}
              <CustomizeViewDrawer
                open={customizeDrawerOpen}
                onClose={() => setCustomizeDrawerOpen(false)}
                roomId={roomId}
                headerRef={headerRef}
              />
            </div>
          </div>
        );
      default:
        return (
          <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
            <PeoplePage />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-[#0a0a0d]">
      {wsrKLoading && <WorkspaceLoading />}
      {/* Assigned To Me and All Tasks span every room, so the workspace/space/room breadcrumb doesn't apply. */}
      <div
        ref={headerRef}
        className={cn(
          "shrink-0 px-3 sm:px-6 py-4 pt-3 ",
          (projectActiveItem === "AssignedToMe" || projectActiveItem === "AllTasks") && "hidden"
        )}
      >
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 min-w-0">
          <div className="min-w-0 w-full sm:flex-1">
            <WorkspaceSidebar />
          </div>

          {projectActiveItem === "DashMangement" && currentRoomDetail && (
            <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto sm:ml-auto">
              {activeTab === "Board" && (
                <div className="relative flex items-center">
                  <button
                    type="button"
                    onClick={handleRefreshBoard}
                    disabled={isRefreshingBoard}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#161616] px-3 py-[8px] text-[14px] text-white/50 transition-colors hover:bg-white/5 cursor-pointer touch-manipulation disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Refresh board"
                    title="Refresh board"
                  >
                    <RefreshCw className={cn("h-4 w-4 text-white/50", isRefreshingBoard && "animate-spin")} />
                    <span>Refresh</span>
                  </button>
                </div>
              )}
              <div className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => setAiDrawerOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#161616] px-3 py-[8px] text-[14px] text-white/50 transition-colors hover:bg-white/5 cursor-pointer touch-manipulation"
                  aria-label="Ask AI"
                >
                  <Sparkles className="h-4 w-4 text-[#FACC15]" />
                  <span>Ask AI</span>
                </button>
                <AskAIDrawer
                  open={aiDrawerOpen}
                  onClose={() => setAiDrawerOpen(false)}
                  roomId={roomId}
                  headerRef={headerRef}
                />
              </div>
              <div className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => setAssigneesOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#161616] px-3 py-[8px] text-[14px]  text-white/50 transition-colors hover:bg-white/5 cursor-pointer touch-manipulation"
                  aria-label="Members"
                >
                  <Users className="h-4 w-4 text-white/50" />
                  <span>Members</span>
                </button>
                <AssigneesDrawer
                  open={assigneesOpen}
                  onClose={() => setAssigneesOpen(false)}
                  roomId={roomId}
                  headerRef={headerRef}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {projectActiveItem === "DashMangement" && !currentRoomDetail
          ? null
          : renderContent()}
      </div>

      {currentSpaceId && !isRoomReadOnly ? (
        <CreateTaskDialog
          open={createTaskOpen}
          onOpenChange={(open) => {
            setCreateTaskOpen(open);
            if (!open) {
              setCreateTaskDueDateMs(null);
              setCreateTaskHideSubtask(false);
              setCreateTaskDefaultToCurrentRoom(false);
            }
          }}
          initialDueDateMs={createTaskDueDateMs}
          hideSubtaskTab={createTaskHideSubtask}
          defaultToCurrentRoom={createTaskDefaultToCurrentRoom}
        />
      ) : null}
    </div>
  );
}

// ── Project Header ────────────────────────────────────────────────────────────
function ProjectHeader({
  activeTab,
  setActiveTab,
  hasLinkedService = false,
}: {
  activeTab: "Board" | "Calendar" | "List" | "Gantt" | "Sheets" | "Figma" | "Notion" | "Youtube" | "GoogleCalendar" | "Service";
  setActiveTab: React.Dispatch<React.SetStateAction<"Board" | "Calendar" | "List" | "Gantt" | "Sheets" | "Figma" | "Notion" | "Youtube" | "GoogleCalendar" | "Service">>;
  /** Adds the Service tab. False on every ordinary taskroom. */
  hasLinkedService?: boolean;
}) {
  const { currentWorkspace } = useWorkspaceStore();
  const { currentRoomDetail } = useTaskroomWorkspacetore();
  const searchParams = useSearchParams();
  const roomId =
    (searchParams.get("shareTask") ? searchParams.get("roomId") : currentRoomDetail?._id) || "";
  const roomAvatarUrl =
    currentRoomDetail?.bgImage
    || "";
  const handleTabClick = (tab: "Board" | "Calendar" | "List" | "Gantt" | "Sheets" | "Figma" | "Notion" | "Youtube" | "GoogleCalendar" | "Service") => {
    setActiveTab(tab);
  };
  return (
    <>
      <div className="flex flex-col bg-[#0a0a0d] ">

        {/* Top Breadcrumb & Actions */}
        {/* <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 sm:px-6 py-2 min-w-0">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 text-white/90">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <div className="flex min-w-0 items-center gap-1 font-bold">
                <span className="flex min-w-0 items-center gap-2">
                  <div
                    className="flex h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 items-center justify-center rounded-sm text-sm font-bold text-black shadow overflow-hidden"
                    style={
                      roomAvatarUrl
                        ? {
                          backgroundImage: `url(${roomAvatarUrl})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                        : { backgroundColor: "#e11d48" }
                    }
                  >
                    {!roomAvatarUrl && (currentRoomDetail?.name?.charAt(0)?.toUpperCase() || "P")}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] sm:text-sm">
                      {currentRoomDetail?.name
                        ? currentRoomDetail.name.charAt(0).toUpperCase() + currentRoomDetail.name.slice(1)
                        : "Project"}
                    </div>
                    {currentRoomDetail?.description && (
                      <div className="truncate text-white/50 text-[11px] sm:text-xs">
                        {currentRoomDetail.description}
                      </div>
                    )}
                  </div>
                </span>
              </div>
            </div>

          </div>
        </div> */}

        {/* Tabs + Toolbar */}
        <div className="flex items-center min-w-0 ">
          <div
            className="flex w-full items-center gap-1 sm:gap-6 overflow-x-auto overscroll-x-contain scrollbar-hide px-3 sm:px-6 [-webkit-overflow-scrolling:touch]"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >

            {/* Board Tab */}
            {([
              { id: "Board" as const, label: "Board", icon: LayoutGrid },
              { id: "List" as const, label: "List", icon: List },
              { id: "Calendar" as const, label: "Calendar", icon: CalendarIcon },
              { id: "Gantt" as const, label: "Gantt", icon: BarChart3 },
              // Additive: present only on service engagement rooms.
              ...(hasLinkedService
                ? [{ id: "Service" as const, label: "Service", icon: Briefcase }]
                : []),
              // { id: "Sheets" as const, label: "Sheets", icon: FileSpreadsheet },
              // { id: "Figma" as const, label: "Figma", icon: Figma },
              // { id: "Notion" as const, label: "Notion", icon: FileText },
              // { id: "Youtube" as const, label: "YouTube", icon: Video },
              // { id: "GoogleCalendar" as const, label: "Google Calendar", icon: CalendarDays },
            ]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleTabClick(id)}
                className={cn(
                  "flex flex-shrink-0 items-center gap-1.5 sm:gap-2 px-2 sm:px-0 py-2.5   sm:py-2 sm:pt-0 text-xs font-medium cursor-pointer transition-colors relative border-b-2 whitespace-nowrap touch-manipulation pt-0",
                  activeTab === id
                    ? "text-white border-[#FACC15]"
                    : "text-white/50 border-transparent hover:text-white"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", activeTab === id ? "text-white" : "text-white/50")} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
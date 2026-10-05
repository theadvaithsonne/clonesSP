import { cn } from "@/lib/utils";
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import PeoplePage from "./components/WorkspacePeopleDashboard";
import { DahboardMangement } from "./components/Dashbaord";
import SettingPage from "./components/WorkspaceSettingsDashboard";
import TimeSheets from './components/timesheet'
import { CalendarView } from "./components/CalendarView";
import { useUIStoreAthena } from "@/store/athena/uiStore";
import { useWorkspaceStore } from "@/store/taskroom/workspaceStore";
import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";
import { ListView } from './components/ListView'
import Gantt from './components/Gantt'
import SheetsView from './components/SheetsView'
import {
  LayoutGrid,
  Calendar as CalendarIcon,
  Sparkles,
  FileSpreadsheet,
  Users,
  X,
} from "lucide-react";
import TimesheetPage from './components/timesheet'

// ── Assignees Drawer ──────────────────────────────────────────────────────────
function AssigneesDrawer({
  open,
  onClose,
  roomId,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
}) {
  const [members, setMembers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const fetchMembers = async (pageNum: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const token = localStorage.getItem("garage_tok");
      const res = await fetch(
        `https://uatapi.garage.app/taskroomv2/v2/room/members?roomId=${roomId}&page=${pageNum}&size=20`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const json = await res.json();
      const newData: any[] = json?.data?.data ?? [];
      setTotalPages(json?.metadata?.totalPages ?? 1);
      setMembers((prev) => (pageNum === 1 ? newData : [...prev, ...newData]));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  // Reset & fetch when drawer opens
  useEffect(() => {
    if (open && roomId) {
      setPage(1);
      setMembers([]);
      setSearch("");
      fetchMembers(1);
    }
  }, [open, roomId]);

  // Infinite scroll handler
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || loadingRef.current) return;
    if (page >= totalPages) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) {
      const next = page + 1;
      setPage(next);
      fetchMembers(next);
    }
  };

  const filtered = members.filter((m) =>
    (m.userData?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (m.userData?.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const getInitials = (name: string) =>
    name
      ?.split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?";

  const avatarColors = [
    "#1e3a5f",
    "#2d1b4e",
    "#1a3a2a",
    "#3b1f1f",
    "#1f2d3b",
    "#2a2a1a",
    "#1f1a3b",
  ];

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute right-0 top-full mt-2 w-[320px] h-[400px] z-50 flex flex-col bg-[#111114] border border-[#e5e7eb18] rounded-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e7eb12]">
          <span className="text-white font-semibold text-sm">Assignees</span>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-[#e5e7eb0a]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user or team..."
            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-white/20 transition-colors"
          />
        </div>

        {/* List */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
        >
          {filtered.length === 0 && !loading && (
            <p className="text-white/30 text-xs text-center mt-10">
              No members found
            </p>
          )}

          {filtered.map((m, i) => {
            const user = m.userData ?? {};
            const name = user.name ?? "Unknown";
            const email = user.email ?? "";
            const hasImage = !!user.image;
            const color = avatarColors[i % avatarColors.length];

            return (
              <div
                key={m._id}
                className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-white/5 transition-colors cursor-pointer group"
              >
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white overflow-hidden"
                  style={{ backgroundColor: hasImage ? "transparent" : color }}
                >
                  {hasImage ? (
                    <img
                      src={user.image}
                      alt={name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    getInitials(name)
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{name}</p>
                  <p className="text-white/35 text-[10px] truncate">{email}</p>
                </div>

                {/* Role badge */}
                {m.role && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/6 text-white/40 capitalize flex-shrink-0">
                    {m.role}
                  </span>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-center py-4">
              <div className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function ProjectManagement({ setActivePopover, setActiveItem }: any) {
  const { projectActiveItem, setProjectActiveItem } = useUIStoreAthena();
  const [activeTab, setActiveTab] = useState<"Board" | "Calendar" | "List" | "Gantt" | "Sheets">("Board");

  // Initialize default view
  useEffect(() => {
    if (!projectActiveItem) {
      setProjectActiveItem("WorkspacePeople");
    }
  }, [projectActiveItem, setProjectActiveItem]);

  const mode = () => {
    switch (activeTab) {
      case "Board":
        return <DahboardMangement />;
      case "Gantt":
        return <Gantt />;
      case "Calendar":
        return <CalendarView />;
      case "List":
        return <ListView />;
      case "Sheets":
        return <SheetsView />;
      default:
        return null;
    }
  };

  const renderContent = () => {
    switch (projectActiveItem) {
      case "WorkspacePeople":
        return (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <PeoplePage />
          </div>
        );

      case "WorkspaceSettings":
        return (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <SettingPage setActivePopover={setActivePopover} setActiveItem={setActiveItem} />
          </div>
        );

      case "TimeSheets":
        return (
          <div className="flex flex-col flex-1">
            <TimeSheets />
          </div>
        );

      case "DashMangement":
        return (
          <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
            <ProjectHeader
              setActiveTab={setActiveTab}
              activeTab={activeTab}
            />
            {mode()}
          </div>
        );

      default:
        return (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <PeoplePage />
          </div>
        );
    }
  };

  return (
    <div
      className="flex flex-col bg-[#0a0a0d] overflow-hidden"
      style={{ height: "calc(100vh - 62px)" }}
    >
      {renderContent()}
    </div>
  );
}

// ── Project Header ────────────────────────────────────────────────────────────
function ProjectHeader({ activeTab, setActiveTab }: {
  activeTab: "Board" | "Calendar" | "List" | "Gantt" | "Sheets";
  setActiveTab: (tab: "Board" | "Calendar" | "List" | "Gantt" | "Sheets") => void;
}) {
  const { currentWorkspace } = useWorkspaceStore();
  const { currentRoomDetail } = useTaskroomWorkspacetore();
  const { projectActiveItem, setProjectActiveItem } = useUIStoreAthena();
  const [assigneesOpen, setAssigneesOpen] = useState(false);
  const searchParams = useSearchParams();
  const roomId = (searchParams.get("shareTask") ? searchParams.get('roomId') : currentRoomDetail?._id) || "";

  const handleTabClick = (tab: "Board" | "Calendar" | "List" | "Gantt" | "Sheets") => {
    setActiveTab(tab);
  };

  return (
    <>
      <div className="flex flex-col bg-[#0a0a0d] border-b border-[#e5e7eb0f]">
        {/* Top Breadcrumb & Actions */}
        <div className="flex items-center justify-between px-6 py-2">
          <div className="flex items-center gap-3 text-white/90">
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1 font-bold">
                <span className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-sm text-sm font-bold text-black shadow"
                    style={{ backgroundColor: "#e11d48" }}
                  >
                    {currentRoomDetail?.name?.charAt(0)?.toUpperCase() || "P"}
                  </div>
                  <div>
                    {currentRoomDetail?.name
                      ? currentRoomDetail.name.charAt(0).toUpperCase() +
                        currentRoomDetail.name.slice(1)
                      : "Project"}
                    <div className="text-white/50 text-xs">
                      {currentRoomDetail?.description}
                    </div>
                  </div>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-white/50">
            <div className="flex items-center gap-1.5 cursor-pointer hover:text-white">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <span className="text-xs font-medium">Ask AI</span>
            </div>
          </div>
        </div>

        {/* Tabs + Toolbar */}
        <div className="flex items-center justify-between px-6 border-b border-[#e5e7eb29]">
          <div className="flex items-center gap-6">
            {/* Board Tab */}
            <div
              onClick={() => handleTabClick("Board")}
              className={cn(
                "flex items-center gap-2 px-0 py-2 text-xs font-medium cursor-pointer transition-colors relative border-b-2",
                activeTab === "Board"
                  ? "text-white border-white"
                  : "text-white/50 border-transparent hover:text-white"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5 text-orange-500" />
              Board
            </div>

            {/* List Tab */}
            <div
              onClick={() => handleTabClick("List")}
              className={cn(
                "flex items-center gap-2 px-0 py-2 text-xs font-medium cursor-pointer transition-colors relative border-b-2",
                activeTab === "List"
                  ? "text-white border-white"
                  : "text-white/50 border-transparent hover:text-white"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5 text-orange-500" />
              List
            </div>

            {/* Calendar Tab */}
            <div
              onClick={() => handleTabClick("Calendar")}
              className={cn(
                "flex items-center gap-2 px-0 py-2 text-xs font-medium cursor-pointer transition-colors relative border-b-2",
                activeTab === "Calendar"
                  ? "text-white border-white"
                  : "text-white/50 border-transparent hover:text-white"
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5 text-orange-500" />
              Calendar
            </div>

            {/* Gantt Tab */}
            <div
              onClick={() => handleTabClick("Gantt")}
              className={cn(
                "flex items-center gap-2 px-0 py-2 text-xs font-medium cursor-pointer transition-colors relative border-b-2",
                activeTab === "Gantt"
                  ? "text-white border-white"
                  : "text-white/50 border-transparent hover:text-white"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5 text-orange-500" />
              Gantt
            </div>

            {/* Sheets Tab (commented out) */}
            {/* <div
              onClick={() => handleTabClick("Sheets")}
              className={cn(
                "flex items-center gap-2 px-0 py-2 text-xs font-medium cursor-pointer transition-colors relative border-b-2",
                activeTab === "Sheets"
                  ? "text-white border-white"
                  : "text-white/50 border-transparent hover:text-white"
              )}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-green-500" />
              Sheets
            </div> */}
          </div>

          {/* Right side — Assignees button */}
          <div className="flex items-center gap-3 text-white/50 relative">
            <button
              onClick={() => setAssigneesOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 hover:bg-white/8 hover:text-white transition-colors text-xs"
            >
              <Users className="h-3.5 w-3.5" />
              Assignees
            </button>
            <AssigneesDrawer
              open={assigneesOpen}
              onClose={() => setAssigneesOpen(false)}
              roomId={roomId}
            />
          </div>
        </div>
      </div>
    </>
  );
}
"use client";

import React, { useState, useEffect } from "react";
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
  Home,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateSpaceDialog } from "./create-space-dialog";
import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import Fixedsidebar from './fixed-sidebar'
import { useUIStore } from "@/store/uiStore";
import SettingSidebar from './setting-sidebar'
import { useWorkspaceStore } from "@/store/taskroom/workspaceStore";
import { Skeleton } from "@/components/ui/skeleton";
import { useTaskroomWorkspacetore, Room } from "@/store/taskroom/taskroomWorkspace";
import { CreateRoomDialog } from "./create-room-dialog";
import { useSpaceStore } from "@/store/taskroom/spaceStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TaskroomSidebar() {
  const collapsed = useUIStore((state) => state.sidebarCollapsed);
  const toggle = useUIStore((state) => state.toggleSidebar);
  const {
    spaceData,
    isLoading: isSpacesLoading,
    fetchspaces,
    showCreateSpace,
    setShowCreateSpace
  } = useWorkspaceStore();
  const pathname = usePathname();

  const isActive = (path: string) => pathname?.startsWith(path);
  const { workspace: workspaceId } = useParams();
  const currentSpaces = workspaceId ? spaceData[workspaceId as string] || [] : [];
  const [isSpaceListOpen, setIsSpaceListOpen] = useState(true);
  const [expandedSpaces, setExpandedSpaces] = useState<Record<string, boolean>>({});
  const { rooms, fetchRooms, isRoomLoading: isRoomsLoading, deleteRoom } = useTaskroomWorkspacetore();
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingSpace, setEditingSpace] = useState<any>(null);
  const { deleteSpace } = useSpaceStore();
  const { space } = useParams()
  const pathSpaceId = space as string
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');
  console.log("spaceRooms", rooms, roomId)
  const toggleSpace = (spaceId: string) => {
    const isExpanded = !expandedSpaces[spaceId];

    setExpandedSpaces(prev => ({
      ...prev,
      [spaceId]: isExpanded,
    }));

    if (isExpanded) {
      fetchRooms(spaceId);
    }
  };
  const handleCreateRoom = (spaceId: string) => {
    setActiveSpaceId(spaceId);
    setEditingRoom(null);
    setShowCreateRoom(true);
  };
console.log("currentSpaces",currentSpaces)
  const handleEditRoom = (room: Room) => {
    setEditingRoom(room);
    setActiveSpaceId(room.spaceId);
    setShowCreateRoom(true);
  };

  const handleEditSpace = (space: any) => {
    console.log("currentSpaces2342343",space)
    setEditingSpace(space);
    setShowCreateSpace(true);
  };

  const handleDeleteSpace = async (spaceId: string) => {
    if (confirm("Are you sure you want to delete this space?")) {
      const success = await deleteSpace(spaceId);
      if (success && workspaceId) {
        fetchspaces(workspaceId as string);
      }
    }
  };

  const handleDeleteRoom = async (room: Room) => {
    if (confirm(`Are you sure you want to delete the room "${room.name}"?`)) {
      await deleteRoom(room._id);
    }
  };

  useEffect(() => {
    if (!pathSpaceId) return;
    if (pathname.includes('settings')) return;
    setExpandedSpaces((prev) => ({
      ...prev,
      [pathSpaceId]: true,
    }));

    fetchRooms(pathSpaceId);
  }, [pathSpaceId]);

  console.log("spaceDatavvcvcbvbc", rooms)
  // const isSettingsPage = pathname.includes('/settings');


  let activeTab: React.ReactNode;

  if (pathname.includes('/settings')) {
    activeTab = <SettingSidebar />;
  } else {
    activeTab = <aside
      aria-label="Taskroom navigation"
      className="hidden w-64 min-w-[256px] flex-none flex-col border-r border border-[#e5e7eb29] rounded-tl-lg rounded-bl-lg rounded-tr-none rounded-br-none  shadow-sm sm:flex"
    >
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-[#e5e7eb29]  px-3 py-2.5">
        <span className="text-sm font-semibold text-white">Home</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md p-1.5 text-white hover:bg-[#343439] hover:text-white"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-md p-1.5 text-white hover:bg-[#343439] hover:text-white"
            aria-label="Filter"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggle}
            className="rounded-md p-1.5 text-white hover:bg-[#343439] hover:text-white"
            aria-label="Minimize sidebar"
          >
            <span className="flex -space-x-0.5">
              <ChevronLeft className="h-4 w-4" />
              <ChevronLeft className="h-4 w-4" />
            </span>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full bg-purple-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-purple-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Create
          </button>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex flex-1 flex-col overflow-y-auto py-2">
        <ul className="space-y-0.5 px-2">
          <li >
            <NavLink icon={Inbox} label="Inbox" />
          </li>
          <li>
            <NavLink icon={MessageSquareReply} label="Replies" />
          </li>
          <li>
            <NavLink icon={MessageCircle} label="Assigned Comments" />
          </li>
          <li>
            <NavLink icon={CheckSquare} label="My Tasks" />
          </li>
          <li>
            <NavLink icon={FileText} label="Docs" href="/docs" active={isActive('/docs')} />
          </li>
          {/* <li>
            <NavLink icon={MoreHorizontal} label="More" />
          </li> */}
        </ul>

        {/* Favorites */}
        <div className="mt-4 px-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white">
            Favorites
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white">
            <Star className="h-3 w-3" />
            Click to add favorites to your sidebar
          </p>
        </div>

        {/* Spaces */}
        <div className="mt-4 flex-1 min-h-0">
          <div className="flex items-center justify-between px-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white">
              Spaces
            </p>
            <button
              type="button"
              onClick={() => setShowCreateSpace(true)}
              className="rounded p-1 text-white hover:bg-[#343439] hover:text-white"
              aria-label="Add space"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-1 space-y-0.5 px-2">


            <button
              type="button"
              onClick={() => setIsSpaceListOpen(!isSpaceListOpen)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-white cusror-pointer "
            >
              <span className="flex items-center gap-2 truncate">
                <Users className="h-3.5 w-3.5 flex-shrink-0 text-white" />
                Team Space
              </span>
              {isSpaceListOpen ? (
                <ChevronUp className="h-3.5 w-3.5 text-white" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-white" />
              )}
            </button>

            {isSpaceListOpen && (
              <div className="mt-1 space-y-0.5 px-2">
                {isSpacesLoading ? (
                  // Skeleton loader
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                      <Skeleton className="h-3 w-3 rounded-full bg-[#343439]" />
                      <Skeleton className="h-3 w-32 bg-[#343439]" />
                    </div>
                  ))
                ) : currentSpaces && currentSpaces.length > 0 ? (
                  currentSpaces.map((space) => {
                    if (!space._id) return null;
                    const isExpanded = expandedSpaces[space._id];
                    const spaceRooms = rooms[space._id] || [];
                    console.log("pathSpaceId", pathSpaceId, space._id)
                    return (
                      <div key={space._id} className="space-y-0.5 group">
                        <div
                          onClick={() => toggleSpace(space._id!)}
                          className={cn(
                            `flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-normal transition-colors cursor-pointer `,
                            space?._id == pathSpaceId
                              ? "bg-[#343439] text-white font-bold"
                              : "text-white hover:bg-[#343439]"
                          )}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FolderKanban className="h-3.5 w-3.5 flex-shrink-0 text-white" />
                            <span className="truncate">{space.name || "Untitled Space"}</span>

                          </div>
                          <div className="flex items-center gap-1">

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="p-0.5 rounded text-white cursor-pointer opacity-0 hover:bg-[#343439] group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-3 w-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-32   bg-[#111116] border-[#e5e7eb29] ">
                                <DropdownMenuItem onClick={() => handleEditSpace(space)}>
                                  <Edit className="mr-2 h-2 w-2 " />
                                  <span className="text-[11px]">Edit</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => handleDeleteSpace(space._id!)}
                                >
                                  <Trash2 className="mr-2 h-2 w-2 " />
                                  <span className="text-[11px]">Delete</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {/* <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateRoom(space._id!);
                              }}
                              className="p-0.5 rounded hover:bg-slate-200 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Plus className="h-3 w-3" />
                            </button> */}
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5 text-white flex-shrink-0" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-white flex-shrink-0" />
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="ml-4 pl-2 border-l  border-[#e5e7eb29] space-y-0.5 py-0.5">
                            {spaceRooms.map((room) => (
                              <NavLink
                                key={room._id}
                                icon={MessageCircle}
                                label={room.name}
                                href={`/taskroom/${workspaceId as string}/dashboard/${room?.spaceId}?roomId=${room._id}`}
                                active={room?._id == roomId}
                                dropdown={
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        className="p-0.5 rounded hover:bg-[#343439] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <MoreHorizontal className="h-3 w-3" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-32 bg-white">
                                      <DropdownMenuItem onClick={() => handleEditRoom(room)}>
                                        <Edit className="mr-2 h-3.5 w-3.5" />
                                        <span>Edit</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="text-red-600 focus:text-red-600"
                                        onClick={() => handleDeleteRoom(room)}
                                      >
                                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                                        <span>Delete</span>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                }
                              />
                            ))}
                            {spaceRooms.length === 0 && !isRoomsLoading && (
                              <div className="px-2 py-1 text-[10px] text-white italic">
                                No rooms yet
                              </div>
                            )}
                            <button
                              onClick={() => handleCreateRoom(space._id!)}
                              className="flex w-full items-center gap-2 px-2 py-1 rounded hover:bg-[#343439] text-[10px] text-white"
                            >
                              <Plus className="h-3 w-3" />
                              Add Room
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="px-3 py-2 text-[11px] text-white italic">
                    No spaces found
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowCreateSpace(true)}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-white hover:bg-[#343439] hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              New Space
            </button>
          </div>

          {/* Views */}
          <div className="mt-4 px-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white">
              Views
            </p>
            <ul className="mt-1 space-y-0.5">
              <li>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg hover:bg-[#343439] px-2 py-1.5 text-left text-xs font-medium text-white"
                >
                  <LayoutList className="h-3.5 w-3.5 text-white" />
                  List
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-white hover:bg-[#343439]"
                >
                  <CalendarDays className="h-3.5 w-3.5 text-white" />
                  Calendar
                </button>
              </li>
            </ul>
          </div>

          {/* Channels */}
          <div className="mt-4 px-3 pb-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white">
              Channels
            </p>
          </div>
        </div>
      </nav>
      <CreateSpaceDialog
        open={showCreateSpace}
        onOpenChange={(open) => {
          setShowCreateSpace(open);
          if (!open) setEditingSpace(null);
        }}
        space={editingSpace}
      />
      <CreateRoomDialog
        open={showCreateRoom}
        onOpenChange={setShowCreateRoom}
        spaceId={activeSpaceId || undefined}
        room={editingRoom}
      />
    </aside>;
  }



  return (

    <div className="flex h-full overflow-hidden gap-2 ">
      <Fixedsidebar />
      {/* {
        isSettingsPage 

        else
      } */}
      {activeTab}

    </div>


  );
}

function NavLink({
  icon: Icon,
  label,
  active,
  badge,
  href,
  onAction,
  dropdown,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  badge?: number;
  href?: string;
  onAction?: () => void;
  dropdown?: React.ReactNode;
}) {
  const content = (
    <>
      <span className="relative flex-shrink-0">
        <Icon className="h-3.5 w-3.5 text-white" />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -right-1.5 -top-1 flex h-4 min-w-[16px]  items-center justify-center rounded-full  px-1 text-[10px] font-normal text-white">
            {badge}
          </span>
        )}
      </span>
      <span className="truncate"
        style={{
          fontWeight: "normal"
        }}
      >{label}</span>
      {dropdown ? (
        <div onClick={(e) => e.stopPropagation()} className="ml-auto flex items-center">
          {dropdown}
        </div>
      ) : onAction && (
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAction();
          }}
          className="ml-auto p-0.5 rounded hover:bg-[#343439] text-white  transition-opacity font-normal cursor-pointer"
        >
          <MoreHorizontal className="h-3 w-3" />
        </div>
      )}
    </>
  );

  const className = cn(
    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium transition-colors cursor-pointer",
    active
      ? "bg-[#343439] text-white"
      : "text-white hover:bg-[#343439]"
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



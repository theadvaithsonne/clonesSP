"use client";

import { useEffect, useMemo, useState, SetStateAction, Dispatch, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";           // ← Add this
import {
    Users,
    MoreHorizontal,
    Plus,
    ChevronDown,
    X,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner"
import type { Column, Task, Member, Employee } from "../types/kanban";
import { Skeleton } from "@/components/ui/skeleton";
import Cookies from "js-cookie";

/* --------------------------------------------------------------- */
/*                           TYPES                                 */
/* --------------------------------------------------------------- */
type Status = "online" | "busy" | "offline";

type User = {
    id: string;
    initials: string;
    name: string;
    role: string;
    status: Status;
};

type Props = {
    onClose?: () => void;
    roomId?: string;
    conversationId: string | undefined;
    workspaceUserId: string | undefined;
    userId: string;
    observerPage: number
    observerHasMore: boolean
    observerLoading: boolean
    newCountMenmbers: number
    /** All members come from the parent */
    members: Member[];
    setnewCountMenmbers: Dispatch<SetStateAction<number>>;
    setMembers: Dispatch<SetStateAction<Member[]>>;
    fetchMembers: (page: number, append: boolean) => Promise<void>;
    /** Optional – used only for the “add-member” dialog */
    employees: Employee[];
    columns: Column[];
    setColumns: Dispatch<SetStateAction<Column[]>>
    setStagecolumns: React.Dispatch<React.SetStateAction<Task[]>>;
};

/* --------------------------------------------------------------- */
/*                         HELPERS                                 */
/* --------------------------------------------------------------- */
function StatusDot({ status }: { status: Status }) {
    const color =
        status === "online"
            ? "bg-emerald-500"
            : status === "busy"
                ? "bg-amber-400"
                : "bg-zinc-400";
    return (
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} aria-hidden="true" />
    );
}

function initialsFromName(name: string) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/* --------------------------------------------------------------- */
/*                     MEMBER ITEM COMPONENT                       */
/* --------------------------------------------------------------- */
function MemberItem({
    m,
    onRemove,
    removing,
    employees,
}: {
    m: Member;
    removing?: boolean;
    onRemove?: (m: Member) => void;
    employees: Employee[];
}) {
    const getEmployeeName = (id: string): string => {
        const emp = employees.find((e) => e.id === id);
        return emp ? emp.name : "Unassigned";
    };

    return (
        <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                    <AvatarFallback>
                        {m.userId ? getEmployeeName(m.userId)[0] : "?"}
                    </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                    <span className="text-sm font-medium">
                        {m.userId ? getEmployeeName(m.userId) : "Unassigned"}
                    </span>
                </div>
            </div>

            {onRemove ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-40">
                        <DropdownMenuItem
                            className="text-destructive"
                            disabled={removing}
                            onClick={() => onRemove(m)}
                        >
                            {removing ? "Removing…" : "Remove from project"}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
}

/* --------------------------------------------------------------- */
/*                     RIGHT SIDE PANEL COMPONENT                  */
/* --------------------------------------------------------------- */
export default function RightSidePanel({
    onClose,
    roomId: taskRoomId,
    conversationId,
    workspaceUserId,
    userId,
    members,
    setMembers,
    setColumns,
    employees,
    columns,
    observerPage, setnewCountMenmbers, newCountMenmbers,
    observerHasMore,
    observerLoading, fetchMembers, setStagecolumns
}: Props) {


    /* ---- Dialog & UI state ---- */
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isRemovingId, setIsRemovingId] = useState<string | null>(null);
    const [isAddingId, setIsAddingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    /* ---- Infinite-scroll state ---- */

    const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

    /* ----------------------------------------------------------- */
    /*                     FETCH MEMBERS (pagination)              */
    /* ----------------------------------------------------------- */


    const handleObserver = useCallback(
        (entries: IntersectionObserverEntry[]) => {
            const [target] = entries;
            if (target.isIntersecting && observerHasMore && !observerLoading) {
                fetchMembers(observerPage + 1, true);
            }
        },
        [observerHasMore, observerLoading, observerPage]
    );

    useEffect(() => {
        const trigger = loadMoreTriggerRef.current;
        if (!trigger) return;

        const obs = new IntersectionObserver(handleObserver, {
            root: null,
            threshold: 0.1,
        });
        obs.observe(trigger);
        return () => obs.disconnect();
    }, [handleObserver]);

    /* ----------------------------------------------------------- */
    /*                     ADD MEMBER (BULK)                       */
    /* ----------------------------------------------------------- */


    const toggleSelect = (id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };
    console.log('employeeswer', employees)
    const addSelectedMembers = async () => {
        if (selectedIds.length === 0) return;

        setIsAddingId("bulk");

        try {
            const token = localStorage.getItem("garage_tok");
            const orgId = localStorage.getItem("garage_org_id");

            // Optional: verify token once
            const meRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!meRes.ok) throw new Error("Invalid token");

            // Prepare payload
            const payload = {
                userIds: selectedIds,
                roomId: taskRoomId,
                role: "view",
                // Use orgId from first selected employee (or handle per-user if needed)
                orgId: orgId,
            };

            // Bulk add via single request
            const res = await fetch("https://uatapi.garage.app/taskroom/v1/users/roles/bulk", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            const result = await res.json();

            if (!res.ok || !result.status) {
                throw new Error(result.message || "Failed to add members");
            }

            const newMembers: Member[] = result.data?.data || result.data || [];
            setnewCountMenmbers(Number(selectedIds?.length))
            // Update parent state
            setMembers((prev) => [...prev, ...newMembers]);

            // Add to chat (if conversation exists)
            if (conversationId && newMembers.length > 0) {
                const chatUserIds = newMembers
                    .map(m => m.userId)
                    .filter(Boolean) as string[];

                if (chatUserIds.length > 0) {
                    // await addMembersToTaskroomChatBulk(chatUserIds, conversationId);
                }
            }

            toast(`${newMembers.length} member${newMembers.length > 1 ? "s" : ""} added`);
            setSelectedIds([]);
            setIsDialogOpen(false);
        } catch (err: any) {
            console.error(err);
            toast(err.message || "Failed to add members");
        } finally {
            setIsAddingId(null);
        }
    };
    const addMembersToTaskroomChatBulk = async (userIds: string[], convId: string) => {
        const token = localStorage.getItem("garage_tok");
        const API_URL = "https://uatapi.garage.app";

        const res = await fetch(`${API_URL}/api/chat/conversations/${convId}/participants`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ participants: userIds }),
        });

        if (!res.ok) {
            console.warn("Failed to add some users to chat:", await res.text());
        }
    };


    const removeMember = async (m: Member) => {
        const idToRemove = m?._id;
        const userIdToRemove = m.userId; // This is the userId we need to unassign

        console.log("removing member", m);

        if (!idToRemove) {
            setMembers((prev) => prev.filter((x) => x._id !== m._id));
            return;
        }

        try {
            const token = localStorage.getItem("garage_tok");

            // Verify token
            const meRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!meRes.ok) throw new Error("Token verification failed");

            setIsRemovingId(idToRemove);

            // Step 1: Remove member from project
            const res = await fetch(
                `https://uatapi.garage.app/taskroom/v1/users/roles/${idToRemove}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!res.ok) {
                const txt = await res.text();
                throw new Error(txt || "Failed to remove member");
            }

            const { status } = await res.json();
            if (!status) throw new Error("Remove failed");

            // Step 2: Update local member list
            setMembers((prev) => prev.filter((x) => x._id !== idToRemove));
            setnewCountMenmbers((prev) => prev - 1);


            setStagecolumns((prev) =>
                prev.map((task) =>
                    task.assignedToId === userIdToRemove
                        ? { ...task, assignedToId: undefined }
                        : task
                )
            );
            // Step 3: Unassign tasks from this user in ALL columns (including paginated records)
            if (userIdToRemove) {
                setColumns((prevColumns) =>
                    prevColumns.map((column) => ({
                        ...column,
                        tasks: column.tasks.map((task) =>
                            task.assignedToId === userIdToRemove
                                ? { ...task, assignedToId: undefined } // or null if your backend prefers null
                                : task
                        ),
                        // Safely handle possibly undefined paginatedTaskRecords
                        paginatedTaskRecords: column.paginatedTaskRecords
                            ? column.paginatedTaskRecords.map((task) =>
                                task.assignedToId === userIdToRemove
                                    ? { ...task, assignedToId: undefined }
                                    : task
                            )
                            : undefined, // or [] if you prefer keeping it as empty array
                    }))
                );
            }

            toast("Member removed and tasks unassigned");
        } catch (err: any) {
            console.error(err);
            toast(err.message || "Unable to remove member");
        } finally {
            setIsRemovingId(null);
        }
    };

    /* ----------------------------------------------------------- */
    /*                     FILTER EMPLOYEES (exclude members)      */
    /* ----------------------------------------------------------- */
    const filteredEmployees = useMemo(() => {
        const memberUserIds = new Set(members.map((m) => m.userId).filter(Boolean));
        return employees?.filter((e) => !memberUserIds?.has(e?.id))?.filter((e) => e?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase()));
    }, [employees, members, searchTerm]);

    /* ----------------------------------------------------------- */
    /*                         RENDER                              */
    /* ----------------------------------------------------------- */
    return (
        <aside className="h-screen sticky top-0 flex flex-col bg-[#0e0e12] border-l border-[#e5e7eb29]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#e5e7eb29]">
                <div className="text-sm font-medium text-white">Project Panel</div>
                <Button variant="ghost" size="icon" aria-label="Collapse" onClick={onClose} className="text-gray-400 hover:text-white">
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Body */}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                    {/* Team Members Card */}
                    <Card className="p-4 bg-[#0e0e12] border-[#e5e7eb29]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium text-white">Team Members</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Add member"
                                    onClick={() => setIsDialogOpen(true)}
                                    className="text-gray-400 hover:text-white"
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" aria-label="Collapse" className="text-gray-400 hover:text-white">
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        {/* <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search members..."
                                // value={searchQuery}
                                // onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 h-9 text-sm"
                            />
                        </div> */}

                        <Separator className="mb-4 bg-[#e5e7eb29]" />
                        <Separator className="my-3 bg-[#e5e7eb29]" />

                        <div className="space-y-1">
                            {Array.from(new Map(members.map(m => [m.userId, m])).values()).map(m => (
                                <MemberItem
                                    key={m._id}
                                    m={m}
                                    removing={isRemovingId === m._id}
                                    onRemove={removeMember}
                                    employees={employees}
                                />
                            ))}

                            {/* Infinite-scroll trigger */}
                            {observerHasMore && (
                                <div ref={loadMoreTriggerRef} className="flex justify-center py-3">
                                    {observerLoading ? (
                                        <Skeleton className="h-9 w-9 rounded-full" />
                                    ) : (
                                        <span className="text-xs text-gray-500">
                                            Scroll for more…
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </ScrollArea>

            {/* ------------------------------------------------------- */}
            {/*                ADD MEMBER DIALOG (MULTI-SELECT)         */}
            {/* ------------------------------------------------------- */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md bg-[#0e0e12] border-[#e5e7eb29]">
                    <DialogHeader>
                        <DialogTitle className="text-white">Add team members</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Select one or more people to add to this project.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Search */}
                    <div className="mb-3">
                        <input
                            type="text"
                            placeholder="Search by name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-2 text-sm bg-gray-900 border border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-600 text-white placeholder:text-gray-500"
                        />
                    </div>

                    {/* Employees list */}
                    <ScrollArea className="max-h-64 pr-1">
                        {filteredEmployees?.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">
                                {searchTerm
                                    ? "No members found matching your search."
                                    : "No available members to add."}
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {filteredEmployees?.map((emp) => {
                                    const checked = selectedIds.includes(emp.id);
                                    return (
                                        <label
                                            key={emp.id}
                                            className="flex items-center gap-3 rounded-md border border-[#e5e7eb29] p-2 cursor-pointer hover:bg-gray-800/50"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleSelect(emp.id)}
                                                className="h-4 w-4 rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500"
                                            />
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback>{initialsFromName(emp.name)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <span className="text-sm font-medium text-white">{emp.name}</span>
                                                <span className="block text-xs text-gray-500">{emp.email}</span>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </ScrollArea>

                    {/* Footer */}
                    <div className="flex justify-end mt-4 gap-2">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800">
                            Cancel
                        </Button>
                        <Button
                            onClick={addSelectedMembers}
                            disabled={selectedIds.length === 0 || isAddingId !== null}
                            className="bg-white hover:bg-gray-200 text-black"
                        >
                            {isAddingId ? "Adding…" : `Add (${selectedIds.length})`}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </aside>
    );
}
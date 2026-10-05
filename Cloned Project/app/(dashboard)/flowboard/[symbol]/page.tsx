"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { KanbanBoard } from "./components/kanban-board";
import { KanbanBoardListView } from "./components/kanban-board-list-view";
import { useBoardSocketStatus } from "../lib/use-board-socket-status";
import { boardSocketService } from "../lib/board-socket-service";
import { useUserStore } from "@/store/flowboard/userStore";
import { jwtDecode } from 'jwt-decode' 
interface JwtPayload {
  // Adjust these fields according to YOUR actual JWT payload
  sub?: string        // user id
  name?: string
  email?: string
  role?: string
  exp?: number
  orgId?: string
  iat?: number
  userId?: string
  // ... add any custom claims like garageId, permissions, etc.
  [key: string]: any
}
export default function Home() {
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const { connected, reconnecting } = useBoardSocketStatus();
  const params = useParams<{ symbol: string }>();
  const boardId = params?.symbol as string | undefined;

  const userProfile = useUserStore((state) => state.userProfile);
  const isUserProfileFetched = useUserStore((state) => state.isUserProfileFetched);

  useEffect(() => {
    // if (!isUserProfileFetched || !userProfile?._id || !boardId) return;
    if (!boardId) return;
    const userData = localStorage.getItem("garage_tok")
    // Connect board-specific socket after profile API success
    if (userData) {
      const payload = jwtDecode<JwtPayload>(userData)
      boardSocketService.connect(payload.userId, boardId);
    }
    return () => {
      boardSocketService.disconnect();
    };
  }, [isUserProfileFetched, userProfile?._id, boardId]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* <div className="px-4 pt-4 flex justify-end">
        <div className="flex items-center gap-2 text-xs sm:text-sm rounded-full bg-white/80 shadow-sm border border-emerald-100 px-3 py-1">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              connected
                ? "bg-emerald-500"
                : reconnecting
                ? "bg-yellow-400 animate-pulse"
                : "bg-red-500"
            }`}
          />
          <span className="text-gray-600">
            {connected
              ? "Board socket connected"
              : reconnecting
              ? "Reconnecting board socket…"
              : "Board socket offline"}
          </span>
        </div>
      </div> */}

      <div className="flex-1">
        <KanbanBoard connected={connected} />
        {/* <KanbanBoardListView /> */}
        {/* {viewMode === "board" ? <KanbanBoard /> : <KanbanBoardListView />} */}
      </div>
    </div>
  );
}

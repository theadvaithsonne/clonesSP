import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Floor, FloorMember } from "../types";

export function useFloors(me: string, amIFounder: boolean) {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [showFloorsPopover, setShowFloorsPopover] = useState(false);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [myFloorId, setMyFloorId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<
    Map<
      string,
      {
        role: string;
        name: string;
        email: string;
        profilePicture?: string;
        guest?: boolean;
        downlineCount?: number;
        lastSeenAt?: string | null;
      }
    >
  >(new Map());
  const [isFloorTransitioning, setIsFloorTransitioning] = useState(false);
  const [floorTransitionDirection, setFloorTransitionDirection] = useState<
    "up" | "down" | null
  >(null);

  const handleFloorChange = useCallback(
    (newFloorId: string | null) => {
      if (newFloorId === selectedFloorId) return;

      if (selectedFloorId && newFloorId) {
        const currentFloor = floors.find((f) => f.id === selectedFloorId);
        const newFloor = floors.find((f) => f.id === newFloorId);

        if (currentFloor && newFloor) {
          const direction = newFloor.level > currentFloor.level ? "up" : "down";
          setFloorTransitionDirection(direction);
        }
      }

      setIsFloorTransitioning(true);

      setTimeout(() => {
        setSelectedFloorId(newFloorId);
        setIsFloorTransitioning(false);
        setFloorTransitionDirection(null);
      }, 300);
    },
    [selectedFloorId, floors]
  );

  const fetchFloors = useCallback(async () => {
    if (loadingFloors) return;
    const orgId = localStorage.getItem("garage_org_id");

    setLoadingFloors(true);
    try {
      const [floorsData, teamData] = await Promise.all([
        api<{ floors: Floor[]; unassigned: { members: FloorMember[] } }>(
          "/floors/roster?orgId=" + orgId,
          {},
          getToken()!
        ),
        api<{ members: any[] }>("/team/list?orgId=" + orgId, {}, getToken()!),
      ]);

      setFloors(floorsData.floors);

      const membersMap = new Map<
        string,
        {
          role: string;
          name: string;
          email: string;
          profilePicture?: string;
          guest?: boolean;
          downlineCount?: number;
          // `/team/list` already returns this — the sidebar consumes it as
          // its "Active X ago" source. Carry it through so the workspace
          // lobby cards can read it off the same payload instead of making
          // a parallel batch call.
          lastSeenAt?: string | null;
        }
      >();
      teamData.members.forEach((member) => {
        const id = member._id ?? member.id;
        membersMap.set(id, {
          role: member.role || "user",
          name: member.name || "",
          email: member.email || "",
          profilePicture: member.profilePicture || "",
          guest: member.guest || false,
          downlineCount: member.downlineCount || 0,
          lastSeenAt: member.lastSeenAt ?? null,
        });
      });
      setTeamMembers(membersMap);

      const myInfo = teamData.members.find((m) => (m._id ?? m.id) === me);
      if (myInfo) {
        const userFloor = floorsData.floors.find((floor) =>
          floor.members.some((member) => member.id === me)
        );

        if (userFloor) {
          setMyFloorId(userFloor.id);
          // Always default to "Show All" (null) instead of user's assigned floor
          // User can manually select their floor if needed
        } else {
          setMyFloorId(null);
        }

        // Default to "Show All" for everyone (selectedFloorId = null)
        // This ensures all users start with all floors visible
      }
    } catch (error) {
      console.error("Failed to fetch floors:", error);
      setFloors([]);
    } finally {
      setLoadingFloors(false);
    }
  }, [loadingFloors, me, selectedFloorId, amIFounder, handleFloorChange]);

  useEffect(() => {
    if (me && !loadingFloors && floors.length === 0) {
      fetchFloors();
    }
  }, [me, loadingFloors, floors.length, fetchFloors]);

  const handleFloorsButtonClick = useCallback(() => {
    if (!showFloorsPopover) {
      fetchFloors();
    }
    setShowFloorsPopover(!showFloorsPopover);
  }, [showFloorsPopover, fetchFloors]);

  return {
    floors,
    showFloorsPopover,
    loadingFloors,
    selectedFloorId,
    myFloorId,
    teamMembers,
    fetchFloors,
    handleFloorsButtonClick,
    setSelectedFloorId,
    setShowFloorsPopover,
    isFloorTransitioning,
    floorTransitionDirection,
    handleFloorChange,
  };
}

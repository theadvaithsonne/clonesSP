"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  Circle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface RegisteredUser {
  id: string;
  participantId?: string | null;
  name: string;
  email: string;
  profilePicture?: string;
  registeredAt: string;
  hasPaid: boolean;
  attended: boolean;
  joinedAt?: string;
  leftAt?: string;
  isActive: boolean;
  durationMinutes?: number;
}

interface Guest {
  id: string;
  displayName: string;
  email: string;
  isHost: boolean;
  joinedAt: string;
  leftAt?: string;
  isActive: boolean;
  durationMinutes?: number;
}

interface AttendanceStats {
  totalRegistered: number;
  attended: number;
  noShows: number;
  guests: number;
  activeNow: number;
  attendanceRate: number;
}

interface WorkshopInfo {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface AttendanceData {
  hasWorkshop: boolean;
  workshop?: WorkshopInfo;
  stats?: AttendanceStats;
  registeredUsers?: RegisteredUser[];
  guests?: Guest[];
  participants?: Guest[];
}

interface MeetAttendancePanelProps {
  joinCode: string;
  isOpen: boolean;
  onClose: () => void;
  onKickParticipant?: (participantId: string) => void | Promise<void>;
}

export default function MeetAttendancePanel({
  joinCode,
  isOpen,
  onClose,
  onKickParticipant,
}: MeetAttendancePanelProps) {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<
    "registered" | "guests" | null
  >("registered");
  const [kickTarget, setKickTarget] = useState<{ id: string; name: string } | null>(null);
  const [isKicking, setIsKicking] = useState(false);

  const handleConfirmKick = useCallback(async () => {
    if (!kickTarget || !onKickParticipant) return;
    setIsKicking(true);
    try {
      await onKickParticipant(kickTarget.id);
    } finally {
      setIsKicking(false);
      setKickTarget(null);
    }
  }, [kickTarget, onKickParticipant]);

  const fetchAttendance = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/public/meet/attendance?code=${joinCode}`
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setData(result);
        }
      }
    } catch (error) {
      console.error("[Attendance Panel] Error fetching:", error);
    } finally {
      setLoading(false);
    }
  }, [joinCode]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchAttendance();

      // Poll every 10 seconds
      const interval = setInterval(fetchAttendance, 10000);
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchAttendance]);

  const formatDuration = (minutes?: number) => {
    if (!minutes) return "-";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 70) return "text-green-400";
    if (rate >= 40) return "text-yellow-400";
    return "text-red-400";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-[#111116] border-l border-[#2a2a35] flex flex-col z-50 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a35]">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold text-white">Attendance</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setLoading(true);
              fetchAttendance();
            }}
            className="h-8 w-8 p-0 text-gray-400 hover:text-white"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 p-0 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && !data ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent" />
          </div>
        ) : !data ? (
          <div className="text-center text-gray-400 py-8">
            Failed to load attendance data
          </div>
        ) : data.hasWorkshop ? (
          // Workshop-linked meeting
          <div className="space-y-4">
            {/* Workshop Info */}
            <div className="bg-[#1a1a20] rounded-lg p-3 border border-[#2a2a35]">
              <p className="text-xs text-gray-400 mb-1">Workshop</p>
              <p className="text-sm font-medium text-white line-clamp-2">
                {data.workshop?.title}
              </p>
            </div>

            {/* Stats Grid */}
            {data.stats && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#1a1a20] rounded-lg p-3 border border-[#2a2a35]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs text-gray-400">Registered</span>
                  </div>
                  <p className="text-lg font-bold text-white">
                    {data.stats.totalRegistered}
                  </p>
                </div>
                <div className="bg-[#1a1a20] rounded-lg p-3 border border-[#2a2a35]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <UserCheck className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-xs text-gray-400">Attended</span>
                  </div>
                  <p className="text-lg font-bold text-white">
                    {data.stats.attended}
                  </p>
                </div>
                <div className="bg-[#1a1a20] rounded-lg p-3 border border-[#2a2a35]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <UserX className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs text-gray-400">No Shows</span>
                  </div>
                  <p className="text-lg font-bold text-white">
                    {data.stats.noShows}
                  </p>
                </div>
                <div className="bg-[#1a1a20] rounded-lg p-3 border border-[#2a2a35]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <UserPlus className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-xs text-gray-400">Guests</span>
                  </div>
                  <p className="text-lg font-bold text-white">
                    {data.stats.guests}
                  </p>
                </div>
              </div>
            )}

            {/* Attendance Rate */}
            {data.stats && (
              <div className="bg-[#1a1a20] rounded-lg p-3 border border-[#2a2a35]">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Attendance Rate</span>
                  <span
                    className={cn(
                      "text-lg font-bold",
                      getAttendanceColor(data.stats.attendanceRate)
                    )}
                  >
                    {data.stats.attendanceRate}%
                  </span>
                </div>
                <div className="mt-2 h-2 bg-[#2a2a35] rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      data.stats.attendanceRate >= 70
                        ? "bg-green-500"
                        : data.stats.attendanceRate >= 40
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    )}
                    style={{ width: `${data.stats.attendanceRate}%` }}
                  />
                </div>
              </div>
            )}

            {/* Active Now */}
            {data.stats && data.stats.activeNow > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                <Circle className="w-2 h-2 fill-green-400 text-green-400 animate-pulse" />
                <span className="text-sm text-green-400">
                  {data.stats.activeNow} active now
                </span>
              </div>
            )}

            {/* Registered Users Section */}
            <div className="border border-[#2a2a35] rounded-lg overflow-hidden">
              <button
                onClick={() =>
                  setExpandedSection(
                    expandedSection === "registered" ? null : "registered"
                  )
                }
                className="w-full flex items-center justify-between px-3 py-2.5 bg-[#1a1a20] hover:bg-[#1f1f25] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-white">
                    Registered ({data.registeredUsers?.length || 0})
                  </span>
                </div>
                {expandedSection === "registered" ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>
              {expandedSection === "registered" && (
                <div className="max-h-60 overflow-y-auto">
                  {data.registeredUsers?.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No registrations yet
                    </p>
                  ) : (
                    data.registeredUsers?.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-2 px-3 py-2 border-t border-[#2a2a35] hover:bg-[#1a1a20]"
                      >
                        {user.profilePicture ? (
                          <img
                            src={user.profilePicture}
                            alt={user.name}
                            className="w-7 h-7 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-medium text-white">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm text-white truncate">
                              {user.name}
                            </p>
                            {user.isActive && (
                              <Circle className="w-1.5 h-1.5 fill-green-400 text-green-400" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {user.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col items-end gap-0.5">
                            {user.attended ? (
                              <span className="text-xs text-green-400 flex items-center gap-1">
                                <UserCheck className="w-3 h-3" />
                                Joined
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">
                                Not joined
                              </span>
                            )}
                            {user.durationMinutes !== undefined && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDuration(user.durationMinutes)}
                              </span>
                            )}
                          </div>
                          {onKickParticipant && user.isActive && user.participantId && (
                            <button
                              onClick={() => setKickTarget({ id: user.participantId!, name: user.name })}
                              className="p-1 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-400 transition-colors"
                              title={`Remove ${user.name}`}
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Guests Section */}
            {(data.guests?.length || 0) > 0 && (
              <div className="border border-[#2a2a35] rounded-lg overflow-hidden">
                <button
                  onClick={() =>
                    setExpandedSection(
                      expandedSection === "guests" ? null : "guests"
                    )
                  }
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-[#1a1a20] hover:bg-[#1f1f25] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-orange-400" />
                    <span className="text-sm font-medium text-white">
                      Guests ({data.guests?.length || 0})
                    </span>
                  </div>
                  {expandedSection === "guests" ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                {expandedSection === "guests" && (
                  <div className="max-h-60 overflow-y-auto">
                    {data.guests?.map((guest) => (
                      <div
                        key={guest.id}
                        className="flex items-center gap-2 px-3 py-2 border-t border-[#2a2a35] hover:bg-[#1a1a20]"
                      >
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center text-xs font-medium text-white">
                          {guest.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm text-white truncate">
                              {guest.displayName}
                            </p>
                            {guest.isActive && (
                              <Circle className="w-1.5 h-1.5 fill-green-400 text-green-400" />
                            )}
                            {guest.isHost && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                                Host
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {guest.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {guest.durationMinutes !== undefined && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(guest.durationMinutes)}
                            </span>
                          )}
                          {onKickParticipant && guest.isActive && !guest.isHost && (
                            <button
                              onClick={() => setKickTarget({ id: guest.id, name: guest.displayName })}
                              className="p-1 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-400 transition-colors"
                              title={`Remove ${guest.displayName}`}
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // Non-workshop meeting - just show participants
          <div className="space-y-4">
            <div className="bg-[#1a1a20] rounded-lg p-3 border border-[#2a2a35]">
              <p className="text-xs text-gray-400 mb-1">Meeting Participants</p>
              <p className="text-lg font-bold text-white">
                {data.participants?.length || 0}
              </p>
            </div>

            <div className="border border-[#2a2a35] rounded-lg overflow-hidden">
              <div className="px-3 py-2.5 bg-[#1a1a20] border-b border-[#2a2a35]">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-white">
                    All Participants
                  </span>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {data.participants?.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No participants yet
                  </p>
                ) : (
                  data.participants?.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 px-3 py-2 border-t border-[#2a2a35] hover:bg-[#1a1a20]"
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-medium text-white">
                        {p.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm text-white truncate">
                            {p.displayName}
                          </p>
                          {p.isActive && (
                            <Circle className="w-1.5 h-1.5 fill-green-400 text-green-400" />
                          )}
                          {p.isHost && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                              Host
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {p.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!p.isActive && (
                          <span className="text-xs text-gray-500">Left</span>
                        )}
                        {onKickParticipant && p.isActive && !p.isHost && (
                          <button
                            onClick={() => setKickTarget({ id: p.id, name: p.displayName })}
                            className="p-1 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-400 transition-colors"
                            title={`Remove ${p.displayName}`}
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Kick Confirmation Dialog */}
      <AlertDialog open={!!kickTarget} onOpenChange={(open) => { if (!open && !isKicking) setKickTarget(null); }}>
        <AlertDialogContent className="bg-[#1a1a20] border-[#2a2a35]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remove participant</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to remove <span className="font-medium text-white">{kickTarget?.name}</span> from this meeting? They will be disconnected immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isKicking}
              className="bg-transparent border-[#2a2a35] text-gray-300 hover:bg-[#2a2a35] hover:text-white"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isKicking}
              onClick={handleConfirmKick}
            >
              {isKicking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

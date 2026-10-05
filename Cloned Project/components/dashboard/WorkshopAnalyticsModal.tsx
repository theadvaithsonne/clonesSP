"use client";

import { useState, useEffect } from "react";
import {
  X,
  Users,
  UserCheck,
  UserX,
  Clock,
  DollarSign,
  RefreshCw,
  CheckCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingUp,
  BarChart3,
  AlertCircle,
  Film,
  Download,
  Play,
  FileText,
  Sparkles,
  Mail,
  Radio,
  MessageSquare,
  Phone,
} from "lucide-react";
import {
  getWorkshopAnalytics,
  getRecurringWorkshopAnalytics,
  getWebinarSessionAnalytics,
  downloadWebinarAttendeesCsv,
  syncWorkshopAttendance,
  markUserAttended,
  type WorkshopAnalytics,
  type RecurringWorkshopAnalytics,
  type WorkshopParticipantAnalytics,
  type WebinarSessionAnalytics,
  type Workshop,
} from "@/lib/feed-api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

interface WorkshopAnalyticsModalProps {
  workshop: Workshop;
  orgId: string;
  onClose: () => void;
}

export function WorkshopAnalyticsModal({
  workshop,
  orgId,
  onClose,
}: WorkshopAnalyticsModalProps) {
  const [analytics, setAnalytics] = useState<WorkshopAnalytics | null>(null);
  const [recurringAnalytics, setRecurringAnalytics] = useState<RecurringWorkshopAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [recordings, setRecordings] = useState<
    { id: string; name: string; size: number; sizeMB: string; createdAt: string; downloadUrl: string; streamUrl?: string }[]
  >([]);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  // What happened in the room itself — separate from the enrolment figures
  // above, which count registrations rather than presence.
  const [session, setSession] = useState<WebinarSessionAnalytics | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sessionPanel, setSessionPanel] = useState<
    "attendees" | "purchases" | "verifications" | "chat"
  >("attendees");
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [markingAttendance, setMarkingAttendance] = useState<string | null>(null);

  // Note-taker AI summary sessions
  interface NoteTakerSession {
    _id: string;
    status: "recording" | "transcribing" | "summarizing" | "ready" | "failed";
    startedAt: string;
    endedAt?: string;
    durationSeconds?: number;
    participants?: { name?: string; email?: string }[];
    transcriptId?: string;
    summaryId?: string;
  }
  interface NoteSummary {
    overview?: string;
    keyTopics?: string[];
    actionItems?: { description: string; assignee?: string; deadline?: string }[];
    decisions?: string[];
    questions?: string[];
    markdownSummary?: string;
  }
  const [noteSessions, setNoteSessions] = useState<NoteTakerSession[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [summaryCache, setSummaryCache] = useState<Record<string, NoteSummary>>({});
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      if (workshop.isRecurring) {
        const result = await getRecurringWorkshopAnalytics(workshop._id, orgId, {
          limit: 20,
          includePast: true,
        });
        setRecurringAnalytics(result);
      } else {
        const result = await getWorkshopAnalytics(workshop._id, orgId);
        setAnalytics(result.analytics);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  const fetchSession = async () => {
    setLoadingSession(true);
    try {
      setSession(await getWebinarSessionAnalytics(workshop._id));
    } catch {
      // 403 for a non-host, or the endpoint not deployed yet. The section
      // renders its own empty state rather than shouting at the founder.
      setSession(null);
    } finally {
      setLoadingSession(false);
    }
  };

  const handleExportAttendees = async () => {
    setExporting(true);
    try {
      await downloadWebinarAttendeesCsv(workshop._id);
      toast.success("Attendee list downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const fetchRecordings = async () => {
    setLoadingRecordings(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") || "" : "";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/webinar/${workshop._id}/recordings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRecordings(data.recordings || []);
      }
    } catch {
      /* silent — recordings section just stays empty */
    } finally {
      setLoadingRecordings(false);
    }
  };

  const fetchNoteSessions = async () => {
    setLoadingNotes(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") || "" : "";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(
        `${apiUrl}/note-taker/sessions?roomName=${encodeURIComponent(workshop._id)}&limit=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setNoteSessions(data.sessions || []);
      }
    } catch {
      /* silent */
    } finally {
      setLoadingNotes(false);
    }
  };

  const fetchSummaryFor = async (sessionId: string) => {
    if (summaryCache[sessionId]) return;
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") || "" : "";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/note-taker/sessions/${sessionId}/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.summary) {
          setSummaryCache((prev) => ({ ...prev, [sessionId]: data.summary }));
        }
      }
    } catch {
      /* silent */
    }
  };

  const toggleNote = async (sessionId: string) => {
    if (expandedNote === sessionId) {
      setExpandedNote(null);
    } else {
      setExpandedNote(sessionId);
      await fetchSummaryFor(sessionId);
    }
  };

  const resendSummaryEmail = async (sessionId: string) => {
    setResending(sessionId);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") || "" : "";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/note-taker/sessions/${sessionId}/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) toast.success("Summary email queued to participants");
      else toast.error("Failed to queue email");
    } catch {
      toast.error("Failed to queue email");
    } finally {
      setResending(null);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    fetchRecordings();
    fetchNoteSessions();
    fetchSession();
  }, [workshop._id, orgId]);

  const handleSyncAttendance = async () => {
    setSyncing(true);
    try {
      const result = await syncWorkshopAttendance(workshop._id, orgId);
      toast.success(result.message);
      if (result.synced > 0) {
        fetchAnalytics();
      }
    } catch (error) {
      console.error("Error syncing attendance:", error);
      toast.error("Failed to sync attendance");
    } finally {
      setSyncing(false);
    }
  };

  const handleMarkAttended = async (userId: string, sessionDate?: string) => {
    setMarkingAttendance(userId);
    try {
      await markUserAttended(workshop._id, userId, orgId, sessionDate);
      toast.success("User marked as attended");
      fetchAnalytics();
    } catch (error) {
      console.error("Error marking attendance:", error);
      toast.error("Failed to mark attendance");
    } finally {
      setMarkingAttendance(null);
    }
  };

  const toggleSession = (sessionDate: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionDate)) {
      newExpanded.delete(sessionDate);
    } else {
      newExpanded.add(sessionDate);
    }
    setExpandedSessions(newExpanded);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 70) return "text-green-400";
    if (rate >= 40) return "text-brand";
    return "text-red-400";
  };

  const getAttendanceBg = (rate: number) => {
    if (rate >= 70) return "bg-green-500/10 border-green-500/20";
    if (rate >= 40) return "bg-brand/10 border-brand/20";
    return "bg-red-500/10 border-red-500/20";
  };

  const renderStats = (data: WorkshopAnalytics, compact = false) => (
    <div className={cn("grid gap-3", compact ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-4")}>
      {/* Total Enrolled */}
      <div className="bg-[#1a1a22] border border-[#2a2a35] rounded-xl p-4 hover:border-[#3a3a45] transition-colors">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 bg-blue-500/10 rounded-lg">
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-xs text-[#9fa0b8] font-medium uppercase tracking-wide">Enrolled</span>
        </div>
        <div className="text-2xl font-bold text-white">{data.totalEnrollments}</div>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-xs text-[#9fa0b8]">{data.enrolledBeforeStart} pre-registered</span>
        </div>
      </div>

      {/* Attended */}
      <div className="bg-[#1a1a22] border border-[#2a2a35] rounded-xl p-4 hover:border-[#3a3a45] transition-colors">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 bg-green-500/10 rounded-lg">
            <UserCheck className="w-4 h-4 text-green-400" />
          </div>
          <span className="text-xs text-[#9fa0b8] font-medium uppercase tracking-wide">Attended</span>
        </div>
        <div className="text-2xl font-bold text-white">{data.totalAttended}</div>
        <div className="flex items-center gap-1 mt-1">
          <TrendingUp className={cn("w-3 h-3", getAttendanceColor(data.attendanceRate))} />
          <span className={cn("text-xs font-medium", getAttendanceColor(data.attendanceRate))}>
            {data.attendanceRate}% rate
          </span>
        </div>
      </div>

      {/* No Shows */}
      <div className="bg-[#1a1a22] border border-[#2a2a35] rounded-xl p-4 hover:border-[#3a3a45] transition-colors">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 bg-red-500/10 rounded-lg">
            <UserX className="w-4 h-4 text-red-400" />
          </div>
          <span className="text-xs text-[#9fa0b8] font-medium uppercase tracking-wide">No Shows</span>
        </div>
        <div className="text-2xl font-bold text-white">{data.noShows}</div>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-xs text-[#9fa0b8]">{data.cancelledEnrollments} cancelled</span>
        </div>
      </div>

      {/* Revenue */}
      <div className="bg-[#1a1a22] border border-[#2a2a35] rounded-xl p-4 hover:border-[#3a3a45] transition-colors">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 bg-brand/10 rounded-lg">
            <DollarSign className="w-4 h-4 text-brand" />
          </div>
          <span className="text-xs text-[#9fa0b8] font-medium uppercase tracking-wide">Revenue</span>
        </div>
        <div className="text-2xl font-bold text-brand">
          {formatCurrency(data.totalRevenue, data.currency)}
        </div>
      </div>
    </div>
  );

  const renderParticipantRow = (
    participant: WorkshopParticipantAnalytics,
    sessionDate?: string
  ) => (
    <div
      key={`${participant.userId}-${sessionDate || ""}`}
      className="flex items-center justify-between py-3 px-4 hover:bg-[#1a1a22] border-b border-[#2a2a35]/50 last:border-0 transition-colors"
    >
      <div className="flex items-center gap-3">
        {participant.profilePicture ? (
          <img
            src={participant.profilePicture}
            alt={participant.name}
            className="w-9 h-9 rounded-full object-cover ring-2 ring-[#2a2a35]"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand/20 to-brand/5 flex items-center justify-center text-sm font-semibold text-brand ring-2 ring-[#2a2a35]">
            {participant.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <div className="text-sm font-medium text-white">{participant.name}</div>
          <div className="text-xs text-[#9fa0b8]">{participant.email}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Enrollment timing badge */}
        <div
          className={cn(
            "text-xs px-2.5 py-1 rounded-full font-medium border",
            participant.enrolledBeforeStart
              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
              : "bg-orange-500/10 text-orange-400 border-orange-500/20"
          )}
        >
          {participant.enrolledBeforeStart ? "Pre-enrolled" : "Late"}
        </div>

        {/* Duration in meeting */}
        {participant.durationInMeeting !== undefined && (
          <div className="flex items-center gap-1.5 text-xs text-[#9fa0b8] bg-[#1a1a22] px-2.5 py-1 rounded-full border border-[#2a2a35]">
            <Clock className="w-3 h-3" />
            {formatDuration(participant.durationInMeeting)}
          </div>
        )}

        {/* Attendance status */}
        {participant.attended ? (
          <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Attended</span>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={() => handleMarkAttended(participant.userId, sessionDate)}
            disabled={markingAttendance === participant.userId}
            className="h-7 text-xs bg-[#1a1a22] border border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35] hover:border-brand/50"
          >
            {markingAttendance === participant.userId ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              "Mark Attended"
            )}
          </Button>
        )}

        {/* Payment */}
        {participant.amountPaid && participant.amountPaid > 0 && (
          <div className="text-xs text-brand bg-brand/10 px-2.5 py-1 rounded-full border border-brand/20 font-medium">
            {formatCurrency(participant.amountPaid, "INR")}
          </div>
        )}
      </div>
    </div>
  );

  const renderParticipantsList = (
    participants: WorkshopParticipantAnalytics[],
    sessionDate?: string
  ) => (
    <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-[#1a1a22] border-b border-[#2a2a35] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#9fa0b8]" />
          <span className="text-sm font-medium text-white">
            Participants
          </span>
          <span className="text-xs text-[#9fa0b8] bg-[#0e0e12] px-2 py-0.5 rounded-full">
            {participants.length}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-[#9fa0b8]">
              {participants.filter((p) => p.attended).length} attended
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-[#9fa0b8]">
              {participants.filter((p) => !p.attended).length} no-show
            </span>
          </div>
        </div>
      </div>
      <div className="max-h-[350px] overflow-y-auto">
        {participants.length === 0 ? (
          <div className="py-12 text-center">
            <AlertCircle className="w-8 h-8 text-[#9fa0b8] mx-auto mb-2 opacity-50" />
            <p className="text-[#9fa0b8] text-sm">No participants enrolled yet</p>
          </div>
        ) : (
          participants.map((p) => renderParticipantRow(p, sessionDate))
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0e0e12] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-[#2a2a35] shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a35] bg-[#0e0e12]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand/10 rounded-xl">
              <BarChart3 className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Workshop Analytics</h2>
              <p className="text-sm text-[#9fa0b8] line-clamp-1">{workshop.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSyncAttendance}
              disabled={syncing}
              className="gap-2 bg-[#1a1a22] border border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35] hover:border-brand/50"
            >
              <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
              Sync Attendance
            </Button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#1a1a22] rounded-lg transition-colors text-[#9fa0b8] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0b0b0d]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#2a2a35] border-t-brand mb-4" />
              <p className="text-[#9fa0b8] text-sm">Loading analytics...</p>
            </div>
          ) : workshop.isRecurring && recurringAnalytics ? (
            // Recurring workshop analytics
            <div className="space-y-6">
              {/* Aggregated stats */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-sm font-medium text-white">Overall Statistics</h3>
                  <span className="text-xs text-[#9fa0b8] bg-[#1a1a22] px-2 py-0.5 rounded-full border border-[#2a2a35]">
                    {recurringAnalytics.aggregated.totalSessions} sessions
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-[#1a1a22] border border-[#2a2a35] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-blue-500/10 rounded-lg">
                        <Users className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="text-xs text-[#9fa0b8] font-medium">Total Enrolled</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {recurringAnalytics.aggregated.totalEnrollments}
                    </div>
                  </div>
                  <div className="bg-[#1a1a22] border border-[#2a2a35] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-green-500/10 rounded-lg">
                        <UserCheck className="w-4 h-4 text-green-400" />
                      </div>
                      <span className="text-xs text-[#9fa0b8] font-medium">Total Attended</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {recurringAnalytics.aggregated.totalAttended}
                    </div>
                  </div>
                  <div className="bg-[#1a1a22] border border-[#2a2a35] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-purple-500/10 rounded-lg">
                        <TrendingUp className="w-4 h-4 text-purple-400" />
                      </div>
                      <span className="text-xs text-[#9fa0b8] font-medium">Avg Attendance</span>
                    </div>
                    <div className={cn("text-2xl font-bold", getAttendanceColor(recurringAnalytics.aggregated.averageAttendanceRate))}>
                      {recurringAnalytics.aggregated.averageAttendanceRate}%
                    </div>
                  </div>
                  <div className="bg-[#1a1a22] border border-[#2a2a35] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-brand/10 rounded-lg">
                        <DollarSign className="w-4 h-4 text-brand" />
                      </div>
                      <span className="text-xs text-[#9fa0b8] font-medium">Total Revenue</span>
                    </div>
                    <div className="text-2xl font-bold text-brand">
                      {formatCurrency(recurringAnalytics.aggregated.totalRevenue, "INR")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Per-session breakdown */}
              <div>
                <h3 className="text-sm font-medium text-white mb-4">Session Breakdown</h3>
                <div className="space-y-2">
                  {recurringAnalytics.sessions.length === 0 ? (
                    <div className="bg-[#1a1a22] border border-[#2a2a35] rounded-xl p-8 text-center">
                      <Calendar className="w-8 h-8 text-[#9fa0b8] mx-auto mb-2 opacity-50" />
                      <p className="text-[#9fa0b8] text-sm">No sessions found</p>
                    </div>
                  ) : (
                    recurringAnalytics.sessions.map((session) => (
                      <div
                        key={session.sessionDate}
                        className="bg-[#1a1a22] border border-[#2a2a35] rounded-xl overflow-hidden hover:border-[#3a3a45] transition-colors"
                      >
                        <button
                          onClick={() => toggleSession(session.sessionDate)}
                          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#0e0e12]/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#0e0e12] rounded-lg">
                              <Calendar className="w-4 h-4 text-brand" />
                            </div>
                            <div className="text-left">
                              <span className="text-white font-medium block">
                                {format(new Date(session.sessionDate), "EEE, MMM d, yyyy")}
                              </span>
                              <span className="text-[#9fa0b8] text-xs">
                                {session.startTime} - {session.endTime}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-[#9fa0b8]">
                                <span className="text-white font-medium">{session.totalEnrollments}</span> enrolled
                              </span>
                              <span className="text-[#9fa0b8]">
                                <span className="text-green-400 font-medium">{session.totalAttended}</span> attended
                              </span>
                              <span
                                className={cn(
                                  "px-2.5 py-1 rounded-full text-xs font-medium border",
                                  getAttendanceBg(session.attendanceRate),
                                  getAttendanceColor(session.attendanceRate)
                                )}
                              >
                                {session.attendanceRate}%
                              </span>
                            </div>
                            <div className="p-1.5 rounded-lg bg-[#0e0e12]">
                              {expandedSessions.has(session.sessionDate) ? (
                                <ChevronUp className="w-4 h-4 text-[#9fa0b8]" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-[#9fa0b8]" />
                              )}
                            </div>
                          </div>
                        </button>
                        {expandedSessions.has(session.sessionDate) && (
                          <div className="border-t border-[#2a2a35] p-4 bg-[#0e0e12]/50 space-y-4">
                            {renderStats(session, true)}
                            {renderParticipantsList(session.participants, session.sessionDate)}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : analytics ? (
            // Single workshop analytics
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-sm text-[#9fa0b8] bg-[#1a1a22] px-4 py-2.5 rounded-xl border border-[#2a2a35] w-fit">
                <Calendar className="w-4 h-4 text-brand" />
                <span>{format(new Date(analytics.workshopDate), "EEEE, MMMM d, yyyy")}</span>
                <span className="text-[#2a2a35]">|</span>
                <Clock className="w-4 h-4" />
                <span>{analytics.startTime} - {analytics.endTime}</span>
              </div>
              {renderStats(analytics)}
              {renderParticipantsList(analytics.participants)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertCircle className="w-10 h-10 text-[#9fa0b8] mb-3 opacity-50" />
              <p className="text-[#9fa0b8]">No analytics data available</p>
            </div>
          )}

          {/* ── Live Session Section ────────────────────────────────────
              What happened in the room: who was there, what they bought,
              who verified a phone number to buy it, and the chat.

              Deliberately separate from the enrolment statistics above.
              Those count registrations — signing up is not attending — and
              this counts presence. Merging them into one block would invite
              reading a registration figure as an audience figure.          */}
          <div className="mt-6 pt-6 border-t border-[#2a2a35]">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                <Radio className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Live Session</h3>
              {loadingSession && (
                <Loader2 className="w-3.5 h-3.5 text-[#9fa0b8] animate-spin" />
              )}
              <div className="ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    exporting || !session || session.attendees.length === 0
                  }
                  onClick={handleExportAttendees}
                  className="h-8 gap-1.5 bg-[#1a1a22] border-[#2a2a35] text-[#9fa0b8] hover:text-white"
                >
                  {exporting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Export CSV
                </Button>
              </div>
            </div>

            {loadingSession ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-[#9fa0b8] animate-spin" />
              </div>
            ) : !session ? (
              <div className="bg-[#1a1a22] border border-[#2a2a35] rounded-xl p-6 text-center">
                <p className="text-[#9fa0b8] text-sm">
                  Live session data isn&apos;t available for this workshop.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-[#1a1a22] border border-[#2a2a35] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                        <Users className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="text-xs text-[#9fa0b8] font-medium">
                        In the room
                      </span>
                    </div>
                    {/*
                      An empty list means one of two very different things,
                      and a bare "0" would say the wrong one. Attendance is
                      only recorded from the day the feature shipped, so a
                      webinar that ran before it has no data — not an
                      audience of nobody.
                    */}
                    <div className="text-2xl font-bold text-white">
                      {session.summary.attendanceRecorded
                        ? session.summary.attendees
                        : "—"}
                    </div>
                    {!session.summary.attendanceRecorded && (
                      <p className="text-[10px] text-[#9fa0b8] mt-1 leading-snug">
                        Not recorded for this session
                      </p>
                    )}
                  </div>

                  <div className="bg-[#1a1a22] border border-[#2a2a35] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-blue-500/10 rounded-lg">
                        <MessageSquare className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="text-xs text-[#9fa0b8] font-medium">
                        Comments
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {session.summary.messages}
                    </div>
                    <p className="text-[10px] text-[#9fa0b8] mt-1">
                      from {session.summary.chatParticipants}{" "}
                      {session.summary.chatParticipants === 1
                        ? "person"
                        : "people"}
                    </p>
                  </div>

                  <div className="bg-[#1a1a22] border border-[#2a2a35] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-purple-500/10 rounded-lg">
                        <Phone className="w-4 h-4 text-purple-400" />
                      </div>
                      <span className="text-xs text-[#9fa0b8] font-medium">
                        Phone verified
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {session.summary.phoneVerifications}
                    </div>
                    {session.summary.comboWindowsStarted > 0 && (
                      <p className="text-[10px] text-[#9fa0b8] mt-1">
                        {session.summary.comboWindowsStarted} started their
                        24h window
                      </p>
                    )}
                  </div>

                  <div className="bg-[#1a1a22] border border-[#2a2a35] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-brand/10 rounded-lg">
                        <DollarSign className="w-4 h-4 text-brand" />
                      </div>
                      <span className="text-xs text-[#9fa0b8] font-medium">
                        Sold
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-brand">
                      {session.summary.purchasesPaid}
                    </div>
                    {/*
                      Unpaid drafts are counted separately. Folding them into
                      the headline would report money that never arrived.
                    */}
                    {session.summary.purchases >
                      session.summary.purchasesPaid && (
                      <p className="text-[10px] text-[#9fa0b8] mt-1">
                        {session.summary.purchases -
                          session.summary.purchasesPaid}{" "}
                        unpaid
                      </p>
                    )}
                  </div>
                </div>

                {Object.keys(session.summary.revenuePaid).length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {Object.entries(session.summary.revenuePaid).map(
                      ([currency, amount]) => (
                        <span
                          key={currency}
                          className="text-xs bg-brand/10 text-brand px-2.5 py-1 rounded-full border border-brand/20 font-medium"
                        >
                          {formatCurrency(amount, currency)}
                        </span>
                      ),
                    )}
                  </div>
                )}

                <div className="flex gap-1 mb-3 border-b border-[#2a2a35]">
                  {(
                    [
                      ["attendees", "Attendees", session.attendees.length],
                      ["purchases", "Purchases", session.purchases.length],
                      [
                        "verifications",
                        "Verifications",
                        session.phoneVerifications.length,
                      ],
                      ["chat", "Chat", session.messages.length],
                    ] as const
                  ).map(([key, label, count]) => (
                    <button
                      key={key}
                      onClick={() => setSessionPanel(key)}
                      className={cn(
                        "px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
                        sessionPanel === key
                          ? "border-emerald-400 text-white"
                          : "border-transparent text-[#9fa0b8] hover:text-white",
                      )}
                    >
                      {label} ({count})
                    </button>
                  ))}
                </div>

                <div className="max-h-72 overflow-y-auto rounded-xl border border-[#2a2a35] bg-[#1a1a22]">
                  {sessionPanel === "attendees" &&
                    (session.attendees.length === 0 ? (
                      <p className="p-6 text-center text-sm text-[#9fa0b8]">
                        {session.summary.attendanceRecorded
                          ? "Nobody joined this session."
                          : "Attendance wasn't being recorded when this session ran."}
                      </p>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="text-[11px] uppercase tracking-wide text-[#9fa0b8]">
                          <tr className="border-b border-[#2a2a35]">
                            <th className="px-3 py-2 font-medium">Name</th>
                            <th className="px-3 py-2 font-medium">Email</th>
                            <th className="px-3 py-2 font-medium">Watched</th>
                            <th className="px-3 py-2 font-medium">Joins</th>
                          </tr>
                        </thead>
                        <tbody>
                          {session.attendees.map((a) => (
                            <tr
                              key={`${a.userId}-${a.sessionDate}`}
                              className="border-b border-[#2a2a35]/60 last:border-0"
                            >
                              <td className="px-3 py-2 text-white">
                                {a.name || "—"}
                                {a.role !== "attendee" && (
                                  <span className="ml-2 text-[10px] uppercase tracking-wide text-emerald-400">
                                    {a.role}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-[#9fa0b8]">
                                {a.email || "—"}
                              </td>
                              <td className="px-3 py-2 text-[#9fa0b8] tabular-nums">
                                {a.minutes} min
                              </td>
                              <td className="px-3 py-2 text-[#9fa0b8] tabular-nums">
                                {a.joinCount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ))}

                  {sessionPanel === "purchases" &&
                    (session.purchases.length === 0 ? (
                      <p className="p-6 text-center text-sm text-[#9fa0b8]">
                        Nothing was bought from this session.
                      </p>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="text-[11px] uppercase tracking-wide text-[#9fa0b8]">
                          <tr className="border-b border-[#2a2a35]">
                            <th className="px-3 py-2 font-medium">Buyer</th>
                            <th className="px-3 py-2 font-medium">Product</th>
                            <th className="px-3 py-2 font-medium">Amount</th>
                            <th className="px-3 py-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {session.purchases.map((p) => (
                            <tr
                              key={`${p.invoiceId}-${p.itemId}`}
                              className="border-b border-[#2a2a35]/60 last:border-0"
                            >
                              <td className="px-3 py-2 text-white">
                                {p.buyerName || p.buyerEmail || "—"}
                              </td>
                              <td className="px-3 py-2 text-[#9fa0b8]">
                                {p.itemName || "—"}
                              </td>
                              <td className="px-3 py-2 text-[#9fa0b8] tabular-nums">
                                {formatCurrency(p.amount, p.currency)}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={cn(
                                    "text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full",
                                    p.paid
                                      ? "bg-green-500/10 text-green-400"
                                      : "bg-[#2a2a35] text-[#9fa0b8]",
                                  )}
                                >
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ))}

                  {sessionPanel === "verifications" &&
                    (session.phoneVerifications.length === 0 ? (
                      <p className="p-6 text-center text-sm text-[#9fa0b8]">
                        Nobody verified a phone number during this session.
                      </p>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="text-[11px] uppercase tracking-wide text-[#9fa0b8]">
                          <tr className="border-b border-[#2a2a35]">
                            <th className="px-3 py-2 font-medium">Name</th>
                            <th className="px-3 py-2 font-medium">Phone</th>
                            <th className="px-3 py-2 font-medium">
                              Buying
                            </th>
                            <th className="px-3 py-2 font-medium">24h</th>
                          </tr>
                        </thead>
                        <tbody>
                          {session.phoneVerifications.map((v, i) => (
                            <tr
                              key={`${v.userId}-${i}`}
                              className="border-b border-[#2a2a35]/60 last:border-0"
                            >
                              <td className="px-3 py-2 text-white">
                                {v.name || v.email || "—"}
                              </td>
                              <td className="px-3 py-2 text-[#9fa0b8]">
                                {v.phone}
                              </td>
                              <td className="px-3 py-2 text-[#9fa0b8]">
                                {v.itemName || "—"}
                              </td>
                              <td className="px-3 py-2">
                                {v.startedComboWindow ? (
                                  <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                                ) : (
                                  <span className="text-[#9fa0b8]">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ))}

                  {sessionPanel === "chat" &&
                    (session.messages.length === 0 ? (
                      <p className="p-6 text-center text-sm text-[#9fa0b8]">
                        No chat during this session.
                      </p>
                    ) : (
                      <div className="p-3 space-y-2">
                        {session.messages.map((m) => (
                          <div key={m.id} className="leading-tight">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-medium text-emerald-400">
                                {m.name}
                              </span>
                              <span className="text-[10px] text-[#9fa0b8]">
                                {format(new Date(m.timestamp), "d MMM, HH:mm")}
                              </span>
                            </div>
                            <p className="text-[13px] text-white break-words">
                              {m.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>

          {/* ── Recordings Section ──────────────────────────────────── */}
          <div className="mt-6 pt-6 border-t border-[#2a2a35]">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-pink-500/10 rounded-lg">
                <Film className="w-4 h-4 text-pink-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Recordings</h3>
              <span className="text-xs text-[#9fa0b8] ml-1">
                {loadingRecordings ? "Loading..." : `${recordings.length} file${recordings.length !== 1 ? "s" : ""}`}
              </span>
            </div>

            {loadingRecordings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-[#9fa0b8] animate-spin" />
              </div>
            ) : recordings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Film className="w-8 h-8 text-[#9fa0b8] mb-2 opacity-40" />
                <p className="text-sm text-[#9fa0b8]">No recordings yet</p>
                <p className="text-xs text-[#9fa0b8]/60 mt-1">
                  Click Record during a webinar to capture sessions
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recordings.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center gap-3 bg-[#1a1a22] border border-[#2a2a35] rounded-xl px-4 py-3 hover:border-[#3a3a45] transition-colors group"
                  >
                    <div className="p-1.5 bg-pink-500/10 rounded-lg flex-shrink-0">
                      <Film className="w-3.5 h-3.5 text-pink-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{rec.name}</p>
                      <p className="text-xs text-[#9fa0b8] mt-0.5">
                        {format(new Date(rec.createdAt), "MMM d, yyyy h:mm a")} · {parseFloat(rec.sizeMB) >= 1024 ? `${(parseFloat(rec.sizeMB) / 1024).toFixed(2)} GB` : `${rec.sizeMB} MB`}
                      </p>
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {rec.downloadUrl && (
                        <>
                          <a
                            href={rec.streamUrl || rec.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg border border-[#2a2a35] hover:bg-[#2a2a35] transition-colors"
                            title="Play"
                          >
                            <Play className="w-3.5 h-3.5 text-[#9fa0b8]" />
                          </a>
                          <a
                            href={rec.downloadUrl}
                            download={rec.name}
                            className="p-1.5 rounded-lg border border-[#2a2a35] hover:bg-[#2a2a35] transition-colors"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5 text-[#9fa0b8]" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Notes & AI Summary Section ──────────────────────────── */}
          <div className="mt-6 bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-purple-500/10 rounded-lg">
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Notes & Summary</h3>
              <span className="text-xs text-[#9fa0b8] ml-1">
                {loadingNotes ? "Loading..." : `${noteSessions.length} session${noteSessions.length !== 1 ? "s" : ""}`}
              </span>
            </div>

            {loadingNotes ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-[#9fa0b8] animate-spin" />
              </div>
            ) : noteSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="w-8 h-8 text-[#9fa0b8] mb-2 opacity-40" />
                <p className="text-sm text-[#9fa0b8]">No notes yet</p>
                <p className="text-xs text-[#9fa0b8]/60 mt-1">
                  AI notes generate automatically when a webinar is recorded
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {noteSessions.map((s) => {
                  const expanded = expandedNote === s._id;
                  const summary = summaryCache[s._id];
                  const statusBadge =
                    s.status === "ready" ? "bg-emerald-500/10 text-emerald-400"
                    : s.status === "failed" ? "bg-red-500/10 text-red-400"
                    : "bg-yellow-500/10 text-yellow-400";
                  return (
                    <div
                      key={s._id}
                      className="bg-[#1a1a22] border border-[#2a2a35] rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleNote(s._id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a2a35] transition-colors text-left"
                      >
                        <div className="p-1.5 bg-purple-500/10 rounded-lg flex-shrink-0">
                          <FileText className="w-3.5 h-3.5 text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white">
                            {format(new Date(s.startedAt), "MMM d, yyyy h:mm a")}
                            {s.durationSeconds ? (
                              <span className="text-xs text-[#9fa0b8] ml-2">
                                {Math.round(s.durationSeconds / 60)} min
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-[#9fa0b8] mt-0.5">
                            {(s.participants?.length || 0)} participant
                            {(s.participants?.length || 0) !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusBadge)}>
                          {s.status}
                        </span>
                        {expanded ? (
                          <ChevronUp className="w-4 h-4 text-[#9fa0b8]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#9fa0b8]" />
                        )}
                      </button>

                      {expanded && (
                        <div className="px-4 py-4 border-t border-[#2a2a35]">
                          {s.status !== "ready" ? (
                            <p className="text-sm text-[#9fa0b8] italic">
                              Summary not available yet (status: {s.status}). Try again in a minute.
                            </p>
                          ) : !summary ? (
                            <div className="flex items-center gap-2 text-[#9fa0b8]">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="text-sm">Loading summary...</span>
                            </div>
                          ) : (
                            <div className="space-y-4 text-sm">
                              {summary.overview && (
                                <div>
                                  <p className="text-xs font-semibold uppercase text-[#9fa0b8] mb-1 tracking-wider">
                                    Overview
                                  </p>
                                  <p className="text-white/90 leading-relaxed">{summary.overview}</p>
                                </div>
                              )}

                              {summary.keyTopics && summary.keyTopics.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold uppercase text-[#9fa0b8] mb-1 tracking-wider">
                                    Key Topics
                                  </p>
                                  <ul className="list-disc list-inside space-y-1 text-white/80">
                                    {summary.keyTopics.map((t, i) => (
                                      <li key={i}>{t}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {summary.actionItems && summary.actionItems.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold uppercase text-[#9fa0b8] mb-1 tracking-wider">
                                    Action Items
                                  </p>
                                  <ul className="space-y-1 text-white/80">
                                    {summary.actionItems.map((ai, i) => (
                                      <li key={i} className="flex gap-2">
                                        <span className="text-brand">▸</span>
                                        <span>
                                          {ai.description}
                                          {ai.assignee && <span className="text-[#9fa0b8]"> — {ai.assignee}</span>}
                                          {ai.deadline && <span className="text-[#9fa0b8]"> ({ai.deadline})</span>}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {summary.decisions && summary.decisions.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold uppercase text-[#9fa0b8] mb-1 tracking-wider">
                                    Decisions
                                  </p>
                                  <ul className="list-disc list-inside space-y-1 text-white/80">
                                    {summary.decisions.map((d, i) => (
                                      <li key={i}>{d}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {summary.questions && summary.questions.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold uppercase text-[#9fa0b8] mb-1 tracking-wider">
                                    Open Questions
                                  </p>
                                  <ul className="list-disc list-inside space-y-1 text-white/80">
                                    {summary.questions.map((q, i) => (
                                      <li key={i}>{q}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              <div className="pt-2 border-t border-[#2a2a35]">
                                <button
                                  onClick={() => resendSummaryEmail(s._id)}
                                  disabled={resending === s._id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/10 border border-brand/20 text-brand text-xs font-medium hover:bg-brand/20 transition-colors disabled:opacity-50"
                                >
                                  {resending === s._id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Mail className="w-3.5 h-3.5" />
                                  )}
                                  Resend email to participants
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

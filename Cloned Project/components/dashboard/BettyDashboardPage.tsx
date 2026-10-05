"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Bot,
  Calendar,
  Send,
  Plus,
  CalendarCheck,
  RefreshCw,
  Activity,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { useAIProvider } from "@/lib/hooks/useAIProvider";
import OnlineActivityTab from "./OnlineActivityTab";
import AIProviderRequiredModal from "./AIProviderRequiredModal";
import AIProviderSelector from "./AIProviderSelector";

type TimeEntry = {
  _id: string;
  clockInTime: string;
  clockOutTime?: string;
  durationInSeconds?: number;
};

type LeaveRequest = {
  _id: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

type ChatMessage = {
  id: string;
  type: "user" | "betty";
  message: string;
  timestamp: Date;
};

type AttendanceEntry = {
  id: string;
  clockInTime: string;
  clockOutTime: string | null;
  durationInSeconds: number;
};

type AttendanceEmployee = {
  userId: string;
  name: string;
  email: string | null;
  totalDurationInSeconds: number;
  activeEntry: AttendanceEntry | null;
  entries: AttendanceEntry[];
  dailyTotals: Record<string, number>;
};

type AttendanceDay = {
  date: string;
  totalDurationInSeconds: number;
  employees: Array<{
    userId: string;
    name: string;
    email: string | null;
    durationInSeconds: number;
  }>;
};

type AttendanceSummary = {
  range: { start: string; end: string };
  employees: AttendanceEmployee[];
  days: AttendanceDay[];
  generatedAt: string;
};

type AttendanceApiResponse = {
  success: boolean;
  data: AttendanceSummary;
};

// Helper function to convert markdown-like formatting to HTML
// @ts-ignore
function formatMessage(message: string): JSX.Element {
  // Split by double newlines for paragraphs
  const paragraphs = message.split(/\n\n/);

  return (
    <>
      {paragraphs.map((paragraph, i) => {
        // Skip empty paragraphs
        if (!paragraph.trim()) return null;

        // Handle headers (## Text)
        if (paragraph.match(/^##+ .+$/)) {
          const match = paragraph.match(/^(#+)\s+(.+)$/);
          if (match) {
            const level = match[1].length;
            const text = match[2];
            // @ts-ignore
            const HeadingTag = `h${Math.min(
              level + 2,
              6
              // @ts-ignore
            )}` as keyof JSX.IntrinsicElements;

            return (
              //@ts-ignore
              <HeadingTag
                key={i}
                className={`font-semibold text-yellow-400 mb-2 ${
                  level === 1 ? "text-base" : "text-sm"
                }`}
              >
                {text}
              </HeadingTag>
            );
          }
        }

        // Process bold, dates, and other inline formatting
        const lines = paragraph.split("\n");

        return (
          <div key={i} className="mb-2 last:mb-0">
            {lines.map((line, lineIdx) => {
              // Handle bold (**text**) and dates
              const parts = line.split(/(\*\*.*?\*\*|📅.*?\n|📝.*?\n|📊.*?\n)/);

              return (
                <div key={lineIdx} className={lines.length > 1 ? "mb-1" : ""}>
                  {parts.map((part, j) => {
                    // Bold text
                    if (part.startsWith("**") && part.endsWith("**")) {
                      const text = part.slice(2, -2);
                      return (
                        <strong
                          key={j}
                          className="font-semibold text-yellow-300"
                        >
                          {text}
                        </strong>
                      );
                    }

                    // List items
                    if (part.match(/^[•·]\s/) || part.match(/^\d+\.\s/)) {
                      return (
                        <div key={j} className="ml-4">
                          {part}
                        </div>
                      );
                    }

                    // Regular text
                    return <span key={j}>{part}</span>;
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

const getMonthRange = (month: string) => {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

const formatDayLabel = (isoDate: string) => {
  if (!isoDate) return "";
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (isoDate: string) => {
  const date = new Date(isoDate);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function BettyDashboardPage() {
  const { amIFounder } = useAmIFounder();
  const {
    keys: aiProviderKeys,
    selectedProvider,
    isLoading: isLoadingAIProvider,
    hasAnyKey,
    setSelectedProvider,
    refetch: refetchAIProviders,
    isFounder: isAIProviderFounder,
  } = useAIProvider();
  const [showAPIKeyModal, setShowAPIKeyModal] = useState(false);
  const defaultMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
  }, []);

  const [activeTab, setActiveTab] = useState<
    "time" | "leave" | "chat" | "attendance" | "online-activity"
  >("online-activity");
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showCreateLeave, setShowCreateLeave] = useState(false);
  const [newLeaveRequest, setNewLeaveRequest] = useState({
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [attendanceMonth, setAttendanceMonth] = useState(defaultMonth);
  const [attendanceRange, setAttendanceRange] = useState(() =>
    getMonthRange(defaultMonth)
  );
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [attendanceData, setAttendanceData] =
    useState<AttendanceSummary | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [editingEntry, setEditingEntry] = useState<AttendanceEntry | null>(
    null
  );
  const [editFormData, setEditFormData] = useState({
    clockInTime: "",
    clockOutTime: "",
  });
  const [editLoading, setEditLoading] = useState(false);

  const loadTimeEntries = async () => {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const res = await api<{ success: boolean; history: TimeEntry[] }>(
        `/betty/time-tracking?orgId=${orgId}`
      );
      setEntries(res.history || []);
    } catch (error) {
      console.error("Failed to load time entries:", error);
    }
  };

  const loadLeaveRequests = async () => {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const res = await api<{ success: boolean; requests: LeaveRequest[] }>(
        `/betty/my-leave-requests?orgId=${orgId}`
      );
      setLeaveRequests(res.requests || []);
    } catch (error) {
      console.error("Failed to load leave requests:", error);
    }
  };

  const loadChatHistory = async () => {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const res = await api<{ success: boolean; messages: ChatMessage[] }>(
        `/betty/chat-history?orgId=${orgId}`
      );
      if (res.messages && res.messages.length > 0) {
        setChatMessages(res.messages);
      } else {
        // Add welcome message if no history
        setChatMessages([
          {
            id: "welcome",
            type: "betty",
            message: `Hi! I'm Betty, your AI assistant. I can automatically help you with:

**🤖 Automatic Leave Requests:**
• "I need time off tomorrow because I'm sick" → I'll create it instantly!
• "Can I take vacation from December 15 to December 20?" → Done!
• "I want to request leave next week for a family event" → Created!
• "I need personal time off on January 5th" → Submitted!

**📊 Time Tracking:**
• "Show me my recent time entries"
• "How many hours have I worked this week?"

**📅 Leave Management:**
• "Show me my leave requests"
• "What's the status of my recent requests?"

Just tell me what you need in natural language - I'll handle everything automatically!`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
      // Add welcome message on error
      setChatMessages([
        {
          id: "welcome",
          type: "betty",
          message: `Hi! I'm Betty, your AI assistant. I can automatically help you with:

**🤖 Automatic Leave Requests:**
• "I need time off tomorrow because I'm sick" → I'll create it instantly!
• "Can I take vacation from December 15 to December 20?" → Done!
• "I want to request leave next week for a family event" → Created!
• "I need personal time off on January 5th" → Submitted!

**📊 Time Tracking:**
• "Show me my recent time entries"
• "How many hours have I worked this week?"

**📅 Leave Management:**
• "Show me my leave requests"
• "What's the status of my recent requests?"

Just tell me what you need in natural language - I'll handle everything automatically!`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const load = async () => {
    setLoading(true);
    await Promise.all([
      loadTimeEntries(),
      loadLeaveRequests(),
      loadChatHistory(),
    ]);
    setLoading(false);
  };

  const fetchAttendance = useCallback(
    async (range: { start: string; end: string }) => {
      if (!amIFounder) return;
      const orgId = localStorage.getItem("garage_org_id");

      if (!orgId) {
        setAttendanceError("No organization selected");
        setAttendanceData(null);
        return;
      }

      setAttendanceLoading(true);
      setAttendanceError(null);

      try {
        const params = new URLSearchParams({ orgId });
        if (range.start) params.append("start", range.start);
        if (range.end) params.append("end", range.end);

        const res = await api<AttendanceApiResponse>(
          `/betty/org-time-tracking?${params.toString()}`
        );

        if (res.success) {
          setAttendanceData(res.data);
        } else {
          setAttendanceData(null);
          setAttendanceError("Failed to load attendance data");
        }
      } catch (error) {
        console.error("Failed to load attendance overview:", error);
        setAttendanceData(null);
        setAttendanceError("Failed to load attendance data");
      } finally {
        setAttendanceLoading(false);
      }
    },
    [amIFounder]
  );

  useEffect(() => {
    load();
    const onReload = () => load();
    window.addEventListener("betty:reload", onReload as any);

    // Listen for leave request notifications
    const handleLeaveNotification = () => {
      loadLeaveRequests(); // Refresh leave requests when notification received
    };
    window.addEventListener(
      "leave-notification",
      handleLeaveNotification as any
    );

    return () => {
      window.removeEventListener("betty:reload", onReload as any);
      window.removeEventListener(
        "leave-notification",
        handleLeaveNotification as any
      );
    };
  }, []);

  // Tab guard removed — only online-activity tab exists now

  useEffect(() => {
    if (!attendanceData || attendanceData.employees.length === 0) {
      if (selectedEmployeeId !== "") {
        setSelectedEmployeeId("");
      }
      return;
    }

    const exists = attendanceData.employees.some(
      (emp) => emp.userId === selectedEmployeeId
    );

    if (!selectedEmployeeId || !exists) {
      setSelectedEmployeeId(attendanceData.employees[0].userId);
    }
  }, [attendanceData, selectedEmployeeId]);

  useEffect(() => {
    if (!amIFounder || activeTab !== "attendance") return;
    fetchAttendance(attendanceRange);
  }, [
    amIFounder,
    activeTab,
    attendanceRange.start,
    attendanceRange.end,
    fetchAttendance,
  ]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendMessage = async () => {
    if (!chatInput.trim() || sendingMessage) return;

    // Check if user has configured any AI provider keys
    if (!hasAnyKey) {
      setShowAPIKeyModal(true);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      message: chatInput.trim(),
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setSendingMessage(true);

    try {
      const orgId = localStorage.getItem("garage_org_id");
      const res = await api<{
        success: boolean;
        response: string;
        createdLeaveRequest?: any;
      }>(`/betty/chat?orgId=${orgId}`, {
        method: "POST",
        body: JSON.stringify({
          message: userMessage.message,
          provider: selectedProvider,
        }),
      });

      const bettyMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "betty",
        message: res.response,
        timestamp: new Date(),
      };

      setChatMessages((prev) => [...prev, bettyMessage]);

      // If a leave request was created, refresh the leave requests list
      if (res.createdLeaveRequest) {
        loadLeaveRequests();
        toast.success("Leave request created successfully!");
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "betty",
        message:
          "Sorry, I'm having trouble connecting right now. Please try again later.",
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSendingMessage(false);
    }
  };

  const createLeaveRequest = async () => {
    if (
      !newLeaveRequest.startDate ||
      !newLeaveRequest.endDate ||
      !newLeaveRequest.reason
    ) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const orgId = localStorage.getItem("garage_org_id");
      await api(`/betty/leave-requests?orgId=${orgId}`, {
        method: "POST",
        body: JSON.stringify(newLeaveRequest),
      });

      toast.success("Leave request submitted successfully!");
      setNewLeaveRequest({ startDate: "", endDate: "", reason: "" });
      setShowCreateLeave(false);
      loadLeaveRequests();
    } catch (error) {
      toast.error("Failed to submit leave request");
    }
  };

  const totalSeconds = useMemo(
    () =>
      (entries || []).reduce((acc, e) => acc + (e.durationInSeconds || 0), 0),
    [entries]
  );

  const organizationAttendanceStats = useMemo(() => {
    if (!attendanceData) {
      return {
        totalEmployees: 0,
        totalSeconds: 0,
        activeSessions: 0,
        workingDays: 0,
      };
    }

    const totalSecondsWorked = attendanceData.employees.reduce(
      (acc, emp) => acc + emp.totalDurationInSeconds,
      0
    );
    const activeSessions = attendanceData.employees.filter(
      (emp) => emp.activeEntry
    ).length;
    const workingDays = attendanceData.days.filter(
      (day) => day.totalDurationInSeconds > 0
    ).length;

    return {
      totalEmployees: attendanceData.employees.length,
      totalSeconds: totalSecondsWorked,
      activeSessions,
      workingDays,
    };
  }, [attendanceData]);

  const filteredEmployees = useMemo(() => {
    if (!attendanceData) return [];
    const query = employeeSearch.trim().toLowerCase();
    if (!query) return attendanceData.employees;
    return attendanceData.employees.filter((employee) => {
      const name = employee.name?.toLowerCase() ?? "";
      const email = employee.email?.toLowerCase() ?? "";
      return name.includes(query) || email.includes(query);
    });
  }, [attendanceData, employeeSearch]);

  const selectedEmployee = useMemo(() => {
    if (!selectedEmployeeId || !attendanceData) return null;
    return attendanceData.employees.find(
      (emp) => emp.userId === selectedEmployeeId
    );
  }, [attendanceData, selectedEmployeeId]);

  const groupedEntries = useMemo(() => {
    if (!selectedEmployee) return [];

    const map = new Map<
      string,
      {
        date: string;
        entries: AttendanceEntry[];
        totalDurationInSeconds: number;
      }
    >();

    selectedEmployee.entries.forEach((entry) => {
      const dayKey = new Date(entry.clockInTime).toISOString().split("T")[0];
      if (!map.has(dayKey)) {
        map.set(dayKey, {
          date: dayKey,
          entries: [],
          totalDurationInSeconds: 0,
        });
      }
      const target = map.get(dayKey)!;
      target.entries.push(entry);
      target.totalDurationInSeconds += entry.durationInSeconds;
    });

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        entries: group.entries.sort(
          (a, b) =>
            new Date(a.clockInTime).getTime() -
            new Date(b.clockInTime).getTime()
        ),
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedEmployee]);

  const selectedEmployeeDayCount = selectedEmployee
    ? Object.keys(selectedEmployee.dailyTotals || {}).length
    : 0;

  const averageDailySeconds =
    selectedEmployee && selectedEmployeeDayCount > 0
      ? Math.round(
          selectedEmployee.totalDurationInSeconds / selectedEmployeeDayCount
        )
      : 0;

  const lastActivityEntry = selectedEmployee?.entries[0] ?? null;
  const lastActivityDate = lastActivityEntry
    ? new Date(lastActivityEntry.clockInTime)
    : null;

  const formatAverageDaily = () =>
    averageDailySeconds > 0 ? formatDuration(averageDailySeconds) : "0h";

  const handleMonthChange = (value: string) => {
    if (!value) return;
    setAttendanceMonth(value);
    setAttendanceRange(getMonthRange(value));
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return "-";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const formatDurationWithZero = (seconds?: number) => {
    const result = formatDuration(seconds);
    return result === "-" ? "0h" : result;
  };

  const formatHoursDecimal = (seconds?: number) => {
    if (!seconds || seconds <= 0) return "0.00";
    return (seconds / 3600).toFixed(2);
  };

  const handleExport = () => {
    if (!selectedEmployee) return;

    const rows: string[] = ["Date,Clock In,Clock Out,Duration (hours)"];

    selectedEmployee.entries.forEach((entry) => {
      const date = new Date(entry.clockInTime);
      const dateLabel = date.toLocaleDateString();
      const clockInLabel = date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const clockOutLabel = entry.clockOutTime
        ? new Date(entry.clockOutTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "Active";

      rows.push(
        [
          `"${dateLabel}"`,
          `"${clockInLabel}"`,
          `"${clockOutLabel}"`,
          formatHoursDecimal(entry.durationInSeconds),
        ].join(",")
      );
    });

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (selectedEmployee.name || "stakeholder")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "");
    link.href = url;
    link.download = `${safeName || "stakeholder"}_attendance_${
      attendanceMonth || "range"
    }.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "text-green-400";
      case "rejected":
        return "text-red-400";
      default:
        return "text-yellow-400";
    }
  };

  const openEditModal = (entry: AttendanceEntry) => {
    const formatForInput = (isoString: string) => {
      const date = new Date(isoString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    setEditingEntry(entry);
    setEditFormData({
      clockInTime: formatForInput(entry.clockInTime),
      clockOutTime: entry.clockOutTime
        ? formatForInput(entry.clockOutTime)
        : "",
    });
  };

  const closeEditModal = () => {
    setEditingEntry(null);
    setEditFormData({ clockInTime: "", clockOutTime: "" });
  };

  const handleEditSubmit = async () => {
    if (!editingEntry) return;

    setEditLoading(true);
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const body: { clockInTime?: string; clockOutTime?: string } = {};

      if (editFormData.clockInTime) {
        body.clockInTime = new Date(editFormData.clockInTime).toISOString();
      }
      if (editFormData.clockOutTime) {
        body.clockOutTime = new Date(editFormData.clockOutTime).toISOString();
      }

      await api(`/betty/time-tracking/${editingEntry.id}?orgId=${orgId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      toast.success("Time entry updated successfully");
      closeEditModal();
      fetchAttendance(attendanceRange);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update time entry");
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0b0b0d] text-white">
      {/* Fixed Header */}
      <div className="flex-shrink-0 px-3 py-3 sm:p-4 border-b border-[#2a2a35]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-yellow-500/10 to-yellow-600/20 border border-yellow-400/20">
              <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold">Analytics</h2>
              <p className="text-[10px] sm:text-xs text-gray-500">Online/Offline Activity</p>
            </div>
          </div>
          {/* Tabs removed — only Online/Offline tab is active */}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col h-full"
            >
              {/* Scrollable Chat Messages */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.type === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[70%] p-2.5 sm:p-3 rounded-lg ${
                        msg.type === "user"
                          ? "bg-yellow-500/20 text-yellow-100 border border-yellow-400/30"
                          : "bg-[#0e0e12] text-gray-300 border border-[#2a2a35]"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {msg.type === "betty" && (
                          <Bot className="w-3 h-3 mt-0.5 text-yellow-400 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <div className="text-sm leading-relaxed whitespace-pre-wrap">
                            {formatMessage(msg.message)}
                          </div>
                          <div className="text-xs opacity-60 mt-1">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {sendingMessage && (
                  <div className="flex justify-start">
                    <div className="bg-[#0e0e12] text-gray-300 border border-[#2a2a35] p-3 rounded-lg">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></div>
                        <div
                          className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                        <div
                          className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"
                          style={{ animationDelay: "0.4s" }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Fixed Input Area */}
              <div className="flex-shrink-0 p-3 sm:p-4 border-t border-[#2a2a35] bg-[#0b0b0d]">
                {/* Quick action buttons */}
                <div className="flex gap-1.5 sm:gap-2 mb-2.5 sm:mb-3 flex-wrap">
                  <Button
                    onClick={() =>
                      setChatInput("I need time off tomorrow because I'm sick")
                    }
                    variant="outline"
                    size="sm"
                    className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 bg-[#1a1a20] border-[#2a2a35] text-gray-300 hover:bg-[#2a2a35]"
                  >
                    <span className="hidden sm:inline">🤒</span> Sick Leave
                  </Button>
                  <Button
                    onClick={() =>
                      setChatInput(
                        "I want to take vacation from next Monday to Friday"
                      )
                    }
                    variant="outline"
                    size="sm"
                    className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 bg-[#1a1a20] border-[#2a2a35] text-gray-300 hover:bg-[#2a2a35]"
                  >
                    <span className="hidden sm:inline">🏖️</span> Vacation
                  </Button>
                  <Button
                    onClick={() =>
                      setChatInput("Show me my recent time entries")
                    }
                    variant="outline"
                    size="sm"
                    className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 bg-[#1a1a20] border-[#2a2a35] text-gray-300 hover:bg-[#2a2a35]"
                  >
                    <span className="hidden sm:inline">⏰</span> Time
                  </Button>
                  <Button
                    onClick={() => setChatInput("Show me my leave requests")}
                    variant="outline"
                    size="sm"
                    className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 bg-[#1a1a20] border-[#2a2a35] text-gray-300 hover:bg-[#2a2a35]"
                  >
                    <span className="hidden sm:inline">📅</span> Requests
                  </Button>
                </div>

                <div className="flex gap-1.5 sm:gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Ask Betty..."
                    className="flex-1 text-sm sm:text-base bg-[#1a1a20] border-[#2a2a35] text-white placeholder-gray-400"
                    disabled={sendingMessage}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!chatInput.trim() || sendingMessage}
                    size="sm"
                    className="h-9 w-9 sm:h-10 sm:w-10 p-0 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/30 text-yellow-300 hover:text-yellow-200"
                  >
                    <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Time Tracking Tab */}
          {activeTab === "time" && (
            <motion.div
              key="time"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 overflow-y-auto p-3 sm:p-4"
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4"
              >
                <div className="p-2.5 sm:p-3 rounded-lg bg-[#0e0e12] border border-[#2a2a35]">
                  <div className="text-[10px] sm:text-xs text-gray-500">Total recorded</div>
                  <div className="text-base sm:text-lg font-semibold mt-1 text-yellow-300">
                    {formatDuration(totalSeconds)}
                  </div>
                </div>
              </motion.div>

              <div className="p-2.5 sm:p-3 rounded-lg bg-[#0e0e12] border border-[#2a2a35]">
                <div className="text-xs sm:text-sm text-gray-400 mb-2 sm:mb-3">Recent Entries</div>
                {loading ? (
                  <div className="text-gray-500 text-sm">Loading...</div>
                ) : entries.length === 0 ? (
                  <div className="text-gray-500 text-sm">No time entries yet.</div>
                ) : (
                  <div className="space-y-1.5 sm:space-y-2">
                    {entries.map((e) => (
                      <div
                        key={e._id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between px-2.5 sm:px-3 py-2 rounded-md bg-[#111116] border border-[#2a2a35] gap-1 sm:gap-0"
                      >
                        <div className="text-xs sm:text-sm">
                          <div className="text-white">
                            In: {new Date(e.clockInTime).toLocaleString()}
                          </div>
                          <div className="text-gray-400 text-[10px] sm:text-xs">
                            Out:{" "}
                            {e.clockOutTime
                              ? new Date(e.clockOutTime).toLocaleString()
                              : "—"}
                          </div>
                        </div>
                        <div className="text-xs sm:text-sm font-medium">
                          {formatDuration(e.durationInSeconds)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Leave Requests Tab */}
          {activeTab === "leave" && (
            <motion.div
              key="leave"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 overflow-y-auto p-3 sm:p-4"
            >
              <div className="flex justify-between items-center mb-2.5 sm:mb-3">
                <h3 className="text-sm sm:text-base font-semibold">Leave Requests</h3>
                <Button
                  onClick={() => setShowCreateLeave(true)}
                  size="sm"
                  className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/30 text-yellow-300 hover:text-yellow-200"
                >
                  <Plus className="h-3 w-3 mr-1 sm:mr-1.5" />
                  New
                </Button>
              </div>

              {showCreateLeave && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-3 sm:mb-4 p-2.5 sm:p-3 rounded-lg bg-[#0e0e12] border border-[#2a2a35]"
                >
                  <h4 className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3">
                    Create Leave Request
                  </h4>
                  <div className="space-y-2 sm:space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <label className="text-[10px] sm:text-xs text-gray-400">
                          Start Date
                        </label>
                        <Input
                          type="date"
                          value={newLeaveRequest.startDate}
                          onChange={(e) =>
                            setNewLeaveRequest((prev) => ({
                              ...prev,
                              startDate: e.target.value,
                            }))
                          }
                          className="text-sm bg-[#1a1a20] border-[#2a2a35] text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] sm:text-xs text-gray-400">
                          End Date
                        </label>
                        <Input
                          type="date"
                          value={newLeaveRequest.endDate}
                          onChange={(e) =>
                            setNewLeaveRequest((prev) => ({
                              ...prev,
                              endDate: e.target.value,
                            }))
                          }
                          className="text-sm bg-[#1a1a20] border-[#2a2a35] text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] sm:text-xs text-gray-400">Reason</label>
                      <Input
                        value={newLeaveRequest.reason}
                        onChange={(e) =>
                          setNewLeaveRequest((prev) => ({
                            ...prev,
                            reason: e.target.value,
                          }))
                        }
                        placeholder="Enter reason for leave..."
                        className="text-sm bg-[#1a1a20] border-[#2a2a35] text-white placeholder-gray-400"
                      />
                    </div>
                    <div className="flex gap-1.5 sm:gap-2">
                      <Button
                        onClick={createLeaveRequest}
                        size="sm"
                        className="text-[10px] sm:text-xs bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/30 text-yellow-300 hover:text-yellow-200"
                      >
                        Submit
                      </Button>
                      <Button
                        onClick={() => setShowCreateLeave(false)}
                        variant="ghost"
                        size="sm"
                        className="text-[10px] sm:text-xs hover:bg-[#2a2a35] text-gray-400 hover:text-white"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="p-2.5 sm:p-3 rounded-lg bg-[#0e0e12] border border-[#2a2a35]">
                {loading ? (
                  <div className="text-gray-500 text-sm">Loading...</div>
                ) : leaveRequests.length === 0 ? (
                  <div className="text-gray-500 text-sm">No leave requests yet.</div>
                ) : (
                  <div className="space-y-1.5 sm:space-y-2">
                    {leaveRequests.map((req) => (
                      <div
                        key={req._id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between px-2.5 sm:px-3 py-2 rounded-md bg-[#111116] border border-[#2a2a35] gap-1.5 sm:gap-0"
                      >
                        <div className="text-xs sm:text-sm">
                          <div className="text-white">
                            {new Date(req.startDate).toLocaleDateString()} -{" "}
                            {new Date(req.endDate).toLocaleDateString()}
                          </div>
                          <div className="text-gray-400 text-[10px] sm:text-xs">
                            {req.reason}
                          </div>
                          <div className="text-[10px] sm:text-xs text-gray-500">
                            Submitted:{" "}
                            {new Date(req.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div
                          className={`text-xs sm:text-sm font-medium ${getStatusColor(
                            req.status
                          )}`}
                        >
                          {req.status.charAt(0).toUpperCase() +
                            req.status.slice(1)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Attendance Overview Tab */}
          {activeTab === "attendance" && amIFounder && (
            <motion.div
              key="attendance"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 overflow-y-auto p-3 sm:p-4"
            >
              {!attendanceData && attendanceLoading ? (
                <div className="flex h-full items-center justify-center text-gray-400 text-sm">
                  Loading attendance...
                </div>
              ) : !attendanceData ? (
                <div className="flex h-full items-center justify-center text-gray-500 text-xs sm:text-sm px-4 text-center">
                  No attendance data available yet. Ask your team to clock in to
                  start tracking time.
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row">
                  <div className="flex-shrink-0 space-y-3 sm:space-y-4 lg:w-72">
                    <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-3 sm:p-4">
                      <div className="text-[10px] sm:text-xs uppercase tracking-wide text-gray-500">
                        Team Summary
                      </div>
                      <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-gray-400">
                            Stakeholders
                          </span>
                          <span className="text-sm sm:text-base font-semibold text-white">
                            {organizationAttendanceStats.totalEmployees}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-gray-400">
                            Total Hours
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-yellow-300">
                            {formatDurationWithZero(
                              organizationAttendanceStats.totalSeconds
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-gray-400">
                            Active Sessions
                          </span>
                          <span className="text-sm sm:text-base font-semibold text-white">
                            {organizationAttendanceStats.activeSessions}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-gray-400">
                            Working Days
                          </span>
                          <span className="text-sm sm:text-base font-semibold text-white">
                            {organizationAttendanceStats.workingDays}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-3 sm:p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs sm:text-sm font-semibold text-white">
                          Stakeholder List
                        </h3>
                        <span className="text-[10px] sm:text-xs text-gray-500">
                          {filteredEmployees.length} filtered
                        </span>
                      </div>
                      <Input
                        placeholder="Search by name or email"
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                        className="mt-2 sm:mt-3 text-sm bg-[#1a1a20] border-[#2a2a35] text-white placeholder:text-gray-500"
                      />
                      <div className="mt-2 sm:mt-3 space-y-1.5 sm:space-y-2 max-h-[40vh] sm:max-h-[60vh] overflow-y-auto pr-1">
                        {filteredEmployees.length === 0 ? (
                          <div className="rounded-md border border-dashed border-[#2a2a35] px-3 py-6 text-center text-xs text-gray-500">
                            No stakeholders match your search.
                          </div>
                        ) : (
                          filteredEmployees.map((employee) => {
                            const isSelected =
                              employee.userId === selectedEmployeeId;
                            return (
                              <button
                                key={employee.userId}
                                onClick={() =>
                                  setSelectedEmployeeId(employee.userId)
                                }
                                className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                                  isSelected
                                    ? "border-yellow-400/50 bg-yellow-500/10"
                                    : "border-transparent bg-[#111116] hover:border-[#1f1f27]"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="text-sm font-medium text-white">
                                      {employee.name || employee.email || "—"}
                                    </div>
                                    {employee.email && (
                                      <div className="text-xs text-gray-500">
                                        {employee.email}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-xs font-medium text-yellow-300">
                                    {formatDurationWithZero(
                                      employee.totalDurationInSeconds
                                    )}
                                  </div>
                                </div>
                                {employee.activeEntry && (
                                  <div className="mt-2 text-[11px] text-green-400">
                                    Active since{" "}
                                    {new Date(
                                      employee.activeEntry.clockInTime
                                    ).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: true,
                                    })}
                                  </div>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-6">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-wide text-gray-500">
                              Month
                            </span>
                            <Input
                              type="month"
                              value={attendanceMonth}
                              onChange={(e) =>
                                handleMonthChange(e.target.value)
                              }
                              className="bg-[#1a1a20] border-[#2a2a35] text-white text-sm"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-wide text-gray-500">
                              Stakeholder
                            </span>
                            <Select
                              value={selectedEmployeeId}
                              onValueChange={(value) =>
                                setSelectedEmployeeId(value)
                              }
                            >
                              <SelectTrigger className="w-[220px] bg-[#1a1a20] border-[#2a2a35] text-left text-sm text-white">
                                <SelectValue placeholder="Select stakeholder" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#111116] text-white">
                                {attendanceData.employees.map((employee) => (
                                  <SelectItem
                                    key={employee.userId}
                                    value={employee.userId}
                                    className="text-sm text-white data-[state=checked]:bg-yellow-500/20 data-[state=checked]:text-yellow-200"
                                  >
                                    {employee.name || employee.email || "—"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={handleExport}
                            size="sm"
                            variant="outline"
                            disabled={
                              !selectedEmployee ||
                              selectedEmployee.entries.length === 0
                            }
                            className="bg-[#1a1a20] border-[#2a2a35] text-gray-300 hover:bg-[#2a2a35]"
                          >
                            Export CSV
                          </Button>
                          <Button
                            onClick={() => fetchAttendance(attendanceRange)}
                            disabled={attendanceLoading}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2 bg-[#1a1a20] border-[#2a2a35] text-gray-300 hover:bg-[#2a2a35]"
                          >
                            <RefreshCw
                              className={`h-3 w-3 ${
                                attendanceLoading ? "animate-spin" : ""
                              }`}
                            />
                            Refresh
                          </Button>
                        </div>
                      </div>
                      {attendanceError && (
                        <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                          {attendanceError}
                        </div>
                      )}
                      <div className="mt-3 text-xs text-gray-500">
                        Showing entries from{" "}
                        {new Date(
                          attendanceData.range.start
                        ).toLocaleDateString()}{" "}
                        to{" "}
                        {new Date(
                          attendanceData.range.end
                        ).toLocaleDateString()}
                      </div>
                    </div>

                    {attendanceLoading && (
                      <div className="rounded-lg border border-dashed border-[#2a2a35] bg-[#0b0b0d] px-4 py-3 text-sm text-gray-500">
                        Refreshing attendance data...
                      </div>
                    )}

                    {selectedEmployee ? (
                      <>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-4">
                            <div className="text-xs uppercase tracking-wide text-gray-500">
                              Total Hours
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-white">
                              {formatDurationWithZero(
                                selectedEmployee.totalDurationInSeconds
                              )}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              Across {selectedEmployeeDayCount} day
                              {selectedEmployeeDayCount === 1 ? "" : "s"}
                            </div>
                          </div>
                          <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-4">
                            <div className="text-xs uppercase tracking-wide text-gray-500">
                              Average Per Day
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-white">
                              {formatAverageDaily()}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              Calculated on logged days
                            </div>
                          </div>
                          <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-4">
                            <div className="text-xs uppercase tracking-wide text-gray-500">
                              Current Status
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
                              {selectedEmployee.activeEntry ? (
                                <span className="text-green-400">Active</span>
                              ) : (
                                <span className="text-gray-400">Offline</span>
                              )}
                            </div>
                            {selectedEmployee.activeEntry ? (
                              <div className="mt-1 text-xs text-gray-500">
                                Clocked in at{" "}
                                {new Date(
                                  selectedEmployee.activeEntry.clockInTime
                                ).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                })}
                              </div>
                            ) : (
                              <div className="mt-1 text-xs text-gray-500">
                                Last session completed
                              </div>
                            )}
                          </div>
                          <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-4">
                            <div className="text-xs uppercase tracking-wide text-gray-500">
                              Last Activity
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-white">
                              {lastActivityDate
                                ? lastActivityDate.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                  })
                                : "—"}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              {lastActivityDate
                                ? lastActivityDate.toLocaleDateString()
                                : "No entries yet"}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {groupedEntries.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-[#2a2a35] bg-[#0b0b0d] p-6 text-center text-sm text-gray-500">
                              No time entries recorded for this period.
                            </div>
                          ) : (
                            groupedEntries.map((group) => {
                              const dateObj = new Date(
                                `${group.date}T00:00:00`
                              );
                              return (
                                <div
                                  key={group.date}
                                  className="overflow-hidden rounded-lg border border-[#2a2a35] bg-[#0e0e12]"
                                >
                                  <div className="flex items-center justify-between border-b border-[#1f1f27] px-4 py-3">
                                    <div>
                                      <div className="text-sm font-semibold text-white">
                                        {dateObj.toLocaleDateString(undefined, {
                                          weekday: "long",
                                          month: "long",
                                          day: "numeric",
                                        })}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Total{" "}
                                        {formatDurationWithZero(
                                          group.totalDurationInSeconds
                                        )}
                                      </div>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className="border-[#1f1f27] bg-[#111116] text-xs text-gray-300"
                                    >
                                      {group.entries.length}{" "}
                                      {group.entries.length === 1
                                        ? "entry"
                                        : "entries"}
                                    </Badge>
                                  </div>
                                  <div className="px-4 py-2">
                                    <div className="grid grid-cols-[1fr_120px_120px_120px_40px] gap-3 text-[11px] uppercase tracking-wide text-gray-500">
                                      <span>Session</span>
                                      <span className="text-right">
                                        Clock In
                                      </span>
                                      <span className="text-right">
                                        Clock Out
                                      </span>
                                      <span className="text-right">
                                        Duration
                                      </span>
                                      <span></span>
                                    </div>
                                    {group.entries.map((entry, index) => {
                                      const isActive = !entry.clockOutTime;
                                      return (
                                        <div
                                          key={entry.id}
                                          className="grid grid-cols-[1fr_120px_120px_120px_40px] items-center gap-3 border-t border-[#1f1f27] py-3"
                                        >
                                          <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#18181f] text-xs text-gray-400">
                                              {index + 1}
                                            </div>
                                            <div className="flex flex-col">
                                              <span className="text-sm text-white">
                                                Shift {index + 1}
                                              </span>
                                              <span className="text-xs text-gray-500">
                                                {isActive
                                                  ? "In progress"
                                                  : "Completed"}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="text-right text-sm text-white">
                                            {new Date(
                                              entry.clockInTime
                                            ).toLocaleTimeString([], {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                              hour12: true,
                                            })}
                                          </div>
                                          <div className="text-right text-sm text-white">
                                            {entry.clockOutTime
                                              ? new Date(
                                                  entry.clockOutTime
                                                ).toLocaleTimeString([], {
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                                  hour12: true,
                                                })
                                              : "—"}
                                          </div>
                                          <div className="text-right text-sm font-medium text-yellow-300">
                                            {formatDurationWithZero(
                                              entry.durationInSeconds
                                            )}
                                          </div>
                                          <div className="flex justify-end">
                                            <button
                                              onClick={() =>
                                                openEditModal(entry)
                                              }
                                              className="p-1.5 rounded-md text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                                              title="Edit time entry"
                                            >
                                              <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-[#2a2a35] bg-[#0b0b0d] text-sm text-gray-500">
                        Select a stakeholder from the list to see detailed
                        history.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Online Activity Tab */}
          {activeTab === "online-activity" && (
            <OnlineActivityTab />
          )}
        </AnimatePresence>
      </div>

      {/* Edit Time Entry Modal */}
      <AnimatePresence>
        {editingEntry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={closeEditModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-xl border border-[#2a2a35] bg-[#0e0e12] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-white">
                  Edit Time Entry
                </h3>
                <button
                  onClick={closeEditModal}
                  className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-[#1f1f27] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Clock In Time
                  </label>
                  <Input
                    type="datetime-local"
                    value={editFormData.clockInTime}
                    onChange={(e) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        clockInTime: e.target.value,
                      }))
                    }
                    className="bg-[#1a1a20] border-[#2a2a35] text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Clock Out Time
                  </label>
                  <Input
                    type="datetime-local"
                    value={editFormData.clockOutTime}
                    onChange={(e) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        clockOutTime: e.target.value,
                      }))
                    }
                    className="bg-[#1a1a20] border-[#2a2a35] text-white text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty if session is still active
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button
                  onClick={closeEditModal}
                  variant="ghost"
                  size="sm"
                  className="px-4 hover:bg-[#1f1f27] text-gray-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleEditSubmit}
                  disabled={editLoading || !editFormData.clockInTime}
                  size="sm"
                  className="px-4 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/30 text-yellow-300 hover:text-yellow-200 disabled:opacity-50"
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Key Required Modal */}
      <AIProviderRequiredModal
        open={showAPIKeyModal}
        onOpenChange={(open) => {
          setShowAPIKeyModal(open);
          if (!open) {
            // Refetch keys when modal closes in case user configured them
            refetchAIProviders();
          }
        }}
        featureName="Betty AI Assistant"
        isFounder={isAIProviderFounder}
      />
    </div>
  );
}

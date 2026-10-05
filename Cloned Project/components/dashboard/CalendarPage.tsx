"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { getToken, getUserIdFromToken } from "@/lib/auth";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Save,
  Loader2,
  Settings,
  AlertCircle,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CalendarHeader } from "./calendar/CalendarHeader";
import { CalendarGrid } from "./calendar/CalendarGrid";
import { EventDetailsModal } from "./calendar/EventDetailsModal";
import { CreateEventModal } from "./calendar/CreateEventModal";
import { EditEventModal } from "./calendar/EditEventModal";
import { EditMembersModal } from "./calendar/EditMembersModal";
import type { ViewMode, CalendarEvent } from "@/lib/calendarUtils";

type Availability = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  enabled: boolean;
};

type DealFollowUpItem = {
  _id?: string;
  leadId?: string;
  lead?: string;
  title?: string;
  subject?: string;
  entityName?: string;
  companyName?: string;
  contactName?: string;
  dueDate?: string;
  scheduledDate?: string;
  status?: string;
  isCompleted?: boolean;
  description?: string;
};

const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
// Time options from 6:00 AM to 10:00 PM (6:00-22:00) for better UX
const timeOptions = Array.from({ length: 33 }, (_, i) => {
  const hour = Math.floor(i / 2) + 6; // Start from 6:00
  const minute = i % 2 === 0 ? "00" : "30";
  return `${hour.toString().padStart(2, "0")}:${minute}`;
});

export default function CalendarPage() {
  const meId = getUserIdFromToken();
  const [availability, setAvailability] = useState<Availability[]>(
    days.map((_, i) => ({
      dayOfWeek: i,
      startTime: "09:00",
      endTime: "17:00",
      enabled: i >= 1 && i <= 5,
    }))
  );
  const [bookings, setBookings] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialAvailability, setInitialAvailability] = useState<
    Availability[]
  >([]);
  const [activeTab, setActiveTab] = useState<"calendar" | "availability">(
    "calendar"
  );
  const [currentTime, setCurrentTime] = useState(new Date());
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // New state for calendar view
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [editEventOpen, setEditEventOpen] = useState(false);
  const [editMembersOpen, setEditMembersOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<CalendarEvent | null>(null);

  // Update current time every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Auto-save with debounce
  useEffect(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    if (hasChanges && !saving && activeTab === "availability") {
      autoSaveTimeoutRef.current = setTimeout(async () => {
        const orgId = localStorage.getItem("garage_org_id");
        if (!orgId) return;

        setSaving(true);
        try {
          await api(
            `/calendar/availability?orgId=${orgId}`,
            {
              method: "POST",
              body: JSON.stringify(availability),
            },
            getToken()!
          );
          setInitialAvailability(JSON.parse(JSON.stringify(availability)));
          setHasChanges(false);
          toast.success("Availability auto-saved!", { duration: 2000 });
        } catch (error) {
          toast.error("Auto-save failed. Please try saving manually.");
        } finally {
          setSaving(false);
        }
      }, 3000);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [availability, hasChanges, saving, activeTab]);

  const fetchCalendarData = useCallback(async () => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) {
      toast.error("Organization context not found. Please re-login.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [availRes, bookingsRes, eventsRes] = await Promise.all([
        api<{ availabilities: Availability[] }>(
          `/calendar/availability?orgId=${orgId}`,
          {},
          getToken()!
        ),
        api<{ bookings: CalendarEvent[] }>(
          `/calendar/bookings?orgId=${orgId}`,
          {},
          getToken()!
        ),
        api<{ events: any[] }>(
          `/events?orgId=${orgId}`,
          {},
          getToken()!
        ),
      ]);

      let followUpItems: DealFollowUpItem[] = [];
      try {
        const followUpsRes = await authenticatedFetch(
          buildExternalUrl("crm/activities-followups"),
          { method: "GET" }
        );
        if (followUpsRes.ok) {
          const followUpsData = await followUpsRes.json();
          const list =
            followUpsData?.data ||
            followUpsData?.activities ||
            followUpsData?.followups ||
            followUpsData ||
            [];
          followUpItems = Array.isArray(list) ? list : [];
        }
      } catch (error) {
        console.error("[CalendarPage] failed to fetch deal follow-ups:", error);
      }

      const defaultAvailability = days.map((_, i) => ({
        dayOfWeek: i,
        startTime: "09:00",
        endTime: "17:00",
        enabled: i >= 1 && i <= 5,
      }));

      if (availRes.availabilities && availRes.availabilities.length > 0) {
        const newAvail = days.map((_, i) => {
          const existing = availRes.availabilities.find(
            (a) => a.dayOfWeek === i
          );
          return existing || defaultAvailability[i];
        });
        setAvailability(newAvail);
        setInitialAvailability(JSON.parse(JSON.stringify(newAvail)));
      } else {
        setAvailability(defaultAvailability);
        setInitialAvailability(JSON.parse(JSON.stringify(defaultAvailability)));
      }

      // Combine bookings and events into one array
      const allBookings = [...(bookingsRes.bookings || [])];
      const events = eventsRes.events || [];

      // Transform events to match CalendarEvent interface
      const transformedEvents = events.map((event: any) => ({
        _id: event._id,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        bookerId: event.creatorId,
        bookedWithId: event.creatorId, // For events, we'll use creator
        isEvent: true, // Flag to differentiate events from bookings
        invitedUserIds: event.invitedUserIds || [],
        guestInvitations: event.guestInvitations || [],
        status: event.status,
        isRepeating: event.isRepeating || false,
        isLive: event.isLive || false,
        publicJoinCode: event.publicJoinCode
      }));

      const meParticipant = {
        _id: meId || "deals",
        name: "Deals",
        email: "deals@garage.app",
      };

      const transformedFollowUps: CalendarEvent[] = followUpItems
        .filter((item) => {
          if (item.isCompleted) return false;
          const normalizedStatus = String(item.status || "").toLowerCase();
          if (normalizedStatus === "completed" || normalizedStatus === "done") {
            return false;
          }
          return Boolean(item.dueDate || item.scheduledDate);
        })
        .map((item, index) => {
          const rawStart = item.dueDate || item.scheduledDate;
          const startDate = rawStart ? new Date(rawStart) : null;
          if (!startDate || Number.isNaN(startDate.getTime())) return null;

          const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
          const leadIdentifier = item.leadId || item.lead || item._id || "";

          return {
            _id:
              item._id ||
              `deal-followup-${leadIdentifier || index}-${startDate.getTime()}`,
            title:
              item.title ||
              item.subject ||
              item.entityName ||
              item.companyName ||
              "Deal follow-up",
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
            bookerId: meParticipant,
            bookedWithId: meParticipant,
            isDealActivity: true,
            activityType: "follow-up",
            leadId: String(leadIdentifier || ""),
            entityName: item.entityName || item.companyName,
            contactName: item.contactName,
            description: item.description,
            status: item.status,
            isCompleted: item.isCompleted,
          } satisfies CalendarEvent;
        })
        .filter((event): event is CalendarEvent => Boolean(event));

      setBookings([...allBookings, ...transformedEvents, ...transformedFollowUps]);
    } catch (error) {
      // Silent fail
    } finally {
      setLoading(false);
      setHasChanges(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  const handleAvailabilityChange = (
    dayIndex: number,
    field: keyof Availability,
    value: any
  ) => {
    setAvailability((prev) => {
      const newAvail = prev.map((day, i) =>
        i === dayIndex ? { ...day, [field]: value } : day
      );
      const hasChanged =
        JSON.stringify(newAvail) !== JSON.stringify(initialAvailability);
      setHasChanges(hasChanged);
      return newAvail;
    });
  };

  const handleSaveAvailability = async () => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) {
      toast.error("Organization context not found.");
      return;
    }
    setSaving(true);
    try {
      await api(
        `/calendar/availability?orgId=${orgId}`,
        {
          method: "POST",
          body: JSON.stringify(availability),
        },
        getToken()!
      );
      setInitialAvailability(JSON.parse(JSON.stringify(availability)));
      setHasChanges(false);
      toast.success("Availability updated successfully!");
    } catch (error) {
      toast.error("Failed to save availability.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) {
      toast.error("Organization context not found.");
      return;
    }
    try {
      await api(
        `/calendar/bookings/${bookingId}/cancel?orgId=${orgId}`,
        {
          method: "PATCH",
        },
        getToken()!
      );

      setBookings((prev) => prev.filter((b) => b._id !== bookingId));
      toast.success("Meeting cancelled.");
    } catch (error) {
      toast.error("Failed to cancel meeting.");
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleEventCreated = () => {
    fetchCalendarData();
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEventToEdit(event);
    setEditEventOpen(true);
  };

  const handleEditMembers = (event: CalendarEvent) => {
    setEventToEdit(event);
    setEditMembersOpen(true);
  };

  const handleDeleteEvent = async (eventId: string) => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) {
      toast.error("Organization context not found.");
      return;
    }
    try {
      await api(
        `/events/${eventId}?orgId=${orgId}`,
        {
          method: "DELETE",
        },
        getToken()!
      );

      setBookings((prev) => prev.filter((b) => b._id !== eventId));
      toast.success("Event deleted successfully.");
    } catch (error) {
      toast.error("Failed to delete event.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col h-full"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-[#111116]">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#2a2a35] rounded-lg">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                <span className="text-xs sm:text-sm font-medium text-white">
                  Receptionist
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                Schedule & Bookings
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                Manage your calendar, availability, and upcoming meetings
              </p>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-1 bg-[#1a1a20] rounded-lg p-1 w-full sm:w-auto">
              <Button
                onClick={() => setActiveTab("calendar")}
                variant="ghost"
                className={cn(
                  "h-7 sm:h-8 text-xs sm:text-sm transition-all px-2 sm:px-4 flex-1 sm:flex-none",
                  activeTab === "calendar"
                    ? "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30"
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                )}
              >
                Calendar View
              </Button>
              <Button
                onClick={() => setActiveTab("availability")}
                variant="ghost"
                className={cn(
                  "h-7 sm:h-8 text-xs sm:text-sm transition-all px-2 sm:px-4 flex-1 sm:flex-none",
                  activeTab === "availability"
                    ? "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30"
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                )}
              >
                <Settings className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Availability
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === "calendar" ? (
            <motion.div
              key="calendar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <CalendarHeader
                currentDate={currentDate}
                viewMode={viewMode}
                onDateChange={setCurrentDate}
                onViewChange={setViewMode}
                onToday={handleToday}
                onCreateEvent={() => setCreateEventOpen(true)}
              />

              <CalendarGrid
                events={bookings}
                currentDate={currentDate}
                viewMode={viewMode}
                startHour={6}
                endHour={24}
                onEventClick={setSelectedEvent}
                meId={meId || ''}
              />

              <EventDetailsModal
                open={selectedEvent !== null}
                event={selectedEvent}
                meId={meId || ''}
                currentTime={currentTime}
                onClose={() => setSelectedEvent(null)}
                onCancel={handleCancelBooking}
                onEdit={handleEditEvent}
                onDelete={handleDeleteEvent}
                onEditMembers={handleEditMembers}
              />

              <CreateEventModal
                open={createEventOpen}
                onClose={() => setCreateEventOpen(false)}
                onEventCreated={handleEventCreated}
              />

              <EditEventModal
                open={editEventOpen}
                event={eventToEdit}
                onClose={() => {
                  setEditEventOpen(false);
                  setEventToEdit(null);
                }}
                onEventUpdated={handleEventCreated}
              />

              <EditMembersModal
                open={editMembersOpen}
                event={eventToEdit}
                onClose={() => {
                  setEditMembersOpen(false);
                  setEventToEdit(null);
                }}
                onMembersUpdated={handleEventCreated}
              />
            </motion.div>
          ) : (
            <motion.div
              key="availability"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="p-4 sm:p-6 overflow-auto"
            >
              <Card className="border border-[#2a2a35] bg-[#111116]">
                <CardHeader className="pb-3 px-3 sm:px-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-base sm:text-lg text-white">
                        Working Hours
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm text-gray-400 flex flex-wrap items-center gap-2">
                        Set your availability for each day
                        {hasChanges && (
                          <motion.span
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-1 text-orange-400 text-xs font-medium"
                          >
                            <AlertCircle className="h-3 w-3" />
                            Unsaved changes - Auto-saving in 3s...
                          </motion.span>
                        )}
                      </CardDescription>
                    </div>
                    <motion.div
                      animate={{ scale: hasChanges ? [1, 1.05, 1] : 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <Button
                        onClick={handleSaveAvailability}
                        disabled={saving || !hasChanges}
                        size="sm"
                        className={cn(
                          "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30",
                          !hasChanges && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <motion.div
                          animate={{ rotate: saving ? 360 : 0 }}
                          transition={{
                            duration: 1,
                            repeat: saving ? Infinity : 0,
                          }}
                        >
                          {saving ? (
                            <Loader2 className="h-3 w-3 mr-1" />
                          ) : (
                            <Save className="h-3 w-3 mr-1" />
                          )}
                        </motion.div>
                        {saving ? "Saving..." : "Save Now"}
                      </Button>
                    </motion.div>
                  </div>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                    {days.map((day, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2, delay: i * 0.05 }}
                        className={cn(
                          "p-3 rounded-lg border transition-all duration-200",
                          availability[i]?.enabled
                            ? "bg-green-500/10 border-green-500/30"
                            : "bg-[#14141a] border-[#2c2c3a]"
                        )}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  "w-2 h-2 rounded-full",
                                  availability[i]?.enabled
                                    ? "bg-green-400"
                                    : "bg-gray-500"
                                )}
                              />
                              <span
                                className={cn(
                                  "text-sm font-medium",
                                  availability[i]?.enabled
                                    ? "text-white"
                                    : "text-gray-400"
                                )}
                              >
                                {day}
                              </span>
                            </div>
                            <Switch
                              checked={availability[i]?.enabled}
                              onCheckedChange={(checked) =>
                                handleAvailabilityChange(i, "enabled", checked)
                              }
                              className="scale-75"
                            />
                          </div>

                          {availability[i]?.enabled && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-2"
                            >
                              <div className="flex items-center gap-2">
                                <Select
                                  value={availability[i]?.startTime}
                                  onValueChange={(value) =>
                                    handleAvailabilityChange(
                                      i,
                                      "startTime",
                                      value
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs bg-[#1a1a20] border-[#2a2a35]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-[#1a1a20] border-[#2a2a35]">
                                    {timeOptions.map((t) => (
                                      <SelectItem
                                        key={t}
                                        value={t}
                                        className="text-white hover:bg-[#2a2a35]"
                                      >
                                        {t}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <span className="text-gray-400 text-xs">
                                  to
                                </span>
                                <Select
                                  value={availability[i]?.endTime}
                                  onValueChange={(value) =>
                                    handleAvailabilityChange(
                                      i,
                                      "endTime",
                                      value
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs bg-[#1a1a20] border-[#2a2a35]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-[#1a1a20] border-[#2a2a35]">
                                    {timeOptions.map((t) => (
                                      <SelectItem
                                        key={t}
                                        value={t}
                                        className="text-white hover:bg-[#2a2a35]"
                                      >
                                        {t}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

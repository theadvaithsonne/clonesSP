"use client";

import { useState, useEffect, useRef } from "react";
import {
  Calendar,
  Clock,
  Users,
  ExternalLink,
  MapPin,
  Search,
  Filter,
  Grid,
  List,
  X,
  Plus,
  Edit,
  Edit2,
  Eye,
  Trash2,
  Video,
  Check,
  Copy,
  Link2,
  Image,
  Circle,
  DollarSign,
  Globe,
  PlusCircle,
  Play,
  CreditCard,
  UserPlus,
  Upload,
  Loader2,
  Repeat,
  BarChart3,
  Star,
  Sparkles,
  MessageSquare,
  HelpCircle,
  CheckCircle,
  BookOpen,
  Gift,
  ClipboardList,
  User,
  Tag,
  Bold,
  Italic,
  Underline,
  Info,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
} from "lucide-react";

import {
  getWorkshops,
  getOrgChannels,
  registerForFreeWorkshop,
  cancelWorkshopRegistration,
  createWorkshopOrder,
  verifyWorkshopPayment,
  createWorkshop,
  updateWorkshop as updateWorkshopApi,
  softDeleteWorkshop,
  restoreWorkshop,
  trashWorkshopSession,
  generateWorkshopMeeting,
  startWorkshopSession,
  getWorkshopSessions,
  updateWorkshopSession,
  registerForSession,
  createSessionOrder,
  verifySessionPayment,
  registerForFullEnrollment,
  createFullEnrollmentOrder,
  verifyFullEnrollmentPayment,
  getWorkshopRegistrations,
  syncWorkshopAttendance,
  markUserAttended,
  getTeamMembers,
  getWorkshopAnalytics,
  getRecurringWorkshopAnalytics,
  type Workshop,
  type Channel,
  type WorkshopSession,
  type WorkshopSessionOverrideView,
  type SessionAnalytics,
  type WorkshopAgendaItem,
  type WorkshopBonus,
  type WorkshopReview,
  type WorkshopFaq,
  type WorkshopRegistration,
  type TeamMember,
  getCombPlanForItem,
  type FounderStreamRow,
} from "@/lib/feed-api";
import { connectSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, parseDateLocal, formatTime12Hour, stripHtml } from "@/lib/utils";
import { TimeSelector } from "./TimeSelector";
import { toast } from "sonner";
import { ReservesPanel } from "./ReservesPanel";
import { getToken, getUserDataFromToken } from "@/lib/auth";
import { api, API_URL } from "@/lib/api";
import { getPageCache, setPageCache, invalidatePageCache } from "@/lib/revenue-network-cache";
import { format, formatDistanceToNow } from "date-fns";
import {
  formatSellablePrice,
  showSellablePublished,
} from "@/components/shared/SellablePublishedModal";
import {
  CommissionPlanSection,
  saveCommissionPlan,
  CompPlanDisplay,
  CompPlanBadge,
} from "./CommissionPlanSection";
import { WorkshopAnalyticsModal } from "./WorkshopAnalyticsModal";
import { FounderLiveStreamsTable } from "./liveStreams/FounderLiveStreamsTable";
import {
  EditSessionSheet,
  type EditSessionTarget,
} from "./liveStreams/EditSessionSheet";
import {
  SessionScheduleEditor,
  isDraftEmpty,
  type SessionDraft,
  type SessionDraftMap,
} from "./liveStreams/SessionScheduleEditor";
import {
  computeSessionDays,
  describePattern,
  matchesPattern,
} from "@/lib/recurrence";
import { useOrgShareOrigin } from "@/lib/hooks/useOrgShareOrigin";
import { CheckoutPaymentStep } from "@/components/checkout/CheckoutPaymentStep";
import DescriptionEditor from "./DescriptionEditor";
import { ArrowLeft as ArrowLeftIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Apple, Smartphone } from "lucide-react";
import { InstantLiveStreamModal } from "./InstantLiveStreamModal";
import { SpeakerPicker } from "@/components/dashboard/SpeakerPicker";
import { ProductEmailAlertsSection } from "@/components/dashboard/products/ProductEmailAlertsSection";
import { FounderAlertsSection } from "@/components/dashboard/products/FounderAlertsSection";
import { useFounderAlerts } from "@/components/dashboard/products/useFounderAlerts";
import EvergreenSettings from "@/components/webinar/EvergreenSettings";
import SimulatedAudienceSettings from "@/components/webinar/SimulatedAudienceSettings";
import { useEmailAlerts } from "@/components/dashboard/products/useEmailAlerts";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { getBrandHex } from "@/lib/brand-color-context";
import {
  MAX_FAQS,
  MAX_LEARNING_POINTS,
  filterNonEmptyStrings,
  limitReachedLabel,
} from "@/lib/form-limits";

// Get orgId from localStorage
function getOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("garage_org_id");
}

function getTimezoneAbbr(tz?: string): string {
  if (!tz) return "";
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value || tz;
  } catch {
    return tz;
  }
}

/**
 * The per-session edit for a given canonical day (yyyy-mm-dd), or null.
 *
 * `sessionOverrides` only ever carries sessions that actually differ from the
 * series — an untouched series omits the list entirely — so a null here means
 * "this session IS the series" and callers fall straight back to the
 * workshop's own fields.
 *
 * Matched on `sessionDate`, the canonical slot key, never on `displayDate`: a
 * rescheduled session is still identified by the day the rule produced.
 */
function overrideForSessionDay(
  workshop: Workshop,
  sessionYmd: string | undefined,
): WorkshopSessionOverrideView | null {
  if (!sessionYmd || !workshop.sessionOverrides?.length) return null;
  return (
    workshop.sessionOverrides.find(
      (o) => String(o.sessionDate).slice(0, 10) === sessionYmd,
    ) || null
  );
}

/**
 * The days a workshop's series runs on, as local Dates.
 *
 * The walk itself lives in `lib/recurrence.ts` — shared with the schedule
 * preview so the two can't disagree about what a rule produces — and is done
 * in UTC, because a session's identity is the UTC midnight of its day. The
 * results are converted back to local Dates here for the calendar, which
 * renders in the viewer's timezone.
 */
function calculateSessionsClient(w: Workshop, limit: number = 50): Date[] {
  if (!w.isRecurring) {
    try {
      return w.date ? [parseDateLocal(w.date)] : [];
    } catch {
      return [];
    }
  }

  const startStr = w.recurrenceStartDate || w.date;
  if (!startStr) return [];

  try {
    const start = parseDateLocal(startStr);
    const pattern = w.recurrencePattern;
    if (!pattern) return [start];

    return computeSessionDays({
      pattern,
      startDate: String(startStr).slice(0, 10),
      // Honour the bound the founder set — walking past it listed sessions
      // the series will never run.
      endDate: w.recurrenceEndDate
        ? String(w.recurrenceEndDate).slice(0, 10)
        : undefined,
      limit,
    }).map(parseDateLocal);
  } catch (err) {
    console.error("Error calculating sessions client side:", err);
    return [];
  }
}

// Timezones list — comprehensive set grouped by region
const TIMEZONES = [
  // Americas
  { value: "Pacific/Honolulu", label: "(UTC-10:00) Hawaii" },
  { value: "America/Anchorage", label: "(UTC-09:00) Alaska" },
  { value: "America/Los_Angeles", label: "(UTC-08:00) Pacific Time (US)" },
  { value: "America/Denver", label: "(UTC-07:00) Mountain Time (US)" },
  { value: "America/Phoenix", label: "(UTC-07:00) Arizona" },
  { value: "America/Chicago", label: "(UTC-06:00) Central Time (US)" },
  { value: "America/New_York", label: "(UTC-05:00) Eastern Time (US)" },
  { value: "America/Indianapolis", label: "(UTC-05:00) Indiana (East)" },
  { value: "America/Halifax", label: "(UTC-04:00) Atlantic Time (Canada)" },
  { value: "America/Caracas", label: "(UTC-04:00) Caracas" },
  { value: "America/Santiago", label: "(UTC-04:00) Santiago" },
  { value: "America/Sao_Paulo", label: "(UTC-03:00) São Paulo" },
  { value: "America/Argentina/Buenos_Aires", label: "(UTC-03:00) Buenos Aires" },
  { value: "America/St_Johns", label: "(UTC-03:30) Newfoundland" },
  // Europe & Africa
  { value: "Atlantic/Cape_Verde", label: "(UTC-01:00) Cape Verde" },
  { value: "Europe/London", label: "(UTC+00:00) London, Dublin" },
  { value: "Africa/Casablanca", label: "(UTC+00:00) Casablanca" },
  { value: "Africa/Lagos", label: "(UTC+01:00) Lagos, West Africa" },
  { value: "Europe/Berlin", label: "(UTC+01:00) Berlin, Paris, Rome" },
  { value: "Europe/Madrid", label: "(UTC+01:00) Madrid" },
  { value: "Europe/Amsterdam", label: "(UTC+01:00) Amsterdam, Brussels" },
  { value: "Europe/Warsaw", label: "(UTC+01:00) Warsaw" },
  { value: "Europe/Athens", label: "(UTC+02:00) Athens, Bucharest" },
  { value: "Europe/Helsinki", label: "(UTC+02:00) Helsinki" },
  { value: "Europe/Istanbul", label: "(UTC+03:00) Istanbul" },
  { value: "Africa/Cairo", label: "(UTC+02:00) Cairo" },
  { value: "Africa/Johannesburg", label: "(UTC+02:00) Johannesburg" },
  { value: "Africa/Nairobi", label: "(UTC+03:00) Nairobi, East Africa" },
  // Middle East
  { value: "Asia/Jerusalem", label: "(UTC+02:00) Jerusalem" },
  { value: "Asia/Riyadh", label: "(UTC+03:00) Riyadh, Kuwait" },
  { value: "Europe/Moscow", label: "(UTC+03:00) Moscow" },
  { value: "Asia/Tehran", label: "(UTC+03:30) Tehran" },
  { value: "Asia/Dubai", label: "(UTC+04:00) Dubai, Abu Dhabi" },
  { value: "Asia/Baku", label: "(UTC+04:00) Baku" },
  { value: "Asia/Kabul", label: "(UTC+04:30) Kabul" },
  // South & Central Asia
  { value: "Asia/Karachi", label: "(UTC+05:00) Karachi, Islamabad" },
  { value: "Asia/Tashkent", label: "(UTC+05:00) Tashkent" },
  { value: "Asia/Kolkata", label: "(UTC+05:30) India Standard Time" },
  { value: "Asia/Colombo", label: "(UTC+05:30) Sri Lanka" },
  { value: "Asia/Kathmandu", label: "(UTC+05:45) Kathmandu" },
  { value: "Asia/Dhaka", label: "(UTC+06:00) Dhaka" },
  { value: "Asia/Almaty", label: "(UTC+06:00) Almaty" },
  { value: "Asia/Yangon", label: "(UTC+06:30) Yangon" },
  // East & Southeast Asia
  { value: "Asia/Bangkok", label: "(UTC+07:00) Bangkok, Jakarta" },
  { value: "Asia/Ho_Chi_Minh", label: "(UTC+07:00) Ho Chi Minh City" },
  { value: "Asia/Shanghai", label: "(UTC+08:00) Beijing, Shanghai" },
  { value: "Asia/Hong_Kong", label: "(UTC+08:00) Hong Kong" },
  { value: "Asia/Singapore", label: "(UTC+08:00) Singapore" },
  { value: "Asia/Taipei", label: "(UTC+08:00) Taipei" },
  { value: "Asia/Kuala_Lumpur", label: "(UTC+08:00) Kuala Lumpur" },
  { value: "Australia/Perth", label: "(UTC+08:00) Perth" },
  { value: "Asia/Seoul", label: "(UTC+09:00) Seoul" },
  { value: "Asia/Tokyo", label: "(UTC+09:00) Tokyo, Osaka" },
  // Oceania
  { value: "Australia/Adelaide", label: "(UTC+09:30) Adelaide" },
  { value: "Australia/Darwin", label: "(UTC+09:30) Darwin" },
  { value: "Australia/Brisbane", label: "(UTC+10:00) Brisbane" },
  { value: "Australia/Sydney", label: "(UTC+10:00) Sydney, Melbourne" },
  { value: "Pacific/Guam", label: "(UTC+10:00) Guam" },
  { value: "Pacific/Noumea", label: "(UTC+11:00) New Caledonia" },
  { value: "Pacific/Auckland", label: "(UTC+12:00) Auckland, Wellington" },
  { value: "Pacific/Fiji", label: "(UTC+12:00) Fiji" },
  { value: "Pacific/Tongatapu", label: "(UTC+13:00) Tonga" },
  { value: "Pacific/Apia", label: "(UTC+13:00) Samoa" },
];

const MOCK_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&h=100&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&h=100&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&h=100&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=100&h=100&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=100&h=100&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&h=100&q=80"
];

/* ── What the card's primary button does ─────────────────────────────────
 *
 * THE BUG THIS EXISTS TO FIX: `isRegistered` is series-wide. In `per_session`
 * mode it flips true the moment a buyer purchases ONE session, and the card
 * then read that as "you're in" and offered Join Workshop — so a buyer who had
 * bought Tuesday could no longer reach the picker to buy Thursday. Holding one
 * session of a series you buy a session at a time never means you're done.
 *
 * Resolved in one place because the button's LABEL and its ACTION were derived
 * separately, from different expressions. A card that says Join and opens a
 * picker (or vice versa) is worse than either.
 */
type WorkshopCta =
  | "start"
  | "join"
  | "pick-session"
  | "enroll-series-free"
  | "enroll-series-paid"
  | "pay"
  | "enroll-free";

/** Does the buyer hold the session falling on `iso`'s UTC day? */
function holdsSession(workshop: Workshop, iso?: string | null): boolean {
  if (!iso) return false;
  const day = new Date(iso).toISOString().slice(0, 10);
  return (workshop.enrolledSessions || []).some(
    (s) => new Date(s).toISOString().slice(0, 10) === day,
  );
}

function resolveWorkshopCta(workshop: Workshop, isFounder: boolean): WorkshopCta {
  if (isFounder) return "start";

  if (workshop.isRecurring && workshop.enrollmentType === "per_session") {
    // Grandfathered buyers hold every session but have no per-session rows,
    // so there is nothing left for them to pick — they just join.
    const holdsEverything =
      (workshop.isRegistered || workshop.hasPaid) &&
      !(workshop.enrolledSessions || []).length;
    if (holdsEverything) return "join";
    // Join only for the session actually in flight, and only if they bought
    // that one. Any other state means "choose which session".
    if (holdsSession(workshop, workshop.currentSessionDate)) return "join";
    return "pick-session";
  }

  if (workshop.isRecurring && !workshop.isRegistered && !workshop.hasPaid) {
    return workshop.isFree ? "enroll-series-free" : "enroll-series-paid";
  }
  if (!workshop.isFree && !workshop.hasPaid && !workshop.isRegistered) return "pay";
  if (workshop.isFree && !workshop.isRegistered) return "enroll-free";
  return "join";
}

/** The button's words. Each names exactly what pressing it does. */
function workshopCtaLabel(cta: WorkshopCta): string {
  switch (cta) {
    case "start":
      return "Start Live Stream";
    case "join":
      return "Join Workshop";
    case "pick-session":
      return "Select Session";
    default:
      return "Register Now";
  }
}

/* ── Session picker formatting ───────────────────────────────────────────
 *
 * The picker lists occurrences of ONE stream, so the thing that separates one
 * row from the next is the date. These render it as a calendar leaf — weekday,
 * day number, month — which is scannable down a column in a way a repeated
 * "Tuesday, September 1, 2026" is not, and leaves the rest of the row free to
 * carry what the session actually is.
 *
 * All of them take the stream's timezone, because a session at 7pm IST must
 * read as 7pm to everyone choosing it, not as whatever their laptop says.
 */
function sessionDateLeaf(iso: string, timezone?: string) {
  const d = new Date(iso);
  const tz = timezone ? { timeZone: timezone } : {};
  return {
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "short", ...tz }).format(d),
    day: new Intl.DateTimeFormat("en-US", { day: "numeric", ...tz }).format(d),
    month: new Intl.DateTimeFormat("en-US", { month: "short", ...tz }).format(d),
  };
}

function sessionClock(iso: string, timezone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(new Date(iso));
}

/** "7:00 – 8:00 PM". The meridiem is dropped from the start when both sides
 *  share it, which is the common case and halves the width of the line. */
function sessionRange(startIso: string, endIso: string, timezone?: string): string {
  const start = sessionClock(startIso, timezone);
  const end = sessionClock(endIso, timezone);
  const startMeridiem = start.slice(-2);
  return startMeridiem === end.slice(-2)
    ? `${start.slice(0, -3)} – ${end}`
    : `${start} – ${end}`;
}

function sessionDuration(startIso: string, endIso: string): string {
  const mins = Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000,
  );
  if (!Number.isFinite(mins) || mins <= 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} hr`;
  return `${h} hr ${m} min`;
}

function sessionPriceLabel(
  isFree: boolean | undefined,
  price: number | undefined,
  currency: string | undefined,
): string {
  if (isFree || !price) return "Free";
  return `${currency === "INR" ? "₹" : "$"}${price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Countdown timer component for upcoming workshops
// Convert a local time in a given IANA timezone to a UTC timestamp
function localTimeToUtc(dateStr: string, time: string, timezone: string): number {
  const datePart = dateStr.split("T")[0];
  const [hours, minutes] = time.split(":").map(Number);
  const [year, month, day] = datePart.split("-").map(Number);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const tempDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  const parts = formatter.formatToParts(tempDate);
  const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || "0", 10);
  const tzHour = getPart("hour");
  const tzMinute = getPart("minute");
  const tzYear = getPart("year");
  const tzMonth = getPart("month");
  const tzDay = getPart("day");

  const utcMinutes = hours * 60 + minutes;
  const shownMinutes = tzHour * 60 + tzMinute;
  let offsetMinutes = shownMinutes - utcMinutes;

  // Compare full dates to handle month/year boundaries correctly.
  // Previously only compared day-of-month, which broke at month boundaries
  // (e.g., March 31 20:00 UTC → April 1 01:30 IST: tzDay=1 < day=31 gave wrong offset)
  const utcDays = Date.UTC(year, month - 1, day) / (24 * 60 * 60 * 1000);
  const tzDays = Date.UTC(tzYear, tzMonth - 1, tzDay) / (24 * 60 * 60 * 1000);
  const dayDiff = tzDays - utcDays;
  if (dayDiff !== 0) offsetMinutes += dayDiff * 24 * 60;

  return Date.UTC(year, month - 1, day, hours, minutes, 0) - offsetMinutes * 60 * 1000;
}


// Countdown timer overlay component for thumbnails matching mockup
function ThumbnailCountdown({ dateStr, startTime, endTime, timezone }: { dateStr: string; startTime: string; endTime: string; timezone: string }) {
  const [state, setState] = useState<{
    label: "Starts in" | "Ends in";
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    let startUtc: number;
    let endUtc: number;
    try {
      startUtc = localTimeToUtc(dateStr, startTime, timezone);
      endUtc = localTimeToUtc(dateStr, endTime, timezone);
      if (endUtc <= startUtc) endUtc += 24 * 60 * 60 * 1000;
    } catch {
      return;
    }

    const update = () => {
      const now = Date.now();
      let diff: number;
      let label: "Starts in" | "Ends in";

      if (now < startUtc) {
        diff = startUtc - now;
        label = "Starts in";
      } else if (now < endUtc) {
        diff = endUtc - now;
        label = "Ends in";
      } else {
        setState(null);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setState({ label, days, hours, minutes, seconds });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [dateStr, startTime, endTime, timezone]);

  if (!state) return null;

  const pad = (n: number) => n.toString().padStart(2, "0");
  const isLive = state.label === "Ends in";

  return (
    <div className={cn(
      "absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-black/60 backdrop-blur-md text-[11px] font-medium text-white z-10"
    )}>
      {isLive ? (
        <>
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
          <span className="text-green-400 font-semibold">
            LIVE &middot; Ends in {state.days > 0 && `${state.days}d `}{pad(state.hours)}h {pad(state.minutes)}m
          </span>
        </>
      ) : (
        <>
          <Clock className="h-3.5 w-3.5 text-white/90" />
          <span>
            Starts in {state.days > 0 && `${state.days}d `}{pad(state.hours)}h {pad(state.minutes)}m {pad(state.seconds)}s
          </span>
        </>
      )}
    </div>
  );
}

// Helper function to get the next hour (1 hour later) from a given time
const getNextHour = (time: string): string => {
  const [hourStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const nextHour = (hour + 1) % 24;
  return nextHour.toString().padStart(2, "0") + ":00";
};

// Helper function to check if a time is in the past for today
const isTimePast = (time: string, selectedDate: string): boolean => {
  const today = format(new Date(), "yyyy-MM-dd");
  if (selectedDate !== today) return false;

  const [hourStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const currentHour = new Date().getHours();

  return hour <= currentHour;
};

// Helper function to get default start time (next available hour if today)
const getDefaultStartTime = (): string => {
  const currentHour = new Date().getHours();
  const nextHour = Math.min(currentHour + 1, 23);
  return nextHour.toString().padStart(2, "0") + ":00";
};



interface WorkshopsPageProps {
  initialTab?: "upcoming" | "completed" | "reserves" | "attendees" | "discover" | "enrolled";
  viewRole?: "customer" | "founder";
}

export function WorkshopsPage({ initialTab = "upcoming", viewRole }: WorkshopsPageProps = {}) {
  /**
   * Links a founder copies must carry the OFFICE's domain, not the host they
   * happen to be on — otherwise a white-label founder working inside
   * my.garage.app hands out my.garage.app links to their own audience.
   * Falls back to the current origin for offices without a verified domain.
   */
  const shareOrigin = useOrgShareOrigin();
  // Only needed for the instant stream's default title ("<Org>'s Live Stream").
  const { userData } = useAmIFounder();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFounder, setIsFounder] = useState(false);
  const isFounderMode = viewRole === "founder";
  const [affiliateId, setAffiliateId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"upcoming" | "completed" | "attendees" | "discover" | "enrolled">(
    initialTab === "attendees" ? "attendees" : (initialTab === "reserves" ? "upcoming" : (initialTab || "upcoming"))
  );
  const [pageView, setPageView] = useState<"main" | "reserves">("main");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [unsubscribingId, setUnsubscribingId] = useState<string | null>(null);
  // Mode-aware unsub target — carries sessionDate for per_session
  // workshops so the DELETE call scopes cancel to one session. Null when
  // no confirm dialog is open.
  const [unsubscribeTarget, setUnsubscribeTarget] = useState<
    { workshopId: string; sessionDate?: string } | null
  >(null);

  // Founder filters & selection state
  const [selectedWorkshopIds, setSelectedWorkshopIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [submittingBulkDelete, setSubmittingBulkDelete] = useState(false);
  // Listen to open-create-modal custom event from layout
  useEffect(() => {
    const handleOpenCreate = () => {
      setShowCreateModal(true);
      setEditingWorkshop(null);
    };
    window.addEventListener("workshops:open-create-modal", handleOpenCreate);
    return () => {
      window.removeEventListener("workshops:open-create-modal", handleOpenCreate);
    };
  }, []);

  // Same dock button, "Instant" branch of the drop-up.
  useEffect(() => {
    const handleOpenInstant = () => setShowInstantModal(true);
    window.addEventListener("workshops:open-instant-modal", handleOpenInstant);
    return () => {
      window.removeEventListener("workshops:open-instant-modal", handleOpenInstant);
    };
  }, []);


  useEffect(() => {
    if (initialTab === "reserves") {
      setPageView("reserves");
    } else {
      setPageView("main");
      if (initialTab === "attendees") {
        setActiveTab("attendees");
      } else {
        setActiveTab(initialTab || "upcoming");
      }
    }
  }, [initialTab]);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [selectedChannelFilter, setSelectedChannelFilter] = useState<
    string | null
  >(null);
  const [enrollingWorkshopId, setEnrollingWorkshopId] = useState<string | null>(
    null
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  // "Go live now" — the short form, separate from the full scheduling one.
  const [showInstantModal, setShowInstantModal] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null);
  const [workshopToDelete, setWorkshopToDelete] = useState<Workshop | null>(null);
  const [sessionPickerWorkshop, setSessionPickerWorkshop] = useState<Workshop | null>(null);
  // "customer" = enroll picker (default). "host" = founder picks which
  // session to start streaming — reuses the same modal shape.
  const [sessionPickerMode, setSessionPickerMode] = useState<"customer" | "host">("customer");
  const [sessions, setSessions] = useState<WorkshopSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [enrollingSessionDate, setEnrollingSessionDate] = useState<string | null>(null);
  const [startingSessionDate, setStartingSessionDate] = useState<string | null>(null);
  const [analyticsWorkshop, setAnalyticsWorkshop] = useState<Workshop | null>(null);
  // Bumped after any founder-side mutation so the Live Streams grid refetches.
  // The grid owns its own dataset (a dedicated endpoint, not `workshops`), so
  // it can't piggyback on fetchData's state the way the card list did.
  const [founderTableRefresh, setFounderTableRefresh] = useState(0);
  // Which session of a recurring series is open in the per-session editor.
  // Identified by (workshopId, canonical sessionDate) because sessions are
  // computed from the recurrence rule and have no id of their own.
  const [editingSession, setEditingSession] =
    useState<EditSessionTarget | null>(null);
  // A Live Streams side panel (Options / Switch View) is open, so the floating
  // bottom nav has to get out from under it.
  const [liveStreamPanelOpen, setLiveStreamPanelOpen] = useState(false);

  // Calendar and real-time state for Enrolled tab
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      try {
        const timeStr = new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "Asia/Kolkata"
        }).format(new Date());
        const formatted = timeStr.replace(" AM", "am").replace(" PM", "pm") + " IST";
        setCurrentTime(formatted);
      } catch (e) {
        setCurrentTime("");
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const toLocalYMD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  /**
   * The per-session edit covering a given calendar day, or null.
   *
   * Sessions of a recurring series are computed from the recurrence rule, so a
   * day only has its own title/time/description when the founder edited that
   * session. `sessionOverrides` carries only those, and is absent entirely for
   * every series nobody has edited — which is why callers can fall straight
   * back to the workshop's own fields.
   *
   * Matched with `toLocalYMD`, the same convention the calendar's dots use, so
   * the card that opens is the one the dot promised.
   */
  const sessionEditFor = (workshop: Workshop, date: Date) => {
    if (!workshop.sessionOverrides?.length) return null;
    const cell = toLocalYMD(date);
    return (
      workshop.sessionOverrides.find(
        (s) => toLocalYMD(new Date(s.sessionDate)) === cell,
      ) ||
      // A moved session keeps its slot identity but RUNS on another day, so it
      // has to surface on the day the attendee will actually attend as well.
      workshop.sessionOverrides.find(
        (s) => s.isRescheduled && toLocalYMD(new Date(s.displayDate)) === cell,
      ) ||
      null
    );
  };

  const getWorkshopYMD = (workshop: Workshop) => {
    const dateStr = workshop.isRecurring && workshop.nextSession ? workshop.nextSession.dateString : workshop.date;
    if (!dateStr) return "";
    try {
      const parsed = new Date(dateStr);
      return toLocalYMD(parsed);
    } catch {
      return "";
    }
  };

  const isWorkshopCompleted = (workshop: Workshop) => {
    const dateStr = workshop.isRecurring && workshop.nextSession ? workshop.nextSession.dateString : workshop.date;
    try {
      const endUtc = localTimeToUtc(dateStr, workshop.endTime, workshop.timezone);
      return Date.now() > endUtc;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const shouldHideBottomTab =
      selectedWorkshopIds.length > 0 ||
      showCreateModal ||
      showInstantModal ||
      !!editingWorkshop ||
      !!analyticsWorkshop ||
      !!editingSession ||
      liveStreamPanelOpen;

    if (shouldHideBottomTab) {
      window.dispatchEvent(new CustomEvent("bottom-tab:hide"));
    } else {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    }
    return () => {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    };
  }, [selectedWorkshopIds.length, showCreateModal, showInstantModal, editingWorkshop, analyticsWorkshop, editingSession, liveStreamPanelOpen]);

  // Inline checkout state. `showPaymentSelector` toggles the right-side
  // slide-in drawer that hosts <CheckoutPaymentStep> inline (coupon /
  // wallet / GST / cashback / Razorpay / Stripe / crypto all inside).
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [pendingPaymentInfo, setPendingPaymentInfo] = useState<{
    workshop: Workshop;
    enrollmentType: "workshop" | "session" | "full";
    sessionDate?: string;
  } | null>(null);
  const [initiatingPayment, setInitiatingPayment] = useState(false);
  // Buy-to-assign — founder buys N registrations as reserves that can be
  // assigned to specific attendees later via ReservesPanel. Only meaningful
  // for the plain `"workshop"` enrollment type (session/full are already
  // date-scoped or all-sessions; reserves don't map cleanly there). BE
  // fulfillment at services/invoice.ts:2282 mints ItemReserveLicense rows
  // when quantity > 1.
  const [buyToAssign, setBuyToAssign] = useState(false);
  const [reserveQty, setReserveQty] = useState(1);

  useEffect(() => {
    const id = getOrgId();
    setOrgId(id);
  }, []);



  const fetchData = async (invalidate = false) => {
    if (!orgId) return;

    const cacheKey = `workshops:${orgId}:${activeTab}`;
    if (invalidate) {
      invalidatePageCache("workshops:");
      // The founder grid reads its own endpoint, so clearing this page cache
      // doesn't reach it — bump its key from the same place instead of
      // teaching all ~18 fetchData(true) call sites about a second dataset.
      setFounderTableRefresh((n) => n + 1);
    }
    const cached = invalidate ? null : getPageCache<{ workshops: typeof workshops; isFounder: boolean; channels: typeof channels }>(cacheKey);
    if (cached) {
      setWorkshops(cached.workshops);
      setIsFounder(cached.isFounder);
      setChannels(cached.channels);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const [workshopsData, channelsData] = await Promise.all([
        getWorkshops(orgId, {
          upcoming: isFounderMode
            ? undefined
            : activeTab === "attendees" || activeTab === "enrolled"
              ? undefined
              : activeTab === "upcoming" || activeTab === "discover",
          // Enrolled narrows on the server now. It used to fetch a page of
          // every accessible workshop and filter to `isRegistered` here, which
          // meant the row limit bounded the pool rather than the answer.
          ...(activeTab === "enrolled"
            ? {
                enrolledOnly: true,
                // The tab renders a calendar across the whole enrolment
                // history, not one page of it, so it asks for the lot.
                limit: 500,
              }
            : {}),
        }),
        getOrgChannels(orgId),
      ]);

      setWorkshops(workshopsData.workshops);
      setIsFounder(workshopsData.isFounder);
      setChannels(channelsData.channels);
      setPageCache(cacheKey, { workshops: workshopsData.workshops, isFounder: workshopsData.isFounder, channels: channelsData.channels });
    } catch (error) {
      console.error("Error fetching data:", error);
      if (!cached || invalidate) toast.error("Failed to load workshops");
    } finally {
      setLoading(false);
    }
  };

  const handleStartStream = async (workshopId: string) => {
    const selectedWorkshop = workshops.find((w) => w._id === workshopId);
    // Recurring workshops → open the founder session picker so the
    // founder picks WHICH session they're going live for. The picker
    // hits startWorkshopSession, which rotates the Meet + the join
    // gate's currentSessionDate before opening the webinar tab — so a
    // missing meetingUrl is fine here, the picker path creates it.
    if (selectedWorkshop?.isRecurring) {
      handleOpenHostSessionPicker(selectedWorkshop);
      setSelectedWorkshopIds([]);
      return;
    }
    // One-time stream with no Meet yet — happens when a draft was later
    // published via the edit form, which never generated one. Generate
    // it now (same call the create-and-publish path makes) instead of
    // refusing with a "draft" error the founder can't act on.
    if (selectedWorkshop && !selectedWorkshop.meetingUrl) {
      try {
        await generateWorkshopMeeting(workshopId, orgId);
        fetchData(true);
      } catch (err) {
        console.error("Generate meeting error:", err);
        // Surface the server's reason verbatim — the common one is a 409
        // "<name> is already hosting this session", which tells the founder
        // exactly why nothing happened. A generic string hid that.
        toast.error(
          err instanceof Error ? err.message : "Failed to generate meeting link"
        );
        return;
      }
    }
    toast.success("Opening live stream panel...");
    window.open(`/webinar/${workshopId}?role=host`, "_blank");
    setSelectedWorkshopIds([]); // Clear selection
  };

  // Listen for real-time live preview updates
  useEffect(() => {
    if (!orgId) return;
    const socket = connectSocket();

    const handlePreviewUpdate = () => {
      fetchData(true); // Refetch workshops list to get updated statuses
    };

    socket.on("workshop:preview:live", handlePreviewUpdate);
    socket.on("workshop:preview:ended", handlePreviewUpdate);

    return () => {
      socket.off("workshop:preview:live", handlePreviewUpdate);
      socket.off("workshop:preview:ended", handlePreviewUpdate);
    };
  }, [orgId]);

  useEffect(() => {
    if (orgId) {
      fetchData();
    }
  }, [orgId, activeTab]);

  // Fetch affiliate ID for checkout links
  useEffect(() => {
    const fetchAffiliateId = async () => {
      try {
        const response = await api<{
          success: boolean;
          affiliateId: string | null;
          hasAffiliateId: boolean;
        }>("/affiliate/my-affiliate-id", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });

        if (response.success && response.affiliateId) {
          setAffiliateId(response.affiliateId);
        }
      } catch (error) {
        console.error("Error fetching affiliate ID:", error);
      }
    };

    fetchAffiliateId();
  }, []);

  // Fetch organization members to display real profile pictures
  useEffect(() => {
    const fetchMembers = async () => {
      if (!orgId) return;
      try {
        const teamMembers = await getTeamMembers(orgId);
        if (teamMembers) {
          setMembers(teamMembers);
        }
      } catch (error) {
        console.error("Error fetching organization members:", error);
      }
    };
    fetchMembers();
  }, [orgId]);

  // Attendees state
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>("all");
  const [attendees, setAttendees] = useState<WorkshopRegistration[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [attendeeSearchQuery, setAttendeeSearchQuery] = useState("");

  // Sync selectedWorkshopId with workshops list when tab changes to attendees
  useEffect(() => {
    if (activeTab === "attendees" && workshops.length > 0 && selectedWorkshopId === "all") {
      setSelectedWorkshopId(workshops[0]._id);
    }
  }, [activeTab, workshops, selectedWorkshopId]);

  // Fetch attendees
  useEffect(() => {
    if (activeTab !== "attendees" || !orgId || !selectedWorkshopId || selectedWorkshopId === "all") {
      setAttendees([]);
      return;
    }

    const fetchAttendees = async () => {
      setLoadingAttendees(true);
      try {
        const res = await getWorkshopRegistrations(selectedWorkshopId, orgId);
        setAttendees(res.registrations || []);
      } catch (err) {
        console.error("Error fetching workshop attendees:", err);
        toast.error("Failed to load attendees");
      } finally {
        setLoadingAttendees(false);
      }
    };

    fetchAttendees();
  }, [activeTab, selectedWorkshopId, orgId]);

  // Listen to register-request from RightPanel info view
  useEffect(() => {
    const handleRegisterRequest = (e: Event) => {
      const customEvent = e as CustomEvent<{ workshopId: string }>;
      const workshopId = customEvent.detail?.workshopId;
      if (!workshopId) return;
      
      const workshop = workshops.find(w => w._id === workshopId);
      if (!workshop) return;
      
      if (isFounderMode) {
        window.open(`/webinar/${workshop._id}?role=host`, "_blank");
        return;
      }
      // Same resolver the card button uses — this handler used to carry its
      // own copy of the branch, which is how the two came to disagree.
      switch (resolveWorkshopCta(workshop, false)) {
        case "pick-session":
          handleOpenSessionPicker(workshop);
          return;
        case "enroll-series-free":
          handleFullEnrollmentFree(workshop);
          return;
        case "enroll-series-paid":
          handleFullEnrollmentPaid(workshop);
          return;
        case "pay":
          handlePaidEnrollment(workshop);
          return;
        case "enroll-free":
          handleFreeEnrollment(workshop);
          return;
        default:
          window.open(`/webinar/${workshop._id}`, "_blank");
      }
    };

    window.addEventListener("workshop:register-request", handleRegisterRequest);
    return () => {
      window.removeEventListener("workshop:register-request", handleRegisterRequest);
    };
  }, [workshops, isFounderMode]);

  // Lock body scroll when payment selector is open
  useEffect(() => {
    if (!showPaymentSelector) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showPaymentSelector]);

  const handleSyncAttendance = async () => {
    if (!orgId || !selectedWorkshopId) return;
    try {
      const res = await syncWorkshopAttendance(selectedWorkshopId, orgId);
      if (res.success) {
        toast.success(res.message || "Attendance synced successfully");
        const updated = await getWorkshopRegistrations(selectedWorkshopId, orgId);
        setAttendees(updated.registrations || []);
      } else {
        toast.error(res.message || "Failed to sync attendance");
      }
    } catch (err) {
      console.error("Error syncing attendance:", err);
      toast.error("Failed to sync attendance");
    }
  };

  const handleMarkAttended = async (userId: string) => {
    if (!orgId || !selectedWorkshopId) return;
    try {
      const res = await markUserAttended(selectedWorkshopId, userId, orgId);
      if (res.success) {
        toast.success(res.message || "Marked as attended");
        const updated = await getWorkshopRegistrations(selectedWorkshopId, orgId);
        setAttendees(updated.registrations || []);
      } else {
        toast.error(res.message || "Failed to mark as attended");
      }
    } catch (err) {
      console.error("Error marking attendance:", err);
      toast.error("Failed to mark attendance");
    }
  };

  const handleFreeEnrollment = async (workshop: Workshop) => {
    if (!orgId) return;

    setEnrollingWorkshopId(workshop._id);
    try {
      const result = await registerForFreeWorkshop(workshop._id, orgId);
      if (result.success || result.alreadyRegistered) {
        toast.success(
          result.alreadyRegistered
            ? "Already enrolled!"
            : "Successfully enrolled!"
        );
        fetchData(true);
      }
    } catch (err) {
      console.error("Enrollment error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to enroll");
    } finally {
      setEnrollingWorkshopId(null);
    }
  };

  // Helper: load Razorpay SDK script
  const loadRazorpayScript = async (): Promise<boolean> => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return true;
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
    return new Promise((resolve) => {
      let attempts = 0;
      const check = () => {
        if ((window as unknown as { Razorpay?: unknown }).Razorpay) resolve(true);
        else if (attempts >= 50) resolve(false);
        else { attempts++; setTimeout(check, 100); }
      };
      check();
    });
  };

  // Helper: open Razorpay checkout with given options and verify callback
  const openRazorpayCheckout = async (opts: {
    key: string;
    amount: number;
    currency: string;
    orderId: string;
    name: string;
    description: string;
    subscriptionId?: string;
    onVerify: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => Promise<void>;
    onDismiss?: () => void;
  }) => {
    const loaded = await loadRazorpayScript();
    if (!loaded || !(window as unknown as { Razorpay?: unknown }).Razorpay) throw new Error("Payment gateway not available");

    const { getRazorpayContactForCurrentUser } = await import("@/lib/razorpayPrefill");
    const rzpOptions: Record<string, unknown> = {
      key: opts.key,
      amount: opts.amount,
      currency: opts.currency,
      order_id: opts.orderId,
      name: opts.name,
      description: opts.description,
      handler: opts.onVerify,
      modal: { ondismiss: opts.onDismiss || (() => {}) },
      theme: { color: getBrandHex() },
      // Prefill mobile so Razorpay skips its "Enter mobile" step.
      prefill: { contact: await getRazorpayContactForCurrentUser() },
    };
    if (opts.subscriptionId) rzpOptions.subscription_id = opts.subscriptionId;

    const razorpay = new (window as unknown as { Razorpay: new (options: Record<string, unknown>) => { open: () => void } }).Razorpay(rzpOptions);
    razorpay.open();
  };

  // Direct callback for the inline <CheckoutPaymentStep> in the drawer
  // below. Replaces the old cross-frame postMessage listener now that
  // payment renders inline instead of inside an iframe. Semantics preserved:
  //   onSuccess → close drawer + refresh data (same as verify* handlers'
  //   fetchData(true) convention).
  //   onCancel  → close drawer without refresh (matches old invoice:closed).
  const handleInvoicePaidInline = () => {
    setShowPaymentSelector(false);
    setInvoiceId(null);
    setPendingPaymentInfo(null);
    toast.success("Successfully registered!");
    fetchData(true);
  };

  const handleInvoiceCancelledInline = () => {
    setShowPaymentSelector(false);
    setInvoiceId(null);
    setPendingPaymentInfo(null);
  };

  const handlePaidEnrollment = (workshop: Workshop) => {
    setPendingPaymentInfo({ workshop, enrollmentType: "workshop" });
    setShowPaymentSelector(true);
    setInvoiceId(null);
  };

  const handleCheckoutClick = async () => {
    if (!pendingPaymentInfo || !orgId) return;

    setInitiatingPayment(true);
    const { workshop, enrollmentType, sessionDate } = pendingPaymentInfo;

    try {
      if (enrollmentType === "workshop") {
        const orderData = await createWorkshopOrder(
          workshop._id,
          orgId,
          buyToAssign
            ? { quantity: Math.max(1, reserveQty), forReserve: true }
            : undefined,
        ) as { invoiceId?: string; order?: { currency?: string; amount?: number; id?: string } };

        if (orderData.invoiceId) {
          // Preferred path — inline checkout drawer owns coupon / GST /
          // cashback / wallet / Razorpay / crypto / Stripe.
          setInvoiceId(orderData.invoiceId);
        } else {
          // Fallback: direct Razorpay flow
          await openRazorpayCheckout({
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
            amount: orderData.order!.amount,
            currency: orderData.order!.currency,
            orderId: orderData.order!.id,
            name: "Workshop Registration",
            description: workshop.title,
            onVerify: async (response) => {
              try {
                await verifyWorkshopPayment(workshop._id, orgId, {
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                });
                toast.success("Successfully registered!");
                setShowPaymentSelector(false);
                setPendingPaymentInfo(null);
                fetchData(true);
              } catch (err) {
                console.error("Payment verification error:", err);
                toast.error("Payment verification failed");
              }
            },
          });
        }
      } else if (enrollmentType === "session" && sessionDate) {
        const orderData = await createSessionOrder(workshop._id, sessionDate, orgId) as { invoiceId?: string; order?: { currency?: string; amount?: number; id?: string } };
        const description = `${workshop.title} - ${format(new Date(sessionDate), "MMM d, yyyy")}`;

        if (orderData.invoiceId) {
          setInvoiceId(orderData.invoiceId);
        } else {
          // Fallback: direct Razorpay flow
          await openRazorpayCheckout({
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
            amount: orderData.order!.amount,
            currency: orderData.order!.currency,
            orderId: orderData.order!.id,
            name: "Session Registration",
            description,
            onVerify: async (response) => {
              try {
                await verifySessionPayment(workshop._id, sessionDate, orgId, {
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                });
                toast.success("Successfully registered for session!");
                setShowPaymentSelector(false);
                setPendingPaymentInfo(null);
                fetchData(true);
              } catch (err) {
                console.error("Payment verification error:", err);
                toast.error("Payment verification failed");
              }
            },
          });
        }
      } else if (enrollmentType === "full") {
        const orderData = await createFullEnrollmentOrder(workshop._id, orgId) as { invoiceId?: string; order?: { currency?: string; amount?: number; id?: string } };
        const description = `${workshop.title} - All Sessions`;

        if (orderData.invoiceId) {
          setInvoiceId(orderData.invoiceId);
        } else {
          // Fallback: direct Razorpay flow
          await openRazorpayCheckout({
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
            amount: orderData.order!.amount,
            currency: orderData.order!.currency,
            orderId: orderData.order!.id,
            name: "Full Enrollment",
            description,
            onVerify: async (response) => {
              try {
                await verifyFullEnrollmentPayment(workshop._id, orgId, {
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                });
                toast.success("Successfully enrolled for all sessions!");
                setShowPaymentSelector(false);
                setPendingPaymentInfo(null);
                fetchData(true);
              } catch (err) {
                console.error("Payment verification error:", err);
                toast.error("Payment verification failed");
              }
            },
          });
        }
      }
    } catch (err) {
      console.error("Order creation error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setInitiatingPayment(false);
    }
  };

  const handleDeleteWorkshop = async () => {
    if (!orgId || !workshopToDelete) return;

    try {
      // Still a soft delete on the backend — nothing is destroyed, so the
      // stream's enrolments and revenue keep counting. The row now stays in
      // the founder table carrying a "Deleted" status instead of moving to a
      // Trash page (that page is gone).
      await softDeleteWorkshop(workshopToDelete._id, orgId);
      toast.success("Live stream deleted");
      setWorkshopToDelete(null);
      fetchData(true);
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete live stream");
    }
  };

  const handleRestoreWorkshop = async (workshopId: string) => {
    if (!orgId) return;
    try {
      await restoreWorkshop(workshopId, orgId);
      toast.success("Live stream restored");
      fetchData(true);
    } catch (err) {
      console.error("Restore error:", err);
      toast.error("Failed to restore live stream");
    }
  };

  const handleBulkDeleteWorkshops = async () => {
    if (!orgId || selectedWorkshopIds.length === 0) return;

    setSubmittingBulkDelete(true);
    try {
      await Promise.all(
        selectedWorkshopIds.map((id) => softDeleteWorkshop(id, orgId))
      );
      toast.success("Selected live stream(s) deleted");
      setSelectedWorkshopIds([]);
      setShowBulkDeleteModal(false);
      fetchData(true);
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete selected live stream(s)");
    } finally {
      setSubmittingBulkDelete(false);
    }
  };

  const handleTrashSession = async (
    workshopId: string,
    sessionISODate: string
  ) => {
    if (!orgId) return;
    try {
      await trashWorkshopSession(workshopId, sessionISODate, orgId);
      toast.success("Session deleted");
      fetchData(true);
    } catch (err) {
      console.error("Trash session error:", err);
      toast.error("Failed to delete session");
    }
  };

  const handleCopyUrl = (workshopId: string) => {
    const baseUrl = `${shareOrigin}/webinar/${workshopId}`;
    const url = affiliateId ? `${baseUrl}?ref=${affiliateId}` : baseUrl;
    navigator.clipboard.writeText(url);
    toast.success("Meeting URL copied to clipboard!");
  };

  // One-time live streams: same referral URL shape the right panel hands
  // out (/webinar/<id>?ref=<affiliateId>), copied in a single click from
  // the founder card.
  const handleCopyWorkshopAffiliateLink = (workshopId: string) => {
    const baseUrl = `${shareOrigin}/webinar/${workshopId}`;
    const url = affiliateId ? `${baseUrl}?ref=${affiliateId}` : baseUrl;
    navigator.clipboard.writeText(url);
    toast.success("Affiliate link copied to clipboard!");
  };

  // Enrolled cards: same referral URL as the founder card, except
  // per_session streams also pin the selected day so the recipient
  // lands on that session instead of the picker.
  const handleCopyEnrolledAffiliateLink = (w: Workshop, sessionISO: string) => {
    const params = new URLSearchParams();
    if (w.enrollmentType === "per_session") params.set("sessionDate", sessionISO);
    if (affiliateId) params.set("ref", affiliateId);
    const qs = params.toString();
    const url = `${shareOrigin}/webinar/${w._id}${qs ? `?${qs}` : ""}`;
    navigator.clipboard.writeText(url);
    toast.success("Affiliate link copied to clipboard!");
  };

  const handleCopyCheckoutLink = (workshopId: string) => {
    const baseUrl = `${shareOrigin}/checkout/workshop/${workshopId}`;
    const checkoutUrl = affiliateId ? `${baseUrl}?ref=${affiliateId}` : baseUrl;
    navigator.clipboard.writeText(checkoutUrl);
    toast.success("Checkout link copied to clipboard!");
  };

  // Per-session share links. sessionISO is YYYY-MM-DD from the founder's
  // session accordion (per_session workshops only). The buyer's checkout
  // page reads ?sessionDate= and pre-selects it; the webinar join page
  // pipes it through to prepare-join so returning buyers skip the picker.
  const handleCopySessionCheckoutLink = (
    workshopId: string,
    sessionISO: string
  ) => {
    const params = new URLSearchParams({ sessionDate: sessionISO });
    if (affiliateId) params.set("ref", affiliateId);
    const url = `${shareOrigin}/checkout/workshop/${workshopId}?${params.toString()}`;
    navigator.clipboard.writeText(url);
    toast.success("Checkout link copied");
  };

  const handleCopySessionJoinLink = (
    workshopId: string,
    sessionISO: string
  ) => {
    const params = new URLSearchParams({ sessionDate: sessionISO });
    if (affiliateId) params.set("ref", affiliateId);
    const url = `${shareOrigin}/webinar/${workshopId}?${params.toString()}`;
    navigator.clipboard.writeText(url);
    toast.success("Join link copied");
  };

  const handleCopyAffiliateLink = (workshopId: string, hasPlan: boolean) => {
    const workshop = workshops.find(w => w._id === workshopId);
    if (workshop) {
      window.dispatchEvent(new CustomEvent("right-panel:open-information", {
        detail: {
          type: hasPlan ? "commission" : "affiliate",
          itemType: "workshop",
          workshop: workshop,
          affiliateId: affiliateId
        }
      }));
    }
  };

  const handleLearnMore = (workshop: Workshop) => {
    window.dispatchEvent(new CustomEvent("right-panel:open-information", {
      detail: {
        type: "information",
        itemType: "workshop",
        workshop: workshop,
        affiliateId: affiliateId
      }
    }));
  };

  // Open session picker for per-session recurring workshops
  const handleOpenSessionPicker = async (workshop: Workshop) => {
    if (!orgId) return;

    setSessionPickerMode("customer");
    setSessionPickerWorkshop(workshop);
    setLoadingSessions(true);
    setSessions([]);

    try {
      const result = await getWorkshopSessions(workshop._id, { limit: 500 });
      setSessions(result.sessions);
    } catch (err) {
      console.error("Error fetching sessions:", err);
      toast.error("Failed to load sessions");
      setSessionPickerWorkshop(null);
    } finally {
      setLoadingSessions(false);
    }
  };

  // Founder — open the session picker in host mode. Used by
  // handleStartStream for recurring workshops so the founder can pick
  // which session they're going live for.
  const handleOpenHostSessionPicker = async (workshop: Workshop) => {
    if (!orgId) return;

    setSessionPickerMode("host");
    setSessionPickerWorkshop(workshop);
    setLoadingSessions(true);
    setSessions([]);

    try {
      const result = await getWorkshopSessions(workshop._id, { limit: 500 });
      setSessions(result.sessions);
    } catch (err) {
      console.error("Error fetching sessions:", err);
      toast.error("Failed to load sessions");
      setSessionPickerWorkshop(null);
    } finally {
      setLoadingSessions(false);
    }
  };

  // Founder — commit to running a specific session. Rotates the Meet +
  // workshop.currentSessionDate on the BE, then opens the webinar tab
  // with role=host. The join gate on the BE reads currentSessionDate so
  // attendees enrolled for a different session are blocked.
  const handleStartHostSession = async (workshop: Workshop, sessionDate: string) => {
    if (!orgId) return;

    setStartingSessionDate(sessionDate);
    try {
      const result = await startWorkshopSession(workshop._id, orgId, sessionDate);
      if (result.success) {
        toast.success("Opening live stream panel...");
        setSessionPickerWorkshop(null);
        window.open(`/webinar/${workshop._id}?role=host`, "_blank");
        fetchData(true);
      }
    } catch (err) {
      console.error("Start session error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to start session");
    } finally {
      setStartingSessionDate(null);
    }
  };

  // Handle free enrollment for a specific session
  const handleFreeSessionEnrollment = async (workshop: Workshop, sessionDate: string) => {
    if (!orgId) return;

    setEnrollingSessionDate(sessionDate);
    try {
      const result = await registerForSession(workshop._id, sessionDate, orgId);
      if (result.success || result.alreadyRegistered) {
        toast.success(
          result.alreadyRegistered
            ? "Already enrolled in this session!"
            : "Successfully enrolled in session!"
        );
        setSessionPickerWorkshop(null);
        fetchData(true);
      }
    } catch (err) {
      console.error("Session enrollment error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to enroll");
    } finally {
      setEnrollingSessionDate(null);
    }
  };

  // Handle paid enrollment for a specific session
  const handlePaidSessionEnrollment = (workshop: Workshop, sessionDate: string) => {
    setPendingPaymentInfo({ workshop, enrollmentType: "session", sessionDate });
    setShowPaymentSelector(true);
    setInvoiceId(null);
    setSessionPickerWorkshop(null);
  };

  // Handle full enrollment for recurring workshops (enroll once)
  const handleFullEnrollmentFree = async (workshop: Workshop) => {
    if (!orgId) return;

    setEnrollingWorkshopId(workshop._id);
    try {
      const result = await registerForFullEnrollment(workshop._id, orgId);
      if (result.success || result.alreadyRegistered) {
        toast.success(
          result.alreadyRegistered
            ? "Already enrolled!"
            : "Successfully enrolled for all sessions!"
        );
        fetchData(true);
      }
    } catch (err) {
      console.error("Full enrollment error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to enroll");
    } finally {
      setEnrollingWorkshopId(null);
    }
  };

  // Handle paid full enrollment for recurring workshops
  const handleFullEnrollmentPaid = (workshop: Workshop) => {
    setPendingPaymentInfo({ workshop, enrollmentType: "full" });
    setShowPaymentSelector(true);
    setInvoiceId(null);
  };

  const formatDate = (date: string) => {
    return parseDateLocal(date).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Get the effective date for grouping - next session for recurring, original date for one-time
  const getWorkshopGroupDate = (workshop: Workshop): string => {
    if (workshop.isRecurring && workshop.nextSession) {
      return workshop.nextSession.dateString;
    }
    return workshop.date;
  };

  const groupWorkshopsByDate = (workshopList: Workshop[]) => {
    const grouped: { [key: string]: Workshop[] } = {};

    workshopList.forEach((workshop) => {
      const dateKey = formatDate(getWorkshopGroupDate(workshop));
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(workshop);
    });

    return grouped;
  };

  const getFilteredWorkshops = () => {
    let filtered = workshops;

    // Note: upcoming/completed filtering is handled by the backend API
    // (timezone-aware via getWorkshopEndDateTimeUTC). No client-side date
    // filtering needed — it would duplicate logic and introduce timezone bugs.

    // Discover / Enrolled client-side filtering.
    //
    // For recurring workshops with `enrollmentType: "per_session"` the
    // whole workshop's `isRegistered` flips true after ONE session
    // purchase (BE derives it in services/workshop.ts:485). Naively
    // filtering by !isRegistered would then remove the workshop from
    // Discover — but the other N-1 sessions are still purchasable via
    // the session picker. Keep it visible as long as there's still an
    // upcoming `nextSession`. Founders explicitly want the discovery
    // surface to stay so buyers can register for additional sessions.
    if (activeTab === "discover") {
      filtered = filtered.filter((workshop) => {
        if (
          workshop.isRecurring &&
          workshop.enrollmentType === "per_session"
        ) {
          return !!workshop.nextSession;
        }
        return !workshop.isRegistered && !workshop.hasPaid;
      });
    } else if (activeTab === "enrolled") {
      filtered = filtered.filter((workshop) => workshop.isRegistered || workshop.hasPaid);
    }

    // Channel filter
    if (selectedChannelFilter) {
      filtered = filtered.filter((workshop) =>
        workshop.channelIds?.some((ch) => ch._id === selectedChannelFilter)
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (workshop) =>
          workshop.title.toLowerCase().includes(query) ||
          workshop.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const filteredWorkshops = getFilteredWorkshops();
  const groupedWorkshops = groupWorkshopsByDate(filteredWorkshops);

  // Inline full-page empty state for discover tab (like ChannelsPage pattern)
  if (activeTab === "discover" && !loading && filteredWorkshops.length === 0) {
    return (
      <div className="p-4 sm:p-6 min-h-[85vh] flex items-center justify-center bg-[#0a0a0d]">
        <div className="bg-[#131316] border border-[#27272a] rounded-[24px] p-6 max-w-xl w-full text-center shadow-[0_0_50px_rgba(0,0,0,0.8)]">
          <div className="relative w-full rounded-2xl overflow-hidden mb-6 bg-white">
            <img
              src="/1240bcab6a7be9a64f30356c83cc440dfed48c52.png"
              alt="No Live Streams Available"
              className="w-full h-auto object-cover max-h-[300px]"
            />
          </div>
          <h2 className="text-xl sm:text-[22px] font-bold text-white mb-3 px-2 leading-snug">
            Great Job. You Are Already A Part Of Every Live Stream In This Office
          </h2>
          <p className="text-[#8e8e9f] text-xs sm:text-sm px-4 leading-relaxed mb-6">
            You&apos;re all set — stay connected and engaged with your teams.
            <br />
            You can now browse posts, join discussions, and share updates across every live stream.
          </p>
          <button
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("layout:set-active-popover", { detail: "Live:Enrolled" })
              )
            }
            className="w-full bg-brand hover:opacity-90 text-brand-foreground rounded-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand/10 hover:shadow-brand/25 mb-4"
          >
            <Users className="w-4 h-4" />
            Go to Enrolled
          </button>
          <div className="text-xs text-[#6b6b7b]">
            Need help?{" "}
            <span
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("layout:set-active-popover", { detail: "Support" })
                )
              }
              className="text-brand hover:underline cursor-pointer"
            >
              Contact support
            </span>
          </div>
        </div>
      </div>
    );
  }

  // The founder grid is deliberately NOT covered by this early return.
  //
  // It fetches its own dataset from /workshops/founder-table and renders the
  // DataTable's column-shaped skeleton while that runs. Returning the card-grid
  // skeleton here short-circuited that entirely, so the founder console flashed
  // six placeholder CARDS — the layout this page replaced — before the table
  // appeared. Everything else on this page still reads `workshops`, so it keeps
  // waiting on the page-level load.
  const founderGridOwnsLoading = isFounderMode && activeTab === "upcoming";

  if (loading && !founderGridOwnsLoading) {
    return (
      <div className="h-full w-full flex flex-col bg-[#0b0b0d]">
        <div className="border-b border-[#2a2a35] bg-[#0e0e12] px-6 py-4 animate-pulse">
          <div className="h-6 w-40 bg-[#1a1a22] rounded mb-2" />
          <div className="h-4 w-64 bg-[#1a1a22] rounded" />
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-[#0e0e12] border border-[#2a2a35] p-4 animate-pulse space-y-3">
              <div className="h-32 bg-[#1a1a22] rounded-lg" />
              <div className="h-4 bg-[#1a1a22] rounded w-3/4" />
              <div className="h-3 bg-[#1a1a22] rounded w-1/2" />
              <div className="flex gap-2">
                <div className="h-6 bg-[#1a1a22] rounded w-20" />
                <div className="h-6 bg-[#1a1a22] rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const getAvatarsForWorkshop = (workshop: Workshop) => {
    // If no one has registered, do not show any profiles!
    if (!workshop.registeredParticipantsCount || workshop.registeredParticipantsCount === 0) {
      return [];
    }

    // 1. If we have actual registered users' avatars, use them
    if (workshop.registeredParticipantAvatars && workshop.registeredParticipantAvatars.length > 0) {
      return workshop.registeredParticipantAvatars;
    }

    const membersWithPics = members.filter(m => m.profilePicture);
    
    // Deterministic selection based on workshopId
    let hash = 0;
    const workshopId = workshop._id;
    for (let i = 0; i < workshopId.length; i++) {
      hash = workshopId.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);
    
    const result: string[] = [];
    
    // 2. Add real profile pictures of members
    if (membersWithPics.length > 0) {
      for (let i = 0; i < 8; i++) {
        const index = (hash + i) % membersWithPics.length;
        const pic = membersWithPics[index].profilePicture;
        if (pic && !result.includes(pic)) {
          result.push(pic);
        }
      }
    }
    
    // 3. If we don't have enough, add real members without profile pics using dynamic initials
    if (result.length < 8 && members.length > 0) {
      const remainingCount = 8 - result.length;
      for (let i = 0; i < remainingCount; i++) {
        const index = (hash + i) % members.length;
        const nameSeed = encodeURIComponent(members[index].name);
        const initialAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${nameSeed}`;
        if (!result.includes(initialAvatar)) {
          result.push(initialAvatar);
        }
      }
    }
    
    // 4. Fallback to mock avatars if result is still empty
    if (result.length === 0) {
      return MOCK_AVATARS;
    }
    
    return result;
  };

  const renderEnrolledCalendarView = () => {
    const isWorkshopOnDate = (w: Workshop, date: Date) => {
      const cellYMD = toLocalYMD(date);

      // Per-session enrolments — dot only on the specific days the user
      // actually paid for. Falling through to the recurrence-pattern
      // branch would incorrectly emit a dot on every recurring day even
      // if the user only bought one session.
      if (
        w.isRecurring &&
        w.enrollmentType === "per_session" &&
        Array.isArray(w.enrolledSessions)
      ) {
        return w.enrolledSessions.some((iso) => {
          const d = new Date(iso);
          return toLocalYMD(d) === cellYMD;
        });
      }

      if (w.isRecurring && w.isRecurrenceActive && w.recurrencePattern) {
        const startStr = w.recurrenceStartDate || w.date;
        if (!startStr) return false;
        try {
          let startYear, startMonth, startDay;
          if (startStr.includes("T")) {
            const datePart = startStr.split("T")[0];
            [startYear, startMonth, startDay] = datePart.split("-").map(Number);
          } else {
            const datePart = startStr.split(" ")[0];
            [startYear, startMonth, startDay] = datePart.split("-").map(Number);
          }
          
          if (isNaN(startYear) || isNaN(startMonth) || isNaN(startDay)) {
            const parsed = new Date(startStr);
            startYear = parsed.getFullYear();
            startMonth = parsed.getMonth() + 1;
            startDay = parsed.getDate();
          }

          const startMidnight = new Date(startYear, startMonth - 1, startDay);
          const cellMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          if (cellMidnight < startMidnight) {
            return false;
          }
          // The series stops after its end date — without this the calendar
          // keeps dotting days the recurrence rule matches forever, long
          // after the last session has run.
          if (w.recurrenceEndDate) {
            const [ey, em, ed] = String(w.recurrenceEndDate)
              .slice(0, 10)
              .split("-")
              .map(Number);
            if (ey && cellMidnight > new Date(ey, em - 1, ed)) return false;
          }

          // The shared matcher, so a multi-day rule lights up every day it
          // runs on rather than only the first. It reads UTC accessors — the
          // calendar cell is a local midnight, so it's handed the cell's
          // calendar day rebuilt as a UTC one rather than the cell itself.
          return matchesPattern(
            new Date(
              Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
            ),
            w.recurrencePattern,
          );
        } catch {
          return false;
        }
      }

      return getWorkshopYMD(w) === cellYMD;
    };

    const isWorkshopCompletedOnDate = (w: Workshop, date: Date) => {
      const dateStr = w.isRecurring ? toLocalYMD(date) : w.date;
      try {
        const endUtc = localTimeToUtc(dateStr, w.endTime, w.timezone);
        return Date.now() > endUtc;
      } catch {
        return false;
      }
    };

    const getWorkshopsForDate = (date: Date, workshopList: Workshop[]) => {
      return workshopList.filter((w) => isWorkshopOnDate(w, date));
    };

    const getCalendarDays = (monthDate: Date) => {
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();

      const firstDay = new Date(year, month, 1);
      let startDayOfWeek = firstDay.getDay(); // 0 is Sun, 1 is Mon
      startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Mon is 0, Sun is 6

      const days: { date: Date; isCurrentMonth: boolean }[] = [];

      const prevMonthEnd = new Date(year, month, 0);
      const prevMonthDaysCount = prevMonthEnd.getDate();

      for (let i = startDayOfWeek - 1; i >= 0; i--) {
        days.push({
          date: new Date(year, month - 1, prevMonthDaysCount - i),
          isCurrentMonth: false,
        });
      }

      const currentMonthEnd = new Date(year, month + 1, 0);
      const currentMonthDaysCount = currentMonthEnd.getDate();
      for (let i = 1; i <= currentMonthDaysCount; i++) {
        days.push({
          date: new Date(year, month, i),
          isCurrentMonth: true,
        });
      }

      const totalDaysNeeded = startDayOfWeek + currentMonthDaysCount;
      const totalCells = totalDaysNeeded <= 35 ? 35 : 42;
      const nextPaddingCount = totalCells - days.length;
      for (let i = 1; i <= nextPaddingCount; i++) {
        days.push({
          date: new Date(year, month + 1, i),
          isCurrentMonth: false,
        });
      }

      return days;
    };

    const calendarDays = getCalendarDays(currentMonth);
    const formattedMonth = format(currentMonth, "MMMM yyyy");
    
    // Normalize date strings for matching
    const selectedDateStr = toLocalYMD(selectedDate);
    const todayDateStr = toLocalYMD(new Date());

    // Workshops on the selected date
    const dayWorkshops = filteredWorkshops.filter((w) => isWorkshopOnDate(w, selectedDate));
    
    // Sort workshops by start time
    dayWorkshops.sort((a, b) => a.startTime.localeCompare(b.startTime));

    const handlePrevMonth = () => {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const handleDayClick = (dayDate: Date) => {
      setSelectedDate(dayDate);
      if (dayDate.getMonth() !== currentMonth.getMonth()) {
        setCurrentMonth(new Date(dayDate.getFullYear(), dayDate.getMonth(), 1));
      }
    };

    const getDurationString = (startTime: string, endTime: string) => {
      if (!startTime || !endTime) return "1h 00m";
      try {
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = endTime.split(":").map(Number);
        let diffMins = (eh * 60 + em) - (sh * 60 + sm);
        if (diffMins < 0) diffMins += 24 * 60;
        const h = Math.floor(diffMins / 60);
        const m = diffMins % 60;
        return `${h}h ${String(m).padStart(2, "0")}m`;
      } catch {
        return "1h 00m";
      }
    };

    const getWorkshopStatus = (w: Workshop, contextDate: Date) => {
      const contextYMD = toLocalYMD(contextDate);
      // Founder-ended-early override: BE stamps manualEndedAt on the
      // session's override when the founder presses End. Once ended, the
      // session is Completed regardless of the scheduled window — even
      // if scheduledStart is still in the future (founder started AND
      // ended early). Check FIRST so an ended session never lights up
      // Live via a stale currentSessionDate.
      if (
        w.isRecurring &&
        w.manuallyEndedSessionDates?.some(
          (iso) => toLocalYMD(new Date(iso)) === contextYMD
        )
      ) {
        return "completed";
      }
      if (w.meetingStatus === "live") return "live";
      // Founder-started-early override: for recurring per_session workshops
      // the BE stamps workshop.currentSessionDate when the founder hits
      // Start. If that matches the calendar's contextDate, the session is
      // live now — even if the scheduled window is still in the future.
      // Keeps this view consistent with the founder's session accordion
      // (both use manualStartedAt as the source of truth).
      if (
        w.isRecurring &&
        w.currentSessionDate &&
        toLocalYMD(new Date(w.currentSessionDate)) === contextYMD
      ) {
        return "live";
      }
      const dateStr = w.isRecurring ? contextYMD : w.date;
      // A session given its own hours is judged against THOSE hours. Reading
      // the series times here would show "Starts in 1 Day" against a window
      // the session no longer runs in.
      const edit = sessionEditFor(w, contextDate);
      try {
        const startUtc = localTimeToUtc(
          dateStr,
          edit?.startTime || w.startTime,
          edit?.timezone || w.timezone,
        );
        const endUtc = localTimeToUtc(
          dateStr,
          edit?.endTime || w.endTime,
          edit?.timezone || w.timezone,
        );
        const now = Date.now();
        if (now >= startUtc && now < endUtc) return "live";
        if (now < startUtc) return "upcoming";
        return "completed";
      } catch {
        return "upcoming";
      }
    };

    const getButtonDetails = (w: Workshop, contextDate: Date) => {
      const status = getWorkshopStatus(w, contextDate);
      const dateStr = w.isRecurring ? toLocalYMD(contextDate) : w.date;
      // Same session-level times the status above used, so the countdown on
      // the button can't disagree with the badge beside it.
      const edit = sessionEditFor(w, contextDate);
      const startTime = edit?.startTime || w.startTime;
      const tz = edit?.timezone || w.timezone;

      if (status === "live") {
        return {
          label: "Join Now",
          className: "bg-[#ef4444] hover:bg-[#dc2626] text-white shadow-[0_4px_12px_rgba(239,68,68,0.2)]",
          isLive: true,
          disabled: false
        };
      } else if (status === "upcoming") {
        let diffHours = 0;
        try {
          const startUtc = localTimeToUtc(dateStr, startTime, tz);
          const diff = startUtc - Date.now();
          diffHours = Math.floor(diff / (1000 * 60 * 60));
        } catch {}

        let label = "Starts soon";
        if (diffHours > 24) {
          const days = Math.floor(diffHours / 24);
          label = `Starts in ${days} Day${days > 1 ? "s" : ""}`;
        } else if (diffHours > 0) {
          label = `Starts in ${diffHours} Hour${diffHours > 1 ? "s" : ""}`;
        } else {
          try {
            const startUtc = localTimeToUtc(dateStr, startTime, tz);
            const diff = startUtc - Date.now();
            const mins = Math.floor(diff / (1000 * 60));
            label = `Starts in ${mins > 0 ? mins : 1} Min${mins > 1 ? "s" : ""}`;
          } catch {}
        }

        return {
          label,
          className: "bg-brand hover:opacity-90 text-brand-foreground shadow-[0_4px_12px] shadow-brand/15",
          isLive: false,
          disabled: false
        };
      } else {
        return {
          label: "Completed",
          className: "bg-[#252530] text-gray-500 border border-[#2a2a35] cursor-not-allowed",
          isLive: false,
          disabled: true
        };
      }
    };

    const triggerAction = (w: Workshop) => {
      if (isFounder) {
        window.open(`/webinar/${w._id}?role=host`, "_blank");
        return;
      }
      // For per_session recurring workshops, pass the specific session
      // date the buyer picked on the calendar. Makes the target session
      // explicit end-to-end (BE prepare-join → live-gate → auto-join)
      // instead of relying on the server auto-picking currentSessionDate.
      const sessionDate =
        w.enrollmentType === "per_session"
          ? `?sessionDate=${toLocalYMD(selectedDate)}`
          : "";
      window.open(`/webinar/${w._id}${sessionDate}`, "_blank");
    };

    const displaySelectedDate = () => {
      try {
        return format(selectedDate, "EEEE, MMMM d, yyyy");
      } catch {
        return "";
      }
    };

    return (
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Calendar Card - Left */}
        <div className="lg:col-span-4 w-full">
          <div className="bg-[#131316] border border-[#23232a] rounded-[24px] p-3.5 sm:p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)] w-full">
            {/* Header */}
            <div className="flex items-center justify-between mt-1">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-full hover:bg-white/[0.04] text-[#8e8e9f] hover:text-white transition-all cursor-pointer bg-transparent"
              >
                <ChevronLeft className="h-4.5 w-4.5" />
              </button>
              
              <div className="flex flex-col items-center justify-center text-center">
                <h3 className="text-[16px] sm:text-[17px] font-bold text-white tracking-tight">{formattedMonth}</h3>
                {currentTime && (
                  <p className="text-[11px] text-[#8e8e9f]/80 font-medium mt-1">{currentTime}</p>
                )}
              </div>

              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-full hover:bg-white/[0.04] text-[#8e8e9f] hover:text-white transition-all cursor-pointer bg-transparent"
              >
                <ChevronRight className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Weekdays Header */}
            <div className="grid grid-cols-7 gap-1 text-center mt-2.5 mb-1.5">
              {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((dayName) => (
                <div key={dayName} className="text-[9px] font-bold text-[#5c5c70] tracking-wider uppercase">
                  {dayName}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-y-1.5 gap-x-0.5 text-center">
              {calendarDays.map((day, idx) => {
                const dayYMD = toLocalYMD(day.date);
                const isToday = dayYMD === todayDateStr;
                const isSelected = dayYMD === selectedDateStr;
                
                const dayWorkshops = getWorkshopsForDate(day.date, filteredWorkshops);
                const hasUpcoming = dayWorkshops.some((w) => !isWorkshopCompletedOnDate(w, day.date));
                const hasCompleted = dayWorkshops.some((w) => isWorkshopCompletedOnDate(w, day.date));

                return (
                  <div key={idx} className="flex flex-col items-center justify-center">
                    <button
                      onClick={() => handleDayClick(day.date)}
                      className={cn(
                        "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-semibold relative transition-all cursor-pointer select-none",
                        isToday
                          ? "bg-[#ef4444] text-white shadow-[0_2px_8px_rgba(239,68,68,0.4)] font-bold"
                          : isSelected
                          ? "border-2 border-white text-white font-bold"
                          : day.isCurrentMonth
                          ? "text-white hover:bg-white/[0.04]"
                          : "text-[#3a3a48] hover:bg-white/[0.02]"
                      )}
                    >
                      {day.date.getDate()}
                    </button>
                    {/* Dots indicator */}
                    <div className="flex justify-center items-center gap-0.5 mt-0.5 h-1">
                      {isToday && dayWorkshops.length > 0 ? (
                        <span className="w-1 h-1 rounded-full bg-[#ef4444] shadow-[0_0_4px_rgba(239,68,68,0.6)]" />
                      ) : hasUpcoming ? (
                        <span className="w-1 h-1 rounded-full bg-[#facc15] shadow-[0_0_4px_rgba(250,204,21,0.6)]" />
                      ) : hasCompleted ? (
                        <span className="w-1 h-1 rounded-full bg-[#22c55e] shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-[9px] font-semibold text-[#8e8e9f] mt-3.5 pt-2 border-t border-[#23232a]/40 pl-1">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#facc15] shadow-[0_0_4px_rgba(250,204,21,0.6)]" />
                <span>Upcoming</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
                <span>Completed</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shadow-[0_0_4px_rgba(239,68,68,0.4)]" />
                <span>Today</span>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Schedule - Right */}
        <div className="lg:col-span-8 w-full flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-baseline justify-between pb-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-none">
              {displaySelectedDate()}
            </h2>
            <span className="text-xs font-semibold text-[#8e8e9f] tracking-wide uppercase">
              {dayWorkshops.length} {dayWorkshops.length === 1 ? "live stream" : "live streams"}
            </span>
          </div>

          {/* Cards List */}
          <div className="flex flex-col gap-4 w-full">
            {dayWorkshops.length === 0 ? (
              <div className="border border-[#23232a] bg-[#131316]/30 rounded-[24px] p-12 text-center flex flex-col items-center justify-center shadow-inner">
                <Calendar className="h-10 w-10 text-[#5c5c70] mb-3" />
                <h4 className="text-white font-bold text-base mb-1">No Live Streams</h4>
                <p className="text-[#8e8e9f] text-xs">No enrolled live streams scheduled for this date.</p>
              </div>
            ) : (
              dayWorkshops.map((w) => {
                // What THIS day's session says. Unedited days resolve to the
                // series exactly as before.
                const edit = sessionEditFor(w, selectedDate);
                const sessionTitle = edit?.title || w.title;
                const sessionDescription = edit?.description ?? w.description;
                const sessionStartTime = edit?.startTime || w.startTime;
                const sessionEndTime = edit?.endTime || w.endTime;
                const duration = getDurationString(
                  sessionStartTime,
                  sessionEndTime,
                );
                const status = getWorkshopStatus(w, selectedDate);
                const button = getButtonDetails(w, selectedDate);

                return (
                  <div
                    key={w._id}
                    className="flex flex-col sm:flex-row items-stretch border border-[#23232a] bg-[#131316]/70 rounded-[24px] overflow-hidden p-6 hover:border-white/[0.04] hover:bg-[#131316]/90 transition-all duration-300 gap-6 w-full shadow-lg"
                  >
                    {/* Time & Duration */}
                    <div className="sm:w-28 shrink-0 flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-start gap-1 pb-4 sm:pb-0 border-b sm:border-b-0 sm:border-r border-[#23232a] pr-0 sm:pr-4">
                      <div>
                        <div className="text-[17px] font-extrabold text-white tracking-tight uppercase">
                          {formatTime12Hour(sessionStartTime)}
                        </div>
                        <div className="text-xs text-[#8e8e9f] font-medium mt-0.5">
                          {duration}
                        </div>
                      </div>
                      
                      {/* Mobile Badge */}
                      <div className="block sm:hidden">
                        {status === "live" ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-[10px] font-extrabold tracking-wider uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            LIVE NOW
                          </div>
                        ) : status === "upcoming" ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#facc15]/30 bg-[#facc15]/10 text-[#facc15] text-[10px] font-extrabold tracking-wider uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#facc15]" />
                            UPCOMING
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-500/30 bg-gray-500/10 text-gray-400 text-[10px] font-extrabold tracking-wider uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            COMPLETED
                          </div>
                        )}
                      </div>
                    </div>


                    {/* Details Column */}
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        {/* Status Badge (Desktop Only) */}
                        <div className="hidden sm:block mb-2">
                          {status === "live" ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-[10px] font-extrabold tracking-wider uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                              LIVE NOW
                            </div>
                          ) : status === "upcoming" ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#facc15]/30 bg-[#facc15]/10 text-[#facc15] text-[10px] font-extrabold tracking-wider uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#facc15]" />
                              UPCOMING
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-500/30 bg-gray-500/10 text-gray-400 text-[10px] font-extrabold tracking-wider uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                              COMPLETED
                            </div>
                          )}
                        </div>

                        {/* Title */}
                        <h4
                          onClick={() => triggerAction(w)}
                          className="text-[17px] font-bold text-white hover:text-brand transition-colors leading-snug cursor-pointer line-clamp-1 select-none"
                        >
                          {sessionTitle}
                        </h4>

                        {/* A session moved off its recurrence day. Said plainly
                            because the attendee's enrolment, links and refund
                            all still reference the original date. */}
                        {edit?.isRescheduled && (
                          <p className="text-[11px] text-brand mt-1">
                            Rescheduled from{" "}
                            {new Date(edit.sessionDate).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                timeZone: "UTC",
                              },
                            )}
                          </p>
                        )}

                        {/* Description */}
                        {sessionDescription && (
                          <p className="text-xs sm:text-sm text-[#8e8e9f] mt-2 line-clamp-2 leading-relaxed">
                            {stripHtml(sessionDescription)}
                          </p>
                        )}
                      </div>

                      {/* Bottom row: Participants & Button */}
                      <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-xs text-[#8e8e9f] font-semibold">
                          <Users className="h-4 w-4 text-[#5c5c70]" />
                          <span>
                            {w.registeredParticipantsCount || 0} / {w.maxParticipants || 300} participants
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                          <button
                            onClick={() =>
                              handleCopyEnrolledAffiliateLink(
                                w,
                                toLocalYMD(selectedDate)
                              )
                            }
                            title="Copy affiliate link"
                            className="px-4 py-2 h-9 rounded-lg text-xs font-bold border border-[#2a2a35] hover:border-brand/40 bg-[#1a1a22] text-[#9fa0b8] hover:text-brand transition-all cursor-pointer select-none flex items-center justify-center gap-1.5"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            Affiliate Link
                          </button>

                          <button
                            onClick={() => {
                              setUnsubscribeTarget({
                                workshopId: w._id,
                                sessionDate:
                                  w.enrollmentType === "per_session"
                                    ? toLocalYMD(selectedDate)
                                    : undefined,
                              });
                            }}
                            disabled={unsubscribingId !== null}
                            className="px-4 py-2 h-9 rounded-lg text-xs font-bold border border-red-500/30 hover:border-red-500 bg-red-500/10 hover:bg-red-500/20 text-red-400 disabled:opacity-50 transition-all cursor-pointer select-none text-center"
                          >
                            {unsubscribingId === w._id ? "Unsubscribing..." : "Unsubscribe"}
                          </button>

                          <button
                            onClick={() => triggerAction(w)}
                            disabled={button.disabled || unsubscribingId !== null}
                            className={cn(
                              "px-5 py-2 h-9 rounded-lg text-xs font-extrabold transition-all cursor-pointer w-full sm:w-auto text-center flex items-center justify-center select-none",
                              button.className
                            )}
                          >
                            {button.label}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  /**
   * Founder console → Live Streams.
   *
   * The card list this replaced computed its own totals from the page of
   * workshops already in memory, so the KPI tiles only ever described the
   * first 50 streams. The grid reads a purpose-built endpoint that returns
   * the rows, the totals for the WHOLE filtered set, and both view counts —
   * so the footer figures are true totals, not page sums.
   */
  const renderFounderDashboard = () => {
    // The drawer and the modals speak in Workshops; the table speaks in rows.
    // The list in memory is the bridge — a row whose workshop hasn't been
    // fetched (a later page) falls back to a refetch rather than a no-op.
    const workshopFor = (row: FounderStreamRow): Workshop | null =>
      workshops.find((w) => w._id === row.workshopId) || null;

    const linkFor = (row: FounderStreamRow, kind: "join" | "checkout") => {
      const params = new URLSearchParams();
      // A per-session recurring row must pin its own day, or the recipient
      // lands on the session picker instead of the session being shared.
      if (row.sessionDate) params.set("sessionDate", row.sessionDate.slice(0, 10));
      if (affiliateId) params.set("ref", affiliateId);
      const qs = params.toString();
      const path =
        kind === "join"
          ? `/webinar/${row.workshopId}`
          : `/checkout/workshop/${row.workshopId}`;
      return `${shareOrigin}${path}${qs ? `?${qs}` : ""}`;
    };

    return (
      // Break out of the page shell's px-4/sm:px-6 + py gutters so the grid
      // runs edge-to-edge, and give it a bounded height: DataTable scrolls
      // internally (sticky header + frozen columns), which needs a definite
      // parent rather than the page's own overflow-y-auto.
      //
      // The height is the viewport minus the tab bar above it (73px on mobile,
      // 48px from md up — see AppTabBar / the layout's mobile navbar). That
      // makes the grid's bottom edge flush with the viewport, so its footer
      // rule lands on the same line as the sidebar's user-menu divider. A
      // percentage won't do it: the scroll wrapper's child has auto height, so
      // h-full would resolve to auto and collapse.
      <div className="-mx-4 -my-3 flex h-[calc(100dvh-73px)] flex-col overflow-hidden sm:-mx-6 sm:-my-4 md:h-[calc(100dvh-48px)]">
        <FounderLiveStreamsTable
          orgId={orgId}
          refreshKey={founderTableRefresh}
          onPanelOpenChange={setLiveStreamPanelOpen}
          handlers={{
            onStart: (row) => handleStartStream(row.workshopId),
            // Rejoin a stream that is still live (the host's tab or browser
            // closed without ending it). Straight to the host studio: no
            // generate-meeting, and for recurring streams no session picker —
            // startWorkshopSession would rotate currentSessionDate under the
            // attendees mid-session.
            onJoin: (row) => {
              toast.success("Rejoining live stream...");
              window.open(`/webinar/${row.workshopId}?role=host`, "_blank");
            },
            onAnalytics: (row) => {
              const w = workshopFor(row);
              if (w) setAnalyticsWorkshop(w);
              else toast.error("Reload the page to open analytics for this stream");
            },
            onEdit: (row) => {
              const w = workshopFor(row);
              if (!w) {
                toast.error("Reload the page to edit this stream");
                return;
              }
              setEditingWorkshop(w);
              setShowCreateModal(true);
            },
            // Per-session edit. Unlike `onEdit` this needs nothing from the
            // `workshops` list — the sheet loads the session itself from
            // (workshopId, sessionDate), so it also works for rows whose
            // parent isn't in the page's dataset.
            onEditSession: (row) => {
              if (!row.sessionDate) return;
              setEditingSession({
                workshopId: row.workshopId,
                sessionDate: row.sessionDate,
                sessionNumber: row.sessionNumber,
              });
            },
            onDelete: (row) => {
              const w = workshopFor(row);
              if (w) setWorkshopToDelete(w);
              else toast.error("Reload the page to delete this stream");
            },
            // Deleted rows stay in the table, so the undo has to live here —
            // this is the only way back now that the Trash page is gone. It
            // works straight off the row id: `workshopFor` can't help, since
            // the workshops list this page loads excludes deleted streams.
            onRestore: (row) => handleRestoreWorkshop(row.workshopId),
            // EarnGPT is an in-room copilot — it is started from the live
            // studio's control bar, and there is no per-stream configuration
            // endpoint to point at yet. Say that instead of opening a panel
            // that can't do anything.
            onEarnGpt: (row) => {
              toast.info(
                row.status === "active"
                  ? "EarnGPT runs inside the live studio — open the stream and use EarnGPT Live in the control bar."
                  : "EarnGPT runs inside the live studio. Start this stream, then turn on EarnGPT Live in the control bar."
              );
            },
            // Funnels live in the Deals workspace and aren't attachable to a
            // live stream yet.
            onFunnels: () => {
              toast.info(
                "Funnels live under Deals → Funnels. Attaching a funnel to a live stream isn't available yet."
              );
            },
            links: {
              join: (row) => linkFor(row, "join"),
              checkout: (row) => linkFor(row, "checkout"),
              affiliate: (row) => linkFor(row, "join"),
            },
          }}
        />

        <EditSessionSheet
          target={editingSession}
          orgId={orgId}
          onClose={() => setEditingSession(null)}
          onSaved={() => setFounderTableRefresh((n) => n + 1)}
        />
      </div>
    );
  };

  return (
    <div className="h-full w-full max-w-full min-w-0 flex flex-col bg-[#0b0b0d] overflow-x-hidden">


      {/* Workshops List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full min-w-0 px-4 sm:px-6 py-3 sm:py-4 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="w-full space-y-4 sm:space-y-6">
          {pageView === "reserves" ? (
            <ReservesPanel itemType="workshop" />
          ) : activeTab === "attendees" ? (
            <div className="space-y-4 sm:space-y-6">
              {/* Controls Header */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#0e0e12] p-4 rounded-xl border border-[#2a2a35]">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-grow max-w-2xl">
                  {workshops.length > 0 ? (
                    <Select
                      value={selectedWorkshopId}
                      onValueChange={setSelectedWorkshopId}
                    >
                      <SelectTrigger className="w-full sm:w-[280px] h-9 bg-[#1a1a22] border-[#2a2a35] text-white">
                        <SelectValue placeholder="Select a Live Stream" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0e0e12] border-[#2a2a35] text-white">
                        {workshops.map((ws) => (
                          <SelectItem
                            key={ws._id}
                            value={ws._id}
                            className="focus:bg-[#1a1a22] focus:text-brand text-white cursor-pointer"
                          >
                            {ws.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-sm text-[#9fa0b8] italic">
                      No live streams available
                    </div>
                  )}

                  {workshops.length > 0 && selectedWorkshopId !== "all" && (
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
                      <Input
                        placeholder="Search by name or email..."
                        value={attendeeSearchQuery}
                        onChange={(e) => setAttendeeSearchQuery(e.target.value)}
                        className="h-9 w-full pl-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder:text-[#9fa0b8] text-sm"
                      />
                    </div>
                  )}
                </div>

                {workshops.length > 0 && selectedWorkshopId !== "all" && (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleSyncAttendance}
                      disabled={loadingAttendees}
                      variant="outline"
                      className="h-9 gap-2 border-[#2a2a35] hover:border-brand hover:bg-brand/10 hover:text-brand text-xs sm:text-sm"
                    >
                      <Repeat className={cn("h-4 w-4", loadingAttendees && "animate-spin")} />
                      Sync Attendance
                    </Button>
                  </div>
                )}
              </div>

              {/* Main Content Area */}
              {workshops.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border border-[#2a2a35] bg-[#0e0e12] rounded-xl px-4">
                  <Calendar className="h-12 w-12 text-[#9fa0b8] mb-4" />
                  <h3 className="text-base font-medium text-white mb-1">No Live Streams Found</h3>
                  <p className="text-sm text-[#9fa0b8] max-w-sm mb-4">
                    You need to create at least one live stream before you can manage attendees.
                  </p>
                  {isFounderMode && (
                    <Button
                      onClick={() => setShowCreateModal(true)}
                      className="mt-4 gap-2 bg-brand text-brand-foreground hover:opacity-90 text-sm font-semibold"
                    >
                      <Plus className="h-4 w-4" />
                      Create a Live Stream
                    </Button>
                  )}
                </div>
              ) : selectedWorkshopId === "all" ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border border-[#2a2a35] bg-[#0e0e12] rounded-xl px-4">
                  <Users className="h-12 w-12 text-[#9fa0b8] mb-4" />
                  <h3 className="text-base font-medium text-white mb-1">Select a Live Stream</h3>
                  <p className="text-sm text-[#9fa0b8] max-w-sm">
                    Choose a live stream from the dropdown above to view and manage its registered attendees.
                  </p>
                </div>
              ) : loadingAttendees ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 text-brand animate-spin mb-4" />
                  <p className="text-sm text-[#9fa0b8]">Loading attendee list...</p>
                </div>
              ) : (() => {
                const filteredAttendees = attendees.filter((reg) => {
                  const user = reg.userId || {};
                  const name = (user.name || "").toLowerCase();
                  const email = (user.email || "").toLowerCase();
                  const query = attendeeSearchQuery.toLowerCase();
                  return name.includes(query) || email.includes(query);
                });

                if (filteredAttendees.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-center border border-[#2a2a35] bg-[#0e0e12] rounded-xl px-4">
                      <Users className="h-10 w-10 text-[#9fa0b8] mb-3" />
                      <h3 className="text-sm font-medium text-white mb-1">
                        {attendeeSearchQuery ? "No matching attendees" : "No attendees registered"}
                      </h3>
                      <p className="text-xs text-[#9fa0b8] max-w-xs">
                        {attendeeSearchQuery
                          ? "Try adjusting your search terms to find the attendee."
                          : "No one has registered for this live stream yet."}
                      </p>
                    </div>
                  );
                }

                const formatRegDate = (dateStr: string) => {
                  if (!dateStr) return "-";
                  try {
                    return format(new Date(dateStr), "MMM d, yyyy");
                  } catch (e) {
                    return "-";
                  }
                };

                return (
                  <div className="bg-[#0e0e12] rounded-xl border border-[#2a2a35] overflow-hidden">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#2a2a35] bg-[#0c0c10]">
                            <th className="pl-6 pr-3 py-3.5 text-xs font-semibold text-[#7c7c9c] uppercase tracking-wider">
                              Attendee
                            </th>
                            <th className="px-4 py-3.5 text-xs font-semibold text-[#7c7c9c] uppercase tracking-wider">
                              Registration Date
                            </th>
                            <th className="px-4 py-3.5 text-xs font-semibold text-[#7c7c9c] uppercase tracking-wider">
                              Access Type
                            </th>
                            <th className="px-4 py-3.5 text-xs font-semibold text-[#7c7c9c] uppercase tracking-wider">
                              Status
                            </th>
                            <th className="pr-6 pl-4 py-3.5 text-right text-xs font-semibold text-[#7c7c9c] uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1a1a24]">
                          {filteredAttendees.map((reg) => {
                            const user = reg.userId || {};
                            const name = user.name || "Unknown";
                            const email = user.email || "No email";
                            const avatar = user.profilePicture;
                            const regDate = formatRegDate(reg.registeredAt || reg.createdAt);
                            const accessType = reg.hasPaid ? `Paid ($${(reg.amountPaid ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : "Free";

                            return (
                              <tr
                                key={reg._id}
                                className="hover:bg-[#111116] transition-colors duration-150 group"
                              >
                                {/* Attendee Column */}
                                <td className="pl-6 pr-3 py-4 align-middle">
                                  <div className="flex items-center gap-3">
                                    {avatar ? (
                                      <img
                                        src={avatar}
                                        alt={name}
                                        className="h-9 w-9 rounded-full object-cover border border-[#2a2a35]"
                                      />
                                    ) : (
                                      <div className="h-9 w-9 rounded-full bg-[#2a2a35] text-brand flex items-center justify-center font-semibold text-sm">
                                        {name.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-sm font-medium text-white group-hover:text-brand transition-colors truncate">
                                        {name}
                                      </span>
                                      <span className="text-xs text-[#7c7c9c] truncate">
                                        {email}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                {/* Date Column */}
                                <td className="px-4 py-4 align-middle text-sm text-[#7c7c9c]">
                                  {regDate}
                                </td>
                                {/* Access Type Column */}
                                <td className="px-4 py-4 align-middle">
                                  {reg.hasPaid ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      {accessType}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#1a1a22] text-[#9fa0b8] border border-[#2a2a35]">
                                      Free
                                    </span>
                                  )}
                                </td>
                                {/* Status Column */}
                                <td className="px-4 py-4 align-middle">
                                  {reg.status === "attended" ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                      <Check className="h-3 w-3" />
                                      Attended
                                    </span>
                                  ) : reg.status === "cancelled" ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30">
                                      Cancelled
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                      Registered
                                    </span>
                                  )}
                                </td>
                                {/* Action Column */}
                                <td className="pr-6 pl-4 py-4 align-middle text-right">
                                  {reg.status === "registered" && (
                                    <Button
                                      onClick={() => handleMarkAttended(user._id)}
                                      size="sm"
                                      variant="outline"
                                      className="h-8 border-[#2a2a35] hover:border-brand hover:bg-brand/10 hover:text-brand text-xs font-medium"
                                    >
                                      Mark Attended
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card List View */}
                    <div className="md:hidden divide-y divide-[#1a1a24]">
                      {filteredAttendees.map((reg) => {
                        const user = reg.userId || {};
                        const name = user.name || "Unknown";
                        const email = user.email || "No email";
                        const avatar = user.profilePicture;
                        const regDate = formatRegDate(reg.registeredAt || reg.createdAt);
                        const accessType = reg.hasPaid ? `Paid ($${(reg.amountPaid ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : "Free";

                        return (
                          <div key={reg._id} className="p-4 space-y-3">
                            <div className="flex items-center gap-3">
                              {avatar ? (
                                <img
                                  src={avatar}
                                  alt={name}
                                  className="h-9 w-9 rounded-full object-cover border border-[#2a2a35]"
                                />
                              ) : (
                                <div className="h-9 w-9 rounded-full bg-[#2a2a35] text-brand flex items-center justify-center font-semibold text-sm">
                                  {name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm font-medium text-white truncate">
                                  {name}
                                </span>
                                <span className="text-xs text-[#7c7c9c] truncate">
                                  {email}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-[#7c7c9c]">
                              <span>Registered: {regDate}</span>
                              <div className="flex items-center gap-2">
                                {reg.hasPaid ? (
                                  <span className="px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    {accessType}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full font-medium bg-[#1a1a22] text-[#9fa0b8] border border-[#2a2a35]">
                                    Free
                                  </span>
                                )}

                                {reg.status === "attended" ? (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    <Check className="h-3 w-3" />
                                    Attended
                                  </span>
                                ) : reg.status === "cancelled" ? (
                                  <span className="px-2 py-0.5 rounded-full font-medium bg-red-500/15 text-red-400 border border-red-500/30">
                                    Cancelled
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                    Registered
                                  </span>
                                )}
                              </div>
                            </div>

                            {reg.status === "registered" && (
                              <Button
                                onClick={() => handleMarkAttended(user._id)}
                                className="w-full h-8 bg-transparent border border-[#2a2a35] hover:border-brand hover:bg-brand/10 hover:text-brand text-xs"
                              >
                                Mark Attended
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : isFounderMode && activeTab === "upcoming" ? (
            renderFounderDashboard()
          ) : activeTab === "enrolled" ? (
            renderEnrolledCalendarView()
          ) : filteredWorkshops.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center px-4">
              <Calendar className="h-10 w-10 sm:h-12 sm:w-12 text-[#9fa0b8] mb-3 sm:mb-4" />
              <p className="text-sm sm:text-base text-[#9fa0b8]">
                {searchQuery
                  ? "No live streams found"
                  : activeTab === "enrolled"
                  ? "No enrolled live streams available"
                  : `No ${activeTab} live streams available`}
              </p>
              {isFounderMode && activeTab === "upcoming" && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-3 sm:mt-4 gap-2 bg-brand text-brand-foreground hover:opacity-90 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Create your first workshop
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            Object.entries(groupedWorkshops).map(([date, dateWorkshops]) => (
              <div key={date} className="space-y-2 sm:space-y-4">
                <div className="relative flex items-center justify-center my-6">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-[#1f1f27]" />
                  </div>
                  <div className="relative flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#2a2a35] bg-[#0e0e12] text-xs font-medium text-[#9fa0b8]">
                    <Calendar className="h-3.5 w-3.5 text-brand" />
                    <span>{date}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {dateWorkshops.map((workshop) => (
                    <WorkshopCard
                      key={workshop._id}
                      workshop={workshop}
                      isCompleted={activeTab === "completed"}
                      isFounder={isFounderMode}
                      onPaymentClick={() => handlePaidEnrollment(workshop)}
                      onEnrollClick={() => handleFreeEnrollment(workshop)}
                      onEditClick={() => {
                        setEditingWorkshop(workshop);
                        setShowCreateModal(true);
                      }}
                      onDeleteClick={() => setWorkshopToDelete(workshop)}
                      onCopyUrl={() => handleCopyUrl(workshop._id)}
                      onCopyAffiliateLink={(hasPlan) => handleCopyAffiliateLink(workshop._id, hasPlan)}
                      onLearnMoreClick={() => handleLearnMore(workshop)}
                      onSessionPickerOpen={() => handleOpenSessionPicker(workshop)}
                      onFullEnrollmentFree={() => handleFullEnrollmentFree(workshop)}
                      onFullEnrollmentPaid={() => handleFullEnrollmentPaid(workshop)}
                      onAnalyticsClick={() => setAnalyticsWorkshop(workshop)}
                      onStartStreamClick={() => handleStartStream(workshop._id)}
                      isEnrolling={enrollingWorkshopId === workshop._id}
                      memberAvatars={getAvatarsForWorkshop(workshop)}
                      affiliateId={affiliateId}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            Object.entries(groupedWorkshops).map(([date, dateWorkshops]) => (
              <div key={date} className="space-y-2 sm:space-y-4">
                <div className="relative flex items-center justify-center my-6">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-[#1f1f27]" />
                  </div>
                  <div className="relative flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#2a2a35] bg-[#0e0e12] text-xs font-medium text-[#9fa0b8]">
                    <Calendar className="h-3.5 w-3.5 text-brand" />
                    <span>{date}</span>
                  </div>
                </div>
                <div className="space-y-4 sm:space-y-6 w-full">
                  {dateWorkshops.map((workshop) => (
                    <WorkshopCard
                      key={workshop._id}
                      workshop={workshop}
                      isCompleted={activeTab === "completed"}
                      isFounder={isFounderMode}
                      onPaymentClick={() => handlePaidEnrollment(workshop)}
                      onEnrollClick={() => handleFreeEnrollment(workshop)}
                      onEditClick={() => {
                        setEditingWorkshop(workshop);
                        setShowCreateModal(true);
                      }}
                      onDeleteClick={() => setWorkshopToDelete(workshop)}
                      onCopyUrl={() => handleCopyUrl(workshop._id)}
                      onCopyAffiliateLink={(hasPlan) => handleCopyAffiliateLink(workshop._id, hasPlan)}
                      onLearnMoreClick={() => handleLearnMore(workshop)}
                      onSessionPickerOpen={() => handleOpenSessionPicker(workshop)}
                      onFullEnrollmentFree={() => handleFullEnrollmentFree(workshop)}
                      onFullEnrollmentPaid={() => handleFullEnrollmentPaid(workshop)}
                      onAnalyticsClick={() => setAnalyticsWorkshop(workshop)}
                      onStartStreamClick={() => handleStartStream(workshop._id)}
                      isEnrolling={enrollingWorkshopId === workshop._id}
                      isListView
                      memberAvatars={getAvatarsForWorkshop(workshop)}
                      affiliateId={affiliateId}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Filter Drawer */}
      {showFilterDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowFilterDrawer(false)}
          />
          <div className="relative ml-auto w-80 h-full bg-[#0e0e12] border-l border-[#2a2a35] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#2a2a35]">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-brand" />
                <h2 className="text-lg font-semibold text-white">Filters</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilterDrawer(false)}
                className="p-2 text-[#9fa0b8] hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Channel Filter */}
              {channels.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-white mb-3">
                    Channels
                  </h3>
                  <div className="space-y-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedChannelFilter(null)}
                      className={cn(
                        "w-full justify-start text-sm",
                        !selectedChannelFilter
                          ? "bg-brand text-brand-foreground hover:opacity-90"
                          : "text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white"
                      )}
                    >
                      All Channels
                    </Button>
                    {channels.map((channel) => (
                      <Button
                        key={channel._id}
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedChannelFilter(channel._id)}
                        className={cn(
                          "w-full justify-start text-sm",
                          selectedChannelFilter === channel._id
                            ? "bg-brand text-brand-foreground hover:opacity-90"
                            : "text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white"
                        )}
                      >
                        {channel.title}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {selectedChannelFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedChannelFilter(null)}
                  className="w-full border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Workshop Modal */}
      {showCreateModal && orgId && (
        <CreateWorkshopModal
          isOpen={showCreateModal}
          members={members}
          onClose={() => {
            setShowCreateModal(false);
            setEditingWorkshop(null);
          }}
          onSuccess={() => {
            fetchData(true);
            setShowCreateModal(false);
            setEditingWorkshop(null);
          }}
          orgId={orgId}
          channels={channels}
          editWorkshop={editingWorkshop}
        />
      )}

      {/* Instant ("Go Live Now") Modal */}
      {showInstantModal && orgId && (
        <InstantLiveStreamModal
          onClose={() => setShowInstantModal(false)}
          onSuccess={() => {
            fetchData(true);
            setShowInstantModal(false);
          }}
          orgId={orgId}
          channels={channels}
          members={members}
          orgName={userData.orgName}
        />
      )}

      {/* Delete Confirmation Dialog.
          Surfaces, borders and type match the Live Streams drawers (#121214
          shell, #18181B inner card, rim-light edges) so the destructive step
          doesn't look like it came from a different app than the table that
          launched it. "Live stream", not "workshop" — that is the word the
          whole console uses. */}
      {workshopToDelete && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200">
          <div className="rim-light w-full max-w-[440px] rounded-2xl bg-[#121214] p-6 shadow-2xl shadow-black/80 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EF4444]/12">
                <Trash2 className="h-[18px] w-[18px] text-[#EF4444]" />
              </div>
              <h2 className="text-[17px] font-semibold tracking-wide text-white">
                Delete live stream
              </h2>
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-white/50">
              This live stream will be marked Deleted. It stays in your table
              with its enrolments and revenue intact, but nobody can join or
              enrol any more.
            </p>

            <div className="rim-light mt-3 rounded-xl bg-[#18181B]/80 px-4 py-3">
              <span className="text-[14px] font-semibold text-white">
                {workshopToDelete.title}
              </span>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setWorkshopToDelete(null)}
                className="h-10 rounded-xl px-4 text-[14px] font-medium text-white/60 transition hover:bg-white/[0.06] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteWorkshop}
                className="flex h-10 items-center gap-2 rounded-xl bg-[#EF4444] px-4 text-[14px] font-semibold text-white transition hover:bg-[#DC2626]"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      {showBulkDeleteModal && selectedWorkshopIds.length > 0 && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200">
          <div className="rim-light w-full max-w-[440px] rounded-2xl bg-[#121214] p-6 shadow-2xl shadow-black/80 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EF4444]/12">
                <Trash2 className="h-[18px] w-[18px] text-[#EF4444]" />
              </div>
              <h2 className="text-[17px] font-semibold tracking-wide text-white">
                Delete live streams
              </h2>
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-white/50">
              {selectedWorkshopIds.length} selected live stream
              {selectedWorkshopIds.length === 1 ? "" : "s"} will be marked
              Deleted. {selectedWorkshopIds.length === 1 ? "It stays" : "They stay"}{" "}
              in your table, but nobody can join or enrol any more.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={submittingBulkDelete}
                className="h-10 rounded-xl px-4 text-[14px] font-medium text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteWorkshops}
                disabled={submittingBulkDelete}
                className="flex h-10 items-center gap-2 rounded-xl bg-[#EF4444] px-4 text-[14px] font-semibold text-white transition hover:bg-[#DC2626] disabled:opacity-50"
              >
                {submittingBulkDelete ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {submittingBulkDelete ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating bottom selection menu */}
      {selectedWorkshopIds.length > 0 && !showCreateModal && !editingWorkshop && (
        <div className="fixed bottom-6 left-[calc(50%+var(--sidebar-width,0px)/2)] -translate-x-1/2 z-[550] flex items-center justify-center w-full px-4 max-w-[calc(100%-32px)] sm:max-w-md md:max-w-lg lg:max-w-xl pointer-events-none">
          <div
            className="flex items-center gap-4 p-3 pointer-events-auto rounded-[24px] text-white"
            style={{
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              background: "rgba(30, 30, 30, 0.75)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 8px 32px rgba(0, 0, 0, 0.25)"
            }}
          >
            {/* Selected Count */}
            <div className="pl-4 pr-2 text-sm font-semibold text-white whitespace-nowrap">
              {selectedWorkshopIds.length} Selected
            </div>

            {/* Vertical Divider */}
            <div className="h-8 w-[1px] bg-white/20 mx-1 self-center" />

             {/* Action Buttons */}
            <div className="flex items-center gap-3 pr-2">
              {/* Start Stream Action.
                  Mirrors the per-tile button's gating so a completed
                  workshop can't be restarted from the bulk bar either.
                  A missing meetingUrl no longer disables Start —
                  handleStartStream generates the Meet on demand. */}
              {(() => {
                const selected =
                  selectedWorkshopIds.length === 1
                    ? workshops.find((w) => w._id === selectedWorkshopIds[0])
                    : undefined;
                const isCompleted =
                  (selected as any)?.computedStatus === "completed";
                // Only one host seat per session. If someone else already took
                // it, Start can't succeed — the server answers 409 — so offer
                // Join instead of a button that only produces an error.
                const seatHolder = selected?.sessionHost || null;
                const heldByOther =
                  !!seatHolder && seatHolder.id !== getUserDataFromToken().userId;
                const holderName =
                  seatHolder?.name || seatHolder?.email || "Someone";
                const isActionable =
                  selectedWorkshopIds.length === 1 && !isCompleted;
                const tooltip =
                  selectedWorkshopIds.length !== 1
                    ? "Select exactly one live stream to start"
                    : isCompleted
                      ? "Live stream is completed. Create a new one to run again."
                      : heldByOther
                        ? `${holderName} is hosting this session — join as a viewer`
                        : "Start live stream immediately";
                return (
                  <button
                    type="button"
                    disabled={!isActionable}
                    onClick={() => {
                      const selectedId = selectedWorkshopIds[0];
                      if (!selectedId) return;
                      if (heldByOther) {
                        window.open(`/webinar/${selectedId}`, "_blank");
                        setSelectedWorkshopIds([]);
                        return;
                      }
                      handleStartStream(selectedId);
                    }}
                    className={`flex flex-col items-center justify-center px-4 py-2 gap-1 rounded-[16px] transition-all duration-300 ${
                      !isActionable
                        ? "text-white/30 cursor-not-allowed"
                        : heldByOther
                          ? "text-[#3b82f6] hover:text-[#5b9bf5] hover:bg-white/[0.05] cursor-pointer"
                          : "text-brand hover:opacity-80 hover:bg-white/[0.05] cursor-pointer"
                    }`}
                    title={tooltip}
                  >
                    <Play className="h-5 w-5" />
                    <span className="text-[11px] font-medium tracking-wide">
                      {heldByOther ? "Join Stream" : "Start Stream"}
                    </span>
                  </button>
                );
              })()}

              {/* Edit Action */}
              <button
                type="button"
                disabled={selectedWorkshopIds.length !== 1}
                onClick={() => {
                  const selectedWs = workshops.find(w => w._id === selectedWorkshopIds[0]);
                  if (selectedWs) {
                    setEditingWorkshop(selectedWs);
                    setShowCreateModal(true);
                  }
                }}
                className={`flex flex-col items-center justify-center px-4 py-2 gap-1 rounded-[16px] transition-all duration-300 ${
                  selectedWorkshopIds.length === 1
                    ? "text-white/80 hover:text-white hover:bg-white/[0.05] cursor-pointer"
                    : "text-white/30 cursor-not-allowed"
                }`}
                title="Edit live stream (available when 1 item selected)"
              >
                <Edit2 className="h-5 w-5" />
                <span className="text-[11px] font-medium tracking-wide">Edit</span>
              </button>

              {/* Delete Action */}
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                className="flex flex-col items-center justify-center px-4 py-2 gap-1 rounded-[16px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-300 cursor-pointer"
                title="Delete selected live streams"
              >
                <Trash2 className="h-5 w-5" />
                <span className="text-[11px] font-medium tracking-wide">Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workshop Analytics Modal */}
      {analyticsWorkshop && orgId && (
        <WorkshopAnalyticsModal
          workshop={analyticsWorkshop}
          orgId={orgId}
          onClose={() => setAnalyticsWorkshop(null)}
        />
      )}

      {/* Unsubscribe Confirmation AlertDialog */}
      <AlertDialog open={unsubscribeTarget !== null} onOpenChange={(open) => { if (!open) setUnsubscribeTarget(null); }}>
        <AlertDialogContent className="bg-[#0e0e12] border border-[#2a2a35] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-red-500">⚠️</span> Unsubscribe from Live Stream
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#9fa0b8] text-sm mt-2 leading-relaxed">
              {(() => {
                if (!unsubscribeTarget) return null;
                if (!unsubscribeTarget.sessionDate) {
                  return "Are you sure you want to unsubscribe from this live stream? You will lose access to every session and any recorded streams.";
                }
                // Per-session cancel — copy shows which day is affected +
                // how many other sessions the user keeps.
                const workshop = workshops.find(
                  (w) => w._id === unsubscribeTarget.workshopId
                );
                const dateLabel = (() => {
                  try {
                    return format(
                      parseDateLocal(unsubscribeTarget.sessionDate),
                      "MMM d, yyyy"
                    );
                  } catch {
                    return unsubscribeTarget.sessionDate;
                  }
                })();
                const remaining = (workshop?.enrolledSessions || []).filter(
                  (iso) => toLocalYMD(new Date(iso)) !== unsubscribeTarget.sessionDate
                ).length;
                return remaining > 0
                  ? `You'll lose access to the ${dateLabel} session only. You still have ${remaining} other enrolled session${remaining === 1 ? "" : "s"} for this stream.`
                  : `You'll lose access to the ${dateLabel} session only.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="bg-[#1a1a22] hover:bg-[#252530] text-[#9fa0b8] hover:text-white border border-[#2a2a35] hover:border-[#3a3a48]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!unsubscribeTarget) return;
                const target = unsubscribeTarget;
                setUnsubscribeTarget(null);
                setUnsubscribingId(target.workshopId);
                try {
                  await cancelWorkshopRegistration(
                    target.workshopId,
                    target.sessionDate
                  );
                  toast.success(
                    target.sessionDate
                      ? "Unsubscribed from this session"
                      : "Successfully unsubscribed from this live stream!"
                  );
                  fetchData(true);
                } catch (err) {
                  console.error("Error unsubscribing:", err);
                  toast.error("Failed to unsubscribe");
                } finally {
                  setUnsubscribingId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold transition-colors"
            >
              Unsubscribe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Benefits slide-in panel — Step 1 only. Clicking "Register" here
          creates the invoice (handleCheckoutClick), sets `invoiceId`, and
          hands off to the inline checkout drawer below. Once `invoiceId`
          is set this panel hides so the drawer takes over. */}
      {showPaymentSelector && pendingPaymentInfo && !invoiceId && (() => {
        const { workshop } = pendingPaymentInfo;

        const priceVal = workshop.price ?? 0;
        const currencySymbol = workshop.currency === "INR" ? "₹" : "$";
        const formattedPrice = `${currencySymbol}${priceVal.toFixed(2)}`;

        const benefits = [
          "Full access to this live stream event",
          "Access to all session recordings",
          "Interactive Q&A and chat room",
          "Learning materials and resources",
          ...(workshop.isRecurring
            ? ["Access to future sessions", "Cancel anytime"]
            : ["One-time payment, lifetime access"])
        ];

        return (
          <div className="fixed inset-0 z-[1000] flex animate-in fade-in duration-200" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => {
                if (!initiatingPayment) {
                  setShowPaymentSelector(false);
                  setPendingPaymentInfo(null);
                  setInvoiceId(null);
                }
              }}
            />

            {/* Slide-in side panel */}
            <div
              className="relative ml-auto h-full w-full sm:max-w-md bg-[#0b0b0d] border-l border-[#2a2a35] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
            >
              {/* Sticky header */}
              <div className="shrink-0 px-5 pt-5 pb-4 border-b border-[#2a2a35] bg-[#0e0e12]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-brand/10 border border-brand/30 shrink-0">
                      <CreditCard className="w-4 h-4 text-brand" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-white">
                        {workshop.isRecurring ? "Subscribe to webinar" : "Unlock webinar"}
                      </h2>
                      <p className="text-xs text-[#9fa0b8] mt-0.5 truncate">
                        {workshop.title}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPaymentSelector(false);
                      setPendingPaymentInfo(null);
                      setInvoiceId(null);
                    }}
                    disabled={initiatingPayment}
                    className="p-1.5 rounded-md text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
                {/* Webinar Summary Header */}
                <div className="rounded-xl border border-[#2a2a35] bg-[#0e0e12] overflow-hidden">
                  {workshop.thumbnail && (
                    <img
                      src={workshop.thumbnail}
                      alt={workshop.title}
                      className="w-full h-32 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-white text-sm leading-tight mb-2">
                      {workshop.title}
                    </h3>
                    <div className="flex justify-between items-center text-xs text-[#9fa0b8] border-t border-[#2a2a35]/40 pt-2">
                      <span>Total Amount</span>
                      <span className="text-white font-semibold font-mono text-sm">
                        {formattedPrice}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Benefits */}
                <div className="rounded-xl border border-brand/20 bg-brand/[0.04] p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand" />
                    <h4 className="text-xs font-semibold text-brand uppercase tracking-wide">
                      What you get
                    </h4>
                  </div>
                  <ul className="space-y-2">
                    {benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-xs text-[#c7c7da]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-brand mt-0.5 shrink-0" />
                        <span className="leading-relaxed">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Buy-to-assign — only for the plain "workshop" enrollment
                    type (session/full are date-scoped and don't map to
                    reserves cleanly). Mirrors ProductsPage:3760 shape. */}
                {pendingPaymentInfo?.enrollmentType === "workshop" && (
                  <div className="rounded-xl border border-[#2a2a35] bg-[#1a1a22]/30 p-3.5 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white leading-none">Buy to assign</p>
                        <p className="text-[9px] text-[#8888a0] mt-1 leading-normal">Purchase seats as reserves to assign later.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBuyToAssign((v) => !v)}
                        className="relative shrink-0 rounded-full transition-colors duration-200 cursor-pointer"
                        style={{ width: "44px", height: "24px", backgroundColor: buyToAssign ? "var(--brand)" : "#2a2a35" }}
                        aria-pressed={buyToAssign}
                      >
                        <span
                          className="absolute rounded-full bg-white transition-transform duration-200"
                          style={{ top: "2px", left: "2px", width: "20px", height: "20px", transform: buyToAssign ? "translateX(20px)" : "translateX(0px)" }}
                        />
                      </button>
                    </div>
                    {buyToAssign && (
                      <div className="flex items-center justify-between border-t border-[#2a2a35]/30 pt-3">
                        <span className="text-[10px] font-bold text-[#8888a0] uppercase tracking-wider">Quantity</span>
                        <div className="flex items-center gap-2 bg-[#0e0e12] rounded-lg border border-[#2a2a35] p-1 select-none">
                          <button type="button" onClick={() => setReserveQty((q) => Math.max(1, q - 1))}
                            className="h-6 w-6 rounded flex items-center justify-center text-white hover:bg-[#1a1a22] transition-colors text-xs cursor-pointer font-bold">−</button>
                          <span className="w-8 text-center text-xs font-bold text-white tabular-nums">{reserveQty}</span>
                          <button type="button" onClick={() => setReserveQty((q) => Math.min(99, q + 1))}
                            className="h-6 w-6 rounded flex items-center justify-center text-white hover:bg-[#1a1a22] transition-colors text-xs cursor-pointer font-bold">+</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer CTA */}
              <div className="shrink-0 border-t border-[#2a2a35] bg-[#0e0e12] px-5 py-4 space-y-3">
                <Button
                  onClick={handleCheckoutClick}
                  disabled={initiatingPayment}
                  className="w-full h-12 bg-brand hover:opacity-90 text-brand-foreground font-bold text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {initiatingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      {buyToAssign && pendingPaymentInfo?.enrollmentType === "workshop"
                        ? `Buy ${reserveQty} to assign`
                        : workshop.isRecurring && workshop.enrollmentType === "per_session"
                        ? `Register for ${formattedPrice} / session`
                        : workshop.isRecurring
                        ? `Subscribe for ${formattedPrice} / monthly`
                        : `Register for ${formattedPrice}`}
                    </>
                  )}
                </Button>
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#6b6b80]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>
                    Secure checkout · Razorpay · Stripe · UPI · Crypto · Wallet
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Inline invoice payment — right-side slide-in drawer, matching
          ChannelPaymentModalNew and WebinarPreJoin. Replaces the old
          <iframe src="/invoice/{id}?embed=1">. Body renders
          <CheckoutPaymentStep> directly (no iframe, no postMessage).
          Backdrop click AND close-X both cancel — dashboard flow, buyer
          is already authed, closing mid-payment is fine (matches old
          modal behavior). */}
      {showPaymentSelector && invoiceId && (
        <div
          className="fixed inset-0 z-[9999] flex"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop — clicking cancels the payment. */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleInvoiceCancelledInline}
          />

          {/* Slide-in drawer panel */}
          <div className="relative ml-auto h-full w-full sm:max-w-[500px] md:max-w-[540px] bg-[#0b0b0d] border-l border-[#2a2a35] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-[#2a2a35] bg-[#0e0e12]">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-white truncate">Complete Payment</h2>
                <p className="text-xs text-[#9fa0b8] truncate">{pendingPaymentInfo?.workshop?.title || "Workshop"}</p>
              </div>
              <button
                type="button"
                onClick={handleInvoiceCancelledInline}
                aria-label="Close payment"
                className="p-1.5 rounded-full hover:bg-[#1a1a22] text-white transition-colors cursor-pointer shrink-0 ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
              {(() => {
                const me = getUserDataFromToken();
                return (
                  <CheckoutPaymentStep
                    invoiceId={invoiceId}
                    organizationName={
                      pendingPaymentInfo?.workshop?.title || "Complete payment"
                    }
                    userEmail={me.email || ""}
                    userName={me.name || undefined}
                    onSuccess={handleInvoicePaidInline}
                    onCancel={handleInvoiceCancelledInline}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Session Picker Modal for Per-Session Recurring Workshops */}
      {sessionPickerWorkshop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl w-full max-w-lg p-6 shadow-xl animate-in zoom-in-95 duration-200 max-h-[80vh] overflow-hidden flex flex-col">
            {/* The stream's own cover, not a generic calendar glyph — it
                identifies which series these dates belong to, and the purple
                tile it replaces was the only purple in this console. */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                {sessionPickerWorkshop.thumbnail ? (
                  <img
                    src={sessionPickerWorkshop.thumbnail}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand/10">
                    <Calendar className="h-5 w-5 text-brand" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-white">
                    {sessionPickerMode === "host"
                      ? "Start a session"
                      : "Select a session"}
                  </h2>
                  <p className="truncate text-sm text-[#9fa0b8]">
                    {sessionPickerWorkshop.title}
                    {sessions.length > 0 && (
                      <span className="text-[#6c6c80]">
                        {" · "}
                        {sessions.length} available
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSessionPickerWorkshop(null)}
                className="shrink-0 text-[#9fa0b8] hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {sessionPickerWorkshop.timezone && (
              <p className="mb-3 text-xs text-[#6c6c80]">
                Times shown in{" "}
                {new Intl.DateTimeFormat("en-US", {
                  timeZone: sessionPickerWorkshop.timezone,
                  timeZoneName: "short",
                })
                  .formatToParts(new Date())
                  .find((p) => p.type === "timeZoneName")?.value ||
                  sessionPickerWorkshop.timezone}
              </p>
            )}

            <div className="flex-1 overflow-y-auto space-y-3">
              {loadingSessions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 text-brand animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="py-12 text-center">
                  <Calendar className="mx-auto mb-3 h-10 w-10 text-[#2a2a35]" />
                  <p className="text-sm font-medium text-white">
                    No sessions left to join
                  </p>
                  <p className="mt-1 text-xs text-[#6c6c80]">
                    Every session in this series has already run.
                  </p>
                </div>
              ) : (
                sessions.map((session) => {
                  const tz = sessionPickerWorkshop.timezone;
                  const leaf = sessionDateLeaf(session.startDateTime, tz);
                  const duration = sessionDuration(
                    session.startDateTime,
                    session.endDateTime,
                  );
                  // Free vs paid is decided by the SESSION, not the series: a
                  // session priced on its own must not take the free-enrol path
                  // (the backend refuses it), and a session made free must not
                  // open checkout.
                  const isFree =
                    session.isFree ?? sessionPickerWorkshop.isFree;
                  const price = session.price ?? sessionPickerWorkshop.price;
                  const currency =
                    session.currency || sessionPickerWorkshop.currency;
                  // Every row names itself. The server resolves this over the
                  // series template, so an edited session shows its own title
                  // and an untouched one shows the series title — the fallback
                  // is for a backend that predates per-session editing.
                  const title = session.title || sessionPickerWorkshop.title;
                  // The leaf carries weekday/day/month but not the year, and a
                  // long series can cross into the next one.
                  const sessionYear = new Date(
                    session.startDateTime,
                  ).getFullYear();
                  const yearSuffix =
                    sessionYear === new Date().getFullYear()
                      ? ""
                      : ` · ${sessionYear}`;
                  const isLiveNow =
                    sessionPickerMode === "host" &&
                    !!sessionPickerWorkshop.currentSessionDate &&
                    new Date(sessionPickerWorkshop.currentSessionDate)
                      .toISOString()
                      .slice(0, 10) === session.dateString;
                  const busy =
                    startingSessionDate === session.dateString ||
                    enrollingSessionDate === session.dateString;

                  return (
                    <div
                      key={session.dateString}
                      className={cn(
                        "flex items-center gap-4 rounded-xl border p-3.5 transition-colors",
                        session.hasAccess
                          ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                          : session.isFull
                            ? "border-[#2a2a35] bg-[#1a1a22] opacity-60"
                            : "border-[#2a2a35] bg-[#1a1a22] hover:border-brand/40",
                      )}
                    >
                      {/* Calendar leaf. Tabular numerals so the day column
                          stays aligned down the list. */}
                      <div
                        className={cn(
                          "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border",
                          session.isToday
                            ? "border-brand/40 bg-brand/10"
                            : "border-[#2a2a35] bg-[#0e0e12]",
                        )}
                      >
                        <span
                          className={cn(
                            "text-[10px] font-semibold uppercase tracking-wider",
                            session.isToday ? "text-brand" : "text-[#6c6c80]",
                          )}
                        >
                          {leaf.weekday}
                        </span>
                        <span className="text-lg font-bold leading-none tabular-nums text-white">
                          {leaf.day}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-[#6c6c80]">
                          {leaf.month}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[15px] font-semibold text-white">
                            {title}
                          </p>
                          {session.isToday && (
                            <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                              Today
                            </span>
                          )}
                          {isLiveNow && (
                            <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                              Live
                            </span>
                          )}
                        </div>

                        <p className="mt-0.5 truncate text-[13px] text-[#9fa0b8]">
                          {sessionRange(
                            session.startDateTime,
                            session.endDateTime,
                            tz,
                          )}
                          {duration && (
                            <span className="text-[#6c6c80]"> · {duration}</span>
                          )}
                          {yearSuffix && (
                            <span className="text-[#6c6c80]">{yearSuffix}</span>
                          )}
                        </p>

                        {session.speakerName && (
                          <p className="mt-1 truncate text-[12px] text-[#6c6c80]">
                            Hosted by {session.speakerName}
                          </p>
                        )}

                        {/* A moved session shows a date the recurrence rule
                            never produced; the slot it still belongs to is what
                            the enrolment and join link use. */}
                        {session.rescheduledDate && (
                          <p className="mt-1 text-[12px] text-brand/80">
                            Moved from{" "}
                            {new Intl.DateTimeFormat("en-US", {
                              month: "short",
                              day: "numeric",
                              timeZone: "UTC",
                            }).format(new Date(session.date))}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {sessionPickerMode === "customer" && (
                          <span
                            className={cn(
                              "text-[13px] font-semibold",
                              isFree ? "text-[#9fa0b8]" : "text-brand",
                            )}
                          >
                            {sessionPriceLabel(isFree, price, currency)}
                          </span>
                        )}

                        {sessionPickerMode === "host" ? (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              handleStartHostSession(
                                sessionPickerWorkshop,
                                session.dateString,
                              )
                            }
                            className="bg-brand font-semibold text-brand-foreground hover:opacity-90"
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isLiveNow ? (
                              "Rejoin"
                            ) : (
                              "Start"
                            )}
                          </Button>
                        ) : session.hasAccess ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
                            <Check className="h-3 w-3" />
                            Enrolled
                          </span>
                        ) : session.isFull ? (
                          <span className="rounded-full bg-[#2a2a35] px-3 py-1 text-xs font-semibold text-[#9fa0b8]">
                            Full
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              if (isFree) {
                                handleFreeSessionEnrollment(
                                  sessionPickerWorkshop,
                                  session.dateString,
                                );
                              } else {
                                handlePaidSessionEnrollment(
                                  sessionPickerWorkshop,
                                  session.dateString,
                                );
                              }
                            }}
                            className="bg-brand font-semibold text-brand-foreground hover:opacity-90"
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isFree ? (
                              "Enroll"
                            ) : (
                              "Buy"
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}



// Workshop Card Component
function WorkshopCard({
  workshop,
  isCompleted,
  isFounder,
  onPaymentClick,
  onEnrollClick,
  onEditClick,
  onDeleteClick,
  onCopyUrl,
  onCopyAffiliateLink,
  onLearnMoreClick,
  onSessionPickerOpen,
  onFullEnrollmentFree,
  onFullEnrollmentPaid,
  onAnalyticsClick,
  onStartStreamClick,
  isEnrolling = false,
  isListView = true,
  memberAvatars,
  affiliateId,
}: {
  workshop: Workshop;
  isCompleted: boolean;
  isFounder: boolean;
  onPaymentClick: () => void;
  onEnrollClick: () => void;
  onEditClick: () => void;
  onDeleteClick: () => void;
  onCopyUrl: () => void;
  onCopyAffiliateLink: (hasPlan: boolean) => void;
  onLearnMoreClick: () => void;
  onSessionPickerOpen: () => void;
  onFullEnrollmentFree: () => void;
  onFullEnrollmentPaid: () => void;
  onAnalyticsClick: () => void;
  onStartStreamClick?: () => void;
  isEnrolling?: boolean;
  isListView?: boolean;
  memberAvatars?: string[];
  affiliateId?: string;
}) {
  // Same rule as the parent: the card's checkout link is handed to an
  // audience, so it carries the office's own domain, not the founder's host.
  const shareOrigin = useOrgShareOrigin();
  const [plan, setPlan] = useState<any>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const res = await getCombPlanForItem("workshop", workshop._id);
        if (res?.success && res?.plan && res?.plan.levels && res?.plan.levels.length > 0) {
          setPlan(res.plan);
        } else {
          setPlan(null);
        }
      } catch (err) {
        console.error("Error fetching workshop commission plan:", err);
        setPlan(null);
      } finally {
        setLoadingPlan(false);
      }
    };
    fetchPlan();
  }, [workshop._id]);
  const getMeetingUrlWithUserData = (meetingUrl: string): string => {
    const userData = getUserDataFromToken();
    if (userData.email) {
      const url = new URL(meetingUrl);
      url.searchParams.set("email", userData.email);
      if (userData.name) {
        url.searchParams.set("name", userData.name);
      }
      url.searchParams.set("autoJoin", "true");
      return url.toString();
    }
    return meetingUrl;
  };

  const cta = resolveWorkshopCta(workshop, !!isFounder);

  // "Registered" overstates a per-session purchase — it reads as "you hold the
  // series" when the buyer holds one night of it. Count what they actually own.
  const enrolledSessionCount = (workshop.enrolledSessions || []).length;
  const enrolledLabel =
    workshop.enrollmentType === "per_session" && enrolledSessionCount > 0
      ? `${enrolledSessionCount} session${enrolledSessionCount === 1 ? "" : "s"}`
      : "Registered";

  const handleWorkshopAction = () => {
    switch (cta) {
      case "start":
        onStartStreamClick?.();
        return;
      case "pick-session":
        onSessionPickerOpen();
        return;
      case "enroll-series-free":
        onFullEnrollmentFree();
        return;
      case "enroll-series-paid":
        onFullEnrollmentPaid();
        return;
      case "pay":
        onPaymentClick();
        return;
      case "enroll-free":
        onEnrollClick();
        return;
      case "join":
        window.open(`/webinar/${workshop._id}`, "_blank");
        return;
    }
  };

  // Using file-level getTimezoneAbbr utility

  /* ── What the NEXT session says ────────────────────────────────────────
   *
   * Discover sells the next session, not the template, so the card has to
   * read that session's own title / cover / hours when the founder gave it
   * any. An unedited session resolves to the series, which is every session
   * of every series nobody has customised.
   */
  const nextEdit = overrideForSessionDay(
    workshop,
    workshop.isRecurring ? workshop.nextSession?.dateString : undefined,
  );
  // Deliberately the SERIES title, not the next session's. The heading is how
  // the stream is recognised across Discover, search and share links, and a
  // per-session title is a subtitle for one night — letting it take the
  // heading renames the whole stream every time the next session rolls over.
  const cardTitle = workshop.title;
  const cardDescription = nextEdit?.description ?? workshop.description;
  const cardThumbnail = nextEdit?.thumbnail || workshop.thumbnail;
  const cardStartTime = nextEdit?.startTime || workshop.startTime;
  const cardEndTime = nextEdit?.endTime || workshop.endTime;
  const cardTimezone = nextEdit?.timezone || workshop.timezone;
  // The day it RUNS on — a moved session is attended on its new day, even
  // though enrolments and links stay filed under the original.
  const cardDateStr = nextEdit?.isRescheduled
    ? String(nextEdit.displayDate).slice(0, 10)
    : workshop.isRecurring && workshop.nextSession
      ? workshop.nextSession.dateString
      : workshop.date;

  const getDisplayDate = () => {
    const tzAbbr = getTimezoneAbbr(cardTimezone);
    const when = parseDateLocal(cardDateStr);
    return `Next: ${format(when, "EEE, MMM d")} at ${formatTime12Hour(cardStartTime)}${tzAbbr ? ` ${tzAbbr}` : ""}`;
  };

  const avatarsToRender = (workshop.registeredParticipantsCount || 0) > 0
    ? (memberAvatars && memberAvatars.length > 0 ? memberAvatars : MOCK_AVATARS)
    : [];

  const checkoutUrl = affiliateId
    ? `${shareOrigin}/checkout/workshop/${workshop._id}?ref=${affiliateId}`
    : `${shareOrigin}/checkout/workshop/${workshop._id}`;

  if (isListView) {
    return (
      <div className="relative bg-[#0e0e12] border border-[#2a2a35] rounded-[16px] p-5 hover:border-brand transition-all flex flex-col md:flex-row gap-6 shadow-lg group/card w-full">
        <div className="absolute top-4 right-4 flex items-center gap-1.5 z-20">
          {isFounder && (
            <>
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onAnalyticsClick(); }} className="h-8 w-8 rounded-lg bg-[#1a1a22]/80 hover:bg-[#252530] text-[#9fa0b8] hover:text-brand border border-[#2a2a35] transition-colors" title="View Analytics"><BarChart3 className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onEditClick(); }} className="h-8 w-8 rounded-lg bg-[#1a1a22]/80 hover:bg-[#252530] text-[#9fa0b8] hover:text-white border border-[#2a2a35] transition-colors" title="Edit"><Edit className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDeleteClick(); }} className="h-8 w-8 rounded-lg bg-[#1a1a22]/80 hover:bg-[#252530] text-red-400 hover:text-red-300 border border-red-950/20 transition-colors" title="Delete"><Trash2 className="h-4 w-4" /></Button>
            </>
          )}
        </div>
        <div className="relative w-full md:w-[320px] aspect-video md:aspect-[16/10] shrink-0 bg-[#1a1a22] rounded-xl overflow-hidden flex flex-col justify-between border border-[#1f1f27]">
          {!isCompleted && workshop.timezone && (
            <ThumbnailCountdown dateStr={cardDateStr} startTime={cardStartTime} endTime={cardEndTime} timezone={cardTimezone} />
          )}
          {cardThumbnail ? (
            <img src={cardThumbnail} alt={cardTitle} className="w-full flex-1 object-cover" />
          ) : (
            <div className="w-full flex-1 flex items-center justify-center"><Video className="h-10 w-10 text-[#9fa0b8]/40" /></div>
          )}
          {loadingPlan ? (
            <div className="bg-[#2a2a35]/40 text-white/40 text-[11px] font-medium py-1.5 text-center w-full animate-pulse select-none">
              Checking commission structure...
            </div>
          ) : (plan && workshop.price > 0) ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onCopyAffiliateLink(true);
              }}
              className="bg-brand hover:opacity-90 text-brand-foreground text-[11px] font-bold py-1.5 text-center w-full transition-colors cursor-pointer select-none"
              title="Find out how much you can earn"
            >
              Find out how much you can Earn
            </div>
          ) : (
            <div className="bg-[#5E5E5E] text-white/95 text-[11px] font-bold py-1.5 text-center w-full select-none">
              No commissions paid for this live stream
            </div>
          )}
        </div>
        <div className="flex-grow flex flex-col justify-between pr-2 min-w-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white text-xl font-bold tracking-tight line-clamp-1 leading-snug group-hover/card:text-brand transition-colors pr-24">{cardTitle}</h3>
            </div>
            {cardDescription && <p className="text-sm text-[#9fa0b8] mt-2 line-clamp-2 leading-relaxed">{stripHtml(cardDescription)}</p>}
            <div className="flex items-center gap-3 mt-4">
              {avatarsToRender.length > 0 && (
                <div className="flex items-center -space-x-2">
                  {avatarsToRender.slice(0, 8).map((src, i) => (
                    <div key={i} className="w-6 h-6 rounded-full border border-black overflow-hidden shrink-0"><img src={src} alt="Enrolled member" className="w-full h-full object-cover" /></div>
                  ))}
                </div>
              )}
              <span className="text-[12px] text-[#9fa0b8] font-medium">+ {(workshop.registeredParticipantsCount || 0).toLocaleString()} Members Enrolled</span>
            </div>
            <div className="flex items-center gap-2 text-brand font-semibold text-xs mt-4 uppercase tracking-wider"><Calendar className="h-4.5 w-4.5" /><span>{getDisplayDate()}</span></div>
            {isFounder && workshop.isRecurring && workshop.currentSessionDate && (
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-red-500/15 text-red-400 border border-red-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Live: {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", ...(workshop.timezone ? { timeZone: workshop.timezone } : {}) }).format(new Date(workshop.currentSessionDate))}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 pt-4 border-t border-[#1f1f27]">
            <div className="flex items-center gap-3">
              {workshop.isFree ? (
                <span className="text-xl font-extrabold text-green-400">FREE</span>
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-extrabold text-white">{workshop.currency === "INR" ? "₹" : "$"}{workshop.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {!workshop.isFree && workshop.price > 0 && <CompPlanBadge itemType="workshop" itemId={workshop._id} price={workshop.price} currency={workshop.currency === "INR" ? "₹" : "$"} isFounder={isFounder} />}
              {(workshop.isRegistered || workshop.hasPaid) && <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{enrolledLabel}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button onClick={(e) => { e.stopPropagation(); onLearnMoreClick(); }} className="flex items-center gap-1.5 border border-[#2a2a35] hover:border-[#3a3a48] text-white hover:text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all bg-[#0e0e12]/60 shrink-0 cursor-pointer"><BookOpen className="h-3.5 w-3.5 text-white/70" /><span>Learn More</span></button>
              <button onClick={(e) => { e.stopPropagation(); onCopyAffiliateLink(!!plan); }} className="flex items-center gap-1.5 border border-[#2a2a35] hover:border-[#3a3a48] text-white hover:text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all bg-[#0e0e12]/60 shrink-0 cursor-pointer"><Link2 className="h-3.5 w-3.5 text-white/70" /><span>Share Affiliate Link</span></button>
              {!isCompleted && (
                <Button onClick={(e) => { e.stopPropagation(); handleWorkshopAction(); }} disabled={isEnrolling} className="bg-brand hover:opacity-90 text-brand-foreground font-extrabold px-5 py-2 h-9 rounded-lg text-xs transition-all shadow-[0_2px_8px] shadow-brand/15 flex items-center justify-center">
                  {isEnrolling ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
                  {workshopCtaLabel(cta)}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-[#0e0e12] border border-[#2a2a35] rounded-[16px] overflow-hidden hover:border-brand transition-all flex flex-col h-full shadow-lg group/card w-full">
      <div className="absolute top-3 right-3 flex items-center gap-1 z-20">
        {isFounder && (
          <>
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onAnalyticsClick(); }} className="h-7 w-7 rounded bg-[#1a1a22]/80 hover:bg-[#252530] text-[#9fa0b8] hover:text-brand border border-[#2a2a35]" title="View Analytics"><BarChart3 className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onEditClick(); }} className="h-7 w-7 rounded bg-[#1a1a22]/80 hover:bg-[#252530] text-[#9fa0b8] hover:text-white border border-[#2a2a35]" title="Edit"><Edit className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDeleteClick(); }} className="h-7 w-7 rounded bg-[#1a1a22]/80 hover:bg-[#252530] text-red-400 hover:text-red-300 border border-red-950/20" title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
          </>
        )}
      </div>
      <div className="relative w-full aspect-video bg-[#1a1a22] overflow-hidden flex flex-col justify-between border-b border-[#1f1f27]">
        {!isCompleted && workshop.timezone && (
          <ThumbnailCountdown dateStr={cardDateStr} startTime={cardStartTime} endTime={cardEndTime} timezone={cardTimezone} />
        )}
        {cardThumbnail ? (
          <img src={cardThumbnail} alt={cardTitle} className="w-full flex-1 object-cover" />
        ) : (
          <div className="w-full flex-1 flex items-center justify-center"><Video className="h-10 w-10 text-[#9fa0b8]/40" /></div>
        )}
        {loadingPlan ? (
          <div className="bg-[#2a2a35]/40 text-white/40 text-[10px] font-medium py-1 text-center w-full animate-pulse select-none">
            Checking commission structure...
          </div>
        ) : (plan && workshop.price > 0) ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onCopyAffiliateLink(true);
            }}
            className="bg-brand hover:opacity-90 text-brand-foreground text-[10px] font-bold py-1 text-center w-full transition-colors cursor-pointer select-none"
            title="Find out how much you can earn"
          >
            Find out how much you can Earn
          </div>
        ) : (
          <div className="bg-[#5E5E5E] text-white/95 text-[10px] font-bold py-1 text-center w-full select-none">
            No commissions paid for this live stream
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col justify-between flex-grow space-y-3 bg-[#0e0e12]">
        <div>
          <h3 className="text-white text-base font-bold tracking-tight line-clamp-1 leading-snug group-hover/card:text-brand transition-colors">{cardTitle}</h3>
          {cardDescription && <p className="text-xs text-[#9fa0b8] mt-1.5 line-clamp-2 leading-relaxed">{stripHtml(cardDescription)}</p>}
          <div className="flex items-center gap-2 mt-3">
            {avatarsToRender.length > 0 && (
              <div className="flex items-center -space-x-1.5">
                {avatarsToRender.slice(0, 5).map((src, i) => (
                  <div key={i} className="w-5 h-5 rounded-full border border-black overflow-hidden shrink-0"><img src={src} alt="Enrolled member" className="w-full h-full object-cover" /></div>
                ))}
              </div>
            )}
            <span className="text-[10px] text-[#9fa0b8] font-medium">+ {(workshop.registeredParticipantsCount || 0).toLocaleString()} Enrolled</span>
          </div>
          <div className="flex items-center gap-1.5 text-brand font-semibold text-[10px] mt-3 uppercase tracking-wider"><Calendar className="h-3.5 w-3.5" /><span className="truncate">{getDisplayDate()}</span></div>
          {isFounder && workshop.isRecurring && workshop.currentSessionDate && (
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
                <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                Live: {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", ...(workshop.timezone ? { timeZone: workshop.timezone } : {}) }).format(new Date(workshop.currentSessionDate))}
              </span>
            </div>
          )}
        </div>
        <div className="space-y-3 pt-3 border-t border-[#1f1f27]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {workshop.isFree ? (
                <span className="text-base font-extrabold text-green-400">FREE</span>
              ) : (
                <span className="text-base font-extrabold text-white">{workshop.currency === "INR" ? "₹" : "$"}{workshop.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              )}
              {!workshop.isFree && workshop.price > 0 && <CompPlanBadge itemType="workshop" itemId={workshop._id} price={workshop.price} currency={workshop.currency === "INR" ? "₹" : "$"} isFounder={isFounder} />}
            </div>
            {(workshop.isRegistered || workshop.hasPaid) && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{enrolledLabel}</span>}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <button onClick={(e) => { e.stopPropagation(); onLearnMoreClick(); }} className="text-[#9fa0b8] hover:text-white font-semibold transition-colors cursor-pointer bg-transparent border-0 p-0">Learn More</button>
              <button onClick={(e) => { e.stopPropagation(); onCopyAffiliateLink(!!plan); }} className="text-[#9fa0b8] hover:text-brand font-semibold transition-colors cursor-pointer bg-transparent border-0 p-0 flex items-center gap-1"><Link2 className="h-3 w-3 shrink-0" /><span>Share Affiliate Link</span></button>
            </div>
            {!isCompleted && (
              <Button onClick={(e) => { e.stopPropagation(); handleWorkshopAction(); }} disabled={isEnrolling} className="bg-brand hover:opacity-90 text-brand-foreground font-extrabold w-full h-8 rounded-lg text-[11px] transition-all shadow-[0_2px_8px] shadow-brand/15 flex items-center justify-center mt-1">
                {isEnrolling ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
                {workshopCtaLabel(cta)}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Create / Edit Webinar Dialog
// ─────────────────────────────────────────────────────────────────────────────
function CreateWorkshopModal({
  isOpen,
  onClose,
  onSuccess,
  orgId,
  channels,
  members,
  editWorkshop,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
  channels: Channel[];
  /** Office roster, for the speakers picker. */
  members: TeamMember[];
  editWorkshop: Workshop | null;
}) {
  const defaultStartTime = getDefaultStartTime();

  // ── form state ────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    thumbnail: "",
    galleryImages: [] as string[],
    videoUrl: "",
    videoFile: "",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: defaultStartTime,
    endTime: getNextHour(defaultStartTime),
    timezone: "Asia/Kolkata",
    maxParticipants: 100,
    channelIds: [] as string[],
    speakerIds: [] as string[],
    isFree: true,
    price: 0,
    currency: "USD",
    gstInclusive: true,
    requireIosPayment: false,
    appleFeeInclusive: false,
    isRecurring: false,
    recurrenceType: "daily" as "daily" | "weekly" | "monthly",
    excludedDays: [] as number[],
    // Weekly and monthly are multi-select. The singular dayOfWeek/dayOfMonth
    // the API also carries are derived from these on the way out, so a client
    // that only understands the old shape still lands on a real session day.
    daysOfWeek: [1] as number[],
    daysOfMonth: [1] as number[],
    enrollmentType: "once" as "once" | "per_session",
    recurrenceEndDate: "",
    recordingMode: "automatic" as "manual" | "automatic",
    rating: 0,
    ratingCount: 0,
    aboutText: "",
    learningPoints: [] as string[],
    agenda: [] as WorkshopAgendaItem[],
    bonuses: [] as WorkshopBonus[],
    reviews: [] as WorkshopReview[],
    faqs: [] as WorkshopFaq[],
    requirements: [] as string[],
    whatsIncluded: [] as string[],
    hostRating: 0,
    hostStudents: "",
    hostWebinars: "",
    hostExperience: "",
  });

  /**
   * Per-session edits made in the schedule preview, keyed by the session's
   * canonical day (yyyy-mm-dd).
   *
   * In edit mode each one is written through as it's applied and this map
   * stays empty. While CREATING there is no workshop id to write against, so
   * the edits sit here and `flushSessionDrafts` sends them the moment the
   * workshop exists.
   */
  const [sessionDrafts, setSessionDrafts] = useState<SessionDraftMap>({});

  /**
   * Write one session's edits through `PUT /workshops/:id/sessions/:day`.
   *
   * Every editable key is sent on every call: a field the founder cleared has
   * to travel as an explicit `null` so the backend drops that override, where
   * omitting it would mean "leave it as it was". That also makes an empty
   * draft a full reset, which is what the preview's Reset button relies on.
   */
  const persistSessionEdit = async (
    workshopId: string,
    ymd: string,
    draft: SessionDraft,
  ): Promise<boolean> => {
    try {
      await updateWorkshopSession(workshopId, ymd, orgId, {
        title: draft.title?.trim() || null,
        description: draft.description?.trim() || null,
        startTime: draft.startTime || null,
        endTime: draft.endTime || null,
        rescheduledDate: draft.runsOn
          ? new Date(`${draft.runsOn}T00:00:00.000Z`).toISOString()
          : null,
      });
      toast.success(`Session on ${ymd} updated`);
      return true;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't update that session",
      );
      return false;
    }
  };

  /**
   * Apply every buffered session edit to a freshly created workshop.
   *
   * Sequential on purpose: these are upserts against one series and the
   * reschedule check reads the other sessions' overrides, so firing them in
   * parallel would race. A failure is reported but never blocks the create —
   * the workshop and its series already exist at this point.
   */
  const flushSessionDrafts = async (workshopId: string) => {
    const entries = Object.entries(sessionDrafts).filter(
      ([, draft]) => !isDraftEmpty(draft),
    );
    if (entries.length === 0) return;

    let failed = 0;
    for (const [ymd, draft] of entries) {
      try {
        await updateWorkshopSession(workshopId, ymd, orgId, {
          title: draft.title?.trim() || null,
          description: draft.description?.trim() || null,
          startTime: draft.startTime || null,
          endTime: draft.endTime || null,
          rescheduledDate: draft.runsOn
            ? new Date(`${draft.runsOn}T00:00:00.000Z`).toISOString()
            : null,
        });
      } catch {
        failed++;
      }
    }

    if (failed > 0) {
      toast.error(
        `${failed} of ${entries.length} session edits couldn't be saved — edit the stream to reapply them`,
      );
    } else {
      toast.success(
        `${entries.length} session${entries.length === 1 ? "" : "s"} customised`,
      );
    }
  };

  // Post-registration email. Same section + snapshot contract the product,
  // course and community forms use — the backend can't reach Network Mail, so
  // the rendered HTML travels with the workshop.
  const emailAlertsForm = useEmailAlerts();
  const founderAlertsForm = useFounderAlerts();

  // ── ui state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [generatingMeeting, setGeneratingMeeting] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  // Collapsible section state replacement & upload states
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  const [showPriceBreakdownModal, setShowPriceBreakdownModal] = useState(false);
  const [showIosPricingModal, setShowIosPricingModal] = useState(false);
  const [tempIosOption, setTempIosOption] = useState<"inclusive" | "exclusive" | "restrict">("exclusive");
  const [submitIsActive, setSubmitIsActive] = useState(true);

  // Helper to format currency with .00 and explicit currency name
  const formatCardPrice = (amount: number, currency: string = "USD"): string => {
    const symbol = currency === "INR" ? "\u20B9" : "$";
    return `${symbol}${amount.toFixed(2)} ${currency}`;
  };

  const getAffiliateInfo = () => {
    if (typeof window !== "undefined" && (window as any).__commissionPlanInfo) {
      return (window as any).__commissionPlanInfo;
    }
    return { enabled: false, levels: [], totalCommission: 0 };
  };

  const getDetailedPriceBreakdown = () => {
    const priceVal = formData.price || 0;
    const isInclusive = formData.gstInclusive;
    const affInfo = getAffiliateInfo();
    const affPercent = affInfo.enabled ? affInfo.totalCommission : 0;
    
    const basePrice = isInclusive ? priceVal / 1.18 : priceVal;
    
    const nonIosAppleFee = 0;
    const nonIosGst = basePrice * 0.18;
    const nonIosCustomerPays = isInclusive ? priceVal : basePrice + nonIosGst;
    
    const nonIosGovGst = nonIosGst;
    const nonIosAppleDist = 0;
    const nonIosPlatformFee = basePrice * 0.05;
    const nonIosAffiliateCut = basePrice * (affPercent / 100);
    const nonIosYouReceive = basePrice - nonIosPlatformFee - nonIosAffiliateCut;
    
    const iosAppleFee = basePrice * 0.30;
    const iosGst = (basePrice + iosAppleFee) * 0.18;
    const iosCustomerPays = basePrice + iosAppleFee + iosGst;
    
    const iosGovGst = iosGst;
    const iosAppleDist = iosAppleFee;
    const iosPlatformFee = basePrice * 0.05;
    const iosAffiliateCut = basePrice * (affPercent / 100);
    const iosYouReceive = basePrice - iosPlatformFee - iosAffiliateCut;

    return {
      basePrice,
      affPercent,
      nonIos: {
        appleFee: nonIosAppleFee,
        gst: nonIosGst,
        customerPays: nonIosCustomerPays,
        govGst: nonIosGovGst,
        appleDist: nonIosAppleDist,
        platformFee: nonIosPlatformFee,
        affiliateCut: nonIosAffiliateCut,
        youReceive: nonIosYouReceive
      },
      ios: {
        appleFee: iosAppleFee,
        gst: iosGst,
        customerPays: iosCustomerPays,
        govGst: iosGovGst,
        appleDist: iosAppleDist,
        platformFee: iosPlatformFee,
        affiliateCut: iosAffiliateCut,
        youReceive: iosYouReceive
      }
    };
  };

  const getPriceDetails = () => {
  const p = formData.price || 0;
    const currency = formData.currency === "INR" ? "\u20B9" : "$";
    let baseWeb = p;
    let gstWeb = 0;
    let totalWeb = p;
    if (p > 0) {
      if (formData.gstInclusive) {
        baseWeb = p / 1.18;
        gstWeb = p - baseWeb;
        totalWeb = p;
      } else {
        baseWeb = p;
        gstWeb = p * 0.18;
        totalWeb = p + gstWeb;
      }
    }
    let totalIos = totalWeb;
    let appleCut = 0;
    if (formData.requireIosPayment && p > 0) {
      if (formData.appleFeeInclusive) {
        totalIos = totalWeb;
        appleCut = totalWeb * 0.3;
      } else {
        totalIos = totalWeb / 0.7;
        appleCut = totalIos * 0.3;
      }
    }
    return { currency, baseWeb, gstWeb, totalWeb, totalIos, appleCut };
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentCount = formData.galleryImages?.length || 0;
    if (currentCount >= 3) {
      toast.error("You can upload a maximum of 3 gallery images");
      return;
    }

    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploadingGallery(true);
    try {
      const token = getToken();
      const fd = new FormData();
      fd.append("file", file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: fd,
        }
      );

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      upd({
        galleryImages: [...(formData.galleryImages || []), data.url],
      });
      toast.success("Gallery image uploaded successfully");
    } catch (error) {
      console.error("Gallery upload error:", error);
      toast.error("Failed to upload gallery image");
    } finally {
      setUploadingGallery(false);
      if (galleryInputRef.current) {
        galleryInputRef.current.value = "";
      }
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file (MP4 etc.)");
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      toast.error("Video must be less than 500MB");
      return;
    }

    setUploadingVideo(true);
    try {
      const token = getToken();
      const fd = new FormData();
      fd.append("file", file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: fd,
        }
      );

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      upd({ videoFile: data.url, videoUrl: "" });
      toast.success("Video uploaded successfully");
    } catch (error) {
      console.error("Video upload error:", error);
      toast.error("Failed to upload video");
    } finally {
      setUploadingVideo(false);
      if (videoFileInputRef.current) {
        videoFileInputRef.current.value = "";
      }
    }
  };

  const removeUploadedVideo = () => {
    upd({ videoFile: "" });
  };

  // ── populate edit data ────────────────────────────────────────────────────
  useEffect(() => {
    if (editWorkshop) {
      setFormData({
        title: editWorkshop.title,
        description: editWorkshop.description || "",
        thumbnail: editWorkshop.thumbnail || "",
        galleryImages: (editWorkshop as any).galleryImages || [],
        videoUrl: (editWorkshop as any).videoUrl || "",
        videoFile: (editWorkshop as any).videoFile || "",
        date: format(parseDateLocal(editWorkshop.date), "yyyy-MM-dd"),
        startTime: editWorkshop.startTime,
        endTime: editWorkshop.endTime,
        timezone: editWorkshop.timezone,
        maxParticipants: editWorkshop.maxParticipants || 100,
        channelIds: editWorkshop.channelIds.map((c) => c._id),
        speakerIds: (editWorkshop.speakers || []).map((sp) =>
          typeof sp === "string" ? sp : sp._id
        ),
        isFree: editWorkshop.isFree,
        price: editWorkshop.price || 0,
        currency: editWorkshop.currency || "USD",
        gstInclusive: (editWorkshop as any).gstInclusive !== false,
        requireIosPayment: (editWorkshop as any).requireIosPayment || false,
        appleFeeInclusive: (editWorkshop as any).appleFeeInclusive || false,
        isRecurring: editWorkshop.isRecurring || false,
        recurrenceType: editWorkshop.recurrencePattern?.type || "daily",
        excludedDays: editWorkshop.recurrencePattern?.excludedDays || [],
        // Multi-day wins when it's there; otherwise the singular field is the
        // one and only day, which is every series created before this existed.
        daysOfWeek: editWorkshop.recurrencePattern?.daysOfWeek?.length
          ? editWorkshop.recurrencePattern.daysOfWeek
          : [editWorkshop.recurrencePattern?.dayOfWeek ?? 1],
        daysOfMonth: editWorkshop.recurrencePattern?.daysOfMonth?.length
          ? editWorkshop.recurrencePattern.daysOfMonth
          : [editWorkshop.recurrencePattern?.dayOfMonth ?? 1],
        enrollmentType: editWorkshop.enrollmentType || "once",
        recurrenceEndDate: editWorkshop.recurrenceEndDate
          ? format(parseDateLocal(editWorkshop.recurrenceEndDate), "yyyy-MM-dd")
          : "",
        recordingMode: editWorkshop.recordingMode || "automatic",
        rating: editWorkshop.rating || 0,
        ratingCount: editWorkshop.ratingCount || 0,
        aboutText: editWorkshop.aboutText || "",
        learningPoints: editWorkshop.learningPoints || [],
        agenda: editWorkshop.agenda || [],
        bonuses: editWorkshop.bonuses || [],
        reviews: editWorkshop.reviews || [],
        faqs: editWorkshop.faqs || [],
        requirements: editWorkshop.requirements || [],
        whatsIncluded: editWorkshop.whatsIncluded || [],
        hostRating: editWorkshop.hostRating || 0,
        hostStudents: editWorkshop.hostStudents || "",
        hostWebinars: editWorkshop.hostWebinars || "",
        hostExperience: editWorkshop.hostExperience || "",
      });
      emailAlertsForm.hydrate(editWorkshop.emailAlerts);
      founderAlertsForm.hydrate((editWorkshop as any).founderAlerts);
      // Edit mode writes each session through as it's applied, so nothing
      // should be carried over from a previous create.
      setSessionDrafts({});
      setMeetingUrl(editWorkshop.meetingUrl || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editWorkshop]);

  // ── helpers ───────────────────────────────────────────────────────────────
  const upd = (patch: Partial<typeof formData>) =>
    setFormData((prev) => ({ ...prev, ...patch }));

  // A community counts as paid when it isn't flagged free AND carries a price.
  const isPaidChannel = (c?: { isFree?: boolean; price?: number }) =>
    !!c && !c.isFree && (c.price ?? 0) > 0;

  // Is there anything for the one-paid rule to bite on? Drives the standing
  // notice — no point warning about paid communities when none exist.
  const hasPaidChannel = channels.some(isPaidChannel);
  // The free set is everything "Select All" can reach, since a paid community
  // is an exclusive choice and never part of a bulk selection.
  const freeChannelIds = channels
    .filter((c) => !isPaidChannel(c))
    .map((c) => c._id);
  const allFreeSelected =
    freeChannelIds.length > 0 &&
    freeChannelIds.every((id) => formData.channelIds.includes(id)) &&
    formData.channelIds.length === freeChannelIds.length;

  /**
   * Linking rules (FE only — BE payloads from other clients still accepted):
   *
   *   • Free communities  — select as many as you like.
   *   • Paid communities  — at most ONE, and never alongside a free one.
   *
   * A paid selection is therefore exclusive. Rather than refusing the click,
   * we swap: picking a second paid community deselects the first, and mixing
   * paid with free drops whichever side conflicts. Blocking with an error
   * made the user go and manually untick the old one first, which is the
   * same outcome with extra steps.
   *
   * A toast still fires when something was auto-removed, so the change is
   * never silent — it just reports what happened instead of preventing it.
   */
  const handleChannelToggle = (channelId: string) => {
    if (formData.channelIds.includes(channelId)) {
      upd({ channelIds: formData.channelIds.filter((id) => id !== channelId) });
      return;
    }

    const toggling = channels.find((c) => c._id === channelId);
    const selected = formData.channelIds
      .map((id) => channels.find((c) => c._id === id))
      .filter(Boolean) as typeof channels;

    if (isPaidChannel(toggling)) {
      // Paid is exclusive — it replaces everything currently selected.
      if (selected.length > 0) {
        const paidBefore = selected.find(isPaidChannel);
        toast.info(
          paidBefore
            ? `Switched to "${toggling!.title}" — only one paid community can be linked.`
            : `Unlinked the free ${selected.length === 1 ? "community" : "communities"} — a paid community can't be combined with free ones.`,
        );
      }
      upd({ channelIds: [channelId] });
      return;
    }

    // Free: unlimited among themselves, but can't sit next to a paid one.
    const paidSelected = selected.find(isPaidChannel);
    if (paidSelected) {
      toast.info(
        `Unlinked "${paidSelected.title}" — a paid community can't be combined with free ones.`,
      );
      upd({ channelIds: [channelId] });
      return;
    }

    upd({ channelIds: [...formData.channelIds, channelId] });
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be less than 10MB"); return; }
    setUploadingThumbnail(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd }
      );
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      upd({ thumbnail: data.url });
      toast.success("Cover image uploaded!");
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setUploadingThumbnail(false);
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
    }
  };

  const handleGenerateMeeting = async (workshopId: string) => {
    setGeneratingMeeting(true);
    try {
      const result = await generateWorkshopMeeting(workshopId, orgId);
      if (result.success) { setMeetingUrl(result.meeting.joinLink); toast.success("Meeting link generated!"); }
    } catch { toast.error("Failed to generate meeting link"); }
    finally { setGeneratingMeeting(false); }
  };
  const buildPayload = (isActive: boolean, iosOverride?: { requireIosPayment: boolean; appleFeeInclusive: boolean }) => {
    // Weekly and monthly send BOTH shapes: the multi-day array, and the
    // singular field set to the earliest selected day. Anything that only
    // knows the old shape then still resolves to a genuine session day
    // instead of to nothing.
    const earliest = (days: number[], fallback: number) =>
      days.length ? Math.min(...days) : fallback;

    const recurrencePattern = formData.isRecurring
      ? {
          type: formData.recurrenceType,
          ...(formData.recurrenceType === "daily" && { excludedDays: formData.excludedDays }),
          ...(formData.recurrenceType === "weekly" && {
            daysOfWeek: [...formData.daysOfWeek].sort((a, b) => a - b),
            dayOfWeek: earliest(formData.daysOfWeek, 1),
          }),
          ...(formData.recurrenceType === "monthly" && {
            daysOfMonth: [...formData.daysOfMonth].sort((a, b) => a - b),
            dayOfMonth: earliest(formData.daysOfMonth, 1),
          }),
        }
      : undefined;

    // Every repeatable list is stripped of blank and whitespace-only rows
    // before it goes on the wire.
    const nonEmptyLearningPoints = filterNonEmptyStrings(formData.learningPoints);
    const nonEmptyRequirements = filterNonEmptyStrings(formData.requirements);
    const nonEmptyWhatsIncluded = filterNonEmptyStrings(formData.whatsIncluded);
    const nonEmptyFaqs = formData.faqs.filter(
      (f) => f.question.trim() && f.answer.trim(),
    );
    const nonEmptyAgenda = formData.agenda
      .filter((a) => a.title.trim())
      .map((a) => ({
        ...a,
        topics: a.topics ? filterNonEmptyStrings(a.topics) : undefined,
      }));

    return {
      title: formData.title,
      description: formData.description,
      thumbnail: formData.thumbnail,
      galleryImages: formData.galleryImages,
      videoUrl: formData.videoUrl || undefined,
      videoFile: formData.videoFile || undefined,
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      timezone: formData.timezone,
      maxParticipants: formData.maxParticipants,
      channelIds: formData.channelIds,
      speakerIds: formData.speakerIds,
      isFree: formData.isFree,
      price: formData.isFree ? 0 : formData.price,
      currency: formData.currency,
      isActive,
      isRecurring: formData.isRecurring,
      recurrencePattern,
      recurrenceStartDate: formData.isRecurring ? formData.date : undefined,
      recurrenceEndDate:
        formData.isRecurring && formData.recurrenceEndDate
          ? formData.recurrenceEndDate
          : undefined,
      enrollmentType: formData.isRecurring ? formData.enrollmentType : undefined,
      recordingMode: formData.recordingMode,
      rating: formData.rating || undefined,
      ratingCount: formData.ratingCount || undefined,
      aboutText: formData.aboutText || undefined,
      // Blank rows left behind in the editor are dropped here rather than sent
      // and stored — they pad the payload and render as empty bullets on the
      // sales page.
      learningPoints: nonEmptyLearningPoints.length > 0 ? nonEmptyLearningPoints : undefined,
      agenda: nonEmptyAgenda.length > 0 ? nonEmptyAgenda : undefined,
      bonuses: formData.bonuses.filter(b => b.title.trim()).length > 0 ? formData.bonuses.filter(b => b.title.trim()) : undefined,
      reviews: formData.reviews.filter(r => r.reviewerName.trim() && r.text.trim()).length > 0 ? formData.reviews.filter(r => r.reviewerName.trim() && r.text.trim()) : undefined,
      faqs: nonEmptyFaqs.length > 0 ? nonEmptyFaqs : undefined,
      requirements: nonEmptyRequirements.length > 0 ? nonEmptyRequirements : undefined,
      whatsIncluded: nonEmptyWhatsIncluded.length > 0 ? nonEmptyWhatsIncluded : undefined,
      hostRating: formData.hostRating || undefined,
      hostStudents: formData.hostStudents || undefined,
      hostWebinars: formData.hostWebinars || undefined,
      hostExperience: formData.hostExperience || undefined,
      gstInclusive: formData.gstInclusive,
      requireIosPayment: iosOverride ? iosOverride.requireIosPayment : formData.requireIosPayment,
      appleFeeInclusive: iosOverride ? iosOverride.appleFeeInclusive : formData.appleFeeInclusive,
      emailAlerts: emailAlertsForm.buildPayload(),
      founderAlerts: founderAlertsForm.buildPayload(),
    };
  };

  const handleSubmit = async (isActive: boolean, iosOverride?: { requireIosPayment: boolean; appleFeeInclusive: boolean }) => {
    if (!formData.title.trim()) { toast.error("Live stream title is required"); return; }
    if (formData.channelIds.length === 0) { toast.error("Please select at least one channel"); return; }
    if (formData.isRecurring && !formData.recurrenceEndDate) {
      toast.error("Sessions end date is required for recurring live streams");
      return;
    }
    if (
      formData.isRecurring &&
      formData.recurrenceEndDate &&
      formData.date &&
      formData.recurrenceEndDate <= formData.date
    ) {
      toast.error("Sessions end date must be after the start date");
      return;
    }
    // Saving with alerts on but no resolved HTML would store an empty template
    // and silently send nothing on registration.
    const emailAlertsMsg = emailAlertsForm.validate();
    if (emailAlertsMsg) {
      toast.error(emailAlertsMsg);
      return;
    }

    if (isActive) setLoading(true); else setSavingDraft(true);
    setError("");

    // The share popup, for a stream that was just created or first published.
    const announce = (workshopId: string, draft: boolean) => {
      const tz = getTimezoneAbbr(formData.timezone);
      showSellablePublished({
        kind: "live-stream",
        title: formData.title.trim(),
        image: formData.thumbnail || null,
        url: `/webinar/${workshopId}`,
        price: formatSellablePrice(formData.isFree ? 0 : formData.price, formData.currency),
        facts: [
          formData.date &&
            `${format(parseDateLocal(formData.date), "EEE, MMM d")} · ${formatTime12Hour(formData.startTime)}${tz ? ` ${tz}` : ""}`,
          formData.isRecurring && `Repeats ${formData.recurrenceType}`,
        ],
        draft,
      });
    };

    try {
      const payload = buildPayload(isActive, iosOverride);
      if (editWorkshop) {
        await updateWorkshopApi(editWorkshop._id, orgId, payload);
        // Publishing a stream that was first saved as draft: create is
        // the only other path that generates the Meet, so without this
        // the row stays "Draft" (no meetingUrl) even after publishing.
        // Must run after the update — generate-meeting requires the
        // workshop to be active.
        if (isActive && !meetingUrl) await handleGenerateMeeting(editWorkshop._id);
        if (!formData.isFree && formData.price > 0) await saveCommissionPlan(editWorkshop._id);
        if (isActive && !editWorkshop.isActive) announce(editWorkshop._id, false);
        else toast.success("Live stream updated!");
      } else {
        const result = await createWorkshop(orgId, payload);
        if (result.workshop._id) {
          if (isActive) await handleGenerateMeeting(result.workshop._id);
          if (!formData.isFree && formData.price > 0) await saveCommissionPlan(result.workshop._id);
          // The per-session edits made in the schedule preview had nowhere to
          // go until now — the workshop they key off didn't exist yet.
          if (formData.isRecurring) await flushSessionDrafts(result.workshop._id);
          announce(result.workshop._id, !isActive);
        } else {
          toast.success(isActive ? "Live stream published!" : "Saved as draft!");
        }
      }
      emailAlertsForm.noteTemplateUse();
      onSuccess();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save live stream");
    } finally {
      setLoading(false);
      setSavingDraft(false);
    }
  };

  const handleSaveClick = (isActive: boolean) => {
    if (!formData.title.trim()) { toast.error("Live stream title is required"); return; }
    if (formData.channelIds.length === 0) { toast.error("Please select at least one channel"); return; }
    if (formData.isRecurring && !formData.recurrenceEndDate) {
      toast.error("Sessions end date is required for recurring live streams");
      return;
    }
    if (
      formData.isRecurring &&
      formData.recurrenceEndDate &&
      formData.date &&
      formData.recurrenceEndDate <= formData.date
    ) {
      toast.error("Sessions end date must be after the start date");
      return;
    }
    // Saving with alerts on but no resolved HTML would store an empty template
    // and silently send nothing on registration.
    const emailAlertsMsg = emailAlertsForm.validate();
    if (emailAlertsMsg) {
      toast.error(emailAlertsMsg);
      return;
    }

    if (formData.isFree) {
      handleSubmit(isActive);
    } else {
      setSubmitIsActive(isActive);
      // Determine selection option for paid
      if (!formData.requireIosPayment) {
        setTempIosOption("restrict");
      } else if (formData.appleFeeInclusive) {
        setTempIosOption("inclusive");
      } else {
        setTempIosOption("exclusive");
      }
      setShowIosPricingModal(true);
    }
  };

  const handleConfirmIosPricing = async () => {
    setShowIosPricingModal(false);
    const requireIos = tempIosOption !== "restrict";
    const inclusive = tempIosOption === "inclusive";

    upd({
      requireIosPayment: requireIos,
      appleFeeInclusive: inclusive,
    });

    const iosOverride = { requireIosPayment: requireIos, appleFeeInclusive: inclusive };
    await handleSubmit(submitIsActive, iosOverride);
  };

  const handleClose = () => {
    const rst = getDefaultStartTime();
    setFormData({
      title: "", description: "", thumbnail: "",
      galleryImages: [],
      videoUrl: "",
      videoFile: "",
      date: format(new Date(), "yyyy-MM-dd"),
      startTime: rst, endTime: getNextHour(rst),
      timezone: "Asia/Kolkata", maxParticipants: 100,
      channelIds: [], isFree: true, price: 0, currency: "USD",
      gstInclusive: true, requireIosPayment: false, appleFeeInclusive: false,
      isRecurring: false, recurrenceType: "daily", excludedDays: [],
      daysOfWeek: [1], daysOfMonth: [1], enrollmentType: "once",
      recurrenceEndDate: "",
      recordingMode: "automatic",
      rating: 0, ratingCount: 0, aboutText: "", learningPoints: [],
      agenda: [], bonuses: [], reviews: [], faqs: [],
      requirements: [], whatsIncluded: [],
      hostRating: 0, hostStudents: "", hostWebinars: "", hostExperience: "",
    });
    emailAlertsForm.reset();
    founderAlertsForm.reset();
    setSessionDrafts({});
    setMeetingUrl(""); setError("");
    onClose();
  };

  if (!isOpen) return null;

  // ── Section Header ─────────────────────────────────────────────────────────
  const SectionHeader = ({
    id, label, icon,
  }: { id: string; label: string; icon: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between py-3 px-0 group"
    >
      <div className="flex items-center gap-2">
        <span className="text-[#9fa0b8]">{icon}</span>
        <span className="text-sm font-semibold text-white">{label}</span>
      </div>
      <ChevronDown
        className={cn(
          "h-4 w-4 text-[#9fa0b8] transition-transform duration-200",
          openSections[id] ? "rotate-180" : ""
        )}
      />
    </button>
  );

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-[620px] max-h-[92vh] flex flex-col bg-[#111114] border border-[#2a2a35] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">

        {/* ── Sticky Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a35] shrink-0">
          <h2 className="text-base font-semibold text-white">
            {editWorkshop ? "Edit Live Stream" : "Create Live Stream"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable Body ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6" style={{ scrollbarWidth: "none" }}>
          <input ref={thumbnailInputRef} type="file" accept="image/*" onChange={handleThumbnailUpload} className="hidden" />
          <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleGalleryUpload} className="hidden" disabled={uploadingGallery} />
          <input ref={videoFileInputRef} type="file" accept="video/mp4" onChange={handleVideoUpload} className="hidden" disabled={uploadingVideo} />

          {/* ════ BASIC INFORMATION ════ */}
          <div className="space-y-4 pb-6 border-b border-[#2a2a35]/40">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#9fa0b8]">
                Live Stream Title <span className="text-brand font-bold">*</span>
              </label>
              <input
                value={formData.title}
                onChange={(e) => upd({ title: e.target.value })}
                placeholder="e.g. Growth Hacking 101"
                maxLength={200}
                className="w-full bg-[#131316] border border-[#2a2a35] text-white text-sm rounded-xl px-3 py-2.5 outline-none focus:border-brand/60 transition-colors placeholder:text-[#4a4a5a]"
              />
            </div>

            {/* Description Editor */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#9fa0b8]">Description</label>
              <DescriptionEditor
                value={formData.description}
                onChange={(val) => upd({ description: val })}
                placeholder="Enter a brief summary of what this live stream is about..."
              />
            </div>

            {/* Cover Image */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-[#9fa0b8]">Cover Image</label>
              
              {formData.thumbnail ? (
                <div className="relative w-full h-48 rounded-xl overflow-hidden border border-[#2a2a35] bg-[#131316] flex items-center justify-center group">
                  <div
                    className="absolute inset-0 bg-cover bg-center filter blur-2xl opacity-30 scale-105 select-none pointer-events-none"
                    style={{ backgroundImage: `url(${formData.thumbnail})` }}
                  />
                  <div className="absolute inset-0 bg-black/20 z-0" />
                  <img
                    src={formData.thumbnail}
                    alt="Cover"
                    className="relative max-w-[90%] max-h-[85%] object-contain z-10 rounded-lg shadow-2xl border border-white/5"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2.5 z-20">
                    <button
                      type="button"
                      onClick={() => thumbnailInputRef.current?.click()}
                      disabled={uploadingThumbnail}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-white text-black hover:bg-white/90 px-3.5 py-2 rounded-xl transition-colors shadow-lg"
                    >
                      {uploadingThumbnail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Change
                    </button>
                    <button
                      type="button"
                      onClick={() => upd({ thumbnail: "" })}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-xl transition-colors shadow-lg"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => thumbnailInputRef.current?.click()}
                  disabled={uploadingThumbnail}
                  className="w-full border border-dashed border-[#2a2a35] rounded-xl flex items-center hover:border-brand/50 transition-colors cursor-pointer bg-[#131316] hover:bg-[#131316]/80"
                >
                  {uploadingThumbnail ? (
                    <div className="w-full py-8 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 p-5 w-full">
                      <div className="w-12 h-12 rounded-xl bg-[#131316] flex items-center justify-center border border-[#2a2a35] shrink-0">
                        <Image className="w-5 h-5 text-[#9fa0b8]" />
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-semibold text-white block">Upload cover image</span>
                        <p className="text-xs text-[#6b6b7b] mt-0.5">
                          Images should be horizontal, at least 1280&times;720px. PNG or JPG, up to 5mb
                        </p>
                      </div>
                    </div>
                  )}
                </button>
              )}

              {/* 3 Gallery slots below cover image */}
              <div className="grid grid-cols-3 gap-3 mt-3">
                {Array.from({ length: 3 }).map((_, index) => {
                  const imgUrl = formData.galleryImages?.[index];
                  return (
                    <div key={index} className="aspect-video w-full">
                      {imgUrl ? (
                        <div className="relative w-full h-full rounded-xl overflow-hidden border border-[#2a2a35] bg-[#131316]">
                          <img src={imgUrl} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => upd({
                              galleryImages: formData.galleryImages.filter((_, i) => i !== index)
                            })}
                            className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            galleryInputRef.current?.click();
                          }}
                          className="border border-dashed border-[#2a2a35] rounded-xl w-full h-full flex flex-col items-center justify-center hover:border-brand/50 transition-colors cursor-pointer bg-[#131316]/60 hover:bg-[#131316]/80"
                        >
                          {uploadingGallery && index === (formData.galleryImages?.length || 0) ? (
                            <div className="w-5 h-5 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                          ) : (
                            <Plus className="w-5 h-5 text-[#9fa0b8]" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Video Upload Section */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-semibold text-[#9fa0b8] uppercase tracking-wide">Upload Video</label>
              
              {/* YouTube Link */}
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-[#9fa0b8]/60">
                  <Play className="w-4 h-4" />
                </span>
                <input
                  value={formData.videoUrl}
                  onChange={(e) => upd({ videoUrl: e.target.value, videoFile: "" })}
                  placeholder="Paste YouTube link..."
                  className="bg-[#131316] border border-[#2a2a35] text-white pl-10 h-11 text-sm rounded-xl focus:border-brand/60 focus:outline-none w-full transition-colors placeholder:text-[#4a4a5a]"
                />
              </div>

              {formData.videoUrl && (() => {
                const getEmbed = (url: string) => {
                  if (url.includes("youtu.be/")) {
                    const parts = url.split("youtu.be/");
                    if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
                  } else if (url.includes("youtube.com/watch?v=")) {
                    const parts = url.split("v=");
                    if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("&")[0]}`;
                  } else if (url.includes("youtube.com/embed/")) {
                    const parts = url.split("embed/");
                    if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
                  }
                  return "";
                };
                const embedUrl = getEmbed(formData.videoUrl);
                if (!embedUrl) return null;
                return (
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-[#2a2a35] bg-black">
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  </div>
                );
              })()}

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-[#2a2a35]/40"></div>
                <span className="flex-shrink mx-4 text-xs font-semibold text-[#6b6b7b]">OR</span>
                <div className="flex-grow border-t border-[#2a2a35]/40"></div>
              </div>

              {/* MP4 Video Upload Box */}
              <div>
                {formData.videoFile ? (
                  <div className="border border-green-500/30 bg-green-500/5 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <Check className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Video uploaded</p>
                        <p className="text-xs text-green-400">Ready to save</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeUploadedVideo}
                      className="text-[#9fa0b8] hover:text-red-400 transition-colors p-1.5 rounded-lg border border-[#2a2a35] hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : uploadingVideo ? (
                  <div className="border border-[#2a2a35] rounded-xl p-5 flex flex-col items-center justify-center gap-2 bg-[#13131a]/40">
                    <Loader2 className="w-6 h-6 text-brand animate-spin" />
                    <span className="text-xs text-[#9fa0b8]">Uploading video...</span>
                  </div>
                ) : (
                  <div
                    onClick={() => videoFileInputRef.current?.click()}
                    className="border border-dashed border-[#2a2a35] hover:border-brand/50 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer bg-[#131316]/60 hover:bg-[#131316]/80 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#131316] flex items-center justify-center border border-[#2a2a35]">
                      <Upload className="w-4 h-4 text-[#9fa0b8]" />
                    </div>
                    <span className="text-sm font-semibold text-white">Upload MP4 video</span>
                    <p className="text-xs text-[#6b6b7b]">Max 500MB &bull; .mp4 format</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ════ SCHEDULE ════ */}
          <div className="space-y-4 pb-6 border-b border-[#2a2a35]/40">
            {/* Timezone */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#9fa0b8]">Timezone</label>
              <TimezoneDropdown
                value={formData.timezone}
                onChange={(val) => upd({ timezone: val })}
                options={TIMEZONES}
              />
            </div>

            {/* Date / Start / End */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#9fa0b8]">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => {
                    const v = e.target.value;
                    const today = format(new Date(), "yyyy-MM-dd");
                    if (v === today && isTimePast(formData.startTime, v)) {
                      const h = Math.min(new Date().getHours() + 1, 23);
                      const st = h.toString().padStart(2, "0") + ":00";
                      upd({ date: v, startTime: st, endTime: getNextHour(st) });
                    } else {
                      upd({ date: v });
                    }
                  }}
                  min={format(new Date(), "yyyy-MM-dd")}
                  className="w-full bg-[#131316] border border-[#2a2a35] text-white text-sm rounded-xl px-3 py-2.5 outline-none focus:border-brand/60 transition-colors [&::-webkit-calendar-picker-indicator]:invert"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#9fa0b8]">Start Time</label>
                <TimeSelector
                  value={formData.startTime}
                  onChange={(v) => upd({ startTime: v, endTime: getNextHour(v) })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#9fa0b8]">End Time</label>
                <TimeSelector
                  value={formData.endTime}
                  relativeTo={formData.startTime}
                  onChange={(v) => upd({ endTime: v })}
                />
              </div>
            </div>

            {/* Recurring toggle */}
            <div className="flex items-center justify-between bg-[#131316] rounded-xl px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-white">Make this recurring</p>
                <p className="text-xs text-[#9fa0b8]">Schedule repeated sessions</p>
              </div>
              <Switch checked={formData.isRecurring} onCheckedChange={(v) => upd({ isRecurring: v })} />
            </div>

            {/* Recurring options */}
            {formData.isRecurring && (
              <div className="space-y-3">
                <label className="text-xs font-semibold text-[#9fa0b8]">Repeat Pattern</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Daily", "Weekly", "Monthly"] as const).map((opt) => {
                    const val = opt.toLowerCase() as "daily" | "weekly" | "monthly";
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => upd({ recurrenceType: val })}
                        className={cn(
                          "py-2 rounded-xl text-sm font-medium border transition-all",
                          formData.recurrenceType === val
                            ? "bg-brand/10 border-brand text-brand"
                            : "bg-[#131316] border-[#2a2a35] text-white hover:border-[#3a3a45]"
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {/* Daily: skip days */}
                {formData.recurrenceType === "daily" && (
                  <div className="space-y-2">
                    <label className="text-xs text-[#9fa0b8]">Skip these days</label>
                    <div className="flex gap-2 flex-wrap">
                      {DAYS.map((d, i) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() =>
                            upd({
                              excludedDays: formData.excludedDays.includes(i)
                                ? formData.excludedDays.filter((x) => x !== i)
                                : [...formData.excludedDays, i],
                            })
                          }
                          className={cn(
                            "w-10 h-10 rounded-xl text-xs font-medium border transition-all",
                            formData.excludedDays.includes(i)
                              ? "bg-brand/10 border-brand text-brand"
                              : "bg-[#131316] border-[#2a2a35] text-white"
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    {formData.date && (
                      <p className="text-xs text-[#9fa0b8] flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        Every day{formData.excludedDays.length > 0 && `, starting ${format(new Date(formData.date), "MMM d, yyyy")}`}
                      </p>
                    )}
                  </div>
                )}

                {/* Weekly: one or more days of the week */}
                {formData.recurrenceType === "weekly" && (
                  <div className="space-y-2">
                    <label className="text-xs text-[#9fa0b8]">
                      Repeats every — pick one or more days
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {DAYS.map((d, i) => {
                        const selected = formData.daysOfWeek.includes(i);
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() =>
                              upd({
                                // Deselecting the last remaining day would
                                // leave a rule that produces no sessions at
                                // all, so the final day can't be turned off.
                                daysOfWeek: selected
                                  ? formData.daysOfWeek.length > 1
                                    ? formData.daysOfWeek.filter((x) => x !== i)
                                    : formData.daysOfWeek
                                  : [...formData.daysOfWeek, i].sort((a, b) => a - b),
                              })
                            }
                            className={cn(
                              "w-10 h-10 rounded-xl text-xs font-medium border transition-all",
                              selected
                                ? "bg-brand/10 border-brand text-brand"
                                : "bg-[#131316] border-[#2a2a35] text-white hover:border-[#3a3a45]"
                            )}
                          >
                            {d}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-[#9fa0b8] flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      {describePattern({
                        type: "weekly",
                        daysOfWeek: formData.daysOfWeek,
                      })}
                    </p>
                  </div>
                )}

                {/* Monthly: one or more dates in the month */}
                {formData.recurrenceType === "monthly" && (
                  <div className="space-y-2">
                    <label className="text-xs text-[#9fa0b8]">
                      On these days of the month
                    </label>
                    <div className="grid grid-cols-7 gap-1.5">
                      {Array.from({ length: 31 }, (_, idx) => idx + 1).map((d) => {
                        const selected = formData.daysOfMonth.includes(d);
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() =>
                              upd({
                                daysOfMonth: selected
                                  ? formData.daysOfMonth.length > 1
                                    ? formData.daysOfMonth.filter((x) => x !== d)
                                    : formData.daysOfMonth
                                  : [...formData.daysOfMonth, d].sort((a, b) => a - b),
                              })
                            }
                            className={cn(
                              "h-9 rounded-lg text-xs font-medium border transition-all",
                              selected
                                ? "bg-brand/10 border-brand text-brand"
                                : "bg-[#131316] border-[#2a2a35] text-white hover:border-[#3a3a45]"
                            )}
                          >
                            {d}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-[#9fa0b8] flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      {formData.daysOfMonth.some((d) => d > 28)
                        ? "Days past the 28th fall back to the last day of shorter months."
                        : describePattern({
                            type: "monthly",
                            daysOfMonth: formData.daysOfMonth,
                          })}
                    </p>
                  </div>
                )}

                {/* Sessions End Date — required for every recurring
                    workshop. For per_session it bounds the picker so
                    customers can only enrol within the range. For
                    enrol-once it caps the series so customers know when
                    the last session runs and access can lapse cleanly. */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#9fa0b8]">
                    Sessions End Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.recurrenceEndDate || ""}
                    onChange={(e) => upd({ recurrenceEndDate: e.target.value })}
                    min={formData.date || format(new Date(), "yyyy-MM-dd")}
                    className="w-full bg-[#131316] border border-[#2a2a35] text-white text-sm rounded-xl px-3 py-2.5 outline-none focus:border-brand/60 transition-colors [&::-webkit-calendar-picker-indicator]:invert"
                  />
                  <p className="text-[11px] text-[#9fa0b8] flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    The series stops after this date. No sessions run past it.
                  </p>
                </div>

                {/* Every session the rule above produces, each editable on its
                    own. Sessions aren't stored rows — this list is derived
                    from the form, and an edit is written as a per-session
                    override against the canonical day. */}
                <SessionScheduleEditor
                  pattern={{
                    type: formData.recurrenceType,
                    excludedDays: formData.excludedDays,
                    daysOfWeek: formData.daysOfWeek,
                    daysOfMonth: formData.daysOfMonth,
                  }}
                  startDate={formData.date}
                  endDate={formData.recurrenceEndDate}
                  seriesTitle={formData.title || "Untitled live stream"}
                  seriesDescription={formData.description}
                  startTime={formData.startTime}
                  endTime={formData.endTime}
                  workshopId={editWorkshop?._id || null}
                  drafts={sessionDrafts}
                  onDraftsChange={setSessionDrafts}
                  // Only in edit mode: while creating there is no workshop to
                  // write against, so drafts are held and flushed after create.
                  onSaveSession={
                    editWorkshop
                      ? (ymd, draft) => persistSessionEdit(editWorkshop._id, ymd, draft)
                      : undefined
                  }
                />
              </div>
            )}
          </div>

          {/* ════ AUDIENCE ════ */}
          <div className="space-y-4 pb-6 border-b border-[#2a2a35]/40">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#9fa0b8]">
                  Select Communities <span className="text-red-400">*</span>
                </label>
                {channels.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      // "Everything selectable" is the free set, not every
                      // channel — a paid one can never be part of a bulk
                      // selection under the one-paid rule, so testing against
                      // all channels would leave this stuck on "Select All".
                      if (formData.channelIds.length > 0 && allFreeSelected) {
                        upd({ channelIds: [] });
                        return;
                      }
                      // Bulk-select honours the same rule as the individual
                      // toggles: only one paid community may be linked, and a
                      // paid one can't be combined with free ones. "Select
                      // all" therefore means all the FREE communities — a paid
                      // one is an exclusive choice the founder makes on its
                      // own, so it can't be part of a bulk selection.
                      const freeIds = channels
                        .filter((c) => c.isFree || (c.price ?? 0) === 0)
                        .map((c) => c._id);
                      const paidCount = channels.length - freeIds.length;
                      upd({ channelIds: freeIds });
                      if (freeIds.length === 0) {
                        toast.info(
                          "Only one paid community can be selected, so paid communities have to be picked individually.",
                        );
                      } else if (paidCount > 0) {
                        toast.info(
                          `Selected all free communities. Only one paid community can be selected, and it can't be combined with free ones.`,
                        );
                      }
                    }}
                    className="text-xs font-semibold text-brand hover:text-brand/80 transition-colors"
                  >
                    {formData.channelIds.length > 0 && allFreeSelected
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                )}
              </div>

              {/* Standing rule, shown before the founder clicks anything —
                  the toasts only fire after a swap has already happened, so
                  without this the constraint is invisible up front. Only
                  rendered when there IS a paid community to conflict with. */}
              {hasPaidChannel && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-brand/[0.06] border border-brand/25">
                  <AlertCircle className="h-3.5 w-3.5 text-brand shrink-0 mt-[1px]" />
                  <p className="text-[11px] leading-relaxed text-[#d8d9e3]">
                    <span className="font-semibold text-brand">
                      Only one paid community can be selected
                    </span>{" "}
                    — and it can&apos;t be combined with free ones. Picking a
                    different paid community swaps out the current one. Free
                    communities can be selected in any number.
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-[#2a2a35] overflow-hidden">
                {channels.length === 0 ? (
                  <p className="text-sm text-[#9fa0b8] text-center py-6">No communities available</p>
                ) : (
                  channels.map((ch) => (
                    <label
                      key={ch._id}
                      className={cn(
                         "flex items-center gap-3 px-3 py-3 cursor-pointer border-b border-[#2a2a35] last:border-b-0 transition-colors",
                         formData.channelIds.includes(ch._id) ? "bg-brand/5" : "bg-[#131316] hover:bg-[#222228]"
                      )}
                    >
                      {ch.logo ? (
                        <img
                          src={ch.logo}
                          alt={ch.title}
                          className="w-8 h-8 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-[#2a2a35] flex items-center justify-center shrink-0">
                          <Users className="h-4 w-4 text-[#9fa0b8]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{ch.title}</p>
                        <div className="flex items-center gap-2 text-xs text-[#9fa0b8]">
                          <span>{ch.memberCount ?? 0} {ch.memberCount === 1 ? "member" : "members"}</span>
                          <span>&bull;</span>
                          {(ch.isFree || !ch.price || ch.price === 0) ? (
                            <span>Free</span>
                          ) : (
                            <span>
                              {ch.currency === "INR" ? "₹" : "$"}{(ch.price || 0).toFixed(2)}
                              {ch.isSubscription && `/${ch.subscriptionPeriod?.slice(0, 2) || "mo"}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={formData.channelIds.includes(ch._id)}
                        onCheckedChange={() => handleChannelToggle(ch._id)}
                      />
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ════ SPEAKERS ════ */}
          <div className="space-y-4 pb-6 border-b border-[#2a2a35]/40">
            <div>
              <label className="text-xs font-semibold text-[#9fa0b8] uppercase tracking-wide">Speakers</label>
              <p className="text-xs text-[#9fa0b8] mb-3 mt-1">
                Office members on stage. They are listed on the webinar page and seated as co-hosts when they join. Search by name or email.
              </p>
              <SpeakerPicker
                members={members}
                selectedIds={formData.speakerIds}
                onChange={(ids) => upd({ speakerIds: ids })}
              />
            </div>
          </div>

          {/* ════ RECORDING ════ */}
          <div className="space-y-4 pb-6 border-b border-[#2a2a35]/40">
            <div>
              <label className="text-xs font-semibold text-[#9fa0b8] uppercase tracking-wide">Recording</label>
              <p className="text-xs text-[#9fa0b8] mb-3 mt-1">Choose how the session is recorded</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "manual", label: "Manual", desc: "You control start/stop" },
                  { value: "automatic", label: "Automatic", desc: "Starts with session", dot: true },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => upd({ recordingMode: opt.value as "manual" | "automatic" })}
                    className={cn(
                      "text-left p-3 rounded-xl border transition-all",
                      formData.recordingMode === opt.value
                        ? "bg-brand/5 border-brand"
                        : "bg-[#131316] border-[#2a2a35] hover:border-[#3a3a45]"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-white">{opt.label}</span>
                      {opt.dot && formData.recordingMode === opt.value && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                    </div>
                    <p className="text-xs text-[#9fa0b8]">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ════ ENROLLMENT TYPE (recurring only) ════ */}
          {formData.isRecurring && (
            <div className="space-y-4 pb-6 border-b border-[#2a2a35]/40">
              <label className="text-xs font-semibold text-[#9fa0b8] uppercase tracking-wide">Enrollment Type</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "once", label: "Enroll Once", desc: "Pay once, attend all sessions" },
                  { value: "per_session", label: "Per Session", desc: "Pay per individual session" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => upd({ enrollmentType: opt.value as "once" | "per_session" })}
                    className={cn(
                      "text-left p-3 rounded-xl border transition-all",
                      formData.enrollmentType === opt.value
                        ? "bg-brand/5 border-brand"
                        : "bg-[#131316] border-[#2a2a35] hover:border-[#3a3a45]"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-white">{opt.label}</span>
                      {formData.enrollmentType === opt.value && (
                        <span className="w-2 h-2 rounded-full bg-brand" />
                      )}
                    </div>
                    <p className="text-xs text-[#9fa0b8]">{opt.desc}</p>
                  </button>
                ))}
              </div>

            </div>
          )}

          {/* ════ PAGE DETAILS ════ */}
          <div className="space-y-5 pb-6 border-b border-[#2a2a35]/40">
            {/* ── What You'll Learn ── */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#9fa0b8]">What You&apos;ll Learn</p>
              <div className="space-y-3">
                {formData.learningPoints.map((pt, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-[#4a4a5a] shrink-0" />
                    <input
                      value={pt}
                      onChange={(e) => {
                        const up = [...formData.learningPoints];
                        up[i] = e.target.value;
                        upd({ learningPoints: up });
                      }}
                      placeholder="Add a learning point..."
                      className="flex-grow bg-[#131316] border border-[#2a2a35] text-white text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-brand/60 placeholder:text-[#4a4a5a] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => upd({ learningPoints: formData.learningPoints.filter((_, j) => j !== i) })}
                      className="w-10 h-10 rounded-xl border border-[#2a2a35] bg-[#131316] text-[#9fa0b8] hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => upd({ learningPoints: [...formData.learningPoints, ""] })}
                  disabled={formData.learningPoints.length >= MAX_LEARNING_POINTS}
                  className="flex items-center gap-1.5 text-sm text-brand hover:opacity-80 transition-colors font-medium disabled:opacity-40 disabled:pointer-events-none"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add item
                </button>
                {formData.learningPoints.length >= MAX_LEARNING_POINTS && (
                  <span className="text-[11px] text-[#6b6b7b]">
                    {limitReachedLabel(MAX_LEARNING_POINTS, "items")}
                  </span>
                )}
              </div>
            </div>

            {/* ── FAQs ── */}
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-[#9fa0b8]">Frequently Asked Questions</p>
              <div className="space-y-4">
                {formData.faqs.map((faq, i) => (
                  <div key={i} className="bg-[#131316] border border-[#2a2a35] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        value={faq.question}
                        onChange={(e) => {
                          const up = [...formData.faqs];
                          up[i] = { ...up[i], question: e.target.value };
                          upd({ faqs: up });
                        }}
                        placeholder="e.g., What is this product about?"
                        className="flex-grow bg-[#1a1a22]/60 border border-[#2a2a35] text-white text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-brand/60 placeholder:text-[#4a4a5a] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => upd({ faqs: formData.faqs.filter((_, j) => j !== i) })}
                        className="w-10 h-10 rounded-xl border border-[#2a2a35] bg-[#1a1a22]/40 text-[#9fa0b8] hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <textarea
                      value={faq.answer}
                      onChange={(e) => {
                        const up = [...formData.faqs];
                        up[i] = { ...up[i], answer: e.target.value };
                        upd({ faqs: up });
                      }}
                      placeholder="Write a clear answer..."
                      rows={3}
                      className="w-full bg-[#1a1a22]/60 border border-[#2a2a35] text-white text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-brand/60 placeholder:text-[#4a4a5a] resize-none transition-colors"
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => upd({ faqs: [...formData.faqs, { question: "", answer: "" }] })}
                  disabled={formData.faqs.length >= MAX_FAQS}
                  className="flex items-center gap-1.5 text-sm text-brand hover:opacity-80 transition-colors font-medium disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Plus className="h-4 w-4" />
                  + Add FAQ
                </button>
                {formData.faqs.length >= MAX_FAQS && (
                  <span className="text-[11px] text-[#6b6b7b]">
                    {limitReachedLabel(MAX_FAQS, "FAQs")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Simulated audience. Edit-only for the same reason as evergreen —
              the script is stored against a saved workshop. Applies to normal
              live webinars too, not just evergreen ones. */}
          {editWorkshop?._id && (
            <div className="py-4 border-t border-[#2a2a35]/40">
              <SimulatedAudienceSettings workshopId={editWorkshop._id} />
            </div>
          )}

          {/* Evergreen playback. Edit-only: the video is uploaded against a
              saved workshop, so there is nothing to attach it to until the
              webinar exists. Leaving it untouched keeps the webinar live. */}
          {editWorkshop?._id && (
            <div className="py-4 border-t border-[#2a2a35]/40">
              <EvergreenSettings workshopId={editWorkshop._id} />
            </div>
          )}

          {/* Post-registration email. Fires on free registration and on paid
              checkout alike — same section products, courses and communities
              use. */}
          <div className="py-4 border-t border-[#2a2a35]/40">
            <ProductEmailAlertsSection
              {...emailAlertsForm.sectionProps}
              product={{
                productName: formData.title,
                price: formData.isFree ? 0 : formData.price,
                currency: formData.currency,
                isFree: formData.isFree,
              }}
            />
          </div>

          {/* Host's own "someone registered" alert */}
          <div className="py-4 border-t border-[#2a2a35]/40">
            <FounderAlertsSection
              {...founderAlertsForm.sectionProps}
              context="workshop"
            />
          </div>

          {/* For create live stream, comment this section for now, as we are not allowing paid webinars for some time */}
          {/*
          <div className="space-y-4 pb-4">
            <div className="flex items-center justify-between bg-[#131316] rounded-xl px-3 py-2.5">
              <span className="text-sm font-medium text-white">Free Live Stream</span>
              <Switch checked={formData.isFree} onCheckedChange={(v) => upd({ isFree: v })} />
            </div>

            {!formData.isFree && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#9fa0b8]">Currency</label>
                    <CurrencyDropdown
                      value={formData.currency}
                      onChange={(val) => upd({ currency: val })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#9fa0b8]">Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#9fa0b8]">
                        {formData.currency === "INR" ? "₹" : "$"}
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={formData.price || ""}
                        onChange={(e) => upd({ price: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                        className="w-full bg-[#131316] border border-[#2a2a35] text-white text-sm rounded-xl pl-7 pr-3 py-2.5 outline-none focus:border-brand/60 placeholder:text-[#4a4a5a]"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
                    GST / Tax
                  </span>
                  <p className="text-xs text-[#9fa0b8] leading-normal">
                    18.00% GST (Goods &amp; Services Tax) applies to buyers in India, whatever currency you price in. Does the price above already include it?
                  </p>
                  <div className="flex rounded-lg border border-[#2a2a35] bg-[#131316] p-1 w-full gap-1">
                    <button
                      type="button"
                      onClick={() => upd({ gstInclusive: true })}
                      className={cn(
                        "flex-1 py-2 text-xs font-medium rounded-md transition-all text-center",
                        formData.gstInclusive ? "bg-brand text-brand-foreground" : "text-[#9fa0b8] hover:text-white"
                      )}
                    >
                      Yes, I'll cover it in the above price
                    </button>
                    <button
                      type="button"
                      onClick={() => upd({ gstInclusive: false })}
                      className={cn(
                        "flex-1 py-2 text-xs font-medium rounded-md transition-all text-center",
                        !formData.gstInclusive ? "bg-brand text-brand-foreground" : "text-[#9fa0b8] hover:text-white"
                      )}
                    >
                      No, add it on top
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
                    iOS App Purchases
                  </span>
                  <p className="text-xs text-[#9fa0b8] leading-normal">
                    Do you require your customers to be able to pay for this live stream on the iOS app?
                  </p>
                  <div className="flex rounded-lg border border-[#2a2a35] bg-[#131316] p-1 w-full gap-1">
                    <button
                      type="button"
                      className="flex-1 py-2 text-xs font-bold rounded-md transition-all text-center bg-brand text-brand-foreground"
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.info("iOS app purchases coming soon!")}
                      className="flex-1 py-2 text-xs font-medium rounded-md transition-all text-center text-[#8b8c9d] bg-transparent hover:bg-[#1a1a22] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      Yes <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#2a2a35] text-brand font-medium">Coming Soon</span>
                    </button>
                  </div>
                </div>

                <div className="border-t border-[#2a2a35]/40 pt-4 space-y-4">
                  <CommissionPlanSection
                    itemType="workshop"
                    itemId={editWorkshop?._id}
                    itemName={formData.title || "New Live Stream"}
                    isPaid={true}
                  />
                  {editWorkshop?._id && (
                    <CompPlanDisplay itemType="workshop" itemId={editWorkshop._id} />
                  )}
                </div>
              </div>
            )}
          </div>
          */}

          {/* Error */}
          {error && (
            <div className="mt-2 mb-1 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* ── Sticky Footer ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3.5 border-t border-[#2a2a35] shrink-0 bg-[#111114]">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="text-sm font-semibold text-[#9fa0b8] hover:text-white transition-colors px-2.5 py-1.5 rounded-xl hover:bg-[#131316] shrink-0"
            >
              Cancel
            </button>

            {/* Price Info / Breakdown */}
            {!formData.isFree && formData.price > 0 && (() => {
              const priceDetails = getPriceDetails();
              return (
                <div className="flex items-center gap-2 shrink-0">
                  <div className="h-6 w-px bg-[#2a2a35]" />
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-[#8b8c9d] uppercase tracking-wide leading-none">iOS</span>
                        <span className="text-brand font-bold text-sm mt-0.5">
                          {priceDetails.currency}{priceDetails.totalIos.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-5 w-px bg-[#2a2a35]" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-[#8b8c9d] uppercase tracking-wide leading-none">Web</span>
                        {/* Both figures: what the buyer is charged, and the
                            pre-tax base. Showing only one made it impossible
                            to tell whether GST was already inside the price. */}
                        <span className="text-brand font-bold text-sm mt-0.5 leading-none">
                          {priceDetails.currency}{priceDetails.totalWeb.toFixed(2)}
                          <span className="text-[9px] font-medium text-[#6b6b7b] ml-1">incl. GST</span>
                        </span>
                        <span className="text-[9px] text-[#8b8c9d] mt-0.5 leading-none">
                          {priceDetails.currency}{priceDetails.baseWeb.toFixed(2)} excl. GST
                          {priceDetails.gstWeb > 0 && (
                            <span className="text-[#6b6b7b]"> · GST {priceDetails.currency}{priceDetails.gstWeb.toFixed(2)}</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPriceBreakdownModal(true)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#131316] border border-[#2a2a35] text-[10px] font-bold text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22] transition-colors"
                    >
                      <Info className="w-3 h-3" />
                      Breakdown
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="flex items-center gap-2">
            {/* {!editWorkshop && (
              <button
                type="button"
                onClick={() => handleSaveClick(false)}
                disabled={savingDraft || loading}
                className="text-sm font-semibold text-white border border-[#2a2a35] rounded-xl px-3.5 py-2 hover:bg-[#131316] transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
              >
                {savingDraft && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save as Draft
              </button>
            )} */}
            <button
              type="button"
              onClick={() => handleSaveClick(true)}
              disabled={loading || savingDraft}
              className="text-sm font-bold bg-brand text-brand-foreground rounded-xl px-4 py-2 hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editWorkshop ? "Update Live Stream" : "Publish Live Stream"}
            </button>
          </div>
        </div>

        {/* ── Sub-modals inside dialog ── */}
        {showIosPricingModal && (
          <Dialog open={showIosPricingModal} onOpenChange={setShowIosPricingModal}>
            <DialogContent className="bg-[#18181c] border border-[#2a2a35] z-[1200] max-w-[480px] text-white p-6 rounded-2xl" showCloseButton={false}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-white">iOS Pricing</h3>
                <button
                  type="button"
                  onClick={() => setShowIosPricingModal(false)}
                  className="w-7 h-7 rounded-full border border-[#2a2a35] bg-[#1a1a22] flex items-center justify-center text-[#9fa0b8] hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[#9fa0b8] leading-relaxed mb-6">
                Is the price you entered inclusive of Apple's 30% fee? If not, we will be adding 30% to the final price that users on iOS will have to pay to cover Apple's fee.
              </p>

              <div className="space-y-3 mb-6">
                <div
                  onClick={() => setTempIosOption("inclusive")}
                  className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    tempIosOption === "inclusive" ? "bg-[#1E1E1E] border-brand" : "bg-[#1E1E1E] border-[#2a2a35] hover:border-[#3a3a45]"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    tempIosOption === "inclusive" ? "border-brand" : "border-[#9fa0b8]/40"
                  }`}>
                    {tempIosOption === "inclusive" && <div className="w-2.5 h-2.5 rounded-full bg-brand" />}
                  </div>
                  <span className="text-sm font-medium text-white">Yes, I'll cover it in the above price</span>
                </div>

                <div
                  onClick={() => setTempIosOption("exclusive")}
                  className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    tempIosOption === "exclusive" ? "bg-[#1E1E1E] border-brand" : "bg-[#1E1E1E] border-[#2a2a35] hover:border-[#3a3a45]"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    tempIosOption === "exclusive" ? "border-brand" : "border-[#9fa0b8]/40"
                  }`}>
                    {tempIosOption === "exclusive" && <div className="w-2.5 h-2.5 rounded-full bg-brand" />}
                  </div>
                  <span className="text-sm font-medium text-white">No, add it on top</span>
                </div>

                <div
                  onClick={() => setTempIosOption("restrict")}
                  className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    tempIosOption === "restrict" ? "bg-[#1E1E1E] border-brand" : "bg-[#1E1E1E] border-[#2a2a35] hover:border-[#3a3a45]"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    tempIosOption === "restrict" ? "border-brand" : "border-[#9fa0b8]/40"
                  }`}>
                    {tempIosOption === "restrict" && <div className="w-2.5 h-2.5 rounded-full bg-brand" />}
                  </div>
                  <span className="text-sm font-medium text-white">Restrict purchases from iOS app</span>
                </div>
              </div>

              {tempIosOption === "restrict" && (
                <div className="bg-[#ea580c]/5 border border-[#ea580c]/25 rounded-xl p-4 mb-6">
                  <p className="text-xs text-[#ea580c]/90 leading-relaxed">
                    Just because you restrict purchases from the iOS app, doesn't mean that iPhone users can't buy your live stream. It just means that they will have to purchase it in the web or mobile browser and then enjoy the benefits inside of the Garage mobile app.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowIosPricingModal(false)}
                  className="text-[#9fa0b8] hover:text-white text-sm font-semibold h-10 px-4 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmIosPricing}
                  className="bg-brand hover:opacity-90 text-brand-foreground h-10 px-6 font-bold rounded-lg transition-colors text-sm"
                >
                  Confirm
                </button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {showPriceBreakdownModal && (() => {
          const breakdown = getDetailedPriceBreakdown();
          const formatTablePrice = (amount: number, isMinusOrPlus?: "minus" | "plus" | "none") => {
            const symbol = formData.currency === "INR" ? "\u20B9" : "$";
            if (amount === 0 && isMinusOrPlus === "none") return "-";
            const prefix = isMinusOrPlus === "plus" ? "+" : isMinusOrPlus === "minus" ? "-" : "";
            return `${prefix}${symbol}${amount.toFixed(2)}`;
          };

          return (
            <Dialog open={showPriceBreakdownModal} onOpenChange={setShowPriceBreakdownModal}>
              <DialogContent className="bg-[#0e0e12] border-[#2a2a35] z-[1200] max-w-2xl text-white p-6 rounded-2xl" showCloseButton={false}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">Price Preview</span>
                    <span className="w-2 h-2 rounded-full bg-brand" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPriceBreakdownModal(false)}
                    className="w-7 h-7 rounded-full border border-[#2a2a35] bg-[#1a1a22] flex items-center justify-center text-[#9fa0b8] hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* GST only applies to buyers in India — this preview shows
                    that case. Without saying so the numbers read as universal. */}
                <p className="text-[11px] text-[#6b6b7b] leading-relaxed -mt-3 mb-5">
                  Figures below are for a buyer <span className="text-[#9fa0b8]">in India</span>, where 18% GST applies.
                  Buyers outside India pay no GST: they pay the listed price and
                  the full amount counts as your base.
                </p>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-[#13131a] border border-[#2a2a35] rounded-xl p-4 flex flex-col space-y-2">
                    <div className="flex items-center gap-1.5 self-start px-2 py-0.5 rounded bg-[#1a1a22] border border-[#2a2a35]/60 text-[10px] font-semibold text-[#9fa0b8]">
                      <Apple className="w-3 h-3 text-[#9fa0b8]" />
                      iOS Customers
                    </div>
                    <div className="text-2xl font-bold text-white mt-1">
                      {formatCardPrice(breakdown.ios.customerPays, formData.currency)}
                    </div>
                    <div className="text-xs text-[#6b6b7b]">one-time payment</div>
                  </div>

                  <div className="bg-[#13131a] border border-[#2a2a35] rounded-xl p-4 flex flex-col space-y-2">
                    <div className="flex items-center gap-1.5 self-start px-2 py-0.5 rounded bg-[#1a1a22] border border-[#2a2a35]/60 text-[10px] font-semibold text-[#9fa0b8]">
                      <Smartphone className="w-3 h-3 text-[#9fa0b8]" />
                      Non-iOS Customers
                    </div>
                    <div className="text-2xl font-bold text-white mt-1">
                      {formatCardPrice(breakdown.nonIos.customerPays, formData.currency)}
                    </div>
                    <div className="text-xs text-[#6b6b7b]">one-time payment</div>
                  </div>
                </div>

                <div className="bg-[#13131a] border border-[#2a2a35] rounded-xl p-5 space-y-4">
                  <h3 className="text-sm font-bold text-white mb-2">Price Breakdown</h3>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <div className="text-xs text-[#9fa0b8] font-semibold mb-3">iOS Customers</div>
                      
                      <div className="flex justify-between text-xs text-[#9fa0b8]">
                        <span>Base price</span>
                        <span className="text-white">{formatTablePrice(breakdown.basePrice)}</span>
                      </div>
                      
                      <div className="flex justify-between text-xs text-[#9fa0b8]">
                        <span>Apple fee (30%)</span>
                        <span className="text-[#f43f5e] font-medium">{formatTablePrice(breakdown.ios.appleFee, "plus")}</span>
                      </div>
                      
                      <div className="flex justify-between text-xs text-[#9fa0b8]">
                        <span>GST (18%)</span>
                        <span className="text-[#f43f5e] font-medium">{formatTablePrice(breakdown.ios.gst, "plus")}</span>
                      </div>
                      
                      <div className="border-t border-[#2a2a35]/60 my-1 pt-1.5 flex justify-between text-xs font-semibold text-white">
                        <span>Customer pays</span>
                        <span>{formatTablePrice(breakdown.ios.customerPays)}</span>
                      </div>
                      
                      <div className="pt-2">
                        <div className="text-[10px] text-[#6b6b7b] uppercase tracking-wider font-semibold mb-2">DISTRIBUTION</div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-[#9fa0b8]">
                            <span>&rarr; Government (GST)</span>
                            <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.ios.govGst)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-[#9fa0b8]">
                            <span>&rarr; Apple</span>
                            <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.ios.appleDist)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-[#9fa0b8]">
                            <span>&rarr; Platform (5%)</span>
                            <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.ios.platformFee)}</span>
                          </div>
                          {breakdown.affPercent > 0 && (
                            <div className="flex justify-between text-xs text-[#9fa0b8]">
                              <span>&rarr; Affiliate ({breakdown.affPercent}%)</span>
                              <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.ios.affiliateCut)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="border-t border-[#2a2a35]/60 mt-2 pt-2 flex justify-between text-xs font-bold">
                        <span className="text-brand">You receive</span>
                        <span className="text-brand">{formatTablePrice(breakdown.ios.youReceive)}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs text-[#9fa0b8] font-semibold mb-3">Non-iOS Customers</div>
                      
                      <div className="flex justify-between text-xs text-[#9fa0b8]">
                        <span>Base price</span>
                        <span className="text-white">{formatTablePrice(breakdown.basePrice)}</span>
                      </div>
                      
                      <div className="flex justify-between text-xs text-[#6b6b7b]">
                        <span>Apple fee (30%)</span>
                        <span>-</span>
                      </div>
                      
                      <div className="flex justify-between text-xs text-[#9fa0b8]">
                        <span>GST (18%)</span>
                        <span className="text-[#f43f5e] font-medium">{formatTablePrice(breakdown.nonIos.gst, "plus")}</span>
                      </div>
                      
                      <div className="border-t border-[#2a2a35]/60 my-1 pt-1.5 flex justify-between text-xs font-semibold text-white">
                        <span>Customer pays</span>
                        <span>{formatTablePrice(breakdown.nonIos.customerPays)}</span>
                      </div>
                      
                      <div className="pt-2">
                        <div className="text-[10px] text-[#6b6b7b] uppercase tracking-wider font-semibold mb-2">DISTRIBUTION</div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-[#9fa0b8]">
                            <span>&rarr; Government (GST)</span>
                            <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.nonIos.govGst)}</span>
                          </div>
                          
                          <div className="h-[16px] w-full" />
                          
                          <div className="flex justify-between text-xs text-[#9fa0b8]">
                            <span>&rarr; Platform (5%)</span>
                            <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.nonIos.platformFee)}</span>
                          </div>
                          {breakdown.affPercent > 0 && (
                            <div className="flex justify-between text-xs text-[#9fa0b8]">
                              <span>&rarr; Affiliate ({breakdown.affPercent}%)</span>
                              <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.nonIos.affiliateCut)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="border-t border-[#2a2a35]/60 mt-2 pt-2 flex justify-between text-xs font-bold">
                        <span className="text-brand">You receive</span>
                        <span className="text-brand">{formatTablePrice(breakdown.nonIos.youReceive)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}
      </div>
    </div>
  );
}

function parseTz(label: string) {
  const match = label.match(/^\((UTC[+-]\d{2}:\d{2})\)\s*(.*)$/);
  if (match) {
    let offset = match[1];
    const name = match[2];
    offset = offset.replace(/([+-])0(\d)/, '$1$2').replace(/:00$/, '');
    return { offset, name };
  }
  return { offset: "", name: label };
}

interface TimezoneDropdownProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
}

function TimezoneDropdown({ value, onChange, options }: TimezoneDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];
  const { offset: selectedOffset, name: selectedName } = parseTz(selectedOption?.label || "");

  const filteredOptions = options.filter((opt) => {
    const { offset, name } = parseTz(opt.label);
    const query = search.toLowerCase();
    return (
      name.toLowerCase().includes(query) ||
      offset.toLowerCase().includes(query) ||
      opt.value.toLowerCase().includes(query)
    );
  });

  return (
    <div ref={containerRef} className="relative w-full text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-[#131316] border border-[#2a2a35] text-white text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-brand/60 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-semibold text-[#9fa0b8] min-w-[65px] text-left shrink-0">{selectedOffset}</span>
          <span className="text-white font-medium truncate">{selectedName}</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-[#9fa0b8] transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-[1000] left-0 right-0 mt-1.5 bg-[#16161c] border border-[#2a2a35] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[300px]">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#2a2a35] bg-[#111114]">
            <Search className="h-4 w-4 text-[#6b6b7b] shrink-0" />
            <input
              type="text"
              placeholder="Search timezone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-white text-sm outline-none placeholder:text-[#4a4a5a]"
              autoFocus
            />
          </div>

          <div className="flex-grow overflow-y-auto py-1 divide-y divide-[#2a2a35]/10 max-h-[240px]" style={{ scrollbarWidth: "none" }}>
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-xs text-[#6b6b7b] text-center">No timezones found</div>
            ) : (
              filteredOptions.map((opt) => {
                const { offset, name } = parseTz(opt.label);
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-[#1a1a22] ${
                      isSelected ? "bg-[#1a1a22]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-semibold text-[#9fa0b8] w-[65px] shrink-0">{offset}</span>
                      <span className={`truncate ${isSelected ? "text-brand font-bold" : "text-[#d1d1e0]"}`}>{name}</span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-brand shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export interface CurrencyDropdownProps {
  value: string;
  onChange: (val: string) => void;
}

export function CurrencyDropdown({ value, onChange }: CurrencyDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currencies = [
    { code: "USD", symbol: "$", countryCode: "US", flag: "\uD83C\uDDFA\uD83C\uDDF8" },
    { code: "INR", symbol: "\u20B9", countryCode: "IN", flag: "\uD83C\uDDEE\uD83C\uDDF3" },
  ];

  const selected = currencies.find((c) => c.code === value) || currencies[0];

  return (
    <div ref={containerRef} className="relative w-full text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-[#131316] border border-[#2a2a35] text-white text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-brand/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-base select-none leading-none shrink-0">{selected.flag}</span>
          <span className="text-white font-medium">{selected.code}</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-[#9fa0b8] transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-[1000] left-0 right-0 mt-1.5 bg-[#16161c] border border-[#2a2a35] rounded-xl shadow-2xl overflow-hidden py-1">
          {currencies.map((curr) => {
            const isSelected = curr.code === value;
            return (
              <button
                key={curr.code}
                type="button"
                onClick={() => {
                  onChange(curr.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-[#1a1a22] ${
                  isSelected ? "bg-[#1a1a22]" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-base select-none leading-none shrink-0">{curr.flag}</span>
                  <span className={`font-medium ${isSelected ? "text-brand font-bold" : "text-[#d1d1e0]"}`}>{curr.code}</span>
                </div>
                {isSelected && <Check className="h-4 w-4 text-brand shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}





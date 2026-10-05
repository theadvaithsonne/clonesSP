"use client";

import { htmlToPlainLines } from "@/lib/webinar/html-text";
import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  User,
  Loader2,
  Video,
  AlertCircle,
  CheckCircle,
  Mail,
  Shield,
  RefreshCw,
  ArrowRight,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  saveToken,
  saveOrgId,
  getToken,
  isAuthenticated,
  getUserDataFromToken,
} from "@/lib/auth";
import { CheckoutPaymentStep } from "@/components/checkout/CheckoutPaymentStep";
import SessionNotStartedCard, {
  type CommissionLevel,
  type SessionPerson,
} from "@/components/webinar/SessionNotStartedCard";
import {
  parseCalendarDate,
  parseWallClock,
  ymdInTimeZone,
  zonedTimeToUtc,
} from "@/lib/zonedTime";
import {
  saveBat246GuestSession,
  readBat246GuestSession,
} from "@/lib/webinar/bat246GuestSession";
import { connectWebinarSocket, getWebinarSocket } from "@/lib/socket";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Where "View enrolled webinar" goes when there's no live room to enter —
 * the workspace's Live → Enrolled list. Same origin as this page, so a
 * client-side push is enough; `app/(dashboard)/layout.tsx` reads these
 * params and opens the `Live:Enrolled` popover on arrival.
 */
const ENROLLED_WEBINARS_URL = "/workspace?openApp=webinar&tab=enrolled";

/**
 * The Bat246/gotobigwin.com org (name "Bat246", store slug "bat246"). Its
 * webinars are a public lead-gen funnel — used to gate a couple of things
 * that don't fit that funnel: "Explore office" would drop a lead straight
 * into the internal Garage workspace, and the full session card (photo,
 * schedule, pricing, host) is more than a funnel visitor needs to see just
 * to enter an email/OTP. Every other org's webinars are unaffected.
 */
const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";

// ── Types ──────────────────────────────────────────────────────────────────

interface WebinarDetails {
  id: string;
  title: string;
  description?: string | null;
  coverPhoto?: string | null;
  orgIcon?: string | null;
  orgName?: string | null;
  orgId?: string | null;
  brandColor?: string | null;
  startTime: string;
  startTimeStr?: string;
  endTimeStr?: string;
  timezone?: string;
  hostName?: string;
  hostEmail?: string;
  /** Office members the founder billed as speakers. */
  speakers?: { id: string; name: string; avatar?: string | null; title?: string | null }[];
  isLive: boolean;
  status: string;
}

interface Referrer {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
}

/**
 * Extra public metadata for the pre-join card, sourced from
 * `GET /public/workshops/:id`. `/public/webinar/validate` deliberately
 * returns a lean payload for the auth flow, so pricing, the real
 * registration count, the host's avatar, and the affiliate commission
 * plan come from here instead. Everything is optional — the card hides
 * whichever rows it can't populate rather than inventing values.
 */
interface PublicWorkshopMeta {
  isFree?: boolean;
  price?: number;
  currency?: string;
  registeredParticipants?: number;
  creator?: {
    _id?: string;
    name?: string;
    profilePicture?: string | null;
  } | null;
  combPlan?: {
    name?: string;
    levels?: CommissionLevel[];
    totalPercentage?: number;
  } | null;
  organization?: {
    _id?: string;
    name?: string;
  } | null;
}

/**
 * Who is doing the inviting.
 *
 * An affiliate who never set a name used to render as "Unknown invited you
 * to join" — the API's placeholder read as a real person called Unknown.
 * The API now returns the truth (an empty name), and a nameless invite is
 * attributed to the office instead of to nobody. Rendered from one place
 * because this line appears at three points in the pre-join flow.
 */
function InviteLine({
  name,
  orgName,
  brandColor,
}: {
  name?: string | null;
  orgName?: string | null;
  brandColor: string;
}) {
  const who = name?.trim();
  const strong = (text: string) => (
    <span className="font-semibold" style={{ color: brandColor }}>
      {text}
    </span>
  );
  if (who) {
    return (
      <span className="text-sm text-zinc-300">
        {strong(who)} invited you to join
      </span>
    );
  }
  const org = orgName?.trim();
  return (
    <span className="text-sm text-zinc-300">
      You&apos;re invited to{" "}
      {strong(org ? `${org}${org.endsWith("s") ? "'" : "'s"}` : "this")} webinar
    </span>
  );
}

type PreJoinState =
  | "loading"
  | "invalid"
  | "email-entry"
  | "otp-request"
  | "otp-verify"
  | "gating" // Pre-flight paid-enrolment check (calls /prepare-join).
  | "session-pick" // Per-session workshop with no active session — buyer picks.
  | "wrong-session" // Buyer paid for a different session than the active one.
  | "invoice-payment" // Inline <CheckoutPaymentStep> modal for payment.
  | "name-entry"
  | "not-started"
  | "session-not-yet-started" // Buyer paid for a future session; render come-back-later screen.
  | "session-choice" // Buyer paid for both a live-now and an upcoming session.
  | "joining"
  // Bat246 "05" hidden code (?noreg=1) — name-only, no email/OTP. See
  // handleDemoHostJoin. The server independently verifies eligibility;
  // reaching this state is not itself a grant of anything.
  | "demo-name-entry"
  // Bat246 attendee "knock" — verified visitor is waiting for the host to
  // approve or deny their entry. See attemptEnterRoom.
  | "waiting-for-host"
  // Guest join from invite link or Bat246 — name only, no email/OTP.
  | "invite-name-entry";

interface NotYetStartedInfo {
  sessionDate: string;
  startDateTime: string;
  endDateTime: string;
  alreadyEnded?: boolean;
}

interface SessionChoiceInfo {
  liveOption: {
    sessionDate: string;
    startDateTime: string;
    endDateTime: string;
  };
  upcomingOption: {
    sessionDate: string;
    startDateTime: string;
    endDateTime: string;
  };
}

interface PrepareJoinSession {
  date: string;
  dateString: string;
  startDateTime: string;
  endDateTime: string;
  isToday?: boolean;
}

interface WebinarPreJoinProps {
  webinarId: string;
  affiliateId: string;
  // Optional session date (YYYY-MM-DD) read from the URL by the parent
  // /webinar/[id] page. When present, the first prepare-join call passes
  // this through so buyers who click a founder's per-session share link
  // skip the picker. If the sessionDate is invalid, trashed, or the
  // workshop is enrol-once, the BE falls back to needsSessionPick and
  // the picker still renders.
  urlSessionDate?: string;
  onJoinReady: (guestToken: string, displayName: string, userAffiliateId: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function WebinarPreJoin({
  webinarId,
  affiliateId,
  urlSessionDate,
  onJoinReady,
}: WebinarPreJoinProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Bat246 "05" hidden code — see the demo-name-entry state and
  // handleDemoHostJoin below.
  const isDemoNoRegRequest = searchParams.get("noreg") === "1";

  const [pageState, setPageState] = useState<PreJoinState>("loading");
  const [webinarDetails, setWebinarDetails] = useState<WebinarDetails | null>(
    null
  );
  const [referrer, setReferrer] = useState<Referrer | null>(null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [userAffiliateId, setUserAffiliateId] = useState("");
  // Bat246 knock — id of the join request currently awaiting the host's
  // decision, and whether the visitor gave up on it (see attemptEnterRoom).
  const pendingRequestIdRef = useRef<string | null>(null);
  // Guards the async requestJoin callback/listeners against firing after
  // the component has moved on (unmount, or the visitor cancelled).
  const knockCancelledRef = useRef(false);
  // The two listeners currently attached for the in-flight knock, so an
  // unmount can remove exactly them from the shared webinar socket.
  const knockListenersRef = useRef<{
    approved: (payload: { requestId: string }) => void;
    denied: (payload: { requestId: string; reason?: string }) => void;
  } | null>(null);
  // Pricing / enrolment / commission metadata for the waiting-room card.
  const [publicMeta, setPublicMeta] = useState<PublicWorkshopMeta | null>(null);
  // The VIEWER's own affiliate id, fetched for any signed-in user. Never
  // falls back to the `affiliateId` prop — that's the SHARER's code from
  // the ?ref= URL, and putting it on a link this user copies would credit
  // the original sharer for their referrals.
  const [ownAffiliateId, setOwnAffiliateId] = useState("");
  // Public slug of the workshop's org, used as the guest-office fallback
  // when the viewer turns out not to be a member. Resolved lazily because
  // neither /public/webinar/validate nor /public/workshops returns it.
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [isExploringOffice, setIsExploringOffice] = useState(false);
  // Whether the viewer holds a real (non-guest) session. Read in an effect
  // rather than inline, because isAuthenticated() touches localStorage and
  // would desync the server-rendered markup from the first client render.
  const [isSignedIn, setIsSignedIn] = useState(false);
  useEffect(() => {
    setIsSignedIn(isAuthenticated());
  }, [guestToken, pageState]);
  // Bat246/gotobigwin funnel webinars never offer "Explore office" — see
  // BAT246_ORG_ID.
  const hideExploreOffice =
    publicMeta?.organization?._id === BAT246_ORG_ID;
  // Same org, but resolved straight off /validate's response (available as
  // soon as webinarDetails is set) rather than the separate, slower
  // publicMeta fetch above — used to swap in the basic email/OTP popup
  // below before publicMeta would otherwise have landed.
  const isBat246Webinar = webinarDetails?.orgId === BAT246_ORG_ID;

  // Paid-enrolment gate state — populated by /public/webinar/prepare-join.
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(null);
  // Metadata for the "Step X of Y" banner above the inline invoice modal.
  // Populated alongside pendingInvoiceId; cleared on payment complete.
  const [pendingInvoiceMeta, setPendingInvoiceMeta] = useState<{
    stage: "community" | "workshop";
    stepNumber: number;
    totalSteps: number;
    itemName: string;
    itemPrice: number;
    itemCurrency: string;
  } | null>(null);
  const [prepareJoinSessions, setPrepareJoinSessions] = useState<
    PrepareJoinSession[]
  >([]);
  const [selectedSessionDate, setSelectedSessionDate] = useState<string | null>(
    null
  );
  // "You paid for a DIFFERENT session than the one running now" state.
  // Populated when prepare-join returns needsConfirmPay:true. FE renders
  // a confirmation before creating a second invoice.
  const [wrongSessionInfo, setWrongSessionInfo] = useState<{
    paidSessions: string[];
    currentSessionDate: string | null;
  } | null>(null);
  // Buyer paid for a session that hasn't started yet (or already ended).
  const [notYetStartedInfo, setNotYetStartedInfo] =
    useState<NotYetStartedInfo | null>(null);
  // Buyer has access to BOTH a live-now and a future session — let them pick.
  const [sessionChoiceInfo, setSessionChoiceInfo] =
    useState<SessionChoiceInfo | null>(null);

  const brandColor = webinarDetails?.brandColor || "#a855f7";

  // ── Fetch webinar details ──────────────────────────────────────────────

  useEffect(() => {
    if (!webinarId) {
      setPageState("invalid");
      return;
    }

    async function validate() {
      try {
        // Pass the session through so a recurring series that names its
        // occurrences separately shows THIS one's title, cover and times.
        // Omitted → the server falls back to the session the host has
        // started, then to the series, which is the pre-existing behaviour.
        const res = await fetch(
          `${API_URL}/public/webinar/validate?id=${webinarId}` +
            (urlSessionDate
              ? `&sessionDate=${encodeURIComponent(urlSessionDate)}`
              : "")
        );
        const data = await res.json();

        if (!data.success || !data.webinar) {
          setPageState("invalid");
          return;
        }

        setWebinarDetails(data.webinar);

        // Bat246 "05" hidden code — skip email+OTP entirely, straight to a
        // name-only screen. Checked before the isAuthenticated() branch so
        // it takes priority even for a returning signed-in visitor.
        //
        // Gated on the org, not just the query param: ?noreg=1 is only
        // meaningful for Bat246 (see demo-host-join's own org check on the
        // backend, the real security boundary). Without this check here,
        // anyone who happened to have "?noreg=1" on ANY webinar link — a
        // forwarded URL, a bookmark, curiosity — would see this screen
        // instead of the normal one, even though the backend would still
        // correctly reject them. Matching the org here keeps every other
        // webinar's UI identical to before this feature existed.
        if (isDemoNoRegRequest && data.webinar.orgId === BAT246_ORG_ID) {
          setPageState("demo-name-entry");
          return;
        }

        // ONLY for gotobigwin / Bat246:
        // Skip email+OTP entirely. Guests enter their name and join directly without an OTP.
        // Returning guests resume their stored session automatically.
        const isGotobigwin =
          data.webinar.orgId === BAT246_ORG_ID ||
          (typeof window !== "undefined" &&
            /(^|\.)gotobigwin\.com$/i.test(window.location.hostname));

        if (isGotobigwin) {
          const session = readBat246GuestSession(webinarId);
          if (session) {
            setGuestToken(session.token);
            setDisplayName(session.displayName);
            if (data.webinar.isLive) {
              setPageState("joining");
              onJoinReady(session.token, session.displayName, affiliateId || "");
            } else {
              setPageState("not-started");
            }
            return;
          }

          setPageState("invite-name-entry");
          return;
        }

        // Already logged in? Skip email+OTP and jump straight to the
        // paid-enrolment gate. This keeps the paywall, not-yet-started,
        // session-choice, and wrong-session screens reachable for
        // returning users without forcing them through a second OTP.
        // Expired tokens fall through to email-entry so the user can
        // re-verify — isAuthenticated() bakes in the expiry check.
        if (isAuthenticated()) {
          setPageState("gating");
          await runPrepareJoin(getToken() || undefined, urlSessionDate);
          return;
        }

        setPageState("email-entry");
      } catch {
        setPageState("invalid");
      }
    }

    validate();
  }, [webinarId, isDemoNoRegRequest, urlSessionDate]);

  // ── Fetch referrer info ────────────────────────────────────────────────

  useEffect(() => {
    if (!affiliateId) return;

    async function fetchReferrer() {
      try {
        const res = await fetch(
          `${API_URL}/affiliate/referrer-info?affiliateId=${affiliateId}`
        );
        const data = await res.json();
        if (data.success && data.referrer) {
          setReferrer(data.referrer);
        }
      } catch {
        // non-critical
      }
    }

    fetchReferrer();
  }, [affiliateId]);

  // ── Fetch public workshop metadata (pricing, enrolments, commission) ───

  useEffect(() => {
    if (!webinarId) return;

    async function fetchPublicMeta() {
      try {
        const res = await fetch(`${API_URL}/public/workshops/${webinarId}`);
        const data = await res.json();
        if (data?.success && data.workshop) setPublicMeta(data.workshop);
      } catch {
        // non-critical — the card degrades to hiding those rows
      }
    }

    fetchPublicMeta();
  }, [webinarId]);

  // ── Resolve the org's public slug (for the guest-office fallback) ───────

  useEffect(() => {
    const orgId = publicMeta?.organization?._id;
    if (!orgId) return;
    let cancelled = false;

    fetch(`${API_URL}/public/hq-organizations/${orgId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.success && d.organization?.slug)
          setOrgSlug(d.organization.slug);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [publicMeta?.organization?._id]);

  // ── Resolve the viewer's own affiliate id ──────────────────────────────
  //
  // /affiliate/my-affiliate-id mints an id for any authenticated user who
  // doesn't have one yet, so a signed-in viewer always has an affiliate
  // link available — the only reason this comes back empty is a failed or
  // not-yet-finished request. It's behind requireAuth, so webinar-scoped
  // guest tokens can't use it.
  const resolveOwnAffiliateId = useCallback(async (): Promise<string> => {
    if (ownAffiliateId) return ownAffiliateId;
    const token = getToken();
    if (!token || !isAuthenticated()) return "";

    try {
      const res = await fetch(`${API_URL}/affiliate/my-affiliate-id`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data?.success && data.affiliateId) {
        setOwnAffiliateId(data.affiliateId);
        return data.affiliateId as string;
      }
    } catch (err) {
      console.warn("[affiliate] could not resolve own affiliate id:", err);
    }
    return "";
  }, [ownAffiliateId]);

  // Warm it up front so the share control renders with the id already in
  // hand. Re-runs when the viewer signs in — OTP verify is when a visitor
  // first gains a real token, and `isSignedIn` flips right after it.
  useEffect(() => {
    resolveOwnAffiliateId();
  }, [guestToken, isSignedIn, resolveOwnAffiliateId]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleRequestOtp = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/public/webinar/join-request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webinarId, email: email.trim() }),
      });
      const data = await res.json();

      if (!data.success) {
        toast.error(data.message || "Failed to send verification code");
        setIsSubmitting(false);
        return;
      }

      toast.success("Verification code sent to your email");
      setPageState("otp-verify");
    } catch {
      toast.error("Failed to send verification code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = useCallback(async () => {
    if (!email.trim()) {
      toast.error("Please enter your email");
      return;
    }
    // Skip the interstitial "Verify Your Email → Send Verification Code"
    // page — fire the OTP immediately and jump straight to the code-entry
    // screen. One click instead of two, no information lost (the buyer
    // already typed their email on the previous card).
    await handleRequestOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/public/webinar/join-verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webinarId,
          email: email.trim(),
          otp,
          ...(affiliateId ? { affiliateId } : {}),
          displayName: displayName.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        toast.error(data.message || "Invalid verification code");
        setIsSubmitting(false);
        return;
      }

      setGuestToken(data.token);
      // If the backend resolved this email to a real User, persist the JWT
      // to localStorage so authenticated endpoints (e.g. /api/invoices/generate
      // used by in-webinar Buy Now) see a logged-in session. For a guest-only
      // token (no underlying User), skip — it's webinar-socket-scoped.
      if (data.token && data.userId) {
        saveToken(data.token);
        if (data.orgId) saveOrgId(data.orgId);
      }
      if (data.displayName) setDisplayName(data.displayName);
      if (data.userAffiliateId) setUserAffiliateId(data.userAffiliateId);
      toast.success("Email verified!");

      // Bat246 funnel — bypasses the paid-enrolment gate entirely (this
      // isn't a paid session). No separate name-entry step either: use the
      // name the backend resolved, falling back to the email's local part
      // so this stays strictly email+OTP, nothing else to fill in.
      if (isBat246Webinar) {
        const name =
          (data.displayName as string | undefined)?.trim() ||
          email.trim().split("@")[0] ||
          "Guest";
        setDisplayName(name);
        saveBat246GuestSession(webinarId, data.token, name);
        const live = await checkIsLive();
        if (live) {
          attemptEnterRoom(data.token, name, data.userAffiliateId || "");
        } else {
          // Not live yet — back to the funnel landing page, same as the
          // resumed-session branch above. This used to show a dedicated
          // "not live" screen in place instead, to dodge Welcome.tsx's
          // "redirect if authenticated" effect sending an OTP-verified
          // (now `isAuthenticated()`) visitor from "/" to /workspace — that
          // effect is now gated off for the Bat246 whitelabel domain, so
          // "/" is safe again and the funnel tile itself shows the
          // waiting/live status (see Bat246Landing.tsx).
          router.push("/");
        }
        return;
      }

      // Real-user path → run the paid-enrolment gate. Guest-token
      // path (no userId) falls back to today's behavior since we can't
      // authenticate against prepare-join.
      if (data.userId) {
        setPageState("gating");
        await runPrepareJoin(data.token, urlSessionDate);
      } else {
        setPageState("name-entry");
      }
    } catch {
      toast.error("Failed to verify code");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Paid-enrolment gate. Called once after OTP verify (with no
  // sessionDate — BE picks currentSessionDate or asks the FE to pick),
  // and again after the user selects a session in the picker.
  //
  // Response cases:
  //   { ready: true }                                    — pass to name-entry.
  //   { ready: false, needsSessionPick, upcomingSessions } — picker.
  //   { ready: false, invoiceId, sessionDate? }          — inline payment modal.
  const runPrepareJoin = async (
    tokenOverride?: string,
    sessionDate?: string,
    confirmPay?: boolean
  ) => {
    const authToken = tokenOverride || getToken();
    if (!authToken) {
      setPageState("name-entry");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/public/webinar/prepare-join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          webinarId,
          ...(sessionDate ? { sessionDate } : {}),
          ...(affiliateId ? { affiliateId } : {}),
          ...(confirmPay ? { confirmPay: true } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Prepare-join errored — do NOT fall through to name-entry. The
        // socket gate is our last line of defence but was historically
        // easy to bypass (currentSessionDate could be unset). Fail closed
        // to the invalid state so the buyer sees a clear error instead
        // of getting into the room.
        console.warn("[prepare-join] failed:", data);
        setPageState("invalid");
        return;
      }
      if (data.ready) {
        // Auto-join for logged-in users — their JWT already carries a
        // display name, so the "Almost There! Enter your display name"
        // screen is pure friction. Guests (no JWT) still see name-entry.
        // Belt-and-braces: check the mediasoup room is actually live
        // before dropping them in; otherwise fall to not-started which
        // polls every 10s. Prepare-join says "yes you're eligible" but
        // the room state can lag by seconds when the founder just
        // pressed Start.
        //
        // Placeholder-name guard: the BE OTP verify falls back to the
        // email local-part when a brand-new user has no `name` in their
        // User record and no `displayName` in the request body. We do
        // NOT want to bake that into the webinar attendee list — it
        // reads as "tenaupredipei-1504" or similar. When the JWT's
        // `name` equals `email.split("@")[0]`, force the name-entry
        // screen so the buyer types their real name before joining.
        const me = getUserDataFromToken();
        const emailLocalPart =
          me.email && me.email.includes("@")
            ? me.email.split("@")[0].trim().toLowerCase()
            : "";
        const nameLooksLikePlaceholder =
          !!me.name &&
          !!emailLocalPart &&
          me.name.trim().toLowerCase() === emailLocalPart;
        const hasRealName = !!me.name && !nameLooksLikePlaceholder;

        if (isAuthenticated() && authToken && hasRealName) {
          setDisplayName(me.name!);
          if (me.email) setEmail(me.email);
          const live = await checkIsLive();
          // NOTE: never fall back to `affiliateId` (the URL ?ref= value)
          // here — that's the SHARER's id, not this user's. It used to
          // leak into the room as "my affiliate id" and ended up on the
          // Invite button's copied link, crediting the original sharer
          // for invites sent by this user. Signed-in users get their own
          // id fetched by InviteButton instead.
          if (!live) {
            setGuestToken(authToken);
            setUserAffiliateId(userAffiliateId || "");
            setPageState("not-started");
            return;
          }
          setPageState("joining");
          onJoinReady(authToken, me.name!, userAffiliateId || "");
          return;
        }
        // Guest OR authenticated-but-placeholder-name → show name-entry.
        // Pre-populate the email so the "Email verified: X" pill on that
        // screen renders correctly for the auth'd-with-placeholder case.
        if (me.email) setEmail(me.email);
        setPageState("name-entry");
        return;
      }
      if (data.needsSessionPick) {
        setPrepareJoinSessions(data.upcomingSessions || []);
        setPageState("session-pick");
        return;
      }
      if (data.needsConfirmPay) {
        // Buyer paid for a DIFFERENT session — surface the situation
        // before creating a second invoice.
        setWrongSessionInfo({
          paidSessions: data.paidSessions || [],
          currentSessionDate: data.currentSessionDate || null,
        });
        if (data.currentSessionDate)
          setSelectedSessionDate(data.currentSessionDate);
        setPageState("wrong-session");
        return;
      }
      if (data.needsSessionChoice) {
        // Buyer has access to both a currently-live session and an
        // upcoming session they specified in the URL — let them pick.
        setSessionChoiceInfo({
          liveOption: data.liveOption,
          upcomingOption: data.upcomingOption,
        });
        setPageState("session-choice");
        return;
      }
      if (data.notYetStarted) {
        // Buyer paid for a future session that hasn't reached its start
        // time yet (or already ended). Render a come-back-later screen.
        setNotYetStartedInfo({
          sessionDate: data.sessionDate,
          startDateTime: data.startDateTime,
          endDateTime: data.endDateTime,
          alreadyEnded: !!data.alreadyEnded,
        });
        setPageState("session-not-yet-started");
        return;
      }
      if (data.invoiceId) {
        setPendingInvoiceId(data.invoiceId);
        // Capture the stage/step metadata so the inline modal can render a
        // "Step X of Y" banner. Community + workshop flows both flow
        // through this branch — differentiated by data.stage.
        if (data.stage && data.totalSteps) {
          setPendingInvoiceMeta({
            stage: data.stage,
            stepNumber: data.stepNumber || 1,
            totalSteps: data.totalSteps,
            itemName: data.itemName || "",
            itemPrice: Number(data.itemPrice || 0),
            itemCurrency: data.itemCurrency || "USD",
          });
        } else {
          setPendingInvoiceMeta(null);
        }
        if (data.sessionDate) setSelectedSessionDate(data.sessionDate);
        setPageState("invoice-payment");
        return;
      }
      // Unknown shape — fail closed to the invalid state, not name-entry.
      console.warn("[prepare-join] unexpected response shape:", data);
      setPageState("invalid");
    } catch (err) {
      console.error("[prepare-join] network error:", err);
      setPageState("invalid");
    }
  };

  // ── Inline invoice payment callback ───────────────────────────────────
  // Replaced the old cross-frame postMessage listener now that the payment
  // UI renders inline via <CheckoutPaymentStep>. onSuccess re-runs
  // prepare-join, which picks up the NEXT chained invoice (community →
  // workshop) or advances to name-entry when nothing else is due.
  //
  // NOTE: no onCancel handler is wired. The founder explicitly killed
  // the "cancel escape hatch" that dropped buyers back to name-entry
  // without paying (see the old iframe modal — its InvoicePayPage never
  // posted invoice:closed either, so the parent's invoice:closed branch
  // was dead code). Omitting onCancel here also suppresses the internal
  // "Cancel payment" text button that <CheckoutPaymentStep> renders when
  // an onCancel prop is present. Buyers who bail mid-payment can just
  // close the tab.
  const handleInvoicePaidInline = useCallback(() => {
    setPageState("gating");
    setPendingInvoiceId(null);
    setPendingInvoiceMeta(null);
    runPrepareJoin(undefined, selectedSessionDate || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionDate]);

  // Re-check isLive from server (used by handleJoin and auto-poll)
  const checkIsLive = useCallback(async (): Promise<boolean> => {
    try {
      // Same session scoping as the initial validate — this poll REPLACES
      // webinarDetails, so dropping it would revert an edited session's title
      // back to the series the moment the live check ran.
      const session = selectedSessionDate || urlSessionDate;
      const res = await fetch(
        `${API_URL}/public/webinar/validate?id=${webinarId}` +
          (session ? `&sessionDate=${encodeURIComponent(session)}` : "")
      );
      const data = await res.json();
      if (data.success && data.webinar) {
        setWebinarDetails(data.webinar);
        return data.webinar.isLive;
      }
    } catch {
      // ignore
    }
    return false;
  }, [webinarId, selectedSessionDate, urlSessionDate]);

  // Bat246 "knock" — the visitor is verified and the webinar is confirmed
  // live, but entry itself waits on the host. Replaces every direct
  // onJoinReady() call on the Bat246 path (see BAT246_ORG_ID) once isLive
  // is true. WebinarRoomClient's own webinar:joinRoom flow is completely
  // unmodified — this only decides whether it's allowed to fire.
  //
  // connectWebinarSocket() is a module-level singleton (see lib/socket.ts):
  // this opens it early to knock, and when WebinarRoomClient calls the same
  // helper a moment later (after approval), it gets back this exact
  // already-connected socket and just emits webinar:joinRoom on it — no
  // second connection.
  const attemptEnterRoom = useCallback(
    (token: string, name: string, userAffId: string) => {
      knockCancelledRef.current = false;
      setPageState("waiting-for-host");

      const socket = connectWebinarSocket(token);

      const detach = () => {
        socket.off("webinar:joinApproved", onApproved);
        socket.off("webinar:joinDenied", onDenied);
        knockListenersRef.current = null;
      };

      const onApproved = (payload: { requestId: string }) => {
        if (knockCancelledRef.current) return;
        if (payload?.requestId !== pendingRequestIdRef.current) return;
        detach();
        pendingRequestIdRef.current = null;
        setPageState("joining");
        onJoinReady(token, name, userAffId);
      };

      const onDenied = (payload: { requestId: string; reason?: string }) => {
        if (knockCancelledRef.current) return;
        if (payload?.requestId !== pendingRequestIdRef.current) return;
        detach();
        pendingRequestIdRef.current = null;
        toast.info(
          payload?.reason === "timeout"
            ? "The host didn't respond in time."
            : "The host didn't let you in."
        );
        router.push("/");
      };

      socket.on("webinar:joinApproved", onApproved);
      socket.on("webinar:joinDenied", onDenied);
      knockListenersRef.current = { approved: onApproved, denied: onDenied };

      socket.emit(
        "webinar:requestJoin",
        { webinarId, displayName: name },
        (res: { success: boolean; requestId?: string; error?: string }) => {
          if (knockCancelledRef.current) return;
          if (!res?.success || !res.requestId) {
            detach();
            toast.info(
              res?.error === "NO_HOST"
                ? "The host isn't available right now — please try again shortly."
                : "Couldn't reach the host — please try again."
            );
            router.push("/");
            return;
          }
          pendingRequestIdRef.current = res.requestId;
        }
      );
    },
    [webinarId, onJoinReady, router]
  );

  // Unmount safety net: if the visitor navigates away (or this component
  // is torn down some other way) mid-knock, drop the listeners from the
  // shared webinar socket so they can never fire into a dead component.
  useEffect(() => {
    return () => {
      knockCancelledRef.current = true;
      const listeners = knockListenersRef.current;
      const socket = getWebinarSocket();
      if (listeners && socket) {
        socket.off("webinar:joinApproved", listeners.approved);
        socket.off("webinar:joinDenied", listeners.denied);
      }
    };
  }, []);

  // "Cancel" on the waiting-for-host card — visitor backs out before the
  // host responds.
  const handleCancelKnock = useCallback(() => {
    knockCancelledRef.current = true;
    const requestId = pendingRequestIdRef.current;
    if (requestId) {
      connectWebinarSocket().emit("webinar:cancelJoinRequest", { requestId });
    }
    pendingRequestIdRef.current = null;
    router.push("/");
  }, [router]);

  const handleJoin = async () => {
    if (!displayName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (!guestToken) {
      toast.error("Session expired. Please verify again.");
      setPageState("email-entry");
      return;
    }

    // Re-check with server whether webinar is live before joining
    setIsSubmitting(true);
    const live = await checkIsLive();
    setIsSubmitting(false);

    if (!live) {
      setPageState("not-started");
      toast.info("You're all set! Waiting for the host to start the webinar.");
      return;
    }

    setPageState("joining");
    onJoinReady(guestToken, displayName.trim(), userAffiliateId);
  };

  // Bat246 "05" hidden code — mints a demo-host token and joins directly.
  // Deliberately skips checkIsLive(): this call IS what makes the webinar
  // live (see webinar:joinRoom in mediasoupHandlers.ts), so gating on
  // "is it live yet" would deadlock it. The server still independently
  // verifies eligibility (org check in demo-host-join) — this screen
  // reaching submit is not itself a grant of anything.
  const handleDemoHostJoin = async () => {
    if (!displayName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/public/webinar/demo-host-join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webinarId, displayName: displayName.trim() }),
      });
      const data = await res.json();

      if (!data.success || !data.token) {
        toast.error(data.message || "Couldn't start the meeting");
        setIsSubmitting(false);
        return;
      }

      setGuestToken(data.token);
      setPageState("joining");
      onJoinReady(data.token, displayName.trim(), "");
    } catch {
      toast.error("Couldn't start the meeting");
      setIsSubmitting(false);
    }
  };

  // Guest join from invite link or Bat246 — name only, no email/OTP.
  const handleInviteGuestJoin = async () => {
    if (!displayName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/public/webinar/join-anonymous`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webinarId,
          displayName: displayName.trim(),
          ...(affiliateId ? { affiliateId } : {}),
        }),
      });
      const data = await res.json();

      if (!data.success || !data.token) {
        toast.error(data.message || "Couldn't join the webinar");
        setIsSubmitting(false);
        return;
      }

      const name = data.displayName || displayName.trim();
      setGuestToken(data.token);
      setDisplayName(name);
      saveBat246GuestSession(webinarId, data.token, name);

      const live = await checkIsLive();
      if (live) {
        setPageState("joining");
        onJoinReady(data.token, name, affiliateId || "");
      } else {
        setPageState("not-started");
      }
    } catch {
      toast.error("Couldn't join the webinar");
      setIsSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const live = await checkIsLive();
    setIsRefreshing(false);

    if (live && guestToken && displayName.trim()) {
      toast.success("Webinar is now live! Joining...");
      setPageState("joining");
      onJoinReady(guestToken, displayName.trim(), userAffiliateId);
    }
  };

  // "Enter session" from the waiting-room card. Same server-truth check as
  // handleRefresh, but it always gives the buyer feedback: silently doing
  // nothing when the host still hasn't gone live reads as a broken button.
  const handleWaitingRoomJoin = useCallback(async () => {
    setIsRefreshing(true);
    const live = await checkIsLive();
    setIsRefreshing(false);

    if (!live) {
      // There is no room to enter yet, so "View enrolled webinar" goes to
      // the viewer's enrolled list in the workspace (Live → Enrolled)
      // instead of the dead-end "the host hasn't started" screen. Guests
      // holding a webinar-scoped token can't open the workspace, so they
      // keep the in-place notice.
      if (isAuthenticated()) {
        router.push(ENROLLED_WEBINARS_URL);
        return;
      }
      toast.info("The host hasn't started yet — we'll drop you in the moment they do.");
      return;
    }

    const token = guestToken || getToken();
    const name =
      displayName.trim() || (getUserDataFromToken().name || "").trim();

    // Live, but we're missing an identity to join with — send them back
    // through the name step rather than into the room as an unnamed peer.
    if (!token || !name) {
      setPageState("name-entry");
      return;
    }

    setPageState("joining");
    onJoinReady(token, name, ownAffiliateId || userAffiliateId || "");
  }, [
    checkIsLive,
    guestToken,
    displayName,
    onJoinReady,
    ownAffiliateId,
    userAffiliateId,
    router,
  ]);

  // "Explore office" — the way out of an ended session.
  //
  // Membership itself is not created here: /public/webinar/prepare-join
  // already enrols every signed-in viewer into the workshop's office
  // before it can return `notYetStarted`, and join-verify-otp does the
  // same for guests. So this only has to (a) get the viewer signed in and
  // (b) point their session at the right office.
  //
  //   not signed in            → back through the existing email + OTP flow
  //   signed in, org is active → straight to /workspace
  //   signed in, other org     → POST /auth/select-org, then /workspace
  //   select-org rejects them  → public guest office at /guest/{slug}
  const handleExploreOffice = useCallback(async () => {
    const orgId = publicMeta?.organization?._id || null;
    const guestOfficeUrl = orgSlug
      ? `/guest/${orgSlug}${affiliateId ? `?ref=${affiliateId}` : ""}`
      : null;

    if (!isAuthenticated()) {
      // Verifying the email is what enrols them in the office, so send
      // them through the flow this component already owns.
      toast.info("Verify your email to open this office");
      setPageState("email-entry");
      return;
    }

    const token = getToken();
    if (!token || !orgId) {
      router.push(guestOfficeUrl || "/browse-hqs");
      return;
    }

    // Already the active org on this token — nothing to switch.
    if (getUserDataFromToken().orgId === orgId) {
      router.push("/workspace");
      return;
    }

    setIsExploringOffice(true);
    try {
      const me = getUserDataFromToken();
      if (!me.userId) {
        router.push(guestOfficeUrl || "/browse-hqs");
        return;
      }

      // select-org is the membership check: it 400s when the user has no
      // membership row for this org, which is our cue to fall back to the
      // public office instead of dropping them into an empty workspace.
      const res = await fetch(`${API_URL}/auth/select-org`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: me.userId, orgId }),
      });
      const data = await res.json();

      if (!res.ok || !data.token) {
        router.push(guestOfficeUrl || "/browse-hqs");
        return;
      }

      saveToken(data.token);
      saveOrgId(orgId);
      router.push("/workspace");
    } catch {
      router.push(guestOfficeUrl || "/browse-hqs");
    } finally {
      setIsExploringOffice(false);
    }
  }, [publicMeta?.organization?._id, orgSlug, affiliateId, router]);

  // Auto-poll every 10s on the not-started screen.
  useEffect(() => {
    if (pageState !== "not-started") return;

    const interval = setInterval(async () => {
      const live = await checkIsLive();
      if (live && guestToken && displayName.trim()) {
        toast.success("Webinar is now live! Joining...");
        setPageState("joining");
        onJoinReady(guestToken, displayName.trim(), userAffiliateId);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [pageState, guestToken, displayName, checkIsLive, onJoinReady, userAffiliateId]);

  // ── Date/time formatting ───────────────────────────────────────────────

  const formatDateTime = (dateString: string, tz?: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      ...(tz ? { timeZone: tz } : {}),
    }).format(date);
  };

  // When the URL specifies ?sessionDate=YYYY-MM-DD, the "Join Webinar"
  // card should reflect THAT session's date/time — not the workshop's
  // originally-scheduled first occurrence (which is what
  // webinarDetails.startTime holds). Assembles "Weekday, Month DD, YYYY
  // at HH:MM AM/PM" from urlSessionDate + the workshop's startTimeStr,
  // matching the format formatDateTime already produces.
  const formatSessionDisplay = () => {
    if (!webinarDetails) return "";
    if (urlSessionDate && webinarDetails.startTimeStr) {
      try {
        const [y, m, d] = urlSessionDate.split("-").map(Number);
        // Noon of the target UTC day — safe from month/year boundary
        // rollover when the browser's local tz is far from UTC.
        const dateOnly = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
        const dateStr = new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        }).format(dateOnly);
        const [hh, mm] = webinarDetails.startTimeStr.split(":").map(Number);
        const timeShim = new Date(2000, 0, 1, hh || 0, mm || 0);
        const timeStr = new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }).format(timeShim);
        return `${dateStr} at ${timeStr}`;
      } catch {
        // fall through to default
      }
    }
    return formatDateTime(webinarDetails.startTime, webinarDetails.timezone);
  };

  const getTimezoneBadge = (tz?: string) => {
    if (!tz) return null;
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "short",
      }).formatToParts(new Date());
      return parts.find((p) => p.type === "timeZoneName")?.value || null;
    } catch {
      return null;
    }
  };

  // ── Derived data for the waiting-room card ─────────────────────────────

  /**
   * Absolute start/end instants for the session the viewer is waiting on.
   *
   * Three sources, most-specific first:
   *   1. prepare-join's `notYetStartedInfo` — already absolute ISO strings
   *      resolved server-side for the exact session the buyer paid for.
   *   2. `urlSessionDate` (?sessionDate=YYYY-MM-DD) + the workshop's
   *      `startTimeStr`/`endTimeStr` wall clock, resolved in the host's
   *      timezone.
   *   3. The workshop's own scheduled `startTime`, with the wall-clock
   *      strings layered on when both they and a timezone are known.
   *
   * Returns null when nothing parseable is available, in which case the
   * caller falls back to the legacy card.
   */
  const sessionWindow = useMemo((): { start: Date; end: Date | null } | null => {
    if (notYetStartedInfo) {
      const start = new Date(notYetStartedInfo.startDateTime);
      if (Number.isFinite(start.getTime())) {
        const end = notYetStartedInfo.endDateTime
          ? new Date(notYetStartedInfo.endDateTime)
          : null;
        return {
          start,
          end: end && Number.isFinite(end.getTime()) ? end : null,
        };
      }
    }

    if (!webinarDetails) return null;

    const tz = webinarDetails.timezone || null;
    const startClock = parseWallClock(webinarDetails.startTimeStr);
    const endClock = parseWallClock(webinarDetails.endTimeStr);

    // Which calendar day? The URL's session date wins over the workshop's
    // originally-scheduled first occurrence for recurring workshops.
    let ymd = parseCalendarDate(urlSessionDate);
    const scheduled = new Date(webinarDetails.startTime);
    const scheduledValid = Number.isFinite(scheduled.getTime());

    if (!ymd) {
      if (!scheduledValid) return null;
      // Read the day *in the host's timezone* — a date stored as UTC
      // midnight otherwise rolls back a day for hosts west of Greenwich.
      ymd = tz
        ? ymdInTimeZone(scheduled, tz)
        : {
            year: scheduled.getFullYear(),
            month: scheduled.getMonth() + 1,
            day: scheduled.getDate(),
          };
    }

    // No wall clock or no timezone → the stored instant is the best we have.
    if (!startClock || !tz) {
      return scheduledValid ? { start: scheduled, end: null } : null;
    }

    const start = zonedTimeToUtc(
      ymd.year,
      ymd.month,
      ymd.day,
      startClock.hour,
      startClock.minute,
      tz
    );

    let end: Date | null = null;
    if (endClock) {
      end = zonedTimeToUtc(
        ymd.year,
        ymd.month,
        ymd.day,
        endClock.hour,
        endClock.minute,
        tz
      );
      // Sessions that run past midnight land on the next calendar day.
      if (end.getTime() <= start.getTime()) {
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    return { start, end };
  }, [notYetStartedInfo, webinarDetails, urlSessionDate]);

  /** Pricing block — `price` is the single source of truth (0 = free). */
  const cardPricing = useMemo(() => {
    if (!publicMeta) return null;
    const currency = publicMeta.currency || "USD";
    if (publicMeta.isFree) return { isFree: true, price: 0, currency };
    const effective = Number(publicMeta.price || 0);
    if (!Number.isFinite(effective)) return null;
    return { isFree: effective <= 0, price: effective, currency };
  }, [publicMeta]);

  const cardCommission = useMemo(() => {
    const plan = publicMeta?.combPlan;
    if (!plan || !plan.levels?.length) return null;
    return {
      name: plan.name,
      levels: plan.levels,
      totalPercentage:
        plan.totalPercentage ??
        plan.levels.reduce((sum, l) => sum + (l.percentage || 0), 0),
    };
  }, [publicMeta]);

  /**
   * Avatar stack. Only people we can actually attribute to this session go
   * in — the inviter, the host, and the viewer once they've verified. The
   * headline count next to it is the backend's real registration total.
   */
  const cardPeople = useMemo((): SessionPerson[] => {
    const list: SessionPerson[] = [];
    const seen = new Set<string>();
    const push = (person: SessionPerson) => {
      const key = (person.id || person.name).toLowerCase();
      if (!person.name || seen.has(key)) return;
      seen.add(key);
      list.push(person);
    };

    if (referrer) {
      push({
        id: referrer.id,
        name: referrer.name,
        profilePicture: referrer.profilePicture || null,
        caption: "invited you",
      });
    }
    const hostAvatar = publicMeta?.creator?.profilePicture || null;
    if (webinarDetails?.hostName) {
      push({
        id: publicMeta?.creator?._id,
        name: webinarDetails.hostName,
        profilePicture: hostAvatar,
        caption: "host",
      });
    }
    if (displayName.trim()) {
      push({ name: displayName.trim(), caption: "you" });
    }
    return list;
  }, [referrer, publicMeta, webinarDetails, displayName]);

  const enrolledCount =
    typeof publicMeta?.registeredParticipants === "number"
      ? publicMeta.registeredParticipants
      : null;

  /**
   * Single renderer for the session card, shared by every pre-join state.
   *
   * Passing `authForm` turns it into the sign-in surface, so an unverified
   * visitor sees the same session details (countdown, schedule, pricing,
   * social proof) as an enrolled one instead of a bare email box.
   *
   * Returns null when the schedule can't be resolved, which is the signal
   * for each caller to fall back to its legacy card.
   */
  const renderSessionCard = (
    options: {
      authForm?: ReactNode;
      alreadyEnded?: boolean;
      isChecking?: boolean;
      // True once the viewer has cleared /prepare-join — i.e. any state
      // reached after the paid-enrolment gate said yes. The email and OTP
      // screens sit *before* that gate, so they leave it false.
      isEnrolled?: boolean;
      onJoin?: () => void;
      onExpire?: () => void;
      onExploreOffice?: () => void;
    } = {}
  ) => {
    if (!sessionWindow || !webinarDetails) return null;
    return (
      <SessionNotStartedCard
        webinarId={webinarId}
        title={webinarDetails.title}
        description={webinarDetails.description}
        coverPhoto={webinarDetails.coverPhoto}
        hostName={webinarDetails.hostName}
        hostProfilePicture={publicMeta?.creator?.profilePicture || null}
        orgName={webinarDetails.orgName}
        orgIcon={webinarDetails.orgIcon}
        brandColor={brandColor}
        timezone={webinarDetails.timezone}
        startDate={sessionWindow.start}
        endDate={sessionWindow.end}
        isLive={webinarDetails.isLive}
        enrolledCount={enrolledCount}
        pricing={cardPricing}
        commission={cardCommission}
        people={cardPeople}
        speakers={webinarDetails.speakers?.map((sp) => ({
          id: sp.id,
          name: sp.name,
          profilePicture: sp.avatar || null,
          caption: sp.title || undefined,
        }))}
        affiliateId={ownAffiliateId || userAffiliateId || ""}
        resolveAffiliateId={resolveOwnAffiliateId}
        inviterName={referrer?.name || null}
        inviterAvatar={referrer?.profilePicture || null}
        isExploringOffice={isExploringOffice}
        {...options}
      />
    );
  };

  // ── Render: Loading ────────────────────────────────────────────────────

  if (
    pageState === "loading" ||
    pageState === "joining" ||
    pageState === "gating"
  ) {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2
            className="h-12 w-12 animate-spin mx-auto"
            style={{ color: brandColor }}
          />
          <p className="text-zinc-500">
            {pageState === "joining"
              ? "Joining webinar..."
              : pageState === "gating"
              ? "Checking your access..."
              : "Validating webinar link..."}
          </p>
        </div>
      </div>
    );
  }

  // ── Render: Invalid ────────────────────────────────────────────────────

  if (pageState === "invalid") {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#111116] border-red-900/50">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <CardTitle className="text-2xl text-white">
              Invalid Webinar Link
            </CardTitle>
            <CardDescription className="text-zinc-500">
              This webinar link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => router.push("/")}
              className="w-full bg-zinc-800 hover:bg-white/15"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render: Not Started ────────────────────────────────────────────────

  if (pageState === "not-started") {
    // Modern waiting-room card. Needs a resolvable start instant for the
    // countdown, dual-timezone row, and calendar export — when the
    // workshop has no parseable schedule at all we fall through to the
    // legacy refresh card below.
    const card = renderSessionCard({
      isEnrolled: true,
      isChecking: isRefreshing,
      onJoin: handleWaitingRoomJoin,
      onExpire: handleRefresh,
      // Signed-in only: handleExploreOffice needs a real session to switch
      // orgs with. Guests would just be bounced back to the email step,
      // which isn't worth a button. Also suppressed for the Bat246 funnel
      // org — see BAT246_ORG_ID.
      onExploreOffice: isSignedIn && !hideExploreOffice ? handleExploreOffice : undefined,
    });
    if (card) return card;

    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`w-full my-auto ${webinarDetails?.coverPhoto ? "max-w-5xl" : "max-w-lg"}`}
        >
          <Card className="bg-[#111116] border-[#2a2a35] overflow-hidden">
            <div
              className={
                webinarDetails?.coverPhoto ? "grid md:grid-cols-[1fr_1fr]" : ""
              }
            >
              {/* Left column - Cover Photo */}
              {webinarDetails?.coverPhoto && (
                <div className="flex flex-col bg-zinc-950">
                  <div className="relative flex-1 flex items-center justify-center">
                    <img
                      src={webinarDetails.coverPhoto}
                      alt={webinarDetails.title || "Webinar cover"}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  {referrer && (
                    <div
                      className="flex items-center justify-center gap-3 px-4 py-3"
                      style={{
                        backgroundColor: `${brandColor}1A`,
                        borderTop: `1px solid ${brandColor}33`,
                      }}
                    >
                      {referrer.profilePicture ? (
                        <img
                          src={referrer.profilePicture}
                          alt={referrer.name}
                          className="h-8 w-8 rounded-full object-cover border-2"
                          style={{ borderColor: `${brandColor}4D` }}
                        />
                      ) : (
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center border-2"
                          style={{
                            backgroundColor: `${brandColor}33`,
                            borderColor: `${brandColor}4D`,
                          }}
                        >
                          <User
                            className="h-4 w-4"
                            style={{ color: brandColor }}
                          />
                        </div>
                      )}
                      <InviteLine name={referrer.name} orgName={webinarDetails?.orgName} brandColor={brandColor} />
                    </div>
                  )}
                </div>
              )}

              {/* Right column - Status & Details */}
              <div className="p-6 md:p-8 flex flex-col justify-center">
                <div className="text-center mb-6">
                  <div className="mx-auto w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                    <Clock className="h-8 w-8 text-blue-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">
                    Webinar Not Started Yet
                  </h2>
                  <p className="text-zinc-500 text-sm mt-1">
                    The host hasn&apos;t started the webinar yet. Please wait
                    and refresh to check.
                  </p>
                </div>

                {email && (
                  <div className="flex items-center gap-2 p-3 bg-[#1a1a20] border border-[#2a2a35] rounded-lg mb-4">
                    <Mail className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-300 text-sm">
                      Joining as: {email}
                    </span>
                  </div>
                )}

                {/* Webinar Details */}
                <div
                  className="rounded-lg p-4 mb-6"
                  style={{
                    backgroundColor: `${brandColor}1A`,
                    border: `1px solid ${brandColor}33`,
                  }}
                >
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {webinarDetails?.title}
                  </h3>
                  {webinarDetails?.description &&
                    webinarDetails.description !== webinarDetails.title && (
                      // Descriptions come from a rich-text editor, so this is
                      // an HTML fragment. Flatten it — printing it raw shows
                      // the tags, and dangerouslySetInnerHTML would inject
                      // host-authored markup into the join page.
                      <p className="mb-3 whitespace-pre-line text-sm text-zinc-300">
                        {htmlToPlainLines(webinarDetails.description)}
                      </p>
                    )}
                  <div className="space-y-2">
                    <div className="flex items-start gap-3 text-sm">
                      <Calendar
                        className="h-4 w-4 flex-shrink-0 mt-0.5"
                        style={{ color: brandColor }}
                      />
                      <span className="text-zinc-300">
                        {webinarDetails && formatSessionDisplay()}
                        {webinarDetails?.timezone &&
                          getTimezoneBadge(webinarDetails.timezone) && (
                            <span
                              className="ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium align-middle"
                              style={{
                                backgroundColor: `${brandColor}33`,
                                color: brandColor,
                              }}
                            >
                              {getTimezoneBadge(webinarDetails.timezone)}
                            </span>
                          )}
                      </span>
                    </div>
                    {webinarDetails?.hostName && (
                      <div className="flex items-center gap-3 text-sm">
                        <User
                          className="h-4 w-4 flex-shrink-0"
                          style={{ color: brandColor }}
                        />
                        <span className="text-zinc-300">
                          Hosted by {webinarDetails.hostName}
                        </span>
                      </div>
                    )}
                    {!!webinarDetails?.speakers?.length && (
                      <div className="flex items-center gap-3 text-sm">
                        <Users
                          className="h-4 w-4 flex-shrink-0"
                          style={{ color: brandColor }}
                        />
                        <span className="text-zinc-300">
                          Speakers: {webinarDetails.speakers.map((sp) => sp.name).join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="w-full h-12 text-lg text-white"
                  style={{ backgroundColor: brandColor }}
                >
                  {isRefreshing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── Render: Email Entry — Bat246 funnel, basic popup ───────────────────
  //
  // Intercepts before the full session card (photo/schedule/pricing/host)
  // further below — a funnel visitor here just needs an email box, not the
  // whole card. See BAT246_ORG_ID.
  if (pageState === "email-entry" && isBat246Webinar) {
    const hasCover = !!webinarDetails?.coverPhoto;
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`w-full my-auto ${hasCover ? "max-w-3xl" : "max-w-sm"}`}
        >
          <Card className="bg-[#111116] border-[#2a2a35] overflow-hidden">
            <div className={hasCover ? "grid md:grid-cols-2" : ""}>
              {hasCover && (
                <div className="flex items-center justify-center bg-zinc-950 p-4 md:p-0">
                  <img
                    src={webinarDetails!.coverPhoto!}
                    alt={webinarDetails?.title || "Webinar"}
                    className="max-h-[70vh] w-full object-contain md:h-full"
                  />
                </div>
              )}
              <div className="p-6 md:p-8 flex flex-col justify-center">
                <div className="text-center mb-6">
                  <div
                    className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3"
                    style={{ backgroundColor: `${brandColor}33` }}
                  >
                    <Mail className="h-6 w-6" style={{ color: brandColor }} />
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    Join Webinar
                  </h2>
                  <p className="text-zinc-500 text-sm mt-1">
                    We&apos;ll send a 6-digit code to verify it&apos;s you
                  </p>
                </div>
                <div className="space-y-3">
                  <Input
                    id="basicEmail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && email.trim() && handleEmailSubmit()
                    }
                    placeholder="Enter your email"
                    className="h-11 bg-[#161620] border-[#262636] text-white placeholder:text-[#4b4b5b]"
                    autoFocus
                  />
                  <Button
                    onClick={handleEmailSubmit}
                    disabled={!email.trim() || isSubmitting}
                    className="h-11 w-full text-sm font-bold text-brand-foreground hover:brightness-95"
                    style={{ backgroundColor: "var(--brand)" }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending code...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Continue
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── Render: OTP Request ────────────────────────────────────────────────

  if (pageState === "otp-request") {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg my-auto"
        >
          <Card className="bg-[#111116] border-[#2a2a35]">
            <CardHeader className="text-center">
              <div
                className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: brandColor }}
              >
                <Shield className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl text-white">
                Verify Your Email
              </CardTitle>
              <CardDescription className="text-zinc-500">
                We&apos;ll send a verification code to{" "}
                <span className="text-white font-medium">{email}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-[#1a1a20] rounded-lg p-4 border border-[#2a2a35]">
                <h3 className="text-lg font-medium text-white mb-1">
                  {webinarDetails?.title}
                </h3>
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <Mail className="h-4 w-4" />
                  <span>{email}</span>
                </div>
              </div>

              <Button
                onClick={handleRequestOtp}
                disabled={isSubmitting}
                className="w-full h-12 text-lg text-white"
                style={{ backgroundColor: brandColor }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  <>
                    <Mail className="h-5 w-5 mr-2" />
                    Send Verification Code
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── Render: OTP Verify — Bat246 funnel, basic popup ─────────────────────
  //
  // Mirrors the email-entry popup above — intercepts before the full
  // session card. See BAT246_ORG_ID.
  if (pageState === "otp-verify" && isBat246Webinar) {
    const hasCover = !!webinarDetails?.coverPhoto;
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`w-full my-auto ${hasCover ? "max-w-3xl" : "max-w-sm"}`}
        >
          <Card className="bg-[#111116] border-[#2a2a35] overflow-hidden">
            <div className={hasCover ? "grid md:grid-cols-2" : ""}>
              {hasCover && (
                <div className="flex items-center justify-center bg-zinc-950 p-4 md:p-0">
                  <img
                    src={webinarDetails!.coverPhoto!}
                    alt={webinarDetails?.title || "Webinar"}
                    className="max-h-[70vh] w-full object-contain md:h-full"
                  />
                </div>
              )}
              <div className="p-6 md:p-8 flex flex-col justify-center">
                <div className="text-center mb-6">
                  <div
                    className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3"
                    style={{ backgroundColor: `${brandColor}33` }}
                  >
                    <Shield className="h-6 w-6" style={{ color: brandColor }} />
                  </div>
                  <h2 className="text-xl font-bold text-white">Enter code</h2>
                  <p className="text-zinc-500 text-sm mt-1">
                    Sent to <span className="text-white">{email}</span>
                  </p>
                </div>
                <div className="space-y-3">
                  <Input
                    id="basicOtp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      otp.length === 6 &&
                      handleVerifyOtp()
                    }
                    placeholder="000000"
                    className="h-12 bg-[#161620] border-[#262636] text-center font-mono text-2xl tracking-[0.4em] text-white"
                    autoFocus
                  />
                  <Button
                    onClick={handleVerifyOtp}
                    disabled={isSubmitting || otp.length !== 6}
                    className="h-11 w-full text-sm font-bold text-brand-foreground hover:brightness-95"
                    style={{ backgroundColor: "var(--brand)" }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Verify &amp; continue
                      </>
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={isSubmitting}
                    className="w-full text-xs font-semibold text-[#6b6b7b] transition-colors hover:text-white"
                  >
                    Resend code
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── Render: Waiting for host — Bat246 knock ─────────────────────────────
  //
  // Same basic-popup card shell as the email/OTP screens above (image left
  // when there's a cover photo, content right). The visitor stays here
  // until the host approves (→ room) or denies (→ home), or they cancel.
  if (pageState === "waiting-for-host") {
    const hasCover = !!webinarDetails?.coverPhoto;
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`w-full my-auto ${hasCover ? "max-w-3xl" : "max-w-sm"}`}
        >
          <Card className="bg-[#111116] border-[#2a2a35] overflow-hidden">
            <div className={hasCover ? "grid md:grid-cols-2" : ""}>
              {hasCover && (
                <div className="flex items-center justify-center bg-zinc-950 p-4 md:p-0">
                  <img
                    src={webinarDetails!.coverPhoto!}
                    alt={webinarDetails?.title || "Webinar"}
                    className="max-h-[70vh] w-full object-contain md:h-full"
                  />
                </div>
              )}
              <div className="p-6 md:p-8 flex flex-col justify-center">
                <div className="text-center mb-6">
                  <div
                    className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3"
                    style={{ backgroundColor: `${brandColor}33` }}
                  >
                    <Loader2
                      className="h-6 w-6 animate-spin"
                      style={{ color: brandColor }}
                    />
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    Join Webinar
                  </h2>
                  <p className="text-zinc-500 text-sm mt-1">
                    Waiting for the host to let you in…
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCancelKnock}
                  className="w-full text-xs font-semibold text-[#6b6b7b] transition-colors hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── Render: OTP Verify ─────────────────────────────────────────────────

  if (pageState === "otp-verify") {
    const card = renderSessionCard({
      authForm: (
        <div className="space-y-3">
          <div>
            <Label htmlFor="otp" className="text-white">
              Verification code
            </Label>
            <p className="mt-0.5 text-xs text-[#6b6b7b]">
              6-digit code sent to{" "}
              <span className="text-[#9fa0b8]">{email}</span> · expires in 10
              minutes
            </p>
          </div>
          <Input
            id="otp"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            onKeyDown={(e) =>
              e.key === "Enter" && otp.length === 6 && handleVerifyOtp()
            }
            placeholder="000000"
            className="h-12 bg-[#161620] border-[#262636] text-center font-mono text-2xl tracking-[0.4em] text-white"
            autoFocus
          />
          <Button
            onClick={handleVerifyOtp}
            disabled={isSubmitting || otp.length !== 6}
            className="h-11 w-full text-sm font-bold text-brand-foreground hover:brightness-95"
            style={{ backgroundColor: "var(--brand)" }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Verify &amp; continue
              </>
            )}
          </Button>
          <button
            type="button"
            onClick={handleRequestOtp}
            disabled={isSubmitting}
            className="w-full text-xs font-semibold text-[#6b6b7b] transition-colors hover:text-white"
          >
            Resend code
          </button>
        </div>
      ),
    });
    if (card) return card;

    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg my-auto"
        >
          <Card className="bg-[#111116] border-[#2a2a35]">
            <CardHeader className="text-center">
              <div
                className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: brandColor }}
              >
                <Shield className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl text-white">
                Enter Verification Code
              </CardTitle>
              <CardDescription className="text-zinc-500">
                We sent a 6-digit code to{" "}
                <span className="text-white font-medium">{email}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  className="bg-[#1a1a20] border-[#2a2a35] text-white text-center text-3xl tracking-[0.5em] h-16 w-48 font-mono"
                  autoFocus
                />
              </div>

              <p className="text-center text-sm text-zinc-500">
                Code expires in 10 minutes
              </p>

              <Button
                onClick={handleVerifyOtp}
                disabled={isSubmitting || otp.length !== 6}
                className="w-full h-12 text-lg text-white"
                style={{ backgroundColor: brandColor }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Verify & Continue
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={handleRequestOtp}
                disabled={isSubmitting}
                className="w-full text-zinc-500 hover:text-white"
              >
                Resend Code
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── Render: Name Entry ─────────────────────────────────────────────────

  // Bat246 "05" hidden code — name only, no email/OTP, no pricing/enrolment
  // copy. Deliberately not routed through renderSessionCard: that helper
  // shows pricing/enrolment info this screen has no business asking about.
  if (pageState === "demo-name-entry") {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg my-auto"
        >
          <Card className="bg-[#111116] border-[#2a2a35]">
            <CardHeader className="text-center">
              <div
                className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: `${brandColor}33` }}
              >
                <Video className="h-8 w-8" style={{ color: brandColor }} />
              </div>
              <CardTitle className="text-2xl text-white">
                Start the meeting
              </CardTitle>
              <CardDescription className="text-zinc-500">
                Enter your name to begin
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="demoDisplayName" className="text-white">
                  Your Name *
                </Label>
                <Input
                  id="demoDisplayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    displayName.trim() &&
                    handleDemoHostJoin()
                  }
                  placeholder="Enter your name"
                  className="bg-[#0a0a0f] border-[#2a2a35] text-white"
                  autoFocus
                />
              </div>
              <Button
                onClick={handleDemoHostJoin}
                disabled={!displayName.trim() || isSubmitting}
                className="h-11 w-full text-sm font-bold text-brand-foreground hover:brightness-95"
                style={{ backgroundColor: "var(--brand)" }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Video className="mr-2 h-4 w-4" />
                    Start Meeting
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Guest entry via invite link or Bat246 — name only, no email/OTP.
  if (pageState === "invite-name-entry") {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg my-auto"
        >
          <Card className="bg-[#111116] border-[#2a2a35]">
            <CardHeader className="text-center">
              <div
                className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: `${brandColor}33` }}
              >
                <Video className="h-8 w-8" style={{ color: brandColor }} />
              </div>
              <CardTitle className="text-2xl text-white">
                {webinarDetails?.title || "Join Webinar"}
              </CardTitle>
              <CardDescription className="text-zinc-400">
                {referrer?.name
                  ? `${referrer.name} invited you to join as a guest`
                  : "Enter your name to join as a guest"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="guestDisplayName" className="text-white">
                  Your Name *
                </Label>
                <Input
                  id="guestDisplayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    displayName.trim() &&
                    handleInviteGuestJoin()
                  }
                  placeholder="Enter your name"
                  className="bg-[#0a0a0f] border-[#2a2a35] text-white"
                  autoFocus
                />
              </div>
              <Button
                onClick={handleInviteGuestJoin}
                disabled={!displayName.trim() || isSubmitting}
                className="h-11 w-full text-sm font-bold text-brand-foreground hover:brightness-95"
                style={{ backgroundColor: "var(--brand)" }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <Video className="mr-2 h-4 w-4" />
                    Join Webinar
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (pageState === "name-entry") {
    const card = renderSessionCard({
      // Access is already granted at this point — prepare-join cleared them
      // (or they're a guest on an open session). Only the display name is
      // still missing, so the card should say "Enrolled".
      isEnrolled: true,
      authForm: (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
            <p className="truncate text-xs text-[#9fa0b8]">
              Email verified: <span className="text-white">{email}</span>
            </p>
          </div>
          <div>
            <Label htmlFor="displayName" className="text-white">
              Your name *
            </Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && displayName.trim() && handleJoin()
              }
              placeholder="Enter your name"
              className="mt-1.5 h-11 bg-[#161620] border-[#262636] text-white placeholder:text-[#4b4b5b]"
              autoFocus
            />
          </div>
          <Button
            onClick={handleJoin}
            disabled={!displayName.trim() || isSubmitting}
            className="h-11 w-full text-sm font-bold text-brand-foreground hover:brightness-95"
            style={{ backgroundColor: "var(--brand)" }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Video className="mr-2 h-4 w-4" />
                Join webinar
              </>
            )}
          </Button>
        </div>
      ),
    });
    if (card) return card;

    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg my-auto"
        >
          <Card className="bg-[#111116] border-[#2a2a35]">
            <CardHeader className="text-center">
              <div
                className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: `${brandColor}33` }}
              >
                <CheckCircle className="h-8 w-8" style={{ color: brandColor }} />
              </div>
              <CardTitle className="text-2xl text-white">
                Almost There!
              </CardTitle>
              <CardDescription className="text-zinc-500">
                Enter your display name to join the webinar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                <p className="text-sm text-zinc-300">
                  Email verified: {email}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-white">
                  Your Name *
                </Label>
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && displayName.trim() && handleJoin()
                  }
                  placeholder="Enter your name"
                  className="bg-[#1a1a20] border-[#2a2a35] text-white placeholder:text-zinc-500 h-12 text-lg"
                  autoFocus
                />
              </div>

              <Button
                onClick={handleJoin}
                disabled={!displayName.trim() || isSubmitting}
                className="w-full h-12 text-lg text-white"
                style={{ backgroundColor: brandColor }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Video className="h-5 w-5 mr-2" />
                    Join Webinar
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── Render: Session hasn't started yet (paid buyer, session in future) ─
  // Early-return so this replaces the email-entry card entirely instead
  // of rendering next to it. Previously rendered inline as a flex sibling
  // of the email-entry Card inside the main return's <div>, which put
  // both cards side-by-side once payment completed.
  if (pageState === "session-not-yet-started" && notYetStartedInfo) {
    // Re-runs the paid-enrolment gate for THIS session — both when the
    // buyer taps the button and when the countdown reaches zero. The gate
    // owns the timing rules, so it's the only thing allowed to decide the
    // doors are actually open.
    const recheckSession = () => {
      setPageState("gating");
      runPrepareJoin(undefined, notYetStartedInfo.sessionDate);
    };

    // Fallback for the (unexpected) case where validate hasn't landed or
    // the session has no parseable start instant — the card can't render a
    // countdown or calendar entry without one.
    if (!sessionWindow || !webinarDetails) {
      return (
        <div className="min-h-screen bg-[#0a0a0e] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#2a2a35] bg-[#0e0e12] p-6 sm:p-8 text-center">
            <h1 className="text-lg sm:text-xl font-bold text-white mb-2">
              {notYetStartedInfo.alreadyEnded
                ? "This session has ended"
                : "This session hasn't started yet"}
            </h1>
            <p className="text-sm text-[#9fa0b8] mb-5">
              {notYetStartedInfo.alreadyEnded
                ? "The session you paid for is already over. If you need a recording, check with the host."
                : "You're enrolled — come back when the session starts."}
            </p>
            {notYetStartedInfo.alreadyEnded ? (
              // Bat246 funnel org: no "Explore office" (see
              // BAT246_ORG_ID), and "Check again" doesn't make
              // sense once the session has actually ended — so no button.
              hideExploreOffice ? null : (
                <button
                  onClick={handleExploreOffice}
                  disabled={isExploringOffice}
                  className="w-full px-4 py-2.5 rounded-lg text-sm font-bold bg-brand hover:brightness-95 text-brand-foreground transition-colors disabled:opacity-70"
                >
                  {isExploringOffice ? "Opening office…" : "Explore office"}
                </button>
              )
            ) : (
              <button
                onClick={recheckSession}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#1a1a22] hover:bg-[#252530] text-white border border-[#2a2a35] transition-colors"
              >
                Check again
              </button>
            )}
          </div>
        </div>
      );
    }

    return renderSessionCard({
      // Reaching this state *means* the buyer holds a seat — prepare-join
      // only reports notYetStarted for a session they already paid for.
      isEnrolled: true,
      alreadyEnded: !!notYetStartedInfo.alreadyEnded,
      // recheckSession flips pageState to "gating", which unmounts this
      // card in favour of the full-screen loader — so there's no in-place
      // pending state to render here.
      isChecking: false,
      // The seat is real but the session is in the future, so the CTA
      // sends signed-in buyers to their enrolled list rather than looping
      // them back through a gate that will just say "not yet" again. Once
      // the host is actually live, fall through to the gate so they join.
      onJoin: () => {
        if (!webinarDetails?.isLive && isAuthenticated()) {
          router.push(ENROLLED_WEBINARS_URL);
          return;
        }
        recheckSession();
      },
      onExpire: recheckSession,
      onExploreOffice: hideExploreOffice ? undefined : handleExploreOffice,
    });
  }

  // ── Render: Session choice (buyer has access to live-now AND upcoming) ─
  if (pageState === "session-choice" && sessionChoiceInfo) {
    return (
      <div className="min-h-screen bg-[#0a0a0e] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-[#2a2a35] bg-[#0e0e12] p-6 sm:p-8">
          <h1 className="text-lg sm:text-xl font-bold text-white mb-1 text-center">
            You have access to two sessions
          </h1>
          <p className="text-sm text-[#9fa0b8] mb-5 text-center">
            Which one do you want to join right now?
          </p>
          <div className="space-y-2 mb-5">
            <button
              onClick={() => {
                setSessionChoiceInfo(null);
                setPageState("gating");
                runPrepareJoin(
                  undefined,
                  sessionChoiceInfo.liveOption.sessionDate
                );
              }}
              className="w-full flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 px-4 py-3 text-left transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-0.5">
                  Live now
                </div>
                <div className="text-sm font-semibold text-white truncate">
                  {new Intl.DateTimeFormat(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(
                    new Date(sessionChoiceInfo.liveOption.startDateTime)
                  )}
                </div>
              </div>
            </button>
            <button
              onClick={() => {
                setSessionChoiceInfo(null);
                setNotYetStartedInfo({
                  sessionDate: sessionChoiceInfo.upcomingOption.sessionDate,
                  startDateTime:
                    sessionChoiceInfo.upcomingOption.startDateTime,
                  endDateTime: sessionChoiceInfo.upcomingOption.endDateTime,
                });
                setPageState("session-not-yet-started");
              }}
              className="w-full flex items-center gap-3 rounded-xl border border-[#2a2a35] bg-[#1a1a22] hover:bg-[#252530] px-4 py-3 text-left transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-[#6b6b7b] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-[#9fa0b8] uppercase tracking-wider mb-0.5">
                  Upcoming
                </div>
                <div className="text-sm font-semibold text-white truncate">
                  {new Intl.DateTimeFormat(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(
                    new Date(sessionChoiceInfo.upcomingOption.startDateTime)
                  )}
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Email Entry (main landing page) ────────────────────────────

  // The redesigned session card doubles as the sign-in surface: a visitor
  // who hasn't verified yet still gets the countdown, schedule, pricing and
  // social proof next to the email box. Falls back to the legacy card only
  // when the session's schedule can't be resolved.
  const emailEntryCard = renderSessionCard({
    authForm: (
      <div className="space-y-3">
        <div>
          <Label htmlFor="email" className="text-white">
            Your email *
          </Label>
          <p className="mt-0.5 text-xs text-[#6b6b7b]">
            We&apos;ll send a 6-digit code to verify it&apos;s you.
          </p>
        </div>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && email.trim() && handleEmailSubmit()
          }
          placeholder="Enter your email"
          className="h-11 bg-[#161620] border-[#262636] text-white placeholder:text-[#4b4b5b]"
          autoFocus
        />
        <Button
          onClick={handleEmailSubmit}
          disabled={!email.trim() || isSubmitting}
          className="h-11 w-full text-sm font-bold text-brand-foreground hover:brightness-95"
          style={{ backgroundColor: "var(--brand)" }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending code...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              {cardPricing?.isFree ? "Enroll for free" : "Enroll in webinar"}
            </>
          )}
        </Button>
      </div>
    ),
    // Keep isLive fresh so the card flips to "Live now" the moment the
    // host starts, even while the visitor is still typing their email.
    onExpire: () => {
      checkIsLive();
    },
  });

  return (
    <>
      {emailEntryCard}
      {!emailEntryCard && (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 overflow-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full my-auto ${webinarDetails?.coverPhoto ? "max-w-5xl" : "max-w-lg"}`}
      >
        <Card className="bg-[#111116] border-[#2a2a35] overflow-hidden">
          <div
            className={
              webinarDetails?.coverPhoto ? "grid md:grid-cols-[1fr_1fr]" : ""
            }
          >
            {/* Left column - Cover Photo + Referrer */}
            {webinarDetails?.coverPhoto && (
              <div className="flex flex-col bg-zinc-950">
                <div className="relative flex-1 flex items-center justify-center">
                  <img
                    src={webinarDetails.coverPhoto}
                    alt={webinarDetails.title || "Webinar cover"}
                    className="w-full h-full object-contain"
                  />
                  {webinarDetails.isLive && (
                    <div className="absolute top-4 left-4 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                      </span>
                      <span className="text-green-400 text-xs font-medium">
                        Live
                      </span>
                    </div>
                  )}
                </div>
                {referrer && (
                  <div
                    className="flex items-center justify-center gap-3 px-4 py-3"
                    style={{
                      backgroundColor: `${brandColor}1A`,
                      borderTop: `1px solid ${brandColor}33`,
                    }}
                  >
                    {referrer.profilePicture ? (
                      <img
                        src={referrer.profilePicture}
                        alt={referrer.name}
                        className="h-8 w-8 rounded-full object-cover border-2"
                        style={{ borderColor: `${brandColor}4D` }}
                      />
                    ) : (
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center border-2"
                        style={{
                          backgroundColor: `${brandColor}33`,
                          borderColor: `${brandColor}4D`,
                        }}
                      >
                        <User className="h-4 w-4" style={{ color: brandColor }} />
                      </div>
                    )}
                    <InviteLine name={referrer.name} orgName={webinarDetails?.orgName} brandColor={brandColor} />
                  </div>
                )}
              </div>
            )}

            {/* Right column - Webinar Info & Form */}
            <div className="p-6 md:p-8 flex flex-col justify-center">
              {/* Referrer banner when no cover photo */}
              {referrer && !webinarDetails?.coverPhoto && (
                <div
                  className="flex items-center justify-center gap-3 px-4 py-3 mb-6 rounded-lg"
                  style={{
                    backgroundColor: `${brandColor}1A`,
                    border: `1px solid ${brandColor}33`,
                  }}
                >
                  {referrer.profilePicture ? (
                    <img
                      src={referrer.profilePicture}
                      alt={referrer.name}
                      className="h-8 w-8 rounded-full object-cover border-2"
                      style={{ borderColor: `${brandColor}4D` }}
                    />
                  ) : (
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center border-2"
                      style={{
                        backgroundColor: `${brandColor}33`,
                        borderColor: `${brandColor}4D`,
                      }}
                    >
                      <User className="h-4 w-4" style={{ color: brandColor }} />
                    </div>
                  )}
                  <InviteLine name={referrer.name} orgName={webinarDetails?.orgName} brandColor={brandColor} />
                </div>
              )}

              <div className="text-center mb-6">
                {webinarDetails?.orgIcon ? (
                  <img
                    src={webinarDetails.orgIcon}
                    alt={webinarDetails.orgName || "Organization"}
                    className="mx-auto w-14 h-14 rounded-full object-cover mb-4"
                  />
                ) : (
                  <div
                    className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4"
                    style={{ backgroundColor: brandColor }}
                  >
                    <Video className="h-7 w-7 text-white" />
                  </div>
                )}
                <h2 className="text-2xl font-bold text-white">
                  Join Webinar
                </h2>
                <p className="text-zinc-500 text-sm mt-1">
                  Enter your email to continue
                </p>
              </div>

              {/* Webinar Details */}
              <div
                className="rounded-lg p-4 mb-6"
                style={{
                  backgroundColor: `${brandColor}1A`,
                  border: `1px solid ${brandColor}33`,
                }}
              >
                <h3 className="text-lg font-semibold text-white mb-2">
                  {webinarDetails?.title}
                </h3>
                {webinarDetails?.description &&
                  webinarDetails.description !== webinarDetails.title && (
                    <p className="mb-3 whitespace-pre-line text-sm text-zinc-300">
                      {htmlToPlainLines(webinarDetails.description)}
                    </p>
                  )}
                <div className="space-y-2">
                  <div className="flex items-start gap-3 text-sm">
                    <Calendar
                      className="h-4 w-4 flex-shrink-0 mt-0.5"
                      style={{ color: brandColor }}
                    />
                    <span className="text-zinc-300">
                      {webinarDetails && formatSessionDisplay()}
                      {webinarDetails?.timezone &&
                        getTimezoneBadge(webinarDetails.timezone) && (
                          <span
                            className="ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium align-middle"
                            style={{
                              backgroundColor: `${brandColor}33`,
                              color: brandColor,
                            }}
                          >
                            {getTimezoneBadge(webinarDetails.timezone)}
                          </span>
                        )}
                    </span>
                  </div>
                  {webinarDetails?.hostName && (
                    <div className="flex items-center gap-3 text-sm">
                      <User
                        className="h-4 w-4 flex-shrink-0"
                        style={{ color: brandColor }}
                      />
                      <span className="text-zinc-300">
                        Hosted by {webinarDetails.hostName}
                      </span>
                    </div>
                  )}
                  {!!webinarDetails?.speakers?.length && (
                    <div className="flex items-center gap-3 text-sm">
                      <Users
                        className="h-4 w-4 flex-shrink-0"
                        style={{ color: brandColor }}
                      />
                      <span className="text-zinc-300">
                        Speakers: {webinarDetails.speakers.map((sp) => sp.name).join(", ")}
                      </span>
                    </div>
                  )}
                </div>
                {!webinarDetails?.coverPhoto && webinarDetails?.isLive && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                    </span>
                    <span className="text-green-400 text-sm font-medium">
                      Webinar is Live
                    </span>
                  </div>
                )}
              </div>

              {/* Email Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">
                    Your Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && email.trim() && handleEmailSubmit()
                    }
                    placeholder="Enter your email"
                    className="bg-[#1a1a20] border-[#2a2a35] text-white placeholder:text-zinc-500 h-12 text-lg"
                    autoFocus
                  />
                </div>

                <Button
                  onClick={handleEmailSubmit}
                  disabled={!email.trim()}
                  className="w-full h-12 text-lg text-white"
                  style={{ backgroundColor: brandColor }}
                >
                  <Mail className="h-5 w-5 mr-2" />
                  Continue
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
      )}

      {/* Session-picker overlay — per_session paid workshops with no
          active session. Buyer picks a date; we re-run prepare-join
          with the selected sessionDate. */}
      {pageState === "session-pick" && (
        <div className="fixed inset-0 z-[9999] bg-white/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-1">
              Pick a session
            </h2>
            <p className="text-xs text-[#9fa0b8] mb-4">
              Choose which session you&apos;d like to attend.
            </p>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {prepareJoinSessions.length === 0 ? (
                <p className="text-sm text-[#9fa0b8] text-center py-8">
                  No upcoming sessions.
                </p>
              ) : (
                prepareJoinSessions.map((s) => {
                  const start = new Date(s.startDateTime);
                  const label = new Intl.DateTimeFormat("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    ...(webinarDetails?.timezone
                      ? { timeZone: webinarDetails.timezone }
                      : {}),
                  }).format(start);
                  return (
                    <button
                      key={s.dateString}
                      onClick={() => {
                        setSelectedSessionDate(s.dateString);
                        setPageState("gating");
                        runPrepareJoin(undefined, s.dateString);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-[#2a2a35] bg-[#131316] hover:border-brand hover:bg-[#1a1a22] transition-colors flex items-center justify-between"
                    >
                      <span className="text-sm text-white">
                        {label}
                        {s.isToday && (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-brand">
                            Today
                          </span>
                        )}
                      </span>
                      <ArrowRight className="w-4 h-4 text-[#6b6b7b]" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wrong-session confirmation — buyer has paid enrolments for
          different sessions than the currently active one. Give them a
          choice: pay again for THIS session, or cancel and come back on
          the day they already paid for. */}
      {pageState === "wrong-session" && wrongSessionInfo && (
        <div className="fixed inset-0 z-[9999] bg-white/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-brand" />
              <h2 className="text-lg font-semibold text-white">
                This isn&apos;t the session you paid for
              </h2>
            </div>
            <div className="text-sm text-[#9fa0b8] space-y-3">
              {wrongSessionInfo.currentSessionDate && (
                <p>
                  This webinar is currently running the{" "}
                  <span className="text-white font-medium">
                    {new Intl.DateTimeFormat("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      ...(webinarDetails?.timezone
                        ? { timeZone: webinarDetails.timezone }
                        : {}),
                    }).format(new Date(wrongSessionInfo.currentSessionDate))}
                  </span>{" "}
                  session.
                </p>
              )}
              <p>
                You&apos;ve already paid for{" "}
                <span className="text-white font-medium">
                  {wrongSessionInfo.paidSessions
                    .map((iso) =>
                      new Intl.DateTimeFormat("en-US", {
                        month: "short",
                        day: "numeric",
                        ...(webinarDetails?.timezone
                          ? { timeZone: webinarDetails.timezone }
                          : {}),
                      }).format(new Date(iso))
                    )
                    .join(", ")}
                </span>
                . You can come back on that day to join for free — or pay
                to attend this session too.
              </p>
            </div>
            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => {
                  setWrongSessionInfo(null);
                  setPageState("gating");
                  runPrepareJoin(
                    undefined,
                    selectedSessionDate || undefined,
                    true
                  );
                }}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold bg-brand hover:opacity-90 text-white transition-colors"
              >
                Pay for this session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* session-not-yet-started and session-choice are handled as
          early-returns above so they replace the email-entry card
          entirely instead of rendering as flex siblings alongside it. */}

      {/* Inline invoice payment — right-side slide-in drawer, matching
          ChannelPaymentModalNew's shell so every checkout surface across
          the app looks consistent. Body renders <CheckoutPaymentStep>
          directly (no iframe). onSuccess re-runs prepare-join; no onCancel
          is wired per founder's "no cancel escape hatch" requirement.
          The backdrop is CLICK-INERT (no onClick handler) because a buyer
          who bails mid-payment should not drop back to name-entry without
          paying — same rationale as the removed close-X button. */}
      {pageState === "invoice-payment" && pendingInvoiceId && (
        <div
          className="fixed inset-0 z-[9999] flex"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop — click-inert to preserve the rigid-modal rule. */}
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm animate-in fade-in duration-200" />

          {/* Slide-in drawer panel */}
          <div className="relative ml-auto h-full w-full sm:max-w-md bg-[#0b0b0d] border-l border-[#2a2a35] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Step X of Y banner — only shown when BE returned stage/step
                metadata. Renders the current stage prominently so a buyer
                paying for community + workshop understands they'll see two
                payment screens back-to-back, not one accidental duplicate. */}
            {pendingInvoiceMeta && pendingInvoiceMeta.totalSteps > 1 && (
              <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-[#131318] border-b border-[#2a2a35]">
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9fa0b8]">
                    Step {pendingInvoiceMeta.stepNumber} of {pendingInvoiceMeta.totalSteps}
                    {" · "}
                    {pendingInvoiceMeta.stage === "community"
                      ? "Community access"
                      : "Workshop enrollment"}
                  </span>
                  <span className="text-sm font-medium text-white truncate">
                    {pendingInvoiceMeta.itemName}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Two-dot progress. Filled dot = current or completed. */}
                  {Array.from({ length: pendingInvoiceMeta.totalSteps }).map(
                    (_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-6 rounded-full transition-colors ${
                          i < pendingInvoiceMeta.stepNumber
                            ? "bg-white"
                            : "bg-[#2a2a35]"
                        }`}
                      />
                    ),
                  )}
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              <CheckoutPaymentStep
                invoiceId={pendingInvoiceId}
                organizationName={
                  webinarDetails?.orgName ||
                  pendingInvoiceMeta?.itemName ||
                  "Complete payment"
                }
                userEmail={email}
                userName={displayName || undefined}
                onSuccess={handleInvoicePaidInline}
                // No onCancel — see handleInvoicePaidInline comment above.
                // The founder wants the drawer rigid so buyers can't drop
                // back to name-entry without paying.
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

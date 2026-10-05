"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { parseDateLocal, formatTime12Hour, stripHtml } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import OtpInput from "@/components/ui/otp-input";
import {
  Building2,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Send,
  ArrowLeft,
  ArrowRight,
  Mail,
  RotateCcw,
  ShoppingBag,
  BookOpen,
  Calendar,
  Users,
  Play,
  Phone,
  User,
  Video,
  MessageSquare,
  LayoutDashboard,
  Globe,
  Star,
  Download,
  Lock,
  Check,
  Award,
  GraduationCap,
  Bell,
  Flame,
  Hash,
  Zap,
  Crown,
  TrendingUp,
  Lightbulb,
  Heart,
  Coffee,
  Megaphone,
  X,
  Maximize2,
  Code2,
  Palette,
  Briefcase,
  ChevronDown,
  Search,
} from "lucide-react";
import { CompPlanBadge } from "@/components/dashboard/CommissionPlanSection";
import { phoneCountries } from "@/lib/dialCodes";
import { toast } from "sonner";
import Link from "next/link";
import { saveToken, saveOrgId, getUserDataFromToken, isAuthenticated as checkWorkspaceAuth } from "@/lib/auth";
import GuestNavbar from "./components/GuestNavbar";
import { OpenInAppBanner } from "@/components/ui/open-in-app-banner";

interface Organization {
  _id: string;
  name: string;
  slug?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  description?: string;
  headingText?: string;
  subHeadingText?: string;
  icon?: string;
  coverPhoto?: string;
  promoVideoLink?: string;
  office_public?: boolean;
  requestStatus: "pending" | "approved" | "rejected" | null;
  isMember: boolean;
  branding?: {
    primaryColor?: string;
  };
}

interface Product {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  currency: string;
  images: string[];
  isDigital: boolean;
  deliveryMethod: "physical" | "digital" | "both";
  isSubscription?: boolean;
  subscriptionPeriod?: string;
}

interface Course {
  _id: string;
  title: string;
  description?: string;
  coverImage?: string;
  isPaid: boolean;
  isFree: boolean;
  price?: number;
  currency: string;
  totalDuration: number;
  totalChapters: number;
  enrolledStudents: number;
  isSubscription?: boolean;
  subscriptionPeriod?: string;
}

interface Workshop {
  _id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  isFree: boolean;
  price: number;
  currency: string;
  maxParticipants?: number;
  isRecurring: boolean;
  isSubscription?: boolean;
  subscriptionPeriod?: string;
}

interface Channel {
  _id: string;
  title: string;
  description?: string;
  coverImage?: string;
  price: number;
  currency: string;
  isFree: boolean;
  isSubscription?: boolean;
  subscriptionPeriod?: string;
}

interface Service {
  _id: string;
  title: string;
  slug?: string;
  description?: string;
  longDescription?: string;
  icon?: string;
  iconBgColor?: string;
  coverImage?: string;
  tags: string[];
  features: string[];
  deliverables?: string[];
  duration?: string;
  totalPrice: number;
  currency: string;
  projectsCompleted: number;
  activeOptIns?: number;
  status?: "draft" | "active" | "archived";
  paymentTiming?: "free" | "pay_before_milestone" | "pay_after_milestone";
  milestones?: {
    _id?: string;
    order?: number;
    title?: string;
    description?: string;
    duration?: string;
    paymentAmount?: number;
    currency?: string;
  }[];
}

interface CallOffering {
  _id: string;
  title: string;
  description?: string;
  coverImage?: string;
  duration: number;
  pricePerCall: number;
  currency: string;
  isFree: boolean;
  totalPurchased?: number;
  totalUsed?: number;
  totalScheduled?: number;
  purchaseCount?: number;
  reviewCount?: number;
  averageRating?: number;
  creator?: {
    _id: string;
    name: string;
    email?: string;
    profilePicture?: string;
    country?: string;
    state?: string;
    city?: string;
  };
}

interface Member {
  _id: string;
  name: string;
  email: string;
  profilePicture?: string;
  role?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface ReferrerInfo {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
}

type AuthStep = "email" | "otp" | "phone";

// Convert YouTube URLs to embed format
function getEmbedUrl(url: string): string {
  if (!url) return url;

  const watchMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (watchMatch) {
    return `https://www.youtube.com/embed/${watchMatch[1]}`;
  }

  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) {
    return `https://www.youtube.com/embed/${shortMatch[1]}`;
  }

  return url;
}

export default function GuestOfficePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;

  const referCode = searchParams.get("referCode");
  const referSuffix = referCode ? `?referCode=${referCode}` : "";

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [guestUserId, setGuestUserId] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState<string | null>(null);
  const [isWorkspaceUser, setIsWorkspaceUser] = useState(false); // User logged in via workspace
  const [workspaceUserName, setWorkspaceUserName] = useState<string | null>(null);
  const [workspaceOrgId, setWorkspaceOrgId] = useState<string | null>(null); // Current org from workspace token

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [phone, setPhone] = useState("");
  const [joinName, setJoinName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [resendAt, setResendAt] = useState<number>(0);

  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [calls, setCalls] = useState<CallOffering[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [referrer, setReferrer] = useState<ReferrerInfo | null>(null);

  // For public org direct join flow
  const [pendingPublicJoin, setPendingPublicJoin] = useState(false);
  // For private org join flow (new user needs to be added to GARAGE HQ first)
  const [pendingPrivateJoin, setPendingPrivateJoin] = useState(false);
  const [joiningOrg, setJoiningOrg] = useState(false);
  // Track if user is an existing user (already has name in system from verify-otp)
  const [isExistingUser, setIsExistingUser] = useState(false);

  // Already member modal state
  const [showAlreadyMemberModal, setShowAlreadyMemberModal] = useState(false);
  const [alreadyMemberData, setAlreadyMemberData] = useState<{
    userId: string;
    orgId: string;
    orgName: string;
  } | null>(null);
  const [redirectingToWorkspace, setRedirectingToWorkspace] = useState(false);

  // Guest limit status
  const [guestLimitReached, setGuestLimitReached] = useState(false);

  // Platform features tab
  const [activeFeature, setActiveFeature] = useState(0);

  // Theme state (light/dark)
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Promo popup state
  const [showPromoPopup, setShowPromoPopup] = useState(true);

  // Country code selector state - track by isoCode to avoid conflicts (e.g. US and CA both share +1)
  const [selectedCountryIso, setSelectedCountryIso] = useState("IN");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  const countryCodeToFlag = (isoCode: string) => {
    return isoCode
      .toUpperCase()
      .split("")
      .map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
      .join("");
  };

  const countryList = useMemo(() => {
    const countries = phoneCountries();
    const seen = new Set<string>();
    return countries
      .map((c) => ({
        name: c.name,
        code: c.phonecode.startsWith("+") ? c.phonecode : `+${c.phonecode}`,
        isoCode: c.isoCode,
        flag: countryCodeToFlag(c.isoCode),
      }))
      .filter((c) => {
        const key = c.isoCode;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const selectedCountry = useMemo(
    () => countryList.find((c) => c.isoCode === selectedCountryIso) || countryList[0],
    [countryList, selectedCountryIso]
  );

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countryList;
    const q = countrySearch.toLowerCase();
    return countryList.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.includes(q)
    );
  }, [countryList, countrySearch]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setShowCountryDropdown(false);
        setCountrySearch("");
      }
    }
    if (showCountryDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showCountryDropdown]);

  // Mobile detection for auth UI
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Lock body scroll when mobile auth UI is open
  useEffect(() => {
    if (showAuthModal && isMobile) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, [showAuthModal, isMobile]);

  // Brand color from organization or default yellow
  const brandColor = organization?.branding?.primaryColor || "#FBA70A";

  // Helper to check if a color is too light (for white/light backgrounds)
  const isLightColor = (color: string): boolean => {
    // Handle hex colors
    let hex = color.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.7; // Consider light if luminance > 70%
  };

  // Mobile auth button color - use fallback if brand color is too light
  const mobileAuthButtonColor = isLightColor(brandColor) ? "#18181b" : brandColor; // zinc-900 as fallback

  // Platform features data
  const platformFeatures = [
    {
      id: "virtual-office",
      title: "Virtual Office",
      description: "Step into a collaborative virtual workspace where your team comes together in real-time. Navigate floors, join spaces, and feel the presence of your colleagues.",
      bullets: ["Real-time presence", "Floor navigation", "Team visibility"],
      image: "/images/features/virtual-office.png",
    },
    {
      id: "video-meetings",
      title: "Video Meetings",
      description: "Connect face-to-face with HD video calls, screen sharing, and recording capabilities. Perfect for quick syncs or in-depth discussions.",
      bullets: ["HD video calls", "Screen sharing", "Meeting recordings"],
      image: "/images/features/video-meetings.png",
    },
    {
      id: "collaboration",
      title: "Real-time Collaboration",
      description: "Work together seamlessly with instant messaging, file sharing, and collaborative tools that keep your team in sync no matter where they are.",
      bullets: ["Instant messaging", "File sharing", "Task management"],
      image: "/images/features/collaboration.png",
    },
    {
      id: "community",
      title: "Community Hub",
      description: "Build and nurture your community with courses, workshops, and exclusive content. Engage members and grow together.",
      bullets: ["Online courses", "Live workshops", "Member networking"],
      image: "/images/features/community.png",
    },
  ];

  useEffect(() => {
    // First, check if user is logged in via workspace (has valid JWT token)
    if (checkWorkspaceAuth()) {
      const userData = getUserDataFromToken();
      if (userData.userId && userData.email) {
        setIsAuthenticated(true);
        setIsWorkspaceUser(true);
        setGuestUserId(userData.userId);
        setGuestEmail(userData.email);
        setWorkspaceUserName(userData.name);
        setWorkspaceOrgId(userData.orgId);
        // Workspace users already exist in the system
        if (userData.name) {
          setIsExistingUser(true);
        }
        return; // Workspace auth takes precedence
      }
    }

    // Fallback to guest auth
    const storedUserId = localStorage.getItem("guest_user_id");
    const storedEmail = localStorage.getItem("guest_email");
    if (storedUserId && storedEmail) {
      setIsAuthenticated(true);
      setGuestUserId(storedUserId);
      setGuestEmail(storedEmail);
    }
  }, []);

  useEffect(() => {
    if (!slug) return;
    fetchOrganization();
    fetchItems();
  }, [slug, guestUserId]);

  // Check guest limit status when organization is loaded
  useEffect(() => {
    if (!organization?._id) return;

    async function checkGuestLimit() {
      try {
        const response = await api<{
          ok: boolean;
          guestCount: number;
          guestLimit: number;
          limitReached: boolean;
        }>(`/guest-auth/guest-limit-status?orgId=${organization!._id}`);

        if (response.ok) {
          setGuestLimitReached(response.limitReached);
        }
      } catch (err) {
        console.error("Error checking guest limit:", err);
      }
    }

    checkGuestLimit();
  }, [organization?._id]);

  // Fetch calls when organization is loaded
  useEffect(() => {
    if (!organization?._id) return;

    async function fetchCalls() {
      try {
        const response = await api<{
          success?: boolean;
          calls?: CallOffering[];
        }>(`/public/calls/${organization!._id}`, { method: "GET" });

        setCalls(response.calls || []);
      } catch (err) {
        console.error("Error fetching calls:", err);
      }
    }

    fetchCalls();
  }, [organization?._id]);

  // Workspace users who are already members can stay on the funnel page
  // They'll see a "Go to Workspace" button in the UI instead of being auto-redirected

  // Clear guest localStorage when workspace auth is detected (cleanup stale data)
  useEffect(() => {
    if (isWorkspaceUser) {
      localStorage.removeItem("guest_user_id");
      localStorage.removeItem("guest_email");
    }
  }, [isWorkspaceUser]);

  // Fetch referrer info if referCode is present
  useEffect(() => {
    if (!referCode) return;

    async function fetchReferrer() {
      try {
        const response = await api<{
          success: boolean;
          referrer: ReferrerInfo;
        }>(`/affiliate/referrer-info?affiliateId=${referCode}`);

        if (response.success && response.referrer) {
          setReferrer(response.referrer);
        }
      } catch (err) {
        console.error("Error fetching referrer info:", err);
      }
    }

    fetchReferrer();
  }, [referCode]);

  async function fetchOrganization() {
    try {
      setLoading(true);
      const url = guestUserId
        ? `/guest-auth/hq-by-slug/${slug}?userId=${guestUserId}`
        : `/guest-auth/hq-by-slug/${slug}`;

      const response = await api<{
        ok: boolean;
        organization: Organization;
      }>(url, { method: "GET" });

      if (response.ok && response.organization) {
        setOrganization(response.organization);
        setNotFound(false);
      } else {
        setNotFound(true);
      }
    } catch (err: any) {
      console.error("Error fetching organization:", err);
      if (err.message?.includes("404") || err.message?.includes("not found")) {
        setNotFound(true);
      } else {
        toast.error("Failed to load organization");
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchItems() {
    try {
      setItemsLoading(true);
      const response = await api<{
        ok: boolean;
        products: Product[];
        courses: Course[];
        workshops: Workshop[];
        channels: Channel[];
        services?: Service[];
        members: Member[];
      }>(`/guest-auth/hq-items/${slug}`, { method: "GET" });

      if (response.ok) {
        setProducts(response.products || []);
        setCourses(response.courses || []);
        setWorkshops(response.workshops || []);
        setChannels(response.channels || []);
        setServices(response.services || []);
        setMembers(response.members || []);
      }

    } catch (err: any) {
      console.error("Error fetching items:", err);
    } finally {
      setItemsLoading(false);
    }
  }

  // Scroll to hash section after items load (for navigations from detail pages)
  useEffect(() => {
    if (itemsLoading) return;
    const hash = window.location.hash;
    if (hash) {
      // Small delay to let sections render
      setTimeout(() => {
        const el = document.querySelector(hash);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  }, [itemsLoading]);

  async function requestOtp() {
    if (!email) {
      toast.error("Please enter your email");
      return;
    }

    setAuthLoading(true);
    try {
      await api("/guest-auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      toast.success("OTP sent to your email!");
      setAuthStep("otp");
    } catch (err) {
      console.error("Error requesting OTP:", err);
      toast.error("Failed to send OTP. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6 || authLoading) return;

    setAuthLoading(true);
    try {
      const response = await api<{
        ok: boolean;
        userId: string;
        email: string;
        guest: boolean;
        name: string | null;
        phone: string | null;
        profileComplete: boolean;
        hasOrganizations: boolean;
      }>("/guest-auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: otp,
          referralCode: referCode || undefined,
        }),
      });

      if (response.ok) {
        localStorage.setItem("guest_user_id", response.userId);
        localStorage.setItem("guest_email", response.email);
        setGuestUserId(response.userId);
        setGuestEmail(response.email);
        setIsAuthenticated(true);

        // Pre-fill name/phone if user has them (existing user in system)
        if (response.name) {
          setJoinName(response.name);
          setIsExistingUser(true);
        }
        if (response.phone) setPhone(response.phone);

        // Refresh org data to check membership
        const url = `/guest-auth/hq-by-slug/${slug}?userId=${response.userId}`;
        const orgResponse = await api<{
          ok: boolean;
          organization: Organization;
        }>(url, { method: "GET" });

        if (orgResponse.ok && orgResponse.organization?.isMember) {
          // User is already a member - show modal to redirect
          setShowAuthModal(false);
          setAlreadyMemberData({
            userId: response.userId,
            orgId: orgResponse.organization._id,
            orgName: orgResponse.organization.name,
          });
          setShowAlreadyMemberModal(true);
          return;
        }

        // Update organization state with fresh data
        if (orgResponse.ok && orgResponse.organization) {
          setOrganization(orgResponse.organization);
        }

        // If this is a public org, go to phone collection step before joining
        if (organization?.office_public && pendingPublicJoin) {
          toast.success("Email verified! One more step...");
          setAuthStep("phone");
          setOtp("");
        } else if (!organization?.office_public && pendingPrivateJoin) {
          // Private org - new user needs to fill details before being added to GARAGE HQ
          toast.success("Email verified! Complete your profile...");
          setAuthStep("phone");
          setOtp("");
        } else {
          setShowAuthModal(false);
          toast.success("Verified!");
          setAuthStep("email");
          setEmail("");
          setOtp("");
        }
      } else {
        toast.error("Verification failed. Please try again.");
      }
    } catch (err: any) {
      console.error("Error verifying OTP:", err);
      toast.error("Something went wrong!");
      setOtp("");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handlePublicJoin(userId?: string, userPhone?: string) {
    if (!organization) return;

    const userIdToUse = userId || guestUserId;
    if (!userIdToUse) return;

    setJoiningOrg(true);
    try {
      const response = await api<{
        ok: boolean;
        token: string;
        user: { id: string; email: string; name?: string };
        needsProfileCompletion: boolean;
        alreadyMember?: boolean;
      }>("/guest-auth/public-join", {
        method: "POST",
        body: JSON.stringify({
          guestUserId: userIdToUse,
          orgId: organization._id,
          name: joinName.trim() || requestName.trim() || undefined,
          phone: userPhone || phone || undefined,
        }),
      });

      if (response.ok) {
        // Store the token and orgId using the proper auth utilities
        saveToken(response.token);
        saveOrgId(organization._id);
        // Clear guest session data since they now have a proper token
        localStorage.removeItem("guest_user_id");
        localStorage.removeItem("guest_email");

        if (response.alreadyMember) {
          toast.success("You're already a member!");
        } else {
          toast.success(`Welcome to ${organization.name}!`);
        }

        // Redirect to workspace with profile completion flag if needed
        if (response.needsProfileCompletion) {
          router.push("/workspace?completeProfile=true");
        } else {
          router.push("/workspace");
        }
      }
    } catch (err: any) {
      console.error("Error joining organization:", err);
      toast.error(err.message || "Failed to join organization");
      // Refresh to get updated status
      fetchOrganization();
    } finally {
      setJoiningOrg(false);
    }
  }

  async function handlePrivateJoin() {
    if (!organization || !guestUserId) return;

    if (!phone || phone.length < 7) {
      toast.error("Please enter a valid phone number");
      return;
    }
    // Only require name if user is not an existing user (they already have a name)
    if (!isExistingUser && !joinName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    const fullPhone = `${selectedCountry?.code || "+91"}${phone}`;

    setJoiningOrg(true);
    try {
      const response = await api<{
        ok: boolean;
        token: string;
        garageHQId: string;
        garageHQName: string;
        requestId: string;
        status: string;
        needsProfileCompletion: boolean;
      }>("/guest-auth/private-join", {
        method: "POST",
        body: JSON.stringify({
          guestUserId,
          orgId: organization._id,
          name: joinName.trim(),
          phone: fullPhone,
          message: requestMessage.trim() || undefined,
        }),
      });

      if (response.ok) {
        // Store the token and orgId for GARAGE HQ
        saveToken(response.token);
        saveOrgId(response.garageHQId);
        // Clear guest session data since they now have a proper token
        localStorage.removeItem("guest_user_id");
        localStorage.removeItem("guest_email");

        toast.success(`Request submitted!`);

        // Reset form state
        setPendingPrivateJoin(false);
        setShowAuthModal(false);
        setAuthStep("email");
        setEmail("");
        setOtp("");
        setPhone("");
        setJoinName("");
        setRequestMessage("");

        // Redirect to my-requests page with parent HQ info for welcome banner
        const params = new URLSearchParams({
          welcome: "true",
          parentHQName: response.garageHQName,
        });
        router.push(`/my-requests?${params.toString()}`);
      }
    } catch (err: any) {
      console.error("Error joining private organization:", err);
      toast.error(err.message || "Failed to submit request");
    } finally {
      setJoiningOrg(false);
    }
  }

  async function resendOtp() {
    if (Date.now() < resendAt) return;
    try {
      await api("/guest-auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), isResend: true }),
      });
      setResendAt(Date.now() + 60_000);
      toast.success("OTP sent to your email");
    } catch (err) {
      toast.error("Failed to resend OTP");
    }
  }

  async function handleAlreadyMemberRedirect() {
    if (!alreadyMemberData) return;

    setRedirectingToWorkspace(true);
    try {
      const response = await api<{
        token: string;
        currentOrg: {
          id: string;
          name: string;
          role: string;
          joinedAt: string;
          parent: boolean;
        };
      }>("/auth/select-org", {
        method: "POST",
        body: JSON.stringify({
          userId: alreadyMemberData.userId,
          orgId: alreadyMemberData.orgId,
        }),
      });

      // No need to check response.ok - api() throws on error
      // If we reach here, request succeeded
      saveToken(response.token);
      saveOrgId(alreadyMemberData.orgId);
      // Clear guest localStorage
      localStorage.removeItem("guest_user_id");
      localStorage.removeItem("guest_email");
      // Redirect to workspace
      router.push("/workspace");
    } catch (err) {
      console.error("Error redirecting to workspace:", err);
      toast.error("Failed to login. Please try again.");
      setRedirectingToWorkspace(false);
    }
  }

  const secondsLeft = useMemo(
    () => Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)),
    [resendAt]
  );

  // Generate stable "spots left" number
  const spotsLeft = useMemo(() => Math.floor(Math.random() * 30) + 20, []);

  async function completePhoneAndJoin() {
    if (!phone || phone.length < 7) {
      toast.error("Please enter a valid phone number");
      return;
    }
    // Only require name if user is not an existing user (they already have a name)
    if (!isExistingUser && !joinName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    const fullPhone = `${selectedCountry?.code || "+91"}${phone}`;

    // Check if this is a private org join flow
    if (pendingPrivateJoin) {
      await handlePrivateJoin();
      return;
    }

    // Public org flow
    setPendingPublicJoin(false);
    setShowAuthModal(false);
    setAuthStep("email");
    setEmail("");
    setOtp("");

    await handlePublicJoin(guestUserId || undefined, fullPhone);
    setPhone("");
    setJoinName("");
    setIsExistingUser(false);
  }

  function handleApplyClick() {
    if (!isAuthenticated) {
      // Set flag to trigger appropriate join flow after OTP verification
      if (organization?.office_public) {
        setPendingPublicJoin(true);
      } else {
        // Private org - new users need to fill details and be added to GARAGE HQ
        setPendingPrivateJoin(true);
      }
      setShowAuthModal(true);
    } else {
      // User is already authenticated
      if (organization?.office_public) {
        // For workspace users, directly join - they already have name/phone in their profile
        // For guest users who haven't provided name/phone yet, we still need to collect it
        if (isWorkspaceUser) {
          // Workspace user - join directly, no need to ask for name/phone
          handlePublicJoin(guestUserId || undefined, undefined);
        } else {
          // Guest user - need to collect name/phone via the modal
          setPendingPublicJoin(true);
          setAuthStep("phone");
          setShowAuthModal(true);
        }
      } else {
        // For private orgs, show the request dialog
        // Pre-fill name for workspace users
        if (isWorkspaceUser && workspaceUserName) {
          setRequestName(workspaceUserName);
        }
        setShowApplyDialog(true);
      }
    }
  }

  async function submitRequest() {
    if (!organization || !guestUserId) return;

    setSubmitting(true);
    try {
      const response = await api<{
        ok: boolean;
        requestId: string;
        status: string;
      }>("/guest-auth/request-join", {
        method: "POST",
        body: JSON.stringify({
          guestUserId,
          orgId: organization._id,
          name: requestName.trim() || undefined,
          message: requestMessage.trim() || undefined,
        }),
      });

      if (response.ok) {
        toast.success("Request submitted successfully!");
        setShowApplyDialog(false);
        setRequestName("");
        setRequestMessage("");
        await fetchOrganization();
      }
    } catch (err: any) {
      console.error("Error submitting request:", err);
      toast.error(err.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-100 to-zinc-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-zinc-200" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#FBA70A] animate-spin" />
          </div>
          <p className="text-zinc-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (notFound || !organization) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-100 to-zinc-50 px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-white border border-zinc-200 shadow-sm flex items-center justify-center mx-auto mb-6">
            <Building2 className="h-8 w-8 text-zinc-400" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 mb-2">Not Found</h1>
          <p className="text-zinc-500 text-sm mb-8">
            This organization doesn&apos;t exist or isn&apos;t publicly available.
          </p>
          <Link href="/browse-hqs">
            <Button
              variant="outline"
              className="border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Browse HQs
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const hasItems =
    products.length > 0 || courses.length > 0 || workshops.length > 0;

  return (
    <div
      className={`min-h-screen ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}
      style={{ '--brand-color': brandColor } as React.CSSProperties}
    >
      {/* CSS for dynamic brand color hover/focus states */}
      <style>{`
        .brand-hover:hover { color: ${brandColor} !important; }
        .brand-border-hover:hover { border-color: ${brandColor} !important; }
        .group:hover .brand-group-border-hover { border-color: ${brandColor} !important; }
        .brand-focus:focus { border-color: ${brandColor} !important; box-shadow: 0 0 0 3px ${brandColor}33 !important; }
      `}</style>
      {/* Open-in-app banner — shown on mobile browsers only */}
      <OpenInAppBanner
        deepLinkPath={`store/${slug}`}
        contentTitle={organization?.name}
      />
      {/* Header/Navbar */}
      <GuestNavbar
        organization={organization}
        slug={slug}
        theme={theme}
        setTheme={setTheme}
        brandColor={brandColor}
        navItems={[
          ...(channels.length > 0 ? [{ label: "Communities", href: "#channels" }] : []),
          { label: "Members", href: "#community" },
          ...(workshops.length > 0 ? [{ label: "Live Streams", href: "#webinars" }] : []),
          ...(courses.length > 0 ? [{ label: "Courses", href: "#courses" }] : []),
          ...(calls.length > 0 ? [{ label: "1 on 1\u2019s", href: "#calls" }] : []),
          ...(products.length > 0 ? [{ label: "Digital Products", href: "#products" }] : []),
          ...(services.length > 0 ? [{ label: "Services", href: "#services" }] : []),
        ]}
        onApplyClick={handleApplyClick}
        isMember={organization.isMember || (isWorkspaceUser && workspaceOrgId === organization._id)}
        requestStatus={organization.requestStatus}
        officePublic={organization.office_public}
        guestLimitReached={guestLimitReached}
        isAuthenticatedProp={isAuthenticated}
        guestEmailProp={guestEmail}
        isWorkspaceUserProp={isWorkspaceUser}
        workspaceOrgIdProp={workspaceOrgId}
        joiningOrg={joiningOrg}
      />

      {/* Hero Section */}
      <section className={`relative pt-12 pb-16 md:pt-16 md:pb-24 overflow-hidden ${theme === "dark" ? "bg-zinc-950" : "bg-zinc-50"}`}>
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] opacity-40"
            style={{ background: `radial-gradient(circle, ${brandColor}1A, transparent, transparent)` }}
          />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Members Badge */}
          {members.length > 0 && (
            <div className="flex justify-center mb-8">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"} border`}>
                <div className="flex -space-x-2">
                  {members.filter(m => m.name).slice(0, 4).map((member) => (
                    member.profilePicture ? (
                      <img
                        key={member._id}
                        src={member.profilePicture}
                        alt={member.name}
                        className="w-6 h-6 rounded-full border-2 border-zinc-900 object-cover"
                      />
                    ) : (
                      <div
                        key={member._id}
                        className="w-6 h-6 rounded-full border-2 border-zinc-900 flex items-center justify-center"
                        style={{ background: `linear-gradient(to bottom right, ${brandColor}, ${brandColor}CC)` }}
                      >
                        <span className="text-black font-bold text-[8px]">
                          {member.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </span>
                      </div>
                    )
                  ))}
                </div>
                <span className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                  Join <span className="font-semibold" style={{ color: brandColor }}>{members.length.toLocaleString()}+</span> Members
                </span>
              </div>
            </div>
          )}

          {/* Main Heading */}
          <div className="text-center mb-6">
            <h1 className={`text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
              {organization.headingText || `Welcome to`}
              <br />
             {!organization.headingText && <span style={{ color: brandColor }}>{organization.name}</span>}
            </h1>
          </div>

          {/* Subheading */}
          <p className={`text-center text-lg md:text-xl max-w-2xl mx-auto mb-8 leading-relaxed ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
            {organization.subHeadingText || organization.description ||
              `Join our community and unlock exclusive access to resources, courses, and a network of like-minded individuals.`}
          </p>

          {/* CTA Buttons - Moved above video */}
          <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 ${organization.promoVideoLink ? "mb-10" : ""}`}>
            {organization.isMember || (isWorkspaceUser && workspaceOrgId === organization._id) ? (
              <button
                onClick={() => router.push('/workspace')}
                className="relative overflow-hidden rounded-[16px] hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#F75C6B' }}
              >
                <div className="bg-[#FFC107] rounded-[20px] px-7 py-3.5 pb-3">
                  <span className="text-black font-extrabold text-sm sm:text-lg leading-tight block text-center">
                    Go To {organization.name}&apos;s Office
                  </span>
                </div>
                <div className="px-7 text-center">
                  <span className="text-black font-bold text-xs sm:text-xs">100% FREE. No Card Required</span>
                </div>
              </button>
            ) : !organization.requestStatus && !guestLimitReached && (
              <>
                <button
                  onClick={handleApplyClick}
                  disabled={joiningOrg}
                  className="relative overflow-hidden rounded-[16px] hover:opacity-90 transition-opacity disabled:opacity-70"
                  style={{ backgroundColor: '#F75C6B' }}
                >
                  <div className="bg-[#FFC107] rounded-[16px] px-7 py-3.5 pb-3">
                    <span className="text-black font-extrabold text-lg sm:text-xl leading-tight block text-center">
                      {joiningOrg ? (
                        <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      ) : null}
                      {organization.office_public ? `Join ${organization.name}'s Office` : `Request To Join ${organization.name}`}
                    </span>
                  </div>
                  <div className="px-7 text-center">
                    <span className="text-black font-bold text-xs sm:text-sm">100% FREE. No Card Required</span>
                  </div>
                </button>
              </>
            )}
          </div>

          {/* Referrer Banner */}
          {referrer && (
            <div className="flex justify-center mt-6 mb-8">
              <div
                className="inline-flex items-center gap-3 px-5 py-3 rounded-full border"
                style={{ backgroundColor: `${brandColor}1A`, borderColor: `${brandColor}33` }}
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
                    style={{ backgroundColor: `${brandColor}33`, borderColor: `${brandColor}4D` }}
                  >
                    <User className="h-4 w-4" style={{ color: brandColor }} />
                  </div>
                )}
                <span className={`text-sm ${theme === "dark" ? "text-zinc-300" : "text-zinc-700"}`}>
                  <span className="font-semibold" style={{ color: brandColor }}>{referrer.name}</span>{" "}
                  invited you to join
                </span>
              </div>
            </div>
          )}

          {/* Video Player Card */}
          {organization.promoVideoLink && (
            <div className="relative max-w-3xl mx-auto mb-8">
              {/* 3D Effect Container */}
              <div className="relative" style={{ perspective: '1000px' }}>
                {/* Shadow/Glow Effect */}
                <div
                  className="absolute -inset-4 rounded-[32px] blur-xl"
                  style={{ background: `linear-gradient(to bottom, ${brandColor}33, rgba(24, 24, 27, 0.3))` }}
                />

                {/* Video Container */}
                <div className="relative bg-gradient-to-b from-zinc-700 to-zinc-800 rounded-[24px] p-2 shadow-2xl">
                  {/* Screen bezel effect */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-zinc-600 rounded-full" />

                  <div className="relative aspect-video rounded-[16px] overflow-hidden bg-zinc-900 mt-2">
                    <iframe
                      src={getEmbedUrl(organization.promoVideoLink)}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>

                  {/* Bottom info bar */}
                  <div className="flex items-center justify-between px-4 py-3 mt-1">
                    <div className="text-left">
                      <p className="text-xs text-zinc-400">Watch our community intro</p>
                      <p className="text-sm font-medium text-white">See What You&apos;ll Get Inside</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-700/50 rounded-full">
                      <span className="text-xs text-zinc-300">2:30</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) }

          {/* Trust Indicators */}
          {/* <div className={`flex items-center justify-center gap-6 text-sm ${theme === "dark" ? "text-zinc-500" : "text-zinc-600"}`}>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: brandColor }} />
              <span>Premium content</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className={`h-4 w-4 ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`} />
              <span>Active community support</span>
            </div>
          </div> */}
        </div>
      </section>

      {/* Platform Features Section - Commented Out */}
      {/* <section id="features" className={`py-20 ${theme === "dark" ? "bg-zinc-900" : "bg-zinc-50"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className={`text-4xl md:text-5xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
              Platform Features
            </h2>
            <p className={`text-lg max-w-2xl mx-auto ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
              Experience our powerful platform with features designed for seamless collaboration and community building.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {platformFeatures.map((feature, index) => (
              <button
                key={feature.id}
                onClick={() => setActiveFeature(index)}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeFeature === index
                    ? theme === "dark" ? "bg-white text-zinc-900" : "bg-zinc-900 text-white"
                    : theme === "dark" ? "bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 border border-zinc-700" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200"
                }`}
              >
                {feature.title}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <div className={`relative rounded-2xl overflow-hidden aspect-[4/3] ${theme === "dark" ? "bg-gradient-to-br from-zinc-800 to-zinc-900" : "bg-gradient-to-br from-zinc-100 to-zinc-200"}`}>
                <div
                  className="absolute inset-0"
                  style={{ background: `linear-gradient(to bottom right, ${brandColor}33, transparent, rgba(168, 85, 247, 0.2))` }}
                />

                {activeFeature === 0 && (
                  <div className="absolute inset-4 flex items-center justify-center">
                    <div className="relative w-full max-w-[280px]">
                      <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-[40px] p-3 shadow-2xl transform rotate-[-8deg]">
                        <div className="bg-zinc-900 rounded-[32px] p-4 h-[380px] flex flex-col">
                          <div className="flex items-center gap-2 mb-4">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: `${brandColor}33` }}
                            >
                              <Building2 className="h-4 w-4" style={{ color: brandColor }} />
                            </div>
                            <span className="text-white text-sm font-medium">Virtual Office</span>
                          </div>
                          <div className="flex-1 space-y-3">
                            {[1, 2, 3, 4].map((i) => (
                              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600" />
                                <div className="flex-1">
                                  <div className="h-2 bg-zinc-700 rounded w-20 mb-1" />
                                  <div className="h-1.5 bg-zinc-800 rounded w-14" />
                                </div>
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeFeature === 1 && (
                  <div className="absolute inset-4 flex items-center justify-center">
                    <div className="relative w-full max-w-[400px]">
                      <div className="bg-zinc-700 rounded-xl p-1.5 shadow-2xl">
                        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-t-lg">
                          <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                          </div>
                          <div className="flex-1 flex justify-center">
                            <div className="bg-zinc-700 rounded-full px-4 py-1 text-xs text-zinc-400">
                              garage.app/meeting
                            </div>
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-900/50 to-zinc-900 aspect-video rounded-b-lg p-4">
                          <div className="grid grid-cols-2 gap-2 h-full">
                            <div className="bg-zinc-800 rounded-lg flex items-center justify-center">
                              <Video className="h-8 w-8 text-zinc-600" />
                            </div>
                            <div className="bg-zinc-800 rounded-lg flex items-center justify-center">
                              <Video className="h-8 w-8 text-zinc-600" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeFeature === 2 && (
                  <div className="absolute inset-4 flex items-center justify-center">
                    <div className="relative w-full max-w-[320px]">
                      <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-[40px] p-3 shadow-2xl">
                        <div className="bg-zinc-900 rounded-[32px] p-4 h-[400px] flex flex-col">
                          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-800">
                            <MessageSquare className="h-5 w-5" style={{ color: brandColor }} />
                            <span className="text-white text-sm font-medium">Team Chat</span>
                          </div>
                          <div className="flex-1 space-y-3 overflow-hidden">
                            <div className="flex gap-2">
                              <div className="w-6 h-6 rounded-full bg-blue-500 flex-shrink-0" />
                              <div className="bg-zinc-800 rounded-xl rounded-tl-none px-3 py-2 max-w-[80%]">
                                <p className="text-xs text-zinc-300">Hey team! Ready for standup?</p>
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <div className="rounded-xl rounded-tr-none px-3 py-2 max-w-[80%]" style={{ backgroundColor: brandColor }}>
                                <p className="text-xs text-black">On my way!</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <div className="w-6 h-6 rounded-full bg-emerald-500 flex-shrink-0" />
                              <div className="bg-zinc-800 rounded-xl rounded-tl-none px-3 py-2 max-w-[80%]">
                                <p className="text-xs text-zinc-300">Joining in 2 mins</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeFeature === 3 && (
                  <div className="absolute inset-4 flex items-center justify-center">
                    <div className="relative w-full max-w-[280px]">
                      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[40px] p-3 shadow-2xl transform rotate-[5deg]">
                        <div className="bg-zinc-900 rounded-[32px] p-4 h-[380px] flex flex-col">
                          <div className="flex items-center gap-2 mb-4">
                            <Globe className="h-5 w-5" style={{ color: brandColor }} />
                            <span className="text-white text-sm font-medium">Community</span>
                          </div>
                          <div className="bg-zinc-800 rounded-xl p-3 mb-3">
                            <div className="aspect-video bg-zinc-700 rounded-lg mb-2 flex items-center justify-center">
                              <Play className="h-8 w-8 text-zinc-500" />
                            </div>
                            <div className="h-2 bg-zinc-600 rounded w-3/4 mb-1" />
                            <div className="h-1.5 bg-zinc-700 rounded w-1/2" />
                          </div>
                          <div className="flex-1 space-y-2">
                            {[1, 2].map((i) => (
                              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/50">
                                <div className="w-10 h-10 rounded-lg bg-zinc-700" />
                                <div className="flex-1">
                                  <div className="h-2 bg-zinc-600 rounded w-20 mb-1" />
                                  <div className="h-1.5 bg-zinc-700 rounded w-14" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:pl-8">
              <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-medium mb-6 ${theme === "dark" ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-600"}`}>
                Feature {activeFeature + 1} of {platformFeatures.length}
              </span>

              <h3 className={`text-3xl md:text-4xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                {platformFeatures[activeFeature].title}
              </h3>

              <p className={`text-lg leading-relaxed mb-8 ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                {platformFeatures[activeFeature].description}
              </p>

              <ul className="space-y-4">
                {platformFeatures[activeFeature].bullets.map((bullet, index) => (
                  <li key={index} className={`flex items-center gap-3 ${theme === "dark" ? "text-zinc-300" : "text-zinc-700"}`}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: brandColor }} />
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex justify-center gap-2 mt-12">
            {platformFeatures.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveFeature(index)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  activeFeature === index
                    ? "w-8"
                    : "w-2.5 " + (theme === "dark" ? "bg-zinc-700 hover:bg-zinc-600" : "bg-zinc-300 hover:bg-zinc-400")
                }`}
                style={activeFeature === index ? { backgroundColor: brandColor } : undefined}
              />
            ))}
          </div>
        </div>
      </section> */}

      {/* Channels Section */}
      {channels.length > 0 && (
        <section id="channels" className={`py-20 ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header */}
            <div className="text-center mb-12">
              <span
                className="inline-block px-4 py-1.5 rounded-full text-sm font-medium mb-6 border"
                style={{ backgroundColor: `${brandColor}1A`, color: brandColor, borderColor: `${brandColor}33` }}
              >
                Community Channels
              </span>
              <h2 className={`text-4xl md:text-5xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                Join the Conversation
              </h2>
              <p className={`text-lg max-w-2xl mx-auto ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                Connect with fellow members in dedicated spaces for learning, networking, and growth.
              </p>
            </div>

            {/* Channels Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {channels.map((channel) => (
                <Link
                  key={channel._id}
                  href={`/guest/${slug}/channel/${channel._id}${referSuffix}`}
                  className={`group rounded-2xl overflow-hidden transition-all duration-300 block ${
                    !channel.isFree
                      ? theme === "dark" ? "bg-zinc-900 border-2 relative" : "bg-white border-2 relative shadow-sm"
                      : theme === "dark" ? "bg-zinc-900 border border-zinc-800 hover:border-zinc-700" : "bg-white border border-zinc-200 hover:border-zinc-300 shadow-sm"
                  }`}
                  style={!channel.isFree ? { borderColor: `${brandColor}4D` } : undefined}
                >
                  {/* Cover Image */}
                  {channel.coverImage && (
                    <div className="relative h-32">
                      <img
                        src={channel.coverImage}
                        alt={channel.title}
                        className="w-full h-full object-cover"
                      />
                      <div className={`absolute inset-0 bg-gradient-to-t ${theme === "dark" ? "from-zinc-900" : "from-white"} to-transparent`} />
                      {/* Premium Badge on image */}
                      {!channel.isFree && (
                        <div className="absolute top-3 right-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-black text-xs font-medium rounded-full" style={{ backgroundColor: brandColor }}>
                            <Crown className="h-3 w-3" />
                            Premium
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-6">
                    {/* Premium Badge (when no cover image) */}
                    {!channel.isFree && !channel.coverImage && (
                      <div className="absolute top-3 right-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-black text-xs font-medium rounded-full" style={{ backgroundColor: brandColor }}>
                          <Crown className="h-3 w-3" />
                          Premium
                        </span>
                      </div>
                    )}

                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: brandColor }}>
                        <Hash className="h-6 w-6 text-black" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-bold text-lg mb-1 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>{channel.title}</h3>
                        {channel.isSubscription && channel.subscriptionPeriod && (
                          <p className={`text-sm capitalize ${theme === "dark" ? "text-zinc-500" : "text-zinc-500"}`}>{channel.subscriptionPeriod} subscription</p>
                        )}
                      </div>
                    </div>

                    {channel.description && (
                      <div
                        className={`text-sm mb-4 line-clamp-2 [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_p]:mb-0 ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}
                        dangerouslySetInnerHTML={{ __html: channel.description }}
                      />
                    )}

                    <div
                      className={`pt-4 border-t ${channel.isFree ? (theme === "dark" ? "border-zinc-800" : "border-zinc-200") : ""}`}
                      style={!channel.isFree ? { borderColor: `${brandColor}33` } : undefined}
                    >
                      {channel.isFree ? (
                        <span className="px-3 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                          Free
                        </span>
                      ) : (
                        <span className="font-bold" style={{ color: brandColor }}>
                          {channel.currency}{channel.price}
                          {channel.isSubscription && channel.subscriptionPeriod && (
                            <span className={`font-normal text-sm ${theme === "dark" ? "text-zinc-500" : "text-zinc-500"}`}>/{channel.subscriptionPeriod === "monthly" ? "mo" : channel.subscriptionPeriod === "yearly" ? "yr" : channel.subscriptionPeriod}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* About Section */}
      {/* <section id="about" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-zinc-900 mb-4">About {organization.name}</h2>
            {(organization.city || organization.state || organization.country) && (
              <div className="flex items-center justify-center gap-1.5 text-zinc-500">
                <MapPin className="h-4 w-4" />
                <span>
                  {[organization.city, organization.state, organization.country]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
            )}
          </div>

         
          {organization.description && (
            <div className="max-w-3xl mx-auto">
              <p className="text-zinc-600 text-lg leading-relaxed text-center whitespace-pre-wrap">
                {organization.description}
              </p>
            </div>
          )}
        </div>
      </section> */}

      {/* Community / Members Section */}
      {members.length > 0 && (
        <section id="community" className={`py-20 ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header */}
            <div className="text-center mb-12">
              <h2 className={`text-4xl md:text-5xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                Meet Our Global Community
              </h2>
              <p className={`text-lg max-w-2xl mx-auto ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                Join {members.length.toLocaleString()}+ members from around the world learning and growing together.
              </p>
            </div>

            {/* Members Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-6 mb-12">
              {members.filter(m => m.name).slice(0, 40).map((member) => {
                // Build location string from city, state, country
                const locationParts = [member.city, member.state, member.country].filter(Boolean);
                const location = locationParts.length > 0
                  ? locationParts.slice(0, 2).join(", ")
                  : "";

                // Get initials for fallback avatar
                const initials = member.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <div key={member._id} className="flex flex-col items-center text-center group">
                    <div className="relative mb-2">
                      {member.profilePicture ? (
                        <img
                          src={member.profilePicture}
                          alt={member.name}
                          className={`w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 brand-group-border-hover transition-colors ${theme === "dark" ? "border-zinc-700" : "border-zinc-200"}`}
                        />
                      ) : (
                        <div
                          className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center border-2 transition-colors ${theme === "dark" ? "border-zinc-700" : "border-zinc-200"}`}
                          style={{ background: `linear-gradient(to bottom right, ${brandColor}, ${brandColor}CC)` }}
                        >
                          <span className="text-black font-bold text-sm md:text-lg">{initials}</span>
                        </div>
                      )}
                      {/* Founder badge or online indicator */}
                      {member.role === "founder" ? (
                        <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 flex items-center justify-center ${theme === "dark" ? "border-zinc-900" : "border-white"}`} style={{ backgroundColor: brandColor }}>
                          <Crown className="h-3 w-3 text-black" />
                        </div>
                      ) : (
                        <div className={`absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 ${theme === "dark" ? "border-zinc-900" : "border-white"}`} />
                      )}
                    </div>
                    <p className={`font-medium text-xs md:text-sm truncate w-full ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>{member.name}</p>
                    {location && (
                      <p className={`text-[10px] md:text-xs truncate w-full ${theme === "dark" ? "text-zinc-500" : "text-zinc-500"}`}>{location}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Badge */}
            <div className="flex justify-center">
              <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full border ${theme === "dark" ? "bg-zinc-800 border-zinc-700" : "bg-zinc-100 border-zinc-200"}`}>
                <div className="flex -space-x-2">
                  {members.filter(m => m.name).slice(0, 5).map((member) => (
                    member.profilePicture ? (
                      <img
                        key={member._id}
                        src={member.profilePicture}
                        alt={member.name}
                        className={`w-8 h-8 rounded-full border-2 object-cover ${theme === "dark" ? "border-zinc-800" : "border-zinc-100"}`}
                      />
                    ) : (
                      <div
                        key={member._id}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${theme === "dark" ? "border-zinc-800" : "border-zinc-100"}`}
                        style={{ background: `linear-gradient(to bottom right, ${brandColor}, ${brandColor}CC)` }}
                      >
                        <span className="text-black font-bold text-xs">
                          {member.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </span>
                      </div>
                    )
                  ))}
                </div>
                <span className={`font-medium ${theme === "dark" ? "text-zinc-300" : "text-zinc-700"}`}>
                  <span className="font-bold" style={{ color: brandColor }}>{members.length.toLocaleString()}+</span> active members worldwide
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Webinars Section */}
      {workshops.length > 0 && (
        <section id="webinars" className={`py-20 ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header */}
            <div className="text-center mb-12">
              <span
                className="inline-block px-4 py-1.5 rounded-full text-sm font-medium mb-6 border"
                style={{ backgroundColor: `${brandColor}1A`, color: brandColor, borderColor: `${brandColor}33` }}
              >
                Live Webinars
              </span>
              <h2 className={`text-4xl md:text-5xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                Learn Live from the Best
              </h2>
              <p className={`text-lg max-w-2xl mx-auto ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                Join exclusive live sessions with industry leaders, ask questions, and network with peers.
              </p>
            </div>

            {/* Upcoming Sessions Label */}
            <h3 className={`text-2xl font-bold mb-8 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>Upcoming Sessions</h3>

            {/* Webinars Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workshops.map((workshop) => (
                <Link
                  key={workshop._id}
                  href={`/guest/${slug}/webinar/${workshop._id}${referSuffix}`}
                  className={`rounded-2xl border overflow-hidden transition-all duration-300 block cursor-pointer ${theme === "dark" ? "bg-zinc-900 border-zinc-800 hover:border-zinc-700" : "bg-white border-zinc-200 hover:border-zinc-300 shadow-sm"}`}
                >
                  {/* Thumbnail */}
                  {workshop.thumbnail && (
                    <div className="relative aspect-video">
                      <img
                        src={workshop.thumbnail}
                        alt={workshop.title}
                        className="w-full h-full object-cover"
                      />
                      {/* Free Badge */}
                      {workshop.isFree && (
                        <div className="absolute top-3 left-3">
                          <span className="px-3 py-1 text-xs font-semibold bg-emerald-500/90 text-white rounded-full">
                            Free
                          </span>
                        </div>
                      )}
                      {/* Date Overlay */}
                      <div className="absolute bottom-3 left-3">
                        <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 text-center">
                          <span className="block text-xs font-medium text-zinc-400 uppercase">
                            {parseDateLocal(workshop.date).toLocaleDateString("en-US", { month: "short" })}
                          </span>
                          <span className="block text-xl font-bold text-white leading-none">
                            {parseDateLocal(workshop.date).getDate()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-6">
                    <h4 className={`font-bold text-xl mb-3 line-clamp-2 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                      {workshop.title}
                    </h4>

                    {/* Description */}
                    {workshop.description && (
                      <p className={`text-sm mb-4 line-clamp-3 ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                        {stripHtml(workshop.description)}
                      </p>
                    )}

                    {/* Event Details */}
                    <div className="space-y-2 mb-6">
                      <div className={`flex items-center gap-2 text-sm ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                        <Calendar className={`h-4 w-4 ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`} />
                        <span>{parseDateLocal(workshop.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
                      </div>
                      <div className={`flex items-center gap-2 text-sm ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                        <Clock className={`h-4 w-4 ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`} />
                        <span>{formatTime12Hour(workshop.startTime)} - {formatTime12Hour(workshop.endTime)} ({workshop.timezone})</span>
                      </div>
                      {workshop.maxParticipants && (
                        <div className={`flex items-center gap-2 text-sm ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                          <Users className={`h-4 w-4 ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`} />
                          <span>Up to {workshop.maxParticipants} participants</span>
                        </div>
                      )}
                    </div>

                    {/* Price */}
                    <div className={`pt-4 border-t ${theme === "dark" ? "border-zinc-800" : "border-zinc-200"}`}>
                      <div className="flex items-baseline gap-2">
                        {workshop.isFree ? (
                          <span className="text-xl font-bold text-emerald-400">Free</span>
                        ) : (
                          <span className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                            {workshop.currency}{workshop.price.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Courses Section - Expert-Led */}
      {courses.length > 0 && (
        <section id="courses" className={`py-20 ${theme === "dark" ? "bg-zinc-900" : "bg-zinc-50"}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header */}
            <div className="text-center mb-12">
              <span
                className="inline-block px-4 py-1.5 rounded-full text-sm font-medium mb-6 border"
                style={{ backgroundColor: `${brandColor}1A`, color: brandColor, borderColor: `${brandColor}33` }}
              >
                Expert-Led Courses
              </span>
              <h2 className={`text-4xl md:text-5xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                Learn from Industry Experts
              </h2>
              <p className={`text-lg max-w-2xl mx-auto ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                Access {courses.length}+ comprehensive courses covering various topics to help you grow and succeed.
              </p>
            </div>

            {/* Courses Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {courses.map((course, index) => {
                const levels = ["Beginner", "Intermediate", "Beginner to Advanced", "Advanced"];
                const level = levels[index % levels.length];
                const estimatedHours = Math.max(10, course.totalChapters * 2);
                const estimatedLessons = course.totalChapters * 8;

                return (
                  <Link
                    key={course._id}
                    href={`/guest/${slug}/course/${course._id}${referSuffix}`}
                    className={`group rounded-2xl border overflow-hidden transition-all duration-300 cursor-pointer block ${theme === "dark" ? "bg-zinc-900 border-zinc-800 hover:border-zinc-700" : "bg-white border-zinc-200 hover:border-zinc-300 shadow-sm"}`}
                  >
                    {/* Video Thumbnail */}
                    <div className={`relative aspect-video overflow-hidden ${theme === "dark" ? "bg-zinc-800" : "bg-zinc-100"}`}>
                      {course.coverImage ? (
                        <img
                          src={course.coverImage}
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center ${theme === "dark" ? "bg-gradient-to-br from-zinc-800 to-zinc-900" : "bg-gradient-to-br from-zinc-100 to-zinc-200"}`}>
                          <BookOpen className={`h-16 w-16 ${theme === "dark" ? "text-zinc-600" : "text-zinc-400"}`} />
                        </div>
                      )}

                      {/* Dark overlay */}
                      <div className="absolute inset-0 bg-black/40" />

                      {/* Play button */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className="w-16 h-16 rounded-full backdrop-blur-sm flex items-center justify-center border transition-colors"
                          style={{ backgroundColor: `${brandColor}33`, borderColor: `${brandColor}4D` }}
                        >
                          <Play className="h-7 w-7 ml-1" style={{ color: brandColor, fill: brandColor }} />
                        </div>
                      </div>

                      {/* Level Badge */}
                      <span className={`absolute bottom-3 left-3 px-3 py-1.5 text-xs font-medium backdrop-blur-sm rounded-md border ${theme === "dark" ? "bg-zinc-900/80 text-white border-zinc-700" : "bg-white/80 text-zinc-900 border-zinc-300"}`}>
                        {level}
                      </span>
                    </div>

                    {/* Course Info */}
                    <div className="p-6">
                      <h3 className={`font-bold text-xl mb-2 line-clamp-2 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                        {course.title}
                      </h3>

                      {/* Author */}
                      <p className="text-sm mb-3" style={{ color: brandColor }}>
                        by {organization.name}
                      </p>

                      {/* Description */}
                      <p className={`text-sm mb-4 line-clamp-2 ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                        {course.description
                          ? course.description.replace(/<[^>]*>/g, "")
                          : `Master the fundamentals and advanced concepts with this comprehensive course.`}
                      </p>

                      {/* Stats */}
                      <div className={`flex items-center gap-4 text-sm mb-3 ${theme === "dark" ? "text-zinc-500" : "text-zinc-500"}`}>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          {estimatedHours} hours
                        </span>
                        <span className="flex items-center gap-1.5">
                          <BookOpen className="h-4 w-4" />
                          {estimatedLessons} lessons
                        </span>
                      </div>

                      {/* Students enrolled */}
                      <div className={`flex items-center gap-1.5 text-sm mb-4 ${theme === "dark" ? "text-zinc-500" : "text-zinc-500"}`}>
                        <Users className="h-4 w-4" />
                        <span>{(course.enrolledStudents / 1000).toFixed(1)}K students enrolled</span>
                      </div>

                      {/* Course Topics */}
                      <div className="mb-6">
                        <p className={`text-xs mb-2 ${theme === "dark" ? "text-zinc-500" : "text-zinc-500"}`}>Course Topics:</p>
                        <div className="flex flex-wrap gap-2">
                          <span className={`px-3 py-1 text-xs rounded-md border ${theme === "dark" ? "bg-zinc-800 text-zinc-400 border-zinc-700" : "bg-zinc-100 text-zinc-600 border-zinc-200"}`}>
                            {course.title.split(" ")[0]}
                          </span>
                          <span className={`px-3 py-1 text-xs rounded-md border ${theme === "dark" ? "bg-zinc-800 text-zinc-400 border-zinc-700" : "bg-zinc-100 text-zinc-600 border-zinc-200"}`}>
                            Best Practices
                          </span>
                          <span className={`px-3 py-1 text-xs rounded-md border ${theme === "dark" ? "bg-zinc-800 text-zinc-400 border-zinc-700" : "bg-zinc-100 text-zinc-600 border-zinc-200"}`}>
                            +{Math.max(1, course.totalChapters - 2)} more
                          </span>
                        </div>
                      </div>

                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Expert Calls & Consultations Section */}
      {calls.length > 0 && (
        <section id="calls" className={`py-20 ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header */}
            <div className="text-center mb-12">
              <span
                className="inline-block px-4 py-1.5 rounded-full text-sm font-medium mb-6 border"
                style={{ backgroundColor: `${brandColor}1A`, color: brandColor, borderColor: `${brandColor}33` }}
              >
                Expert Calls &amp; Consultations
              </span>
              <h2 className={`text-4xl md:text-5xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                Get Direct Access to Experts
              </h2>
              <p className={`text-lg max-w-2xl mx-auto ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                From free community calls to premium 1-on-1 sessions, get the personalized guidance you need to succeed.
              </p>
            </div>

            {/* Calls Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {calls.map((call) => {
                const durationLabel = call.duration >= 60
                  ? `${Math.floor(call.duration / 60)}h${call.duration % 60 > 0 ? ` ${call.duration % 60}m` : ""}`
                  : `${call.duration} minutes`;

                return (
                  <Link
                    key={call._id}
                    href={`/guest/${slug}/call/${call._id}${referSuffix}`}
                    className={`rounded-2xl border overflow-hidden transition-all duration-300 relative block cursor-pointer ${
                      theme === "dark"
                        ? "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                        : "bg-white border-zinc-200 hover:border-zinc-300 shadow-sm"
                    }`}
                  >
                    <div className="p-6">
                      {/* FREE Badge */}
                      {call.isFree && (
                        <div className="absolute top-4 right-4">
                          <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-500 text-white">
                            FREE
                          </span>
                        </div>
                      )}

                      {/* Icon */}
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center mb-6"
                        style={{ backgroundColor: brandColor }}
                      >
                        <Phone className="h-6 w-6 text-white" />
                      </div>

                      {/* Title */}
                      <h4 className={`font-bold text-xl mb-3 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                        {call.title}
                      </h4>

                      {/* Description */}
                      {call.description && (
                        <p className={`text-sm mb-4 line-clamp-3 ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                          {call.description}
                        </p>
                      )}

                      {/* Rating */}
                      {call.averageRating != null && call.averageRating > 0 && (
                        <div className="flex items-center gap-2 mb-4">
                          <Star className={`h-4 w-4 fill-current`} style={{ color: brandColor }} />
                          <span className={`text-sm font-medium ${theme === "dark" ? "text-zinc-300" : "text-zinc-700"}`}>
                            {call.averageRating.toFixed(1)}
                          </span>
                          {call.reviewCount != null && call.reviewCount > 0 && (
                            <span className={`text-sm ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`}>
                              ({call.reviewCount} review{call.reviewCount !== 1 ? "s" : ""})
                            </span>
                          )}
                        </div>
                      )}

                      {/* Details */}
                      <div className={`space-y-2 pt-4 border-t ${theme === "dark" ? "border-zinc-800" : "border-zinc-200"}`}>
                        <div className="flex items-center gap-2">
                          <Clock className={`h-4 w-4 ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`} />
                          <span className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>{durationLabel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Video className={`h-4 w-4 ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`} />
                          <span className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>Video Call</span>
                        </div>
                        {(call.totalPurchased ?? 0) > 0 && (
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className={`h-4 w-4 text-emerald-500`} />
                            <span className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                              {call.totalPurchased} purchased
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Price and Creator */}
                      <div className={`flex items-center justify-between pt-4 mt-4 border-t ${theme === "dark" ? "border-zinc-800" : "border-zinc-200"}`}>
                        <div>
                          {call.isFree ? (
                            <p className="text-2xl font-bold text-emerald-500">Free</p>
                          ) : (
                            <>
                              <span className={`text-xs ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`}>Per call</span>
                              <p className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                                {call.currency || "$"}{call.pricePerCall.toLocaleString()}
                              </p>
                            </>
                          )}
                        </div>
                        {call.creator && (
                          <div className="flex items-center gap-2">
                            {call.creator.profilePicture ? (
                              <img
                                src={call.creator.profilePicture}
                                alt={call.creator.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                style={{ backgroundColor: brandColor }}
                              >
                                {call.creator.name?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                            )}
                            <span className={`text-xs ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                              {call.creator.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Products Section - Premium Resources */}
      {products.length > 0 && (
        <section id="products" className={`py-20 ${theme === "dark" ? "bg-zinc-900" : "bg-zinc-50"}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header */}
            <div className="text-center mb-12">
              <span
                className="inline-block px-4 py-1.5 rounded-full text-sm font-medium mb-6 border"
                style={{ backgroundColor: `${brandColor}1A`, color: brandColor, borderColor: `${brandColor}33` }}
              >
                Premium Products
              </span>
              <h2 className={`text-4xl md:text-5xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                Professional Resources at Your Fingertips
              </h2>
              <p className={`text-lg max-w-2xl mx-auto ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                Access our entire library of premium products, worth over {products[0]?.currency || "$"}{products.reduce((sum, p) => sum + p.price, 0).toLocaleString()}, included with your membership.
              </p>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {products.map((product, index) => (
                <Link
                  key={product._id}
                  href={`/guest/${slug}/product/${product._id}${referSuffix}`}
                  className={`group rounded-2xl border overflow-hidden transition-all duration-300 block cursor-pointer ${theme === "dark" ? "bg-zinc-800 border-zinc-700 hover:border-zinc-600" : "bg-white border-zinc-200 hover:border-zinc-300 shadow-sm"}`}
                >
                  {/* Product Image */}
                  <div className={`relative aspect-[16/10] overflow-hidden ${theme === "dark" ? "bg-zinc-900" : "bg-zinc-100"}`}>
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${theme === "dark" ? "bg-gradient-to-br from-zinc-800 to-zinc-900" : "bg-gradient-to-br from-zinc-100 to-zinc-200"}`}>
                        <ShoppingBag className={`h-16 w-16 ${theme === "dark" ? "text-zinc-600" : "text-zinc-400"}`} />
                      </div>
                    )}
                    {/* Rating Badge */}
                    <div className={`absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full border ${theme === "dark" ? "bg-zinc-900/90 border-zinc-700" : "bg-white/90 border-zinc-200"}`}>
                      <Star className="h-3.5 w-3.5" style={{ color: brandColor, fill: brandColor }} />
                      <span className={`text-sm font-semibold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                        {(4.5 + (index % 5) * 0.1).toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="p-6">
                    <h3 className={`font-bold text-xl mb-2 line-clamp-1 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                      {product.name}
                    </h3>
                    <p className={`text-sm mb-4 line-clamp-2 ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                      {stripHtml(product.description) || `Premium ${product.isDigital ? "digital" : ""} product with professional quality and instant access.`}
                    </p>

                    {/* Feature Bullets */}
                    <div className="space-y-2 mb-6">
                      {product.isDigital && (
                        <div className={`flex items-center gap-2 text-sm ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                          <Check className="h-4 w-4" style={{ color: brandColor }} />
                          <span>Instant digital delivery</span>
                        </div>
                      )}
                      <div className={`flex items-center gap-2 text-sm ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                        <Check className="h-4 w-4" style={{ color: brandColor }} />
                        <span>Lifetime access</span>
                      </div>
                      <div className={`flex items-center gap-2 text-sm ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                        <Check className="h-4 w-4" style={{ color: brandColor }} />
                        <span>Regular updates</span>
                      </div>
                    </div>

                    {/* Price & Download */}
                    <div className={`flex items-center justify-between pt-4 border-t ${theme === "dark" ? "border-zinc-700" : "border-zinc-200"}`}>
                      <div>
                        <span className={`text-sm line-through ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`}>
                          {product.currency}{product.price.toLocaleString()}
                        </span>
                        <div className="flex items-center gap-1.5" style={{ color: brandColor }}>
                          <Lock className="h-4 w-4" />
                          <span className="font-semibold">Included</span>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1.5 text-sm ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`}>
                        <Download className="h-4 w-4" />
                        <span>{((index + 1) * 2.3).toFixed(1)}K</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Footer Text */}
            {products.length >= 3 && (
              <div className="text-center mt-12">
                <p className={theme === "dark" ? "text-zinc-400" : "text-zinc-600"}>
                  <span className="font-semibold" style={{ color: brandColor }}>Plus {products.length}+ more products</span>{" "}
                  added monthly for members
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Professional Services Section */}
      {services.length > 0 && (
        <section id="services" className={`py-20 ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header */}
            <div className="text-center mb-12">
              <span
                className="inline-block px-4 py-1.5 rounded-full text-sm font-medium mb-6 border"
                style={{ backgroundColor: `${brandColor}1A`, color: brandColor, borderColor: `${brandColor}33` }}
              >
                Professional Services
              </span>
              <h2 className={`text-4xl md:text-5xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                Expert Services Delivered by Our Team
              </h2>
              <p className={`text-lg max-w-2xl mx-auto ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                From strategy to execution, our experienced team delivers high-quality services tailored to your needs.
              </p>
            </div>

            {/* Services Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => {
                const milestonesCount = service.milestones?.length || 0;
                const isFree = service.paymentTiming === "free";

                return (
                  <Link
                    key={service._id}
                    href={`/guest/${slug}/service/${service._id}${referSuffix}`}
                    className={`group flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 ${
                      theme === "dark"
                        ? "bg-[#13151A] border-[#1E222B] hover:border-zinc-700 shadow-lg"
                        : "bg-white border-zinc-200 hover:border-zinc-300 shadow-sm"
                    }`}
                  >
                    {/* Banner */}
                    <div
                      className={`relative aspect-video w-full overflow-hidden ${
                        theme === "dark" ? "bg-[#0F1116]" : "bg-zinc-100"
                      }`}
                    >
                      {service.coverImage ? (
                        <img
                          src={service.coverImage}
                          alt={service.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center"
                          style={{ backgroundColor: service.iconBgColor || `${brandColor}1A` }}
                        >
                          {service.icon && service.icon.length <= 4 ? (
                            <span className="text-5xl">{service.icon}</span>
                          ) : (
                            <Briefcase className="h-10 w-10" style={{ color: brandColor }} />
                          )}
                        </div>
                      )}

                      {isFree && (
                        <span className="absolute right-3 top-3 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400 backdrop-blur-sm">
                          Free
                        </span>
                      )}
                    </div>

                    {/* Body */}
                    <div className="flex flex-1 flex-col p-5">
                      <h4
                        className={`line-clamp-1 text-base md:text-lg font-bold ${
                          theme === "dark" ? "text-white" : "text-zinc-900"
                        }`}
                      >
                        {service.title}
                      </h4>

                      {service.description && (
                        <p
                          className={`mt-2 line-clamp-2 min-h-[32px] text-xs ${
                            theme === "dark" ? "text-zinc-400" : "text-zinc-600"
                          }`}
                        >
                          {service.description}
                        </p>
                      )}

                      {/* Type + price */}
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span
                          className="rounded-md border px-2 py-1 text-[10px] font-medium"
                          style={{
                            backgroundColor: `${brandColor}1A`,
                            borderColor: `${brandColor}33`,
                            color: brandColor,
                          }}
                        >
                          {milestonesCount > 0 ? "Milestone" : service.tags?.[0] || "Service"}
                        </span>
                        <span
                          className="text-base font-semibold"
                          style={{ color: brandColor }}
                        >
                          {isFree
                            ? "Free"
                            : `${service.currency === "INR" ? "₹" : "$"}${service.totalPrice.toLocaleString()}`}
                        </span>
                      </div>

                      {/* Footer */}
                      <div
                        className={`mt-4 flex items-center justify-between gap-2 border-t pt-3 text-xs ${
                          theme === "dark"
                            ? "border-zinc-800/80 text-zinc-400"
                            : "border-zinc-200 text-zinc-500"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-3 truncate">
                          {service.duration && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {service.duration}
                            </span>
                          )}
                          {milestonesCount > 0 && (
                            <span>
                              {milestonesCount} milestone{milestonesCount !== 1 ? "s" : ""}
                            </span>
                          )}
                          {!service.duration && milestonesCount === 0 && service.projectsCompleted > 0 && (
                            <span>{service.projectsCompleted}+ delivered</span>
                          )}
                        </span>
                        <span
                          className="flex shrink-0 items-center gap-1 font-medium"
                          style={{ color: brandColor }}
                        >
                          View Details
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Custom Solution CTA Banner */}
            {/* <div
              className="mt-12 rounded-2xl p-8 text-center"
              style={{
                background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}CC 100%)`,
              }}
            >
              <h3 className="text-2xl md:text-3xl font-bold text-zinc-900 mb-3">
                Need a Custom Solution?
              </h3>
              <p className="text-zinc-700 mb-6 max-w-xl mx-auto">
                We offer tailored services to meet your specific needs. Let&apos;s discuss your project.
              </p>
              <button
                className="px-8 py-3 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Schedule a Free Consultation
              </button>
            </div> */}
          </div>
        </section>
      )}

      {/* Channels Section - moved to after Features */}

      {/* Promo Popup - Commented out for now, may re-enable later */}
      {/* {showPromoPopup && !organization.isMember && !(isWorkspaceUser && workspaceOrgId === organization._id) && !organization.requestStatus && !guestLimitReached && (
        <div className="hidden md:block fixed top-20 right-4 z-50 w-80 animate-in slide-in-from-right duration-300">
          <div className={`rounded-2xl overflow-hidden shadow-2xl ${theme === "dark" ? "bg-zinc-900 border border-zinc-800" : "bg-white border border-zinc-200"}`}>
            <div className="px-5 py-4 relative" style={{ background: `linear-gradient(to right, ${brandColor}, ${brandColor}CC)` }}>
              <button
                onClick={() => setShowPromoPopup(false)}
                className="absolute top-3 right-3 p-1 rounded-full bg-black/20 hover:bg-black/30 transition-colors"
              >
                <X className="h-4 w-4 text-white" />
              </button>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-black/80">Already {members.length.toLocaleString()} people in the community</span>
              </div>
              <h3 className="text-xl font-bold text-black">Join Today & Save 100%</h3>
              <p className="text-sm text-black/70">Because Its</p>
            </div>

            <div className="p-5">
              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                    FREE
                  </span>
                </div>
                <p className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`}>
                  For live community access
                </p>
              </div>

              <div className="space-y-2.5 mb-5">
                {[
                  "Talk to all members",
                  "Participate in webinars",
                  "Access private feeds",
                  "Access founders",
                  "Get paid for referrals"
                ].map((benefit, index) => (
                  <div key={index} className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 flex-shrink-0" style={{ color: brandColor }} />
                    <span className={`text-sm ${theme === "dark" ? "text-zinc-300" : "text-zinc-700"}`}>{benefit}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleApplyClick}
                disabled={joiningOrg}
                className="w-full text-black font-semibold h-11 rounded-lg hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                {joiningOrg ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Join the Community
                <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
              </Button>
            </div>
          </div>
        </div>
      )} */}

      {/* FAB - Commented out for now, may re-enable later */}
      {/* {!showPromoPopup && !organization.isMember && !(isWorkspaceUser && workspaceOrgId === organization._id) && !organization.requestStatus && !guestLimitReached && (
        <button
          onClick={() => setShowPromoPopup(true)}
          className="hidden md:flex fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full items-center justify-center transition-all hover:scale-105 hover:opacity-90 animate-in zoom-in duration-300"
          style={{ backgroundColor: brandColor, boxShadow: `0 10px 15px -3px ${brandColor}4D` }}
        >
          <Maximize2 className="h-6 w-6 text-black" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
        </button>
      )} */}

      {/* Footer */}
      <footer className={`py-8 border-t ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {organization.icon ? (
                <img
                  src={organization.icon}
                  alt={organization.name}
                  className="h-8 w-8 rounded-lg object-cover"
                />
              ) : (
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center"
                  style={{ background: `linear-gradient(to bottom right, ${brandColor}, ${brandColor}CC)` }}
                >
                  <Building2 className="h-4 w-4 text-white" />
                </div>
              )}
              <span className={`font-medium ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>{organization.name}</span>
            </div>
            <p className={`text-sm ${theme === "dark" ? "text-zinc-500" : "text-zinc-500"}`}>
              Powered by <span className="font-medium" style={{ color: brandColor }}>Garage</span>
            </p>
          </div>
        </div>
      </footer>

      {/* Mobile Auth UI - Full page on mobile */}
      {showAuthModal && isMobile && (
        <>
          {/* Full screen backdrop */}
          <div
            className="fixed inset-0 bg-white z-[9998]"
            style={{
              top: '-100px',
              bottom: '-100px',
              left: '-100px',
              right: '-100px',
            }}
          />
          {/* Main content */}
          <div
            className="fixed inset-0 z-[9999] bg-white flex flex-col"
          >
          {/* Header with close button */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
            <div className="flex items-center gap-2">
              {organization.icon ? (
                <img
                  src={organization.icon}
                  alt={organization.name}
                  className="h-8 w-8 rounded-lg object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-zinc-400" />
                </div>
              )}
              <span className="font-medium text-zinc-900 text-sm">{organization.name}</span>
            </div>
            <button
              onClick={() => {
                setShowAuthModal(false);
                setAuthStep("email");
                setOtp("");
                setPhone("");
                setJoinName("");
                setPendingPublicJoin(false);
                setIsExistingUser(false);
              }}
              className="p-2 rounded-full hover:bg-zinc-100 transition-colors"
            >
              <X className="h-5 w-5 text-zinc-500" />
            </button>
          </div>

          {/* Content area - scrollable if needed */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* Title */}
            <h2 className="text-2xl font-bold text-zinc-900 text-center mb-2">
              {organization.office_public ? `Join ${organization.name}'s Office` : `Request To Join ${organization.name}`}
            </h2>
            <p className="text-zinc-500 text-sm text-center mb-6">
              Join {organization.name} community
            </p>

            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex items-center justify-center gap-2 mb-2">
                {/* Step 1 */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      authStep === "email"
                        ? isLightColor(brandColor) ? "text-white" : "text-black"
                        : "bg-emerald-500 text-white"
                    }`}
                    style={authStep === "email" ? { backgroundColor: mobileAuthButtonColor } : {}}
                  >
                    {authStep !== "email" ? <Check className="h-4 w-4" /> : "1"}
                  </div>
                </div>
                <div
                  className={`w-12 h-1 rounded ${
                    authStep === "email" ? "bg-zinc-200" : "bg-emerald-500"
                  }`}
                />
                {/* Step 2 */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      authStep === "otp"
                        ? isLightColor(brandColor) ? "text-white" : "text-black"
                        : authStep === "phone"
                        ? "bg-emerald-500 text-white"
                        : "bg-zinc-200 text-zinc-500"
                    }`}
                    style={authStep === "otp" ? { backgroundColor: mobileAuthButtonColor } : {}}
                  >
                    {authStep === "phone" ? <Check className="h-4 w-4" /> : "2"}
                  </div>
                </div>
                <div
                  className={`w-12 h-1 rounded ${
                    authStep === "phone" ? "bg-emerald-500" : "bg-zinc-200"
                  }`}
                />
                {/* Step 3 */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      authStep === "phone"
                        ? isLightColor(brandColor) ? "text-white" : "text-black"
                        : "bg-zinc-200 text-zinc-500"
                    }`}
                    style={authStep === "phone" ? { backgroundColor: mobileAuthButtonColor } : {}}
                  >
                    3
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-zinc-500">
                Step {authStep === "email" ? "1" : authStep === "otp" ? "2" : "3"} of 3:{" "}
                {authStep === "email"
                  ? "Enter Email"
                  : authStep === "otp"
                  ? "Verify Code"
                  : "Complete Profile"}
              </p>
            </div>

            {/* Form Content */}
            <div className="space-y-4">
              {authStep === "email" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="mobile-email" className="text-zinc-700 text-sm">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                      <Input
                        id="mobile-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && requestOtp()}
                        className="pl-11 bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 h-12 text-base"
                      />
                    </div>
                  </div>
                  <button
                    onClick={requestOtp}
                    disabled={!email || authLoading}
                    className={`w-full h-12 rounded-full font-semibold text-base hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity ${isLightColor(brandColor) ? "text-white" : "text-black"}`}
                    style={{ backgroundColor: mobileAuthButtonColor }}
                  >
                    {authLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </button>
                </div>
              ) : authStep === "otp" ? (
                <div className="space-y-4">
                  <div className="text-center mb-2">
                    <p className="text-sm text-zinc-600">
                      Enter the 6-digit code sent to
                    </p>
                    <p className="font-medium text-zinc-900">{email}</p>
                  </div>
                  <OtpInput value={otp} onChange={setOtp} />
                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthStep("email");
                        setOtp("");
                      }}
                      className="text-zinc-500 hover:text-zinc-700 transition-colors"
                    >
                      Change email
                    </button>
                    <button
                      type="button"
                      onClick={resendOtp}
                      disabled={secondsLeft > 0}
                      className="inline-flex items-center gap-1.5 text-zinc-500 disabled:opacity-50 hover:text-zinc-700 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {secondsLeft > 0 ? `${secondsLeft}s` : "Resend"}
                    </button>
                  </div>
                  <button
                    onClick={verifyOtp}
                    disabled={otp.length !== 6 || authLoading}
                    className={`w-full h-12 rounded-full font-semibold text-base hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity ${isLightColor(brandColor) ? "text-white" : "text-black"}`}
                    style={{ backgroundColor: mobileAuthButtonColor }}
                  >
                    {authLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Verify
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Name Field - only show if user is not already in system */}
                  {!isExistingUser && (
                    <div className="space-y-2">
                      <Label htmlFor="mobile-joinName" className="text-zinc-700 text-sm">
                        Your Name <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                        <Input
                          id="mobile-joinName"
                          type="text"
                          autoComplete="name"
                          placeholder="John Doe"
                          value={joinName}
                          onChange={(e) => setJoinName(e.target.value)}
                          className="pl-11 bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 h-12 text-base"
                        />
                      </div>
                    </div>
                  )}

                  {/* Phone Field */}
                  <div className="space-y-2">
                    <Label htmlFor="mobile-phone" className="text-zinc-700 text-sm">
                      Phone Number <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-2">
                      {/* Country code selector */}
                      <div className="relative" ref={countryDropdownRef}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCountryDropdown(!showCountryDropdown);
                            setCountrySearch("");
                          }}
                          className="flex items-center gap-1 h-12 px-3 rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 text-sm whitespace-nowrap"
                        >
                          <span>{selectedCountry?.flag}</span>
                          <span className="text-zinc-700">{selectedCountry?.code}</span>
                          <ChevronDown className="h-3 w-3 text-zinc-400" />
                        </button>
                        {showCountryDropdown && (
                          <div className="absolute top-full left-0 mt-1 w-64 max-h-56 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 overflow-hidden">
                            <div className="p-2 border-b border-zinc-100">
                              <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                                <input
                                  type="text"
                                  placeholder="Search country..."
                                  value={countrySearch}
                                  onChange={(e) => setCountrySearch(e.target.value)}
                                  className="w-full pl-7 pr-2 py-1.5 text-sm border border-zinc-200 rounded-md outline-none focus:border-zinc-400"
                                  autoFocus
                                />
                              </div>
                            </div>
                            <div className="overflow-y-auto max-h-44">
                              {filteredCountries.map((c) => (
                                <button
                                  key={c.isoCode}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCountryIso(c.isoCode);
                                    setShowCountryDropdown(false);
                                    setCountrySearch("");
                                  }}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50 text-left ${
                                    c.isoCode === selectedCountryIso ? "bg-zinc-100" : ""
                                  }`}
                                >
                                  <span>{c.flag}</span>
                                  <span className="text-zinc-900 truncate flex-1">{c.name}</span>
                                  <span className="text-zinc-500 text-xs">{c.code}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <Input
                        id="mobile-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="9876543210"
                        value={phone}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, "");
                          if (value.length <= 15) {
                            setPhone(value);
                          }
                        }}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          phone.length >= 7 &&
                          (isExistingUser || joinName.trim()) &&
                          completePhoneAndJoin()
                        }
                        className="flex-1 bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 h-12 text-base"
                      />
                    </div>
                    <p className="text-xs text-zinc-500">
                      Required for account verification
                    </p>
                  </div>

                  <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div className="text-emerald-800 text-xs">
                      <p className="font-medium">Your privacy is protected</p>
                      <p className="text-emerald-600">
                        No spam, only important updates.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={completePhoneAndJoin}
                    disabled={phone.length < 7 || (!isExistingUser && !joinName.trim()) || joiningOrg}
                    className={`w-full h-12 rounded-full font-semibold text-base hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity ${isLightColor(brandColor) ? "text-white" : "text-black"}`}
                    style={{ backgroundColor: mobileAuthButtonColor }}
                  >
                    {joiningOrg ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Complete Setup
                        <Check className="h-5 w-5" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Privacy note */}
            <p className="text-xs text-zinc-400 text-center mt-6">
              <Lock className="inline h-3 w-3 mr-1" />
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
        </>
      )}

      {/* Auth Modal - Desktop only */}
      <Dialog
        open={showAuthModal && !isMobile}
        onOpenChange={(open) => {
          setShowAuthModal(open);
          if (!open) {
            setAuthStep("email");
            setOtp("");
            setPhone("");
            setJoinName("");
            setPendingPublicJoin(false);
            setIsExistingUser(false);
          }
        }}
      >
        <DialogContent className="bg-white border-zinc-200 text-zinc-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-zinc-900">
              {authStep === "email"
                ? "Verify Your Email"
                : authStep === "otp"
                ? "Enter Code"
                : "Almost There!"}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm">
              {authStep === "email"
                ? "We'll send you a verification code."
                : authStep === "otp"
                ? `Enter the 6-digit code sent to ${email}`
                : "We need your phone number to complete the setup."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {authStep === "email" ? (
              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-700 text-sm">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && requestOtp()}
                    className="pl-10 bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 brand-focus h-11"
                  />
                </div>
              </div>
            ) : authStep === "otp" ? (
              <div className="space-y-4">
                <OtpInput value={otp} onChange={setOtp} />
                <div className="flex items-center justify-between text-sm text-zinc-500">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep("email");
                      setOtp("");
                    }}
                    className="hover:text-zinc-700 transition-colors"
                  >
                    Change email
                  </button>
                  <button
                    type="button"
                    onClick={resendOtp}
                    disabled={secondsLeft > 0}
                    className="inline-flex items-center gap-1.5 disabled:opacity-50 hover:text-zinc-700 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    {secondsLeft > 0 ? `${secondsLeft}s` : "Resend"}
                  </button>
                </div>
              </div>
            ) : (
              /* Phone step for public org join - collect name and phone */
              <div className="space-y-4">
                {/* Name Field - only show if user is not already in system */}
                {!isExistingUser && (
                  <div className="space-y-2">
                    <Label htmlFor="joinName" className="text-zinc-700 text-sm">
                      Your Name <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                      <Input
                        id="joinName"
                        type="text"
                        placeholder="John Doe"
                        value={joinName}
                        onChange={(e) => setJoinName(e.target.value)}
                        className="pl-10 bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 brand-focus h-11"
                      />
                    </div>
                  </div>
                )}

                {/* Phone Field */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-zinc-700 text-sm">
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex gap-2">
                    {/* Country code selector */}
                    <div className="relative" ref={countryDropdownRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCountryDropdown(!showCountryDropdown);
                          setCountrySearch("");
                        }}
                        className="flex items-center gap-1 h-11 px-2.5 rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 text-sm whitespace-nowrap"
                      >
                        <span className="text-sm">{selectedCountry?.flag}</span>
                        <span className="text-zinc-700 text-sm">{selectedCountry?.code}</span>
                        <ChevronDown className="h-3 w-3 text-zinc-400" />
                      </button>
                      {showCountryDropdown && (
                        <div className="absolute top-full left-0 mt-1 w-64 max-h-56 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 overflow-hidden">
                          <div className="p-2 border-b border-zinc-100">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                              <input
                                type="text"
                                placeholder="Search country..."
                                value={countrySearch}
                                onChange={(e) => setCountrySearch(e.target.value)}
                                className="w-full pl-7 pr-2 py-1.5 text-sm border border-zinc-200 rounded-md outline-none focus:border-zinc-400"
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="overflow-y-auto max-h-44">
                            {filteredCountries.map((c) => (
                              <button
                                key={c.isoCode}
                                type="button"
                                onClick={() => {
                                  setSelectedCountryIso(c.isoCode);
                                  setShowCountryDropdown(false);
                                  setCountrySearch("");
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50 text-left ${
                                  c.isoCode === selectedCountryIso ? "bg-zinc-100" : ""
                                }`}
                              >
                                <span>{c.flag}</span>
                                <span className="text-zinc-900 truncate flex-1">{c.name}</span>
                                <span className="text-zinc-500 text-xs">{c.code}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, "");
                        if (value.length <= 15) {
                          setPhone(value);
                        }
                      }}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        phone.length >= 7 &&
                        (isExistingUser || joinName.trim()) &&
                        completePhoneAndJoin()
                      }
                      className="flex-1 bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 brand-focus h-11"
                    />
                  </div>
                  <p className="text-xs text-zinc-500">
                    Required for account verification and important updates
                  </p>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="text-emerald-800 text-xs">
                    <p className="font-medium">Your privacy is protected</p>
                    <p className="text-emerald-600">
                      We only use your info for verification and important
                      updates. No spam.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAuthModal(false)}
              disabled={authLoading || joiningOrg}
              className="border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900"
            >
              Cancel
            </Button>
            {authStep === "email" ? (
              <Button
                onClick={requestOtp}
                disabled={!email || authLoading}
                className="text-black font-medium hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Continue"
                )}
              </Button>
            ) : authStep === "otp" ? (
              <Button
                onClick={verifyOtp}
                disabled={otp.length !== 6 || authLoading}
                className="text-black font-medium hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Verify"
                )}
              </Button>
            ) : (
              <Button
                onClick={completePhoneAndJoin}
                disabled={phone.length < 7 || (!isExistingUser && !joinName.trim()) || joiningOrg}
                className="text-black font-medium hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                {joiningOrg ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Complete Setup"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="bg-white border-zinc-200 text-zinc-900 sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              {organization.icon ? (
                <img
                  src={organization.icon}
                  alt={organization.name}
                  className="h-10 w-10 rounded-lg object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-zinc-400" />
                </div>
              )}
              <div>
                <DialogTitle className="text-base font-semibold text-zinc-900">
                  Join {organization.name}
                </DialogTitle>
                <DialogDescription className="text-zinc-500 text-xs">
                  Request to become a member
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name Field - only show if user is not already in system */}
            {!isExistingUser && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-zinc-700 text-sm">
                  Your Name
                </Label>
                <Input
                  id="name"
                  placeholder="Optional"
                  value={requestName}
                  onChange={(e) => setRequestName(e.target.value)}
                  className="bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 brand-focus h-10"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="message" className="text-zinc-700 text-sm">
                Message
              </Label>
              <Textarea
                id="message"
                placeholder="Introduce yourself... (optional)"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                rows={3}
                className="bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 brand-focus resize-none"
              />
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: brandColor }} />
              <p className="text-xs text-zinc-600">
                A personal message increases your chances of approval.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowApplyDialog(false)}
              disabled={submitting}
              className="border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900"
            >
              Cancel
            </Button>
            <Button
              onClick={submitRequest}
              disabled={submitting}
              className="text-black font-medium hover:opacity-90"
              style={{ backgroundColor: brandColor }}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-3.5 w-3.5 mr-2" />
                  Send Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Already Member Modal */}
      <Dialog open={showAlreadyMemberModal} onOpenChange={setShowAlreadyMemberModal}>
        <DialogContent className="bg-white border-zinc-200 text-zinc-900 sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-zinc-900">
                  You&apos;re Already a Member!
                </DialogTitle>
                <DialogDescription className="text-zinc-500 text-xs">
                  {alreadyMemberData?.orgName}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-zinc-600">
              Great news! You&apos;re already a member of this organization. Click below to go to your workspace.
            </p>
          </div>

          <DialogFooter>
            <Button
              onClick={handleAlreadyMemberRedirect}
              disabled={redirectingToWorkspace}
              className="w-full text-black font-medium hover:opacity-90"
              style={{ backgroundColor: brandColor }}
            >
              {redirectingToWorkspace ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Go To {organization.name}&apos;s Office
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

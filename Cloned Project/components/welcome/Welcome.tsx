"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { api } from "@/lib/api";
import type { ICountry } from "country-state-city";
import {
  CountryCodePicker,
  dialOf,
  findCountryByIso,
} from "@/components/ui/country-code-picker";
import {
  detectMode,
  buildIdentifier,
  isValidEmail,
  isValidPhoneInput,
  countryOfTyped,
} from "@/lib/identifier";
import Bat246Landing from "./Bat246Landing";
import { useWhitelabelContext } from "@/lib/whitelabel-context";
import {
  getUserDataFromToken,
  isAuthenticated,
  saveOrgId,
  saveToken,
} from "@/lib/auth";
import { isAddingAccount } from "@/lib/accounts";
import {
  defaultHomeFor,
  isBat246OrgId,
  resolveHomeFor,
  useIsBat246Domain,
} from "@/lib/bat246Office";
import {
  BAT246_AUTH_BUTTON_CLASS,
  BAT246_AUTH_BACK_CLASS,
  BAT246_AUTH_BUTTON_ICON_CLASS,
  BAT246_AUTH_DISCLAIMER_CLASS,
  BAT246_AUTH_INPUT_ROW_CLASS,
  BAT246_AUTH_INPUT_TEXT_CLASS,
  BAT246_AUTH_SUBTITLE_CLASS,
  Bat246LeftPanel,
  Bat246PoweredBy,
  Bat246Title,
} from "./Bat246AuthChrome";
import { cn } from "@/lib/utils";
import CancelAddAccount from "@/components/shared/CancelAddAccount";
import {
  forwardDeeplinkParams,
  isDeeplinkIntent,
  safeRedirect,
  withCompleteProfile,
} from "@/lib/deeplink";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LogIn,
  Video,
  Building,
  Rocket,
  Search,
  Shield,
  MessageCircle,
  Mail,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";

import { WelcomeLogo } from "./WelcomeLogo";
import { WelcomeCard } from "./WelcomeCard";

type ActiveFlow = null | "login" | "create" | "talk";

/**
 * What to call each deep-link `itemType` on screen. The keys are the storefront's
 * type names (the same set `/public/sellable-items/:type/:id` switches on); the
 * values are what the rest of the app calls them — a `channel` is a Community
 * everywhere a member can see it, and a `workshop` is a webinar.
 */
const ITEM_KIND_LABELS: Record<string, string> = {
  channel: "community",
  course: "course",
  product: "product",
  workshop: "webinar",
  service: "service",
  call: "call",
};

export function Welcome() {
  const [activeFlow, setActiveFlow] = useState<ActiveFlow>(null);
  /**
   * Holds whichever identifier is being typed — an email address, or the
   * LOCAL part of a phone number once `mode` flips to "phone" (the dial code
   * lives in `phoneCountry`). Kept under the name `email` because that is the
   * field name the request and the /verify query param both still use.
   */
  const [email, setEmail] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<ICountry | null>(null);
  /** So picking a country can put the caret back in the number field. */
  const identifierRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const mode = detectMode(email);

  /**
   * When someone pastes or types a full "+CC…" number, move the picker to
   * that country. Without this the flag can say India while the field holds a
   * US number — the control contradicts the value, and the user has no reason
   * to trust which one is being sent.
   */
  useEffect(() => {
    const iso = countryOfTyped(email);
    if (iso && iso !== phoneCountry?.isoCode) {
      const match = findCountryByIso(iso);
      if (match) setPhoneCountry(match);
    }
  }, [email, phoneCountry?.isoCode]);

  const router = useRouter();
  const searchParams = useSearchParams();
  const whitelabel = useWhitelabelContext();

  /**
   * Bat246 only.
   *
   * Its white-label domain (gotobigwin.com) is a webinar funnel, so the
   * landing offers two ways in rather than the single Login card every other
   * white-label domain shows. Gated on the org id so no other client site
   * changes — this is a one-office arrangement, not a white-label feature.
   */
  const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";
  /**
   * bat246.com is BAT 246's login page, not the funnel: a single Login card
   * with BAT 246 chrome (see Bat246AuthChrome). Takes precedence over
   * `isBat246` so registering the domain to the office can't turn it into
   * the funnel.
   */
  const isBat246Domain = useIsBat246Domain();
  const isBat246 =
    !isBat246Domain &&
    whitelabel.isWhitelabel &&
    whitelabel.orgId === BAT246_ORG_ID;

  /**
   * Resolved at runtime rather than hard-coded: the webinar behind this
   * funnel will be replaced, and a stale id would leave a dead button that
   * no founder can fix. Null until it loads, or if the org has none — the
   * card is hidden rather than linking nowhere.
   */
  const [bat246Webinar, setBat246Webinar] = useState<{
    id: string;
    title: string;
    live: boolean;
  } | null>(null);

  useEffect(() => {
    if (!isBat246) return;
    let cancelled = false;
    api<{ webinar: { id: string; title: string; live: boolean } | null }>(
      `/public/webinar/for-org/${BAT246_ORG_ID}`
    )
      .then((r) => {
        if (!cancelled) setBat246Webinar(r.webinar);
      })
      .catch(() => {
        // Landing still works without it — the webinar card just doesn't show.
        if (!cancelled) setBat246Webinar(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isBat246]);

  // `ref` is what every affiliate share link carries (Grow Your Network builds
  // `?ref=<affiliateId>`); `referCode` is the older name still used by the
  // guest pages. Accept both so a visitor arriving from either link shape gets
  // credited to the same person.
  const referralCode =
    searchParams.get("referCode") || searchParams.get("ref");
  const flowParam = searchParams.get("flow") as ActiveFlow;
  const hideBack = searchParams.get("hideBack") === "1";
  // Set only by the BAT246 office-invite modal's iframe src — shows a
  // "Powered By" label above the Garage logo so a visitor arriving from
  // that branded funnel sees whose platform this sign-in actually is.
  // Every other /login entry point (including whitelabel domains, which
  // show an org's own logo here instead) is unaffected.
  const showPoweredBy = searchParams.get("source") === "bat246";

  // Who invited this visitor, resolved from the affiliate id in the URL. Null
  // until it loads, and stays null if the id matches nobody — the banner is
  // hidden rather than naming an unknown person.
  const [referrer, setReferrer] = useState<{
    name: string;
    profilePicture?: string | null;
  } | null>(null);

  // What the link points at — the offering (community, course, product,
  // webinar, service, call) or the office being joined. Same params the
  // deep-link redirect already runs on (see DEEPLINK_PARAMS); this only reads
  // them so the visitor can see what they're signing up for before they hand
  // over an email.
  const deeplinkItemType = searchParams.get("itemType");
  const deeplinkItemId = searchParams.get("itemId");
  const deeplinkOrgId = searchParams.get("orgId");
  const [joinTarget, setJoinTarget] = useState<{
    name: string;
    kind: string;
    image?: string | null;
    orgName?: string | null;
  } | null>(null);

  // Scroll locking is handled by auth layout

  // Set active flow from URL parameter (e.g., /login?flow=login)
  useEffect(() => {
    if (flowParam && ["login", "create", "talk"].includes(flowParam)) {
      setActiveFlow(flowParam);
      return;
    }
    // Someone arriving on a referral link has already chosen. The menu asks
    // them to pick between Login, Admin and Want to talk — a decision they
    // made when they clicked their friend's link — so open the email field
    // directly, with the referral card above it. An explicit `flow` in the
    // URL still wins (the branch above), and Back still returns to the menu:
    // this only re-runs when the params themselves change.
    if (referralCode) setActiveFlow("login");
  }, [flowParam, referralCode]);

  // Store referral code
  useEffect(() => {
    if (referralCode) {
      localStorage.setItem("referral_code", referralCode);
    }
  }, [referralCode]);

  // Resolve the referral code to a name so the login screen can say who
  // invited them. Failures are silent — this is decoration on a login form,
  // and an error toast here would read as the login itself being broken.
  useEffect(() => {
    if (!referralCode) {
      setReferrer(null);
      return;
    }
    let cancelled = false;
    // `light=1` is the variant built for exactly this card — name and avatar
    // only. The full response also computes downline stats behind a 50-deep
    // $graphLookup, which nothing here renders and which no one should pay
    // for on a login page (garagenew-backend routes/affiliate.ts).
    api<{
      success: boolean;
      referrer?: { name?: string; profilePicture?: string | null };
    }>(
      `/affiliate/referrer-info?affiliateId=${encodeURIComponent(
        referralCode
      )}&light=1`
    )
      .then((r) => {
        if (cancelled) return;
        // The backend returns "" rather than "Unknown" for a nameless user —
        // treat that as no referrer instead of rendering an empty name.
        const name = r?.referrer?.name?.trim();
        setReferrer(
          r?.success && name
            ? { name, profilePicture: r.referrer?.profilePicture ?? null }
            : null
        );
      })
      .catch(() => {
        if (!cancelled) setReferrer(null);
      });
    return () => {
      cancelled = true;
    };
  }, [referralCode]);

  // Resolve the deep link's destination to something nameable. An offering
  // wins over the office: `itemType`/`itemId` is the specific thing that was
  // clicked, and "Join Acme" under a course link tells the visitor less than
  // the course title does. Both lookups are public — this runs before any
  // login. Failures are silent for the same reason as the referrer above.
  useEffect(() => {
    let cancelled = false;

    if (deeplinkItemType && deeplinkItemId) {
      api<{
        success: boolean;
        item?: {
          name?: string;
          coverPhoto?: string | null;
          organization?: { name?: string } | null;
        };
      }>(
        `/public/sellable-items/${encodeURIComponent(
          deeplinkItemType
        )}/${encodeURIComponent(deeplinkItemId)}`
      )
        .then((r) => {
          if (cancelled) return;
          const name = r?.item?.name?.trim();
          setJoinTarget(
            r?.success && name
              ? {
                  name,
                  kind: ITEM_KIND_LABELS[deeplinkItemType] || "offering",
                  image: r.item?.coverPhoto ?? null,
                  orgName: r.item?.organization?.name ?? null,
                }
              : null
          );
        })
        .catch(() => {
          if (!cancelled) setJoinTarget(null);
        });
      return () => {
        cancelled = true;
      };
    }

    if (deeplinkOrgId) {
      api<{
        success: boolean;
        organization?: { name?: string; icon?: string | null };
      }>(`/public/hq-organizations/${encodeURIComponent(deeplinkOrgId)}`)
        .then((r) => {
          if (cancelled) return;
          const name = r?.organization?.name?.trim();
          setJoinTarget(
            r?.success && name
              ? { name, kind: "office", image: r.organization?.icon ?? null }
              : null
          );
        })
        .catch(() => {
          if (!cancelled) setJoinTarget(null);
        });
      return () => {
        cancelled = true;
      };
    }

    setJoinTarget(null);
    return () => {
      cancelled = true;
    };
  }, [deeplinkItemType, deeplinkItemId, deeplinkOrgId]);

  // Set while an already-signed-in visitor is being joined to the office they
  // deep-linked in for. Suppresses this page's UI entirely — they never asked
  // to log in, so a login screen flashing before the redirect reads as a
  // failure.
  const [joiningOffice, setJoiningOffice] = useState(false);
  // The join POST must fire once per landing, not once per run of the effect
  // below (its `searchParams` dependency changes identity on re-render).
  const joinFiredRef = useRef(false);

  // Redirect if authenticated
  useEffect(() => {
    if (typeof window === "undefined") return;
    // `isBat246` is only known once the whitelabel domain lookup resolves
    // (starts false while whitelabel.isLoading — see the isLoading guard
    // below in this component). Wait for it here too: without this, an
    // already-authenticated visitor's very first render on gotobigwin.com
    // would fire this effect with the still-false `isBat246`, redirect to
    // /workspace, and the gate below would never get a chance to run.
    if (whitelabel.isLoading) return;
    // Bat246's gotobigwin.com funnel must never bounce an authenticated
    // visitor to /workspace — the funnel's own OTP-verify flow calls
    // saveToken() for real Users (see WebinarPreJoin.tsx's isBat246Webinar
    // branch), so a webinar visitor becomes `isAuthenticated()` mid-funnel.
    // Without this gate, that visitor (and anyone who later hits "/" again,
    // e.g. via the browser Back button) got silently redirected into real
    // Garage instead of staying on the funnel — this domain's whole point.
    if (isBat246) return;
    if (!isAuthenticated()) return;
    // Someone adding a second account is authenticated ON PURPOSE — bouncing
    // them into the workspace is what would make adding one impossible.
    if (isAddingAccount()) return;

    const redirect = safeRedirect(
      searchParams.get("redirect"),
      defaultHomeFor(getUserDataFromToken().orgId),
    );
    const intent = searchParams.get("intent");
    const joinOrgId = searchParams.get("orgId");

    // Storefront deep links landing on an existing session: do the join in
    // the background and go straight to what was clicked. No login form, no
    // OTP. `join-office` targets an office; `item-deeplink` targets one
    // offering (community, course, product, workshop, service, call) and only
    // differs in where `redirect` points.
    if (isDeeplinkIntent(intent) && joinOrgId) {
      const user = getUserDataFromToken();
      if (user.userId) {
        if (joinFiredRef.current) return;
        joinFiredRef.current = true;
        setJoiningOffice(true);
        const orgSlug = searchParams.get("orgSlug");
        api<{
          ok: boolean;
          token: string;
          alreadyMember?: boolean;
          needsProfileCompletion?: boolean;
        }>("/guest-auth/public-join", {
          method: "POST",
          body: JSON.stringify({
            guestUserId: user.userId,
            orgId: joinOrgId,
            name: user.name || undefined,
            referralCode: searchParams.get("referCode") || undefined,
          }),
        })
          .then((res) => {
            // The returned token is scoped to the org just joined — it is what
            // makes `redirect`'s workspace load as THAT office rather than
            // whichever org was last active.
            if (res.token) saveToken(res.token);
            saveOrgId(joinOrgId);
            router.replace(
              withCompleteProfile(redirect, !!res.needsProfileCompletion)
            );
          })
          .catch((err) => {
            // `public-join` 403s on a private office (and on a guest limit).
            // The hosted office page owns request-to-join, so hand off there
            // instead of opening a workspace they didn't ask for.
            toast.error(err?.message || "Could not join that office.");
            router.replace(
              orgSlug ? `/guest/${encodeURIComponent(orgSlug)}` : redirect
            );
          });
        return;
      }
    }

    const target =
      intent === "whitelabel"
        ? `/select-organization?redirect=${encodeURIComponent(redirect)}`
        : redirect;
    toast.success("You are already signed in. Redirecting...");
    // BAT 246: the hub for a qualified distributor, Game Boards for everyone
    // else — `redirect` above only knows the hub (see resolveHomeFor).
    const orgId = getUserDataFromToken().orgId;
    if (intent !== "whitelabel" && isBat246OrgId(orgId)) {
      let cancelled = false;
      resolveHomeFor(orgId).then((home) => {
        if (!cancelled) router.replace(safeRedirect(searchParams.get("redirect"), home));
      });
      return () => {
        cancelled = true;
      };
    }
    // bat246.com, already signed in but into some other office (or none):
    // Game Boards, which joins them to BAT 246 and shows the way to become a
    // distributor — never /workspace. An explicit ?redirect= still wins.
    if (isBat246Domain && intent !== "whitelabel") {
      router.replace(
        safeRedirect(searchParams.get("redirect"), "/games/bat246/boards"),
      );
      return;
    }
    router.replace(target);
  }, [router, searchParams, whitelabel.isLoading, isBat246, isBat246Domain]);

  // Request OTP and redirect to verify page
  async function handleSubmitEmail(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email || loading) return;

    // One field, two identifiers. The request key stays `email` — six clients
    // post that name — while carrying an address or an E.164 number. The
    // country code comes from the picker, never from a guess: the backend
    // rejects a bare number precisely so nobody's OTP is routed to the wrong
    // country. See lib/identifier.ts.
    const identifier = buildIdentifier(mode, email, dialOf(phoneCountry));

    if (mode === "email" && !isValidEmail(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    // Checked against libphonenumber for the selected country, not a digit
    // count — "09876543210" and "919876543210" are both the right length and
    // both wrong, and both are things people type constantly.
    if (mode === "phone" && !isValidPhoneInput(email, dialOf(phoneCountry))) {
      toast.error("Enter a valid phone number for the selected country");
      return;
    }

    setLoading(true);
    try {
      await api("/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email: identifier }),
      });
      toast.success(
        mode === "phone" ? "Code sent to your phone!" : "OTP sent to your email!"
      );

      // Build verify URL with params. Every deep-link param has to survive
      // this hop — /verify is where the join runs once the OTP checks out, and
      // a dropped orgId or redirect there means the buyer lands in a generic
      // workspace with no memory of what they clicked on the storefront.
      const params = new URLSearchParams();
      // Param name unchanged so /verify and every deep-link consumer keep
      // working; the value is now an address or an E.164 number.
      params.set("email", identifier);
      forwardDeeplinkParams(searchParams, params);
      if (referralCode) params.set("referCode", referralCode);
      // The "Want to talk?" card is its own intent and overrides whatever the
      // URL carried — that flow ends in GARAGE HQ, not in a deep-link target.
      if (activeFlow === "talk") params.set("intent", "talk");
      // Not in DEEPLINK_PARAMS (that list is shared by other deep-link
      // features too) — forwarded explicitly here instead, just for the
      // BAT246 office-invite popup's own showPoweredBy treatment, so the
      // OTP step (`/verify`) renders it the same way the email step does.
      if (showPoweredBy) params.set("source", "bat246");

      router.push(`/verify?${params.toString()}`);
    } catch (err) {
      toast.error("Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Card click handlers
  const handleLoginClick = () => setActiveFlow("login");
  const handleCreateClick = () => setActiveFlow("create");
  const handleDiscoverClick = () => router.push("/discover");
  const handleAdminClick = () => router.push("/garage-admin/login");
  const handleTalkClick = () => setActiveFlow("talk");

  const handleBack = () => {
    setActiveFlow(null);
    setEmail("");
  };

  // Get title based on active flow
  const getFlowTitle = () => {
    switch (activeFlow) {
      case "login":
        return "Welcome Back";
      case "create":
        return "Launch Your HQ";
      case "talk":
        return "Let's Connect";
      default:
        return "";
    }
  };

  const getFlowSubtitle = () => {
    // "or phone number" is the only cue that the field takes both — the
    // country picker doesn't appear until a digit is typed, so without this
    // nothing tells anyone a number is allowed.
    switch (activeFlow) {
      case "login":
        return "Enter your email or phone number to sign in";
      case "create":
        return "Enter your email or phone number to get started";
      case "talk":
        return "Enter your email or phone number to hop into our office";
      default:
        return "";
    }
  };

  // Cards config
  const cards = [
    {
      icon: LogIn,
      title: "Login",
      subtitle: "Or Get Started For Free With Email",
      onClick: handleLoginClick,
      variant: "primary" as const,
    },
    // SUSPENDED (2026-07-03): "Launch A New HQ" (Signup) card temporarily
    // hidden. Un-comment the object below to restore. The onClick handler
    // (handleCreateClick) is intentionally left in place above so this
    // stays a one-block revert.
    // {
    //   icon: Rocket,
    //   title: "Launch A New HQ",
    //   subtitle: "Signup",
    //   onClick: handleCreateClick,
    //   variant: "secondary" as const,
    // },
    // SUSPENDED (2026-07-03): "Discover HQ's" card hidden alongside the
    // removal of the /discover route. Restoring requires bringing back
    // the app/discover/* files as well as un-commenting below.
    // {
    //   icon: Search,
    //   title: "Discover HQ's",
    //   subtitle: "Explore",
    //   onClick: handleDiscoverClick,
    //   variant: "default" as const,
    // },
    {
      icon: Shield,
      title: "I'm An Admin",
      subtitle: "Admin Portal",
      onClick: handleAdminClick,
      variant: "accent" as const,
    },
    {
      icon: MessageCircle,
      title: "Want To Talk?",
      subtitle: "Hop Into Our Office",
      onClick: handleTalkClick,
      variant: "success" as const,
    },
  ];

  // Root cause of the login-page flash on gotobigwin.com: useWhitelabel()
  // starts with isWhitelabel: false and only flips true once its domain
  // lookup fetch resolves. Without this guard, isBat246 was false for that
  // brief window too, so this component fell all the way through to the
  // normal Login/Create/Talk shell below — rendering it for real — before
  // the fetch resolved and swapped it out for Bat246Landing. Blocking on
  // isLoading here means nothing renders until we actually know which UI
  // this domain gets. A non-white-label domain (my.garage.app, localhost)
  // resolves this synchronously (no fetch), so it only ever delays a
  // genuine white-label domain, and only for as long as its lookup takes.
  //
  // Placed below EVERY hook. This sat higher up and skipped the effects
  // between, so a Bat246 render produced fewer hooks than the previous one
  // and React threw a client-side exception on the live domain.
  if (whitelabel.isLoading) {
    return null;
  }

  // Signed-in visitor mid-way through an `intent=join-office` deep link.
  // Same reasoning as above: nothing of this page may render before the
  // redirect, and this sits below every hook so the hook count never changes.
  if (joiningOffice) {
    return (
      <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isBat246) {
    return <Bat246Landing webinar={bat246Webinar} referralCode={referralCode} />;
  }

  return (
    <div
      className="h-dvh min-h-[600px] lg:min-h-screen flex overflow-hidden fixed inset-0 w-full max-w-full touch-none overscroll-none"
      style={{ touchAction: "none", overscrollBehavior: "none" }}
    >
      {/* Left Panel - Image */}
      {isBat246Domain ? (
        <Bat246LeftPanel />
      ) : (
        <div className="hidden lg:block lg:w-[45%] xl:w-[50%] relative overflow-hidden">
          <div className="absolute inset-0 bg-[#0a0a0c]">
            <Image
              src={
                whitelabel.isWhitelabel && whitelabel.coverPhoto
                  ? whitelabel.coverPhoto
                  : "./login_picture.jpg"
              }
              alt="Background"
              fill
              className="object-cover opacity-80"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#0c0c0e]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0e]/60 via-transparent to-[#0c0c0e]/40" />
          </div>
        </div>
      )}

      {/* Right Panel - Controls */}
      <div
        className={cn(
          "relative w-full lg:w-[55%] xl:w-[50%] h-full flex items-center justify-center overflow-y-auto",
          // bat246.com is black edge to edge, matching Bat246LeftPanel.
          isBat246Domain ? "bg-black" : "bg-[#0c0c0e]"
        )}
      >
        <div className="w-full max-w-md mx-auto px-5 sm:px-8 py-4 sm:py-8 lg:py-12">
          <AnimatePresence mode="wait">
            {activeFlow === null ? (
              // Main menu view
              <motion.div
                key="menu"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Logo */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="flex justify-center mb-4 sm:mb-6 lg:mb-8"
                >
                  {isBat246Domain ? (
                    <Bat246Title />
                  ) : (
                    <WelcomeLogo
                      isWhitelabel={whitelabel.isWhitelabel}
                      orgName={whitelabel.orgName}
                      orgIcon={whitelabel.orgIcon}
                      isLoading={whitelabel.isLoading}
                    />
                  )}
                </motion.div>

                {/* Title — dropped on bat246.com: there is only one option
                    to choose. */}
                {!isBat246Domain && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="text-center mb-4 sm:mb-6 lg:mb-10 px-2"
                  >
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2 break-words">
                      {whitelabel.isWhitelabel
                        ? `Welcome to ${whitelabel.orgName || "HQ"}`
                        : "Welcome to Garage"}
                    </h1>
                    <p className="text-xs sm:text-sm lg:text-base text-[#9fa0b8]">
                      Choose an option to get started
                    </p>
                  </motion.div>
                )}

                {/* Action cards - only show login for whitelabel domains */}
                <div className="space-y-1.5 sm:space-y-2 lg:space-y-2.5">
                  {(isBat246
                    ? [
                        // Webinar first — it is why someone lands here. Only
                        // shown once a webinar actually resolves.
                        ...(bat246Webinar
                          ? [
                              {
                                icon: Video,
                                title: bat246Webinar.live
                                  ? "Join Webinar — Live now"
                                  : "Join Webinar",
                                subtitle: bat246Webinar.title,
                                onClick: () =>
                                  router.push(`/webinar/${bat246Webinar.id}`),
                                variant: "primary" as const,
                              },
                            ]
                          : []),
                        {
                          icon: Building,
                          title: "Go to BAT 246",
                          subtitle: "Open your office on Garage",
                          // Full URL, not a route: the office lives on the
                          // main app, not on this white-label domain.
                          onClick: () => {
                            window.location.href = "https://my.garage.app";
                          },
                          variant: "secondary" as const,
                        },
                      ]
                    : whitelabel.isWhitelabel || isBat246Domain
                      ? [
                          {
                            ...cards[0],
                            title: "Login",
                            subtitle: "Sign in to continue",
                          },
                        ]
                      : cards
                  ).map((card, index) => (
                    <WelcomeCard
                      key={card.title}
                      icon={card.icon}
                      title={card.title}
                      subtitle={card.subtitle}
                      onClick={card.onClick}
                      variant={card.variant}
                      index={index}
                      size={isBat246Domain ? "lg" : "default"}
                    />
                  ))}
                </div>

                {/* Footer */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.4 }}
                  className="mt-4 sm:mt-6 lg:mt-8 text-center"
                >
                  <p
                    className={cn(
                      "text-[#6a6a7a]",
                      isBat246Domain
                        ? BAT246_AUTH_DISCLAIMER_CLASS
                        : "text-[10px] sm:text-xs"
                    )}
                  >
                    By continuing you agree to our{" "}
                    <a
                      href="/terms"
                      className="text-[#9fa0b8] hover:text-white transition-colors underline underline-offset-2"
                    >
                      Terms
                    </a>{" "}
                    &{" "}
                    <a
                      href="/privacy"
                      className="text-[#9fa0b8] hover:text-white transition-colors underline underline-offset-2"
                    >
                      Privacy Policy
                    </a>
                  </p>
                </motion.div>
              </motion.div>
            ) : (
              // Email input view
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Context for the link they arrived on: what they're signing
                    up for, and who sent them. Each row appears only once its
                    lookup resolves to a real name, so a plain /login is
                    unchanged and a dead id shows nothing rather than a blank. */}
                {(joinTarget || referrer) && (
                  <div className="mb-3 sm:mb-5 rounded-xl border border-[#2a2a35] bg-[#1a1a22] divide-y divide-[#2a2a35]">
                    {joinTarget && (
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        {joinTarget.image ? (
                          <img
                            src={joinTarget.image}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-semibold uppercase text-primary">
                            {joinTarget.name.charAt(0)}
                          </span>
                        )}
                        <div className="min-w-0 text-left">
                          <p className="text-[10px] uppercase tracking-wider text-[#6a6a7a]">
                            You&apos;re joining this {joinTarget.kind}
                          </p>
                          <p className="truncate text-xs sm:text-sm font-semibold text-white">
                            {joinTarget.name}
                          </p>
                          {/* The office only earns a line of its own when it
                              isn't already the thing being named above. */}
                          {joinTarget.orgName &&
                            joinTarget.orgName !== joinTarget.name && (
                              <p className="truncate text-[10px] sm:text-xs text-[#9fa0b8]">
                                by {joinTarget.orgName}
                              </p>
                            )}
                        </div>
                      </div>
                    )}

                    {referrer && (
                      <div className="flex items-center gap-2.5 px-3 py-2.5">
                        {referrer.profilePicture ? (
                          <img
                            src={referrer.profilePicture}
                            alt=""
                            className="h-7 w-7 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold uppercase text-primary">
                            {referrer.name.charAt(0)}
                          </span>
                        )}
                        <p className="min-w-0 truncate text-xs sm:text-sm text-[#9fa0b8]">
                          Referred by{" "}
                          <span className="font-semibold text-white">
                            {referrer.name}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Back button */}
                {!hideBack && (
                  <button
                    onClick={handleBack}
                    className={cn(
                      "flex items-center gap-2 text-[#9fa0b8] hover:text-white transition-colors mb-3 sm:mb-6 lg:mb-8",
                      isBat246Domain ? BAT246_AUTH_BACK_CLASS : "text-xs sm:text-sm"
                    )}
                  >
                    <ArrowLeft className={isBat246Domain ? "w-5 h-5" : "w-4 h-4"} />
                    Back
                  </button>
                )}

                {/* Logo — hidden for the BAT246 office-invite modal, which
                    shows its own "Powered By Garage" mark at the bottom
                    instead (see showPoweredBy below) rather than the full
                    Garage logo up here. */}
                {!showPoweredBy && (
                  <div className="flex justify-center mb-3 sm:mb-6 lg:mb-8">
                    {isBat246Domain ? (
                      <Bat246Title />
                    ) : (
                      <WelcomeLogo
                        isWhitelabel={whitelabel.isWhitelabel}
                        orgName={whitelabel.orgName}
                        orgIcon={whitelabel.orgIcon}
                        isLoading={whitelabel.isLoading}
                      />
                    )}
                  </div>
                )}

                {/* Title */}
                <div className="text-center mb-3 sm:mb-6 lg:mb-8">
                  {/* <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2">
                    {getFlowTitle()}
                  </h1> */}
                  {/* Double-size for the BAT246 office-invite modal (see
                      showPoweredBy) — same reasoning as the bigger footer
                      disclaimer below, both keyed off the same flag. */}
                  <p
                    className={
                      showPoweredBy
                        ? "text-2xl sm:text-3xl text-[#9fa0b8]"
                        : isBat246Domain
                          ? BAT246_AUTH_SUBTITLE_CLASS
                          : "text-xs sm:text-sm text-[#9fa0b8]"
                    }
                  >
                    {getFlowSubtitle()}
                  </p>
                </div>

                {/* Renders only mid "Add account" — see the component. */}
                <CancelAddAccount />

                {/* Email form */}
                <form
                  onSubmit={handleSubmitEmail}
                  className="space-y-3 sm:space-y-4"
                >
                  {/* One field, two identifiers. The dial-code picker slides in
                      as soon as what's typed reads as a number, so the user
                      states their country rather than us assuming +91 — the
                      guess that mislabelled 349 stored numbers. */}
                  <div className="relative z-20">
                    {/* ONE input, always mounted.
                        Rendering a separate <Input> per mode meant React
                        unmounted and remounted the element on every flip, so
                        typing the first digit — or backspacing it away — threw
                        away focus and the caret mid-word. Only the leading
                        adornment swaps; the field itself never moves. */}
                    {/* `relative` makes THIS the positioning context, so the
                        picker's dropdown spans the whole field — the same
                        arrangement ProfilePopover uses. No `overflow-hidden`
                        here: it clips the dropdown to the field's height. */}
                    <div className={cn("relative flex items-stretch rounded-xl border border-[#2a2a35] bg-[#1a1a22] transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-brand-2/20", isBat246Domain ? BAT246_AUTH_INPUT_ROW_CLASS : "h-12 sm:h-14")}>
                      {mode === "phone" ? (
                        <CountryCodePicker
                          value={phoneCountry}
                          onChange={(c) => {
                            setPhoneCountry(c);
                            // Hand the caret straight back to the number.
                            requestAnimationFrame(() => identifierRef.current?.focus());
                          }}
                          buttonClassName="rounded-l-xl"
                        />
                      ) : (
                        <span className="flex shrink-0 items-center pl-4 pr-1 text-[#6a6a7a]">
                          <Mail className={isBat246Domain ? "h-5 w-5 sm:h-6 sm:w-6" : "h-4 w-4 sm:h-5 sm:w-5"} />
                        </span>
                      )}
                      <Input
                        // Explicit key: pins this element's identity so no
                        // reconciliation path can swap it out when the sibling
                        // adornment changes type (span <-> picker). Losing the
                        // element loses focus and the caret mid-word.
                        key="login-identifier"
                        ref={identifierRef}
                        // NOT type="email": native validation would reject a
                        // phone number before submit ever ran. Type stays
                        // "text" in both modes so the element is never
                        // recreated — only inputMode/autoComplete change,
                        // which the browser applies in place.
                        type="text"
                        inputMode={mode === "phone" ? "tel" : "email"}
                        autoComplete={mode === "phone" ? "tel" : "email"}
                        placeholder={
                          mode === "phone"
                            ? "98765 43210"
                            : isBat246Domain
                              ? // The long hint is cut off at bat246.com's larger size.
                                "Email or phone number"
                              : "you@company.com or phone number"
                        }
                        className={cn(
                          "min-w-0 flex-1 h-full border-0 bg-transparent px-3 text-white placeholder:text-[#6a6a7a] focus-visible:ring-0 focus-visible:ring-offset-0",
                          isBat246Domain ? BAT246_AUTH_INPUT_TEXT_CLASS : "text-base"
                        )}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className={cn(
                      "w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-black font-semibold rounded-xl",
                      isBat246Domain
                        ? BAT246_AUTH_BUTTON_CLASS
                        : "h-12 sm:h-14 text-sm sm:text-base"
                    )}
                    disabled={!email || loading}
                  >
                    {loading ? (
                      <Loader2
                        className={cn(
                          "animate-spin",
                          isBat246Domain
                            ? BAT246_AUTH_BUTTON_ICON_CLASS
                            : "w-4 h-4 sm:w-5 sm:h-5"
                        )}
                      />
                    ) : (
                      <>
                        Send OTP
                        <ArrowRight
                          className={cn(
                            "ml-2",
                            isBat246Domain
                              ? BAT246_AUTH_BUTTON_ICON_CLASS
                              : "w-4 h-4 sm:w-5 sm:h-5"
                          )}
                        />
                      </>
                    )}
                  </Button>
                </form>

                {/* Footer — double-size for the BAT246 office-invite modal,
                    same flag as the subtitle above. */}
                <p
                  className={
                    showPoweredBy
                      ? "text-xl sm:text-2xl text-[#6a6a7a] text-center mt-4 sm:mt-6 lg:mt-8"
                      : isBat246Domain
                        ? `${BAT246_AUTH_DISCLAIMER_CLASS} text-center mt-4 sm:mt-6 lg:mt-8`
                        : "text-[10px] sm:text-xs text-[#6a6a7a] text-center mt-4 sm:mt-6 lg:mt-8"
                  }
                >
                  By continuing you agree to our Terms & Privacy Policy.
                </p>

                {/* "Powered By Garage" — only for the BAT246 office-invite
                    modal, see showPoweredBy above. Bigger and pushed further
                    down toward the bottom of the modal than a normal footer
                    mark since it's standing in for the main logo, which is
                    hidden above. */}
                {showPoweredBy && (
                  <div className="flex flex-col items-center gap-1.5 mt-16 sm:mt-24">
                    <p className="text-xs uppercase tracking-wider text-[#6a6a7a]">
                      Powered By
                    </p>
                    <Image
                      src="/logo.svg"
                      alt="Garage"
                      width={130}
                      height={40}
                      className="h-7 w-auto opacity-90"
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {isBat246Domain && <Bat246PoweredBy />}
      </div>
    </div>
  );
}

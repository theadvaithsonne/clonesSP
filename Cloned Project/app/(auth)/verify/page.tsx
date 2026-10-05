"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatIdentifier } from "@/lib/identifier";
import { saveOrgId, saveToken } from "@/lib/auth";
import { endAddAccount } from "@/lib/accounts";
import {
  isDeeplinkIntent,
  safeRedirect,
  withCompleteProfile,
} from "@/lib/deeplink";
// ActivityTracker disabled with the Team Activity retirement. The login
// rows it wrote went into UserActivity but were only read by the panel
// we just hid. OnlineActivityTab (which IS kept) reads online/offline
// rows produced by socket.ts, not by this tracker.
// import { ActivityTracker } from "@/lib/activity-tracker";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  getCurrentDomain,
  isWhitelabelDomain,
  fetchWhitelabelOrg,
} from "@/lib/whitelabel";
import { useWhitelabelContext } from "@/lib/whitelabel-context";
import { Button } from "@/components/ui/button";
import OtpInput from "@/components/ui/otp-input";
import { ArrowRight, ArrowLeft, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { WelcomeLogo } from "@/components/welcome/WelcomeLogo";
import { useAuthStore } from "@/store/authStore";
import {
  BAT246_ORG_ID,
  bat246LandingPath,
  isBat246OrgId,
  resolveHomeFor,
  useIsBat246Domain,
} from "@/lib/bat246Office";
import {
  BAT246_AUTH_BUTTON_CLASS,
  BAT246_AUTH_BACK_CLASS,
  BAT246_AUTH_BUTTON_ICON_CLASS,
  BAT246_AUTH_DISCLAIMER_CLASS,
  BAT246_AUTH_LINKS_CLASS,
  BAT246_AUTH_SUBTITLE_CLASS,
  Bat246LeftPanel,
  Bat246PoweredBy,
  Bat246Title,
} from "@/components/welcome/Bat246AuthChrome";
import { cn } from "@/lib/utils";

function VerifyPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const whitelabel = useWhitelabelContext();
  /**
   * The identifier the code was sent to — an email address or an E.164 phone
   * number. The param keeps the name `email` so every existing deep link and
   * the /auth/verify-otp payload are unchanged.
   *
   * Only lowercased when it IS an email: a phone number has no case, and
   * lowercasing is what makes "A@b.com" and "a@b.com" resolve to one account.
   */
  const rawIdentifier = (sp.get("email") || "").trim();
  const isPhone = rawIdentifier.startsWith("+");
  const email = isPhone ? rawIdentifier : rawIdentifier.toLowerCase();
  // BAT246 office-invite popup (see Welcome.tsx, same flag, forwarded here
  // from the email step) — bigger text, logo swapped for "Powered By
  // Garage" pushed to the bottom, same treatment as the email step.
  const showPoweredBy = sp.get("source") === "bat246";
  // bat246.com — same BAT 246 chrome as its login step (see Welcome.tsx).
  const isBat246Domain = useIsBat246Domain();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendAt, setResendAt] = useState<number>(0);

  useEffect(() => {
    if (!email) router.replace("/login");
  }, [email, router]);

  // Scroll locking is handled by auth layout

  async function verify() {
    if (code.length !== 6 || loading) return;
    setLoading(true);

    try {
      const referCode = sp.get("referCode");

      const data = await api<{
        token?: string;
        userId: string;
        user: {
          id: string;
          email: string;
          name?: string;
          role?: string;
          phone?: string;
          phoneVerified?: boolean;
          organizations: Array<{
            id: string;
            name: string;
            role: "founder" | "stakeholder";
            joinedAt: string;
            parent?: boolean;
            guest?: boolean;
          }>;
          hasOrganizations: boolean;
          currentOrg?: any;
        };
      }>(`/auth/verify-otp`, {
        method: "POST",
        body: JSON.stringify({
          email,
          code,
          referralCode: referCode || undefined,
        }),
      });

      // The new account is live from here on, so the "add account" flow — and
      // the login-screen bounce it suppresses — is over either way.
      endAddAccount();

      useAuthStore.getState().setUser({
        userId: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        // Carry the phone state through login. `verify-otp` returns both, and
        // dropping them here left a verified user looking unverified on every
        // fresh sign-in: the store had `phoneVerified: undefined`, so the
        // "Verify your phone" nudge came back and the profile showed the
        // number as unverified. Clearing cookies reproduced it exactly,
        // because that wipes the persisted store where a correct value had
        // been written by a later refresh.
        phone: data.user.phone,
        phoneVerified: !!data.user.phoneVerified,
      });
      const intent = sp.get("intent");

      // Storefront deep link (`intent=join-office` from `officeJoinLoginUrl`,
      // or `intent=item-deeplink` from `buildUniversalItemDeeplinkUrl`). Join
      // the target org right here and go to what was clicked —
      // /select-organization would be asking the user to pick the office they
      // just clicked to enter.
      const joinOrgId = sp.get("orgId");
      if (isDeeplinkIntent(intent) && joinOrgId) {
        try {
          const joinRes = await api<{
            ok: boolean;
            token: string;
            alreadyMember?: boolean;
            needsProfileCompletion?: boolean;
          }>("/guest-auth/public-join", {
            method: "POST",
            body: JSON.stringify({
              guestUserId: data.user.id,
              orgId: joinOrgId,
              name: data.user.name || undefined,
              referralCode: referCode || undefined,
            }),
          });

          // Org-scoped token — this is what makes the workspace open as the
          // joined office rather than whichever org was auto-selected above.
          if (joinRes.token) saveToken(joinRes.token);
          saveOrgId(joinOrgId);
          toast.success(
            joinRes.alreadyMember
              ? "You're already a member!"
              : "Welcome — you're in!"
          );
          // A brand-new account has no profile. The prompt rides on the
          // destination instead of replacing it, so the buyer still lands on
          // the item they came for. `verify-otp` doesn't report profile
          // state, so the join response is the signal.
          const needsProfile =
            !!joinRes.needsProfileCompletion ||
            (data.user as { profileComplete?: boolean }).profileComplete === false;
          router.push(
            withCompleteProfile(
              safeRedirect(
                sp.get("redirect"),
                isBat246OrgId(joinOrgId)
                  ? await bat246LandingPath()
                  : `/workspace?orgId=${joinOrgId}`,
              ),
              needsProfile
            )
          );
          return;
        } catch (joinErr: any) {
          // `public-join` 403s on a private office (and on a guest limit).
          // The hosted office page owns those flows (request-to-join, waiting
          // state), so hand off there rather than dumping the user in a
          // workspace they didn't ask for. The OTP itself was valid, so this
          // must not fall into the catch below that blames the code.
          toast.error(joinErr?.message || "Could not join that office.");
          const orgSlug = sp.get("orgSlug");
          if (orgSlug) {
            if (data.token) saveToken(data.token);
            router.push(`/guest/${encodeURIComponent(orgSlug)}`);
            return;
          }
        }
      }

      // Check if this is a "talk" intent - auto-select GARAGE HQ
      if (intent === "talk") {
        const garageHQ = data.user.organizations?.find(
          (org) => org.parent === true,
        );

        if (garageHQ) {
          const selectResponse = await api<{
            token: string;
            currentOrg: { id: string; name: string };
          }>("/auth/select-org", {
            method: "POST",
            body: JSON.stringify({
              userId: data.user.id,
              orgId: garageHQ.id,
            }),
          });

          saveToken(selectResponse.token);
          localStorage.setItem("garage_org_id", garageHQ.id);
          toast.success(`Welcome to ${selectResponse.currentOrg.name}!`);
          // ActivityTracker.login(data.userId, data.user.name); // disabled with Team Activity
          router.push(safeRedirect(sp.get("redirect"), "/workspace"));
          return;
        } else if (data.token && data.user.currentOrg) {
          saveToken(data.token);
          localStorage.setItem("garage_org_id", data.user.currentOrg.id);
          toast.success("Welcome to GARAGE HQ!");
          // ActivityTracker.login(data.userId, data.user.name); // disabled with Team Activity
          router.push(safeRedirect(sp.get("redirect"), "/workspace"));
          return;
        }
      }

      // Whitelabel upgrade intent. A signup with no office of its own goes
      // straight into the create-office flow — profile, plan, office — with no
      // org list to pick from. The GARAGE HQ guest membership every signup
      // gets doesn't count: it isn't theirs to whitelabel. Users who already
      // have offices choose which one they're buying the add-on for.
      if (intent === "whitelabel") {
        if (data.token) saveToken(data.token);
        const redirect = safeRedirect(
          sp.get("redirect"),
          "/workspace?openApp=whitelabel",
        );
        const ownOrgs = (data.user.organizations || []).filter(
          (org) => !org.parent && !org.guest,
        );

        if (ownOrgs.length === 0) {
          router.push(
            `/office-payment?newOffice=true&redirect=${encodeURIComponent(redirect)}`,
          );
          return;
        }

        const params = new URLSearchParams({
          userId: data.user.id,
          email: data.user.email,
          name: data.user.name || "",
          organizations: JSON.stringify(data.user.organizations || []),
          redirect,
          intent: "whitelabel",
        });
        router.push(`/select-organization?${params.toString()}`);
        return;
      }

      // bat246.com: a BAT 246 member goes straight into BAT 246, never the
      // office picker and never whichever office the backend auto-selected.
      // The white-label match further down can't do this — bat246.com isn't
      // registered as the office's domain, so its lookup finds nothing.
      // Someone who isn't a member falls through to the normal flow.
      if (
        isBat246Domain &&
        data.user.organizations?.some((org) => isBat246OrgId(org.id))
      ) {
        let token = data.token;
        if (!isBat246OrgId(data.user.currentOrg?.id) || !token) {
          const selectResponse = await api<{ token: string }>("/auth/select-org", {
            method: "POST",
            body: JSON.stringify({ userId: data.user.id, orgId: BAT246_ORG_ID }),
          });
          token = selectResponse.token;
        }
        saveToken(token!);
        localStorage.setItem("garage_org_id", BAT246_ORG_ID);
        toast.success("Authenticated successfully!");
        router.push(safeRedirect(sp.get("redirect"), await bat246LandingPath()));
        return;
      }

      // bat246.com, someone who ISN'T a BAT 246 member yet — a stranger who
      // typed the address, or anyone who didn't arrive through gotobigwin's
      // Join button. They land on Game Boards like any non-distributor, where
      // the "Path to BAT 246 Distributor" steps and the entry purchase are.
      // /bat246/office/join is the same call Game Boards already makes for a
      // non-member, done here so the first screen they see is that page and
      // not a bounce through /workspace. If it fails, fall through to the
      // normal flow below rather than strand them.
      if (isBat246Domain && data.token) {
        try {
          saveToken(data.token);
          const joined = await api<{ token?: string; orgId?: string }>(
            "/bat246/office/join",
            { method: "POST" },
          );
          if (joined?.token) {
            saveToken(joined.token);
            saveOrgId(joined.orgId || BAT246_ORG_ID);
            toast.success("Authenticated successfully!");
            router.push(
              safeRedirect(sp.get("redirect"), await bat246LandingPath()),
            );
            return;
          }
        } catch (joinErr) {
          console.error("bat246.com office join failed:", joinErr);
        }
      }

      // If an org was auto-selected (single org or legacy flow), go straight in.
      //
      // Gated on `currentOrg`, not on the token alone: a user with NO orgs now
      // also receives a token (user-scoped, no orgId) so they can authenticate
      // against POST /org/create-first-time, which is no longer open. Keying
      // this branch off the token would send them to /workspace with no
      // workspace to land in. For every pre-existing case the backend sets
      // both together, so this is a no-op there.
      if (data.token && data.user.currentOrg?.id) {
        saveToken(data.token);
        toast.success("Authenticated successfully!");
        // ActivityTracker.login(data.userId, data.user.name); // disabled with Team Activity

        if (data.user.currentOrg?.id) {
          localStorage.setItem("garage_org_id", data.user.currentOrg.id);
        }
        router.push(
          safeRedirect(sp.get("redirect"), await resolveHomeFor(data.user.currentOrg?.id)),
        );
        return;
      }

      // Multiple organizations - check if we're on a whitelabel domain
      if (data.user.hasOrganizations) {
        const domain = getCurrentDomain();

        if (isWhitelabelDomain(domain)) {
          const whitelabelOrg = await fetchWhitelabelOrg(domain);

          if (whitelabelOrg) {
            const matchingOrg = data.user.organizations.find(
              (org) => org.id === whitelabelOrg.orgId,
            );

            if (matchingOrg) {
              const selectResponse = await api<{
                token: string;
                currentOrg: any;
              }>("/auth/select-org", {
                method: "POST",
                body: JSON.stringify({
                  userId: data.user.id,
                  orgId: matchingOrg.id,
                }),
              });

              saveToken(selectResponse.token);
              localStorage.setItem("garage_org_id", matchingOrg.id);
              toast.success("Authenticated successfully!");
              // ActivityTracker.login(data.userId, data.user.name); // disabled with Team Activity
              router.push(safeRedirect(sp.get("redirect"), await resolveHomeFor(matchingOrg.id)));
              return;
            }
          }
        }

        // Persist the user-scoped token before handing off to the picker.
        // /select-organization is reached with the org list in QUERY PARAMS and
        // no token, and its "Create Workspace" button routes to /organization —
        // which now needs auth. Without this, a multi-org founder creating an
        // extra office would 401 on submit.
        if (data.token) saveToken(data.token);

        toast.success("Select your workspace to continue");
        const searchParams = new URLSearchParams({
          userId: data.user.id,
          email: data.user.email,
          name: data.user.name || "",
          organizations: JSON.stringify(data.user.organizations),
        });
        const redirectParam = sp.get("redirect");
        if (redirectParam)
          searchParams.set("redirect", safeRedirect(redirectParam, "/workspace"));

        router.push(`/select-organization?${searchParams.toString()}`);
        return;
      }

      // No organizations - redirect to organization creation.
      //
      // Save the user-scoped token first: POST /org/create-first-time now
      // requires auth, so without this the founder reaches the form and every
      // submit 401s. There is no org yet, so no `garage_org_id` to store.
      if (data.token) saveToken(data.token);

      toast.success("Let's create your workspace!");
      const searchParams = new URLSearchParams({
        userId: data.userId,
      });
      const redirectParam = sp.get("redirect");
      if (redirectParam) searchParams.set("redirect", redirectParam);
      router.push(`/organization?${searchParams.toString()}`);
    } catch (err) {
      toast.error("Invalid OTP. Please try again.");
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  // Enter submits when complete
  useEffect(() => {
    function onEnter(e: KeyboardEvent) {
      if (e.key === "Enter" && code.length === 6) verify();
    }
    window.addEventListener("keydown", onEnter);
    return () => window.removeEventListener("keydown", onEnter);
  }, [code]);

  async function resend() {
    if (Date.now() < resendAt) return;
    await api("/auth/request-otp", {
      method: "POST",
      body: JSON.stringify({ email, isResend: true }),
    });
    setResendAt(Date.now() + 60_000);
    toast.success(isPhone ? "Code sent to your phone" : "OTP sent to your email");
  }

  const secondsLeft = useMemo(
    () => Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)),
    [resendAt],
  );

  useEffect(() => {
    if (!resendAt) return;
    const id = setInterval(() => {}, 250);
    return () => clearInterval(id);
  }, [resendAt]);

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

      {/* Right Panel - OTP Form */}
      <div
        className={cn(
          "relative w-full lg:w-[55%] xl:w-[50%] h-full flex items-center justify-center overflow-hidden",
          // bat246.com is black edge to edge, matching Bat246LeftPanel.
          isBat246Domain ? "bg-black" : "bg-[#0c0c0e]"
        )}
      >
        <div className="w-full max-w-md mx-auto px-5 sm:px-8 py-4 sm:py-8 lg:py-12">
          {/* Back button */}
          <button
            onClick={() => router.push("/login")}
            className={cn(
              "flex items-center gap-2 text-[#9fa0b8] hover:text-white transition-colors mb-3 sm:mb-6 lg:mb-8",
              isBat246Domain ? BAT246_AUTH_BACK_CLASS : "text-xs sm:text-sm"
            )}
          >
            <ArrowLeft className={isBat246Domain ? "w-5 h-5" : "w-4 h-4"} />
            Back
          </button>

          {/* Logo — hidden for the BAT246 office-invite modal, which shows
              its own "Powered By Garage" mark at the bottom instead (see
              showPoweredBy below), same as the email step. */}
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

          {/* Title — double-size for the BAT246 office-invite modal, same
              flag as the email step. */}
          <div className="text-center mb-4 sm:mb-6 lg:mb-8">
            {/* <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2">
              Check Your Email
            </h1> */}
            <p
              className={
                showPoweredBy
                  // 22.8/28.5px, then 20% down again.
                  ? "text-[18.24px] sm:text-[22.8px] text-[#9fa0b8]"
                  : isBat246Domain
                    ? BAT246_AUTH_SUBTITLE_CLASS
                    : "text-xs sm:text-sm text-[#9fa0b8]"
              }
            >
              Enter the 6-digit code sent to{" "}
              {/* break-all splits a short address mid-word at bat246.com's
                  larger size; break-words moves it to its own line instead. */}
              <span className={cn("text-primary", isBat246Domain ? "break-words" : "break-all")}>
                {formatIdentifier(email)}
              </span>
            </p>
          </div>

          {/* OTP Form */}
          <div className="space-y-3 sm:space-y-4">
            <OtpInput value={code} onChange={setCode} />

            <Button
              className={cn(
                "w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-black font-semibold rounded-xl",
                isBat246Domain
                  ? BAT246_AUTH_BUTTON_CLASS
                  : "h-12 sm:h-14 text-sm sm:text-base"
              )}
              onClick={verify}
              disabled={code.length !== 6 || loading}
            >
              {loading ? (
                <Loader2
                  className={cn(
                    "animate-spin",
                    isBat246Domain ? BAT246_AUTH_BUTTON_ICON_CLASS : "w-4 h-4 sm:w-5 sm:h-5"
                  )}
                />
              ) : (
                <>
                  Verify
                  <ArrowRight
                    className={cn(
                      "ml-2",
                      isBat246Domain ? BAT246_AUTH_BUTTON_ICON_CLASS : "w-4 h-4 sm:w-5 sm:h-5"
                    )}
                  />
                </>
              )}
            </Button>

            {/* Footer actions — bigger for the BAT246 office-invite modal. */}
            <div
              className={
                showPoweredBy
                  // 20px/24px, then 25% down.
                  ? "flex items-center justify-between text-[15px] sm:text-[18px] text-[#9fa0b8] pt-1 sm:pt-2"
                  : isBat246Domain
                    ? `flex items-center justify-between gap-3 ${BAT246_AUTH_LINKS_CLASS} text-[#9fa0b8] pt-1 sm:pt-2`
                    : "flex items-center justify-between text-xs sm:text-sm text-[#9fa0b8] pt-1 sm:pt-2"
              }
            >
              <button
                type="button"
                onClick={() => router.push("/login?flow=login")}
                className="hover:text-white transition-colors text-left"
              >
                Use a different email or number
              </button>

              <button
                type="button"
                onClick={resend}
                disabled={secondsLeft > 0}
                className={`inline-flex items-center gap-1.5 transition-colors ${
                  secondsLeft > 0
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:text-white"
                }`}
              >
                <RotateCcw
                  className={isBat246Domain ? "w-4 h-4 sm:w-5 sm:h-5" : "w-3 h-3 sm:w-3.5 sm:h-3.5"}
                />
                {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend"}
              </button>
            </div>
          </div>

          {/* Footer — double-size for the BAT246 office-invite modal, same
              flag as the email step. */}
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

          {/* "Powered By Garage" — only for the BAT246 office-invite modal,
              see showPoweredBy above. Same treatment as the email step:
              bigger and pushed toward the bottom, standing in for the main
              logo hidden above. */}
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
        </div>
        {isBat246Domain && <Bat246PoweredBy />}
      </div>
    </div>
  );
}

export default function VerifyWholePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <VerifyPage />
    </Suspense>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { saveToken, saveOrgId } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import OtpInput from "@/components/ui/otp-input";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Mail,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

type AuthOutcome =
  | { kind: "authenticated" }
  | { kind: "wrong-org"; userEmail: string };

interface Props {
  open: boolean;
  targetOrgId?: string | null;
  onAuthenticated: (outcome: AuthOutcome) => void;
}

export default function InlineLoginModal({
  open,
  targetOrgId,
  onAuthenticated,
}: Props) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendAt, setResendAt] = useState(0);

  useEffect(() => {
    if (!open) {
      setStep("email");
      setEmail("");
      setCode("");
      setLoading(false);
      setResendAt(0);
    }
  }, [open]);

  async function requestOtp(e?: React.FormEvent) {
    e?.preventDefault();
    const cleaned = email.trim().toLowerCase();
    if (!cleaned) {
      toast.error("Please enter your email");
      return;
    }
    setLoading(true);
    try {
      await api("/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email: cleaned }),
      });
      setEmail(cleaned);
      setStep("otp");
      setResendAt(Date.now() + 60_000);
      toast.success("OTP sent to your email");
    } catch (err) {
      console.error("request-otp failed", err);
      toast.error("Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    try {
      const data = await api<{
        token?: string;
        userId: string;
        user: {
          id: string;
          email: string;
          name?: string;
          role?: string;
          organizations: Array<{ id: string; name: string }>;
          hasOrganizations: boolean;
          currentOrg?: { id: string; name: string };
        };
      }>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });

      if (targetOrgId) {
        const member = data.user.organizations?.find(
          (o) => o.id === targetOrgId,
        );
        if (!member) {
          onAuthenticated({ kind: "wrong-org", userEmail: data.user.email });
          return;
        }
        const selectResponse = await api<{
          token: string;
          currentOrg: { id: string; name: string };
        }>("/auth/select-org", {
          method: "POST",
          body: JSON.stringify({ userId: data.user.id, orgId: targetOrgId }),
        });
        saveToken(selectResponse.token);
        saveOrgId(selectResponse.currentOrg.id);
      } else if (data.token) {
        saveToken(data.token);
        if (data.user.currentOrg?.id) saveOrgId(data.user.currentOrg.id);
      } else {
        toast.error("Could not establish a session. Please contact support.");
        return;
      }

      onAuthenticated({ kind: "authenticated" });
    } catch (err) {
      console.error("verify-otp failed", err);
      toast.error("Invalid code. Please try again.");
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    function onEnter(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      if (step === "otp" && code.length === 6) verifyOtp();
    }
    window.addEventListener("keydown", onEnter);
    return () => window.removeEventListener("keydown", onEnter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, code]);

  const secondsLeft = useMemo(
    () => Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)),
    [resendAt],
  );

  async function resend() {
    if (Date.now() < resendAt) return;
    try {
      await api("/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email, isResend: true }),
      });
      setResendAt(Date.now() + 60_000);
      toast.success("Code resent");
    } catch {
      toast.error("Failed to resend. Try again later.");
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden border-0 bg-transparent shadow-none"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          {step === "email" ? "Sign in" : "Verify code"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Sign in with a one-time code sent to your email.
        </DialogDescription>

        <div className="relative rounded-2xl border border-white/10 bg-[#0B0B0E]/95 backdrop-blur-2xl overflow-hidden">
          {/* Ambient gradient glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0
              bg-[radial-gradient(600px_300px_at_15%_-20%,color-mix(in_srgb,_var(--brand-2)_18%,_transparent),transparent_55%),radial-gradient(500px_300px_at_110%_120%,rgba(138,43,226,0.18),transparent_55%)]"
          />
          {/* Top brand strip */}
          <div className="relative px-7 pt-7 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative h-8 w-8 rounded-lg overflow-hidden ring-1 ring-white/10 bg-black/30 flex items-center justify-center">
                  <Image
                    src="/logo.svg"
                    alt="Garage"
                    width={20}
                    height={20}
                    className="h-4 w-auto"
                  />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-[#9fa0b8]">
                    Garage
                  </span>
                  <span className="text-xs text-white/80 font-medium">
                    Secure sign-in
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <StepDot active={step === "email"} done={step === "otp"} />
                <div className="h-px w-5 bg-white/10" />
                <StepDot active={step === "otp"} done={false} />
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="relative px-7 pb-7 pt-5">
            <AnimatePresence mode="wait" initial={false}>
              {step === "email" ? (
                <motion.div
                  key="email"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-5"
                >
                  <div className="space-y-1.5">
                    <h2 className="text-xl font-semibold text-white tracking-tight">
                      Sign in to open this task
                    </h2>
                    <p className="text-[13px] text-[#9fa0b8] leading-relaxed">
                      We&apos;ll email you a one-time code. No password needed.
                    </p>
                  </div>

                  <form onSubmit={requestOtp} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] uppercase tracking-wider text-[#9fa0b8] font-medium">
                        Work email
                      </label>
                      <div className="relative group">
                        <div
                          aria-hidden
                          className="pointer-events-none absolute -inset-px rounded-xl bg-gradient-to-r from-primary/40 via-secondary/40 to-primary/40 opacity-0 group-focus-within:opacity-100 transition-opacity blur-sm"
                        />
                        <div className="relative flex items-center rounded-xl bg-black/40 border border-white/10 group-focus-within:border-primary/50 transition-colors">
                          <Mail className="ml-3.5 h-4 w-4 text-[#9fa0b8] group-focus-within:text-primary transition-colors" />
                          <Input
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            placeholder="you@company.com"
                            className="h-12 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-white placeholder:text-[#5a5b6a] px-3"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoFocus
                          />
                        </div>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={!email || loading}
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-black font-semibold text-sm shadow-[0_10px_30px_-12px_color-mix(in_srgb,_var(--brand-2)_45%,_transparent)] transition-all"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          Send sign-in code
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>

                    <div className="flex items-center gap-2 pt-1 text-[11px] text-[#7a7b8a]">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary/80" />
                      <span>
                        Protected by Garage SSO. Codes expire in 10 minutes.
                      </span>
                    </div>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-5"
                >
                  <div className="space-y-1.5">
                    <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Check your inbox
                    </h2>
                    <p className="text-[13px] text-[#9fa0b8] leading-relaxed">
                      We sent a 6-digit code to{" "}
                      <span className="text-white font-medium break-all">
                        {email}
                      </span>
                      .
                    </p>
                  </div>

                  <div className="rounded-xl bg-black/30 border border-white/5 p-4">
                    <OtpInput value={code} onChange={setCode} />
                  </div>

                  <Button
                    onClick={verifyOtp}
                    disabled={code.length !== 6 || loading}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-black font-semibold text-sm shadow-[0_10px_30px_-12px_color-mix(in_srgb,_var(--brand-2)_45%,_transparent)] transition-all"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Verify and continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setStep("email");
                        setCode("");
                      }}
                      className="inline-flex items-center gap-1.5 text-[#9fa0b8] hover:text-white transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Different email
                    </button>
                    <button
                      type="button"
                      onClick={resend}
                      disabled={secondsLeft > 0}
                      className="inline-flex items-center gap-1.5 text-[#9fa0b8] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {secondsLeft > 0
                        ? `Resend in ${secondsLeft}s`
                        : "Resend code"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer accent line */}
          <div
            aria-hidden
            className="h-px w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent"
          />
          <div className="px-7 py-3 text-[11px] text-[#6a6a7a] text-center">
            By continuing you agree to our Terms &amp; Privacy Policy.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <span
      className={
        "block h-1.5 rounded-full transition-all duration-300 " +
        (active
          ? "w-6 bg-gradient-to-r from-primary to-secondary"
          : done
            ? "w-1.5 bg-primary/80"
            : "w-1.5 bg-white/15")
      }
    />
  );
}

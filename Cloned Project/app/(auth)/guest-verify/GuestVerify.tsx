"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import OtpInput from "@/components/ui/otp-input";
import { ArrowRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export default function GuestVerify() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendAt, setResendAt] = useState<number>(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  const referCode = searchParams.get("referCode");

  useEffect(() => {
    if (!email) router.replace("/guest-login");
  }, [email, router]);

  async function verifyOtp() {
    if (code.length !== 6 || loading) return;

    setLoading(true);
    try {
      const response = await api<{
        ok: boolean;
        userId: string;
        email: string;
        guest: boolean;
      }>("/guest-auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          email,
          code,
          referralCode: referCode || undefined,
        }),
      });

      if (response.ok && response.guest) {
        // Store guest userId temporarily in localStorage
        localStorage.setItem("guest_user_id", response.userId);
        localStorage.setItem("guest_email", response.email);

        toast.success("Verified! Redirecting to organizations...");
        router.push("/browse-hqs");
      } else {
        toast.error("Verification failed. Please try again.");
      }
    } catch (err: any) {
      console.error("Error verifying OTP:", err);
      toast.error("Something went wrong!");
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  // Enter submits when complete
  useEffect(() => {
    function onEnter(e: KeyboardEvent) {
      if (e.key === "Enter" && code.length === 6) verifyOtp();
    }
    window.addEventListener("keydown", onEnter);
    return () => window.removeEventListener("keydown", onEnter);
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  async function resend() {
    if (Date.now() < resendAt) return;
    await api("/guest-auth/request-otp", {
      method: "POST",
      body: JSON.stringify({ email, isResend: true }),
    });
    setResendAt(Date.now() + 60_000); // 60s cooldown
    toast.success("OTP sent to your email");
  }

  const secondsLeft = useMemo(
    () => Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)),
    [resendAt]
  );

  useEffect(() => {
    if (!resendAt) return;
    const id = setInterval(() => {}, 250);
    return () => clearInterval(id);
  }, [resendAt]);

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
      {/* subtle background, same vibe as Login */}
      <div
        className="pointer-events-none absolute inset-0
        bg-[radial-gradient(1000px_500px_at_30%_-10%,rgba(138,43,226,0.20),transparent_60%),radial-gradient(700px_400px_at_90%_120%,rgba(75,0,130,0.20),transparent_60%)]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/40" />

      <Card className="relative w-full max-w-lg border-border/10 backdrop-blur-xl bg-[#0C0C0E]/80">
        <CardHeader className="space-y-2 p-4 sm:p-6">
          <span className="inline-flex w-fit items-center gap-1.5 sm:gap-2 self-start rounded-full bg-primary px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs text-primary-foreground">
            <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary-foreground" /> Guest verification
          </span>
          <CardTitle className="text-xl sm:text-2xl">Check your email</CardTitle>
          <CardDescription className="text-sm">
            Enter the 6-digit code sent to{" "}
            <span className="text-primary break-all">{email}</span>.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0 sm:pt-0">
          <OtpInput value={code} onChange={setCode} />

          <Button
            className="w-full text-sm sm:text-base"
            onClick={verifyOtp}
            disabled={code.length !== 6 || loading}
          >
            {loading ? (
              "Verifying…"
            ) : (
              <>
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 text-xs sm:text-sm text-[var(--muted-foreground)]">
            <button
              type="button"
              onClick={() => router.push("/guest-login")}
              className="underline underline-offset-4 hover:text-[var(--foreground)]"
            >
              Use a different email
            </button>

            <button
              type="button"
              onClick={resend}
              disabled={secondsLeft > 0}
              className="inline-flex items-center gap-1 disabled:opacity-60 underline underline-offset-4 hover:text-[var(--foreground)]"
            >
              <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend code"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

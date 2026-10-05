"use client";

import { useState, useEffect, useMemo } from "react";
import { garageAdminApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import OtpInput from "@/components/ui/otp-input";
import { Mail, ArrowRight, Shield, ArrowLeft, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  landingPathForAdmin,
  type AdminPageLevel,
} from "@/lib/admin-api/permissions";

export default function GarageAdminLogin() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [resendAt, setResendAt] = useState<number>(0);
  const router = useRouter();

  async function requestOtp(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      await garageAdminApi("/garage-admin/request-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      toast.success("OTP sent successfully!");
      setStep("otp");
    } catch (err: any) {
      console.error("Request OTP error:", err);

      // Check if it's a deactivated account error
      if (err?.response?.status === 403) {
        toast.error(
          "Account has been deactivated. Please contact your administrator."
        );
      } else {
        toast.error("Invalid admin credentials or email not found!");
      }
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6 || loading) return;
    setLoading(true);
    try {
      const response = await garageAdminApi<{
        data: {
          token: string;
          role: string;
          name: string;
          email: string;
          id: string;
          isSuperAdmin?: boolean;
          permissions?: Record<string, AdminPageLevel>;
        };
      }>("/garage-admin/login", {
        method: "POST",
        body: JSON.stringify({ email, code: otp }),
      });

      console.log(response);

      // Store admin token
      localStorage.setItem("garage_admin_token", response?.data?.token);
      localStorage.setItem(
        "garage_admin_info",
        JSON.stringify({
          id: response?.data?.id,
          name: response?.data?.name,
          email: response?.data?.email,
          role: response?.data?.role,
          // The dashboard shell builds its sidebar off these two. Anything
          // this page fails to copy stays undefined until something else
          // refreshes it — so they have to be written here, not just
          // returned by the API.
          isSuperAdmin: response?.data?.isSuperAdmin,
          permissions: response?.data?.permissions,
        })
      );

      toast.success(`Welcome back, ${response?.data?.name}!`);
      router.push(await landingPathForAdmin(response?.data || {}));
    } catch (err: any) {
      console.error("Login error:", err);

      // Check if it's a deactivated account error
      if (err?.response?.status === 403) {
        toast.error(
          "Account has been deactivated. Please contact your administrator."
        );
      } else {
        toast.error("Invalid OTP!");
      }
    } finally {
      setLoading(false);
    }
  }

  // Enter submits when complete
  useEffect(() => {
    function onEnter(e: KeyboardEvent) {
      if (e.key === "Enter" && otp.length === 6) verifyOtp();
    }
    window.addEventListener("keydown", onEnter);
    return () => window.removeEventListener("keydown", onEnter);
  }, [otp]); // eslint-disable-line react-hooks/exhaustive-deps

  async function resend() {
    if (Date.now() < resendAt) return;
    await garageAdminApi("/garage-admin/request-otp", {
      method: "POST",
      body: JSON.stringify({ email, isResend: true }),
    });
    setResendAt(Date.now() + 60_000); // 60s cooldown
    toast.success("OTP sent successfully!");
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
      {/* Admin-themed background */}
      <div
        className="pointer-events-none absolute inset-0
        bg-[radial-gradient(1000px_500px_at_30%_-10%,rgba(59, 130, 246, 0.20),transparent_60%),radial-gradient(700px_400px_at_90%_120%,rgba(16, 185, 129, 0.20),transparent_60%)]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/40" />

      <Card className="relative w-full max-w-lg border-border/10 backdrop-blur-xl bg-[#0C0C0E]/80">
        <CardHeader className="space-y-2 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
            <span className="inline-flex w-fit items-center gap-1.5 sm:gap-2 self-start rounded-full bg-[#3B82F6] px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs text-white">
              <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              Admin Access
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/login")}
              className="text-[10px] sm:text-xs hover:bg-gray-100/10 h-7 sm:h-8 px-2 sm:px-3 self-start sm:self-auto"
            >
              <ArrowLeft className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />
              Back to User Login
            </Button>
          </div>
          <CardTitle className="text-xl sm:text-2xl">
            {step === "email" ? "Garage Admin Portal" : "Check your email"}
          </CardTitle>
          <CardDescription className="text-sm">
            {step === "email"
              ? "Enter your admin email to receive a one-time code."
              : `Enter the 6-digit code sent to ${email}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          {step === "email" ? (
            <form onSubmit={requestOtp} className="space-y-3 sm:space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="admin@company.com"
                  className="pl-9 text-sm sm:text-base"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <Button
                className="w-full text-sm sm:text-base"
                disabled={!email || loading}
                type="submit"
              >
                {loading ? (
                  "Sending…"
                ) : (
                  <>
                    Send OTP <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              <OtpInput value={otp} onChange={setOtp} />

              <Button
                className="w-full text-sm sm:text-base"
                onClick={verifyOtp}
                disabled={otp.length !== 6 || loading}
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
                  onClick={() => setStep("email")}
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
                  {secondsLeft > 0
                    ? `Resend in ${secondsLeft}s`
                    : "Resend code"}
                </button>
              </div>
            </div>
          )}

          <p className="text-[10px] sm:text-xs text-[var(--muted-foreground)] mt-3 sm:mt-4">
            Secure admin authentication powered by OTP verification.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { api } from "@/lib/api";
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
import { Mail, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function GuestLogin() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function requestOtp(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email) {
      toast.error("Please enter your email");
      return;
    }

    setLoading(true);
    try {
      await api("/guest-auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      toast.success("OTP sent to your email!");

      router.push(
        `/guest-verify?email=${encodeURIComponent(email.trim().toLowerCase())}`
      );
    } catch (err) {
      console.error("Error requesting OTP:", err);
      toast.error("Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
      {/* subtle bg */}
      <div
        className="pointer-events-none absolute inset-0
        bg-[radial-gradient(1200px_600px_at_70%_-10%,color-mix(in_srgb,_var(--brand)_30%,_transparent),transparent_60%),radial-gradient(700px_400px_at_20%_110%,color-mix(in_srgb,_var(--brand)_30%,_transparent),transparent_60%)]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/40" />

      <Card className="relative w-full max-w-lg border-border/10 backdrop-blur-xl bg-[#0C0C0E]/80">
        <CardHeader className="space-y-2 p-4 sm:p-6">
          <span className="inline-flex w-fit items-center gap-1.5 sm:gap-2 self-start rounded-full bg-primary px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs text-primary-foreground">
            <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary-foreground" /> Guest
            Access
          </span>
          <CardTitle className="text-xl sm:text-2xl">
            Browse & Join Organizations
          </CardTitle>
          <CardDescription className="text-sm">
            Enter your email to get a one-time code and explore organizations.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          <form onSubmit={requestOtp} className="space-y-3 sm:space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@company.com"
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
                  Continue as Guest <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <p className="text-[10px] sm:text-xs text-[var(--muted-foreground)]">
              By continuing you agree to our Terms & Privacy Policy.
            </p>

            <p className="text-[10px] sm:text-xs text-[var(--muted-foreground)] -mt-1 sm:-mt-2">
              Already have an account?{" "}
              <Link href="/login" className="text-primary underline">
                Sign in here
              </Link>
              .
            </p>
          </form>

          {/* Guest Access Info */}
          {/* <div className="mt-6 p-4 bg-brand-2/10 border border-brand-2/20 rounded-lg">
            <p className="text-sm font-medium text-[var(--foreground)] mb-2">
              Guest Access allows you to:
            </p>
            <ul className="space-y-1.5 text-xs text-[var(--muted-foreground)]">
              <li className="flex items-start gap-2">
                <span className="text-brand-2 mt-0.5">•</span>
                <span>Browse all available organizations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-2 mt-0.5">•</span>
                <span>Request to join organizations of interest</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-2 mt-0.5">•</span>
                <span>Track your request status in real-time</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-2 mt-0.5">•</span>
                <span>Become a member after founder approval</span>
              </li>
            </ul>
          </div> */}
        </CardContent>
      </Card>
    </div>
  );
}

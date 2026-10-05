"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { saveToken } from "@/lib/auth";
import { resolveHomeFor } from "@/lib/bat246Office";
import { useRouter, useSearchParams } from "next/navigation";
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
import {
  ArrowRight,
  Mail,
  AlertTriangle,
  Phone,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

function AcceptInvitePage() {
  const sp = useSearchParams();
  const router = useRouter();

  const [email, setEmail] = useState(
    (sp.get("email") || "").trim().toLowerCase()
  );
  const [orgId, setOrgId] = useState(
    (sp.get("orgId") || "").trim().toLowerCase()
  );
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState(sp.get("code") || "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function doAccept() {
    if (!email || code.length !== 6) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await api<{ ok: boolean; token: string; user: any }>(
        `/invites/accept`,
        {
          method: "POST",
          body: JSON.stringify({ email, code, phone }),
        }
      );
      saveToken(res.token);
      localStorage.setItem("garage_org_id", orgId);
      // After accepting invite, redirect to workspace (BAT 246 has its own home)
      toast.success("Welcome to the team!");
      router.push(await resolveHomeFor(orgId));
    } catch (e: any) {
      setErr(() => {
        try {
          const msg = typeof e?.message === "string" ? e.message : "";
          return (
            msg || "Could not accept invite. Check your code and try again."
          );
        } catch {
          return "Could not accept invite. Check your code and try again.";
        }
      });
    } finally {
      setLoading(false);
    }
  }

  // Press Enter to submit when 6 digits filled
  useEffect(() => {
    function onEnter(e: KeyboardEvent) {
      if (e.key === "Enter" && code.length === 6 && !loading) doAccept();
    }
    window.addEventListener("keydown", onEnter);
    return () => window.removeEventListener("keydown", onEnter);
  }, [code, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = useMemo(
    () => !!email && code.length === 6 && !!phone && !loading,
    [email, code, phone, loading]
  );

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 py-12">
      {/* subtle bg */}
      <div
        className="pointer-events-none absolute inset-0
        bg-[radial-gradient(1200px_600px_at_70%_-10%,color-mix(in_srgb,_var(--brand)_30%,_transparent),transparent_60%),radial-gradient(700px_400px_at_20%_110%,color-mix(in_srgb,_var(--brand)_30%,_transparent),transparent_60%)]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/40" />

      <Card className="relative w-full max-w-lg border-border/10 backdrop-blur-xl bg-[#0C0C0E]/80">
        <CardHeader className="space-y-2">
          <span className="inline-flex w-fit items-center gap-2 self-start rounded-full bg-brand-2 px-3 py-1 text-xs text-[white]">
            <span className="w-1.5 h-1.5 rounded-full bg-[white]" /> Team
            invitation
          </span>
          <CardTitle className="text-2xl">Almost there!</CardTitle>
          <CardDescription>
            Everything looks good, but we need your phone number to complete the
            setup. We won't spam you, don't worry.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {err && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>{err}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="pl-9"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value.trim().toLowerCase())
                  }
                />
              </div>
            </div>

            {/* OTP Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]">
                Verification Code
              </label>
              <div className="space-y-2">
                <OtpInput value={code} onChange={setCode} />
                <p className="text-xs text-[var(--muted-foreground)]">
                  Tip: paste the entire code — it'll auto-fill.
                </p>
              </div>
            </div>

            {/* Phone Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="923XXXXXXX"
                  className="pl-9"
                  value={phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, "");
                    if (value.length <= 10) {
                      setPhone(value);
                    }
                  }}
                  required
                />
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Required for account verification and important updates
              </p>
            </div>

            {/* Reassuring message about phone number */}
            <div className="flex items-start gap-2 rounded-md border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div className="text-green-200">
                <p className="font-medium">Your privacy is protected</p>
                <p className="text-xs text-green-300/80">
                  We only use your phone for account verification and important
                  updates. No marketing messages.
                </p>
              </div>
            </div>
          </div>

          <Button className="w-full" onClick={doAccept} disabled={!canSubmit}>
            {loading ? (
              "Setting up your account…"
            ) : (
              <>
                Complete setup <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcceptInviteWholePage() {
  return (
    <>
      <Suspense fallback={<div>Loading...</div>}>
        <AcceptInvitePage />
      </Suspense>
    </>
  );
}

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { garageAdminApi } from "@/lib/api";
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
  Shield,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  landingPathForAdmin,
  type AdminPageLevel,
} from "@/lib/admin-api/permissions";

function AcceptGarageAdminInvitePage() {
  const sp = useSearchParams();
  const router = useRouter();

  const [email, setEmail] = useState(
    (sp.get("email") || "").trim().toLowerCase()
  );
  const [code, setCode] = useState(sp.get("code") || "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function doAccept() {
    if (!email || code.length !== 6) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await garageAdminApi<{
        success: boolean;
        data: {
          id: string;
          name: string;
          email: string;
          role: string;
          token: string;
          isSuperAdmin?: boolean;
          permissions?: Record<string, AdminPageLevel>;
        };
      }>("/garage-admin/login", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });

      // Store admin token
      localStorage.setItem("garage_admin_token", res?.data?.token);
      localStorage.setItem(
        "garage_admin_info",
        JSON.stringify({
          id: res?.data?.id,
          name: res?.data?.name,
          email: res?.data?.email,
          role: res?.data?.role,
          // Same contract as the login page — the sidebar reads these out
          // of localStorage, so they must be copied here too.
          isSuperAdmin: res?.data?.isSuperAdmin,
          permissions: res?.data?.permissions,
        })
      );

      toast.success(`Welcome to the garage admin team, ${res?.data?.name}!`);
      router.push(await landingPathForAdmin(res?.data || {}));
    } catch (e: any) {
      console.error("Accept invite error:", e);
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
    () => !!email && code.length === 6 && !loading,
    [email, code, loading]
  );

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 py-12">
      {/* Admin-themed background */}
      <div
        className="pointer-events-none absolute inset-0
        bg-[radial-gradient(1200px_600px_at_70%_-10%,rgba(59, 130, 246, 0.3),transparent_60%),radial-gradient(700px_400px_at_20%_110%,rgba(59, 130, 246, 0.3),transparent_60%)]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/40" />

      <Card className="relative w-full max-w-lg border-border/10 backdrop-blur-xl bg-[#0C0C0E]/80">
        <CardHeader className="space-y-2">
          <span className="inline-flex w-fit items-center gap-2 self-start rounded-full bg-[#3B82F6] px-3 py-1 text-xs text-white">
            <Shield className="w-3 h-3" />
            Garage Admin Invitation
          </span>
          <CardTitle className="text-2xl">Welcome to the Admin Team!</CardTitle>
          <CardDescription>
            You've been invited to join the garage admin portal. Complete your
            setup to get started.
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
                  placeholder="admin@company.com"
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
                  Enter the 6-digit code sent to your email.
                </p>
              </div>
            </div>

            {/* Admin privileges info */}
            <div className="flex items-start gap-2 rounded-md border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm">
              <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-blue-200">
                <p className="font-medium">Admin Privileges</p>
                <p className="text-xs text-blue-300/80">
                  You'll have access to garage admin management features and can
                  invite other admins.
                </p>
              </div>
            </div>
          </div>

          <Button className="w-full" onClick={doAccept} disabled={!canSubmit}>
            {loading ? (
              "Setting up your admin account…"
            ) : (
              <>
                Complete Admin Setup <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcceptGarageAdminInviteWholePage() {
  return (
    <>
      <Suspense fallback={<div>Loading...</div>}>
        <AcceptGarageAdminInvitePage />
      </Suspense>
    </>
  );
}

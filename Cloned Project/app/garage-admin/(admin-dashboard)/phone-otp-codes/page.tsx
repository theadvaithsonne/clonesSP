"use client";

// Phone OTP codes — Admin → Others → Phone OTPs.
//
// The SMS twin of /garage-admin/otp-codes. Codes are keyed by the user's
// EMAIL (that's what createOtp stores), so the backend joins in the phone
// number people actually want to read off this page.
//
// Only live codes exist to show: otpcodes carries a TTL index on
// `expiresAt`, so Mongo deletes them the moment they lapse — anything in
// the "expired" section here lapsed between the fetch and the render.
//
// Backend: GET /auth/phone-otp-codes (garagenew-backend routes/auth.ts).

import { useEffect, useState } from "react";
import { garageAdminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Copy,
  Check,
  Clock,
  Smartphone,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

type PhoneOTP = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  phoneVerified: boolean;
  code: string;
  purpose: string;
  expiresAt: string;
  createdAt: string;
  isExpired: boolean;
};

export default function PhoneOTPCodesPage() {
  const [otps, setOtps] = useState<PhoneOTP[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadOTPs() {
    try {
      // garageAdminApi reads the admin token from storage itself.
      const res = await garageAdminApi<{ ok: boolean; otps: PhoneOTP[] }>(
        "/auth/phone-otp-codes",
      );
      setOtps(res.otps || []);
    } catch (error) {
      console.error("Failed to load phone OTPs:", error);
      toast.error("Failed to load phone OTP codes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadOTPs();
  }, []);

  // Codes are short-lived, so keep the countdown honest without a refetch.
  useEffect(() => {
    const t = setInterval(() => setOtps((prev) => [...prev]), 1000);
    return () => clearInterval(t);
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await loadOTPs();
    toast.success("Refreshed");
  }

  function copyCode(code: string, id: string) {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success("Copied");
    setTimeout(() => setCopiedId(null), 2000);
  }

  function getTimeRemaining(expiresAt: string) {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  const activeOtps = otps.filter((o) => !o.isExpired);
  const expiredOtps = otps.filter((o) => o.isExpired);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#6a6a7a]">
            {activeOtps.length} active · {expiredOtps.length} expired
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          variant="ghost"
          className="h-8 px-3 text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22] border border-[#2a2a35]"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-5 w-5 animate-spin text-[#6a6a7a]" />
        </div>
      ) : otps.length === 0 ? (
        <div className="text-center py-16 text-[#6a6a7a]">
          <Smartphone className="h-6 w-6 mx-auto mb-3 text-[#3a3a4a]" />
          <p className="text-sm">No phone OTP codes</p>
          <p className="text-xs mt-1 text-[#4a4a5a]">
            Codes appear here while they&apos;re valid, then expire away.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {activeOtps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span className="text-xs font-medium text-[#9fa0b8] uppercase tracking-wide">
                  Active
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {activeOtps.map((otp) => (
                  <div
                    key={otp.id}
                    className="group bg-[#12121a] border border-[#1e1e2a] rounded-xl p-4 hover:border-[#2a2a3a] transition-all duration-200"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <code className="text-2xl font-mono font-semibold text-white tracking-[0.2em]">
                        {otp.code}
                      </code>
                      <button
                        onClick={() => copyCode(otp.code, otp.id)}
                        className="p-2 rounded-lg text-[#6a6a7a] hover:text-white hover:bg-[#1a1a24] transition-colors"
                      >
                        {copiedId === otp.id ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {/* Phone is the headline here — the code was texted to it. */}
                    <div className="flex items-center gap-2 mb-2">
                      <Smartphone className="h-3.5 w-3.5 text-[#4a4a5a]" />
                      <span className="text-sm font-medium text-white truncate">
                        {otp.phone || "No number on file"}
                      </span>
                      {otp.phoneVerified && (
                        <ShieldCheck
                          className="h-3.5 w-3.5 text-emerald-400 shrink-0"
                          aria-label="Phone already verified"
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <Mail className="h-3.5 w-3.5 text-[#4a4a5a]" />
                      <span className="text-xs text-[#6a6a7a] truncate">
                        {otp.name ? `${otp.name} · ` : ""}
                        {otp.email}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="px-2 py-1 text-[10px] font-medium rounded-md border bg-[#FBD10D]/10 text-[#FBD10D] border-[#FBD10D]/20">
                        {otp.purpose}
                      </span>
                      <div className="flex items-center gap-1.5 text-emerald-400">
                        <Clock className="h-3 w-3" />
                        <span className="text-xs font-medium">
                          {getTimeRemaining(otp.expiresAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expiredOtps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 bg-[#3a3a4a] rounded-full" />
                <span className="text-xs font-medium text-[#5a5a6a] uppercase tracking-wide">
                  Expired
                </span>
              </div>
              <div className="space-y-1.5">
                {expiredOtps.map((otp) => (
                  <div
                    key={otp.id}
                    className="flex items-center justify-between py-2.5 px-3 bg-[#0e0e14] rounded-lg border border-[#18181f]"
                  >
                    <div className="flex items-center gap-3">
                      <code className="text-sm font-mono text-[#4a4a5a] line-through">
                        {otp.code}
                      </code>
                      <span className="text-xs text-[#3a3a4a]">
                        {otp.phone || otp.email}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#3a3a4a]">
                      {otp.purpose}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

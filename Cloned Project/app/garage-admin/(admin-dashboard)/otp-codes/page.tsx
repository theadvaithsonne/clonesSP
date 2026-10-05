"use client";

import { useEffect, useState } from "react";
import { garageAdminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { RefreshCw, Copy, Check, Clock, Mail } from "lucide-react";
import { toast } from "sonner";

type OTPCode = {
  id: string;
  email: string;
  code: string;
  purpose: string;
  expiresAt: string;
  createdAt: string;
  isExpired: boolean;
};

export default function OTPCodesPage() {
  const [otps, setOtps] = useState<OTPCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadOTPs() {
    try {
      const token = localStorage.getItem("garage_admin_token");
      const res = await garageAdminApi<{ ok: boolean; otps: OTPCode[] }>(
        "/auth/otp-codes",
        {},
        token || undefined
      );
      setOtps(res.otps || []);
    } catch (error) {
      console.error("Failed to load OTPs:", error);
      toast.error("Failed to load OTP codes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadOTPs();
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
    const now = Date.now();
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;

    if (diff <= 0) return "Expired";

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  function getPurposeColor(purpose: string) {
    switch (purpose) {
      case "login":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "invite":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "guest-login":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "garage-admin-login":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "garage-admin-invite":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default:
        return "bg-[#FBD10D]/10 text-[#FBD10D] border-[#FBD10D]/20";
    }
  }

  const activeOtps = otps.filter((otp) => !otp.isExpired);
  const expiredOtps = otps.filter((otp) => otp.isExpired);

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <p className="text-sm">No OTP codes</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active OTPs - Grid of tiles */}
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
                    {/* Code display */}
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

                    {/* Email */}
                    <div className="flex items-center gap-2 mb-3">
                      <Mail className="h-3.5 w-3.5 text-[#4a4a5a]" />
                      <span className="text-sm text-[#9fa0b8] truncate">
                        {otp.email}
                      </span>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-1 text-[10px] font-medium rounded-md border ${getPurposeColor(
                          otp.purpose
                        )}`}
                      >
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

          {/* Expired OTPs - Compact list */}
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
                      <span className="text-xs text-[#3a3a4a]">{otp.email}</span>
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

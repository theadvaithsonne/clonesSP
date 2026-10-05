"use client";

// Who is buying, at the top of the attendee step.
//
// Signed in → a banner and the buyer's details pre-filled. Signed out → a
// two-field OTP sign-in, the same `/auth/request-otp` + `/auth/verify-otp`
// pair the rest of the app uses, carrying the `referralCode` from the share
// link the visitor arrived on.
//
// This is a REQUIRED step, not an offer: the checkout will not submit until
// it reports a signed-in user. Two reasons it has to be. `/auth/verify-otp`
// is what binds a new account to the affiliate who shared the link, so a guest
// checkout earns the sharer nothing; and a ticket held by an account is one
// the attendee can find again from any device, which a guest order is not.

import React, { useState } from "react";
import { CheckCircle2, Loader2, UserCheck } from "lucide-react";
import { api } from "@/lib/api";
import { saveToken } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import { C } from "./ui";

interface VerifyResponse {
  token?: string;
  userId?: string;
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: string;
    phone?: string | null;
    phoneVerified?: boolean;
    currentOrg?: { id?: string };
  };
}

export default function CheckoutIdentity({
  accent,
  referralCode,
  onSignedIn,
}: {
  accent: string;
  /** From `?ref=` / `?referCode=` on the event link. */
  referralCode?: string;
  /** Fills the first attendee card from the verified account. */
  onSignedIn: (user: { name: string; email: string; phone?: string }) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);

  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Signed in ──────────────────────────────────────────────────────────
  if (isAuthenticated && user) {
    return (
      <div
        className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
        style={{ borderColor: C.border, background: "#fafafb" }}
      >
        <UserCheck className="h-4 w-4 shrink-0" style={{ color: "#16a34a" }} />
        <span className="min-w-0 flex-1 text-[13px]" style={{ color: C.ink }}>
          Signed in as{" "}
          <span className="font-semibold">{user.name || user.email}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            // Not a full logout: the buyer is mid-order, and dropping the
            // session outright would also drop the cart on a reload.
            useAuthStore.getState().setUser(null);
            setSent(false);
            setCode("");
          }}
          className="shrink-0 text-[12px] underline underline-offset-4"
          style={{ color: C.body }}
        >
          Use a different account
        </button>
      </div>
    );
  }

  // ── Signed out ─────────────────────────────────────────────────────────
  async function sendOtp() {
    if (!identifier.trim()) {
      setError("Enter your email or phone number");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email: identifier.trim(), purpose: "login" }),
      });
      setSent(true);
    } catch (err: any) {
      setError(err?.message || "Could not send the code");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<VerifyResponse>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          email: identifier.trim(),
          code: code.trim(),
          // What binds this account to whoever shared the link.
          referralCode: referralCode || undefined,
        }),
      });
      if (res.token) saveToken(res.token);
      const verified = res.user;
      setUser({
        userId: res.userId || verified?.id || "",
        email: verified?.email || "",
        name: verified?.name || "",
        role: verified?.role || "user",
        organizationId: verified?.currentOrg?.id || "",
        phone: verified?.phone || null,
        phoneVerified: !!verified?.phoneVerified,
      });
      onSignedIn({
        name: verified?.name || "",
        email: verified?.email || "",
        phone: verified?.phone || undefined,
      });
    } catch (err: any) {
      setError(err?.message || "That code didn't work");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="mb-6 rounded-xl border p-4"
      style={{ borderColor: C.border }}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-[13px] font-semibold" style={{ color: C.ink }}>
          Sign in to continue
        </span>
        <span className="text-[13px]" style={{ color: C.red }}>
          *
        </span>
      </div>
      <p className="mb-3 text-[12px] leading-5" style={{ color: C.muted }}>
        We&apos;ll send a one-time code. Your tickets are kept on this account,
        so you can find them again from any device.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          disabled={sent}
          placeholder="Email or phone number"
          className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2.5 text-[13px] outline-none placeholder:text-[#b6b7c2] focus:border-[#15151a] disabled:opacity-60"
          style={{ borderColor: C.border, color: C.ink }}
        />
        {!sent ? (
          <button
            type="button"
            onClick={sendOtp}
            disabled={busy}
            className="flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[12px] font-semibold text-[#141418] disabled:opacity-50"
            style={{ background: accent }}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Send OTP
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setCode("");
            }}
            className="shrink-0 text-[12px] underline underline-offset-4"
            style={{ color: C.body }}
          >
            Change
          </button>
        )}
      </div>

      {sent && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            placeholder="6-digit code"
            className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2.5 font-mono text-[13px] tracking-[0.3em] outline-none placeholder:tracking-normal placeholder:text-[#b6b7c2] focus:border-[#15151a]"
            style={{ borderColor: C.border, color: C.ink }}
          />
          <button
            type="button"
            onClick={verifyOtp}
            disabled={busy}
            className="flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[12px] font-semibold text-[#141418] disabled:opacity-50"
            style={{ background: accent }}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Verify
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-[12px]" style={{ color: C.red }}>
          {error}
        </p>
      )}
    </div>
  );
}

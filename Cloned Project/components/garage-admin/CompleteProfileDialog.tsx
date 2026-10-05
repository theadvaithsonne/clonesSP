"use client";

import { useEffect, useState } from "react";
import { Loader2, UserCheck, X } from "lucide-react";
import { completeUserProfile } from "@/lib/admin-api/danger-zone";

/**
 * Fill in a user's profile on their behalf.
 *
 * The backend requires all six fields before it will mark the profile
 * complete — the same rule the user's own save follows — so this collects
 * them all rather than patching one at a time.
 *
 * The offer-window switch is off by default and says why. `profileCompletedAt`
 * is what opens the 24-hour free-first-cycle window, and an admin tidying up
 * an address shouldn't silently start a commercial clock for someone.
 */
export default function CompleteProfileDialog({
  open,
  user,
  onCancel,
  onDone,
}: {
  open: boolean;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phone?: string | null;
    country?: string | null;
    state?: string | null;
    city?: string | null;
    postalCode?: string | null;
  } | null;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    country: "",
    state: "",
    city: "",
    postalCode: "",
  });
  const [startOfferWindow, setStartOfferWindow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from whatever the row already has, so the operator only fills
  // the gaps rather than retyping the record.
  useEffect(() => {
    if (!open || !user) return;
    setForm({
      name: user.name || "",
      phone: user.phone || "",
      country: user.country || "",
      state: user.state || "",
      city: user.city || "",
      postalCode: user.postalCode || "",
    });
    setStartOfferWindow(false);
    setError(null);
  }, [open, user]);

  if (!open || !user) return null;

  const missing = Object.entries(form)
    .filter(([, v]) => !v.trim())
    .map(([k]) => k);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await completeUserProfile(user.id, {
        ...form,
        startOfferWindow,
      });
      onDone();
      if (res.user.offerWindowStarted) {
        // Worth saying out loud — it's the part with commercial consequences.
        console.info("[admin] 24h offer window started for", res.user.email);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to complete profile");
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof typeof form, label: string, placeholder: string) => (
    <div>
      <label className="mb-1 block text-[11px] text-zinc-400">{label}</label>
      <input
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-white/[0.1] bg-[#0e0e12] px-3 text-sm text-white placeholder-zinc-700 focus:border-emerald-500/50 focus:outline-none"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141419] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <UserCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Complete profile
              </h2>
              <p className="mt-0.5 truncate text-xs text-zinc-500">
                {user.email || user.name || user.id}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg p-1 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4">
          {field("name", "Full name", "Jane Doe")}
          {field("phone", "Phone", "+91 98765 43210")}
          <div className="grid grid-cols-2 gap-3">
            {field("country", "Country", "India")}
            {field("state", "State", "Maharashtra")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("city", "City", "Mumbai")}
            {field("postalCode", "Postal code", "400001")}
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <input
              type="checkbox"
              checked={startOfferWindow}
              onChange={(e) => setStartOfferWindow(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-emerald-500"
            />
            <span className="text-[11px] leading-snug text-zinc-400">
              <span className="text-zinc-200">Start their 24-hour offer window</span>
              <br />
              Stamps <code className="text-zinc-500">profileCompletedAt</code>,
              which opens the free-first-cycle pricing for 24 hours. Leave off
              unless you mean to start that clock. Has no effect if their
              window has already started.
            </span>
          </label>

          {missing.length > 0 && (
            <p className="text-[11px] text-amber-300/90">
              All fields are required before the profile counts as complete.
            </p>
          )}
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="h-9 rounded-lg border border-white/[0.1] bg-white/[0.03] px-4 text-[13px] text-zinc-200 hover:bg-white/[0.06] disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || missing.length > 0}
            className="flex h-9 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-[13px] font-medium text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save profile
          </button>
        </div>
      </div>
    </div>
  );
}

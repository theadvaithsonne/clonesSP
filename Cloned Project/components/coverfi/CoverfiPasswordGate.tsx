"use client";

import { useEffect, useRef, useState } from "react";
import { Umbrella, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "coverfi_authed";
const COVERFI_PASSWORD = "coverfi@admin";

type Props = {
  /** Children render only after the gate is satisfied. */
  children: React.ReactNode;
};

/**
 * Frontend password gate for the Coverfi section. The check is intentionally
 * client-side only — it's a soft barrier so the panel doesn't pop open by
 * accident, not a security control. The actual security comes from the
 * `requireFounder` + `requireCoverfiScope` middleware on every backend route.
 *
 * Once entered correctly, the unlock persists in sessionStorage so the
 * founder doesn't have to re-enter on every page navigation within the
 * same tab. Closing the tab clears it.
 */
export default function CoverfiPasswordGate({ children }: Props) {
  const [authed, setAuthed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [pwd, setPwd] = useState("");
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAuthed(sessionStorage.getItem(STORAGE_KEY) === "1");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !authed) {
      // small delay so the dialog mounts cleanly before focus
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [hydrated, authed]);

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (checking) return;
    setChecking(true);
    // simulated check delay — feels less abrupt than instant failure/success
    await new Promise((r) => setTimeout(r, 220));
    if (pwd === COVERFI_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setAuthed(true);
      setPwd("");
    } else {
      toast.error("Incorrect password");
      setPwd("");
      inputRef.current?.focus();
    }
    setChecking(false);
  }

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center h-full text-[#9fa0b8] gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-brand" />
        Loading Coverfi…
      </div>
    );
  }

  if (authed) return <>{children}</>;

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-6 animate-in fade-in duration-200">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-white/[0.06] bg-gradient-to-b from-[#0e0e12] to-[#0a0a0d] p-7 shadow-[0_24px_56px_-16px_rgba(0,0,0,0.65)]"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-brand flex items-center justify-center shadow-[0_0_24px_-6px_color-mix(in_srgb,_var(--brand)_55%,_transparent)]">
            <Umbrella className="h-5 w-5 text-brand-foreground" strokeWidth={2.2} />
          </div>
          <div>
            <div className="text-[16px] font-semibold tracking-tight">
              Coverfi
            </div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-white/35">
              Brokerage backoffice
            </div>
          </div>
        </div>

        <div className="mb-5">
          <h2 className="text-[15px] font-medium mb-1">Enter access password</h2>
          <p className="text-[12.5px] text-white/45 leading-relaxed">
            This section is restricted. Enter the Coverfi password to continue.
          </p>
        </div>

        <label className="block">
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/35" />
            <input
              ref={inputRef}
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Password"
              autoComplete="off"
              className="w-full h-11 pl-9 pr-3 rounded-lg bg-white/[0.025] border border-white/[0.06] text-[14px] text-white placeholder:text-white/30 outline-none transition-all focus:bg-brand/[0.04] focus:border-brand/35 focus:shadow-[0_0_0_3px_color-mix(in_srgb,_var(--brand)_7%,_transparent)]"
              disabled={checking}
            />
          </div>
        </label>

        <button
          type="submit"
          disabled={checking || !pwd}
          className="mt-4 w-full h-11 rounded-lg bg-brand text-brand-foreground font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_18px_-4px_color-mix(in_srgb,_var(--brand)_55%,_transparent)] flex items-center justify-center gap-2"
        >
          {checking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Checking…
            </>
          ) : (
            "Unlock"
          )}
        </button>
      </form>
    </div>
  );
}

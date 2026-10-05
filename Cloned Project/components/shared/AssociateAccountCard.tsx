"use client";

/**
 * "Already have an account?" — shown inside Complete Profile.
 *
 * Logging in by phone creates an account when the number matches none, so
 * someone whose number was never on file lands in an empty one and reasonably
 * thinks their history is gone. This is the way back: name the real account by
 * email, prove ownership with a code sent there, and the phone moves across
 * while the throwaway is deleted.
 *
 * The same box is also how a phone signup ADDS an email. When nobody holds the
 * address, the backend sends a code to it instead ("add" mode) and saves it on
 * this account once confirmed. Before that branch existed a new email was a
 * dead end — the profile's email field is read-only, and PUT /profile takes no
 * email — so these accounts never got one, or the sign-up offer email.
 *
 * Only rendered for an account that could plausibly BE a throwaway — a
 * verified phone and no email. Showing it to an ordinary user would be an
 * invitation to delete the account they are sitting in.
 */

import { useState } from "react";
import { api } from "@/lib/api";
import { saveToken, saveOrgId } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import { isValidEmail } from "@/lib/identifier";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Link2, ArrowLeft, ShieldCheck } from "lucide-react";

type Step = "email" | "code";
/** "link": the email is another account's — merge into it. "add": it's new — save it here. */
type Mode = "link" | "add";

interface AssociateResponse {
  ok: boolean;
  merged?: boolean;
  movedPhone?: string | null;
  token?: string;
  userId: string;
  user: {
    id: string;
    email: string | null;
    name: string | null;
    role?: string;
    phone?: string | null;
    phoneVerified?: boolean;
    organizations: Array<{ id: string; name: string; role: string }>;
    hasOrganizations: boolean;
    currentOrg?: { id: string };
  };
}

export function AssociateAccountCard({ onDone }: { onDone?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState<Step>("email");
  const [mode, setMode] = useState<Mode>("link");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  /** Name on the account we found, so the confirmation names a real person. */
  const [foundName, setFoundName] = useState<string | null>(null);

  // The signal for "this might be a throwaway": a proven number, no email.
  const looksLikeThrowaway = !!user?.phoneVerified && !user?.email;
  if (!looksLikeThrowaway) return null;

  async function lookup() {
    const value = email.trim().toLowerCase();
    if (!isValidEmail(value)) {
      toast.error("Enter a valid email address");
      return;
    }
    setBusy(true);
    try {
      const r = await api<{
        ok: boolean;
        exists: boolean;
        self?: boolean;
        name?: string | null;
        codeSent?: boolean;
      }>("/auth/associate/request-otp", {
        method: "POST",
        body: JSON.stringify({ email: value, addIfNew: true }),
      });
      if (r.self) {
        toast.error("That's the account you're already signed in to");
        return;
      }
      if (!r.exists) {
        // `codeSent` absent = a backend without the add-email branch (the two
        // deploy separately). Say what's true there rather than erroring.
        if (r.codeSent === undefined) {
          toast.info("No existing account uses that email.");
          return;
        }
        if (!r.codeSent) {
          toast.error("Could not send a code to that email");
          return;
        }
        setMode("add");
        setFoundName(null);
        setStep("code");
        toast.success("Code sent — check that inbox");
        return;
      }
      setMode("link");
      setFoundName(r.name ?? null);
      setStep("code");
      toast.success("Code sent — check that inbox");
    } catch (e: any) {
      toast.error(e?.message || "Could not send the code");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (code.trim().length !== 6) return;
    if (mode === "add") return confirmAdd();
    setBusy(true);
    try {
      const data = await api<AssociateResponse>("/auth/associate/verify", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });

      // The account this session belonged to no longer exists — swap to the
      // one that survived before anything else re-reads the store.
      if (data.token) saveToken(data.token);
      if (data.user.currentOrg?.id) saveOrgId(data.user.currentOrg.id);
      useAuthStore.getState().setUser({
        userId: data.user.id,
        email: data.user.email || undefined,
        name: data.user.name || undefined,
        role: data.user.role,
        phone: data.user.phone,
        phoneVerified: !!data.user.phoneVerified,
      });

      toast.success(
        data.movedPhone
          ? "Accounts linked — your number is on your original account"
          : "Accounts linked"
      );
      onDone?.();
      // A full reload is the honest option: this session's identity changed
      // underneath every mounted component, and selectively refetching would
      // leave stale org/wallet/downline state from the deleted account.
      window.location.href = data.user.hasOrganizations ? "/workspace" : "/organization";
    } catch (e: any) {
      toast.error(e?.message || "Could not link the accounts");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function confirmAdd() {
    const value = email.trim().toLowerCase();
    setBusy(true);
    try {
      const data = await api<{ ok: boolean; email: string; token?: string }>(
        "/auth/email/verify",
        { method: "POST", body: JSON.stringify({ email: value, code: code.trim() }) }
      );
      // The JWT carries `email`, and parts of the app read identity from the
      // token rather than the store — swap it so both agree.
      if (data.token) saveToken(data.token);
      // setUser merges. Setting the email also unmounts this card, which only
      // renders for an account without one.
      useAuthStore.getState().setUser({ email: data.email });
      toast.success("Email confirmed and saved to your account");
    } catch (e: any) {
      // Someone registered it between the code and now: it's a merge after all.
      // api() surfaces `error` before `message`, so this arrives as the code.
      if (/email_taken|another account/i.test(e?.message || "")) {
        toast.error("That email now belongs to another account — send a code again to link it");
        setStep("email");
        setMode("link");
      } else {
        toast.error(e?.message || "Could not save the email");
      }
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#2a2a35] bg-[#13131a] p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand/25 bg-brand/10">
          <Link2 className="h-4 w-4 text-brand" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            Already have a Garage account?
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-white/50">
            You signed in with your number and we didn&apos;t recognise it, so
            this is a new account. Enter your email — if it&apos;s on an
            existing account we&apos;ll move your number over to it, otherwise
            we&apos;ll confirm it and add it to this one.
          </p>

          {step === "email" ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !busy && lookup()}
                className="h-10 flex-1 border-[#2a2a35] bg-[#1a1a24] text-sm text-white placeholder:text-white/30"
              />
              <Button
                onClick={lookup}
                disabled={busy || !email.trim()}
                className="h-10 bg-brand font-semibold text-brand-foreground hover:bg-brand/90"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send code"}
              </Button>
            </div>
          ) : (
            <div className="mt-3">
              <div className="mb-2 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-2.5">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                {mode === "add" ? (
                  <p className="text-[11px] leading-relaxed text-emerald-200/80">
                    No account uses{" "}
                    <b className="break-all">{email.trim().toLowerCase()}</b>, so
                    it&apos;ll be added to this account. Enter the code we sent
                    there to confirm it&apos;s yours.
                  </p>
                ) : (
                  <p className="text-[11px] leading-relaxed text-emerald-200/80">
                    Found {foundName ? <b>{foundName}</b> : "an account"} for{" "}
                    <b className="break-all">{email.trim().toLowerCase()}</b>. Enter
                    the code we sent there. This account will be closed and your
                    number moved over — nothing on the original account changes.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && !busy && confirm()}
                  className="h-10 flex-1 border-[#2a2a35] bg-[#1a1a24] text-sm tracking-[0.4em] text-white placeholder:tracking-normal placeholder:text-white/30"
                />
                <Button
                  onClick={confirm}
                  disabled={busy || code.length !== 6}
                  className="h-10 bg-brand font-semibold text-brand-foreground hover:bg-brand/90"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : mode === "add" ? (
                    "Verify & save"
                  ) : (
                    "Link accounts"
                  )}
                </Button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                }}
                className="mt-2 inline-flex items-center gap-1 text-[11px] text-white/40 transition-colors hover:text-white/70"
              >
                <ArrowLeft className="h-3 w-3" />
                Use a different email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AssociateAccountCard;

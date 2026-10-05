"use client";

// "Verify your admin" — the step-up gate over the admin console, asked once
// per login. The chrome behind it is blurred and inert; the page's own
// content is replaced by a skeleton rather than blurred, because a blur is
// a CSS property and the DOM under it stays readable.
//
// Layout: one wide card split in two. The left panel carries the identity
// of the moment — what this is, and who it thinks you are — and the right
// panel is the task itself: one question, one line to answer it on. The
// answer field is deliberately not a box; it's a single rule under the
// question, so the card reads as a sentence to complete rather than a form
// to fill in.
//
// The real enforcement is server-side: every admin route returns 403
// ADMIN_VERIFICATION_REQUIRED until the token carries the verified claim.
// This component is how you obtain that token, not the lock itself.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck, Loader2, LogOut, RefreshCw, ArrowRight } from "lucide-react";
import {
  signOutAdmin,
  submitAdminVerification,
  type AdminVerifyChallenge,
} from "@/lib/admin-api/admin-verify";

export function AdminVerifyGate({
  challenge,
  adminName,
  adminEmail,
  onVerified,
}: {
  challenge: AdminVerifyChallenge;
  adminName?: string;
  adminEmail?: string;
  onVerified: () => void;
}) {
  const questions = useMemo(() => challenge.questions ?? [], [challenge]);

  // Start somewhere random so the same question isn't the standing one
  // every single login.
  const [index, setIndex] = useState(() =>
    questions.length ? Math.floor(Math.random() * questions.length) : 0,
  );
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const question = questions[index] ?? null;

  useEffect(() => {
    inputRef.current?.focus();
  }, [index]);

  const nextQuestion = useCallback(() => {
    if (questions.length < 2) return;
    setIndex((i) => (i + 1) % questions.length);
    setAnswer("");
    setError(null);
  }, [questions.length]);

  const submit = useCallback(async () => {
    if (!question || busy) return;
    const value = answer.trim();
    if (!value) return;

    setBusy(true);
    setError(null);
    const result = await submitAdminVerification(question.id, value);

    if (result.ok) {
      onVerified();
      return;
    }

    if (result.signOut) {
      // The token is already dead server-side; show why for a beat so the
      // login screen isn't a mystery, then go.
      setSignedOut(true);
      setTimeout(signOutAdmin, 1600);
      return;
    }

    setBusy(false);
    setAnswer("");
    setError(result.message || "That's not the right answer.");
    setAttemptsLeft(result.attemptsLeft ?? null);
    inputRef.current?.focus();
  }, [answer, busy, onVerified, question]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/65 px-4 py-10">
      <div className="w-full max-w-[860px]">
        <div className="relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#0e0e12] shadow-[0_30px_90px_-24px_rgba(0,0,0,0.95)]">
          {/* A single hairline of brand colour along the top — enough to tie
              it to the console without a banner. */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-brand/55 to-transparent" />

          {signedOut ? (
            <SignedOut />
          ) : (
            <div className="grid md:grid-cols-[300px_minmax(0,1fr)]">
              {/* ───────── Left: what this is, and who you are ───────── */}
              <aside className="flex flex-col justify-between gap-10 border-b border-white/[0.06] bg-gradient-to-b from-white/[0.035] to-transparent px-8 py-9 md:border-b-0 md:border-r">
                <div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/[0.12] text-brand">
                    <ShieldCheck className="h-[19px] w-[19px]" />
                  </span>
                  <h1 className="mt-5 text-[22px] font-semibold leading-[1.15] tracking-[-0.01em] text-white">
                    Verify your
                    <br />
                    admin
                  </h1>
                  <p className="mt-3 max-w-[210px] text-[12.5px] leading-relaxed text-zinc-500">
                    Signing in isn't quite enough here. Answer one question and
                    the console opens for the rest of this session.
                  </p>
                </div>

                <div className="border-t border-white/[0.06] pt-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                    Signed in as
                  </div>
                  <div className="mt-1.5 truncate text-[13px] font-medium text-zinc-200">
                    {adminName || adminEmail || "Garage admin"}
                  </div>
                  {adminName && adminEmail && (
                    <div className="truncate text-[12px] text-zinc-600">
                      {adminEmail}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={signOutAdmin}
                    className="mt-4 inline-flex items-center gap-1.5 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out instead
                  </button>
                </div>
              </aside>

              {/* ───────── Right: the question, and one line to answer ───────── */}
              <section className="px-8 py-9 md:px-10">
                {question ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submit();
                    }}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                      Security question
                    </div>

                    <label
                      htmlFor="admin-verify-answer"
                      className="mt-3 block text-[21px] font-medium leading-snug tracking-[-0.01em] text-white"
                    >
                      {question.prompt}
                    </label>

                    {/* Not a box — a rule under the question, with the caret
                        sitting on it. The line lights up on focus. */}
                    <div className="group relative mt-8">
                      <input
                        id="admin-verify-answer"
                        ref={inputRef}
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        // Masked so the answer isn't readable over a
                        // shoulder, and never kept in form-fill history.
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        disabled={busy}
                        placeholder="Type your answer"
                        className="peer w-full border-0 bg-transparent pb-3 pr-10 text-[17px] text-white outline-none ring-0 placeholder:text-[15px] placeholder:tracking-normal placeholder:text-zinc-700 disabled:opacity-50"
                      />
                      {/* Base rule + the gold one that grows over it. */}
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/[0.12]" />
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.5px] origin-left scale-x-0 bg-brand transition-transform duration-300 ease-out peer-focus:scale-x-100" />
                      {answer.trim() && !busy && (
                        <button
                          type="submit"
                          aria-label="Verify"
                          className="absolute bottom-2 right-0 text-zinc-500 transition-colors hover:text-brand"
                        >
                          <ArrowRight className="h-[18px] w-[18px]" />
                        </button>
                      )}
                    </div>

                    <div className="mt-3 min-h-[18px]">
                      {error ? (
                        <p className="text-[12.5px] text-red-400">
                          {error}
                          {attemptsLeft === 1 && (
                            <span className="text-red-400/70">
                              {" "}
                              · one more wrong answer signs you out
                            </span>
                          )}
                          {attemptsLeft !== null && attemptsLeft > 1 && (
                            <span className="text-red-400/70">
                              {" "}
                              · {attemptsLeft} attempts left
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-[12.5px] text-zinc-600">
                          Capitals, spacing and punctuation are ignored.
                        </p>
                      )}
                    </div>

                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={busy || !answer.trim()}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-8 text-[14px] font-semibold text-brand-foreground transition hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] disabled:opacity-40"
                      >
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                        {busy ? "Verifying…" : "Verify"}
                      </button>

                      {/* Not knowing THIS one shouldn't cost the session. */}
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={nextQuestion}
                          disabled={busy}
                          className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[13px] text-zinc-400 transition-colors hover:text-white disabled:opacity-40"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Change the question
                        </button>
                      )}
                    </div>
                  </form>
                ) : (
                  <div className="flex h-full min-h-[220px] flex-col justify-center">
                    <p className="max-w-[340px] text-[14px] leading-relaxed text-zinc-400">
                      No verification question is set up for this account.
                      Contact a super admin.
                    </p>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SignedOut() {
  return (
    <div className="px-10 py-16 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/[0.12] text-red-400">
        <LogOut className="h-5 w-5" />
      </span>
      <h1 className="mt-5 text-[20px] font-semibold tracking-tight text-white">
        Signed out
      </h1>
      <p className="mx-auto mt-2 max-w-[330px] text-[13.5px] leading-relaxed text-zinc-400">
        Too many incorrect answers. Sign in again with a new code to try once
        more.
      </p>
    </div>
  );
}

/**
 * Stand-in for the page content while the gate is up. The real page is not
 * rendered at all — it would fire API calls the backend is refusing, and
 * its data has no business being in the DOM behind a blur.
 */
export function AdminVerifySkeleton() {
  return (
    <div className="space-y-6 px-8 pb-8 pt-7" aria-hidden>
      <div className="h-8 w-56 rounded-lg bg-white/[0.04]" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/[0.03]" />
        ))}
      </div>
      <div className="h-[420px] rounded-xl bg-white/[0.03]" />
    </div>
  );
}

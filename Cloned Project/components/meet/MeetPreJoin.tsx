'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, Shield, User as UserIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import OtpInput from '@/components/ui/otp-input';
import { saveToken, saveOrgId } from '@/lib/auth';

const AUTH_API_URL =
  process.env.NEXT_PUBLIC_AUTH_API_URL ?? 'https://test.garage.app';
const GARAGE_AFFILIATE_API =
  process.env.NEXT_PUBLIC_GARAGE_API_URL ?? 'https://test.garage.app';

type PreJoinState =
  | 'email-entry'
  | 'otp-verify'
  | 'name-entry'
  | 'guest-name-entry'
  | 'joining';

interface Referrer {
  id: string;
  name: string;
  email?: string;
  profilePicture?: string;
}

export interface MeetPreJoinProps {
  /** Optional meeting title to surface above the prompt. */
  title?: string;
  /** Affiliate id pulled from `?ref=…` on the URL. */
  affiliateId?: string;
  /** Called after the user has authenticated and the parent is
   *  expected to re-fetch /meet/token with the freshly-saved JWT. */
  onReady: () => void;
  /** Optional: skip auth entirely and join as an unauthenticated
   *  guest. Parent is responsible for calling /meet/token/guest with
   *  the supplied name and wiring up the room. */
  onGuestJoin?: (name: string) => Promise<void>;
}

/**
 * Pre-join screen for meet rooms — mirrors WebinarPreJoin's OTP
 * flow against Garage's /auth/request-otp + /auth/verify-otp (the
 * same endpoints NC's login uses). A successful verify mints a
 * Garage JWT that IS the NC auth token; the parent then re-runs
 * /meet/token to enter the room as a real authenticated user.
 *
 * No validate / not-started / isLive polling — meet rooms don't
 * have a curated "live" status the way webinars do.
 */
export default function MeetPreJoin({
  title,
  affiliateId,
  onReady,
  onGuestJoin,
}: MeetPreJoinProps) {
  const router = useRouter();

  const [pageState, setPageState] = useState<PreJoinState>('email-entry');
  const [referrer, setReferrer] = useState<Referrer | null>(null);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  // Pre-fill email from localStorage if a prior visit saved it
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('nc_guest_email');
    if (saved) setEmail(saved);
  }, []);

  /* ── Resolve referrer card (?ref=aff_…) ─────────────────────── */
  useEffect(() => {
    if (!affiliateId) return;
    const id = affiliateId.trim();
    (async () => {
      try {
        const res = await fetch(
          `${GARAGE_AFFILIATE_API}/affiliate/referrer-info?affiliateId=${encodeURIComponent(id)}`,
        );
        const data = await res.json().catch(() => ({}));
        if (data?.success && data?.referrer) setReferrer(data.referrer);
      } catch {
        /* soft-fail */
      }
    })();
  }, [affiliateId]);

  /* ── Step 1: request OTP ────────────────────────────────────── */
  async function handleRequestOtp() {
    if (!email.trim()) {
      setErr('Please enter your email');
      return;
    }
    setSubmitting(true);
    setErr('');
    try {
      const res = await fetch(`${AUTH_API_URL}/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Failed to send code');
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          'nc_guest_email',
          email.trim().toLowerCase(),
        );
      }
      setPageState('otp-verify');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to send code');
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Step 2: verify OTP → save NC token ─────────────────────── */
  const handleVerifyOtp = useCallback(
    async (code: string) => {
      if (code.length !== 6) return;
      setSubmitting(true);
      setErr('');
      try {
        const res = await fetch(`${AUTH_API_URL}/auth/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            code,
            // Garage's /auth/verify-otp accepts `referralCode` (the
            // `aff_…` affiliate id). New users get `referredBy`
            // permanently linked to the referrer; existing users
            // without one yet have it filled in. So a guest who
            // joined a meet via ?ref=aff_… gets their attribution
            // wired up on first verify.
            ...(affiliateId ? { referralCode: affiliateId } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.error || 'Invalid code');
        }
        // Prefer the direct token; otherwise pick the first org and
        // call /auth/select-org for a scoped JWT. Mirrors the login
        // page exactly.
        if (data.token) {
          saveToken(data.token);
          if (data.user?.currentOrg?.id) saveOrgId(data.user.currentOrg.id);
        } else if (data.user?.organizations?.length > 0) {
          const org = data.user.organizations[0];
          const sel = await fetch(`${AUTH_API_URL}/auth/select-org`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: data.user.id, orgId: org.id }),
          });
          const selData = await sel.json();
          if (!sel.ok) {
            throw new Error(
              selData.message || 'Failed to select organization',
            );
          }
          saveToken(selData.token);
          saveOrgId(org.id);
        } else {
          throw new Error('No organization found for this account');
        }
        const resolvedName = data.user?.name?.trim();
        if (resolvedName) {
          // Existing member with a name on file — skip the redundant
          // name-entry step and hand off to the parent.
          setDisplayName(resolvedName);
          setPageState('joining');
          onReady();
        } else {
          setPageState('name-entry');
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Verification failed');
        setOtp('');
      } finally {
        setSubmitting(false);
      }
    },
    [email, onReady],
  );

  // Auto-submit once 6 digits are typed.
  useEffect(() => {
    if (otp.length === 6 && pageState === 'otp-verify' && !submitting) {
      handleVerifyOtp(otp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  /* ── Step 3 (optional): name entry ──────────────────────────── */
  function handleJoin() {
    if (!displayName.trim()) {
      setErr('Please enter your name');
      return;
    }
    setPageState('joining');
    onReady();
  }

  /* ── Guest-only path: name → /meet/token/guest (no auth) ───── */
  async function handleGuestJoin() {
    if (!onGuestJoin) return;
    if (!displayName.trim()) {
      setErr('Please enter your name');
      return;
    }
    setSubmitting(true);
    setErr('');
    try {
      await onGuestJoin(displayName.trim());
      setPageState('joining');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to join as guest');
      setSubmitting(false);
    }
  }

  /* ── Render: joining loader ─────────────────────────────────── */
  if (pageState === 'joining') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-purple-500" />
          <p className="text-sm text-gray-400">Joining meeting…</p>
        </div>
      </div>
    );
  }

  /* ── Shared header card with optional title + referrer chip ─── */
  const headerCard = (
    <div className="mb-5 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-indigo-600">
        <svg
          className="h-7 w-7 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-white">
        {title || 'Join Meeting'}
      </h2>
      <p className="mt-1 text-xs text-gray-400">
        Verify your email to join
      </p>
      {referrer && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#2a2a35] bg-[#1a1a20] p-2 text-left">
          {referrer.profilePicture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={referrer.profilePicture}
              alt={referrer.name}
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2a2a35] text-[11px] font-semibold text-white">
              {referrer.name?.charAt(0).toUpperCase() || '?'}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[9px] uppercase tracking-wide text-gray-500">
              Referred by
            </div>
            <div className="truncate text-xs text-white">{referrer.name}</div>
          </div>
        </div>
      )}
    </div>
  );

  /* ── Render: email entry ────────────────────────────────────── */
  if (pageState === 'email-entry') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm rounded-2xl border border-[#2a2a35] bg-[#111116] p-6 shadow-2xl"
        >
          {headerCard}
          <label className="mb-1 block text-[11px] font-medium text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> Email
            </span>
          </label>
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRequestOtp()}
            placeholder="you@example.com"
            className="mb-3 w-full rounded-lg border border-[#2a2a35] bg-[#1a1a20] px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500/60"
          />
          {err && (
            <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {err}
            </p>
          )}
          <button
            onClick={handleRequestOtp}
            disabled={submitting || !email.trim()}
            className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Send code'}
          </button>
          {/* Guest path — only rendered when the parent supplies an
              onGuestJoin handler (i.e. the room allows unauthenticated
              joins). Divider + secondary button so it doesn't compete
              with the primary email flow. */}
          {onGuestJoin && (
            <>
              <div className="my-4 flex items-center gap-2 text-[10px] uppercase tracking-wide text-gray-600">
                <span className="h-px flex-1 bg-[#2a2a35]" />
                or
                <span className="h-px flex-1 bg-[#2a2a35]" />
              </div>
              <button
                onClick={() => {
                  setErr('');
                  setPageState('guest-name-entry');
                }}
                disabled={submitting}
                className="w-full rounded-lg border border-[#2a2a35] bg-[#1a1a20] py-2.5 text-sm font-medium text-white transition hover:bg-[#22222c] disabled:opacity-50"
              >
                Join as guest
              </button>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  /* ── Render: guest name-entry (no auth) ─────────────────────── */
  if (pageState === 'guest-name-entry') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm rounded-2xl border border-[#2a2a35] bg-[#111116] p-6 shadow-2xl"
        >
          {headerCard}
          <div className="mb-3 flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">
              Joining as guest
            </h3>
          </div>
          <input
            autoFocus
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGuestJoin()}
            placeholder="Your name"
            className="mb-3 w-full rounded-lg border border-[#2a2a35] bg-[#1a1a20] px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500/60"
          />
          {err && (
            <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {err}
            </p>
          )}
          <button
            onClick={handleGuestJoin}
            disabled={submitting || !displayName.trim()}
            className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Joining…' : 'Join meeting'}
          </button>
          <button
            onClick={() => {
              setErr('');
              setPageState('email-entry');
            }}
            disabled={submitting}
            className="mt-3 w-full text-xs text-gray-500 hover:text-gray-300 disabled:opacity-50"
          >
            ← Sign in with email instead
          </button>
        </motion.div>
      </div>
    );
  }

  /* ── Render: OTP verify ─────────────────────────────────────── */
  if (pageState === 'otp-verify') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm rounded-2xl border border-[#2a2a35] bg-[#111116] p-6 shadow-2xl"
        >
          {headerCard}
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">
              Enter verification code
            </h3>
          </div>
          <p className="mb-4 text-xs text-gray-500">
            We sent a 6-digit code to{' '}
            <span className="text-gray-300">{email}</span>.
          </p>
          <OtpInput value={otp} onChange={setOtp} length={6} />
          {err && (
            <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {err}
            </p>
          )}
          <button
            onClick={() => {
              setOtp('');
              setErr('');
              setPageState('email-entry');
            }}
            className="mt-4 w-full text-xs text-gray-500 hover:text-gray-300"
          >
            Change email
          </button>
          {submitting && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Verifying…
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  /* ── Render: name entry ─────────────────────────────────────── */
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl border border-[#2a2a35] bg-[#111116] p-6 shadow-2xl"
      >
        {headerCard}
        <div className="mb-3 flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">
            How should we call you?
          </h3>
        </div>
        <input
          autoFocus
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          placeholder="Your name"
          className="mb-3 w-full rounded-lg border border-[#2a2a35] bg-[#1a1a20] px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500/60"
        />
        {err && (
          <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {err}
          </p>
        )}
        <button
          onClick={handleJoin}
          disabled={submitting || !displayName.trim()}
          className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50"
        >
          Join meeting
        </button>
      </motion.div>
    </div>
  );
}

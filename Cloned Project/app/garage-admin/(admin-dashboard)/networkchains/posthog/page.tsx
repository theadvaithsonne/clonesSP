"use client";

/**
 * Admin session-replay viewer. Lists PostHog recordings from contacts-backend's
 * /admin/posthog/* proxy and plays the selected one IN-PANEL via PostHog's own
 * player (an iframe fed by an on-demand sharing token from /embed). The personal
 * API key never reaches the browser — the backend holds it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertOctagon, AlertTriangle, Check, ExternalLink, Keyboard, Link2, Loader2, MonitorPlay, MousePointerClick } from "lucide-react";
import {
  listRecordings,
  getEmbed,
  listSessionExceptions,
  getStats,
  PostHogUnavailableError,
  type SessionException,
  type PostHogRecording,
  type PostHogStats,
} from "@/lib/nc-admin-api/admin-posthog";
import { AdminUnauthorizedError } from "@/lib/nc-admin-api/admin";
import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";
import { useAdminProduct, useAdminDevice, appsFor } from "@/lib/admin/product";
import { ProductSwitch } from "@/components/nc-admin/product-switch";
import { DeviceSwitch } from "@/components/nc-admin/device-switch";
import { useAdminSearch } from "@/components/garage-admin/admin-search";

const PAGE = 30;

function fmtDuration(sec?: number): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtWhen(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function personLabel(r: PostHogRecording): string {
  return (
    r.person?.name ||
    r.person?.distinct_ids?.[0] ||
    r.distinct_id ||
    "Anonymous"
  );
}

export default function AdminPostHogPage() {
  const [recordings, setRecordings] = useState<PostHogRecording[]>([]);
  const [stats, setStats] = useState<PostHogStats | null>(null);
  const [selected, setSelected] = useState<PostHogRecording | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [embedLoading, setEmbedLoading] = useState(false);
  const [embedError, setEmbedError] = useState("");
  const [links, setLinks] = useState<{ shareUrl?: string; posthogUrl?: string }>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [exceptions, setExceptions] = useState<SessionException[] | null>(null);
  const [exceptionsLoading, setExceptionsLoading] = useState(false);
  const { query: searchInput } = useAdminSearch();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [product] = useAdminProduct();
  const [device] = useAdminDevice();
  const apps = useMemo(() => appsFor(product), [product]);

  // An expired NC token is recovered by re-elevating from the Garage session —
  // never by reloading, which would drop the operator out of the Garage shell.
  // Capped to one recovery attempt per failure episode: if elevation keeps
  // succeeding while the data endpoint keeps 401ing, this must not loop
  // forever hammering the backend. Re-arms on the next successful load.
  // lib/nc-admin-api/auth.ts already clears the stale NC token on every path
  // that throws this error, so no page-level clear is needed here.
  const recoveryAttempted = useRef(false);

  const recoverThenRetry = useCallback((retry: () => void) => {
    if (recoveryAttempted.current) return; // one attempt per failure episode
    recoveryAttempted.current = true;
    ensureNcAdminToken().then((result) => {
      if (result.ok === true) retry();
    });
  }, []);

  const handleErr = useCallback(
    (e: unknown, retry: () => void) => {
      if (e instanceof AdminUnauthorizedError) {
        recoverThenRetry(retry);
        return;
      }
      if (e instanceof PostHogUnavailableError) {
        setUnavailable(e.reason);
        return;
      }
      // Show the upstream reason when there is one — a filter that PostHog
      // rejects should say so, not read as a generic outage.
      setError(
        e instanceof Error && e.message
          ? `Failed to load recordings — ${e.message}`
          : "Failed to load recordings.",
      );
    },
    [recoverThenRetry],
  );

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const reqId = useRef(0);

  const load = useCallback(
    async (off: number, append: boolean) => {
      // Stamp the request and drop its response if a newer one has started.
      // The product switch hydrates from localStorage after mount, so a hard
      // refresh on Seller fires NetworkChains first and Seller a tick later —
      // and NetworkChains, being the slower query, was landing last and
      // overwriting the list. Without this the switch says one product and the
      // rows are another.
      const id = ++reqId.current;
      setLoading(true);
      setError("");
      setUnavailable(null);
      try {
        const r = await listRecordings({
          limit: PAGE,
          offset: off,
          search: search || undefined,
          apps,
          device,
        });
        if (id !== reqId.current) return;
        setHasNext(!!r.has_next);
        setRecordings((prev) => (append ? [...prev, ...r.results] : r.results));
        recoveryAttempted.current = false; // healthy again — re-arm for a future episode
      } catch (e) {
        if (id !== reqId.current) return;
        handleErr(e, () => load(off, append));
      } finally {
        // Only the newest request owns the spinner; a superseded one clearing
        // it would hide that the current fetch is still running.
        if (id === reqId.current) setLoading(false);
      }
    },
    [search, apps, device, handleErr],
  );

  useEffect(() => {
    setOffset(0);
    load(0, false);
  }, [load]);

  useEffect(() => {
    const fetchStats = () => {
      getStats()
        .then((s) => {
          setStats(s);
          recoveryAttempted.current = false; // healthy again — re-arm for a future episode
        })
        .catch((e) => {
          if (e instanceof AdminUnauthorizedError) {
            recoverThenRetry(fetchStats);
            return;
          }
          // best-effort — the list is the primary content
        });
    };
    fetchStats();
  }, [recoverThenRetry]);

  const openRecording = useCallback(
    async (r: PostHogRecording) => {
      setSelected(r);
      setEmbedUrl(null);
      setLinks({});
      setCopied(null);
      setEmbedError("");
      setEmbedLoading(true);

      // Errors load independently of the player — a failed embed shouldn't
      // hide them, and vice versa. Best-effort: an empty list is a normal
      // outcome, so a rejection just resolves to none rather than surfacing.
      setExceptions(null);
      setExceptionsLoading(true);
      listSessionExceptions(r.id)
        .then((d) => setExceptions(d.exceptions))
        .catch(() => setExceptions([]))
        .finally(() => setExceptionsLoading(false));

      try {
        const info = await getEmbed(r.id);
        setEmbedUrl(info.embedUrl);
        setLinks({ shareUrl: info.shareUrl, posthogUrl: info.posthogUrl });
        recoveryAttempted.current = false; // healthy again — re-arm for a future episode
      } catch (e) {
        if (e instanceof AdminUnauthorizedError) {
          recoverThenRetry(() => openRecording(r));
          return;
        }
        setEmbedError(
          e instanceof PostHogUnavailableError
            ? "PostHog rejected the request — the personal API key needs sharing/recording write scope to embed."
            : "Couldn't load this replay.",
        );
      } finally {
        setEmbedLoading(false);
      }
    },
    [recoverThenRetry],
  );

  const loadMore = () => {
    const next = offset + PAGE;
    setOffset(next);
    load(next, true);
  };

  if (unavailable) return <UnavailableCard reason={unavailable} />;

  return (
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col gap-4 bg-[#080808] p-4 text-white sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
            <MonitorPlay className="h-5 w-5 text-[#FFC200]" />
            Session Replays
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Watch each recording in-panel. Powered by PostHog (project data,
            read-only).
          </p>
        </div>
        <ProductSwitch />
        <DeviceSwitch />
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Weekly active" value={stats.weeklyActiveUsers} />
          <StatCard label="Events · 7d" value={stats.events7d} />
          <StatCard label="Screen / page views · 7d" value={stats.views7d} />
        </div>
      )}

      {/* Master–detail */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
        {/* List */}
        <div className="flex min-h-0 flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02]">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {error && (
              <p className="p-4 text-xs text-[#EF4444]">{error}</p>
            )}
            {loading && recordings.length === 0 ? (
              <div className="flex items-center justify-center gap-2 p-10 text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading recordings…</span>
              </div>
            ) : recordings.length === 0 ? (
              <p className="p-10 text-center text-sm text-zinc-500">
                No recordings found.
              </p>
            ) : (
              <ul>
                {recordings.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => openRecording(r)}
                      className={`w-full border-b border-white/[0.04] px-3 py-3 text-left transition hover:bg-white/[0.03] ${
                        selected?.id === r.id ? "bg-white/[0.05]" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-zinc-100">
                          {personLabel(r)}
                        </span>
                        <span className="shrink-0 text-[11px] text-zinc-500">
                          {fmtWhen(r.start_time)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-500">
                        <span>{fmtDuration(r.recording_duration)}</span>
                        <span className="flex items-center gap-1">
                          <MousePointerClick className="h-3 w-3" />
                          {r.click_count ?? 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <Keyboard className="h-3 w-3" />
                          {r.keypress_count ?? 0}
                        </span>
                        {!!r.console_error_count && (
                          <span className="flex items-center gap-1 text-[#EF4444]">
                            <AlertOctagon className="h-3 w-3" />
                            {r.console_error_count}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {hasNext && !loading && (
              <button
                type="button"
                onClick={loadMore}
                className="w-full py-3 text-xs font-medium text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
              >
                Load more
              </button>
            )}
            {loading && recordings.length > 0 && (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
              </div>
            )}
          </div>
        </div>

        {/* Player */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-zinc-600">
              <MonitorPlay className="h-8 w-8" />
              <p className="text-sm">Select a recording to play it here.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {personLabel(selected)}
                  </p>
                  <p className="truncate text-[11px] text-zinc-500">
                    {fmtDuration(selected.recording_duration)} ·{" "}
                    {selected.start_url || "unknown page"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {links.shareUrl && (
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(links.shareUrl!);
                        setCopied("share");
                        setTimeout(() => setCopied(null), 1600);
                      }}
                      title="Public link — opens the replay without a PostHog login"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 transition hover:text-white"
                    >
                      {copied === "share" ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Link2 className="h-3 w-3" />
                      )}
                      {copied === "share" ? "Copied" : "Copy link"}
                    </button>
                  )}
                  {links.posthogUrl && (
                    <a
                      href={links.posthogUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in PostHog — the Console tab there shows the console errors this panel can't fetch"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 transition hover:text-white"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open in PostHog
                    </a>
                  )}
                </div>
              </div>
              <div className="relative flex-1 bg-black">
                {embedLoading && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Preparing replay…</span>
                  </div>
                )}
                {embedError && (
                  <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-[#EF4444]">
                    {embedError}
                  </div>
                )}
                {embedUrl && (
                  <iframe
                    key={embedUrl}
                    src={embedUrl}
                    title="Session replay"
                    className="h-full w-full border-0"
                    allow="fullscreen"
                  />
                )}
              </div>
              <div className="shrink-0 overflow-y-auto px-4 pb-4">
                <SessionExceptions
                  loading={exceptionsLoading}
                  exceptions={exceptions}
                  consoleErrorCount={selected.console_error_count ?? 0}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
      <p className="text-lg font-bold text-white">
        {value.toLocaleString()}
      </p>
      <p className="text-[11px] text-zinc-500">{label}</p>
    </div>
  );
}

/** Thrown errors captured in the session.
 *
 *  Distinct from the console-error badge on the recording row. That badge is
 *  `console_error_count` — console.error() output, which PostHog renders in
 *  the player's Console tab but does NOT expose over its API, so reading them
 *  means opening the recording in PostHog itself. The two numbers disagreeing
 *  is expected, so the header says which is which. */
function SessionExceptions({
  loading,
  exceptions,
  consoleErrorCount,
}: {
  loading: boolean;
  exceptions: SessionException[] | null;
  consoleErrorCount: number;
}) {
  return (
    <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <div className="flex items-baseline justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-400">
          Errors in this session
        </h3>
        {consoleErrorCount > 0 && (
          <span className="text-[11px] text-zinc-500">
            + {consoleErrorCount.toLocaleString()} console error
            {consoleErrorCount === 1 ? "" : "s"} — use “Open in PostHog”
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-4 py-5 text-zinc-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs">Loading errors…</span>
        </div>
      ) : !exceptions || exceptions.length === 0 ? (
        <p className="px-4 py-5 text-xs text-zinc-500">
          No thrown errors captured in this session.
          {consoleErrorCount > 0 &&
            " The console errors above aren't fetchable — PostHog's API doesn't expose replay console output, so open it in PostHog to read them."}
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {exceptions.map((e, i) => (
            <li key={`${e.type}-${e.message}-${i}`} className="px-4 py-2.5">
              <div className="flex items-start gap-2">
                <span className="mt-px shrink-0 rounded-sm bg-[#EF4444]/[0.12] px-1.5 py-0.5 text-[10px] text-[#EF4444]">
                  {e.type}
                </span>
                <p className="min-w-0 flex-1 break-words text-xs leading-relaxed text-zinc-200">
                  {e.message}
                </p>
                {e.occurrences > 1 && (
                  <span
                    className="shrink-0 rounded-sm bg-white/[0.06] px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-300"
                    title="Times this same error fired in the session"
                  >
                    ×{e.occurrences}
                  </span>
                )}
              </div>
              {e.url && (
                <p className="mt-1 truncate text-[11px] text-zinc-600" title={e.url}>
                  {e.url}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UnavailableCard({ reason }: { reason: string }) {
  const msg =
    reason === "posthog_not_configured"
      ? "PostHog isn't configured on the backend yet. Set POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID, and POSTHOG_API_HOST on contacts-backend."
      : reason === "posthog_auth"
        ? "PostHog rejected the personal API key — it's invalid or lacks the required read scopes (session_recording:read, query:read, person:read)."
        : "Couldn't reach PostHog. Try again shortly.";
  return (
    <div className="-mx-8 -mb-8 -mt-7 flex min-h-[calc(100vh-66px)] items-center justify-center bg-[#080808] p-4 text-white sm:p-6">
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-10 text-center">
        <AlertTriangle className="h-7 w-7 text-amber-400" />
        <p className="text-base font-semibold text-white">Replays unavailable</p>
        <p className="max-w-md text-sm text-zinc-400">{msg}</p>
      </div>
    </div>
  );
}

"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Loader2, Monitor, User } from "lucide-react";
import {
  getIssue,
  getLatestEvent,
  replayIdOf,
  issueReplaysUrl,
  getEvent,
  listEvents,
  exceptionValues,
  breadcrumbs,
  requestEntry,
  messageEntry,
  resolveActor,
  levelClass,
  relTime,
  type SentryIssue,
  type SentryEvent,
  SentryUnavailableError,
} from "@/lib/nc-admin-api/admin-sentry";
import { AdminUnauthorizedError } from "@/lib/nc-admin-api/admin";
import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";
import { StackTrace } from "@/components/nc-admin/sentry/stack-trace";
import {
  Panel,
  TagsPanel,
  ContextsPanel,
  UserPanel,
  RequestPanel,
  BreadcrumbsPanel,
  RawJsonPanel,
} from "@/components/nc-admin/sentry/event-panels";
import { UnavailableState } from "@/components/nc-admin/sentry/unavailable-state";

export default function AdminSentryIssuePage({
  params,
}: {
  params: Promise<{ issueId: string }>;
}) {
  const { issueId } = use(params);
  const router = useRouter();
  const [issue, setIssue] = useState<SentryIssue | null>(null);
  const [event, setEvent] = useState<SentryEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [occurrences, setOccurrences] = useState<SentryEvent[] | null>(null);

  // An expired NC token is recovered by re-elevating from the Garage session —
  // never by reloading, which would drop the operator out of the Garage shell.
  // Capped to one recovery attempt per failure episode: if elevation keeps
  // succeeding while the data endpoint keeps 401ing, this must not loop
  // forever hammering the backend. Re-arms on the next successful load.
  // lib/nc-admin-api/auth.ts already clears the stale NC token on every path
  // that throws this error, so no page-level clear is needed here.
  const recoveryAttempted = useRef(false);

  const handleErr = useCallback((e: unknown, retry: () => void) => {
    if (e instanceof AdminUnauthorizedError) {
      if (recoveryAttempted.current) return; // one attempt per failure episode
      recoveryAttempted.current = true;
      ensureNcAdminToken().then((result) => {
        if (result.ok === true) {
          retry();
        }
      });
      return;
    }
    if (e instanceof SentryUnavailableError) {
      setUnavailable(e.reason);
      return;
    }
    setError("Failed to load this issue.");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setUnavailable(null);
    try {
      const [i, ev] = await Promise.all([getIssue(issueId), getLatestEvent(issueId)]);
      setIssue(i.issue);
      setEvent(ev.event);
      recoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      handleErr(e, load);
    } finally {
      setLoading(false);
    }
  }, [issueId, handleErr]);

  useEffect(() => {
    load();
  }, [load]);

  const loadOccurrences = useCallback(async () => {
    try {
      const r = await listEvents(issueId);
      setOccurrences(r.events);
      recoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      handleErr(e, loadOccurrences);
    }
  }, [issueId, handleErr]);

  const switchEvent = useCallback(
    async (eventId: string) => {
      try {
        const r = await getEvent(issueId, eventId);
        setEvent(r.event);
        window.scrollTo({ top: 0, behavior: "smooth" });
        recoveryAttempted.current = false; // healthy again — re-arm for a future episode
      } catch (e) {
        handleErr(e, () => switchEvent(eventId));
      }
    },
    [issueId, handleErr],
  );

  if (loading) {
    return (
      <div className="-mx-8 -mb-8 -mt-7 flex min-h-[calc(100vh-66px)] items-center justify-center bg-[#080808]">
        <Loader2 className="h-6 w-6 animate-spin text-[#FFC200]" />
      </div>
    );
  }

  if (unavailable) {
    return (
      <Shell onBack={() => router.push("/garage-admin/networkchains/sentry")}>
        <UnavailableState reason={unavailable} />
      </Shell>
    );
  }

  if (error || !issue || !event) {
    return (
      <Shell onBack={() => router.push("/garage-admin/networkchains/sentry")}>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-6 text-center text-sm text-red-400">
          {error || "This issue was not found."}
        </div>
      </Shell>
    );
  }

  const message = messageEntry(event);
  const req = requestEntry(event);
  const actor = resolveActor(event);

  return (
    <Shell onBack={() => router.push("/garage-admin/networkchains/sentry")}>
      {/* Header */}
      <div className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`rounded border px-2 py-0.5 text-[10px] uppercase ${levelClass(issue.level)}`}>
            {issue.level ?? "error"}
          </span>
          {issue.shortId && (
            <span className="font-mono text-[11px] text-zinc-500">{issue.shortId}</span>
          )}
          {issue.status && (
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-400">
              {issue.status}
            </span>
          )}
          {/* Only shown when the event actually carries a replay — a link to
              an empty Replays tab is worse than no link, because it reads as
              "the replay is missing" rather than "this error has none". */}
          {replayIdOf(event) && issueReplaysUrl(issue.permalink) && (
            <a
              href={issueReplaysUrl(issue.permalink)!}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-[#FFC200] hover:underline"
            >
              Watch session replay <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {issue.permalink && (
            <a
              href={issue.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline ${
                replayIdOf(event) ? "" : "ml-auto"
              }`}
            >
              Open in Sentry <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-white break-words">
          {issue.title}
        </h1>
        {issue.culprit && (
          <p className="mt-0.5 font-mono text-xs text-zinc-400 break-words">{issue.culprit}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-zinc-500">
          <span>events: {String(issue.count ?? "—")}</span>
          <span>users: {issue.userCount ?? 0}</span>
          <span>first: {relTime(issue.firstSeen)}</span>
          <span>last: {relTime(issue.lastSeen)}</span>
          {event.environment && <span>env: {String(event.environment)}</span>}
          {event.eventID && <span className="font-mono">event: {event.eventID.slice(0, 8)}</span>}
        </div>

        {/* Who + client — resolved actor for this specific event */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wide text-zinc-500">
              <User className="h-3.5 w-3.5" /> User
            </div>
            {actor.email ? (
              <div className="text-sm font-medium text-white break-all">{actor.email}</div>
            ) : (
              <div className="text-sm font-medium text-amber-300">Guest</div>
            )}
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
              {actor.email && <span className="text-emerald-400">authenticated</span>}
              {!actor.email && actor.userId && <span className="text-zinc-400">unauthenticated id</span>}
              {actor.userId && <span className="font-mono">id: {actor.userId}</span>}
              {actor.ip && <span className="font-mono">ip: {actor.ip}</span>}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wide text-zinc-500">
              <Monitor className="h-3.5 w-3.5" /> Client
            </div>
            {actor.clientKnown ? (
              <>
                <div className="text-sm font-medium text-white break-all">
                  {actor.browser ?? "Unknown browser"}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
                  {actor.os && <span>{actor.os}</span>}
                  {actor.device && <span>{actor.device}</span>}
                </div>
              </>
            ) : (
              <>
                <div className="text-sm text-zinc-400">Server-side — no browser</div>
                <div className="mt-1 text-[11px] text-zinc-600">
                  worker/job/cron error with no end-user request
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Exception + stack trace (the centerpiece) */}
        <Panel title="Exception">
          <StackTrace values={exceptionValues(event)} />
          {exceptionValues(event).length === 0 && message && (
            <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-black/30 p-3 font-mono text-[11px] text-zinc-300">
              {message}
            </pre>
          )}
        </Panel>

        <BreadcrumbsPanel crumbs={breadcrumbs(event)} />
        <TagsPanel event={event} />
        <ContextsPanel event={event} />
        <RequestPanel request={req} />
        <UserPanel event={event} />

        {/* Occurrences (lazy) — page to older events for this issue */}
        <Panel title="Occurrences" defaultOpen={false}>
          {occurrences == null ? (
            <button
              onClick={loadOccurrences}
              className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-medium text-white hover:bg-white/[0.08]"
            >
              Load recent occurrences
            </button>
          ) : occurrences.length === 0 ? (
            <p className="text-xs text-zinc-500">No occurrences returned.</p>
          ) : (
            <ul className="space-y-1">
              {occurrences.map((o) => (
                <li key={o.eventID ?? o.id}>
                  <button
                    onClick={() => switchEvent(o.eventID ?? o.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-white/[0.04] ${
                      (o.eventID ?? o.id) === (event.eventID ?? event.id)
                        ? "bg-white/[0.04]"
                        : ""
                    }`}
                  >
                    <span className="font-mono text-[11px] text-sky-400">
                      {(o.eventID ?? o.id).slice(0, 12)}
                    </span>
                    <span className="text-zinc-500">{relTime(o.dateCreated)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <RawJsonPanel event={event} />
      </div>
    </Shell>
  );
}

function Shell({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col overflow-y-auto bg-gradient-to-br from-[rgba(8,8,8,0.98)] to-[rgba(15,15,15,0.98)] px-8 pb-8 pt-7 text-white">
      <button
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to issues
      </button>
      {children}
    </div>
  );
}

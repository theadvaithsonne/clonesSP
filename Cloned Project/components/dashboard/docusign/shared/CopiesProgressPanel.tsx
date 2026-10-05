"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DsCopiesProgress } from "@/lib/docusign/types";

const POLL_MS = 3000;
// After a failed poll, wait this long, doubling on each further failure up to the max; a success resets it.
const ERROR_RETRY_MS = POLL_MS * 2;
const MAX_ERROR_RETRY_MS = 60_000;
// Errors that polling again can't fix: signed out, no longer allowed to see it, or it's gone.
const FINAL_ERROR_STATUSES = [401, 403, 404];
// How many failed people are named before "and N more".
const NAMED_FAILURES = 5;

interface CopiesProgressPanelProps {
  // Any one copy of the send (the sender's editor shows the original).
  documentId: string;
  // Required, not defaulted: this component is shared by both flows, so it must not import
  // either side's API. Internal passes getCopiesProgress/retryFailedCopies; external passes
  // getExternalCopiesProgress/retryExternalFailedCopies (same response shape, different URL).
  // Same pattern as MoveToFolderDialog's moveFn prop.
  fetchProgress: (id: string) => Promise<{ status: boolean; data: DsCopiesProgress }>;
  retryProgress: (id: string) => Promise<{ status: boolean; data: DsCopiesProgress }>;
}

// The sender's view of a "separate copy for each person" send: copies are built in the background, so this shows
// how far along it is, keeps updating until it's done, and lets them retry the ones that failed. Renders nothing
// for someone who isn't allowed to see it (the endpoint is owner/admin only) or when there's no such send.
export function CopiesProgressPanel({ documentId, fetchProgress, retryProgress }: CopiesProgressPanelProps) {
  const [progress, setProgress] = useState<DsCopiesProgress | null>(null);
  const [hidden, setHidden] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  // Bumping this restarts polling (after a retry the job is running again).
  const [pollRun, setPollRun] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let haveProgress = false;
    let errorDelay = ERROR_RETRY_MS;

    const tick = async () => {
      try {
        const res = await fetchProgress(documentId);
        if (cancelled) return;
        haveProgress = true;
        errorDelay = ERROR_RETRY_MS;
        setProgress(res.data);
        // Keep going while copies are still being built; a finished job with nothing left needs no more polling.
        if (res.data.status !== "done" || res.data.remaining > 0) timer = setTimeout(tick, POLL_MS);
      } catch (err) {
        if (cancelled) return;
        // Never got an answer (403/404: not ours to see, or not a separate send): stay out of the way.
        if (!haveProgress) return setHidden(true);
        // Session expired, access removed, or the document is gone: asking again won't change that.
        // The last progress we had stays on screen. (api() puts the HTTP status on what it throws;
        // DocusignAuthExpiredError carries 401.)
        const status = (err as { status?: number } | null)?.status;
        if (status !== undefined && FINAL_ERROR_STATUSES.includes(status)) return;
        // A blip while watching: keep trying, backing off so a longer outage isn't polled every few seconds.
        timer = setTimeout(tick, errorDelay);
        errorDelay = Math.min(errorDelay * 2, MAX_ERROR_RETRY_MS);
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [documentId, pollRun]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const res = await retryProgress(documentId);
      setProgress(res.data);
      setPollRun((n) => n + 1);
      toast.success("Retrying the copies that failed");
    } catch (err: any) {
      toast.error(err.message || "Could not retry");
    } finally {
      setIsRetrying(false);
    }
  };

  if (hidden) return null;
  if (!progress) {
    return (
      <div className="mb-6 h-8 animate-pulse rounded bg-white/[0.04]" aria-label="Checking copies" />
    );
  }

  const { created, total, remaining, failed, failedItems, stalled } = progress;
  const pct = total ? Math.min(100, Math.round((created / total) * 100)) : 100;
  const working = remaining > 0;
  const allDone = !working && !failed;

  return (
    <div className="mb-6" data-testid="copies-progress">
      <h3 className="mb-3 text-sm font-semibold text-white/90">Separate copies</h3>
      <div className="space-y-2.5 rounded-md border border-[#2a2a35] bg-[#0c0c10] p-3">
        <div className="flex items-center justify-between gap-2 text-[13px] text-white/90">
          <span>
            {created} of {total} created
          </span>
          {working && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#7a7a90]" aria-label="Working" />}
          {allDone && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-label="Done" />}
        </div>

        <div
          className="h-1.5 overflow-hidden rounded-full bg-[#2f2f3a]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={created}
          aria-label="Copies created"
        >
          <div className={`h-full rounded-full transition-all ${failed ? "bg-amber-400" : "bg-brand"}`} style={{ width: `${pct}%` }} />
        </div>

        {working && !stalled && (
          <p className="text-xs text-[#7a7a90]">
            {remaining} still being created in the background. You can leave this page; it carries on. Invitations are emailed in waves, so people may
            receive theirs a few minutes apart.
          </p>
        )}
        {stalled && (
          <p className="text-xs text-amber-400">
            Paused because the server restarted. Keep this page open, or open this document again, and the remaining {remaining} will continue.
          </p>
        )}
        {allDone && (
          <p className="text-xs text-[#7a7a90]">
            All copies are created. Invitations are emailed in waves, so people may receive theirs a few minutes apart.
          </p>
        )}

        {failed > 0 && (
          <div className="space-y-2 rounded border border-amber-500/30 bg-amber-500/10 p-2.5">
            <p className="flex items-start gap-1.5 text-xs text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {failed} cop{failed === 1 ? "y" : "ies"} could not be created:{" "}
                {failedItems.slice(0, NAMED_FAILURES).map((f) => f.name || f.email).join(", ")}
                {failed > NAMED_FAILURES ? ` and ${failed - NAMED_FAILURES} more` : ""}.
                {failedItems[0]?.error ? ` ${failedItems[0].error}` : ""}
              </span>
            </p>
            <Button size="sm" variant="outline" onClick={handleRetry} disabled={isRetrying || working}>
              {isRetrying ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Retry failed
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

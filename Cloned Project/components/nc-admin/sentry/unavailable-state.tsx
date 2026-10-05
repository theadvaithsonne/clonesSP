import { AlertTriangle } from "lucide-react";

const MESSAGES: Record<string, { title: string; detail: string }> = {
  sentry_not_configured: {
    title: "Sentry isn't configured yet",
    detail:
      "Set SENTRY_API_TOKEN, SENTRY_ORG_SLUG and SENTRY_PROJECTS on the backend " +
      "(a read-scoped internal-integration token: event:read + project:read).",
  },
  sentry_auth: {
    title: "Sentry rejected the token",
    detail:
      "The configured SENTRY_API_TOKEN is invalid or lacks read scopes " +
      "(needs event:read + project:read).",
  },
  sentry_upstream: {
    title: "Sentry returned an error",
    detail: "The Sentry API responded with an error. Try again shortly.",
  },
  sentry_unreachable: {
    title: "Couldn't reach Sentry",
    detail: "The backend couldn't reach the Sentry API. Try again shortly.",
  },
};

export function UnavailableState({ reason }: { reason: string }) {
  const m = MESSAGES[reason] ?? {
    title: "Sentry is unavailable",
    detail: reason,
  };
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] px-6 py-10 text-center">
      <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-amber-400" />
      <div className="text-sm font-semibold text-white">{m.title}</div>
      <p className="mx-auto mt-1.5 max-w-md text-xs text-zinc-400">{m.detail}</p>
    </div>
  );
}

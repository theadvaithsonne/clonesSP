// MUST be imported before any other module (see src/index.ts line 1) so Sentry's
// HTTP / Express / Mongo auto-instrumentation is installed before those libs load.
// No-ops cleanly when SENTRY_DSN is unset, so it's safe to deploy dark.
import * as Sentry from "@sentry/node";
import { env } from "./config/env";

Sentry.init({
  dsn: env.SENTRY_DSN || undefined,
  enabled: Boolean(env.SENTRY_DSN),
  environment: env.SENTRY_ENV || env.NODE_ENV,
  // Include request body/query/headers + user on events.
  sendDefaultPii: true,
  tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  integrations: [
    // Report HANDLED errors too: most route catch blocks log via
    // console.error(..., err), so capturing console.error turns those into
    // Sentry issues without editing every catch. HTTP/Express auto-instrumentation
    // is preserved (this is added on top of the SDK defaults).
    Sentry.captureConsoleIntegration({ levels: ["error"] }),
  ],
  beforeSend: (event, hint) => {
    // `sendDefaultPii` attaches request bodies to events, which would ship
    // a typed admin verification answer to Sentry in plain text — where
    // anyone with Sentry access could read the very secret the hashing
    // exists to protect. Redact it before the event leaves the process.
    const reqData: any = (event.request as any)?.data;
    if (reqData && typeof reqData === "object" && "answer" in reqData) {
      (event.request as any).data = { ...reqData, answer: "[redacted]" };
    } else if (
      typeof reqData === "string" &&
      /\/garage-admin\/verify/.test(event.request?.url || "")
    ) {
      (event.request as any).data = "[redacted]";
    }

    const orig = hint?.originalException;
    // Only report console captures that carry a real Error — drop pure string
    // logs/warnings (deprecations, Mongoose notices) that have no exception.
    const fromConsole = event.logger === "console";
    if (fromConsole && !(orig instanceof Error) && !event.exception) return null;
    // Drop noisy Node/Mongoose process warnings that would otherwise bury real issues.
    const text = `${event.message ?? ""} ${orig instanceof Error ? `${orig.name}: ${orig.message}` : ""}`;
    if (/\(node:\d+\)\s*\[/.test(text) || /\[MONGOOSE\] Warning/i.test(text)) return null;
    return event;
  },
});

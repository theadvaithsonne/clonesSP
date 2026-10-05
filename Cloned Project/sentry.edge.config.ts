import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: true,
  // Errors unsampled; traces sampled. extraErrorData is Node-only, but
  // console-error capture works on the edge runtime too.
  tracesSampleRate: 0.1,
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
});

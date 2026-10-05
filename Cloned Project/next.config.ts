import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
  images: { unoptimized: true },
 reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Strip debug logging from production bundles. Beyond the noise, Sentry's
  // console breadcrumbs hold references to logged objects (whole boards).
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
};

// Wrap with Sentry for source-map upload + build instrumentation. org/project/
// authToken come from env (SENTRY_ORG=garage-71, SENTRY_PROJECT=<garage-web
// slug>, SENTRY_AUTH_TOKEN=<reused org token>). Upload is skipped when the auth
// token is absent, so builds without it still succeed.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
});

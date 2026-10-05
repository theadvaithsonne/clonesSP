// Uploads this build's source maps a SECOND time, to the admin console's own
// Sentry project.
//
// Why this exists: one bundle serves my.garage.app and admin.garage.app, but
// withSentryConfig() in next.config uploads to exactly one project
// (SENTRY_PROJECT). Once the console reports to its own project via
// NEXT_PUBLIC_SENTRY_DSN_ADMIN, its issues would arrive with minified frames —
// same JavaScript, same Debug IDs, just never uploaded to that project.
//
// Debug IDs are embedded in the bundles by the Sentry webpack plugin and travel
// in the maps, so re-uploading the identical artifacts to a second project
// resolves correctly. Nothing needs rebuilding.
//
// No-ops unless it is configured, so it is safe to leave wired into `build`
// whether or not the split is switched on.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const org = process.env.SENTRY_ORG;
const project = process.env.SENTRY_ADMIN_PROJECT;
const token = process.env.SENTRY_AUTH_TOKEN;

if (!project) {
  console.info(
    "[sentry] SENTRY_ADMIN_PROJECT unset — skipping the admin source-map upload.",
  );
  process.exit(0);
}
if (!org || !token) {
  // Loud, because at this point someone meant to split and half-configured it:
  // the console would report to its own project with unreadable stack traces.
  console.warn(
    `[sentry] SENTRY_ADMIN_PROJECT is set to "${project}" but ${
      !org ? "SENTRY_ORG" : "SENTRY_AUTH_TOKEN"
    } is missing — admin source maps were NOT uploaded, so that project's stack traces will stay minified.`,
  );
  process.exit(0);
}
if (!existsSync(".next")) {
  console.warn("[sentry] no .next directory — run this after the build.");
  process.exit(0);
}

// npm puts node_modules/.bin on PATH, but this is also runnable by hand — so
// prefer the local binary and only fall back to PATH.
const localCli = join(process.cwd(), "node_modules", ".bin", "sentry-cli");
const cli = existsSync(localCli) ? localCli : "sentry-cli";

const result = spawnSync(
  cli,
  ["sourcemaps", "upload", "--org", org, "--project", project, ".next"],
  { stdio: "inherit", env: process.env, shell: false },
);

// Deliberately non-fatal: a Sentry outage should not fail a deploy. The warning
// above plus sentry-cli's own output is enough to notice.
if (result.status !== 0) {
  console.warn(
    `[sentry] admin source-map upload exited ${result.status}; the build is unaffected.`,
  );
}

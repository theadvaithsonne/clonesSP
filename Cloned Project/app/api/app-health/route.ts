import { NextResponse } from "next/server";

/**
 * Link contract version.
 *
 * Bump this whenever a route that PUBLIC links point at is added or moved
 * (/webinar/[id], /checkout/workshop/[workshopId], /hq/[slug], …). The backend
 * refuses to mint share links on a domain whose deployment reports a contract
 * older than the minimum it requires, so a domain left on a stale deployment
 * can never be handed out again.
 *
 * 1 — /webinar/[id], /checkout/workshop/[workshopId], /guest/[slug], /hq/[slug]
 */
export const LINK_CONTRACT_VERSION = 1;

// Never prerender or cache: a cached body would report the deployment that
// built it rather than the one currently serving the domain.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Deployment liveness probe for white-label domains.
 *
 * A stale Next deployment does not 404 unknown paths — its own catch-all
 * ([orgSlug]/[channelId]) answers 200 with HTML. Status codes are therefore
 * worthless as a probe. Callers MUST match on this JSON body: `service` +
 * `ok` + `linkContract`. HTML back means the domain is on an old build.
 */
export async function GET() {
  return NextResponse.json(
    {
      service: "garage-web",
      ok: true,
      linkContract: LINK_CONTRACT_VERSION,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      env: process.env.VERCEL_ENV ?? null,
    },
    { headers: { "cache-control": "no-store" } }
  );
}

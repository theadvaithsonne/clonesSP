import { NextRequest, NextResponse } from "next/server";

/**
 * Reads a remote image through our own origin.
 *
 * Re-cropping an already-saved image needs its pixels on a canvas, and a canvas
 * is tainted the moment it draws a cross-origin image whose host didn't send
 * CORS headers — after which it can't be exported at all. Most upload hosts
 * don't send them (and a browser that already cached the image for an ordinary
 * `<img>` will replay that header-less copy even for a `crossOrigin` request),
 * so the crop dialog falls back to this route: same origin, so the canvas
 * stays clean and the image can be reframed instead of re-uploaded.
 */

export const runtime = "nodejs";
/** Proxied bytes are per-URL immutable in practice, but never worth caching wrong. */
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Our own backend, which serves uploads and is often on localhost in dev —
 * allowed through the private-host guard below, since the browser can reach it
 * directly anyway.
 */
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "").origin;
  } catch {
    return null;
  }
})();

/** Hosts that only ever resolve inside the deployment — never proxy to those. */
const PRIVATE_HOST = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /\.local$/i,
  /\.internal$/i,
];

function reject(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
  if (!target) return reject("Missing `url`", 400);

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return reject("`url` is not a valid absolute URL", 400);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return reject("Only http(s) URLs can be proxied", 400);
  }
  if (
    url.origin !== apiOrigin &&
    PRIVATE_HOST.some((pattern) => pattern.test(url.hostname))
  ) {
    return reject("That host can't be proxied", 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(url.toString(), {
      // No cookies or auth: this only ever fetches public image URLs.
      credentials: "omit",
      redirect: "follow",
      headers: {
        Accept: "image/*,*/*;q=0.8",
        // Some hosts (Wikimedia among them) reject a request with no agent.
        "User-Agent": "GarageImageProxy/1.0 (+https://garage.app)",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return reject("Couldn't reach that image", 502);
  }

  if (!upstream.ok) {
    return reject(
      `The image host returned ${upstream.status}`,
      upstream.status === 404 ? 404 : 502,
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return reject("That URL is not an image", 415);
  }

  const declaredLength = Number(upstream.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BYTES) return reject("That image is too large", 413);

  const bytes = await upstream.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) return reject("That image is too large", 413);

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

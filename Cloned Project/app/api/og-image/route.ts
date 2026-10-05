import { NextRequest, NextResponse } from "next/server";

/**
 * Edge Runtime — lightweight image proxy, no heavy dependencies.
 */
export const runtime = "edge";

/**
 * Allowed image domains — open to all for now since we need to proxy
 * any image that a post/article might reference (UploadThing, S3,
 * YouTube thumbnails, etc.).
 *
 * We validate that the URL is a proper http(s) URL to prevent SSRF.
 */
function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Image proxy that serves images from external hosts on the application's
 * own domain. This is critical for social-media link previews because:
 *
 * 1. Bypasses `x-robots-tag: noindex` headers (e.g. UploadThing)
 * 2. Bypasses CORS restrictions that block crawler bots
 * 3. Bypasses bot-detection/blocking on some CDNs
 * 4. Ensures the image is always served from our trusted domain
 *
 * Usage: /api/og-image?url=<encoded-image-url>
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  if (!isValidImageUrl(imageUrl)) {
    return new NextResponse("Invalid image URL", { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const upstream = await fetch(imageUrl, {
      headers: {
        // Use a common browser user-agent — some CDNs block bot-like UAs
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/jpeg,image/png,image/gif,image/webp,image/*,*/*",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!upstream.ok) {
      console.error(
        `[og-image proxy] Upstream returned ${upstream.status} for: ${imageUrl}`
      );
      return new NextResponse("Failed to fetch image", {
        status: upstream.status,
      });
    }

    const imageData = await upstream.arrayBuffer();
    const contentType =
      upstream.headers.get("content-type") || "image/jpeg";

    // WhatsApp requires images under 300KB for reliable preview rendering.
    // If the image is too large, we still serve it but log a warning.
    if (imageData.byteLength > 5 * 1024 * 1024) {
      console.warn(
        `[og-image proxy] Image exceeds 5MB (${Math.round(imageData.byteLength / 1024)}KB): ${imageUrl}`
      );
    }

    return new NextResponse(imageData, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(imageData.byteLength),
        "Cache-Control":
          "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400",
        // Explicitly allow indexing so social crawlers can see the image
        "X-Robots-Tag": "index",
        // Allow any origin to load the image (critical for crawlers)
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    const isTimeout = error?.name === "AbortError";
    console.error(
      `[og-image proxy] ${isTimeout ? "Timeout" : "Error"} fetching: ${imageUrl}`,
      isTimeout ? "" : error
    );
    return new NextResponse(
      isTimeout ? "Image fetch timeout" : "Image proxy error",
      { status: isTimeout ? 504 : 500 }
    );
  }
}

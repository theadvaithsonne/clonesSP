import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

/**
 * Generates a vertical (9:16) OG image for drop share links.
 * Renders thumbnail + dark overlay + centered play button.
 *
 * Usage: /api/drop-og-image?thumbnailUrl=<encoded>
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const thumbnailUrl = searchParams.get("thumbnailUrl");

  const width = 405;
  const height = 720;

  const response = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
          backgroundColor: "#000",
          overflow: "hidden",
        }}
      >
        {/* Background thumbnail */}
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(180deg, #1a1a2e 0%, #0a0a10 100%)",
            }}
          >
            <svg
              width="80"
              height="80"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FBD10D"
              strokeWidth="1.5"
            >
              <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14" />
              <rect x="3" y="6" width="12" height="12" rx="2" />
            </svg>
          </div>
        )}

        {/* Dark overlay for contrast */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.05) 70%, rgba(0,0,0,0.15) 100%)",
          }}
        />

        {/* Centered play button */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            border: "3px solid rgba(255, 255, 255, 0.35)",
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="white"
            style={{ marginLeft: 4 }}
          >
            <polygon points="5,3 19,12 5,21" />
          </svg>
        </div>
      </div>
    ),
    {
      width,
      height,
    }
  );

  response.headers.set(
    "Cache-Control",
    "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400"
  );

  return response;
}

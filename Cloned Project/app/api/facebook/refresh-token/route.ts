import { NextRequest, NextResponse } from "next/server";

const FACEBOOK_APP_ID = "1389133145656991";
const FACEBOOK_APP_SECRET =
  process.env.FACEBOOK_APP_SECRET || "a08238cce4c4cf6c6778026c6dd45808";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentToken } = body;

    if (!currentToken) {
      return NextResponse.json(
        { success: false, error: "currentToken is required" },
        { status: 400 }
      );
    }

    // Validate the current token is still alive before attempting refresh
    const debugRes = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${currentToken}&access_token=${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`
    );
    const debugData = await debugRes.json();

    if (debugData.data && !debugData.data.is_valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Token is no longer valid",
          reason: "invalid_token",
        },
        { status: 401 }
      );
    }

    // Exchange the current long-lived token for a fresh long-lived token
    const url = new URL("https://graph.facebook.com/v23.0/oauth/access_token");
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", FACEBOOK_APP_ID);
    url.searchParams.set("client_secret", FACEBOOK_APP_SECRET);
    url.searchParams.set("fb_exchange_token", currentToken);

    const fbResponse = await fetch(url.toString());
    const data = await fbResponse.json();

    if (!fbResponse.ok || data.error) {
      console.error("Facebook token refresh failed:", data.error);
      return NextResponse.json(
        {
          success: false,
          error: data.error?.message || "Token refresh failed",
          reason: data.error?.code === 190 ? "expired" : "refresh_failed",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
    });
  } catch (error) {
    console.error("Error in token refresh:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

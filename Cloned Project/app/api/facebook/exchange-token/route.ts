import { NextRequest, NextResponse } from "next/server";

const FACEBOOK_APP_ID = "1389133145656991";
const FACEBOOK_APP_SECRET =
  process.env.FACEBOOK_APP_SECRET || "a08238cce4c4cf6c6778026c6dd45808";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shortLivedToken } = body;

    if (!shortLivedToken) {
      return NextResponse.json(
        { success: false, error: "shortLivedToken is required" },
        { status: 400 }
      );
    }

    const url = new URL("https://graph.facebook.com/v23.0/oauth/access_token");
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", FACEBOOK_APP_ID);
    url.searchParams.set("client_secret", FACEBOOK_APP_SECRET);
    url.searchParams.set("fb_exchange_token", shortLivedToken);

    const fbResponse = await fetch(url.toString());
    const data = await fbResponse.json();

    if (!fbResponse.ok || data.error) {
      console.error("Facebook token exchange failed:", data.error);
      return NextResponse.json(
        {
          success: false,
          error: data.error?.message || "Token exchange failed",
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
    console.error("Error in token exchange:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

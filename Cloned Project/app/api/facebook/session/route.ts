import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const SESSION_COOKIE = "fb_leads_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 days

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE);

    if (!sessionCookie?.value) {
      return NextResponse.json(
        { success: false, error: "No session found" },
        { status: 401 }
      );
    }

    const session = JSON.parse(sessionCookie.value);
    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error("Error reading Facebook session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to read session" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionData } = body;

    if (!sessionData) {
      return NextResponse.json(
        { success: false, error: "sessionData is required" },
        { status: 400 }
      );
    }

    const serialized = JSON.stringify(sessionData);

    // Cookies have a 4KB limit; if payload is too large, store only essential fields
    const isOversize = serialized.length > 3800;
    const toStore = isOversize
      ? JSON.stringify({
          accessToken: sessionData.accessToken,
          tokenExpiresAt: sessionData.tokenExpiresAt,
          userInfo: sessionData.userInfo,
          selectedPage: sessionData.selectedPage
            ? {
                id: sessionData.selectedPage.id,
                name: sessionData.selectedPage.name,
                access_token: sessionData.selectedPage.access_token,
              }
            : null,
        })
      : serialized;

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, toStore, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving Facebook session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save session" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting Facebook session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete session" },
      { status: 500 }
    );
  }
}

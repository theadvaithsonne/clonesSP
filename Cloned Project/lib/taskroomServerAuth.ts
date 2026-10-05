// Server-only helpers for Next.js API routes that act on behalf of a Taskroom user.

export const TASKROOM_API_BASE =
  (process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/").replace(/\/+$/, "") + "/";

/** The caller's `garage_tok`, taken from `Authorization: Bearer <token>`. */
export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") || "";
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return token || null;
}

/**
 * Resolves the caller's Taskroom profile, or null when the token is missing or
 * rejected. Routes that spend money (OpenAI) must not be callable anonymously.
 */
export async function verifyTaskroomUser(req: Request): Promise<{ _id: string } | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    const res = await fetch(`${TASKROOM_API_BASE}users/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    return json?.status && json?.data?._id ? json.data : null;
  } catch {
    return null;
  }
}

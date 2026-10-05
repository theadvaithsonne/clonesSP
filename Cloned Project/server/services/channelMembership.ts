import { ChannelMembership } from "../models/channelMembership.model";

/**
 * Resolves the set of channel IDs a user is currently a member of within a
 * given organization. Used by product, service, and course discovery routes
 * to gate items whose `channelIds` restrict visibility to members of specific
 * channels.
 *
 * Previously duplicated in routes/product.ts and routes/service.ts — extracted
 * here so course.ts (and any future item type) can share both the query shape
 * and the in-process cache without diverging.
 *
 * The cache is a 5-minute TTL keyed by `${userId}:${orgId}` — good enough for
 * discovery/list requests where staleness within a few minutes of joining a
 * channel is acceptable. Single-item access checks that need real-time
 * freshness can call `.delete()` on the exported cache directly after a
 * membership mutation if it becomes a problem.
 */
const _channelIdCache = new Map<
  string,
  { ids: string[]; expiresAt: number }
>();
const TTL_MS = 5 * 60 * 1000;

export async function getUserChannelIds(
  userId: string,
  orgId: string,
): Promise<string[]> {
  const key = `${userId}:${orgId}`;
  const cached = _channelIdCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.ids;

  const memberships = await ChannelMembership.find({
    userId,
    organizationId: orgId,
  })
    .select("channelId")
    .lean();

  const ids = memberships.map((m) => m.channelId.toString());
  _channelIdCache.set(key, { ids, expiresAt: Date.now() + TTL_MS });
  return ids;
}

/**
 * Invalidate the cached channel list for a specific (user, org) pair.
 * Call this after mutating ChannelMembership (join / leave / status change)
 * so subsequent list requests reflect the change immediately instead of
 * waiting for the 5-min TTL.
 */
export function invalidateUserChannelIds(userId: string, orgId: string): void {
  _channelIdCache.delete(`${userId}:${orgId}`);
}

import { Types } from "mongoose";
import { WorkshopSessionOverride } from "../models/workshopSessionOverride.model";
import type { PinnedProductSnapshot } from "./mediasoup";

/**
 * The parts of a live room that must outlive the process.
 *
 * `rooms` (services/mediasoup.ts) is an in-memory map, and until now everything
 * a host did DURING a session lived only there: who they made co-host, what
 * they pinned, who they removed. A deploy, a crash, or the room simply emptying
 * for a moment rebuilt it from nothing — the co-host's next re-join landed them
 * back at attendee while LiveKit still had them publishing, and the pin was
 * gone from every late joiner's ack.
 *
 * Written through on every change (realtime/mediasoupHandlers.ts →
 * persistLiveState) and read back once, when a room object is created. It
 * lives on the session's override row — the same row that holds the host
 * seat — so it is scoped to one session and cleared with it.
 */
export interface WebinarLiveState {
  /** userId → granted role, i.e. WebinarRoom.elevatedRoles. */
  elevatedRoles?: Record<string, "host" | "panelist">;
  pinnedProduct?: PinnedProductSnapshot | null;
  /** Users a host removed; refused on re-join for the rest of the session. */
  bannedUserIds?: string[];
}

export interface LiveStateKey {
  workshopId: string;
  /** The session's UTC-midnight anchor — see webinarHost#resolveSessionAnchor. */
  sessionDate: Date;
}

function rowFilter(key: LiveStateKey) {
  return {
    workshopId: new Types.ObjectId(key.workshopId),
    sessionDate: key.sessionDate,
  };
}

export async function loadLiveState(
  key: LiveStateKey
): Promise<WebinarLiveState | null> {
  const row = await WorkshopSessionOverride.findOne(rowFilter(key))
    .select("liveState")
    .lean();
  return ((row as any)?.liveState as WebinarLiveState | undefined) ?? null;
}

/**
 * Merge a partial state in. Dotted paths on purpose: a nested `$set` on the
 * whole `liveState` object would replace it, wiping whichever field this call
 * did not mention.
 */
export async function saveLiveState(
  key: LiveStateKey,
  patch: WebinarLiveState
): Promise<void> {
  const $set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) $set[`liveState.${k}`] = v;
  }
  if (!Object.keys($set).length) return;
  try {
    await WorkshopSessionOverride.updateOne(rowFilter(key), { $set }, { upsert: true });
  } catch (err) {
    // Two writers upserting the same brand-new row trip the unique
    // (workshopId, sessionDate) index; the row exists now, so just update it.
    if ((err as { code?: number })?.code !== 11000) throw err;
    await WorkshopSessionOverride.updateOne(rowFilter(key), { $set });
  }
}

export async function clearLiveState(key: LiveStateKey): Promise<void> {
  await WorkshopSessionOverride.updateOne(rowFilter(key), {
    $unset: { liveState: "" },
  });
}

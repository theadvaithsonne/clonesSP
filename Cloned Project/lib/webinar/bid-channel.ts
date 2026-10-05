/**
 * Auction fan-out for a webinar room — how "this lot changed" reaches everyone.
 *
 * Wire-identical to the store app's `nc:bid` topic (garage-store-app
 * lib/nc-bid-channel.ts) on purpose: a bid placed from the phone app moves the
 * price in this room, and vice versa.
 *
 * The packet carries NO auction state. The Garage Store backend is the arbiter
 * — it orders bids atomically, applies anti-snipe in the same write, and settles
 * on a cron — so every number comes from REST and this channel only ever says
 * "lot X changed, go read it". Same REST-is-truth / channel-is-notify split the
 * chat and pin flows use.
 *
 * Three transports carry that one sentence, because each covers the others'
 * blind spot:
 *   - LiveKit data channel — sub-100ms, but only reaches participants whose
 *     media transport is up at publish time
 *   - the room socket — survives a media reconnect, and reaches anyone watching
 *     without having joined the LiveKit room yet
 *   - a local window event — the sender's own hooks, which neither of the above
 *     loops back to
 */

import type { Room } from "livekit-client";
import type { Socket } from "socket.io-client";

/** LiveKit data-channel topic. Shared with the store/NetworkChain rooms. */
export const NC_BID_TOPIC = "nc:bid";

/** Window event every transport funnels into — what useLiveLot listens on. */
export const AUCTION_PING_EVENT = "webinar:auction-ping";

/** Socket event, relayed by the room server to everyone but the sender. */
export const AUCTION_PING_SOCKET_EVENT = "webinar:auctionPing";

/**
 * Announce over the LiveKit data channel. `null` retires the current lot.
 * Best-effort: a room that isn't connected yet simply has nothing to publish
 * to, and the socket leg below still gets the word out.
 */
export async function publishBidPing(
  room: Room | null | undefined,
  productId: string | null
): Promise<void> {
  if (!room?.localParticipant) return;
  const payload = new TextEncoder().encode(
    JSON.stringify({ type: NC_BID_TOPIC, productId })
  );
  try {
    await room.localParticipant.publishData(payload, {
      reliable: true,
      topic: NC_BID_TOPIC,
    });
  } catch {
    /* the socket leg and the 3s poll both still cover this */
  }
}

/** Refetch now, on this client. Neither remote transport echoes to the sender,
 *  so without this the person who acted is the last to see the result. */
export function dispatchLocalPing(productId: string | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(AUCTION_PING_EVENT, { detail: { productId } })
  );
}

/**
 * Tell the whole room a lot changed — after a bid, after a round opens, after
 * a cancel. Fires every transport; each one is independently best-effort.
 */
export function announceLotChange({
  productId,
  room,
  socket,
  webinarId,
}: {
  productId: string | null;
  room?: Room | null;
  socket?: Socket | null;
  webinarId?: string;
}): void {
  publishBidPing(room, productId);
  if (socket && webinarId) {
    socket.emit(AUCTION_PING_SOCKET_EVENT, { webinarId, productId });
  }
  dispatchLocalPing(productId);
}

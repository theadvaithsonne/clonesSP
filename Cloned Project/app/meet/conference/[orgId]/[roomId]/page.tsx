import { Metadata } from "next";
import ConferenceCallStandalone from "./ConferenceCallStandalone";

// Force dynamic rendering — the conference page joins LiveKit on mount
// and depends entirely on the live session. Static caching would either
// leak stale presence or block the call from connecting.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Conference Room",
};

// Full-page (chrome-less) conference call URL.
//
// This route sits under app/meet/* which already has its own minimal
// layout (no dashboard sidebar, no popover stack) — so the experience
// is full-viewport like NetworkChain's /meet/room/[roomId] and the
// existing /meet/join. Shareable: anyone with the URL who has access
// to the org can land here directly and join the call.
//
// URL shape:  /meet/conference/<orgId>/<roomId>
//   - orgId  → the organization the conference room belongs to
//   - roomId → ConferenceRoom._id (multi-room support, see
//              src/models/conferenceRoom.model.ts on garagenew-backend)
//
// Spaces map: the LiveKit + presence layer keys off
// `hq-room:<orgId>:<roomId>` (the synthetic spaceId convention added
// when multi-conference shipped). Both shapes — legacy
// `hq-room:<orgId>` and named `hq-room:<orgId>:<roomId>` — are
// already understood by the realtime socket handler.
export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string; roomId: string }>;
}) {
  const { orgId, roomId } = await params;
  return <ConferenceCallStandalone orgId={orgId} roomId={roomId} />;
}

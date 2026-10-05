# OfficeStream Live Preview — NetworkStatsCard

Live webinar preview embedded directly in the **Business Network** card on the OfficeStream page. When a webinar is live in the user's organization, the right-side network graph is replaced by a real-time video + audio preview.

---

## Where It Lives

```
app/(dashboard)/workspace/components/NetworkStatsCard.tsx
```

The card is rendered as part of the OfficeStream sidebar/workspace view and receives `orgId` as its only prop.

---

## What It Does

- Detects when a webinar is live in the user's organization (via polling + socket events)
- Replaces the decorative network graph with a live video preview
- Streams both video and audio from the LiveKit room the host is in
- Shows LIVE badge, mute/unmute button, dismiss (×) button
- Clicking the preview opens the full webinar in a new tab **as a pre-guest** (`?role=pre-guest`)

---

## Key Components

### `CardLivePreview` (internal)

A self-contained component that connects to the LiveKit room as a silent audience member.

**Props**

| Prop | Type | Description |
|------|------|-------------|
| `workshopId` | `string` | ID of the live workshop |
| `muted` | `boolean` | Whether audio output is muted |

**How it works**

1. Calls `POST /workshop-preview/audience-token` with the `workshopId`.
2. Creates a `livekit-client` `Room` with `adaptiveStream` and `dynacast` enabled.
3. Subscribes to `TrackSubscribed`, `TrackUnsubscribed`, `ParticipantDisconnected` events.
4. On each event, scans `room.remoteParticipants` and picks:
   - **Video**: screen share track first, camera track as fallback
   - **Audio**: microphone track + screen-share audio track (both collected)
5. Sets `videoRef.srcObject` and `audioRef.srcObject` directly.
6. The `<audio>` element has the `muted` JSX attribute so browsers allow autoplay from the start (browser autoplay policy blocks unmuted audio without a user gesture). Toggling `audioRef.current.muted` in a `useEffect` is all that's needed to unmute — no `.play()` call required.
7. On unmount (or `workshopId` change), disconnects the LiveKit room.

```tsx
function CardLivePreview({ workshopId, muted }: { workshopId: string; muted: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const roomRef = useRef<Room | null>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function connect() {
      const res = await fetch(`${API_URL}/workshop-preview/audience-token`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workshopId }),
      });
      const data = await res.json();
      if (!data.success || cancelled) return;

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      const update = () => {
        let vTrack: MediaStreamTrack | null = null;
        const aTracks: MediaStreamTrack[] = [];
        room.remoteParticipants.forEach((p) => {
          if (!vTrack) {
            const s = p.getTrackPublication(Track.Source.ScreenShare)?.track?.mediaStreamTrack;
            const c = p.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack;
            vTrack = s || c || null;
          }
          const mic = p.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack;
          const sa  = p.getTrackPublication(Track.Source.ScreenShareAudio)?.track?.mediaStreamTrack;
          if (mic) aTracks.push(mic);
          if (sa)  aTracks.push(sa);
        });
        if (videoRef.current) videoRef.current.srcObject = vTrack ? new MediaStream([vTrack]) : null;
        setHasVideo(!!vTrack);
        if (audioRef.current) audioRef.current.srcObject = aTracks.length ? new MediaStream(aTracks) : null;
      };

      room.on(RoomEvent.TrackSubscribed,       update);
      room.on(RoomEvent.TrackUnsubscribed,     update);
      room.on(RoomEvent.ParticipantDisconnected, update);
      await room.connect(data.serverUrl, data.token);
      if (!cancelled) update();
    }
    connect();
    return () => {
      cancelled = true;
      roomRef.current?.disconnect(true);
      roomRef.current = null;
    };
  }, [workshopId]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  return (
    <>
      <video ref={videoRef} autoPlay muted playsInline
        className={`absolute inset-0 w-full h-full object-cover ${hasVideo ? "block" : "hidden"}`}
      />
      <audio ref={audioRef} autoPlay muted />
    </>
  );
}
```

---

### `NetworkStatsCard` — live state management

```tsx
const { webinar, markJoined } = useWebinarLivePreview();
const [cardDismissed, setCardDismissed] = useState(false);
useEffect(() => { setCardDismissed(false); }, [webinar?.workshopId]);
const isLive = !!webinar && !cardDismissed;
const [isMuted, setIsMuted] = useState(true);
```

**`shouldShow` is intentionally NOT used here.**  
The hook's `shouldShow` hides the preview for the webinar host. The card should show for everyone (including the host), so visibility is controlled locally with `isLive = !!webinar && !cardDismissed`.

When the webinar ends and a new one starts, `webinar.workshopId` changes and `cardDismissed` resets automatically.

---

## Rendering — live vs static

```tsx
{isLive ? (
  <div className="relative w-full h-full bg-black group">
    <CardLivePreview workshopId={webinar.workshopId} muted={isMuted} />

    {/* z-[11]: join-click layer — catches clicks on the video area */}
    <div className="absolute inset-0 z-[11] cursor-pointer"
      onClick={() => {
        // Opens as pre-guest so host sees the viewer in the participant list
        window.open(`/webinar/${webinar.workshopId}?role=pre-guest`, "_blank", "noopener,noreferrer");
        markJoined(webinar.workshopId);
      }}
    />

    {/* z-[11] pointer-events-none: hover hint overlay */}
    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 ... z-[11] pointer-events-none">
      <ExternalLink /> <span>Join</span>
    </div>

    {/* z-[12]: controls sit above the join layer */}
    {/* LIVE badge */}
    <div className="absolute top-1.5 left-1.5 ... z-[12]">
      <Radio className="animate-pulse" /> LIVE
    </div>
    {/* Dismiss */}
    <button onClick={() => setCardDismissed(true)} className="... z-[12]">
      <X />
    </button>
    {/* Mute toggle */}
    <button onClick={() => setIsMuted(m => !m)} className="... z-[12]">
      {isMuted ? <VolumeX /> : <Volume2 />}
    </button>
  </div>
) : (
  <NetworkGraph color={c} />
)}
```

**Z-index layering:**

| Layer | z-index | Purpose |
|-------|---------|---------|
| `<video>` / `<audio>` | — | Media elements (no z-index needed) |
| Join click div | 11 | Catches clicks on video to open webinar |
| Hover hint overlay | 11 | `pointer-events-none` — visual only |
| LIVE badge, ×, mute | 12 | Interactive controls, above click layer |

---

## Data Flow

```
useWebinarLivePreview hook
  ├── polls GET /workshop-preview/live?orgId=... every 30 s
  ├── listens for socket events: workshop:preview:live / workshop:preview:ended
  └── returns { webinar, markJoined }

NetworkStatsCard
  ├── isLive = !!webinar && !cardDismissed
  └── renders CardLivePreview when isLive

CardLivePreview
  ├── POST /workshop-preview/audience-token  →  { token, serverUrl }
  ├── livekit Room.connect(serverUrl, token)
  ├── subscribes to remote tracks
  └── sets srcObject on <video> and <audio> refs
```

---

## Backend Endpoints

### `GET /workshop-preview/live?orgId=`

Returns the most recently started live workshop for an org. Calls `getWebinarViewerCount` against the LiveKit server for a real-time count.

**Viewer count logic (`getWebinarViewerCount` in `src/services/livekit.ts`):**
- Queries `RoomServiceClient.listParticipants(roomName)`
- Excludes: the host (matched by `hostUserId = workshop.createdBy._id`)
- Excludes: preview-card audience viewers (`identity.startsWith("audience-")`)
- Counts: all actual webinar participants (attendees, panelists, pre-guests who opened the webinar page)

LiveKit state lives on the LiveKit server (separate process), so viewer counts survive backend restarts. Count = 0 is correct when only the host is in the room and no attendees have opened the webinar page yet.

### `POST /workshop-preview/audience-token`

Validates that the workshop exists, is active, and its meeting is `status: "live"`, then generates a LiveKit token using `audience-${Date.now()}` as identity with publish disabled (`canPublish: false`).

Returns:
```json
{
  "success": true,
  "token": "<livekit-jwt>",
  "serverUrl": "wss://...",
  "roomName": "..."
}
```

The room name uses the same formula as the host: `toLivekitRoomName("webinar-{workshopId}")`.

---

## Pre-Guest Flow

When a user clicks the preview card:
1. `window.open('/webinar/{workshopId}?role=pre-guest', '_blank')` opens the webinar page
2. Webinar page emits `webinar:joinRoom` with `role: "pre-guest"` via socket
3. Server sets `verifiedRole = "pre-guest"`, adds peer to mediasoup room
4. Existing participants receive `webinar:peerJoined` with `role: "pre-guest"` → yellow badge in participant list
5. Webinar page calls `POST /webinar/:workshopId/livekit-token` → `identity = userId`, `canPublish: false`
6. User joins LiveKit room as subscriber → counted in `getWebinarViewerCount`

If the same user later re-joins with a different role (e.g., attendee after re-opening the page), the server kicks the stale pre-guest socket so there are no duplicate entries in the participant list.

---

## Why These Design Choices

| Decision | Reason |
|----------|--------|
| Bypass `shouldShow` from hook | Hook hides preview for the host; card should show for everyone |
| Local `cardDismissed` state | Scoped to this card only; resets when a new webinar starts |
| `<audio muted>` attribute | Browser autoplay policy — muted elements autoplay freely; toggling `.muted` ref unmutes without re-calling `.play()` |
| Collect all audio tracks into one `MediaStream` | Host may publish both mic and screen-share audio simultaneously |
| Screen share video preferred over camera | Screen share is the primary content in most webinars |
| `cancelled` flag in connect effect | Prevents state updates after the component unmounts or `workshopId` changes mid-fetch |
| `?role=pre-guest` on join click | Makes viewer visible in host's participant list with yellow badge |
| LiveKit-based viewer count (not mediasoup) | mediasoup `rooms` Map is in-memory, resets on backend restart; LiveKit server state persists independently |
| `dist/` excluded from git via `.gitignore` | Compiled JS output should not be versioned; only `src/` TypeScript source is tracked |

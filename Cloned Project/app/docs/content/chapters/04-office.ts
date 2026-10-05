import type { Chapter } from "../types";

export const office: Chapter = {
  slug: "office",
  number: 4,
  title: "The virtual office",
  part: "The office",
  blurb:
    "Where everyone is standing, how you walk up and knock, and what happens to the call when they say yes.",
  blocks: [
    {
      type: "prose",
      text: [
        "`/workspace` is the room you sit in all day. It is one client component, loaded without server rendering because almost everything in it depends on the browser's media devices, and it holds the whole office in state: who is here, which space each person is in, what they are sharing, and which calls are live.",
      ],
    },
    { type: "heading", id: "spaces", text: "Spaces" },
    {
      type: "prose",
      text: [
        "Every person has a `spaceId`, and that one field decides what you see of them. The lobby is where you arrive. A floor is where your team stands. A meeting room is a space you walk into. A call is a space too.",
        "Moving is an announcement, not a navigation: the client emits `workspace:move-to-space` and everyone's roster updates. There is no page load and no URL change.",
      ],
    },
    {
      type: "flow",
      flow: {
        title: "Joining the office",
        summary: "What happens between opening /workspace and appearing on someone else's screen.",
        steps: [
          { label: "Acquire camera and microphone", actor: "useLocalMedia", kind: "start", detail: "Failing here is not fatal — you join without media." },
          { label: "Connect the socket", actor: "lib/socket.ts", detail: "A singleton per tab, carrying the JWT." },
          { label: "Announce arrival", actor: "workspace:join" },
          { label: "Receive the roster", actor: "workspace:users", kind: "wait", detail: "Everyone currently in the org, with their space and state." },
          { label: "Confirm", actor: "workspace:join-confirmed" },
          { label: "Open peer connections to your space", actor: "useWebRTC", detail: "Offer/answer and ICE over `workspace:signal`." },
          { label: "You are in the lobby", kind: "end" },
        ],
      },
    },
    {
      type: "note",
      tone: "info",
      title: "Staying in sync",
      text: "`workspace:heartbeat` / `workspace:heartbeat-ack` keep liveness honest, and `workspace:request-sync` → `workspace:full-sync` repairs a roster that has drifted — after a laptop wakes from sleep, for instance. `workspace:presence-sync` and `workspace:check-presence` cover the narrower case of one user's state looking wrong.",
    },
    { type: "heading", id: "presence", text: "Presence and status" },
    {
      type: "prose",
      text: [
        "Peer cards show who is here, what space they are in, whether they are sharing a screen or recording, and — from `/users/last-seen` — when they were last active, rendered as *Active 3m ago*.",
        "Five status values exist. Four are yours to pick: **available**, **busy**, **afk**, **offline**. The fifth, **mobile**, is synthesised by the server when someone has a registered push token but no live socket; they show a phone icon and can still be knocked.",
      ],
    },
    {
      type: "note",
      tone: "limit",
      title: "The status dropdown is currently local only",
      text: "`useStatus` no longer broadcasts `workspace:status-change`. The green-dot online indicator was retired, no component listens for `workspace:user-status-changed`, and the backend tolerates the event without acting on it. The picker still works as a personal preference — other people do not see it. Re-adding the broadcast is the starting point for a \"busy means don't ring me\" feature.",
    },
    { type: "heading", id: "knocking", text: "Knocking" },
    {
      type: "prose",
      text: [
        "Knocking is how a one-to-one call starts. You click someone's card; they get a prompt; if they accept, both of you are dropped into a LiveKit room. Nobody sends a link.",
      ],
    },
    {
      type: "sequence",
      sequence: {
        title: "Knock to call",
        summary: "Both ends are told separately, and the backend mints a token for each.",
        actors: ["Knocker", "Backend", "Recipient", "LiveKit"],
        messages: [
          { phase: "The knock", from: 0, to: 1, label: "workspace:knock { targetId }" },
          { from: 1, to: 2, label: "workspace:knock-request", dashed: true },
          { from: 2, to: 1, label: "workspace:knock-accept" },
          { phase: "Setting up the room", from: 1, to: 2, label: "livekit:init-call { url, token }", dashed: true },
          { from: 1, to: 0, label: "livekit:join-call { url, token }", dashed: true },
          { from: 2, to: 3, label: "connect + publish tracks" },
          { from: 0, to: 3, label: "connect + publish tracks" },
          { phase: "In the call", from: 3, to: 0, label: "TrackSubscribed", dashed: true },
          { from: 3, to: 2, label: "TrackSubscribed", dashed: true },
        ],
      },
    },
    {
      type: "prose",
      text: [
        "The other outcomes are events too. `workspace:knock-decline` sends a decline; `workspace:knock-cancel` withdraws a knock that has not been answered; `workspace:knock-unreachable` comes back when the target has no way to be reached; and `workspace:knock-handled` tells the other devices of a multi-device user to stop ringing once one of them answers.",
      ],
    },
    {
      type: "note",
      tone: "info",
      title: "Ring everywhere, answer once",
      text: "A knock reaches every device the recipient has — browser tabs and the mobile app. `livekit:call-answered-elsewhere` is what stops the rest from ringing after one of them picks up.",
    },
    {
      type: "events",
      caption: "Knock events",
      items: [
        { name: "workspace:knock", dir: "out", note: "Start knocking someone." },
        { name: "workspace:knock-cancel", dir: "out", note: "Withdraw an unanswered knock." },
        { name: "workspace:knock-accept", dir: "out", note: "Accept. The backend then sets up the room." },
        { name: "workspace:knock-decline", dir: "out", note: "Decline." },
        { name: "workspace:knock-request", dir: "in", note: "Someone is knocking on you." },
        { name: "workspace:knock-accepted", dir: "in", note: "Your knock was accepted." },
        { name: "workspace:knock-declined", dir: "in", note: "Your knock was declined." },
        { name: "workspace:knock-cancelled", dir: "in", note: "The knocker gave up." },
        { name: "workspace:knock-unreachable", dir: "in", note: "No device could be reached." },
        { name: "workspace:knock-handled", dir: "in", note: "Another of your devices answered — stop ringing." },
        { name: "workspace:pending-knock", dir: "in", note: "A knock that arrived while you were away." },
        { name: "workspace:knock-user", dir: "out", note: "Knock a specific user outside the floor roster." },
      ],
    },
    { type: "heading", id: "calls", text: "Calls" },
    {
      type: "prose",
      text: [
        "Every call in the workspace runs on LiveKit through `useLiveKit`, whether it is a two-person knock call or a full meeting room. The hook is socket-driven: it waits for `livekit:init-call` (you are the host) or `livekit:join-call` (you are joining), then connects imperatively with the `Room` class.",
      ],
    },
    {
      type: "spec",
      items: [
        { term: "Controls", def: "`toggleMicrophone()`, `toggleCamera()`, `toggleScreenShare()`. These are LiveKit track operations and are entirely separate from the workspace's peer-to-peer presence tracks." },
        { term: "Chat", def: "Sent over LiveKit's data channel with `publishData()`, received on `RoomEvent.DataReceived`. No server round trip." },
        { term: "Recording", def: "Server-side, through LiveKit's Egress API — `POST /livekit/recording/start` and `/stop`." },
        { term: "Participants", def: "`livekit:participants-update` keeps the roster outside the call honest about who is inside it." },
        { term: "Leaving", def: "`livekit:leave-call`, plus automatic teardown when the component unmounts." },
        { term: "Failure", def: "`livekit:join-error` surfaces a join that could not complete, rather than leaving a spinner running." },
      ],
    },
    {
      type: "note",
      tone: "warn",
      title: "Two call systems, one screen",
      text: "Mute and camera buttons during a LiveKit call must call the LiveKit controls, not the workspace's peer-to-peer `toggleTrack()`. They look identical on screen and target different tracks; wiring one to the other produces a button that appears to do nothing.",
    },
    { type: "heading", id: "screen-share", text: "Screen sharing" },
    {
      type: "prose",
      text: [
        "Presence video carries a single video track per peer, so sharing a screen replaces the camera rather than adding to it. The camera track is held in a ref, the screen track is swapped in with `sender.replaceTrack()`, every peer renegotiates, and on exit the camera comes back from the ref.",
        "State is broadcast with `workspace:screen-share-state` so other people's cards show the share before they click into it. `getPreferredScreenTrack()` picks the best track when a browser offers several, and a shared screen can be popped out into picture-in-picture.",
      ],
    },
    { type: "heading", id: "recording", text: "Recording a work session" },
    {
      type: "prose",
      text: [
        "This is separate from call recording. It captures what *you* are doing — your screen plus the voices of everyone in your space — and then hands the result to the AI for analysis.",
      ],
    },
    {
      type: "flow",
      flow: {
        title: "Session recording",
        steps: [
          { label: "Pick a screen to capture", actor: "getDisplayMedia()", kind: "start" },
          { label: "Mix the audio", actor: "Web Audio API", detail: "Your microphone, every peer in your space, and the display stream's own audio if it has any." },
          { label: "Record", actor: "MediaRecorder", detail: "Chunks are mirrored into IndexedDB as they arrive, so a crash does not lose the session." },
          { label: "Tell the office", actor: "workspace:recording-state", detail: "Peer cards show a recording indicator." },
          { label: "Stop and upload", actor: "POST /cabinet/files/upload" },
          { label: "Ask Cabinet analyses it", actor: "generateAskCabinetPrompt()", kind: "end", detail: "Tasks completed, where time went, and which AI tools would have helped." },
        ],
      },
    },
    {
      type: "note",
      tone: "limit",
      title: "Browser support varies",
      text: "MediaRecorder's available container and codec combinations differ by browser; the hook picks from a supported-MIME list. Screen capture and recording both need a user gesture and a permission grant, which is why neither can be tested automatically.",
    },
    { type: "heading", id: "rooms", text: "Meeting rooms and bookings" },
    {
      type: "prose",
      text: [
        "`FloorMeetingRoomCard` and `HqMeetingRoomCard` render rooms from outside: who is in them, and whether anything is scheduled. Booking a room through `HqRoomBookingModal` creates a record with invitees and a time window, shown on `HqRoomSchedule`. `workspace:end-meeting` closes a room down for everyone in it.",
      ],
    },
    { type: "heading", id: "office-stream", text: "The office stream" },
    {
      type: "prose",
      text: [
        "`OfficeStreamSection` and the community stream components put an ambient live layer over the office — a broadcast anyone in the org can drop into. It has a proximity audio model (`useProximityAudio`) where voices get louder as avatars move closer, and it can run on either LiveKit or Daily depending on the transport chosen for the stream.",
        "`WorkshopPreviewCard` does something similar for workshops: a live look inside a session that has not been joined yet, expandable to full screen.",
      ],
    },
    { type: "heading", id: "reliability", text: "When the connection breaks" },
    {
      type: "spec",
      items: [
        { term: "ICE restart", def: "Attempted first when a peer connection fails, before tearing anything down." },
        { term: "Exponential backoff", def: "Reconnection at 1s, 2s, 4s, 8s, 16s, up to five attempts." },
        { term: "Pending ICE queue", def: "Candidates that arrive mid-renegotiation are held and applied after, rather than dropped." },
        { term: "Candidate batching", def: "ICE candidates are collected in 100ms windows before sending — roughly a hundredfold reduction in signalling messages." },
        { term: "`DisconnectedOverlay`", def: "Covers the office when the socket is gone, so a stale roster is never mistaken for an empty one." },
        { term: "`useConnectionHealth`", def: "Tracks connection quality; `NetworkStatsCard` surfaces it." },
      ],
    },
    {
      type: "events",
      caption: "Workspace presence events",
      items: [
        { name: "workspace:join / :leave", dir: "out", note: "Enter and exit the office." },
        { name: "workspace:rejoin", dir: "out", note: "Re-announce after a reconnect." },
        { name: "workspace:move-to-space", dir: "out", note: "Change which space you are standing in." },
        { name: "workspace:join-space", dir: "out", note: "Enter a specific room." },
        { name: "workspace:signal", dir: "both", note: "WebRTC offer, answer and ICE for presence video." },
        { name: "workspace:users", dir: "in", note: "The full roster on join." },
        { name: "workspace:user-joined / :user-left", dir: "in", note: "Someone arrived or left." },
        { name: "workspace:user-moved-space", dir: "in", note: "Someone changed space." },
        { name: "workspace:user-recording-changed", dir: "in", note: "Someone started or stopped recording." },
        { name: "workspace:screen-share-state", dir: "both", note: "Screen sharing started or stopped." },
        { name: "workspace:recording-state", dir: "out", note: "Broadcast your own recording state." },
        { name: "workspace:set-breadcrumbs / :breadcrumb-click", dir: "both", note: "Shared navigation trail within the office." },
        { name: "workspace:todo-notification", dir: "in", note: "A task was assigned to you." },
      ],
    },
  ],
};

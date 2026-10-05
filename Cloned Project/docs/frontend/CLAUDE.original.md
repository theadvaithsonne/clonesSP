#  CLAUDE.md

This file provides  guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project  Overview       
  

Garage 2.0  is a Next.js-based virtual office platform that combines LiveKit video calling, WebRTC peer-to-peer communications, and Socket.IO  real-time  signaling to create an immersive remote workspace experience.

## Common Development Commands

### Development
 
```bash
npm run dev          #Start development server with Turbopack
```

### Build & Production
```bash
npm run build        # Production build with Turbopack
npm start            # Start production server
```

### Linting
```bash
npm run lint         # Run ESLint
```

### Notes
- TypeScript errors are ignored during build (configured in `next.config.ts`)
- ESLint errors are ignored during build
- Images are unoptimized (configured for static export compatibility)

## Architecture Overview

### Core Communication Stack

The application uses a **hybrid communication architecture** with three layers:

1. **LiveKit** - Primary video calling solution for all call types
   - Used for 1-on-1 knock calls, floor/meeting room group calls, meet/conference pages, guest events, workshop previews, and community streams
   - Server: `wss://lk.garage.app` (env: `NEXT_PUBLIC_LIVEKIT_URL`)
   - Backend generates JWT tokens via `livekit-server-sdk` (`AccessToken` + `VideoGrant`)
   - Frontend uses imperative `Room` class from `livekit-client` for workspace calls (socket-driven join)
   - Frontend uses `<LiveKitRoom>` component wrapper for meet pages (REST-driven join)
   - Socket events: `livekit:init-call`, `livekit:join-call`, `livekit:leave-call`, `livekit:participants-update`
   - Recording via LiveKit Egress API (backend endpoints: `POST /livekit/recording/start|stop`)
   - Chat via DataChannel (`publishData()` / `RoomEvent.DataReceived`)

2. **WebRTC (Peer-to-peer)** - For floor-level presence and multi-peer connections
   - Manages concurrent peer connections for same-space participants
   - Uses STUN/TURN servers for NAT traversal (config in `lib/webrtc-context.tsx`)
   - ICE candidate batching (100ms windows) to reduce signaling overhead
   - Exponential backoff reconnection (up to 5 attempts)

3. **Socket.IO** - Real-time signaling and presence
   - Singleton pattern in `lib/socket.ts`
   - Handles WebRTC SDP/ICE exchange, presence tracking, knock requests, screen share state
   - Connects to backend at `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:4000`)
   - Emits LiveKit call setup events: `livekit:init-call`, `livekit:join-call`, `livekit:leave-call`

### Workspace System

**Location:** `/app/(dashboard)/workspace/`

The workspace is the core virtual office feature with:
- **Hierarchical spaces:** Organization → Floors → Departments → Meeting Rooms
- **Peer state management:** Tracks audio/video streams, connection status, screen sharing, recording state
- **Dynamic floor navigation:** Animated transitions with member visibility filtering

**Main component:** `WorkspaceClient.tsx` (3,236 lines)
- Dynamically imported with SSR disabled
- Orchestrates all workspace state via custom hooks
- Manages peer connections, floors, spaces, and UI layout

### Custom Hooks Architecture

**Workspace-specific hooks** (`app/(dashboard)/workspace/hooks/`):
- `useLocalMedia` - Local camera/microphone acquisition
- `useFloors` - Floor roster management with animated transitions
- `useWebRTC` - Peer connection orchestration with ICE restart and reconnection
- `useLiveKit` - **LiveKit integration for all workspace video calls** (knock calls + floor/meeting room calls)
  - Uses imperative `Room` class from `livekit-client`
  - Listens for `livekit:init-call` / `livekit:join-call` socket events from backend
  - Manages track subscriptions, audio playback, chat via DataChannel
  - Recording via backend Egress API
  - Provides `toggleMicrophone()`, `toggleCamera()`, `toggleScreenShare()` controls
  - Auto-cleanup on component unmount
- `useScreenShare` - Screen capture with track replacement logic
- `useStatus` - Presence/availability state (available/busy/afk/offline)
- `useRecording` - Session recording with mixed audio context
- `useKnocking` - One-to-one meeting request flow (emits knock events with Agora setup)
- `useTodoNotifications` - Real-time task assignment notifications

**Global hooks** (`lib/hooks/`):
- `useTodos` - Task CRUD operations (personal & assigned)
- `usePresenceTracking` - Window focus/blur for status updates
- `useIsAdmin` - Role-based access control
- `useAmIFounder` - Founder-specific permissions
- `useHydration` - SSR hydration prevention

### Screen Share Implementation

**Complex pattern:** Single video track management
- Normal mode: Renders camera feed
- Screen share: Removes camera track, adds screen track via `sender.replaceTrack()`
- Exit: Restores camera from `cameraTrackRef`
- Each peer gets updated via WebRTC renegotiation
- Supports Picture-in-Picture (PiP) mode for fullscreen viewing

### Recording System

**Location:** `app/(dashboard)/workspace/hooks/useRecording.ts`

**Flow:**
1. Request screen share via `getDisplayMedia()`
2. Build mixed audio context (local + all peers in same space)
3. Create MediaRecorder with merged stream
4. Auto-upload to `/cabinet/files/upload`
5. Auto-request Ask Cabinet AI analysis with `generateAskCabinetPrompt()`

**Mixed Audio:** Uses Web Audio API to combine:
- Local user's microphone
- All peer audio streams in current space
- Display stream audio if available

### Ask Cabinet (AI Work Analysis)

**Location:** `/app/api/ask-cabinet/route.ts`, `/lib/askCabinetUtils.ts`

AI-powered analysis of recordings and documents:
- Video: Tasks completed, efficiency improvements, AI tool suggestions
- PDF: Document analysis
- Audio: Transcription + analysis

Automatically triggered after workspace recording upload.

## Key Technical Patterns

### Deterministic Call ID Generation
```typescript
// Ensures same call ID regardless of who initiates
generateCallId(userId1, userId2) {
  const sorted = [userId1, userId2].sort();
  return `knock-call-${sorted[0]}-${sorted[1]}`;
}
```
Prevents duplicate calls if both users "knock" simultaneously.

### Track Management
Helper functions in `app/(dashboard)/workspace/utils.ts`:
- `isLiveCameraTrack()` - Detects active camera tracks
- `isScreenTrack()` - Detects screen share tracks
- `getPreferredScreenTrack()` - Selects best screen track from multiple options

### Connection Recovery
- ICE restart on connection failure
- Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 5 attempts)
- Pending ICE candidate queue during renegotiation
- Automatic status change to "available" on call end/decline

### Performance Optimizations
- Dynamic imports for workspace (no SSR)
- ICE candidate batching (~100x reduction in signaling messages)
- Stream deduplication (replaces same-kind tracks)
- Memoized computations for peer lists and space rendering

## Important Socket.IO Events

**Workspace events:**
- `workspace:signal` - WebRTC signaling (SDP/ICE)
- `workspace:knock` - Request one-to-one meeting
- `workspace:knock-accept` - Accept knock request
- `workspace:knock-decline` - Decline knock request
- `workspace:screen-share-state` - Broadcast screen sharing status
- `workspace:recording-state` - Broadcast recording status
- `workspace:status-change` - User availability updates
- `workspace:move-to-space` - Floor/space navigation
- `workspace:todo-notification` - Task assignment notifications

**WebRTC call events:**
- `audio:incoming-call`, `video:incoming-call` - Incoming call signals
- `audio:call-accepted`, `video:call-accepted` - Call acceptance
- `audio:call-ended`, `video:call-ended` - Call termination
- `audio:call-declined`, `video:call-declined` - Call rejection
- `audio:ice-candidate`, `video:ice-candidate` - ICE candidate exchange

**Agora call events:**
- `agora:init-call` - Sent to knock accepter (host) with Agora credentials
- `agora:join-call` - Sent to knocker (guest) with Agora credentials
- `agora:leave-call` - Broadcast when user leaves Agora call
- Payload: `{ appId, channel, token, uid, partnerId }`

## Data Models

**Key types** (`app/(dashboard)/workspace/types.ts`):
```typescript
PeerState: {
  id: string;
  email: string;
  stream?: MediaStream;
  spaceId: string;              // Current room
  status?: UserStatus;          // available/busy/afk/offline
  isScreenSharing?: boolean;
  isRecording?: boolean;
  connectionStatus?: RTCPeerConnectionState;
}

Floor: {
  id: string;
  level: number;               // For sorting/animation
  name: string;
  departments: Array<{ name: string; color?: string; count?: number }>;
  members: FloorMember[];
  pending: FloorMember[];
}
```

## Environment Configuration

**Required environment variables:**
```
NEXT_PUBLIC_API_URL              # Backend API URL (default: http://localhost:4000)
NEXT_PUBLIC_STREAM_API_KEY       # Stream.io API key (optional, for Stream calls)
NEXT_PUBLIC_HQ_FORCE_RECORDING   # Auto-recording for HQ (true/false/"off"/"0")
NEXT_PUBLIC_HQ_NAME              # HQ name for recording policy (optional)
```

**Backend environment variables** (in `roam-backend/.env`):
```
AGORA_APP_ID                     # Agora application ID (required for knock calls)
AGORA_APP_CERTIFICATE            # Agora app certificate (required for token generation)
STREAM_API_KEY                   # Stream.io API key (optional)
STREAM_API_SECRET                # Stream.io secret (optional)
```

The app gracefully handles missing credentials (logs error, returns null client).

## API Endpoints (Backend)

**Video Calling:**
- `/api/agora/token` - Generate Agora RTC auth token for knock calls
- `/stream/token` - Generate Stream.io auth token (if using Stream)

**Organization:**
- `/floors/roster?orgId=X` - Fetch all floors with members
- `/team/list?orgId=X` - Fetch team members

**Tasks:**
- `GET /todos?orgId=X` - List todos
- `POST /todos?orgId=X` - Create todo

**Files:**
- `POST /cabinet/files/upload` - Upload recordings/documents

**Kasm Integration:**
- `/api/kasm-proxy/[...path]` - CORS proxy for Kasm server (see `KASM_INTEGRATION.md`)

## Component Organization

```
app/
├── (dashboard)/
│   ├── workspace/              # Main virtual office
│   │   ├── WorkspaceClient.tsx # Core component (3,236 lines)
│   │   ├── hooks/              # Workspace-specific hooks
│   │   └── components/         # Peer video, audio, screen share cards
│   ├── ask-cabinet/            # AI document analysis
│   └── layout.tsx              # Dashboard providers
├── (landing)/                  # Marketing pages
├── (onboarding)/               # Team/org setup
├── garage-admin/               # Admin dashboard
└── api/                        # Next.js API routes

lib/
├── socket.ts                   # Socket.IO singleton
├── streamClient.ts             # Stream.io client factory
├── webrtc-context.tsx          # Global WebRTC state provider
├── hooks/                      # Global custom hooks
└── api.ts                      # HTTP client wrapper

components/
├── dashboard/                  # Dashboard-specific components
├── landing/                    # Marketing components
├── shared/                     # Cross-app shared components
└── ui/                         # Radix UI wrappers
```

## Common Modifications

### Adding a new Socket.IO event
1. Define event handler in `WorkspaceClient.tsx`
2. Add listener in `useEffect` hook
3. Emit from appropriate component/hook
4. Clean up listener in `useEffect` return function

### Adding a new space type
1. Update `spacesToRender` memoized calculation in `WorkspaceClient.tsx`
2. Add rendering logic in JSX
3. Update `workspace:move-to-space` event handling if needed

### Modifying recording behavior
1. Edit `useRecording` hook in `app/(dashboard)/workspace/hooks/useRecording.ts`
2. Update mixed audio logic if changing audio sources
3. Modify auto-upload/Ask Cabinet integration if needed

### Adding new peer state fields
1. Update `PeerState` type in `app/(dashboard)/workspace/types.ts`
2. Update all `useState<Map<string, PeerState>>` declarations
3. Add Socket.IO broadcast event for state changes
4. Update peer card rendering to display new field

## Testing Considerations

- WebRTC requires real ICE candidates (not easily mockable)
- Stream.io calls need valid API key + token from backend
- Socket.IO events require backend listener
- Screen share/recording require browser permissions (can't be automated)
- MediaRecorder API support varies by browser (check `SUPPORTED_MIME_TYPES`)

## Agora Knock Call Implementation

### How Knock Calls Work (Agora)

1. **User A clicks "knock"** on User B's card
   - `useKnocking` hook generates channel: `private-room-${userBId}`
   - Emits `workspace:knock` to backend with `targetId` and `channelName`

2. **Backend receives knock** (`roam-backend/src/realtime/socket.ts`)
   - Generates Agora tokens for both users (different UIDs)
   - Host (User B) gets `agora:init-call` event
   - Guest (User A) gets `agora:join-call` event
   - Both events include: `{ appId, channel, token, uid }`

3. **Frontend joins Agora channel** (`useAgora` hook)
   - Creates Agora RTC client
   - Joins channel with provided credentials
   - Publishes local audio/video tracks
   - Subscribes to remote user's tracks
   - Sets `inCall = true` to show video overlay

4. **Video overlay renders** (`WorkspaceClient.tsx`)
   - Full-screen black overlay (z-index 9999)
   - Two video containers: remote (left) and local (right)
   - Control panel: mic, camera, screen share, end call buttons
   - Uses `AgoraVideoPlayer` component to render video tracks
   - Automatically clears knocking state when call starts

5. **Controls during call**
   - Mic/Camera buttons call `toggleMicrophone()` / `toggleCamera()`
   - These use Agora's `track.setEnabled()` API (not workspace WebRTC)
   - Screen share button uses workspace `toggleScreenShare()` (not implemented for Agora yet)
   - End call button calls `leaveCall()` to cleanup and return to lobby

### Important Notes

- **Agora vs Workspace WebRTC**: Knock calls use Agora SDK directly, not the workspace WebRTC peer connections
- **Control state isolation**: Agora calls have separate mute/camera states (`agoraMicMuted`, `agoraCameraOff`)
- **Video overlay positioning**: Rendered at end of WorkspaceClient (outside all conditionals) to avoid hiding issues
- **Auto-cleanup**: When last remote user leaves, call automatically ends via `user-left` event

### Common Agora Issues & Solutions

**Issue: Video overlay not showing despite `inCall = true`**
- **Cause**: Overlay was nested inside a conditional (e.g., `mySpaceId === "lobby"`)
- **Solution**: Moved overlay to end of component, only depends on `inCall` state

**Issue: Mic/camera toggle not working**
- **Cause**: Buttons were calling workspace `toggleTrack()` instead of Agora controls
- **Solution**: Use `toggleMicrophone()` / `toggleCamera()` from `useAgora` hook

**Issue: Remote video not showing but audio works**
- **Cause**: `remoteUsers` state only updated on `video` publish, not `audio`
- **Solution**: Update state on both `audio` and `video` publish events

**Issue: Duplicate Agora dependency warning**
- **Cause**: `agora-rtc-sdk-ng` listed twice in package.json
- **Solution**: Remove duplicate entry, keep v4.24.0

**Debugging Agora calls:**
- Check console for `[AGORA]` prefixed logs
- Verify backend has `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` set
- Ensure browser has camera/microphone permissions granted
- Look for `user-published` events for both audio and video
- Confirm `AgoraVideoPlayer` effect logs show track rendering

## Key Files to Understand

Start with these files to understand the codebase:
1. `app/(dashboard)/workspace/WorkspaceClient.tsx` - Main workspace orchestration (3000+ lines)
2. `app/(dashboard)/workspace/hooks/useAgora.ts` - **Agora knock call integration**
3. `app/(dashboard)/workspace/components/AgoraVideoPlayer.tsx` - **Renders Agora video tracks**
4. `app/(dashboard)/workspace/hooks/useWebRTC.ts` - WebRTC connection lifecycle (for floor/meeting calls)
5. `app/(dashboard)/workspace/hooks/useKnocking.ts` - Knock request flow
6. `app/(dashboard)/workspace/hooks/useStreamCall.ts` - Stream.io integration (alternative)
7. `lib/socket.ts` - Real-time event flow
8. `app/(dashboard)/workspace/types.ts` - Core data models
9. `lib/webrtc-context.tsx` - Global WebRTC state for 1:1 calls

## Additional Documentation

- `GETSTREAM_INTEGRATION.md` - Stream.io integration guide (alternative to Agora)
- `KASM_INTEGRATION.md` - Kasm virtual desktop integration details
- `README.md` - Basic Next.js setup and environment variables

## Teamforce HR Module

**Location:** `components/dashboard/inlineApps/teamforce/`

### Navigation model
`TeamforceApp.tsx` owns an `internalDetail` state. Routes listed in `handleNavigate` (`"add-employee"`, `"add-employee-form"`, `"edit-employee"`) set `internalDetail`; anything else clears it. Active section = `internalDetail || externalSection`.

### Add Employee flow
`AddEmployeeSection.tsx` has three sub-views (`View = "select" | "bulk" | "invite"`):
- **Manual Entry** → navigates to `"add-employee-form"` (EmployeeForm, mode=add). Back button must navigate to `"add-employee"`, not `"employees"`.
- **Bulk Upload** → `BulkUploadView`: parses CSV, resolves Branch/Department names to IDs, calls `upsertEmployee` per row.
- **Invite via Email** → `InviteViaEmailView`: calls `sendOrgInvites` (OTP email via `/invites/create`) then `upsertEmployee` per email to pre-populate HR profile.

### Bulk Upload CSV format
Template columns (exact header names, case-insensitive on parse):
`Full Legal Name`, `Mobile Number`, `Email ID`, `Pan`, `Date of Joining` (dd/mm/yyyy), `Place of Joining`, `Branch` (name), `Department` (name), `Designation`, `Employment Type`

Branch and Department columns accept the display name (e.g. "Engineering") — the parser does a case-insensitive lookup to resolve to the `_id`. Unrecognised names are silently skipped (the employee is still created without that field).

### Email invite logic
`sendOrgInvites(emails)` in `api.ts` calls `POST /invites/create` — the same backend endpoint used by `InviteMemberDialog`. No changes to `InviteMemberDialog` or the backend route. Role defaults to `"stakeholder"`.

## Verifying changes in this repo

- **`npm run build` is the authoritative check.** Turbopack does not typecheck.
- `./node_modules/.bin/tsc --noEmit` currently reports **~160 pre-existing
  errors** (mostly `WorkshopsPage.tsx` and generated `.next/types`). The repo has
  never been tsc-clean, so a non-zero exit proves nothing on its own. Judge your
  work by: (a) `npm run build` exits 0, and (b) grep the tsc output for the files
  you actually touched and confirm none appear.
- Never use `npx --no tsc --noEmit` — it emits nothing and exits 0 regardless,
  which reads as a pass.

## Auth store: what login must carry

`store/authStore.tsx` is persisted to localStorage (`auth-storage`), and
`checkAuth()` only runs in the garage-admin layout — so in the main app the
store is populated by the **login response** and then only refreshed by explicit
`refreshUser()` calls.

Any field the login page fails to copy is `undefined` until something else
refreshes it, and the persisted cache hides that until cookies are cleared. This
produced a real bug twice: a verified user kept seeing "Verify your phone" and an
unverified number in their profile, because `app/(auth)/verify/page.tsx` copied
only `userId/email/name/role` out of a `/auth/verify-otp` response that also
contained `phone` and `phoneVerified`.

**When adding a user field, update the verify page's `setUser` too** — the
backend returning it is not enough. Note `setUser` in `app/select-organization/`
and `components/affiliate/globe/AffiliateProfileOverlay.tsx` are local
`useState`, not the store.

## Phone OTP

- Three entry points, all of which must stay in sync:
  `components/shared/ProfilePopover.tsx` (Complete Profile),
  `components/shared/PhoneVerifyBanner.tsx` (the nudge),
  `components/webinar/PlanPhoneVerifySheet.tsx` (webinar Buy Now).
- All three pass `channel: "both"` so the code goes over WhatsApp **and** SMS.
  The backend defaults to `"sms"` when the field is absent.
- All three use the searchable `country-state-city` picker. When prefilling from
  a stored E.164 number, match the **longest** dial code first or `+1` wins over
  `+91`.

## Webinar analytics

`components/dashboard/WorkshopAnalyticsModal.tsx` has two different notions of
attendance and they must not be conflated:

- The **enrolment** stats (`getWorkshopAnalytics`) count registrations. Its
  "Total Attended" tile reads `WorkshopRegistration.status === "attended"`, which
  no backend code ever writes — that tile is 0 for every workshop.
- The **Live Session** section (`getWebinarSessionAnalytics`) reads who was
  actually in the room, plus purchases, phone verifications and chat.

Attendance is only recorded from the day that feature shipped and cannot be
backfilled. `summary.attendanceRecorded === false` means "not recorded", NOT
"nobody came" — render it as `—` with an explanation, never as `0`.

## Pushing while the working tree is dirty

`main` is usually behind the remote, and this tree often carries unrelated
uncommitted work (and sometimes a second agent editing files). `git pull --rebase`
refuses, and `stash`/`checkout` would destroy in-flight work.

Commit the specific files by pathspec, then merge and push from a throwaway
worktree so the primary tree is never touched:

```bash
git commit -m "…" -- path/to/file.tsx          # only this file
git worktree add /tmp/wt -b tmp-push <commit>
cd /tmp/wt && git merge origin/main --no-edit
git push origin tmp-push:main                  # lands on main
cd - && git worktree remove /tmp/wt --force && git branch -D tmp-push
```

Check first whether upstream touches your file: `git diff --name-only <commit>^ origin/main | grep <file>`.

## Deploys

This app deploys through **Vercel**, not from the CLI here. Pushing to `main`
does not put a change in front of users until that deploy runs.

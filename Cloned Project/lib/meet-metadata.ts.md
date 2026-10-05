# `lib/meet-metadata.ts`

> Type and safe parser for the JSON metadata attached to LiveKit participants in meet and webinar rooms (host, bot, co-host, audience, role, avatar, name, user id).

**Kind:** frontend library · **Lines:** 43

## Purpose
When the backend issues a LiveKit token it can embed a JSON string as participant metadata. UI components such as the participants panel, sidebar and video grid need to read flags like "is this the host?" or "is this a bot?" from that string. This file gives them one typed, defensive parser so a missing or malformed metadata string never crashes the UI.

## How it works
- `ParticipantMeta` describes the expected shape. The webinar-only fields are documented inline: `isCoHost` (joined via the webinar token endpoint as co-host, used for promote/demote controls), `isAudience` (a TV-preview subscriber that publishes nothing and is hidden from the grid and People panel), and `role` (`'host' | 'co-host' | 'viewer' | 'audience'` or any string) for badges.
- `parseParticipantMeta(metadata)` returns `{ isHost: false, isBot: false }` for an empty or unparseable string. Otherwise it coerces each field strictly: booleans only when exactly `true`, strings only when the value is a string; an empty `avatar` becomes `undefined`. Unknown keys are dropped.

## Exports
- `interface ParticipantMeta` - parsed participant flags and profile info.
- `parseParticipantMeta(metadata: string | undefined): ParticipantMeta` - safe parser with defaults.

## Dependencies
- **Internal:** none. **Packages:** none.

## Used by
- `components/office/MeetParticipantsPanel.tsx` - host/co-host badges and controls.
- `components/office/MeetSidebar.tsx`
- `components/office/VideoGrid.tsx` - hides audience participants and shows avatars/names.

## Notes
- The metadata is written by the backend when it mints LiveKit tokens; any new flag must be added both there and to the explicit field list here, or it will be silently dropped.

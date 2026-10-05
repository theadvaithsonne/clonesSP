# `lib/webinar/mic-devices.ts`

> Which microphones are really *choices*, for the "pick a mic" prompt.

**Kind:** frontend library · **Lines:** 49

<!-- docgen:auto -->

## Purpose
Which microphones are really *choices*, for the "pick a mic" prompt.

`enumerateDevices()` is not a list of hardware. Chrome on Windows prepends
two virtual entries — `deviceId: "default"` and `"communications"` — that
are aliases for a real device further down the list. Counting raw entries
there reports 3 mics on a laptop that has one, so a prompt gated on
"more than one mic" would open for everybody on Windows.

Kept free of any DOM/React import so it can be tested on its own.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `realAudioInputs` | function | `realAudioInputs(devices: MediaDeviceInfo[]): MediaDeviceInfo[]` — Real, distinct microphones, in the order the browser gave them. | 23 |
| `micLabel` | function | `micLabel(device: MediaDeviceInfo, index: number): string` — Label to show for a mic — browsers return "" until permission is granted. | 46 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
- `components/webinar/MicPickerDialog.tsx`

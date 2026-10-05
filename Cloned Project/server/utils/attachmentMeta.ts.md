# `server/utils/attachmentMeta.ts`

> src/utils/attachmentMeta.ts

**Kind:** backend utility · **Lines:** 117

<!-- docgen:auto -->

## Purpose
src/utils/attachmentMeta.ts

Normalise an inbound chat attachment before it is persisted.

The socket handlers used to build this object inline, listing each field by
hand — which meant any field the client started sending was silently dropped.
That is exactly what happened to the playback metadata below: the schema
accepted `durationMs`/`width`/`height`/`waveform`, but the whitelist in the
handler threw them away before Mongoose ever saw them.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MAX_WAVEFORM_SAMPLES` | const | `= 64` — Voice-note waveforms are capped at 64 samples — see message.model.ts. | 12 |
| `InboundAttachment` | interface |  | 14 |
| `processAttachmentMeta` | function | `processAttachmentMeta(att: Partial<InboundAttachment>)` — Just the optional metadata, validated and ready to spread onto an attachment the caller has already built. | 73 |
| `processAttachment` | function | `processAttachment(att: InboundAttachment)` — Build the stored attachment. | 94 |
| `processAttachments` | function | `processAttachments(attachments?: InboundAttachment[]): ReturnType<typeof processAttachment>[] \| undefined` | 111 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/realtime/socket.ts`

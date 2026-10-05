# `server/models/openclawMessage.model.ts`

> Mongoose model that stores the chat history between a Garage user and an OpenClaw AI agent.

**Kind:** Mongoose model · **Lines:** 17

## Purpose
OpenClaw agents (an external AI-agent service reached through the `/openclaw-ws/:channel` WebSocket proxy) do not keep a transcript Garage can read back. This collection persists each user/assistant turn so the frontend can reload a conversation with a given agent and page backwards through it.

## How it works
- One document per message: `userId` (ref `User`), `agentId` (string id of the OpenClaw agent), `sessionId` (string, the OpenClaw session the message belonged to), `role` (`"user"` or `"assistant"`), `content` (text). All fields are required.
- `timestamps: true` adds `createdAt` / `updatedAt`; `createdAt` is the ordering key.
- Compound index `{ userId: 1, agentId: 1, createdAt: 1 }` serves the main read pattern: "messages for this user and agent, in time order", including cursor paging with `createdAt < before`.

## Exports
- `OpenClawMessage` - the Mongoose model (`model("OpenClawMessage", ...)`).

## Interfaces
- **Database:** `OpenClawMessage` (collection `openclawmessages`, the Mongoose default pluralisation).

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
- `server/routes/openclawMessages.ts` (mounted at `/openclaw-messages`, browser `/backend/openclaw-messages`): `GET /` pages history (`agentId`, `limit` default 30 max 200, `before`), `POST /` bulk-inserts `{ agentId, sessionId, messages[] }`, `DELETE /` clears a user's history with one agent. All behind `requireAuth`.
- `server/routes/internalChat.ts` (mounted at `/internal/chat`): `POST /message` writes an assistant message on behalf of a server-side caller authenticated by the `GARAGE_INTERNAL_API_KEY` bearer value.

## Notes
- The model is registered without a `mongoose.models` guard, so importing it twice in one process under different module instances would throw `OverwriteModelError`; in practice the CommonJS module cache prevents that.
- No TTL: history is kept until the user deletes it through `DELETE /backend/openclaw-messages`.

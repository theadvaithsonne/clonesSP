# `server/realtime/openclawWs.ts`

> A raw-WebSocket proxy that relays OpenClawApi's realtime `tasks`, `crons` and `activity` channels to browsers, filtering every event so each user only sees the agents (and, for employees, the activity rows) they are allowed to see.

**Kind:** Socket.IO / realtime · **Lines:** 246 · **Mounted at:** WebSocket upgrade path `/openclaw-ws/:channel` (browser: `/backend/openclaw-ws/:channel`)

## Purpose
OpenClawApi (an external AI-agent service) exposes `/api/tasks/ws`, `/api/crons/ws` and `/api/activity/ws`, which broadcast every event to every client with no org or agent scoping. Connecting browsers to them directly would leak other organisations' tasks, leak unassigned agents to employees, and would stop working once OpenClawApi is firewalled into a private network. This module puts the backend in the middle: the browser opens a WebSocket to this server with its JWT, the server works out which agent IDs the user may see, and it forwards only the matching upstream events. It is not Socket.IO; it uses the `ws` library alongside Socket.IO on the same HTTP server.

## How it works

### Upgrade routing and auth (`installOpenClawWsProxy`, L172-L233)
- Creates a `WebSocketServer` with `noServer: true` and listens for the HTTP server's `upgrade` event, so it can share the server with Socket.IO (which owns `/socket.io/*`).
- Only paths matching `/^\/openclaw-ws\/(tasks|crons|activity)\/?$/` are claimed; any other upgrade is ignored so other handlers can take it. In the combined server, `server/main.ts` prepends a listener that strips the `/backend` prefix first, so the browser's `/backend/openclaw-ws/tasks` arrives here as `/openclaw-ws/tasks`.
- The JWT is read from the `token` query parameter and checked with `verifyJwt`. An invalid or missing token gets a raw `HTTP/1.1 401 Unauthorized` response and the socket is destroyed before the upgrade.
- After the upgrade, `resolveAccess(userId, orgId)` runs. If the lookup throws, the socket is closed with code `1011` ("access lookup failed").
- The client is recorded as a `DownstreamClient` (socket, allowed agent IDs, founder flag, userId, channel) in the channel's subscriber set, and `ensureUpstream(channel)` makes sure the shared upstream connection exists. On downstream `close` or `error`, the client is removed. The upstream is deliberately left open even when no subscribers remain.

### Access resolution (`resolveAccess`, L149-L170)
- No `orgId` in the JWT means an empty agent set and not a founder, so the user receives nothing that carries an agent ID.
- Loads the `User` (`role`, `organization`, `organizations`). Like `requireAuth`, it uses the membership for the JWT's org: a membership with `role === "founder"` or `fullAccess === true` (`hasFounderAccess`) counts as founder. Otherwise the membership role applies, or the user's top-level `role` when no membership matches.
- Founders get every `OpenClawAgent` in the org (`orgId`, `deletedAt: null`). Everyone else only gets agents whose `assignedUserIds` contains their user ID. Only `agentId` is selected.
- Access is resolved **once per connection**. Agent assignments that change later only take effect after the client reconnects.

### Shared upstream per channel (`ensureUpstream`, L75-L147)
- Module-level maps keep one upstream socket per channel (`upstreams`), the subscribers for each channel (`subscribers`) and pending reconnect timers (`reconnectTimers`).
- The upstream URL is `env.OPENCLAW_API_URL` with `http` swapped for `ws` (so `https` becomes `wss`), trailing slashes removed, and the channel path appended. When `env.OPENCLAW_SERVICE_SECRET` is set it is sent as `Authorization: Bearer ...`.
- **Filtering rules for each upstream message** (L91-L127):
  1. Frames that are not JSON are dropped.
  2. The agent ID is taken from `data.agent_id`, or from `data.task.agent_id` (the `issue_resolved` shape), by `extractAgentId`.
  3. Events with no agent ID go to founders only.
  4. Events whose agent is not in the client's allowed set are dropped.
  5. On the `activity` channel, non-founders also need `data.user_id` to equal their own userId. This matches the REST endpoint's scoping.
  6. Anything that passes is forwarded as the original text frame, unchanged.
- On upstream `close`, the slot is cleared. If the channel still has subscribers, a reconnect is scheduled after a **fixed 2 s delay**. Downstream clients stay connected while the upstream is down. Upstream errors are only logged.

## Exports
- `installOpenClawWsProxy(server: HttpServer): void` - attaches the upgrade handler described above to an HTTP server.
- `_debugUpstreamState(): Record<"tasks"|"crons"|"activity", { connected: boolean; subscribers: number }>` - snapshot of each channel's upstream state and subscriber count, meant for tests and health checks. Nothing in the repo calls it.

## Interfaces
- **Endpoints served:** WebSocket upgrade `GET /backend/openclaw-ws/{tasks|crons|activity}?token=<jwt>`, or `/openclaw-ws/...` on hosts in BACKEND_HOSTS / standalone mode. JWT required. Server-to-client only: messages that clients send are ignored.
- **Database:** `User` (collection `users`) - read role and memberships; `OpenClawAgent` (collection `openclawagents`, Mongoose default) - read `agentId` by `orgId`, `deletedAt` and `assignedUserIds`.
- **External services:** OpenClawApi WebSocket endpoints `/api/tasks/ws`, `/api/crons/ws`, `/api/activity/ws` at `OPENCLAW_API_URL`.
- **Environment variables:** read through `env`: `OPENCLAW_API_URL` (falls back to `OPENCLAW_AGENT_MANAGER_URL`, then a hardcoded default host in `server/config/env.ts`) - upstream base URL; `OPENCLAW_SERVICE_SECRET` - optional bearer secret for the upstream.
- **Background work:** one long-lived upstream WebSocket per channel, opened lazily, plus a 2 s reconnect timer.

## Dependencies
- **Internal:** `server/services/jwt.ts` (`verifyJwt`) - validates the query token; `server/models/user.model.ts` (`User`) - role lookup; `server/utils/accessCheck.ts` (`hasFounderAccess`) - founder / fullAccess elevation; `server/models/openclawAgent.model.ts` (`OpenClawAgent`) - allowed agents; `server/config/env.ts` (`env`) - upstream URL and secret.
- **Packages:** `ws` - WebSocket server and upstream client; `http` - types; `url` - path and query parsing; `mongoose` - `Types.ObjectId` for the `assignedUserIds` filter.

## Used by
- `server/index.ts`: `attachRealtime(server)` calls `installOpenClawWsProxy(server)` right after `initSocket`. `attachRealtime` is used both by standalone backend mode and by the combined entry `server/main.ts`.
- Client side: `useOpenClawWs` in `components/dashboard/OpenClawAgentTabs.tsx` connects to `${NEXT_PUBLIC_API_URL}/openclaw-ws/<channel>?token=...`. It converts legacy paths such as `/api/tasks/ws` into channel names and reconnects with a fresh token.

## Notes
- The header comment mentions "expo backoff", but the code reconnects after a fixed 2000 ms with no backoff or attempt cap.
- The JWT travels in the query string, so it can show up in proxy or access logs.
- Events without an agent ID go to all founders of **any** org connected to that channel. Org scoping relies entirely on `agent_id`, so upstream event types without one may cross orgs for founders.
- Unknown event types that do carry an agent ID are forwarded once the agent check passes. The code does not keep an allow-list of event names.
- A downstream close never closes the upstream. An idle upstream stays open until OpenClawApi drops it, and after that it is reopened only when the next subscriber arrives.

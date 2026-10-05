/**
 * OpenClawApi WebSocket proxy with RBAC filtering.
 *
 * OpenClawApi's /api/{tasks,crons,activity}/ws endpoints broadcast every
 * event to every connected client with no org or agent scoping. Hitting
 * them directly from the browser would:
 *   1) leak cross-org data (every org's tasks visible to every client)
 *   2) leak unassigned agents to employees
 *   3) break entirely when OpenClawApi is firewalled to the VPC
 *
 * This module routes browser clients through roam-backend instead:
 *
 *   Browser → ws://roam-backend/openclaw-ws/:channel?token=<jwt>
 *     → roam-backend verifies JWT, resolves accessible agent_ids
 *     → forwards events whose `data.agent_id` is in that set
 *     → drops everything else
 *
 * Upstream to OpenClawApi is shared across all downstream clients (one
 * socket per channel, not per client). Fanout + filter happen in-process.
 * If the upstream drops we reconnect with expo backoff; downstream
 * clients stay connected across upstream hiccups.
 */
import type { Server as HttpServer, IncomingMessage } from "http";
import WebSocket, { WebSocketServer } from "ws";
import { parse as parseUrl } from "url";
import { verifyJwt } from "../services/jwt";
import { User } from "../models/user.model";
import { hasFounderAccess } from "../utils/accessCheck";
import { OpenClawAgent } from "../models/openclawAgent.model";
import { env } from "../config/env";
import { Types } from "mongoose";

type Channel = "tasks" | "crons" | "activity";
const CHANNELS: Channel[] = ["tasks", "crons", "activity"];

const CHANNEL_PATH: Record<Channel, string> = {
  tasks: "/api/tasks/ws",
  crons: "/api/crons/ws",
  activity: "/api/activity/ws",
};

// Event names we care about per channel. Anything not in this list is
// still forwarded (we default to "unknown-event → forward unchanged")
// since OpenClawApi may add new event types; we only explicitly
// drop/filter events that carry an agent_id we know how to check.
function extractAgentId(payload: any): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  // task_created/updated/deleted payloads have agent_id at the top
  if (typeof payload.agent_id === "string") return payload.agent_id;
  // issue_resolved wraps the full task under .task
  if (payload.task && typeof payload.task.agent_id === "string") {
    return payload.task.agent_id;
  }
  return undefined;
}

interface DownstreamClient {
  socket: WebSocket;
  accessibleAgentIds: Set<string>;
  isFounder: boolean;
  userId: string;
  channel: Channel;
}

// Shared upstream + its subscribers per channel.
const upstreams: Map<Channel, WebSocket | null> = new Map();
const subscribers: Map<Channel, Set<DownstreamClient>> = new Map();
const reconnectTimers: Map<Channel, NodeJS.Timeout> = new Map();

function upstreamUrl(channel: Channel): string {
  const base = env.OPENCLAW_API_URL.replace(/^http/, "ws").replace(/\/+$/, "");
  return `${base}${CHANNEL_PATH[channel]}`;
}

function ensureUpstream(channel: Channel): void {
  if (upstreams.get(channel)) return; // already open

  const url = upstreamUrl(channel);
  const headers: Record<string, string> = {};
  if (env.OPENCLAW_SERVICE_SECRET) {
    headers.Authorization = `Bearer ${env.OPENCLAW_SERVICE_SECRET}`;
  }

  const up = new WebSocket(url, { headers });
  upstreams.set(channel, up);

  up.on("open", () => {
    console.log(`[openclaw-ws] upstream ${channel} connected`);
  });

  up.on("message", (raw) => {
    const text = typeof raw === "string" ? raw : raw.toString("utf8");
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return; // garbage upstream frame — ignore
    }
    const agentId = extractAgentId(parsed?.data);
    const subs = subscribers.get(channel);
    if (!subs) return;

    // Extra per-user filter on the activity channel: employees only
    // see activity rows they themselves produced (data.user_id matches
    // their userId). Founders see everything for agents in their org.
    // This mirrors the REST endpoint's scoping so WS + REST agree.
    const eventUserId = typeof parsed?.data?.user_id === "string" ? parsed.data.user_id : undefined;

    for (const client of subs) {
      if (client.socket.readyState !== WebSocket.OPEN) continue;

      // No agent_id on the event: forward only to founders.
      if (!agentId) {
        if (client.isFounder) client.socket.send(text);
        continue;
      }
      // Agent not in the user's accessible set → drop.
      if (!client.accessibleAgentIds.has(agentId)) continue;

      // Activity channel: apply the user_id filter for non-founders.
      if (client.channel === "activity" && !client.isFounder) {
        if (!eventUserId || eventUserId !== client.userId) continue;
      }

      client.socket.send(text);
    }
  });

  up.on("close", () => {
    console.warn(`[openclaw-ws] upstream ${channel} closed — will reconnect`);
    upstreams.set(channel, null);
    // Schedule a reconnect, but only if we still have subscribers. If
    // everyone disconnected while upstream was up, let it stay closed
    // until the next subscribe triggers ensureUpstream again.
    if ((subscribers.get(channel)?.size ?? 0) > 0) {
      const t = setTimeout(() => {
        reconnectTimers.delete(channel);
        ensureUpstream(channel);
      }, 2000);
      reconnectTimers.set(channel, t);
    }
  });

  up.on("error", (err) => {
    console.error(`[openclaw-ws] upstream ${channel} error:`, err.message);
  });
}

async function resolveAccess(userId: string, orgId: string | undefined): Promise<{ ids: Set<string>; isFounder: boolean }> {
  if (!orgId) return { ids: new Set(), isFounder: false };

  const dbUser = await User.findById(userId).select("role organization organizations").lean();
  if (!dbUser) return { ids: new Set(), isFounder: false };

  // Mirror requireAuth's elevation logic so fullAccess stakeholders count
  // as founders for scoping purposes.
  let role = dbUser.role;
  if (dbUser.organizations) {
    const m = (dbUser.organizations as any[]).find((mem: any) => mem.organization?.toString() === orgId);
    if (m) role = hasFounderAccess(m) ? "founder" : m.role;
  }
  const isFounder = role === "founder";

  const filter: Record<string, unknown> = { orgId, deletedAt: null };
  if (!isFounder) {
    filter.assignedUserIds = new Types.ObjectId(userId);
  }
  const rows = await OpenClawAgent.find(filter).select("agentId").lean();
  return { ids: new Set(rows.map((r: any) => r.agentId as string)), isFounder };
}

export function installOpenClawWsProxy(server: HttpServer): void {
  // Use `noServer: true` so we can route upgrades by path alongside
  // Socket.IO (which owns /socket.io/*).
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const url = parseUrl(req.url ?? "", true);
    const pathname = url.pathname ?? "";
    const match = pathname.match(/^\/openclaw-ws\/(tasks|crons|activity)\/?$/);
    if (!match) return; // Let Socket.IO (or another handler) deal with it.

    const channel = match[1] as Channel;
    const token = typeof url.query.token === "string" ? url.query.token : "";

    let payload: { userId: string; orgId?: string };
    try {
      payload = verifyJwt(token);
    } catch {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, async (ws) => {
      let access: { ids: Set<string>; isFounder: boolean };
      try {
        access = await resolveAccess(payload.userId, payload.orgId);
      } catch (err) {
        console.error("[openclaw-ws] access lookup failed:", err);
        ws.close(1011, "access lookup failed");
        return;
      }

      const client: DownstreamClient = {
        socket: ws,
        accessibleAgentIds: access.ids,
        isFounder: access.isFounder,
        userId: payload.userId,
        channel,
      };

      let subs = subscribers.get(channel);
      if (!subs) {
        subs = new Set();
        subscribers.set(channel, subs);
      }
      subs.add(client);
      ensureUpstream(channel);

      ws.on("close", () => {
        subs!.delete(client);
        // Let the upstream linger even if subs is empty — it's cheap, and
        // the next subscriber will find it already open. Close is handled
        // automatically by the upstream's own close handler if it drops.
      });

      ws.on("error", () => {
        subs!.delete(client);
      });
    });
  });
}

// Exported for testability / health checks.
export function _debugUpstreamState() {
  const out: Record<string, { connected: boolean; subscribers: number }> = {};
  for (const ch of CHANNELS) {
    out[ch] = {
      connected: upstreams.get(ch)?.readyState === WebSocket.OPEN,
      subscribers: subscribers.get(ch)?.size ?? 0,
    };
  }
  return out;
}

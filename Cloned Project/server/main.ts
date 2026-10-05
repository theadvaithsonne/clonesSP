/**
 * Garage — combined server. One Node process and one port for the whole app:
 *
 *   /socket.io/*             Socket.IO (presence, knock calls, chat, webinars…)
 *   /openclaw-ws/:channel    OpenClaw WebSocket proxy
 *   /backend/*               Express backend (server/app.ts). The prefix is
 *                            stripped first, so every router sees exactly the
 *                            paths it saw as the standalone garagenew-backend.
 *   any path on BACKEND_HOSTS
 *                            Express backend at the root, for hosts that were
 *                            the old API domain (mobile apps, webhooks, partners)
 *   everything else          Next.js — pages, app router, app/api route handlers
 *
 *   npm run dev   → tsx watch server/main.ts --dev
 *   npm start     → node dist/main.js   (after `npm run build`)
 *
 * The backend can still run on its own with `npm run dev:backend` /
 * `npm run start:backend` (server/index.ts), and Next.js on its own with
 * `npm run dev:web` / `npm run start:web`.
 */
import { DEV, ROOT_DIR } from "./bootstrap-env"; // must stay first
import "./instrument"; // Sentry, before http/express/mongoose load
import http from "node:http";
import { EventEmitter } from "node:events";
import next from "next";
import app from "./app";
import { attachRealtime, startBackend, stopBackend } from "./index";

const port = Number(process.env.PORT || 3000);

const BACKEND_BASE_PATH = normalizeBasePath(process.env.BACKEND_BASE_PATH ?? "/backend");
const BACKEND_HOSTS = new Set(
  (process.env.BACKEND_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
);

type Target = "backend" | "next";
const TARGET = Symbol("garage.target");
type ClassifiedRequest = http.IncomingMessage & { [TARGET]?: Target };

/** "/backend/" → "/backend"; "" or "/" disables the prefix route. */
function normalizeBasePath(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * Decides once per request (and per upgrade) where it goes. A backend request
 * under BACKEND_BASE_PATH has the prefix removed from req.url here, before
 * Socket.IO, the OpenClaw proxy or Express look at it.
 */
function classify(request: http.IncomingMessage): Target {
  const req = request as ClassifiedRequest;
  if (req[TARGET]) return req[TARGET];

  let target: Target = "next";
  const host = (req.headers.host ?? "").replace(/:\d+$/, "").toLowerCase();
  const url = req.url ?? "/";
  if (BACKEND_HOSTS.has(host)) {
    target = "backend";
  } else if (
    BACKEND_BASE_PATH &&
    (url === BACKEND_BASE_PATH ||
      url.startsWith(`${BACKEND_BASE_PATH}/`) ||
      url.startsWith(`${BACKEND_BASE_PATH}?`))
  ) {
    const rest = url.slice(BACKEND_BASE_PATH.length);
    req.url = rest.startsWith("/") ? rest : `/${rest}`;
    target = "backend";
  }
  req[TARGET] = target;
  return target;
}

async function main(): Promise<void> {
  // Next.js attaches an "upgrade" listener to `httpServer` — or, when that
  // option is absent, to whatever server delivered its first request. On the
  // real server it would see the Socket.IO and OpenClaw upgrades too, and for
  // any path that resolves to a page ("/socket.io" matches the root-level
  // app/(affiliate)/[orgSlug] route) it calls socket.end() on a connection
  // engine.io has already upgraded. So Next listens on a private emitter and
  // is handed only /_next/* upgrades (the dev HMR socket).
  const nextUpgrades = new EventEmitter();
  const nextApp = next({
    dev: DEV,
    dir: ROOT_DIR,
    hostname: "localhost",
    port,
    turbopack: DEV,
    httpServer: nextUpgrades as unknown as http.Server,
  });
  const handleNext = nextApp.getRequestHandler();

  const server = http.createServer((req, res) => {
    if (classify(req) === "backend") {
      app(req, res);
      return;
    }
    handleNext(req, res).catch((err) => {
      console.error("[next] request failed:", err);
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    });
  });

  // Socket.IO wraps the request listener above (it answers /socket.io/* and
  // passes everything else through) and, with the OpenClaw proxy, adds
  // "upgrade" listeners that each claim only their own path.
  attachRealtime(server);

  // Prepended so they run before those listeners: a /backend/socket.io/… or
  // /backend/openclaw-ws/… URL is rewritten before anything inspects it.
  server.prependListener("request", (req) => void classify(req));
  server.prependListener("upgrade", (req) => void classify(req));

  server.on("upgrade", (req, socket, head) => {
    if (classify(req) === "next" && (req.url ?? "").startsWith("/_next/")) {
      nextUpgrades.emit("upgrade", req, socket, head);
    }
    // Anything nobody claims is closed by engine.io after ~1 s, as before.
  });

  // pm2 / tsx watch send SIGINT or SIGTERM: flush PostHog (3 s cap) and stop
  // the Next dev compiler before exiting.
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[shutdown] received ${signal}`);
    await Promise.allSettled([stopBackend(), nextApp.close()]);
    process.exit(0);
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));

  // Next's compiler start-up and the backend boot (Mongo, boot tasks,
  // background jobs) are independent; run them side by side, listen when
  // both are ready — the standalone backend also listened only after boot.
  await Promise.all([nextApp.prepare(), startBackend()]);

  server.listen(port, () => {
    const where = [
      BACKEND_BASE_PATH ? `backend at ${BACKEND_BASE_PATH}` : "backend prefix disabled",
      BACKEND_HOSTS.size ? `backend hosts: ${[...BACKEND_HOSTS].join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("; ");
    console.log(
      `[garage] ${DEV ? "development" : "production"} server on http://localhost:${port} — Next.js at /, ${where}`
    );
  });
}

main().catch((err) => {
  console.error("Fatal boot error:", err);
  process.exit(1);
});

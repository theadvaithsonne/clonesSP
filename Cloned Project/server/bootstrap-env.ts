/**
 * First import of server/main.ts — settles NODE_ENV and loads the env files
 * before any other module reads process.env. (server/config/env.ts snapshots
 * process.env at import time, and Next.js inlines NEXT_PUBLIC_* from it.)
 *
 *   npm run dev   → `--dev` flag → development (Next dev server + Turbopack)
 *   npm start     → no flag      → production  (serves the `next build` output)
 *
 * Files load with Next.js precedence — .env.$NODE_ENV.local, .env.local
 * (skipped when NODE_ENV=test), .env.$NODE_ENV, .env — and never override a
 * variable the shell or process manager already set. The backend's own
 * `dotenv.config()` calls run later and find nothing left to do.
 */
import path from "node:path";
import { loadEnvConfig } from "@next/env";

export const DEV = process.argv.includes("--dev");

// Decided by the flag, like `next dev` / `next start`, so a NODE_ENV left in
// a .env file or the shell can't put a production build into dev mode or
// the reverse. (Assigned through a cast: Next's types mark it read-only.)
(process.env as Record<string, string | undefined>).NODE_ENV = DEV ? "development" : "production";

// The repo root: one level above both server/ (tsx) and dist/ (compiled).
export const ROOT_DIR = path.resolve(__dirname, "..");

loadEnvConfig(ROOT_DIR, DEV);

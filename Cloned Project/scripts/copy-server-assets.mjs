// Copies the non-TypeScript files the compiled backend reads at runtime into
// dist/ (tsc only emits .js). Replaces the old backend build's POSIX-only
// `mkdir -p … && cp -R …` step so `npm run build` works on Windows as well.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Read through path.join(__dirname, "emails", "templates") by
// services/affiliateEmailTemplates.ts and services/founderEmailTemplates.ts.
const ASSET_DIRS = ["services/emails/templates"];

for (const dir of ASSET_DIRS) {
  const from = path.join(root, "server", dir);
  const to = path.join(root, "dist", dir);
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, {
    recursive: true,
    // Each template has a sibling <file>.md doc; it is not a runtime asset.
    filter: (src) => !src.endsWith(".md"),
  });
  console.log(`copied server/${dir} -> dist/${dir}`);
}

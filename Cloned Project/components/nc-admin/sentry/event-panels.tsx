"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type {
  SentryBreadcrumb,
  SentryEvent,
  SentryRequestEntry,
} from "@/lib/nc-admin-api/admin-sentry";
import { levelClass } from "@/lib/nc-admin-api/admin-sentry";

/** Collapsible titled section shell, matching the admin card language. */
export function Panel({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-5 py-3 text-left"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {count != null && (
          <span className="rounded-full bg-zinc-500/15 px-2 py-0.5 text-[10px] text-zinc-400">
            {count}
          </span>
        )}
      </button>
      {open && <div className="border-t border-white/[0.06] px-5 py-4">{children}</div>}
    </div>
  );
}

function KeyVals({ rows }: { rows: Array<[string, unknown]> }) {
  if (!rows.length) return <p className="text-xs text-zinc-500">None</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={i} className="border-b border-white/[0.04] last:border-b-0">
              <td className="w-1/3 py-1.5 pr-4 align-top font-mono text-[11px] text-zinc-500">
                {k}
              </td>
              <td className="py-1.5 align-top font-mono text-[11px] text-zinc-200 break-words">
                {typeof v === "string" ? v : JSON.stringify(v)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TagsPanel({ event }: { event: SentryEvent }) {
  const tags = event.tags ?? [];
  return (
    <Panel title="Tags" count={tags.length}>
      {tags.length ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t, i) => (
            <span
              key={i}
              className="rounded border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono text-[10px]"
            >
              <span className="text-zinc-500">{t.key}</span>
              <span className="text-zinc-600"> = </span>
              <span className="text-zinc-200">{t.value}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">No tags</p>
      )}
    </Panel>
  );
}

export function ContextsPanel({ event }: { event: SentryEvent }) {
  const contexts = event.contexts ?? {};
  const keys = Object.keys(contexts);
  return (
    <Panel title="Contexts" count={keys.length}>
      {keys.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {keys.map((name) => {
            const c = contexts[name] as Record<string, unknown>;
            const rows = Object.entries(c).filter(([k]) => k !== "type");
            return (
              <div key={name} className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
                <div className="mb-1.5 text-xs font-semibold capitalize text-white">{name}</div>
                <KeyVals rows={rows} />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">No contexts</p>
      )}
    </Panel>
  );
}

export function UserPanel({ event }: { event: SentryEvent }) {
  const u = event.user;
  if (!u) return null;
  const rows = Object.entries(u).filter(([, v]) => v != null && v !== "");
  return (
    <Panel title="User">
      <KeyVals rows={rows} />
    </Panel>
  );
}

export function RequestPanel({ request }: { request: SentryRequestEntry | null }) {
  if (!request) return null;
  const headers = Array.isArray(request.headers) ? request.headers : [];
  const query = Array.isArray(request.query) ? request.query : [];
  return (
    <Panel title="Request">
      <div className="space-y-3">
        <div className="font-mono text-[11px] text-zinc-200 break-all">
          <span className="text-brand">{request.method ?? "GET"}</span> {request.url ?? ""}
        </div>
        {query.length > 0 && (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Query</div>
            <KeyVals rows={query as Array<[string, unknown]>} />
          </div>
        )}
        {headers.length > 0 && (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Headers</div>
            <KeyVals rows={headers as Array<[string, unknown]>} />
          </div>
        )}
        {request.data != null && (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Body</div>
            <pre className="max-h-72 overflow-auto rounded-lg border border-white/[0.06] bg-black/30 p-3 font-mono text-[11px] text-zinc-300">
              {typeof request.data === "string"
                ? request.data
                : JSON.stringify(request.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Panel>
  );
}

function crumbTime(ts?: string | number): string {
  if (ts == null) return "";
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleTimeString();
}

export function BreadcrumbsPanel({ crumbs }: { crumbs: SentryBreadcrumb[] }) {
  return (
    <Panel title="Breadcrumbs" count={crumbs.length} defaultOpen={false}>
      {crumbs.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-zinc-500">
                <th className="pb-2 pr-3 font-medium">Time</th>
                <th className="pb-2 pr-3 font-medium">Category</th>
                <th className="pb-2 pr-3 font-medium">Level</th>
                <th className="pb-2 font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {crumbs.map((c, i) => (
                <tr key={i} className="border-b border-white/[0.04] align-top">
                  <td className="whitespace-nowrap py-1.5 pr-3 font-mono text-[10px] text-zinc-500">
                    {crumbTime(c.timestamp)}
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-[11px] text-zinc-300">
                    {c.category ?? c.type ?? "—"}
                  </td>
                  <td className="py-1.5 pr-3">
                    <span className={`rounded border px-1.5 py-0.5 text-[9px] ${levelClass(c.level)}`}>
                      {c.level ?? "info"}
                    </span>
                  </td>
                  <td className="py-1.5 font-mono text-[11px] text-zinc-300 break-words">
                    {c.message ?? (c.data ? JSON.stringify(c.data) : "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">No breadcrumbs</p>
      )}
    </Panel>
  );
}

export function RawJsonPanel({ event }: { event: SentryEvent }) {
  return (
    <Panel title="Raw JSON" defaultOpen={false}>
      <pre className="max-h-[36rem] overflow-auto rounded-lg border border-white/[0.06] bg-black/30 p-3 font-mono text-[11px] text-zinc-300">
        {JSON.stringify(event, null, 2)}
      </pre>
    </Panel>
  );
}

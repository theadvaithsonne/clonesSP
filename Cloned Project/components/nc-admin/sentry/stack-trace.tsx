"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { SentryExceptionValue, SentryFrame } from "@/lib/nc-admin-api/admin-sentry";

/**
 * Sentry-faithful stack trace: chained exceptions, newest frame first, in-app
 * frames highlighted and expanded, with pre/error/post source context.
 */
export function StackTrace({ values }: { values: SentryExceptionValue[] }) {
  if (!values.length) {
    return <p className="text-xs text-zinc-500">No stack trace on this event.</p>;
  }
  return (
    <div className="space-y-5">
      {values.map((ex, i) => (
        <ExceptionBlock key={i} ex={ex} />
      ))}
    </div>
  );
}

function ExceptionBlock({ ex }: { ex: SentryExceptionValue }) {
  // Sentry renders frames newest-last from the API; the UI shows newest-first.
  const frames = (ex.stacktrace?.frames ?? []).slice().reverse();
  return (
    <div>
      <div className="mb-2">
        <span className="font-mono text-sm font-semibold text-red-300">
          {ex.type ?? "Error"}
        </span>
        {ex.value && (
          <span className="ml-2 font-mono text-xs text-zinc-300 break-words">
            {ex.value}
          </span>
        )}
        {ex.mechanism?.type && (
          <span className="ml-2 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-400">
            {ex.mechanism.type}
            {ex.mechanism.handled === false ? " · unhandled" : ""}
          </span>
        )}
      </div>
      {frames.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-white/[0.08]">
          {frames.map((f, i) => (
            <Frame key={i} frame={f} defaultOpen={!!f.inApp} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">No frames.</p>
      )}
    </div>
  );
}

function frameTitle(f: SentryFrame): { file: string; fn: string; loc: string } {
  const file = f.filename ?? f.module ?? f.absPath ?? "<unknown>";
  const fn = f.function ?? f.rawFunction ?? "?";
  const loc =
    f.lineNo != null ? `${f.lineNo}${f.colNo != null ? `:${f.colNo}` : ""}` : "";
  return { file, fn, loc };
}

function Frame({ frame, defaultOpen }: { frame: SentryFrame; defaultOpen: boolean }) {
  const ctx = frame.context ?? [];
  const [open, setOpen] = useState(defaultOpen && ctx.length > 0);
  const { file, fn, loc } = frameTitle(frame);
  const hasCtx = ctx.length > 0;

  return (
    <div
      className={`border-b border-white/[0.05] last:border-b-0 ${
        frame.inApp ? "bg-white/[0.02]" : "bg-transparent"
      }`}
    >
      <button
        type="button"
        onClick={() => hasCtx && setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${
          hasCtx ? "hover:bg-white/[0.03]" : "cursor-default"
        }`}
      >
        {hasCtx ? (
          <ChevronRight
            className={`h-3 w-3 shrink-0 text-zinc-500 transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="truncate font-mono text-[11px] text-zinc-300">
          <span className={frame.inApp ? "text-zinc-100" : "text-zinc-400"}>{file}</span>
          <span className="text-zinc-500"> in </span>
          <span className="text-brand">{fn}</span>
          {loc && <span className="text-zinc-500"> at line {loc}</span>}
        </span>
        {frame.inApp && (
          <span className="ml-auto shrink-0 rounded bg-brand/10 px-1.5 py-0.5 text-[9px] font-medium text-brand">
            in-app
          </span>
        )}
      </button>

      {open && hasCtx && (
        <div className="overflow-x-auto border-t border-white/[0.05] bg-black/30">
          <table className="w-full border-collapse font-mono text-[11px] leading-relaxed">
            <tbody>
              {ctx.map(([ln, src], i) => {
                const isErr = frame.lineNo != null && ln === frame.lineNo;
                return (
                  <tr
                    key={i}
                    className={isErr ? "bg-red-500/10" : "hover:bg-white/[0.02]"}
                  >
                    <td
                      className={`select-none whitespace-nowrap px-3 py-0.5 text-right ${
                        isErr ? "text-red-300" : "text-zinc-600"
                      }`}
                    >
                      {ln}
                    </td>
                    <td
                      className={`whitespace-pre px-3 py-0.5 ${
                        isErr ? "text-red-100" : "text-zinc-400"
                      }`}
                    >
                      {src || " "}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

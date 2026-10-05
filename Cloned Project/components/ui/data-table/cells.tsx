"use client";

import { useState } from "react";

/* Shared cell atoms for the Bigin-style DataTable — the vocabulary every
 * Deals table (Leads, Funnels, …) renders its cells with, so the pages read
 * as one surface. */

export function Dash() {
  return <span className="text-white/25">—</span>;
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

export function Avatar({
  src,
  name,
  size = 32,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const px = { width: size, height: size };
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        aria-hidden
        onError={() => setFailed(true)}
        className="shrink-0 rounded-full object-cover"
        style={px}
      />
    );
  }
  return (
    <span
      aria-hidden
      // rgba, not `bg-white/[0.06]` — the inline Deals shell repaints any
      // class containing "bg-white" to #13131a with !important.
      className="flex shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.06)] text-[11px] font-semibold tracking-tight text-white/70"
      style={px}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Person cell: avatar + name + secondary line. Degrades to "—" when empty. */
export function PersonBlock({
  name,
  email,
  avatar,
}: {
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
}) {
  if (!name && !email) return <Dash />;
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Avatar src={avatar} name={name} />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[13px] font-medium text-white/90">{name ?? "—"}</p>
        {email ? <p className="truncate text-[11px] text-white/45">{email}</p> : null}
      </div>
    </div>
  );
}

"use client";

// Chrome shared by the public careers page and job pages: the office's top bar
// ("Sign in" / "Powered by Garage") and the footer. Styled like the rest of
// the app's dark surfaces so a candidate moving from here into Garage doesn't
// feel the seam.

import React from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { OrgLogo } from "@/components/dashboard/jobs/ui";
import type { PublicOrg } from "./types";

/** Whether a Garage session exists in this browser. False during SSR/first paint. */
export function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = React.useState(false);
  React.useEffect(() => {
    setSignedIn(!!getToken());
  }, []);
  return signedIn;
}

/** `/login` that brings the visitor back to `redirect` once signed in. */
export function loginUrl(redirect: string, ref?: string | null): string {
  const q = new URLSearchParams({ flow: "login", redirect });
  if (ref) q.set("ref", ref);
  return `/login?${q.toString()}`;
}

export function PublicTopBar({ org }: { org: Pick<PublicOrg, "name" | "slug" | "icon"> | null }) {
  const signedIn = useSignedIn();
  const [here, setHere] = React.useState("/workspace");
  React.useEffect(() => {
    setHere(`${window.location.pathname}${window.location.search}`);
  }, []);
  return (
    <header className="sticky top-0 z-40 border-b border-[#1c1c24] bg-[#0c0c0e]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {org ? (
          <Link href={`/jobs/${encodeURIComponent(org.slug)}`} className="flex min-w-0 items-center gap-3">
            <OrgLogo name={org.name} src={org.icon} size={34} />
            <span className="truncate text-sm font-semibold text-white sm:text-base">{org.name}</span>
          </Link>
        ) : (
          <span className="text-sm font-semibold text-white">Garage Jobs</span>
        )}
        <div className="flex shrink-0 items-center gap-4">
          {signedIn ? (
            <Link href="/workspace" className="text-sm text-white hover:text-brand">
              Open Garage
            </Link>
          ) : (
            <Link href={loginUrl(here)} className="text-sm text-white hover:text-brand">
              Sign in
            </Link>
          )}
          <span className="hidden text-xs text-[#61627a] sm:inline">Powered by Garage</span>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter({ org }: { org: Pick<PublicOrg, "name" | "slug"> | null }) {
  return (
    <footer className="border-t border-[#1c1c24]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-[#61627a] sm:px-6">
        <span>
          {org ? (
            <Link href={`/jobs/${encodeURIComponent(org.slug)}`} className="hover:text-white">
              {org.name} careers
            </Link>
          ) : (
            "Careers"
          )}
          {" · "}
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
        </span>
        <span>Powered by Garage Jobs</span>
      </div>
    </footer>
  );
}

export function PublicState({ title, message, action }: { title: string; message?: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-lg font-semibold text-white">{title}</h1>
      {message && <p className="mt-2 max-w-md text-sm text-[#7c7d94]">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

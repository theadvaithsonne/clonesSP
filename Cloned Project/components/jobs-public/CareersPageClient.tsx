"use client";

// C1 · Public careers page — `/jobs/<office slug>`.
//
// Everything comes from GET /jobs/public/org/:slug: the office, the careers
// page the founder set up in Jobs → Settings, and every live role published
// with a public link. Roles link to their public page tagged
// `?source=careers_page` so applications are attributed to this page.

import React from "react";
import Link from "next/link";
import { ArrowRight, Briefcase, Clock, MapPin, Search } from "lucide-react";
import { Chip, OrgLogo } from "@/components/dashboard/jobs/ui";
import { EMPLOYMENT_LABELS, WORKPLACE_LABELS } from "@/components/dashboard/jobs/constants";
import { fetchCareersPage, PublicJobsError } from "./api";
import { PublicFooter, PublicState, PublicTopBar } from "./PublicShell";
import type { CareersResponse, PublicJob } from "./types";

function roleMeta(job: PublicJob): string {
  const place =
    job.workplace === "remote"
      ? job.locations[0]
        ? `Remote · ${job.locations[0]}`
        : "Remote"
      : [job.locations[0], job.locations.length > 1 ? `+${job.locations.length - 1}` : ""].filter(Boolean).join(" ");
  return [place, job.workplace !== "remote" ? WORKPLACE_LABELS[job.workplace] : "", EMPLOYMENT_LABELS[job.employmentType]]
    .filter(Boolean)
    .join(" · ");
}

export default function CareersPageClient({ orgSlug }: { orgSlug: string }) {
  const [data, setData] = React.useState<CareersResponse | null>(null);
  const [error, setError] = React.useState<{ status: number; message: string } | null>(null);
  const [query, setQuery] = React.useState("");
  const [department, setDepartment] = React.useState("");

  const load = React.useCallback(async () => {
    setError(null);
    try {
      setData(await fetchCareersPage(orgSlug));
    } catch (err) {
      setError({
        status: err instanceof PublicJobsError ? err.status : 0,
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }, [orgSlug]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0c0c0e]">
        <PublicTopBar org={null} />
        {error.status === 404 ? (
          <PublicState title="Careers page not found" message="This link doesn't match any office on Garage. Check the address and try again." />
        ) : (
          <PublicState
            title="Couldn't load this careers page"
            message={error.message}
            action={
              <button type="button" onClick={load} className="rounded-xl border border-[#262626] px-4 py-2 text-sm text-white hover:border-[#3a3a48]">
                Try again
              </button>
            }
          />
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0c0c0e]">
        <PublicTopBar org={null} />
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-10 sm:px-6">
          <div className="h-48 animate-pulse rounded-2xl bg-[#141414]" />
          <div className="h-8 w-64 animate-pulse rounded-lg bg-[#141414]" />
          <div className="h-16 animate-pulse rounded-xl bg-[#141414]" />
          <div className="h-16 animate-pulse rounded-xl bg-[#141414]" />
        </div>
      </div>
    );
  }

  const { org, careersPage, jobs } = data;
  const about = careersPage.about || org.description || "";
  const place = [org.city, org.country].filter(Boolean).join(", ");
  const departments = Array.from(new Set(jobs.map((j) => j.department).filter(Boolean) as string[])).sort();
  const q = query.trim().toLowerCase();
  const visible = jobs.filter(
    (j) =>
      (!department || j.department === department) &&
      (!q || [j.title, j.department, ...j.locations, ...j.skills].join(" ").toLowerCase().includes(q))
  );

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white">
      <PublicTopBar org={org} />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <section className="overflow-hidden rounded-2xl border border-[#262626] bg-[#141414]">
          {careersPage.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={careersPage.coverImage} alt="" className="h-40 w-full object-cover sm:h-56" />
          ) : (
            <div
              className="h-28 w-full sm:h-36"
              style={{ background: "radial-gradient(120% 120% at 15% 0%, color-mix(in srgb, var(--brand) 22%, transparent) 0%, transparent 60%), #16161d" }}
            />
          )}
          <div className="relative px-5 pb-6 sm:px-8">
            <div className="-mt-8 mb-4 w-fit rounded-xl border-4 border-[#141414] bg-[#141414]">
              <OrgLogo name={org.name} src={org.icon} size={56} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{org.name}</p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight text-white sm:text-3xl">
              {careersPage.headline || `Work at ${org.name}`}
            </h1>
            {about && <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-6 text-[#c7c7da]">{about}</p>}
            {place && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-[#7c7d94]">
                <MapPin className="h-3.5 w-3.5" /> {place}
              </p>
            )}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Open roles ({jobs.length})</h2>
            {jobs.length > 0 && (
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4f5065]" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search roles"
                    className="w-full rounded-lg border border-[#2a2a35] bg-[#141418] py-2 pl-9 pr-3 text-sm text-white placeholder:text-[#4f5065] focus:border-[#4a4a5c] focus:outline-none"
                  />
                </div>
                {departments.length > 1 && (
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="rounded-lg border border-[#2a2a35] bg-[#141418] px-3 py-2 text-sm text-[#c7c7da] focus:outline-none [&>option]:bg-[#141418]"
                    aria-label="Department"
                  >
                    <option value="">All departments</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#262626] px-6 py-14 text-center">
              <Briefcase className="mx-auto h-8 w-8 text-[#3a3a48]" />
              <p className="mt-3 text-sm font-semibold text-white">No open roles right now</p>
              <p className="mt-1 text-sm text-[#7c7d94]">{org.name} isn&apos;t hiring publicly at the moment. Check back soon.</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-[#262626] bg-[#141414] px-6 py-10 text-center text-sm text-[#7c7d94]">
              No roles match your search.
            </div>
          ) : (
            <ul className="space-y-2">
              {visible.map((job) => (
                <li key={job._id}>
                  <Link
                    href={`/jobs/${encodeURIComponent(org.slug)}/${encodeURIComponent(job.slug)}?source=careers_page`}
                    className="group flex items-center gap-4 rounded-xl border border-[#262626] bg-[#141414] px-4 py-4 transition-colors hover:border-[#3a3a48] sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white sm:text-base">{job.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#7c7d94]">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {roleMeta(job)}
                        </span>
                        {job.department && <span>{job.department}</span>}
                        {job.closesAt && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            Closes {new Date(job.closesAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="hidden items-center gap-1 text-sm text-[#c7c7da] group-hover:text-white sm:inline-flex">
                      View role <ArrowRight className="h-4 w-4" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-[#7c7d94] sm:hidden" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {(careersPage.culturePhotos.length > 0 || careersPage.perks.length > 0) && (
          <section className="mt-12">
            <h2 className="mb-4 text-lg font-semibold text-white">Life at {org.name}</h2>
            {careersPage.culturePhotos.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {careersPage.culturePhotos.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${src}-${i}`}
                    src={src}
                    alt=""
                    className="aspect-[4/3] w-full rounded-xl border border-[#262626] object-cover"
                  />
                ))}
              </div>
            )}
            {careersPage.perks.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {careersPage.perks.map((p) => (
                  <Chip key={p}>{p}</Chip>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <PublicFooter org={org} />
    </div>
  );
}

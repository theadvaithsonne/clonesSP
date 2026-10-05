"use client";

import React, { useState } from "react";
import { Search } from "lucide-react";
import { JoinAnotherOfficeTile, OfficeSwitcherCard } from "./OfficeCard";
import { BackLink, Pill } from "./ui";

export type MyOfficeTile = {
  id: string;
  name: string;
  icon?: string;
  subtitle: string;
  /** Awaiting a founder's approval. */
  pending: boolean;
};

/** Offices past which a name filter is worth showing. */
const FILTER_THRESHOLD = 8;

/** Every office you're in (and ones awaiting approval), one click to switch. */
export function MyOfficesView({
  offices,
  currentOrgId,
  loadingOrgId,
  onSelect,
  onFindMore,
  onBack,
}: {
  offices: MyOfficeTile[];
  currentOrgId: string | null;
  loadingOrgId: string | null;
  onSelect: (officeId: string) => void;
  onFindMore: () => void;
  /** Back to the Offices home. */
  onBack: () => void;
}) {
  const [filter, setFilter] = useState("");
  const query = filter.trim().toLowerCase();
  const shown = query ? offices.filter((o) => o.name.toLowerCase().includes(query)) : offices;

  return (
    <div className="flex flex-col gap-9">
      <div className="flex flex-col gap-5">
        <BackLink onClick={onBack} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2.5">
            <h1 className="text-[32px] font-semibold leading-tight text-[#f5f1e7] sm:text-[40px]">My offices</h1>
            <p className="max-w-[680px] text-[15px] leading-[1.5] text-[#aaa69c]">
              Every office you belong to. Pick one to switch into it.
            </p>
          </div>
          <Pill tone="neutral">
            {offices.length} {offices.length === 1 ? "office" : "offices"}
          </Pill>
        </div>
      </div>

      {offices.length > FILTER_THRESHOLD && (
        <label className="flex h-11 w-full max-w-[420px] items-center gap-2.5 rounded-full border border-[#2b2923] bg-[#121210] px-[15px] transition-colors focus-within:border-[#ffc200]">
          <Search className="size-[17px] shrink-0 text-[#747169]" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter your offices"
            aria-label="Filter your offices"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[#f5f1e7] outline-none placeholder:text-[#747169]"
          />
        </label>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {shown.map((office, i) => (
          <div
            key={office.id}
            className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
            style={{ animationDelay: `${Math.min(i, 12) * 25}ms`, animationFillMode: "both" }}
          >
            <OfficeSwitcherCard
              name={office.name}
              icon={office.icon}
              subtitle={office.subtitle}
              pending={office.pending}
              current={office.id === currentOrgId}
              loading={loadingOrgId === office.id}
              disabled={loadingOrgId !== null}
              onSelect={() => onSelect(office.id)}
            />
          </div>
        ))}
        {!query && <JoinAnotherOfficeTile onClick={onFindMore} />}
      </div>

      {query && shown.length === 0 && (
        <p className="text-center text-[13px] text-[#747169]">No offices match &ldquo;{filter.trim()}&rdquo;.</p>
      )}
    </div>
  );
}

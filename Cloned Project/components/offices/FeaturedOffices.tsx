"use client";

import React from "react";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrendingOffice } from "@/lib/discover-api";
import { OfficeCover } from "./OfficeCard";
import { SkeletonBar } from "./OfficesSkeletons";
import { Pill, PillButton, formatCount } from "./ui";

/** "+141 this week" — people who joined the office in the window. */
export function GrowthNote({ joins, days }: { joins: number; days: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#55c98a]">
      <TrendingUp className="size-3" />+{joins.toLocaleString()} {days === 7 ? "this week" : `in ${days} days`}
    </span>
  );
}

/** The week's most-joined offices: a wide lead card and a narrower runner-up. */
export function FeaturedOffices({
  offices,
  days,
  isMember,
  onOpen,
}: {
  offices: TrendingOffice[];
  days: number;
  isMember: (officeId: string) => boolean;
  onOpen: (office: TrendingOffice) => void;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-6", offices.length > 1 && "lg:grid-cols-[2fr_1fr]")}>
      {offices.map((office, i) => (
        <FeaturedCard
          key={office._id}
          office={office}
          lead={i === 0}
          days={days}
          member={isMember(office._id)}
          onOpen={() => onOpen(office)}
        />
      ))}
    </div>
  );
}

function FeaturedCard({
  office,
  lead,
  days,
  member,
  onOpen,
}: {
  office: TrendingOffice;
  lead: boolean;
  days: number;
  member: boolean;
  onOpen: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "group relative flex h-[340px] cursor-pointer flex-col justify-between overflow-hidden rounded-[28px] border border-[rgba(229,184,92,0.3)] p-6 shadow-[0_10px_30px_rgba(214,155,48,0.2)] outline-none transition-colors hover:border-[rgba(229,184,92,0.55)] focus-visible:border-[#ffc200] sm:h-[390px]",
        lead && "sm:p-[34px]"
      )}
    >
      <OfficeCover
        office={office}
        logoClassName={lead ? "left-[74%] top-[40%] size-[120px]" : "left-[72%] top-[34%] size-[88px]"}
      />
      <div
        className={cn(
          "absolute inset-0",
          lead
            ? "bg-[linear-gradient(244.6deg,rgba(9,9,8,0.133)_12.353%,rgba(9,9,8,0.8)_63.176%,rgba(9,9,8,0.98)_91.765%)]"
            : "bg-[linear-gradient(256.9deg,rgba(9,9,8,0.133)_12.353%,rgba(9,9,8,0.8)_63.176%,rgba(9,9,8,0.98)_91.765%)]"
        )}
      />
      {/* Keeps the copy readable on bright covers, whatever the angle above leaves. */}
      <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-[rgba(9,9,8,0.92)] via-[rgba(9,9,8,0.55)] to-transparent" />

      <div className="relative flex items-center gap-2">
        <Pill tone="accent">Featured</Pill>
        {member && <Pill tone="success">Joined</Pill>}
      </div>

      <div className={cn("relative flex flex-col gap-3", lead && "max-w-[560px]")}>
        <h3
          className={cn(
            "line-clamp-2 font-semibold leading-[1.08] text-[#f5f1e7]",
            lead ? "text-[30px] sm:text-[38px]" : "text-[28px]"
          )}
        >
          {office.name}
        </h3>
        {office.description && (
          <p className="line-clamp-2 text-[15px] leading-[1.5] text-[#aaa69c]">{office.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <PillButton
            variant="primary"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            <ArrowUpRight className="size-4" />
            {member ? "Open office" : "Visit office"}
          </PillButton>
          {!!office.memberCount && (
            <span className="text-[13px] text-[#aaa69c]">{formatCount(office.memberCount)} members</span>
          )}
          <GrowthNote joins={office.recentJoins} days={days} />
        </div>
      </div>
    </div>
  );
}

export function FeaturedOfficesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
      {[true, false].map((lead) => (
        <div
          key={String(lead)}
          className={cn(
            "flex h-[340px] flex-col justify-between rounded-[28px] border border-[#2b2923] bg-[#121210] p-6 sm:h-[390px]",
            lead && "sm:p-[34px]"
          )}
        >
          <SkeletonBar className="h-7 w-[84px] rounded-full" />
          <div className="flex flex-col gap-3">
            <SkeletonBar className={cn("h-9", lead ? "w-[340px] max-w-[80%]" : "w-[220px] max-w-[80%]")} />
            <SkeletonBar className="h-4 w-[420px] max-w-[90%]" />
            <div className="flex items-center gap-3">
              <SkeletonBar className="h-11 w-[128px] rounded-full" />
              <SkeletonBar className="h-3.5 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { Compass } from "lucide-react";
import { SkeletonBar } from "./OfficesSkeletons";
import { Eyebrow, PillButton } from "./ui";

/** Exact live count from the directory, grouped for readability ("1,284"). */
function formatOfficeTotal(total: number): string {
  return total.toLocaleString("en-US");
}

export function HubHero({ officeTotal, loading }: { officeTotal: number | null; loading: boolean }) {
  return (
    <section className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
      <div className="flex max-w-[740px] flex-col gap-3">
        <Eyebrow>Community, organized</Eyebrow>
        <h1 className="text-[40px] font-semibold leading-[1.04] text-[#f5f1e7] sm:text-[56px]">
          Find your people.
          <br />
          Build what matters.
        </h1>
        <p className="max-w-[620px] text-[15px] leading-[1.5] text-[#aaa69c] sm:text-[17px]">
          Switch between the offices you call home, then discover thoughtful communities built around the work you
          care about.
        </p>
      </div>
      {loading ? (
        <div className="flex shrink-0 flex-col gap-2 lg:items-end">
          <SkeletonBar className="h-10 w-28" />
          <SkeletonBar className="h-3.5 w-32" />
        </div>
      ) : officeTotal !== null && officeTotal > 0 && (
        <div className="flex shrink-0 flex-col gap-1.5 animate-in fade-in-0 duration-300 lg:items-end">
          <p className="text-[40px] font-semibold leading-none text-[#ffc200]">{formatOfficeTotal(officeTotal)}</p>
          <p className="text-[13px] text-[#aaa69c]">offices on Garage</p>
        </div>
      )}
    </section>
  );
}

const NUMBER_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five"];

/** The new-member nudge: a ring showing how many of `goal` offices are joined. */
export function GettingStartedCard({
  joined,
  goal,
  onDiscover,
}: {
  joined: number;
  goal: number;
  onDiscover: () => void;
}) {
  const remaining = Math.max(goal - joined, 0);
  const title =
    joined === 0
      ? "Join your first office"
      : `${NUMBER_WORDS[remaining] ?? remaining} more ${remaining === 1 ? "office makes" : "offices make"} Garage yours`;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(joined / goal, 1);

  return (
    <section className="flex flex-col items-start gap-7 rounded-[28px] border border-[rgba(229,184,92,0.3)] bg-[#181713] p-7 md:flex-row md:items-center">
      <div className="relative size-[108px] shrink-0">
        <svg viewBox="0 0 108 108" className="size-full -rotate-90" aria-hidden>
          <circle cx="54" cy="54" r={radius} fill="rgba(229,184,92,0.1)" stroke="rgba(229,184,92,0.18)" strokeWidth="6" />
          <circle
            cx="54"
            cy="54"
            r={radius}
            fill="none"
            stroke="#ffc200"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[28px] font-bold text-[#ffc200]">
          {joined}/{goal}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[9px]">
        <Eyebrow>Getting started</Eyebrow>
        <h2 className="text-[24px] font-semibold leading-tight text-[#f5f1e7] sm:text-[28px]">{title}</h2>
        <p className="max-w-[660px] text-[15px] leading-[1.5] text-[#aaa69c]">
          Pick communities around the work you care about, then switch between them in one click.
        </p>
      </div>
      <PillButton variant="primary" onClick={onDiscover}>
        <Compass className="size-4" />
        Discover offices
      </PillButton>
    </section>
  );
}

export function OfficesFooter({ onCreateOffice }: { onCreateOffice: () => void }) {
  return (
    <footer className="flex flex-col gap-6 border-t border-[#2b2923] pt-7 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2">
        <p className="text-[16px] font-bold text-[#f5f1e7]">GARAGE</p>
        <p className="text-[13px] text-[#747169]">The room where meaningful work begins.</p>
      </div>
      <nav className="flex gap-6 text-[13px] text-[#aaa69c]">
        <Link href="/" className="hover:text-[#f5f1e7]">
          About
        </Link>
        <Link href="/privacy" className="hover:text-[#f5f1e7]">
          Privacy
        </Link>
      </nav>
      <PillButton onClick={onCreateOffice} className="self-start sm:self-auto">
        Create an office
      </PillButton>
    </footer>
  );
}

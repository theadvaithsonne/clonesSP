"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { OfficeCardSkeleton, OfficeSwitcherSkeleton } from "./OfficeCard";
import { Atmosphere } from "./ui";

/** One placeholder bar, in the design's loading colour. */
export function SkeletonBar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("animate-pulse rounded-[10px] bg-[#24221d]", className)} style={style} />;
}

const CHIP_WIDTHS = [112, 98, 106, 90, 118, 92];

export function ChipRowSkeleton() {
  return (
    <div className="flex gap-2.5 overflow-hidden">
      {CHIP_WIDTHS.map((w, i) => (
        <SkeletonBar key={i} className="h-[42px] shrink-0 rounded-full" style={{ width: w }} />
      ))}
    </div>
  );
}

function SectionHeadingSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <SkeletonBar className="h-3 w-28" />
      <SkeletonBar className="h-7 w-56" />
    </div>
  );
}

/** "Finding offices worth your time…" under a loading grid. */
export function LoadingMessage() {
  return (
    <p className="flex items-center justify-center gap-2.5 text-[13px] text-[#747169]">
      <span className="size-2 animate-pulse rounded-full bg-[#ffc200]" />
      Finding offices worth your time…
    </p>
  );
}

function TopBarSkeleton() {
  return (
    <header className="sticky top-0 z-40 h-[76px] border-b border-[#2b2923] bg-[#0d0d0b]">
      <div className="mx-auto flex h-full max-w-[1440px] items-center gap-4 px-4 sm:px-8 lg:px-16">
        <div className="flex flex-1 items-center">
          <Image src="/logo.svg" alt="Garage" width={146} height={31} priority className="h-[26px] w-auto sm:h-[31px]" />
        </div>
        <div className="hidden h-11 w-full max-w-[520px] rounded-full border border-[#2b2923] bg-[#121210] md:block" />
        <div className="flex flex-1 items-center justify-end gap-2.5">
          <SkeletonBar className="h-11 w-11 rounded-full lg:w-[150px]" />
          <SkeletonBar className="h-11 w-11 rounded-full sm:w-[140px]" />
          <SkeletonBar className="size-[34px] rounded-full" />
        </div>
      </div>
    </header>
  );
}

/**
 * The whole Offices page while the member and their offices load, shaped
 * like the screen that's coming: the hub, a list, or "My offices".
 */
export function OfficesPageSkeleton({ variant }: { variant: "hub" | "list" | "mine" }) {
  return (
    <div
      aria-busy
      aria-label="Loading offices"
      className="relative min-h-screen bg-[#090908] font-[family-name:var(--font-chat)] text-[#f5f1e7] antialiased"
    >
      <Atmosphere />
      <TopBarSkeleton />
      <main className="relative mx-auto flex max-w-[1440px] flex-col gap-9 px-4 pb-16 pt-10 sm:px-8 sm:pt-12 lg:px-16 lg:pt-[54px]">
        {variant === "hub" ? (
          <div className="flex flex-col gap-[72px]">
            <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
              <div className="flex w-full max-w-[740px] flex-col gap-3">
                <SkeletonBar className="h-3 w-40" />
                <SkeletonBar className="h-12 w-[520px] max-w-[90%]" />
                <SkeletonBar className="h-12 w-[480px] max-w-[80%]" />
                <SkeletonBar className="mt-2 h-4 w-[560px] max-w-[95%]" />
                <SkeletonBar className="h-4 w-[420px] max-w-[70%]" />
              </div>
              <div className="flex flex-col gap-2 lg:items-end">
                <SkeletonBar className="h-10 w-28" />
                <SkeletonBar className="h-3.5 w-32" />
              </div>
            </div>
            <div className="flex flex-col gap-[22px]">
              <SectionHeadingSkeleton />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <OfficeSwitcherSkeleton key={i} />
                ))}
              </div>
            </div>
            <ChipRowSkeleton />
            <div className="flex flex-col gap-[22px]">
              <SectionHeadingSkeleton />
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <OfficeCardSkeleton key={i} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3.5">
              <SkeletonBar className="h-10 w-[260px] max-w-full" />
              <SkeletonBar className="h-4 w-[540px] max-w-full" />
            </div>
            {variant === "list" ? (
              <>
                <ChipRowSkeleton />
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <OfficeCardSkeleton key={i} />
                  ))}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <OfficeSwitcherSkeleton key={i} />
                ))}
              </div>
            )}
            <LoadingMessage />
          </>
        )}
      </main>
    </div>
  );
}

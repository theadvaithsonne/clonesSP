"use client";

import React, { useState } from "react";
import { ArrowUpRight, ChevronRight, Clock, Loader2, Plus, CirclePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { OfficeEmblem, Pill, PillButton, initials, isNewOffice, membersLabel } from "./ui";

/** What an office card needs; `/discover/organizations` rows fit as-is. */
export type OfficeCardData = {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  coverPhoto?: string;
  category?: string;
  memberCount?: number;
  createdAt?: string;
};

const CARD_SURFACE =
  "rounded-[20px] border bg-[#121210] shadow-[0_18px_42px_rgba(0,0,0,0.4)]";

/**
 * A discoverable office: cover, emblem, name, members · category, and a
 * description. The whole card opens it; the arrow visits its public page.
 */
export function OfficeCard({
  office,
  onOpen,
  footer,
  highlighted,
}: {
  office: OfficeCardData;
  onOpen: () => void;
  /** Bottom row, e.g. a "Joined" or "Request pending" pill. */
  footer?: React.ReactNode;
  /** Accent border, used for offices you're already in. */
  highlighted?: boolean;
}) {
  // A brand-new office's "0 members" reads as broken, so it's left out.
  const members = office.memberCount ? membersLabel(office.memberCount) : null;

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
        CARD_SURFACE,
        "group flex h-[378px] cursor-pointer flex-col overflow-hidden text-left outline-none transition-colors focus-visible:border-[#ffc200]",
        highlighted
          ? "border-[rgba(229,184,92,0.3)] hover:border-[rgba(229,184,92,0.55)]"
          : "border-[#2b2923] hover:border-[#3a362c]"
      )}
    >
      <div className="relative h-[178px] w-full shrink-0 overflow-hidden">
        <OfficeCover office={office} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[rgba(9,9,8,0.8)]" />
        {isNewOffice(office.createdAt) && (
          <div className="absolute left-3.5 top-3.5">
            <Pill tone="accent">New</Pill>
          </div>
        )}
        <OfficeEmblem
          name={office.name}
          icon={office.icon}
          className="absolute bottom-4 left-[18px] size-[42px] rounded-[14px] border-2 border-black"
          textClassName="text-[18px]"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 px-[18px] pb-[18px] pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="truncate text-[20px] font-semibold text-[#f5f1e7]">{office.name}</h3>
          {office.slug && (
            <a
              href={`/hq/${office.slug}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Visit office page"
              aria-label={`Visit ${office.name}'s page`}
              className="-m-1 shrink-0 rounded-md p-1 text-[#747169] transition-colors hover:bg-white/[0.05] hover:text-[#f5f1e7]"
            >
              <ArrowUpRight className="size-4" />
            </a>
          )}
        </div>
        {(members || office.category) && (
          <div className="flex min-w-0 items-center gap-[7px] text-[11px] text-[#aaa69c]">
            {members && <span className="shrink-0">{members}</span>}
            {members && office.category && <span className="size-[3px] shrink-0 rounded-full bg-[#747169]" />}
            {office.category && <span className="truncate">{office.category}</span>}
          </div>
        )}
        {office.description && (
          <p className="line-clamp-3 text-[13px] leading-[1.5] text-[#aaa69c]">{office.description}</p>
        )}
        {footer && <div className="mt-auto flex items-center justify-between gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * The card's cover, from the office's own images: its cover photo, else its
 * logo as a blurred wash with the mark on top, else the lettered stand-in.
 * The layer underneath shows until the photo has loaded (or if it fails),
 * and images fade in rather than painting line by line.
 */
export function OfficeCover({
  office,
  logoClassName,
}: {
  office: OfficeCardData;
  /** Size/position of the mark on a logo cover (defaults to card size). */
  logoClassName?: string;
}) {
  const [coverState, setCoverState] = useState<"loading" | "loaded" | "failed">("loading");
  const showPhoto = !!office.coverPhoto && coverState !== "failed";

  return (
    <>
      {office.icon ? (
        <LogoCover icon={office.icon} logoClassName={logoClassName} />
      ) : (
        <CoverFallback name={office.name} />
      )}
      {showPhoto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={office.coverPhoto}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setCoverState("loaded")}
          onError={() => setCoverState("failed")}
          className={cn(
            "absolute inset-0 size-full object-cover transition-[opacity,transform] duration-500 group-hover:scale-[1.03]",
            coverState === "loaded" ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </>
  );
}

function LogoCover({ icon, logoClassName }: { icon: string; logoClassName?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#161512]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={icon}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          "absolute left-1/2 top-1/2 size-[150%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover blur-2xl saturate-150 transition-opacity duration-500",
          loaded ? "opacity-50" : "opacity-0"
        )}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={icon}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn(
          "absolute left-1/2 top-[42%] size-[72px] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.5)] transition-[opacity,transform] duration-500 group-hover:scale-105",
          logoClassName,
          loaded ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}

/** Stand-in for offices with neither a cover photo nor a logo. */
function CoverFallback({ name }: { name: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(120%_90%_at_85%_0%,rgba(229,184,92,0.22),rgba(18,18,16,0)_60%),linear-gradient(160deg,#211d15,#121210)]">
      <span className="absolute -right-3 -top-6 select-none text-[150px] font-bold leading-none text-[#ffc200]/[0.07]">
        {initials(name, 1)}
      </span>
    </div>
  );
}

export function OfficeCardSkeleton() {
  return (
    <div className="flex h-[378px] flex-col overflow-hidden rounded-[20px] border border-[#2b2923] bg-[#121210]">
      <div className="h-[178px] w-full shrink-0 animate-pulse bg-[#24221d]" />
      <div className="flex flex-col gap-3.5 p-[18px]">
        <div className="h-5 w-[180px] max-w-full animate-pulse rounded-[10px] bg-[#24221d]" />
        <div className="h-3 w-[116px] animate-pulse rounded-[10px] bg-[#24221d]" />
        <div className="h-3 w-full animate-pulse rounded-[10px] bg-[#24221d]" />
        <div className="h-3 w-[224px] max-w-full animate-pulse rounded-[10px] bg-[#24221d]" />
        <div className="h-3 w-[90px] animate-pulse rounded-[10px] bg-[#24221d]" />
      </div>
    </div>
  );
}

/** The accent tile that sits after your own offices. */
export function FindOfficeCard({ onExplore }: { onExplore: () => void }) {
  return (
    <div className="flex h-[378px] flex-col items-center justify-center gap-4 rounded-[20px] border border-[rgba(229,184,92,0.3)] bg-[rgba(229,184,92,0.1)] p-7 text-center">
      <div className="flex size-[54px] items-center justify-center rounded-full bg-[#ffc200]">
        <Plus className="size-6 text-black" />
      </div>
      <p className="text-[20px] font-semibold text-[#f5f1e7]">Find your next office</p>
      <p className="w-[240px] max-w-full text-[13px] leading-[1.5] text-[#aaa69c]">
        Browse communities built around the work you care about.
      </p>
      <PillButton onClick={onExplore}>Explore</PillButton>
    </div>
  );
}

/** One office in the "Your offices" one-click switcher. */
export function OfficeSwitcherCard({
  name,
  icon,
  subtitle,
  current,
  pending,
  loading,
  disabled,
  onSelect,
}: {
  name: string;
  icon?: string;
  subtitle: string;
  /** The office this session is signed into. */
  current?: boolean;
  /** Awaiting a founder's approval — shown, not enterable. */
  pending?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={pending || disabled}
      className={cn(
        "flex h-[112px] w-full min-w-0 items-center gap-3.5 rounded-[20px] border p-[18px] text-left transition-colors",
        current
          ? "border-[#ffc200] bg-[#181713]"
          : "border-[#2b2923] bg-[#121210] enabled:hover:border-[#3a362c] enabled:hover:bg-[#161512]",
        pending && "cursor-default opacity-70",
        disabled && !pending && "cursor-wait"
      )}
    >
      <div
        className={cn(
          "flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2",
          // A logo keeps the dark disc (see OfficeEmblem); the current office
          // shows it with an accent ring instead of an accent fill.
          icon
            ? cn("bg-[#201e18]", current ? "border-[#ffc200]" : "border-[#090908]")
            : current
              ? "border-[#090908] bg-[#ffc200] text-black"
              : "border-[#090908] bg-[#201e18] text-[#f5f1e7]"
        )}
      >
        {icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt="" className="size-full object-contain p-[16%]" />
        ) : (
          <span className="text-[15.36px] font-bold">{initials(name)}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[15px] font-semibold text-[#f5f1e7]">{name}</p>
          {current && <span className="size-[7px] shrink-0 rounded-full bg-[#55c98a]" title="Current office" />}
        </div>
        <p className="flex items-center gap-1 truncate text-[13px] text-[#aaa69c]">
          {pending && <Clock className="size-3 shrink-0" />}
          {subtitle}
        </p>
      </div>
      {!pending &&
        (loading ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-[#ffc200]" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-[#747169]" />
        ))}
    </button>
  );
}

export function JoinAnotherOfficeTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[112px] w-full flex-col items-center justify-center gap-[9px] rounded-[20px] border border-[rgba(229,184,92,0.3)] bg-[rgba(229,184,92,0.1)] transition-colors hover:bg-[rgba(229,184,92,0.16)]"
    >
      <CirclePlus className="size-[22px] text-[#ffc200]" />
      <span className="text-[13px] font-semibold text-[#ffc200]">Join another office</span>
    </button>
  );
}

export function OfficeSwitcherSkeleton() {
  return (
    <div className="flex h-[112px] items-center gap-3.5 rounded-[20px] border border-[#2b2923] bg-[#121210] p-[18px]">
      <div className="size-12 shrink-0 animate-pulse rounded-full bg-[#24221d]" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-4 w-2/3 animate-pulse rounded-[10px] bg-[#24221d]" />
        <div className="h-3 w-1/2 animate-pulse rounded-[10px] bg-[#24221d]" />
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import { BAT246_DISPLAY_NAME } from "@/lib/bat246Office";

/**
 * Pieces of the bat246.com login and verify pages (see useIsBat246Domain).
 * Everywhere else those pages keep the Garage chrome.
 */

/**
 * bat246.com sizing. Its members skew older, so every line of text is set for
 * low eyesight: nothing under 16px, and the disclaimer is lifted to the
 * subtitle grey because the default #6a6a7a is too faint on this background.
 */
export const BAT246_AUTH_BUTTON_CLASS = "h-[60px] sm:h-[70px] text-[17.5px] sm:text-xl";
export const BAT246_AUTH_BUTTON_ICON_CLASS = "w-5 h-5 sm:w-6 sm:h-6";
/** The email / phone field, matched to the button height. */
export const BAT246_AUTH_INPUT_ROW_CLASS = "h-[60px] sm:h-[70px]";
// Important: app/globals.css pins `input { font-size: 16px }` outside any
// layer, which beats a plain utility. The placeholder has its own size in
// components/ui/input.tsx, so it is set too.
export const BAT246_AUTH_INPUT_TEXT_CLASS = "text-lg! placeholder:text-lg";
export const BAT246_AUTH_DISCLAIMER_CLASS = "text-base sm:text-lg text-[#9fa0b8]";
export const BAT246_AUTH_SUBTITLE_CLASS = "text-lg sm:text-xl text-[#9fa0b8]";
export const BAT246_AUTH_BACK_CLASS = "text-base sm:text-lg";
/** "Use a different email or number" / "Resend" on the verify step. */
export const BAT246_AUTH_LINKS_CLASS = "text-base sm:text-lg";

/** Replaces the city-lights photo: plain black with the B2 coin. */
export function Bat246LeftPanel() {
  return (
    <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] items-center justify-center bg-black">
      <Image
        src="/images/bat246-b2coin-on-black.png"
        alt="B2"
        width={638}
        height={652}
        className="w-[55%] max-w-[420px] h-auto"
        priority
      />
    </div>
  );
}

/**
 * Replaces the Garage logo at the top of the form. Below `lg` the left panel
 * is hidden, so the coin moves up here instead.
 */
export function Bat246Title() {
  return (
    <div className="flex flex-col items-center gap-3">
      <Image
        src="/images/bat246-b2coin-on-black.png"
        alt="B2"
        width={638}
        height={652}
        className="lg:hidden w-20 sm:w-24 h-auto"
        priority
      />
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-wide text-white text-center">
        {BAT246_DISPLAY_NAME}
      </h1>
    </div>
  );
}

/** Pinned to the bottom-right of the (relative) right panel. */
export function Bat246PoweredBy() {
  return (
    <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex items-center gap-1.5 opacity-80">
      <span className="text-[10px] uppercase tracking-wider text-[#6a6a7a]">
        Powered by
      </span>
      <Image
        src="/logo.svg"
        alt="Garage"
        width={130}
        height={40}
        className="h-4 w-auto"
      />
    </div>
  );
}

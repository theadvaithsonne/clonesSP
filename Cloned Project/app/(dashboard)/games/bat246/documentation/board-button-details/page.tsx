"use client";

import Link from "next/link";
import { ChevronLeft, Printer, Share2, Check } from "lucide-react";
import { useState } from "react";

interface ButtonDoc {
  num: number;
  label: string;
  imgSrc: string;
  description: string;
  solution: string;
  extraHeading?: string;
  bullets?: string[];
}

const BUTTON_DOCS: ButtonDoc[] = [
  {
    num: 1,
    label: "Layaway - Reserve",
    imgSrc: "/images/bat246-doc-layaway.svg",
    description:
      "How many times have you wanted to purchase something on sale or buy the last available product, yet the bank account is strained until payday? Some stores agree to putting an item aside, giving you a short period of time to pay for it. This is a Layaway.",
    solution:
      "Whenever you have guaranteed revenues coming from a Sales Team (BAT 246 Board), you can take advantage of our Layaway option. Simply pick your product and it will be set aside, confirmed as yours. You will also earn your free board position. The Layaway - Reserve button will simply collect the amount owed from your board earnings until the Layaway has been fully paid, at which point the product will be released to you. The amount available for Layaway is determined by your position and income on the Sales Team Board as follows:",
    extraHeading: "Layaway amount available when collecting on the following positions…",
    bullets: [
      "Baseball Card: At Home Plate or you're now collecting it in the Hot Box = $1,600",
      "Gray Card: 1 of 4 POD Team Gray Card or 1 of up to 4 for Free Gray Card = $400 each",
      "Leader Board Positions: Triple = $100, Home Run = $200, Grand Slam = $300",
      "Matching Bonus: Your personal recruit is now collecting at Home Base $1,600 (1 of up to 4 Gray Card Owners = $400 each)",
    ],
  },
  {
    num: 2,
    label: "Snap-Back Loans",
    imgSrc: "/images/bat246-doc-snapback.svg",
    description:
      "Sometimes, people will have a desire to purchase a product from you but might ask for a loan to make said purchase. As a friend, you might feel compelled to offer such a loan but are reluctant due to repayment risks? Generally, you want to keep from loaning all the money as it leaves the borrower with “no skin in the game” so to speak. The borrower becomes less likely to work the business as it was intended. This in turn reduces their desire to do.",
    solution:
      "If you feel the desire to loan some of the money, it's only fair you get paid back as soon as the borrower starts making money! The “Snap-back Loans” Button will assure you get repaid by having the borrower commit to paying you back with their next upcoming BAT 246 earnings. As they earn money, it will automatically be paid to you until the loan is fully paid back!",
  },
  {
    num: 3,
    label: "Messaging",
    imgSrc: "/images/bat246-doc-messaging.svg",
    description:
      "Contacting your Team is always a good idea. With the “Messaging” Button, members can answer each other's questions as well as help each other to create Sales, which in turn helps fill the Sales Team faster. Such communication could also be used for strategic purposes.",
    solution:
      "The “Messaging” Button allows you to easily communicate with any of your other Team members.",
  },
  {
    num: 4,
    label: "Pre-Pick",
    imgSrc: "/images/bat246-doc-prepick.svg",
    description:
      "You have a Distributor coming on your Team and you strategically want to place them in a specific At Bat position.",
    solution:
      "You can use the “Pre-Pick” Button to pre-pick your first two choices as to which At Bat position you want the new Team member to be placed, as well as the Entry you want the Baseball Card attached to, as well as your Board of choice.",
  },
  {
    num: 5,
    label: "Penciling",
    imgSrc: "/images/bat246-doc-penciling.svg",
    description:
      "Sometimes, you may have a person who decides they want to buy a product and receive the free Entry, and you want them to be placed in a particular At Bat position. The problem is they need a short while to make payment, and you fear losing the board position you want to use.",
    solution:
      "With the “Penciling” Button, all you have to do is write your prospect's name in the At Bat position of your choice and it will automatically lock up that position for up to 24 hours. However, there must always be an available position for a paying prospect. If there is a sale and only one empty position remaining At Bat, the most recent Penciled name will be removed! Penciling will take precedence over Pre-Pick only when it's the same person's name entering! Each Team Member is only allowed one Penciled name at a time and only 1st Base can use the Penciling Button during the Protection Period! A Penciled name can be removed at any time or changed to someone else only by the original Penciling user!",
  },
  {
    num: 6,
    label: "Warp Speed",
    imgSrc: "/images/bat246-doc-warp.svg",
    description:
      "Since the Protection Period (PP) is 120 hours, there will be times during the PP when someone on 1st base has no intention of trying to get his two sales. Maybe he is going on holiday or anticipating being too busy to make sales. This holds up the other team members for no reason!",
    solution:
      "Each Entry on 1st Base has a “Warp Speed” Button. If the Distributor knows for sure they are not doing any more sales within the PP, they can use the “Warp Speed” Button giving up their right to the balance of the Protection Period. The clock will automatically be stopped (PP ended) once all four Entries on 1st Base either have two sales or press the “Warp Speed” Button.",
  },
  {
    num: 7,
    label: "Speed The Board Up",
    imgSrc: "/images/bat246-doc-speedup.svg",
    description:
      "The faster the board moves and splits, the better the ability of the people on board becomes at making sales, thus the harder they are willing to work.",
    solution:
      "“Speed The Board Up” Button shares with you the best ways to do exactly that! We have put together 9 very effective ways to “Speed The Board Up” that will surely increase sales and strengthen your Board Team.",
  },
  {
    num: 8,
    label: "Gift Card",
    imgSrc: "/images/bat246-doc-giftcard.svg",
    description:
      "Whenever you would like to pay for someone's product and are not sure what product they would buy?",
    solution:
      "The Gift Card is the answer, allowing you to give anyone a product that BAT 246 has!",
  },
];

export default function Bat246BoardButtonDetailsPage() {
  const [copied, setCopied] = useState(false);

  const handlePrint = () => window.print();

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Board Buttons — BAT 246", url });
      } catch {
        /* user cancelled the share sheet — no-op */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="bat246-doc-print-root w-full h-full overflow-y-auto bg-[#525659] text-black flex flex-col items-center print:bg-white" style={{ colorScheme: "light" }}>
      {/* Print rules: standard margin regardless of A4 vs Letter, and never
          split a button's image+text block across a page boundary.

          The dashboard shell around this page clips overflow with a fixed
          viewport height (needed for its own internal scrolling), which
          would otherwise cut print output down to a single page. Fixing
          this takes two parts:
          - position: absolute (not fixed — fixed elements never paginate
            in Chrome's print engine, they just get truncated to one page)
            lifts this element out of the shell's flow, using the
            visibility trick to hide everything else.
          - .overflow-hidden / height utilities get force-reset for print,
            since the shell's outer wrapper (one level further out than
            this element's own containing block) is what's actually doing
            the clipping — absolute positioning alone can't escape a clip
            enforced by a more distant ancestor. Scoped with :has() to only
            match genuine ANCESTORS of this element — an unscoped reset
            would also hit unrelated same-classed elements inside our own
            content (e.g. each button image's rounded-corner crop mask uses
            overflow-hidden too; resetting that let the raw artwork balloon
            to its native size instead of staying cropped). */}
      <style>{`
        @page { margin: 14mm; margin-top: 8mm; }
        @media print {
          /* Chrome drops background-color/background-image by default when
             printing (the "Background graphics" checkbox is off unless the
             user opts in) — this forces the numbered badges, card shadows,
             etc. to always print with their real fill instead of turning
             into hollow outlines. */
          .bat246-doc-print-root, .bat246-doc-print-root * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .pdf-toolbar { display: none; }
          body * { visibility: hidden; }
          .bat246-doc-print-root, .bat246-doc-print-root * { visibility: visible; }
          .bat246-doc-print-root {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            height: auto !important;
            overflow: visible !important;
            width: 100% !important;
          }
          .overflow-hidden:has(.bat246-doc-print-root),
          .overflow-auto:has(.bat246-doc-print-root),
          .h-dvh:has(.bat246-doc-print-root),
          .h-full:has(.bat246-doc-print-root),
          .h-screen:has(.bat246-doc-print-root) {
            overflow: visible !important;
            height: auto !important;
          }
          /* The dashboard shell wraps this page in a relative-positioned
             grid container (app/(dashboard)/layout.tsx's main grid div)
             plus other positioned wrappers. Any one of them becomes the
             containing block for the position:absolute;top:0 rule above,
             so top:0 lands at THAT ancestor's box origin instead of the
             true page top — and whatever's still occupying space above it
             (visibility:hidden keeps the box, just hides content) pushes
             our content down as a blank gap. Stripping position from every
             real ancestor bubbles the containing-block search all the way
             up to the page itself, so top:0 is finally the actual page top
             regardless of what the (invisible) shell above it is doing. */
          *:has(.bat246-doc-print-root) {
            position: static !important;
          }
        }
      `}</style>

      {/* PDF-viewer-style toolbar — sticky dark bar with back nav, filename,
          and Share / Print actions (mirrors the browser's built-in PDF viewer). */}
      <div className="pdf-toolbar sticky top-0 z-20 w-full bg-[#323639] text-white shadow-md">
        <div className="w-full h-12 px-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/games/bat246/documentation"
              className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-[13px] font-medium transition-colors group flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              Documentation
            </Link>
            <span className="text-white/30 hidden sm:inline">|</span>
            <span className="text-[13px] font-medium text-white/90 truncate">Board Buttons.pdf</span>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleShare}
              title="Share"
              className="relative flex items-center gap-1.5 px-2.5 sm:px-3 h-8 rounded hover:bg-white/10 transition-colors text-[13px] font-medium"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? "Copied!" : "Share"}</span>
            </button>
            <button
              onClick={handlePrint}
              title="Print"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 h-8 rounded hover:bg-white/10 transition-colors text-[13px] font-medium"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-2 sm:mx-5 w-full sm:w-auto bg-white shadow-xl print:shadow-none px-4 sm:px-8 md:px-12 py-6 sm:py-10 mt-4 sm:mt-8 mb-6 sm:mb-10 print:max-w-none print:mx-0 print:px-0 print:py-0 print:mt-0 print:mb-0">

        {/* Header — same spacing/size on screen and in print (no print:
            overrides left: what print wanted is now just the base value). */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-normal tracking-tight text-blue-800">
            Board Buttons - 8 buttons from Bat 246 board explained
          </h1>
        </div>

        {/* Sections — on-screen layout now matches print exactly: each item
            is a flow-root block with its icon floated left (not a flex row),
            same sizes/spacing/gaps in both places. */}
        <div className="flex flex-col">
          {BUTTON_DOCS.map((b, idx) => {
            // Forced page breaks (print-only — no visual effect on screen)
            // so print always lands as 2 items on page 1, 3 on page 2, 3 on
            // page 3 — after item #2 (idx 1) and after item #5 (idx 4).
            const forcedBreakAfter = idx === 1 || idx === 4;
            // Page 1 (idx 0-1) has less leftover space per page than page 2
            // (idx 2-4) or page 3 (idx 5-7), so items past the first on a
            // page get progressively more breathing room above them, on
            // top of the standard py-6 every row already has.
            const firstOnPage = idx === 0 || idx === 2 || idx === 5;
            const page2Or3FirstItem = idx === 2 || idx === 5;
            const isPage2Or3 = idx >= 2;
            let extraTopClass = "";
            if (page2Or3FirstItem) {
              extraTopClass = "mt-10";
            } else if (!firstOnPage) {
              extraTopClass = isPage2Or3 ? "mt-12" : "mt-8";
            }
            return (
            <div
              key={b.num}
              className={`flow-root py-6 ${extraTopClass} break-inside-avoid ${forcedBreakAfter ? "print:break-after-page" : ""} ${idx < BUTTON_DOCS.length - 1 ? "border-b-2 border-black/40" : ""}`}
            >
              {/* Image floats left — text (title, description, etc.) wraps
                  into the space beside it first, then continues at full
                  width once it runs past the image's bottom. flow-root on
                  the container above keeps the border-bottom below the
                  full height of the float instead of clipping through it.

                  Below sm: a 150px float left only ~160px of a narrow
                  phone's content width for the wrapped text — 2-3 words
                  per line. float-none there stacks the image full-width
                  above the text instead. sm:/print: both force float-left
                  back on explicitly (not relying on sm: alone still
                  matching at print time, even though Chrome's print engine
                  does evaluate min-width against the paper's width) so the
                  screen-matches-print guarantee this file already worked
                  to establish holds regardless. */}
              <div className="float-none sm:float-left print:float-left w-full sm:w-[150px] print:w-[150px] h-auto aspect-[351/207] sm:mr-4 print:mr-4 mb-3 sm:mb-2 print:mb-2 rounded-xl overflow-hidden shadow-md border border-black/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.imgSrc} alt={b.label} className="w-full h-full object-cover" />
              </div>

              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-800 text-white text-[13px] font-bold flex items-center justify-center">
                    {b.num}
                  </span>
                  <h2 className="text-[14.44pt] font-bold text-black">{b.label}</h2>
                </div>

                <p className="text-[12.37pt] text-black/85 leading-snug mb-1.5">
                  <span className="font-bold text-black">Description: </span>
                  {b.description}
                </p>
                <p className="text-[12.37pt] text-black/85 leading-snug">
                  <span className="font-bold text-blue-800">BAT 246 Solution: </span>
                  {b.solution}
                </p>

                {b.bullets && (
                  <div className="mt-2 pt-2 border-t border-dashed border-black/15">
                    <p className="text-[12.37pt] font-semibold text-black/70 mb-1">{b.extraHeading}</p>
                    <ul className="space-y-3">
                      {b.bullets.map((bullet, i) => (
                        <li key={i} className="flex gap-2 text-[12.37pt] text-black/85 leading-snug">
                          <span className="text-blue-800 font-bold">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

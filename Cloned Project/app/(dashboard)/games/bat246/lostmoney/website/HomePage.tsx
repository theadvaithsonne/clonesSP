import Link from "next/link";
import { headers } from "next/headers";
import { Users, PiggyBank, RefreshCw, Repeat, Clock, RotateCcw, ArrowRight } from "lucide-react";
import HomeGallery from "./_components/HomeGallery";
import { isLostMoneyCustomDomainHost } from "@/lib/lostmoney-domains";

const BASE = "/games/bat246/lostmoney/index";

const HOW_IT_WORKS = [
  {
    icon: Users,
    title: "Anyone Qualifies",
    text: "Any distributor who was in a previous company owned by Alan Kippax can apply to recover money lost due to the business failure.",
  },
  {
    icon: PiggyBank,
    title: "Repayments Are Funded",
    text: "A portion of the revenue from every new sale in B2 is set aside to fund repayments for approved claimants.",
  },
  {
    icon: RefreshCw,
    title: "Paid in Line Order",
    text: "As new sales come in, funds are paid out to whoever is next in the Lost Money line-up, each moving down in the queue as the first in line-up gets paid.",
  },
  {
    icon: Repeat,
    title: "The Cycle Repeats",
    text: "Once a claimant has been paid $300, any leftover amount from that payment goes to the next person in line — and it repeats.",
  },
];

const RULES = [
  {
    icon: Clock,
    title: "90-Day Countdown",
    text: "Register and get approved to start a 90-day countdown before you're placed in the Lost Money line-up.",
  },
  {
    icon: RotateCcw,
    title: "Back on the Journey, Skip the Countdown",
    text: "After seeing and understanding the new TLS - B2, you decide to get back on the journey & purchase a $650 product then 90-day clock is removed, you go straight into the line-up at the end.",
  },
  {
    icon: Repeat,
    title: "Start Receiving Your Lost Money",
    text: "Start getting your money until you're paid $300, then you're moved to the back of the line-up so others can get a immediate chance to get their money back.",
  },
];

export default async function LostMoneyHomePage() {
  // Same domain-aware branded-path swap as SiteHeader/SiteFooter — this
  // page has its own hardcoded CTA links, so it needs to know too.
  const headersList = await headers();
  const host = (headersList.get("host") || "").split(":")[0].toLowerCase();
  const isCustomDomain = isLostMoneyCustomDomainHost(host);
  const registerHref = isCustomDomain ? "/register" : `${BASE}/register`;
  const aboutHref = isCustomDomain ? "/aboutus" : `${BASE}/about`;
  const paidHref = isCustomDomain ? "/paidlist" : `${BASE}/paid`;

  return (
    <div>
      {/* Hero */}
      <section className="w-full bg-[#f2ead6] border-b border-[#e6dcc3]">
        <div className="w-full max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-12 py-14 sm:py-20 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#e6dcc3] mb-6">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-[0.12em]">
                A Message From Alan Kippax
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-black leading-[1.1] mb-6 text-stone-900">
              Lost Money In A Previous Company?
            </h1>
            <p className="text-stone-600 text-lg sm:text-xl leading-relaxed max-w-[560px] mb-8">
              A program to identify, verify, and repay legitimate losses from previous business
               owned by Alan Kippax. If you believe you lost money, we want to make it right.
            </p>
            <div className="flex flex-col sm:flex-row items-start gap-3">
              <Link
                href={registerHref}
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-lg bg-emerald-800 text-white font-bold text-base hover:bg-emerald-900 transition-colors"
              >
                Register Your Claim
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href={aboutHref}
                className="inline-flex items-center justify-center px-7 py-4 rounded-lg bg-blue-900 text-white font-bold text-base hover:bg-blue-950 transition-colors"
              >
                Read Alan&apos;s Explanation Letter
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-stone-900 text-white p-6 sm:p-8">
              <div className="text-emerald-500 text-sm font-bold mb-1">Our Goal</div>
              <div className="text-3xl sm:text-4xl font-black mb-2">Up to 100% of Your Verified Loss</div>
              <p className="text-stone-400 text-[15px] leading-relaxed">
                Returned over time as revenue is allocated to the line-up, once your claim is
                reviewed and verified.
              </p>
            </div>
            <p className="text-black font-bold text-sm leading-relaxed px-1">
              *Subject to review, verification, and available funds.{" "}
              <span className="underline decoration-black underline-offset-2">Terms &amp; Conditions apply.</span>
            </p>
          </div>
        </div>
      </section>

      {/* Opening message from Alan — sets the context before the mechanics */}
      <section className="w-full max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-12 py-16 sm:py-20 border-b border-[#e6dcc3]">
        <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-14 items-center">
          <div className="max-w-[820px]">
            <p className="text-stone-900 text-2xl sm:text-3xl leading-snug font-medium italic mb-3">
              &quot;I have never forgotten those people.&quot;
            </p>
            <p className="text-stone-600 text-lg sm:text-xl leading-relaxed mb-6">
              &quot;To me, they were never simply customers, investors, distributors, or names on an
              old business record. They were part of the journey. They believed in the same vision I
              did, and I have always considered them partners in what I was trying to build.&quot;
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-stone-900 font-black text-base">— Alan Kippax</span>
              <Link
                href={aboutHref}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-900 text-white font-bold text-base hover:bg-blue-950 transition-colors"
              >
                Read Alan&apos;s Full Letter <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <HomeGallery />
        </div>
      </section>

      {/* How it works */}
      <section className="w-full max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-12 py-16 sm:py-20">
        <div className="max-w-[640px] mb-10">
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 mb-3">How It Works</h2>
          <p className="text-stone-500 text-base sm:text-lg leading-relaxed">
            A simple, transparent process for identifying and repaying legitimate losses.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.title} className="rounded-2xl border border-[#e6dcc3] bg-white p-6 hover:border-emerald-800/30 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-bold text-stone-900 text-lg">{item.title}</h3>
                <div className="w-16 h-16 rounded-xl bg-[#f2ead6] flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-8 h-8 text-emerald-800" />
                </div>
              </div>
              <p className="text-stone-700 text-base leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Rules */}
      <section className="w-full bg-[#f2ead6] border-y border-[#e6dcc3]">
        <div className="w-full max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-12 py-16 sm:py-20">
          <div className="max-w-[640px] mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-stone-900 mb-3">The Way It Works</h2>
            <p className="text-stone-500 text-base sm:text-lg leading-relaxed">What to expect once you're approved and in the line-up.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {RULES.map((item, i) => (
              <div key={item.title} className="rounded-2xl bg-white border border-[#e6dcc3] p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-stone-900 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <h3 className="font-bold text-stone-900 text-lg">{item.title}</h3>
                  </div>
                  <item.icon className="w-10 h-10 text-emerald-800 flex-shrink-0" />
                </div>
                <p className="text-stone-700 text-base leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="w-full max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-12 py-16 sm:py-20">
        <div className="rounded-3xl bg-stone-900 px-6 sm:px-12 py-12 sm:py-16 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">Ready to file your claim?</h2>
            <p className="text-stone-400 text-base sm:text-lg leading-relaxed max-w-[440px]">
              Fill in as much accurate detail as you remember - every submission is reviewed
              individually, and we'll follow up if anything needs clarifying.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row lg:justify-end gap-3">
            <Link
              href={registerHref}
              style={{ transform: "translateX(-5%)" }}
              className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-lg bg-emerald-700 text-white font-bold text-base hover:bg-emerald-800 transition-colors"
            >
              Register Your Claim
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href={paidHref}
              className="inline-flex items-center justify-center px-7 py-4 rounded-lg border border-white/20 text-white font-bold text-base hover:bg-white/5 transition-colors"
            >
              See Who's Been Paid
            </Link>
            <Link
              href={aboutHref}
              className="inline-flex items-center justify-center px-7 py-4 rounded-lg bg-blue-900 text-white font-bold text-base hover:bg-blue-950 transition-colors"
            >
              Read Alan&apos;s Explanation Letter
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

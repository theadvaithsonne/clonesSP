import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight } from "lucide-react";
import { isLostMoneyCustomDomainHost } from "@/lib/lostmoney-domains";

const BASE = "/games/bat246/lostmoney/index";

const PARAGRAPHS = [
  "For more than 30 years, I have pursued one business vision.",
  "I was 28 years old when I began developing what eventually became the TLS — the Time Leverage System. My goal was simple: to build a structured business where ordinary people could have the opportunity to earn extraordinary incomes, regardless of their professional background or skill level.",
  "I have often said: “You shouldn't have to be a lawyer or a doctor to have the opportunity to earn that kind of income.”",
  "What followed was not a series of unrelated businesses. It was one continuing effort to perfect that original idea.",
  "Each new version grew from the one before it. We kept what worked, eliminated what didn't, and learned from both our successes and our mistakes. Sometimes circumstances we had not anticipated—or could not control—changed everything.",
  "Unfortunately, some earlier versions of the business failed. When that happened, people who believed in me and what we were building sometimes lost money or did not receive what they reasonably expected.",
  "I have never forgotten those people.",
  "To me, they were never simply customers, investors, distributors, or names on an old business record. They were part of the journey. They believed in the same vision I did, and I have always considered them partners in what I was trying to build.",
  "When an attempt failed, I didn't abandon the vision. I learned, improved the concept, and tried again.",
  "Someone once suggested that if I ever wrote the story of my life, I should call it A Continuous Goal. After pursuing this vision since 1994, I think that describes my journey rather well.",
];

const PARAGRAPHS_2 = [
  "Business always involves risk, and not every enterprise succeeds. But I have never been comfortable simply saying, “That's business,” and forgetting the people who were affected.",
  "It was never my intention for people who trusted me in good faith to lose money.",
  "So I have made a personal decision:",
  "If you legitimately lost money through one of the previous versions of my business, I want to make it right. My intention is to return 100% of your verified loss.",
  "I realize some of these losses occurred many years ago and you may no longer have every receipt, document, or record. That's okay. Simply provide as much accurate information as you still have or can honestly remember.",
  "Every submission will be reviewed fairly. If something is unclear, we will contact you and work together to determine and agree upon the legitimate amount of your loss. Once verified, your claim will be placed in line for repayment.",
  "I have designed the latest version of TLS so that a portion of its revenues can be systematically allocated toward repaying these verified losses as funds become available. I want this to be an orderly, fair, and continuing process.",
];

const PARAGRAPHS_3 = [
  "Today, at age 60, I look back at the 28-year-old man who started with an idea and realize just how much I didn't know.",
  "Every success, mistake, and setback taught me something. What we are building today is the culmination of those 32 years of lessons and experience.",
  "Sometimes I call this “My Last Kick at the Can.” Not because I have lost confidence in the dream—quite the opposite. After more than three decades of learning, refining, correcting, and rebuilding, I have never been more confident in what we have created.",
  "I truly believe we have finally reached the pinnacle of the idea I began pursuing in 1994.",
  "And as this final evolution succeeds, I don't want that success to belong only to the people who are here today. I want to remember those who helped us get here—including the people who believed in earlier versions and were hurt financially when those attempts did not succeed.",
  "I cannot go back and change what happened. But I can acknowledge it, learn from it, and, as this business provides me with the ability to do so, I can and will do my best to right the wrongs left behind along the way.",
  "That is what YourMoneyBack.info is all about.",
  "If you believe you legitimately lost money through one of my previous business operations, please complete the application below as accurately and honestly as you can. This website was created specifically to identify those losses, verify them fairly, and ultimately make good on them.",
  "I am genuinely sorry for the disappointment some people experienced along this long journey.",
  "And to those who believed in me then, I simply want to say:",
];

export default async function LostMoneyAboutPage() {
  // Same domain-aware branded-path swap as SiteHeader/SiteFooter — this
  // page has its own hardcoded CTA link, so it needs to know too.
  const headersList = await headers();
  const host = (headersList.get("host") || "").split(":")[0].toLowerCase();
  const isCustomDomain = isLostMoneyCustomDomainHost(host);
  const registerHref = isCustomDomain ? "/register" : `${BASE}/register`;

  return (
    <div className="w-full max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#e6dcc3] mb-6">
        <span className="text-xs font-bold text-emerald-800 uppercase tracking-[0.12em]">About Us</span>
      </div>
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-10 sm:mb-14 leading-tight max-w-[900px]">
        A Personal Message from the Desk of Alan Kippax
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-12 xl:gap-20">
        <div className="flex flex-col gap-5 max-w-[720px]">
          {PARAGRAPHS.map((p, i) => (
            <p key={i} className="text-stone-600 text-base sm:text-lg leading-relaxed">
              {p}
            </p>
          ))}

          <h2 className="text-xl sm:text-2xl font-black text-stone-900 mt-4 mb-1">
            Now I Want to Make Something Right.
          </h2>

          {PARAGRAPHS_2.map((p, i) => (
            <p key={i} className="text-stone-600 text-base sm:text-lg leading-relaxed">
              {p}
            </p>
          ))}

          <h2 className="text-xl sm:text-2xl font-black text-stone-900 mt-4 mb-1">
            Perfected Since 1994
          </h2>

          {PARAGRAPHS_3.map((p, i) => (
            <p key={i} className="text-stone-600 text-base sm:text-lg leading-relaxed">
              {p}
            </p>
          ))}

          <p className="text-stone-900 text-base sm:text-lg leading-relaxed font-semibold border-l-4 border-emerald-800 pl-4 my-2">
            &quot;Thank you for believing in the vision. Thank you for being part of the journey. And
            thank you for giving me the opportunity to make things right today.&quot;
          </p>

          <div className="mt-6">
            <p className="text-stone-900 font-black text-xl">Alan Kippax</p>
            <p className="text-black font-bold text-base italic">A Continuous Goal</p>
            <p className="text-emerald-800 text-sm font-bold tracking-wide mt-1">TLS &mdash; BAT 246</p>
          </div>
        </div>

        <aside className="lg:sticky lg:top-28 self-start flex flex-col gap-4">
          <div className="rounded-2xl bg-stone-900 text-white p-6">
            <div className="text-emerald-500 text-sm font-bold uppercase tracking-wide mb-2">Our Commitment</div>
            <div className="text-2xl font-black mb-2">Up to 100% of Your Verified Loss</div>
            <p className="text-stone-400 text-base leading-relaxed">
              Every claim is reviewed fairly, and a portion of every sale is allocated toward
              repaying verified losses as funds become available from B2.
            </p>
          </div>
          <p className="text-black font-bold text-sm leading-relaxed px-1">
            *Subject to review, verification, and available funds.{" "}
            <span className="underline decoration-black underline-offset-2">Terms &amp; Conditions apply.</span>
          </p>

          <div className="rounded-2xl border border-[#e6dcc3] bg-white p-6">
            <div className="font-bold text-stone-900 text-base mb-2">Believe you're owed money?</div>
            <p className="text-stone-500 text-base leading-relaxed mb-4">
              Submit your claim — you don't need every document, just as much detail as you can
              honestly remember.
            </p>
            <Link
              href={registerHref}
              className="inline-flex items-center gap-2 text-emerald-800 font-bold text-base hover:text-emerald-900"
            >
              Register your claim <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

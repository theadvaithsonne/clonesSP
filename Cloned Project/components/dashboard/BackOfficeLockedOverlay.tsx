"use client";

import { useRouter } from "next/navigation";
import { Lock, Crown, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Rendered in place of <MarketplacePage /> when the founder's office is on
 * the Starter plan. Directs them to /office-payment (which handles the
 * Starter → Pro switch via the /subscribe endpoint's plan-switch branch).
 */
export default function BackOfficeLockedOverlay() {
  const router = useRouter();

  return (
    <div className="min-h-full flex items-center justify-center p-6 bg-[#0b0b0d]">
      <div className="relative w-full max-w-[520px] rounded-2xl border border-[#2a2a35] bg-gradient-to-br from-[#111114] to-[#0e0e12] p-8 md:p-10 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(400px_200px_at_50%_20%,color-mix(in_srgb,_var(--brand-2)_15%,_transparent),transparent_70%)]" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-brand-2/10 border border-brand-2/30 flex items-center justify-center mb-5">
            <Lock className="w-6 h-6 text-brand-2" />
          </div>

          <h2 className="text-xl md:text-2xl font-semibold text-white mb-2">
            BackOffice is a Pro feature
          </h2>
          <p className="text-sm text-[#9fa0b8] mb-6 max-w-[400px] leading-relaxed">
            The marketplace and BackOffice tools are unlocked on the Founders
            Office Pro plan. Upgrade anytime — you can also switch back to
            Starter later.
          </p>

          <div className="w-full rounded-xl border border-[#2a2a35] bg-black/40 p-4 mb-6 text-left">
            <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-wider text-[#6b6b80]">
              <Crown className="w-3.5 h-3.5 text-brand-2" />
              What Pro unlocks
            </div>
            <ul className="space-y-2 text-sm text-[#c7c7da]">
              <li className="flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-brand-2 shrink-0 mt-0.5" />
                Full BackOffice marketplace
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-brand-2 shrink-0 mt-0.5" />
                Conference room add-ons
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-brand-2 shrink-0 mt-0.5" />
                5% platform fee on sales (vs 10% on Starter)
              </li>
            </ul>
          </div>

          <Button
            onClick={() => router.push("/office-payment")}
            className="w-full bg-brand text-brand-foreground font-semibold hover:bg-[#fde047] transition-colors h-11 rounded-lg text-sm"
          >
            Upgrade to Pro
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}

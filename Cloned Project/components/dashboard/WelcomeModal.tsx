"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, Users, TrendingUp } from "lucide-react";

type WelcomeModalProps = {
  open: boolean;
  onClose: () => void;
  onGoToWallet: () => void;
};

export default function WelcomeModal({
  open,
  onClose,
  onGoToWallet,
}: WelcomeModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#0e0e12] border-[#2a2a35] text-white sm:max-w-md">
        <DialogHeader className="text-center items-center">
          <div className="mx-auto mb-2 p-3 bg-brand/20 rounded-full w-fit">
            <Sparkles className="w-8 h-8 text-brand" />
          </div>
          <DialogTitle className="text-2xl font-bold text-white">
            Welcome to Garage!
          </DialogTitle>
          <DialogDescription className="text-[#9fa0b8] text-sm">
            Your profile is all set. You're now part of a growing network of
            creators, founders, and professionals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-2">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-[#1a1a24] border border-[#2a2a35]">
            <Users className="w-5 h-5 text-brand mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">Build Your Network</p>
              <p className="text-xs text-[#9fa0b8]">
                Connect with like-minded professionals and grow together.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-[#1a1a24] border border-[#2a2a35]">
            <TrendingUp className="w-5 h-5 text-brand mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">Earn as You Grow</p>
              <p className="text-xs text-[#9fa0b8]">
                Activate the Unilevel Plus plan for just $25 and start earning
                affiliate commissions from your network.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-[#1a1a24] border border-[#2a2a35]">
            <Zap className="w-5 h-5 text-brand mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">Unlock Full Potential</p>
              <p className="text-xs text-[#9fa0b8]">
                Get multi-level bonuses, direct referral rewards, and redeem
                your earnings anytime.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button
            onClick={onGoToWallet}
            className="w-full bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground font-semibold h-11"
          >
            Become an Affiliate — $25
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full text-[#9fa0b8] hover:text-white hover:bg-[#1a1a24]"
          >
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

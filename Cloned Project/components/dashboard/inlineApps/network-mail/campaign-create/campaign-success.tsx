"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { Check } from "lucide-react";
import { ActionButton } from "./campaign-action-bar";
import { getScheduleDescription } from "./utils";
import type { CampaignData } from "./types";

export function CampaignSuccessScreen({
  campaignData,
  onViewDetails,
  onCreateAnother,
  onGoToDashboard,
}: {
  campaignData: Partial<CampaignData>;
  onViewDetails: () => void;
  onCreateAnother: () => void;
  onGoToDashboard: () => void;
}) {
  const [countdown, setCountdown] = useState(5);
  const net =
    campaignData.recipients?.netRecipientCount ??
    campaignData.recipients?.recipientCount ??
    0;

  useEffect(() => {
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
    });
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      onGoToDashboard();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onGoToDashboard]);

  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[360px] px-6 py-8">
      <div className="h-16 w-16 rounded-full bg-brand/15 flex items-center justify-center mb-5">
        <Check className="h-8 w-8 text-brand" />
      </div>
      <h2 className="text-xl font-semibold text-white text-center">
        Campaign Launched!
      </h2>
      <p className="text-sm text-[#7a7a7a] mt-2 text-center max-w-sm">
        Your campaign &apos;{campaignData.campaignName}&apos; is on its way
      </p>

      <div className="mt-6 w-full rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2 text-sm">
        <p className="text-white">Campaign: {campaignData.campaignName}</p>
        <p className="text-[#a8a8a8]">Recipients: {net.toLocaleString()}</p>
        <p className="text-[#a8a8a8]">Send time: {getScheduleDescription(campaignData)}</p>
      </div>

      <p className="text-xs text-[#7a7a7a] mt-5">Closing in {countdown}…</p>

      <div className="flex flex-col sm:flex-row gap-2 mt-6 w-full max-w-sm">
        <ActionButton variant="primary" onClick={onViewDetails} className="flex-1">
          View Details
        </ActionButton>
        <ActionButton variant="secondary" onClick={onCreateAnother} className="flex-1">
          Create Another
        </ActionButton>
      </div>
      <button
        type="button"
        onClick={onGoToDashboard}
        className="mt-3 text-sm text-[#7a7a7a] hover:text-white cursor-pointer"
      >
        Go to Dashboard
      </button>
    </div>
  );
}

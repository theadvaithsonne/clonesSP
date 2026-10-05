"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Stepper } from "./Stepper";
import { getCorporate } from "@/lib/coverfi/corporate-api";
import type { Corporate } from "@/lib/coverfi/types";
import { toast } from "sonner";
import CorporateStep2Address from "./CorporateStep2Address";
import CorporateStep3Employees from "./CorporateStep3Employees";
import CorporateStep4Products from "./CorporateStep4Products";
import CorporateDetail from "./CorporateDetail";

type Props = { corporateId: string };

export default function CorporateWizard({ corporateId }: Props) {
  const router = useRouter();
  const [corporate, setCorporate] = useState<Corporate | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<number>(2);

  async function reload() {
    try {
      const c = await getCorporate(corporateId);
      setCorporate(c);
      const next = Math.min(4, Math.max(2, (c.step_completed || 1) + 1));
      setCurrentStep(c.step_completed >= 4 ? 4 : next);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load corporate");
    }
  }

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corporateId]);

  if (loading) {
    return (
      <div className="px-8 py-8 text-[#9fa0b8] flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-brand" />
        Loading corporate…
      </div>
    );
  }

  if (!corporate) {
    return (
      <div className="px-8 py-8 text-sm text-[#9fa0b8]">
        Couldn&apos;t load this corporate. It may have been removed.
      </div>
    );
  }

  // Once finalized → detail mode (Info / Employees / Products tabs)
  if (corporate.step_completed >= 4) {
    return <CorporateDetail corporate={corporate} onReload={reload} />;
  }

  return (
    <div className="px-8 py-7 max-w-4xl">
      <Link
        href="/coverfi/corporate"
        className="inline-flex items-center text-sm text-[#9fa0b8] hover:text-white mb-5"
      >
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to corporates
      </Link>

      <h1 className="text-[22px] font-semibold tracking-tight mb-1">
        {corporate.display_name || corporate.legal_name}
      </h1>
      <p className="text-[13px] text-white/45 mb-6">
        Continue setting up. You can jump back to any completed step.
      </p>

      <Stepper
        current={currentStep}
        done={corporate.step_completed || 0}
        onJump={(n) => setCurrentStep(n)}
      />

      <div className="mt-6">
        {currentStep === 2 && (
          <CorporateStep2Address
            corporate={corporate}
            onSaved={async (c) => {
              setCorporate(c);
              setCurrentStep(3);
            }}
            onBack={() => router.push(`/coverfi/corporate/new`)}
          />
        )}
        {currentStep === 3 && (
          <CorporateStep3Employees
            corporate={corporate}
            onSaved={async (c) => {
              setCorporate(c);
              setCurrentStep(4);
            }}
            onBack={() => setCurrentStep(2)}
          />
        )}
        {currentStep === 4 && (
          <CorporateStep4Products
            corporate={corporate}
            onFinish={async () => {
              toast.success("Corporate finalized");
              await reload();
            }}
            onBack={() => setCurrentStep(3)}
          />
        )}
      </div>
    </div>
  );
}

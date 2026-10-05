"use client";

// Container for the whitelabel setup wizard. Owns which step is on screen
// and nothing else — each step fetches and saves its own data, so a
// founder who leaves halfway and comes back lands on the right screen
// from server state rather than from wizard memory.
//
//   Step 1 — Domain   (WhitelabelDomainWizard)
//   Step 2 — Branding (WhitelabelBrandingStep)
//   Step 3 — Email    (WhitelabelEmailStep)
//   Step 4 — Done     (WhitelabelCompleteStep)
//
// Skipping is a first-class path: every step's left-hand action moves
// forward without saving, and step 4 reads the real state, so a skipped
// step shows up honestly on the summary instead of being claimed as done.

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import WhitelabelDomainWizard from "./WhitelabelDomainWizard";
import WhitelabelBrandingStep from "./WhitelabelBrandingStep";
import WhitelabelEmailStep from "./WhitelabelEmailStep";
import WhitelabelCompleteStep from "./WhitelabelCompleteStep";

export default function WhitelabelSetupWizard({
  setActivePopover,
}: {
  setActivePopover?: (popover: string | null) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  // Step 3 prefills the sending domain from whatever was registered in
  // step 1, so the founder doesn't type the same domain twice.
  const [appDomain, setAppDomain] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const orgId =
        typeof window !== "undefined"
          ? localStorage.getItem("garage_org_id")
          : null;
      if (!orgId) return;
      try {
        const res = await api<{
          domains?: Array<{ domain: string; isPrimary?: boolean }>;
        }>(`/initial-setup/app-domains?orgId=${orgId}`);
        if (cancelled) return;
        const primary =
          res.domains?.find((d) => d.isPrimary) || res.domains?.[0];
        setAppDomain(primary?.domain);
      } catch {
        // Prefill is a convenience, not a requirement.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const backToSettings = () => setActivePopover?.("Office Settings:domain");
  const closeWizard = () => setActivePopover?.(null);

  if (step === 4) {
    return <WhitelabelCompleteStep onBackToSettings={backToSettings} />;
  }

  if (step === 3) {
    return (
      <WhitelabelEmailStep
        onNext={() => setStep(4)}
        onSkip={() => setStep(4)}
        appDomain={appDomain}
      />
    );
  }

  if (step === 2) {
    return (
      <WhitelabelBrandingStep
        onNext={() => setStep(3)}
        onSkip={() => setStep(3)}
      />
    );
  }

  return (
    <WhitelabelDomainWizard
      setActivePopover={setActivePopover}
      onNext={() => setStep(2)}
      onSkip={closeWizard}
    />
  );
}

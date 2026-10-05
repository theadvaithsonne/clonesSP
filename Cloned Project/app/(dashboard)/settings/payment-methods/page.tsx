"use client";

// Standalone /settings/payment-methods page — thin wrapper around
// PaymentMethodsPanel. The Vault page renders the same panel inline as
// a tab (see WalletPageNew — "Payment Methods" tab), so both surfaces
// stay behavior-identical.

import { PaymentMethodsPanel } from "@/components/dashboard/PaymentMethodsPanel";

export default function PaymentMethodsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <PaymentMethodsPanel />
      </div>
    </div>
  );
}

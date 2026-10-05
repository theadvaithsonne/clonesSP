"use client";

// Purchase dialog for the whitelabel add-on. Mints an invoice on the
// BE and hands the founder off to the standard invoice-pay page
// (opened in a new tab) — same "external hosted checkout" pattern the
// office subscription flow uses. No saved-card picker: the founder
// picks whatever payment method they want (Razorpay, Stripe, crypto,
// wallet) on the invoice pay page.
//
// On payment, `fulfillInvoice`'s `whitelabel_addon` switch case
// activates the add-on and pays 50% of the base to the direct
// referrer. Nothing here needs to poll for status — the parent's
// `onSuccess` re-fetches on close, and if the founder finishes payment
// after closing, the next status refresh (or page reload) picks it up.

import { useState } from "react";
import { ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  purchaseWhitelabelAddon,
  type WhitelabelPriceResponse,
} from "@/lib/whitelabel-addon-api";

interface Props {
  price: WhitelabelPriceResponse;
  onClose: () => void;
  onSuccess: () => void;
}

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function WhitelabelPurchaseDialog({
  price,
  onClose,
  onSuccess,
}: Props) {
  const [minting, setMinting] = useState(false);

  const handleContinue = async () => {
    setMinting(true);
    try {
      const r = await purchaseWhitelabelAddon();
      // Open the standard invoice pay page with the invoiceNumber in a new tab so the founder
      // doesn't lose their spot in Domain Management. noopener/
      // noreferrer prevents the new tab from grabbing a reference to
      // window.opener.
      const invoiceTarget = r.invoiceNumber || r.invoiceId;
      const targetUrl = invoiceTarget ? `/invoice/${invoiceTarget}` : r.redirectUrl;
      window.open(targetUrl, "_blank", "noopener,noreferrer");
      toast.success("Invoice ready — complete payment in the new tab");
      // Close the dialog and let the parent refresh status. If the
      // founder pays in the new tab, the next status refresh will show
      // whitelabel active.
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create invoice");
      setMinting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-[#0e0e12] border-[#2a2a35] text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Buy Whitelabel</DialogTitle>
          <DialogDescription className="text-[#9fa0b8]">
            Continue to the invoice page to complete payment. Pay by
            card, UPI, wallet, or crypto — whatever works for you.
          </DialogDescription>
        </DialogHeader>

        {/* Price summary */}
        <div className="rounded-lg border border-white/[0.06] bg-black/30 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#9fa0b8]">Base</span>
            <span className="text-white tabular-nums">
              {formatUsdFromCents(price.baseUsdCents)} / yr
            </span>
          </div>
          {price.gstApplicable && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#9fa0b8]">GST 18%</span>
              <span className="text-white tabular-nums">
                {formatUsdFromCents(price.gstAmountSmallest)}
              </span>
            </div>
          )}
          <div className="border-t border-white/[0.06] pt-1.5 flex items-center justify-between text-sm font-semibold">
            <span className="text-white">Total on this invoice</span>
            <span className="text-brand tabular-nums">
              {formatUsdFromCents(price.totalUsdCents)}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs text-[#6a6a7a]">
          <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>
            Whitelabel activates the moment payment lands. Renews
            yearly — you&apos;ll receive a new invoice ~7 days before
            the cycle ends.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-[#9fa0b8] hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleContinue}
            disabled={minting}
            className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground font-semibold min-w-[180px]"
          >
            {minting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Preparing invoice…
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Continue to payment
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

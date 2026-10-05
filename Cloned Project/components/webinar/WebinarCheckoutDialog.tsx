"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckoutPaymentStep } from "@/components/checkout/CheckoutPaymentStep";
import { UserCircle2 } from "lucide-react";
import type { InvoiceReferrerInfo } from "@/lib/feed-api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
  organizationName: string;
  userEmail: string;
  userName?: string;
  referrer: InvoiceReferrerInfo | null;
  onPaid: (paymentId?: string) => void;
}

export default function WebinarCheckoutDialog({
  open,
  onOpenChange,
  invoiceId,
  organizationName,
  userEmail,
  userName,
  referrer,
  onPaid,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* grid-cols-1: the dialog's implicit grid track is `auto`, which sizes to
          max-content and overflows the dialog — pin it so the truncate below
          (a long referrer name) actually clamps. */}
      <DialogContent className="grid-cols-1 bg-[#0f0f13] text-white border-[#2a2a35] sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete your purchase</DialogTitle>
          <DialogDescription className="text-[#9fa0b8]">
            Pay securely without leaving the webinar.
          </DialogDescription>
        </DialogHeader>

        {referrer && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
            <UserCircle2 className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              Referred by <span className="font-semibold">{referrer.name}</span>
              {referrer.affiliateId && (
                <span className="text-blue-400/70"> · @{referrer.affiliateId}</span>
              )}
            </span>
          </div>
        )}

        {invoiceId ? (
          <CheckoutPaymentStep
            invoiceId={invoiceId}
            organizationName={organizationName}
            userEmail={userEmail}
            userName={userName}
            onSuccess={(data) => {
              onPaid(data.paymentId);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : (
          <div className="flex items-center justify-center py-12 text-sm text-[#6b6b80]">
            Preparing checkout...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

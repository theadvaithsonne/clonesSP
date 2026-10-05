"use client";

import { useState } from "react";
import { Copy, Check, Globe } from "lucide-react";
import type { AdminWalletAccount } from "@/lib/admin-api/users";

/**
 * Full key/value detail panel for a single payout account (bank or crypto).
 * Shows every field on file — full unmasked account number / wallet address,
 * IBAN, SWIFT, routing, country, beneficiary, memo — each with its own copy
 * button. Empty fields are omitted.
 *
 * Used by:
 *  - garage-admin User Accounts → user detail (inside the expandable
 *    AccountRow)
 *  - garage-admin InitiateWithdrawalDialog (always-visible under the
 *    selected payout account so an admin can verify before sending money)
 */

const NETWORK_LABELS: Record<string, string> = {
  ethereum: "Ethereum",
  tron: "Tron",
  bitcoin: "Bitcoin",
  solana: "Solana",
  bsc: "BNB Chain",
  polygon: "Polygon",
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      className="h-6 w-6 rounded-md flex items-center justify-center text-[#5a5a72] hover:text-[#FBD10D] hover:bg-[#1a1a22] transition-colors shrink-0"
      title="Copy"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

function DetailField({
  label,
  value,
  mono,
  copy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copy?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[#1f1f2a] bg-[#0d0d11] px-2.5 py-2">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#5a5a72]">
          {label}
        </p>
        {copy && <CopyButton value={value} />}
      </div>
      <p
        className={`text-[12px] text-white leading-snug break-all ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function PayoutAccountDetail({
  account,
  className,
}: {
  account: AdminWalletAccount;
  className?: string;
}) {
  const isBank = account.accountType === "bank";
  const netLabel = NETWORK_LABELS[account.cryptoNetwork] || account.cryptoNetwork;

  const fields: { label: string; value?: string; mono?: boolean; copy?: boolean }[] =
    isBank
      ? [
          { label: "Bank name", value: account.bankName },
          { label: "Label", value: account.label },
          { label: "Beneficiary", value: account.beneficiaryName },
          { label: "Country", value: account.country },
          { label: "Account number", value: account.accountNumber, mono: true, copy: true },
          { label: "IBAN", value: account.ibanNumber, mono: true, copy: true },
          { label: "SWIFT / BIC", value: account.swiftCode, mono: true, copy: true },
          { label: "Routing number", value: account.routingNumber, mono: true, copy: true },
        ]
      : [
          { label: "Label", value: account.label },
          { label: "Network", value: netLabel },
          { label: "Wallet address", value: account.cryptoAddress, mono: true, copy: true },
          { label: "Memo / tag", value: account.cryptoMemo, mono: true, copy: true },
        ];
  const visible = fields.filter((f) => f.value && f.value.length > 0);

  if (visible.length === 0) return null;

  return (
    <div className={className}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {visible.map((f) => (
          <DetailField
            key={f.label}
            label={f.label}
            value={f.value!}
            mono={!!f.mono}
            copy={!!f.copy}
          />
        ))}
      </div>
      {!isBank && account.cryptoAddress && (
        <p className="mt-3 text-[10px] text-[#5a5a72] flex items-center gap-1.5">
          <Globe className="h-3 w-3" />
          On-chain {netLabel}. Double-check the address before sending —
          transactions are irreversible.
        </p>
      )}
    </div>
  );
}

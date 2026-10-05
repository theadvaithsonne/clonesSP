"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Landmark,
  Pencil,
  Loader2,
  Plus,
  Building2,
  CreditCard,
  User,
  MapPin,
  CheckCircle2,
  Trash2,
  Coins,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Country } from "country-state-city";
import {
  getWalletAccounts,
  saveWalletAccount,
  deleteWalletAccount,
  type WalletAccountData,
  type WalletAccountWalletType,
  type BankAddress,
  type CryptoNetwork,
} from "@/lib/feed-api";

/* ── shared style tokens (match BankDetailsSection) ─────────── */
const inputClass =
  "bg-[#1a1a22] border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/40 focus-visible:ring-brand/20 focus-visible:border-brand/40 h-9 text-sm rounded-lg";
const selectTriggerClass =
  "w-full bg-[#1a1a22] border-[#2a2a35] text-white h-9 text-sm focus:ring-brand/20 focus:border-brand/40 rounded-lg";
const selectContentClass =
  "bg-[#0e0e12] border-[#2a2a35] text-white max-h-[280px]";

const countries = Country.getAllCountries();

const CRYPTO_NETWORKS: { value: CryptoNetwork; label: string }[] = [
  { value: "ethereum", label: "Ethereum (ERC-20)" },
  { value: "tron", label: "Tron (TRC-20)" },
  { value: "bitcoin", label: "Bitcoin" },
  { value: "solana", label: "Solana" },
  { value: "bsc", label: "BNB Smart Chain (BEP-20)" },
  { value: "polygon", label: "Polygon" },
];
const networkLabel = (v: string) =>
  CRYPTO_NETWORKS.find((n) => n.value === v)?.label || v;

const emptyAddress: BankAddress = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

function maskAccount(value: string): string {
  if (!value) return "";
  if (value.length <= 4) return value;
  return "••••" + value.slice(-4);
}
function shortAddr(value: string): string {
  if (!value) return "";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

/* ── tiny helpers ────────────────────────────────────────────── */
function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-medium text-[#9fa0b8] mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function SectionDivider({
  icon: Icon,
  title,
  required,
}: {
  icon: React.ElementType;
  title: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 pt-1 pb-1">
      <div className="p-1.5 rounded-md bg-brand/10">
        <Icon className="w-3.5 h-3.5 text-brand" />
      </div>
      <span className="text-sm font-medium text-white">
        {title}
        {required && <span className="text-red-400 ml-1">*</span>}
      </span>
      <div className="flex-1 h-px bg-[#2a2a35]" />
    </div>
  );
}

function AddressFields({
  address,
  onChange,
}: {
  address: BankAddress;
  onChange: (field: keyof BankAddress, value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <div className="col-span-2 sm:col-span-1">
        <FieldLabel>Address Line 1</FieldLabel>
        <Input className={inputClass} placeholder="Street address" value={address.line1} onChange={(e) => onChange("line1", e.target.value)} />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <FieldLabel>Address Line 2</FieldLabel>
        <Input className={inputClass} placeholder="Apt, suite, etc." value={address.line2} onChange={(e) => onChange("line2", e.target.value)} />
      </div>
      <div>
        <FieldLabel>City</FieldLabel>
        <Input className={inputClass} placeholder="City" value={address.city} onChange={(e) => onChange("city", e.target.value)} />
      </div>
      <div>
        <FieldLabel>State / Province</FieldLabel>
        <Input className={inputClass} placeholder="State" value={address.state} onChange={(e) => onChange("state", e.target.value)} />
      </div>
      <div>
        <FieldLabel>Postal Code</FieldLabel>
        <Input className={inputClass} placeholder="ZIP / Postal" value={address.postalCode} onChange={(e) => onChange("postalCode", e.target.value)} />
      </div>
      <div>
        <FieldLabel>Country</FieldLabel>
        <Select value={address.country} onValueChange={(v) => onChange("country", v)}>
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent className={selectContentClass}>
            {countries.map((c) => (
              <SelectItem key={c.isoCode} value={c.isoCode}>
                {c.flag} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/* ── bank form state ─────────────────────────────────────────── */
interface BankForm {
  country: string;
  bankName: string;
  branchAddress: BankAddress;
  routingNumber: string;
  accountNumber: string;
  swiftCode: string;
  ibanNumber: string;
  beneficiaryName: string;
  beneficiaryAddress: BankAddress;
}
const initialBank: BankForm = {
  country: "",
  bankName: "",
  branchAddress: { ...emptyAddress },
  routingNumber: "",
  accountNumber: "",
  swiftCode: "",
  ibanNumber: "",
  beneficiaryName: "",
  beneficiaryAddress: { ...emptyAddress },
};

interface CryptoForm {
  cryptoNetwork: CryptoNetwork | "";
  cryptoAddress: string;
  label: string;
  cryptoMemo: string;
}
const initialCrypto: CryptoForm = {
  cryptoNetwork: "",
  cryptoAddress: "",
  label: "",
  cryptoMemo: "",
};

const WALLET_LABELS: Record<WalletAccountWalletType, string> = {
  store: "Store Wallet",
  affiliate: "Affiliate Wallet",
  content_rewards: "Content Rewards Wallet",
};

/* ══════════════════════════════════════════════════════════════ */
export function PayoutAccountsSection({
  walletType,
  orgId,
}: {
  walletType: WalletAccountWalletType;
  orgId?: string | null;
}) {
  const [accounts, setAccounts] = useState<WalletAccountData[]>([]);
  const [loading, setLoading] = useState(true);

  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [cryptoModalOpen, setCryptoModalOpen] = useState(false);
  const [bankForm, setBankForm] = useState<BankForm>({ ...initialBank });
  const [cryptoForm, setCryptoForm] = useState<CryptoForm>({ ...initialCrypto });
  const [bankErrors, setBankErrors] = useState<Record<string, string>>({});
  const [cryptoErrors, setCryptoErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const bank = accounts.find((a) => a.accountType === "bank") || null;
  const crypto = accounts.find((a) => a.accountType === "crypto") || null;

  // store wallet needs an orgId to scope; if missing we can't load.
  const blocked = walletType === "store" && !orgId;

  const load = useCallback(async () => {
    if (blocked) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await getWalletAccounts(walletType, orgId);
      setAccounts(res.accounts || []);
    } catch {
      // silent — slots show "add"
    } finally {
      setLoading(false);
    }
  }, [walletType, orgId, blocked]);

  useEffect(() => {
    load();
  }, [load]);

  /* ── bank modal ── */
  function openBank() {
    if (bank) {
      setBankForm({
        country: bank.country,
        bankName: bank.bankName,
        branchAddress: { ...bank.branchAddress },
        routingNumber: bank.routingNumber,
        accountNumber: bank.accountNumber,
        swiftCode: bank.swiftCode,
        ibanNumber: bank.ibanNumber,
        beneficiaryName: bank.beneficiaryName,
        beneficiaryAddress: { ...bank.beneficiaryAddress },
      });
    } else {
      setBankForm({ ...initialBank });
    }
    setBankErrors({});
    setBankModalOpen(true);
  }

  function validateBank(): boolean {
    const e: Record<string, string> = {};
    if (!bankForm.country) e.country = "Required";
    if (!bankForm.bankName.trim()) e.bankName = "Required";
    if (!bankForm.accountNumber.trim()) e.accountNumber = "Required";
    if (!bankForm.swiftCode.trim()) e.swiftCode = "Required";
    if (!bankForm.beneficiaryName.trim()) e.beneficiaryName = "Required";
    const ba = bankForm.branchAddress;
    if (!ba.line1.trim() && !ba.city.trim())
      e.branchAddress = "Provide at least a street address or city";
    const bfa = bankForm.beneficiaryAddress;
    if (!bfa.line1.trim() && !bfa.city.trim())
      e.beneficiaryAddress = "Provide at least a street address or city";
    setBankErrors(e);
    return Object.keys(e).length === 0;
  }

  async function saveBank() {
    if (!validateBank()) return;
    try {
      setSaving(true);
      await saveWalletAccount({
        walletType,
        orgId,
        account: { accountType: "bank", ...bankForm },
      });
      await load();
      setBankModalOpen(false);
      toast.success("Bank account saved");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save bank account");
    } finally {
      setSaving(false);
    }
  }

  /* ── crypto modal ── */
  function openCrypto() {
    if (crypto) {
      setCryptoForm({
        cryptoNetwork: (crypto.cryptoNetwork as CryptoNetwork) || "",
        cryptoAddress: crypto.cryptoAddress,
        label: crypto.label,
        cryptoMemo: crypto.cryptoMemo,
      });
    } else {
      setCryptoForm({ ...initialCrypto });
    }
    setCryptoErrors({});
    setCryptoModalOpen(true);
  }

  function validateCrypto(): boolean {
    const e: Record<string, string> = {};
    if (!cryptoForm.cryptoNetwork) e.cryptoNetwork = "Required";
    if (!cryptoForm.cryptoAddress.trim()) e.cryptoAddress = "Required";
    setCryptoErrors(e);
    return Object.keys(e).length === 0;
  }

  async function saveCrypto() {
    if (!validateCrypto()) return;
    try {
      setSaving(true);
      await saveWalletAccount({
        walletType,
        orgId,
        account: {
          accountType: "crypto",
          cryptoNetwork: cryptoForm.cryptoNetwork as CryptoNetwork,
          cryptoAddress: cryptoForm.cryptoAddress.trim(),
          label: cryptoForm.label.trim(),
          cryptoMemo: cryptoForm.cryptoMemo.trim(),
        },
      });
      await load();
      setCryptoModalOpen(false);
      toast.success("Crypto address saved");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save crypto address");
    } finally {
      setSaving(false);
    }
  }

  async function removeAccount(id: string) {
    try {
      setDeletingId(id);
      await deleteWalletAccount(id);
      await load();
      toast.success("Account removed");
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove account");
    } finally {
      setDeletingId(null);
    }
  }

  if (blocked) {
    return (
      <div className="bg-[#0e0e12] rounded-xl border border-[#2a2a35] p-4 text-sm text-[#9fa0b8]">
        Select an office to manage this store wallet's payout accounts.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-[#0e0e12] rounded-xl border border-[#2a2a35] p-4 sm:p-5">
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-[#1a1a22]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 rounded bg-[#1a1a22]" />
            <div className="h-3 w-44 rounded bg-[#1a1a22]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* heading */}
      <div className="flex items-center gap-2">
        <Wallet className="w-3.5 h-3.5 text-brand" />
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
          Payout Accounts
        </h3>
        <span className="text-[10px] text-[#5a5a72]">
          {WALLET_LABELS[walletType]} · up to 1 bank + 1 crypto
        </span>
      </div>

      {/* nudge when none */}
      {!bank && !crypto && (
        <p className="text-[11px] text-[#9fa0b8]">
          Add at least one account to receive payouts from this wallet.
        </p>
      )}

      {/* ── Bank slot ── */}
      <div className="bg-[#0e0e12] rounded-xl border border-[#2a2a35] p-4 group hover:border-[#3a3a45] transition-colors">
        {bank ? (
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2.5 rounded-xl bg-brand/10 shrink-0">
              <Landmark className="w-5 h-5 text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-white truncate">{bank.bankName}</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
              </div>
              <div className="flex items-center gap-2 text-xs text-[#9fa0b8] flex-wrap">
                <span>Acct {maskAccount(bank.accountNumber)}</span>
                {bank.swiftCode && (
                  <>
                    <span className="text-[#2a2a35]">|</span>
                    <span>{bank.swiftCode}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="outline" size="sm" onClick={openBank}
                className="border-[#2a2a35] text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white gap-1.5 h-8 text-xs">
                <Pencil className="w-3.5 h-3.5" /><span className="hidden sm:inline">Edit</span>
              </Button>
              <Button variant="outline" size="sm" disabled={deletingId === bank._id}
                onClick={() => removeAccount(bank._id)}
                className="border-[#2a2a35] text-[#9fa0b8] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 h-8 px-2">
                {deletingId === bank._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        ) : (
          <button onClick={openBank} className="flex items-center gap-3 sm:gap-4 w-full text-left">
            <div className="p-2.5 rounded-xl bg-brand/10 shrink-0 group-hover:bg-brand/15 transition-colors">
              <Landmark className="w-5 h-5 text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-white block">Add Bank Account</span>
              <span className="text-xs text-[#9fa0b8]">Fiat payouts to your bank</span>
            </div>
            <div className="p-1.5 rounded-lg bg-brand/10 shrink-0 group-hover:bg-brand/20 transition-colors">
              <Plus className="w-4 h-4 text-brand" />
            </div>
          </button>
        )}
      </div>

      {/* ── Crypto slot ── */}
      <div className="bg-[#0e0e12] rounded-xl border border-[#2a2a35] p-4 group hover:border-[#3a3a45] transition-colors">
        {crypto ? (
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2.5 rounded-xl bg-brand/10 shrink-0">
              <Coins className="w-5 h-5 text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-white truncate">
                  {crypto.label || networkLabel(crypto.cryptoNetwork)}
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
              </div>
              <div className="flex items-center gap-2 text-xs text-[#9fa0b8] flex-wrap">
                <span className="px-1.5 py-0.5 rounded bg-[#1a1a22] text-[10px] text-[#c7c7da]">{networkLabel(crypto.cryptoNetwork)}</span>
                <span className="font-mono">{shortAddr(crypto.cryptoAddress)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="outline" size="sm" onClick={openCrypto}
                className="border-[#2a2a35] text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white gap-1.5 h-8 text-xs">
                <Pencil className="w-3.5 h-3.5" /><span className="hidden sm:inline">Edit</span>
              </Button>
              <Button variant="outline" size="sm" disabled={deletingId === crypto._id}
                onClick={() => removeAccount(crypto._id)}
                className="border-[#2a2a35] text-[#9fa0b8] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 h-8 px-2">
                {deletingId === crypto._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        ) : (
          <button onClick={openCrypto} className="flex items-center gap-3 sm:gap-4 w-full text-left">
            <div className="p-2.5 rounded-xl bg-brand/10 shrink-0 group-hover:bg-brand/15 transition-colors">
              <Coins className="w-5 h-5 text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-white block">Add Crypto Address</span>
              <span className="text-xs text-[#9fa0b8]">Stablecoin / crypto payouts</span>
            </div>
            <div className="p-1.5 rounded-lg bg-brand/10 shrink-0 group-hover:bg-brand/20 transition-colors">
              <Plus className="w-4 h-4 text-brand" />
            </div>
          </button>
        )}
      </div>

      {/* ── Bank modal ── */}
      <Dialog open={bankModalOpen} onOpenChange={setBankModalOpen}>
        <DialogContent showCloseButton className="bg-[#0c0c0e] border-[#2a2a35] sm:max-w-[580px] max-h-[90vh] overflow-y-auto p-0 gap-0">
          <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4">
            <DialogHeader className="gap-1">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-brand/10"><Landmark className="w-4 h-4 text-brand" /></div>
                <DialogTitle className="text-white text-base sm:text-lg">{bank ? "Edit Bank Account" : "Add Bank Account"}</DialogTitle>
              </div>
              <DialogDescription className="text-[#9fa0b8] text-xs sm:text-sm pl-[42px]">
                {WALLET_LABELS[walletType]} payout destination.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-5">
            <div className="space-y-3">
              <SectionDivider icon={Building2} title="Bank Information" />
              <div className="grid grid-cols-2 gap-2.5">
                <div className="col-span-2 sm:col-span-1">
                  <FieldLabel required>Country</FieldLabel>
                  <Select value={bankForm.country} onValueChange={(v) => setBankForm((p) => ({ ...p, country: v }))}>
                    <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      {countries.map((c) => (<SelectItem key={c.isoCode} value={c.isoCode}>{c.flag} {c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  {bankErrors.country && <p className="text-[11px] text-red-400 mt-1">{bankErrors.country}</p>}
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <FieldLabel required>Bank Name</FieldLabel>
                  <Input className={inputClass} placeholder="e.g. JPMorgan Chase" value={bankForm.bankName} onChange={(e) => setBankForm((p) => ({ ...p, bankName: e.target.value }))} />
                  {bankErrors.bankName && <p className="text-[11px] text-red-400 mt-1">{bankErrors.bankName}</p>}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <SectionDivider icon={MapPin} title="Bank Address" required />
              <AddressFields address={bankForm.branchAddress} onChange={(f, v) => setBankForm((p) => ({ ...p, branchAddress: { ...p.branchAddress, [f]: v } }))} />
              {bankErrors.branchAddress && <p className="text-[11px] text-red-400">{bankErrors.branchAddress}</p>}
            </div>

            <div className="space-y-3">
              <SectionDivider icon={CreditCard} title="Account Details" />
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <FieldLabel required>Account Number</FieldLabel>
                  <Input className={inputClass} placeholder="Account number" value={bankForm.accountNumber} onChange={(e) => setBankForm((p) => ({ ...p, accountNumber: e.target.value }))} />
                  {bankErrors.accountNumber && <p className="text-[11px] text-red-400 mt-1">{bankErrors.accountNumber}</p>}
                </div>
                <div>
                  <FieldLabel required>SWIFT Code</FieldLabel>
                  <Input className={inputClass} placeholder="e.g. CHASUS33" value={bankForm.swiftCode} onChange={(e) => setBankForm((p) => ({ ...p, swiftCode: e.target.value }))} />
                  {bankErrors.swiftCode && <p className="text-[11px] text-red-400 mt-1">{bankErrors.swiftCode}</p>}
                </div>
                <div>
                  <FieldLabel>Routing Number</FieldLabel>
                  <Input className={inputClass} placeholder="Optional" value={bankForm.routingNumber} onChange={(e) => setBankForm((p) => ({ ...p, routingNumber: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel>IBAN Number</FieldLabel>
                  <Input className={inputClass} placeholder="Optional" value={bankForm.ibanNumber} onChange={(e) => setBankForm((p) => ({ ...p, ibanNumber: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <SectionDivider icon={User} title="Beneficiary" />
              <div>
                <FieldLabel required>Beneficiary Name</FieldLabel>
                <Input className={inputClass} placeholder="Full legal name of account holder" value={bankForm.beneficiaryName} onChange={(e) => setBankForm((p) => ({ ...p, beneficiaryName: e.target.value }))} />
                {bankErrors.beneficiaryName && <p className="text-[11px] text-red-400 mt-1">{bankErrors.beneficiaryName}</p>}
              </div>
            </div>

            <div className="space-y-3">
              <SectionDivider icon={MapPin} title="Beneficiary Address" required />
              <AddressFields address={bankForm.beneficiaryAddress} onChange={(f, v) => setBankForm((p) => ({ ...p, beneficiaryAddress: { ...p.beneficiaryAddress, [f]: v } }))} />
              {bankErrors.beneficiaryAddress && <p className="text-[11px] text-red-400">{bankErrors.beneficiaryAddress}</p>}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#2a2a35]">
              <Button variant="outline" onClick={() => setBankModalOpen(false)} disabled={saving}
                className="border-[#2a2a35] text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white h-9 text-sm rounded-lg px-4">Cancel</Button>
              <Button onClick={saveBank} disabled={saving}
                className="bg-brand hover:opacity-90 text-brand-foreground h-9 text-sm font-semibold rounded-lg px-5 min-w-[100px]">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />Saving...</> : bank ? "Update Account" : "Save Account"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Crypto modal ── */}
      <Dialog open={cryptoModalOpen} onOpenChange={setCryptoModalOpen}>
        <DialogContent showCloseButton className="bg-[#0c0c0e] border-[#2a2a35] sm:max-w-[480px] max-h-[90vh] overflow-y-auto p-0 gap-0">
          <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4">
            <DialogHeader className="gap-1">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-brand/10"><Coins className="w-4 h-4 text-brand" /></div>
                <DialogTitle className="text-white text-base sm:text-lg">{crypto ? "Edit Crypto Address" : "Add Crypto Address"}</DialogTitle>
              </div>
              <DialogDescription className="text-[#9fa0b8] text-xs sm:text-sm pl-[42px]">
                {WALLET_LABELS[walletType]} crypto payout destination.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-4">
            <div>
              <FieldLabel required>Network</FieldLabel>
              <Select value={cryptoForm.cryptoNetwork} onValueChange={(v) => setCryptoForm((p) => ({ ...p, cryptoNetwork: v as CryptoNetwork }))}>
                <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Select network" /></SelectTrigger>
                <SelectContent className={selectContentClass}>
                  {CRYPTO_NETWORKS.map((n) => (<SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>))}
                </SelectContent>
              </Select>
              {cryptoErrors.cryptoNetwork && <p className="text-[11px] text-red-400 mt-1">{cryptoErrors.cryptoNetwork}</p>}
            </div>
            <div>
              <FieldLabel required>Wallet Address</FieldLabel>
              <Input className={`${inputClass} font-mono`} placeholder="Paste your wallet address" value={cryptoForm.cryptoAddress} onChange={(e) => setCryptoForm((p) => ({ ...p, cryptoAddress: e.target.value }))} />
              {cryptoErrors.cryptoAddress && <p className="text-[11px] text-red-400 mt-1">{cryptoErrors.cryptoAddress}</p>}
            </div>
            <div>
              <FieldLabel>Label</FieldLabel>
              <Input className={inputClass} placeholder="Optional — e.g. My USDT wallet" value={cryptoForm.label} onChange={(e) => setCryptoForm((p) => ({ ...p, label: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>Memo / Tag</FieldLabel>
              <Input className={inputClass} placeholder="Optional — only for chains that require it" value={cryptoForm.cryptoMemo} onChange={(e) => setCryptoForm((p) => ({ ...p, cryptoMemo: e.target.value }))} />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#2a2a35]">
              <Button variant="outline" onClick={() => setCryptoModalOpen(false)} disabled={saving}
                className="border-[#2a2a35] text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white h-9 text-sm rounded-lg px-4">Cancel</Button>
              <Button onClick={saveCrypto} disabled={saving}
                className="bg-brand hover:opacity-90 text-brand-foreground h-9 text-sm font-semibold rounded-lg px-5 min-w-[100px]">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />Saving...</> : crypto ? "Update Address" : "Save Address"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

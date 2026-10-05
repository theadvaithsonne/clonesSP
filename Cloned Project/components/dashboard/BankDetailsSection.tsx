"use client";

import { useState, useEffect } from "react";
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
  getBankDetails,
  saveBankDetails,
  type BankDetailsData,
  type BankAddress,
} from "@/lib/feed-api";

const emptyAddress: BankAddress = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

interface FormState {
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

const initialForm: FormState = {
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

const countries = Country.getAllCountries();

const inputClass =
  "bg-[#1a1a22] border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/40 focus-visible:ring-brand/20 focus-visible:border-brand/40 h-9 text-sm rounded-lg";

const selectTriggerClass =
  "w-full bg-[#1a1a22] border-[#2a2a35] text-white h-9 text-sm focus:ring-brand/20 focus:border-brand/40 rounded-lg";

const selectContentClass =
  "bg-[#0e0e12] border-[#2a2a35] text-white max-h-[280px]";

/* ── Tiny helpers ─────────────────────────────────────────── */

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
        <Input
          className={inputClass}
          placeholder="Street address"
          value={address.line1}
          onChange={(e) => onChange("line1", e.target.value)}
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <FieldLabel>Address Line 2</FieldLabel>
        <Input
          className={inputClass}
          placeholder="Apt, suite, etc."
          value={address.line2}
          onChange={(e) => onChange("line2", e.target.value)}
        />
      </div>
      <div>
        <FieldLabel>City</FieldLabel>
        <Input
          className={inputClass}
          placeholder="City"
          value={address.city}
          onChange={(e) => onChange("city", e.target.value)}
        />
      </div>
      <div>
        <FieldLabel>State / Province</FieldLabel>
        <Input
          className={inputClass}
          placeholder="State"
          value={address.state}
          onChange={(e) => onChange("state", e.target.value)}
        />
      </div>
      <div>
        <FieldLabel>Postal Code</FieldLabel>
        <Input
          className={inputClass}
          placeholder="ZIP / Postal"
          value={address.postalCode}
          onChange={(e) => onChange("postalCode", e.target.value)}
        />
      </div>
      <div>
        <FieldLabel>Country</FieldLabel>
        <Select
          value={address.country}
          onValueChange={(v) => onChange("country", v)}
        >
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

function maskAccount(value: string): string {
  if (value.length <= 4) return value;
  return "••••" + value.slice(-4);
}

/* ── Main component ──────────────────────────────────────── */

export function BankDetailsSection() {
  const [bankDetails, setBankDetails] = useState<BankDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<FormState>({ ...initialForm });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchBankDetails();
  }, []);

  async function fetchBankDetails() {
    try {
      setLoading(true);
      const res = await getBankDetails();
      if (res.bankDetails) setBankDetails(res.bankDetails);
    } catch {
      // silently fail — card will show "add" state
    } finally {
      setLoading(false);
    }
  }

  function openModal() {
    if (bankDetails) {
      setFormData({
        country: bankDetails.country,
        bankName: bankDetails.bankName,
        branchAddress: { ...bankDetails.branchAddress },
        routingNumber: bankDetails.routingNumber,
        accountNumber: bankDetails.accountNumber,
        swiftCode: bankDetails.swiftCode,
        ibanNumber: bankDetails.ibanNumber,
        beneficiaryName: bankDetails.beneficiaryName,
        beneficiaryAddress: { ...bankDetails.beneficiaryAddress },
      });
    } else {
      setFormData({ ...initialForm });
    }
    setErrors({});
    setModalOpen(true);
  }

  function updateField(field: keyof FormState, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function updateBranchAddress(field: keyof BankAddress, value: string) {
    setFormData((prev) => ({
      ...prev,
      branchAddress: { ...prev.branchAddress, [field]: value },
    }));
  }

  function updateBeneficiaryAddress(field: keyof BankAddress, value: string) {
    setFormData((prev) => ({
      ...prev,
      beneficiaryAddress: { ...prev.beneficiaryAddress, [field]: value },
    }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!formData.country) e.country = "Required";
    if (!formData.bankName.trim()) e.bankName = "Required";
    if (!formData.accountNumber.trim()) e.accountNumber = "Required";
    if (!formData.swiftCode.trim()) e.swiftCode = "Required";
    if (!formData.beneficiaryName.trim()) e.beneficiaryName = "Required";
    const ba = formData.branchAddress;
    if (!ba.line1.trim() && !ba.city.trim())
      e.branchAddress = "Provide at least a street address or city";
    const bfa = formData.beneficiaryAddress;
    if (!bfa.line1.trim() && !bfa.city.trim())
      e.beneficiaryAddress = "Provide at least a street address or city";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    try {
      setSaving(true);
      const res = await saveBankDetails(formData);
      setBankDetails(res.bankDetails);
      setModalOpen(false);
      toast.success("Bank details saved successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to save bank details");
    } finally {
      setSaving(false);
    }
  }

  /* ── Loading skeleton ───────────────────────────────────── */
  if (loading) {
    return (
      <div className="bg-[#0e0e12] rounded-xl border border-[#2a2a35] p-4 sm:p-5">
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-[#1a1a22]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 rounded bg-[#1a1a22]" />
            <div className="h-3 w-44 rounded bg-[#1a1a22]" />
          </div>
          <div className="h-8 w-16 rounded-lg bg-[#1a1a22]" />
        </div>
      </div>
    );
  }

  const countryObj = bankDetails?.country
    ? Country.getCountryByCode(bankDetails.country)
    : null;

  /* ── Summary card ───────────────────────────────────────── */
  return (
    <>
      <div className="bg-[#0e0e12] rounded-xl border border-[#2a2a35] p-4 sm:p-5 group hover:border-[#3a3a45] transition-colors">
        {bankDetails ? (
          /* ── Has bank details: compact summary ── */
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2.5 rounded-xl bg-brand/10 shrink-0">
              <Landmark className="w-5 h-5 text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm sm:text-base font-semibold text-white truncate">
                  {bankDetails.bankName}
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-[#9fa0b8]">
                {countryObj && (
                  <span>
                    {countryObj.flag} {countryObj.name}
                  </span>
                )}
                <span className="text-[#2a2a35]">|</span>
                <span>Acct {maskAccount(bankDetails.accountNumber)}</span>
                {bankDetails.swiftCode && (
                  <>
                    <span className="text-[#2a2a35]">|</span>
                    <span>{bankDetails.swiftCode}</span>
                  </>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={openModal}
              className="border-[#2a2a35] text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white gap-1.5 h-8 text-xs sm:text-sm shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          </div>
        ) : (
          /* ── No bank details: prompt to add ── */
          <button
            onClick={openModal}
            className="flex items-center gap-3 sm:gap-4 w-full text-left"
          >
            <div className="p-2.5 rounded-xl bg-brand/10 shrink-0 group-hover:bg-brand/15 transition-colors">
              <Landmark className="w-5 h-5 text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm sm:text-base font-semibold text-white block">
                Add Bank Details
              </span>
              <span className="text-xs sm:text-sm text-[#9fa0b8]">
                Set up your bank account for affiliate payouts
              </span>
            </div>
            <div className="p-1.5 rounded-lg bg-brand/10 shrink-0 group-hover:bg-brand/20 transition-colors">
              <Plus className="w-4 h-4 text-brand" />
            </div>
          </button>
        )}
      </div>

      {/* ── Modal ─────────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          showCloseButton
          className="bg-[#0c0c0e] border-[#2a2a35] sm:max-w-[580px] max-h-[90vh] overflow-y-auto p-0 gap-0"
        >
          {/* Header */}
          <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4">
            <DialogHeader className="gap-1">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-brand/10">
                  <Landmark className="w-4 h-4 text-brand" />
                </div>
                <DialogTitle className="text-white text-base sm:text-lg">
                  {bankDetails ? "Edit Bank Details" : "Add Bank Details"}
                </DialogTitle>
              </div>
              <DialogDescription className="text-[#9fa0b8] text-xs sm:text-sm pl-[42px]">
                {bankDetails
                  ? "Update your bank account information."
                  : "Add your bank account to receive affiliate payouts."}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Body */}
          <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-5">
            {/* ─ Bank Info ─ */}
            <div className="space-y-3">
              <SectionDivider icon={Building2} title="Bank Information" />
              <div className="grid grid-cols-2 gap-2.5">
                <div className="col-span-2 sm:col-span-1">
                  <FieldLabel required>Country</FieldLabel>
                  <Select
                    value={formData.country}
                    onValueChange={(v) => updateField("country", v)}
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      {countries.map((c) => (
                        <SelectItem key={c.isoCode} value={c.isoCode}>
                          {c.flag} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.country && (
                    <p className="text-[11px] text-red-400 mt-1">
                      {errors.country}
                    </p>
                  )}
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <FieldLabel required>Bank Name</FieldLabel>
                  <Input
                    className={inputClass}
                    placeholder="e.g. JPMorgan Chase"
                    value={formData.bankName}
                    onChange={(e) => updateField("bankName", e.target.value)}
                  />
                  {errors.bankName && (
                    <p className="text-[11px] text-red-400 mt-1">
                      {errors.bankName}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ─ Bank Address ─ */}
            <div className="space-y-3">
              <SectionDivider icon={MapPin} title="Bank Address" required />
              <AddressFields
                address={formData.branchAddress}
                onChange={updateBranchAddress}
              />
              {errors.branchAddress && (
                <p className="text-[11px] text-red-400">
                  {errors.branchAddress}
                </p>
              )}
            </div>

            {/* ─ Account Details ─ */}
            <div className="space-y-3">
              <SectionDivider icon={CreditCard} title="Account Details" />
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <FieldLabel required>Account Number</FieldLabel>
                  <Input
                    className={inputClass}
                    placeholder="Account number"
                    value={formData.accountNumber}
                    onChange={(e) =>
                      updateField("accountNumber", e.target.value)
                    }
                  />
                  {errors.accountNumber && (
                    <p className="text-[11px] text-red-400 mt-1">
                      {errors.accountNumber}
                    </p>
                  )}
                </div>
                <div>
                  <FieldLabel required>SWIFT Code</FieldLabel>
                  <Input
                    className={inputClass}
                    placeholder="e.g. CHASUS33"
                    value={formData.swiftCode}
                    onChange={(e) => updateField("swiftCode", e.target.value)}
                  />
                  {errors.swiftCode && (
                    <p className="text-[11px] text-red-400 mt-1">
                      {errors.swiftCode}
                    </p>
                  )}
                </div>
                <div>
                  <FieldLabel>Routing Number</FieldLabel>
                  <Input
                    className={inputClass}
                    placeholder="Optional"
                    value={formData.routingNumber}
                    onChange={(e) =>
                      updateField("routingNumber", e.target.value)
                    }
                  />
                </div>
                <div>
                  <FieldLabel>IBAN Number</FieldLabel>
                  <Input
                    className={inputClass}
                    placeholder="Optional"
                    value={formData.ibanNumber}
                    onChange={(e) => updateField("ibanNumber", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ─ Beneficiary ─ */}
            <div className="space-y-3">
              <SectionDivider icon={User} title="Beneficiary" />
              <div>
                <FieldLabel required>Beneficiary Name</FieldLabel>
                <Input
                  className={inputClass}
                  placeholder="Full legal name of account holder"
                  value={formData.beneficiaryName}
                  onChange={(e) =>
                    updateField("beneficiaryName", e.target.value)
                  }
                />
                {errors.beneficiaryName && (
                  <p className="text-[11px] text-red-400 mt-1">
                    {errors.beneficiaryName}
                  </p>
                )}
              </div>
            </div>

            {/* ─ Beneficiary Address ─ */}
            <div className="space-y-3">
              <SectionDivider
                icon={MapPin}
                title="Beneficiary Address"
                required
              />
              <AddressFields
                address={formData.beneficiaryAddress}
                onChange={updateBeneficiaryAddress}
              />
              {errors.beneficiaryAddress && (
                <p className="text-[11px] text-red-400">
                  {errors.beneficiaryAddress}
                </p>
              )}
            </div>

            {/* ─ Actions ─ */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#2a2a35]">
              <Button
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="border-[#2a2a35] text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white h-9 text-sm rounded-lg px-4"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground h-9 text-sm font-semibold rounded-lg px-5 min-w-[100px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    Saving...
                  </>
                ) : bankDetails ? (
                  "Update Details"
                ) : (
                  "Save Details"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

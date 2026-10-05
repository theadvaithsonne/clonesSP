"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, X, Plus } from "lucide-react";
import { Country, State } from "country-state-city";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import ImageUpload from "@/components/coverfi/brokerage/ImageUpload";
import {
  createCompanyStep1,
  createCompanyStep2,
  createCompanyStep3,
} from "@/lib/coverfi/companies-api";
import { listProducts } from "@/lib/coverfi/products-api";
import type { Company, Product } from "@/lib/coverfi/types";
import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1, label: "Basic info" },
  { n: 2, label: "Address" },
  { n: 3, label: "Products" },
];

export default function CompanyWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // step 1
  const [info, setInfo] = useState({
    legal_name: "",
    display_name: "",
    industry: "",
    poc_first_name: "",
    poc_last_name: "",
    poc_email: "",
    poc_phone: "",
  });

  // step 2
  const [addr, setAddr] = useState({
    company_logo: "",
    street_number: "",
    street_name: "",
    city: "",
    state: "",
    country: "",
    pincode: "",
  });

  // step 3
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listProducts()
      .then((p) => setProducts(p.filter((x) => x.is_active)))
      .catch(() => {});
  }, []);

  async function submitStep1() {
    if (!info.legal_name) {
      toast.error("Legal name is required");
      return;
    }
    setSaving(true);
    try {
      const created = await createCompanyStep1({
        legal_name: info.legal_name,
        display_name: info.display_name || undefined,
        industry: info.industry || undefined,
        poc: {
          first_name: info.poc_first_name || undefined,
          last_name: info.poc_last_name || undefined,
          email: info.poc_email || undefined,
          phone_number: info.poc_phone || undefined,
        },
      });
      setCompanyId(created._id);
      setStep(2);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitStep2() {
    if (!companyId) return;
    setSaving(true);
    try {
      const payload: Partial<Company> = {
        company_logo: addr.company_logo || undefined,
        street_number: addr.street_number || undefined,
        street_name: addr.street_name || undefined,
        city: addr.city || undefined,
        state: addr.state || undefined,
        country: addr.country || undefined,
        pincode: addr.pincode ? Number(addr.pincode) : undefined,
      };
      await createCompanyStep2(companyId, payload);
      setStep(3);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitStep3() {
    if (!companyId) return;
    setSaving(true);
    try {
      await createCompanyStep3(companyId, {
        enrolled_products: selectedProductIds.map((id) => ({ productId: id })),
      });
      toast.success("Company created");
      router.push(`/coverfi/companies/${companyId}`);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function toggleProduct(id: string) {
    setSelectedProductIds((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  }

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">New customer company</h1>
      <Stepper current={step} />

      {step === 1 && (
        <BasicInfoStep
          data={info}
          setData={setInfo}
          onNext={submitStep1}
          saving={saving}
        />
      )}
      {step === 2 && (
        <AddressStep
          data={addr}
          setData={setAddr}
          onBack={() => setStep(1)}
          onNext={submitStep2}
          saving={saving}
        />
      )}
      {step === 3 && (
        <ProductsStep
          products={products}
          selected={selectedProductIds}
          toggle={toggleProduct}
          onBack={() => setStep(2)}
          onFinish={submitStep3}
          saving={saving}
        />
      )}
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-1">
      {STEPS.map((s, i) => {
        const isComplete = current > s.n;
        const isActive = current === s.n;
        return (
          <li key={s.n} className="flex items-center gap-1">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm",
                isActive
                  ? "bg-[#15151b] text-white border border-[#3b3b4a]"
                  : isComplete
                    ? "text-brand"
                    : "text-[#9fa0b8]",
              )}
            >
              <span
                className={cn(
                  "h-5 w-5 rounded-full flex items-center justify-center text-xs font-medium border",
                  isComplete
                    ? "bg-brand/20 border-brand/40 text-brand"
                    : isActive
                      ? "bg-brand/20 border-brand/40 text-brand"
                      : "bg-[#15151b] border-[#2a2a3a]",
                )}
              >
                {isComplete ? <Check className="h-3 w-3" /> : s.n}
              </span>
              {s.label}
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-[#3b3b4a]" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function BasicInfoStep({
  data,
  setData,
  onNext,
  saving,
}: {
  data: any;
  setData: (d: any) => void;
  onNext: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Legal name" required>
          <Input
            value={data.legal_name}
            onChange={(e) => setData({ ...data, legal_name: e.target.value })}
            placeholder="Acme Pvt Ltd"
          />
        </Field>
        <Field label="Display name">
          <Input
            value={data.display_name}
            onChange={(e) =>
              setData({ ...data, display_name: e.target.value })
            }
            placeholder="Acme"
          />
        </Field>
        <Field label="Industry">
          <Input
            value={data.industry}
            onChange={(e) => setData({ ...data, industry: e.target.value })}
            placeholder="Technology"
          />
        </Field>
      </div>

      <div className="border-t border-[#222230] pt-4">
        <div className="text-xs uppercase tracking-wider text-brand mb-3">
          Point of contact
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <Input
              value={data.poc_first_name}
              onChange={(e) =>
                setData({ ...data, poc_first_name: e.target.value })
              }
            />
          </Field>
          <Field label="Last name">
            <Input
              value={data.poc_last_name}
              onChange={(e) =>
                setData({ ...data, poc_last_name: e.target.value })
              }
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={data.poc_email}
              onChange={(e) => setData({ ...data, poc_email: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <Input
              value={data.poc_phone}
              onChange={(e) =>
                setData({
                  ...data,
                  poc_phone: e.target.value.replace(/\D/g, ""),
                })
              }
            />
          </Field>
        </div>
      </div>

      <div className="pt-2">
        <Button onClick={onNext} disabled={saving}>
          {saving ? "Saving…" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

function AddressStep({
  data,
  setData,
  onBack,
  onNext,
  saving,
}: {
  data: any;
  setData: (d: any) => void;
  onBack: () => void;
  onNext: () => void;
  saving: boolean;
}) {
  const countries = Country.getAllCountries();
  const states = data.country ? State.getStatesOfCountry(data.country) : [];
  return (
    <div className="space-y-4">
      <ImageUpload
        label="Company logo"
        value={data.company_logo}
        onChange={(url) => setData({ ...data, company_logo: url })}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Street number">
          <Input
            value={data.street_number}
            onChange={(e) =>
              setData({ ...data, street_number: e.target.value })
            }
          />
        </Field>
        <Field label="Street name">
          <Input
            value={data.street_name}
            onChange={(e) =>
              setData({ ...data, street_name: e.target.value })
            }
          />
        </Field>
        <Field label="City">
          <Input
            value={data.city}
            onChange={(e) => setData({ ...data, city: e.target.value })}
          />
        </Field>
        <Field label="Country">
          <Select
            value={data.country}
            onValueChange={(v) =>
              setData({ ...data, country: v, state: "" })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {countries.map((c) => (
                <SelectItem key={c.isoCode} value={c.isoCode}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="State">
          <Select
            value={data.state}
            onValueChange={(v) => setData({ ...data, state: v })}
            disabled={!data.country}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {states.map((s) => (
                <SelectItem key={s.isoCode} value={s.isoCode}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Pincode">
          <Input
            value={data.pincode}
            onChange={(e) =>
              setData({
                ...data,
                pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
              })
            }
          />
        </Field>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={saving}>
          {saving ? "Saving…" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

function ProductsStep({
  products,
  selected,
  toggle,
  onBack,
  onFinish,
  saving,
}: {
  products: Product[];
  selected: string[];
  toggle: (id: string) => void;
  onBack: () => void;
  onFinish: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Enroll products</h2>
      <p className="text-sm text-[#9fa0b8]">
        Pick products this company is buying. You can change this later.
      </p>
      {products.length === 0 ? (
        <p className="text-sm text-[#9fa0b8] italic">
          No active products yet — you can finish here and enroll later from
          the company detail page.
        </p>
      ) : (
        <div className="space-y-2 max-w-2xl">
          {products.map((p) => {
            const checked = selected.includes(p._id);
            return (
              <label
                key={p._id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                  checked
                    ? "bg-[#15151b] border-brand/40"
                    : "bg-[#0c0c12] border-[#222230] hover:border-[#3b3b4a]",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(p._id)}
                />
                <div className="flex-1">
                  <div className="font-medium">{p.name}</div>
                  {p.description && (
                    <div className="text-xs text-[#9fa0b8] truncate">
                      {p.description}
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onFinish} disabled={saving}>
          {saving ? "Saving…" : "Finish"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-[#9fa0b8]">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

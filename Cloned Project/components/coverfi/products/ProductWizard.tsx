"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import ImageUpload from "@/components/coverfi/brokerage/ImageUpload";
import { uploadFile } from "@/lib/coverfi/uploadFile";
import { listInsuranceCompanies } from "@/lib/coverfi/insurance-api";
import {
  getProduct,
  listCategories,
  createCategory,
  listFilterTypes,
  listFilterItemsForType,
  stepCategory,
  stepFilters,
  stepInfo,
  stepBilling,
} from "@/lib/coverfi/products-api";
import {
  BILLING_TYPES,
  PAYMENT_FREQUENCIES,
  WAIVER_TYPES,
  type BillingType,
  type FilterItem,
  type FilterType,
  type InsuranceCompany,
  type PaymentFrequency,
  type Product,
  type ProductCategory,
  type WaiverType,
} from "@/lib/coverfi/types";
import { cn } from "@/lib/utils";
import CategoryFormDialog from "./CategoryFormDialog";

const STEPS = [
  { n: 2, label: "Category" },
  { n: 3, label: "Filters" },
  { n: 4, label: "Product info" },
  { n: 5, label: "Billing & coverage" },
];

const COMMON_COVERAGE = ["Self", "Spouse", "Family", "Parents", "Children"];

type Props = { productId: string };

export default function ProductWizard({ productId }: Props) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(2);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProduct(productId)
      .then((p) => {
        setProduct(p);
        // start at the next step that needs to be filled
        const nextStep = Math.min(5, Math.max(2, (p.step_completed || 1) + 1));
        setCurrentStep(p.is_active ? 5 : nextStep);
      })
      .catch((e) => toast.error(e?.message || "Failed to load product"))
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) {
    return (
      <div className="p-8 text-[#9fa0b8] flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading product…
      </div>
    );
  }
  if (!product) {
    return (
      <div className="p-8 text-sm text-[#9fa0b8]">
        Couldn&apos;t load this product. It may have been deleted or you
        don&apos;t have access.
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {product.is_active
            ? `Editing ${product.name || "product"}`
            : "Create new product"}
        </h1>
        <p className="text-sm text-[#9fa0b8] mt-1">
          {product.is_active
            ? "Click any completed step to jump to it."
            : "Walk through the steps to publish your product."}
        </p>
      </div>

      <Stepper
        current={currentStep}
        done={product.step_completed || 1}
        onJump={(n) => setCurrentStep(n)}
      />

      {currentStep === 2 && (
        <CategoryStep
          product={product}
          onNext={(p) => {
            setProduct(p);
            setCurrentStep(3);
          }}
        />
      )}
      {currentStep === 3 && (
        <FiltersStep
          product={product}
          onBack={() => setCurrentStep(2)}
          onNext={(p) => {
            setProduct(p);
            setCurrentStep(4);
          }}
        />
      )}
      {currentStep === 4 && (
        <InfoStep
          product={product}
          onBack={() => setCurrentStep(3)}
          onNext={(p) => {
            setProduct(p);
            setCurrentStep(5);
          }}
        />
      )}
      {currentStep === 5 && (
        <BillingStep
          product={product}
          onBack={() => setCurrentStep(4)}
          onFinish={() => {
            toast.success("Product saved");
            router.push("/coverfi/products");
          }}
        />
      )}
    </div>
  );
}

function Stepper({
  current,
  done,
  onJump,
}: {
  current: number;
  done: number;
  onJump?: (n: number) => void;
}) {
  return (
    <ol className="flex items-center gap-1">
      {STEPS.map((s, i) => {
        const isComplete = done >= s.n;
        const isActive = current === s.n;
        // Allow clicking on already-completed steps OR the currently active one.
        const clickable = !!onJump && (isComplete || isActive);
        const content = (
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all duration-200",
              isActive
                ? "bg-[#15151b] text-white border border-[#3b3b4a]"
                : isComplete
                  ? "text-brand border border-transparent"
                  : "text-[#9fa0b8] border border-transparent",
              clickable &&
                !isActive &&
                "hover:bg-[#101015] hover:border-[#2a2a3a] cursor-pointer",
            )}
          >
            <span
              className={cn(
                "h-5 w-5 rounded-full flex items-center justify-center text-xs font-medium border transition-colors duration-200",
                isComplete || isActive
                  ? "bg-brand/20 border-brand/40 text-brand"
                  : "bg-[#15151b] border-[#2a2a3a]",
              )}
            >
              {isComplete && !isActive ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            {s.label}
          </div>
        );
        return (
          <li key={s.n} className="flex items-center gap-1">
            {clickable && !isActive ? (
              <button
                type="button"
                onClick={() => onJump!(s.n)}
                className="block"
              >
                {content}
              </button>
            ) : (
              content
            )}
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-[#3b3b4a]" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ----------------- step 2: category ----------------- */

function CategoryStep({
  product,
  onNext,
}: {
  product: Product;
  onNext: (p: Product) => void;
}) {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [selected, setSelected] = useState<string>(product.category || "");
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function refresh() {
    setCategories(await listCategories());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onSave() {
    if (!selected) {
      toast.error("Pick a category");
      return;
    }
    setSaving(true);
    try {
      const updated = await stepCategory(product._id, selected);
      onNext(updated);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Choose a category</h2>
      <div className="flex gap-2">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="max-w-md">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {c.category_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New category
        </Button>
      </div>
      <div className="pt-2">
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Continue"}
        </Button>
      </div>

      <CategoryFormDialog
        open={dialogOpen}
        existing={null}
        onClose={() => setDialogOpen(false)}
        onSaved={(c) => {
          refresh();
          if (c) setSelected(c._id);
        }}
      />
    </div>
  );
}

/* ----------------- step 3: filters ----------------- */

function FiltersStep({
  product,
  onBack,
  onNext,
}: {
  product: Product;
  onBack: () => void;
  onNext: (p: Product) => void;
}) {
  const [types, setTypes] = useState<FilterType[]>([]);
  const [selected, setSelected] = useState<string[]>(product.filters || []);
  const [itemsByType, setItemsByType] = useState<Record<string, FilterItem[]>>(
    {},
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const list = await listFilterTypes();
      setTypes(list);
      // Lazily preload items for each type so users see what's in each filter
      const items: Record<string, FilterItem[]> = {};
      await Promise.all(
        list.map(async (t) => {
          items[t._id] = await listFilterItemsForType(t._id).catch(() => []);
        }),
      );
      setItemsByType(items);
    })();
  }, []);

  function toggle(id: string) {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  }

  async function onSave() {
    setSaving(true);
    try {
      const updated = await stepFilters(product._id, selected);
      onNext(updated);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Pick filters</h2>
      <p className="text-sm text-[#9fa0b8]">
        Choose filter types that apply to this product. Customers will see the
        items inside each filter when browsing.
      </p>
      {types.length === 0 && (
        <p className="text-sm text-[#9fa0b8] italic">
          No filter types defined yet. You can skip this step or define them
          in the Filters tab first.
        </p>
      )}
      <div className="space-y-2 max-w-2xl">
        {types.map((t) => {
          const checked = selected.includes(t._id);
          const items = itemsByType[t._id] || [];
          return (
            <label
              key={t._id}
              className={cn(
                "block rounded-lg border p-3 cursor-pointer transition-colors",
                checked
                  ? "bg-[#15151b] border-brand/40"
                  : "bg-[#0c0c12] border-[#222230] hover:border-[#3b3b4a]",
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(t._id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium">{t.filter_type_name}</div>
                  {t.filter_type_description && (
                    <div className="text-xs text-[#9fa0b8] mt-0.5">
                      {t.filter_type_description}
                    </div>
                  )}
                  {items.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {items.map((it) => (
                        <Badge
                          key={it._id}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {it.filter_item_name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </label>
          );
        })}
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

/* ----------------- step 4: info ----------------- */

function InfoStep({
  product,
  onBack,
  onNext,
}: {
  product: Product;
  onBack: () => void;
  onNext: (p: Product) => void;
}) {
  const [insurers, setInsurers] = useState<InsuranceCompany[]>([]);
  const [data, setData] = useState({
    name: product.name || "",
    description: product.description || "",
    type: product.type || "",
    insurance_provider: product.insurance_provider || "",
    logo: product.logo || "",
    product_document: product.product_document || "",
  });
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listInsuranceCompanies()
      .then(setInsurers)
      .catch((e) => toast.error(e?.message || "Failed to load insurers"));
  }, []);

  async function onPickPdf(file: File) {
    setUploadingPdf(true);
    try {
      const { url } = await uploadFile(file);
      setData((d) => ({ ...d, product_document: url }));
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploadingPdf(false);
    }
  }

  async function onSave() {
    if (!data.name || !data.insurance_provider) {
      toast.error("Name and insurance provider are required");
      return;
    }
    setSaving(true);
    try {
      const updated = await stepInfo(product._id, data);
      onNext(updated);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Product information</h2>

      <div className="grid grid-cols-2 gap-3 max-w-3xl">
        <div className="space-y-1.5">
          <Label className="text-xs text-[#9fa0b8]">
            Name <span className="text-red-400">*</span>
          </Label>
          <Input
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            placeholder="HDFC Health Optima"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[#9fa0b8]">
            Insurance provider <span className="text-red-400">*</span>
          </Label>
          <Select
            value={data.insurance_provider}
            onValueChange={(v) =>
              setData({ ...data, insurance_provider: v })
            }
            disabled={insurers.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  insurers.length === 0 ? "No providers yet" : "Select provider"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {insurers.map((i) => (
                <SelectItem key={i._id} value={i._id}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {insurers.length === 0 && (
            <p className="text-[11px] text-[#9fa0b8]">
              <Link
                href="/coverfi/insurance-companies"
                className="text-brand hover:underline"
              >
                Add an insurance provider
              </Link>{" "}
              first, then come back here.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[#9fa0b8]">Type</Label>
          <Input
            value={data.type}
            onChange={(e) => setData({ ...data, type: e.target.value })}
            placeholder="Individual, Group, etc."
          />
        </div>
        <div />
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs text-[#9fa0b8]">Description</Label>
          <Textarea
            rows={3}
            value={data.description}
            onChange={(e) =>
              setData({ ...data, description: e.target.value })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 max-w-3xl pt-2">
        <ImageUpload
          label="Product logo"
          value={data.logo}
          onChange={(url) => setData((d) => ({ ...d, logo: url }))}
        />
        <div className="space-y-1.5">
          <Label className="text-xs text-[#9fa0b8]">
            Product document (PDF)
          </Label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickPdf(f);
                e.target.value = "";
              }}
              className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:bg-[#15151b] file:text-white"
            />
            {uploadingPdf && (
              <Loader2 className="h-4 w-4 animate-spin text-[#9fa0b8]" />
            )}
          </div>
          {data.product_document && (
            <a
              href={data.product_document}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-brand hover:underline mt-1"
            >
              View uploaded PDF
            </a>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

/* ----------------- step 5: billing + coverage ----------------- */

function BillingStep({
  product,
  onBack,
  onFinish,
}: {
  product: Product;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [data, setData] = useState({
    billing_type: product.billing_type || ("" as BillingType | ""),
    payment_frequency: product.payment_frequency || ("" as PaymentFrequency | ""),
    waiver_type: product.waiver_type || ("" as WaiverType | ""),
    waiver_text: product.waiver_text || "",
    waiver_terms: product.waiver_terms || [],
    coverage_type: product.coverage_type || "",
    coverage: product.coverage || [],
  });
  const [termDraft, setTermDraft] = useState("");
  const [coverageDraft, setCoverageDraft] = useState("");
  const [saving, setSaving] = useState(false);

  function addTerm() {
    const v = termDraft.trim();
    if (!v) return;
    setData((d) => ({ ...d, waiver_terms: [...d.waiver_terms, v] }));
    setTermDraft("");
  }
  function removeTerm(i: number) {
    setData((d) => ({
      ...d,
      waiver_terms: d.waiver_terms.filter((_, idx) => idx !== i),
    }));
  }

  function addCoverage(v: string) {
    const t = v.trim();
    if (!t || data.coverage.includes(t)) return;
    setData((d) => ({ ...d, coverage: [...d.coverage, t] }));
    setCoverageDraft("");
  }
  function removeCoverage(i: number) {
    setData((d) => ({
      ...d,
      coverage: d.coverage.filter((_, idx) => idx !== i),
    }));
  }

  async function onSave() {
    if (!data.billing_type || !data.payment_frequency || !data.waiver_type) {
      toast.error("Billing type, payment frequency, and waiver type are required");
      return;
    }
    setSaving(true);
    try {
      await stepBilling(product._id, {
        billing_type: data.billing_type as BillingType,
        payment_frequency: data.payment_frequency as PaymentFrequency,
        waiver_type: data.waiver_type as WaiverType,
        waiver_text: data.waiver_text,
        waiver_terms: data.waiver_terms,
        coverage_type: data.coverage_type,
        coverage: data.coverage,
      });
      onFinish();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Billing &amp; coverage</h2>

      <div className="grid grid-cols-3 gap-3 max-w-3xl">
        <div className="space-y-1.5">
          <Label className="text-xs text-[#9fa0b8]">Billing type</Label>
          <Select
            value={data.billing_type}
            onValueChange={(v) =>
              setData({ ...data, billing_type: v as BillingType })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {BILLING_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[#9fa0b8]">Payment frequency</Label>
          <Select
            value={data.payment_frequency}
            onValueChange={(v) =>
              setData({ ...data, payment_frequency: v as PaymentFrequency })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_FREQUENCIES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[#9fa0b8]">Waiver type</Label>
          <Select
            value={data.waiver_type}
            onValueChange={(v) =>
              setData({ ...data, waiver_type: v as WaiverType })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {WAIVER_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5 max-w-3xl">
        <Label className="text-xs text-[#9fa0b8]">Waiver text</Label>
        <Textarea
          rows={3}
          value={data.waiver_text}
          onChange={(e) => setData({ ...data, waiver_text: e.target.value })}
        />
      </div>

      <div className="space-y-1.5 max-w-3xl">
        <Label className="text-xs text-[#9fa0b8]">Waiver terms</Label>
        <div className="flex gap-2">
          <Input
            value={termDraft}
            onChange={(e) => setTermDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTerm();
              }
            }}
            placeholder="Type a term and press Enter"
          />
          <Button variant="outline" onClick={addTerm}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ul className="space-y-1 mt-2">
          {data.waiver_terms.map((t, i) => (
            <li
              key={i}
              className="flex items-center justify-between bg-[#15151b] border border-[#2a2a3a] rounded-md px-3 py-1.5 text-sm"
            >
              <span>{t}</span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeTerm(i)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1.5 max-w-3xl">
        <Label className="text-xs text-[#9fa0b8]">Coverage type</Label>
        <Input
          value={data.coverage_type}
          onChange={(e) =>
            setData({ ...data, coverage_type: e.target.value })
          }
          placeholder="e.g. Sum Insured Slabs"
        />
      </div>

      <div className="space-y-1.5 max-w-3xl">
        <Label className="text-xs text-[#9fa0b8]">Coverage options</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {COMMON_COVERAGE.filter((c) => !data.coverage.includes(c)).map(
            (c) => (
              <Badge
                key={c}
                variant="outline"
                className="cursor-pointer hover:bg-[#15151b]"
                onClick={() => addCoverage(c)}
              >
                + {c}
              </Badge>
            ),
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={coverageDraft}
            onChange={(e) => setCoverageDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCoverage(coverageDraft);
              }
            }}
            placeholder="Custom coverage label, Enter to add"
          />
          <Button
            variant="outline"
            onClick={() => addCoverage(coverageDraft)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {data.coverage.map((c, i) => (
            <Badge key={i} className="gap-1">
              {c}
              <button
                type="button"
                onClick={() => removeCoverage(i)}
                className="ml-1"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-3">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save & finish"}
        </Button>
      </div>
    </div>
  );
}

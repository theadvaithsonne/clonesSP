"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Building2,
  X,
} from "lucide-react";
import { Country, State } from "country-state-city";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getCompany,
  updateCompany,
  enrollProduct,
  unenrollProduct,
  listCompanyEmployees,
  deleteCompanyEmployee,
} from "@/lib/coverfi/companies-api";
import { listProducts } from "@/lib/coverfi/products-api";
import { listInsuranceCompanies } from "@/lib/coverfi/insurance-api";
import type {
  Company,
  CompanyEmployee,
  InsuranceCompany,
  Product,
} from "@/lib/coverfi/types";
import ImageUpload from "@/components/coverfi/brokerage/ImageUpload";
import CompanyEmployeeFormDialog from "./CompanyEmployeeFormDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tab = "info" | "products" | "employees";

export default function CompanyDetail({ companyId }: { companyId: string }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [insurers, setInsurers] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("info");

  async function refresh() {
    setLoading(true);
    try {
      const [c, p, i] = await Promise.all([
        getCompany(companyId),
        listProducts().catch(() => []),
        listInsuranceCompanies().catch(() => []),
      ]);
      setCompany(c);
      setProducts(p);
      setInsurers(i);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load company");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [companyId]);

  if (loading) {
    return <div className="p-8 text-sm text-[#9fa0b8]">Loading…</div>;
  }
  if (!company) {
    return (
      <div className="p-8 text-sm text-[#9fa0b8]">
        Couldn&apos;t load this company. It may have been removed.
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <Link
        href="/coverfi/companies"
        className="inline-flex items-center text-sm text-[#9fa0b8] hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to companies
      </Link>

      <header className="flex items-start gap-4">
        {company.company_logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.company_logo}
            alt=""
            className="h-14 w-14 rounded-lg object-cover bg-[#15151b]"
          />
        ) : (
          <div className="h-14 w-14 rounded-lg bg-[#15151b] border border-[#2a2a3a] flex items-center justify-center">
            <Building2 className="h-6 w-6 text-[#9fa0b8]" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold">
            {company.display_name || company.legal_name}
          </h1>
          {company.industry && (
            <p className="text-sm text-[#9fa0b8]">{company.industry}</p>
          )}
          <div className="flex gap-2 mt-2 text-xs text-[#9fa0b8]">
            <span>
              {company.enrolled_products.length} product(s) enrolled
            </span>
            <span>·</span>
            <span>{company.employee_count ?? 0} employee(s)</span>
          </div>
        </div>
      </header>

      <div className="border-b border-[#222230]">
        <nav className="flex gap-1">
          {(["info", "products", "employees"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2 text-sm capitalize -mb-px border-b-2 transition-colors",
                tab === t
                  ? "text-white border-brand"
                  : "text-[#9fa0b8] hover:text-white border-transparent",
              )}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {tab === "info" && (
        <InfoTab company={company} onSaved={refresh} />
      )}
      {tab === "products" && (
        <ProductsTab
          company={company}
          products={products}
          insurers={insurers}
          onChanged={refresh}
        />
      )}
      {tab === "employees" && (
        <EmployeesTab companyId={company._id} />
      )}
    </div>
  );
}

/* ---------------- info tab ---------------- */

function InfoTab({
  company,
  onSaved,
}: {
  company: Company;
  onSaved: () => void;
}) {
  const [data, setData] = useState({
    legal_name: company.legal_name || "",
    display_name: company.display_name || "",
    industry: company.industry || "",
    poc_first_name: company.poc?.first_name || "",
    poc_last_name: company.poc?.last_name || "",
    poc_email: company.poc?.email || "",
    poc_phone: company.poc?.phone_number || "",
    company_logo: company.company_logo || "",
    street_number: company.street_number || "",
    street_name: company.street_name || "",
    city: company.city || "",
    state: company.state || "",
    country: company.country || "",
    pincode: company.pincode?.toString() || "",
  });
  const [saving, setSaving] = useState(false);

  const countries = useMemo(() => Country.getAllCountries(), []);
  const states = useMemo(
    () => (data.country ? State.getStatesOfCountry(data.country) : []),
    [data.country],
  );

  async function onSave() {
    setSaving(true);
    try {
      await updateCompany(company._id, {
        legal_name: data.legal_name,
        display_name: data.display_name,
        industry: data.industry,
        poc: {
          first_name: data.poc_first_name,
          last_name: data.poc_last_name,
          email: data.poc_email,
          phone_number: data.poc_phone,
        },
        company_logo: data.company_logo,
        street_number: data.street_number,
        street_name: data.street_name,
        city: data.city,
        state: data.state,
        country: data.country,
        pincode: data.pincode ? Number(data.pincode) : undefined,
      });
      toast.success("Saved");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <ImageUpload
        label="Company logo"
        value={data.company_logo}
        onChange={(url) => setData({ ...data, company_logo: url })}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Legal name">
          <Input
            value={data.legal_name}
            onChange={(e) =>
              setData({ ...data, legal_name: e.target.value })
            }
          />
        </Field>
        <Field label="Display name">
          <Input
            value={data.display_name}
            onChange={(e) =>
              setData({ ...data, display_name: e.target.value })
            }
          />
        </Field>
        <Field label="Industry">
          <Input
            value={data.industry}
            onChange={(e) => setData({ ...data, industry: e.target.value })}
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
              onChange={(e) =>
                setData({ ...data, poc_email: e.target.value })
              }
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

      <div className="border-t border-[#222230] pt-4">
        <div className="text-xs uppercase tracking-wider text-brand mb-3">
          Address
        </div>
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
      </div>

      <Button onClick={onSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

/* ---------------- products tab ---------------- */

function ProductsTab({
  company,
  products,
  insurers,
  onChanged,
}: {
  company: Company;
  products: Product[];
  insurers: InsuranceCompany[];
  onChanged: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<string>("");

  const enrolledIds = new Set(company.enrolled_products.map((p) => p.productId));
  const eligible = products.filter((p) => p.is_active && !enrolledIds.has(p._id));

  const productById = useMemo(() => {
    const m: Record<string, Product> = {};
    products.forEach((p) => (m[p._id] = p));
    return m;
  }, [products]);

  const insurerById = useMemo(() => {
    const m: Record<string, string> = {};
    insurers.forEach((i) => (m[i._id] = i.name));
    return m;
  }, [insurers]);

  async function onEnroll() {
    if (!selected) return;
    try {
      await enrollProduct(company._id, selected);
      toast.success("Enrolled");
      setSelected("");
      setPickerOpen(false);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Enroll failed");
    }
  }

  async function onUnenroll(productId: string) {
    if (!confirm("Unenroll this product?")) return;
    try {
      await unenrollProduct(company._id, productId);
      toast.success("Unenrolled");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Unenroll failed");
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Enrolled products</h2>
        {!pickerOpen && eligible.length > 0 && (
          <Button onClick={() => setPickerOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Enroll product
          </Button>
        )}
      </div>

      {pickerOpen && (
        <div className="rounded-lg border border-[#222230] bg-[#0c0c12] p-4 space-y-3">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder="Select a product" />
            </SelectTrigger>
            <SelectContent>
              {eligible.map((p) => (
                <SelectItem key={p._id} value={p._id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button onClick={onEnroll} disabled={!selected}>
              Enroll
            </Button>
            <Button variant="ghost" onClick={() => setPickerOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-[#222230] bg-[#0c0c12] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Insurer</TableHead>
              <TableHead>Enrolled</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {company.enrolled_products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-[#9fa0b8]">
                  No products enrolled.
                </TableCell>
              </TableRow>
            ) : (
              company.enrolled_products.map((ep) => {
                const p = productById[ep.productId];
                return (
                  <TableRow key={ep.productId}>
                    <TableCell className="font-medium">
                      {p?.name || (
                        <span className="text-[#9fa0b8] italic">
                          Unknown product
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-[#9fa0b8] text-sm">
                      {p?.insurance_provider
                        ? insurerById[p.insurance_provider] || "—"
                        : "—"}
                    </TableCell>
                    <TableCell className="text-[#9fa0b8] text-xs">
                      {new Date(ep.enrolled_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onUnenroll(ep.productId)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ---------------- employees tab ---------------- */

function EmployeesTab({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<CompanyEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyEmployee | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setRows(await listCompanyEmployees(companyId));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function onDelete(e: CompanyEmployee) {
    if (!confirm(`Delete ${e.first_name} ${e.last_name}?`)) return;
    try {
      await deleteCompanyEmployee(e._id);
      refresh();
    } catch (err: any) {
      toast.error(err?.message || "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Employees</h2>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Add employee
        </Button>
      </div>

      <div className="rounded-lg border border-[#222230] bg-[#0c0c12] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-[#9fa0b8]">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-[#9fa0b8]">
                  No employees yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r._id}>
                  <TableCell className="font-medium">
                    {r.first_name} {r.last_name}
                  </TableCell>
                  <TableCell className="text-sm text-[#9fa0b8]">
                    {r.email || "—"}
                  </TableCell>
                  <TableCell>{r.designation || "—"}</TableCell>
                  <TableCell>{r.department || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(r);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onDelete(r)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CompanyEmployeeFormDialog
        open={open}
        companyId={companyId}
        existing={editing}
        onClose={() => setOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-[#9fa0b8]">{label}</Label>
      {children}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Umbrella,
  ShieldCheck,
  Briefcase,
  Mail,
  ArrowRight,
} from "lucide-react";
import PageHeader from "@/components/coverfi/PageHeader";
import { coverfiApi } from "@/lib/coverfi/api";
import type {
  CoverfiHealth,
  Company,
  InsuranceCompany,
  Product,
} from "@/lib/coverfi/types";
import { listProducts } from "@/lib/coverfi/products-api";
import { listCompanies } from "@/lib/coverfi/companies-api";
import { listInsuranceCompanies } from "@/lib/coverfi/insurance-api";
import { listTemplates } from "@/lib/coverfi/communication-api";
import { cn } from "@/lib/utils";

type Counts = {
  products: number;
  companies: number;
  insurers: number;
  templates: number;
};

export default function CoverfiDashboardPage() {
  const [health, setHealth] = useState<CoverfiHealth | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    coverfiApi<CoverfiHealth>("/v1/coverfi/health")
      .then(setHealth)
      .catch(() => {});

    Promise.all([
      listProducts().catch(() => [] as Product[]),
      listCompanies().catch(() => [] as Company[]),
      listInsuranceCompanies().catch(() => [] as InsuranceCompany[]),
      listTemplates().catch(() => []),
    ]).then(([products, companies, insurers, templates]) =>
      setCounts({
        products: products.filter((p) => p.is_active).length,
        companies: companies.length,
        insurers: insurers.length,
        templates: templates.length,
      }),
    );
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Coverfi · Overview"
        title="Welcome to Coverfi"
        description="Your insurance brokerage backoffice — manage products, customers, and communication from one place."
        icon={<Umbrella className="h-4 w-4" />}
      />

      <div className="px-8 py-8 max-w-5xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard
          label="Active products"
          value={counts?.products}
          icon={<ShieldCheck className="h-4 w-4" />}
          href="/coverfi/products"
        />
        <StatCard
          label="Customer companies"
          value={counts?.companies}
          icon={<Briefcase className="h-4 w-4" />}
          href="/coverfi/companies"
        />
        <StatCard
          label="Insurance providers"
          value={counts?.insurers}
          icon={<Umbrella className="h-4 w-4" />}
          href="/coverfi/insurance-companies"
        />
        <StatCard
          label="Email templates"
          value={counts?.templates}
          icon={<Mail className="h-4 w-4" />}
          href="/coverfi/communication/templates"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <ActionCard
          href="/coverfi/brokerage"
          icon={<Building2 className="h-5 w-5" />}
          title="Set up your brokerage"
          description="Profile, branding, locations, landing page."
        />
        <ActionCard
          href="/coverfi/products/new"
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Create a product"
          description="Walk the 4-step wizard with categories and filters."
        />
        <ActionCard
          href="/coverfi/companies/new"
          icon={<Briefcase className="h-5 w-5" />}
          title="Add a customer company"
          description="Capture POC, address, and enrolled products."
        />
        <ActionCard
          href="/coverfi/communication/templates"
          icon={<Mail className="h-5 w-5" />}
          title="Craft email templates"
          description="Reusable rich-HTML messages with variables."
        />
      </div>

      {health && (
        <div className="mt-10 flex items-center gap-2 text-[11px] text-[#5b5b70]">
          <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
          <span>Brokerage ID</span>
          <code className="font-mono text-[#6b6b80]">{health.brokerageId}</code>
        </div>
      )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-xl border border-[#1c1c24] bg-[#0c0c10] p-4",
        "transition-all duration-200 ease-out",
        "hover:border-brand/40 hover:bg-[#101015] hover:-translate-y-0.5",
      )}
    >
      <div className="flex items-center gap-2 text-[#6b6b80] mb-2">
        <span className="text-brand/70 group-hover:text-brand transition-colors">
          {icon}
        </span>
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-semibold tabular-nums">
        {value ?? <span className="text-[#3b3b4a]">—</span>}
      </div>
    </Link>
  );
}

function ActionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-start gap-3 rounded-xl border border-[#1c1c24] bg-[#0c0c10] p-4",
        "transition-all duration-200 ease-out",
        "hover:border-brand/40 hover:bg-[#101015]",
      )}
    >
      <div className="h-10 w-10 rounded-lg bg-[#15151b] border border-[#222230] flex items-center justify-center text-brand shrink-0 group-hover:bg-brand/10 group-hover:border-brand/30 transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm">{title}</span>
          <ArrowRight className="h-3.5 w-3.5 text-[#6b6b80] -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-200" />
        </div>
        <p className="text-xs text-[#9fa0b8] mt-1">{description}</p>
      </div>
    </Link>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Landmark,
  Users,
  ShieldCheck,
  Info as InfoIcon,
  Copy,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Corporate } from "@/lib/coverfi/types";
import CorporateInfoTab from "./CorporateInfoTab";
import CorporateEmployeesTab from "./CorporateEmployeesTab";
import CorporateProductsTab from "./CorporateProductsTab";

type Tab = "info" | "employees" | "products";

type Props = {
  corporate: Corporate;
  onReload: () => Promise<void> | void;
};

export default function CorporateDetail({ corporate, onReload }: Props) {
  const [tab, setTab] = useState<Tab>("info");

  return (
    <div className="px-8 py-7 space-y-6">
      <Link
        href="/coverfi/corporate"
        className="inline-flex items-center text-sm text-[#9fa0b8] hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to corporates
      </Link>

      <header className="flex items-start gap-4">
        {corporate.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={corporate.logo}
            alt=""
            className="h-14 w-14 rounded-lg object-cover bg-[#15151b]"
          />
        ) : (
          <div className="h-14 w-14 rounded-lg bg-[#15151b] border border-[#2a2a3a] flex items-center justify-center">
            <Landmark className="h-6 w-6 text-[#9fa0b8]" />
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] font-semibold tracking-tight">
              {corporate.display_name || corporate.legal_name}
            </h1>
            {corporate.corporate_code && (
              <CorporateCodeBadge code={corporate.corporate_code} />
            )}
          </div>
          {corporate.industry && (
            <p className="text-sm text-[#9fa0b8]">{corporate.industry}</p>
          )}
          <div className="flex gap-2 mt-2 text-xs text-[#9fa0b8]">
            <Badge className="bg-brand/12 text-brand border-brand/25">
              Active
            </Badge>
            <span>
              {corporate.employee_count ?? 0} employee(s)
            </span>
            <span>·</span>
            <span>
              {corporate.dependent_count ?? 0} dependent(s)
            </span>
            <span>·</span>
            <span>
              {corporate.active_policy_count ?? 0} active polic
              {corporate.active_policy_count === 1 ? "y" : "ies"}
            </span>
          </div>
        </div>
      </header>

      <div className="border-b border-white/5">
        <nav className="flex gap-1">
          {(
            [
              { id: "info", label: "Info", icon: InfoIcon },
              { id: "employees", label: "Employees", icon: Users },
              { id: "products", label: "Products", icon: ShieldCheck },
            ] as Array<{ id: Tab; label: string; icon: any }>
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm capitalize -mb-px border-b-2 transition-colors",
                  tab === t.id
                    ? "text-white border-brand"
                    : "text-[#9fa0b8] hover:text-white border-transparent",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {tab === "info" && (
        <CorporateInfoTab corporate={corporate} onSaved={onReload} />
      )}
      {tab === "employees" && (
        <CorporateEmployeesTab corporateId={corporate._id} onChanged={onReload} />
      )}
      {tab === "products" && (
        <CorporateProductsTab corporateId={corporate._id} onChanged={onReload} />
      )}
    </div>
  );
}

function CorporateCodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`${code} copied`);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Couldn't copy");
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="group inline-flex items-center gap-1.5 rounded-md border border-brand/25 bg-brand/8 px-2 py-1 text-[12px] font-mono tracking-wide hover:bg-brand/14 hover:border-brand/40 transition-colors"
      title={`Copy ${code}`}
    >
      <span className="text-brand">{code}</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 text-brand/60 group-hover:text-brand" />
      )}
    </button>
  );
}

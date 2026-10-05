"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCorporateStep1 } from "@/lib/coverfi/corporate-api";
import type { CorporatePoc } from "@/lib/coverfi/types";
import { toast } from "sonner";
import { Stepper, STEP_LABELS } from "./Stepper";

const empty = {
  legal_name: "",
  display_name: "",
  industry: "",
  admin_first_name: "",
  admin_last_name: "",
  admin_email: "",
  admin_phone_code: "+91",
  admin_phone: "",
};

const emptyPoc: CorporatePoc = {
  first_name: "",
  last_name: "",
  email: "",
  phone_number: "",
  phoneCode: "+91",
  designation: "",
};

export default function CorporateStep1Form() {
  const router = useRouter();
  const [data, setData] = useState({ ...empty });
  const [pocs, setPocs] = useState<CorporatePoc[]>([]);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof empty>(k: K, v: string) {
    setData((d) => ({ ...d, [k]: v }));
  }

  function addPoc() {
    setPocs((p) => [...p, { ...emptyPoc }]);
  }
  function updatePoc(i: number, k: keyof CorporatePoc, v: string) {
    setPocs((p) => p.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  }
  function removePoc(i: number) {
    setPocs((p) => p.filter((_, idx) => idx !== i));
  }

  async function onSubmit() {
    if (!data.legal_name || !data.admin_email) {
      toast.error("Legal name and admin email are required");
      return;
    }
    setSaving(true);
    try {
      const created = await createCorporateStep1({
        legal_name: data.legal_name,
        display_name: data.display_name || undefined,
        industry: data.industry || undefined,
        admin_email: data.admin_email,
        admin_first_name: data.admin_first_name || undefined,
        admin_last_name: data.admin_last_name || undefined,
        admin_phone: data.admin_phone || undefined,
        admin_phone_code: data.admin_phone_code || undefined,
        poc: pocs.length > 0 ? pocs : undefined,
      });
      if (created.corporate_code) {
        toast.success(`Corporate created · ID ${created.corporate_code}`, {
          description: "Share this ID with the admin to sign into the portal.",
          duration: 7000,
          action: {
            label: "Copy",
            onClick: () =>
              navigator.clipboard
                .writeText(created.corporate_code!)
                .then(() => toast.success(`${created.corporate_code} copied`))
                .catch(() => toast.error("Couldn't copy")),
          },
        });
      } else {
        toast.success("Corporate created — admin account provisioned");
      }
      router.push(`/coverfi/corporate/${created._id}`);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
      setSaving(false);
    }
  }

  return (
    <div className="px-8 py-7 max-w-3xl">
      <Link
        href="/coverfi/corporate"
        className="inline-flex items-center text-sm text-[#9fa0b8] hover:text-white mb-5"
      >
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to corporates
      </Link>

      <h1 className="text-[22px] font-semibold tracking-tight mb-1">
        New corporate
      </h1>
      <p className="text-[13px] text-white/45 mb-6">
        Step 1 of {STEP_LABELS.length}: basic info + corporate admin. The
        admin&apos;s Garage account is created automatically and they can log
        in via OTP to the external portal once you publish.
      </p>

      <Stepper current={1} done={0} />

      <div className="mt-6 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Legal name" required>
            <Input
              value={data.legal_name}
              onChange={(e) => set("legal_name", e.target.value)}
              placeholder="Acme Pvt Ltd"
            />
          </Field>
          <Field label="Display name">
            <Input
              value={data.display_name}
              onChange={(e) => set("display_name", e.target.value)}
              placeholder="Acme"
            />
          </Field>
          <Field label="Industry">
            <Input
              value={data.industry}
              onChange={(e) => set("industry", e.target.value)}
              placeholder="Technology"
            />
          </Field>
        </div>

        <div className="border-t border-white/5 pt-5">
          <div className="text-xs uppercase tracking-[0.14em] text-brand/80 mb-3">
            Corporate admin
          </div>
          <p className="text-[12.5px] text-white/45 mb-4">
            This person will manage their corporate&apos;s employees and
            policies via the external portal. They&apos;ll be auto-provisioned
            as a Garage guest user with an affiliate-chain link to you.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" required>
              <Input
                type="email"
                value={data.admin_email}
                onChange={(e) => set("admin_email", e.target.value)}
                placeholder="admin@acme.com"
              />
            </Field>
            <div />
            <Field label="First name">
              <Input
                value={data.admin_first_name}
                onChange={(e) => set("admin_first_name", e.target.value)}
              />
            </Field>
            <Field label="Last name">
              <Input
                value={data.admin_last_name}
                onChange={(e) => set("admin_last_name", e.target.value)}
              />
            </Field>
            <Field label="Phone code">
              <Input
                value={data.admin_phone_code}
                onChange={(e) => set("admin_phone_code", e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={data.admin_phone}
                onChange={(e) =>
                  set("admin_phone", e.target.value.replace(/\D/g, ""))
                }
              />
            </Field>
          </div>
        </div>

        <div className="border-t border-white/5 pt-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs uppercase tracking-[0.14em] text-brand/80">
                Additional points of contact
              </div>
              <p className="text-[12.5px] text-white/45 mt-1">
                Optional. These aren&apos;t Garage users — just contact
                references on the corporate record.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addPoc}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add POC
            </Button>
          </div>

          {pocs.length > 0 && (
            <div className="space-y-3">
              {pocs.map((poc, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-white/5 bg-[#0e0e12] p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-white/45">
                      POC #{i + 1}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removePoc(i)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="First name"
                      value={poc.first_name || ""}
                      onChange={(e) =>
                        updatePoc(i, "first_name", e.target.value)
                      }
                    />
                    <Input
                      placeholder="Last name"
                      value={poc.last_name || ""}
                      onChange={(e) =>
                        updatePoc(i, "last_name", e.target.value)
                      }
                    />
                    <Input
                      placeholder="Email"
                      type="email"
                      value={poc.email || ""}
                      onChange={(e) => updatePoc(i, "email", e.target.value)}
                    />
                    <Input
                      placeholder="Designation"
                      value={poc.designation || ""}
                      onChange={(e) =>
                        updatePoc(i, "designation", e.target.value)
                      }
                    />
                    <Input
                      placeholder="Phone code"
                      value={poc.phoneCode || "+91"}
                      onChange={(e) =>
                        updatePoc(i, "phoneCode", e.target.value)
                      }
                    />
                    <Input
                      placeholder="Phone"
                      value={poc.phone_number || ""}
                      onChange={(e) =>
                        updatePoc(
                          i,
                          "phone_number",
                          e.target.value.replace(/\D/g, ""),
                        )
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-3 border-t border-white/5">
          <Button variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? "Creating…" : "Continue"}
          </Button>
        </div>
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

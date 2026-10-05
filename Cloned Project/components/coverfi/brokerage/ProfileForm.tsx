"use client";

import { useEffect, useMemo, useState } from "react";
import { Country, State } from "country-state-city";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getBrokerage,
  patchBrokerageProfile,
} from "@/lib/coverfi/brokerage-api";
import type { Brokerage } from "@/lib/coverfi/types";

const fields = [
  "legal_name",
  "business_email",
  "business_phone",
  "phoneCode",
  "business_website",
  "business_description",
  "address",
  "country",
  "state",
  "pincode",
] as const;

type PickedFields = (typeof fields)[number];
type ProfileState = Partial<Omit<Pick<Brokerage, PickedFields>, "pincode">> & {
  pincode?: number | string;
};

export default function ProfileForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<ProfileState>({});

  useEffect(() => {
    getBrokerage()
      .then((b) => {
        if (b) {
          const pick: ProfileState = {};
          for (const f of fields) (pick as any)[f] = (b as any)[f];
          setData(pick);
        }
      })
      .catch((e) => toast.error(e?.message || "Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  const countries = useMemo(() => Country.getAllCountries(), []);
  const states = useMemo(
    () => (data.country ? State.getStatesOfCountry(data.country) : []),
    [data.country],
  );

  function set<K extends keyof ProfileState>(key: K, value: ProfileState[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function onSave() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...data };
      if (payload.pincode != null && payload.pincode !== "") {
        payload.pincode = Number(payload.pincode);
      } else {
        delete payload.pincode;
      }
      await patchBrokerageProfile(payload);
      toast.success("Profile saved");
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-[#9fa0b8]">Loading profile…</div>;
  }

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Legal name" required>
          <Input
            value={data.legal_name || ""}
            onChange={(e) => set("legal_name", e.target.value)}
            placeholder="Acme Insurance Brokerage"
          />
        </Field>
        <Field label="Business email" required>
          <Input
            type="email"
            value={data.business_email || ""}
            onChange={(e) => set("business_email", e.target.value)}
            placeholder="hello@example.com"
          />
        </Field>
        <Field label="Phone code">
          <Input
            value={data.phoneCode || ""}
            onChange={(e) => set("phoneCode", e.target.value)}
            placeholder="+91"
          />
        </Field>
        <Field label="Business phone">
          <Input
            value={data.business_phone || ""}
            onChange={(e) => set("business_phone", e.target.value)}
            placeholder="9999999999"
          />
        </Field>
        <Field label="Website">
          <Input
            value={data.business_website || ""}
            onChange={(e) => set("business_website", e.target.value)}
            placeholder="example.com"
          />
        </Field>
        <Field label="Country">
          <Select
            value={data.country || ""}
            onValueChange={(v) => {
              set("country", v);
              set("state", "");
            }}
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
            value={data.state || ""}
            onValueChange={(v) => set("state", v)}
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
            value={data.pincode?.toString() || ""}
            onChange={(e) =>
              set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="400001"
          />
        </Field>
        <div className="col-span-2">
          <Field label="Address">
            <Input
              value={data.address || ""}
              onChange={(e) => set("address", e.target.value)}
              placeholder="1 Marine Drive"
            />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Description">
            <Textarea
              rows={4}
              value={data.business_description || ""}
              onChange={(e) =>
                set("business_description", e.target.value)
              }
              placeholder="What does your brokerage do?"
            />
          </Field>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
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

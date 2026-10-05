"use client";

import { useMemo, useState } from "react";
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
import ImageUpload from "@/components/coverfi/brokerage/ImageUpload";
import { createCorporateStep2 } from "@/lib/coverfi/corporate-api";
import type { Corporate } from "@/lib/coverfi/types";
import { toast } from "sonner";

type Props = {
  corporate: Corporate;
  onSaved: (c: Corporate) => void;
  onBack: () => void;
};

export default function CorporateStep2Address({
  corporate,
  onSaved,
  onBack,
}: Props) {
  const [data, setData] = useState({
    logo: corporate.logo || "",
    street_number: corporate.street_number || "",
    street_name: corporate.street_name || "",
    city: corporate.city || "",
    state: corporate.state || "",
    country: corporate.country || "",
    pincode: corporate.pincode?.toString() || "",
  });
  const [saving, setSaving] = useState(false);

  const countries = useMemo(() => Country.getAllCountries(), []);
  const states = useMemo(
    () => (data.country ? State.getStatesOfCountry(data.country) : []),
    [data.country],
  );

  async function onContinue() {
    setSaving(true);
    try {
      const updated = await createCorporateStep2(corporate._id, {
        logo: data.logo || undefined,
        street_number: data.street_number || undefined,
        street_name: data.street_name || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        country: data.country || undefined,
        pincode: data.pincode ? Number(data.pincode) : undefined,
      });
      onSaved(updated);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold mb-1">Address &amp; logo</h2>
        <p className="text-[13px] text-white/45">
          Where is the corporate based? Used on policy documents and the
          portal landing page.
        </p>
      </div>

      <ImageUpload
        label="Corporate logo"
        value={data.logo}
        onChange={(url) => setData({ ...data, logo: url })}
      />

      <div className="grid grid-cols-2 gap-3 max-w-2xl">
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
            onValueChange={(v) => setData({ ...data, country: v, state: "" })}
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

      <div className="flex gap-2 pt-3 border-t border-white/5">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue} disabled={saving}>
          {saving ? "Saving…" : "Continue"}
        </Button>
      </div>
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

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
import { updateCorporate } from "@/lib/coverfi/corporate-api";
import type { Corporate } from "@/lib/coverfi/types";
import { toast } from "sonner";

type Props = {
  corporate: Corporate;
  onSaved: () => Promise<void> | void;
};

export default function CorporateInfoTab({ corporate, onSaved }: Props) {
  const [data, setData] = useState({
    legal_name: corporate.legal_name,
    display_name: corporate.display_name || "",
    industry: corporate.industry || "",
    logo: corporate.logo || "",
    admin_email: corporate.admin_email,
    admin_first_name: corporate.admin_first_name || "",
    admin_last_name: corporate.admin_last_name || "",
    admin_phone_code: corporate.admin_phone_code || "+91",
    admin_phone: corporate.admin_phone || "",
    street_number: corporate.street_number || "",
    street_name: corporate.street_name || "",
    city: corporate.city || "",
    state: corporate.state || "",
    country: corporate.country || "",
    pincode: corporate.pincode?.toString() || "",
    status: corporate.status,
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
      await updateCorporate(corporate._id, {
        ...data,
        pincode: data.pincode ? Number(data.pincode) : undefined,
      } as any);
      toast.success("Saved");
      await onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <ImageUpload
        label="Corporate logo"
        value={data.logo}
        onChange={(url) => setData({ ...data, logo: url })}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Legal name" required>
          <Input
            value={data.legal_name}
            onChange={(e) => setData({ ...data, legal_name: e.target.value })}
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

      <div className="border-t border-white/5 pt-4">
        <div className="text-xs uppercase tracking-[0.14em] text-brand/80 mb-3">
          Admin contact
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Admin email">
            <Input
              type="email"
              value={data.admin_email}
              onChange={(e) =>
                setData({ ...data, admin_email: e.target.value })
              }
            />
          </Field>
          <div />
          <Field label="First name">
            <Input
              value={data.admin_first_name}
              onChange={(e) =>
                setData({ ...data, admin_first_name: e.target.value })
              }
            />
          </Field>
          <Field label="Last name">
            <Input
              value={data.admin_last_name}
              onChange={(e) =>
                setData({ ...data, admin_last_name: e.target.value })
              }
            />
          </Field>
          <Field label="Phone code">
            <Input
              value={data.admin_phone_code}
              onChange={(e) =>
                setData({ ...data, admin_phone_code: e.target.value })
              }
            />
          </Field>
          <Field label="Phone">
            <Input
              value={data.admin_phone}
              onChange={(e) =>
                setData({
                  ...data,
                  admin_phone: e.target.value.replace(/\D/g, ""),
                })
              }
            />
          </Field>
        </div>
      </div>

      <div className="border-t border-white/5 pt-4">
        <div className="text-xs uppercase tracking-[0.14em] text-brand/80 mb-3">
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

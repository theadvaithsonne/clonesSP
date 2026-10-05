"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getBrokerage,
  patchBrokerageBranding,
} from "@/lib/coverfi/brokerage-api";
import ImageUpload from "./ImageUpload";

type BrandingState = {
  tag_line?: string;
  business_logo?: string;
  business_icon?: string;
  primary_color?: string;
  secondary_color?: string;
};

export default function BrandingForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<BrandingState>({});

  useEffect(() => {
    getBrokerage()
      .then((b) => {
        if (b) {
          setData({
            tag_line: b.tag_line,
            business_logo: b.business_logo,
            business_icon: b.business_icon,
            primary_color: b.primary_color || "#025F4C",
            secondary_color: b.secondary_color || "#025F4C",
          });
        }
      })
      .catch((e) => toast.error(e?.message || "Failed to load branding"))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof BrandingState>(key: K, value: BrandingState[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function onSave() {
    setSaving(true);
    try {
      await patchBrokerageBranding(data);
      toast.success("Branding saved");
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-[#9fa0b8]">Loading branding…</div>;
  }

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div className="space-y-1.5">
        <Label className="text-xs text-[#9fa0b8]">Tag line</Label>
        <Input
          value={data.tag_line || ""}
          onChange={(e) => set("tag_line", e.target.value)}
          placeholder="Smart insurance for modern teams"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <ImageUpload
          label="Business logo"
          value={data.business_logo}
          onChange={(url) => set("business_logo", url)}
        />
        <ImageUpload
          label="Business icon"
          value={data.business_icon}
          onChange={(url) => set("business_icon", url)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <ColorField
          label="Primary color"
          value={data.primary_color || "#025F4C"}
          onChange={(v) => set("primary_color", v)}
        />
        <ColorField
          label="Secondary color"
          value={data.secondary_color || "#025F4C"}
          onChange={(v) => set("secondary_color", v)}
        />
      </div>

      <div className="pt-2">
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save branding"}
        </Button>
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-[#9fa0b8]">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded-md border border-[#2a2a3a] bg-transparent cursor-pointer"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono"
          placeholder="#RRGGBB"
        />
      </div>
    </div>
  );
}

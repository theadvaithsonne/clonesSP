"use client";

import { useEffect, useState } from "react";
import { Plus, X, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getBrokerage,
  saveLandingPage,
  publishLandingPage,
} from "@/lib/coverfi/brokerage-api";
import ImageUpload from "./ImageUpload";

type LandingState = {
  heading?: string;
  bullet_points?: string[];
  cover_pic?: string;
  primary_color?: string;
  landing_published?: boolean;
  landing_published_at?: string;
};

export default function LandingPageBuilder() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [data, setData] = useState<LandingState>({ bullet_points: [] });
  const [bulletDraft, setBulletDraft] = useState("");

  useEffect(() => {
    getBrokerage()
      .then((b) => {
        if (b) {
          setData({
            heading: b.heading,
            bullet_points: b.bullet_points || [],
            cover_pic: b.cover_pic,
            primary_color: b.primary_color || "#025F4C",
            landing_published: b.landing_published,
            landing_published_at: b.landing_published_at,
          });
        }
      })
      .catch((e) => toast.error(e?.message || "Failed to load landing page"))
      .finally(() => setLoading(false));
  }, []);

  function addBullet() {
    const t = bulletDraft.trim();
    if (!t) return;
    setData((d) => ({
      ...d,
      bullet_points: [...(d.bullet_points || []), t],
    }));
    setBulletDraft("");
  }

  function removeBullet(idx: number) {
    setData((d) => ({
      ...d,
      bullet_points: (d.bullet_points || []).filter((_, i) => i !== idx),
    }));
  }

  async function onSave() {
    setSaving(true);
    try {
      await saveLandingPage({
        heading: data.heading,
        bullet_points: data.bullet_points,
        cover_pic: data.cover_pic,
        primary_color: data.primary_color,
      });
      toast.success("Landing page saved");
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onPublish() {
    await onSave();
    setPublishing(true);
    try {
      const updated = await publishLandingPage();
      setData((d) => ({
        ...d,
        landing_published: updated.landing_published,
        landing_published_at: updated.landing_published_at,
      }));
      toast.success("Landing page published");
    } catch (e: any) {
      toast.error(e?.message || "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-[#9fa0b8]">Loading…</div>;
  }

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        {data.landing_published ? (
          <Badge className="bg-brand/12 text-brand border-brand/25">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Published
          </Badge>
        ) : (
          <Badge variant="secondary">Draft</Badge>
        )}
        {data.landing_published_at && (
          <span className="text-xs text-[#9fa0b8]">
            Last published:{" "}
            {new Date(data.landing_published_at).toLocaleString()}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-[#9fa0b8]">Heading</Label>
        <Input
          value={data.heading || ""}
          onChange={(e) => setData({ ...data, heading: e.target.value })}
          placeholder="Insurance, simplified."
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-[#9fa0b8]">Bullet points</Label>
        <div className="flex gap-2">
          <Input
            value={bulletDraft}
            onChange={(e) => setBulletDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addBullet();
              }
            }}
            placeholder="Type a bullet and press Enter"
          />
          <Button type="button" variant="outline" onClick={addBullet}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ul className="space-y-1 mt-2">
          {(data.bullet_points || []).map((b, i) => (
            <li
              key={i}
              className="flex items-center justify-between bg-[#15151b] border border-[#2a2a3a] rounded-md px-3 py-1.5 text-sm"
            >
              <span>{b}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => removeBullet(i)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
          {(data.bullet_points || []).length === 0 && (
            <li className="text-xs text-[#9fa0b8] italic">No bullets yet.</li>
          )}
        </ul>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-[#9fa0b8]">Cover image</Label>
        <ImageUpload
          value={data.cover_pic}
          onChange={(url) => setData({ ...data, cover_pic: url })}
          thumbClass="h-32 w-48"
        />
      </div>

      <div className="space-y-1.5 max-w-xs">
        <Label className="text-xs text-[#9fa0b8]">Primary color</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={data.primary_color || "#025F4C"}
            onChange={(e) =>
              setData({ ...data, primary_color: e.target.value })
            }
            className="h-9 w-12 rounded-md border border-[#2a2a3a] bg-transparent cursor-pointer"
          />
          <Input
            value={data.primary_color || ""}
            onChange={(e) =>
              setData({ ...data, primary_color: e.target.value })
            }
            className="font-mono"
            placeholder="#RRGGBB"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save draft"}
        </Button>
        <Button onClick={onPublish} disabled={publishing}>
          {publishing ? "Publishing…" : "Publish"}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Plus, Save, X, Info, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/coverfi/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getPolicySettings,
  patchPolicySettings,
  unsetPolicySetting,
} from "@/lib/coverfi/policy-settings-api";
import { toast } from "sonner";

export default function PolicySettingsForm() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const doc = await getPolicySettings();
      // Coerce all values to strings for the v1 editor.
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(doc.settings || {})) {
        flat[k] =
          typeof v === "string" ? v : v == null ? "" : JSON.stringify(v);
      }
      setSettings(flat);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function updateLocal(key: string, value: string) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function onAdd() {
    const k = newKey.trim();
    if (!k) {
      toast.error("Key is required");
      return;
    }
    if (k in settings) {
      toast.error("That key already exists");
      return;
    }
    setSettings((s) => ({ ...s, [k]: newValue }));
    setNewKey("");
    setNewValue("");
  }

  async function onRemove(key: string) {
    if (!confirm(`Delete setting "${key}"?`)) return;
    try {
      await unsetPolicySetting(key);
      setSettings((s) => {
        const next = { ...s };
        delete next[key];
        return next;
      });
      toast.success("Removed");
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  async function onSaveAll() {
    setSaving(true);
    try {
      await patchPolicySettings(settings);
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Coverfi · Settings"
        title="Policy Settings"
        description="Per-brokerage configuration as flat key/value pairs."
        icon={<Settings className="h-4 w-4" />}
        action={
          <Button onClick={onSaveAll} disabled={saving || loading}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving…" : "Save all"}
          </Button>
        }
      />

      <div className="px-8 pt-6 pb-8 max-w-3xl">
      <div className="rounded-md bg-[#15151b] border border-[#2a2a3a] px-3 py-2 mb-4 text-xs text-[#9fa0b8] flex items-start gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Schema is intentionally open in v1 — values are stored as strings.
          When concrete settings are defined, this page will gain typed inputs
          and validation.
        </span>
      </div>

      <div className="rounded-lg border border-[#222230] bg-[#0c0c12] overflow-hidden mb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/3">Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-[#9fa0b8]">
                  Loading…
                </TableCell>
              </TableRow>
            ) : Object.keys(settings).length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-[#9fa0b8]">
                  No settings yet. Add one below.
                </TableCell>
              </TableRow>
            ) : (
              Object.entries(settings).map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell className="font-mono text-sm">{k}</TableCell>
                  <TableCell>
                    <Input
                      value={v}
                      onChange={(e) => updateLocal(k, e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onRemove(k)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg border border-[#222230] bg-[#0c0c12] p-4">
        <Label className="text-xs text-[#9fa0b8] mb-2 block">
          Add setting
        </Label>
        <div className="flex gap-2">
          <Input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="key"
            className="font-mono w-48"
          />
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="value"
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
          />
          <Button variant="outline" onClick={onAdd}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[11px] text-[#9fa0b8] mt-2">
          Newly added rows aren&apos;t persisted until you click{" "}
          <strong>Save all</strong>.
        </p>
      </div>
      </div>
    </div>
  );
}

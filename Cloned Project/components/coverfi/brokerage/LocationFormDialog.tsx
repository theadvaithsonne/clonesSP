"use client";

import { useEffect, useMemo, useState } from "react";
import { Country, State } from "country-state-city";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createLocation,
  updateLocation,
} from "@/lib/coverfi/brokerage-api";
import type { BrokerageLocation } from "@/lib/coverfi/types";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: BrokerageLocation | null;
};

const empty = {
  location_name: "",
  address: "",
  country: "",
  state: "",
  pincode: "",
};

export default function LocationFormDialog({
  open,
  onClose,
  onSaved,
  existing,
}: Props) {
  const [data, setData] = useState({ ...empty });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setData({
        location_name: existing.location_name,
        address: existing.address,
        country: existing.country,
        state: existing.state,
        pincode: String(existing.pincode || ""),
      });
    } else {
      setData({ ...empty });
    }
  }, [existing, open]);

  const countries = useMemo(() => Country.getAllCountries(), []);
  const states = useMemo(
    () => (data.country ? State.getStatesOfCountry(data.country) : []),
    [data.country],
  );

  async function onSave() {
    if (
      !data.location_name ||
      !data.address ||
      !data.country ||
      !data.state ||
      !data.pincode
    ) {
      toast.error("All fields are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        location_name: data.location_name,
        address: data.address,
        country: data.country,
        state: data.state,
        pincode: Number(data.pincode),
      };
      if (existing) {
        await updateLocation(existing._id, payload);
        toast.success("Location updated");
      } else {
        await createLocation(payload);
        toast.success("Location added");
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit location" : "Add location"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-[#9fa0b8]">Location name</Label>
            <Input
              value={data.location_name}
              onChange={(e) =>
                setData({ ...data, location_name: e.target.value })
              }
              placeholder="Mumbai HQ"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[#9fa0b8]">Address</Label>
            <Input
              value={data.address}
              onChange={(e) => setData({ ...data, address: e.target.value })}
              placeholder="1 Marine Drive"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#9fa0b8]">Country</Label>
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
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#9fa0b8]">State</Label>
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
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[#9fa0b8]">Pincode</Label>
            <Input
              value={data.pincode}
              onChange={(e) =>
                setData({
                  ...data,
                  pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                })
              }
              placeholder="400001"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : existing ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

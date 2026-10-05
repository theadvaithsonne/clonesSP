"use client";

import { useEffect, useState } from "react";
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
import { createSender, updateSender } from "@/lib/coverfi/communication-api";
import type { EmailSender } from "@/lib/coverfi/types";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: EmailSender | null;
};

const empty = {
  nickname: "",
  from_name: "",
  from_email: "",
  reply_to: "",
  street: "",
  city: "",
  state: "",
  country: "",
  zip: "",
};

export default function SenderFormDialog({
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
        nickname: existing.nickname,
        from_name: existing.from_name,
        from_email: existing.from_email,
        reply_to: existing.reply_to || "",
        street: existing.address?.street || "",
        city: existing.address?.city || "",
        state: existing.address?.state || "",
        country: existing.address?.country || "",
        zip: existing.address?.zip || "",
      });
    } else {
      setData({ ...empty });
    }
  }, [existing, open]);

  async function onSave() {
    if (!data.nickname || !data.from_name || !data.from_email) {
      toast.error("Nickname, from name, and from email are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nickname: data.nickname,
        from_name: data.from_name,
        from_email: data.from_email,
        reply_to: data.reply_to || undefined,
        address: {
          street: data.street || undefined,
          city: data.city || undefined,
          state: data.state || undefined,
          country: data.country || undefined,
          zip: data.zip || undefined,
        },
      };
      if (existing) {
        await updateSender(existing._id, payload as Partial<EmailSender>);
        toast.success("Updated");
      } else {
        await createSender(payload);
        toast.success("Added");
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit sender" : "Add sender"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nickname" required>
            <Input
              value={data.nickname}
              onChange={(e) =>
                setData({ ...data, nickname: e.target.value })
              }
              placeholder="Support"
            />
          </Field>
          <Field label="From name" required>
            <Input
              value={data.from_name}
              onChange={(e) =>
                setData({ ...data, from_name: e.target.value })
              }
              placeholder="Acme Support"
            />
          </Field>
          <Field label="From email" required>
            <Input
              type="email"
              value={data.from_email}
              onChange={(e) =>
                setData({ ...data, from_email: e.target.value })
              }
              disabled={!!existing}
              placeholder="support@example.com"
            />
          </Field>
          <Field label="Reply-to">
            <Input
              type="email"
              value={data.reply_to}
              onChange={(e) =>
                setData({ ...data, reply_to: e.target.value })
              }
            />
          </Field>
        </div>

        <div className="border-t border-[#222230] pt-3 mt-2">
          <div className="text-xs uppercase tracking-wider text-brand mb-3">
            Postal address (CAN-SPAM / compliance)
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Street">
              <Input
                value={data.street}
                onChange={(e) =>
                  setData({ ...data, street: e.target.value })
                }
              />
            </Field>
            <Field label="City">
              <Input
                value={data.city}
                onChange={(e) => setData({ ...data, city: e.target.value })}
              />
            </Field>
            <Field label="State">
              <Input
                value={data.state}
                onChange={(e) => setData({ ...data, state: e.target.value })}
              />
            </Field>
            <Field label="Country">
              <Input
                value={data.country}
                onChange={(e) =>
                  setData({ ...data, country: e.target.value })
                }
              />
            </Field>
            <Field label="Zip / Pincode">
              <Input
                value={data.zip}
                onChange={(e) => setData({ ...data, zip: e.target.value })}
              />
            </Field>
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

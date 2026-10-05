"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import SenderFormDialog from "./SenderFormDialog";
import {
  listSenders,
  deleteSender,
  verifySender,
} from "@/lib/coverfi/communication-api";
import type {
  EmailSender,
  SenderVerificationStatus,
} from "@/lib/coverfi/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<SenderVerificationStatus, string> = {
  unverified: "bg-[#15151b] text-[#9fa0b8] border-[#2a2a3a]",
  pending: "bg-brand-2/12 text-brand-2 border-brand-2/25",
  verified: "bg-brand/12 text-brand border-brand/25",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function SendersTable() {
  const [rows, setRows] = useState<EmailSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmailSender | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setRows(await listSenders());
    } catch (e: any) {
      toast.error(e?.message || "Failed to load senders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onDelete(s: EmailSender) {
    if (!confirm(`Delete sender "${s.nickname}"?`)) return;
    try {
      await deleteSender(s._id);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  async function onVerify(s: EmailSender) {
    try {
      await verifySender(s._id);
      toast.success("Verification requested");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Email senders</h2>
          <p className="text-sm text-[#9fa0b8]">
            Outbound identities used by Coverfi templates. Verification is a
            stub for now — wires to SES / SendGrid later.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Add sender
        </Button>
      </div>

      <div className="rounded-lg border border-[#222230] bg-[#0c0c12] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nickname</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Reply-to</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-[#9fa0b8]">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-[#9fa0b8]">
                  No senders yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s) => (
                <TableRow key={s._id}>
                  <TableCell className="font-medium">{s.nickname}</TableCell>
                  <TableCell className="text-sm">
                    {s.from_name}
                    <span className="block text-xs text-[#9fa0b8]">
                      {s.from_email}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-[#9fa0b8]">
                    {s.reply_to || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(STATUS_STYLES[s.verification_status])}
                    >
                      {s.verification_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {s.verification_status !== "verified" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Start verification"
                          onClick={() => onVerify(s)}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(s);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onDelete(s)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <SenderFormDialog
        open={open}
        existing={editing}
        onClose={() => setOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
}

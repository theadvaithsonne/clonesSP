"use client";
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Minus, Eraser, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { creditOrgWallet, debitOrgWallet, clearOrgDebt } from "@/lib/admin-api/wallets";

type Mode = "credit" | "debit" | "clear-debt";

interface Props {
  mode: Mode | null;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
  orgName: string;
  currentBalance: number;
  currentDebt: number;
}

function fmtCents(c: number): string {
  return `$${(c / 100).toFixed(2)}`;
}

function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const MODE_META: Record<Mode, { title: string; icon: any; iconBg: string; iconText: string; iconBorder: string }> = {
  credit:        { title: "Add credits",     icon: Plus,   iconBg: "bg-[#FBD10D]/10", iconText: "text-[#FBD10D]", iconBorder: "border-[#FBD10D]/25" },
  debit:         { title: "Deduct credits",  icon: Minus,  iconBg: "bg-red-500/10",   iconText: "text-red-400",   iconBorder: "border-red-500/25" },
  "clear-debt":  { title: "Clear debt",      icon: Eraser, iconBg: "bg-orange-500/10",iconText: "text-orange-400",iconBorder: "border-orange-500/25" },
};

export function WalletActionDialog(props: Props) {
  const { mode, onClose, onSuccess, orgId, orgName, currentBalance, currentDebt } = props;
  const [amountStr, setAmountStr] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [idemKey, setIdemKey] = useState("");

  useEffect(() => {
    if (mode) {
      setAmountStr("");
      setNote("");
      setIdemKey(newIdempotencyKey());
    }
  }, [mode]);

  if (!mode) return null;
  const meta = MODE_META[mode];
  const Icon = meta.icon;

  const amountCents = Math.round(parseFloat(amountStr || "0") * 100);
  const noteRequired = mode === "debit" || mode === "clear-debt";
  const noteOk = !noteRequired || note.trim().length > 0;

  let amountOk = mode === "clear-debt"
    ? true
    : Number.isFinite(amountCents) && amountCents > 0 && amountCents <= 100_000;
  if (mode === "debit" && amountOk) amountOk = amountCents <= currentBalance;

  const canSubmit = noteOk && amountOk && !submitting;

  const newBalance =
    mode === "credit" ? currentBalance + amountCents :
    mode === "debit" ? currentBalance - amountCents :
    currentBalance;

  async function submit() {
    setSubmitting(true);
    try {
      if (mode === "credit") {
        await creditOrgWallet(orgId, { amountCents, note: note.trim() || undefined }, idemKey);
        toast.success(`Credited ${fmtCents(amountCents)} to ${orgName}`);
      } else if (mode === "debit") {
        await debitOrgWallet(orgId, { amountCents, note: note.trim() }, idemKey);
        toast.success(`Deducted ${fmtCents(amountCents)} from ${orgName}`);
      } else {
        await clearOrgDebt(orgId, { note: note.trim() }, idemKey);
        toast.success(`Cleared $${(currentDebt / 100).toFixed(2)} of debt for ${orgName}`);
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setSubmitting(false);
    }
  }

  const ctaClass = mode === "credit"
    ? "bg-[#FBD10D] text-black font-bold hover:bg-[#e8c00c] active:scale-[0.98] shadow-lg shadow-[#FBD10D]/10"
    : "bg-red-500 text-white font-bold hover:bg-red-600 active:scale-[0.98] shadow-lg shadow-red-500/20";

  return (
    <Dialog open={!!mode} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="bg-[#111116] border-[#2a2a35] text-white rounded-2xl shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className={`h-10 w-10 rounded-xl ${meta.iconBg} border ${meta.iconBorder} flex items-center justify-center`}>
              <Icon className={`h-5 w-5 ${meta.iconText}`} />
            </div>
            <DialogTitle className="text-lg font-black tracking-tight">{meta.title}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-[#9fa0b8]">
            {mode === "credit" && <>Add credits to <span className="text-white font-semibold">{orgName}</span>&apos;s wallet.</>}
            {mode === "debit" && (
              <span className="flex items-start gap-1.5 text-red-400/90">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{fmtCents(amountCents || 0)} will be removed from <span className="font-semibold">{orgName}</span>&apos;s wallet.</span>
              </span>
            )}
            {mode === "clear-debt" && <>${(currentDebt / 100).toFixed(2)} of debt will be cleared for <span className="text-white font-semibold">{orgName}</span>.</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {mode !== "clear-debt" && (
            <div>
              <Label className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72]">Amount (USD)</Label>
              <Input
                type="number" step="0.01" min="0.01" max="1000"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="mt-1.5 h-10 bg-[#0d0d11] border-[#2c2c3a] text-white rounded-xl font-mono text-base focus-visible:ring-1 focus-visible:ring-[#FBD10D]/40 focus-visible:border-[#FBD10D]/40"
                disabled={submitting}
                placeholder="0.00"
              />
              <p className="text-[11px] text-[#5a5a72] mt-1.5">
                Max $1,000 per action. New balance: <span className="font-mono text-[#c7c7da]">{fmtCents(Math.max(0, newBalance))}</span>
              </p>
            </div>
          )}

          <div>
            <Label className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72]">
              Note {noteRequired ? <span className="text-red-400">*</span> : "(optional)"}
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={noteRequired ? "Required: why are you doing this?" : "Optional context for the audit log"}
              className="mt-1.5 bg-[#0d0d11] border-[#2c2c3a] text-white rounded-xl focus-visible:ring-1 focus-visible:ring-[#FBD10D]/40 focus-visible:border-[#FBD10D]/40"
              rows={3}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="h-9 border-[#2c2c3a] bg-transparent text-[#c7c7da] hover:text-white hover:bg-[#15151b] hover:border-[#363649] rounded-xl"
          >Cancel</Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            className={`h-9 rounded-xl ${ctaClass} disabled:opacity-50 disabled:hover:bg-[#FBD10D] disabled:active:scale-100`}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

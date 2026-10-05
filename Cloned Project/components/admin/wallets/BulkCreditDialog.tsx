"use client";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Layers, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { bulkCredit } from "@/lib/admin-api/wallets";

type Stage = "filter" | "confirm" | "running" | "done";

export function BulkCreditDialog({ onComplete }: { onComplete: () => void }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("filter");

  const [createdBefore, setCreatedBefore] = useState("");
  const [hasDebt, setHasDebt] = useState(false);
  const [amountStr, setAmountStr] = useState("");
  const [note, setNote] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<{ succeeded: number; failed: number; errors: any[] } | null>(null);

  const amountCents = Math.round(parseFloat(amountStr || "0") * 100);
  const amountOk = amountCents > 0 && amountCents <= 100_000;

  function reset() {
    setStage("filter");
    setCreatedBefore("");
    setHasDebt(false);
    setAmountStr("");
    setNote("");
    setConfirmText("");
    setResult(null);
  }

  async function runBulk() {
    setStage("running");
    try {
      const r = await bulkCredit({
        amountCents,
        note: note.trim() || undefined,
        filter: {
          createdBefore: createdBefore || undefined,
          hasDebt: hasDebt || undefined,
        },
      });
      setResult(r);
      setStage("done");
      onComplete();
    } catch (e: any) {
      toast.error(e?.message ?? "Bulk credit failed");
      setStage("filter");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className="h-9 bg-[#FBD10D] text-black font-bold hover:bg-[#e8c00c] active:scale-[0.98] rounded-xl shadow-lg shadow-[#FBD10D]/10">
          <Layers className="h-4 w-4 mr-2" /> Bulk credit
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#111116] border-[#2a2a35] text-white rounded-2xl shadow-2xl max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-[#FBD10D]/10 border border-[#FBD10D]/25 flex items-center justify-center">
              <Layers className="h-5 w-5 text-[#FBD10D]" />
            </div>
            <DialogTitle className="text-lg font-black tracking-tight">Bulk credit wallets</DialogTitle>
          </div>
        </DialogHeader>

        {stage === "filter" && (
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72]">Org created before (optional)</Label>
              <Input
                type="date"
                value={createdBefore}
                onChange={(e) => setCreatedBefore(e.target.value)}
                className="mt-1.5 h-10 bg-[#0d0d11] border-[#2c2c3a] text-white rounded-xl focus-visible:ring-1 focus-visible:ring-[#FBD10D]/40 focus-visible:border-[#FBD10D]/40"
              />
            </div>
            <label className="flex items-center gap-2.5 text-sm text-[#c7c7da] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasDebt}
                onChange={(e) => setHasDebt(e.target.checked)}
                className="h-4 w-4 rounded border-[#2c2c3a] bg-[#0d0d11] accent-[#FBD10D]"
              />
              Only orgs with outstanding debt
            </label>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72]">Amount per org (USD)</Label>
              <Input
                type="number" step="0.01" min="0.01" max="1000"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="mt-1.5 h-10 bg-[#0d0d11] border-[#2c2c3a] text-white rounded-xl font-mono text-base focus-visible:ring-1 focus-visible:ring-[#FBD10D]/40 focus-visible:border-[#FBD10D]/40"
                placeholder="0.00"
              />
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72]">Note (optional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1.5 bg-[#0d0d11] border-[#2c2c3a] text-white rounded-xl focus-visible:ring-1 focus-visible:ring-[#FBD10D]/40 focus-visible:border-[#FBD10D]/40"
                rows={2}
                placeholder="e.g. Launch comp for Cohort 4"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                className="h-9 border-[#2c2c3a] bg-transparent text-[#c7c7da] hover:text-white hover:bg-[#15151b] hover:border-[#363649] rounded-xl"
              >Cancel</Button>
              <Button
                disabled={!amountOk}
                onClick={() => setStage("confirm")}
                className="h-9 bg-[#FBD10D] text-black font-bold hover:bg-[#e8c00c] active:scale-[0.98] rounded-xl shadow-lg shadow-[#FBD10D]/10 disabled:opacity-50"
              >Continue</Button>
            </DialogFooter>
          </div>
        )}

        {stage === "confirm" && (
          <div className="space-y-3 py-2">
            <div className="bg-[#0d0d11] border border-[#FBD10D]/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-[#FBD10D] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-white">
                  About to credit <span className="font-mono font-bold text-[#FBD10D]">${(amountCents / 100).toFixed(2)}</span> to every matching org.
                </p>
                <p className="text-xs text-[#9fa0b8] mt-1">
                  Total spend depends on filter match count. Server caps at $1,000 per org.
                </p>
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72]">
                Type <span className="font-mono text-[#FBD10D]">BULK CREDIT</span> to confirm
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="BULK CREDIT"
                className="mt-1.5 h-10 bg-[#0d0d11] border-[#2c2c3a] text-white rounded-xl font-mono focus-visible:ring-1 focus-visible:ring-[#FBD10D]/40 focus-visible:border-[#FBD10D]/40"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStage("filter")}
                className="h-9 border-[#2c2c3a] bg-transparent text-[#c7c7da] hover:text-white hover:bg-[#15151b] hover:border-[#363649] rounded-xl"
              >Back</Button>
              <Button
                disabled={confirmText !== "BULK CREDIT"}
                onClick={runBulk}
                className="h-9 bg-[#FBD10D] text-black font-bold hover:bg-[#e8c00c] active:scale-[0.98] rounded-xl shadow-lg shadow-[#FBD10D]/10 disabled:opacity-50"
              >Run</Button>
            </DialogFooter>
          </div>
        )}

        {stage === "running" && (
          <div className="py-12 flex flex-col items-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-[#FBD10D]" />
            <p className="text-sm font-bold text-[#c7c7da]">Crediting orgs…</p>
          </div>
        )}

        {stage === "done" && result && (
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0d0d11] border border-green-500/25 rounded-xl p-3 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
                <div>
                  <p className="text-xs text-[#9fa0b8]">Succeeded</p>
                  <p className="text-xl font-black text-green-400">{result.succeeded}</p>
                </div>
              </div>
              <div className={`bg-[#0d0d11] border ${result.failed > 0 ? "border-red-500/25" : "border-[#2c2c3a]"} rounded-xl p-3 flex items-center gap-3`}>
                <XCircle className={`h-5 w-5 shrink-0 ${result.failed > 0 ? "text-red-400" : "text-[#5a5a72]"}`} />
                <div>
                  <p className="text-xs text-[#9fa0b8]">Failed</p>
                  <p className={`text-xl font-black ${result.failed > 0 ? "text-red-400" : "text-[#5a5a72]"}`}>{result.failed}</p>
                </div>
              </div>
            </div>
            {result.failed > 0 && (
              <div className="bg-[#0d0d11] border border-red-500/20 rounded-xl p-3 text-xs max-h-40 overflow-auto space-y-1">
                {result.errors.slice(0, 20).map((e, i) => (
                  <div key={i} className="text-[#9fa0b8]">
                    <span className="font-mono text-[#5a5a72]">{e.orgId}</span>: {e.error}
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button
                onClick={() => { setOpen(false); reset(); }}
                className="h-9 bg-[#FBD10D] text-black font-bold hover:bg-[#e8c00c] active:scale-[0.98] rounded-xl shadow-lg shadow-[#FBD10D]/10"
              >Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

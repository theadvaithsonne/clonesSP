"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Hardcoded entry-tier product IDs — same convention already used for the
// $650 "Buy" button on the boards page and the $160 POD-invite link.
const PRODUCT_650_ID = "6a159466cd9f94f7f23b2ef9";
const PRODUCTS = [
  { id: PRODUCT_650_ID, label: "$650 Board Entry" },
  { id: "6a7236f5e76fd9817e7238d9", label: "$160 POD Entry" },
] as const;

export function InviteNewDistributorModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [productId, setProductId] = useState<string>(PRODUCTS[0].id);
  const [sending, setSending] = useState(false);
  // POD members (seated in pod-0/1/2 on their own board) can only invite for
  // the $160 product — checked against the caller's own progress record.
  const [inPod, setInPod] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
    fetch(`${API}/bat246/distributor/progress`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d?.inPod) {
          setInPod(true);
          setProductId(prev => (prev === PRODUCT_650_ID ? "6a7236f5e76fd9817e7238d9" : prev));
        }
      })
      .catch(() => {});
  }, []);

  async function handleSend() {
    if (!email.trim() || sending) return;
    setSending(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
      const res = await fetch(`${API}/bat246/office-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: email.trim(), productId }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Failed to send invite");
        return;
      }
      toast.success(`Invite sent to ${email.trim()}`);
      onClose();
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#0e0e14] border border-white/10 rounded-xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-white">Invite a New Distributor</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-[#7a7a7a] mb-4">
          Sends an email to someone who isn&apos;t on Garage yet — they&apos;ll sign in / sign up and land on the Path to BAT 246 Distributor.
        </p>

        <label className="block text-[11px] text-[#7a7a7a] mb-1.5">Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="prospect@example.com"
          className="w-full h-10 px-3 mb-4 rounded-lg bg-[#1a1a22] border border-white/[0.08] text-[13px] text-white placeholder:text-[#5a5a5a] focus:outline-none focus:border-amber-500/30"
        />

        <label className="block text-[11px] text-[#7a7a7a] mb-1.5">Product</label>
        <div className="flex flex-col gap-2 mb-2">
          {PRODUCTS.map(p => {
            const disabled = inPod && p.id === PRODUCT_650_ID;
            return (
              <label
                key={p.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a22] border border-white/[0.08] text-[13px] text-white ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <input
                  type="radio"
                  name="invite-product"
                  checked={productId === p.id}
                  disabled={disabled}
                  onChange={() => setProductId(p.id)}
                  className="accent-amber-500"
                />
                {p.label}
              </label>
            );
          })}
        </div>
        {inPod && (
          <p className="text-[11px] text-amber-400/80 mb-3">
            You&apos;re currently placed in a POD, so you can only invite new distributors for the $160 POD Entry product.
          </p>
        )}
        {!inPod && <div className="mb-3" />}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-3 py-1.5 rounded-md bg-white/[0.06] border border-white/10 text-white text-[12px] font-medium hover:bg-white/[0.1] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !email.trim()}
            className="px-3 py-1.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[12px] font-semibold hover:bg-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}

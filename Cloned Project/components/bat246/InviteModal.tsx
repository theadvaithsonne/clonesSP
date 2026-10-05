"use client";

import { useEffect, useState } from "react";
import { X, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Product { _id: string; name: string; price: number; currency?: string }

interface Props {
  boardId: string;
  position: string; // e.g. "atBat-0"
  posLabel: string; // e.g. "AT BAT 1"
  myUserId: string;
  disablePreservePosition?: boolean;
  hidePreservePosition?: boolean;
  onClose: () => void;
}

export function InviteModal({ boardId, position, posLabel, myUserId, disablePreservePosition, hidePreservePosition, onClose }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("garage_tok") ?? "";
    fetch(`${API}/bat246/products`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setProducts(d.products ?? []); if (d.products?.length === 1) setSelectedId(d.products[0]._id); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleGenerate(pos: string) {
    if (!selectedId) return;
    const origin = window.location.origin;
    const url = `${origin}/games/bat246/join/${boardId}/${pos}?productId=${selectedId}&ref=${myUserId}`;
    setGeneratedUrl(url);
    setCopied(false);
  }

  function handleCopy() {
    navigator.clipboard.writeText(generatedUrl)
      .then(() => { setCopied(true); toast.success("Link copied!"); setTimeout(() => setCopied(false), 2000); })
      .catch(() => toast.error("Copy failed"));
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[420px] bg-[#13131f] border border-white/15 rounded-xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-white font-bold text-sm">Invite to {posLabel}</div>
            <div className="text-white/40 text-[11px]">Generate a shareable invite link</div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product dropdown */}
        <div className="mb-3">
          <label className="text-[11px] text-white/50 uppercase tracking-wider block mb-1.5">Select Product</label>
          {loading ? (
            <div className="flex items-center gap-2 text-white/40 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : (
            <select
              value={selectedId}
              onChange={e => { setSelectedId(e.target.value); setGeneratedUrl(""); }}
              className="w-full bg-[#1c1c2e] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
            >
              <option value="">— Choose a product —</option>
              {products.map(p => (
                <option key={p._id} value={p._id} style={{ backgroundColor: "#1c1c2e" }}>
                  {p.name}{p.price ? ` — $${p.price}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Generate buttons */}
        {!hidePreservePosition && (
          <button
            onClick={() => handleGenerate(position)}
            disabled={!selectedId || disablePreservePosition}
            title={disablePreservePosition ? "Make your first sale with 'Without Position' to unlock this" : undefined}
            className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors mb-2"
          >
            Generate Link — Preserve Position
          </button>
        )}
        <button
          onClick={() => handleGenerate("unassigned")}
          disabled={!selectedId}
          className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors mb-3"
        >
          Generate Link — Without Position
        </button>

        {/* Generated URL */}
        {generatedUrl && (
          <div className="space-y-2">
            <div className="bg-black/40 border border-white/10 rounded-lg p-2.5 text-[11px] text-white/60 break-all leading-relaxed">
              {generatedUrl}
            </div>
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-green-700/80 hover:bg-green-600 text-white text-sm font-semibold transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquareQuote, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface PaidEntry {
  _id: string;
  name: string;
  userId?: string | null;
  amount: number;
  totalPaid: number;
  paidAt: string;
  note?: string;
  testimonial: string | null;
}

// "John Smith" -> "John S."
function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? fullName;
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export default function LostMoneyPaidPage() {
  const [paid, setPaid] = useState<PaidEntry[] | null>(null);
  const [activeTestimonial, setActiveTestimonial] = useState<{ name: string; message: string } | null>(null);

  useEffect(() => {
    fetch(`${API}/bat246/lostmoney/paid`)
      .then((r) => r.json())
      .then((d) => setPaid(d.paid ?? []))
      .catch(() => setPaid([]));
  }, []);

  return (
    <div className="w-full max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#e6dcc3] mb-5">
        <span className="text-xs font-bold text-emerald-800 uppercase tracking-[0.12em]">Transparency</span>
      </div>
      <h1 className="text-3xl sm:text-4xl font-black mb-3 text-stone-900">The Repayment Lineup</h1>
      <p className="text-stone-500 text-lg mb-10 max-w-[680px]">
        A running, public record of everyone approved and in line to be repaid through this
        program.
      </p>

      {paid === null ? (
        <div className="flex items-center gap-2 text-stone-400 text-base py-10">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : paid.length === 0 ? (
        <div className="p-10 rounded-2xl border border-[#e6dcc3] bg-white text-center">
          <p className="text-stone-500 text-base">
            Program has not started yet — this lineup will be updated as claims are approved and paid.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#e6dcc3] bg-white overflow-hidden overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="bg-[#f2ead6] border-b border-[#e6dcc3]">
                <th className="text-left font-bold text-stone-500 text-xs uppercase tracking-wide px-5 py-3">Name</th>
                <th className="text-left font-bold text-stone-500 text-xs uppercase tracking-wide px-5 py-3">Date</th>
                <th className="text-left font-bold text-stone-500 text-xs uppercase tracking-wide px-5 py-3">Time</th>
                <th className="text-right font-bold text-stone-500 text-xs uppercase tracking-wide px-5 py-3">Amount</th>
                <th className="text-right font-bold text-stone-500 text-xs uppercase tracking-wide px-5 py-3">Total</th>
                <th className="text-center font-bold text-stone-500 text-xs uppercase tracking-wide px-5 py-3">Status</th>
                <th className="text-center font-bold text-stone-500 text-xs uppercase tracking-wide px-5 py-3">Testimonial</th>
              </tr>
            </thead>
            <tbody>
              {paid.map((p) => {
                // Defensive: fall back to safe values if the API ever sends
                // an unexpected shape (e.g. mid-deploy version skew) rather
                // than crashing the whole page.
                const hasDate = p.paidAt && !Number.isNaN(new Date(p.paidAt).getTime());
                const d = hasDate ? new Date(p.paidAt) : null;
                const isPaid = (p.totalPaid ?? 0) > 0;
                return (
                  <tr key={p._id} className="border-b border-[#efe7d2] last:border-0 hover:bg-[#faf6ec]">
                    <td className="px-5 py-4 font-bold text-stone-900">{shortName(p.name)}</td>
                    <td className="px-5 py-4 text-stone-500">{d ? d.toLocaleDateString() : "—"}</td>
                    <td className="px-5 py-4 text-stone-500">
                      {d ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-emerald-800">
                      ${(p.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-stone-900">
                      ${(p.totalPaid ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                          isPaid ? "bg-emerald-800/10 text-emerald-800" : "bg-stone-200 text-stone-500"
                        }`}
                      >
                        {isPaid ? "Paid" : "In Queue"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {p.testimonial ? (
                        <button
                          onClick={() => setActiveTestimonial({ name: shortName(p.name), message: p.testimonial! })}
                          className="inline-flex items-center gap-1.5 text-emerald-800 font-bold text-sm hover:text-emerald-900"
                        >
                          <MessageSquareQuote className="w-4 h-4" />
                          View
                        </button>
                      ) : (
                        <span className="text-stone-300 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTestimonial && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setActiveTestimonial(null)}
        >
          <div
            className="w-full max-w-[520px] bg-white rounded-2xl border border-[#e6dcc3] p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <MessageSquareQuote className="w-8 h-8 text-emerald-800/40" />
              <button
                onClick={() => setActiveTestimonial(null)}
                className="text-stone-400 hover:text-stone-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-stone-700 text-lg leading-relaxed mb-4">{activeTestimonial.message}</p>
            <p className="text-stone-900 font-black text-base">— {activeTestimonial.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}

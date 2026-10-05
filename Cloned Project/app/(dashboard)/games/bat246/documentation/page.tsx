"use client";

import Link from "next/link";
import { FileText, ArrowUpRight, ChevronLeft } from "lucide-react";

export default function Bat246DocumentationPage() {
  return (
    <div className="w-full bg-[#09090f] text-white">
      <div className="px-4 sm:px-8 py-6 max-w-[1400px] mx-auto">

        {/* Back */}
        <div className="mb-4">
          <Link
            href="/games/bat246"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/15 text-white/80 hover:text-white hover:bg-white/[0.1] hover:border-white/25 text-sm font-semibold transition-colors group"
          >
            <ChevronLeft className="w-4.5 h-4.5 group-hover:-translate-x-0.5 transition-transform" />
            Admin Board
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/games/bat246/documentation/board-button-details"
            className="group relative overflow-hidden rounded-xl border border-brand/30 flex flex-col transition-all duration-300 hover:border-brand/60"
            style={{ background: "linear-gradient(145deg, #241f06 0%, #0a0a10 100%)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px color-mix(in srgb, var(--brand) 25%, transparent), 0 0 80px color-mix(in srgb, var(--brand) 10%, transparent)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-brand to-transparent" />
            <div className="absolute -bottom-4 -right-4 opacity-[0.06] pointer-events-none">
              <FileText style={{ width: 90, height: 90 }} className="text-brand" />
            </div>

            <div className="relative flex flex-col flex-1 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl border border-brand/40 bg-brand/15 flex items-center justify-center">
                  <FileText style={{ width: 16, height: 16 }} className="text-brand" />
                </div>
                <ArrowUpRight
                  style={{ width: 14, height: 14 }}
                  className="text-white/10 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 text-brand opacity-0 group-hover:opacity-60"
                />
              </div>

              <div className="flex-1">
                <div className="text-[14px] font-bold text-white mb-1">Board Button Details</div>
                <div className="text-[11px] text-white/50 leading-relaxed">Reference for the buttons and controls on a BAT 246 board</div>
              </div>

              <div className="flex items-end justify-between mt-3 pt-3 border-t border-brand/15">
                <div className="text-[11px] font-semibold text-brand uppercase tracking-wider">BAT 246</div>
                <span className="text-[11px] font-semibold text-brand opacity-0 group-hover:opacity-100 transition-opacity">
                  Open →
                </span>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

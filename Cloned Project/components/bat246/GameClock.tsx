"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TimeLeft {
  hrs: number;
  min: number;
  sec: number;
  expired: boolean;
}

/** `stopped`: the board has split — the clock is frozen at the split moment (pass that time as pausedRemainingMs). */
export function GameClock({ targetDate, pausedRemainingMs, stopped = false }: { targetDate: Date; pausedRemainingMs?: number | null; stopped?: boolean }) {
  const [time, setTime] = useState<TimeLeft>({ hrs: 0, min: 0, sec: 0, expired: false });
  const paused = pausedRemainingMs != null;

  useEffect(() => {
    if (pausedRemainingMs != null) {
      const ms = Math.max(0, pausedRemainingMs);
      setTime({
        hrs: Math.floor(ms / 3_600_000),
        min: Math.floor((ms % 3_600_000) / 60_000),
        sec: Math.floor((ms % 60_000) / 1_000),
        expired: false,
      });
      return;
    }
    const tick = () => {
      const diff = targetDate.getTime() - Date.now();
      if (diff <= 0) {
        setTime({ hrs: 0, min: 0, sec: 0, expired: true });
        return;
      }
      setTime({
        hrs: Math.floor(diff / 3_600_000),
        min: Math.floor((diff % 3_600_000) / 60_000),
        sec: Math.floor((diff % 60_000) / 1_000),
        expired: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate, pausedRemainingMs]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const expired = time.expired;
  const led = expired ? "#ff5a4d" : "#ffb22e";
  const glow = expired ? "rgba(255,90,77,0.6)" : "rgba(255,178,46,0.6)";

  const Cell = ({ value, label }: { value: string; label: string }) => (
    <div className="flex-1 flex flex-col items-center gap-[2px]">
      <div className="w-full rounded-[2px] bg-orange-500 border border-orange-600 py-[3px] text-center shadow-[inset_0_0_4px_rgba(0,0,0,0.3)]">
        <span
          className="font-[family-name:var(--font-bat-led)] font-black text-[17.12px] leading-none tracking-[0.05em] tabular-nums"
          style={{ color: "#000000", textShadow: "none" }}
        >
          {value}
        </span>
      </div>
      <span
        className="font-[family-name:var(--font-bat-led)] font-bold text-[11px] tracking-[0.12em] uppercase"
        style={{ color: expired ? "#ff5a4d" : "#ffe566", textShadow: `0 0 12px #ffe566, 0 0 24px rgba(255,229,50,1)` }}
      >
        {label}
      </span>
    </div>
  );

  return (
    <div className="flex-shrink-0 rounded-md border-2 border-black/70 bg-gradient-to-b from-[#34343a] to-[#0c0c0e] p-1.5 shadow-[0_3px_8px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]">
      {/* Header — single row, letters spread full width */}
      <div className="w-full flex justify-between mb-1">
        {"GAME CLOCK".split("").map((c, i) => (
          <span
            key={i}
            className="font-[family-name:var(--font-bat-led)] font-black text-[17.6px] leading-none uppercase"
            style={{ color: expired ? "#ff2a1a" : "#ffe566", textShadow: expired ? `0 0 6px rgba(255,42,26,1), 0 0 14px rgba(255,42,26,0.9), 0 0 26px rgba(255,42,26,0.7)` : `0 0 12px #ffe566, 0 0 24px rgba(255,229,50,1)`, WebkitTextStroke: expired ? "0.8px #ff2a1a" : "0.8px #ffe566", paintOrder: "stroke fill" }}
          >
            {c === " " ? " " : c}
          </span>
        ))}
      </div>
      <div className="flex items-start gap-1">
        <Cell value={String(time.hrs).padStart(3, "0")} label="Hours" />
        <Cell value={pad(time.min)} label="Mins" />
        <Cell value={pad(time.sec)} label="Sec" />
      </div>
      <div className="text-center mt-1 text-[14px] font-black uppercase w-full" style={{ color: led, textShadow: `0 0 6px ${glow}`, letterSpacing: "3px" }}>
        {stopped ? "PP Stopped" : expired ? "PP Expired" : paused ? "PP Paused" : "PP Active"}
      </div>
    </div>
  );
}

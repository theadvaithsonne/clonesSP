"use client";

import * as React from "react";

type Props = {
  length?: number; // default 6
  value: string; // controlled value (digits only)
  onChange: (val: string) => void;
  autoFocus?: boolean;
};

export default function OtpInput({
  length = 6,
  value,
  onChange,
  autoFocus = true,
}: Props) {
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);

  // ensure value never exceeds length & keep only digits
  React.useEffect(() => {
    const digits = value.replace(/\D/g, "").slice(0, length);
    if (digits !== value) onChange(digits);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, length]);

  React.useEffect(() => {
    if (autoFocus && refs.current[0]) refs.current[0].focus();
  }, [autoFocus]);

  function setAt(i: number, v: string) {
    const d = v.replace(/\D/g, "").slice(0, 1);
    const next = value.split("");
    next[i] = d;
    const joined = next.join("").slice(0, length);
    onChange(joined);
    if (d && i < length - 1) refs.current[i + 1]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    const key = e.key;
    if (key === "Backspace") {
      if (!value[i] && i > 0) refs.current[i - 1]?.focus();
      return;
    }
    if (key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    }
    if (key === "ArrowRight" && i < length - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
    if (key === "Home") refs.current[0]?.focus();
    if (key === "End") refs.current[length - 1]?.focus();
  }

  // Paste: distribute digits starting at current index
  function onPaste(e: React.ClipboardEvent<HTMLInputElement>, i: number) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;

    const next = value.split("");
    let cursor = i;
    for (const ch of pasted) {
      if (cursor >= length) break;
      next[cursor++] = ch;
    }
    const joined = next.join("").slice(0, length);
    onChange(joined);
    const focusTo = Math.min(cursor, length - 1);
    refs.current[focusTo]?.focus();
  }

  return (
    <div className="flex items-center justify-between gap-2">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => setAt(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(e, i)}
          onPaste={(e) => onPaste(e, i)}
          className="h-12 w-12 text-center text-lg font-medium rounded-md
                     bg-white border border-zinc-300 text-zinc-900
                     dark:bg-zinc-800 dark:border-zinc-600 dark:text-white
                     placeholder:text-zinc-400
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:border-zinc-400
                     shadow-none transition-colors"
        />
      ))}
    </div>
  );
}

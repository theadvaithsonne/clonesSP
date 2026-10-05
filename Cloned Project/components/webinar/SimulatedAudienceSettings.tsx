"use client";

// Simulated audience — fabricated attendees and chat for a LIVE webinar.
//
// Generation is AI-assisted but never automatic: the model proposes a roster
// and a timed script, the host edits them here, and nothing shows in a room
// until they turn it on. Timings are seconds from when the host actually goes
// live, so a session that starts late doesn't dump its backlog at once.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { getToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Person {
  name: string;
}
interface ChatLine {
  atSec: number;
  name: string;
  message: string;
}
interface SimAudience {
  enabled?: boolean;
  people?: Person[];
  chat?: ChatLine[];
  viewers?: { enabled?: boolean; peak?: number };
}

function clock(total?: number): string {
  const s = Math.max(0, Math.floor(total || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** "mm:ss" / "h:mm:ss" -> seconds. null when unparseable. */
function parseClock(v: string): number | null {
  const parts = v.trim().split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export default function SimulatedAudienceSettings({ workshopId }: { workshopId: string }) {
  const [sim, setSim] = useState<SimAudience | null>(null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showGen, setShowGen] = useState(false);
  const [form, setForm] = useState({
    audience: "",
    tone: "casual, warm",
    region: "",
    peopleCount: 25,
    messageCount: 40,
    durationMin: 60,
  });
  // Edits are local until saved, so a long script isn't a PATCH per keystroke.
  const dirty = useRef(false);

  const authed = useCallback(
    (path: string, init: RequestInit = {}) =>
      fetch(`${API_URL}/simulated-audience/${workshopId}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken() || ""}`,
          ...(init.headers || {}),
        },
      }),
    [workshopId]
  );

  useEffect(() => {
    authed("")
      .then((r) => r.json())
      .then((d) => setSim(d?.simulatedAudience || { enabled: false }))
      .catch(() => setSim({ enabled: false }));
  }, [authed]);

  const save = async (patch: Partial<SimAudience>) => {
    setBusy(true);
    try {
      const res = await authed("", { method: "PATCH", body: JSON.stringify(patch) }).then((r) => r.json());
      if (!res.success) throw new Error(res.error || "Save failed");
      setSim(res.simulatedAudience);
      dirty.current = false;
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await authed("/generate", {
        method: "POST",
        body: JSON.stringify(form),
      }).then((r) => r.json());
      if (!res.success) throw new Error(res.error || "Generation failed");
      // Held locally for review — the host saves when happy with it.
      setSim((p) => ({ ...(p || {}), people: res.people, chat: res.chat }));
      dirty.current = true;
      setShowGen(false);
      toast.success(
        `Generated ${res.people.length} people and ${res.chat.length} messages — review, then save`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  if (!sim) {
    return (
      <div className="flex items-center gap-2 p-4 text-[13px] text-[#9fa0b8]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const people = sim.people || [];
  const chat = sim.chat || [];
  const setLocal = (patch: Partial<SimAudience>) => {
    dirty.current = true;
    setSim((p) => ({ ...(p || {}), ...patch }));
  };

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-[#2a2a35] bg-[#131316]/50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-semibold text-white">Simulated audience</h3>
          <p className="mt-1 text-[12px] leading-snug text-[#9fa0b8]">
            Fabricated attendees and chat, shown alongside the real ones. Timings run
            from the moment you actually go live.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!sim.enabled}
          disabled={busy || (!sim.enabled && !people.length && !chat.length)}
          onClick={() => save({ enabled: !sim.enabled })}
          title={!people.length && !chat.length ? "Generate or add some people first" : undefined}
          className={`relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
            sim.enabled ? "bg-brand" : "bg-[#2a2a35]"
          }`}
        >
          <span
            className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform ${
              sim.enabled ? "translate-x-[18px]" : "translate-x-[2px]"
            }`}
          />
        </button>
      </div>

      {/* Generate */}
      <div>
        <button
          type="button"
          disabled={generating}
          onClick={() => setShowGen((v) => !v)}
          className="flex items-center gap-2 rounded-full bg-brand px-3.5 py-2 text-[12px] font-semibold text-brand-foreground hover:brightness-95 disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? "Generating…" : chat.length ? "Regenerate" : "Generate with AI"}
        </button>

        {showGen && (
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[#2a2a35] bg-[#131316] p-3">
            <p className="text-[11px] text-[#9fa0b8]">
              The webinar&apos;s own title, description and learning points are used
              automatically. These just steer it.
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[#9fa0b8]">Who is watching?</span>
              <input
                value={form.audience}
                onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
                placeholder="e.g. first-time founders exploring crypto offices"
                className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] px-2.5 py-2 text-[12px] text-white outline-none focus:border-brand/60"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[#9fa0b8]">Tone</span>
                <input
                  value={form.tone}
                  onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))}
                  className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] px-2.5 py-2 text-[12px] text-white outline-none focus:border-brand/60"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[#9fa0b8]">Names suit</span>
                <input
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                  placeholder="e.g. India + US mix"
                  className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] px-2.5 py-2 text-[12px] text-white outline-none focus:border-brand/60"
                />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {([
                ["People", "peopleCount"],
                ["Messages", "messageCount"],
                ["Minutes", "durationMin"],
              ] as const).map(([label, key]) => (
                <label key={key} className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-[#9fa0b8]">{label}</span>
                  <input
                    type="number"
                    min={1}
                    value={form[key]}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: Math.max(1, Number(e.target.value) || 1) }))
                    }
                    className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] px-2.5 py-2 text-[12px] text-white outline-none focus:border-brand/60"
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={generating}
              onClick={generate}
              className="self-start rounded-full bg-brand px-3.5 py-2 text-[12px] font-semibold text-brand-foreground hover:brightness-95 disabled:opacity-50"
            >
              {generating ? "Generating…" : "Generate"}
            </button>
          </div>
        )}
      </div>

      {/* People */}
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#9fa0b8]">
          People ({people.length})
        </p>
        <textarea
          rows={3}
          defaultValue={people.map((p) => p.name).join("\n")}
          key={people.map((p) => p.name).join("|")}
          onBlur={(e) =>
            setLocal({
              people: e.target.value
                .split("\n")
                .map((n) => n.trim())
                .filter(Boolean)
                .map((name) => ({ name })),
            })
          }
          placeholder="One name per line"
          className="w-full resize-y rounded-lg border border-[#2a2a35] bg-[#131316] px-2.5 py-2 text-[12px] text-white outline-none focus:border-brand/60"
        />
      </div>

      {/* Chat script */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9fa0b8]">
          Chat ({chat.length})
        </p>
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {chat.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                defaultValue={clock(line.atSec)}
                onBlur={(e) => {
                  const secs = parseClock(e.target.value);
                  if (secs === null) return toast.error("Use mm:ss or h:mm:ss");
                  const next = [...chat];
                  next[i] = { ...line, atSec: secs };
                  setLocal({ chat: next });
                }}
                className="w-20 rounded-lg border border-[#2a2a35] bg-[#131316] px-2 py-1.5 text-[12px] tabular-nums text-white outline-none focus:border-brand/60"
              />
              <input
                defaultValue={line.name}
                onBlur={(e) => {
                  const next = [...chat];
                  next[i] = { ...line, name: e.target.value };
                  setLocal({ chat: next });
                }}
                className="w-28 rounded-lg border border-[#2a2a35] bg-[#131316] px-2 py-1.5 text-[12px] text-white outline-none focus:border-brand/60"
              />
              <input
                defaultValue={line.message}
                onBlur={(e) => {
                  const next = [...chat];
                  next[i] = { ...line, message: e.target.value };
                  setLocal({ chat: next });
                }}
                className="min-w-0 flex-1 rounded-lg border border-[#2a2a35] bg-[#131316] px-2 py-1.5 text-[12px] text-white outline-none focus:border-brand/60"
              />
              <button
                type="button"
                onClick={() => setLocal({ chat: chat.filter((_, j) => j !== i) })}
                aria-label="Remove message"
                className="shrink-0 rounded-md p-1.5 text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setLocal({ chat: [...chat, { atSec: 0, name: people[0]?.name || "", message: "" }] })}
            className="rounded-full bg-[#1a1a22] px-3 py-1.5 text-[12px] text-white hover:bg-[#22222c] disabled:opacity-50"
          >
            Add message
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => save({ people, chat })}
            className="rounded-full bg-brand px-3.5 py-1.5 text-[12px] font-semibold text-brand-foreground hover:brightness-95 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save audience"}
          </button>
          <span className="text-[11px] text-[#9fa0b8]">
            {dirty.current ? "Unsaved changes" : "Saved"}
          </span>
        </div>
      </div>
    </div>
  );
}

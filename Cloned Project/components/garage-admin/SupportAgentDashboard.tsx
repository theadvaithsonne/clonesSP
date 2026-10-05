"use client";

// The Support Agent dashboard — the operator's "my work" view, scoped to the
// signed-in admin. It answers three questions at a glance: who am I supporting,
// who still needs an NVC chat, and who has converted to a subscriber. Data
// comes from /garage-admin/support/my-assignments (self-scoped); the NVC toggle
// reuses the same endpoint the affiliate tables use, gated by the mark-nvc
// grant so an agent without it sees the status read-only.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Check,
  Headset,
  Loader2,
  MessageCircle,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import { garageAdminApi } from "@/lib/api";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";

interface Affiliate {
  userId: string;
  user: {
    _id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    profilePicture: string | null;
    country: string | null;
  };
  location: { city: string | null; state: string | null; country: string | null };
  joinedAt: string | null;
  assignedAt: string | null;
  hasNvcChat: boolean;
  isNetworkChainSubscriber: boolean;
}

interface Payload {
  agent: { id: string; name: string | null; email: string | null; role: string | null };
  stats: { assigned: number; nvcDone: number; nvcPending: number; subscribers: number };
  affiliates: Affiliate[];
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-sm font-semibold text-zinc-300">
      {initial}
    </span>
  );
}

function locationLine(l: Affiliate["location"]): string {
  return [l.city, l.state, l.country].filter(Boolean).join(", ");
}

export default function SupportAgentDashboard() {
  const { canDoAction } = useAdminAccess();
  const canMarkNvc =
    canDoAction("one_time_affiliates", "mark-nvc") ||
    canDoAction("networkchain_subs", "mark-nvc");

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    garageAdminApi<Payload>("/garage-admin/support/my-assignments", {
      method: "GET",
    })
      .then(setData)
      .catch((e: any) => setError(e?.message || "Couldn't load your dashboard"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleNvc = async (row: Affiliate) => {
    if (!canMarkNvc) return;
    const next = !row.hasNvcChat;
    setData((prev) =>
      prev
        ? {
            ...prev,
            affiliates: prev.affiliates.map((a) =>
              a.userId === row.userId ? { ...a, hasNvcChat: next } : a,
            ),
            stats: {
              ...prev.stats,
              nvcDone: prev.stats.nvcDone + (next ? 1 : -1),
              nvcPending: prev.stats.nvcPending + (next ? -1 : 1),
            },
          }
        : prev,
    );
    try {
      await garageAdminApi(`/garage-admin/users/${row.userId}/nvc-chat`, {
        method: "POST",
        body: JSON.stringify({ created: next }),
      });
    } catch (e: any) {
      // Roll back on failure.
      setData((prev) =>
        prev
          ? {
              ...prev,
              affiliates: prev.affiliates.map((a) =>
                a.userId === row.userId ? { ...a, hasNvcChat: !next } : a,
              ),
              stats: {
                ...prev.stats,
                nvcDone: prev.stats.nvcDone + (next ? -1 : 1),
                nvcPending: prev.stats.nvcPending + (next ? 1 : -1),
              },
            }
          : prev,
      );
      toast.error(e?.message || "Couldn't update NVC chat");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-xl border border-brand/25 bg-brand/10 p-2.5">
          <Headset className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Support Agent</h1>
          <p className="text-sm text-zinc-400">
            {data?.agent.name || data?.agent.email
              ? `Signed in as ${data?.agent.name || data?.agent.email}`
              : "Your assigned work"}
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-5 py-4 text-sm text-red-300">
          {error}
          <button onClick={load} className="ml-3 text-brand hover:underline">
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Assigned to me" value={data?.stats.assigned ?? 0} icon={Users} />
            <Stat
              label="NVC chats to do"
              value={data?.stats.nvcPending ?? 0}
              icon={MessageCircle}
              accent="text-brand"
            />
            <Stat label="NVC chats done" value={data?.stats.nvcDone ?? 0} icon={Check} />
            <Stat
              label="Subscribers"
              value={data?.stats.subscribers ?? 0}
              icon={Sparkles}
              accent="text-emerald-400"
            />
          </div>

          {/* Quick link to tickets */}
          <div className="mt-4">
            <Link
              href="/garage-admin/tickets"
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06]"
            >
              <Ticket className="h-4 w-4" />
              Go to support tickets
            </Link>
          </div>

          {/* Assigned affiliates */}
          <div className="mt-6">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-white">
                My assigned affiliates
              </h2>
              {(data?.stats.nvcPending ?? 0) > 0 && (
                <span className="text-xs text-brand">
                  {data?.stats.nvcPending} still need an NVC chat
                </span>
              )}
            </div>

            {(data?.affiliates.length ?? 0) === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.1] py-16 text-center">
                <p className="text-sm text-zinc-400">
                  No affiliates are assigned to you yet.
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  A super admin assigns them from One Time Affiliates or
                  NetworkChain Subs.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {data!.affiliates.map((a) => {
                  const phone = (a.user.phone || "").replace(/\D/g, "");
                  const loc = locationLine(a.location);
                  return (
                    <li
                      key={a.userId}
                      className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors hover:bg-white/[0.04]"
                    >
                      <Avatar src={a.user.profilePicture} name={a.user.name || a.user.email || "?"} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold text-white">
                            {a.user.name || "Unnamed"}
                          </span>
                          {a.isNetworkChainSubscriber && (
                            <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                              Subscriber
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-zinc-500">
                          {a.user.email || "—"}
                          {loc ? ` · ${loc}` : ""}
                        </div>
                      </div>

                      {/* NVC status / toggle */}
                      {canMarkNvc ? (
                        <button
                          type="button"
                          onClick={() => toggleNvc(a)}
                          title={a.hasNvcChat ? "NVC chat created — click to unmark" : "Mark NVC chat as created"}
                          className={
                            a.hasNvcChat
                              ? "shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
                              : "shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-zinc-400 transition hover:bg-white/[0.09] hover:text-zinc-200"
                          }
                        >
                          NVC {a.hasNvcChat ? "✓" : "—"}
                        </button>
                      ) : (
                        <span
                          className={
                            a.hasNvcChat
                              ? "shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400"
                              : "shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-zinc-400"
                          }
                        >
                          NVC {a.hasNvcChat ? "✓" : "—"}
                        </span>
                      )}

                      {phone && (
                        <a
                          href={`https://wa.me/${phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="WhatsApp"
                          className="shrink-0 rounded-lg border border-white/[0.08] p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  accent = "text-zinc-300",
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">
            {label}
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-2">
          <Icon className={`h-4 w-4 ${accent}`} />
        </div>
      </div>
    </div>
  );
}

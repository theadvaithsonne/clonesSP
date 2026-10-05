"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  GitMerge,
  GitPullRequestArrow,
  Mail,
  Phone,
  Link2,
  Users as UsersIcon,
  Sparkles,
  Fingerprint,
  Copy,
  Check,
} from "lucide-react";
import {
  getAxonDetail,
  axonLabel,
  type RawAxon,
  type AxonLink,
  type AxonStatus,
  type AxonEnrichmentChannel,
} from "@/lib/nc-admin-api/admin-axons";
import { AdminUnauthorizedError } from "@/lib/nc-admin-api/admin";
import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";
import { MergeDialog } from "@/components/nc-admin/axons/merge-dialog";
import { UnmergeDialog } from "@/components/nc-admin/axons/unmerge-dialog";
import { toast } from "sonner";

function CopyId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1 font-mono text-[11px] text-zinc-300 hover:bg-white/[0.06]"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 text-zinc-500" />
      )}
      {value}
    </button>
  );
}

function StatusBadge({ status }: { status: AxonStatus }) {
  const map: Record<AxonStatus, string> = {
    active: "bg-emerald-500/15 text-emerald-300",
    merged_into: "bg-zinc-500/20 text-zinc-400",
    erased: "bg-red-500/15 text-red-300",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] ${map[status]}`}>
      {status}
    </span>
  );
}

function Section({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: typeof Mail;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#FFC200]" />
        <h2 className="text-sm font-semibold">{title}</h2>
        {count != null && (
          <span className="rounded-full bg-zinc-500/15 px-2 py-0.5 text-[10px] text-zinc-400">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function ChannelCard({
  platform,
  ch,
}: {
  platform: string;
  ch: AxonEnrichmentChannel;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold capitalize text-white">
          {platform}
        </span>
        {ch.status && (
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-400">
            {ch.status}
          </span>
        )}
      </div>
      {ch.profileUrl && (
        <a
          href={ch.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-[11px] text-sky-400 hover:underline"
        >
          {ch.profileUrl}
        </a>
      )}
      {ch.summary && (
        <p className="mt-1.5 line-clamp-4 text-[11px] text-zinc-300">
          {ch.summary}
        </p>
      )}
      {ch.highlights && ch.highlights.length > 0 && (
        <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[11px] text-zinc-400">
          {ch.highlights.slice(0, 5).map((h, i) => (
            <li key={i} className="truncate">
              {h}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-500">
        {ch.source && <span>src: {ch.source}</span>}
        {ch.fetchedAt && (
          <span>fetched: {new Date(ch.fetchedAt).toLocaleString()}</span>
        )}
        {ch.costCents != null && <span>cost: {ch.costCents}¢</span>}
        {ch.contributor?.userId && (
          <span>by: {ch.contributor.userId}</span>
        )}
      </div>
    </div>
  );
}

// Garage's admin shell paints #181818 behind every page and wraps children in
// px-8 pb-8 pt-7. NC's own chrome paints flat #080808 behind every admin page
// (NC's `from-[rgba(8, 8, 8,0.98)]`/`to-[rgba(15, 15, 15,0.98)]` gradient
// classes contain literal spaces inside the arbitrary value, which Tailwind
// cannot parse — the class never applies, so live NC renders flat #080808,
// not a gradient). A ported page must re-establish that flat surface itself —
// the -mx-8/-mb-8/-mt-7 cancels Garage's padding edge-to-edge — and follows
// the chrome convention already used by networkchains/ai-cost/page.tsx and
// networkchains/users/[userId]/page.tsx: flat bg-[#080808],
// h-[calc(100vh-66px)] with internal scroll, re-padded with px-8 pb-8 pt-7.
function Shell({
  children,
  onBack,
  backMargin = "mb-5",
}: {
  children: React.ReactNode;
  onBack: () => void;
  /** NC's own (unreused) chrome used mb-5 on the main content view and mb-6
   *  on the not-found error view — two separately inline-styled blocks in
   *  the NC source, unified here into one Shell. */
  backMargin?: "mb-5" | "mb-6";
}) {
  return (
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col overflow-y-auto bg-[#080808] px-8 pb-8 pt-7 text-white">
      <button
        onClick={onBack}
        className={`${backMargin} inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white`}
      >
        <ArrowLeft className="h-4 w-4" /> Back to directory
      </button>
      {children}
    </div>
  );
}

export default function AdminAxonDetailPage({
  params,
}: {
  params: Promise<{ axonId: string }>;
}) {
  const { axonId } = use(params);
  const router = useRouter();
  const [axon, setAxon] = useState<RawAxon | null>(null);
  const [contributors, setContributors] = useState<AxonLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showMerge, setShowMerge] = useState(false);
  const [showUnmerge, setShowUnmerge] = useState(false);
  // Merging and unmerging are writes, so they need "Full" on NC · Aixons.
  // contacts-backend rejects them with 403 for a view-only grant either way;
  // this is about not offering a button that can only fail. Gated on `ready`
  // so the control never flashes in before permissions resolve.
  const { ready: accessReady, canManage } = useAdminAccess();
  const canManageAxons = accessReady && canManage("nc_axons");

  // An expired NC token is recovered by re-elevating from the Garage session —
  // never by reloading, which would drop the operator out of the Garage shell.
  // Capped to one recovery attempt per failure episode: if elevation keeps
  // succeeding while the data endpoint keeps 401ing, this must not loop
  // forever hammering the backend. Re-arms once data loads again.
  // lib/nc-admin-api/auth.ts already clears the stale NC token on every path
  // that throws this error, so no page-level clear is needed here.
  const recoveryAttempted = useRef(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAxonDetail(axonId);
      setAxon(data.axon);
      setContributors(data.contributors);
      setError("");
      recoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) {
        if (recoveryAttempted.current) return; // one attempt per failure episode
        recoveryAttempted.current = true;
        ensureNcAdminToken().then((result) => {
          if (result.ok === true) {
            fetchDetail();
          }
        });
        return;
      }
      setError("Failed to load axon");
    } finally {
      setLoading(false);
    }
  }, [axonId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (loading) {
    return (
      <div className="-mx-8 -mb-8 -mt-7 flex min-h-[calc(100vh-66px)] items-center justify-center bg-[#080808]">
        <Loader2 className="h-6 w-6 animate-spin text-[#FFC200]" />
      </div>
    );
  }

  if (error || !axon) {
    return (
      <Shell backMargin="mb-6" onBack={() => router.push("/garage-admin/networkchains/axons")}>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-6 text-center text-sm text-red-400">
          This axon was not found.
        </div>
      </Shell>
    );
  }

  const enr = axon.enrichment ?? {};
  const channels: [string, AxonEnrichmentChannel][] = (
    [
      ["linkedin", enr.linkedin],
      ["facebook", enr.facebook],
      ["instagram", enr.instagram],
    ] as [string, AxonEnrichmentChannel | undefined][]
  ).filter((e): e is [string, AxonEnrichmentChannel] => !!e[1]);

  return (
    <Shell onBack={() => router.push("/garage-admin/networkchains/axons")}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {axon.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={axon.imageUrl}
              alt=""
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#FFC200] to-[#FFA800] text-lg font-semibold text-black">
              {axonLabel(axon).charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {axonLabel(axon)}
              </h1>
              <StatusBadge status={axon.status} />
            </div>
            {axon.headline && (
              <p className="mt-0.5 text-sm text-zinc-400">{axon.headline}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <CopyId value={axon._id} />
              {axon.location && (
                <span className="text-xs text-zinc-500">{axon.location}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManageAxons && (
            <>
              <button
                onClick={() => setShowMerge(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-medium text-white hover:bg-white/[0.08]"
              >
                <GitMerge className="h-3.5 w-3.5 text-[#FFC200]" />
                Merge
              </button>
              <button
                onClick={() => setShowUnmerge(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-medium text-white hover:bg-white/[0.08]"
              >
                <GitPullRequestArrow className="h-3.5 w-3.5 text-[#FFC200]" />
                Unmerge
              </button>
            </>
          )}
        </div>
      </div>

      {axon.mergedInto && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          This axon is a tombstone — canonical lives at{" "}
          <button
            onClick={() => router.push(`/garage-admin/networkchains/axons/${axon.mergedInto}`)}
            className="font-mono underline hover:text-amber-200"
          >
            {axon.mergedInto}
          </button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Identity: emails */}
        <Section title="Emails" icon={Mail} count={axon.emails?.length ?? 0}>
          {axon.emails && axon.emails.length > 0 ? (
            <ul className="space-y-1.5">
              {axon.emails.map((e, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="text-zinc-200">{e.value}</span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {e.normalized}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">None</p>
          )}
        </Section>

        {/* Identity: phones */}
        <Section title="Phones" icon={Phone} count={axon.phones?.length ?? 0}>
          {axon.phones && axon.phones.length > 0 ? (
            <ul className="space-y-1.5">
              {axon.phones.map((p, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="text-zinc-200">{p.value}</span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {p.e164 || p.digits}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">None</p>
          )}
        </Section>

        {/* Social profiles */}
        <Section
          title="Social profiles"
          icon={Link2}
          count={axon.socialProfiles?.length ?? 0}
        >
          {axon.socialProfiles && axon.socialProfiles.length > 0 ? (
            <ul className="space-y-2">
              {axon.socialProfiles.map((s, i) => (
                <li key={i} className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize text-white">
                      {s.platform}
                    </span>
                    {s.username && (
                      <span className="text-zinc-400">@{s.username}</span>
                    )}
                    {s.isVerified && (
                      <span className="rounded bg-sky-500/15 px-1 text-[9px] text-sky-300">
                        verified
                      </span>
                    )}
                  </div>
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-[11px] text-sky-400 hover:underline"
                    >
                      {s.url}
                    </a>
                  )}
                  {s.externalId && (
                    <div className="font-mono text-[10px] text-zinc-500">
                      {s.externalId}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">None</p>
          )}
        </Section>

        {/* Match keys */}
        <Section
          title="Match keys"
          icon={Fingerprint}
          count={axon.matchKeys?.length ?? 0}
        >
          {axon.matchKeys && axon.matchKeys.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {axon.matchKeys.map((k) => {
                const strength = axon.keyStrength?.[k];
                const color =
                  strength === "strong"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : strength === "role"
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-white/[0.06] text-zinc-400";
                return (
                  <span
                    key={k}
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${color}`}
                    title={strength ? `${strength} key` : undefined}
                  >
                    {k}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">None</p>
          )}
        </Section>
      </div>

      {/* Enrichment */}
      <div className="mt-5">
        <Section title="Enrichment" icon={Sparkles} count={channels.length}>
          {channels.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {channels.map(([platform, ch]) => (
                <ChannelCard key={platform} platform={platform} ch={ch} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">No enrichment yet</p>
          )}
          {axon.about && (
            <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">
                About
              </div>
              <p className="text-xs text-zinc-300">{axon.about}</p>
            </div>
          )}
        </Section>
      </div>

      {/* Contributors */}
      <div className="mt-5">
        <Section
          title="Contributors"
          icon={UsersIcon}
          count={contributors.length}
        >
          <p className="mb-3 text-[11px] text-zinc-500">
            Users linked to this axon (admin fan-out, audited).
          </p>
          {contributors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-zinc-500">
                    <th className="pb-2 font-medium">User</th>
                    <th className="pb-2 font-medium">Org</th>
                    <th className="pb-2 font-medium">Contact</th>
                    <th className="pb-2 font-medium text-right">Linked</th>
                  </tr>
                </thead>
                <tbody>
                  {contributors.map((c) => (
                    <tr
                      key={c._id}
                      className="border-b border-white/[0.04] hover:bg-white/[0.03]"
                    >
                      <td className="py-2">
                        <button
                          onClick={() =>
                            router.push(`/garage-admin/networkchains/users/${c.userId}`)
                          }
                          className="group flex flex-col items-start text-left"
                        >
                          <span className="font-medium text-sky-400 group-hover:underline">
                            {c.userName || "Unknown user"}
                          </span>
                          {c.userEmail && (
                            <span className="text-[11px] text-zinc-400">
                              {c.userEmail}
                            </span>
                          )}
                          <span className="font-mono text-[10px] text-zinc-600">
                            {c.userId}
                          </span>
                        </button>
                      </td>
                      <td className="py-2 font-mono text-zinc-400">
                        {c.orgId || "—"}
                      </td>
                      <td className="py-2 font-mono text-zinc-400">
                        {c.contactId || "—"}
                      </td>
                      <td className="py-2 text-right text-zinc-400">
                        {c.createdAt
                          ? new Date(c.createdAt).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">No contributors</p>
          )}
        </Section>
      </div>

      {/* Meta */}
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-zinc-500">
        <span>contributorCount: {axon.contributorCount}</span>
        {axon.projectionGen != null && (
          <span>projectionGen: {axon.projectionGen}</span>
        )}
        {axon.schemaVersion != null && (
          <span>schemaVersion: {axon.schemaVersion}</span>
        )}
        {axon.createdAt && (
          <span>created: {new Date(axon.createdAt).toLocaleString()}</span>
        )}
        {axon.updatedAt && (
          <span>updated: {new Date(axon.updatedAt).toLocaleString()}</span>
        )}
      </div>

      {showMerge && (
        <MergeDialog
          axon={axon}
          onClose={() => setShowMerge(false)}
          onMerged={(r) => {
            if (r.status === "merged") {
              toast.success("Merge applied");
              fetchDetail();
            } else {
              toast.message(`Merge: ${r.status}`);
            }
          }}
        />
      )}
      {showUnmerge && (
        <UnmergeDialog
          onClose={() => setShowUnmerge(false)}
          onUnmerged={(r) => {
            if (r.status === "reverted") {
              toast.success("Unmerge reverted");
              fetchDetail();
            } else {
              toast.message(`Unmerge: ${r.status}`);
            }
          }}
        />
      )}
    </Shell>
  );
}

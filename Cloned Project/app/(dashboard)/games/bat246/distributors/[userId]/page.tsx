"use client";

import { useState, useEffect, useMemo, use } from "react";
import Link from "next/link";
import { ChevronLeft, CheckCircle2, XCircle, User, MapPin, Phone, Mail, Calendar, Shield, Award, Network } from "lucide-react";
import {
  getMembersCache,
  setMembersCache,
  type CachedMember,
  type PersonBlock,
} from "@/lib/bat246MembersCache";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const ALAN_K_EMAIL = "redbaron2020@mail.com";

interface DistributorUser {
  _id: string;
  name?: string;
  email: string;
  phone?: string;
  profilePicture?: string;
  country?: string;
  state?: string;
  city?: string;
  postalCode?: string;
}

interface Distributor {
  _id: string;
  userId: DistributorUser;
  firstName?: string;
  lastName?: string;
  distributorId?: string;
  isOfficeMember: boolean;
  isGarageAffiliate: boolean;
  garageAffiliateExpiresAt?: string;
  hasBat246Membership: boolean;
  membershipExpiresAt?: string;
  hasPurchasedProduct: boolean;
  isQualified: boolean;
  qualifiedAt?: string;
  createdAt?: string;
}

function fmtDate(s?: string | null, withTime = false) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function Avatar({ src, name, email, size = "lg" }: {
  src?: string | null; name?: string | null; email?: string | null; size?: "sm" | "md" | "lg" | "xl";
}) {
  const initial = ((name || email || "?").charAt(0)).toUpperCase();
  const cls =
    size === "xl" ? "w-16 h-16 rounded-2xl text-2xl ring-2 ring-white/10" :
    size === "lg" ? "w-12 h-12 rounded-xl text-lg ring-2 ring-white/10"   :
    size === "md" ? "w-9  h-9  rounded-xl text-sm ring-1 ring-white/10"   :
                   "w-7  h-7  rounded-lg  text-xs ring-1 ring-white/10";
  return src ? (
    <img src={src} alt={name || email || ""} className={`${cls} object-cover shrink-0`} />
  ) : (
    <div className={`${cls} flex items-center justify-center font-bold bg-white/8 text-white shrink-0`}>
      {initial}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0b0b12] rounded-xl border border-white/[0.08] overflow-hidden">
      <div className="px-5 py-3 border-b border-white/[0.06]">
        <h2 className="text-[10px] font-semibold text-white/35 uppercase tracking-[0.14em]">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.05] last:border-b-0">
      <span className="text-[12px] text-white/40">{label}</span>
      <span className="text-[12px] text-white/80 text-right">{value}</span>
    </div>
  );
}

function FlagRow({ label, ok, expires }: { label: string; ok: boolean; expires?: string | null }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.05] last:border-b-0">
      <span className="text-[13px] text-white/60">{label}</span>
      <div className="flex items-center gap-2.5">
        {expires && ok && (
          <span className="text-[10px] text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-md">
            expires {fmtDate(expires)}
          </span>
        )}
        {ok
          ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          : <XCircle      className="w-4 h-4 text-white/15 shrink-0" />
        }
      </div>
    </div>
  );
}

function getUplineChain(
  userId: string,
  membersMap: Map<string, CachedMember>,
  distributorSet: Set<string>,
): Array<{ data: PersonBlock | CachedMember; isDistributor: boolean; level: number }> {
  const chain: Array<{ data: PersonBlock | CachedMember; isDistributor: boolean; level: number }> = [];
  const visited = new Set<string>([userId]);
  let current   = membersMap.get(userId);

  for (let level = 1; level <= 2; level++) {
    if (!current?.upline) break;
    const uplineId = current.upline.userId;
    if (visited.has(uplineId)) break;
    visited.add(uplineId);
    const rich = membersMap.get(uplineId);
    chain.push({ data: rich ?? current.upline, isDistributor: distributorSet.has(uplineId), level });
    current = rich;
  }

  return chain;
}

export default function DistributorDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);

  const [distributor, setDistributor] = useState<Distributor | null | "not_found">(null);
  const [membersData, setMembersData] = useState<CachedMember[] | null>(null);
  const [allDistIds,  setAllDistIds]  = useState<Set<string>>(new Set());
  const [pageLoading, setPageLoading] = useState(true);

  const { userData, loading: authLoading } = useAmIFounder();
  const isAdmin = !authLoading && userData.email?.toLowerCase() === ALAN_K_EMAIL;
  const [hasDashboardAccess, setHasDashboardAccess] = useState(false);

  useEffect(() => {
    if (authLoading || isAdmin) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
    fetch(`${API}/bat246/my-dashboard-access`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setHasDashboardAccess(!!d.hasAccess))
      .catch(() => {});
  }, [authLoading, isAdmin]);

  useEffect(() => {
    const cached = getMembersCache();
    if (cached) { setMembersData(cached.members); return; }
    const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
    fetch(`${API}/office/bat246/members`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setMembersCache(d); setMembersData(d.members ?? []); })
      .catch(() => setMembersData([]));
  }, []);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
    fetch(`${API}/bat246/distributors?page=1&limit=50`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const list: any[] = d.distributors ?? [];
        setAllDistIds(new Set<string>(list.map((x: any) => String(x.userId?._id ?? x.userId))));
        const found = list.find((x: any) => String(x.userId?._id ?? x.userId) === userId);
        setDistributor(found ?? "not_found");
      })
      .catch(() => setDistributor("not_found"))
      .finally(() => setPageLoading(false));
  }, [userId]);

  const membersMap = useMemo(() => {
    const map = new Map<string, CachedMember>();
    (membersData ?? []).forEach(m => map.set(m.userId, m));
    return map;
  }, [membersData]);

  const member      = membersMap.get(userId) ?? null;
  const uplineChain = useMemo(() => getUplineChain(userId, membersMap, allDistIds), [userId, membersMap, allDistIds]);

  const dist         = distributor !== "not_found" ? distributor : null;
  const u            = dist?.userId;
  const displayName  = u?.name  || member?.name  || "Unknown";
  const displayEmail = u?.email || member?.email || "—";
  const displayPhone = u?.phone || member?.phone || null;
  const address      = member?.address ?? null;
  const loc = u
    ? [u.city, u.state, u.country].filter(Boolean).join(", ")
    : address
    ? [address.city, address.state, address.country].filter(Boolean).join(", ")
    : "";

  // ── Loading ───────────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="min-h-full bg-[#09090f] text-white p-6">
        <div className="max-w-5xl mx-auto animate-pulse space-y-4">
          <div className="h-4 w-40 bg-white/8 rounded" />
          <div className="h-32 bg-[#0b0b12] rounded-xl border border-white/8" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-52 bg-[#0b0b12] rounded-xl border border-white/8" />
            <div className="h-52 bg-[#0b0b12] rounded-xl border border-white/8" />
          </div>
          <div className="h-40 bg-[#0b0b12] rounded-xl border border-white/8" />
        </div>
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (distributor === "not_found") {
    return (
      <div className="min-h-full bg-[#09090f] text-white p-6">
        <div className="max-w-5xl mx-auto">
          <Link href="/games/bat246/distributors" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/15 text-white/80 hover:text-white hover:bg-white/[0.1] hover:border-white/25 text-sm font-semibold transition-colors group mb-6">
            <ChevronLeft className="w-4.5 h-4.5 group-hover:-translate-x-0.5 transition-transform" />
            Distributors
          </Link>
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-16 w-16 rounded-2xl bg-[#0b0b12] border border-white/8 flex items-center justify-center mb-4">
              <User className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-white/60 text-base">Distributor not found</p>
            <p className="text-white/25 text-sm mt-1">This user may not be a qualified BAT 246 distributor</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#09090f] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-4">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-white/30">
          <Link
            href={isAdmin ? "/games/bat246" : hasDashboardAccess ? "/games/bat246/dashboard" : "/games/bat246/boards"}
            className="hover:text-white/70 transition-colors"
          >
            {isAdmin ? "Admin Board" : hasDashboardAccess ? "Dashboard" : "Boards"}
          </Link>
          <span>/</span>
          <Link href="/games/bat246/distributors" className="hover:text-white/70 transition-colors">Distributors</Link>
          <span>/</span>
          <span className="text-white/60">{displayName}</span>
        </div>

        {/* ── Hero Profile Card ─────────────────────────────────────────────── */}
        <div className="bg-[#0b0b12] rounded-xl border border-white/[0.08] overflow-hidden">
          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

          <div className="p-5">
            <div className="flex items-start gap-4">
              <Avatar src={u?.profilePicture || member?.profilePicture} name={displayName} email={displayEmail} size="xl" />

              <div className="flex-1 min-w-0">
                {/* Name + badges */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h1 className="text-lg font-bold text-white leading-tight">{displayName}</h1>
                  {dist?.distributorId && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-[10px] font-semibold text-amber-400 tracking-wide shrink-0">
                      ID: {dist.distributorId}
                    </span>
                  )}
                  {dist?.isQualified && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/25 text-[10px] font-semibold text-green-400 uppercase tracking-wide shrink-0">
                      <Shield className="w-2.5 h-2.5" /> Qualified
                    </span>
                  )}
                  {member?.role && (
                    <span className="px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] text-white/45 uppercase tracking-wide shrink-0">
                      {member.role}
                    </span>
                  )}
                </div>

                {/* Contact details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                  <div className="flex items-center gap-2 text-[13px] text-white/50">
                    <Mail className="w-3.5 h-3.5 shrink-0 text-white/25" />
                    <span className="truncate">{displayEmail}</span>
                  </div>
                  {displayPhone && (
                    <div className="flex items-center gap-2 text-[13px] text-white/50">
                      <Phone className="w-3.5 h-3.5 shrink-0 text-white/25" />
                      <span>{displayPhone}</span>
                    </div>
                  )}
                  {(loc || address?.formatted) && (
                    <div className="flex items-center gap-2 text-[13px] text-white/40 sm:col-span-2">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-white/25" />
                      <span>{address?.formatted || loc}</span>
                      {address?.postalCode && <span className="text-white/25">· {address.postalCode}</span>}
                    </div>
                  )}
                  {member?.joinedAt && (
                    <div className="flex items-center gap-2 text-[12px] text-white/30">
                      <Calendar className="w-3 h-3 shrink-0 text-white/20" />
                      <span>Joined {fmtDate(member.joinedAt)}</span>
                    </div>
                  )}
                  {dist?.qualifiedAt && (
                    <div className="flex items-center gap-2 text-[12px] text-white/30">
                      <Award className="w-3 h-3 shrink-0 text-white/20" />
                      <span>Qualified {fmtDate(dist.qualifiedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick status pill */}
              <div className="shrink-0 hidden sm:flex flex-col items-end gap-2">
                {dist?.isQualified ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[11px] font-semibold text-green-400">Active Distributor</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                    <span className="text-[11px] text-white/30">Not Qualified</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Two-column grid ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Qualification Status */}
          {dist && (
            <SectionCard title="Qualification Status">
              {dist.distributorId && <InfoRow label="Distributor ID" value={dist.distributorId} />}
              <FlagRow label="Office Member"     ok={dist.isOfficeMember} />
              <FlagRow label="Garage Affiliate"  ok={dist.isGarageAffiliate}   expires={dist.garageAffiliateExpiresAt} />
              <FlagRow label="BAT 246 Membership" ok={dist.hasBat246Membership} expires={dist.membershipExpiresAt} />
              <FlagRow label="Product Purchased" ok={dist.hasPurchasedProduct} />
              <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[12px] text-white/40">Overall Status</span>
                {dist.isQualified ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Qualified Distributor
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-white/30">
                    <XCircle className="w-3.5 h-3.5" /> Not yet qualified
                  </span>
                )}
              </div>
            </SectionCard>
          )}

          {/* Office Membership */}
          {member && (
            <SectionCard title="Office Membership">
              <InfoRow label="Role"        value={member.role || "—"} />
              <InfoRow label="Member type" value={member.guest ? "Guest" : "Full member"} />
              <InfoRow label="Member since" value={fmtDate(member.joinedAt, true)} />
              {address?.city && <InfoRow label="City"    value={address.city} />}
              {address?.state && <InfoRow label="State"  value={address.state} />}
              {address?.country && <InfoRow label="Country" value={address.country} />}
            </SectionCard>
          )}
        </div>

        {/* ── Upline Chain ─────────────────────────────────────────────────── */}
        <SectionCard title="Upline Chain">
          {uplineChain.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Network className="w-8 h-8 text-white/10 mb-3" />
              <p className="text-[14px] text-white/25">No upline data available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {uplineChain.map((entry) => {
                const p       = entry.data;
                const entryLoc = p.address
                  ? [p.address.city, p.address.state, p.address.country].filter(Boolean).join(", ")
                  : "";

                return (
                  <div key={`lvl-${entry.level}`} className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                    {/* Level */}
                    <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
                      <div className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Lvl</div>
                      <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-[13px] font-black text-white/50">
                        {entry.level}
                      </div>
                    </div>

                    {/* Avatar */}
                    <Avatar src={p.profilePicture} name={p.name} email={p.email} size="md" />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[13px] font-semibold text-white">{p.name || "—"}</span>
                        {entry.isDistributor ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-[9px] font-bold text-green-400 uppercase tracking-wide shrink-0">
                            <Shield className="w-2 h-2" /> Distributor
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-[9px] text-white/25 uppercase tracking-wide shrink-0">
                            Not yet
                          </span>
                        )}
                      </div>
                      {p.email && <p className="text-[11px] text-white/35 truncate">{p.email}</p>}
                      {p.phone && <p className="text-[11px] text-white/25 mt-0.5">{p.phone}</p>}
                      {entryLoc && <p className="text-[10px] text-white/20 mt-0.5">{entryLoc}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-white/15 mt-4">
            Showing immediate 2-level upline chain · &quot;Nearby Upline&quot; in the distributors list shows the nearest qualified distributor ancestor
          </p>
        </SectionCard>

      </div>
    </div>
  );
}

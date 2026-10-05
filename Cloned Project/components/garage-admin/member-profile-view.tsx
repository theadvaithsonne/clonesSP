"use client";

// Shared member-profile view — ONE implementation rendered by three garage
// admin row→detail routes: One Time Affiliates, Users, and NetworkChain Subs.
// Each route mounts <MemberProfileView params={params} backLabel="…" />; the
// only per-list difference is the breadcrumb label. Everything else (Move
// Upline, Saved Cards, the tabs, columns, padding) is common, so teammate
// changes land in one place. Header (identity + upline + location) + tabs of
// what the member bought/joined: Offices, Communities, Live Streams, Courses,
// Digital Products, Purchases, Saved Cards. Data via
// lib/affiliate/downline-profile-api.

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Phone,
  Mail,
  Share2,
  Check,
  ChevronDown,
  ChevronLeft,
  ExternalLink,
  Truck,
  ShoppingBag,
  ChevronRight,
  Link2,
  Crown,
  Box,
  ArrowUpFromLine,
  CreditCard as SavedCardsIcon,
} from "lucide-react";
// Reuse the shared upline-reassignment drawer + type. Wiring is one
// state + one button + one dialog mount — the endpoint already exists.
import { MemberActivityChart } from "@/components/garage-admin/MemberActivityChart";
import {
  SpeakersDrawer,
  type SpeakersDrawerState,
} from "@/components/downline/speakers-drawer";
import {
  fetchMemberLiveStreams,
  fetchMemberLiveStreamSessions,
  type MemberLiveStreamRow,
} from "@/lib/affiliate/downline-livestreams-api";
import { MoveUplineDialog } from "@/components/admin/MoveUplineDialog";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";
import type { AdminUplineRef } from "@/lib/admin-api/users";
// Admin-only tab body (list + charge/refund dialogs). Only imported so
// the tab render can branch on activeTab.key === "saved_cards".
import { AdminSavedCardsPanel } from "@/components/admin/AdminSavedCardsPanel";
import {
  CommunityDetailDrawer,
  type CommunityDrawer,
} from "@/components/downline/community-detail-drawer";
import {
  SelectViewDrawer,
  type ViewOption,
} from "@/components/downline/select-view-drawer";
import {
  OfficesIcon,
  CommunitiesIcon,
  LiveStreamsIcon,
  CoursesIcon,
  DigitalProductsIcon,
  PurchasesIcon,
  DigitalModeIcon,
} from "@/components/downline/profile-icons";
import { DownlineQueryProvider } from "@/components/downline/downline-query-provider";

// Tab/dropdown icon component — the exact Figma glyphs (and a couple lucide
// fallbacks) all satisfy this.
type IconCmp = React.ComponentType<{ className?: string }>;
import { DataTable } from "@/components/data-table/DataTable";
import type { ColumnDef, SortState } from "@/components/data-table/types";
import {
  fetchMemberProfile,
  fetchMemberTab,
  type MemberOffice,
  type MemberPurchaseItem,
  type MemberPhysicalOrderItem,
  type MemberCommunityItem,
  type MemberTabCategory,
} from "@/lib/affiliate/downline-profile-api";
import { getCountryFlag } from "@/lib/country-flag";
import { COUNTRIES } from "@/lib/countries";

const GOLD = "#FFC200";

// Flag emoji for a phone number: match its leading "+<dial>" against the known
// dial codes (longest prefix wins, so +1268 beats +1). When the dial code is
// ambiguous (+1 → US/CA) or absent, fall back to the given country's flag.
function phoneFlag(phone?: string | null, fallbackCountry?: string | null): string {
  const raw = (phone || "").replace(/[^\d+]/g, "");
  if (raw.startsWith("+")) {
    let maxLen = 0;
    for (const c of COUNTRIES) {
      if (raw.startsWith(c.dial) && c.dial.length > maxLen) maxLen = c.dial.length;
    }
    if (maxLen > 0) {
      const matches = COUNTRIES.filter((c) => c.dial.length === maxLen && raw.startsWith(c.dial));
      if (matches.length === 1) return getCountryFlag(matches[0].code);
    }
  }
  return fallbackCountry ? getCountryFlag(fallbackCountry) : "";
}
const PAGE_SIZE = 20;
const RPP_OPTIONS = [10, 20, 50, 100];

// ── Tabs ─────────────────────────────────────────────────────────────────────
type TabKey =
  | "offices"
  | "communities"
  | "live_streams"
  | "courses"
  | "digital_products"
  | "physical_products"
  | "purchases"
  // Admin-only tab: renders the user's saved Stripe cards + management
  // actions (charge / refund / set-default / delete). Rendered via a
  // dedicated panel; skips the shared fetchMemberTab query below.
  | "saved_cards";

type Mode = "digital" | "physical";

type TabDef = { key: TabKey; label: string; category: MemberTabCategory; icon: IconCmp };

// Digital mode: offices/communities/live-streams/courses are inherently digital,
// so they only appear here; Purchases is the full invoice ledger.
//
// Physical mode: physical purchases exist ONLY in ProductOrder — they never
// appear in the invoice ledger (verified: 0 physical lines across all product
// invoices). So the invoice-based Purchases tab would be all-digital here and is
// dropped; the Physical Products tab IS the complete physical-purchase list.
const DIGITAL_TABS: TabDef[] = [
  { key: "offices", label: "Offices", category: "offices", icon: OfficesIcon },
  { key: "communities", label: "Communities", category: "communities", icon: CommunitiesIcon },
  { key: "live_streams", label: "Live Streams", category: "live_streams", icon: LiveStreamsIcon },
  { key: "courses", label: "Courses", category: "courses", icon: CoursesIcon },
  { key: "digital_products", label: "Digital Products", category: "digital_products", icon: DigitalProductsIcon },
  // Sits BEFORE Purchases per product ask. `category` here is a
  // placeholder — the shared tab query is short-circuited for this key
  // and the AdminSavedCardsPanel component takes over the tab body.
  { key: "saved_cards", label: "Saved Cards", category: "all", icon: SavedCardsIcon },
  { key: "purchases", label: "Purchases", category: "all", icon: PurchasesIcon },
];

const PHYSICAL_TABS: TabDef[] = [
  { key: "physical_products", label: "Physical Products", category: "physical_products", icon: Truck },
];

// "Select View" drawer option sets. Role: only Shopper is live for now
// (Affiliate/Founder are shown but disabled). Product type: Digital ⇄ Physical.
const ROLE_OPTIONS: ViewOption[] = [
  { id: "shopper", title: "As A Shopper", description: "Explore how {name} has used Garage as a shopper", icon: ShoppingBag },
  { id: "affiliate", title: "As An Affiliate", description: "Explore how {name} has used Garage as an affiliate", icon: Link2, disabled: true },
  { id: "founder", title: "As A Founder", description: "Explore how {name} has used Garage as a founder", icon: Crown, disabled: true },
];
const PRODUCT_TYPE_OPTIONS: ViewOption[] = [
  { id: "digital", title: "Digital", description: "Explore how {name} engages with digital products", icon: DigitalModeIcon },
  { id: "physical", title: "Physical", description: "Explore how {name} engages with physical products", icon: Box },
];

// ── Formatters ───────────────────────────────────────────────────────────────
function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
// Matches the main downline table's date format ("Aug 7th 2026").
/** Same calendar day? An instant cancel stamps both timestamps within the same
 *  request, so they differ by milliseconds rather than being equal. */
function isSameDay(a: string, b: string): boolean {
  const x = new Date(a);
  const y = new Date(b);
  if (Number.isNaN(x.getTime()) || Number.isNaN(y.getTime())) return false;
  return x.toDateString() === y.toDateString();
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return "—";
  const month = t.toLocaleString("en-US", { month: "short" });
  return `${month} ${ordinal(t.getDate())} ${t.getFullYear()}`;
}

function fmtMoney(cents: number, currency: string): string {
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format((cents || 0) / 100);
  } catch {
    return `${((cents || 0) / 100).toFixed(2)} ${code}`;
  }
}

// ProductOrder prices are stored in WHOLE currency units (₹299, $88) — NOT the
// cents the invoice tabs use — so this formatter must not divide by 100.
function fmtMoneyWhole(amount: number, currency: string): string {
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch {
    return `${(amount || 0).toFixed(2)} ${code}`;
  }
}

// "Mumbai, IN" — city + country only (never the street/phone: this is someone
// else's order viewed by their upline).
function shipTo(city: string | null, country: string | null): string {
  return [city, country].filter(Boolean).join(", ") || "—";
}

const TYPE_LABELS: Record<string, string> = {
  product: "Product",
  ecommerce_item: "Product",
  course: "Course",
  channel: "Community",
  workshop: "Live Stream",
  service: "Service",
  call: "Call",
  office_plan: "Office Plan",
  office_addon: "Office Add-on",
  unilevel_plus: "Unilevel Plus",
  third_party_subscription: "Subscription",
  bat246_membership: "Membership",
  franchise_program: "Franchise Program",
  franchise_territory: "Franchise Territory",
  franchise_global: "Franchise",
  store_wallet_topup: "Wallet Top-up",
  auction_wallet_topup: "Auction Top-up",
};
const humanType = (t?: string | null) =>
  t ? TYPE_LABELS[t] || t.replace(/_/g, " ") : "—";

function initials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function rangeLabel(page: number, limit: number, total: number): string {
  if (total === 0) return "0";
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return `${from} to ${to} of ${total}`;
}

// ── WhatsApp glyph (lucide has no brand icon) ───────────────────────────────
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export function MemberProfileView({
  params,
  backLabel,
}: {
  params: Promise<{ userId: string }>;
  /** Breadcrumb label for the list this profile was opened from
   *  (e.g. "One Time Affiliates", "Users", "NetworkChain Subs"). */
  backLabel: string;
}) {
  return (
    <DownlineQueryProvider>
      <MemberProfileViewInner params={params} backLabel={backLabel} />
    </DownlineQueryProvider>
  );
}

function MemberProfileViewInner({
  params,
  backLabel,
}: {
  params: Promise<{ userId: string }>;
  backLabel: string;
}) {
  const { userId } = use(params);
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("digital");
  const [tab, setTab] = useState<TabKey>("offices");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [sort, setSort] = useState<SortState | null>(null);
  const [copied, setCopied] = useState(false);
  const [commDrawer, setCommDrawer] = useState<CommunityDrawer | null>(null);
  const [viewDrawer, setViewDrawer] = useState<"role" | "producttype" | null>(null);
  const [moveUplineOpen, setMoveUplineOpen] = useState(false);
  // Moving a member's upline is an independently-grantable Users write
  // (page-manage or the move-upline action). Hidden for anyone without it.
  const { canDoAction } = useAdminAccess();
  const canMoveUpline = canDoAction("users", "move-upline");
  const communityCols = useMemo(
    () => communityColumns((kind, row) => setCommDrawer({ kind, row })),
    [],
  );

  const tabs = mode === "physical" ? PHYSICAL_TABS : DIGITAL_TABS;
  const activeTab = tabs.find((t) => t.key === tab) ?? tabs[0];

  const profileQ = useQuery({
    queryKey: ["member-profile", userId],
    queryFn: () => fetchMemberProfile(userId),
  });

  // One query drives every tab (Offices + the invoice tabs), server-sorted.
  // Saved-cards is admin-only and lives in its own panel component with
  // its own React Query fetches — disable this shared query for that key
  // so we don't fire an unrelated purchases request against the backend.
  const tabQ = useQuery({
    queryKey: [
      "member-tab",
      userId,
      activeTab.category,
      page,
      pageSize,
      sort?.by ?? null,
      sort?.order ?? null,
    ],
    queryFn: () =>
      fetchMemberTab<
        MemberOffice | MemberPurchaseItem | MemberPhysicalOrderItem | MemberCommunityItem
      >({
        userId,
        category: activeTab.category,
        page,
        limit: pageSize,
        sortBy: sort?.by,
        sortOrder: sort?.order,
      }),
    placeholderData: keepPreviousData,
    enabled: activeTab.key !== "saved_cards",
  });

  // Live Streams has its own endpoint and row shape (registrations, not
  // invoice lines), so it doesn't ride `tabQ`.
  const liveStreamsQ = useQuery({
    queryKey: ["admin-member-live-streams", userId],
    queryFn: () => fetchMemberLiveStreams(userId),
    enabled: activeTab.key === "live_streams",
  });

  /** Which recurring stream's sessions are open, if any. */
  const [sessionOf, setSessionOf] = useState<{
    workshopId: string;
    title: string;
  } | null>(null);

  const sessionsQ = useQuery({
    queryKey: ["admin-member-stream-sessions", userId, sessionOf?.workshopId],
    queryFn: () => fetchMemberLiveStreamSessions(userId, sessionOf!.workshopId),
    enabled: activeTab.key === "live_streams" && !!sessionOf,
  });

  // An admin earns no commission from this member, so the two "You Earned"
  // columns are omitted rather than drawn as $0.00 on every row.
  const [speakersOf, setSpeakersOf] = useState<SpeakersDrawerState | null>(null);

  const streamCols = useMemo(
    () =>
      liveStreamColumns({
        variant: "streams",
        showViewerEarnings: false,
        onViewSpeakers: setSpeakersOf,
        onSessions: (r) =>
          setSessionOf({ workshopId: r.workshopId, title: r.name }),
      }),
    [],
  );
  const sessionCols = useMemo(
    () =>
      liveStreamColumns({
        variant: "sessions",
        showViewerEarnings: false,
        onViewSpeakers: setSpeakersOf,
      }),
    [],
  );
  const streamMergeTail = useMemo(
    () =>
      liveStreamMergeTail((r) =>
        setSessionOf({ workshopId: r.workshopId, title: r.name }),
      ),
    [],
  );

  /** Drilled into one stream's sessions — the breadcrumb takes over the tab
   *  row and the table swaps to session columns. */
  const inSessionView = activeTab.key === "live_streams" && !!sessionOf;

  const p = profileQ.data;
  const total = tabQ.data?.total ?? 0;

  // Offices columns are member-scoped: the founder's phone flag falls back to
  // the member's country when the number carries no dial code.
  const officeCols = useMemo(
    () => officeColumns(p?.location.country ?? null),
    [p?.location.country],
  );

  const selectTab = (k: TabKey) => {
    // Leaving Live Streams closes any open session drill-down, so coming back
    // lands on the stream list rather than a stale sub-view.
    setSessionOf(null);
    setTab(k);
    setPage(1);
    setSort(null); // a column id may not exist in the next tab
  };

  // Digital ⇄ Physical. The tab sets differ, so jump to each mode's first tab
  // and reset paging/sort (the other mode's column ids don't carry over).
  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    setTab(m === "physical" ? "physical_products" : "offices");
    setPage(1);
    setSort(null);
  };

  const onSortChange = (s: SortState) => {
    setSort(s);
    setPage(1);
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const phoneDigits = (p?.phone || "").replace(/[^\d+]/g, "");

  return (
    <div className="flex flex-col text-white">
      {/* Breadcrumb bar — full-bleed: flush under the header + against the sidebar */}
      <div className="-mx-8 -mt-7 flex items-center justify-between gap-4 border-b border-white/[0.06] bg-[#181818] px-4 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex w-fit items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
          <span className="text-zinc-600">/</span>
          <span className="text-white">{p?.name || "Member"}</span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {/* Move Upline — reassigns this member under a different upline.
              Reuses the shared MoveUplineDialog + backing
              /garage-admin/users/:id/move-upline endpoint. Shown only to admins
              granted the move-upline write; the dialog handles the "no current
              upline (root user)" case inline. */}
          {canMoveUpline && (
            <ActionButton
              onClick={() => setMoveUplineOpen(true)}
              label="Move Upline"
            >
              <ArrowUpFromLine className="h-4 w-4" />
              <span className="hidden sm:inline">Move Upline</span>
            </ActionButton>
          )}
          <ActionButton
            as="a"
            href={phoneDigits ? `https://wa.me/${phoneDigits.replace(/\D/g, "")}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            label="WhatsApp"
            disabled={!phoneDigits}
          >
            <WhatsAppIcon className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </ActionButton>
          <ActionButton onClick={share} label="Share">
            {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          </ActionButton>
          <ActionButton
            as="a"
            href={p?.email ? `mailto:${p.email}` : undefined}
            label="Email"
            disabled={!p?.email}
          >
            <Mail className="h-4 w-4" />
          </ActionButton>
          <ActionButton
            as="a"
            href={phoneDigits ? `tel:${phoneDigits}` : undefined}
            label="Call"
            disabled={!phoneDigits}
          >
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">Call</span>
          </ActionButton>
        </div>
      </div>

      <div className="flex-none space-y-4 px-4 pt-6 pb-6 lg:px-6">
      {/* Header card */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 lg:p-6">
        {/* items-center, not items-start: the chart is taller than the identity
            grid, and top-aligning left the identity block with a large gap
            below it and none above. Centring gives equal space top and bottom
            whichever side is taller. */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
              {p?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatar} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-zinc-300">
                  {p ? initials(p.name) : ""}
                </div>
              )}
            </div>

            {/* Identity — 3 columns matching the design */}
            <div className="grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Name" value={p?.name} loading={profileQ.isLoading} />
              <Field
                label="Upline Name"
                value={p?.referrer?.name}
                loading={profileQ.isLoading}
                avatar={p?.referrer ? { src: p.referrer.avatar, name: p.referrer.name } : undefined}
              />
              <Field label="City" value={p?.location.city} loading={profileQ.isLoading} />

              <Field
                label="Phone Number"
                value={p?.phone}
                loading={profileQ.isLoading}
                flag={phoneFlag(p?.phone, p?.location.country)}
              />
              <Field
                label="Upline Phone Number"
                value={p?.referrer?.phone}
                loading={profileQ.isLoading}
                flag={p?.referrer ? phoneFlag(p.referrer.phone, p.referrer.country) : ""}
              />
              <Field label="State/Province" value={p?.location.state} loading={profileQ.isLoading} />

              <Field label="Email" value={p?.email} loading={profileQ.isLoading} />
              <Field label="Upline Email" value={p?.referrer?.email} loading={profileQ.isLoading} />
              <Field
                label="Country"
                value={p?.location.country}
                loading={profileQ.isLoading}
                flag={p?.location.country ? getCountryFlag(p.location.country) : ""}
              />
            </div>
          </div>

          {/* Monthly activity — spend / earnings from this member. Global to
              the member, so the tabs and the shopper/digital dropdowns below
              do NOT filter it. */}
          <MemberActivityChart
            userId={userId}
            memberName={p?.name}
            className="hidden shrink-0 lg:flex lg:w-[420px]"
            // An admin has no commission from this member, so the backend
            // returns zero earnings — show purchase volume only.
            showEarnings={false}
          />
        </div>
      </div>

      {/* Tabs + controls. Drilled into a stream's sessions the breadcrumb
          REPLACES the tab strip on this row, rather than stacking a second bar
          above the table — the tabs aren't reachable from in there anyway, and
          the role/mode pills stay put on the right. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {inSessionView ? (
          <div className="flex min-w-0 items-center gap-2 text-[14px]">
            <button
              type="button"
              onClick={() => setSessionOf(null)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/[0.1] text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
              aria-label="Back to live streams"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setSessionOf(null)}
              className="shrink-0 text-zinc-400 transition hover:text-zinc-200"
            >
              Live Streams
            </button>
            <span className="shrink-0 text-zinc-600">→</span>
            <span className="truncate font-semibold text-white">
              {sessionsQ.data?.workshopTitle || sessionOf?.title}
            </span>
          </div>
        ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => selectTab(t.key)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
                tab === t.key
                  ? "bg-white/[0.08] text-white"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              }`}
              style={tab === t.key ? { boxShadow: `inset 0 0 0 1px ${GOLD}55` } : undefined}
            >
              <t.icon
                className={`h-[15px] w-auto ${tab === t.key ? "text-[#FFC200]" : "text-zinc-500"}`}
              />
              {t.label}
            </button>
          ))}
        </div>
        )}

        {/* As A Shopper is the only role for now; Digital ⇄ Physical toggles
            the whole page — Physical shows only Physical Products + Purchases. */}
        <div className="flex items-center gap-2">
          <SwitcherPill icon={ShoppingBag} label="As A Shopper" onClick={() => setViewDrawer("role")} />
          <SwitcherPill
            icon={mode === "physical" ? Truck : DigitalModeIcon}
            label={mode === "physical" ? "Physical" : "Digital"}
            onClick={() => setViewDrawer("producttype")}
          />
        </div>
      </div>
      </div>

      {/* Table for the active tab — full-bleed and fills the remaining height,
          matching the main downline table's layout. */}
      <div className="flex flex-col border-t border-white/[0.06] px-4 pb-6 lg:px-6">
        {(() => {
          // Distinct key → the table remounts per tab so its persisted
          // column-order state can't bleed between tabs (they share this
          // element position). v3 tableId abandons any layout the earlier
          // shared-instance bug corrupted.
          const commonPagination = {
            page,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
            rangeLabel: rangeLabel(page, pageSize, total),
            recordsPerPage: pageSize,
            recordsPerPageOptions: RPP_OPTIONS,
            onPrev: () => setPage((n) => Math.max(1, n - 1)),
            onNext: () => setPage((n) => n + 1),
            onRecordsPerPageChange: (n: number) => {
              setPageSize(n);
              setPage(1);
            },
          };
          if (tab === "saved_cards") {
            // Bespoke admin tab body — the list + management actions
            // render inside this component. Bypasses the shared
            // DataTable/pagination stack because saved-card management
            // isn't a paginated table.
            return <AdminSavedCardsPanel userId={userId} />;
          }
          if (tab === "offices") {
            return (
              <DataTable<MemberOffice>
                key="member-offices-v3"
                tableId="member-offices-v3"
                stickyBg="#181818"
                autoHeight
                columns={officeCols}
                rows={(tabQ.data?.items ?? []) as MemberOffice[]}
                getRowId={(r) => r.orgId}
                loading={tabQ.isLoading}
                emptyLabel="No offices yet."
                sort={sort}
                onSortChange={onSortChange}
                pagination={commonPagination}
              />
            );
          }
          if (tab === "communities") {
            return (
              <DataTable<MemberCommunityItem>
                key="member-communities-v3"
                tableId="member-communities-v3"
                stickyBg="#181818"
                autoHeight
                columns={communityCols}
                rows={(tabQ.data?.items ?? []) as MemberCommunityItem[]}
                getRowId={(r) => r.channelId}
                loading={tabQ.isLoading}
                emptyLabel="No communities yet."
                sort={sort}
                onSortChange={onSortChange}
                pagination={commonPagination}
              />
            );
          }
          if (tab === "live_streams") {
            const inSessions = !!sessionOf;
            return (
              <DataTable<MemberLiveStreamRow>
                key={inSessions ? "admin-stream-sessions-v1" : "admin-live-streams-v1"}
                tableId={inSessions ? "admin-stream-sessions-v1" : "admin-live-streams-v1"}
                stickyBg="#181818"
                columns={inSessions ? sessionCols : streamCols}
                rows={sortLiveStreamRows(
                  inSessions
                    ? sessionsQ.data?.rows ?? []
                    : liveStreamsQ.data?.rows ?? [],
                  sort,
                )}
                getRowId={(r) => r.id}
                // Only the stream list merges; a session row is one
                // occurrence and shows every column.
                mergeTail={inSessions ? undefined : streamMergeTail}
                loading={inSessions ? sessionsQ.isLoading : liveStreamsQ.isLoading}
                emptyLabel={
                  inSessions
                    ? "This live stream has no sessions yet."
                    : "No live streams yet."
                }
                sort={sort}
                onSortChange={onSortChange}
              />
            );
          }
          if (tab === "physical_products") {
            return (
              <DataTable<MemberPhysicalOrderItem>
                key="member-physical-v3"
                tableId="member-physical-v3"
                stickyBg="#181818"
                autoHeight
                columns={PHYSICAL_COLUMNS}
                rows={(tabQ.data?.items ?? []) as MemberPhysicalOrderItem[]}
                getRowId={(r) => `${r.orderId}:${r.productId ?? r.name}`}
                loading={tabQ.isLoading}
                emptyLabel="No physical orders yet."
                sort={sort}
                onSortChange={onSortChange}
                pagination={commonPagination}
              />
            );
          }
          return (
            <DataTable<MemberPurchaseItem>
              key={`member-${tab}-v3`}
              tableId={`member-${tab}-v3`}
              stickyBg="#181818"
              autoHeight
              columns={PURCHASE_COLUMNS[tab as Exclude<TabKey, "offices" | "physical_products" | "communities" | "saved_cards">]}
              rows={(tabQ.data?.items ?? []) as MemberPurchaseItem[]}
              getRowId={(r) => `${r.invoiceId}:${r.itemId ?? r.name}`}
              loading={tabQ.isLoading}
              emptyLabel="Nothing here yet."
              sort={sort}
              onSortChange={onSortChange}
              pagination={commonPagination}
            />
          );
        })()}
      </div>

      <CommunityDetailDrawer drawer={commDrawer} onClose={() => setCommDrawer(null)} />

      <SpeakersDrawer drawer={speakersOf} onClose={() => setSpeakersOf(null)} />

      <SelectViewDrawer
        open={viewDrawer === "role"}
        options={ROLE_OPTIONS}
        selectedId="shopper"
        memberName={p?.name}
        onSelect={() => {
          /* only "shopper" is live; Affiliate/Founder are disabled */
        }}
        onClose={() => setViewDrawer(null)}
      />
      <SelectViewDrawer
        open={viewDrawer === "producttype"}
        options={PRODUCT_TYPE_OPTIONS}
        selectedId={mode}
        memberName={p?.name}
        onSelect={(id) => switchMode(id as Mode)}
        onClose={() => setViewDrawer(null)}
      />

      {/* Move Upline dialog — reused as-is. Reshapes p.referrer
          ({id, name, avatar, email, phone}) into AdminUplineRef
          ({id, name, email, profilePicture, affiliateId}). directReferrals
          isn't on MemberProfile; passing 0 hides the "N direct downline
          members move with them" warning (a purely cosmetic detail). On
          success we refetch the profile so the Upline Name / Phone /
          Email fields update in place. */}
      <MoveUplineDialog
        memberId={userId}
        memberName={p?.name}
        memberEmail={p?.email}
        currentUpline={
          p?.referrer
            ? ({
                id: p.referrer.id,
                name: p.referrer.name,
                email: p.referrer.email,
                profilePicture: p.referrer.avatar || null,
                affiliateId: null,
              } as AdminUplineRef)
            : null
        }
        directReferrals={0}
        open={moveUplineOpen}
        onOpenChange={setMoveUplineOpen}
        onDone={() => {
          profileQ.refetch();
        }}
      />
    </div>
  );
}

// ── Header field ─────────────────────────────────────────────────────────────
function Field({
  label,
  value,
  loading,
  flag,
  avatar,
}: {
  label: string;
  value?: string | null;
  loading?: boolean;
  /** Leading country-flag emoji (phone / country fields). */
  flag?: string;
  /** Leading round avatar (e.g. the upline's profile picture). */
  avatar?: { src?: string | null; name?: string | null };
}) {
  const showAvatar = !!(avatar && (avatar.src || avatar.name));
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      {loading ? (
        <div className="mt-1 h-4 w-24 animate-pulse rounded bg-white/[0.06]" />
      ) : (
        <div className="mt-0.5 flex items-center gap-1.5 text-sm text-white">
          {showAvatar && (
            <span className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full bg-white/[0.06] text-[9px] font-semibold text-zinc-200">
              {avatar!.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar!.src} alt="" className="h-full w-full object-cover" />
              ) : (
                initials(avatar!.name || "")
              )}
            </span>
          )}
          {flag ? <span className="shrink-0 text-base leading-none">{flag}</span> : null}
          <span className="truncate">{value || "—"}</span>
        </div>
      )}
    </div>
  );
}

// ── Action button (renders as <a> or <button>) ───────────────────────────────
function ActionButton({
  as = "button",
  href,
  target,
  rel,
  onClick,
  label,
  disabled,
  children,
}: {
  as?: "a" | "button";
  href?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const cls =
    "flex h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 text-[13px] font-medium text-zinc-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40";
  if (as === "a") {
    if (disabled || !href) {
      return (
        <span className={cls} aria-disabled title={label}>
          {children}
        </span>
      );
    }
    return (
      <a href={href} target={target} rel={rel} className={cls} title={label}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls} title={label}>
      {children}
    </button>
  );
}

// ── Single-option selector (visual only, one item for now) ───────────────────
// Switcher pill — opens the "Select View" drawer (role / product type).
function SwitcherPill({
  icon: Icon,
  label,
  onClick,
}: {
  icon: IconCmp;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 text-[13px] text-zinc-300 transition hover:bg-white/[0.06]"
    >
      <Icon className="h-[15px] w-auto text-zinc-400" />
      {label}
      <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
    </button>
  );
}

// ── Reusable cells ───────────────────────────────────────────────────────────
function itemCell(name: string, image: string | null, subtitle?: string | null) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`grid h-[34px] w-[34px] shrink-0 place-items-center overflow-hidden rounded-full text-[12px] font-semibold text-black ${
          image ? "" : "bg-gradient-to-br from-[#FFC200] to-[#FFA800]"
        }`}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(name)
        )}
      </span>
      <div className="min-w-0 space-y-0.5">
        <div className="truncate font-semibold text-white">{name || "—"}</div>
        {subtitle && <div className="truncate text-[12px] text-zinc-400">{subtitle}</div>}
      </div>
    </div>
  );
}

function progressCell(pct?: number | null) {
  if (pct == null) return <span className="text-zinc-500">—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: GOLD }}
        />
      </div>
      <span className="tabular-nums text-xs text-zinc-300">{Math.round(pct)}%</span>
    </div>
  );
}

// Fulfillment status badge for physical orders.
const STATUS_STYLE: Record<string, string> = {
  delivered: "bg-emerald-500/[0.12] text-emerald-300",
  shipped: "bg-sky-500/[0.12] text-sky-300",
  processing: "bg-amber-500/[0.12] text-amber-300",
  confirmed: "bg-white/[0.06] text-zinc-300",
  pending: "bg-white/[0.06] text-zinc-400",
  cancelled: "bg-rose-500/[0.12] text-rose-300",
  refunded: "bg-rose-500/[0.12] text-rose-300",
};
function statusBadge(status: string) {
  const s = (status || "pending").toLowerCase();
  const cls = STATUS_STYLE[s] || "bg-white/[0.06] text-zinc-400";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${cls}`}>
      {s}
    </span>
  );
}

function trackingCell(url: string | null, num: string | null) {
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-[#FFC200] hover:underline"
      >
        Track
      </a>
    );
  }
  if (num) return <span className="truncate text-zinc-400">{num}</span>;
  return <span className="text-zinc-500">—</span>;
}

// ── Column definitions ───────────────────────────────────────────────────────
/** "45 Days Ago" relative label. */
function relativeDays(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 0) return "";
  if (days === 0) return "Today";
  return `${days} Day${days !== 1 ? "s" : ""} Ago`;
}

/** Date + time + relative, stacked (matches the "Joined On" design). */
function joinedCell(iso?: string | null) {
  if (!iso) return <span className="text-zinc-500">—</span>;
  const d = new Date(iso);
  const time = Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return (
    <div className="space-y-0.5">
      <div className="text-zinc-300">{fmtDate(iso)}</div>
      {time && <div className="text-[12px] text-zinc-500">{time}</div>}
      <div className="text-[12px] text-zinc-500">{relativeDays(iso)}</div>
    </div>
  );
}

/** Founder avatar + name + email + phone. */
function founderCell(
  f?: { name: string; email: string; phone: string; avatar: string } | null,
  fallbackCountry?: string | null,
) {
  if (!f || !f.name) return <span className="text-zinc-500">—</span>;
  const flag = f.phone ? phoneFlag(f.phone, fallbackCountry) : "";
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white/[0.06] text-[11px] font-semibold text-zinc-200">
        {f.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(f.name)
        )}
      </span>
      <div className="min-w-0 space-y-0.5">
        <div className="truncate font-semibold text-white">{f.name}</div>
        {f.email && <div className="truncate text-[12px] text-zinc-400">{f.email}</div>}
        {f.phone && (
          <div className="flex items-center gap-1 truncate text-[12px] text-zinc-500">
            {flag ? <span className="shrink-0 text-[13px] leading-none">{flag}</span> : null}
            <span className="truncate">{f.phone}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** "Affiliate" link pill, or a dash when the member has no link for the item. */
function affiliateCell(url?: string | null) {
  if (!url) return <span className="text-zinc-500">—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-zinc-200 transition hover:bg-white/[0.06]"
    >
      <ExternalLink className="h-3 w-3" /> Affiliate
    </a>
  );
}

// Offices — the "As A Shopper" standard columns. Rating/Review are intentionally
// absent: there's no office-review feature (confirmed in both backends). Only
// office + joined are server-sortable; the enriched aggregate columns aren't.
// `fallbackCountry` (the member's country) is the flag source for a founder
// whose phone carries no dial code.
function officeColumns(fallbackCountry: string | null): ColumnDef<MemberOffice>[] {
  return [
  { id: "office", header: "Office", frozen: true, sortable: true, width: 220, cell: (r) => itemCell(r.name, r.icon || null) },
  { id: "founder", header: "Founder", width: 250, cell: (r) => founderCell(r.founder, fallbackCountry) },
  { id: "joined", header: "Joined On", sortable: true, width: 150, cell: (r) => joinedCell(r.joinedAt) },
  { id: "consumed", header: "Consumed Offerings", align: "right", sortable: true, width: 120, cell: (r) => <span className="tabular-nums text-zinc-300">{r.consumedOfferings ?? 0}</span> },
  { id: "free", header: "Free Offerings", align: "right", sortable: true, width: 110, cell: (r) => <span className="tabular-nums text-zinc-300">{r.freeOfferings ?? 0}</span> },
  { id: "paid", header: "Paid Offerings", align: "right", sortable: true, width: 110, cell: (r) => <span className="tabular-nums text-zinc-300">{r.paidOfferings ?? 0}</span> },
  { id: "spent", header: "Total Spent", align: "right", sortable: true, width: 120, cell: (r) => <span className="tabular-nums text-zinc-200">{fmtMoney(r.totalSpent ?? 0, r.spentCurrency || "USD")}</span> },
  { id: "earned", header: "You Earned", align: "right", sortable: true, width: 120, cell: (r) => <span className="tabular-nums text-zinc-200">{fmtMoney(r.youEarned ?? 0, r.earnedCurrency || "USD")}</span> },
  { id: "rating", header: "Rating", align: "right", sortable: true, width: 90, cell: (r) => communityRatingCell(r.rating ?? null) },
  { id: "review", header: "Review", width: 260, cell: (r) => reviewCell(r.review) },
  { id: "links", header: "Links", width: 140, cell: (r) => affiliateCell(r.affiliateUrl) },
  ];
}

const moneyCol: ColumnDef<MemberPurchaseItem> = {
  id: "amount",
  header: "Amount",
  align: "right",
  sortable: true,
  width: 130,
  cell: (r) => (
    <span className="tabular-nums text-zinc-200">{fmtMoney(r.totalPrice, r.currency)}</span>
  ),
};

// ── Communities cells ────────────────────────────────────────────────────────
function periodShort(p: string | null): string {
  if (!p) return "";
  const s = p.toLowerCase();
  if (s.startsWith("month")) return "Month";
  if (s.startsWith("year") || s.startsWith("annual")) return "Year";
  if (s.startsWith("week")) return "Week";
  if (s.startsWith("day") || s.startsWith("dai")) return "Day";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function expanderBtn(onClick: () => void) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Details"
      className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-white/[0.1] text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
    >
      <ChevronRight className="h-3.5 w-3.5" />
    </button>
  );
}

function priceCell(r: MemberCommunityItem, onOpen: () => void) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        {r.isFree ? (
          <span className="text-zinc-300">Free</span>
        ) : (
          <>
            <div className="text-zinc-200">{fmtMoneyWhole(r.price, r.currency)}</div>
            {r.subscriptionPeriod && (
              <div className="text-[12px] text-zinc-500">/{periodShort(r.subscriptionPeriod)}</div>
            )}
          </>
        )}
      </div>
      {expanderBtn(onOpen)}
    </div>
  );
}

function compCell(r: MemberCommunityItem, onOpen: () => void) {
  const levels = r.compLevels ?? [];
  const has = levels.length > 0;
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        {has ? (
          <>
            <div className="text-zinc-200">{levels[0].percentage}%</div>
            <div className="text-[12px] text-zinc-500">
              {levels.length} Level{levels.length !== 1 ? "s" : ""}
            </div>
          </>
        ) : (
          <span className="text-zinc-500">NA</span>
        )}
      </div>
      {has && expanderBtn(onOpen)}
    </div>
  );
}

function communityStatusCell(r: MemberCommunityItem) {
  // `endReason` comes from the membership event log and is the ONLY way to
  // tell the two exits apart: a member who cancelled and one whose payment
  // failed both end up on subscriptionStatus "expired". "expired" as an event
  // is the sweeper closing out an earlier cancel, so it reads as voluntary.
  const label =
    r.status === "active"
      ? "Active"
      : r.endReason === "unsubscribed" || r.endReason === "expired"
        ? "Unsubscribed"
        : r.endReason === "payment_defaulted"
          ? "Payment Failed"
          : r.subscriptionStatus === "cancelled"
            ? "Unsubscribed"
            : r.status || "Inactive";
  const cls =
    label === "Active"
      ? "bg-emerald-500/[0.12] text-emerald-300"
      : label === "Unsubscribed"
        ? "bg-rose-500/[0.12] text-rose-300"
        : label === "Payment Failed"
          ? "bg-amber-500/[0.12] text-amber-300"
          : "bg-white/[0.06] text-zinc-400";
  return (
    <div className="space-y-1">
      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${cls}`}>
        {label}
      </span>
      {/* A cancelled membership carries TWO dates: when the user hit cancel,
          and how long their access actually ran. On a recurring paid channel
          those differ. On a free / one-time leave, or a payment default,
          access ends in the same instant, so the second line would just
          repeat the first and is dropped. */}
      {r.cancelledAt ? (
        <>
          <div className="text-[11px] text-zinc-500" title="Unsubscribe requested">
            {fmtDate(r.cancelledAt)}
          </div>
          {r.activeUntil && !isSameDay(r.cancelledAt, r.activeUntil) && (
            <div className="text-[11px] text-zinc-500" title="Active until">
              {fmtDate(r.activeUntil)}
            </div>
          )}
        </>
      ) : (
        // Still subscribed — this is the upcoming charge, not an end date.
        r.nextPaymentDate && (
          <div className="text-[11px] text-zinc-500">Next {fmtDate(r.nextPaymentDate)}</div>
        )
      )}
    </div>
  );
}

function likedCell(r: MemberCommunityItem) {
  return (
    <div className="space-y-0.5 text-[12px] text-zinc-400">
      <div>{r.likedPosts} Post{r.likedPosts !== 1 ? "s" : ""}</div>
      <div>{r.likedComments} Comment{r.likedComments !== 1 ? "s" : ""}</div>
    </div>
  );
}

function communityRatingCell(rating: number | null) {
  if (rating == null) return <span className="text-zinc-500">—</span>;
  return <span className="tabular-nums text-zinc-200">{rating}/5</span>;
}

// The member's written review text (truncated; full text on hover), or a dash.
function reviewCell(text?: string | null) {
  if (!text) return <span className="text-zinc-500">—</span>;
  return (
    // Wraps onto following lines rather than truncating to one. The row grows
    // to fit: DataTable sets no fixed row height and top-aligns cells. Clamped
    // at 3 lines so one long review can't stretch the whole row; `title` still
    // carries the full text in that case.
    <span
      className="block max-w-[240px] line-clamp-3 break-words leading-snug text-zinc-300"
      title={text}
    >
      {text}
    </span>
  );
}

// Communities — the rich standard columns. Price + Comp Plan open a right-side
// detail drawer via `onOpen`. (Built as a function so the cells can close over
// the drawer opener.) Rating is the member's own 1-5 review.
function communityColumns(
  onOpen: (kind: "price" | "comp", row: MemberCommunityItem) => void,
): ColumnDef<MemberCommunityItem>[] {
  return [
    { id: "name", header: "Name", frozen: true, sortable: true, width: 200, cell: (r) => itemCell(r.name, r.icon) },
    { id: "office", header: "Office", sortable: true, width: 180, cell: (r) => itemCell(r.office, r.officeIcon) },
    { id: "joined", header: "Joined", sortable: true, width: 150, cell: (r) => joinedCell(r.joinedAt) },
    { id: "price", header: "Price", sortable: true, width: 140, cell: (r) => priceCell(r, () => onOpen("price", r)) },
    { id: "comp", header: "Commissions", sortable: true, width: 150, cell: (r) => compCell(r, () => onOpen("comp", r)) },
    { id: "spent", header: "Total Spent", align: "right", sortable: true, width: 120, cell: (r) => <span className="tabular-nums text-zinc-200">{fmtMoney(r.totalSpent, r.spentCurrency)}</span> },
    { id: "earned", header: "You Earned", align: "right", sortable: true, width: 120, cell: (r) => <span className="tabular-nums text-zinc-200">{fmtMoney(r.youEarned, r.earnedCurrency)}</span> },
    { id: "status", header: "Status", sortable: true, width: 160, cell: (r) => communityStatusCell(r) },
    { id: "posts", header: "Posts", align: "right", sortable: true, width: 90, cell: (r) => <span className="tabular-nums text-zinc-300">{r.posts}</span> },
    { id: "comments", header: "Comments", align: "right", sortable: true, width: 100, cell: (r) => <span className="tabular-nums text-zinc-300">{r.comments}</span> },
    { id: "liked", header: "Liked", sortable: true, width: 120, cell: (r) => likedCell(r) },
    { id: "links", header: "Links", width: 140, cell: (r) => affiliateCell(r.affiliateUrl) },
    { id: "rating", header: "Rating", align: "right", sortable: true, width: 90, cell: (r) => communityRatingCell(r.rating) },
  ];
}

// Physical Products (ProductOrder-backed). Prices are whole units → fmtMoneyWhole.
// Fulfillment status + tracking + ship-to are the columns physical adds over
// digital; qty replaces the digital tab's category.
/* ── Live Streams ────────────────────────────────────────────────────────
 * Its own row shape and endpoint — rows are the streams the member
 * REGISTERED for, so free streams appear too (the invoice-line tabs miss
 * most of them). `variant` swaps the leading column: the tab lists streams,
 * the drill-down lists the sessions of one stream.
 */
function statusPill(status: MemberLiveStreamRow["status"]) {
  const meta = {
    active: { label: "Active", cls: "bg-[rgba(114,114,114,0.32)] text-white" },
    completed: { label: "Completed", cls: "bg-emerald-500/[0.12] text-emerald-300" },
    deleted: { label: "Deleted", cls: "bg-rose-500/[0.12] text-rose-300" },
    // The only outlined pill — it reads as an empty slot rather than a state
    // something has reached.
    not_started: { label: "Yet To Start", cls: "border border-white/[0.18] text-white/45" },
  }[status];
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

// Host first, then co-hosts. Rendered like Created By — two distinct accounts
// can share a name here, so the email is what tells them apart.
// The host, plus a way into the rest. A stream can have several co-hosts and
// the cell has room for one, so the others live behind the panel rather than
// stretching every row to fit them.
function speakersCell(
  r: MemberLiveStreamRow,
  onViewAll: ((d: SpeakersDrawerState) => void) | undefined,
) {
  const speakers = r.speakers;
  if (!speakers.length) return <span className="text-zinc-500">—</span>;
  const [first, ...rest] = speakers;
  return (
    <div className="space-y-1.5">
      {founderCell(
        {
          name: first.name,
          email: first.email,
          phone: first.phone || "",
          avatar: first.avatar || "",
        },
        first.country,
      )}
      {rest.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewAll?.({ streamName: r.name, speakers });
          }}
          className="inline-flex items-center gap-0.5 text-[12px] font-medium text-zinc-400 transition hover:text-zinc-200"
        >
          View all speakers
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** The drill-down button. On a recurring stream it fills the whole merged
 *  tail — Date & Time through Review — because none of those columns has a
 *  single value for a series. */
function sessionLevelButton(
  r: MemberLiveStreamRow,
  onSessions: ((r: MemberLiveStreamRow) => void) | undefined,
) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSessions?.(r);
      }}
      className="whitespace-nowrap rounded-full border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-zinc-300 transition hover:bg-white/[0.07] hover:text-white"
    >
      See Session Level Data
    </button>
  );
}

/** Date, time and timezone stacked — or, on a recurring ONE-TIME enrolment,
 *  the drill-down button. That row keeps every other column, but a series has
 *  no single date, so this one cell offers the sessions instead. Per-session
 *  rows never reach here: their whole tail is merged. */
function dateTimeCell(
  r: MemberLiveStreamRow,
  onSessions: ((r: MemberLiveStreamRow) => void) | undefined,
) {
  if (!r.dateTime) {
    return r.frequency === "recurring" ? (
      sessionLevelButton(r, onSessions)
    ) : (
      <span className="text-zinc-600" />
    );
  }
  const d = new Date(r.dateTime.date);
  const day = Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  return (
    <div className="space-y-0.5">
      <div className="text-zinc-300">{day}</div>
      {r.dateTime.startTime && (
        <div className="text-[12px] text-zinc-500">{r.dateTime.startTime}</div>
      )}
      {r.dateTime.timezone && (
        <div className="text-[12px] text-zinc-500">{r.dateTime.timezone}</div>
      )}
    </div>
  );
}

function enrollmentPriceCell(price: MemberLiveStreamRow["enrollmentPrice"]) {
  // Blank, not a dash: a per-session series genuinely has no series price.
  if (!price) return <span className="text-zinc-600" />;
  if (price.isFree) return <span className="font-semibold text-zinc-200">Free</span>;
  return (
    <div className="space-y-0.5">
      <div className="font-semibold text-zinc-200">
        {fmtMoneyWhole(price.price, price.currency)}
      </div>
      <div className="text-[12px] text-zinc-500">{price.currency}</div>
    </div>
  );
}

function compPlanCell(levels: MemberLiveStreamRow["compPlan"]) {
  if (!levels.length) return <span className="font-semibold text-zinc-400">NA</span>;
  const top = [...levels].sort((a, b) => a.level - b.level)[0];
  return (
    <div className="space-y-0.5">
      <div className="text-zinc-200">{(top?.percentage ?? 0).toFixed(2)}%</div>
      <div className="text-[12px] text-zinc-500">
        {levels.length} Level{levels.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}

/** Sort value per column id. Live Streams is fetched whole rather than paged,
 *  so it sorts in the browser — DataTable is purely controlled and reorders
 *  nothing itself, which would leave every `sortable` header a dead control. */
function liveStreamSortValue(r: MemberLiveStreamRow, key: string): string | number {
  switch (key) {
    case "name":
      return r.name.toLowerCase();
    case "session":
      return r.sessionNumber ?? 0;
    case "frequency":
      return r.frequency;
    case "enrollmentType":
      return r.enrollmentType;
    case "status":
      return r.status;
    case "enrollmentPrice":
      // Free sorts below every paid price; a series with no price sorts last.
      return r.enrollmentPrice ? (r.enrollmentPrice.isFree ? -1 : r.enrollmentPrice.price) : -2;
    case "earnedEnrollment":
      return r.youEarnedFromEnrollment;
    case "attendance":
      return r.attendance;
    case "liveSellingPurchases":
      return r.liveSelling.purchases;
    case "liveSellingVolume":
      return r.liveSelling.volumeUsd;
    case "liveSellingEarned":
      return r.liveSelling.youEarnedUsd;
    case "rating":
      return r.rating ?? -1;
    default:
      return 0;
  }
}

/**
 * Only a PER-SESSION enrolment collapses Date & Time → Review into one cell
 * holding the drill-down button. There, every figure past that point belongs
 * to an individual session — the price is charged per session, and attendance,
 * rating and comp plan follow the same split — so the series has no row-level
 * answer for any of them.
 *
 * A recurring ONE-TIME enrolment keeps all of it: one price bought the whole
 * run, so the stats are the series'. Only its Date & Time is unanswerable
 * (many dates), and that cell carries the button on its own — see
 * dateTimeCell.
 *
 * Nothing merges inside the session view: every row there is one occurrence.
 */
function liveStreamMergeTail(
  onSessions: ((r: MemberLiveStreamRow) => void) | undefined,
) {
  return (r: MemberLiveStreamRow) =>
    r.enrollmentType === "per_session"
      ? { fromColumnId: "dateTime", content: sessionLevelButton(r, onSessions) }
      : null;
}

function sortLiveStreamRows(
  rows: MemberLiveStreamRow[],
  sort: { by: string; order: "asc" | "desc" } | null,
): MemberLiveStreamRow[] {
  if (!sort) return rows;
  const dir = sort.order === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = liveStreamSortValue(a, sort.by);
    const y = liveStreamSortValue(b, sort.by);
    if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
    return String(x).localeCompare(String(y)) * dir;
  });
}

/** The member cancelled this enrolment. Shown as a tag on the existing name /
 *  session cell rather than its own column — they still paid for it, so the
 *  row stays, but it must not read as an ordinary registration. */
function cancelledTag(r: MemberLiveStreamRow) {
  if (r.enrolment !== "cancelled") return null;
  return (
    <span className="ml-[44px] inline-flex rounded-full bg-rose-500/[0.12] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300">
      Cancelled
    </span>
  );
}

function liveStreamColumns(opts: {
  variant: "streams" | "sessions";
  onSessions?: (r: MemberLiveStreamRow) => void;
  onViewSpeakers?: (d: SpeakersDrawerState) => void;
  /**
   * Whether the CALLER earns commission from this member.
   *
   * False in the garage admin panel: requireUserOrGarageAdmin sets
   * `req.user = {}` for an admin token, so the backend returns zero for both
   * "You Earned" figures by design. Drawing $0.00 on every row would read as
   * "this member generated no commission" rather than "you, the admin, earn
   * nothing from them" — so those two columns are omitted instead.
   */
  showViewerEarnings?: boolean;
}): ColumnDef<MemberLiveStreamRow>[] {
  const showEarnings = opts.showViewerEarnings !== false;
  const lead: ColumnDef<MemberLiveStreamRow> =
    opts.variant === "sessions"
      ? {
          id: "session",
          header: "Session #",
          frozen: true,
          width: 240,
          cell: (r) => (
            <div className="space-y-1">
              {itemCell(r.name, r.thumbnail, `Session ${r.sessionNumber ?? "—"}`)}
              {cancelledTag(r)}
            </div>
          ),
        }
      : {
          id: "name",
          header: "Name",
          frozen: true,
          sortable: true,
          width: 200,
          cell: (r) => (
            <div className="space-y-1">
              {itemCell(r.name, r.thumbnail)}
              {cancelledTag(r)}
            </div>
          ),
        };

  return [
    lead,
    {
      id: "office",
      header: "Office",
      width: 135,
      cell: (r) =>
        r.office ? itemCell(r.office.name, r.office.icon) : <span className="text-zinc-500">—</span>,
    },
    {
      id: "createdBy",
      header: "Created By",
      width: 185,
      cell: (r) =>
        founderCell(
          r.createdBy
            ? {
                name: r.createdBy.name,
                email: r.createdBy.email,
                phone: r.createdBy.phone || "",
                avatar: r.createdBy.avatar || "",
              }
            : null,
          r.createdBy?.country ?? null,
        ),
    },
    {
      id: "speakers",
      header: "Speakers",
      width: 175,
      cell: (r) => speakersCell(r, opts.onViewSpeakers),
    },
    {
      id: "frequency",
      header: "Frequency",
      sortable: true,
      width: 95,
      cell: (r) => (
        <span className="text-zinc-300">{r.frequency === "recurring" ? "Recurring" : "One Time"}</span>
      ),
    },
    {
      id: "enrollmentType",
      header: "Enrollment Type",
      sortable: true,
      width: 115,
      cell: (r) => (
        <span className="font-semibold text-zinc-300">
          {r.enrollmentType === "na" ? "NA" : r.enrollmentType === "once" ? "One Time" : "Per Session"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status Of Live Stream",
      sortable: true,
      width: 140,
      cell: (r) => statusPill(r.status),
    },
    // The drill-down already IS one stream's sessions, so it needs no button
    // and each row states its own date in the Session # column.
    ...(opts.variant === "streams"
      ? [
          {
            id: "dateTime",
            header: "Date & Time",
            width: 210,
            cell: (r: MemberLiveStreamRow) => dateTimeCell(r, opts.onSessions),
          } as ColumnDef<MemberLiveStreamRow>,
        ]
      : []),
    {
      id: "enrollmentPrice",
      header: "Enrollment Price",
      sortable: true,
      width: 150,
      cell: (r) => enrollmentPriceCell(r.enrollmentPrice),
    },
    {
      id: "compPlan",
      header: "Enrollment Comp Plan",
      width: 170,
      cell: (r) => compPlanCell(r.compPlan),
    },
    ...(showEarnings
      ? [
          {
            id: "earnedEnrollment",
            header: "You Earned From Enrollment",
            sortable: true,
            width: 190,
            cell: (r: MemberLiveStreamRow) =>
              r.enrollmentType === "na" && !r.compPlan.length ? (
                <span className="font-semibold text-zinc-400">NA</span>
              ) : (
                <span className="tabular-nums text-zinc-200">
                  {fmtMoney(r.youEarnedFromEnrollment, r.earnedCurrency)}
                </span>
              ),
          } as ColumnDef<MemberLiveStreamRow>,
        ]
      : []),
    { id: "links", header: "Affiliate Link", width: 150, cell: (r) => affiliateCell(r.affiliateUrl) },
    {
      id: "attendance",
      header: "Attendance",
      sortable: true,
      width: 130,
      // A session that hasn't run yet shows a dash, not "Not Attended" —
      // nobody can have missed a date that hasn't arrived.
      cell: (r) =>
        r.attendance === "not_applicable" ? (
          <span className="text-zinc-600">—</span>
        ) : (
          <span className={r.attendance === "attended" ? "text-zinc-200" : "text-zinc-500"}>
            {r.attendance === "attended" ? "Attended" : "Not Attended"}
          </span>
        ),
    },
    {
      id: "liveSellingPurchases",
      header: "Live Selling Purchases",
      sortable: true,
      width: 170,
      cell: (r) => (
        <span className="tabular-nums text-zinc-300">
          {r.liveSelling.purchases} Purchase{r.liveSelling.purchases === 1 ? "" : "s"}
        </span>
      ),
    },
    {
      id: "liveSellingVolume",
      header: "Live Selling Purchase Volume",
      sortable: true,
      width: 200,
      cell: (r) => (
        <span className="tabular-nums text-zinc-300">
          {fmtMoneyWhole(r.liveSelling.volumeUsd, "USD")}
        </span>
      ),
    },
    ...(showEarnings
      ? [
          {
            id: "liveSellingEarned",
            header: "You Earned From Live Selling Purchases",
            sortable: true,
            width: 240,
            cell: (r: MemberLiveStreamRow) => (
              <span className="tabular-nums text-zinc-300">
                {fmtMoneyWhole(r.liveSelling.youEarnedUsd, "USD")}
              </span>
            ),
          } as ColumnDef<MemberLiveStreamRow>,
        ]
      : []),
    { id: "rating", header: "Rating", sortable: true, width: 100, cell: (r) => communityRatingCell(r.rating) },
    { id: "review", header: "Review", width: 260, cell: (r) => reviewCell(r.review) },
  ];
}

const PHYSICAL_COLUMNS: ColumnDef<MemberPhysicalOrderItem>[] = [
  { id: "name", header: "Product", frozen: true, sortable: true, width: 280, cell: (r) => itemCell(r.name, r.image, r.variant) },
  { id: "store", header: "Store", sortable: true, width: 160, cell: (r) => <span className="truncate text-zinc-300">{r.store || "—"}</span> },
  { id: "qty", header: "Qty", align: "right", sortable: true, width: 80, cell: (r) => <span className="tabular-nums text-zinc-300">{r.quantity}</span> },
  { id: "price", header: "Price", align: "right", sortable: true, width: 120, cell: (r) => <span className="tabular-nums text-zinc-200">{fmtMoneyWhole(r.linePrice, r.currency)}</span> },
  { id: "status", header: "Status", sortable: true, width: 130, cell: (r) => statusBadge(r.status) },
  { id: "tracking", header: "Tracking", width: 110, cell: (r) => trackingCell(r.trackingUrl, r.trackingNumber) },
  { id: "shipto", header: "Shipped To", width: 160, cell: (r) => <span className="truncate text-zinc-300">{shipTo(r.shipCity, r.shipCountry)}</span> },
  { id: "ordered", header: "Ordered", sortable: true, width: 150, cell: (r) => <span className="text-zinc-300">{fmtDate(r.orderedAt)}</span> },
];

// Shared enriched columns for the invoice-backed tabs.
const earnedCol: ColumnDef<MemberPurchaseItem> = {
  id: "earned",
  header: "You Earned",
  align: "right",
  sortable: true,
  width: 120,
  cell: (r) => (
    <span className="tabular-nums text-zinc-200">{fmtMoney(r.youEarned ?? 0, r.earnedCurrency || "USD")}</span>
  ),
};
const ratingCol: ColumnDef<MemberPurchaseItem> = {
  id: "rating",
  header: "Rating",
  align: "right",
  sortable: true,
  width: 90,
  cell: (r) => communityRatingCell(r.rating ?? null),
};
const affiliateColP: ColumnDef<MemberPurchaseItem> = {
  id: "links",
  header: "Links",
  width: 140,
  cell: (r) => affiliateCell(r.affiliateUrl),
};

// Live Streams / Courses / Digital Products / Purchases (invoice-backed).
// Communities has its own dedicated columns (communityColumns); offices/physical
// have their own render branches — so all three are excluded here.
const PURCHASE_COLUMNS: Record<
  // saved_cards has its own bespoke panel and never routes through the
  // PURCHASE_COLUMNS lookup — exclude alongside offices/physical/communities.
  // Live Streams left this set when it moved to registrations — it has its
  // own row shape and render branch now (see liveStreamColumns).
  Exclude<
    TabKey,
    | "offices"
    | "physical_products"
    | "communities"
    | "saved_cards"
    | "live_streams"
  >,
  ColumnDef<MemberPurchaseItem>[]
> = {
  courses: [
    { id: "name", header: "Course", frozen: true, sortable: true, width: 240, cell: (r) => itemCell(r.name, r.image) },
    { id: "enrolled", header: "Enrolled", sortable: true, width: 150, cell: (r) => <span className="text-zinc-300">{fmtDate(r.paidAt)}</span> },
    { id: "progress", header: "Progress", sortable: true, width: 150, cell: (r) => progressCell(r.progressPercentage) },
    { id: "status", header: "Status", sortable: true, width: 130, cell: (r) => <span className="capitalize text-zinc-300">{r.enrollmentStatus || "—"}</span> },
    moneyCol,
    earnedCol,
    affiliateColP,
    ratingCol,
  ],
  digital_products: [
    { id: "name", header: "Product", frozen: true, sortable: true, width: 240, cell: (r) => itemCell(r.name, r.image) },
    { id: "store", header: "Seller", sortable: true, width: 150, cell: (r) => <span className="truncate text-zinc-300">{r.vendor || "—"}</span> },
    { id: "category", header: "Category", sortable: true, width: 140, cell: (r) => <span className="truncate text-zinc-300">{r.category || "—"}</span> },
    { id: "purchased", header: "Purchased", sortable: true, width: 150, cell: (r) => <span className="text-zinc-300">{fmtDate(r.paidAt)}</span> },
    { id: "qty", header: "Qty", align: "right", sortable: true, width: 80, cell: (r) => <span className="tabular-nums text-zinc-300">{r.quantity}</span> },
    moneyCol,
    earnedCol,
    affiliateColP,
    ratingCol,
  ],
  purchases: [
    { id: "name", header: "Item", frozen: true, sortable: true, width: 240, cell: (r) => itemCell(r.name, r.image) },
    { id: "type", header: "Type", sortable: true, width: 140, cell: (r) => <span className="text-zinc-300">{humanType(r.itemType)}</span> },
    { id: "store", header: "Seller", sortable: true, width: 150, cell: (r) => <span className="truncate text-zinc-300">{r.vendor || "—"}</span> },
    { id: "purchased", header: "Purchased", sortable: true, width: 150, cell: (r) => <span className="text-zinc-300">{fmtDate(r.paidAt)}</span> },
    moneyCol,
    earnedCol,
    ratingCol,
    { id: "invoice", header: "Invoice #", sortable: true, width: 150, cell: (r) => <span className="truncate text-zinc-400">{r.invoiceNumber || "—"}</span> },
  ],
};

// Pure maths behind /affiliate/genealogy/*. No DB, no I/O — everything the
// routes compute that is worth a test lives here.
import { RANK_KEYS } from "../../models/rankPlan.model";

export type NcStatus = "active" | "lapsed" | "never";
export type MemberStatus = "active" | "qualified" | "lapsed" | "inactive";

/** Label precedence agreed 2026-09-19: lapsed > qualified > active > inactive. */
export function memberStatus(nc: NcStatus, qualified: boolean): MemberStatus {
  if (nc === "lapsed") return "lapsed";
  if (nc === "active") return qualified ? "qualified" : "active";
  return "inactive";
}

/** The root's direct child on this member's path (the member itself when it is
 *  a direct), or null when the root is not one of its ancestors. */
export function legHeadOf(
  ancestors: unknown[] | undefined,
  rootId: string,
  selfId: string,
): string | null {
  const anc = (ancestors || []).map(String);
  const i = anc.indexOf(rootId);
  if (i < 0) return null;
  return anc[i + 1] ?? selfId;
}

/** Ids root → … → self, or null when self is not under root. */
export function pathFromRoot(
  ancestors: unknown[] | undefined,
  rootId: string,
  selfId: string,
): string[] | null {
  if (selfId === rootId) return [rootId];
  const anc = (ancestors || []).map(String);
  const i = anc.indexOf(rootId);
  if (i < 0) return null;
  return [...anc.slice(i), selfId];
}

/** Invoice value without GST or shipping, in paymentCurrency minor units. */
export function netMinor(inv: { totalAmount?: number; tax?: number; shippingCost?: number }): number {
  return Math.max(0, (inv.totalAmount || 0) - (inv.tax || 0) - (inv.shippingCost || 0));
}

/** Minor units → USD dollars (2dp). `usdRates[X]` = units of X per 1 USD
 *  (fxService.getRateTable("USD").rates). Unknown currency counts as 0. */
export function minorToUsd(
  minor: number,
  currency: string | undefined,
  usdRates: Record<string, number>,
): number {
  const cur = (currency || "USD").toUpperCase();
  const rate = cur === "USD" ? 1 : usdRates[cur];
  if (!rate || rate <= 0) return 0;
  return Math.round(minor / rate) / 100;
}

export function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function monthRange(periodKey: string): { from: Date; to: Date } {
  const [y, m] = periodKey.split("-").map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
}

/** Levels 1..15 are the bonus zone; everything deeper shares bucket 16 ("16+"). */
export const LEVEL_BUCKETS = 16;
export function levelBucket(level: number): number {
  return Math.min(Math.max(1, level), LEVEL_BUCKETS);
}

export function rankOrder(rank: string | null | undefined): number {
  const i = (RANK_KEYS as readonly string[]).indexOf(rank || "");
  return i < 0 ? 0 : i + 1;
}

// ── Tree aggregates ─────────────────────────────────────────────────────────

export interface TreeMember {
  id: string;
  parentId: string | null;
  name: string;
  handle: string | null;
  avatar: string;
  depth: number;
  /** depth − root depth; the root itself is 0. */
  level: number;
  legHead: string | null;
  joinedAt: Date | null;
  rank: string | null;
  directs: number;
  teamSize: number;
  nc: NcStatus;
  qualified: boolean;
  status: MemberStatus;
  /** This calendar month's personal volume, USD ex-GST. */
  volumeUsd: number;
}

/**
 * Every ancestor of `matches`, up to and including the root, excluding the
 * matches themselves.
 *
 * This is what lets the tree PRUNE a filtered view instead of just dimming it:
 * drawing `matches ∪ ancestorsOf(matches)` drops every branch with no match in
 * it while each surviving match keeps an unbroken chain back to the root. Hiding
 * non-matches outright would orphan a match five levels down with no visible
 * parent, which is exactly the "where in my network is this" answer the tree
 * exists to give.
 */
export function ancestorsOf(
  matches: readonly { id: string; parentId: string | null }[],
  all: readonly TreeMember[]
): string[] {
  const parentOf = new Map(all.map((m) => [m.id, m.parentId]));
  const isMatch = new Set(matches.map((m) => m.id));
  const out = new Set<string>();
  for (const m of matches) {
    // Stop at a node already walked, or at another match — a match's own chain
    // is walked when the loop reaches it, so nothing above is missed. Also the
    // guard against a cycle in a corrupted ancestors path.
    for (let p = m.parentId; p && !out.has(p) && !isMatch.has(p); p = parentOf.get(p) ?? null) {
      out.add(p);
    }
  }
  return [...out];
}

export interface Cell {
  people: number;
  active: number;
  qualified: number;
  volumeUsd: number;
}

export function emptyCell(): Cell {
  return { people: 0, active: 0, qualified: 0, volumeUsd: 0 };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function addTo(c: Cell, x: TreeMember): void {
  c.people += 1;
  if (x.nc === "active") c.active += 1;
  if (x.qualified) c.qualified += 1;
  c.volumeUsd = r2(c.volumeUsd + x.volumeUsd);
}

/** Leg × level matrix (levels 1..15 + "16+"). The root row (level 0) and
 *  members outside `legHeads` are ignored. */
export function buildMatrix(members: TreeMember[], legHeads: string[]) {
  const col = new Map(legHeads.map((id, i) => [id, i]));
  const rows = Array.from({ length: LEVEL_BUCKETS }, (_, i) => ({
    level: i + 1,
    cells: legHeads.map(() => emptyCell()),
    total: emptyCell(),
  }));
  const legTotals = legHeads.map(() => emptyCell());
  const grand = emptyCell();
  for (const x of members) {
    if (x.level < 1 || !x.legHead) continue;
    const c = col.get(x.legHead);
    if (c === undefined) continue;
    const row = rows[levelBucket(x.level) - 1];
    addTo(row.cells[c], x);
    addTo(row.total, x);
    addTo(legTotals[c], x);
    addTo(grand, x);
  }
  return { rows, legTotals, grand };
}

export function levelHistogram(members: TreeMember[]): number[] {
  const h = new Array(LEVEL_BUCKETS).fill(0);
  for (const x of members) if (x.level >= 1) h[levelBucket(x.level) - 1] += 1;
  return h;
}

export interface LegSummary {
  legHead: string;
  size: number;
  active: number;
  qualified: number;
  /** Deepest level reached inside the leg, relative to the root. */
  depth: number;
  histogram: number[];
  volumeUsd: number;
  highestRank: { userId: string; name: string; rank: string; level: number } | null;
}

export function summarizeLegs(members: TreeMember[], legHeads: string[]): LegSummary[] {
  const byLeg = new Map<string, TreeMember[]>(legHeads.map((h) => [h, []]));
  for (const x of members) {
    if (x.level >= 1 && x.legHead && byLeg.has(x.legHead)) byLeg.get(x.legHead)!.push(x);
  }
  return legHeads.map((legHead) => {
    const xs = byLeg.get(legHead)!;
    let best: TreeMember | null = null;
    for (const x of xs) {
      if (!x.rank) continue;
      if (
        !best ||
        rankOrder(x.rank) > rankOrder(best.rank) ||
        (rankOrder(x.rank) === rankOrder(best.rank) && x.level < best.level)
      )
        best = x;
    }
    return {
      legHead,
      size: xs.length,
      active: xs.filter((x) => x.nc === "active").length,
      qualified: xs.filter((x) => x.qualified).length,
      depth: xs.reduce((d, x) => Math.max(d, x.level), 0),
      histogram: levelHistogram(xs),
      volumeUsd: r2(xs.reduce((s, x) => s + x.volumeUsd, 0)),
      highestRank: best
        ? { userId: best.id, name: best.name, rank: best.rank!, level: best.level }
        : null,
    };
  });
}

// ── Earnings ────────────────────────────────────────────────────────────────

export interface EarnSplit {
  direct: number;
  level: number;
  infinity: number;
  total: number;
}

export function emptySplit(): EarnSplit {
  return { direct: 0, level: 0, infinity: 0, total: 0 };
}

export function addSplits(...s: EarnSplit[]): EarnSplit {
  const o = emptySplit();
  for (const x of s) {
    o.direct += x.direct;
    o.level += x.level;
    o.infinity += x.infinity;
  }
  o.direct = r2(o.direct);
  o.level = r2(o.level);
  o.infinity = r2(o.infinity);
  o.total = r2(o.direct + o.level + o.infinity);
  return o;
}

type Recip = { userId: unknown; amount: number; creditedAmount?: number | null };
export interface UpDistLike {
  directBonusRecipientId?: unknown;
  directBonusAmount?: number;
  directBonusCreditedAmount?: number | null;
  levelBonusRecipients?: Recip[];
  infinityTier1Recipients?: Recip[];
  infinityTier2Recipients?: Recip[];
}

/** What `me` was credited from UnilevelPlusDistribution rows (USD). Credited
 *  amounts win over plan amounts (the NC coverage split can halve them). */
export function upEarnings(me: string, rows: UpDistLike[]): EarnSplit {
  const got = (r: Recip) => (r.creditedAmount ?? r.amount) || 0;
  const mine = (rs?: Recip[]) =>
    (rs || []).filter((r) => String(r.userId) === me).reduce((s, r) => s + got(r), 0);
  let direct = 0;
  let level = 0;
  let infinity = 0;
  for (const d of rows) {
    if (d.directBonusRecipientId != null && String(d.directBonusRecipientId) === me)
      direct += (d.directBonusCreditedAmount ?? d.directBonusAmount) || 0;
    level += mine(d.levelBonusRecipients);
    infinity += mine(d.infinityTier1Recipients) + mine(d.infinityTier2Recipients);
  }
  return addSplits({ direct, level, infinity, total: 0 });
}

import {
  memberStatus, legHeadOf, pathFromRoot, netMinor, minorToUsd,
  monthStart, monthRange, levelBucket, rankOrder,
} from "../genealogy/pure";
import {
  buildMatrix, levelHistogram, summarizeLegs, upEarnings, addSplits, emptySplit,
  ancestorsOf, TreeMember,
} from "../genealogy/pure";

describe("memberStatus", () => {
  it("applies lapsed > qualified > active > inactive", () => {
    expect(memberStatus("lapsed", true)).toBe("lapsed");
    expect(memberStatus("active", true)).toBe("qualified");
    expect(memberStatus("active", false)).toBe("active");
    expect(memberStatus("never", true)).toBe("inactive");
    expect(memberStatus("never", false)).toBe("inactive");
  });
});

describe("legHeadOf / pathFromRoot", () => {
  const anc = ["g", "r", "d1", "x"]; // global root g → root r → direct d1 → x → self
  it("returns the root's direct child on the path", () => {
    expect(legHeadOf(anc, "r", "self")).toBe("d1");
  });
  it("returns self when self is a direct of the root", () => {
    expect(legHeadOf(["g", "r"], "r", "d2")).toBe("d2");
  });
  it("returns null when root is not an ancestor", () => {
    expect(legHeadOf(anc, "zzz", "self")).toBeNull();
  });
  it("builds root → … → self", () => {
    expect(pathFromRoot(anc, "r", "self")).toEqual(["r", "d1", "x", "self"]);
    expect(pathFromRoot([], "r", "r")).toEqual(["r"]);
    expect(pathFromRoot(anc, "zzz", "self")).toBeNull();
  });
  it("accepts ObjectId-like values", () => {
    const oid = (s: string) => ({ toString: () => s });
    expect(legHeadOf([oid("r"), oid("d1")], "r", "self")).toBe("d1");
  });
});

describe("money", () => {
  it("netMinor strips GST and shipping, never negative", () => {
    expect(netMinor({ totalAmount: 2950, tax: 450, shippingCost: 0 })).toBe(2500);
    expect(netMinor({ totalAmount: 1000 })).toBe(1000);
    expect(netMinor({ totalAmount: 100, tax: 80, shippingCost: 50 })).toBe(0);
  });
  it("minorToUsd converts via a units-per-USD table, rounded to cents", () => {
    const rates = { USD: 1, INR: 88 };
    expect(minorToUsd(2500, "USD", rates)).toBe(25);
    expect(minorToUsd(220000, "INR", rates)).toBe(25);
    expect(minorToUsd(2500, undefined, rates)).toBe(25);
    expect(minorToUsd(1000, "inr", rates)).toBeCloseTo(0.11, 2);
  });
  it("minorToUsd returns 0 for an unknown currency", () => {
    expect(minorToUsd(5000, "XYZ", { USD: 1 })).toBe(0);
  });
});

describe("periods", () => {
  it("monthStart is the UTC first of the month", () => {
    expect(monthStart(new Date("2026-09-19T10:00:00Z")).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
  it("monthRange spans exactly one month", () => {
    const { from, to } = monthRange("2026-12");
    expect(from.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("levelBucket / rankOrder", () => {
  it("caps levels at the 16+ bucket", () => {
    expect(levelBucket(1)).toBe(1);
    expect(levelBucket(15)).toBe(15);
    expect(levelBucket(16)).toBe(16);
    expect(levelBucket(40)).toBe(16);
  });
  it("orders ranks Bronze < … < Platinum, unranked lowest", () => {
    expect(rankOrder(null)).toBe(0);
    expect(rankOrder("Bronze")).toBeLessThan(rankOrder("Silver"));
    expect(rankOrder("Diamond")).toBeLessThan(rankOrder("Platinum"));
    expect(rankOrder("Nonsense")).toBe(0);
  });
});

const m = (p: Partial<TreeMember>): TreeMember => ({
  id: "x", parentId: null, name: "X", handle: null, avatar: "", depth: 0, level: 1,
  legHead: "L1", joinedAt: null, rank: null, directs: 0, teamSize: 0,
  nc: "never", qualified: false, status: "inactive", volumeUsd: 0, ...p,
});

describe("buildMatrix", () => {
  const members = [
    m({ id: "a", legHead: "L1", level: 1, nc: "active", qualified: true, volumeUsd: 25 }),
    m({ id: "b", legHead: "L1", level: 2, nc: "never" }),
    m({ id: "c", legHead: "L2", level: 1, nc: "active", volumeUsd: 10.5 }),
    m({ id: "d", legHead: "L2", level: 20, qualified: true }), // 16+ bucket
    m({ id: "root", legHead: null, level: 0 }),                 // root row is ignored
  ];
  const mx = buildMatrix(members, ["L1", "L2"]);
  it("has 16 level rows with one cell per leg", () => {
    expect(mx.rows).toHaveLength(16);
    expect(mx.rows[0].cells).toHaveLength(2);
  });
  it("counts people/active/qualified/volume per cell", () => {
    expect(mx.rows[0].cells[0]).toEqual({ people: 1, active: 1, qualified: 1, volumeUsd: 25 });
    expect(mx.rows[0].cells[1]).toEqual({ people: 1, active: 1, qualified: 0, volumeUsd: 10.5 });
    expect(mx.rows[1].cells[0].people).toBe(1);
    expect(mx.rows[15].cells[1]).toEqual({ people: 1, active: 0, qualified: 1, volumeUsd: 0 });
  });
  it("totals rows, legs and grand", () => {
    expect(mx.rows[0].total).toEqual({ people: 2, active: 2, qualified: 1, volumeUsd: 35.5 });
    expect(mx.legTotals[0].people).toBe(2);
    expect(mx.legTotals[1].people).toBe(2);
    expect(mx.grand).toEqual({ people: 4, active: 2, qualified: 2, volumeUsd: 35.5 });
  });
});

describe("levelHistogram / summarizeLegs", () => {
  const members = [
    m({ id: "h1", legHead: "h1", level: 1, name: "Head", nc: "active", rank: "Bronze" }),
    m({ id: "x1", legHead: "h1", level: 3, name: "Deep", rank: "Silver", qualified: true, volumeUsd: 5 }),
    m({ id: "x2", legHead: "h1", level: 18 }),
    m({ id: "h2", legHead: "h2", level: 1, name: "Other" }),
  ];
  it("buckets people by level with a 16+ bucket", () => {
    const h = levelHistogram(members);
    expect(h).toHaveLength(16);
    expect(h[0]).toBe(2);
    expect(h[2]).toBe(1);
    expect(h[15]).toBe(1);
  });
  it("summarizes each leg", () => {
    const [a, b] = summarizeLegs(members, ["h1", "h2"]);
    expect(a).toMatchObject({ legHead: "h1", size: 3, active: 1, qualified: 1, depth: 18, volumeUsd: 5 });
    expect(a.highestRank).toEqual({ userId: "x1", name: "Deep", rank: "Silver", level: 3 });
    expect(b).toMatchObject({ legHead: "h2", size: 1, active: 0, highestRank: null });
  });
});

describe("upEarnings", () => {
  const rows = [{
    directBonusRecipientId: "me", directBonusAmount: 9, directBonusCreditedAmount: 4.5,
    levelBonusRecipients: [{ userId: "me", amount: 0.3 }, { userId: "other", amount: 1 }],
    infinityTier1Recipients: [{ userId: "me", amount: 0.4, creditedAmount: 0.4 }],
    infinityTier2Recipients: [{ userId: "me", amount: 2 }],
  }];
  it("sums only the caller's credited amounts, falling back to amount", () => {
    expect(upEarnings("me", rows)).toEqual({ direct: 4.5, level: 0.3, infinity: 2.4, total: 7.2 });
  });
  it("addSplits sums fields and rounds to cents", () => {
    const s = addSplits({ direct: 0.1, level: 0.2, infinity: 0, total: 0.3 }, emptySplit(),
      { direct: 0.2, level: 0, infinity: 0, total: 0.2 });
    expect(s).toEqual({ direct: 0.3, level: 0.2, infinity: 0, total: 0.5 });
  });
});

describe("ancestorsOf", () => {
  //        root
  //       /    \
  //      a      b
  //     / \      \
  //    c   d      e
  //   /
  //  f
  const tree = [
    m({ id: "root", parentId: null, level: 0 }),
    m({ id: "a", parentId: "root", level: 1 }),
    m({ id: "b", parentId: "root", level: 1 }),
    m({ id: "c", parentId: "a", level: 2 }),
    m({ id: "d", parentId: "a", level: 2 }),
    m({ id: "e", parentId: "b", level: 2 }),
    m({ id: "f", parentId: "c", level: 3 }),
  ];
  const pick = (...ids: string[]) => tree.filter((x) => ids.includes(x.id));

  it("returns the chain to the root for one deep match", () => {
    expect(ancestorsOf(pick("f"), tree).sort()).toEqual(["a", "c", "root"]);
  });

  it("excludes the matches themselves", () => {
    const anc = ancestorsOf(pick("c", "f"), tree);
    expect(anc).not.toContain("c");
    expect(anc).not.toContain("f");
    // c is a match, so the walk from f stops there — but c's own walk still
    // contributes a and root, so nothing above a match is lost.
    expect(anc.sort()).toEqual(["a", "root"]);
  });

  it("drops branches with no match in them", () => {
    // Matching only e must not pull in the whole a-subtree.
    const keep = new Set([...ancestorsOf(pick("e"), tree), "e"]);
    expect([...keep].sort()).toEqual(["b", "e", "root"]);
    for (const id of ["a", "c", "d", "f"]) expect(keep.has(id)).toBe(false);
  });

  it("merges overlapping chains without repeating a node", () => {
    const anc = ancestorsOf(pick("c", "d"), tree);
    expect(anc.sort()).toEqual(["a", "root"]);
    expect(new Set(anc).size).toBe(anc.length);
  });

  it("is empty when the only match is a direct of the root's child chain top", () => {
    expect(ancestorsOf(pick("root"), tree)).toEqual([]);
  });

  it("survives a parent id that is not in the member list", () => {
    const orphan = [m({ id: "lost", parentId: "gone", level: 1 })];
    expect(ancestorsOf(orphan, orphan)).toEqual(["gone"]);
  });

  it("terminates on a cycle rather than hanging", () => {
    const cyclic = [
      m({ id: "p", parentId: "q", level: 1 }),
      m({ id: "q", parentId: "p", level: 1 }),
    ];
    expect(ancestorsOf([cyclic[0]], cyclic).sort()).toEqual(["q"]);
  });
});

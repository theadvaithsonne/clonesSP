import { linksPageParams, paginateByCategory } from "../affiliateLinksPage";

type Item = { id: string; name: string; category: string };
const it_ = (id: string, name: string, category: string): Item => ({ id, name, category });

const all: Item[] = [
  it_("3", "Zeta", "physical"),
  it_("1", "Alpha", "physical"),
  it_("2", "Mid", "digital"),
  it_("4", "Beta", "digital"),
  it_("5", "Gamma", "physical"),
];
const opts = {
  categoryOf: (i: Item) => i.category,
  keyOf: (i: Item) => i.id,
  nameOf: (i: Item) => i.name,
};

describe("paginateByCategory", () => {
  it("filters to one category and orders by name", () => {
    const r = paginateByCategory(all, { ...opts, category: "physical", page: 1, limit: 10 });
    expect(r.items.map((i) => i.name)).toEqual(["Alpha", "Gamma", "Zeta"]);
    expect(r.total).toBe(3);
  });

  it("counts every category across the whole list, not the filtered page", () => {
    const r = paginateByCategory(all, { ...opts, category: "physical", q: "alp", page: 1, limit: 1 });
    // The tab badges count what a tab HOLDS, not what this search found in it.
    expect(r.counts).toEqual({ physical: 3, digital: 2 });
    expect(r.total).toBe(1);
  });

  it("serves each item on exactly one page", () => {
    const seen: string[] = [];
    const { totalPages } = paginateByCategory(all, { ...opts, page: 1, limit: 2 });
    for (let p = 1; p <= totalPages; p++) {
      seen.push(...paginateByCategory(all, { ...opts, page: p, limit: 2 }).items.map((i) => i.id));
    }
    expect(seen.length).toBe(all.length);
    expect(new Set(seen).size).toBe(all.length);
  });

  it("pages a shuffled list identically — the sort is what makes paging safe", () => {
    const shuffled = [...all].reverse();
    const keys = (src: Item[], p: number) =>
      paginateByCategory(src, { ...opts, page: p, limit: 2 }).items.map((i) => i.id);
    for (const p of [1, 2, 3]) expect(keys(shuffled, p)).toEqual(keys(all, p));
  });

  it("searches by name, case-insensitively, across the whole category", () => {
    const r = paginateByCategory(all, { ...opts, q: "ET", page: 1, limit: 10 });
    expect(r.items.map((i) => i.name).sort()).toEqual(["Beta", "Zeta"]);
    expect(paginateByCategory(all, { ...opts, q: "nope", page: 1, limit: 10 }).total).toBe(0);
  });

  it("an out-of-range page is empty, not a wrapped slice", () => {
    expect(paginateByCategory(all, { ...opts, page: 99, limit: 2 }).items).toEqual([]);
  });

  it("totalPages is 1 when nothing matches, so the UI never shows 'page 1 of 0'", () => {
    expect(paginateByCategory([], { ...opts, page: 1, limit: 24 }).totalPages).toBe(1);
    expect(paginateByCategory(all, { ...opts, q: "zzz", page: 1, limit: 24 }).totalPages).toBe(1);
  });

  it("survives items with no name", () => {
    // The catalog defaults a missing title to "Untitled", but a bad row must
    // not crash the sort.
    const odd = [{ id: "a" }, { id: "b", name: "B" }] as Item[];
    const r = paginateByCategory(odd, { ...opts, categoryOf: () => "x", page: 1, limit: 10 });
    expect(r.total).toBe(2);
  });

  it("paging is opt-in: no page/limit means the whole list, as before", () => {
    // The mobile and desktop apps call these routes and expect everything.
    expect(linksPageParams({})).toBeNull();
    const r = paginateByCategory(all, { ...opts, category: "physical" });
    expect(r.items.map((i) => i.name)).toEqual(["Alpha", "Gamma", "Zeta"]);
    expect(r.totalPages).toBe(1);
    expect(r.limit).toBe(3);
  });

  it("clamps page and limit once a caller asks for a page", () => {
    expect(linksPageParams({ page: "2" })).toEqual({ page: 2, limit: 24 });
    expect(linksPageParams({ page: "0", limit: "9999" })).toEqual({ page: 1, limit: 100 });
    expect(linksPageParams({ page: "junk", limit: "junk" })).toEqual({ page: 1, limit: 24 });
  });
});

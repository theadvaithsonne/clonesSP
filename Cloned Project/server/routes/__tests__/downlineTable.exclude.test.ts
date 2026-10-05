import assert from "node:assert";
import { excludeBeneathClause } from "../downlineTable";

// ── ?excludeUserId= ──────────────────────────────────────────────────────────
const ids = (c: Record<string, unknown> | null) =>
  ((c?.ancestors as { $nin?: unknown[] })?.$nin ?? []).map(String);

test("exclusion hides everyone BENEATH the named people, not the people", () => {
  // Expressed as a condition on `ancestors`: a person's own ancestors never
  // include themselves, so they stay listed while their leg drops out.
  const clause = excludeBeneathClause("507f1f77bcf86cd799439011");
  assert.deepEqual(ids(clause), ["507f1f77bcf86cd799439011"]);
  assert.ok(clause && "ancestors" in clause, "filters on ancestors, not _id");
});

test("repeated params and comma lists both work", () => {
  const a = "507f1f77bcf86cd799439011";
  const b = "507f1f77bcf86cd799439012";
  assert.deepEqual(ids(excludeBeneathClause([a, b])), [a, b]);
  assert.deepEqual(ids(excludeBeneathClause(`${a},${b}`)), [a, b]);
  assert.deepEqual(ids(excludeBeneathClause(` ${a} , ${b} `)), [a, b], "whitespace tolerated");
});

test("a malformed id excludes nobody rather than emptying or widening the table", () => {
  // Dropping the bad value keeps the other, valid legs working; throwing would
  // break the page, and ignoring the whole param would silently show hidden legs.
  const good = "507f1f77bcf86cd799439011";
  assert.deepEqual(ids(excludeBeneathClause([good, "not-an-id", ""])), [good]);
  assert.equal(excludeBeneathClause("not-an-id"), null);
  assert.equal(excludeBeneathClause(""), null, "no param = no clause");
  assert.equal(excludeBeneathClause(undefined), null);
});

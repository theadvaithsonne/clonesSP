import { test } from "node:test";
import assert from "node:assert/strict";
import { comboWindowFor, comboWindowStatus } from "../../dist/services/comboWindow.js";

const now = new Date("2026-01-02T00:00:00Z");
test("not_started when no profileCompletedAt and no override", () => {
  const w = comboWindowFor({}, now);
  assert.equal(comboWindowStatus(w), "not_started");
});
test("open while inside the natural 24h", () => {
  const w = comboWindowFor({ profileCompletedAt: "2026-01-01T12:00:00Z" }, now); // 12h in
  assert.equal(comboWindowStatus(w), "open");
});
test("expired after the natural 24h", () => {
  const w = comboWindowFor({ profileCompletedAt: "2025-12-31T00:00:00Z" }, now); // >24h
  assert.equal(comboWindowStatus(w), "expired");
});
test("completed when UP purchased inside the window (beats open/expired)", () => {
  const w = comboWindowFor({ profileCompletedAt: "2026-01-01T12:00:00Z" }, now);
  assert.equal(comboWindowStatus(w, { upPurchasedAt: "2026-01-01T18:00:00Z" }), "completed");
});
test("purchase after expiry is NOT completed", () => {
  // Reference clock must itself be past expiresAt (2026-01-02T12:00:00Z) for
  // the window to read "expired" — comboWindowStatus's open/expired branch
  // reflects the window's state as of `now`, independent of when a late
  // purchase happened to land.
  const later = new Date("2026-01-03T00:00:00Z");
  const w = comboWindowFor({ profileCompletedAt: "2026-01-01T12:00:00Z" }, later);
  assert.equal(comboWindowStatus(w, { upPurchasedAt: "2026-01-03T00:00:00Z" }), "expired");
});

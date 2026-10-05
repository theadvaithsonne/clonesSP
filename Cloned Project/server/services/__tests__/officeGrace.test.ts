import { graceStatusFor, newGraceWindow, OFFICE_GRACE_DAYS } from "../officeGrace";

const NOW = new Date("2026-10-01T12:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86400 * 1000);

describe("office grace — status derivation", () => {
  it("counts down while the window is open", () => {
    const s = graceStatusFor({ startedAt: days(-5), expiresAt: days(25) }, false, NOW);
    expect(s.status).toBe("grace");
    expect(s.daysRemaining).toBe(25);
    expect(s.secondsRemaining).toBe(25 * 86400);
    expect(s.licenceActive).toBe(false);
  });

  it("rounds the last partial day UP, so an office that still works never reads 0 days", () => {
    const s = graceStatusFor({ startedAt: days(-30), expiresAt: new Date(NOW.getTime() + 3600_000) }, false, NOW);
    expect(s.status).toBe("grace");
    expect(s.daysRemaining).toBe(1);
  });

  it("locks the instant the window passes", () => {
    const atExpiry = graceStatusFor({ startedAt: days(-30), expiresAt: NOW }, false, NOW);
    expect(atExpiry.status).toBe("locked");
    expect(atExpiry.secondsRemaining).toBe(0);
    expect(graceStatusFor({ startedAt: days(-40), expiresAt: days(-10) }, false, NOW).status).toBe("locked");
  });

  it("a licence outranks everything — including a window that already lapsed", () => {
    const lapsed = graceStatusFor({ startedAt: days(-90), expiresAt: days(-60) }, true, NOW);
    expect(lapsed.status).toBe("licensed");
    expect(lapsed.licenceActive).toBe(true);
    // buying on day 300 unlocks with no write, no cron
    expect(graceStatusFor({ startedAt: days(-5), expiresAt: days(25) }, true, NOW).status).toBe("licensed");
  });

  it("an office that was never on the programme is 'none', never 'locked'", () => {
    // Callers gate on "locked"; a normal office must not be caught by it.
    expect(graceStatusFor(null, false, NOW).status).toBe("none");
    expect(graceStatusFor(undefined, false, NOW).status).toBe("none");
    expect(graceStatusFor({ startedAt: null, expiresAt: null }, false, NOW).status).toBe("none");
    expect(graceStatusFor({}, false, NOW).status).toBe("none");
  });

  it("a corrupt expiry reads as 'none' rather than locking a working office", () => {
    expect(graceStatusFor({ expiresAt: new Date("nonsense") }, false, NOW).status).toBe("none");
  });

  it("carries the window dates through on every status", () => {
    const g = { startedAt: days(-5), expiresAt: days(25) };
    for (const licence of [true, false]) {
      const s = graceStatusFor(g, licence, NOW);
      expect(s.startedAt).toEqual(g.startedAt);
      expect(s.expiresAt).toEqual(g.expiresAt);
    }
  });
});

describe("office grace — window", () => {
  it("is exactly OFFICE_GRACE_DAYS long from now", () => {
    const w = newGraceWindow(NOW);
    expect(w.startedAt).toEqual(NOW);
    expect(w.expiresAt.getTime() - NOW.getTime()).toBe(OFFICE_GRACE_DAYS * 86400 * 1000);
    expect(OFFICE_GRACE_DAYS).toBe(30);
  });

  it("a freshly created office reads as 30 days of grace", () => {
    const w = newGraceWindow(NOW);
    const s = graceStatusFor(w, false, NOW);
    expect(s.status).toBe("grace");
    expect(s.daysRemaining).toBe(30);
  });
});

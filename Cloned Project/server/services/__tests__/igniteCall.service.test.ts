import {
  chunk,
  newestLiveCall,
  enrichStatuses,
  NC_STATUS_CHUNK,
  applyManualCompletion,
} from "../igniteCall.service";

describe("chunk", () => {
  it("splits into batches of at most the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns no batches for an empty list", () => {
    expect(chunk([], 10)).toEqual([]);
  });

  it("keeps a list smaller than the size as one batch", () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });
});

describe("newestLiveCall", () => {
  const a = { _id: "a", scheduledAt: new Date("2026-09-01"), detachedAt: null };
  const b = { _id: "b", scheduledAt: new Date("2026-09-05"), detachedAt: null };
  const detached = { _id: "c", scheduledAt: new Date("2026-09-09"), detachedAt: new Date() };

  it("picks the latest scheduledAt", () => {
    expect(newestLiveCall([a, b])!._id).toBe("b");
  });

  it("ignores detached calls even when they are newest", () => {
    expect(newestLiveCall([a, b, detached])!._id).toBe("b");
  });

  it("returns null when every call is detached", () => {
    expect(newestLiveCall([detached])).toBeNull();
  });

  it("returns null for an empty history", () => {
    expect(newestLiveCall([])).toBeNull();
  });
});

describe("enrichStatuses", () => {
  const status = (id: string, over = {}) => ({
    scheduleId: id, scheduledAt: "2026-09-04T10:00:00Z", startedAt: null,
    endedAt: null, isLive: false, status: "scheduled" as const, ...over,
  });

  it("returns a map keyed by scheduleId", async () => {
    const out = await enrichStatuses(["s1"], async () => [status("s1", { status: "started" })]);
    expect(out.get("s1")!.status).toBe("started");
  });

  it("chunks requests at NC_STATUS_CHUNK", async () => {
    // CSV export pages the affiliates list at 200 rows, so a single call can
    // carry more linked rows than contacts-backend accepts in one request.
    const ids = Array.from({ length: 250 }, (_, i) => `s${i}`);
    const batches: number[] = [];
    await enrichStatuses(ids, async (batch) => {
      batches.push(batch.length);
      return batch.map((id) => status(id));
    });
    expect(batches).toEqual([NC_STATUS_CHUNK, NC_STATUS_CHUNK, 50]);
  });

  it("every id in a 200-row export page gets a status", async () => {
    const ids = Array.from({ length: 200 }, (_, i) => `s${i}`);
    const out = await enrichStatuses(ids, async (batch) => batch.map((id) => status(id)));
    expect(out.size).toBe(200);
  });

  it("fails soft to an empty map when NetworkChains errors", async () => {
    const out = await enrichStatuses(["s1"], async () => {
      throw new Error("connect ETIMEDOUT");
    });
    expect(out.size).toBe(0);
  });

  it("keeps the batches that succeeded when one batch fails", async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `s${i}`);
    let call = 0;
    const out = await enrichStatuses(ids, async (batch) => {
      call += 1;
      if (call === 2) throw new Error("boom");
      return batch.map((id) => status(id));
    });
    expect(out.size).toBe(NC_STATUS_CHUNK);
  });

  it("does not call NetworkChains at all for an empty id list", async () => {
    const fetcher = jest.fn();
    const out = await enrichStatuses([], fetcher as never);
    expect(out.size).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("applyManualCompletion", () => {
  const AT = new Date("2026-09-05T12:00:00Z");

  it("leaves the derived status alone when there is no override", () => {
    expect(applyManualCompletion("scheduled", null)).toBe("scheduled");
    expect(applyManualCompletion("scheduled", undefined)).toBe("scheduled");
  });

  it("promotes a scheduled call to completed", () => {
    expect(applyManualCompletion("scheduled", AT)).toBe("completed");
  });

  it("is a no-op on a call that is already completed", () => {
    expect(applyManualCompletion("completed", AT)).toBe("completed");
  });

  it("does NOT override a call that is live right now", () => {
    // Live evidence from the room beats a stale manual mark — otherwise a
    // call in progress would read Completed while people are still in it.
    expect(applyManualCompletion("started", AT)).toBe("started");
  });

  it("cannot conjure a status for an affiliate with no call", () => {
    expect(applyManualCompletion("not_scheduled", AT)).toBe("not_scheduled");
  });
});

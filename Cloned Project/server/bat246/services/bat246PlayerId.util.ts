import { Types } from "mongoose";
import { Bat246Player } from "../models/bat246Player.model";

/**
 * playerIdNo ("2000HI", "2001HI", ...) used to be generated from
 * Bat246Player.countDocuments() at each of the ~9 create() call sites —
 * correct only as long as no player document is ever deleted. Deleting the
 * test accounts' player rows (see _tmp_remove_test_bat246_accounts.ts,
 * an earlier session) shifted the count down, so the next count-based id
 * collided with one already assigned to a real, still-active player
 * (E11000 on playerIdNo_1) — silently blocking every new signup's first
 * purchase or membership activation until property1thousand@gmail.com's
 * report traced it here.
 *
 * Derives the next id from the highest currently-assigned numeric id
 * instead of the row count, so a gap left by a deleted row no longer causes
 * a collision — and retries the insert if two concurrent requests still
 * race to the same id, rather than assuming a single read is safe.
 */
export async function createBat246Player(fields: {
  userId: Types.ObjectId;
  nickname: string;
  email: string;
  memberSince?: Date;
  countryResidence?: string | null;
}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const docs = await Bat246Player.find({ playerIdNo: /^\d+HI$/ })
      .select("playerIdNo")
      .lean();
    const maxId = docs.reduce((max, d: any) => {
      const n = parseInt(d.playerIdNo, 10);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 1999);
    try {
      return await Bat246Player.create({ ...fields, playerIdNo: `${maxId + 1}HI` });
    } catch (err: any) {
      if (err?.code === 11000 && attempt < 4) continue;
      throw err;
    }
  }
  throw new Error("createBat246Player: exhausted retries generating a unique playerIdNo");
}

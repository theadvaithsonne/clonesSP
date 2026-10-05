/**
 * Creates a fully-populated BAT246 TEST BOARD for mobile-view testing.
 *
 *   Dry run:   npx tsx src/scripts/bat246-test-board-create.ts
 *   For real:  npx tsx src/scripts/bat246-test-board-create.ts --confirm
 *   Remove:    npx tsx src/scripts/bat246-test-board-delete.ts --confirm
 *
 * - mode: "test"  → the backend serves it ONLY to a frontend running at
 *   http://localhost:3000 (see bat246TestMode.ts). bat246.com, gotobigwin.com,
 *   etc. never list or open it.
 * - hidden: true  → on top of that, only Alan K (redbaron2020@mail.com) can see it.
 * - Dummy players only ("Alpha Tester", ...). Emails end in @bat246-test.invalid,
 *   player ids start with "TB", distributor ids end in "TB".
 * - Writes ONLY raw documents (board, dummy players, dummy distributors, card
 *   history). It never calls the entry / purchase / split / payout services, so
 *   no money moves and no transaction, commission or notification is created.
 * - The Protection Period clock is parked (paused) so no automatic job acts on it.
 * - Findable by tracking number "T-9999" and the @bat246-test.invalid email
 *   domain — exactly what the delete script uses.
 */
import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246Board } from "../bat246/models/bat246Board.model";
import { Bat246Player } from "../bat246/models/bat246Player.model";
import { Bat246Distributor } from "../bat246/models/bat246Distributor.model";
import { Bat246SalesCredit } from "../bat246/models/bat246SalesCredit.model";

const TRACKING = "T-9999";
const BOARD_NUMBER = 999999;
const EMAIL_DOMAIN = "bat246-test.invalid";

const NAMES = [
  "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliet",
  "Kilo", "Lima", "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango",
  "Uniform", "Victor", "Whiskey", "Xray", "Yankee", "Zulu", "Amber", "Blaze", "Cobalt", "Dawn",
  "Ember", "Frost", "Garnet", "Harbor", "Indigo", "Jade", "Karma", "Lotus", "Maple", "Nova",
  "Onyx", "Pearl", "Quartz", "Raven", "Sable", "Topaz", "Umber", "Velvet",
];
const COUNTRIES: [string, string][] = [
  ["United Kingdom", "Canada"], ["India", "India"], ["United States", "United States"], ["Spain", "Canada"],
  ["Australia", "India"], ["Philippines", "Philippines"], ["Canada", "Canada"], ["United Arab Emirates", "India"],
];

const BASE = new Date("2026-09-29T08:50:13Z").getTime();
const at = (minutes: number) => new Date(BASE + minutes * 60_000);

type Made = { _id: Types.ObjectId; name: string; entryNo: string; distId: string; userId: Types.ObjectId; country: [string, string]; enteredAt: Date };
let counter = 0;

function nextPlayer(): Made {
  const i = counter++;
  return {
    _id: new Types.ObjectId(),
    name: `${NAMES[i % NAMES.length]} Tester`,
    entryNo: String((i % 3) + 1),
    distId: `9${String(i + 1).padStart(3, "0")}TB`,
    userId: new Types.ObjectId(),
    country: COUNTRIES[i % COUNTRIES.length],
    enteredAt: at(i * 2),
  };
}

type Extra = {
  sales?: number; gold?: number; black?: number; brown?: number; freeGray?: number; gray160?: number;
  cardType?: "Green" | "Gold" | null; pod?: string | null; trophies?: boolean;
};
const extras = new Map<string, Extra>();

function slot(m: Made, ex: Extra) {
  extras.set(m._id.toString(), ex);
  return {
    playerId: m._id,
    entryNo: m.entryNo,
    playerName: m.name,
    playerEmail: `${m.name.split(" ")[0].toLowerCase()}@${EMAIL_DOMAIN}`,
    enteredAt: m.enteredAt,
    joinedBoardAt: m.enteredAt,
    cardType: ex.cardType ?? null,
    salesCredits: ex.sales ?? 0,
    goldCards: ex.gold ?? 0,
    blackCards: ex.black ?? 0,
    brownCards: ex.brown ?? 0,
    freeGrayCards: ex.freeGray ?? 0,
    grayCard160: ex.gray160 ?? 0,
    referredByName: "Alpha Tester",
    countryResidence: m.country[0],
    countryOrigin: m.country[1],
    podTeamId: ex.pod ?? null,
  };
}

async function run() {
  const confirm = process.argv.includes("--confirm");
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set");
  await mongoose.connect(uri);

  if (await Bat246Board.findOne({ $or: [{ trackingNumber: TRACKING }, { boardNumber: BOARD_NUMBER }] }).select("_id").lean()) {
    console.log(`A test board (${TRACKING}) already exists — run bat246-test-board-delete.ts --confirm first.`);
    await mongoose.disconnect();
    return;
  }

  // ── players, one per occupied slot ─────────────────────────────────────
  const hp = nextPlayer();
  const third = nextPlayer();
  const second = [nextPlayer(), nextPlayer()];
  const first = [nextPlayer(), nextPlayer(), nextPlayer(), nextPlayer()];
  const atBat = Array.from({ length: 8 }, () => nextPlayer());
  const pod = [nextPlayer(), nextPlayer(), nextPlayer()];
  const dugoutP = Array.from({ length: 20 }, () => nextPlayer());

  // Every card kind each position can realistically hold, at (or beyond) capacity.
  // AT BAT 1–8 carry only Gold + Green (no Black / Brown / Gray).
  const board: any = {
    boardNumber: BOARD_NUMBER,
    trackingNumber: TRACKING,
    title: "TEST BOARD — mobile view (delete me)",
    status: "active",
    mode: "test",               // served ONLY to a frontend on http://localhost:3000
    hidden: true,               // and only to Alan K on top of that
    generation: 0,
    familyNumber: 99,
    side: null,
    protectionPeriodEnd: new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000),
    ppPausedRemainingMs: 120 * 3600 * 1000,
    warpCount: 2,
    minorLeagueAmount: 650,
    podTeamId: "P-9999",
    homePlate: slot(hp, { sales: 2, brown: 3, gold: 2, black: 1, freeGray: 1, gray160: 1, trophies: true }),
    thirdBase: slot(third, { sales: 2, black: 3, gold: 1, brown: 1, freeGray: 1, gray160: 1, trophies: true }),
    secondBaseA: slot(second[0], { sales: 2, black: 2, gold: 1, brown: 1, freeGray: 1, trophies: true }),
    secondBaseB: slot(second[1], { sales: 2, black: 2, gold: 1, brown: 1, gray160: 1 }),
    firstBase: first.map((m) => slot(m, { sales: 2, gold: 1, black: 1, brown: 1, gray160: 1 })),
    atBat: atBat.map((m) => slot(m, { cardType: "Green", gold: 1 })),
    pod: pod.map((m) => slot(m, { pod: "P-9999", sales: 1 })),
    dugout: dugoutP.map((m, i) => slot(m, i % 5 === 0 ? { pod: "P-9998" } : {})),
    onDeckCircle: [],
    hotBox: (["Gold", "Black", "Brown", "Green", "Gold", "Black", "Brown", "Green", "Gold", "Black"] as const).map((cardType, i) => ({
      cardType,
      playerId: atBat[i % atBat.length]._id,
      assignedAt: at(100 + i),
    })),
    leaderBoard: [
      { tier: "G", playerId: hp._id, qualifiedAt: at(200), earningsOnBoard: 0 },
      { tier: "H", playerId: third._id, qualifiedAt: at(201), earningsOnBoard: 0 },
      { tier: "T", playerId: second[0]._id, qualifiedAt: at(202), earningsOnBoard: 0 },
    ],
  };

  const lbCards: Record<string, any> = {
    [hp._id.toString()]: { gold: 1, black: 2, brown: 1, green: 3, gray: 1, noCard: 0, freeGray: 1, gray160: 0 },        // G: 7 counted
    [third._id.toString()]: { gold: 1, black: 1, brown: 1, green: 2, gray: 0, noCard: 0, freeGray: 0, gray160: 0 },     // H: 5
    [second[0]._id.toString()]: { gold: 1, black: 1, brown: 0, green: 1, gray: 0, noCard: 0, freeGray: 0, gray160: 0 }, // T: 3
  };
  const lbTier: Record<string, "G" | "H" | "T"> = { [hp._id.toString()]: "G", [third._id.toString()]: "H", [second[0]._id.toString()]: "T" };

  const all = [hp, third, ...second, ...first, ...atBat, ...pod, ...dugoutP];

  console.log(`Board ${TRACKING} (mode: test, hidden)`);
  console.log(`  players: ${all.length} (all "…Tester", @${EMAIL_DOMAIN})`);
  console.log(`  slots: HP, 3rd, 2nd×2, 1st×4, AT BAT×8, POD×3, dugout×${dugoutP.length}, hot box×${board.hotBox.length}, leaderboard G/H/T`);
  if (!confirm) { console.log("\nDRY RUN — nothing written. Re-run with --confirm."); await mongoose.disconnect(); return; }

  const created = await Bat246Board.create(board);
  const boardId = created._id as Types.ObjectId;

  const playerDocsToInsert = all.map((m, i) => {
    const ex = extras.get(m._id.toString()) ?? {};
    const lb = lbCards[m._id.toString()];
    const tier = lbTier[m._id.toString()];
    const trophy = ex.trophies ? { earnedAt: at(300), boardId, boardTrackingNo: TRACKING } : null;
    return {
      _id: m._id,
      userId: m.userId,
      playerIdNo: `TB${String(i + 1).padStart(4, "0")}`,
      nickname: m.name,
      email: `${m.name.split(" ")[0].toLowerCase()}@${EMAIL_DOMAIN}`,
      role: "stakeholder",
      memberSince: at(0),
      countryResidence: m.country[0],
      countryOrigin: m.country[1],
      membershipActive: false,
      minorLeague: lb ? { cardsEarned: lb, totalBCs: 7, lbLevel: tier, lbEarnings: { grandSlam: 0, homeRun: 0, triple: 0 } } : {},
      trophies: ex.trophies ? { G: tier === "G" ? trophy : null, H: tier === "H" || tier === "G" ? trophy : null, T: trophy } : {},
    };
  });
  await Bat246Player.insertMany(playerDocsToInsert);

  await Bat246Distributor.insertMany(all.map((m, i) => ({
    userId: m.userId,
    playerId: m._id,
    firstName: m.name.split(" ")[0],
    lastName: "Tester",
    distributorId: m.distId,
    userSnapshot: { name: m.name, email: `${m.name.split(" ")[0].toLowerCase()}@${EMAIL_DOMAIN}`, country: m.country[0] },
    isOfficeMember: true,
    isApproved: true,
    approvedAt: at(i),
  })));

  // Card history so the card pop-ups (green/gold/black/brown/gray) have data
  const credits: any[] = [];
  const owners: { m: Made; pos: string }[] = [
    { m: hp, pos: "homePlate" }, { m: third, pos: "thirdBase" },
    { m: second[0], pos: "secondBaseA" }, { m: second[1], pos: "secondBaseB" },
    ...first.map((m, i) => ({ m, pos: `firstBase${"ABCD"[i]}` })),
    ...atBat.map((m, i) => ({ m, pos: `atBat${i + 1}` })),
  ];
  for (const { m, pos } of owners) {
    const ex = extras.get(m._id.toString()) ?? {};
    const mk = (cardType: string, n: number, countsForLB: boolean) => {
      for (let k = 0; k < n; k++) {
        const ref = atBat[(counter + k) % atBat.length];
        credits.push({
          boardId, playerId: m._id, playerName: m.name, position: pos, cardType, countsForLB,
          saleAmount: 0, earnedAt: at(400 + credits.length),
          referredUserId: ref._id, referredUserName: ref.name, boardTrackingNumber: TRACKING,
          cardBack: {
            assignedTo: { playerName: m.name, playerIdNo: m.distId, entryNo: m.entryNo },
            freePosition: { playerName: ref.name, playerIdNo: ref.distId, entryNo: ref.entryNo },
            stolenFrom: { playerName: first[0].name, playerIdNo: first[0].distId, entryNo: first[0].entryNo, playerId: first[0]._id },
            stolenBy: { playerName: hp.name, playerIdNo: hp.distId, entryNo: hp.entryNo, playerId: hp._id },
            cardEarned: cardType, position: pos, atBatPositionNo: "AB" + ((k % 8) + 1), firstBasePosition: "A",
            issuedAt: at(400 + credits.length), boardTrackingNo: TRACKING,
          },
        });
      }
    };
    mk("Green", Math.max(ex.sales ?? 0, ex.cardType === "Green" ? 1 : 0), true);
    mk("Gold", ex.gold ?? 0, true);
    mk("Black", ex.black ?? 0, true);
    mk("Brown", ex.brown ?? 0, true);
    mk("Gray", (ex.freeGray ?? 0) + (ex.gray160 ?? 0), false);
  }
  await Bat246SalesCredit.insertMany(credits);

  console.log(`\nCREATED board ${TRACKING} (${boardId}), ${all.length} players/distributors, ${credits.length} card-history records.`);
  console.log(`Open: http://localhost:3000/games/bat246/${boardId}   (localhost:3000 + redbaron2020@mail.com only)`);
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });

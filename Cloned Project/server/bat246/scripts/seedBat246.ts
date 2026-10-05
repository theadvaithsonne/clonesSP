/**
 * Seed script — creates Board 1 (split) + Board 2 (Left, active) + Board 3 (Right, active).
 * Demonstrates the exact split scenario from BOARD_RULES.md:
 *   Board 1 splits the moment Patrick S. (1st Base D) earns his 2nd Green Card.
 *   Board 2 (Left, even) + Board 3 (Right, odd) are created per the split movement map.
 * Run: npx ts-node src/bat246/scripts/seedBat246.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246Config } from "../models/bat246Config.model";
import { Bat246Board } from "../models/bat246Board.model";
import { Bat246Player } from "../models/bat246Player.model";
import { Bat246PlayerBoard } from "../models/bat246PlayerBoard.model";
import { Bat246SalesCredit } from "../models/bat246SalesCredit.model";
import { Product } from "../../models/product.model";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  await Promise.all([
    Bat246Config.deleteMany({}),
    Bat246Board.deleteMany({}),
    Bat246Player.deleteMany({}),
    Bat246PlayerBoard.deleteMany({}),
    Bat246SalesCredit.deleteMany({}),
  ]);
  console.log("Cleared existing bat246 data");

  // boardCounter = 3 (3 boards total); familyCounter = 1 (only Board 1 started a family)
  // familySequences["1"] = 102 (family 1 used 100 for original, 101 L + 102 R for split)
  await Bat246Config.create({ boardCounter: 3, familyCounter: 1, familySequences: { "1": 102 } });

  const splitAt = new Date("2026-05-19T10:00:00Z");
  const board1ppEnd = new Date("2026-05-23T05:01:00Z"); // Board 1 PP (still within window when split fired)
  const childPpEnd = new Date("2026-05-24T10:00:00Z");  // Board 2 & 3 PP = splitAt + 120h
  const now = new Date();

  // ── Players ──────────────────────────────────────────────────────────────────
  const players = await Bat246Player.insertMany([
    { playerIdNo: "1001HI", nickname: "Shorupan P.", email: "shorupan@gmail.com", memberSince: new Date("2024-01-01"), countryResidence: "CA", countryOrigin: "LK" },
    { playerIdNo: "1002HI", nickname: "Alan M.",     email: "alan@gmail.com",     memberSince: new Date("2024-01-01"), countryResidence: "US", countryOrigin: "US" },
    { playerIdNo: "1003HI", nickname: "Bill R.",     email: "bill@gmail.com",     memberSince: new Date("2024-01-01"), countryResidence: "GB", countryOrigin: "IE" },
    { playerIdNo: "1004HI", nickname: "Patrick S.",  email: "patrick@gmail.com",  memberSince: new Date("2024-01-01"), countryResidence: "AU", countryOrigin: "AU" },
    { playerIdNo: "1005HI", nickname: "Kevin L.",    email: "kevin@gmail.com",    memberSince: new Date("2024-01-01"), countryResidence: "US", countryOrigin: "CN" },
    { playerIdNo: "1006HI", nickname: "Mike N.",     email: "mike@gmail.com",     memberSince: new Date("2024-01-01"), countryResidence: "AU", countryOrigin: "NG" },
    { playerIdNo: "1007HI", nickname: "Nina O.",     email: "nina@gmail.com",     memberSince: new Date("2024-01-01"), countryResidence: "CA", countryOrigin: "NG" },
    { playerIdNo: "1008HI", nickname: "Jeff D.",     email: "jeff@gmail.com",     memberSince: new Date("2024-01-01"), countryResidence: "US", countryOrigin: "US" },
    { playerIdNo: "1009HI", nickname: "Alice J.",    email: "alice@gmail.com",    memberSince: new Date("2024-01-01"), countryResidence: "GB", countryOrigin: "GB" },
    { playerIdNo: "1010HI", nickname: "Bob C.",      email: "bob@gmail.com",      memberSince: new Date("2024-01-01"), countryResidence: "US", countryOrigin: "MX" },
    { playerIdNo: "1011HI", nickname: "Carol D.",    email: "carol@gmail.com",    memberSince: new Date("2024-01-01"), countryResidence: "FR", countryOrigin: "FR" },
    { playerIdNo: "1012HI", nickname: "Dan E.",      email: "dan@gmail.com",      memberSince: new Date("2024-01-01"), countryResidence: "DE", countryOrigin: "DE" },
    { playerIdNo: "1013HI", nickname: "Eve F.",      email: "eve@gmail.com",      memberSince: new Date("2024-01-01"), countryResidence: "JP", countryOrigin: "JP" },
    { playerIdNo: "1014HI", nickname: "Frank G.",    email: "frank@gmail.com",    memberSince: new Date("2024-01-01"), countryResidence: "ZA", countryOrigin: "ZA" },
    { playerIdNo: "1015HI", nickname: "Grace H.",    email: "grace@gmail.com",    memberSince: new Date("2024-01-01"), countryResidence: "NZ", countryOrigin: "NZ" },
    { playerIdNo: "1016HI", nickname: "Oscar P.",    email: "oscar@gmail.com",    memberSince: new Date("2024-01-01"), countryResidence: "BR", countryOrigin: "BR" },
    { playerIdNo: "1017HI", nickname: "Pam Q.",      email: "pam@gmail.com",      memberSince: new Date("2024-01-01"), countryResidence: "IT", countryOrigin: "IT" },
    { playerIdNo: "1018HI", nickname: "Quinn R.",    email: "quinn@gmail.com",    memberSince: new Date("2024-01-01"), countryResidence: "ES", countryOrigin: "ES" },
    { playerIdNo: "1019HI", nickname: "Sam T.",      email: "sam@gmail.com",      memberSince: new Date("2024-01-01"), countryResidence: "IN", countryOrigin: "IN" },
    { playerIdNo: "1020HI", nickname: "Liam U.",     email: "liam@gmail.com",     memberSince: new Date("2024-01-01"), countryResidence: "CA", countryOrigin: "CA" },
  ]);

  const p = (email: string) => players.find(q => q.email === email)!;
  const shorupan = p("shorupan@gmail.com");
  const alan     = p("alan@gmail.com");
  const bill     = p("bill@gmail.com");
  const patrick  = p("patrick@gmail.com");
  const kevin    = p("kevin@gmail.com");
  const mike     = p("mike@gmail.com");
  const nina     = p("nina@gmail.com");
  const jeff     = p("jeff@gmail.com");
  const alice    = p("alice@gmail.com");
  const bob      = p("bob@gmail.com");
  const carol    = p("carol@gmail.com");
  const dan      = p("dan@gmail.com");
  const eve      = p("eve@gmail.com");
  const frank    = p("frank@gmail.com");
  const grace    = p("grace@gmail.com");
  const oscar    = p("oscar@gmail.com");
  const pam      = p("pam@gmail.com");
  const quinn    = p("quinn@gmail.com");
  const sam      = p("sam@gmail.com");
  const liam     = p("liam@gmail.com");

  // ── Update player stats ───────────────────────────────────────────────────
  // entryNo on Board 1 reflects how many boards each player has been on:
  //   Jeff=3, Nina/Kevin/Mike=2, Shorupan=3, Alan/Bill/Patrick=2, rest=1
  // After Board 1 splits, each player moving to Board 2 or 3 gets entryNo+1.
  // totalEntries = total board placements (Board 1 + child boards + prior history).
  //
  // Shorupan: 5 total BCs (2 Gold + 1 Black + 1 Brown + 1 Green) → qualifies for Home Run (H)
  // Alan: 3 total BCs (1 Gold + 1 Black + 1 Green) → qualifies for Triple (T)
  await Bat246Player.updateOne({ _id: jeff._id }, {
    $set: { "minorLeague.totalEntries": 3 },  // Board 1 was his 3rd board; left at HP
  });
  await Bat246Player.updateOne({ _id: nina._id }, {
    $set: { "minorLeague.totalEntries": 4 },  // Board 1 (entry 2) → Board 2 HP + Board 3 HP
  });
  await Bat246Player.updateOne({ _id: kevin._id }, {
    $set: { "minorLeague.totalEntries": 3 },  // Board 1 (entry 2) → Board 2 3rd
  });
  await Bat246Player.updateOne({ _id: mike._id }, {
    $set: { "minorLeague.totalEntries": 3 },  // Board 1 (entry 2) → Board 3 3rd
  });
  await Bat246Player.updateOne({ _id: shorupan._id }, {
    $set: {
      "minorLeague.totalEntries": 4,           // Board 1 (entry 3) → Board 2 2ndA
      "minorLeague.totalBCs": 5,
      "minorLeague.goldBCs": 2,
      "minorLeague.lbLevel": "H",
      "minorLeague.totalEarnings": 14200,
      "minorLeague.cardsEarned.gold": 2,
      "minorLeague.cardsEarned.black": 1,
      "minorLeague.cardsEarned.brown": 1,
      "minorLeague.cardsEarned.green": 1,
    },
  });
  await Bat246Player.updateOne({ _id: alan._id }, {
    $set: {
      "minorLeague.totalEntries": 3,           // Board 1 (entry 2) → Board 2 2ndB
      "minorLeague.totalBCs": 3,
      "minorLeague.goldBCs": 1,
      "minorLeague.lbLevel": "T",
      "minorLeague.totalEarnings": 5300,
      "minorLeague.cardsEarned.gold": 1,
      "minorLeague.cardsEarned.black": 1,
      "minorLeague.cardsEarned.green": 1,
    },
  });
  await Bat246Player.updateOne({ _id: bill._id },    { $set: { "minorLeague.totalEntries": 3 } });  // B1→B3 2ndA
  await Bat246Player.updateOne({ _id: patrick._id }, { $set: { "minorLeague.totalEntries": 3 } });  // B1→B3 2ndB
  await Bat246Player.updateOne({ _id: alice._id },   { $set: { "minorLeague.totalEntries": 2 } });  // B1→B2 1stA
  await Bat246Player.updateOne({ _id: bob._id },     { $set: { "minorLeague.totalEntries": 2 } });  // B1→B2 1stB
  await Bat246Player.updateOne({ _id: carol._id },   { $set: { "minorLeague.totalEntries": 2 } });  // B1→B2 1stC
  await Bat246Player.updateOne({ _id: dan._id },     { $set: { "minorLeague.totalEntries": 2 } });  // B1→B2 1stD
  await Bat246Player.updateOne({ _id: eve._id },     { $set: { "minorLeague.totalEntries": 2 } });  // B1→B3 1stA
  await Bat246Player.updateOne({ _id: frank._id },   { $set: { "minorLeague.totalEntries": 2 } });  // B1→B3 1stB
  await Bat246Player.updateOne({ _id: grace._id },   { $set: { "minorLeague.totalEntries": 2 } });  // B1→B3 1stC
  await Bat246Player.updateOne({ _id: oscar._id },   { $set: { "minorLeague.totalEntries": 2 } });  // B1→B2 dugout
  await Bat246Player.updateOne({ _id: pam._id },     { $set: { "minorLeague.totalEntries": 2 } });  // B1→B3 dugout
  await Bat246Player.updateOne({ _id: quinn._id },   { $set: { "minorLeague.totalEntries": 2 } });  // B1→B3 on-deck
  await Bat246Player.updateOne({ _id: sam._id },     { $set: { "minorLeague.totalEntries": 2 } });  // B1 dugout overflow→B2 on-deck→B2 AB1
  await Bat246Player.updateOne({ _id: liam._id },   { $set: { "minorLeague.totalEntries": 2 } });  // B1 AB8→B3 1stD

  // ══════════════════════════════════════════════════════════════════════════
  // BOARD 1 — Root board, now SPLIT
  //   Split was triggered when Patrick S. (1st Base D) earned his 2nd Green Card.
  //   All 4 × 1st Base players reached salesCredits = 2 (2 Green Cards) within the PP window.
  // ══════════════════════════════════════════════════════════════════════════
  const board1 = await Bat246Board.create({
    boardNumber: 1,
    trackingNumber: "1-100",
    title: "1 of 4 Board Basics",
    status: "split",
    generation: 0,
    familyNumber: 1,
    side: null,
    parentBoardId: null,
    protectionPeriodEnd: board1ppEnd,
    warpCount: 4,            // All 4 warped before split
    minorLeagueAmount: 600,
    splitAt,

    homePlate: {
      playerId: jeff._id, entryNo: "3", playerName: "Jeff D.", playerEmail: "jeff@gmail.com",
      enteredAt: new Date("2026-03-27T07:29:00Z"), joinedBoardAt: new Date("2026-03-27T07:29:00Z"),
      cardType: "Brown", countryResidence: "US", countryOrigin: "US",
    },
    thirdBase: {
      playerId: nina._id, entryNo: "2", playerName: "Nina O.", playerEmail: "nina@gmail.com",
      enteredAt: new Date("2026-03-28T11:00:00Z"), joinedBoardAt: new Date("2026-03-28T11:00:00Z"),
      cardType: "Black", countryResidence: "CA", countryOrigin: "NG",
    },
    secondBaseA: {
      playerId: kevin._id, entryNo: "2", playerName: "Kevin L.", playerEmail: "kevin@gmail.com",
      enteredAt: new Date("2026-03-30T10:00:00Z"), joinedBoardAt: new Date("2026-03-30T10:00:00Z"),
      cardType: "Black", countryResidence: "US", countryOrigin: "CN",
    },
    secondBaseB: {
      playerId: mike._id, entryNo: "2", playerName: "Mike N.", playerEmail: "mike@gmail.com",
      enteredAt: new Date("2026-03-29T09:00:00Z"), joinedBoardAt: new Date("2026-03-29T09:00:00Z"),
      cardType: "Black", countryResidence: "AU", countryOrigin: "NG",
    },

    // All 4 firstBase players completed their 2 Green Cards → split triggered
    firstBase: [
      { playerId: shorupan._id, entryNo: "3", playerName: "Shorupan P.", playerEmail: "shorupan@gmail.com", enteredAt: new Date("2026-03-31T22:00:00Z"), joinedBoardAt: new Date("2026-03-31T22:00:00Z"), cardType: "Gold", salesCredits: 2, warpStatus: 2, countryResidence: "CA", countryOrigin: "LK" },
      { playerId: alan._id,     entryNo: "2", playerName: "Alan M.",     playerEmail: "alan@gmail.com",     enteredAt: new Date("2026-03-31T22:30:00Z"), joinedBoardAt: new Date("2026-03-31T22:30:00Z"), cardType: "Gold", salesCredits: 2, warpStatus: 2, countryResidence: "US", countryOrigin: "US" },
      { playerId: bill._id,     entryNo: "2", playerName: "Bill R.",     playerEmail: "bill@gmail.com",     enteredAt: new Date("2026-03-31T23:00:00Z"), joinedBoardAt: new Date("2026-03-31T23:00:00Z"), cardType: "Gold", salesCredits: 2, warpStatus: 2, countryResidence: "GB", countryOrigin: "IE" },
      { playerId: patrick._id,  entryNo: "2", playerName: "Patrick S.",  playerEmail: "patrick@gmail.com",  enteredAt: new Date("2026-03-31T23:45:00Z"), joinedBoardAt: new Date("2026-03-31T23:45:00Z"), cardType: "Gold", salesCredits: 2, warpStatus: 2, countryResidence: "AU", countryOrigin: "AU" },
    ],

    atBat: [
      { playerId: alice._id,  entryNo: "1", playerName: "Alice J.",  playerEmail: "alice@gmail.com",  enteredAt: new Date("2026-04-01T00:15:00Z"), joinedBoardAt: new Date("2026-04-01T00:15:00Z"), cardType: "Gold", countryResidence: "GB", countryOrigin: "GB" },
      { playerId: bob._id,    entryNo: "1", playerName: "Bob C.",    playerEmail: "bob@gmail.com",    enteredAt: new Date("2026-04-01T01:20:00Z"), joinedBoardAt: new Date("2026-04-01T01:20:00Z"), countryResidence: "US", countryOrigin: "MX" },
      { playerId: carol._id,  entryNo: "1", playerName: "Carol D.",  playerEmail: "carol@gmail.com",  enteredAt: new Date("2026-04-01T02:45:00Z"), joinedBoardAt: new Date("2026-04-01T02:45:00Z"), countryResidence: "FR", countryOrigin: "FR" },
      { playerId: dan._id,    entryNo: "1", playerName: "Dan E.",    playerEmail: "dan@gmail.com",    enteredAt: new Date("2026-04-01T03:10:00Z"), joinedBoardAt: new Date("2026-04-01T03:10:00Z"), countryResidence: "DE", countryOrigin: "DE" },
      { playerId: eve._id,    entryNo: "1", playerName: "Eve F.",    playerEmail: "eve@gmail.com",    enteredAt: new Date("2026-04-01T04:00:00Z"), joinedBoardAt: new Date("2026-04-01T04:00:00Z"), countryResidence: "JP", countryOrigin: "JP" },
      { playerId: frank._id,  entryNo: "1", playerName: "Frank G.",  playerEmail: "frank@gmail.com",  enteredAt: new Date("2026-04-01T05:30:00Z"), joinedBoardAt: new Date("2026-04-01T05:30:00Z"), countryResidence: "ZA", countryOrigin: "ZA" },
      { playerId: grace._id,  entryNo: "1", playerName: "Grace H.",  playerEmail: "grace@gmail.com",  enteredAt: new Date("2026-04-01T06:15:00Z"), joinedBoardAt: new Date("2026-04-01T06:15:00Z"), countryResidence: "NZ", countryOrigin: "NZ" },
      // Liam: AB8 referred by Patrick S. (1BD) — his 2nd Green Card, triggering split
      { playerId: liam._id,   entryNo: "1", playerName: "Liam U.",   playerEmail: "liam@gmail.com",   enteredAt: new Date("2026-04-01T07:15:00Z"), joinedBoardAt: new Date("2026-04-01T07:15:00Z"), countryResidence: "CA", countryOrigin: "CA", referredBy: patrick._id, referredByName: "Patrick S." },
    ],

    dugout: [
      { playerId: oscar._id, entryNo: "1", playerName: "Oscar P.", playerEmail: "oscar@gmail.com", enteredAt: new Date("2026-04-01T07:00:00Z"), joinedBoardAt: new Date("2026-04-01T07:00:00Z"), countryResidence: "BR", countryOrigin: "BR", referredBy: shorupan._id, referredByName: "Shorupan P." },
      { playerId: pam._id,   entryNo: "1", playerName: "Pam Q.",   playerEmail: "pam@gmail.com",   enteredAt: new Date("2026-04-01T07:30:00Z"), joinedBoardAt: new Date("2026-04-01T07:30:00Z"), countryResidence: "IT", countryOrigin: "IT", referredBy: mike._id,     referredByName: "Mike N." },
      { playerId: quinn._id, entryNo: "1", playerName: "Quinn R.", playerEmail: "quinn@gmail.com", enteredAt: new Date("2026-04-01T08:00:00Z"), joinedBoardAt: new Date("2026-04-01T08:00:00Z"), countryResidence: "ES", countryOrigin: "ES", referredBy: frank._id,    referredByName: "Frank G." },
      // Sam: overflow dugout (index 3), referred by Alice J. (AB1 → Board 2 Left)
      // Split logic: Alice is in leftPlayerIds → Sam follows Alice → Board 2 on-deck → then placed at AB1
      { playerId: sam._id,   entryNo: "1", playerName: "Sam T.",   playerEmail: "sam@gmail.com",   enteredAt: new Date("2026-04-01T08:30:00Z"), joinedBoardAt: new Date("2026-04-01T08:30:00Z"), countryResidence: "IN", countryOrigin: "IN",  referredBy: alice._id,    referredByName: "Alice J." },
    ],

    // One entry per cardType — most recent holder
    hotBox: [
      { cardType: "Gold",  playerId: alan._id,  assignedAt: new Date("2026-05-19T09:55:00Z") },
      { cardType: "Black", playerId: mike._id,  assignedAt: new Date("2026-03-29T09:00:00Z") },
      { cardType: "Brown", playerId: jeff._id,  assignedAt: new Date("2026-03-27T07:29:00Z") },
    ],

    leaderBoard: [
      { tier: "G", playerId: null,         qualifiedAt: null },
      { tier: "H", playerId: shorupan._id, qualifiedAt: new Date("2026-03-01T00:00:00Z") },
      { tier: "T", playerId: alan._id,     qualifiedAt: new Date("2026-03-01T00:00:00Z") },
    ],

    penciling: [],
    prePick: [],
    onDeckCircle: [],
  });

  console.log(`Board 1 created (split): ${board1._id}`);

  // ══════════════════════════════════════════════════════════════════════════
  // BOARD 2 — Left child (boardNumber 2, even = Left)
  //   Receives per split map: 3rd→HP, 2ndA→3rd, 1BA→2ndA, 1BB→2ndB, AB1–4→1BA–D
  //   Dugout: Oscar (first dugout player → Left board)
  // ══════════════════════════════════════════════════════════════════════════
  const board2 = await Bat246Board.create({
    boardNumber: 2,
    trackingNumber: "1-101 L",
    title: "Board 2 (Left)",
    status: "active",
    generation: 1,
    familyNumber: 1,
    side: "left",
    parentBoardId: board1._id,
    leftChildBoardId: null,
    rightChildBoardId: null,
    splitAt: null,
    protectionPeriodEnd: childPpEnd,
    warpCount: 0,
    minorLeagueAmount: 600,

    // Nina duplicates — appears as HP on BOTH Board 2 and Board 3 (per split rules)
    // entryNo = Board 1 entryNo + 1 (this is each player's new board entry)
    homePlate: {
      playerId: nina._id, entryNo: "3", playerName: "Nina O.", playerEmail: "nina@gmail.com",
      enteredAt: splitAt, joinedBoardAt: new Date("2026-03-28T11:00:00Z"),
      cardType: "Black", countryResidence: "CA", countryOrigin: "NG",
    },
    thirdBase: {
      playerId: kevin._id, entryNo: "3", playerName: "Kevin L.", playerEmail: "kevin@gmail.com",
      enteredAt: splitAt, joinedBoardAt: new Date("2026-03-30T10:00:00Z"),
      cardType: "Black", countryResidence: "US", countryOrigin: "CN",
    },
    secondBaseA: {
      playerId: shorupan._id, entryNo: "4", playerName: "Shorupan P.", playerEmail: "shorupan@gmail.com",
      enteredAt: splitAt, joinedBoardAt: new Date("2026-03-31T22:00:00Z"),
      cardType: "Gold", countryResidence: "CA", countryOrigin: "LK",
    },
    secondBaseB: {
      playerId: alan._id, entryNo: "3", playerName: "Alan M.", playerEmail: "alan@gmail.com",
      enteredAt: splitAt, joinedBoardAt: new Date("2026-03-31T22:30:00Z"),
      cardType: "Gold", countryResidence: "US", countryOrigin: "US",
    },

    firstBase: [
      // Alice has 1 Green Card: she recruited Sam T. who joined AB1 on this board
      { playerId: alice._id, entryNo: "2", playerName: "Alice J.", playerEmail: "alice@gmail.com", enteredAt: splitAt, joinedBoardAt: new Date("2026-04-01T00:15:00Z"), cardType: "Gold", salesCredits: 1, warpStatus: 1, countryResidence: "GB", countryOrigin: "GB" },
      { playerId: bob._id,   entryNo: "2", playerName: "Bob C.",   playerEmail: "bob@gmail.com",   enteredAt: splitAt, joinedBoardAt: new Date("2026-04-01T01:20:00Z"), cardType: null,   salesCredits: 0, warpStatus: 0, countryResidence: "US", countryOrigin: "MX" },
      { playerId: carol._id, entryNo: "2", playerName: "Carol D.", playerEmail: "carol@gmail.com", enteredAt: splitAt, joinedBoardAt: new Date("2026-04-01T02:45:00Z"), cardType: null,   salesCredits: 0, warpStatus: 0, countryResidence: "FR", countryOrigin: "FR" },
      { playerId: dan._id,   entryNo: "2", playerName: "Dan E.",   playerEmail: "dan@gmail.com",   enteredAt: splitAt, joinedBoardAt: new Date("2026-04-01T03:10:00Z"), cardType: null,   salesCredits: 0, warpStatus: 0, countryResidence: "DE", countryOrigin: "DE" },
    ],

    // Sam arrived via Board 1 dugout overflow (referred by Alice) → Board 2 on-deck after split → placed at AB1
    atBat: [
      { playerId: sam._id, entryNo: "2", playerName: "Sam T.", playerEmail: "sam@gmail.com", enteredAt: splitAt, joinedBoardAt: new Date("2026-04-01T08:30:00Z"), countryResidence: "IN", countryOrigin: "IN", referredBy: alice._id, referredByName: "Alice J." },
      null, null, null, null, null, null, null,
    ],

    dugout: [
      { playerId: oscar._id, entryNo: "2", playerName: "Oscar P.", playerEmail: "oscar@gmail.com", enteredAt: splitAt, joinedBoardAt: new Date("2026-04-01T07:00:00Z"), countryResidence: "BR", countryOrigin: "BR", referredBy: shorupan._id, referredByName: "Shorupan P." },
    ],

    hotBox: [
      { cardType: "Gold",  playerId: alice._id,   assignedAt: splitAt },
      { cardType: "Black", playerId: kevin._id,   assignedAt: splitAt },
    ],

    leaderBoard: [
      { tier: "G", playerId: null,         qualifiedAt: null },
      { tier: "H", playerId: shorupan._id, qualifiedAt: new Date("2026-03-01T00:00:00Z") },
      { tier: "T", playerId: alan._id,     qualifiedAt: new Date("2026-03-01T00:00:00Z") },
    ],

    penciling: [],
    prePick: [],
    onDeckCircle: [],
  });

  console.log(`Board 2 (Left) created: ${board2._id}`);

  // ══════════════════════════════════════════════════════════════════════════
  // BOARD 3 — Right child (boardNumber 3, odd = Right)
  //   Receives per split map: 3rd→HP, 2ndB→3rd, 1BC→2ndA, 1BD→2ndB, AB5–8→1BA–D
  //   AB8 (Liam U., referred by Patrick) → 1BD on Board 3
  //   Dugout: Pam + Quinn (remaining dugout players → Right board)
  //   On-Deck Circle: Quinn moved to on-deck (board split without needing 3rd dugout player)
  // ══════════════════════════════════════════════════════════════════════════
  const board3 = await Bat246Board.create({
    boardNumber: 3,
    trackingNumber: "1-102 R",
    title: "Board 3 (Right)",
    status: "active",
    generation: 1,
    familyNumber: 1,
    side: "right",
    parentBoardId: board1._id,
    leftChildBoardId: null,
    rightChildBoardId: null,
    splitAt: null,
    protectionPeriodEnd: childPpEnd,
    warpCount: 0,
    minorLeagueAmount: 600,

    // Nina duplicates — same player at HP on both Board 2 and Board 3
    // entryNo = Board 1 entryNo + 1 (new board entry for each player)
    homePlate: {
      playerId: nina._id, entryNo: "3", playerName: "Nina O.", playerEmail: "nina@gmail.com",
      enteredAt: splitAt, joinedBoardAt: new Date("2026-03-28T11:00:00Z"),
      cardType: "Black", countryResidence: "CA", countryOrigin: "NG",
    },
    thirdBase: {
      playerId: mike._id, entryNo: "3", playerName: "Mike N.", playerEmail: "mike@gmail.com",
      enteredAt: splitAt, joinedBoardAt: new Date("2026-03-29T09:00:00Z"),
      cardType: "Black", countryResidence: "AU", countryOrigin: "NG",
    },
    secondBaseA: {
      playerId: bill._id, entryNo: "3", playerName: "Bill R.", playerEmail: "bill@gmail.com",
      enteredAt: splitAt, joinedBoardAt: new Date("2026-03-31T23:00:00Z"),
      cardType: "Gold", countryResidence: "GB", countryOrigin: "IE",
    },
    secondBaseB: {
      playerId: patrick._id, entryNo: "3", playerName: "Patrick S.", playerEmail: "patrick@gmail.com",
      enteredAt: splitAt, joinedBoardAt: new Date("2026-03-31T23:45:00Z"),
      cardType: "Gold", countryResidence: "AU", countryOrigin: "AU",
    },

    firstBase: [
      { playerId: eve._id,   entryNo: "2", playerName: "Eve F.",   playerEmail: "eve@gmail.com",   enteredAt: splitAt, joinedBoardAt: new Date("2026-04-01T04:00:00Z"), cardType: "Gold", salesCredits: 0, warpStatus: 0, countryResidence: "JP", countryOrigin: "JP" },
      { playerId: frank._id, entryNo: "2", playerName: "Frank G.", playerEmail: "frank@gmail.com", enteredAt: splitAt, joinedBoardAt: new Date("2026-04-01T05:30:00Z"), cardType: null, salesCredits: 0, warpStatus: 0, countryResidence: "ZA", countryOrigin: "ZA" },
      { playerId: grace._id, entryNo: "2", playerName: "Grace H.", playerEmail: "grace@gmail.com", enteredAt: splitAt, joinedBoardAt: new Date("2026-04-01T06:15:00Z"), cardType: null, salesCredits: 0, warpStatus: 0, countryResidence: "NZ", countryOrigin: "NZ" },
      { playerId: liam._id,  entryNo: "2", playerName: "Liam U.",  playerEmail: "liam@gmail.com",  enteredAt: splitAt, joinedBoardAt: new Date("2026-04-01T07:15:00Z"), cardType: null, salesCredits: 0, warpStatus: 0, countryResidence: "CA", countryOrigin: "CA" },
    ],

    atBat: [null, null, null, null, null, null, null, null],

    dugout: [
      { playerId: pam._id, entryNo: "2", playerName: "Pam Q.", playerEmail: "pam@gmail.com", enteredAt: splitAt, joinedBoardAt: new Date("2026-04-01T07:30:00Z"), countryResidence: "IT", countryOrigin: "IT", referredBy: mike._id, referredByName: "Mike N." },
    ],

    // Quinn moved to on-deck circle (3rd dugout player, board split without needing her)
    onDeckCircle: [
      { playerId: quinn._id, entryNo: "2", playerName: "Quinn R.", playerEmail: "quinn@gmail.com", enteredAt: splitAt, joinedBoardAt: new Date("2026-04-01T08:00:00Z"), countryResidence: "ES", countryOrigin: "ES", referredBy: frank._id, referredByName: "Frank G." },
    ],

    hotBox: [
      { cardType: "Gold",  playerId: eve._id,  assignedAt: splitAt },
      { cardType: "Black", playerId: mike._id, assignedAt: splitAt },
    ],

    leaderBoard: [
      { tier: "G", playerId: null,         qualifiedAt: null },
      { tier: "H", playerId: shorupan._id, qualifiedAt: new Date("2026-03-01T00:00:00Z") },
      { tier: "T", playerId: alan._id,     qualifiedAt: new Date("2026-03-01T00:00:00Z") },
    ],

    penciling: [],
    prePick: [],
  });

  console.log(`Board 3 (Right) created: ${board3._id}`);

  // ── Wire Board 1's child IDs back ──────────────────────────────────────────
  await Bat246Board.updateOne({ _id: board1._id }, {
    $set: { leftChildBoardId: board2._id, rightChildBoardId: board3._id },
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Player-board memberships
  // ══════════════════════════════════════════════════════════════════════════
  const board1Memberships = [
    { playerId: jeff._id,     position: "homePlate" },
    { playerId: nina._id,     position: "thirdBase" },
    { playerId: kevin._id,    position: "secondBaseA" },
    { playerId: mike._id,     position: "secondBaseB" },
    { playerId: shorupan._id, position: "firstBase.A" },
    { playerId: alan._id,     position: "firstBase.B" },
    { playerId: bill._id,     position: "firstBase.C" },
    { playerId: patrick._id,  position: "firstBase.D" },
    { playerId: alice._id,    position: "atBat.0" },
    { playerId: bob._id,      position: "atBat.1" },
    { playerId: carol._id,    position: "atBat.2" },
    { playerId: dan._id,      position: "atBat.3" },
    { playerId: eve._id,      position: "atBat.4" },
    { playerId: frank._id,    position: "atBat.5" },
    { playerId: grace._id,    position: "atBat.6" },
    { playerId: oscar._id,    position: "dugout.0" },
    { playerId: pam._id,      position: "dugout.1" },
    { playerId: quinn._id,    position: "dugout.2" },
    { playerId: sam._id,      position: "dugout.3" },
    { playerId: liam._id,     position: "atBat.7" },
  ];

  await Bat246PlayerBoard.insertMany(
    board1Memberships.map(m => ({
      playerId: m.playerId, boardId: board1._id,
      position: m.position, status: "left", joinedAt: now, leftAt: splitAt,
    }))
  );

  const board2Memberships = [
    { playerId: nina._id,     position: "homePlate" },
    { playerId: kevin._id,    position: "thirdBase" },
    { playerId: shorupan._id, position: "secondBaseA" },
    { playerId: alan._id,     position: "secondBaseB" },
    { playerId: alice._id,    position: "firstBase.A" },
    { playerId: bob._id,      position: "firstBase.B" },
    { playerId: carol._id,    position: "firstBase.C" },
    { playerId: dan._id,      position: "firstBase.D" },
    { playerId: oscar._id,    position: "dugout.0" },
    { playerId: sam._id,      position: "atBat.0" },
  ];

  await Bat246PlayerBoard.insertMany(
    board2Memberships.map(m => ({
      playerId: m.playerId, boardId: board2._id,
      position: m.position, status: "active", joinedAt: splitAt,
    }))
  );

  const board3Memberships = [
    { playerId: nina._id,     position: "homePlate" },
    { playerId: mike._id,     position: "thirdBase" },
    { playerId: bill._id,     position: "secondBaseA" },
    { playerId: patrick._id,  position: "secondBaseB" },
    { playerId: eve._id,      position: "firstBase.A" },
    { playerId: frank._id,    position: "firstBase.B" },
    { playerId: grace._id,    position: "firstBase.C" },
    { playerId: liam._id,     position: "firstBase.D" },
    { playerId: pam._id,      position: "dugout.0" },
    { playerId: quinn._id,    position: "onDeckCircle.0" },
  ];

  await Bat246PlayerBoard.insertMany(
    board3Memberships.map(m => ({
      playerId: m.playerId, boardId: board3._id,
      position: m.position, status: "active", joinedAt: splitAt,
    }))
  );

  // ══════════════════════════════════════════════════════════════════════════
  // Green Card ledger (immutable)
  // All 4 first-base players' 2 Green Cards each; also Alice's Gold at AB position
  // ══════════════════════════════════════════════════════════════════════════
  await Bat246SalesCredit.insertMany([
    // Shorupan — 2 Gold BCs from 1st Base A (these are his early BCs, before his LB history)
    { boardId: board1._id, playerId: shorupan._id, playerName: "Shorupan P.", position: "firstBase.A", cardType: "Gold", countsForLB: true, saleAmount: 650, earnedAt: new Date("2026-03-31T22:00:00Z") },
    { boardId: board1._id, playerId: shorupan._id, playerName: "Shorupan P.", position: "firstBase.A", cardType: "Gold", countsForLB: true, saleAmount: 650, earnedAt: new Date("2026-03-31T22:10:00Z") },
    // Alan — 1 Gold BC from 1st Base B
    { boardId: board1._id, playerId: alan._id,     playerName: "Alan M.",     position: "firstBase.B", cardType: "Gold", countsForLB: true, saleAmount: 650, earnedAt: new Date("2026-05-19T07:00:00Z") },
    { boardId: board1._id, playerId: alan._id,     playerName: "Alan M.",     position: "firstBase.B", cardType: "Gold", countsForLB: true, saleAmount: 650, earnedAt: new Date("2026-05-19T08:00:00Z") },
    // Bill — 2 Gold BCs from 1st Base C
    { boardId: board1._id, playerId: bill._id,     playerName: "Bill R.",     position: "firstBase.C", cardType: "Gold", countsForLB: true, saleAmount: 650, earnedAt: new Date("2026-05-19T08:30:00Z") },
    { boardId: board1._id, playerId: bill._id,     playerName: "Bill R.",     position: "firstBase.C", cardType: "Gold", countsForLB: true, saleAmount: 650, earnedAt: new Date("2026-05-19T09:00:00Z") },
    // Patrick — 2 Gold BCs from 1st Base D (his 2nd Green Card triggered the split!)
    { boardId: board1._id, playerId: patrick._id,  playerName: "Patrick S.",  position: "firstBase.D", cardType: "Gold", countsForLB: true, saleAmount: 650, earnedAt: new Date("2026-05-19T09:30:00Z") },
    { boardId: board1._id, playerId: patrick._id,  playerName: "Patrick S.",  position: "firstBase.D", cardType: "Gold", countsForLB: true, saleAmount: 650, earnedAt: new Date("2026-05-19T09:58:00Z") }, // ← SPLIT TRIGGER
    // Alice — Gold BC at At Bat (Board 1)
    { boardId: board1._id, playerId: alice._id,    playerName: "Alice J.",    position: "atBat.0",     cardType: "Gold", countsForLB: true, saleAmount: 650, earnedAt: new Date("2026-04-01T00:15:00Z") },
    // Alice — 1st Green Card at 1st Base A (Board 2): Sam T. joined AB1 referred by Alice
    { boardId: board2._id, playerId: alice._id,    playerName: "Alice J.",    position: "firstBase.A", cardType: "Gold", countsForLB: true, saleAmount: 650, earnedAt: splitAt },
  ]);

  console.log("Sales credits seeded.");

  // ── Seed $1 Bat246 entry product ─────────────────────────────────────────
  // Requires an existing Organization + User in the DB. Skips gracefully if absent.
  // Set BAT246_ORG_ID env var to target a specific org; otherwise uses the admin's org.
  try {
    const { Organization } = require("../../models/organization.model");
    const { User } = require("../../models/user.model");

    const admin = await User.findOne({ role: { $in: ["admin", "founder", "superAdmin"] } }).lean() as any;
    const orgId = process.env.BAT246_ORG_ID || admin?.organizationId;
    const org   = orgId ? await Organization.findById(orgId).lean() : await Organization.findOne().lean() as any;

    if (org && admin) {
      let entryProductId: any;
      const existing = await Product.findOne({ tags: "bat246_entry" }).lean();
      if (!existing) {
        const p246 = await Product.create({
          organizationId: org._id,
          createdBy: admin._id,
          name: "Bat246 Board Entry",
          slug: "bat246-board-entry",
          description: "Purchase a position on a new Bat246 board. You will be placed at Home Plate.",
          sku: "BAT246-ENTRY-001",
          price: 1,
          currency: "USD",
          isDigital: true,
          requiresShipping: false,
          deliveryMethod: "digital",
          status: "active",
          tags: ["bat246_entry"],
          trackQuantity: false,
        });
        entryProductId = p246._id;
        console.log(`Bat246 $1 entry product created: ${p246._id}  (org: ${org.name})`);
      } else {
        entryProductId = (existing as any)._id;
        console.log(`Bat246 $1 entry product already exists: ${(existing as any)._id}`);
      }
      // Wire inviteProductId on all boards
      await Bat246Board.updateMany({}, { $set: { inviteProductId: entryProductId } });
      console.log(`inviteProductId set on all boards → ${entryProductId}`);
    } else {
      console.log("⚠  No org/admin found — skipping product seed. Create manually via Digital Products UI.");
    }
  } catch (productErr: any) {
    console.warn("⚠  Product seed skipped:", productErr.message);
  }

  console.log("");
  console.log("━━━ SEED COMPLETE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Board 1 (split):    ${board1._id}  → 1-100`);
  console.log(`Board 2 (Left):     ${board2._id}  → 1-101 L`);
  console.log(`Board 3 (Right):    ${board3._id}  → 1-102 R`);
  console.log("");
  console.log("Split trigger: Patrick S. (1st Base D) earned his 2nd Green Card");
  console.log("  at 2026-05-19T09:58Z — all 4 × 1st Base players at 2 Green Cards.");
  console.log("The lobby shows Board 2 and Board 3 (both active).");
  console.log("Board 1 is viewable via its direct URL (linked from Board 2/3).");
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});

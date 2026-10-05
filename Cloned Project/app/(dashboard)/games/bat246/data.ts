export type CardType = "Gold" | "Black" | "Brown" | "Gray";

export interface PlayerSlot {
  entryNo: string;
  playerName: string;
  playerEmail: string;
  date: string;
  time: string;
  salesCredits?: number; // 1st base only: 0-2
  cards?: CardType[];
}

export interface HotBoxEntry {
  cardType: CardType;
  playerName: string;
  date: string;
}

export interface LeaderBoardRow {
  id: "G" | "H" | "T";
  label: string;
  playerName: string | null;
  earnings: number;
  maxEarnings: number;
  color: string;
}

export interface BoardData {
  boardNumber: number;
  trackingNumber: string;
  title: string;
  /** Fixed future date used as protection-period countdown target */
  protectionPeriodEnd: Date;
  minorLeagueAmount: number;
  atBat: (PlayerSlot | null)[];        // 8 slots: AB1-AB2 under 1BA, AB3-AB4 under 1BB, AB5-AB6 under 1BC, AB7-AB8 under 1BD
  firstBase: (PlayerSlot | null)[];    // 4 slots: 1BA+1BB under 2nd Base A, 1BC+1BD under 2nd Base B
  secondBaseA: (PlayerSlot | null)[];  // 1 slot
  secondBaseB: (PlayerSlot | null)[];  // 1 slot
  thirdBase: (PlayerSlot | null)[];    // 1 slot (centered above 2nd Base A and B)
  homePlate: PlayerSlot | null;        // 1 slot
  dugout: (PlayerSlot | null)[];       // 8 slots
  hotBox: HotBoxEntry[];
  leaderBoard: LeaderBoardRow[];
}

// PP ends ~5 days from May 18 2026 EST (= May 23 05:01 UTC)
const PP_END = new Date("2026-05-23T05:01:00Z");

export const BOARD_1: BoardData = {
  boardNumber: 1,
  trackingNumber: "1-2000",
  title: "1 of 4 Board Basics",
  protectionPeriodEnd: PP_END,
  minorLeagueAmount: 600,

  leaderBoard: [
    { id: "G", label: "Grand Slam", playerName: null,          earnings: 0,     maxEarnings: 150000, color: "#ef4444" },
    { id: "H", label: "Home Run",   playerName: "Shorupan P.", earnings: 14200, maxEarnings: 100000, color: "#f59e0b" },
    { id: "T", label: "Triple",     playerName: "Alan M.",     earnings: 5300,  maxEarnings: 50000,  color: "#6366f1" },
  ],

  atBat: [
    { entryNo: "AB-001", playerName: "Alice J.",   playerEmail: "alice@gmail.com",   date: "Apr 01", time: "00:15", cards: ["Gold"] },
    { entryNo: "AB-002", playerName: "Bob C.",     playerEmail: "bob@gmail.com",     date: "Apr 01", time: "01:20" },
    { entryNo: "AB-003", playerName: "Carol D.",   playerEmail: "carol@gmail.com",   date: "Apr 01", time: "02:45" },
    { entryNo: "AB-004", playerName: "Dan E.",     playerEmail: "dan@gmail.com",     date: "Apr 01", time: "03:10" },
    { entryNo: "AB-005", playerName: "Eve F.",     playerEmail: "eve@gmail.com",     date: "Apr 01", time: "04:00" },
    { entryNo: "AB-006", playerName: "Frank G.",   playerEmail: "frank@gmail.com",   date: "Apr 01", time: "05:30" },
    { entryNo: "AB-007", playerName: "Grace H.",   playerEmail: "grace@gmail.com",   date: "Apr 01", time: "06:15" },
    null,
  ],

  firstBase: [
    { entryNo: "1B-001", playerName: "Shorupan P.", playerEmail: "shorupan@gmail.com", date: "Mar 31", time: "22:00", salesCredits: 2, cards: ["Gold"] },
    { entryNo: "1B-002", playerName: "Alan M.",     playerEmail: "alan@gmail.com",     date: "Mar 31", time: "22:30", salesCredits: 1, cards: ["Gold"] },
    { entryNo: "1B-003", playerName: "Bill R.",     playerEmail: "bill@gmail.com",     date: "Mar 31", time: "23:00", salesCredits: 1 },
    { entryNo: "1B-004", playerName: "Patrick S.",  playerEmail: "patrick@gmail.com",  date: "Mar 31", time: "23:45", salesCredits: 0 },
  ],

  secondBaseA: [
    { entryNo: "2A-001", playerName: "Kevin L.", playerEmail: "kevin@gmail.com", date: "Mar 30", time: "10:00", cards: ["Gold", "Black"] },
  ],

  secondBaseB: [
    { entryNo: "2B-001", playerName: "Mike N.", playerEmail: "mike@gmail.com", date: "Mar 29", time: "09:00", cards: ["Gold", "Black"] },
  ],

  thirdBase: [
    { entryNo: "3B-001", playerName: "Nina O.", playerEmail: "nina@gmail.com", date: "Mar 28", time: "11:00", cards: ["Gold", "Black"] },
  ],

  homePlate: { entryNo: "HP-001", playerName: "Jeff D.", playerEmail: "jeff@gmail.com", date: "Mar 27", time: "07:29", cards: ["Gold", "Black", "Brown"] },

  dugout: [
    { entryNo: "DG-001", playerName: "Oscar P.",  playerEmail: "oscar@gmail.com",  date: "Apr 01", time: "07:00" },
    { entryNo: "DG-002", playerName: "Pam Q.",    playerEmail: "pam@gmail.com",    date: "Apr 01", time: "07:30" },
    { entryNo: "DG-003", playerName: "Quinn R.",  playerEmail: "quinn@gmail.com",  date: "Apr 01", time: "08:00" },
    null, null, null, null, null,
  ],

  hotBox: [
    { cardType: "Gold",  playerName: "Shorupan P.", date: "Apr 01" },
    { cardType: "Gold",  playerName: "Alan M.",     date: "Apr 01" },
    { cardType: "Black", playerName: "Mike N.",     date: "Mar 29" },
  ],
};

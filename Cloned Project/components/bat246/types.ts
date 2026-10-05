export type CardType = "Gold" | "Black" | "Brown" | "Gray" | "Green" | "NoCard" | null;

export interface SlotData {
  playerId?: string;
  entryNo?: string;
  playerName?: string;
  distributorId?: string;
  playerEmail?: string;
  enteredAt?: string;
  joinedBoardAt?: string;
  cardType?: CardType;
  salesCredits?: number;
  goldCards?: number;
  blackCards?: number;
  brownCards?: number;
  grayCards?: number;
  freeGrayCards?: number;
  grayCard160?: number;
  noCards?: number;
  /** Permanent leaderboard trophies earned by this player (any board). */
  trophies?: { G?: boolean; H?: boolean; T?: boolean };
  warpStatus?: number;
  referredBy?: string | null;
  referredByName?: string | null;
  isCPD?: boolean;
  isCompanyInvitee?: boolean;
  isLayaway?: boolean;
  isLayawayPlan?: boolean;
  layawayBalance?: number;
  countryResidence?: string | null;
  countryOrigin?: string | null;
  totalEarning?: number;
  hpReferralBonusCount?: number;
  /** Set on all 4 members of a POD cycle (the 3 board.pod[] seats + the 4th
   * entrant's dugout/atBat slot) — e.g. "P-1001". When set on a dugout/atBat
   * slot, the UI shows this instead of the player's name, clickable to a
   * popup listing all 4 team members (GET /bat246/pod-team/:teamId). */
  podTeamId?: string | null;
}

export interface HotBoxEntry {
  cardType: "Gold" | "Black" | "Brown" | "Gray" | "Green";
  playerId?: string;
  playerName?: string | null;
  entryNo?: string | null;
  assignedAt?: string;
}

export interface LeaderBoardRow {
  tier: "G" | "H" | "T";
  playerId?: string | null;
  playerName?: string | null;
  distributorId?: string | null;
  entryNo?: string | null;
  earnings?: number;
  totalBCs?: number;
  cardsEarned?: { gold: number; black: number; brown: number; gray: number; green: number; noCard: number; freeGray?: number; gray160?: number } | null;
  qualifiedAt?: string | null;
  countryResidence?: string | null;
  countryOrigin?: string | null;
}

export interface PencilingEntry {
  playerId: string;
  targetAbSlot: string;
  expiresAt: string;
  penciledAt: string;
}

export interface PrePickEntry {
  playerId: string;
  targetAbSlot: string;
  createdAt: string;
}

export interface BoardData {
  _id: string;
  boardNumber: number;
  trackingNumber: string;
  title?: string;
  status: "pending" | "active" | "splitting" | "split" | "completed" | "stalled";
  hidden?: boolean;
  inviteProductId?: string | null;
  generation: number;
  side: "left" | "right" | null;
  parentBoardId?: string | null;
  leftChildBoardId?: string | null;
  rightChildBoardId?: string | null;
  splitAt?: string | null;
  protectionPeriodEnd: string;
  ppPausedRemainingMs?: number | null;
  warpCount: 0 | 1 | 2 | 3 | 4;
  minorLeagueAmount: number;
  nextHomePlatePayout?: number;
  homePlate: SlotData | null;
  thirdBase: SlotData | null;
  secondBaseA: SlotData | null;
  secondBaseB: SlotData | null;
  firstBase: (SlotData | null)[];
  atBat: (SlotData | null)[];
  dugout: (SlotData | null)[];
  onDeckCircle: SlotData[];
  /** 3 visual POD gondola seats — the 4th POD-cycle placement goes to Dugout
   * (or straight to AT BAT if PP already expired) instead of occupying a
   * seat, see bat246_pod_invite.md. */
  pod?: (SlotData | null)[];
  /** This board's POD cycle team ID (e.g. "P-1001"), set once the first
   * member joins. Never carried onto child boards on a split. */
  podTeamId?: string | null;
  hotBox: HotBoxEntry[];
  penciling: PencilingEntry[];
  prePick: PrePickEntry[];
  leaderBoard: LeaderBoardRow[];
  createdAt: string;
}

export interface PositionReservation {
  position: string;
  reservedByEmail: string;
  reservedAt: string;
  expiresAt: string;
  status: "active" | "used" | "expired";
}

export interface PositionStatus {
  key: string;
  status: "filled" | "blank" | "reserved";
  expiresAt?: string;
}

export interface BoardSummary {
  _id: string;
  boardNumber: number;
  trackingNumber: string;
  title?: string;
  hidden?: boolean;
  status: BoardData["status"];
  warpCount: BoardData["warpCount"];
  protectionPeriodEnd: string;
  minorLeagueAmount: number;
  leaderBoard: LeaderBoardRow[];
  inviteProductId?: string | null;
  createdAt: string;
  positions?: PositionStatus[];
}

/**
 * Shared formatter for the `cardBack` snapshot stored on Green Card
 * SalesCredit records. Pure/sync — callers pass in data they already have
 * in scope so this adds zero extra DB queries at any call site.
 */

interface PlayerLite {
  nickname?: string | null;
  email?: string | null;
  playerIdNo?: string | null;
}

export interface BuildGreenCardBackInput {
  /** The player who earned the Green Card (1st or 2nd Base occupant). */
  earner: PlayerLite | null | undefined;
  earnerEntryNo: string | null | undefined;
  /** Raw position key the earner occupies, e.g. "1stA" | "secondBaseA" | "secondBaseB". */
  earnerPosition: string;
  /** The newly-placed player whose entry triggered the Green Card. */
  referred: PlayerLite | null | undefined;
  referredPlayerId: unknown;
  referredEntryNo: string | null | undefined;
  /** Raw position key the referred player landed in, e.g. "atBat-3" | "1stA". */
  referredPosition: string;
  boardTrackingNo: string | null | undefined;
  issuedAt: Date;
}

function firstBaseLetter(position: string): "A" | "B" | "C" | "D" | null {
  const m = /^1st([A-D])$/.exec(position);
  return (m?.[1] as "A" | "B" | "C" | "D" | undefined) ?? null;
}

function displayName(p: PlayerLite | null | undefined): string {
  return p?.nickname || p?.email || "";
}

export function buildGreenCardBack(input: BuildGreenCardBackInput) {
  return {
    assignedTo: {
      playerName: displayName(input.earner),
      playerIdNo: input.earner?.playerIdNo ?? null,
      entryNo: input.earnerEntryNo ?? null,
    },
    position: input.earnerPosition,
    freePositionAssignedTo: input.referredPlayerId ?? null,
    freePosition: {
      playerName: displayName(input.referred),
      playerIdNo: input.referred?.playerIdNo ?? null,
      entryNo: input.referredEntryNo ?? null,
    },
    atBatPositionNo: input.referredPosition,
    firstBasePosition: firstBaseLetter(input.earnerPosition),
    issuedAt: input.issuedAt,
    boardTrackingNo: input.boardTrackingNo ?? null,
  };
}

export interface BuildNoCardCardBackInput {
  /** The gold card earner — "stole" from the NoCard holder. */
  stolenBy: PlayerLite | null | undefined;
  stolenByEntryNo: string | null | undefined;
  stolenByPlayerId?: unknown;
  stolenByPosition: string;
  cardEarned: string;
  /** The NoCard holder themselves. */
  stolenFrom: PlayerLite | null | undefined;
  stolenFromEntryNo: string | null | undefined;
  stolenFromPlayerId?: unknown;
  stolenFromPosition: string | null | undefined;
  boardTrackingNo: string | null | undefined;
  issuedAt: Date;
}

export function buildNoCardCardBack(input: BuildNoCardCardBackInput) {
  return {
    stolenBy: input.stolenBy
      ? {
          playerName: displayName(input.stolenBy),
          playerIdNo: input.stolenBy.playerIdNo ?? null,
          entryNo: input.stolenByEntryNo ?? null,
          playerId: input.stolenByPlayerId ?? null,
        }
      : null,
    position: input.stolenByPosition,
    cardEarned: input.cardEarned,
    stolenFrom: input.stolenFrom
      ? {
          playerName: displayName(input.stolenFrom),
          playerIdNo: input.stolenFrom.playerIdNo ?? null,
          entryNo: input.stolenFromEntryNo ?? null,
          playerId: input.stolenFromPlayerId ?? null,
        }
      : null,
    stolenFromPosition: input.stolenFromPosition ?? null,
    issuedAt: input.issuedAt,
    boardTrackingNo: input.boardTrackingNo ?? null,
  };
}

export interface BuildGoldCardBackInput extends BuildGreenCardBackInput {
  stolenFrom?: PlayerLite | null;
  stolenFromPlayerId?: unknown;
  stolenFromEntryNo?: string | null;
  stolenFromPosition?: string | null;
}

export function buildGoldCardBack(input: BuildGoldCardBackInput) {
  return {
    ...buildGreenCardBack(input),
    stolenFrom: input.stolenFrom
      ? {
          playerName: displayName(input.stolenFrom),
          playerIdNo: input.stolenFrom.playerIdNo ?? null,
          entryNo: input.stolenFromEntryNo ?? null,
          playerId: input.stolenFromPlayerId ?? null,
        }
      : null,
    stolenFromPosition: input.stolenFromPosition ?? null,
  };
}

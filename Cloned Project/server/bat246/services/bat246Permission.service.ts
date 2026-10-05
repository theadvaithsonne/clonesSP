import { Types } from "mongoose";
import { Bat246CardPermission, Bat246CardKey } from "../models/bat246CardPermission.model";
import { User } from "../../models/user.model";

// Same constant every Bat246 admin route file hardcodes independently —
// not consolidated here on purpose (established pattern in this codebase,
// see CLAUDE.md-adjacent notes in bat246LostMoney.routes.ts).
export const ALAN_K_EMAIL = "redbaron2020@mail.com";

// Same org ID every Bat246 route file already hardcodes independently
// (bat246.routes.ts, bat246Permission.routes.ts, bat246Layaway.service.ts) —
// duplicated here on purpose, matching that same established pattern.
const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";

// Cards every Bat246-office member gets automatically, just by being in the
// org — no board position and no explicit per-person grant needed. This is
// the org-membership equivalent of the "legacy" board-position access
// bat246Permission.routes.ts already computes for boards/members/
// distributors/inviteandplace. Single source of truth — imported by
// bat246Permission.routes.ts's people-matrix rather than re-declared there,
// so the two can never drift apart.
export const DEFAULT_ORG_CARD_KEYS: Bat246CardKey[] = ["documentation", "b2coinwallet"];

async function isBat246OrgMember(userId: string | undefined | null): Promise<boolean> {
  if (!userId || !Types.ObjectId.isValid(userId)) return false;
  const user = await User.findById(userId).select("organizations").lean() as any;
  return !!user?.organizations?.some((o: any) => o.organization?.toString() === BAT246_ORG_ID);
}

// Alan always has full access to every card. Anyone else needs an explicit
// grant for at least one of the given cardKeys (routes that share backend
// authority, e.g. Distributors + Invite and Place, pass both) — or, for
// documentation/b2coinwallet, just needs to already be a Bat246-office
// member (see DEFAULT_ORG_CARD_KEYS above).
export async function isBat246CardAdmin(
  email: string | undefined | null,
  userId: string | undefined | null,
  ...cardKeys: Bat246CardKey[]
): Promise<boolean> {
  if (email?.toLowerCase() === ALAN_K_EMAIL) return true;
  if (!userId || cardKeys.length === 0) return false;
  if (cardKeys.some(k => DEFAULT_ORG_CARD_KEYS.includes(k)) && (await isBat246OrgMember(userId))) return true;
  const grant = await Bat246CardPermission.findOne({
    userId,
    cardKey: { $in: cardKeys },
  })
    .select("_id")
    .lean();
  return !!grant;
}

// All cardKeys a given (non-Alan) user currently holds — explicit grants
// plus the org-wide defaults (documentation, b2coinwallet) if they're a
// Bat246-office member.
export async function getGrantedCardKeys(userId: string | undefined | null): Promise<Bat246CardKey[]> {
  if (!userId) return [];
  const [grants, isOrgMember] = await Promise.all([
    Bat246CardPermission.find({ userId }).select("cardKey").lean(),
    isBat246OrgMember(userId),
  ]);
  const keys = new Set<Bat246CardKey>(grants.map((g: any) => g.cardKey as Bat246CardKey));
  if (isOrgMember) DEFAULT_ORG_CARD_KEYS.forEach(k => keys.add(k));
  return Array.from(keys);
}

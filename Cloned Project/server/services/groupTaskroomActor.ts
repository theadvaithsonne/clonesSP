// src/services/groupTaskroomActor.ts
//
// Who the server acts as when it calls Taskroom on a linked group's behalf.
//
// Taskroom v2 authenticates every call as a person: the Garage JWT must map to
// an active tr2_user in the same org, or it answers 401 "Unauthorized". The
// server therefore mints a short-lived token for somebody who is known to have
// that record, and falls through a list of candidates when one is refused:
//
//   1. `preferUserId` — the person the action is really theirs (the reporter of
//      an AI task), when member sync has confirmed their Taskroom account.
//   2. The admin who linked the board — they had Taskroom access at link time.
//   3. Any other group admin, then the group creator, the sync has confirmed.
//
// A candidate refused with 401 is skipped; any other error is the call's own
// failure and is thrown to the caller unchanged.

import { mintUserToken } from "./taskroomProvision";

export class NoTaskroomActorError extends Error {
  constructor(message = "Nobody in this group can act on the linked Taskroom board") {
    super(message);
    this.name = "NoTaskroomActorError";
  }
}

/**
 * Taskroom's auth middleware answers every refusal with exactly
 * "Unauthorized" (401). Matched whole, not as a substring: controllers also
 * answer 400 "Unauthorized for this operation" when the person HAS an account
 * but is not on the board — that is the call's own failure, not a reason to
 * try somebody else (and treating it as one would wrongly mark a link broken).
 */
export function isTaskroomUnauthorized(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return /^unauthori[sz]ed\.?$/i.test(message.trim());
}

/**
 * Ordered, de-duplicated Garage user ids to act as for this group.
 * `group` is a lean or hydrated Group document with a `taskroom` link.
 */
export function taskroomActorCandidates(group: any, preferUserId?: string): string[] {
  const link = group?.taskroom;
  if (!link) return [];

  const synced = new Set<string>(
    (link.members || [])
      .filter((m: any) => m?.status === "synced" && m?.taskroomUserId)
      .map((m: any) => String(m.userId))
  );

  const ordered: string[] = [];
  const push = (id: unknown) => {
    if (!id) return;
    const s = String(id);
    if (!ordered.includes(s)) ordered.push(s);
  };

  const inGroup = new Set<string>(
    (group.members || []).map((m: any) => String(m.userId))
  );

  if (preferUserId && synced.has(String(preferUserId))) push(preferUserId);
  // Taskroom never hears about org or group removals, so a linker who has
  // left must stop being the account the server acts as. A support chat's
  // linker is the support board owner, who is never in the chat
  // (`actorOrgId` marks those links) — they always act.
  if (link.linkedBy && (link.actorOrgId || inGroup.has(String(link.linkedBy)))) {
    push(link.linkedBy);
  }
  for (const m of group.members || []) {
    if (m?.role === "admin" && synced.has(String(m.userId))) push(m.userId);
  }
  if (group.createdBy && synced.has(String(group.createdBy))) push(group.createdBy);

  return ordered;
}

/**
 * Run `fn` with a Taskroom token for the first candidate Taskroom accepts.
 * Returns the result and who it ran as. Throws NoTaskroomActorError when every
 * candidate is refused (or there are none).
 */
export async function withTaskroomActor<T>(
  group: any,
  fn: (token: string, actorUserId: string) => Promise<T>,
  preferUserId?: string
): Promise<{ result: T; actorUserId: string }> {
  // Support links act in the board owner's org, not the customer's.
  const orgId = group?.taskroom?.actorOrgId || group?.orgId;
  if (!orgId) throw new NoTaskroomActorError("Group has no org");

  for (const userId of taskroomActorCandidates(group, preferUserId)) {
    const token = await mintUserToken(userId, orgId);
    try {
      const result = await fn(token, userId);
      return { result, actorUserId: userId };
    } catch (error) {
      if (isTaskroomUnauthorized(error)) continue;
      throw error;
    }
  }
  throw new NoTaskroomActorError();
}

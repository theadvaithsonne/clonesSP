// Short-lived, in-memory record of who is typing in which group.
//
// The apps show typing over the socket, but the admin support-chats console has
// no socket (it polls). The group:typing socket handler records here, and the
// console polls GET /garage-admin/support-chats/:groupId/typing to read it.
//
// In-memory on purpose: typing is ephemeral (a few seconds), single pm2 fork,
// and losing it on deploy is harmless.

const typing = new Map<string, Map<string, number>>(); // groupId -> userId -> expiresAt
/** A keystroke keeps the user "typing" for this long; the app re-emits as they
 *  keep typing, so this only lapses once they actually stop. */
const TTL_MS = 6000;

export function markTyping(groupId: string, userId: string): void {
  let g = typing.get(groupId);
  if (!g) {
    g = new Map();
    typing.set(groupId, g);
  }
  g.set(userId, Date.now() + TTL_MS);
}

export function clearTyping(groupId: string, userId: string): void {
  typing.get(groupId)?.delete(userId);
}

/** Currently-typing user ids for a group, pruning anything expired. */
export function typingUserIds(groupId: string): string[] {
  const g = typing.get(groupId);
  if (!g) return [];
  const now = Date.now();
  const out: string[] = [];
  for (const [uid, exp] of g) {
    if (exp > now) out.push(uid);
    else g.delete(uid);
  }
  if (g.size === 0) typing.delete(groupId);
  return out;
}

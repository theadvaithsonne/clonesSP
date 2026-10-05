import mongoose, { Types } from 'mongoose';

// Access shared collections from contacts-backend's MongoDB
const Users = mongoose.connection.collection('users');
const MeetSessions = mongoose.connection.collection('meetsessions');

export interface ResolvedParticipant {
  identity: string;
  name: string;
  email: string | null;
}

/**
 * Resolve email addresses for meeting participants.
 *
 * The LiveKit identity can be either a userId (ObjectId string) or a display name
 * (e.g. "Starfish") depending on how contacts-backend generates tokens.
 * We try multiple strategies:
 *   1. If email is already set on the participant
 *   2. Look up by identity as a userId (_id)
 *   3. Look up by userId field if present
 *   4. Look up by name/displayName in the users collection
 *   5. Fall back to MeetSession.createdBy (covers instant meetings with one host)
 */
export async function resolveParticipantEmails(
  participants: { identity: string; name?: string; userId?: any; email?: string }[],
  roomName?: string,
): Promise<ResolvedParticipant[]> {
  const resolved: ResolvedParticipant[] = [];
  const foundEmails = new Set<string>();

  for (const p of participants) {
    // 1. Email already known
    if (p.email) {
      resolved.push({ identity: p.identity, name: p.name || p.identity, email: p.email });
      foundEmails.add(p.email);
      continue;
    }

    // Skip guest participants
    if (p.identity.startsWith('guest-')) {
      resolved.push({ identity: p.identity, name: p.name || p.identity, email: null });
      continue;
    }

    // 2. Try identity as userId (ObjectId)
    let email = await lookupEmailByObjectId(p.identity);

    // 3. Try userId field
    if (!email && p.userId) {
      email = await lookupEmailByObjectId(p.userId);
    }

    // 4. Try searching by name/displayName
    if (!email) {
      const searchName = p.name || p.identity;
      email = await lookupEmailByName(searchName);
    }

    if (email) {
      resolved.push({ identity: p.identity, name: p.name || p.identity, email });
      foundEmails.add(email);
    } else {
      resolved.push({ identity: p.identity, name: p.name || p.identity, email: null });
    }
  }

  // 5. Fallback: if we still have no emails, check MeetSession.createdBy
  if (foundEmails.size === 0 && roomName) {
    const meetSession = await MeetSessions.findOne(
      { roomName },
      { projection: { createdBy: 1 } },
    );
    if (meetSession?.createdBy) {
      const email = await lookupEmailByObjectId(meetSession.createdBy);
      if (email) {
        console.log(`[ParticipantResolver] Resolved email from MeetSession.createdBy: ${email}`);
        resolved.push({ identity: 'host', name: 'Meeting Host', email });
      }
    }
  }

  return resolved;
}

async function lookupEmailByObjectId(id: any): Promise<string | null> {
  try {
    const objectId = typeof id === 'string' ? new Types.ObjectId(id) : id;
    const user = await Users.findOne(
      { _id: objectId },
      { projection: { email: 1 } },
    );
    return (user?.email as string) || null;
  } catch {
    return null;
  }
}

async function lookupEmailByName(name: string): Promise<string | null> {
  if (!name || name.length < 2) return null;
  try {
    const user = await Users.findOne(
      { name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } },
      { projection: { email: 1 } },
    );
    return (user?.email as string) || null;
  } catch {
    return null;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

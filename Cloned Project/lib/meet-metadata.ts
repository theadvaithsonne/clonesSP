export interface ParticipantMeta {
  isHost: boolean;
  isBot: boolean;
  /** Webinar-only — true when the participant joined via a /webinars
   *  /:id/token call as a co-host. The People panel uses this to
   *  drive the inline promote/demote chevrons; without it, the panel
   *  can't tell a co-host from a regular attendee. */
  isCoHost?: boolean;
  /** Webinar-only — true when the participant is a TV preview
   *  subscriber (joined via /webinars/:id/audience-token). These
   *  viewers don't publish anything; the People panel + VideoGrid
   *  hide them so they don't clutter the host's view. */
  isAudience?: boolean;
  /** Webinar-only — discriminator carrying "host" / "co-host" /
   *  "viewer" / "audience". Useful when isHost / isCoHost are both
   *  false but we still want a stable role string for badges. */
  role?: 'host' | 'co-host' | 'viewer' | 'audience' | string;
  avatar?: string;
  displayName?: string;
  userId?: string;
}

export function parseParticipantMeta(metadata: string | undefined): ParticipantMeta {
  if (!metadata) return { isHost: false, isBot: false };
  try {
    const m = JSON.parse(metadata) as Partial<ParticipantMeta>;
    return {
      isHost: m.isHost === true,
      isBot: m.isBot === true,
      isCoHost: m.isCoHost === true,
      isAudience: m.isAudience === true,
      role: typeof m.role === 'string' ? (m.role as ParticipantMeta['role']) : undefined,
      avatar:
        typeof m.avatar === 'string' && m.avatar.length > 0 ? m.avatar : undefined,
      displayName:
        typeof m.displayName === 'string' ? m.displayName : undefined,
      userId: typeof m.userId === 'string' ? m.userId : undefined,
    };
  } catch {
    return { isHost: false, isBot: false };
  }
}

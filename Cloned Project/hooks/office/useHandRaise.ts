'use client';

import { useCallback, useState, useMemo } from 'react';
import { useDataChannel, useLocalParticipant } from '@livekit/components-react';

const HAND_TOPIC = 'hand-raise';

interface HandRaisePayload {
  userId: string;
  name: string;
  raised: boolean;
  ts: number;
}

/**
 * Hand-raise state for the meeting. Broadcasts via LiveKit's
 * DataChannel — every participant sees a synchronized set of raised
 * hands. No backend involvement: on join, the local participant
 * starts with an empty set (raised hands don't persist), and a
 * newly-joined user won't see hands raised BEFORE they arrived. That
 * matches Meet / NC behaviour — hands are ephemeral signals.
 *
 * Returns:
 *   raisedIds:  Set of identity strings currently raised
 *   myHand:     local participant's own state
 *   toggle():   flip the local participant's hand + broadcast
 *   lower(id):  host action — force-lower another participant. Sends
 *               a signal that the participant's own hook flips.
 */
export function useHandRaise() {
  const { localParticipant } = useLocalParticipant();
  const [raisedIds, setRaisedIds] = useState<Set<string>>(() => new Set());

  const onMessage = useCallback((msg: any) => {
    try {
      const data: HandRaisePayload = JSON.parse(
        new TextDecoder().decode(msg.payload),
      );
      if (!data.userId) return;
      setRaisedIds((prev) => {
        const next = new Set(prev);
        if (data.raised) {
          next.add(data.userId);
        } else {
          next.delete(data.userId);
        }
        return next;
      });
    } catch {
      /* malformed payload — ignore */
    }
  }, []);

  const { send } = useDataChannel(HAND_TOPIC, onMessage);

  const publish = useCallback(
    (userId: string, raised: boolean) => {
      const payload: HandRaisePayload = {
        userId,
        name: localParticipant.name || localParticipant.identity || 'Someone',
        raised,
        ts: Date.now(),
      };
      const bytes = new TextEncoder().encode(JSON.stringify(payload));
      send(bytes, { reliable: true });
    },
    [send, localParticipant],
  );

  const myHand = raisedIds.has(localParticipant.identity);

  const toggle = useCallback(() => {
    const next = !myHand;
    // Update local state immediately so the button flips without
    // waiting for the round-trip. Same optimistic pattern as
    // useEmojiReactions.
    setRaisedIds((prev) => {
      const set = new Set(prev);
      if (next) set.add(localParticipant.identity);
      else set.delete(localParticipant.identity);
      return set;
    });
    publish(localParticipant.identity, next);
  }, [myHand, publish, localParticipant.identity]);

  const lower = useCallback(
    (identity: string) => {
      // Host action. Broadcast raised=false for the target user;
      // every client (including the target's own hook) will clear.
      setRaisedIds((prev) => {
        const set = new Set(prev);
        set.delete(identity);
        return set;
      });
      publish(identity, false);
    },
    [publish],
  );

  const raisedList = useMemo(() => Array.from(raisedIds), [raisedIds]);

  return { raisedIds, raisedList, myHand, toggle, lower };
}

'use client';

import { useState, useCallback, useRef } from 'react';
import { useDataChannel, useLocalParticipant } from '@livekit/components-react';
import { nanoid } from 'nanoid';

const EMOJI_TOPIC = 'emoji-reaction';
const REACTION_DURATION = 3000;
const COOLDOWN = 500;

export interface EmojiReaction {
  emoji: string;
  senderName: string;
  senderId: string;
  id: string;
  x: number; // random horizontal position 10-90
}

export const REACTION_EMOJIS = [
  { key: 'thumbsup', char: '\uD83D\uDC4D', label: 'Thumbs up' },
  { key: 'heart', char: '\u2764\uFE0F', label: 'Heart' },
  { key: 'laugh', char: '\uD83D\uDE02', label: 'Laugh' },
  { key: 'clap', char: '\uD83D\uDC4F', label: 'Clap' },
  { key: 'fire', char: '\uD83D\uDD25', label: 'Fire' },
  { key: 'surprised', char: '\uD83D\uDE2E', label: 'Surprised' },
];

export function useEmojiReactions() {
  const [reactions, setReactions] = useState<EmojiReaction[]>([]);
  const lastSentRef = useRef(0);
  const { localParticipant } = useLocalParticipant();

  const addReaction = useCallback((reaction: EmojiReaction) => {
    setReactions((prev) => [...prev, reaction]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
    }, REACTION_DURATION);
  }, []);

  const onMessage = useCallback(
    (msg: any) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(msg.payload));
        if (data.emoji && data.id) {
          addReaction({
            emoji: data.emoji,
            senderName: data.senderName || 'Unknown',
            senderId: data.senderId || '',
            id: data.id,
            x: 10 + Math.random() * 80,
          });
        }
      } catch {}
    },
    [addReaction],
  );

  const { send } = useDataChannel(EMOJI_TOPIC, onMessage);

  const sendReaction = useCallback(
    async (emoji: string) => {
      const now = Date.now();
      if (now - lastSentRef.current < COOLDOWN) return;
      lastSentRef.current = now;

      const id = nanoid();
      const name =
        localParticipant.name || localParticipant.identity || 'You';
      const payload = {
        emoji,
        senderName: name,
        senderId: localParticipant.identity,
        id,
      };

      // Show locally
      addReaction({
        ...payload,
        x: 10 + Math.random() * 80,
      });

      // Broadcast
      try {
        const encoded = new TextEncoder().encode(JSON.stringify(payload));
        await send(encoded, { reliable: true, topic: EMOJI_TOPIC });
      } catch (err) {
        console.error('Failed to send reaction:', err);
      }
    },
    [send, localParticipant, addReaction],
  );

  return { reactions, sendReaction };
}

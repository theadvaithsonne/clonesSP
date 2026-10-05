'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { EmojiReaction } from '@/hooks/office/useEmojiReactions';

interface EmojiReactionOverlayProps {
  reactions: EmojiReaction[];
}

export default function EmojiReactionOverlay({ reactions }: EmojiReactionOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 1, y: 0, scale: 0.5 }}
            animate={{ opacity: 0, y: -350, scale: 1.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.8, ease: 'easeOut' }}
            className="absolute bottom-8 flex flex-col items-center"
            style={{ left: `${r.x}%` }}
          >
            <span className="text-5xl drop-shadow-lg">{r.emoji}</span>
            <span className="mt-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white whitespace-nowrap">
              {r.senderName}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

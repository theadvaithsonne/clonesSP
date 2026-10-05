"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlarmClock, X } from "lucide-react";
import {
  NOTES_REMINDER_EVENT,
  getStoredNoteReminders,
  markNoteReminderTriggered,
  playReminderRingtone,
  type StoredNoteReminder,
} from "../lib/notesReminders";

/**
 * Polls localStorage for due note reminders and rings like a knock,
 * with an in-app card: "You have a reminder for {note title}".
 */
export default function NotesReminderListener({
  onOpenNote,
}: {
  onOpenNote?: (noteId: string) => void;
}) {
  const [active, setActive] = useState<StoredNoteReminder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const stopAudio = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };

    const fire = (reminder: StoredNoteReminder) => {
      if (shownRef.current.has(reminder.blockId)) return;
      shownRef.current.add(reminder.blockId);
      markNoteReminderTriggered(reminder.blockId);
      stopAudio();
      audioRef.current = playReminderRingtone();
      setActive(reminder);
      window.dispatchEvent(
        new CustomEvent(NOTES_REMINDER_EVENT, { detail: reminder })
      );
    };

    const check = () => {
      const now = Date.now();
      const stored = getStoredNoteReminders();
      Object.values(stored).forEach((reminder) => {
        if (reminder.triggered) return;
        const fireAt = new Date(reminder.fireAt).getTime();
        if (!Number.isFinite(fireAt)) return;
        if (now >= fireAt) fire(reminder);
      });
    };

    check();
    const id = window.setInterval(check, 15_000);
    return () => {
      window.clearInterval(id);
      stopAudio();
    };
  }, []);

  const dismiss = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setActive(null);
  };

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed top-6 right-6 z-[1000] max-w-sm w-full"
          initial={{ opacity: 0, x: 400, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 400, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <div className="bg-[#0e0e12]/95 backdrop-blur-xl border border-amber-500/30 rounded-xl shadow-2xl shadow-amber-900/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <AlarmClock className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-xs font-medium text-amber-400 uppercase tracking-wide">
                    Note reminder
                  </span>
                </div>
                <p className="text-white text-sm font-medium">
                  You have a reminder for{" "}
                  <span className="text-amber-200">
                    {active.noteTitle?.trim() || "Untitled"}
                  </span>
                </p>
                <p className="text-zinc-400 text-xs mt-1">
                  {active.date === "Custom"
                    ? "Custom date"
                    : active.date}{" "}
                  at {active.time}
                </p>
                {active.noteId && onOpenNote && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenNote(active.noteId);
                      dismiss();
                    }}
                    className="mt-3 text-[12px] font-medium text-amber-300 hover:text-amber-200 transition-colors"
                  >
                    Open note →
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Dismiss reminder"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

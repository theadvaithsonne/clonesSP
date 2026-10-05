"use client";

/**
 * Shared notes-reminder storage + ringtone helper.
 * Reminders are checked globally from the thoughts page so they still fire
 * when the user isn't looking at the block that created them.
 */

export const NOTES_REMINDER_STORAGE_KEY = "notes-reminders-v2";
export const NOTES_REMINDER_EVENT = "notes:reminder-fired";

export interface StoredNoteReminder {
  blockId: string;
  noteId: string;
  noteTitle: string;
  date: string;
  time: string;
  customDate?: string;
  /** ISO timestamp when the reminder should fire */
  fireAt: string;
  triggered: boolean;
}

export function getStoredNoteReminders(): Record<string, StoredNoteReminder> {
  try {
    const stored = localStorage.getItem(NOTES_REMINDER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function upsertNoteReminder(reminder: StoredNoteReminder) {
  const stored = getStoredNoteReminders();
  stored[reminder.blockId] = reminder;
  localStorage.setItem(NOTES_REMINDER_STORAGE_KEY, JSON.stringify(stored));
}

export function markNoteReminderTriggered(blockId: string) {
  const stored = getStoredNoteReminders();
  if (stored[blockId]) {
    stored[blockId].triggered = true;
    localStorage.setItem(NOTES_REMINDER_STORAGE_KEY, JSON.stringify(stored));
  }
}

export function removeNoteReminder(blockId: string) {
  const stored = getStoredNoteReminders();
  delete stored[blockId];
  localStorage.setItem(NOTES_REMINDER_STORAGE_KEY, JSON.stringify(stored));
}

/** Same ringtone used for workspace knocks. */
export function playReminderRingtone() {
  try {
    const audio = new Audio("/knock.mp3");
    audio.volume = 0.55;
    void audio.play().catch(() => {});
    return audio;
  } catch {
    return null;
  }
}

export function getActiveNoteTitleFromDom(): string {
  if (typeof document === "undefined") return "Untitled";
  const el = document.querySelector(
    ".garage-notes-title-textarea"
  ) as HTMLTextAreaElement | null;
  const value = el?.value?.trim();
  return value || "Untitled";
}

export function getActiveNoteIdFromDom(): string {
  if (typeof document === "undefined") return "";
  const el = document.querySelector("[data-active-note-id]") as HTMLElement | null;
  return el?.getAttribute("data-active-note-id") || "";
}

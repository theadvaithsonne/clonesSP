"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";

const REMINDER_CHECK_INTERVAL_MS = 60 * 1000; // check every minute
const DAILY_2PM_HOUR = 14;
const DAILY_2PM_MINUTE = 0;

export interface FollowUpItem {
  _id?: string;
  leadId?: string;
  lead?: string;
  title?: string;
  entityName?: string;
  contactName?: string;
  dueDate?: string;
  scheduledDate?: string;
  status?: string;
  isCompleted?: boolean;
  [key: string]: unknown;
}

export interface FollowUpKnock {
  id: string;
  type: "exact" | "daily";
  title: string;
  subtitle?: string;
  leadId?: string;
  dueDate?: string;
  entityName?: string;
}

const STORAGE_KEY_KNOCKED_IDS = "followUpKnock_shownIds";
const STORAGE_KEY_2PM_DATE = "followUpKnock_2pmDate";

function getStoredKnockedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_KNOCKED_IDS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function addKnockedId(id: string) {
  if (typeof window === "undefined") return;
  try {
    const ids = getStoredKnockedIds();
    if (!ids.includes(id)) ids.push(id);
    sessionStorage.setItem(STORAGE_KEY_KNOCKED_IDS, JSON.stringify(ids));
  } catch {}
}

function get2pmReminderShownToday(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const dateStr = sessionStorage.getItem(STORAGE_KEY_2PM_DATE);
    const today = new Date().toDateString();
    return dateStr === today;
  } catch {
    return false;
  }
}

function set2pmReminderShownToday() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY_2PM_DATE, new Date().toDateString());
  } catch {}
}

function isOpenFollowUp(a: FollowUpItem): boolean {
  const status = (a.status || "").toLowerCase();
  if (a.isCompleted === true) return false;
  if (status === "completed" || status === "done") return false;
  return true;
}

function getDueDate(a: FollowUpItem): Date | null {
  const raw = a.dueDate || a.scheduledDate;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export function useFollowUpReminders() {
  const [knock, setKnock] = useState<FollowUpKnock | null>(null);
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);

  const fetchFollowUps = useCallback(async () => {
    try {
      const res = await authenticatedFetch(buildExternalUrl("crm/activities-followups"), { method: "GET" });
      if (!res.ok) return;
      const data = await res.json();
      const list = data?.data ?? data?.activities ?? data?.followups ?? data;
      const arr = Array.isArray(list) ? list : [];
      setFollowUps(arr);
    } catch (e) {
      console.error("[useFollowUpReminders] fetch failed:", e);
    }
  }, []);

  const dismissKnock = useCallback(() => {
    setKnock(null);
  }, []);

  useEffect(() => {
    fetchFollowUps();
    const refreshInterval = setInterval(fetchFollowUps, 5 * 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, [fetchFollowUps]);

  useEffect(() => {
    if (!followUps.length) return;

    const openWithDue = followUps.filter((a) => isOpenFollowUp(a) && getDueDate(a));

    const runCheck = () => {
      const now = new Date();
      const nowMinute = now.getHours() * 60 + now.getMinutes();
      const is2pm = now.getHours() === DAILY_2PM_HOUR && now.getMinutes() === DAILY_2PM_MINUTE;
      const alreadyShown2pm = get2pmReminderShownToday();
      const shownIds = getStoredKnockedIds();

      // 1) Exact-time knock: due in the current minute
      for (const a of openWithDue) {
        const due = getDueDate(a)!;
        const dueMinute = due.getHours() * 60 + due.getMinutes();
        const dueDateOnly = new Date(due);
        dueDateOnly.setHours(0, 0, 0, 0);
        const todayOnly = new Date(now);
        todayOnly.setHours(0, 0, 0, 0);
        const isDueToday = dueDateOnly.getTime() === todayOnly.getTime();
        const id = `${a._id || a.leadId || "followup"}-${dueDateOnly.getTime()}`;
        if (!a._id && !a.leadId && !a.dueDate) continue;

        if (isDueToday && dueMinute === nowMinute && !shownIds.includes(id)) {
          addKnockedId(id);
          setKnock({
            id,
            type: "exact",
            title: a.title || "Follow-up due now",
            subtitle: [a.entityName, a.contactName].filter(Boolean).join(" · ") || undefined,
            leadId: a.leadId || (a.lead as string),
            dueDate: a.dueDate || a.scheduledDate,
            entityName: a.entityName,
          });
          return;
        }
      }

      // 2) Daily 2pm reminder: one knock for "follow-ups due today / overdue"
      if (is2pm && !alreadyShown2pm) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueTodayOrOverdue = openWithDue.filter((a) => {
          const d = getDueDate(a)!;
          const day = new Date(d);
          day.setHours(0, 0, 0, 0);
          return day.getTime() <= today.getTime(); // today or overdue
        });
        if (dueTodayOrOverdue.length > 0) {
          set2pmReminderShownToday();
          const first = dueTodayOrOverdue[0];
          const leadId = first.leadId || (first.lead as string);
          setKnock({
            id: `2pm-${Date.now()}`,
            type: "daily",
            title: "Follow-up reminder",
            subtitle:
              dueTodayOrOverdue.length === 1
                ? [first.entityName, first.contactName].filter(Boolean).join(" · ") || first.title
                : `You have ${dueTodayOrOverdue.length} follow-up(s) due`,
            leadId,
            dueDate: first.dueDate || first.scheduledDate,
            entityName: first.entityName,
          });
        }
      }
    };

    runCheck();
    const interval = setInterval(runCheck, REMINDER_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [followUps]);

  return { knock, dismissKnock, followUps, refreshFollowUps: fetchFollowUps };
}

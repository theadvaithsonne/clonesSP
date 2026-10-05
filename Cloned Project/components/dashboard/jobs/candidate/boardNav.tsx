"use client";

// Navigation and small shared state for the candidate Job Board.
//
// Each screen is a dashboard popover key ("Job Board", "Job Board:Job", …) so
// the sidebar, top tab and back/forward history treat it like any other page.
// Which job is open lives in a sessionStorage-backed store, so a reload lands
// back on the same job. Saved-job ids live in a separate in-memory store that
// every screen shares, so a bookmark toggled on one page shows on the others.

import React from "react";
import { toast } from "sonner";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { errorMessage } from "../ui";
import * as candidateApi from "./candidateApi";
import type { ApplySource, PublicJob } from "./candidateTypes";

export const BOARD_PAGES = {
  discover: "Job Board",
  job: "Job Board:Job",
  apply: "Job Board:Apply",
  applications: "Job Board:Applications",
  saved: "Job Board:Saved",
} as const;

export type ApplicationsTab = "active" | "offers" | "closed" | "drafts";
export type SavedTab = "saved" | "alerts";

interface BoardState {
  jobId: string | null;
  applyJobId: string | null;
  applicationsTab: ApplicationsTab;
  savedTab: SavedTab;
  set: (patch: Partial<Omit<BoardState, "set">>) => void;
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set) => ({
      jobId: null,
      applyJobId: null,
      applicationsTab: "active",
      savedTab: "saved",
      set: (patch) => set(patch),
    }),
    {
      name: "garage-job-board",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        jobId: s.jobId,
        applyJobId: s.applyJobId,
        applicationsTab: s.applicationsTab,
        savedTab: s.savedTab,
      }),
    }
  )
);

// ── Referral carried from a deep link into the apply flow ────────────────

const APPLY_SOURCES: ApplySource[] = ["garage_hq", "university", "public_link", "careers_page", "talent_pool"];
const refKey = (jobId: string) => `garage-job-board:ref:${jobId}`;

/** Remember whose link (and which surface) brought the candidate to a job. */
export function rememberReferral(jobId: string, data: { ref?: string | null; source?: string | null }) {
  try {
    const current = referralFor(jobId);
    const next = {
      ref: data.ref?.trim() || current.ref,
      source: data.source && APPLY_SOURCES.includes(data.source as ApplySource) ? data.source : current.source,
    };
    sessionStorage.setItem(refKey(jobId), JSON.stringify(next));
  } catch {
    /* storage unavailable — the application just goes in without a referral */
  }
}

export function referralFor(jobId: string): { ref?: string; source?: ApplySource } {
  try {
    const raw = sessionStorage.getItem(refKey(jobId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { ref?: string; source?: string };
    return {
      ref: typeof parsed.ref === "string" && parsed.ref ? parsed.ref.slice(0, 60) : undefined,
      source: APPLY_SOURCES.includes(parsed.source as ApplySource) ? (parsed.source as ApplySource) : undefined,
    };
  } catch {
    return {};
  }
}

// ── Saved job ids ────────────────────────────────────────────────────────

interface SavedState {
  ids: Set<string>;
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
  /** Merge `saved` flags from a list the server already returned (Discover). */
  absorb: (jobs: PublicJob[]) => void;
  /** Replace with the complete saved list (the Saved page's own fetch). */
  setAll: (jobIds: string[]) => void;
  toggle: (jobId: string) => Promise<void>;
}

export const useSavedStore = create<SavedState>()((set, get) => ({
  ids: new Set<string>(),
  loaded: false,
  loading: false,
  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const res = await candidateApi.getSavedJobs();
      set({ ids: new Set(res.jobs.map((j) => j._id)), loaded: true });
    } catch {
      /* the bookmark just starts empty */
    } finally {
      set({ loading: false });
    }
  },
  absorb: (jobs) => {
    const ids = new Set(get().ids);
    for (const j of jobs) {
      if (j.saved === true) ids.add(j._id);
      if (j.saved === false) ids.delete(j._id);
    }
    set({ ids });
  },
  setAll: (jobIds) => set({ ids: new Set(jobIds), loaded: true }),
  toggle: async (jobId) => {
    const was = get().ids.has(jobId);
    const optimistic = new Set(get().ids);
    if (was) optimistic.delete(jobId);
    else optimistic.add(jobId);
    set({ ids: optimistic });
    try {
      if (was) await candidateApi.unsaveJob(jobId);
      else await candidateApi.saveJob(jobId);
      toast.success(was ? "Removed from saved jobs" : "Saved — find it under Jobs → Saved");
    } catch (err) {
      const revert = new Set(get().ids);
      if (was) revert.add(jobId);
      else revert.delete(jobId);
      set({ ids: revert });
      toast.error(errorMessage(err, "Couldn't update your saved jobs."));
    }
  },
}));

// ── Navigation context ───────────────────────────────────────────────────

export interface BoardNav {
  go: (page: string) => void;
  openJob: (jobId: string) => void;
  openApply: (jobId: string) => void;
  openApplications: (tab?: ApplicationsTab) => void;
  openSaved: (tab?: SavedTab) => void;
}

const BoardNavContext = React.createContext<BoardNav | null>(null);

export function BoardNavProvider({ onNavigate, children }: { onNavigate: (page: string) => void; children: React.ReactNode }) {
  const set = useBoardStore((s) => s.set);
  const value = React.useMemo<BoardNav>(
    () => ({
      go: onNavigate,
      openJob: (jobId) => {
        set({ jobId });
        onNavigate(BOARD_PAGES.job);
      },
      openApply: (jobId) => {
        set({ applyJobId: jobId });
        onNavigate(BOARD_PAGES.apply);
      },
      openApplications: (tab) => {
        if (tab) set({ applicationsTab: tab });
        onNavigate(BOARD_PAGES.applications);
      },
      openSaved: (tab) => {
        if (tab) set({ savedTab: tab });
        onNavigate(BOARD_PAGES.saved);
      },
    }),
    [onNavigate, set]
  );
  return <BoardNavContext.Provider value={value}>{children}</BoardNavContext.Provider>;
}

export function useBoardNav(): BoardNav {
  const ctx = React.useContext(BoardNavContext);
  if (!ctx) throw new Error("useBoardNav must be used inside BoardNavProvider");
  return ctx;
}

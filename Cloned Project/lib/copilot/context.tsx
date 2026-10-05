"use client";

// Stub of NC's Copilot context. NC's meet header uses an AI Copilot
// to surface contextual actions ("schedule a follow-up", "send a
// recap"). Garage doesn't have that layer yet, so we expose a no-op
// shim with the same shape so the ported NC components compile and
// the toggle button just renders disabled. Replace with a real
// implementation when Garage ships a Copilot equivalent.
import { createContext, ReactNode, useContext } from "react";

export type CopilotStatus = "idle" | "starting" | "live" | "stopping";

interface CopilotContextValue {
  status: CopilotStatus;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

const NOOP: CopilotContextValue = {
  status: "idle",
  start: async () => {},
  stop: async () => {},
  open: false,
  toggle: () => {},
  setOpen: () => {},
};

const CopilotContext = createContext<CopilotContextValue>(NOOP);

export const useCopilot = () => useContext(CopilotContext);

export function CopilotProvider({ children }: { children: ReactNode }) {
  return (
    <CopilotContext.Provider value={NOOP}>{children}</CopilotContext.Provider>
  );
}

# `lib/copilot/context.tsx`

> A no-op React context shim that stands in for NetworkChains' (NC) AI "Copilot" so ported meeting components compile and render without a real Copilot backend.

**Kind:** frontend library · **Lines:** 40

## Purpose
The meeting header and conference page were ported from NC, where an AI Copilot surfaces contextual actions during a call ("schedule a follow-up", "send a recap"). Garage has no Copilot layer yet, so this file exposes a context with the same shape whose values do nothing. The Copilot toggle in the ported UI therefore renders but stays inert. The file header says to replace it with a real implementation once Garage ships one.

## How it works
- A constant `NOOP` value holds `status: "idle"`, `open: false`, and empty functions for `start`, `stop`, `toggle` and `setOpen`.
- `CopilotContext` is created with `NOOP` as its default, so `useCopilot()` returns the no-op value even when no provider is mounted.
- `CopilotProvider` always provides that same `NOOP` object. It keeps no state, so calling `toggle()` or `start()` changes nothing and `status` never leaves `"idle"`.

## Exports
- `CopilotProvider({ children })` - wraps a subtree and provides the no-op Copilot value.
- `useCopilot()` - returns the current `CopilotContextValue` (`status`, `start`, `stop`, `open`, `toggle`, `setOpen`).
- `type CopilotStatus` - `"idle" | "starting" | "live" | "stopping"`.

(`CopilotContextValue` is an internal interface and is not exported.)

## Dependencies
- **Packages:** `react` - `createContext`, `useContext`, `ReactNode`.

## Used by
- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx` - wraps the conference UI in `<CopilotProvider>`.
- `components/office/MeetHeader.tsx` - reads `status`, `start` and `stop` from `useCopilot()` for the Copilot button.

## Notes
- This is a placeholder: anything that depends on Copilot state changing will never see a change.
- `app/docs/content/chapters/11-ai.ts` describes this file as a provider that "gives assistants the current page's situation". That does not match the code, which is only a stub.

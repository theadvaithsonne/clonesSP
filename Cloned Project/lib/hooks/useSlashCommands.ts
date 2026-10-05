"use client";

// Core slash-command engine: detects "/" at the start of the chat textarea
// (or after a newline), opens a searchable command menu, and tracks which
// command form should be rendered. Designed to be reused by DMPage,
// GlobalDMPage, and GroupChatPage with no per-page state.
//
// The hook deliberately stays UI-agnostic — it returns plain state + actions
// and lets the host page render the menu/form however it likes.

import { useCallback, useMemo, useRef, useState } from "react";
import {
  CheckSquare,
  BarChart3,
  Calendar,
  TrendingUp,
  ShieldCheck,
  FileText,
  ShoppingBag,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

export type ChatType = "dm" | "global-dm" | "group";

export type SlashCommandId =
  // | "task"      // BackOffice — commented out
  | "poll"
  | "meet"
  // | "deal"      // BackOffice — commented out
  // | "approve"   // BackOffice — commented out
  // | "doc"       // BackOffice — commented out
  | "share"
  // Group chat only, and only when a Taskroom board is linked + enabled.
  | "taskroom";

export interface SlashCommand {
  id: SlashCommandId;
  trigger: string; // includes leading slash, e.g. "/task"
  label: string;
  description: string;
  icon: LucideIcon;
  orgOnly: boolean; // hidden in global-dm where there's no shared org
}

const COMMANDS: SlashCommand[] = [
  // ── BackOffice-dependent commands (commented out) ──────────────
  // {
  //   id: "task",
  //   trigger: "/task",
  //   label: "Create Task",
  //   description: "Create a task in Taskrooms",
  //   icon: CheckSquare,
  //   orgOnly: true,
  // },
  // {
  //   id: "deal",
  //   trigger: "/deal",
  //   label: "Share Deal",
  //   description: "Look up or update a deal in CRM",
  //   icon: TrendingUp,
  //   orgOnly: true,
  // },
  // {
  //   id: "approve",
  //   trigger: "/approve",
  //   label: "Request Approval",
  //   description: "Send an approval request",
  //   icon: ShieldCheck,
  //   orgOnly: true,
  // },
  // {
  //   id: "doc",
  //   trigger: "/doc",
  //   label: "Share Document",
  //   description: "Share a document from Cabinet",
  //   icon: FileText,
  //   orgOnly: true,
  // },
  // ── Active commands ───────────────────────────────────────────
  {
    id: "poll",
    trigger: "/poll",
    label: "Create Poll",
    description: "Create a poll in this chat",
    icon: BarChart3,
    orgOnly: false,
  },
  {
    id: "meet",
    trigger: "/meet",
    label: "Schedule Meeting",
    description: "Book a conference room",
    icon: Calendar,
    orgOnly: false,
  },
  {
    id: "share",
    trigger: "/share",
    label: "Share Product",
    description: "Share a course, webinar, or product",
    icon: ShoppingBag,
    orgOnly: true,
  },
  {
    id: "taskroom",
    trigger: "/taskroom",
    label: "Taskroom",
    description: "Add a task to the linked board",
    icon: ListChecks,
    orgOnly: true,
  },
];

interface UseSlashCommandsOptions {
  chatType: ChatType;
  // Called when the host page wants to clear the textarea trigger after a
  // command is selected (so "/task" doesn't get sent as plain text).
  onClearTrigger?: () => void;
  // Group chat only: whether the group has a linked + enabled Taskroom board.
  // The "/taskroom" command is filtered out unless this is true.
  taskroomEnabled?: boolean;
}

export interface UseSlashCommandsReturn {
  menuOpen: boolean;
  query: string;
  filteredCommands: SlashCommand[];
  selectedIndex: number;
  activeCommand: SlashCommandId | null;
  // Call from textarea onChange — returns the (possibly unchanged) text to
  // store. We don't mutate the value here; the host page owns the text state.
  handleInputChange: (text: string) => void;
  // Optional helper for Up/Down/Enter/Escape within the textarea while the
  // menu is open. Returns true if the key was consumed.
  handleKeyDown: (e: KeyboardEvent | React.KeyboardEvent) => boolean;
  selectCommand: (id: SlashCommandId) => void;
  closeMenu: () => void;
  closeForm: () => void;
}

// Match a slash trigger at the start of the textarea content OR immediately
// after a newline. The captured group is the partial query after the slash.
const TRIGGER_RE = /(?:^|\n)\/(\w*)$/;

export function useSlashCommands({
  chatType,
  onClearTrigger,
  taskroomEnabled = false,
}: UseSlashCommandsOptions): UseSlashCommandsReturn {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCommand, setActiveCommand] = useState<SlashCommandId | null>(null);
  // Whether the menu was explicitly dismissed for the current trigger so we
  // don't reopen it on every keystroke after Escape.
  const dismissedTriggerRef = useRef<string | null>(null);

  const available = useMemo(() => {
    let list = chatType === "global-dm" ? COMMANDS.filter((c) => !c.orgOnly) : COMMANDS;
    // "/taskroom" only surfaces in group chats with a linked + enabled board.
    if (!(chatType === "group" && taskroomEnabled)) {
      list = list.filter((c) => c.id !== "taskroom");
    }
    return list;
  }, [chatType, taskroomEnabled]);

  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (c) =>
        c.id.includes(q) ||
        c.label.toLowerCase().includes(q) ||
        c.trigger.slice(1).startsWith(q)
    );
  }, [available, query]);

  const handleInputChange = useCallback(
    (text: string) => {
      const match = text.match(TRIGGER_RE);
      if (!match) {
        if (menuOpen) setMenuOpen(false);
        dismissedTriggerRef.current = null;
        return;
      }
      const partial = match[1] || "";
      if (dismissedTriggerRef.current === text) return;
      setQuery(partial);
      setSelectedIndex(0);
      setMenuOpen(true);
    },
    [menuOpen]
  );

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const closeForm = useCallback(() => {
    setActiveCommand(null);
  }, []);

  const selectCommand = useCallback(
    (id: SlashCommandId) => {
      if (!available.some((c) => c.id === id)) return;
      setMenuOpen(false);
      setActiveCommand(id);
      onClearTrigger?.();
    },
    [available, onClearTrigger]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent | React.KeyboardEvent) => {
      if (!menuOpen) return false;
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen(false);
        return true;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (filteredCommands.length ? (i + 1) % filteredCommands.length : 0));
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) =>
          filteredCommands.length ? (i - 1 + filteredCommands.length) % filteredCommands.length : 0
        );
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        const cmd = filteredCommands[selectedIndex];
        if (cmd) {
          e.preventDefault();
          selectCommand(cmd.id);
          return true;
        }
      }
      return false;
    },
    [menuOpen, filteredCommands, selectedIndex, selectCommand]
  );

  return {
    menuOpen,
    query,
    filteredCommands,
    selectedIndex,
    activeCommand,
    handleInputChange,
    handleKeyDown,
    selectCommand,
    closeMenu,
    closeForm,
  };
}

export { COMMANDS as SLASH_COMMANDS };

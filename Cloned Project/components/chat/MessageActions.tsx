"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Reply,
  Smile,
  Star,
  Pin,
  Plus,
  Forward,
  Copy,
  Trash2,
  CheckSquare,
  Edit3,
  ChevronDown,
  ArrowLeft,
  Check,
  MessageSquareText,
  ListX,
  UserPlus,
} from "lucide-react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { messageExtras, useMessageExtras } from "@/lib/messageExtras";
import { useLongPress } from "@/lib/hooks/useLongPress";

// Renders an emoji-picker-react instance positioned within the viewport
// using a portal. Anchors near `anchor` (a DOM rect) and clamps so it never
// falls behind sidebars or off the bottom of the screen.
function PortalEmojiPicker({
  anchor,
  onPick,
  onClose,
}: {
  anchor: DOMRect | null;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pickerW = 300;
  const pickerH = 380;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!anchor || typeof document === "undefined") return null;

  const margin = 8;
  // Prefer below anchor; flip above if no room.
  let top = anchor.bottom + 6;
  if (top + pickerH > window.innerHeight - margin) {
    top = Math.max(margin, anchor.top - pickerH - 6);
  }
  // Prefer right-aligned to the anchor; clamp into viewport.
  let left = anchor.right - pickerW;
  if (left < margin) left = margin;
  if (left + pickerW > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - pickerW - margin);
  }

  return createPortal(
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top,
        left,
        zIndex: 1000,
      }}
      className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl shadow-2xl overflow-hidden"
    >
      <EmojiPicker
        onEmojiClick={(d: EmojiClickData) => {
          onPick(d.emoji);
          onClose();
        }}
        theme={Theme.DARK}
        width={pickerW}
        height={pickerH}
        searchDisabled={false}
        skinTonesDisabled
        previewConfig={{ showPreview: false }}
      />
    </div>,
    document.body
  );
}

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// Wrap any element so a touch-and-hold opens the action menu (mobile UX).
export function LongPressDiv({
  onLongPress,
  className,
  children,
  onClick,
}: {
  onLongPress: () => void;
  className?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const handlers = useLongPress(onLongPress);
  return (
    <div className={className} onClick={onClick} {...handlers}>
      {children}
    </div>
  );
}

export type MessageActionContext = {
  messageId: string;
  text: string;
  isMine: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onReply: () => void;
  onThread?: () => void;
  onForward: () => void;
  onCopy: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onEnterSelectionMode: () => void;
  // Optional: fire a reaction toggle. When provided, "React" opens the full
  // emoji picker and picking an emoji calls this back (rather than mutating
  // local storage). This is the path used by server-synced reactions.
  onReact?: (emoji: string) => void;
  // Group chats only: the message became a Taskroom task and the viewer may
  // take it back out. The menu shows "Remove from Taskroom" only when this is
  // provided — DMs and Global chat never pass it.
  onRemoveFromTaskroom?: () => void;
  // Group chats only: assign the Taskroom task this message created to group
  // members. The menu shows "Assign to…" only when this is provided — DMs and
  // Global chat never pass it.
  onAssignTask?: () => void;
};

type Props = {
  ctx: MessageActionContext;
  meId: string;
  align?: "left" | "right";
  // Externally controlled open state (used by long-press on mobile)
  forceOpen?: boolean;
  onClose?: () => void;
  // "inside" = small chevron meant to live inside the bubble (transparent bg)
  triggerVariant?: "default" | "inside";
};

export function MessageActionMenu({
  ctx,
  meId,
  align = "left",
  forceOpen,
  onClose,
  triggerVariant = "default",
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = forceOpen ?? internalOpen;
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
  const { pinned } = useMessageExtras(ctx.messageId);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  // Optional rows make the menu taller than the height guesses below assume;
  // without this it would clip at the bottom or cover its own trigger. Always
  // 0 where no optional row is passed, so those menus are unchanged.
  const extraRowsHeight = (ctx.onRemoveFromTaskroom ? 33 : 0) + (ctx.onAssignTask ? 33 : 0);

  // Flip the menu above the trigger when there's not enough room below.
  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const needed = 300 + extraRowsHeight;
    setPlacement(spaceBelow < needed && spaceAbove > spaceBelow ? "top" : "bottom");
    setTriggerRect(rect);
  }, [open, extraRowsHeight]);

  const setOpen = (v: boolean) => {
    if (forceOpen === undefined) setInternalOpen(v);
    if (!v) onClose?.();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      // Don't close while the portal-mounted emoji picker is open; it has its
      // own outside-click handler.
      if (pickerAnchor) return;
      if (
        (wrapRef.current && wrapRef.current.contains(e.target as Node)) ||
        (menuRef.current && menuRef.current.contains(e.target as Node))
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setPickerAnchor(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, pickerAnchor]);

  const close = () => {
    setOpen(false);
    setPickerAnchor(null);
  };

  const react = (emoji: string) => {
    if (ctx.onReact) {
      ctx.onReact(emoji);
    } else {
      messageExtras.toggleReaction(ctx.messageId, emoji, meId);
    }
    close();
  };

  return (
    <div ref={wrapRef} className="relative inline-flex items-center">
      {/* Trigger: chevron arrow */}
      {forceOpen === undefined && (
        <button
          type="button"
          aria-label="Message actions"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
          className={
            triggerVariant === "inside"
              ? `h-4 w-4 inline-flex items-center justify-center rounded text-white/60 hover:text-white hover:bg-black/30 transition-colors ${
                  open ? "bg-black/40 text-white" : ""
                }`
              : `h-5 w-5 inline-flex items-center justify-center rounded-md text-[#999] hover:text-white hover:bg-[#3a3a3a] transition-colors ${
                  open ? "bg-[#3a3a3a] text-white" : ""
                }`
          }
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      )}

      {pickerAnchor && (
        <PortalEmojiPicker
          anchor={pickerAnchor}
          onPick={(emoji) => react(emoji)}
          onClose={() => setPickerAnchor(null)}
        />
      )}
      {open && triggerRect && typeof document !== "undefined" && (
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: placement === "top"
                ? Math.max(8, triggerRect.top - (ctx.canEdit || ctx.canDelete ? 310 : 250) - extraRowsHeight - 4)
                : triggerRect.bottom + 4,
              left: align === "right"
                ? Math.max(8, triggerRect.right - 150)
                : triggerRect.left,
              zIndex: 99999,
            }}
            className="flex flex-col gap-1 items-stretch"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Action list */}
            <div className="min-w-[150px] bg-[#2E2E2E] border border-[#3a3a3a] rounded-lg shadow-xl overflow-hidden">
              <MenuItem
                icon={<Reply className="h-3.5 w-3.5" />}
                label="Reply"
                onClick={() => {
                  ctx.onReply();
                  close();
                }}
              />
              {ctx.onThread && (
                <MenuItem
                  icon={<MessageSquareText className="h-3.5 w-3.5" />}
                  label="Reply in Thread"
                  onClick={() => {
                    ctx.onThread?.();
                    close();
                  }}
                />
              )}
              <MenuItem
                icon={<Smile className="h-3.5 w-3.5" />}
                label="React"
                onClick={(e) => {
                  e?.stopPropagation();
                  if (wrapRef.current) {
                    setPickerAnchor(wrapRef.current.getBoundingClientRect());
                  }
                }}
              />

              <MenuItem
                icon={<Pin className={`h-3.5 w-3.5 ${pinned ? "fill-blue-400 text-blue-400" : ""}`} />}
                label={pinned ? "Unpin" : "Pin"}
                onClick={() => {
                  messageExtras.togglePin(ctx.messageId);
                  close();
                }}
              />
              <MenuItem
                icon={<Forward className="h-3.5 w-3.5" />}
                label="Forward"
                onClick={() => {
                  ctx.onForward();
                  close();
                }}
              />
              <MenuItem
                icon={<Copy className="h-3.5 w-3.5" />}
                label="Copy"
                onClick={() => {
                  ctx.onCopy();
                  close();
                }}
              />
              {ctx.canEdit && (
                <MenuItem
                  icon={<Edit3 className="h-3.5 w-3.5" />}
                  label="Edit"
                  onClick={() => {
                    ctx.onEdit?.();
                    close();
                  }}
                />
              )}
              {ctx.onAssignTask && (
                <MenuItem
                  icon={<UserPlus className="h-3.5 w-3.5" />}
                  label="Assign to…"
                  onClick={() => {
                    ctx.onAssignTask?.();
                    close();
                  }}
                />
              )}
              {ctx.onRemoveFromTaskroom && (
                <MenuItem
                  icon={<ListX className="h-3.5 w-3.5" />}
                  label="Remove from Taskroom"
                  destructive
                  onClick={() => {
                    ctx.onRemoveFromTaskroom?.();
                    close();
                  }}
                />
              )}
              {ctx.canDelete && (
                <MenuItem
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  label="Delete"
                  destructive
                  onClick={() => {
                    ctx.onDelete?.();
                    close();
                  }}
                />
              )}
              <div className="border-t border-[#3a3a3a]" />
              <MenuItem
                icon={<CheckSquare className="h-3.5 w-3.5" />}
                label="Select messages"
                onClick={() => {
                  ctx.onEnterSelectionMode();
                  close();
                }}
              />
            </div>
          </div>,
          document.body
        )
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: (e?: React.MouseEvent) => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-[#3a3a3a] transition-colors ${
        destructive ? "text-red-400" : "text-white"
      }`}
    >
      <span className={destructive ? "text-red-400" : "text-[#999]"}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ─── Reactions display (shown beneath the bubble) ──────────────────────────

// User info type for resolving reactor names/avatars
export type ReactionUserInfo = {
  name?: string;
  email?: string;
  profilePicture?: string;
};

// Portal popup that shows who reacted with a given emoji (WhatsApp-style).
function ReactionDetailPopup({
  emoji,
  users,
  meId,
  userMap,
  anchorRect,
  onRemoveMine,
  onClose,
}: {
  emoji: string;
  users: string[];
  meId: string;
  userMap: Record<string, ReactionUserInfo>;
  anchorRect: DOMRect;
  onRemoveMine: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  // Position: prefer above the badge, fall below if no room
  const popupW = 220;
  const popupH = Math.min(users.length * 44 + 46, 240); // header + rows, capped
  const margin = 8;

  let top = anchorRect.top - popupH - 6;
  if (top < margin) {
    top = anchorRect.bottom + 6;
  }
  let left = anchorRect.left;
  if (left + popupW > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - popupW - margin);
  }
  if (left < margin) left = margin;

  return createPortal(
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{ position: "fixed", top, left, zIndex: 1000, width: popupW }}
      className="bg-[#1a1a22] border border-[#2a2a35] rounded-xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2a2a35]">
        <span className="text-base">{emoji}</span>
        <span className="text-[11px] text-[#999] font-medium">
          {users.length} {users.length === 1 ? "reaction" : "reactions"}
        </span>
      </div>
      {/* User list */}
      <div className="max-h-[180px] overflow-y-auto">
        {users.map((userId) => {
          const user = userMap[userId];
          const isMe = userId === meId;
          const displayName = isMe
            ? "You"
            : user?.name || user?.email || userId.slice(0, 8);
          const initials = (
            user?.name?.charAt(0) ||
            user?.email?.charAt(0) ||
            "?"
          ).toUpperCase();

          return (
            <button
              key={userId}
              type="button"
              disabled={!isMe}
              onClick={(e) => {
                e.stopPropagation();
                if (isMe) {
                  onRemoveMine();
                }
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                isMe
                  ? "hover:bg-red-500/10 cursor-pointer"
                  : "cursor-default"
              }`}
            >
              {/* Avatar */}
              {user?.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt={displayName}
                  className="w-6 h-6 rounded-full object-cover border border-[#2a2a35] shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand to-brand-2 flex items-center justify-center text-[10px] font-semibold text-brand-foreground shrink-0">
                  {initials}
                </div>
              )}
              {/* Name + hint */}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-white truncate font-medium">
                  {displayName}
                </div>
                {isMe && (
                  <div className="text-[9px] text-red-400/80">
                    Tap to remove
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

export function MessageReactions({
  messageId,
  meId,
  align,
  reactions: reactionsProp,
  onReact,
  userMap = {},
}: {
  messageId: string;
  meId: string;
  align: "left" | "right";
  // When provided, the parent controls reaction state (e.g. synced via socket).
  // Otherwise we fall back to the legacy localStorage store.
  reactions?: Record<string, string[]>;
  onReact?: (emoji: string) => void;
  // Map of userId -> user info for showing reactor names in the detail popup
  userMap?: Record<string, ReactionUserInfo>;
}) {
  const { reactions: extras } = useMessageExtras(messageId);
  const reactions = reactionsProp ?? extras;
  const entries = Object.entries(reactions);
  const [detailPopup, setDetailPopup] = useState<{
    emoji: string;
    users: string[];
    rect: DOMRect;
  } | null>(null);

  if (entries.length === 0) return null;
  return (
    <>
      <div
        className={`mt-1 flex flex-wrap gap-1 ${
          align === "right" ? "justify-end" : "justify-start"
        }`}
      >
        {entries.map(([emoji, users]) => {
          const mine = users.includes(meId);
          return (
            <button
              key={emoji}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setDetailPopup({ emoji, users, rect });
              }}
              className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] leading-none transition-colors ${
                mine
                  ? "bg-[#007AFF]/15 border-[#007AFF]/40 text-white"
                  : "bg-[#2E2E2E] border-[#3a3a3a] text-white hover:bg-[#3a3a3a]"
              }`}
              title={`${users.length} reaction${users.length === 1 ? "" : "s"}`}
            >
              <span className="text-[12px]">{emoji}</span>
              <span className="text-[#999]">{users.length}</span>
            </button>
          );
        })}
      </div>
      {detailPopup && (
        <ReactionDetailPopup
          emoji={detailPopup.emoji}
          users={detailPopup.users}
          meId={meId}
          userMap={userMap}
          anchorRect={detailPopup.rect}
          onRemoveMine={() => {
            if (onReact) onReact(detailPopup.emoji);
            else messageExtras.toggleReaction(messageId, detailPopup.emoji, meId);
            setDetailPopup(null);
          }}
          onClose={() => setDetailPopup(null)}
        />
      )}
    </>
  );
}

// ─── WhatsApp-style quick smiley button next to the bubble ─────────────────
// `openTo` controls which side the emoji strip expands to (horizontal),
// so it never falls below the bubble.

export function QuickReactionButton({
  messageId,
  meId,
  openTo,
  onReact,
}: {
  messageId: string;
  meId: string;
  openTo: "left" | "right";
  // When provided, the parent owns reaction state (synced via socket).
  // Otherwise we fall back to the legacy localStorage store.
  onReact?: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const plusBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      // Don't close the bar while the portal picker is open — it has its own
      // outside-click handler and lives outside this DOM subtree.
      if (pickerAnchor) return;
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, pickerAnchor]);

  const fire = (emoji: string) => {
    if (onReact) onReact(emoji);
    else messageExtras.toggleReaction(messageId, emoji, meId);
  };

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="h-6 w-6 inline-flex items-center justify-center rounded-full bg-[#2E2E2E] border border-[#3a3a3a] text-[#999] hover:text-white hover:bg-[#3a3a3a] transition-colors shadow-sm"
        title="React"
        aria-label="Add reaction"
      >
        <Smile className="h-3 w-3" />
      </button>
      {open && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 ${
            openTo === "right" ? "left-full ml-1" : "right-full mr-1"
          } flex items-center gap-0.5 bg-[#2E2E2E] border border-[#3a3a3a] rounded-full px-1.5 py-1 shadow-xl z-[100] whitespace-nowrap`}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fire(emoji);
                setOpen(false);
              }}
              className="h-7 w-7 flex items-center justify-center hover:bg-[#3a3a3a] rounded-full transition-transform hover:scale-110 text-base leading-none"
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          {/* Open the full picker */}
          <button
            ref={plusBtnRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (plusBtnRef.current) {
                setPickerAnchor(plusBtnRef.current.getBoundingClientRect());
              }
            }}
            className="h-7 w-7 flex items-center justify-center text-[#999] hover:text-white hover:bg-[#3a3a3a] rounded-full transition-colors"
            title="More emojis"
            aria-label="More emojis"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {pickerAnchor && (
        <PortalEmojiPicker
          anchor={pickerAnchor}
          onPick={(emoji) => {
            fire(emoji);
            setOpen(false);
          }}
          onClose={() => setPickerAnchor(null)}
        />
      )}
    </div>
  );
}

// ─── Selection mode toolbar ────────────────────────────────────────────────

export function SelectionToolbar({
  count,
  onCancel,
  onCopy,
  onForward,
  onDelete,
}: {
  count: number;
  onCancel: () => void;
  onCopy: () => void;
  onForward: () => void;
  onDelete?: () => void;
}) {
  const disabled = count === 0;
  return (
    <div className="absolute top-0 left-0 right-0 z-30 bg-[#0e0e12] border-b border-[#2E2E2E] px-2 sm:px-4 py-2.5 flex items-center gap-3 shadow-lg">
      <button
        type="button"
        onClick={onCancel}
        className="h-8 w-8 inline-flex items-center justify-center rounded-full text-white hover:bg-[#2E2E2E] transition-colors"
        aria-label="Cancel selection"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <span className="text-sm text-white font-medium">{count}</span>
      <div className="flex-1" />
      <ToolbarIcon
        title="Copy"
        disabled={disabled}
        onClick={onCopy}
        icon={<Copy className="h-4 w-4" />}
      />
      <ToolbarIcon
        title="Forward"
        disabled={disabled}
        onClick={onForward}
        icon={<Forward className="h-4 w-4" />}
      />
      {onDelete && (
        <ToolbarIcon
          title="Delete"
          disabled={disabled}
          onClick={onDelete}
          icon={<Trash2 className="h-4 w-4" />}
          destructive
        />
      )}
    </div>
  );
}

function ToolbarIcon({
  icon,
  title,
  onClick,
  disabled,
  destructive,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        destructive
          ? "text-red-400 hover:bg-red-500/10"
          : "text-white hover:bg-[#2E2E2E]"
      }`}
    >
      {icon}
    </button>
  );
}

// Circular check overlay shown on a message when it is selected.
export function SelectionCheckOverlay({ selected }: { selected: boolean }) {
  return (
    <div
      className={`absolute -top-1 -left-1 h-4 w-4 rounded-full border flex items-center justify-center transition-all ${
        selected
          ? "bg-[#25D366] border-[#25D366] text-white scale-100"
          : "bg-[#1F1F1F] border-[#3a3a3a] text-transparent scale-90"
      }`}
    >
      <Check className="h-3 w-3" strokeWidth={3} />
    </div>
  );
}

// ─── Forward dialog ────────────────────────────────────────────────────────

export type ForwardTarget = {
  id: string;
  kind: "dm" | "group";
  label: string;
};

export function ForwardDialog({
  open,
  text,
  targets,
  onClose,
  onSend,
}: {
  open: boolean;
  text: string;
  targets: ForwardTarget[];
  onClose: () => void;
  onSend: (target: ForwardTarget) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter((t) => t.label.toLowerCase().includes(q));
  }, [targets, query]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#0e0e12] border border-[#2E2E2E] rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#2E2E2E] flex items-center justify-between">
          <span className="text-sm font-medium text-white">Forward to…</span>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-[#999] hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="px-3 py-2 border-b border-[#2E2E2E]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full bg-[#1F1F1F] border border-[#2E2E2E] text-white rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
          />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-[11px] text-[#6E6E6E]">
              No matches
            </div>
          ) : (
            filtered.map((t) => (
              <button
                key={`${t.kind}:${t.id}`}
                type="button"
                onClick={() => {
                  onSend(t);
                  onClose();
                }}
                className="w-full text-left px-4 py-2 text-[11px] text-white hover:bg-[#2E2E2E] flex items-center justify-between"
              >
                <span className="truncate">{t.label}</span>
                <span className="text-[9px] uppercase tracking-wide text-[#6E6E6E]">
                  {t.kind}
                </span>
              </button>
            ))
          )}
        </div>
        {text && (
          <div className="px-4 py-2 border-t border-[#2E2E2E] text-[10px] text-[#6E6E6E]">
            <span className="text-white">Preview:</span> {text.slice(0, 120)}
            {text.length > 120 ? "…" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Delete confirmation dialog ────────────────────────────────────────────

export function DeleteConfirmDialog({
  open,
  count,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  count?: number; // number of messages being deleted (for bulk)
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  const isBulk = (count ?? 1) > 1;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-xs bg-[#1a1a1f] border border-[#2a2a35] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 text-center">
          <div className="h-10 w-10 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-3">
            <Trash2 className="h-5 w-5 text-red-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">
            {isBulk ? `Delete ${count} messages?` : "Delete message?"}
          </h3>
          <p className="text-[11px] text-white/50 mt-1.5 leading-relaxed">
            {isBulk
              ? "These messages will be permanently deleted for everyone. This cannot be undone."
              : "This message will be permanently deleted for everyone. This cannot be undone."}
          </p>
        </div>
        <div className="px-4 pb-4 flex items-center gap-2 mt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-9 rounded-lg border border-[#3a3a3a] text-[12px] font-medium text-white/80 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-9 rounded-lg bg-red-500 text-[12px] font-medium text-white hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

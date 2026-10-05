"use client";

import { useMemo, useState } from "react";
import {
  MicOff,
  ChevronUp,
  ChevronDown,
  X,
  Pencil,
  Monitor,
  Smartphone,
  Search,
} from "lucide-react";
import useWebinarStore, { detectLocalDeviceType } from "@/store/webinarStore";
import type { WebinarRole } from "@/store/webinarStore";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import type { Socket } from "socket.io-client";
import {
  useAccessControl,
  type PermissionKind,
} from "@/hooks/office/useAccessControl";

interface ParticipantsListProps {
  socket: Socket | null;
  webinarId: string;
}

export default function ParticipantsList({
  socket,
  webinarId,
}: ParticipantsListProps) {
  const peers = useWebinarStore((s) => s.peers);
  const simulatedPeople = useWebinarStore((s) => s.simulatedPeople);
  const role = useWebinarStore((s) => s.role);
  const localAvatar = useWebinarStore((s) => s.localAvatar);
  const user = useAuthStore((s) => s.user);
  // Mirror the avatar resolution VideoGrid uses for the local tile —
  // prefer what the backend echoed at joinRoom, then fall back to the
  // auth store. Keeps the People panel and the video tiles consistent.
  const myAvatar =
    localAvatar ||
    (user as { profilePicture?: string } | null)?.profilePicture ||
    "";

  const total = peers.length + simulatedPeople.length + 1;
  const isModerator = role === "host" || role === "panelist";

  // Our own row gets no server-sent deviceType (the peers list excludes the
  // caller), so read it off this browser directly.
  const myDeviceType = detectLocalDeviceType();

  /**
   * The same access-control feature the office meets use. Its routes are
   * room-generic — they take a LiveKit room name and widen that participant's
   * canPublishSources — and a webinar's room is `webinar-<id>`, so this needs
   * no webinar-specific API. Approving is what actually hands someone the mic;
   * the raised hand beside their name is only the ask.
   */
  const roomName = `webinar-${webinarId}`;
  const myUserId =
    (user as { _id?: string; id?: string } | null)?._id ||
    (user as { id?: string } | null)?.id ||
    "";
  const { pending, grantPermission, denyPermission } = useAccessControl({
    roomName,
    isHost: isModerator,
    localUserId: myUserId,
  });

  const handleGrant = async (
    userId: string,
    name: string,
    kind: PermissionKind
  ) => {
    try {
      await grantPermission(userId, kind);
      toast.success(`${name} can now ${kind === "present" ? "present" : "speak"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve");
    }
  };

  const handleDeny = async (userId: string, name: string) => {
    try {
      await denyPermission(userId);
      toast.success(`Declined ${name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to deny");
    }
  };

  const mute = (id: string) =>
    socket?.emit(
      "webinar:muteParticipant",
      { webinarId, targetSocketId: id },
      (r: { success?: boolean; error?: string }) => {
        if (!r?.success) toast.error(r?.error || "Failed to mute");
      }
    );

  const remove = (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the webinar?`)) return;
    socket?.emit(
      "webinar:removeParticipant",
      { webinarId, targetSocketId: id },
      (r: { success?: boolean; error?: string }) => {
        if (!r?.success) toast.error(r?.error || "Failed to remove");
      }
    );
  };

  const promote = (id: string, name: string) => {
    if (
      !confirm(
        `Make ${name} a Co-Host? They will be able to use camera, mic & screen share.`
      )
    )
      return;
    socket?.emit(
      "webinar:promoteToHost",
      { webinarId, targetSocketId: id },
      (r: { success?: boolean; error?: string }) => {
        if (r?.success) toast.success(`${name} is now a Co-Host`);
        else toast.error(r?.error || "Failed to promote");
      }
    );
  };

  const demote = (id: string, name: string) => {
    if (
      !confirm(
        `Remove Co-Host role from ${name}? They will become a regular attendee.`
      )
    )
      return;
    socket?.emit(
      "webinar:demoteToAttendee",
      { webinarId, targetSocketId: id },
      (r: { success?: boolean; error?: string }) => {
        if (r?.success) toast.success(`${name} is now an attendee`);
        else toast.error(r?.error || "Failed to demote");
      }
    );
  };

  /**
   * Stand down from Co-Host. Same server call as demoting anyone else — a
   * co-host was always allowed to pass their own socket — it simply had no
   * control in the UI. Camera, mic and screen share are torn down by the
   * `webinar:roleChanged` handler, which this goes through like any other
   * demotion, so there's no separate cleanup here.
   *
   * Only offered to co-hosts. A host stepping down could leave the room
   * with nobody able to run it, which is a different decision entirely.
   */
  const stepDown = () => {
    const myId = socket?.id;
    if (!myId) {
      toast.error("Not connected");
      return;
    }
    if (
      !confirm(
        "Stop being a Co-Host? You'll become a regular attendee and lose camera, mic and screen share."
      )
    )
      return;
    socket?.emit(
      "webinar:demoteToAttendee",
      { webinarId, targetSocketId: myId },
      (r: { success?: boolean; error?: string }) => {
        if (!r?.success) toast.error(r?.error || "Failed to step down");
        // On success the roleChanged broadcast announces it — a toast here
        // too would double up.
      }
    );
  };

  const muteAll = () => {
    const attendees = peers.filter((p) => p.role === "attendee");
    if (!attendees.length) {
      toast.info("No attendees to mute");
      return;
    }
    attendees.forEach((p) =>
      socket?.emit("webinar:muteParticipant", {
        webinarId,
        targetSocketId: p.socketId,
      })
    );
    toast.success(
      `Muted ${attendees.length} attendee${attendees.length > 1 ? "s" : ""}`
    );
  };

  // Roster search. A busy webinar can run to hundreds of rows, where finding
  // one person to promote or remove meant scrolling. Name-only and
  // case-insensitive — that's all a row exposes to match on.
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visiblePeers = useMemo(
    () => (q ? peers.filter((p) => (p.name || "").toLowerCase().includes(q)) : peers),
    [peers, q]
  );
  // The scripted audience answers to the same search. They render as ordinary
  // attendee rows with no moderation controls — there is no socket behind them
  // to mute, promote or remove.
  const visibleSimulated = useMemo(
    () =>
      q
        ? simulatedPeople.filter((p) => (p.name || "").toLowerCase().includes(q))
        : simulatedPeople,
    [simulatedPeople, q]
  );
  // Your own row is part of the roster, so it has to answer to the search
  // like any other — otherwise "no matches" still shows a result.
  const selfMatches = !q || (user?.name || "You").toLowerCase().includes(q);
  const noMatches =
    !!q && !selfMatches && visiblePeers.length === 0 && visibleSimulated.length === 0;

  const roleBadge: Record<string, string> = {
    host: "bg-purple-900/50 text-purple-300 border border-purple-700",
    panelist: "bg-blue-900/50 text-blue-300 border border-blue-700",
    attendee: "bg-zinc-900 text-zinc-500",
    "pre-guest": "bg-yellow-900/40 text-yellow-400 border border-yellow-700/50",
  };

  return (
    <div className="flex flex-col h-full bg-[#282828]">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-sm">Participants</p>
          <p className="text-zinc-500 text-xs mt-0.5">{total} in room</p>
        </div>
        {(role === "host" || role === "panelist") && peers.length > 0 && (
          <button
            onClick={muteAll}
            className="text-xs text-yellow-400 hover:text-yellow-300 bg-yellow-900/20 hover:bg-yellow-900/40 px-2 py-1 rounded transition-colors flex items-center gap-1"
            title="Mute all attendees"
          >
            <MicOff className="w-3 h-3" />
            Mute All
          </button>
        )}
      </div>

      <div className="px-3 pt-2.5 pb-0.5 shrink-0">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-1.5">
          <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            aria-label="Search participants"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder-zinc-500"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="shrink-0 text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {/* Requests for the stage, above the roster so the host answers them
            without hunting. A raised hand from mobile files one of these: the
            hand on its own was decoration, since publish rights come from the
            grant below rather than from the hand. */}
        {isModerator && pending.length > 0 && (
          <div className="mb-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-300/90">
                Permission requests
              </div>
              <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                {pending.length}
              </span>
            </div>
            {pending.map((req) => {
              const what =
                req.kind === "both"
                  ? "speak & present"
                  : req.kind === "unmute"
                    ? "speak"
                    : "present";
              return (
                <div
                  key={req.userId}
                  className="mb-1.5 flex items-center gap-2 rounded-lg px-2 py-1.5 last:mb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-white">{req.name}</div>
                    <div className="truncate text-[10px] text-amber-200/80">
                      wants to {what}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeny(req.userId, req.name)}
                    className="shrink-0 rounded-md px-2 py-1 text-[11px] text-zinc-300 transition hover:bg-white/10 hover:text-white"
                    title="Deny request"
                  >
                    Deny
                  </button>
                  <button
                    onClick={() => handleGrant(req.userId, req.name, req.kind)}
                    className="shrink-0 rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-amber-400"
                    title="Approve request"
                  >
                    Approve
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Self */}
        {selfMatches && (
          <ParticipantRow
            name={user?.name || "You"}
            peerRole={role}
            isSelf
            avatar={myAvatar}
            deviceType={myDeviceType}
            roleBadge={roleBadge}
            socket={socket}
            webinarId={webinarId}
            // Only a co-host is offered the way out; a host stepping down
            // could leave the room with nobody able to run it.
            onStepDown={role === "panelist" ? stepDown : undefined}
          />
        )}

        {visiblePeers.map((peer) => (
          <ParticipantRow
            key={peer.socketId}
            name={peer.name}
            peerRole={peer.role}
            avatar={peer.avatar}
            deviceType={peer.deviceType}
            handRaised={peer.handRaised}
            isMuted={peer.isMuted}
            roleBadge={roleBadge}
            isHost={role === "host" || role === "panelist"}
            onMute={() => mute(peer.socketId)}
            onRemove={() => remove(peer.socketId, peer.name)}
            onPromote={
              peer.role === "attendee"
                ? () => promote(peer.socketId, peer.name)
                : undefined
            }
            onDemote={
              peer.role === "panelist"
                ? () => demote(peer.socketId, peer.name)
                : undefined
            }
          />
        ))}

        {visibleSimulated.map((p, i) => (
          <ParticipantRow
            key={`sim-${p.name}-${i}`}
            name={p.name}
            peerRole="attendee"
            roleBadge={roleBadge}
            // No isHost, no handlers: a scripted attendee has nothing to mute,
            // promote or remove, so the moderation menu must not appear.
          />
        ))}

        {noMatches && (
          <p className="px-2 py-6 text-center text-[13px] text-zinc-500">
            Nobody matching &ldquo;{query.trim()}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Participant Row ──────────────────────────────────────────────────────── */

interface ParticipantRowProps {
  name: string;
  peerRole: WebinarRole;
  isSelf?: boolean;
  /** Profile picture URL. Falls back to coloured initials when missing. */
  avatar?: string;
  /** Client the participant joined from. Unknown is drawn as web. */
  deviceType?: "web" | "mobile";
  handRaised?: boolean;
  isMuted?: boolean;
  roleBadge: Record<string, string>;
  isHost?: boolean;
  onMute?: () => void;
  onRemove?: () => void;
  onPromote?: () => void;
  onDemote?: () => void;
  /** Self row only: give up Co-Host. Absent for hosts and attendees. */
  onStepDown?: () => void;
  socket?: Socket | null;
  webinarId?: string;
}

function ParticipantRow({
  name,
  peerRole,
  isSelf,
  avatar,
  deviceType,
  handRaised,
  isMuted,
  roleBadge,
  isHost,
  onMute,
  onRemove,
  onPromote,
  onDemote,
  onStepDown,
  socket,
  webinarId,
}: ParticipantRowProps) {
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
  const avatarColor = isSelf ? "bg-zinc-800" : "bg-zinc-800";
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(name);

  const saveName = () => {
    const clean = (editName || "").trim();
    if (!clean || clean === name) {
      setEditing(false);
      return;
    }
    socket?.emit(
      "webinar:updateName",
      { webinarId, name: clean },
      (res: { success?: boolean; error?: string }) => {
        if (res?.success) {
          useAuthStore.getState().updateUser({ name: clean });
          toast.success("Name updated");
        } else {
          toast.error(res?.error || "Failed");
        }
      }
    );
    setEditing(false);
  };

  return (
    <div
      className={`flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-white/[0.05] group transition-colors ${
        handRaised ? "bg-yellow-900/20" : ""
      }`}
    >
      <div
        className={`relative w-8 h-8 rounded-full ${
          avatar ? "" : avatarColor
        } flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 overflow-hidden ${
          handRaised
            ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-black"
            : ""
        }`}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          initials
        )}
        {handRaised && (
          <span className="absolute -top-1.5 -right-1.5 text-sm animate-bounce">
            <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 8.5V5.5a1 1 0 00-2 0v3h-1V4a1 1 0 00-2 0v4.5h-1V3.5a1 1 0 00-2 0V8.5h-1V5a1 1 0 00-2 0v7l-1.76-1.76a1 1 0 00-1.41 1.41L8 15.82V20h8l3-7.5V8.5z" />
            </svg>
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {isSelf && editing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") setEditing(false);
            }}
            maxLength={50}
            className="bg-zinc-950 text-white text-sm px-2 py-0.5 rounded border border-white/10 w-full focus:outline-none focus:border-white/30"
          />
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-sm text-white truncate">
              {name}{" "}
              {isSelf && (
                <span className="text-zinc-500 text-xs">(You)</span>
              )}
              {isSelf && (
                <button
                  onClick={() => {
                    setEditName(name);
                    setEditing(true);
                  }}
                  className="text-zinc-500 hover:text-blue-400 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Edit name"
                >
                  <Pencil className="w-3 h-3 inline" />
                </button>
              )}
            </p>
            {/* Which client they're on. Anything the server couldn't place
                is drawn as web — the desktop glyph is the safer guess. */}
            <span
              className="shrink-0 leading-none"
              title={deviceType === "mobile" ? "Mobile" : "Web"}
            >
              {deviceType === "mobile" ? (
                <Smartphone
                  className="w-3.5 h-3.5 text-zinc-400 shrink-0"
                  aria-label="Mobile"
                />
              ) : (
                <Monitor
                  className="w-3.5 h-3.5 text-zinc-400 shrink-0"
                  aria-label="Web"
                />
              )}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={`inline-block text-xs px-1.5 py-0 rounded capitalize ${
              roleBadge[peerRole] || roleBadge.attendee
            }`}
          >
            {peerRole === "panelist" ? "Co-Host" : peerRole}
          </span>
          {isMuted && (
            <MicOff className="w-3 h-3 text-red-400" />
          )}
        </div>
      </div>

      {onStepDown && (
        <button
          onClick={onStepDown}
          title="Give up Co-Host and become a regular attendee"
          // Spelled out rather than an icon: it only appears on your own row,
          // it's rare, and it's not worth guessing at.
          className="shrink-0 text-[11px] font-medium text-orange-400 hover:text-orange-300 px-2 py-1 rounded hover:bg-white/10 transition-colors"
        >
          Step down
        </button>
      )}

      {isHost && !isSelf && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onMute}
            title="Mute"
            className="text-xs text-yellow-400 hover:text-yellow-300 px-1.5 py-1 rounded hover:bg-white/10 transition-colors"
          >
            <MicOff className="w-3.5 h-3.5" />
          </button>
          {onPromote && (
            <button
              onClick={onPromote}
              title="Make Co-Host"
              className="text-xs text-green-400 hover:text-green-300 px-1.5 py-1 rounded hover:bg-white/10 transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}
          {onDemote && (
            <button
              onClick={onDemote}
              title="Remove Co-Host"
              className="text-xs text-orange-400 hover:text-orange-300 px-1.5 py-1 rounded hover:bg-white/10 transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onRemove}
            title="Kick Out"
            className="text-xs text-red-400 hover:text-red-300 px-1.5 py-1 rounded hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

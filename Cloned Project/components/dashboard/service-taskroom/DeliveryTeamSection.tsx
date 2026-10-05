"use client";

/**
 * "Delivery team & pay rates" — part of Section 3 for a billable service.
 *
 * Two things live here that nothing else in the wizard covers:
 *
 *  - what each person is paid per hour. It is per person, not per service,
 *    because nobody is paid the same; the gap against the client's billed rate
 *    is the margin, shown per row so a loss-making rate is obvious while it is
 *    being typed.
 *  - which tasks are theirs. A task added here lands on the taskroom board in
 *    Section 6 with them as the assignee, and provisioning adds them to the
 *    engagement room, so the assignment survives into Taskroom untouched.
 *
 * Pay rates are internal. The server strips them from every response a
 * non-founder can reach — this component is the only place they are shown.
 */

import { useMemo, useState } from "react";
import {
  Check,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceTeamMember, TeamMember } from "@/lib/feed-api";

const INPUT_CLS =
  "w-full rounded-lg border border-[#262626] bg-[#0F0F0F] px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-brand";

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "?"
  );
}

function Avatar({ member }: { member: { name: string; image?: string } }) {
  if (member.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={member.image}
        alt={member.name}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#262626] text-[11px] font-semibold text-zinc-300">
      {initials(member.name)}
    </span>
  );
}

export function DeliveryTeamSection({
  team,
  onChange,
  currency,
  hourlyRate,
  members,
  loadingMembers,
  assignedTasks,
  onAssignTask,
  onUnassignTask,
  boardEnabled,
}: {
  team: ServiceTeamMember[];
  onChange: (team: ServiceTeamMember[]) => void;
  currency: string;
  /** What the client is billed per hour, for the margin readout. */
  hourlyRate: number;
  members: TeamMember[];
  loadingMembers: boolean;
  /** Task titles already assigned to each user id, read from the board config. */
  assignedTasks: Record<string, string[]>;
  onAssignTask: (member: ServiceTeamMember, title: string) => void;
  onUnassignTask: (userId: string, title: string) => void;
  /** Section 6 is off — say so rather than silently dropping the tasks. */
  boardEnabled: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [draftTask, setDraftTask] = useState<Record<string, string>>({});

  const added = useMemo(
    () => new Set(team.map((member) => member.userId)),
    [team],
  );

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter((member) => {
      if (added.has(member._id)) return false;
      if (!needle) return true;
      return (
        member.name?.toLowerCase().includes(needle) ||
        member.email?.toLowerCase().includes(needle)
      );
    });
  }, [members, added, query]);

  const addMember = (member: TeamMember) => {
    onChange([
      ...team,
      {
        userId: member._id,
        name: member.name || member.email,
        email: member.email,
        image: member.profilePicture,
        payRate: 0,
        // Left blank on purpose: their org role ("stakeholder") is not what
        // they do on this service, which is what the client is shown.
        role: "",
      },
    ]);
    setQuery("");
    setPicking(false);
  };

  const patchMember = (userId: string, patch: Partial<ServiceTeamMember>) =>
    onChange(
      team.map((member) =>
        member.userId === userId ? { ...member, ...patch } : member,
      ),
    );

  const removeMember = (userId: string) =>
    onChange(team.filter((member) => member.userId !== userId));

  const submitTask = (member: ServiceTeamMember) => {
    const title = (draftTask[member.userId] || "").trim();
    if (!title) return;
    onAssignTask(member, title);
    setDraftTask((prev) => ({ ...prev, [member.userId]: "" }));
  };

  return (
    <div className="rounded-xl border border-[#262626] bg-[#1A1A1A] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <div>
            <p className="text-xs font-semibold text-white">
              Delivery team &amp; pay rates
            </p>
            <p className="text-[11px] text-zinc-500">
              What each person is paid per hour, and the tasks that are theirs.
              Rates are internal — clients only ever see names.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPicking((open) => !open)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#262626] px-2.5 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-[#3A3A3A] hover:text-white"
        >
          <UserPlus className="h-3 w-3" />
          Add employee
        </button>
      </div>

      {picking && (
        <div className="mt-3 rounded-xl border border-[#262626] bg-[#0F0F0F]">
          <div className="flex items-center gap-2 border-b border-[#262626] px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employees by name or email..."
              className="w-full border-none bg-transparent text-xs text-white placeholder:text-zinc-600 outline-none"
            />
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="text-zinc-600 transition-colors hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {loadingMembers ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
              </div>
            ) : candidates.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-zinc-600">
                {members.length === 0
                  ? "No employees in this organisation yet."
                  : "Everyone matching is already on the team."}
              </p>
            ) : (
              candidates.map((member) => (
                <button
                  key={member._id}
                  type="button"
                  onClick={() => addMember(member)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                >
                  <Avatar
                    member={{
                      name: member.name || member.email,
                      image: member.profilePicture,
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-white">
                      {member.name || member.email}
                    </span>
                    <span className="block truncate text-[11px] text-zinc-500">
                      {member.email}
                    </span>
                  </span>
                  <Plus className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {team.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-[#262626] py-6 text-center text-[11px] text-zinc-500">
          No one on the delivery team yet. Add an employee to set their pay rate
          and give them tasks.
        </p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {team.map((member) => {
            const tasks = assignedTasks[member.userId] || [];
            const margin = (hourlyRate || 0) - (member.payRate || 0);
            const hasRates = hourlyRate > 0 && member.payRate > 0;

            return (
              <div
                key={member.userId}
                className="rounded-xl border border-[#262626] bg-[#0F0F0F] p-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar member={member} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white">
                      {member.name}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {member.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMember(member.userId)}
                    className="shrink-0 text-zinc-600 transition-colors hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Paid per hour ({currency})
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={member.payRate || ""}
                      onChange={(e) =>
                        patchMember(member.userId, {
                          payRate: parseFloat(e.target.value) || 0,
                        })
                      }
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      placeholder="40.00"
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Role on this service
                    </label>
                    <input
                      value={member.role || ""}
                      onChange={(e) =>
                        patchMember(member.userId, { role: e.target.value })
                      }
                      placeholder="Senior Engineer"
                      className={INPUT_CLS}
                    />
                  </div>
                </div>

                {hasRates && (
                  <p
                    className={cn(
                      "mt-1.5 text-[11px]",
                      margin > 0 ? "text-zinc-500" : "text-red-400",
                    )}
                  >
                    {margin > 0
                      ? `${currency} ${margin.toFixed(2)} margin on every hour they log.`
                      : `Billed at ${currency} ${hourlyRate.toFixed(2)} — every hour they log loses ${currency} ${Math.abs(margin).toFixed(2)}.`}
                  </p>
                )}

                <div className="mt-3 border-t border-[#262626] pt-2.5">
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    Tasks assigned to {member.name.split(" ")[0]}
                  </p>
                  {tasks.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap gap-1.5">
                      {tasks.map((title) => (
                        <span
                          key={title}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-brand/20 bg-brand/10 px-2 py-1 text-[10px] text-brand"
                        >
                          <Check className="h-2.5 w-2.5" />
                          {title}
                          <button
                            type="button"
                            onClick={() => onUnassignTask(member.userId, title)}
                            className="text-brand/70 transition-colors hover:text-white"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    value={draftTask[member.userId] || ""}
                    onChange={(e) =>
                      setDraftTask((prev) => ({
                        ...prev,
                        [member.userId]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitTask(member);
                      }
                    }}
                    placeholder="+ Assign a task to this person"
                    className="w-full rounded-lg border border-dashed border-[#2A2A2A] bg-transparent px-2.5 py-1.5 text-[11px] text-white placeholder:text-zinc-600 outline-none focus:border-brand"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[11px] text-zinc-600">
        {boardEnabled
          ? "Everyone here is added to the client's taskroom room when the engagement is created, and their tasks arrive already assigned to them."
          : "Turn the taskroom on in section 6 to have these people and their tasks provisioned into the client's room."}
      </p>
    </div>
  );
}

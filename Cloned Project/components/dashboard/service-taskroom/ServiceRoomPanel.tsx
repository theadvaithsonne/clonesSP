"use client";

/**
 * The "Service" tab shown inside a Taskroom room that belongs to a service
 * engagement.
 *
 * Purely additive: it renders only when `useLinkedService` resolves the room to
 * an engagement, so ordinary taskrooms never see this tab and nothing about
 * their behaviour changes. It reads from Garage's own API — not Taskroom's —
 * so it adds no load to the board's own fetch chain.
 */

import { Fragment } from "react";
import {
  CheckCircle2,
  CircleDashed,
  CreditCard,
  Loader2,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskroomLinkedService } from "@/lib/feed-api";

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

const PAYMENT_PILL: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pending: "bg-brand/10 text-brand border-brand/20",
  not_required: "bg-white/5 text-zinc-500 border-white/10",
};

export function ServiceRoomPanel({
  linked,
}: {
  linked: TaskroomLinkedService | null;
}) {
  if (!linked) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
      </div>
    );
  }

  const { service, optIn, client, viewerRole } = linked;
  const milestones = [...(optIn.milestonesProgress || [])].sort(
    (a, b) => a.order - b.order,
  );

  return (
    <div className="h-full overflow-y-auto p-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="rounded-2xl border border-[#e5e7eb29] bg-[#141414] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                style={{ backgroundColor: service.iconBgColor || "#1a1a22" }}
              >
                {service.icon || "🧩"}
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Service engagement
                </p>
                <h3 className="text-lg font-bold text-white">
                  {service.title}
                </h3>
                {viewerRole === "founder" && client && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-400">
                    <UserIcon className="h-3 w-3" />
                    {client.name || client.email}
                  </p>
                )}
              </div>
            </div>

            <div className="text-right">
              <p className="text-2xl font-bold text-brand">
                {optIn.progressPercentage}%
              </p>
              <p className="text-[11px] text-zinc-500">
                {optIn.completedMilestones} of {optIn.totalMilestones}{" "}
                milestones
              </p>
            </div>
          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#0F0F0F]">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${optIn.progressPercentage}%` }}
            />
          </div>
        </div>

        {viewerRole === "founder" && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total", value: optIn.totalAmount },
              { label: "Paid", value: optIn.amountPaid },
              { label: "Pending", value: optIn.amountPending },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-[#e5e7eb29] bg-[#141414] p-3.5"
              >
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  {stat.label}
                </p>
                <p className="mt-1 text-base font-bold text-white">
                  {formatMoney(stat.value, optIn.currency)}
                </p>
              </div>
            ))}
          </div>
        )}

        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Milestones
          </p>
          <div className="overflow-hidden rounded-2xl border border-[#e5e7eb29] bg-[#141414]">
            {milestones.map((milestone, index) => (
              <Fragment key={milestone.milestoneId}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    index > 0 && "border-t border-[#e5e7eb29]",
                  )}
                >
                  {milestone.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <CircleDashed
                      className={cn(
                        "h-4 w-4 shrink-0",
                        milestone.status === "in_progress"
                          ? "text-brand"
                          : "text-zinc-700",
                      )}
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {milestone.title}
                    </p>
                    <p className="text-[11px] capitalize text-zinc-500">
                      {milestone.status.replace("_", " ")}
                    </p>
                  </div>

                  {milestone.paymentAmount > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">
                        {formatMoney(
                          milestone.paymentAmount,
                          milestone.currency || optIn.currency,
                        )}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium",
                          PAYMENT_PILL[milestone.paymentStatus] ||
                            PAYMENT_PILL.not_required,
                        )}
                      >
                        <CreditCard className="h-2.5 w-2.5" />
                        {milestone.paymentStatus.replace("_", " ")}
                      </span>
                    </div>
                  )}
                </div>
              </Fragment>
            ))}
          </div>
        </div>

        <p className="px-1 text-[11px] text-zinc-600">
          Milestone approval and payments are managed from the service
          engagement, not from this board.
        </p>
      </div>
    </div>
  );
}

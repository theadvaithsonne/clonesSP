"use client";

// A14 · Mark hired: confirm the joining date and see what happens to the
// referral reward — its guarantee period starts from the joining date, and
// it is paid through the commission plan once that ends. Without a referral
// link there is simply no reward due.

import React from "react";
import { toast } from "sonner";
import * as jobsApi from "../../api";
import { Avatar, Button, GOLD, Label, MatchScore, Modal, errorMessage, formatDate, formatMoney } from "../../ui";

function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86400000);
}

export default function HireModal({
  open,
  applicationId,
  candidate,
  jobTitle,
  reward,
  referral,
  onClose,
  onDone,
}: {
  open: boolean;
  applicationId: string;
  candidate: { name: string; avatar?: string; matchScore: number };
  jobTitle: string;
  reward: { enabled: boolean; amount: number; guaranteeDays: number } | null;
  referral: { name: string; affiliateId: string } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [joining, setJoining] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setJoining(addDays(new Date(), 30).toISOString().slice(0, 10));
  }, [open]);

  const joinDate = joining ? new Date(`${joining}T09:00:00`) : null;
  const rewardDue = !!(reward?.enabled && reward.amount > 0 && referral);
  const guaranteeEnd = joinDate && reward ? addDays(joinDate, reward.guaranteeDays || 90) : null;

  const milestones: Array<{ title: string; sub: string }> = [
    { title: "Hired today", sub: formatDate(new Date()) },
    { title: joinDate ? `Joins ${formatDate(joinDate)}` : "Joining date", sub: "Joining date" },
  ];
  if (rewardDue && guaranteeEnd) {
    milestones.push(
      { title: `Guarantee ends ${formatDate(guaranteeEnd)}`, sub: `${reward!.guaranteeDays}-day guarantee` },
      { title: "Reward paid out", sub: `${formatMoney(reward!.amount)} split through the commission plan` }
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Mark ${candidate.name} hired`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={!joining}
            onClick={async () => {
              if (!joinDate) return;
              setBusy(true);
              try {
                const res = await jobsApi.hireApplication(applicationId, joinDate.toISOString());
                toast.success(
                  res.filled ? `${candidate.name} hired — all openings are filled, so the job is now closed` : `${candidate.name} hired`
                );
                onDone();
              } catch (err) {
                toast.error(errorMessage(err, "Couldn't confirm the hire."));
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirm hire
          </Button>
        </>
      }
    >
      <p className="-mt-2 text-sm text-[#7c7d94]">Confirm the joining date and referral outcome.</p>
      <div className="flex items-center gap-3 rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3">
        <Avatar name={candidate.name} src={candidate.avatar} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">{candidate.name}</div>
          <div className="truncate text-xs text-[#7c7d94]">{jobTitle}</div>
        </div>
        <MatchScore score={candidate.matchScore} />
      </div>
      <div>
        <Label required>Joining date</Label>
        <input
          type="date"
          value={joining}
          onChange={(e) => setJoining(e.target.value)}
          className="w-full rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-sm text-white outline-none [color-scheme:dark] focus:border-brand"
        />
      </div>

      {rewardDue ? (
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: "color-mix(in srgb, var(--brand) 40%, #262626)" }}>
          <div className="text-sm text-white">
            Referral reward: <span style={{ color: GOLD }}>{formatMoney(reward!.amount)}</span> · referred by {referral!.name} ({referral!.affiliateId})
          </div>
          <p className="mt-1 text-xs leading-5 text-[#7c7d94]">
            If {candidate.name.split(" ")[0]} leaves before {guaranteeEnd ? formatDate(guaranteeEnd) : "the guarantee ends"}, mark it in Referral
            Payouts and the reward is cancelled. If it has already been paid, the referrer owes a refund.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#262626] bg-[#141414] px-4 py-3 text-sm text-[#c7c7da]">
          {referral ? "This job has no referral reward — nothing is due." : "No referral link — no reward due."}
        </div>
      )}

      <ol className="space-y-3 border-l border-[#262626] pl-4">
        {milestones.map((m, i) => (
          <li key={i} className="relative">
            <span
              className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full"
              style={{ background: i === 0 ? "#22c55e" : i === milestones.length - 1 && rewardDue ? GOLD : "#3a3a48" }}
            />
            <div className="text-sm text-white">{m.title}</div>
            <div className="text-xs text-[#7c7d94]">{m.sub}</div>
          </li>
        ))}
      </ol>
    </Modal>
  );
}

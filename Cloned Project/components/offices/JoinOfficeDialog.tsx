"use client";

import React, { useEffect, useState } from "react";
import { DoorOpen, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchPublicOffice,
  joinPublicOffice,
  requestToJoinOffice,
  type PublicOfficeDetails,
} from "@/lib/discover-api";
import type { OfficeCardData } from "./OfficeCard";
import { OfficeEmblem, Pill, PillButton, initials } from "./ui";

/**
 * "Join X?" for an office you're not in. Open offices (`office_public`) join
 * straight away; the rest send the founders a request instead.
 */
export function JoinOfficeDialog({
  office,
  userId,
  userName,
  pending,
  onClose,
  onJoined,
  onRequested,
}: {
  office: OfficeCardData | null;
  userId: string;
  userName?: string;
  /** A request to this office is already waiting on its founders. */
  pending: boolean;
  onClose: () => void;
  /** Called once the join succeeded; entering the office is up to the page. */
  onJoined: (office: OfficeCardData) => Promise<void> | void;
  onRequested: (office: OfficeCardData) => void;
}) {
  const [details, setDetails] = useState<PublicOfficeDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  // null = couldn't tell; joining then falls back to a request if refused.
  const [isOpenOffice, setIsOpenOffice] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setDetails(null);
    setIsOpenOffice(null);
    setSubmitting(false);
    if (!office) return;
    let cancelled = false;
    setLoadingDetails(true);
    fetchPublicOffice(office._id)
      .then((d) => {
        if (cancelled) return;
        setDetails(d);
        setIsOpenOffice(d.office_public === true);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });
    return () => {
      cancelled = true;
    };
  }, [office]);

  if (!office) return null;

  const name = office.name;
  const founders = (details?.founders || []).slice(0, 3);
  const memberCount = office.memberCount;
  const requestMode = isOpenOffice === false;

  const join = async () => {
    setSubmitting(true);
    try {
      await joinPublicOffice(userId, office._id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/not public/i.test(message)) {
        setIsOpenOffice(false);
        toast.message(`${name} reviews new members. Send a request instead.`);
      } else {
        toast.error(message || `Couldn't join ${name}`);
      }
      setSubmitting(false);
      return;
    }
    // Entering the office navigates away; the spinner stays until it does.
    await onJoined(office);
    setSubmitting(false);
  };

  const request = async () => {
    setSubmitting(true);
    try {
      await requestToJoinOffice(userId, office._id, userName);
      toast.success(`Request sent to ${name}`);
      onRequested(office);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send your request");
      setSubmitting(false);
    }
  };

  const description =
    office.description ||
    details?.description ||
    (requestMode
      ? "Its founders review new members. Send a request and you'll get in once they approve."
      : "Join to get into its rooms, member directory and conversations. You can leave at any time.");

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-w-[488px] flex-col items-center gap-6 rounded-[28px] border-[rgba(229,184,92,0.3)] bg-[#181713] p-8 text-center font-[family-name:var(--font-chat)] shadow-[0_10px_30px_rgba(214,155,48,0.2)] sm:max-w-[488px]"
      >
        <OfficeEmblem
          name={name}
          icon={office.icon || details?.icon}
          className="size-[72px] rounded-[20px]"
          textClassName="text-[28px]"
        />

        <div className="flex w-full flex-col items-center gap-2.5">
          {pending ? (
            <Pill tone="neutral">Request pending</Pill>
          ) : loadingDetails ? (
            <div className="h-7 w-24 animate-pulse rounded-full bg-[#24221d]" />
          ) : isOpenOffice === true ? (
            <Pill tone="success">Open office</Pill>
          ) : isOpenOffice === false ? (
            <Pill tone="neutral">Approval required</Pill>
          ) : null}
          <DialogTitle className="text-[24px] font-semibold leading-tight text-[#f5f1e7] sm:text-[28px]">
            {pending ? "Request pending" : requestMode ? `Request to join ${name}?` : `Join ${name}?`}
          </DialogTitle>
          <DialogDescription className="line-clamp-4 text-[15px] leading-[1.5] text-[#aaa69c]">
            {pending
              ? `${name}'s founders haven't answered yet. You'll get in once they approve.`
              : description}
          </DialogDescription>
        </div>

        {(founders.length > 0 || !!memberCount) && (
          <div className="flex items-center gap-2.5">
            {founders.length > 0 && (
              <div className="flex">
                {founders.map((f, i) => (
                  <div
                    key={f._id}
                    title={f.name}
                    className={`-mr-2 flex size-[30px] items-center justify-center overflow-hidden rounded-full border-2 border-[#090908] text-[9.6px] font-bold last:mr-0 ${
                      i === 0 ? "bg-[#ffc200] text-black" : "bg-[#201e18] text-[#f5f1e7]"
                    }`}
                  >
                    {f.profilePicture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.profilePicture} alt="" className="size-full object-cover" />
                    ) : (
                      initials(f.name)
                    )}
                  </div>
                ))}
              </div>
            )}
            {!!memberCount && (
              <p className="text-[13px] text-[#aaa69c]">
                {memberCount.toLocaleString()} {memberCount === 1 ? "member is" : "members are"} already inside
              </p>
            )}
          </div>
        )}

        <div className="flex w-full flex-col gap-2.5">
          {pending ? (
            <PillButton variant="primary" disabled className="w-full">
              Request sent
            </PillButton>
          ) : (
            <PillButton
              variant="primary"
              className="w-full"
              disabled={submitting || loadingDetails}
              onClick={requestMode ? request : join}
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : requestMode ? (
                <Send className="size-4" />
              ) : (
                <DoorOpen className="size-4" />
              )}
              {requestMode ? "Send request" : `Join ${name}`}
            </PillButton>
          )}
          <PillButton variant="ghost" className="w-full" disabled={submitting} onClick={onClose}>
            Not now
          </PillButton>
        </div>

        {!pending && !requestMode && (
          <p className="text-[11px] text-[#747169]">By joining, you agree to follow the office guidelines.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

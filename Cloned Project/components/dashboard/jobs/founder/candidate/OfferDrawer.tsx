"use client";

// A14 · Create offer: role, annual CTC, currency, joining and expiry dates, an
// offer letter and a message. The candidate accepts or declines inside Garage;
// earlier offers stay listed (withdraw a sent one before sending a new one).

import React from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useUploadThing } from "@/lib/uploadthing";
import * as jobsApi from "../../api";
import { CURRENCIES } from "../../constants";
import {
  Avatar,
  Button,
  CustomSelect,
  Drawer,
  Label,
  MatchScore,
  TextArea,
  TextInput,
  errorMessage,
  formatDate,
  fromLocalInput,
} from "../../ui";
import type { Offer } from "../../types";

const STATUS_TEXT: Record<Offer["status"], string> = {
  sent: "Waiting for the candidate",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

export default function OfferDrawer({
  open,
  applicationId,
  candidate,
  jobTitle,
  defaultCurrency,
  offers,
  onClose,
  onDone,
}: {
  open: boolean;
  applicationId: string;
  candidate: { name: string; avatar?: string; title?: string; matchScore: number };
  jobTitle: string;
  defaultCurrency?: string;
  offers: Offer[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { startUpload, isUploading } = useUploadThing("postDocuments");
  const [role, setRole] = React.useState(jobTitle);
  const [ctc, setCtc] = React.useState("");
  const [currency, setCurrency] = React.useState(defaultCurrency || "USD");
  const [joining, setJoining] = React.useState("");
  const [expires, setExpires] = React.useState("");
  const [letter, setLetter] = React.useState<{ url: string; name: string; size?: number } | null>(null);
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setRole(jobTitle);
    setCtc("");
    setCurrency(defaultCurrency || "USD");
    setJoining("");
    const exp = new Date(Date.now() + 7 * 86400000);
    setExpires(exp.toISOString().slice(0, 10));
    setLetter(null);
    setMessage(`Hi ${candidate.name.split(" ")[0]}, we're delighted to offer you the ${jobTitle} role.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pending = offers.find((o) => o.status === "sent");

  const send = async () => {
    const amount = Number(ctc);
    if (!role.trim()) return toast.error("Add the role.");
    if (!(amount > 0)) return toast.error("Enter the annual CTC.");
    if (expires && new Date(expires) <= new Date()) return toast.error("The expiry date must be in the future.");
    setBusy(true);
    try {
      await jobsApi.createOffer(applicationId, {
        role: role.trim(),
        ctc: amount,
        currency,
        joiningDate: joining ? fromLocalInput(`${joining}T09:00`) : undefined,
        expiresAt: expires ? fromLocalInput(`${expires}T23:59`) : undefined,
        letter: letter || undefined,
        message: message.trim() || undefined,
      });
      toast.success(`Offer sent to ${candidate.name}`);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't send the offer."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      title="Create offer"
      subtitle={jobTitle}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={isUploading} onClick={send}>
            Send offer
          </Button>
        </>
      }
    >
      <div className="space-y-5 px-6 py-5">
        <div className="flex items-center gap-3 rounded-xl border border-[#262626] bg-[#141414] px-4 py-3">
          <Avatar name={candidate.name} src={candidate.avatar} size={36} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">{candidate.name}</div>
            {candidate.title && <div className="truncate text-xs text-[#7c7d94]">{candidate.title}</div>}
          </div>
          <MatchScore score={candidate.matchScore} />
        </div>

        {pending && (
          <p className="rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/5 px-3 py-2 text-xs text-[#fbbf24]">
            Sending a new offer withdraws the one sent {formatDate(pending.createdAt)}.
          </p>
        )}

        <TextInput label="Role" value={role} maxLength={160} onChange={(e) => setRole(e.target.value)} />
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <TextInput label="Annual CTC" type="number" min={0} value={ctc} onChange={(e) => setCtc(e.target.value)} />
          <CustomSelect label="Currency" value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Joining</Label>
            <input
              type="date"
              value={joining}
              onChange={(e) => setJoining(e.target.value)}
              className="w-full rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-sm text-white outline-none [color-scheme:dark] focus:border-brand"
            />
          </div>
          <div>
            <Label>Offer expires</Label>
            <input
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              className="w-full rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-sm text-white outline-none [color-scheme:dark] focus:border-brand"
            />
          </div>
        </div>

        <div>
          <Label>Offer letter</Label>
          {letter ? (
            <div className="flex items-center gap-3 rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3">
              <FileText className="h-4 w-4 text-[#7c7d94]" />
              <a href={letter.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm text-white hover:underline">
                {letter.name}
              </a>
              {letter.size ? <span className="text-xs text-[#61627a]">{Math.round(letter.size / 1024)} KB</span> : null}
              <button type="button" onClick={() => setLetter(null)} className="text-[#7c7d94] hover:text-white" aria-label="Remove letter">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#3A3A3A] bg-[#141414] px-4 py-5 text-sm text-[#c7c7da] hover:border-[#4a4a5c]"
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-[#7c7d94]" />}
              {isUploading ? "Uploading…" : "Upload PDF (optional)"}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            hidden
            accept=".pdf"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > 10 * 1024 * 1024) return toast.error("Keep the letter under 10 MB.");
              try {
                const [res] = await startUpload([file]);
                if (res) setLetter({ url: res.url, name: file.name, size: file.size });
              } catch (err) {
                toast.error(errorMessage(err, "Upload failed."));
              }
            }}
          />
        </div>

        <TextArea label="Message" rows={4} value={message} maxLength={4000} onChange={(e) => setMessage(e.target.value)} />
        <p className="text-xs text-[#7c7d94]">{candidate.name.split(" ")[0]} will accept or decline inside Garage and gets an email.</p>

        {offers.length > 0 && (
          <div>
            <Label>Offers sent</Label>
            <div className="space-y-2">
              {offers.map((o) => (
                <div key={o._id} className="flex items-center gap-3 rounded-xl border border-[#262626] bg-[#141414] px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="text-white">
                      {o.currency} {o.ctc.toLocaleString()} · {o.role}
                    </div>
                    <div className="text-xs text-[#7c7d94]">
                      Sent {formatDate(o.createdAt)} · {STATUS_TEXT[o.status]}
                      {o.declineReason ? ` · "${o.declineReason}"` : ""}
                    </div>
                  </div>
                  {o.status === "sent" && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await jobsApi.withdrawOffer(o._id);
                          toast.success("Offer withdrawn");
                          onDone();
                        } catch (err) {
                          toast.error(errorMessage(err, "Couldn't withdraw the offer."));
                        }
                      }}
                      className="text-xs text-[#f87171] hover:underline"
                    >
                      Withdraw
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

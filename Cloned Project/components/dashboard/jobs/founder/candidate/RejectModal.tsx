"use client";

// Reject a candidate: reason (from Settings → Rejection reasons), an internal
// note, and whether the candidate gets the rejection email (sent after the
// job's delay).

import React from "react";
import { toast } from "sonner";
import * as jobsApi from "../../api";
import { Button, CustomSelect, Modal, TextArea, Toggle, errorMessage, useLoad } from "../../ui";

export default function RejectModal({
  open,
  applicationId,
  candidateName,
  delayHours,
  onClose,
  onDone,
}: {
  open: boolean;
  applicationId: string;
  candidateName: string;
  delayHours?: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const settings = useLoad(() => (open ? jobsApi.getSettings() : Promise.resolve(null)), [open]);
  const [reason, setReason] = React.useState("");
  const [note, setNote] = React.useState("");
  const [sendEmail, setSendEmail] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setReason("");
      setNote("");
      setSendEmail(true);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reject ${candidateName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await jobsApi.rejectApplication(applicationId, { reason: reason || undefined, note: note || undefined, sendEmail });
                toast.success(`${candidateName} rejected`);
                onDone();
              } catch (err) {
                toast.error(errorMessage(err, "Couldn't reject the candidate."));
              } finally {
                setBusy(false);
              }
            }}
          >
            Reject
          </Button>
        </>
      }
    >
      <CustomSelect
        label="Reason"
        value={reason}
        onChange={setReason}
        placeholder="Pick a reason (optional)"
        options={(settings.data?.settings.rejectionReasons || []).map((r) => ({ value: r.label, label: r.label }))}
      />
      <TextArea label="Internal note" rows={3} value={note} maxLength={4000} onChange={(e) => setNote(e.target.value)} placeholder="Only your team sees this." />
      <Toggle
        checked={sendEmail}
        onChange={setSendEmail}
        label="Send the rejection email"
        description={
          delayHours ? `Sent ${delayHours} hours after this decision, so you can undo it first.` : "Sent right away."
        }
      />
      <p className="text-xs text-[#7c7d94]">The candidate never sees your reason or notes.</p>
    </Modal>
  );
}

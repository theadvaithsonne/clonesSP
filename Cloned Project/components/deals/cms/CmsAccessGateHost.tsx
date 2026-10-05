"use client";

import { useEffect, useState } from "react";
import { CmsPasswordDialog } from "@/components/deals/cms/CmsPasswordDialog";
import {
  registerCmsAccessDialog,
  unregisterCmsAccessDialog,
  unlockCmsAccess,
  verifyCmsPassword,
} from "@/lib/cms/accessGate";

export default function CmsAccessGateHost() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    registerCmsAccessDialog((onGranted) => {
      setError("");
      setPendingAction(() => onGranted);
      setOpen(true);
    });
    return () => unregisterCmsAccessDialog();
  }, []);

  const handleClose = () => {
    setOpen(false);
    setPendingAction(null);
    setError("");
  };

  const handleSubmit = (password: string) => {
    if (!verifyCmsPassword(password)) {
      setError("Incorrect password. Please try again.");
      return;
    }
    unlockCmsAccess();
    setOpen(false);
    setError("");
    pendingAction?.();
    setPendingAction(null);
  };

  return (
    <CmsPasswordDialog
      open={open}
      error={error}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else setOpen(true);
      }}
      onSubmit={handleSubmit}
    />
  );
}

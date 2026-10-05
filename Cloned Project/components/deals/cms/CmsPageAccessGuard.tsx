"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CmsPasswordDialog } from "@/components/deals/cms/CmsPasswordDialog";
import {
  isCmsAccessUnlocked,
  unlockCmsAccess,
  verifyCmsPassword,
} from "@/lib/cms/accessGate";

type CmsPageAccessGuardProps = {
  children: React.ReactNode;
};

export default function CmsPageAccessGuard({ children }: CmsPageAccessGuardProps) {
  const router = useRouter();
  const [granted, setGranted] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isCmsAccessUnlocked()) {
      setGranted(true);
      return;
    }
    setOpen(true);
  }, []);

  const handleClose = () => {
    setOpen(false);
    router.replace("/deals");
  };

  const handleSubmit = (password: string) => {
    if (!verifyCmsPassword(password)) {
      setError("Incorrect password. Please try again.");
      return;
    }
    unlockCmsAccess();
    setError("");
    setOpen(false);
    setGranted(true);
  };

  if (granted) return <>{children}</>;

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

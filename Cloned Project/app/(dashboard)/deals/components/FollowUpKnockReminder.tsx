"use client";

import { useFollowUpReminders } from "@/hooks/useFollowUpReminders";
import { FollowUpKnockCard } from "@/components/crm/FollowUpKnockCard";

export function FollowUpKnockReminder() {
  const { knock, dismissKnock } = useFollowUpReminders();
  return <FollowUpKnockCard knock={knock} onDismiss={dismissKnock} />;
}

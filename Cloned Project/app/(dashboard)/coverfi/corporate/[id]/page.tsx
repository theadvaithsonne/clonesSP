"use client";

import { use } from "react";
import CorporateWizard from "@/components/coverfi/corporate/CorporateWizard";

export default function CorporateIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <CorporateWizard corporateId={id} />;
}

"use client";

import { use } from "react";
import TemplateEditor from "@/components/coverfi/communication/TemplateEditor";

export default function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <TemplateEditor id={id} />;
}

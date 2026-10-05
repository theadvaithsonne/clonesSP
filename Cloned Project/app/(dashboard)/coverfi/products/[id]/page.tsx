"use client";

import { use } from "react";
import ProductWizard from "@/components/coverfi/products/ProductWizard";

export default function ProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ProductWizard productId={id} />;
}

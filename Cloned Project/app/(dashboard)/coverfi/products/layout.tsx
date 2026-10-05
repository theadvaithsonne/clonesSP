import { ShieldCheck } from "lucide-react";
import PageHeader from "@/components/coverfi/PageHeader";
import ProductsTabs from "@/components/coverfi/products/ProductsTabs";

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        eyebrow="Coverfi · Catalog"
        title="Products"
        description="Define products, the categories that group them, and the filters that describe them."
        icon={<ShieldCheck className="h-4 w-4" />}
        noDivider
      />
      <ProductsTabs />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}

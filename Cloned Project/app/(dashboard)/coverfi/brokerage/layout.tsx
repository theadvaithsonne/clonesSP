import { Building2 } from "lucide-react";
import PageHeader from "@/components/coverfi/PageHeader";
import BrokerageTabs from "@/components/coverfi/brokerage/BrokerageTabs";

export default function BrokerageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        eyebrow="Coverfi · Brokerage"
        title="My Brokerage"
        description="Profile, branding, locations, stakeholders, and the public landing page."
        icon={<Building2 className="h-4 w-4" />}
        noDivider
      />
      <BrokerageTabs />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}

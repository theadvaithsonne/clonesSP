import { Mail } from "lucide-react";
import PageHeader from "@/components/coverfi/PageHeader";
import CommunicationTabs from "@/components/coverfi/communication/CommunicationTabs";

export default function CommunicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        eyebrow="Coverfi · Outbound"
        title="Communication"
        description="Email senders and rich-HTML templates triggered by Coverfi events."
        icon={<Mail className="h-4 w-4" />}
        noDivider
      />
      <CommunicationTabs />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}

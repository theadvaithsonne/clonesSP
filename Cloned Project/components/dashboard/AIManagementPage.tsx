"use client";

import OpenClawAgentPage from "./OpenClawAgentPage";
import OpenClawJobsPage from "./OpenClawJobsPage";
import OpenClawTasksPage from "./OpenClawTasksPage";
import OpenClawContextsPage from "./OpenClawContextsPage";
import OpenClawIntegrationsPage from "./OpenClawIntegrationsPage";
import OpenClawMarketplacePage from "./OpenClawMarketplacePage";
import BillingPage from "@/components/dashboard/OpenClawBillingPage";

type AITab =
  | "my-ai-agent"
  | "ai-jobs"
  | "ai-tasks"
  | "ai-contexts"
  | "ai-integrations"
  | "ai-marketplace"
  | "billing";

interface AIManagementPageProps {
  defaultTab?: AITab;
  onClose?: () => void;
}

export default function AIManagementPage({
  defaultTab = "my-ai-agent",
}: AIManagementPageProps) {
  const renderContent = () => {
    switch (defaultTab) {
      case "my-ai-agent":     return <OpenClawAgentPage />;
      case "ai-jobs":         return <OpenClawJobsPage />;
      case "ai-tasks":        return <OpenClawTasksPage />;
      case "ai-contexts":     return <OpenClawContextsPage />;
      case "ai-integrations": return <OpenClawIntegrationsPage />;
      case "ai-marketplace":  return <OpenClawMarketplacePage />;
      case "billing":         return <BillingPage />;
      default:                return null;
    }
  };

  return (
    <div className="flex-1 h-full overflow-auto p-6">
      {renderContent()}
    </div>
  );
}
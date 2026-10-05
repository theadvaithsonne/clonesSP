"use client";

import {
  FollowUpEmailIcon,
  FollowUpLeadPinIcon,
  FollowUpMoreIcon,
  FollowUpWhatsAppIcon,
} from "@/components/deals/DashboardFollowUpActionIcons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type DashboardFollowUpActivity = {
  _id?: string;
  title?: string;
  companyName?: string;
  entityName?: string;
  contactName?: string;
  leadName?: string;
  type?: string;
  stage?: string;
  leadDetails?: {
    stage?: string;
    leadName?: string;
    name?: string;
    companyName?: string;
  };
  [key: string]: unknown;
};

export function toDisplayText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const nested =
      record.name ??
      record.leadName ??
      record.fullName ??
      record.label ??
      record.value;
    if (nested != null && nested !== value) {
      return toDisplayText(nested);
    }
  }
  return "";
}

function resolveTaskName(activity: DashboardFollowUpActivity, leadName: string) {
  const title = toDisplayText(activity.title);
  if (title && title !== leadName) return title;

  const activityType = toDisplayText(activity.type).toLowerCase();
  if (activityType === "call" || activityType === "phone") return "Call";
  if (activityType.includes("demo") || activityType.includes("presentation"))
    return "Demo";
  if (activityType.includes("follow")) return "Follow-up";
  if (activityType.includes("message") || activityType.includes("email"))
    return "Email follow-up";

  return "Follow-up";
}

function resolveLeadName(activity: DashboardFollowUpActivity, fallbackLeadName?: unknown) {
  const candidates = [
    activity.leadDetails?.leadName,
    activity.leadName,
    activity.leadDetails?.name,
    activity.leadDetails?.companyName,
    activity.companyName,
    activity.entityName,
    activity.contactName,
    fallbackLeadName,
  ];

  for (const candidate of candidates) {
    const text = toDisplayText(candidate);
    if (text) return text;
  }

  return "Unknown";
}

function resolveStageLabel(activity: DashboardFollowUpActivity) {
  const raw = activity.stage ?? activity.leadDetails?.stage;
  const stageText = toDisplayText(raw);
  if (stageText) return stageText;

  const activityType = toDisplayText(activity.type).toLowerCase();
  if (activityType === "call" || activityType === "phone") return "Call";
  if (activityType.includes("demo") || activityType.includes("presentation"))
    return "Demo";
  if (activityType.includes("follow")) return "Follow-up";
  if (activityType.includes("message") || activityType.includes("email"))
    return "Email";
  return activityType ? activityType : "Task";
}

type DashboardFollowUpCardProps = {
  activity: DashboardFollowUpActivity;
  leadName?: string;
  leadId?: string;
  leadPhone?: string;
  leadEmail?: string;
  onClick?: () => void;
  onWhatsApp?: () => void;
  onEmail?: () => void;
  onEditLead?: () => void;
  onEditFollowUp?: () => void;
  onStopFollowUp?: () => void;
  onStartAutoFollowUp?: () => void;
  showDate?: boolean;
};

export default function DashboardFollowUpCard({
  activity,
  leadName,
  leadId,
  leadPhone,
  leadEmail,
  onClick,
  onWhatsApp,
  onEmail,
  onEditLead,
  onEditFollowUp,
  onStopFollowUp,
  onStartAutoFollowUp,
  showDate,
}: DashboardFollowUpCardProps) {
  const displayLeadName = resolveLeadName(activity, leadName);
  const taskName = resolveTaskName(activity, displayLeadName);
  const stageLabel = resolveStageLabel(activity);
  const isAutoFollowUp = activity.isAutoFollowUp === true;

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const rawDate = activity.dueDate || activity.scheduledDate || activity.createdAt;
  const formattedDate = (showDate && rawDate)
    ? new Date(rawDate as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : "";

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className="bg-[#1e1e1e] border border-[#2e2e2e] border-solid rounded-[12px] p-[10px] drop-shadow-[0px_2px_1px_#000000] cursor-pointer hover:opacity-90 transition-opacity w-full"
    >
      <div className="flex flex-col gap-[16px] w-full">
        {/* Row 1 — task title + action icons */}
        <div className="flex items-center gap-[8px] w-full">
          <p className="flex-1 min-w-0 text-[12px] font-medium leading-[1.4] text-white [word-break:break-word]">
            {taskName}
          </p>
          <div
            className="flex items-center gap-[15px] shrink-0"
            onClick={stopPropagation}
          >
            <button
              type="button"
              className="relative shrink-0 size-[20px] p-0 border-0 bg-transparent cursor-pointer hover:opacity-80 transition-opacity disabled:cursor-not-allowed"
              aria-label="WhatsApp"
              onClick={onWhatsApp}
              disabled={!leadPhone}
              title={leadPhone ? "Send WhatsApp" : "No phone number"}
            >
              <FollowUpWhatsAppIcon className="block size-full" />
            </button>
            <button
              type="button"
              className="relative shrink-0 size-[20px] p-0 border-0 bg-transparent cursor-pointer hover:opacity-80 transition-opacity disabled:cursor-not-allowed"
              aria-label="Email"
              onClick={onEmail}
              disabled={!leadEmail}
              title={leadEmail ? "Send email" : "No email address"}
            >
              <FollowUpEmailIcon className="block size-full" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="relative shrink-0 size-[20px] p-0 border-0 bg-transparent cursor-pointer hover:opacity-80 transition-opacity"
                  aria-label="More options"
                >
                  <FollowUpMoreIcon className="block size-full" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-[#1e1e1e] border border-[#2e2e2e] text-white rounded-[10px] min-w-[150px]"
              >
                {isAutoFollowUp ? (
                  <DropdownMenuItem
                    className="cursor-pointer text-[12px] text-red-500 focus:bg-[#2e2e2e] focus:text-red-500"
                    onSelect={(e) => {
                      e.preventDefault();
                      onStopFollowUp?.();
                    }}
                  >
                    Stop Followup
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="cursor-pointer text-[12px] text-green-500 focus:bg-[#2e2e2e] focus:text-green-500"
                    onSelect={(e) => {
                      e.preventDefault();
                      onStartAutoFollowUp?.();
                    }}
                  >
                    Start Auto Follow Up
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="cursor-pointer text-[12px] focus:bg-[#2e2e2e] focus:text-white"
                  onSelect={(e) => {
                    e.preventDefault();
                    onEditFollowUp?.();
                  }}
                >
                  Edit Follow up
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer text-[12px] focus:bg-[#2e2e2e] focus:text-white"
                  onSelect={(e) => {
                    e.preventDefault();
                    onEditLead?.();
                  }}
                >
                  Edit Lead
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Row 2 — lead info + stage badge */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-[5px] min-w-0 flex-1">
            <span className="relative shrink-0 size-[12px]">
              <FollowUpLeadPinIcon className="block size-full" />
            </span>
            <span className="text-[12px] font-normal leading-[1.4] text-[#6b7280] truncate">
              {displayLeadName}
            </span>
            {formattedDate && (
              <span className="text-[12px] font-normal leading-[1.4] text-[#9ca3af] shrink-0">
                ({formattedDate})
              </span>
            )}
          </div>
          <span className="inline-flex items-center justify-center bg-[#eff6ff] px-[8px] py-[4px] rounded-[12px] shrink-0 text-[12px] font-medium leading-none text-[#2563eb] whitespace-nowrap">
            {stageLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

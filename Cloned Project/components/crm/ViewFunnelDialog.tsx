"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { isDealsInlineMode } from "@/lib/deals-events";
import { useTheme } from "next-themes";

type DealsTheme = "dark" | "color" | "light";

function useDealsTheme(): DealsTheme {
  const { theme, resolvedTheme: nextResolvedTheme } = useTheme();
  if (theme === "color") return "color";
  if (theme === "dark" || isDealsInlineMode() || nextResolvedTheme === "dark") return "dark";
  return "light";
}

function dialogShellClass(t: DealsTheme) {
  if (t === "color") return "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)] text-white";
  if (t === "dark") return "bg-[#0f0f0f] border-[#2a2d3a] text-white";
  return "bg-white border-[#e5e7eb] text-[#1f1f1f]";
}

function cardClass(t: DealsTheme) {
  if (t === "dark") return "bg-[#181818] border-[#2a2d3a]";
  if (t === "color") return "bg-[rgba(20,20,40,0.6)] border-[rgba(0,255,255,0.2)]";
  return "bg-white border-[#e5e7eb]";
}

function headingClass(t: DealsTheme) {
  if (t === "dark") return "text-white";
  if (t === "color") return "text-white";
  return "text-[#1f1f1f]";
}

function mutedClass(t: DealsTheme) {
  if (t === "dark") return "text-[#9ca3af]";
  if (t === "color") return "text-[rgba(0,255,255,0.6)]";
  return "text-[#6b7280]";
}

function fieldClass(t: DealsTheme) {
  if (t === "dark") return "bg-[#121215] border-[#2a2d3a] text-[#e5e7eb]";
  if (t === "color") return "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]";
  return "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]";
}

function dividerClass(t: DealsTheme) {
  if (t === "dark") return "border-[#2a2d3a]";
  if (t === "color") return "border-[rgba(0,255,255,0.2)]";
  return "border-[#e5e7eb]";
}

function stageBadgeBgClass(t: DealsTheme) {
  if (t === "dark") return "bg-[rgba(255,194,0,0.12)]";
  if (t === "color") return "bg-[rgba(1,255,255,0.1)]";
  return "bg-[rgba(123,104,238,0.1)]";
}

function stageBadgeTextClass(t: DealsTheme) {
  if (t === "dark") return "text-brand";
  if (t === "color") return "text-[#0ff]";
  return "text-[#7b68ee]";
}

function getStages(funnel: any): any[] {
  const stages = funnel?.funnelStage || funnel?.stages || funnel?.products || [];
  return Array.isArray(stages) ? stages : [];
}

type ViewFunnelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewingFunnel: any | null;
  isLoading: boolean;
};

export default function ViewFunnelDialog({
  open,
  onOpenChange,
  viewingFunnel,
  isLoading,
}: ViewFunnelDialogProps) {
  const resolvedTheme = useDealsTheme();
  const stageList = viewingFunnel ? getStages(viewingFunnel) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-[calc(100vw-2rem)] sm:max-w-[800px] max-h-[90vh] overflow-y-auto ${dialogShellClass(resolvedTheme)}`}
      >
        <DialogHeader>
          <DialogTitle>Funnel Details</DialogTitle>
          <DialogDescription className={mutedClass(resolvedTheme)}>
            View funnel information and stages
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${
              resolvedTheme === "dark" ? "border-brand" : "border-[#8b7aff]"
            }`} />
          </div>
        ) : viewingFunnel ? (
          <div className="space-y-4 md:space-y-6 py-2 md:py-4">
            <div className={`border border-[0.667px] rounded-[12px] p-4 md:p-6 flex flex-col gap-4 md:gap-6 ${cardClass(resolvedTheme)}`}>
              <h4 className={`text-[14px] font-bold leading-[20px] ${headingClass(resolvedTheme)}`}>
                Funnel Settings
              </h4>
              <div className="flex flex-col gap-2 min-w-0">
                <Label className={`text-[12px] font-bold leading-[16px] ${headingClass(resolvedTheme)}`}>
                  Funnel Name
                </Label>
                <div className={`border border-[0.667px] rounded-[6px] min-h-8 px-3 py-1 text-[14px] flex items-center break-words ${fieldClass(resolvedTheme)}`}>
                  {viewingFunnel.funnelName || viewingFunnel.name || "-"}
                </div>
              </div>
              {viewingFunnel.funnelDesc && (
                <div className="flex flex-col gap-2 min-w-0">
                  <Label className={`text-[12px] font-bold leading-[16px] ${headingClass(resolvedTheme)}`}>
                    Description
                  </Label>
                  <div className={`border border-[0.667px] rounded-[6px] min-h-[80px] px-3 py-2 text-[14px] break-words ${fieldClass(resolvedTheme)}`}>
                    {viewingFunnel.funnelDesc}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2 min-w-0">
                <Label className={`text-[12px] font-bold leading-[16px] ${headingClass(resolvedTheme)}`}>
                  Status
                </Label>
                <div className={`border border-[0.667px] rounded-[6px] min-h-8 px-3 py-1 text-[14px] flex items-center ${fieldClass(resolvedTheme)}`}>
                  {(viewingFunnel.status || "active").charAt(0).toUpperCase() +
                    (viewingFunnel.status || "active").slice(1)}
                </div>
              </div>
            </div>

            <div className={`border border-[0.667px] rounded-[12px] min-w-0 ${cardClass(resolvedTheme)}`}>
              <div className={`flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-b-[0.667px] ${dividerClass(resolvedTheme)}`}>
                <h4 className={`text-[14px] font-normal leading-[20px] ${headingClass(resolvedTheme)}`}>
                  Sales Stages ({stageList.length})
                </h4>
              </div>

              <div className="flex flex-col gap-3 px-4 md:px-6 pt-4 md:pt-6 pb-8 md:pb-12">
                {stageList.length === 0 ? (
                  <div className={`text-center py-8 text-[14px] ${mutedClass(resolvedTheme)}`}>
                    No stages defined
                  </div>
                ) : (
                  stageList.map((stage: any, index: number) => {
                    const stageName =
                      typeof stage === "string"
                        ? stage
                        : stage?.name || stage?.stageName || "Unknown Stage";
                    const probability =
                      typeof stage === "object" && stage?.probability !== undefined
                        ? stage.probability
                        : "";
                    const exitCriteria =
                      typeof stage === "object" && stage?.exitCriteria ? stage.exitCriteria : "";
                    const requiredDocuments =
                      typeof stage === "object" && stage?.requiredDocuments
                        ? stage.requiredDocuments
                        : "";

                    return (
                      <div
                        key={index}
                        className={`border border-[0.667px] rounded-[12px] p-[0.667px] min-w-0 ${cardClass(resolvedTheme)}`}
                      >
                        <div className="flex flex-col gap-3 pt-4 px-3 md:px-4 pb-4">
                          <div className="flex gap-3 items-start min-w-0">
                            <div className="flex flex-col gap-2 items-center w-7 shrink-0 pt-1">
                              <div
                                className={`rounded-full w-7 h-7 flex items-center justify-center ${stageBadgeBgClass(resolvedTheme)}`}
                              >
                                <p className={`text-[12px] font-bold leading-[16px] ${stageBadgeTextClass(resolvedTheme)}`}>
                                  {index + 1}
                                </p>
                              </div>
                            </div>

                            <div className="flex-1 flex flex-col gap-3 min-w-0">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5 min-w-0">
                                  <Label className={`text-[12px] font-bold leading-[16px] ${headingClass(resolvedTheme)}`}>
                                    Stage Name
                                  </Label>
                                  <div className={`border border-[0.667px] rounded-[6px] min-h-8 px-3 py-1 text-[14px] flex items-center break-words ${fieldClass(resolvedTheme)}`}>
                                    {stageName}
                                  </div>
                                </div>
                                {probability !== "" && probability !== undefined && (
                                  <div className="flex flex-col gap-1.5 min-w-0">
                                    <Label className={`text-[12px] font-bold leading-[16px] ${headingClass(resolvedTheme)}`}>
                                      Probability %
                                    </Label>
                                    <div className={`border border-[0.667px] rounded-[6px] min-h-8 px-3 py-1 text-[14px] flex items-center ${fieldClass(resolvedTheme)}`}>
                                      {probability}%
                                    </div>
                                  </div>
                                )}
                              </div>

                              {exitCriteria && (
                                <div className="flex flex-col gap-1.5 min-w-0">
                                  <Label className={`text-[12px] font-bold leading-[16px] ${headingClass(resolvedTheme)}`}>
                                    Exit Criteria
                                  </Label>
                                  <div className={`border border-[0.667px] rounded-[6px] min-h-[64px] px-3 py-2 text-[14px] break-words ${fieldClass(resolvedTheme)}`}>
                                    {exitCriteria}
                                  </div>
                                </div>
                              )}

                              {requiredDocuments && (
                                <div className="flex flex-col gap-1.5 min-w-0">
                                  <Label className={`text-[12px] font-bold leading-[16px] ${headingClass(resolvedTheme)}`}>
                                    Required Documents
                                  </Label>
                                  <div className={`border border-[0.667px] rounded-[6px] min-h-8 px-3 py-1 text-[14px] flex items-center break-words ${fieldClass(resolvedTheme)}`}>
                                    {requiredDocuments}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className={`py-8 text-center text-[14px] ${mutedClass(resolvedTheme)}`}>
            No funnel data available
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={
              resolvedTheme === "dark"
                ? "h-8 px-3 rounded-[6px] text-[13px] font-semibold text-[#e5e7eb] border-[#2a2d3a] bg-[#181818] hover:bg-[#1f1f1f] shadow-none"
                : resolvedTheme === "color"
                  ? "h-8 px-3 rounded-[6px] text-[13px] font-semibold text-white border-[rgba(0,255,255,0.2)] bg-transparent hover:bg-[rgba(0,255,255,0.05)] shadow-none"
                  : "h-8 px-3 rounded-[6px] text-[13px] font-semibold"
            }
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

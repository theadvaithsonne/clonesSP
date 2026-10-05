"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createTemplate,
  formatTemplateListDate,
  getNetworkMailOrgId,
  listTemplates,
  type TemplateCategory as MailTemplateCategory,
} from "@/lib/network-mail-api";
import { CreateTemplateModal } from "../create-template-modal";
import { toast } from "sonner";
import { CampaignStepper } from "./campaign-stepper";
import { CampaignActionBar, ActionButton } from "./campaign-action-bar";
import { CampaignStepHeader } from "./campaign-create-dialog";
import { DiscardDialog } from "./discard-dialog";
import type { CampaignTemplateItem } from "./types";
import { TemplatePickerDropdown } from "./template-picker-dropdown";

function mapTemplate(t: {
  id: string;
  name: string;
  category: string;
  createdAt: string;
  useCount: number;
  thumbnailUrl?: string | null;
}): CampaignTemplateItem {
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    createdDate: formatTemplateListDate(t.createdAt),
    uses: t.useCount,
    thumbnailUrl: t.thumbnailUrl,
  };
}

export function CampaignStep1Template({
  onNext,
  onCancel,
  initialData,
  returnToReview,
  onReturnToReview,
}: {
  onNext: (data: { templateId: string; templateName: string; campaignName: string }) => void;
  onCancel: () => void;
  initialData?: { templateId?: string; campaignName?: string; templateName?: string };
  returnToReview?: boolean;
  onReturnToReview?: () => void;
}) {
  const [selectedId, setSelectedId] = useState(initialData?.templateId ?? "");
  const [selectedName, setSelectedName] = useState(initialData?.templateName ?? "");
  const [campaignName, setCampaignName] = useState(initialData?.campaignName ?? "");
  const [templates, setTemplates] = useState<CampaignTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDiscard, setShowDiscard] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [nextError, setNextError] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const dirty = selectedId !== "" || campaignName.trim() !== "";

  const fetchTemplates = useCallback(async () => {
    const orgId = getNetworkMailOrgId();
    if (!orgId) {
      setTemplates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await listTemplates({
        orgId,
        sort: "newest",
      });
      setTemplates(res.templates.map(mapTemplate));
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const canProceed = Boolean(selectedId && campaignName.trim());

  const selectTemplate = (id: string, name: string) => {
    setSelectedId(id);
    setSelectedName(name);
    setNextError(false);
  };

  const handleNext = () => {
    if (!selectedId) {
      setNextError(true);
      return;
    }
    if (!campaignName.trim()) {
      setNameError(true);
      setNextError(true);
      return;
    }
    onNext({
      templateId: selectedId,
      templateName: selectedName,
      campaignName: campaignName.trim(),
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <CampaignStepper
        currentStep={1}
        returnToReview={returnToReview}
        onReturnToReview={onReturnToReview}
      />

      <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
        <div className="space-y-5">
          <CampaignStepHeader
            step={1}
            title="Template"
            description="Choose a starting point for your email campaign."
          />

          <div>
            <label className="text-sm font-medium text-[#a8a8a8]">
              Campaign name <span className="text-red-400">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              maxLength={150}
              value={campaignName}
              onChange={(e) => {
                setCampaignName(e.target.value);
                setNameError(false);
              }}
              placeholder="e.g. Q2 Product Launch"
              className={`mt-2 w-full h-11 px-3.5 rounded-lg border bg-white/[0.04] text-sm text-white placeholder:text-white/40 outline-none transition-colors ${
                nameError ? "border-red-500/60" : "border-white/10"
              }`}
            />
            <div className="flex items-center justify-between mt-1.5">
              {nameError && (
                <span className="text-xs text-red-400">Campaign name is required</span>
              )}
              <span className="text-xs text-[#7a7a7a] ml-auto">
                {campaignName.length}/150
              </span>
            </div>
          </div>

          <TemplatePickerDropdown
            templates={templates}
            loading={loading}
            selectedId={selectedId}
            selectedName={selectedName}
            onSelect={selectTemplate}
            onCreateNew={() => setShowCreateModal(true)}
          />

          {nextError && !selectedId && (
            <p className="text-xs text-red-400">Select a template to continue</p>
          )}
        </div>
      </div>

      <CampaignActionBar
        left={
          <ActionButton
            variant="secondary"
            onClick={() => (dirty ? setShowDiscard(true) : onCancel())}
          >
            Cancel
          </ActionButton>
        }
        right={
          <ActionButton
            variant="primary"
            disabled={!canProceed}
            onClick={() => {
              if (!canProceed) {
                setNextError(true);
                if (!campaignName.trim()) setNameError(true);
                return;
              }
              handleNext();
            }}
          >
            Next: Recipients
          </ActionButton>
        }
      />

      <DiscardDialog
        open={showDiscard}
        onClose={() => setShowDiscard(false)}
        onConfirm={() => {
          setShowDiscard(false);
          onCancel();
        }}
      />

      {showCreateModal && (
        <CreateTemplateModal
          zIndex={720}
          onClose={() => setShowCreateModal(false)}
          onCreate={async ({ name, category }) => {
            const orgId = getNetworkMailOrgId();
            if (!orgId) {
              toast.error("No organization selected");
              throw new Error("No organization selected");
            }
            const created = await createTemplate(orgId, {
              name,
              category: category as MailTemplateCategory,
            });
            await fetchTemplates();
            selectTemplate(created.id, created.name);
            toast.success("Template created");
          }}
        />
      )}
    </div>
  );
}

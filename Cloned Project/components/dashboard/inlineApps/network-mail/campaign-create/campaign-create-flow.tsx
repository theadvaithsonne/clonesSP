"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  apiCampaignToCampaignData,
  campaignDataToApiPayload,
  createCampaign,
  getCampaign,
  getNetworkMailOrgId,
  getNetworkMailSettings,
  launchCampaign,
  updateCampaign,
} from "@/lib/network-mail-campaigns-api";
import { recordTemplateUse, syncTemplateHtmlBody } from "@/lib/network-mail-api";
import { CampaignCreateDialog } from "./campaign-create-dialog";
import { CampaignStep1Template } from "./step-1-template";
import { CampaignStep2Recipients } from "./step-2-recipients";
import { CampaignStep3Schedule } from "./step-3-schedule";
import { CampaignStep4Review } from "./step-4-review";
import { CampaignSuccessScreen } from "./campaign-success";
import { DiscardDialog } from "./discard-dialog";
import type { CampaignData, RecipientsData, ScheduleData } from "./types";

type FlowView = "wizard" | "success";

const DEFAULT_RECIPIENTS: RecipientsData = {
  source: "leads",
  exclusions: {
    excludeUnsubscribed: true,
    excludeBounced: true,
    excludeSpam: true,
  },
  recipientCount: 0,
  netRecipientCount: 0,
};

export function CampaignCreateFlow({
  onExit,
  onSaved,
  editCampaignId,
}: {
  onExit: () => void;
  onSaved?: () => void;
  /** When set, loads an existing draft and opens the review step to edit or launch. */
  editCampaignId?: string;
}) {
  const [step, setStep] = useState(1);
  const [view, setView] = useState<FlowView>("wizard");
  const [campaignData, setCampaignData] = useState<Partial<CampaignData>>({});
  const [campaignId, setCampaignId] = useState<string | null>(editCampaignId ?? null);
  const [editFromReview, setEditFromReview] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [launchedData, setLaunchedData] = useState<Partial<CampaignData>>({});
  const [isLaunching, setIsLaunching] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!!editCampaignId);
  const saveInFlightRef = useRef(false);

  const returnToReview = editFromReview;

  const persistCampaign = useCallback(
    async (data: Partial<CampaignData>, id?: string | null) => {
      const orgId = getNetworkMailOrgId();
      if (!orgId) throw new Error("Organization not found");

      const body = campaignDataToApiPayload(data);
      if (!body.campaignName && !body.templateId && !body.recipients) {
        return id ?? campaignId;
      }

      if (!body.recipients) {
        body.recipients = {
          ...DEFAULT_RECIPIENTS,
          recipientCount: 0,
          netRecipientCount: 0,
        };
      }
      if (!body.schedule) {
        body.schedule = { type: "now" };
      }

      const existingId = id ?? campaignId;
      if (existingId) {
        const updated = await updateCampaign(orgId, existingId, body);
        return updated.id;
      }

      const created = await createCampaign(orgId, {
        campaignName: body.campaignName ?? "Untitled campaign",
        templateId: body.templateId ?? "",
        recipients: body.recipients,
        schedule: body.schedule,
        subjectLine: body.subjectLine,
        fromName: body.fromName,
        fromEmail: body.fromEmail,
        previewText: body.previewText,
      });
      return created.id;
    },
    [campaignId],
  );

  useEffect(() => {
    if (!editCampaignId) return;

    const orgId = getNetworkMailOrgId();
    if (!orgId) {
      toast.error("Organization not found");
      onExit();
      return;
    }

    let cancelled = false;
    setLoadingExisting(true);
    getCampaign(orgId, editCampaignId)
      .then((campaign) => {
        if (cancelled) return;
        if (campaign.status !== "draft") {
          toast.error("Only draft campaigns can be edited from here");
          onExit();
          return;
        }
        const data = apiCampaignToCampaignData(campaign);
        setCampaignData({ ...data, campaignId: campaign.id });
        setCampaignId(campaign.id);
        setStep(4);
      })
      .catch((error) => {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Failed to load campaign";
        toast.error(message);
        onExit();
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per campaign id
  }, [editCampaignId]);

  useEffect(() => {
    const orgId = getNetworkMailOrgId();
    if (!orgId || settingsLoaded) return;
    getNetworkMailSettings(orgId)
      .then((settings) => {
        setCampaignData((prev) => ({
          ...prev,
          fromName: prev.fromName ?? settings.senderIdentity.defaultFromName,
          fromEmail: prev.fromEmail ?? settings.senderIdentity.defaultFromEmail,
        }));
        setSettingsLoaded(true);
      })
      .catch(() => setSettingsLoaded(true));
  }, [settingsLoaded]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!campaignId || Object.keys(campaignData).length === 0 || saveInFlightRef.current) {
        return;
      }
      saveInFlightRef.current = true;
      persistCampaign(campaignData, campaignId)
        .catch(() => {
          /* silent auto-save failure */
        })
        .finally(() => {
          saveInFlightRef.current = false;
        });
    }, 30000);
    return () => clearInterval(interval);
  }, [campaignData, campaignId, persistCampaign]);

  const handleCancel = () => {
    setCampaignData({});
    setCampaignId(null);
    setStep(1);
    setEditFromReview(false);
    onExit();
  };

  const saveAndAdvance = async (
    patch: Partial<CampaignData>,
    nextStep: number,
  ) => {
    const merged = { ...campaignData, ...patch };
    setCampaignData(merged);
    try {
      const id = await persistCampaign(merged);
      if (id) {
        setCampaignId(id);
        setCampaignData((prev) => ({ ...prev, campaignId: id }));
      }
      setStep(nextStep);
    } catch (error) {
      console.error("Failed to save campaign:", error);
      toast.error("Failed to save campaign. Please try again.");
    }
  };

  const handleStep1Next = async (data: {
    templateId: string;
    templateName: string;
    campaignName: string;
  }) => {
    const patch = { ...data };
    if (returnToReview) {
      await saveAndAdvance(patch, 4);
      setEditFromReview(false);
    } else {
      await saveAndAdvance(patch, 2);
    }
  };

  const handleStep2Next = async (recipients: RecipientsData) => {
    const senderEmail = recipients.senderEmail?.trim();
    const patch: Partial<CampaignData> = {
      recipients,
      ...(senderEmail ? { fromEmail: senderEmail } : {}),
    };
    if (returnToReview) {
      await saveAndAdvance(patch, 4);
      setEditFromReview(false);
    } else {
      await saveAndAdvance(patch, 3);
    }
  };

  const handleStep3Next = async (schedule: ScheduleData) => {
    const patch = { schedule };
    if (returnToReview) {
      await saveAndAdvance(patch, 4);
      setEditFromReview(false);
    } else {
      await saveAndAdvance(patch, 4);
    }
  };

  const handleEditStep = (targetStep: number) => {
    setEditFromReview(true);
    setStep(targetStep);
  };

  const handleReturnToReview = () => {
    setEditFromReview(false);
    setStep(4);
  };

  const handleLaunch = async () => {
    const orgId = getNetworkMailOrgId();
    if (!orgId) {
      toast.error("Organization not found");
      return;
    }

    setIsLaunching(true);
    try {
      let id = campaignId;
      const complete: Partial<CampaignData> = {
        ...campaignData,
        subjectLine: campaignData.subjectLine ?? "Welcome to our platform!",
        fromName: campaignData.fromName ?? "Company Name",
        fromEmail: campaignData.fromEmail ?? "hello@company.com",
        previewText: campaignData.previewText ?? "Get started today...",
      };

      id = (await persistCampaign(complete, id)) ?? id;
      if (!id) {
        throw new Error("Campaign could not be saved");
      }

      if (campaignData.templateId) {
        try {
          await syncTemplateHtmlBody(orgId, campaignData.templateId);
        } catch {
          /* non-blocking — launch still uses stored template html */
        }
      }

      const launchBody = {
        subjectLine: complete.subjectLine,
        fromName: complete.fromName,
        fromEmail: complete.fromEmail,
        previewText: complete.previewText,
      };

      const result = await launchCampaign(orgId, id, launchBody);

      if (campaignData.templateId) {
        try {
          await recordTemplateUse(orgId, campaignData.templateId);
        } catch {
          /* non-blocking */
        }
      }

      const launched: Partial<CampaignData> = {
        ...complete,
        campaignId: id,
        status: result.campaign.status,
        recipients: {
          ...complete.recipients!,
          netRecipientCount: result.campaign.netRecipientCount,
        },
      };

      setLaunchedData(launched);
      setView("success");
      onSaved?.();
    } catch (error) {
      console.error("Failed to launch campaign:", error);
      const message =
        error instanceof Error ? error.message : "Failed to launch campaign. Please try again.";
      toast.error(message);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      await persistCampaign({ ...campaignData, status: "draft" });
      toast.success("Campaign saved as draft");
      onSaved?.();
      handleCancel();
    } catch {
      toast.error("Failed to save draft");
    }
  };

  const handleCampaignDataChange = (patch: Partial<CampaignData>) => {
    setCampaignData((prev) => ({ ...prev, ...patch }));
  };

  if (loadingExisting) {
    return (
      <CampaignCreateDialog onClose={() => setShowDiscard(true)} loading>
        {null}
      </CampaignCreateDialog>
    );
  }

  if (view === "success") {
    return (
      <CampaignCreateDialog onClose={handleCancel}>
        <CampaignSuccessScreen
          campaignData={launchedData}
          onViewDetails={() => {
            handleCancel();
          }}
          onCreateAnother={() => {
            setCampaignData({});
            setCampaignId(null);
            setStep(1);
            setView("wizard");
          }}
          onGoToDashboard={() => {
            toast.success("Campaign launched successfully!");
            handleCancel();
          }}
        />
      </CampaignCreateDialog>
    );
  }

  return (
    <CampaignCreateDialog onClose={() => setShowDiscard(true)}>
      {step === 1 && (
        <CampaignStep1Template
          initialData={{
            templateId: campaignData.templateId,
            campaignName: campaignData.campaignName,
            templateName: campaignData.templateName,
          }}
          onNext={handleStep1Next}
          onCancel={() => setShowDiscard(true)}
          returnToReview={returnToReview}
          onReturnToReview={handleReturnToReview}
        />
      )}
      {step === 2 && (
        <CampaignStep2Recipients
          initialData={
            campaignData.recipients
              ? {
                  ...campaignData.recipients,
                  senderEmail:
                    campaignData.recipients.senderEmail ?? campaignData.fromEmail,
                }
              : undefined
          }
          onNext={handleStep2Next}
          onBack={() => setStep(returnToReview ? 4 : 1)}
          returnToReview={returnToReview}
          onReturnToReview={handleReturnToReview}
        />
      )}
      {step === 3 && (
        <CampaignStep3Schedule
          initialData={campaignData.schedule}
          recipientCount={campaignData.recipients?.recipientCount ?? 0}
          campaignName={campaignData.campaignName}
          campaignId={campaignId}
          onNext={handleStep3Next}
          onBack={() => setStep(returnToReview ? 4 : 2)}
          returnToReview={returnToReview}
          onReturnToReview={handleReturnToReview}
        />
      )}
      {step === 4 && (
        <CampaignStep4Review
          campaignData={campaignData}
          campaignId={campaignId}
          isLaunching={isLaunching}
          onBack={() => setStep(3)}
          onEditStep={handleEditStep}
          onLaunch={handleLaunch}
          onSaveDraft={handleSaveDraft}
          onCampaignDataChange={handleCampaignDataChange}
        />
      )}

      <DiscardDialog
        open={showDiscard}
        onClose={() => setShowDiscard(false)}
        onConfirm={handleCancel}
      />
    </CampaignCreateDialog>
  );
}

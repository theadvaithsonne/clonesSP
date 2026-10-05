"use client";

import { useState, useRef, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ArrowRight, X, Plus, Trash2, Cog, ChevronRight, GripVertical, AlertTriangle, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buildExternalUrl } from "@/lib/api-config";
import { isDealsInlineMode } from "@/lib/deals-events";
import { authenticatedFetch } from "@/utils/api";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function FunnelFlow({
  setIsAdd,
  editingFunnel,
  onCancel,
  asDialog = false,
}: {
  setIsAdd: (value: boolean) => void;
  editingFunnel?: any;
  onCancel?: () => void;
  asDialog?: boolean;
}) {
  const [activeTab, setActiveTab] = useState("information");
  const [funnelName, setFunnelName] = useState("");
  const [funnelDescription, setFunnelDescription] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [stageInput, setStageInput] = useState("");
  const [stages, setStages] = useState<string[]>([]);
  const [showStageSuggestions, setShowStageSuggestions] = useState(false);
  const stageInputRef = useRef<HTMLInputElement>(null);
  const stageSuggestionsRef = useRef<HTMLDivElement>(null);

  // Figma-style stage cards
  type StageCard = {
    id: number;
    name: string;
    probability: number | string;
    exitCriteria: string;
    requiredDocuments: string;
  };
  const [stageCards, setStageCards] = useState<StageCard[]>([
    { id: 1, name: "", probability: "", exitCriteria: "", requiredDocuments: "" },
  ]);

  const [followUpInput, setFollowUpInput] = useState("");
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [showFollowUpSuggestions, setShowFollowUpSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [funnelNameError, setFunnelNameError] = useState("");
  const [stageErrors, setStageErrors] = useState<Record<number, { name?: string; probability?: string }>>({});
  const MAX_FUNNEL_NAME_LENGTH = 100;
  const MAX_STAGE_NAME_LENGTH = 50;
  const followUpInputRef = useRef<HTMLInputElement>(null);
  const followUpSuggestionsRef = useRef<HTMLDivElement>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activeLeadsCount, setActiveLeadsCount] = useState<number>(0);
  const [isRemoveStageDialogOpen, setIsRemoveStageDialogOpen] = useState(false);
  const [stageIndexToRemove, setStageIndexToRemove] = useState<number | null>(null);
  const { theme: nextTheme, resolvedTheme: nextResolvedTheme } = useTheme();
  const theme =
    nextTheme === "color"
      ? "color"
      : nextTheme === "dark" || isDealsInlineMode() || nextResolvedTheme === "dark"
        ? "dark"
        : "light";

  const tabsOrder = ["information", "stages"]; // legacy tabs (not shown in UI now)

  // Prefill form when editing
  useEffect(() => {
    if (editingFunnel) {
      setFunnelName(editingFunnel.funnelName || "");
      setFunnelDescription(editingFunnel.funnelDesc || "");
      if (editingFunnel.status) {
        const normalizedStatus = String(editingFunnel.status).toLowerCase() === "inactive" ? "inactive" : "active";
        setStatus(normalizedStatus);
      }

      // Set active leads count
      const leadsCount = editingFunnel.activeLeads ?? editingFunnel.leadsCount ?? editingFunnel.active_leads ?? 0;
      setActiveLeadsCount(leadsCount);

      // Convert products/stages to figma-style stage cards
      const list = (editingFunnel.products || editingFunnel.funnelStage || []) as any[];
      if (Array.isArray(list) && list.length) {
        const cards: StageCard[] = list.map((item: any, idx: number) => ({
          id: idx + 1,
          name: typeof item === "string" ? item : item?.name || "",
          probability: typeof item === "object" && item?.probability !== undefined ? item.probability : "",
          exitCriteria: typeof item === "object" && item?.exitCriteria ? item.exitCriteria : "",
          requiredDocuments: typeof item === "object" && item?.requiredDocuments ? item.requiredDocuments : "",
        }));
        setStageCards(cards.length ? cards : [{ id: 1, name: "", probability: "", exitCriteria: "", requiredDocuments: "" }]);
      }
    } else {
      setStatus("active");
      setActiveLeadsCount(0);
    }
  }, [editingFunnel]);

  const availableStages = [
    "Discovery",
    "Awareness",
    "Closing",
    "Qualification",
    "Proposal",
    "Negotiation",
    "Follow-up",
    "Onboarding",
    "Retention",
  ];

  const availableFollowUps = [
    "Email Reminder",
    "Call Client",
    "Schedule Meeting",
    "Send Proposal",
    "Follow-up Email",
    "Check-in Call",
  ];

  const filteredStageSuggestions = availableStages.filter(
    (stage) =>
      stage.toLowerCase().includes(stageInput.toLowerCase()) &&
      !stages.includes(stage)
  );

  const filteredFollowUpSuggestions = availableFollowUps.filter(
    (followUp) =>
      followUp.toLowerCase().includes(followUpInput.toLowerCase()) &&
      !followUps.includes(followUp)
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        stageInputRef.current &&
        !stageInputRef.current.contains(event.target as Node) &&
        stageSuggestionsRef.current &&
        !stageSuggestionsRef.current.contains(event.target as Node)
      ) {
        setShowStageSuggestions(false);
      }
      if (
        followUpInputRef.current &&
        !followUpInputRef.current.contains(event.target as Node) &&
        followUpSuggestionsRef.current &&
        !followUpSuggestionsRef.current.contains(event.target as Node)
      ) {
        setShowFollowUpSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSaveAndNext = async () => {
    if (isSaving) return;
    const trimmedFunnelName = funnelName.trim();
    if (!trimmedFunnelName) {
      setFunnelNameError("Funnel name is required");
      toast.error("Funnel name is required");
      return;
    }
    if (trimmedFunnelName.length > MAX_FUNNEL_NAME_LENGTH) {
      setFunnelNameError(`Funnel name must be ${MAX_FUNNEL_NAME_LENGTH} characters or less`);
      toast.error(`Funnel name must be ${MAX_FUNNEL_NAME_LENGTH} characters or less`);
      return;
    }

    const nextStageErrors: Record<number, { name?: string; probability?: string }> = {};
    stageCards.forEach((stage, index) => {
      const rowError: { name?: string; probability?: string } = {};
      if (!stage.name?.trim()) {
        rowError.name = "Stage name is required";
      } else if (stage.name.trim().length > MAX_STAGE_NAME_LENGTH) {
        rowError.name = `Stage name must be ${MAX_STAGE_NAME_LENGTH} characters or less`;
      }
      const probabilityValue = String(stage.probability ?? "").trim();
      if (probabilityValue === "") {
        rowError.probability = "Probability is required";
      } else {
        const parsedProbability = Number(probabilityValue);
        if (!Number.isFinite(parsedProbability) || parsedProbability < 0 || parsedProbability > 100) {
          rowError.probability = "Probability must be between 0 and 100";
        }
      }
      if (rowError.name || rowError.probability) {
        nextStageErrors[index] = rowError;
      }
    });

    const DUPLICATE_STAGE_MSG = "Duplicate stage name — each stage must be unique in this funnel";
    const nameKeyToIndices = new Map<string, number[]>();
    stageCards.forEach((stage, index) => {
      const trimmed = stage.name?.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (!nameKeyToIndices.has(key)) nameKeyToIndices.set(key, []);
      nameKeyToIndices.get(key)!.push(index);
    });
    nameKeyToIndices.forEach((indices) => {
      if (indices.length < 2) return;
      indices.forEach((idx) => {
        const existing = nextStageErrors[idx] || {};
        nextStageErrors[idx] = {
          ...existing,
          name: DUPLICATE_STAGE_MSG,
        };
      });
    });

    if (Object.keys(nextStageErrors).length > 0) {
      setStageErrors(nextStageErrors);
      const hasDuplicateNameError = Object.values(nextStageErrors).some(
        (err) => err.name === DUPLICATE_STAGE_MSG
      );
      const hasRangeError = Object.values(nextStageErrors).some(
        (err) => err.probability === "Probability must be between 0 and 100"
      );
      const hasNameLengthError = Object.values(nextStageErrors).some(
        (err) => err.name === `Stage name must be ${MAX_STAGE_NAME_LENGTH} characters or less`
      );
      toast.error(
        hasDuplicateNameError
          ? "Each stage name must be unique in this funnel"
          : hasNameLengthError
          ? `Stage name must be ${MAX_STAGE_NAME_LENGTH} characters or less`
          : hasRangeError
          ? "Probability must be between 0 and 100"
          : "Please fill Stage Name and Probability for all stages"
      );
      return;
    }

    setIsSaving(true);

    const payloadStages = stageCards.map((s) => ({
      name: s.name,
      probability: s.probability,
      exitCriteria: s.exitCriteria,
      requiredDocuments: s.requiredDocuments,
    }));

    try {
      const funnelData = {
        funnelName: trimmedFunnelName,
        funnelDesc: funnelDescription,
        funnelStage: payloadStages,
        followUp: followUps,
        status: status,
      };

      const url = editingFunnel
        ? buildExternalUrl(`/crm/funnels/${editingFunnel._id}`)
        : buildExternalUrl("/crm/funnels");
      const method = editingFunnel ? "PUT" : "POST";

      const response = await authenticatedFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(funnelData),
      });

      if (!response.ok) {
        throw new Error(editingFunnel ? "Failed to update funnel" : "Failed to save funnel");
      }

      const result = await response.json();
      console.log(editingFunnel ? "Funnel updated successfully:" : "Funnel saved successfully:", result);
      toast.success(editingFunnel ? "Funnel updated successfully!" : "Funnel saved successfully!");
      setIsAdd(false);
    } catch (error) {
      console.error(editingFunnel ? "Error updating funnel:" : "Error saving funnel:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : editingFunnel
            ? "Failed to update funnel"
            : "Failed to save funnel"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const addStageCard = () => {
    setStageCards((prev) => [
      ...prev,
      { id: prev.length + 1, name: "", probability: "", exitCriteria: "", requiredDocuments: "" },
    ]);
  };

  const removeStageCard = (index: number) => {
    setStageCards((prev) => {
      const next = prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, id: i + 1 }));
      return next.length ? next : [{ id: 1, name: "", probability: "", exitCriteria: "", requiredDocuments: "" }];
    });
  };

  const requestRemoveStageCard = (index: number) => {
    setStageIndexToRemove(index);
    setIsRemoveStageDialogOpen(true);
  };

  const confirmRemoveStageCard = () => {
    if (stageIndexToRemove === null) return;
    removeStageCard(stageIndexToRemove);
    setStageIndexToRemove(null);
    setIsRemoveStageDialogOpen(false);
  };

  // Insert a new blank stage at a specific position (after the given index)
  const insertStageAt = (afterIndex: number) => {
    setStageCards((prev) => {
      const newCards = [...prev];
      newCards.splice(afterIndex + 1, 0, {
        id: 0,
        name: "",
        probability: "",
        exitCriteria: "",
        requiredDocuments: "",
      });
      // Re-number all cards
      return newCards.map((s, i) => ({ ...s, id: i + 1 }));
    });
  };

  const addStage = (stageName: string) => {
    console.log("Adding stage:", stageName);
    if (stageName.trim() !== "" && !stages.includes(stageName.trim())) {
      setStages([...stages, stageName.trim()]);
      setStageInput("");
      setShowStageSuggestions(false);
    }
  };

  const handleAddStageFromInput = () => {
    addStage(stageInput);
  };

  const handleRemoveStage = (stageToRemove: string) => {
    setStages(stages.filter((stage) => stage !== stageToRemove));
  };

  const addFollowUp = (followUpName: string) => {
    if (
      followUpName.trim() !== "" &&
      !followUps.includes(followUpName.trim())
    ) {
      setFollowUps([...followUps, followUpName.trim()]);
      setFollowUpInput("");
      setShowFollowUpSuggestions(false);
    }
  };

  const handleAddFollowUpFromInput = () => {
    addFollowUp(followUpInput);
  };

  const handleRemoveFollowUp = (followUpToRemove: string) => {
    setFollowUps(followUps.filter((followUp) => followUp !== followUpToRemove));
  };

  // Define a set of colors for the badges
  const badgeColors = [
    "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
    "bg-green-100 text-green-700 hover:bg-green-100",
    "bg-red-100 text-red-700 hover:bg-red-100",
    "bg-blue-100 text-blue-700 hover:bg-blue-100",
  ];

  const isActiveWithLeads = editingFunnel && status === "active" && activeLeadsCount > 0;
  const isFigma = asDialog || isDealsInlineMode();
  const pageTitle = editingFunnel
    ? "Edit Funnel"
    : isFigma
      ? "Create a Funnel"
      : "Create New Funnel";

  const closeFlow = () => {
    if (editingFunnel && onCancel) onCancel();
    else setIsAdd(false);
  };

  const labelClass = isFigma
    ? "text-[12px] font-medium text-[#9a9a9a]"
    : theme === "dark" || theme === "color"
      ? "text-[12px] font-bold leading-[16px] text-white"
      : "text-[12px] font-bold leading-[16px] text-[#1f1f1f]";

  const inputClass = (hasError?: boolean) =>
    isFigma
      ? `h-9 rounded-[8px] border px-2.5 text-[13px] text-[#efefef] placeholder:text-[#5a5a5a] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 ${
          hasError ? "border-red-500 bg-[#1e1e1e]" : "border-[#3a3a3a] bg-[#1e1e1e]"
        }`
      : `border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] focus:outline-none focus:ring-0 ${
          hasError
            ? "border-red-500 focus:border-red-500"
            : theme === "dark"
              ? "bg-[#121215] border-[#2a2d3a] text-[#e5e7eb] placeholder:text-[#9ca3af]"
              : theme === "color"
                ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.6)] placeholder:text-[rgba(0,255,255,0.6)]"
                : "bg-white border-[#e5e7eb] text-[#6b7280]"
        }`;

  const textareaClass = isFigma
    ? "min-h-[72px] rounded-[8px] border border-[#3a3a3a] bg-[#1e1e1e] px-2.5 py-2.5 text-[13px] text-[#efefef] placeholder:text-[#5a5a5a] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-none"
    : `border border-[0.667px] rounded-[6px] h-16 px-3 py-2 text-[14px] focus:outline-none focus:ring-0 resize-none ${
        theme === "dark"
          ? "bg-[#121215] border-[#2a2d3a] text-[#9ca3af] placeholder:text-[#9ca3af]"
          : theme === "color"
            ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.6)] placeholder:text-[rgba(0,255,255,0.6)]"
            : "bg-white border-[#e5e7eb] text-[#6b7280]"
      }`;

  const cardClass = isFigma
    ? "rounded-[12px] border border-[#2a2d3a] bg-[#141414]"
    : `border border-[0.667px] rounded-[12px] ${
        theme === "dark"
          ? "bg-[#181818] border-[#2a2d3a]"
          : theme === "color"
            ? "bg-[rgba(20,20,40,0.6)] border-[rgba(0,255,255,0.2)]"
            : "bg-white border-[#e5e7eb]"
      }`;

  const formBody = (
    <>
      {isActiveWithLeads && (
        <div className="bg-[rgba(245,158,11,0.05)] border border-[rgba(245,158,11,0.2)] rounded-[8px] min-h-[41px] flex items-start gap-3 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-[#f59e0b]" />
          <p className={`text-[12px] leading-[16px] ${isFigma ? "text-[#9a9a9a]" : "text-[#9ca3af]"}`}>
            This funnel is currently active with {activeLeadsCount}{" "}
            {activeLeadsCount === 1 ? "lead" : "leads"}. Changes will affect existing leads in the
            pipeline.
          </p>
        </div>
      )}

      <div className={`${cardClass} p-4 md:p-5 flex flex-col gap-4 min-w-0`}>
        <h4 className={`text-[14px] font-bold ${isFigma || theme !== "light" ? "text-white" : "text-[#1f1f1f]"}`}>
          Funnel Settings
        </h4>
        <div className="flex flex-col gap-1.5">
          <Label className={labelClass}>
            Funnel Name {isFigma ? <span className="text-[#9a9a9a]">*</span> : "*"}
          </Label>
          <Input
            placeholder="Enterprise Sales Funnel"
            value={funnelName}
            maxLength={MAX_FUNNEL_NAME_LENGTH}
            onChange={(e) => {
              setFunnelName(e.target.value);
              if (funnelNameError) {
                if (e.target.value.trim().length > MAX_FUNNEL_NAME_LENGTH) {
                  setFunnelNameError(`Funnel name must be ${MAX_FUNNEL_NAME_LENGTH} characters or less`);
                } else {
                  setFunnelNameError("");
                }
              }
            }}
            className={inputClass(!!funnelNameError)}
          />
          {funnelNameError && <p className="text-xs text-red-500">{funnelNameError}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className={labelClass}>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as "active" | "inactive")}>
            <SelectTrigger
              className={
                isFigma
                  ? "h-9 w-full rounded-[8px] border border-[#3a3a3a] bg-[#1e1e1e] px-2.5 text-[13px] text-[#efefef] shadow-none focus:ring-0"
                  : undefined
              }
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={isFigma ? "bg-[#1e1e1e] border-[#3a3a3a] text-white" : undefined}>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={`${cardClass} min-w-0`}>
        <div
          className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 md:px-5 py-3 md:py-4 border-b ${
            isFigma || theme === "dark" ? "border-[#2a2d3a]" : "border-[#e5e7eb]"
          }`}
        >
          <h4 className={`text-[14px] font-bold ${isFigma || theme !== "light" ? "text-white" : "text-[#1f1f1f]"}`}>
            Sales Stages ({stageCards.length})
          </h4>
          <Button
            type="button"
            onClick={addStageCard}
            className={
              isFigma
                ? "h-8 w-full sm:w-auto rounded-[8px] px-3 bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_95%,black)] text-brand-foreground text-[12px] font-bold shadow-none"
                : `h-8 w-full sm:w-auto rounded-[6px] px-3 text-[12px] font-bold ${
                    theme === "dark"
                      ? "bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)] text-brand-foreground"
                      : theme === "color"
                        ? "bg-[#0ff] hover:bg-[#0dd] text-[#0a0e27]"
                        : "bg-[#7b68ee] hover:bg-[#6b58d8] text-white"
                  }`
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Stage
          </Button>
        </div>

        <div className="flex flex-col gap-3 px-4 md:px-5 pt-4 pb-6 min-w-0">
          {stageCards.map((stage, index) => (
            <div key={stage.id}>
              <div className={`${cardClass} p-3 md:p-4`}>
                <div className="flex gap-2 md:gap-3 items-start min-w-0">
                  <div className="flex flex-col gap-2 items-center w-7 shrink-0 pt-1">
                    <GripVertical className={`h-4 w-4 ${isFigma ? "text-[#5a5a5a]" : "text-[#9ca3af]"}`} />
                    <div
                      className={`rounded-full w-7 h-7 flex items-center justify-center ${
                        isFigma ? "bg-[rgba(245,197,24,0.12)]" : "bg-[rgba(255,194,0,0.12)]"
                      }`}
                    >
                      <p className={`text-[12px] font-bold ${isFigma ? "text-brand" : "text-brand"}`}>
                        {stage.id}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-3 min-w-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label className={labelClass}>
                          Stage Name {isFigma ? <span className="text-[#9a9a9a]">*</span> : "*"}
                        </Label>
                        <Input
                          placeholder="Prospects"
                          value={stage.name}
                          maxLength={MAX_STAGE_NAME_LENGTH}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStageCards((prev) =>
                              prev.map((s, i) => (i === index ? { ...s, name: val } : s))
                            );
                            setStageErrors((prev) => {
                              const existing = prev[index]?.name;
                              if (!existing && val.trim().length <= MAX_STAGE_NAME_LENGTH) return prev;
                              const next = { ...prev };
                              const row = { ...next[index] };
                              if (val.trim().length > MAX_STAGE_NAME_LENGTH) {
                                row.name = `Stage name must be ${MAX_STAGE_NAME_LENGTH} characters or less`;
                              } else {
                                delete row.name;
                              }
                              if (!row.name && !row.probability) delete next[index];
                              else next[index] = row;
                              return next;
                            });
                          }}
                          className={inputClass(!!stageErrors[index]?.name)}
                        />
                        {stageErrors[index]?.name && (
                          <p className="text-xs text-red-500">{stageErrors[index]?.name}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className={labelClass}>Probability %</Label>
                        <Input
                          placeholder="10"
                          value={String(stage.probability)}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStageCards((prev) =>
                              prev.map((s, i) => (i === index ? { ...s, probability: val } : s))
                            );
                            setStageErrors((prev) => {
                              if (!prev[index]?.probability) return prev;
                              const next = { ...prev };
                              const row = { ...next[index] };
                              delete row.probability;
                              if (!row.name && !row.probability) delete next[index];
                              else next[index] = row;
                              return next;
                            });
                          }}
                          className={inputClass(!!stageErrors[index]?.probability)}
                        />
                        {stageErrors[index]?.probability && (
                          <p className="text-xs text-red-500">{stageErrors[index]?.probability}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className={labelClass}>Exit Criteria</Label>
                      <Textarea
                        placeholder="What needs to happen to move to the next stage?"
                        value={stage.exitCriteria}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStageCards((prev) =>
                            prev.map((s, i) => (i === index ? { ...s, exitCriteria: val } : s))
                          );
                        }}
                        className={textareaClass}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className={labelClass}>Required Documents</Label>
                      <Input
                        placeholder="e.g., Proposal, Contract"
                        value={stage.requiredDocuments}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStageCards((prev) =>
                            prev.map((s, i) => (i === index ? { ...s, requiredDocuments: val } : s))
                          );
                        }}
                        className={inputClass()}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => requestRemoveStageCard(index)}
                    className={`rounded-[6px] w-7 h-7 flex items-center justify-center shrink-0 ${
                      isFigma ? "hover:bg-white/5" : "hover:bg-[rgba(58,58,58,0.5)]"
                    }`}
                  >
                    <Trash2 className={`h-4 w-4 ${isFigma ? "text-[#9a9a9a]" : "text-[#9ca3af]"}`} />
                  </button>
                </div>
              </div>

              {index < stageCards.length - 1 && (
                <div className="flex items-center justify-center py-3 gap-3">
                  <div className={`flex-1 h-px ${isFigma ? "bg-[#2a2d3a]" : "bg-[#3a3a3a]"}`} />
                  <button
                    type="button"
                    onClick={() => insertStageAt(index)}
                    className={`group flex items-center gap-2 px-4 py-2 rounded-full border ${
                      isFigma
                        ? "bg-[rgba(245,197,24,0.08)] border-brand/40 hover:bg-[rgba(245,197,24,0.16)]"
                        : "bg-[rgba(255,194,0,0.08)] border-brand/40"
                    }`}
                  >
                    <Plus className={`h-4 w-4 ${isFigma ? "text-brand" : "text-brand"}`} />
                    <span className={`text-[12px] font-semibold ${isFigma ? "text-brand" : "text-brand"}`}>
                      Insert Stage
                    </span>
                  </button>
                  <div className={`flex-1 h-px ${isFigma ? "bg-[#2a2d3a]" : "bg-[#3a3a3a]"}`} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const previewAndRemoveDialogs = (
    <>
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent
          className={`max-w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[90vh] overflow-y-auto ${
            isFigma || theme === "dark"
              ? "bg-[#0f0f0f] border-[#2a2d3a] text-white"
              : theme === "color"
                ? "bg-[rgba(20,20,40,0.6)] border-[rgba(0,255,255,0.2)] text-white"
                : ""
          }`}
        >
          <DialogHeader>
            <DialogTitle className={isFigma || theme !== "light" ? "text-white" : ""}>
              Funnel Preview
            </DialogTitle>
            <DialogDescription className={isFigma ? "text-[#9a9a9a]" : "text-[#9ca3af]"}>
              Review the funnel details before saving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className={`rounded-lg border p-4 ${isFigma ? "bg-[#141414] border-[#2a2d3a]" : "bg-[#181818] border-[#2a2d3a]"}`}>
              <p className={`text-sm ${isFigma ? "text-[#9a9a9a]" : "text-[#9ca3af]"}`}>Funnel Name</p>
              <p className="text-lg font-semibold text-white">{funnelName || "Untitled Funnel"}</p>
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-white">Stages</h4>
              {stageCards.map((stage, idx) => (
                <div
                  key={stage.id}
                  className={`rounded-lg border p-4 ${isFigma ? "bg-[#141414] border-[#2a2d3a]" : "bg-[#181818] border-[#2a2d3a]"}`}
                >
                  <div className="flex items-center gap-2">
                    <Badge className={isFigma ? "bg-[rgba(245,197,24,0.12)] text-brand" : "bg-[rgba(255,194,0,0.12)] text-brand"}>
                      #{idx + 1}
                    </Badge>
                    <p className="font-medium text-white">
                      {stage.name?.trim() ? stage.name : "Unnamed Stage"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPreviewOpen(false)}
              className={isFigma ? "h-8 border-[#3a3a3a] bg-[#1e1e1e] text-[#efefef] hover:bg-[#252525]" : ""}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setIsPreviewOpen(false);
                handleSaveAndNext();
              }}
              disabled={isSaving}
              className={
                isFigma
                  ? "h-auto rounded-[8px] bg-brand px-5 py-2 text-[14px] font-bold text-brand-foreground shadow-none hover:bg-[color:color-mix(in_srgb,var(--brand)_95%,black)]"
                  : "bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)] text-brand-foreground"
              }
            >
              {isSaving ? "Saving..." : "Save Funnel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isRemoveStageDialogOpen}
        onOpenChange={(open) => {
          setIsRemoveStageDialogOpen(open);
          if (!open) setStageIndexToRemove(null);
        }}
      >
        <AlertDialogContent
          overlayClassName="bg-transparent"
          className={
            isFigma || theme === "dark"
              ? "bg-[#232323] border-[#2e2e2e] text-white"
              : theme === "color"
                ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)] text-white"
                : ""
          }
        >
          <AlertDialogHeader>
            <AlertDialogTitle className={isFigma || theme !== "light" ? "text-white" : ""}>
              Remove stage?
            </AlertDialogTitle>
            <AlertDialogDescription className={isFigma || theme === "dark" ? "text-[#a1a1aa]" : ""}>
              This stage will be removed from the funnel. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className={
                isFigma || theme === "dark"
                  ? "border-[#2a2d3a] bg-[#181818] text-white hover:bg-[#1f1f1f]"
                  : ""
              }
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveStageCard}
              className="bg-[#ff3b30] hover:bg-[#e6352b] text-white"
            >
              Remove Stage
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (isFigma) {
    return (
      <>
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) closeFlow();
          }}
        >
          <DialogContent
            showCloseButton={false}
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            className="!max-w-[720px] w-[min(720px,calc(100vw-2rem))] flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-[20px] border-0 bg-[#0f0f0f] p-0 shadow-[2px_2px_2px_black] top-[50%] translate-y-[-50%]"
          >
            <div className="flex items-center justify-between border-b border-[#1f1f1f] px-5 py-5">
              <h2 className="text-[15px] font-bold text-white">{pageTitle}</h2>
              <button
                type="button"
                onClick={closeFlow}
                className="text-[#9a9a9a] hover:text-white"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-5">
              {formBody}
            </div>

            <div className="flex items-center justify-between border-t border-[#1f1f1f] bg-[#141414] px-6 py-[15px]">
              <button
                type="button"
                onClick={closeFlow}
                disabled={isSaving}
                className="text-[14px] font-semibold text-[#888] hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPreviewOpen(true)}
                  disabled={isSaving}
                  className="h-auto rounded-[8px] border border-[#3a3a3a] bg-[#1e1e1e] px-4 py-3 text-[13px] font-semibold text-[#efefef] shadow-none hover:bg-[#252525]"
                >
                  <Eye className="h-4 w-4 mr-1.5" />
                  Preview
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveAndNext}
                  disabled={isSaving}
                  className="h-auto rounded-[8px] bg-brand px-5 py-3 text-[14px] font-bold text-brand-foreground shadow-none hover:bg-[color:color-mix(in_srgb,var(--brand)_95%,black)]"
                >
                  {isSaving
                    ? editingFunnel
                      ? "Saving..."
                      : "Creating..."
                    : editingFunnel
                      ? "Save Changes"
                      : "Create Funnel"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {previewAndRemoveDialogs}
      </>
    );
  }

  return (
    <>
      <div
        className={`flex flex-col min-h-full min-w-0 overflow-x-hidden ${
          theme === "color" ? "bg-[#0A0E27]" : theme === "dark" ? "bg-[#0e0e0e]" : ""
        }`}
      >
        <div
          className={`border-b pt-4 px-4 md:px-6 pb-4 ${
            theme === "dark"
              ? "border-[#2a2d3a] bg-[#121215]"
              : theme === "color"
                ? "border-[rgba(0,255,255,0.2)]"
                : "border-[#e5e7eb]"
          }`}
        >
          <div className="flex flex-col gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <Button onClick={closeFlow} variant="ghost" className="h-8 shrink-0 px-2.5 rounded-[6px]">
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                <span className="text-[12px] font-bold">Back</span>
              </Button>
              <div className="flex flex-col min-w-0 flex-1">
                <h2 className="text-[14px] font-bold truncate">{pageTitle}</h2>
                <p className="hidden md:block text-[12px] text-[#6b7280]">
                  Design your sales process with custom stages
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto sm:self-end shrink-0">
              <Button
                variant="outline"
                onClick={() => setIsPreviewOpen(true)}
                disabled={isSaving}
                className="h-8 rounded-[6px] px-2.5 text-[12px] font-bold"
              >
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </Button>
              <Button
                onClick={handleSaveAndNext}
                disabled={isSaving}
                className={`h-8 rounded-[6px] px-4 text-[12px] font-bold ${
                  theme === "dark"
                    ? "bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)] text-brand-foreground"
                    : "bg-[#7b68ee] hover:bg-[#6b58d8] text-white"
                }`}
              >
                {isSaving ? "Saving..." : "Save Funnel"}
              </Button>
            </div>
          </div>
        </div>
        <div className="px-4 md:px-6 pt-4 pb-16 flex flex-col gap-4 min-w-0">{formBody}</div>
      </div>
      {previewAndRemoveDialogs}
    </>
  );
}

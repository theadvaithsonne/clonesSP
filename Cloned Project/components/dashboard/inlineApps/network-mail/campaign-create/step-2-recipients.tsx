"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CloudUpload,
  Download,
  FileText,
  Loader2,
  XCircle,
} from "lucide-react";
import { CampaignStepper } from "./campaign-stepper";
import { CampaignStepHeader } from "./campaign-create-dialog";
import { CampaignActionBar, ActionButton } from "./campaign-action-bar";
import {
  CRM_LEAD_SOURCE_FILTER_OPTIONS,
  CRM_LEAD_STATUS_FILTER_OPTIONS,
} from "./constants";
import {
  getCrmFunnelStages,
  listCrmFunnels,
  listCrmLeadTags,
  type CrmFunnelOption,
  type CrmFunnelStageOption,
} from "./crm-recipients-api";
import {
  getNetworkMailOrgId,
  previewLeadRecipients,
  previewManualRecipients,
  uploadCsvRecipients,
} from "@/lib/network-mail-campaigns-api";
import { useUser } from "@/store/authStore";
import { estimateSendMinutes, parseEmails } from "./utils";
import type { RecipientsData, RecipientSource } from "./types";

const SOURCES: { id: RecipientSource; title: string }[] = [
  { id: "leads", title: "Filter CRM leads" },
  { id: "csv", title: "Upload CSV file" },
  { id: "manual", title: "Enter email addresses" },
];

const SELECT_CLASS =
  "w-full h-11 px-3 pr-9 rounded-lg border border-white/10 bg-[#1a1a1a] text-sm text-white outline-none appearance-none disabled:opacity-50 disabled:cursor-not-allowed";

const FIELD_CLASS =
  "w-full h-11 px-3 rounded-lg border border-white/10 bg-[#1a1a1a] text-sm text-white outline-none disabled:opacity-50";

function formatStatValue(value: number): string {
  return value > 0 ? value.toLocaleString() : "—";
}

function downloadCsvTemplate() {
  const csv = "email,firstName,lastName\njohn@example.com,John,Doe\njane@example.com,Jane,Smith\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "campaign-recipients-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function defaultRecipients(initial?: RecipientsData): RecipientsData {
  return (
    initial ?? {
      source: "leads",
      exclusions: {
        excludeUnsubscribed: true,
        excludeBounced: true,
        excludeSpam: true,
      },
      recipientCount: 0,
      netRecipientCount: 0,
      senderEmail: "",
    }
  );
}

function RadioDot({ checked }: { checked: boolean }) {
  return (
    <span
      className={`h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${
        checked ? "border-brand bg-brand" : "border-white/30 bg-transparent"
      }`}
    />
  );
}

function SourceOption({
  selected,
  title,
  onSelect,
}: {
  selected: boolean;
  title: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-lg border px-4 py-3.5 flex items-center gap-3 transition-all cursor-pointer ${
        selected
          ? "border-brand bg-brand/[0.04]"
          : "border-white/10 bg-transparent hover:border-white/20"
      }`}
    >
      <RadioDot checked={selected} />
      <span className="text-sm font-medium text-white">{title}</span>
    </button>
  );
}

function CrmSelectField({
  label,
  required,
  children,
  ...selectProps
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="block text-sm text-[#a8a8a8] mb-2">
        {label}
        {required && <span className="text-white ml-0.5">*</span>}
      </label>
      <div className="relative">
        <select className={SELECT_CLASS} {...selectProps}>
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7a7a7a] pointer-events-none" />
      </div>
    </div>
  );
}

function LeadsFilterPanel({
  funnels,
  funnelStages,
  tagOptions,
  loadingFunnels,
  loadingStages,
  loadingTags,
  loadingLeadStats,
  leadStatsError,
  selectedFunnelId,
  selectedStage,
  selectedTag,
  selectedLeadStatus,
  selectedSource,
  onFunnelChange,
  onStageChange,
  onTagChange,
  onLeadStatusChange,
  onSourceChange,
}: {
  funnels: CrmFunnelOption[];
  funnelStages: CrmFunnelStageOption[];
  tagOptions: string[];
  loadingFunnels: boolean;
  loadingStages: boolean;
  loadingTags: boolean;
  loadingLeadStats: boolean;
  leadStatsError: string;
  selectedFunnelId: string;
  selectedStage: string;
  selectedTag: string;
  selectedLeadStatus: string;
  selectedSource: string;
  leadStats?: RecipientsData["leadStats"];
  onFunnelChange: (funnelId: string, funnelName?: string) => void;
  onStageChange: (stage: string) => void;
  onTagChange: (tag: string) => void;
  onLeadStatusChange: (leadStatus: string) => void;
  onSourceChange: (source: string) => void;
}) {
  return (
    <div className="space-y-4">
      <CrmSelectField
        label="Sales funnel"
        required
        value={selectedFunnelId}
        disabled={loadingFunnels}
        onChange={(e) => {
          const funnelId = e.target.value;
          const funnel = funnels.find((f) => f.id === funnelId);
          onFunnelChange(funnelId, funnel?.name);
        }}
      >
        <option value="" className="bg-[#1a1a1a]">
          {loadingFunnels ? "Loading funnels..." : "Choose a funnel..."}
        </option>
        {funnels.map((funnel) => (
          <option key={funnel.id} value={funnel.id} className="bg-[#1a1a1a]">
            {funnel.name}
            {funnel.activeLeads != null
              ? ` (${funnel.activeLeads.toLocaleString()} leads)`
              : ""}
          </option>
        ))}
      </CrmSelectField>

      <CrmSelectField
        label="Stage"
        required
        value={selectedStage}
        disabled={!selectedFunnelId || loadingStages}
        onChange={(e) => onStageChange(e.target.value)}
      >
        <option value="" className="bg-[#1a1a1a]">
          {!selectedFunnelId
            ? "Select a funnel first"
            : loadingStages
              ? "Loading stages..."
              : "Choose a stage..."}
        </option>
        {funnelStages.map((stage) => (
          <option key={stage.value} value={stage.value} className="bg-[#1a1a1a]">
            {stage.name}
          </option>
        ))}
      </CrmSelectField>

      <CrmSelectField
        label="Tags filter"
        value={selectedTag}
        disabled={loadingTags}
        onChange={(e) => onTagChange(e.target.value)}
      >
        <option value="" className="bg-[#1a1a1a]">
          {loadingTags ? "Loading tags..." : "All tags"}
        </option>
        {tagOptions.map((tag) => (
          <option key={tag} value={tag} className="bg-[#1a1a1a]">
            {tag}
          </option>
        ))}
      </CrmSelectField>

      <CrmSelectField
        label="Lead status filter"
        value={selectedLeadStatus}
        onChange={(e) => onLeadStatusChange(e.target.value)}
      >
        {CRM_LEAD_STATUS_FILTER_OPTIONS.map((opt) => (
          <option key={opt.value || "all"} value={opt.value} className="bg-[#1a1a1a]">
            {opt.label}
          </option>
        ))}
      </CrmSelectField>

      <CrmSelectField
        label="Source filter"
        value={selectedSource}
        onChange={(e) => onSourceChange(e.target.value)}
      >
        {CRM_LEAD_SOURCE_FILTER_OPTIONS.map((source) => (
          <option key={source || "all"} value={source} className="bg-[#1a1a1a]">
            {source || "All sources"}
          </option>
        ))}
      </CrmSelectField>

      {loadingLeadStats && (
        <div className="flex items-center gap-2 text-xs text-[#7a7a7a]">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
          Counting matching leads...
        </div>
      )}
      {leadStatsError && <p className="text-xs text-red-400">{leadStatsError}</p>}
    </div>
  );
}

export function CampaignStep2Recipients({
  onNext,
  onBack,
  initialData,
  returnToReview,
  onReturnToReview,
}: {
  onNext: (data: RecipientsData) => void;
  onBack: () => void;
  initialData?: RecipientsData;
  returnToReview?: boolean;
  onReturnToReview?: () => void;
}) {
  const user = useUser();
  const [data, setData] = useState<RecipientsData>(() => defaultRecipients(initialData));
  const [manualInput, setManualInput] = useState(
    initialData?.manualEmails?.join("\n") ?? ""
  );
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [manualNetCount, setManualNetCount] = useState<number | null>(null);
  const [loadingManualPreview, setLoadingManualPreview] = useState(false);
  const senderDefaultApplied = useRef(!!initialData?.senderEmail?.trim());
  const [senderEmail, setSenderEmail] = useState(
    () => initialData?.senderEmail?.trim() ?? ""
  );
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (senderDefaultApplied.current) return;
    const email = user?.email?.trim();
    if (!email) return;
    setSenderEmail(email);
    senderDefaultApplied.current = true;
  }, [user?.email]);

  const [funnels, setFunnels] = useState<CrmFunnelOption[]>([]);
  const [funnelStages, setFunnelStages] = useState<CrmFunnelStageOption[]>([]);
  const [loadingFunnels, setLoadingFunnels] = useState(false);
  const [loadingStages, setLoadingStages] = useState(false);
  const [loadingLeadStats, setLoadingLeadStats] = useState(false);
  const [leadStatsError, setLeadStatsError] = useState("");
  const [leadTagOptions, setLeadTagOptions] = useState<string[]>([]);
  const [loadingLeadTags, setLoadingLeadTags] = useState(false);

  const parsedManual = useMemo(() => parseEmails(manualInput), [manualInput]);
  const parsedSenderEmail = useMemo(() => parseEmails(senderEmail), [senderEmail]);
  const selectedFunnelId = data.leadFilter?.funnelId ?? "";
  const selectedStage = data.leadFilter?.stage ?? "";
  const selectedTag = data.leadFilter?.tag ?? "";
  const selectedLeadStatus = data.leadFilter?.leadStatus ?? "";
  const selectedSource = data.leadFilter?.source ?? "";

  useEffect(() => {
    if (data.source !== "leads") return;
    let cancelled = false;
    setLoadingFunnels(true);
    listCrmFunnels()
      .then((list) => {
        if (!cancelled) setFunnels(list);
      })
      .catch(() => {
        if (!cancelled) setFunnels([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingFunnels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data.source]);

  useEffect(() => {
    if (data.source !== "leads" || !selectedFunnelId) {
      setFunnelStages([]);
      return;
    }
    let cancelled = false;
    setLoadingStages(true);
    getCrmFunnelStages(selectedFunnelId)
      .then((stages) => {
        if (!cancelled) setFunnelStages(stages);
      })
      .catch(() => {
        if (!cancelled) setFunnelStages([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data.source, selectedFunnelId]);

  useEffect(() => {
    if (data.source !== "leads") return;
    let cancelled = false;
    setLoadingLeadTags(true);
    listCrmLeadTags()
      .then((tags) => {
        if (!cancelled) setLeadTagOptions(tags);
      })
      .catch(() => {
        if (!cancelled) setLeadTagOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingLeadTags(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data.source]);

  const selectedCount = useMemo(() => {
    switch (data.source) {
      case "csv":
        return data.csvStats?.valid ?? 0;
      case "manual":
        return parsedManual.valid.length;
      case "leads":
        return data.leadStats?.withEmail ?? 0;
      default:
        return 0;
    }
  }, [data.source, data.csvStats, data.leadStats, parsedManual.valid.length]);

  const netRecipients = useMemo(() => {
    switch (data.source) {
      case "csv":
        return data.netRecipientCount ?? data.csvStats?.valid ?? 0;
      case "manual":
        return manualNetCount ?? parsedManual.valid.length;
      case "leads":
        return data.netRecipientCount ?? data.leadStats?.withEmail ?? 0;
      default:
        return 0;
    }
  }, [
    data.source,
    data.netRecipientCount,
    data.csvStats,
    data.leadStats,
    manualNetCount,
    parsedManual.valid.length,
  ]);

  const exclusionCount = Math.max(0, selectedCount - netRecipients);
  const estimatedMinutes = estimateSendMinutes(netRecipients);

  const senderEmailValid =
    !senderEmail.trim() ||
    (parsedSenderEmail.valid.length === 1 && parsedSenderEmail.invalid.length === 0);

  const isValid = useMemo(() => {
    if (!senderEmailValid) return false;
    switch (data.source) {
      case "csv":
        return Boolean(csvFile && data.csvFileId) && (data.netRecipientCount ?? 0) > 0 && !csvUploading;
      case "manual":
        return parsedManual.valid.length > 0 && !loadingManualPreview && (manualNetCount ?? 0) > 0;
      case "leads":
        return (
          Boolean(selectedFunnelId) &&
          Boolean(selectedStage) &&
          (data.netRecipientCount ?? 0) > 0 &&
          !loadingLeadStats
        );
      default:
        return false;
    }
  }, [
    senderEmailValid,
    data.source,
    data.csvStats,
    data.leadStats,
    data.csvFileId,
    data.netRecipientCount,
    csvFile,
    csvUploading,
    loadingManualPreview,
    manualNetCount,
    selectedFunnelId,
    selectedStage,
    loadingLeadStats,
    parsedManual.valid.length,
  ]);

  const update = (patch: Partial<RecipientsData>) => {
    setData((prev) => ({ ...prev, ...patch }));
    setError("");
  };

  useEffect(() => {
    if (data.source !== "leads" || !selectedFunnelId || !selectedStage) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoadingLeadStats(true);
      setLeadStatsError("");
      const orgId = getNetworkMailOrgId();
      if (!orgId) {
        setLeadStatsError("Organization not found");
        return;
      }
      previewLeadRecipients(orgId, {
        leadFilter: {
          funnelId: selectedFunnelId,
          funnelName: data.leadFilter?.funnelName,
          stage: selectedStage,
          tag: selectedTag || undefined,
          leadStatus: selectedLeadStatus || undefined,
          source: selectedSource || undefined,
        },
        exclusions: data.exclusions,
      })
        .then((stats) => {
          setData((prev) => ({
            ...prev,
            leadStats: {
              total: stats.total,
              withEmail: stats.withEmail,
              sample: stats.sample,
            },
            recipientCount: stats.withEmail,
            netRecipientCount: stats.netRecipientCount,
          }));
        })
        .catch((err: Error) => {
          if (err.name === "AbortError") return;
          setLeadStatsError("Could not load lead count for this funnel and stage");
          setData((prev) => ({
            ...prev,
            leadStats: { total: 0, withEmail: 0 },
            netRecipientCount: 0,
          }));
        })
        .finally(() => {
          setLoadingLeadStats(false);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    data.source,
    selectedFunnelId,
    selectedStage,
    selectedTag,
    selectedLeadStatus,
    selectedSource,
    data.exclusions,
    data.leadFilter?.funnelName,
  ]);

  useEffect(() => {
    if (data.source !== "manual" || parsedManual.valid.length === 0) {
      setManualNetCount(null);
      return;
    }
    const orgId = getNetworkMailOrgId();
    if (!orgId) return;
    const timer = setTimeout(() => {
      setLoadingManualPreview(true);
      previewManualRecipients(orgId, {
        emails: parsedManual.valid,
        exclusions: data.exclusions,
      })
        .then((res) => {
          setManualNetCount(res.netRecipientCount);
          setData((prev) => ({
            ...prev,
            netRecipientCount: res.netRecipientCount,
            recipientCount: parsedManual.valid.length,
          }));
        })
        .catch(() => setManualNetCount(parsedManual.valid.length))
        .finally(() => setLoadingManualPreview(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [data.source, data.exclusions, parsedManual.valid]);

  const uploadCsvFile = async (file: File) => {
    const orgId = getNetworkMailOrgId();
    if (!orgId) {
      setError("Organization not found");
      return;
    }
    setCsvUploading(true);
    setError("");
    try {
      const res = await uploadCsvRecipients(orgId, file);
      setCsvFile(file);
      update({
        csvFileId: res.csvFileId,
        csvFileName: res.fileName,
        csvFileSize: res.fileSize,
        csvMapping: res.mapping,
        csvStats: res.stats,
        recipientCount: res.stats.valid,
        netRecipientCount: res.netRecipientCount,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload CSV");
      setCsvFile(null);
    } finally {
      setCsvUploading(false);
    }
  };

  const isAcceptedCsv = (file: File) =>
    file.type === "text/csv" ||
    file.name.endsWith(".csv") ||
    file.name.endsWith(".xlsx") ||
    file.name.endsWith(".xls");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isAcceptedCsv(file)) void uploadCsvFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && isAcceptedCsv(file)) void uploadCsvFile(file);
  };

  const handleRemoveFile = () => {
    setCsvFile(null);
    update({
      csvFileId: undefined,
      csvFileName: undefined,
      csvFileSize: undefined,
      csvMapping: undefined,
      csvStats: undefined,
      netRecipientCount: 0,
      recipientCount: 0,
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleNext = () => {
    if (!senderEmailValid) {
      setError("Enter a valid sender email or leave the field empty");
      return;
    }
    if (!isValid) {
      if (data.source === "leads") {
        setError(
          !selectedFunnelId || !selectedStage
            ? "Select a funnel and stage to continue"
            : "No leads with email addresses match this funnel and stage"
        );
      } else {
        setError("Add at least one valid recipient to continue");
      }
      return;
    }
    const trimmedSender = senderEmail.trim();
    onNext({
      ...data,
      manualEmails: data.source === "manual" ? parsedManual.valid : data.manualEmails,
      senderEmail: trimmedSender || undefined,
      recipientCount: selectedCount,
      netRecipientCount: netRecipients,
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <CampaignStepper
        currentStep={2}
        returnToReview={returnToReview}
        onReturnToReview={onReturnToReview}
      />

      <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
        <div className="space-y-4 mb-5">
          <CampaignStepHeader
            step={2}
            title="Recipients"
            description="Define who receives this campaign."
          />
        </div>
        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex-1 min-w-0 space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#a8a8a8] mb-2">
                Recipient source
              </label>
              <div className="space-y-2">
                {SOURCES.map((src) => (
                  <SourceOption
                    key={src.id}
                    selected={data.source === src.id}
                    title={src.title}
                    onSelect={() => update({ source: src.id })}
                  />
                ))}
              </div>
            </div>

            {data.source === "leads" && (
              <div className="space-y-4">
                <LeadsFilterPanel
                  funnels={funnels}
                  funnelStages={funnelStages}
                  tagOptions={leadTagOptions}
                  loadingFunnels={loadingFunnels}
                  loadingStages={loadingStages}
                  loadingTags={loadingLeadTags}
                  loadingLeadStats={loadingLeadStats}
                  leadStatsError={leadStatsError}
                  selectedFunnelId={selectedFunnelId}
                  selectedStage={selectedStage}
                  selectedTag={selectedTag}
                  selectedLeadStatus={selectedLeadStatus}
                  selectedSource={selectedSource}
                  onFunnelChange={(funnelId, funnelName) =>
                  update({
                    leadFilter: {
                      funnelId,
                      funnelName,
                      stage: "",
                      tag: data.leadFilter?.tag,
                      leadStatus: data.leadFilter?.leadStatus,
                      source: data.leadFilter?.source,
                    },
                    leadStats: { total: 0, withEmail: 0 },
                  })
                }
                onStageChange={(stage) =>
                  update({
                    leadFilter: {
                      funnelId: selectedFunnelId,
                      funnelName: data.leadFilter?.funnelName,
                      stage,
                      tag: data.leadFilter?.tag,
                      leadStatus: data.leadFilter?.leadStatus,
                      source: data.leadFilter?.source,
                    },
                    leadStats: { total: 0, withEmail: 0 },
                  })
                }
                onTagChange={(tag) =>
                  update({
                    leadFilter: {
                      funnelId: selectedFunnelId,
                      funnelName: data.leadFilter?.funnelName,
                      stage: selectedStage,
                      tag,
                      leadStatus: data.leadFilter?.leadStatus,
                      source: data.leadFilter?.source,
                    },
                    leadStats: { total: 0, withEmail: 0 },
                  })
                }
                onLeadStatusChange={(leadStatus) =>
                  update({
                    leadFilter: {
                      funnelId: selectedFunnelId,
                      funnelName: data.leadFilter?.funnelName,
                      stage: selectedStage,
                      tag: data.leadFilter?.tag,
                      leadStatus,
                      source: data.leadFilter?.source,
                    },
                    leadStats: { total: 0, withEmail: 0 },
                  })
                }
                onSourceChange={(source) =>
                  update({
                    leadFilter: {
                      funnelId: selectedFunnelId,
                      funnelName: data.leadFilter?.funnelName,
                      stage: selectedStage,
                      tag: data.leadFilter?.tag,
                      leadStatus: data.leadFilter?.leadStatus,
                      source,
                    },
                    leadStats: { total: 0, withEmail: 0 },
                  })
                }
                />

                <div>
                  <label className="block text-sm text-[#a8a8a8] mb-2">Sender email</label>
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => {
                      setSenderEmail(e.target.value);
                      setError("");
                    }}
                    placeholder={user?.email ?? "you@company.com"}
                    className={FIELD_CLASS}
                  />
                </div>
              </div>
            )}

            {data.source === "csv" && (
              <div className="space-y-3">
                {csvUploading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#7a7a7a]">
                    <Loader2 className="h-5 w-5 animate-spin text-brand" />
                    Uploading and validating…
                  </div>
                ) : !csvFile ? (
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className="border border-dashed border-white/20 rounded-lg px-6 py-10 text-center"
                  >
                    <CloudUpload className="h-8 w-8 text-white/70 mx-auto mb-3" />
                    <p className="text-sm text-white mb-1">Drag & drop your CSV file here</p>
                    <p className="text-xs text-[#7a7a7a] mb-4">or</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 px-4 rounded-lg border border-white/15 bg-white/[0.06] text-sm text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Browse files
                    </button>
                    <p className="text-xs text-[#7a7a7a] mt-4">Supported format: .csv</p>
                    <button
                      type="button"
                      onClick={downloadCsvTemplate}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand hover:text-[color:color-mix(in_srgb,var(--brand)_87%,black)] underline underline-offset-2 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download CSV template
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/10 rounded-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{csvFile.name}</p>
                          <p className="text-xs text-[#7a7a7a]">
                            {(csvFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="text-sm text-red-400 hover:text-red-300 shrink-0 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>

                    {data.csvStats && (
                      <div className="rounded-lg border border-white/10 p-3 space-y-1.5 text-sm">
                        <div className="flex items-center gap-2 text-emerald-400">
                          <Check className="h-3.5 w-3.5" />
                          <span>{data.csvStats.valid} valid emails</span>
                        </div>
                        {data.csvStats.duplicates > 0 && (
                          <div className="flex items-center gap-2 text-amber-400">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>{data.csvStats.duplicates} duplicates skipped</span>
                          </div>
                        )}
                        {data.csvStats.invalid > 0 && (
                          <div className="flex items-center gap-2 text-red-400">
                            <XCircle className="h-3.5 w-3.5" />
                            <span>{data.csvStats.invalid} invalid skipped</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {data.source === "manual" && (
              <div>
                <label className="block text-sm font-medium text-[#a8a8a8] mb-2">
                  Email addresses
                </label>
                <textarea
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder={"john@example.com, jane@example.com\nteam@company.org..."}
                  rows={5}
                  className="w-full px-3 py-2.5 text-sm border border-white/10 rounded-lg bg-white/[0.04] text-white placeholder:text-white/30 outline-none resize-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-[#7a7a7a]">Separate with commas or new lines</p>
                  <span className="text-xs text-[#7a7a7a] px-2 py-0.5 rounded-full bg-white/[0.06]">
                    {parsedManual.valid.length} address{parsedManual.valid.length === 1 ? "" : "es"}
                  </span>
                </div>

                {parsedManual.invalid.length > 0 && (
                  <div className="mt-3 bg-red-500/10 border border-red-500/25 rounded-lg p-3">
                    <p className="text-xs font-medium text-red-300 mb-2">Invalid emails:</p>
                    <div className="flex flex-wrap gap-1">
                      {parsedManual.invalid.map((email) => (
                        <span
                          key={email}
                          className="px-2 py-0.5 bg-red-500/15 text-red-300 text-xs rounded"
                        >
                          {email}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {data.source !== "leads" && (
              <div>
                <label className="block text-sm text-[#a8a8a8] mb-2">Sender email</label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => {
                    setSenderEmail(e.target.value);
                    setError("");
                  }}
                  placeholder={user?.email ?? "you@company.com"}
                  className={FIELD_CLASS}
                />
              </div>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          <div className="lg:w-52 shrink-0">
            <div className="lg:sticky lg:top-4 border border-white/10 rounded-xl p-4 bg-white/[0.02]">
              <h4 className="text-sm font-semibold text-white mb-4">Recipient stats</h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#7a7a7a]">Total Recipients</span>
                  <span className="text-white">{formatStatValue(selectedCount)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#7a7a7a]">Selected</span>
                  <span className="text-white">{formatStatValue(selectedCount)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#7a7a7a]">Exclusions</span>
                  <span className="text-white">
                    {exclusionCount > 0 ? `-${exclusionCount.toLocaleString()}` : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#7a7a7a]">Net Recipients</span>
                  <span className="text-brand font-medium">
                    {formatStatValue(netRecipients)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#7a7a7a]">Est. send time</span>
                  <span className="text-white">
                    {netRecipients > 0 ? `~${estimatedMinutes} min` : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CampaignActionBar
          left={
            <ActionButton variant="secondary" onClick={onBack} className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </ActionButton>
          }
          right={
            <ActionButton
              variant="primary"
              disabled={!isValid}
              onClick={handleNext}
              className="inline-flex items-center gap-2"
            >
              Next: Schedule
              <ArrowRight className="h-4 w-4" />
            </ActionButton>
          }
        />
    </div>
  );
}

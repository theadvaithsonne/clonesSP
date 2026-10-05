"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LayoutGrid,
  Send,
  BarChart3,
  Settings,
  X,
  Mail,
  Mailbox,
  Search,
  Plus,
  Monitor,
  Smartphone,
  Pencil,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  ImageIcon,
  Stamp,
  Building2,
  Type,
  Heading,
  AlignJustify,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  MousePointerClick,
  Share2,
  PanelBottom,
  Square,
  ListOrdered,
  List,
  Columns3,
  RectangleHorizontal,
  MoveVertical,
  GripVertical,
  Trash2,
  Check,
  Bold,
  Italic,
  Underline,
  Copy,
  Upload,
  Link,
  Lock,
  Unlock,
  ExternalLink,
  Maximize2,
  Rows3,
  Undo2,
  Redo2,
  Code2,
  Download,
  Clipboard,
  SendHorizonal,
  LayoutTemplate,
  Sparkles,
  Newspaper,
  Percent,
  FileCheck,
  ShoppingBag,
} from "lucide-react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import type { InlineAppProps } from "../registry";
import {
  SocialIconsBlockRenderer,
  SocialIconsPropertiesPanel,
  parseSocialIcons,
  getVisibleIcons,
  SocialIconGlyph,
  getIconContainerStyle,
  getIconFillColor,
  BRAND_COLORS,
} from "./social-icons";
import {
  FooterBlockRenderer,
  FooterPropertiesPanel,
  formatAddress,
} from "./footer-block";
import {
  PreheaderBlockRenderer,
  PreheaderPropertiesPanel,
  sortComponentsWithPreheaderFirst,
} from "./preheader-block";
import {
  createBlock,
  makeId,
  parseColumns,
  serializeColumns,
  makeColumnsContent,
  type BlockType,
  type ComponentBlock,
  type ColumnData,
} from "./block-factory";
import {
  EMAIL_TEMPLATE_PRESETS,
  buildEmailTemplatePreset,
  type EmailTemplatePresetId,
} from "./email-template-presets";
import {
  exportToHTML,
  resolveTemplatePreviewHtml,
} from "./email-html-export";
import { ResponsiveEmailFrame } from "@/components/shared/EmailTemplatePreview";
import {
  applyMergeSamples,
  mergeToken,
  pickableLinkVariables,
} from "./merge-variables";
import {
  DynamicFieldsCard,
  MergeVariableAutocomplete,
  VariablePickerButton,
  editableFromSelection,
  insertTokenAtCaret,
} from "./merge-variable-picker";
import { toast } from "sonner";
import {
  createTemplate,
  deleteTemplate,
  formatTemplateListDate,
  getNetworkMailOrgId,
  getTemplate,
  listTemplates,
  publishTemplate,
  sendTemplateTestEmail,
  updateTemplate,
  type TemplateCategory as MailTemplateCategory,
  type TemplateListItem,
  type TemplateStatus,
} from "@/lib/network-mail-api";
import {
  NetworkMailEditorProvider,
  useNetworkMailEditor,
} from "./network-mail-editor-context";
import { buildExternalUrl } from "@/lib/api-config";
import { resolveEditorImageSrc } from "./template-image-upload";
import { CampaignTable, type CampaignRow } from "./campaign-table";
import { CampaignDetailsView } from "./campaign-details-view";
import { CampaignCreateFlow } from "./campaign-create/campaign-create-flow";
import { CreateTemplateModal } from "./create-template-modal";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";
import { DeleteCampaignDialog } from "./delete-campaign-dialog";
import {
  apiStatusToDisplayStatus,
  apiStatusToTableFilter,
  deleteCampaign,
  duplicateCampaign,
  formatCampaignListDate,
  listCampaigns,
  type CampaignListItem,
} from "@/lib/network-mail-campaigns-api";

const DND_PALETTE = "PALETTE_COMPONENT";
const DND_CANVAS = "CANVAS_COMPONENT";
const DND_COLUMN_CELL = "COLUMN_CELL";

interface PaletteDragItem {
  componentType: BlockType;
}

interface CanvasDragItem {
  id: string;
  index: number;
}

type NetworkMailSection =
  | "template-library"
  | "campaigns"
  | "reports"
  | "settings";

const SECTION_META: Record<
  NetworkMailSection,
  { label: string; subtitle: string; icon: typeof LayoutGrid }
> = {
  "template-library": {
    label: "Template Library",
    subtitle: "Manage and create email templates",
    icon: LayoutGrid,
  },
  campaigns: {
    label: "Campaigns",
    subtitle: "Create and manage email campaigns",
    icon: Send,
  },
  reports: {
    label: "Reports",
    subtitle: "Campaign analytics and performance",
    icon: BarChart3,
  },
  settings: {
    label: "Settings",
    subtitle: "Configure your email workspace",
    icon: Settings,
  },
};

function resolveSection(section?: string): NetworkMailSection {
  if (
    section === "template-library" ||
    section === "campaigns" ||
    section === "reports" ||
    section === "settings"
  ) {
    return section;
  }
  return "template-library";
}

export default function NetworkMailApp({ onClose, section }: InlineAppProps) {
  const [mounted, setMounted] = useState(false);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [openCreateCampaignRequest, setOpenCreateCampaignRequest] = useState(0);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const activeSection = useMemo(() => resolveSection(section), [section]);
  const meta = SECTION_META[activeSection];
  const SectionIcon = meta.icon;

  useEffect(() => {
    const onOpenCreateCampaign = () => {
      setOpenCreateCampaignRequest((n) => n + 1);
    };
    window.addEventListener(
      "network-mail:open-create-campaign",
      onOpenCreateCampaign,
    );
    return () => {
      window.removeEventListener(
        "network-mail:open-create-campaign",
        onOpenCreateCampaign,
      );
    };
  }, []);

  // Don't reopen create dialog when navigating back to Campaigns later.
  useEffect(() => {
    if (activeSection !== "campaigns") {
      setOpenCreateCampaignRequest(0);
    }
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== "template-library") {
      setIsEditingTemplate(false);
    }
  }, [activeSection]);

  const handleCreateCampaignRequestHandled = useCallback(() => {
    setOpenCreateCampaignRequest(0);
  }, []);

  function renderSection() {
    switch (activeSection) {
      case "template-library":
        return <TemplateLibrarySection onEditingChange={setIsEditingTemplate} />;
      case "campaigns":
        return (
          <CampaignsSection
            openCreateCampaignRequest={openCreateCampaignRequest}
            onCreateCampaignRequestHandled={handleCreateCampaignRequestHandled}
          />
        );
      case "reports":
        return <ReportsSection />;
      case "settings":
        return <SettingsSection />;
      default:
        return null;
    }
  }

  return (
    <div
      className={`flex flex-col h-full bg-[#0e0e0e] text-white transition-opacity duration-300 ease-out ${mounted ? "opacity-100" : "opacity-0"
        }`}
    >
      <main className={`flex-1 bg-[#000] ${isEditingTemplate ? "overflow-hidden flex flex-col min-h-0" : "overflow-y-auto"}`}>
        <div
          className={isEditingTemplate
            ? "flex-1 flex flex-col min-h-0 w-full animate-[fadeIn_0.25s_ease-out]"
            : `p-6 mx-auto animate-[fadeIn_0.25s_ease-out] ${activeSection === "template-library" ? "max-w-[1400px] w-full" : "max-w-[1400px]"
            }`}
          key={activeSection}
        >
          {renderSection()}
        </div>
      </main>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

const TEMPLATE_CATEGORIES = [
  "All Templates",
  "Marketing",
  "General",
  "Promotional",
  "Transactional",
] as const;

const CREATE_CATEGORIES = ["Marketing", "General", "Promotional", "Transactional"] as const;

type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  General: { bg: "bg-[#2a2a35]", text: "text-[#c0c0cc]" },
  Marketing: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  Promotional: { bg: "bg-blue-500/15", text: "text-blue-400" },
  Transactional: { bg: "bg-amber-500/15", text: "text-amber-400" },
};

const CATEGORY_BADGE: Record<string, string> = {
  General: "bg-[#4b5563] text-white",
  Marketing: "bg-[#16a34a] text-white",
  Promotional: "bg-[#2563eb] text-white",
  Transactional: "bg-[#d97706] text-white",
};

type LibraryTemplate = {
  id: string;
  name: string;
  category: string;
  status: TemplateStatus;
  createdDate: string;
  uses: number;
  thumbnailUrl?: string | null;
};

function resolveTemplateThumbnailSrc(url: string): string {
  if (/^(https?:|data:|\/)/.test(url)) {
    return url.startsWith("/") && !url.startsWith("//")
      ? buildExternalUrl(url.slice(1))
      : url;
  }
  return buildExternalUrl(url);
}

function TemplateLibraryThumbnail({ template }: { template: LibraryTemplate }) {
  const badgeClass = CATEGORY_BADGE[template.category] || CATEGORY_BADGE.General;
  const imageSrc = template.thumbnailUrl
    ? resolveTemplateThumbnailSrc(template.thumbnailUrl)
    : null;

  return (
    <div className="relative aspect-[16/10] overflow-hidden bg-[#141414]">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <>
        </>
        // <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#242424] to-[#141414] px-4">
        //   <div className="w-full max-w-[140px] rounded border border-white/10 bg-white/[0.04] p-2.5 space-y-1.5">
        //     <div className="h-3 w-full rounded bg-brand/35" />
        //     <div className="h-8 w-full rounded bg-white/10" />
        //     <div className="h-1.5 w-full rounded bg-white/10" />
        //     <div className="h-1.5 w-3/4 rounded bg-white/10" />
        //     <div className="mx-auto mt-1 h-3 w-12 rounded bg-brand/25" />
        //   </div>
        // </div>
      )}
      <span
        className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badgeClass}`}
      >
        {template.category}
      </span>
    </div>
  );
}

type PreviewDevice = "desktop" | "mobile";

function TemplatePreviewModal({
  template,
  onClose,
  onEdit,
}: {
  template: LibraryTemplate;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [htmlBody, setHtmlBody] = useState<string | null>(null);
  const [preheader, setPreheader] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const colors = CATEGORY_COLORS[template.category] || CATEGORY_COLORS.General;

  useEffect(() => {
    let cancelled = false;
    const orgId = getNetworkMailOrgId();
    if (!orgId) {
      setLoading(false);
      return;
    }
    getTemplate(orgId, template.id)
      .then((t) => {
        if (!cancelled) {
          setHtmlBody(resolveTemplatePreviewHtml(t) || "");
          const preheaderComp = Array.isArray(t.components)
            ? t.components.find((c: any) => c.type === "preheader")
            : null;
          if (preheaderComp && preheaderComp.content?.text) {
            setPreheader(preheaderComp.content.text);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load preview");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [template.id]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative bg-[#1a1a1a] rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]"
        style={{ width: "min(720px, 92vw)", maxHeight: "90vh" }}
      >
        {/* Header toolbar */}
        <div className="h-14 shrink-0 border-b border-white/10 flex items-center justify-between px-5">
          <h3 className="text-[15px] font-semibold text-white truncate mr-4">
            {template.name}
          </h3>

          <div className="flex items-center gap-3">
            {/* Device toggle */}
            <div className="flex items-center h-8 rounded-lg bg-white/[0.06] ring-1 ring-white/10 p-0.5">
              <button
                onClick={() => setDevice("desktop")}
                className={`h-7 px-3 rounded-md flex items-center gap-1.5 text-xs font-medium transition-all cursor-pointer ${device === "desktop"
                  ? "bg-white/[0.12] text-white shadow-sm"
                  : "text-[#7a7a7a] hover:text-[#a8a8a8]"
                  }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                Desktop
              </button>
              <button
                onClick={() => setDevice("mobile")}
                className={`h-7 px-3 rounded-md flex items-center gap-1.5 text-xs font-medium transition-all cursor-pointer ${device === "mobile"
                  ? "bg-white/[0.12] text-white shadow-sm"
                  : "text-[#7a7a7a] hover:text-[#a8a8a8]"
                  }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                Mobile
              </button>
            </div>

            <button
              onClick={() => {
                onEdit();
              }}
              className="h-8 px-4 rounded-lg bg-brand text-brand-foreground text-xs font-medium hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)] active:scale-[0.97] transition-all cursor-pointer whitespace-nowrap"
            >
              Use this template
            </button>

            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 text-xs text-[#a8a8a8] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>

            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="h-4 w-4 text-[#7a7a7a] hover:text-white transition-colors" />
            </button>
          </div>
        </div>

        {/* Email metadata simulation */}
        {preheader && (
          <div className="shrink-0 bg-[#222] border-b border-white/10 px-5 py-2.5 flex flex-col gap-1 text-[11px]">
            <div className="flex gap-2">
              <span className="text-[#7a7a7a] font-medium w-16">Subject:</span>
              <span className="text-[#a8a8a8]">{template.name}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#7a7a7a] font-medium w-16">Pre-header:</span>
              <span className="text-[#d1d5db] italic">{preheader}</span>
            </div>
          </div>
        )}

        {/* Email preview body — this pane is the only scroller; the frames
            inside it are sized to the whole email. */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch] bg-[#e8e8e8] flex justify-center p-3 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : device === "desktop" ? (
            <div className="w-full max-w-[600px] min-w-0 bg-white rounded-lg shadow-sm overflow-hidden self-start">
              {htmlBody ? (
                <ResponsiveEmailFrame html={htmlBody} />
              ) : (
                <p className="p-8 text-sm text-[#666] text-center">No preview available</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center self-start w-full min-w-0">
              {/* Phone frame */}
              <div
                className="relative bg-[#1c1c1e] rounded-[40px] p-3 shadow-xl shadow-black/40 w-full"
                style={{ maxWidth: 310 }}
              >
                {/* Notch */}
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-5 bg-[#1c1c1e] rounded-b-2xl z-10" />
                {/* Screen bezel */}
                <div className="rounded-[28px] overflow-hidden bg-white">
                  {/* Status bar */}
                  <div className="h-11 bg-[#f8f8f8] flex items-end justify-between px-6 pb-1">
                    <span className="text-[10px] font-semibold text-[#1c1c1e]">9:41</span>
                    <div className="flex items-center gap-1">
                      <div className="w-3.5 h-2 rounded-sm bg-[#1c1c1e]/70" />
                      <div className="w-3 h-2 rounded-sm bg-[#1c1c1e]/40" />
                      <div className="w-4 h-2 rounded-sm border border-[#1c1c1e]/50 relative">
                        <div className="absolute inset-0.5 bg-[#34c759] rounded-[1px]" />
                      </div>
                    </div>
                  </div>
                  {/* Email content in phone. The handset grows to the full
                      email rather than capping and scrolling internally — the
                      modal body is the scroller. */}
                  <div className="bg-white min-w-0">
                    {htmlBody ? (
                      <ResponsiveEmailFrame
                        html={htmlBody}
                        title="Email preview mobile"
                      />
                    ) : (
                      <p className="p-6 text-xs text-[#666] text-center">No preview</p>
                    )}
                  </div>
                  {/* Home indicator */}
                  <div className="h-6 bg-white flex items-center justify-center">
                    <div className="w-28 h-1 rounded-full bg-[#1c1c1e]/20" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer bar */}
        <div className="h-11 shrink-0 border-t border-white/10 flex items-center gap-4 px-5 bg-[#151515]">
          <span
            className={`inline-block text-[11px] px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}
          >
            {template.category}
          </span>
          <span className="text-[11px] text-[#7a7a7a]">
            Created {template.createdDate}
          </span>
          <span className="text-[11px] text-[#7a7a7a]">
            Used {template.uses} times
          </span>
        </div>
      </div>
    </div>
  );
}

type EditorTemplate = { id: string; name: string; category: string };

const HEADING_LEVEL_DEFAULT_SIZE: Record<string, string> = {
  "1": "36", "2": "30", "3": "24", "4": "20", "5": "18", "6": "16",
};

const LOGO_WIDTH_PRESETS: Record<string, string> = {
  small: "100",
  medium: "150",
  large: "200",
};

const LOGO_ACCEPT_TYPES = ["image/jpeg", "image/png", "image/svg+xml"];

/** Left sidebar palette order (pre-header first when used). */
const PALETTE_ITEMS: { type: BlockType; icon: typeof AlignLeft; label: string }[] = [
  { type: "preheader", icon: EyeOff, label: "Pre-header" },
  { type: "logo", icon: Stamp, label: "Logo" },
  { type: "heading", icon: Heading, label: "Heading" },
  { type: "text", icon: AlignLeft, label: "Text" },
  { type: "image", icon: ImageIcon, label: "Image" },
  { type: "button", icon: RectangleHorizontal, label: "Button" },
  { type: "divider", icon: Minus, label: "Divider" },
  { type: "spacer", icon: MoveVertical, label: "Spacer" },
  { type: "columns", icon: Columns3, label: "Columns" },
  { type: "socialIcons", icon: Share2, label: "Social Icons" },
  { type: "footer", icon: PanelBottom, label: "Footer" },
];

const PRESET_THUMBNAIL_ICONS: Record<EmailTemplatePresetId, typeof Sparkles> = {
  welcome: Sparkles,
  newsletter: Newspaper,
  promotional: Percent,
  transactional: FileCheck,
  "order-confirmation": ShoppingBag,
  "org-welcome": Sparkles,
};

/* ─── Export Modal ─── */

function ExportModal({
  components,
  templateName,
  templateId,
  onClose,
}: {
  components: ComponentBlock[];
  templateName: string;
  templateId: string;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"html" | "preview">("preview");
  const [copied, setCopied] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const html = useMemo(() => exportToHTML(components, templateName), [components, templateName]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = html;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [html]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${templateName.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "email-template"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [html, templateName]);

  const handlePreviewNewTab = useCallback(() => {
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }, [html]);

  const handleSendTest = useCallback(async () => {
    if (!testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) return;
    const orgId = getNetworkMailOrgId();
    if (!orgId) {
      toast.error("No organization selected");
      return;
    }
    setSendingTest(true);
    try {
      await updateTemplate(orgId, templateId, { htmlBody: html });
      await sendTemplateTestEmail(orgId, templateId, {
        to: testEmail,
        subject: `Test: ${templateName}`,
        mergeData: { first_name: "Alex", company_name: "Acme Inc" },
        htmlBody: html,
      });
      setTestSent(true);
      toast.success("Test email sent");
      setTimeout(() => setTestSent(false), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  }, [testEmail, templateId, templateName, html]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[calc(100vw-2rem)] max-w-[900px] max-h-[85vh] bg-[#111111] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-brand/15 flex items-center justify-center">
              <Code2 className="h-4 w-4 text-brand" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-white">Export Template</h3>
              <p className="text-[12px] text-[#7a7a7a]">Email-compatible HTML with inline styles</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-colors cursor-pointer">
            <X className="h-4 w-4 text-[#7a7a7a]" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-0">
          {(["preview", "html"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-9 px-4 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${activeTab === tab
                ? "bg-white/[0.08] text-white"
                : "text-[#7a7a7a] hover:text-[#a8a8a8] hover:bg-white/[0.04]"
                }`}
            >
              {tab === "preview" ? "Preview" : "HTML Code"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {activeTab === "preview" ? (
            // Only this pane scrolls. The frame inside is sized to the full
            // email, so the preview itself never grows a scrollbar.
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch] p-3 sm:p-6">
              <div className="bg-[#f3f4f6] rounded-xl p-3 sm:p-6">
                <div className="w-full max-w-[600px] mx-auto min-w-0 bg-white shadow-lg rounded-lg overflow-hidden">
                  <ResponsiveEmailFrame html={html} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-6">
              <pre className="bg-[#0a0a0a] border border-white/[0.06] rounded-xl p-4 text-[12px] text-[#a8a8a8] leading-relaxed font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto">
                {html}
              </pre>
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="px-6 py-4 border-t border-white/[0.06]">
          <div className="flex flex-wrap items-center gap-3">
            {/* Copy HTML */}
            <button
              onClick={handleCopy}
              className={`h-10 px-5 rounded-lg flex items-center gap-2 text-[13px] font-medium transition-all cursor-pointer ${copied
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-white/[0.06] text-white border border-white/10 hover:bg-white/[0.1]"
                }`}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy HTML"}
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              className="h-10 px-5 rounded-lg bg-white/[0.06] text-white border border-white/10 hover:bg-white/[0.1] flex items-center gap-2 text-[13px] font-medium transition-all cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              Download .html
            </button>

            {/* Preview in new tab */}
            <button
              onClick={handlePreviewNewTab}
              className="h-10 px-5 rounded-lg bg-white/[0.06] text-white border border-white/10 hover:bg-white/[0.1] flex items-center gap-2 text-[13px] font-medium transition-all cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Tab
            </button>

            <div className="w-px h-8 bg-white/10 mx-1" />

            {/* Send test email */}
            <div className="flex items-center gap-2 flex-1">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@email.com"
                onKeyDown={(e) => { if (e.key === "Enter") handleSendTest(); }}
                className="flex-1 h-10 px-3 rounded-lg border border-white/10 bg-white/[0.04] text-[13px] text-white placeholder:text-white/30 outline-none focus:border-brand/50 transition-colors"
              />
              <button
                onClick={handleSendTest}
                disabled={sendingTest || !testEmail}
                className={`h-10 px-5 rounded-lg flex items-center gap-2 text-[13px] font-medium transition-all cursor-pointer ${testSent
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : sendingTest
                    ? "bg-brand/10 text-brand border border-brand/20"
                    : "bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)]"
                  } ${!testEmail ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {testSent ? (
                  <><Check className="h-3.5 w-3.5" /> Sent!</>
                ) : sendingTest ? (
                  <><div className="h-3.5 w-3.5 border-2 border-brand border-t-transparent rounded-full animate-spin" /> Sending...</>
                ) : (
                  <><SendHorizonal className="h-3.5 w-3.5" /> Send Test</>
                )}
              </button>
            </div>
          </div>

          {/* Email client compatibility note */}
          <div className="flex items-center gap-2 mt-3 px-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#7a7a7a] uppercase tracking-wider">Compatible with</span>
              {["Gmail", "Outlook", "Apple Mail", "Yahoo"].map((c) => (
                <span key={c} className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] text-[#a8a8a8] border border-white/[0.06]">{c}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TextBlockRenderer({
  block,
  onUpdate,
}: {
  block: ComponentBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (b: ComponentBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const s = block.styles;

  // Edited as-is: `{{tokens}}` are ordinary text here, exactly as they are
  // stored and exported. Nothing is rewritten on the way in or out.
  const html = block.content.html || "";
  const renderedRef = useRef<string | null>(null);

  // Injected imperatively rather than through `dangerouslySetInnerHTML` so a
  // commit made while the founder is still typing (toolbar insert, inline
  // autocomplete) does not blow away the DOM under their caret.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (renderedRef.current === html) return;
    if (document.activeElement === el) {
      renderedRef.current = html;
      return;
    }
    el.innerHTML = html;
    renderedRef.current = html;
  }, [html]);

  const commit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const html = el.innerHTML;
    const plain = el.innerText;
    if (html !== block.content.html) {
      onUpdate({ ...block, content: { ...block.content, html, plainText: plain } });
    }
  }, [block, onUpdate]);

  return (
    <div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onBlur={commit}
        className="outline-none min-h-[1.5em] [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-1 [&_ul]:my-2 [&_ol]:my-2"
        style={{
          fontSize: `${s.fontSize}px`,
          color: s.color,
          backgroundColor: s.backgroundColor === "transparent" ? undefined : s.backgroundColor,
          fontWeight: Number(s.fontWeight),
          lineHeight: s.lineHeight,
          textAlign: s.textAlign as CanvasTextAlign,
          fontStyle: s.fontStyle,
          textDecoration: s.textDecoration === "none" ? undefined : s.textDecoration,
          paddingTop: `${s.paddingTop}px`,
          paddingRight: `${s.paddingRight}px`,
          paddingBottom: `${s.paddingBottom}px`,
          paddingLeft: `${s.paddingLeft}px`,
        }}
      />
      <MergeVariableAutocomplete editableRef={ref} onInserted={commit} />
    </div>
  );
}

function headingDecorationStyle(s: Record<string, string>): React.CSSProperties["textDecoration"] {
  const u = s.decorationUnderline === "true";
  const l = s.decorationLineThrough === "true";
  if (u && l) return "underline line-through";
  if (u) return "underline";
  if (l) return "line-through";
  return undefined;
}

function HeadingBlockRenderer({
  block,
  onUpdate,
}: {
  block: ComponentBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (b: ComponentBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const s = block.styles;
  const level = Math.min(6, Math.max(1, Number(block.content.level) || 2));
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

  // Headings store plain text — `{{tokens}}` included, written straight into
  // the node so nothing can reinterpret them as markup.
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.textContent = block.content.text || "Your heading here";
    }
  }, [block.content.text]);

  const commit = useCallback(() => {
    if (!ref.current) return;
    const text = (ref.current.innerText || "").trim() || "Your heading here";
    if (text !== block.content.text) {
      onUpdate({ ...block, content: { ...block.content, text } });
    }
  }, [block, onUpdate]);

  const style: React.CSSProperties = {
    fontSize: `${s.fontSize}px`,
    color: s.color,
    fontWeight: Number(s.fontWeight),
    lineHeight: s.lineHeight,
    textAlign: s.textAlign as React.CSSProperties["textAlign"],
    textTransform: s.textTransform as React.CSSProperties["textTransform"],
    letterSpacing: `${s.letterSpacing}px`,
    textDecoration: headingDecorationStyle(s),
    fontFamily: s.fontFamily,
    marginTop: `${s.marginTop}px`,
    marginBottom: `${s.marginBottom}px`,
    marginLeft: 0,
    marginRight: 0,
    paddingTop: `${s.paddingTop}px`,
    paddingRight: `${s.paddingRight}px`,
    paddingBottom: `${s.paddingBottom}px`,
    paddingLeft: `${s.paddingLeft}px`,
    backgroundColor: s.backgroundColor === "transparent" ? undefined : s.backgroundColor,
    borderBottom:
      s.borderBottomEnabled === "true"
        ? `${s.borderBottomWidth}px solid ${s.borderBottomColor}`
        : undefined,
  };

  return (
    <div>
      <Tag
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onBlur={commit}
        className="outline-none"
        style={style}
      />
      <MergeVariableAutocomplete editableRef={ref} onInserted={commit} />
    </div>
  );
}

function validateLogoFile(file: File): boolean {
  if (file.size > 2 * 1024 * 1024) {
    alert("Logo must be under 2MB");
    return false;
  }
  if (!LOGO_ACCEPT_TYPES.includes(file.type)) {
    alert("Unsupported format. Use PNG, JPG, or SVG.");
    return false;
  }
  return true;
}

function logoContainerStyle(s: Record<string, string>): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: s.align === "left" ? "flex-start" : s.align === "right" ? "flex-end" : "center",
    paddingTop: `${s.paddingTop}px`,
    paddingBottom: `${s.paddingBottom}px`,
    paddingLeft: `${s.paddingX}px`,
    paddingRight: `${s.paddingX}px`,
    backgroundColor: s.backgroundColor === "transparent" ? undefined : s.backgroundColor,
  };
}

function logoImgStyle(s: Record<string, string>): React.CSSProperties {
  return {
    width: `${s.width}px`,
    maxWidth: "100%",
    height: s.height === "auto" ? "auto" : `${s.height}px`,
    opacity: Number(s.opacity) / 100,
    borderRadius: `${s.borderRadius}px`,
    display: "block",
  };
}

function LogoBlockRenderer({
  block,
  onUpdate,
  onSelect,
}: {
  block: ComponentBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (b: ComponentBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const editor = useNetworkMailEditor();
  const s = block.styles;
  const src = block.content.src;

  const handleFile = async (file: File) => {
    if (!validateLogoFile(file)) return;
    setLoading(true);
    try {
      const url = await resolveEditorImageSrc(file, "logo", editor);
      onUpdate({ ...block, content: { ...block.content, src: url } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  // A merge tag is not a URL — rendering it would draw a broken image in the
  // builder for something that resolves correctly (or collapses) at send time.
  const isMergeTagSrc = !!src && src.includes("{{");

  const img = isMergeTagSrc ? (
    <div
      style={{ ...logoImgStyle(s), display: "flex" }}
      className="items-center justify-center gap-1 rounded-lg border border-dashed border-indigo-400/60 bg-indigo-400/10 text-[10px] font-semibold text-indigo-500 text-center leading-tight px-1"
    >
      <ImageIcon className="h-3 w-3" />
      Logo
    </div>
  ) : src ? (
    <img
      src={src}
      alt={block.content.alt || "Logo"}
      style={logoImgStyle(s)}
      className="block"
      draggable={false}
    />
  ) : null;

  const inner = block.content.link?.trim() ? (
    <a href={block.content.link} onClick={(e) => e.preventDefault()} className="inline-block">
      {img}
    </a>
  ) : (
    img
  );

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/svg+xml"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />

      {src ? (
        <div style={logoContainerStyle(s)}>
          {inner}
        </div>
      ) : (
        <div
          style={logoContainerStyle(s)}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <div
            onClick={(e) => { e.stopPropagation(); onSelect(); fileRef.current?.click(); }}
            className="w-full max-w-[320px] mx-auto h-[140px] border-2 border-dashed border-[#d1d5dc] bg-[#f9fafb] rounded-xl flex flex-col items-center justify-center gap-2 hover:border-brand/40 hover:bg-[#f5f0ff] transition-colors cursor-pointer"
          >
            {loading ? (
              <div className="h-8 w-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <div className="h-11 w-11 rounded-full bg-[#f3f4f6] flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-[#99a1af]" />
                </div>
                <p className="text-[13px] text-[#6b7280] font-semibold">Add Logo</p>
                <p className="text-[12px] text-[#9ca3af]">Click to upload logo</p>
                <p className="text-[10px] text-[#c0c4cc]">PNG, JPG, SVG &middot; Max 2MB</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ImageBlockRenderer({
  block,
  onUpdate,
  onSelect,
}: {
  block: ComponentBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (b: ComponentBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const s = block.styles;

  const editor = useNetworkMailEditor();

  const handleFile = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      alert("Image must be under 2MB");
      return;
    }
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      alert("Unsupported format. Use JPG, PNG, GIF, or WebP.");
      return;
    }
    setLoading(true);
    try {
      const url = await resolveEditorImageSrc(file, "image", editor);
      onUpdate({ ...block, content: { ...block.content, src: url } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const alignStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: s.align === "left" ? "flex-start" : s.align === "right" ? "flex-end" : "center",
    paddingTop: `${s.paddingTop}px`,
    paddingRight: `${s.paddingRight}px`,
    paddingBottom: `${s.paddingBottom}px`,
    paddingLeft: `${s.paddingLeft}px`,
  };

  const imgStyle: React.CSSProperties = {
    width: `${s.width}px`,
    maxWidth: "100%",
    height: s.height === "auto" ? "auto" : `${s.height}px`,
    objectFit: s.objectFit as React.CSSProperties["objectFit"],
    borderRadius: `${s.borderRadius}px`,
    borderWidth: Number(s.borderWidth) > 0 ? `${s.borderWidth}px` : undefined,
    borderColor: s.borderColor,
    borderStyle: s.borderStyle === "none" ? undefined : s.borderStyle,
  };

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      {block.content.src ? (
        <div style={alignStyle}>
          <img src={block.content.src} alt={block.content.alt || "Image"} style={imgStyle} className="block" draggable={false} />
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={(e) => { e.stopPropagation(); onSelect(); fileRef.current?.click(); }}
          className="h-[180px] mx-4 my-3 border-2 border-dashed border-[#d1d5dc] bg-[#f9fafb] rounded-xl flex flex-col items-center justify-center gap-2.5 hover:border-brand/40 hover:bg-[#f5f0ff] transition-colors"
        >
          {loading ? (
            <div className="h-8 w-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <div className="h-12 w-12 rounded-full bg-[#f3f4f6] flex items-center justify-center">
                <Upload className="h-5 w-5 text-[#99a1af]" />
              </div>
              <p className="text-[13px] text-[#6b7280] font-medium">Click to upload or drag image</p>
              <p className="text-[11px] text-[#9ca3af]">JPG, PNG, GIF, WebP &middot; Max 2MB</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ButtonBlockRenderer({
  block,
}: {
  block: ComponentBlock;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const s = block.styles;
  const v = s.variant;

  const btnStyle: React.CSSProperties = {
    fontSize: `${s.fontSize}px`,
    fontWeight: Number(s.fontWeight),
    paddingLeft: `${s.paddingX}px`,
    paddingRight: `${s.paddingX}px`,
    paddingTop: `${s.paddingY}px`,
    paddingBottom: `${s.paddingY}px`,
    borderRadius: `${s.borderRadius}px`,
    width: s.align === "full" ? "100%" : undefined,
    ...(v === "filled"
      ? {
        backgroundColor: hovered ? `${s.backgroundColor}dd` : s.backgroundColor,
        color: s.color,
        border: "none",
      }
      : v === "outlined"
        ? {
          backgroundColor: hovered ? `${s.borderColor}10` : "transparent",
          color: s.borderColor,
          borderWidth: `${s.borderWidth}px`,
          borderStyle: "solid",
          borderColor: s.borderColor,
        }
        : {
          backgroundColor: "transparent",
          color: s.color,
          border: "none",
          textDecoration: hovered ? "underline" : "none",
        }),
    transition: "all 150ms ease",
  };

  const containerAlign =
    s.align === "full" ? "stretch" : s.align === "left" ? "flex-start" : s.align === "right" ? "flex-end" : "center";

  return (
    <div
      style={{
        marginTop: `${s.marginTop}px`,
        marginRight: `${s.marginRight}px`,
        marginBottom: `${s.marginBottom}px`,
        marginLeft: `${s.marginLeft}px`,
      }}
    >
      <div
        className="px-6 py-3 flex"
        style={{ justifyContent: containerAlign, alignItems: "center" }}
      >
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={btnStyle}
          className="inline-block text-center select-none"
        >
          {block.content.text}
        </div>
      </div>
    </div>
  );
}

function DividerBlockRenderer({
  block,
}: {
  block: ComponentBlock;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const s = block.styles;

  const lineAlign =
    s.align === "left" ? "flex-start" : s.align === "right" ? "flex-end" : "center";

  return (
    <div
      style={{
        marginTop: `${s.marginTop}px`,
        marginBottom: `${s.marginBottom}px`,
        paddingLeft: 24,
        paddingRight: 24,
        paddingTop: 8,
        paddingBottom: 8,
      }}
    >
      <div className="flex" style={{ justifyContent: lineAlign }}>
        <div
          style={{
            width: `${s.width}%`,
            borderTopStyle: s.borderStyle as React.CSSProperties["borderTopStyle"],
            borderTopWidth: `${s.borderWidth}px`,
            borderTopColor: s.borderColor,
            opacity: Number(s.opacity) / 100,
          }}
        />
      </div>
    </div>
  );
}

function SpacerBlockRenderer({
  block,
  isSelected,
}: {
  block: ComponentBlock;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const h = Number(block.styles.height);

  return (
    <div className="relative" style={{ height: `${h}px`, minHeight: 12 }}>
      <div className={`absolute inset-x-4 inset-y-0 border border-dashed rounded-lg flex items-center justify-center transition-colors ${isSelected ? "border-brand/40 bg-brand/[0.03]" : "border-[#d1d5dc]/60"
        }`}>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white shadow-sm border border-[#e5e7eb]">
          <MoveVertical className="h-3 w-3 text-[#9ca3af]" />
          <span className="text-[11px] font-medium text-[#6b7280] tabular-nums">{h}px</span>
        </div>
      </div>
    </div>
  );
}

function ColumnCellRenderer({ comp, onUpdate }: { comp: ComponentBlock; onUpdate?: (b: ComponentBlock) => void }) {
  const s = comp.styles;
  switch (comp.type) {
    case "text": {
      // Edited as plain HTML, same as the top-level text block: `{{tokens}}`
      // are text and stay text.
      const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
        const html = e.currentTarget.innerHTML;
        const plain = e.currentTarget.innerText;
        if (html !== comp.content.html && onUpdate) {
          onUpdate({ ...comp, content: { ...comp.content, html, plainText: plain } });
        }
      };
      return (
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={handleBlur}
          className="outline-none min-h-[1.2em] [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-1 [&_ul]:my-2 [&_ol]:my-2"
          style={{
            fontSize: `${s.fontSize}px`, color: s.color, fontWeight: Number(s.fontWeight),
            lineHeight: s.lineHeight, textAlign: s.textAlign as CanvasTextAlign,
            padding: `${s.paddingTop}px ${s.paddingRight}px ${s.paddingBottom}px ${s.paddingLeft}px`,
          }}
          dangerouslySetInnerHTML={{ __html: comp.content.html }}
        />
      );
    }
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(comp.content.level) || 2));
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      return (
        <Tag
          style={{
            fontSize: `${s.fontSize}px`,
            color: s.color,
            fontWeight: Number(s.fontWeight),
            lineHeight: s.lineHeight,
            textAlign: s.textAlign as CanvasTextAlign,
            textTransform: s.textTransform as React.CSSProperties["textTransform"],
            letterSpacing: `${s.letterSpacing}px`,
            textDecoration: headingDecorationStyle(s),
            fontFamily: s.fontFamily,
            margin: `${s.marginTop}px 0 ${s.marginBottom}px 0`,
            padding: `${s.paddingTop}px ${s.paddingRight}px ${s.paddingBottom}px ${s.paddingLeft}px`,
            backgroundColor: s.backgroundColor === "transparent" ? undefined : s.backgroundColor,
            borderBottom:
              s.borderBottomEnabled === "true"
                ? `${s.borderBottomWidth}px solid ${s.borderBottomColor}`
                : undefined,
          }}
        >
          {comp.content.text || "Your heading here"}
        </Tag>
      );
    }
    case "logo":
      return comp.content.src ? (
        <div style={logoContainerStyle(s)}>
          <img src={comp.content.src} alt={comp.content.alt || "Logo"} style={logoImgStyle(s)} className="block" draggable={false} />
        </div>
      ) : (
        <div className="h-14 border border-dashed border-[#d1d5dc] rounded-lg bg-[#f9fafb] flex items-center justify-center gap-2">
          <Building2 className="h-4 w-4 text-[#9ca3af]" />
          <span className="text-[11px] text-[#9ca3af]">Logo</span>
        </div>
      );
    case "image": {
      const alignStyle: React.CSSProperties = {
        display: "flex",
        justifyContent: s.align === "left" ? "flex-start" : s.align === "right" ? "flex-end" : "center",
        paddingTop: s.paddingTop ? `${s.paddingTop}px` : undefined,
        paddingRight: s.paddingRight ? `${s.paddingRight}px` : undefined,
        paddingBottom: s.paddingBottom ? `${s.paddingBottom}px` : undefined,
        paddingLeft: s.paddingLeft ? `${s.paddingLeft}px` : undefined,
      };
      const imgStyle: React.CSSProperties = {
        width: s.width ? `${s.width}px` : "100%",
        maxWidth: "100%",
        height: s.height === "auto" ? "auto" : `${s.height}px`,
        objectFit: s.objectFit as React.CSSProperties["objectFit"],
        borderRadius: `${s.borderRadius || 0}px`,
        borderWidth: Number(s.borderWidth) > 0 ? `${s.borderWidth}px` : undefined,
        borderColor: s.borderColor,
        borderStyle: s.borderStyle === "none" ? undefined : s.borderStyle,
      };
      return comp.content.src ? (
        <div style={alignStyle} className="w-full">
          <img src={comp.content.src} alt={comp.content.alt || ""} className="block" style={imgStyle} draggable={false} />
        </div>
      ) : (
        <div className="h-16 border border-dashed border-[#d1d5dc] rounded bg-[#f9fafb] flex items-center justify-center">
          <ImageIcon className="h-4 w-4 text-[#9ca3af]" />
        </div>
      );
    }
    case "socialIcons": {
      const visible = getVisibleIcons(parseSocialIcons(comp.content.icons || "[]"));
      const sz = Number(s.size) || 28;
      const iconStyle = s.iconStyle || "colored";
      return (
        <div className="flex flex-wrap justify-center py-2" style={{ gap: `${s.spacing || 8}px` }}>
          {visible.map((icon) => {
            const fill = getIconFillColor(icon.platform, iconStyle, s.color || "#333");
            const container =
              iconStyle === "colored"
                ? { width: sz, height: sz, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 6, backgroundColor: BRAND_COLORS[icon.platform] }
                : getIconContainerStyle(s, fill);
            return (
              <div key={icon.id} style={{ ...container, width: sz, height: sz }}>
                <SocialIconGlyph platform={icon.platform} iconStyle={iconStyle} monoColor={s.color || "#333"} customIcon={icon.customIcon} size={sz} />
              </div>
            );
          })}
        </div>
      );
    }
    case "button": {
      const v = s.variant;
      return (
        <div className="text-center py-1">
          <span
            className="inline-block"
            style={{
              fontSize: `${s.fontSize}px`, fontWeight: Number(s.fontWeight),
              padding: `${s.paddingY}px ${s.paddingX}px`, borderRadius: `${s.borderRadius}px`,
              ...(v === "filled" ? { backgroundColor: s.backgroundColor, color: s.color } : v === "outlined" ? { border: `${s.borderWidth}px solid ${s.borderColor}`, color: s.borderColor } : { color: s.color }),
            }}
          >{comp.content.text}</span>
        </div>
      );
    }
    case "divider":
      return (
        <div style={{ padding: "12px 0", margin: `${s.marginTop}px 0 ${s.marginBottom}px`, opacity: Number(s.opacity) / 100 }}>
          <div style={{ width: `${s.width}%`, borderTopWidth: `${s.borderWidth}px`, borderTopStyle: s.borderStyle as React.CSSProperties["borderTopStyle"], borderTopColor: s.borderColor, margin: s.align === "center" ? "0 auto" : s.align === "right" ? "0 0 0 auto" : undefined }} />
        </div>
      );
    case "spacer":
      return <div style={{ height: `${s.height}px` }} />;
    case "footer":
      return <FooterBlockRenderer block={comp} onUpdate={onUpdate || (() => { })} />;
    default:
      return <div className="p-2 text-[11px] text-[#9ca3af]">{comp.type}</div>;
  }
}

function DraggableColumnCell({
  comp,
  columnId,
  columnsBlockId,
  removeFromColumn,
  selectedId,
  setSelectedId,
  onUpdate,
}: {
  comp: ComponentBlock;
  columnId: string;
  columnsBlockId: string;
  removeFromColumn: (colId: string, compId: string) => void;
  selectedId?: string | null;
  setSelectedId?: (id: string | null) => void;
  onUpdate?: (b: ComponentBlock) => void;
}) {
  const [{ isDragging }, drag] = useDrag({
    type: DND_COLUMN_CELL,
    item: { cellId: comp.id, sourceColumnId: columnId, sourceBlockId: columnsBlockId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const isSelected = selectedId === comp.id;

  return (
    <div
      ref={(node) => {
        drag(node);
      }}
      onClick={(e) => {
        if (setSelectedId) {
          e.stopPropagation();
          setSelectedId(comp.id);
        }
      }}
      className={`relative group/cell cursor-grab active:cursor-grabbing rounded transition-all ${isDragging ? "opacity-40" : ""
        } ${isSelected
          ? "ring-2 ring-brand ring-offset-1 z-10"
          : "ring-1 ring-transparent hover:ring-[#d1d5dc]/40"
        }`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          removeFromColumn(columnId, comp.id);
        }}
        className="absolute top-0.5 right-0.5 z-10 h-5 w-5 rounded bg-[#1a1a1a]/80 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity cursor-pointer"
        title="Remove"
      >
        <X className="h-2.5 w-2.5 text-white/70" />
      </button>
      <ColumnCellRenderer comp={comp} onUpdate={onUpdate} />
    </div>
  );
}

function ColumnContainer({
  col,
  columnsBlock,
  isActiveCol,
  onClick,
  removeFromColumn,
  addableTypes,
  addToColumn,
  addMenuCol,
  setAddMenuCol,
  setComponents,
  componentsState,
  selectedId,
  setSelectedId,
  onUpdate,
}: {
  col: ColumnData;
  columnsBlock: ComponentBlock;
  isActiveCol: boolean;
  onClick: (e: React.MouseEvent) => void;
  removeFromColumn: (colId: string, compId: string) => void;
  addableTypes: { type: BlockType; icon: typeof AlignLeft; label: string }[];
  addToColumn: (colId: string, type: BlockType) => void;
  addMenuCol: string | null;
  setAddMenuCol: (colId: string | null) => void;
  setComponents?: React.Dispatch<React.SetStateAction<ComponentBlock[]>>;
  componentsState?: ComponentBlock[];
  selectedId?: string | null;
  setSelectedId?: (id: string | null) => void;
  onUpdate?: (b: ComponentBlock) => void;
}) {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: [DND_PALETTE, DND_CANVAS, DND_COLUMN_CELL],
    drop: (item: any, monitor) => {
      if (monitor.didDrop()) return;

      // 1. Drop from Sidebar (palette component type)
      if (item.componentType) {
        addToColumn(col.id, item.componentType);
        return;
      }

      // 2. Drop from Canvas (existing root level component)
      if (item.id && item.index !== undefined) {
        if (!setComponents || !componentsState) return;
        const sourceBlock = componentsState.find((c) => c.id === item.id);
        if (!sourceBlock || sourceBlock.type === "columns") return; // Avoid nesting columns

        setComponents((prev) => {
          // Remove from root, keep other components
          const next = prev.filter((c) => c.id !== item.id);
          return next.map((c) => {
            if (c.id === columnsBlock.id) {
              const currentCols = parseColumns(c.content.columns);
              const updatedCols = currentCols.map((tc) => {
                if (tc.id === col.id) {
                  return { ...tc, components: [...tc.components, sourceBlock] };
                }
                return tc;
              });
              return { ...c, content: { ...c.content, columns: serializeColumns(updatedCols) } };
            }
            return c;
          });
        });
        return;
      }

      // 3. Drop from another column or same column (existing column cell)
      if (item.cellId && item.sourceColumnId && item.sourceBlockId) {
        if (!setComponents) return;

        setComponents((prev) => {
          let sourceCell: ComponentBlock | null = null;

          // Find and remove cell from its source column
          const cleaned = prev.map((c) => {
            if (c.id === item.sourceBlockId) {
              const currentCols = parseColumns(c.content.columns);
              const updatedCols = currentCols.map((tc) => {
                if (tc.id === item.sourceColumnId) {
                  sourceCell = tc.components.find((x) => x.id === item.cellId) || null;
                  return { ...tc, components: tc.components.filter((x) => x.id !== item.cellId) };
                }
                return tc;
              });
              return { ...c, content: { ...c.content, columns: serializeColumns(updatedCols) } };
            }
            return c;
          });

          if (!sourceCell) return prev;

          // Add cell to target column
          return cleaned.map((c) => {
            if (c.id === columnsBlock.id) {
              const currentCols = parseColumns(c.content.columns);
              const updatedCols = currentCols.map((tc) => {
                if (tc.id === col.id) {
                  const exists = tc.components.some(x => x.id === sourceCell!.id);
                  if (exists) return tc;
                  return { ...tc, components: [...tc.components, sourceCell!] };
                }
                return tc;
              });
              return { ...c, content: { ...c.content, columns: serializeColumns(updatedCols) } };
            }
            return c;
          });
        });
        return;
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  });

  return (
    <div
      ref={(node) => {
        drop(node);
      }}
      onClick={onClick}
      className={`relative flex flex-col rounded-lg border transition-all duration-200 ${addMenuCol === col.id ? "" : "overflow-hidden"
        } ${isActiveCol
          ? "border-brand/60 bg-brand/[0.03]"
          : isOver
            ? "border-brand border-dashed bg-brand/[0.06] shadow-[0_0_15px_rgba(245,197,24,0.18)] scale-[1.01]"
            : "border-dashed border-[#d1d5dc]/70 hover:border-brand/30 bg-[#fafafa]"
        }`}
      style={{ width: `${col.width}%`, minHeight: 80 }}
    >
      {/* Column content */}
      {col.components.length > 0 ? (
        <div className="flex-1">
          {col.components.map((comp) => (
            <DraggableColumnCell
              key={comp.id}
              comp={comp}
              columnId={col.id}
              columnsBlockId={columnsBlock.id}
              removeFromColumn={removeFromColumn}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-6 px-2 text-center select-none">
          <span className="text-[11px] font-medium text-[#9ca3af]">Empty Column</span>
          <span className="text-[9px] text-[#9ca3af]/70 mt-0.5">Drop elements here</span>
        </div>
      )}

      {/* Add button */}
      <div className="relative border-t border-dashed border-[#e5e7eb]/60">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setAddMenuCol(addMenuCol === col.id ? null : col.id);
          }}
          className="w-full h-8 flex items-center justify-center gap-1 text-[10px] font-medium text-[#9ca3af] hover:text-brand hover:bg-brand/[0.04] transition-colors cursor-pointer"
        >
          <Plus className="h-3 w-3" />
          Add Element
        </button>
        {addMenuCol === col.id && (
          <div className="absolute bottom-full left-0 right-0 z-20 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl py-1 mb-1 max-h-80 overflow-y-auto">
            {addableTypes.map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={(e) => {
                  e.stopPropagation();
                  addToColumn(col.id, type);
                }}
                className="w-full flex items-center gap-2 px-3 h-7 text-[11px] text-[#a8a8a8] hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
              >
                <Icon className="h-3 w-3 text-[#7a7a7a]" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ColumnsBlockRenderer({
  block,
  isSelected,
  onSelect,
  onUpdate,
  setComponents,
  componentsState,
  selectedId,
  setSelectedId,
}: {
  block: ComponentBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (b: ComponentBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  setComponents?: React.Dispatch<React.SetStateAction<ComponentBlock[]>>;
  componentsState?: ComponentBlock[];
  selectedId?: string | null;
  setSelectedId?: (id: string | null) => void;
}) {
  const s = block.styles;
  const columns = parseColumns(block.content.columns);
  const [activeColId, setActiveColId] = useState<string | null>(null);
  const [addMenuCol, setAddMenuCol] = useState<string | null>(null);

  const updateColumns = (cols: ColumnData[]) => {
    onUpdate({ ...block, content: { ...block.content, columns: serializeColumns(cols) } });
  };

  const addToColumn = (colId: string, type: BlockType) => {
    const newBlock = createBlock(type);
    const cols = columns.map((c) =>
      c.id === colId ? { ...c, components: [...c.components, newBlock] } : c
    );
    updateColumns(cols);
    setAddMenuCol(null);
  };

  const removeFromColumn = (colId: string, compId: string) => {
    const cols = columns.map((c) =>
      c.id === colId ? { ...c, components: c.components.filter((x) => x.id !== compId) } : c
    );
    updateColumns(cols);
  };

  const addableTypes: { type: BlockType; icon: typeof AlignLeft; label: string }[] = [
    { type: "logo", icon: Stamp, label: "Logo" },
    { type: "heading", icon: Heading, label: "Heading" },
    { type: "text", icon: AlignLeft, label: "Text" },
    { type: "image", icon: ImageIcon, label: "Image" },
    { type: "button", icon: RectangleHorizontal, label: "Button" },
    { type: "divider", icon: Minus, label: "Divider" },
    { type: "spacer", icon: MoveVertical, label: "Spacer" },
    { type: "socialIcons", icon: Share2, label: "Social Icons" },
    { type: "footer", icon: PanelBottom, label: "Footer" },
  ];

  return (
    <div
      onClick={() => setActiveColId(null)}
      style={{
        paddingTop: `${s.paddingTop}px`,
        paddingRight: `${s.paddingRight}px`,
        paddingBottom: `${s.paddingBottom}px`,
        paddingLeft: `${s.paddingLeft}px`,
      }}
    >
      {/* Columns */}
      <div className="flex px-4 py-3 font-sans" style={{ gap: `${s.gap}px` }}>
        {columns.map((col) => {
          const isActiveCol = activeColId === col.id;
          return (
            <ColumnContainer
              key={col.id}
              col={col}
              columnsBlock={block}
              isActiveCol={isActiveCol}
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
                setActiveColId(col.id);
              }}
              removeFromColumn={removeFromColumn}
              addableTypes={addableTypes}
              addToColumn={addToColumn}
              addMenuCol={addMenuCol}
              setAddMenuCol={setAddMenuCol}
              setComponents={setComponents}
              componentsState={componentsState}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              onUpdate={onUpdate}
            />
          );
        })}
      </div>
    </div>
  );
}

function PropertyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-medium text-[#7a7a7a] uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function PropInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 px-3 rounded-lg border border-white/10 bg-white/[0.04] text-[13px] text-white placeholder:text-white/30 outline-none focus:border-brand/50 transition-colors"
    />
  );
}

function PropSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 px-3 rounded-lg border border-white/10 bg-white/[0.04] text-[13px] text-white outline-none focus:border-brand/50 transition-colors appearance-none cursor-pointer"
    >
      {options.map((o) => <option key={o.value} value={o.value} className="bg-[#1a1a1a]">{o.label}</option>)}
    </select>
  );
}

/* ─── Enhanced reusable controls ─── */

const COLOR_PRESETS = [
  "#000000", "#333333", "#666666", "#999999", "#cccccc", "#ffffff",
  "#f5c518", "#e6b800", "#3b82f6", "#06b6d4", "#10b981", "#eab308",
  "#f97316", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6", "#84cc16",
];

const recentColorsStore: string[] = [];
function trackRecentColor(c: string) {
  const hex = c.toLowerCase();
  const idx = recentColorsStore.indexOf(hex);
  if (idx >= 0) recentColorsStore.splice(idx, 1);
  recentColorsStore.unshift(hex);
  if (recentColorsStore.length > 8) recentColorsStore.pop();
}

function ColorPicker({
  label, value, onChange, allowTransparent,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  allowTransparent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHex(value); }, [value]);

  useEffect(() => {
    if (open && popRef.current) {
      setTimeout(() => {
        popRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 80);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => { if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const apply = (c: string) => {
    onChange(c);
    setHex(c);
    if (c !== "transparent") trackRecentColor(c);
  };

  const isTransparent = value === "transparent";

  return (
    <PropertyField label={label}>
      <div className="relative" ref={popRef}>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setOpen(!open)}
            className="h-9 w-9 rounded-lg border border-white/10 cursor-pointer shrink-0 relative overflow-hidden"
            style={{ backgroundColor: isTransparent ? undefined : value }}
          >
            {isTransparent && (
              <div className="absolute inset-0 bg-[repeating-conic-gradient(#444_0%_25%,#222_0%_50%)] bg-[length:8px_8px]" />
            )}
          </button>
          <input
            type="text"
            value={hex}
            onChange={(e) => {
              setHex(e.target.value);
              if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) apply(e.target.value);
            }}
            onBlur={() => { if (/^#[0-9a-fA-F]{6}$/.test(hex)) apply(hex); else setHex(value); }}
            placeholder={allowTransparent ? "transparent" : "#000000"}
            className="flex-1 h-9 px-3 rounded-lg border border-white/10 bg-white/[0.04] text-[13px] text-white placeholder:text-white/30 outline-none focus:border-brand/50 transition-colors font-mono"
          />
          {allowTransparent && !isTransparent && (
            <button onClick={() => apply("transparent")} className="h-9 px-2 rounded-lg border border-white/10 text-[11px] text-[#7a7a7a] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer whitespace-nowrap shrink-0">
              Clear
            </button>
          )}
        </div>

        {open && (
          <div className="absolute top-full left-0 right-0 z-30 mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl p-3 space-y-3">
            <div className="relative h-28 w-full rounded-lg border border-white/10 overflow-hidden bg-[#0d0d0d]">
              <style>{`
                .native-color-picker::-webkit-color-swatch-wrapper {
                  padding: 0 !important;
                }
                .native-color-picker::-webkit-color-swatch {
                  border: none !important;
                  border-radius: 6px !important;
                }
              `}</style>
              {isTransparent && (
                <div className="absolute inset-0 bg-[repeating-conic-gradient(#2a2a2a_0%_25%,#151515_0%_50%)] bg-[length:16px_16px] flex flex-col items-center justify-center pointer-events-none z-10">
                  <div className="bg-[#111111]/90 border border-white/10 rounded-lg px-3 py-1.5 text-center shadow-lg backdrop-blur-sm">
                    <span className="text-[11px] font-semibold text-white/90 tracking-wide uppercase">Transparent</span>
                    <p className="text-[9px] text-[#888888] mt-0.5">Click to choose custom color</p>
                  </div>
                </div>
              )}
              <input
                type="color"
                value={isTransparent ? "#000000" : value}
                onChange={(e) => apply(e.target.value)}
                className="native-color-picker absolute inset-0 w-full h-full bg-transparent cursor-pointer p-0 border-0 outline-none"
                style={{
                  padding: 0,
                  border: 'none',
                  WebkitAppearance: 'none',
                }}
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-[#7a7a7a] uppercase tracking-wider">Presets</span>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => { apply(c); setOpen(false); }}
                    className={`h-6 w-6 rounded-md border cursor-pointer hover:scale-110 transition-transform ${value === c ? "border-brand ring-1 ring-brand" : "border-white/10"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {recentColorsStore.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] text-[#7a7a7a] uppercase tracking-wider">Recent</span>
                <div className="flex gap-1.5">
                  {recentColorsStore.map((c) => (
                    <button
                      key={c}
                      onClick={() => { apply(c); setOpen(false); }}
                      className={`h-6 w-6 rounded-md border cursor-pointer hover:scale-110 transition-transform ${value === c ? "border-brand ring-1 ring-brand" : "border-white/10"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PropertyField>
  );
}

function SliderInput({
  label, min, max, value, onChange, unit = "px", step = 1,
}: {
  label: string;
  min: number;
  max: number;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  step?: number;
}) {
  const numVal = Number(value) || min;

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") { e.preventDefault(); onChange(String(Math.min(max, numVal + step))); }
    if (e.key === "ArrowDown") { e.preventDefault(); onChange(String(Math.max(min, numVal - step))); }
  };

  return (
    <PropertyField label={label}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={numVal}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 accent-brand cursor-pointer"
        />
        <div className="flex items-center">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKey}
            className="w-14 h-8 px-2 rounded-lg border border-white/10 bg-white/[0.04] text-[12px] text-white text-center outline-none focus:border-brand/50 transition-colors tabular-nums"
          />
          {unit && <span className="text-[11px] text-[#7a7a7a] ml-1 w-5">{unit}</span>}
        </div>
      </div>
    </PropertyField>
  );
}

function SearchSelect({
  label, value, onChange, options, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; icon?: typeof AlignLeft }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options,
    [options, query],
  );

  useEffect(() => { setHighlightIdx(0); }, [query]);

  useEffect(() => {
    if (open && listRef.current) {
      setTimeout(() => {
        listRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 80);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) { setOpen(false); setQuery(""); }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && filtered[highlightIdx]) { onChange(filtered[highlightIdx].value); setOpen(false); setQuery(""); }
    else if (e.key === "Escape") { setOpen(false); setQuery(""); }
  };

  return (
    <PropertyField label={label}>
      <div className="relative" ref={listRef}>
        <button
          onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 0); }}
          className="w-full h-9 px-3 rounded-lg border border-white/10 bg-white/[0.04] text-[13px] text-white outline-none hover:border-white/20 transition-colors flex items-center justify-between cursor-pointer"
        >
          <span className="flex items-center gap-2 truncate">
            {selected?.icon && <selected.icon className="h-3.5 w-3.5 text-[#7a7a7a] shrink-0" />}
            {selected?.label ?? placeholder ?? "Select..."}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-[#7a7a7a] transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden">
            {options.length > 6 && (
              <div className="p-2 border-b border-white/[0.06]">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Search..."
                  className="w-full h-7 px-2 rounded bg-white/[0.06] text-[12px] text-white placeholder:text-white/30 outline-none"
                />
              </div>
            )}
            <div className="max-h-48 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-[#7a7a7a]">No results</div>
              ) : (
                filtered.map((o, i) => (
                  <button
                    key={o.value}
                    onClick={() => { onChange(o.value); setOpen(false); setQuery(""); }}
                    onMouseEnter={() => setHighlightIdx(i)}
                    className={`w-full flex items-center gap-2 px-3 h-8 text-[12px] transition-colors cursor-pointer ${i === highlightIdx ? "bg-white/[0.08] text-white" : "text-[#a8a8a8] hover:text-white"
                      }`}
                  >
                    {o.icon && <o.icon className="h-3.5 w-3.5 text-[#7a7a7a] shrink-0" />}
                    <span className="flex-1 text-left truncate">{o.label}</span>
                    {o.value === value && <Check className="h-3 w-3 text-brand shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </PropertyField>
  );
}

function CollapsibleSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">(defaultOpen ? "auto" : 0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!bodyRef.current) return;
    if (open) {
      const h = bodyRef.current.scrollHeight;
      setHeight(h);
      const t = setTimeout(() => setHeight("auto"), 200);
      return () => clearTimeout(t);
    } else {
      const h = bodyRef.current.scrollHeight;
      setHeight(h);
      const t = setTimeout(() => setHeight(0), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <div className="border-b border-white/[0.06] last:border-0 relative focus-within:z-30 transition-[z-index]">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-3 cursor-pointer group">
        <span className="text-[12px] font-semibold text-[#a8a8a8] uppercase tracking-wider group-hover:text-white transition-colors">{title}</span>
        <ChevronRight className={`h-3.5 w-3.5 text-[#7a7a7a] transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
      </button>
      <div
        ref={bodyRef}
        className={`${height === "auto" ? "overflow-visible" : "overflow-hidden"} transition-[height] duration-200 ease-out`}
        style={{ height: height === "auto" ? "auto" : `${height}px` }}
      >
        <div className="pb-4 space-y-3.5">{children}</div>
      </div>
    </div>
  );
}

function SpacingInputs({
  label, top, right, bottom, left, onChange, presets,
}: {
  label: string;
  top: string; right: string; bottom: string; left: string;
  onChange: (t: string, r: string, b: string, l: string) => void;
  presets?: { label: string; value: string }[];
}) {
  const [locked, setLocked] = useState(top === right && right === bottom && bottom === left);

  const handleChange = (side: "top" | "right" | "bottom" | "left", val: string) => {
    if (locked) {
      onChange(val, val, val, val);
    } else {
      const t = side === "top" ? val : top;
      const r = side === "right" ? val : right;
      const b = side === "bottom" ? val : bottom;
      const l = side === "left" ? val : left;
      onChange(t, r, b, l);
    }
  };

  return (
    <PropertyField label={label}>
      <div className="space-y-2.5">
        {presets && (
          <div className="flex gap-2">
            {presets.map((p) => {
              const isActive = top === p.value && right === p.value && bottom === p.value && left === p.value;
              return (
                <button
                  key={p.label}
                  onClick={() => { onChange(p.value, p.value, p.value, p.value); setLocked(true); }}
                  className={`flex-1 h-8 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${isActive ? "bg-brand/15 text-brand border border-brand/30" : "bg-white/[0.04] text-[#7a7a7a] border border-white/8 hover:text-white hover:bg-white/[0.08]"
                    }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLocked(!locked)}
            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0 ${locked ? "bg-brand/15 text-brand" : "text-[#7a7a7a] hover:bg-white/[0.06]"
              }`}
            title={locked ? "Unlock sides" : "Lock all sides"}
          >
            {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          </button>
          <div className="grid grid-cols-4 gap-1.5 flex-1">
            {(["top", "right", "bottom", "left"] as const).map((side) => {
              const val = side === "top" ? top : side === "right" ? right : side === "bottom" ? bottom : left;
              return (
                <div key={side} className="flex flex-col items-center gap-0.5">
                  <input
                    type="number"
                    min={0}
                    value={val}
                    onChange={(e) => handleChange(side, e.target.value)}
                    className="w-full h-8 px-1 rounded-lg border border-white/10 bg-white/[0.04] text-[11px] text-white text-center outline-none focus:border-brand/50 transition-colors tabular-nums"
                  />
                  <span className="text-[9px] text-[#7a7a7a] uppercase">{side[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PropertyField>
  );
}

function ToolbarBtn({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={`h-7 w-7 rounded flex items-center justify-center transition-colors cursor-pointer ${active ? "bg-brand/20 text-brand" : "text-[#7a7a7a] hover:bg-white/[0.08] hover:text-white"
        }`}
    >
      {children}
    </button>
  );
}

const FONT_SIZES = ["12", "14", "16", "18", "20", "24", "28", "32", "36"];
const FONT_WEIGHTS = [
  { value: "400", label: "Normal (400)" },
  { value: "500", label: "Medium (500)" },
  { value: "600", label: "Semibold (600)" },
  { value: "700", label: "Bold (700)" },
];
const PADDING_PRESETS = [
  { label: "None", value: "0" },
  { label: "S", value: "8" },
  { label: "M", value: "16" },
  { label: "L", value: "24" },
];

function TextPropertiesPanel({ block, onUpdate, onDelete }: { block: ComponentBlock; onUpdate: (b: ComponentBlock) => void; onDelete: () => void }) {
  const s = block.styles;
  const setStyle = (key: string, val: string) => onUpdate({ ...block, styles: { ...block.styles, [key]: val } });
  const setPadding = (top: string, right: string, bottom: string, left: string) =>
    onUpdate({ ...block, styles: { ...block.styles, paddingTop: top, paddingRight: right, paddingBottom: bottom, paddingLeft: left } });

  const [, setSelectionTrigger] = useState(0);

  useEffect(() => {
    const handleSelect = () => setSelectionTrigger((t) => t + 1);
    document.addEventListener("selectionchange", handleSelect);
    return () => document.removeEventListener("selectionchange", handleSelect);
  }, []);

  const isCmdActive = (cmd: string) => {
    if (typeof document === "undefined") return false;
    try {
      return document.queryCommandState(cmd);
    } catch {
      return false;
    }
  };

  const execCmd = (cmd: string) => {
    document.execCommand(cmd, false);
    setSelectionTrigger((t) => t + 1);
    if (typeof window !== "undefined") {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node: Node | null = sel.getRangeAt(0).startContainer;
        while (node) {
          if (node instanceof HTMLElement && node.getAttribute("contenteditable") === "true") {
            const html = node.innerHTML;
            const plain = node.innerText;
            onUpdate({
              ...block,
              content: {
                ...block.content,
                html,
                plainText: plain,
              },
            });
            break;
          }
          node = node.parentNode;
        }
      }
    }
  };

  /**
   * The token lands at the caret when the founder still has one in the canvas —
   * `ToolbarBtn`/`VariablePickerButton` suppress mousedown precisely so the
   * selection survives the click. With no caret (they were typing in the
   * textarea below) the token is appended rather than the click dropped.
   */
  const insertVariable = (key: string) => {
    const editable = editableFromSelection();
    if (editable && insertTokenAtCaret(editable, key)) {
      onUpdate({
        ...block,
        content: {
          ...block.content,
          html: editable.innerHTML,
          plainText: editable.innerText,
        },
      });
      return;
    }
    const token = mergeToken(key);
    onUpdate({
      ...block,
      content: {
        ...block.content,
        html: `${block.content.html || ""}${token}`,
        plainText: `${block.content.plainText || ""}${token}`,
      },
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-1">
        <h4 className="text-[13px] font-semibold text-white">Text Block</h4>
        <button onClick={onDelete} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors cursor-pointer group">
          <Trash2 className="h-3.5 w-3.5 text-[#7a7a7a] group-hover:text-red-400 transition-colors" />
        </button>
      </div>

      {/* Content Section */}
      <CollapsibleSection title="Content">
        <div className="flex flex-wrap gap-0.5 p-1 rounded-lg bg-white/[0.03] border border-white/[0.06] mb-3">
          <ToolbarBtn title="Bold" active={isCmdActive("bold")} onClick={() => execCmd("bold")}>
            <Bold className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Italic" active={isCmdActive("italic")} onClick={() => execCmd("italic")}>
            <Italic className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Underline" active={isCmdActive("underline")} onClick={() => execCmd("underline")}>
            <Underline className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Align Left" active={s.textAlign === "left" || !s.textAlign} onClick={() => setStyle("textAlign", "left")}>
            <AlignLeft className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Align Center" active={s.textAlign === "center"} onClick={() => setStyle("textAlign", "center")}>
            <AlignCenter className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Align Right" active={s.textAlign === "right"} onClick={() => setStyle("textAlign", "right")}>
            <AlignRight className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <div className="w-px h-5 bg-white/10 self-center mx-1" />
          <ToolbarBtn title="Bulleted List" onClick={() => execCmd("insertUnorderedList")}>
            <List className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Numbered List" onClick={() => execCmd("insertOrderedList")}>
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarBtn>
        </div>
        <PropertyField label="Text Content">
          <textarea
            value={block.content.plainText || (block.content.html ? block.content.html.replace(/<[^>]*>/g, "") : "")}
            onChange={(e) => {
              const val = e.target.value;
              onUpdate({
                ...block,
                content: {
                  ...block.content,
                  plainText: val,
                  html: val.replace(/\n/g, "<br/>"),
                },
              });
            }}
            rows={5}
            className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-[13px] text-white placeholder:text-white/30 outline-none focus:border-brand/50 resize-y overflow-y-auto custom-scrollbar leading-relaxed"
            placeholder="Type your text content here..."
          />
        </PropertyField>
        <DynamicFieldsCard
          onInsert={insertVariable}
          hint={
            <>
              <span className="font-semibold text-[#a8a8a8]">
                Personalize your email
              </span>
              : insert dynamic fields or type{" "}
              <span className="text-[#a8a8a8]">@</span> in the canvas to
              automatically fill in the customer&apos;s name, order ID, or total
              when this email is sent.
            </>
          }
        />
      </CollapsibleSection>

      {/* Style Section */}
      <CollapsibleSection title="Style">
        <SearchSelect label="Font Size" value={s.fontSize} onChange={(v) => setStyle("fontSize", v)} options={FONT_SIZES.map((sz) => ({ value: sz, label: `${sz}px` }))} />
        <ColorPicker label="Text Color" value={s.color} onChange={(v) => setStyle("color", v)} />
        <ColorPicker label="Background Color" value={s.backgroundColor} onChange={(v) => setStyle("backgroundColor", v)} allowTransparent />
        <SearchSelect label="Font Weight" value={s.fontWeight} onChange={(v) => setStyle("fontWeight", v)} options={FONT_WEIGHTS} />
        <SliderInput label="Line Height" min={1} max={2} step={0.1} value={s.lineHeight} onChange={(v) => setStyle("lineHeight", v)} unit="" />
      </CollapsibleSection>

      {/* Spacing Section */}
      <CollapsibleSection title="Spacing">
        <SpacingInputs
          label="Padding"
          top={s.paddingTop} right={s.paddingRight} bottom={s.paddingBottom} left={s.paddingLeft}
          onChange={setPadding}
          presets={PADDING_PRESETS}
        />
      </CollapsibleSection>
    </div>
  );
}

const HEADING_LEVEL_OPTIONS = [
  { value: "1", label: "H1" },
  { value: "2", label: "H2" },
  { value: "3", label: "H3" },
  { value: "4", label: "H4" },
  { value: "5", label: "H5" },
  { value: "6", label: "H6" },
];

const HEADING_FONT_WEIGHTS = [
  { value: "300", label: "Light (300)" },
  { value: "400", label: "Normal (400)" },
  { value: "500", label: "Medium (500)" },
  { value: "600", label: "Semibold (600)" },
  { value: "700", label: "Bold (700)" },
  { value: "800", label: "Extra Bold (800)" },
];

const TEXT_TRANSFORM_OPTIONS = [
  { value: "none", label: "None" },
  { value: "uppercase", label: "Uppercase" },
  { value: "lowercase", label: "Lowercase" },
  { value: "capitalize", label: "Capitalize" },
];

const FONT_FAMILY_OPTIONS = [
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "Helvetica, Arial, sans-serif", label: "Helvetica" },
  { value: "Georgia, Times New Roman, serif", label: "Georgia" },
  { value: "Times New Roman, Times, serif", label: "Times New Roman" },
  { value: "Courier New, Courier, monospace", label: "Courier" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { value: "Tahoma, Geneva, sans-serif", label: "Tahoma" },
  { value: "Trebuchet MS, Helvetica, sans-serif", label: "Trebuchet MS" },
  { value: "Palatino Linotype, Book Antiqua, Palatino, serif", label: "Palatino" },
  { value: "Lucida Sans Unicode, Lucida Grande, sans-serif", label: "Lucida Sans" },
  { value: "Impact, Charcoal, sans-serif", label: "Impact" },
  { value: "Comic Sans MS, cursive", label: "Comic Sans MS" },
];

function HeadingPropertiesPanel({ block, onUpdate, onDelete }: { block: ComponentBlock; onUpdate: (b: ComponentBlock) => void; onDelete: () => void }) {
  const s = block.styles;
  const setContent = (key: string, val: string) => onUpdate({ ...block, content: { ...block.content, [key]: val } });
  const setStyle = (key: string, val: string) => onUpdate({ ...block, styles: { ...block.styles, [key]: val } });
  const setPadding = (top: string, right: string, bottom: string, left: string) =>
    onUpdate({ ...block, styles: { ...block.styles, paddingTop: top, paddingRight: right, paddingBottom: bottom, paddingLeft: left } });

  const setLevel = (level: string) => {
    const defaultSize = HEADING_LEVEL_DEFAULT_SIZE[level] ?? s.fontSize;
    onUpdate({
      ...block,
      content: { ...block.content, level },
      styles: { ...block.styles, fontSize: defaultSize },
    });
  };

  const toggleDecoration = (key: "decorationUnderline" | "decorationLineThrough") => {
    setStyle(key, s[key] === "true" ? "false" : "true");
  };

  /** Same caret-first behaviour as the text block; headings store plain text. */
  const insertVariable = (key: string) => {
    const editable = editableFromSelection();
    if (editable && insertTokenAtCaret(editable, key)) {
      setContent("text", editable.innerText);
      return;
    }
    setContent("text", `${block.content.text || ""}${mergeToken(key)}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-1">
        <h4 className="text-[13px] font-semibold text-white">Heading Block</h4>
        <button onClick={onDelete} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors cursor-pointer group">
          <Trash2 className="h-3.5 w-3.5 text-[#7a7a7a] group-hover:text-red-400 transition-colors" />
        </button>
      </div>

      <CollapsibleSection title="Content">
        <PropertyField label="Heading text">
          <textarea
            value={block.content.text}
            onChange={(e) => setContent("text", e.target.value)}
            rows={3}
            placeholder="Your heading here"
            className="w-full min-h-[88px] px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-[15px] text-white placeholder:text-white/30 outline-none focus:border-brand/50 transition-colors resize-y overflow-y-auto custom-scrollbar"
          />
        </PropertyField>
        <DynamicFieldsCard
          onInsert={insertVariable}
          hint={
            <>
              <span className="font-semibold text-[#a8a8a8]">
                Greet each recipient by name
              </span>
              : insert dynamic fields or type{" "}
              <span className="text-[#a8a8a8]">@</span> in the canvas and this
              heading fills in with the customer&apos;s own details when the
              email is sent.
            </>
          }
        />
        <SearchSelect label="Heading level" value={block.content.level || "2"} onChange={setLevel} options={HEADING_LEVEL_OPTIONS} />
      </CollapsibleSection>

      <CollapsibleSection title="Style">
        <SliderInput label="Font size" min={14} max={72} value={s.fontSize} onChange={(v) => setStyle("fontSize", v)} />
        <ColorPicker label="Text color" value={s.color} onChange={(v) => setStyle("color", v)} />
        <SearchSelect label="Font weight" value={s.fontWeight} onChange={(v) => setStyle("fontWeight", v)} options={HEADING_FONT_WEIGHTS} />
        <SearchSelect label="Text transform" value={s.textTransform} onChange={(v) => setStyle("textTransform", v)} options={TEXT_TRANSFORM_OPTIONS} />
        <SliderInput label="Letter spacing" min={-2} max={5} step={0.5} value={s.letterSpacing} onChange={(v) => setStyle("letterSpacing", v)} />
        <PropertyField label="Text decoration">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div
                onClick={() => toggleDecoration("decorationUnderline")}
                className={`h-[18px] w-[18px] rounded border flex items-center justify-center transition-all cursor-pointer ${s.decorationUnderline === "true" ? "bg-brand border-brand" : "border-white/20 bg-white/[0.04] hover:border-white/40"
                  }`}
              >
                {s.decorationUnderline === "true" && <Check className="h-3 w-3 text-black" />}
              </div>
              <span className="text-[12px] text-[#a8a8a8] group-hover:text-white transition-colors">Underline</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div
                onClick={() => toggleDecoration("decorationLineThrough")}
                className={`h-[18px] w-[18px] rounded border flex items-center justify-center transition-all cursor-pointer ${s.decorationLineThrough === "true" ? "bg-brand border-brand" : "border-white/20 bg-white/[0.04] hover:border-white/40"
                  }`}
              >
                {s.decorationLineThrough === "true" && <Check className="h-3 w-3 text-black" />}
              </div>
              <span className="text-[12px] text-[#a8a8a8] group-hover:text-white transition-colors">Line-through</span>
            </label>
          </div>
        </PropertyField>
      </CollapsibleSection>

      <CollapsibleSection title="Alignment">
        <div className="grid grid-cols-4 gap-1.5">
          {([
            { value: "left", Icon: AlignLeft },
            { value: "center", Icon: AlignCenter },
            { value: "right", Icon: AlignRight },
            { value: "justify", Icon: AlignJustify },
          ] as const).map(({ value, Icon }) => (
            <button
              key={value}
              onClick={() => setStyle("textAlign", value)}
              className={`h-9 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[10px] transition-all cursor-pointer ${s.textAlign === value ? "bg-brand/15 text-brand border border-brand/30" : "bg-white/[0.04] text-[#7a7a7a] border border-white/8 hover:text-white hover:bg-white/[0.08]"
                }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] text-[#7a7a7a] mt-1.5">
          <span>Left</span>
          <span>Center</span>
          <span>Right</span>
          <span>Justify</span>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Spacing">
        <SpacingInputs
          label="Padding"
          top={s.paddingTop} right={s.paddingRight} bottom={s.paddingBottom} left={s.paddingLeft}
          onChange={setPadding}
          presets={PADDING_PRESETS}
        />
        <SliderInput label="Margin top" min={0} max={80} value={s.marginTop} onChange={(v) => setStyle("marginTop", v)} />
        <SliderInput label="Margin bottom" min={0} max={80} value={s.marginBottom} onChange={(v) => setStyle("marginBottom", v)} />
      </CollapsibleSection>

      <CollapsibleSection title="Advanced">
        <SliderInput label="Line height" min={1} max={2.5} step={0.1} value={s.lineHeight} onChange={(v) => setStyle("lineHeight", v)} unit="" />
        <ColorPicker label="Background color" value={s.backgroundColor} onChange={(v) => setStyle("backgroundColor", v)} allowTransparent />
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <div
            onClick={() => setStyle("borderBottomEnabled", s.borderBottomEnabled === "true" ? "false" : "true")}
            className={`h-[18px] w-[18px] rounded border flex items-center justify-center transition-all cursor-pointer shrink-0 ${s.borderBottomEnabled === "true" ? "bg-brand border-brand" : "border-white/20 bg-white/[0.04] hover:border-white/40"
              }`}
          >
            {s.borderBottomEnabled === "true" && <Check className="h-3 w-3 text-black" />}
          </div>
          <span className="text-[12px] text-[#a8a8a8] group-hover:text-white transition-colors">Border bottom</span>
        </label>
        {s.borderBottomEnabled === "true" && (
          <>
            <ColorPicker label="Border color" value={s.borderBottomColor} onChange={(v) => setStyle("borderBottomColor", v)} />
            <SliderInput label="Border width" min={1} max={8} value={s.borderBottomWidth} onChange={(v) => setStyle("borderBottomWidth", v)} />
          </>
        )}
        <SearchSelect label="Font family" value={s.fontFamily} onChange={(v) => setStyle("fontFamily", v)} options={FONT_FAMILY_OPTIONS} />
      </CollapsibleSection>
    </div>
  );
}

function LogoPropertiesPanel({ block, onUpdate, onDelete }: { block: ComponentBlock; onUpdate: (b: ComponentBlock) => void; onDelete: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const darkFileRef = useRef<HTMLInputElement>(null);
  const editor = useNetworkMailEditor();
  const s = block.styles;
  const [aspectLock, setAspectLock] = useState(s.aspectLock !== "false");

  const setContent = (key: string, val: string) => onUpdate({ ...block, content: { ...block.content, [key]: val } });
  const setStyle = (key: string, val: string) => onUpdate({ ...block, styles: { ...block.styles, [key]: val } });

  const readFile = async (file: File, key: "src" | "darkModeSrc") => {
    if (!validateLogoFile(file)) return;
    try {
      const url = await resolveEditorImageSrc(file, "logo", editor);
      setContent(key, url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const setWidthPreset = (preset: string) => {
    const width = preset === "custom" ? s.width : (LOGO_WIDTH_PRESETS[preset] ?? s.width);
    onUpdate({
      ...block,
      styles: { ...block.styles, widthPreset: preset, width },
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-1">
        <h4 className="text-[13px] font-semibold text-white">Logo Block</h4>
        <button onClick={onDelete} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors cursor-pointer group">
          <Trash2 className="h-3.5 w-3.5 text-[#7a7a7a] group-hover:text-red-400 transition-colors" />
        </button>
      </div>

      <CollapsibleSection title="Content">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/svg+xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f, "src"); e.target.value = ""; }} />
        <button onClick={() => fileRef.current?.click()} className="w-full h-9 rounded-lg bg-brand/10 text-brand text-[13px] font-medium hover:bg-brand/20 transition-colors cursor-pointer flex items-center justify-center gap-2">
          <Upload className="h-3.5 w-3.5" />
          Upload Logo
        </button>

        <PropertyField label="Or paste logo URL">
          <PropInput value={block.content.src.startsWith("data:") ? "" : block.content.src} onChange={(v) => setContent("src", v)} placeholder="https://example.com/logo.png" />
        </PropertyField>

        {block.content.src && (
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-[#7a7a7a] uppercase tracking-wider">Preview</label>
            <div className="h-20 rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden flex items-center justify-center p-2">
              <img src={block.content.src} alt="Logo preview" className="max-h-full max-w-full object-contain" style={{ opacity: Number(s.opacity) / 100 }} draggable={false} />
            </div>
          </div>
        )}

        <PropertyField label="Alt text">
          <PropInput value={block.content.alt} onChange={(v) => setContent("alt", v)} placeholder="Company name" />
        </PropertyField>

        <PropertyField label="Link URL (optional)">
          <div className="relative">
            <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#7a7a7a]" />
            <input
              type="text"
              value={block.content.link || ""}
              onChange={(e) => setContent("link", e.target.value)}
              placeholder="https://yourcompany.com"
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-white/10 bg-white/[0.04] text-[13px] text-white placeholder:text-white/30 outline-none focus:border-brand/50 transition-colors"
            />
          </div>
        </PropertyField>
      </CollapsibleSection>

      <CollapsibleSection title="Size">
        <PropertyField label="Width">
          <div className="grid grid-cols-4 gap-1.5">
            {([
              { key: "small", label: "S", sub: "100px" },
              { key: "medium", label: "M", sub: "150px" },
              { key: "large", label: "L", sub: "200px" },
              { key: "custom", label: "Custom", sub: "" },
            ] as const).map(({ key, label, sub }) => (
              <button
                key={key}
                onClick={() => setWidthPreset(key)}
                className={`h-9 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${(s.widthPreset || "medium") === key ? "bg-brand/15 text-brand border border-brand/30" : "bg-white/[0.04] text-[#7a7a7a] border border-white/8 hover:text-white hover:bg-white/[0.08]"
                  }`}
              >
                <span className="text-[11px] font-medium">{label}</span>
                {sub && <span className="text-[9px] opacity-70">{sub}</span>}
              </button>
            ))}
          </div>
        </PropertyField>
        {(s.widthPreset === "custom" || !LOGO_WIDTH_PRESETS[s.widthPreset || ""]) && (
          <SliderInput label="Custom width" min={50} max={400} value={s.width} onChange={(v) => setStyle("width", v)} />
        )}

        <SearchSelect
          label="Height"
          value={s.height === "auto" ? "auto" : "custom"}
          onChange={(v) => setStyle("height", v === "auto" ? "auto" : "60")}
          options={[{ value: "auto", label: "Auto (aspect ratio)" }, { value: "custom", label: "Custom" }]}
        />
        {s.height !== "auto" && (
          <SliderInput label="Height (px)" min={20} max={200} value={s.height} onChange={(v) => setStyle("height", v)} />
        )}

        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#7a7a7a]">Lock aspect ratio</span>
          <button
            onClick={() => { const next = !aspectLock; setAspectLock(next); setStyle("aspectLock", next ? "true" : "false"); }}
            className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${aspectLock ? "bg-brand/15 text-brand" : "text-[#7a7a7a] hover:bg-white/[0.06]"}`}
          >
            {aspectLock ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Alignment">
        <div className="grid grid-cols-3 gap-1.5">
          {([
            { value: "left", Icon: AlignLeft },
            { value: "center", Icon: AlignCenter },
            { value: "right", Icon: AlignRight },
          ] as const).map(({ value, Icon }) => (
            <button
              key={value}
              onClick={() => setStyle("align", value)}
              className={`h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${s.align === value ? "bg-brand/15 text-brand border border-brand/30" : "bg-white/[0.04] text-[#7a7a7a] border border-white/8 hover:text-white hover:bg-white/[0.08]"
                }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] text-[#7a7a7a] mt-1.5">
          <span>Left</span>
          <span>Center</span>
          <span>Right</span>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Style">
        <SliderInput label="Opacity" min={0} max={100} value={s.opacity} onChange={(v) => setStyle("opacity", v)} unit="%" />
        <ColorPicker label="Background color" value={s.backgroundColor} onChange={(v) => setStyle("backgroundColor", v)} allowTransparent />
        <SliderInput label="Border radius" min={0} max={50} value={s.borderRadius} onChange={(v) => setStyle("borderRadius", v)} />
      </CollapsibleSection>

      <CollapsibleSection title="Spacing">
        <SliderInput label="Padding top" min={0} max={80} value={s.paddingTop} onChange={(v) => setStyle("paddingTop", v)} />
        <SliderInput label="Padding bottom" min={0} max={80} value={s.paddingBottom} onChange={(v) => setStyle("paddingBottom", v)} />
        <SliderInput label="Padding left / right" min={0} max={40} value={s.paddingX} onChange={(v) => setStyle("paddingX", v)} />
      </CollapsibleSection>

      <CollapsibleSection title="Advanced" defaultOpen={false}>
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <div
            onClick={() => setStyle("retinaOptimized", s.retinaOptimized === "true" ? "false" : "true")}
            className={`h-[18px] w-[18px] rounded border flex items-center justify-center transition-all cursor-pointer shrink-0 ${s.retinaOptimized === "true" ? "bg-brand border-brand" : "border-white/20 bg-white/[0.04] hover:border-white/40"
              }`}
          >
            {s.retinaOptimized === "true" && <Check className="h-3 w-3 text-black" />}
          </div>
          <span className="text-[12px] text-[#a8a8a8] group-hover:text-white transition-colors">Optimize for high-DPI screens (2x)</span>
        </label>

        <input ref={darkFileRef} type="file" accept="image/jpeg,image/png,image/svg+xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f, "darkModeSrc"); e.target.value = ""; }} />
        <PropertyField label="Dark mode logo (optional)">
          <button onClick={() => darkFileRef.current?.click()} className="w-full h-8 rounded-lg bg-white/[0.04] text-[12px] text-[#a8a8a8] hover:text-white hover:bg-white/[0.08] border border-white/8 transition-colors cursor-pointer">
            {block.content.darkModeSrc ? "Replace dark logo" : "Upload dark logo"}
          </button>
          {block.content.darkModeSrc && (
            <div className="mt-2 h-14 rounded-lg border border-white/10 bg-[#0a0a0a] flex items-center justify-center p-2">
              <img src={block.content.darkModeSrc} alt="Dark logo" className="max-h-full max-w-full object-contain" draggable={false} />
            </div>
          )}
        </PropertyField>

        <PropertyField label="Fallback text">
          <PropInput value={block.content.fallbackText || ""} onChange={(v) => setContent("fallbackText", v)} placeholder="Shown if image fails to load" />
        </PropertyField>
      </CollapsibleSection>
    </div>
  );
}

const OBJECT_FIT_OPTIONS = [
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
  { value: "fill", label: "Fill" },
];

const BORDER_STYLE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
];

function ImagePropertiesPanel({ block, onUpdate, onDelete }: { block: ComponentBlock; onUpdate: (b: ComponentBlock) => void; onDelete: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const editor = useNetworkMailEditor();
  const s = block.styles;
  const [aspectLock, setAspectLock] = useState(true);
  const setContent = (key: string, val: string) => onUpdate({ ...block, content: { ...block.content, [key]: val } });
  const setStyle = (key: string, val: string) => onUpdate({ ...block, styles: { ...block.styles, [key]: val } });
  const setPadding = (top: string, right: string, bottom: string, left: string) =>
    onUpdate({ ...block, styles: { ...block.styles, paddingTop: top, paddingRight: right, paddingBottom: bottom, paddingLeft: left } });

  const handleFile = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { alert("Image must be under 2MB"); return; }
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) { alert("Unsupported format."); return; }
    try {
      const url = await resolveEditorImageSrc(file, "image", editor);
      setContent("src", url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-1">
        <h4 className="text-[13px] font-semibold text-white">Image Block</h4>
        <button onClick={onDelete} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors cursor-pointer group">
          <Trash2 className="h-3.5 w-3.5 text-[#7a7a7a] group-hover:text-red-400 transition-colors" />
        </button>
      </div>

      {/* Content */}
      <CollapsibleSection title="Content">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        <button onClick={() => fileRef.current?.click()} className="w-full h-9 rounded-lg bg-brand/10 text-brand text-[13px] font-medium hover:bg-brand/20 transition-colors cursor-pointer flex items-center justify-center gap-2">
          <Upload className="h-3.5 w-3.5" />
          Choose image
        </button>

        <PropertyField label="Or paste image URL">
          <PropInput value={block.content.src.startsWith("data:") ? "" : block.content.src} onChange={(v) => setContent("src", v)} placeholder="https://example.com/image.jpg" />
        </PropertyField>

        {block.content.src && (
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-[#7a7a7a] uppercase tracking-wider">Preview</label>
            <div className="h-20 rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden flex items-center justify-center">
              <img src={block.content.src} alt="Preview" className="max-h-full max-w-full object-contain" draggable={false} />
            </div>
          </div>
        )}

        <PropertyField label="Alt text">
          <PropInput value={block.content.alt} onChange={(v) => setContent("alt", v)} placeholder="Describe image for accessibility" />
        </PropertyField>

        <PropertyField label="Link URL (optional)">
          <div className="relative">
            <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#7a7a7a]" />
            <input
              type="text"
              value={block.content.link || ""}
              onChange={(e) => setContent("link", e.target.value)}
              placeholder="Make image clickable"
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-white/10 bg-white/[0.04] text-[13px] text-white placeholder:text-white/30 outline-none focus:border-brand/50 transition-colors"
            />
          </div>
        </PropertyField>
      </CollapsibleSection>

      {/* Size */}
      <CollapsibleSection title="Size">
        <SliderInput label="Width" min={50} max={600} value={s.width} onChange={(v) => setStyle("width", v)} />

        <SearchSelect label="Height" value={s.height === "auto" ? "auto" : "custom"} onChange={(v) => setStyle("height", v === "auto" ? "auto" : "300")} options={[{ value: "auto", label: "Auto" }, { value: "custom", label: "Custom" }]} />

        {s.height !== "auto" && (
          <SliderInput label="Height (px)" min={50} max={800} value={s.height} onChange={(v) => setStyle("height", v)} />
        )}

        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#7a7a7a]">Lock aspect ratio</span>
          <button onClick={() => setAspectLock(!aspectLock)} className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${aspectLock ? "bg-brand/15 text-brand" : "text-[#7a7a7a] hover:bg-white/[0.06]"}`}>
            {aspectLock ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </button>
        </div>

        <SearchSelect label="Fit mode" value={s.objectFit} onChange={(v) => setStyle("objectFit", v)} options={OBJECT_FIT_OPTIONS} />
      </CollapsibleSection>

      {/* Alignment */}
      <CollapsibleSection title="Alignment">
        <div className="flex gap-2">
          {(["left", "center", "right"] as const).map((a) => {
            const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
            return (
              <button
                key={a}
                onClick={() => setStyle("align", a)}
                className={`flex-1 h-9 rounded-lg flex items-center justify-center gap-1.5 text-[12px] font-medium capitalize transition-all cursor-pointer ${s.align === a ? "bg-brand/15 text-brand border border-brand/30" : "bg-white/[0.04] text-[#7a7a7a] border border-white/8 hover:text-white hover:bg-white/[0.08]"
                  }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {a}
              </button>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* Style (Border) */}
      <CollapsibleSection title="Style">
        <SliderInput label="Border Radius" min={0} max={50} value={s.borderRadius} onChange={(v) => setStyle("borderRadius", v)} />
        <SearchSelect label="Border Style" value={s.borderStyle} onChange={(v) => setStyle("borderStyle", v)} options={BORDER_STYLE_OPTIONS} />
        {s.borderStyle !== "none" && (
          <>
            <SliderInput label="Border Width" min={0} max={10} value={s.borderWidth} onChange={(v) => setStyle("borderWidth", v)} />
            <ColorPicker label="Border Color" value={s.borderColor} onChange={(v) => setStyle("borderColor", v)} />
          </>
        )}
      </CollapsibleSection>

      {/* Spacing */}
      <CollapsibleSection title="Spacing">
        <SpacingInputs
          label="Padding"
          top={s.paddingTop} right={s.paddingRight} bottom={s.paddingBottom} left={s.paddingLeft}
          onChange={setPadding}
          presets={PADDING_PRESETS}
        />
      </CollapsibleSection>
    </div>
  );
}

const BTN_FONT_SIZES = [
  { value: "12", label: "12px" },
  { value: "14", label: "14px" },
  { value: "16", label: "16px" },
  { value: "18", label: "18px" },
  { value: "20", label: "20px" },
];

const MARGIN_PRESETS = [
  { label: "None", value: "0" },
  { label: "S", value: "8" },
  { label: "M", value: "16" },
  { label: "L", value: "24" },
];

/**
 * Where a button can point without the founder writing a URL. Each entry maps
 * to the merge tag the backend resolves at send time, so "Open Organization HQ"
 * lands on that member's own workspace rather than a link typed once by hand.
 */
const BUTTON_ACTION_OPTIONS = [
  ...pickableLinkVariables().map((v) => ({
    value: v.key,
    // The token is spelled out so a founder who knows the tags can match the
    // plain-language wording to what actually ships in the href.
    label: `${v.actionLabel || `Open ${v.label.replace(/ Link$/, "")}`} (${mergeToken(v.key)})`,
    icon: v.icon,
  })),
  { value: "custom", label: "Custom Web URL", icon: Link },
];

const BUTTON_ACTION_KEYS = new Set(
  pickableLinkVariables().map((v) => v.key),
);

function ButtonPropertiesPanel({ block, onUpdate, onDelete }: { block: ComponentBlock; onUpdate: (b: ComponentBlock) => void; onDelete: () => void }) {
  const s = block.styles;
  const setContent = (key: string, val: string) => onUpdate({ ...block, content: { ...block.content, [key]: val } });

  // Derived from the URL rather than stored alongside it, so a template edited
  // before this selector existed still shows the right action.
  const action = useMemo(() => {
    const match = /^\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}$/.exec(
      (block.content.url || "").trim(),
    );
    return match && BUTTON_ACTION_KEYS.has(match[1]) ? match[1] : "custom";
  }, [block.content.url]);

  const setAction = (next: string) => {
    if (next === "custom") {
      // Clearing the tag only when switching away from one keeps a hand-typed
      // URL intact if the founder re-picks "Custom URL".
      if (action !== "custom") setContent("url", "");
      return;
    }
    setContent("url", mergeToken(next));
  };

  /**
   * The button label is edited here rather than in the canvas, so there is no
   * caret to honour — the token goes on the end of whatever is written.
   */
  const insertIntoText = (key: string) =>
    setContent("text", `${block.content.text || ""}${mergeToken(key)}`);
  const setStyle = (key: string, val: string) => onUpdate({ ...block, styles: { ...block.styles, [key]: val } });
  const setMargin = (top: string, right: string, bottom: string, left: string) =>
    onUpdate({ ...block, styles: { ...block.styles, marginTop: top, marginRight: right, marginBottom: bottom, marginLeft: left } });

  return (
    <div>
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-1">
        <h4 className="text-[13px] font-semibold text-white">Button Block</h4>
        <button onClick={onDelete} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors cursor-pointer group">
          <Trash2 className="h-3.5 w-3.5 text-[#7a7a7a] group-hover:text-red-400 transition-colors" />
        </button>
      </div>

      {/* Content */}
      <CollapsibleSection title="Content">
        <PropertyField label="Button text">
          <PropInput value={block.content.text} onChange={(v) => setContent("text", v)} placeholder="Enter button text" />
        </PropertyField>
        <DynamicFieldsCard
          label="Insert Dynamic Field"
          onInsert={insertIntoText}
          hint={
            <>
              <span className="font-semibold text-[#a8a8a8]">
                Personalize this button
              </span>
              : add a dynamic field to the label (&quot;Track order{" "}
              {mergeToken("order_number")}&quot;), and pick a destination below
              so the link points at each recipient&apos;s own page.
            </>
          }
        />
        <SearchSelect
          label="Link to Dynamic Destination"
          value={action}
          onChange={setAction}
          options={BUTTON_ACTION_OPTIONS}
        />
        {action === "custom" ? (
          <PropertyField label="Link URL">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1 min-w-0">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#7a7a7a]" />
                <input
                  type="text"
                  value={block.content.url}
                  onChange={(e) => setContent("url", e.target.value)}
                  placeholder="Where should this button go?"
                  className="w-full h-9 pl-8 pr-3 rounded-lg border border-white/10 bg-white/[0.04] text-[13px] text-white placeholder:text-white/30 outline-none focus:border-brand/50 transition-colors"
                />
              </div>
              {/* Drops a link token straight into the field, for founders who
                  reached the URL box before the action selector above. */}
              <VariablePickerButton
                variant="icon"
                title="Use a dynamic link"
                variables={pickableLinkVariables()}
                onInsert={(key) => setContent("url", mergeToken(key))}
              />
            </div>
          </PropertyField>
        ) : (
          <p className="text-[11px] text-[#7a7a7a] -mt-1 mb-3 leading-relaxed">
            The link is built for each recipient when the email sends — no URL to
            keep up to date.
          </p>
        )}
        <div
          onClick={() => setContent("openInNewTab", block.content.openInNewTab === "true" ? "false" : "true")}
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          <div
            className={`h-[18px] w-[18px] rounded border flex items-center justify-center transition-all ${block.content.openInNewTab === "true"
              ? "bg-brand border-brand"
              : "border-white/20 bg-white/[0.04] hover:border-white/40"
              }`}
          >
            {block.content.openInNewTab === "true" && <Check className="h-3 w-3 text-black" />}
          </div>
          <span className="text-[12px] text-[#a8a8a8] group-hover:text-white transition-colors flex items-center gap-1.5">
            <ExternalLink className="h-3 w-3" />
            Open in new tab
          </span>
        </div>
      </CollapsibleSection>

      {/* Alignment */}
      <CollapsibleSection title="Alignment">
        <div className="grid grid-cols-4 gap-1.5">
          {(["left", "center", "right", "full"] as const).map((a) => {
            const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : a === "right" ? AlignRight : Maximize2;
            return (
              <button
                key={a}
                onClick={() => setStyle("align", a)}
                className={`h-9 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[10px] capitalize transition-all cursor-pointer ${s.align === a ? "bg-brand/15 text-brand border border-brand/30" : "bg-white/[0.04] text-[#7a7a7a] border border-white/8 hover:text-white hover:bg-white/[0.08]"
                  }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] text-[#7a7a7a] mt-1.5">
          <span>Left</span>
          <span>Center</span>
          <span>Right</span>
          <span>Full</span>
        </div>
      </CollapsibleSection>

      {/* Style */}
      <CollapsibleSection title="Style">
        <PropertyField label="Button style">
          <div className="flex gap-1.5">
            {(["filled", "outlined", "text"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setStyle("variant", v)}
                className={`flex-1 h-9 rounded-lg text-[12px] font-medium capitalize transition-all cursor-pointer ${s.variant === v ? "bg-brand/15 text-brand border border-brand/30" : "bg-white/[0.04] text-[#7a7a7a] border border-white/8 hover:text-white hover:bg-white/[0.08]"
                  }`}
              >
                {v === "text" ? "Text only" : v}
              </button>
            ))}
          </div>
        </PropertyField>

        {s.variant === "filled" && (
          <ColorPicker label="Background color" value={s.backgroundColor} onChange={(v) => setStyle("backgroundColor", v)} />
        )}

        <ColorPicker label="Text color" value={s.color} onChange={(v) => setStyle("color", v)} />

        {s.variant === "outlined" && (
          <>
            <ColorPicker label="Border color" value={s.borderColor} onChange={(v) => setStyle("borderColor", v)} />
            <SliderInput label="Border width" min={1} max={5} value={s.borderWidth} onChange={(v) => setStyle("borderWidth", v)} />
          </>
        )}
      </CollapsibleSection>

      {/* Size */}
      <CollapsibleSection title="Size">
        <SearchSelect label="Font size" value={s.fontSize} onChange={(v) => setStyle("fontSize", v)} options={BTN_FONT_SIZES} />
        <SearchSelect label="Font weight" value={s.fontWeight} onChange={(v) => setStyle("fontWeight", v)} options={FONT_WEIGHTS} />
        <SliderInput label="Horizontal padding" min={16} max={48} value={s.paddingX} onChange={(v) => setStyle("paddingX", v)} />
        <SliderInput label="Vertical padding" min={8} max={24} value={s.paddingY} onChange={(v) => setStyle("paddingY", v)} />
        <SliderInput label="Border radius" min={0} max={50} value={s.borderRadius === "999" ? "50" : s.borderRadius} onChange={(v) => setStyle("borderRadius", v)} />
        <button
          onClick={() => setStyle("borderRadius", s.borderRadius === "999" ? "8" : "999")}
          className={`w-full h-8 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${s.borderRadius === "999" ? "bg-brand/15 text-brand border border-brand/30" : "bg-white/[0.04] text-[#7a7a7a] border border-white/8 hover:text-white hover:bg-white/[0.08]"
            }`}
        >
          Pill shape (999px)
        </button>
      </CollapsibleSection>

      {/* Spacing */}
      <CollapsibleSection title="Spacing">
        <SpacingInputs
          label="Margin"
          top={s.marginTop} right={s.marginRight} bottom={s.marginBottom} left={s.marginLeft}
          onChange={setMargin}
          presets={MARGIN_PRESETS}
        />
      </CollapsibleSection>
    </div>
  );
}

const LINE_STYLE_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
  { value: "double", label: "Double" },
];

function DividerPropertiesPanel({ block, onUpdate, onDelete }: { block: ComponentBlock; onUpdate: (b: ComponentBlock) => void; onDelete: () => void }) {
  const s = block.styles;
  const setStyle = (key: string, val: string) => onUpdate({ ...block, styles: { ...block.styles, [key]: val } });

  return (
    <div>
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-1">
        <h4 className="text-[13px] font-semibold text-white">Divider Block</h4>
        <button onClick={onDelete} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors cursor-pointer group">
          <Trash2 className="h-3.5 w-3.5 text-[#7a7a7a] group-hover:text-red-400 transition-colors" />
        </button>
      </div>

      {/* Style */}
      <CollapsibleSection title="Style">
        <SearchSelect label="Line style" value={s.borderStyle} onChange={(v) => setStyle("borderStyle", v)} options={LINE_STYLE_OPTIONS} />
        <SliderInput label="Thickness" min={1} max={10} value={s.borderWidth} onChange={(v) => setStyle("borderWidth", v)} />
        <ColorPicker label="Color" value={s.borderColor} onChange={(v) => setStyle("borderColor", v)} />
        <SliderInput label="Opacity" min={0} max={100} value={s.opacity} onChange={(v) => setStyle("opacity", v)} unit="%" />
      </CollapsibleSection>

      {/* Width */}
      <CollapsibleSection title="Width">
        <SliderInput label="Width" min={10} max={100} value={s.width} onChange={(v) => setStyle("width", v)} unit="%" />
        <PropertyField label="Alignment">
          <div className="flex gap-2">
            {(["left", "center", "right"] as const).map((a) => {
              const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
              return (
                <button
                  key={a}
                  onClick={() => setStyle("align", a)}
                  className={`flex-1 h-9 rounded-lg flex items-center justify-center gap-1.5 text-[12px] font-medium capitalize transition-all cursor-pointer ${s.align === a ? "bg-brand/15 text-brand border border-brand/30" : "bg-white/[0.04] text-[#7a7a7a] border border-white/8 hover:text-white hover:bg-white/[0.08]"
                    }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {a}
                </button>
              );
            })}
          </div>
        </PropertyField>
      </CollapsibleSection>

      {/* Spacing */}
      <CollapsibleSection title="Spacing">
        <SliderInput label="Margin top" min={0} max={80} value={s.marginTop} onChange={(v) => setStyle("marginTop", v)} />
        <SliderInput label="Margin bottom" min={0} max={80} value={s.marginBottom} onChange={(v) => setStyle("marginBottom", v)} />
      </CollapsibleSection>
    </div>
  );
}

const SPACER_PRESETS = [
  { label: "XS", value: "8" },
  { label: "S", value: "16" },
  { label: "M", value: "32" },
  { label: "L", value: "48" },
  { label: "XL", value: "80" },
];

function SpacerPropertiesPanel({ block, onUpdate, onDelete }: { block: ComponentBlock; onUpdate: (b: ComponentBlock) => void; onDelete: () => void }) {
  const s = block.styles;
  const setStyle = (key: string, val: string) => onUpdate({ ...block, styles: { ...block.styles, [key]: val } });
  const matchDesktop = s.matchDesktop === "true";

  return (
    <div>
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-1">
        <h4 className="text-[13px] font-semibold text-white">Spacer Block</h4>
        <button onClick={onDelete} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors cursor-pointer group">
          <Trash2 className="h-3.5 w-3.5 text-[#7a7a7a] group-hover:text-red-400 transition-colors" />
        </button>
      </div>

      {/* Size */}
      <CollapsibleSection title="Size">
        <SliderInput
          label="Height"
          min={0} max={200}
          value={s.height}
          onChange={(v) => { setStyle("height", v); if (matchDesktop) setStyle("mobileHeight", v); }}
        />

        <PropertyField label="Quick presets">
          <div className="flex gap-1.5">
            {SPACER_PRESETS.map((p) => {
              const isActive = s.height === p.value;
              return (
                <button
                  key={p.label}
                  onClick={() => {
                    setStyle("height", p.value);
                    if (matchDesktop) setStyle("mobileHeight", p.value);
                  }}
                  className={`flex-1 h-9 rounded-lg flex flex-col items-center justify-center text-[10px] font-medium transition-all cursor-pointer ${isActive ? "bg-brand/15 text-brand border border-brand/30" : "bg-white/[0.04] text-[#7a7a7a] border border-white/8 hover:text-white hover:bg-white/[0.08]"
                    }`}
                >
                  <span className="text-[11px]">{p.label}</span>
                  <span className="opacity-60">{p.value}px</span>
                </button>
              );
            })}
          </div>
        </PropertyField>
      </CollapsibleSection>

      {/* Responsive */}
      <CollapsibleSection title="Responsive">
        <SliderInput
          label="Desktop height"
          min={0} max={200}
          value={s.height}
          onChange={(v) => { setStyle("height", v); if (matchDesktop) setStyle("mobileHeight", v); }}
        />

        <label className="flex items-center gap-2.5 cursor-pointer group">
          <div
            onClick={() => {
              const next = matchDesktop ? "false" : "true";
              onUpdate({ ...block, styles: { ...block.styles, matchDesktop: next, ...(next === "true" ? { mobileHeight: s.height } : {}) } });
            }}
            className={`h-[18px] w-[18px] rounded border flex items-center justify-center transition-all cursor-pointer ${matchDesktop ? "bg-brand border-brand" : "border-white/20 bg-white/[0.04] hover:border-white/40"
              }`}
          >
            {matchDesktop && <Check className="h-3 w-3 text-black" />}
          </div>
          <span className="text-[12px] text-[#a8a8a8] group-hover:text-white transition-colors">Match desktop height</span>
        </label>

        {!matchDesktop && (
          <SliderInput label="Mobile height" min={0} max={200} value={s.mobileHeight} onChange={(v) => setStyle("mobileHeight", v)} />
        )}
      </CollapsibleSection>
    </div>
  );
}

const LAYOUT_PRESETS: Record<number, { label: string; widths: number[] }[]> = {
  1: [{ label: "Full", widths: [100] }],
  2: [
    { label: "Equal", widths: [50, 50] },
    { label: "2 : 1", widths: [66, 34] },
    { label: "1 : 2", widths: [34, 66] },
  ],
  3: [
    { label: "Equal", widths: [33, 34, 33] },
    { label: "1:2:1", widths: [25, 50, 25] },
  ],
  4: [{ label: "Equal", widths: [25, 25, 25, 25] }],
};

function ColumnsPropertiesPanel({ block, onUpdate, onDelete }: { block: ComponentBlock; onUpdate: (b: ComponentBlock) => void; onDelete: () => void }) {
  const s = block.styles;
  const columns = parseColumns(block.content.columns);
  const colCount = columns.length;
  const setStyle = (key: string, val: string) => onUpdate({ ...block, styles: { ...block.styles, [key]: val } });
  const updateColumns = (cols: ColumnData[]) => onUpdate({ ...block, content: { ...block.content, columns: serializeColumns(cols) } });
  const setPadding = (top: string, right: string, bottom: string, left: string) =>
    onUpdate({ ...block, styles: { ...block.styles, paddingTop: top, paddingRight: right, paddingBottom: bottom, paddingLeft: left } });

  const setColumnCount = (n: number) => {
    if (n === colCount) return;
    if (n > colCount) {
      const extra = makeColumnsContent(n - colCount);
      const existingTotal = columns.reduce((a, c) => a + c.width, 0);
      const newWidth = Math.floor(100 / n);
      const rebalanced = columns.map((c) => ({ ...c, width: newWidth }));
      const remainder = 100 - newWidth * n;
      if (rebalanced.length > 0) rebalanced[rebalanced.length - 1].width += remainder;
      updateColumns([...rebalanced.slice(0, n > colCount ? colCount : n), ...extra.map((e) => ({ ...e, width: newWidth }))].slice(0, n));
    } else {
      const kept = columns.slice(0, n);
      const newWidth = Math.floor(100 / n);
      const rebalanced = kept.map((c, i) => ({ ...c, width: i === n - 1 ? 100 - newWidth * (n - 1) : newWidth }));
      updateColumns(rebalanced);
    }
  };

  const applyPreset = (widths: number[]) => {
    const updated = columns.map((c, i) => ({ ...c, width: widths[i] ?? c.width }));
    updateColumns(updated);
  };

  const setColumnWidth = (idx: number, newWidth: number) => {
    const clamped = Math.max(10, Math.min(90, newWidth));
    const diff = clamped - columns[idx].width;
    const neighborIdx = idx < columns.length - 1 ? idx + 1 : idx - 1;
    if (neighborIdx < 0 || neighborIdx >= columns.length) return;
    const neighborNew = columns[neighborIdx].width - diff;
    if (neighborNew < 10) return;
    const updated = columns.map((c, i) => i === idx ? { ...c, width: clamped } : i === neighborIdx ? { ...c, width: neighborNew } : c);
    updateColumns(updated);
  };

  const presets = LAYOUT_PRESETS[colCount] ?? [];

  return (
    <div>
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-1">
        <h4 className="text-[13px] font-semibold text-white">Columns Block</h4>
        <button onClick={onDelete} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors cursor-pointer group">
          <Trash2 className="h-3.5 w-3.5 text-[#7a7a7a] group-hover:text-red-400 transition-colors" />
        </button>
      </div>

      {/* Layout */}
      <CollapsibleSection title="Layout">
        <PropertyField label="Number of columns">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setColumnCount(n)}
                className={`flex-1 h-9 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${colCount === n ? "bg-brand/15 text-brand border border-brand/30" : "bg-white/[0.04] text-[#7a7a7a] border border-white/8 hover:text-white hover:bg-white/[0.08]"
                  }`}
              >
                {n}
              </button>
            ))}
          </div>
        </PropertyField>
        <SliderInput label="Column gap" min={0} max={40} value={s.gap} onChange={(v) => setStyle("gap", v)} />
        {presets.length > 1 && (
          <PropertyField label="Layout preset">
            <div className="flex gap-1.5">
              {presets.map((p) => {
                const isActive = p.widths.every((w, i) => columns[i]?.width === w);
                return (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p.widths)}
                    className={`flex-1 h-9 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${isActive ? "bg-brand/15 text-brand border border-brand/30" : "bg-white/[0.04] text-[#7a7a7a] border border-white/8 hover:text-white hover:bg-white/[0.08]"
                      }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </PropertyField>
        )}
      </CollapsibleSection>

      {/* Column Widths */}
      <CollapsibleSection title="Column Widths">
        {columns.map((col, idx) => (
          <SliderInput key={col.id} label={`Column ${idx + 1}`} min={10} max={90} value={String(col.width)} onChange={(v) => setColumnWidth(idx, Number(v))} unit="%" />
        ))}
        <div className="text-[10px] text-[#7a7a7a] text-center">Total: {columns.reduce((a, c) => a + c.width, 0)}%</div>
      </CollapsibleSection>

      {/* Spacing */}
      <CollapsibleSection title="Spacing">
        <SpacingInputs
          label="Padding"
          top={s.paddingTop} right={s.paddingRight} bottom={s.paddingBottom} left={s.paddingLeft}
          onChange={setPadding}
          presets={PADDING_PRESETS}
        />
      </CollapsibleSection>

      {/* Mobile Behavior */}
      <CollapsibleSection title="Mobile Behavior">
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <div
            onClick={() => setStyle("stackOnMobile", s.stackOnMobile === "true" ? "false" : "true")}
            className={`h-[18px] w-[18px] rounded border flex items-center justify-center transition-all cursor-pointer ${s.stackOnMobile === "true" ? "bg-brand border-brand" : "border-white/20 bg-white/[0.04] hover:border-white/40"
              }`}
          >
            {s.stackOnMobile === "true" && <Check className="h-3 w-3 text-black" />}
          </div>
          <span className="text-[12px] text-[#a8a8a8] group-hover:text-white transition-colors flex items-center gap-1.5">
            <Rows3 className="h-3 w-3" />
            Stack on mobile
          </span>
        </label>

        {s.stackOnMobile === "true" && (
          <PropertyField label="Mobile order">
            <div className="flex gap-2">
              {(["ltr", "rtl"] as const).map((dir) => (
                <button
                  key={dir}
                  onClick={() => setStyle("mobileOrder", dir)}
                  className={`flex-1 h-9 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${s.mobileOrder === dir ? "bg-brand/15 text-brand border border-brand/30" : "bg-white/[0.04] text-[#7a7a7a] border border-white/8 hover:text-white hover:bg-white/[0.08]"
                    }`}
                >
                  {dir === "ltr" ? "Left → Right" : "Right → Left"}
                </button>
              ))}
            </div>
          </PropertyField>
        )}
      </CollapsibleSection>
    </div>
  );
}

function PropertiesPanel({
  block,
  onUpdate,
  onDelete,
}: {
  block: ComponentBlock;
  onUpdate: (updated: ComponentBlock) => void;
  onDelete: () => void;
}) {
  const setContent = (key: string, val: string) => onUpdate({ ...block, content: { ...block.content, [key]: val } });
  const setStyle = (key: string, val: string) => onUpdate({ ...block, styles: { ...block.styles, [key]: val } });

  if (block.type === "preheader") {
    return <PreheaderPropertiesPanel block={block} onUpdate={onUpdate} onDelete={onDelete} ColorPicker={ColorPicker} />;
  }
  if (block.type === "text") {
    return <TextPropertiesPanel block={block} onUpdate={onUpdate} onDelete={onDelete} />;
  }
  if (block.type === "heading") {
    return <HeadingPropertiesPanel block={block} onUpdate={onUpdate} onDelete={onDelete} />;
  }
  if (block.type === "logo") {
    return <LogoPropertiesPanel block={block} onUpdate={onUpdate} onDelete={onDelete} />;
  }
  if (block.type === "image") {
    return <ImagePropertiesPanel block={block} onUpdate={onUpdate} onDelete={onDelete} />;
  }
  if (block.type === "button") {
    return <ButtonPropertiesPanel block={block} onUpdate={onUpdate} onDelete={onDelete} />;
  }
  if (block.type === "socialIcons") {
    return <SocialIconsPropertiesPanel block={block} onUpdate={onUpdate} onDelete={onDelete} ColorPicker={ColorPicker} />;
  }
  if (block.type === "footer") {
    return <FooterPropertiesPanel block={block} onUpdate={onUpdate} onDelete={onDelete} ColorPicker={ColorPicker} />;
  }
  if (block.type === "divider") {
    return <DividerPropertiesPanel block={block} onUpdate={onUpdate} onDelete={onDelete} />;
  }
  if (block.type === "spacer") {
    return <SpacerPropertiesPanel block={block} onUpdate={onUpdate} onDelete={onDelete} />;
  }
  if (block.type === "columns") {
    return <ColumnsPropertiesPanel block={block} onUpdate={onUpdate} onDelete={onDelete} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-semibold text-white capitalize">{block.type} Properties</h4>
        <button onClick={onDelete} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors cursor-pointer group">
          <Trash2 className="h-3.5 w-3.5 text-[#7a7a7a] group-hover:text-red-400 transition-colors" />
        </button>
      </div>
    </div>
  );
}

function DraggablePaletteItem({ type, icon: Icon, label, onClickAdd }: { type: BlockType; icon: typeof AlignLeft; label: string; onClickAdd: () => void }) {
  const [{ isDragging }, drag] = useDrag<PaletteDragItem, unknown, { isDragging: boolean }>({
    type: DND_PALETTE,
    item: { componentType: type },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  return (
    <button
      ref={(node) => {
        drag(node);
      }}
      onClick={onClickAdd}
      className={`flex items-center gap-3 h-10 px-3 rounded-lg border border-white/8 bg-white/[0.03] text-[13px] text-[#b0b0b8] hover:bg-white/[0.07] hover:text-white hover:border-brand/40 transition-all cursor-grab active:cursor-grabbing group ${isDragging ? "opacity-40 scale-95" : ""
        }`}
    >
      <Icon className="h-4 w-4 shrink-0 text-[#7a7a7a] group-hover:text-brand transition-colors" />
      {label}
      <GripVertical className="h-3.5 w-3.5 ml-auto text-[#7a7a7a]/40 group-hover:text-[#7a7a7a] transition-opacity" />
    </button>
  );
}

function DraggableCanvasBlock({
  block, index, isSelected, onSelect, onDelete, onDuplicate,
  children, moveBlockByIndex, insertFromPalette, setComponents,
}: {
  block: ComponentBlock;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  children: React.ReactNode;
  moveBlockByIndex: (fromIdx: number, toIdx: number) => void;
  insertFromPalette: (type: BlockType, atIndex: number) => void;
  setComponents?: React.Dispatch<React.SetStateAction<ComponentBlock[]>>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dropSide, setDropSide] = useState<"top" | "bottom" | null>(null);

  const [{ isDragging }, drag] = useDrag<CanvasDragItem, unknown, { isDragging: boolean }>({
    type: DND_CANVAS,
    item: { id: block.id, index },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop<CanvasDragItem | PaletteDragItem | { cellId: string; sourceColumnId: string; sourceBlockId: string }, void, { isOver: boolean }>({
    accept: [DND_CANVAS, DND_PALETTE, DND_COLUMN_CELL],
    hover: (item, monitor) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const clientY = monitor.getClientOffset()?.y ?? 0;
      const mid = rect.top + rect.height / 2;
      setDropSide(clientY < mid ? "top" : "bottom");
    },
    drop: (item: any, monitor) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const clientY = monitor.getClientOffset()?.y ?? 0;
      const mid = rect.top + rect.height / 2;
      const insertIdx = clientY < mid ? index : index + 1;

      if (item.componentType) {
        insertFromPalette(item.componentType, insertIdx);
      } else if (item.cellId && item.sourceColumnId && item.sourceBlockId) {
        if (!setComponents) return;
        setComponents((prev) => {
          let cellToInsert: ComponentBlock | null = null;

          const cleaned = prev.map((c) => {
            if (c.id === item.sourceBlockId) {
              const currentCols = parseColumns(c.content.columns);
              const updatedCols = currentCols.map((tc) => {
                if (tc.id === item.sourceColumnId) {
                  cellToInsert = tc.components.find((x) => x.id === item.cellId) || null;
                  return { ...tc, components: tc.components.filter((x) => x.id !== item.cellId) };
                }
                return tc;
              });
              return { ...c, content: { ...c.content, columns: serializeColumns(updatedCols) } };
            }
            return c;
          });

          if (!cellToInsert) return prev;

          const next = [...cleaned];
          next.splice(insertIdx, 0, cellToInsert);
          return sortComponentsWithPreheaderFirst(next);
        });
      } else if (item.index !== undefined && item.index !== index) {
        moveBlockByIndex(item.index, clientY < mid ? index : index);
      }
      setDropSide(null);
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  const handleRef = useCallback((node: HTMLDivElement | null) => {
    drop(node);
    (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [drop]);

  return (
    <div
      ref={handleRef}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={`relative group/block mx-2 my-1 rounded-lg transition-all cursor-pointer ${isDragging ? "opacity-30 scale-[0.98]" : ""
        } ${isSelected
          ? "ring-2 ring-brand ring-offset-2"
          : "ring-1 ring-transparent hover:ring-[#d1d5dc]"
        }`}
      onDragLeave={() => setDropSide(null)}
    >
      {/* Drop indicator — top */}
      {isOver && dropSide === "top" && (
        <div className="absolute top-0 left-2 right-2 z-20 h-0.5 bg-brand rounded-full -translate-y-0.5">
          <div className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-brand" />
          <div className="absolute -right-1 -top-[3px] h-2 w-2 rounded-full bg-brand" />
        </div>
      )}

      {/* Action toolbar */}
      <div className={`absolute -top-3.5 right-2 z-20 flex items-center gap-0.5 bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.12)] border border-[#e5e7eb] px-1 py-0.5 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover/block:opacity-100"
        }`}>
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          className="h-6 w-6 rounded flex items-center justify-center hover:bg-[#f3f4f6] transition-colors cursor-pointer"
          title="Duplicate (Ctrl+D)"
        >
          <Copy className="h-3 w-3 text-[#6b7280]" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="h-6 w-6 rounded flex items-center justify-center hover:bg-red-50 transition-colors cursor-pointer"
          title="Delete (Del)"
        >
          <Trash2 className="h-3 w-3 text-[#6b7280] hover:text-red-500" />
        </button>
      </div>

      {/* Drag handle */}
      <div
        ref={(node) => {
          drag(node);
        }}
        className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 h-8 w-5 rounded bg-white shadow-[0_1px_4px_rgba(0,0,0,0.1)] border border-[#e5e7eb] flex items-center justify-center cursor-grab active:cursor-grabbing transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover/block:opacity-100"
          }`}
        title="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5 text-[#9ca3af]" />
      </div>

      {children}

      {/* Drop indicator — bottom */}
      {isOver && dropSide === "bottom" && (
        <div className="absolute bottom-0 left-2 right-2 z-20 h-0.5 bg-brand rounded-full translate-y-0.5">
          <div className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-brand" />
          <div className="absolute -right-1 -top-[3px] h-2 w-2 rounded-full bg-brand" />
        </div>
      )}
    </div>
  );
}

function CanvasDropZone({
  viewMode, components, selectedId, setSelectedId,
  addBlock, insertBlock, updateBlock, deleteBlock, duplicateBlock, moveBlockByIndex,
  setComponents,
}: {
  viewMode: "desktop" | "mobile";
  components: ComponentBlock[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  addBlock: (type: BlockType) => void;
  insertBlock: (type: BlockType, atIndex: number) => void;
  updateBlock: (b: ComponentBlock) => void;
  deleteBlock: (id: string) => void;
  duplicateBlock: (id: string) => void;
  moveBlockByIndex: (from: number, to: number) => void;
  setComponents: React.Dispatch<React.SetStateAction<ComponentBlock[]>>;
}) {
  const [{ isOver: isOverCanvas }, canvasDrop] = useDrop<PaletteDragItem | { cellId: string; sourceColumnId: string; sourceBlockId: string }, void, { isOver: boolean }>({
    accept: [DND_PALETTE, DND_COLUMN_CELL],
    drop: (item: any, monitor) => {
      if (monitor.didDrop()) return;
      if (item.componentType) {
        addBlock(item.componentType);
      } else if (item.cellId && item.sourceColumnId && item.sourceBlockId) {
        setComponents((prev) => {
          let cellToInsert: ComponentBlock | null = null;

          const cleaned = prev.map((c) => {
            if (c.id === item.sourceBlockId) {
              const currentCols = parseColumns(c.content.columns);
              const updatedCols = currentCols.map((tc) => {
                if (tc.id === item.sourceColumnId) {
                  cellToInsert = tc.components.find((x) => x.id === item.cellId) || null;
                  return { ...tc, components: tc.components.filter((x) => x.id !== item.cellId) };
                }
                return tc;
              });
              return { ...c, content: { ...c.content, columns: serializeColumns(updatedCols) } };
            }
            return c;
          });

          if (!cellToInsert) return prev;

          return sortComponentsWithPreheaderFirst([...cleaned, cellToInsert]);
        });
      }
    },
    collect: (monitor) => ({ isOver: monitor.isOver({ shallow: true }) }),
  });

  function renderBlock(block: ComponentBlock, index: number) {
    const isSelected = selectedId === block.id;
    const common = { isSelected, onSelect: () => setSelectedId(block.id), onDelete: () => deleteBlock(block.id), onDuplicate: () => duplicateBlock(block.id) };

    let content: React.ReactNode;
    switch (block.type) {
      case "preheader":
        content = <PreheaderBlockRenderer block={block} onUpdate={updateBlock} />;
        break;
      case "logo":
        content = <LogoBlockRenderer block={block} {...common} onUpdate={updateBlock} />;
        break;
      case "heading":
        content = <HeadingBlockRenderer block={block} {...common} onUpdate={updateBlock} />;
        break;
      case "text":
        content = <TextBlockRenderer block={block} {...common} onUpdate={updateBlock} />;
        break;
      case "image":
        content = <ImageBlockRenderer block={block} {...common} onUpdate={updateBlock} />;
        break;
      case "button":
        content = <ButtonBlockRenderer block={block} {...common} />;
        break;
      case "divider":
        content = <DividerBlockRenderer block={block} {...common} />;
        break;
      case "spacer":
        content = <SpacerBlockRenderer block={block} {...common} />;
        break;
      case "columns":
        content = (
          <ColumnsBlockRenderer
            block={block}
            {...common}
            onUpdate={updateBlock}
            setComponents={setComponents}
            componentsState={components}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
          />
        );
        break;
      case "socialIcons":
        content = <SocialIconsBlockRenderer block={block} {...common} onUpdate={updateBlock} />;
        break;
      case "footer":
        content = <FooterBlockRenderer block={block} onUpdate={updateBlock} />;
        break;
      default:
        content = null;
    }

    return (
      <DraggableCanvasBlock
        key={block.id}
        block={block}
        index={index}
        isSelected={isSelected}
        onSelect={common.onSelect}
        onDelete={common.onDelete}
        onDuplicate={common.onDuplicate}
        moveBlockByIndex={moveBlockByIndex}
        insertFromPalette={insertBlock}
        setComponents={setComponents}
      >
        {content}
      </DraggableCanvasBlock>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto bg-[#f3f4f6] flex justify-center pt-8 pb-8"
      onClick={() => setSelectedId(null)}
    >
      <div
        ref={(node) => {
          canvasDrop(node);
        }}
        className={`bg-white shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08),0_4px_6px_-4px_rgba(0,0,0,0.06)] rounded-lg overflow-hidden transition-all duration-300 self-start ${isOverCanvas && components.length === 0 ? "ring-2 ring-brand ring-offset-4 ring-offset-[#f3f4f6]" : ""
          }`}
        style={{ width: viewMode === "desktop" ? 600 : 375 }}
        onClick={(e) => e.stopPropagation()}
      >
        {components.length === 0 ? (
          <div className={`h-[400px] flex flex-col items-center justify-center gap-3 border-2 border-dashed m-6 rounded-xl transition-colors ${isOverCanvas ? "border-brand bg-brand/[0.03]" : "border-[#d1d5dc]"
            }`}>
            <div className={`h-14 w-14 rounded-xl flex items-center justify-center transition-colors ${isOverCanvas ? "bg-brand/10" : "bg-[#f3f4f6]"
              }`}>
              <Plus className={`h-6 w-6 transition-colors ${isOverCanvas ? "text-brand" : "text-[#99a1af]"}`} />
            </div>
            <p className={`text-[15px] font-medium transition-colors ${isOverCanvas ? "text-brand" : "text-[#99a1af]"}`}>
              {isOverCanvas ? "Release to add component" : "Drop components here"}
            </p>
            <p className="text-[12px] text-[#c0c4cc]">Drag from the left panel or click to add</p>
          </div>
        ) : (
          <div className="py-2">
            {components.map((block, idx) => renderBlock(block, idx))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The "Preview" half of the canvas toggle: the real exported email with every
 * variable resolved to sample data, so the founder reads what the recipient
 * reads instead of a page of chips. Rendered in a sandboxed iframe for the same
 * reason mail clients do — the template's own CSS must not touch the app.
 */
function CustomerPreviewCanvas({
  viewMode,
  components,
  templateName,
}: {
  viewMode: "desktop" | "mobile";
  components: ComponentBlock[];
  templateName: string;
}) {
  const srcDoc = useMemo(
    () => applyMergeSamples(exportToHTML(components, templateName)),
    [components, templateName],
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#f3f4f6] flex flex-col items-center pt-8 pb-8 gap-3">
      <p className="text-[12px] text-[#6b7280] px-4 text-center">
        Sample details shown — each recipient&apos;s own name, organization, and
        links are filled in when the email sends.
      </p>
      <iframe
        title="Customer preview"
        srcDoc={srcDoc}
        sandbox=""
        className="border-0 bg-white shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08),0_4px_6px_-4px_rgba(0,0,0,0.06)] rounded-lg transition-all duration-300 self-center"
        style={{ width: viewMode === "desktop" ? 600 : 375, minHeight: 720 }}
      />
    </div>
  );
}

function TemplatePresetGrid({
  onSelectPreset,
}: {
  onSelectPreset: (id: EmailTemplatePresetId) => void;
}) {
  return (
    <div className="p-3 flex flex-col gap-3">
      <p className="text-[11px] text-[#7a7a7a] leading-relaxed px-0.5">
        Start from a complete layout. You can customize every block after loading.
      </p>
      {EMAIL_TEMPLATE_PRESETS.map((preset) => {
        const Icon = PRESET_THUMBNAIL_ICONS[preset.id];
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelectPreset(preset.id)}
            className="group text-left rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-brand/40 hover:bg-brand/[0.06] transition-all cursor-pointer overflow-hidden"
          >
            <div
              className={`h-[88px] bg-gradient-to-br ${preset.thumbnailGradient} relative flex items-center justify-center`}
            >
              <div className="absolute inset-3 rounded-md bg-white/90 shadow-sm flex flex-col gap-1.5 p-2 opacity-95">
                <div className="h-2 w-8 mx-auto rounded bg-brand/30" />
                <div className="h-1.5 w-full rounded bg-[#e5e7eb]" />
                <div className="h-1.5 w-[85%] rounded bg-[#e5e7eb]" />
                <div className="h-3 w-12 mx-auto rounded bg-brand/40 mt-auto" />
              </div>
              <div className="absolute top-2 right-2 h-7 w-7 rounded-lg bg-black/20 flex items-center justify-center">
                <Icon className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-[13px] font-semibold text-white group-hover:text-brand transition-colors">
                {preset.name}
              </p>
              <p className="text-[11px] text-[#7a7a7a] mt-0.5 line-clamp-2">{preset.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function TemplateEditorView({
  template,
  onBack,
  exitRequestNonce = 0,
}: {
  template: EditorTemplate;
  onBack: () => void;
  /** Bumped by parent when sidebar "Template Library" is clicked while editing. */
  exitRequestNonce?: number;
}) {
  const [templateName, setTemplateName] = useState(template.name);
  const [category, setCategory] = useState<MailTemplateCategory>(template.category as MailTemplateCategory);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  /**
   * "builder" shows variables as chips and everything editable; "customer"
   * renders the exported email with sample data filled in, which is what the
   * recipient will actually open.
   */
  const [canvasMode, setCanvasMode] = useState<"builder" | "customer">("builder");
  const [components, setComponents] = useState<ComponentBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [leftSidebarTab, setLeftSidebarTab] = useState<"components" | "templates">("components");
  const [pendingPresetId, setPendingPresetId] = useState<EmailTemplatePresetId | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [publishedStatus, setPublishedStatus] = useState<TemplateStatus>("draft");

  const historyRef = useRef<{ past: ComponentBlock[][]; future: ComponentBlock[][] }>({ past: [], future: [] });
  const MAX_HISTORY = 50;

  const pushHistory = useCallback((prev: ComponentBlock[]) => {
    historyRef.current.past.push(prev);
    if (historyRef.current.past.length > MAX_HISTORY) historyRef.current.past.shift();
    historyRef.current.future = [];
  }, []);

  const undo = useCallback(() => {
    const { past, future } = historyRef.current;
    if (past.length === 0) return;
    const prev = past.pop()!;
    setComponents((cur) => { future.push(cur); return prev; });
  }, []);

  const redo = useCallback(() => {
    const { past, future } = historyRef.current;
    if (future.length === 0) return;
    const next = future.pop()!;
    setComponents((cur) => { past.push(cur); return next; });
  }, []);

  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;

  const selectedBlock = useMemo(() => {
    if (!selectedId) return null;
    const found = components.find((c) => c.id === selectedId);
    if (found) return found;
    for (const c of components) {
      if (c.type === "columns" && c.content?.columns) {
        try {
          const columns = parseColumns(c.content.columns);
          for (const col of columns) {
            const nestedFound = col.components.find((comp) => comp.id === selectedId);
            if (nestedFound) return nestedFound;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    return null;
  }, [components, selectedId]);

  /* ─── Save / Auto-save / Load ─── */

  const saveDraft = useCallback(async () => {
    const orgId = getNetworkMailOrgId();
    if (!orgId) {
      toast.error("No organization selected");
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateTemplate(orgId, template.id, {
        name: templateName,
        category: category,
        components,
        subject,
        htmlBody: exportToHTML(components, templateName),
      });
      setLastSaved(new Date(updated.updatedAt));
      setPublishedStatus(updated.status);
      setIsDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  }, [template.id, category, templateName, components, subject]);

  const handlePublish = useCallback(async () => {
    const orgId = getNetworkMailOrgId();
    if (!orgId) {
      toast.error("No organization selected");
      return;
    }
    setIsSaving(true);
    const payload = {
      name: templateName,
      category: category,
      components,
      subject,
      htmlBody: exportToHTML(components, templateName),
    };
    try {
      const isPublished = publishedStatus === "published";
      let updated;
      if (isPublished) {
        updated = await updateTemplate(orgId, template.id, payload);
      } else {
        await updateTemplate(orgId, template.id, payload);
        updated = await publishTemplate(orgId, template.id, payload);
      }
      setLastSaved(new Date(updated.updatedAt));
      setPublishedStatus(updated.status);
      setIsDirty(false);
      toast.success(isPublished ? "Template updated" : "Template published");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : publishedStatus === "published"
            ? "Failed to update template"
            : "Failed to publish",
      );
    } finally {
      setIsSaving(false);
    }
  }, [template.id, category, publishedStatus, components, subject, templateName]);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const handleBack = useCallback(() => {
    if (isDirty) {
      setShowLeaveDialog(true);
      return;
    }
    onBack();
  }, [isDirty, onBack]);

  const handledExitNonceRef = useRef(0);
  useEffect(() => {
    if (exitRequestNonce <= handledExitNonceRef.current) return;
    handledExitNonceRef.current = exitRequestNonce;
    handleBack();
  }, [exitRequestNonce, handleBack]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const orgId = getNetworkMailOrgId();
      if (!orgId) {
        if (!cancelled) {
          setLoadError("No organization selected");
          setLoadingTemplate(false);
        }
        return;
      }
      try {
        const t = await getTemplate(orgId, template.id);
        if (cancelled) return;
        setTemplateName(t.name);
        if (t.category) {
          setCategory(t.category as MailTemplateCategory);
        }
        setSubject(t.subject || "");
        setComponents(Array.isArray(t.components) ? t.components : []);
        setPublishedStatus(t.status);
        setLastSaved(new Date(t.updatedAt));
        setIsDirty(false);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load template");
        }
      } finally {
        if (!cancelled) setLoadingTemplate(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [template.id]);

  useEffect(() => {
    if (!isDirty || loadingTemplate) return;
    const timer = setTimeout(() => {
      void saveDraft();
    }, 30000);
    return () => clearTimeout(timer);
  }, [isDirty, loadingTemplate, components, templateName, subject, saveDraft]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const formatLastSaved = useCallback(() => {
    if (!lastSaved) return null;
    const now = new Date();
    const diffMs = now.getTime() - lastSaved.getTime();
    if (diffMs < 60_000) return "just now";
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 60) return `${mins}m ago`;
    return lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [lastSaved]);

  const addBlock = useCallback((type: BlockType) => {
    const block = createBlock(type);
    setComponents((prev) => {
      pushHistory(prev);
      return sortComponentsWithPreheaderFirst([...prev, block]);
    });
    setSelectedId(block.id);
    markDirty();
  }, [pushHistory, markDirty]);

  const insertBlock = useCallback((type: BlockType, atIndex: number) => {
    const block = createBlock(type);
    setComponents((prev) => {
      pushHistory(prev);
      const next = [...prev];
      next.splice(atIndex, 0, block);
      return sortComponentsWithPreheaderFirst(next);
    });
    setSelectedId(block.id);
    markDirty();
  }, [pushHistory, markDirty]);

  const moveBlockByIndex = useCallback((fromIdx: number, toIdx: number) => {
    setComponents((prev) => {
      if (fromIdx === toIdx) return prev;
      pushHistory(prev);
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return sortComponentsWithPreheaderFirst(next);
    });
    markDirty();
  }, [pushHistory, markDirty]);

  const updateBlock = useCallback((updated: ComponentBlock) => {
    setComponents((prev) => {
      pushHistory(prev);
      let updatedAtRoot = false;
      const next = prev.map((c) => {
        if (c.id === updated.id) {
          updatedAtRoot = true;
          return updated;
        }
        return c;
      });
      if (updatedAtRoot) return next;
      return prev.map((c) => {
        if (c.type === "columns" && c.content?.columns) {
          try {
            const columns = parseColumns(c.content.columns);
            let colUpdated = false;
            const updatedCols = columns.map((col) => {
              const hasComp = col.components.some((comp) => comp.id === updated.id);
              if (hasComp) {
                colUpdated = true;
                return {
                  ...col,
                  components: col.components.map((comp) => comp.id === updated.id ? updated : comp)
                };
              }
              return col;
            });
            if (colUpdated) {
              return {
                ...c,
                content: {
                  ...c.content,
                  columns: serializeColumns(updatedCols)
                }
              };
            }
          } catch (e) {
            console.error(e);
          }
        }
        return c;
      });
    });
    markDirty();
  }, [pushHistory, markDirty]);

  const deleteBlock = useCallback((id: string) => {
    setComponents((prev) => {
      pushHistory(prev);
      const rootFiltered = prev.filter((c) => c.id !== id);
      if (rootFiltered.length < prev.length) {
        return rootFiltered;
      }
      return prev.map((c) => {
        if (c.type === "columns" && c.content?.columns) {
          try {
            const columns = parseColumns(c.content.columns);
            let colUpdated = false;
            const updatedCols = columns.map((col) => {
              const hasComp = col.components.some((comp) => comp.id === id);
              if (hasComp) {
                colUpdated = true;
                return {
                  ...col,
                  components: col.components.filter((comp) => comp.id !== id)
                };
              }
              return col;
            });
            if (colUpdated) {
              return {
                ...c,
                content: {
                  ...c.content,
                  columns: serializeColumns(updatedCols)
                }
              };
            }
          } catch (e) {
            console.error(e);
          }
        }
        return c;
      });
    });
    if (selectedId === id) setSelectedId(null);
    markDirty();
  }, [selectedId, pushHistory, markDirty]);

  const duplicateBlock = useCallback((id: string) => {
    setComponents((prev) => {
      const rootIdx = prev.findIndex((c) => c.id === id);
      if (rootIdx >= 0) {
        pushHistory(prev);
        const clone = { ...prev[rootIdx], id: makeId(), content: { ...prev[rootIdx].content }, styles: { ...prev[rootIdx].styles } };
        const next = [...prev];
        next.splice(rootIdx + 1, 0, clone);
        return sortComponentsWithPreheaderFirst(next);
      }
      let duplicated = false;
      const next = prev.map((c) => {
        if (c.type === "columns" && c.content?.columns) {
          try {
            const columns = parseColumns(c.content.columns);
            let colUpdated = false;
            const updatedCols = columns.map((col) => {
              const idx = col.components.findIndex((comp) => comp.id === id);
              if (idx >= 0) {
                duplicated = true;
                colUpdated = true;
                const sourceComp = col.components[idx];
                const clone = { ...sourceComp, id: makeId(), content: { ...sourceComp.content }, styles: { ...sourceComp.styles } };
                const nextComps = [...col.components];
                nextComps.splice(idx + 1, 0, clone);
                return {
                  ...col,
                  components: nextComps
                };
              }
              return col;
            });
            if (colUpdated) {
              return {
                ...c,
                content: {
                  ...c.content,
                  columns: serializeColumns(updatedCols)
                }
              };
            }
          } catch (e) {
            console.error(e);
          }
        }
        return c;
      });
      if (duplicated) {
        pushHistory(prev);
        return next;
      }
      return prev;
    });
    markDirty();
  }, [pushHistory, markDirty]);

  const loadEmailPreset = useCallback((id: EmailTemplatePresetId) => {
    setComponents((prev) => {
      pushHistory(prev);
      return buildEmailTemplatePreset(id);
    });
    setSelectedId(null);
    setLeftSidebarTab("components");
    markDirty();
    setPendingPresetId(null);
  }, [pushHistory, markDirty]);

  const requestEmailPreset = useCallback((id: EmailTemplatePresetId) => {
    if (components.length > 0) {
      setPendingPresetId(id);
      return;
    }
    loadEmailPreset(id);
  }, [components.length, loadEmailPreset]);

  const moveBlock = useCallback((id: string, dir: -1 | 1) => {
    setComponents((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      pushHistory(prev);
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    markDirty();
  }, [pushHistory, markDirty]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toUpperCase();
      const activeTag = document.activeElement?.tagName?.toUpperCase();
      const isEditableElement = (el: Element | null) => {
        if (!el) return false;
        const tag = el.tagName.toUpperCase();
        return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable || el.closest('[contenteditable="true"]') !== null;
      };
      const isInput = isEditableElement(e.target as Element) || isEditableElement(document.activeElement);
      const mod = e.metaKey || e.ctrlKey;

      if ((e.key === "Delete" || e.key === "Backspace") && !isInput) {
        if (selectedId) { e.preventDefault(); deleteBlock(selectedId); }
      }
      else if (mod && e.key === "s") {
        e.preventDefault();
        saveDraft();
      }
      else if (mod && e.key === "d") {
        e.preventDefault();
        if (selectedId) duplicateBlock(selectedId);
      }
      else if (mod && e.shiftKey && e.key === "z") {
        e.preventDefault();
        redo();
      }
      else if (mod && e.key === "z") {
        e.preventDefault();
        undo();
      }
      else if (e.key === "ArrowUp" && !isInput) {
        e.preventDefault();
        if (selectedId) {
          moveBlock(selectedId, -1);
        } else if (components.length > 0) {
          setSelectedId(components[components.length - 1].id);
        }
      }
      else if (e.key === "ArrowDown" && !isInput) {
        e.preventDefault();
        if (selectedId) {
          moveBlock(selectedId, 1);
        } else if (components.length > 0) {
          setSelectedId(components[0].id);
        }
      }
      else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, components, deleteBlock, duplicateBlock, moveBlock, undo, redo, saveDraft]);

  if (loadingTemplate) {
    return (
      <div className="flex flex-col items-center justify-center h-full -m-6 gap-3">
        <div className="h-8 w-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#7a7a7a]">Loading template...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full -m-6 gap-4 px-6">
        <p className="text-sm text-red-400 text-center">{loadError}</p>
        <button
          type="button"
          onClick={onBack}
          className="h-9 px-4 rounded-lg border border-white/10 text-sm text-white hover:bg-white/[0.06] cursor-pointer"
        >
          Back to library
        </button>
      </div>
    );
  }

  return (
    <NetworkMailEditorProvider templateId={template.id}>
      <DndProvider backend={HTML5Backend}>
        <div className="flex flex-col h-full w-full min-h-0">
          {/* Toolbar */}
          <div className="h-[52px] shrink-0 border-b border-[#e5e7eb]/15 flex items-center justify-between px-4">
            {/* Left: Back + editable name */}
            <div className="flex items-center gap-2.5 min-w-0">
              <button onClick={handleBack} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0">
                <ArrowLeft className="h-[18px] w-[18px] text-white" />
              </button>
              <input
                type="text"
                value={templateName}
                maxLength={35}
                onChange={(e) => { setTemplateName(e.target.value); markDirty(); }}
                className="bg-transparent text-[15px] text-white outline-none border-b border-transparent hover:border-white/20 focus:border-brand transition-colors min-w-0 w-[200px] py-1"
                placeholder="Template name..."
              />
              <span className={`text-[10px] shrink-0 mr-1.5 ${templateName.length >= 35 ? "text-red-500 font-medium" : "text-[#7a7a7a]"}`}>
                {templateName.length}/35
              </span>
            </div>

            {/* Center: Undo/Redo + Device toggle */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${canUndo ? "text-[#a8a8a8] hover:bg-white/[0.06] hover:text-white" : "text-white/15 cursor-not-allowed"}`}
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${canRedo ? "text-[#a8a8a8] hover:bg-white/[0.06] hover:text-white" : "text-white/15 cursor-not-allowed"}`}
                  title="Redo (Ctrl+Shift+Z)"
                >
                  <Redo2 className="h-4 w-4" />
                </button>
              </div>
              <div className="w-px h-5 bg-white/10" />
              <div className="flex items-center h-9 rounded-lg bg-white/[0.06] p-1">
                <button
                  onClick={() => setViewMode("desktop")}
                  className={`h-7 px-3 rounded-md flex items-center gap-1.5 text-[13px] transition-all cursor-pointer ${viewMode === "desktop"
                    ? "bg-white/[0.12] text-white shadow-sm"
                    : "text-[#7a7a7a] hover:text-[#a8a8a8]"
                    }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  Desktop
                </button>
                <button
                  onClick={() => setViewMode("mobile")}
                  className={`h-7 px-3 rounded-md flex items-center gap-1.5 text-[13px] transition-all cursor-pointer ${viewMode === "mobile"
                    ? "bg-white/[0.12] text-white shadow-sm"
                    : "text-[#7a7a7a] hover:text-[#a8a8a8]"
                    }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  Mobile
                </button>
              </div>
              <div className="w-px h-5 bg-white/10" />
              <div className="flex items-center h-9 rounded-lg bg-white/[0.06] p-1">
                <button
                  onClick={() => setCanvasMode("builder")}
                  title="Edit the layout — variables show as chips"
                  className={`h-7 px-3 rounded-md flex items-center gap-1.5 text-[13px] transition-all cursor-pointer ${canvasMode === "builder"
                    ? "bg-white/[0.12] text-white shadow-sm"
                    : "text-[#7a7a7a] hover:text-[#a8a8a8]"
                    }`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Build
                </button>
                <button
                  onClick={() => setCanvasMode("customer")}
                  title="See it as the recipient does, with sample details filled in"
                  className={`h-7 px-3 rounded-md flex items-center gap-1.5 text-[13px] transition-all cursor-pointer ${canvasMode === "customer"
                    ? "bg-white/[0.12] text-white shadow-sm"
                    : "text-[#7a7a7a] hover:text-[#a8a8a8]"
                    }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </button>
              </div>
            </div>

            {/* Right: Save status + actions */}
            <div className="flex items-center gap-2.5">
              {/* Save status indicator */}
              <div className="flex items-center gap-2 mr-1">
                {isSaving && (
                  <span className="flex items-center gap-1.5 text-[12px] text-[#7a7a7a]">
                    <div className="h-3 w-3 border-[1.5px] border-brand border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </span>
                )}
                {!isSaving && lastSaved && (
                  <span className="text-[11px] text-[#7a7a7a]">Saved {formatLastSaved()}</span>
                )}
                {isDirty && !isSaving && (
                  <div className="h-2 w-2 rounded-full bg-amber-400" title="Unsaved changes" />
                )}
              </div>
              <button
                onClick={saveDraft}
                className="h-9 px-4 rounded-lg border border-white/10 text-[13px] text-[#a8a8a8] hover:bg-white/[0.06] hover:text-white transition-all cursor-pointer flex items-center gap-2"
                title="Save Draft (Ctrl+S)"
              >
                {!isDirty && lastSaved ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : null}
                {!isDirty && lastSaved ? "Saved" : "Save Draft"}
              </button>
              <button
                onClick={async () => {
                  if (isDirty) {
                    await saveDraft();
                  }
                  setShowExport(true);
                }}
                className="h-9 px-4 rounded-lg border border-white/10 text-[13px] text-[#a8a8a8] hover:bg-white/[0.06] hover:text-white transition-all cursor-pointer flex items-center gap-2"
              >
                <Code2 className="h-3.5 w-3.5" />
                Export
              </button>
              <button
                onClick={() => void handlePublish()}
                disabled={isSaving || loadingTemplate}
                className="h-9 px-5 rounded-lg bg-brand text-brand-foreground text-[13px] font-medium hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)] active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {publishedStatus === "published" ? "Update" : "Publish"}
              </button>
            </div>
          </div>

          {/* 3-panel body */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left sidebar — Components & Templates (250px) */}
            <div className="w-[250px] shrink-0 bg-white/[0.02] border-r border-[#e5e7eb]/10 flex flex-col overflow-hidden">
              <div className="shrink-0 border-b border-white/[0.06]">
                <div className="flex p-1.5 gap-1 mx-2 mt-2 mb-1 rounded-lg bg-white/[0.04]">
                  <button
                    type="button"
                    onClick={() => setLeftSidebarTab("components")}
                    className={`flex-1 h-8 rounded-md text-[12px] font-medium transition-all cursor-pointer ${leftSidebarTab === "components"
                      ? "bg-brand text-brand-foreground shadow-sm"
                      : "text-[#7a7a7a] hover:text-white"
                      }`}
                  >
                    Components
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeftSidebarTab("templates")}
                    className={`flex-1 h-8 rounded-md text-[12px] font-medium transition-all cursor-pointer flex items-center justify-center gap-1 ${leftSidebarTab === "templates"
                      ? "bg-brand text-brand-foreground shadow-sm"
                      : "text-[#7a7a7a] hover:text-white"
                      }`}
                  >
                    <LayoutTemplate className="h-3 w-3" />
                    Templates
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {leftSidebarTab === "components" ? (
                  <div className="p-3 flex flex-col gap-1.5">
                    {PALETTE_ITEMS.map(({ type, icon, label }) => (
                      <DraggablePaletteItem
                        key={type}
                        type={type}
                        icon={icon}
                        label={label}
                        onClickAdd={() => addBlock(type)}
                      />
                    ))}
                  </div>
                ) : (
                  <TemplatePresetGrid onSelectPreset={requestEmailPreset} />
                )}
              </div>
            </div>

            {/* Center canvas (flex-1) — or the customer-eye preview */}
            {canvasMode === "customer" ? (
              <CustomerPreviewCanvas
                viewMode={viewMode}
                components={components}
                templateName={templateName}
              />
            ) : (
              <CanvasDropZone
                viewMode={viewMode}
                components={components}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                addBlock={addBlock}
                insertBlock={insertBlock}
                updateBlock={updateBlock}
                deleteBlock={deleteBlock}
                duplicateBlock={duplicateBlock}
                moveBlockByIndex={moveBlockByIndex}
                setComponents={setComponents}
              />
            )}

            {/* Right sidebar — Properties (320px) */}
            <div className="w-[320px] shrink-0 bg-white/[0.02] border-l border-[#e5e7eb]/10 flex flex-col overflow-hidden">
              <div className="p-4 pb-3 border-b border-white/[0.06] shrink-0">
                <h4 className="text-[13px] font-semibold text-white tracking-tight">Properties</h4>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-4 pb-64">
                  {selectedBlock ? (
                    <PropertiesPanel
                      key={selectedBlock.id}
                      block={selectedBlock}
                      onUpdate={updateBlock}
                      onDelete={() => deleteBlock(selectedBlock.id)}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <div className="h-12 w-12 rounded-xl bg-white/[0.04] flex items-center justify-center">
                        <MousePointerClick className="h-5 w-5 text-[#7a7a7a]" />
                      </div>
                      <p className="text-[13px] text-[#7a7a7a] text-center">Select a component to edit</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {showExport && (
          <ExportModal
            components={components}
            templateName={templateName}
            templateId={template.id}
            onClose={() => setShowExport(false)}
          />
        )}

        <UnsavedChangesDialog
          open={showLeaveDialog}
          onClose={() => setShowLeaveDialog(false)}
          onLeave={() => {
            setShowLeaveDialog(false);
            onBack();
          }}
        />

        {pendingPresetId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-[420px] bg-[#111111] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5">
              <div className="space-y-2">
                <h3 className="text-[16px] font-semibold text-white">Replace current content?</h3>
                <p className="text-[13px] text-[#7a7a7a] leading-relaxed">
                  Loading{" "}
                  <span className="text-[#a8a8a8] font-medium">
                    {EMAIL_TEMPLATE_PRESETS.find((p) => p.id === pendingPresetId)?.name}
                  </span>{" "}
                  will replace all blocks on the canvas. You can undo with Ctrl+Z.
                </p>
              </div>
              <div className="flex items-center gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setPendingPresetId(null)}
                  className="h-10 px-5 rounded-lg border border-white/10 text-[13px] text-[#a8a8a8] hover:bg-white/[0.06] hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => pendingPresetId && loadEmailPreset(pendingPresetId)}
                  className="h-10 px-5 rounded-lg bg-brand text-brand-foreground text-[13px] font-medium hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)] active:scale-[0.97] transition-all cursor-pointer"
                >
                  Replace content
                </button>
              </div>
            </div>
          </div>
        )}

      </DndProvider>
    </NetworkMailEditorProvider>
  );
}

type SortMode = "newest" | "oldest";

// Temporary snippet — merged into NetworkMailApp.tsx

function mapApiTemplate(t: TemplateListItem): LibraryTemplate {
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    status: t.status,
    createdDate: formatTemplateListDate(t.createdAt),
    uses: t.useCount,
    thumbnailUrl: t.thumbnailUrl,
  };
}

function TemplateLibrarySection({ onEditingChange }: { onEditingChange?: (editing: boolean) => void }) {
  const [activeTab, setActiveTab] = useState<TemplateCategory>("All Templates");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [templates, setTemplates] = useState<LibraryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ all: 0, draft: 0, published: 0 });
  const [previewTemplate, setPreviewTemplate] = useState<LibraryTemplate | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editorTemplate, setEditorTemplate] = useState<EditorTemplate | null>(null);
  const [exitEditorNonce, setExitEditorNonce] = useState(0);
  const editorTemplateRef = useRef(editorTemplate);
  editorTemplateRef.current = editorTemplate;

  useEffect(() => {
    onEditingChange?.(!!editorTemplate);
  }, [editorTemplate, onEditingChange]);

  useEffect(() => {
    return () => onEditingChange?.(false);
  }, [onEditingChange]);

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const section = (event as CustomEvent<{ section?: NetworkMailSection }>).detail
        ?.section;
      if (!section || !editorTemplateRef.current) return;
      if (section === "template-library") {
        setExitEditorNonce((n) => n + 1);
        return;
      }
      setEditorTemplate(null);
    };
    window.addEventListener("network-mail:inline-navigate", onNavigate);
    return () => window.removeEventListener("network-mail:inline-navigate", onNavigate);
  }, []);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const onOpenCreateTemplate = () => {
      setShowCreateModal(true);
    };
    window.addEventListener("network-mail:open-create-template", onOpenCreateTemplate);
    return () => {
      window.removeEventListener("network-mail:open-create-template", onOpenCreateTemplate);
    };
  }, []);

  const fetchTemplates = useCallback(async () => {
    const orgId = getNetworkMailOrgId();
    if (!orgId) {
      setTemplates([]);
      setLoading(false);
      toast.error("No organization selected");
      return;
    }
    setLoading(true);
    try {
      const res = await listTemplates({
        orgId,
        category:
          activeTab === "All Templates" ? undefined : (activeTab as MailTemplateCategory),
        search: debouncedSearch || undefined,
        sort: "newest",
      });
      setTemplates(res.templates.map(mapApiTemplate));
      setCounts(res.counts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load templates");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedSearch]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const displayedTemplates = useMemo(() => {
    if (sortMode === "oldest") return [...templates].reverse();
    return templates;
  }, [templates, sortMode]);

  const handleCreate = useCallback(
    async ({ name, category }: { name: string; category: string }) => {
      const orgId = getNetworkMailOrgId();
      if (!orgId) {
        toast.error("No organization selected");
        throw new Error("No organization selected");
      }
      const created = await createTemplate(orgId, {
        name,
        category: category as MailTemplateCategory,
      });
      setEditorTemplate({
        id: created.id,
        name: created.name,
        category: created.category,
      });
    },
    [],
  );

  const openEditor = useCallback((t: LibraryTemplate) => {
    setEditorTemplate({ id: t.id, name: t.name, category: t.category });
  }, []);

  const handleDelete = useCallback(
    async (t: LibraryTemplate) => {
      const orgId = getNetworkMailOrgId();
      if (!orgId) {
        toast.error("No organization selected");
        return;
      }
      if (!window.confirm(`Delete "${t.name}"? This cannot be undone.`)) return;
      setDeletingId(t.id);
      try {
        await deleteTemplate(orgId, t.id);
        toast.success("Template deleted");
        if (previewTemplate?.id === t.id) setPreviewTemplate(null);
        await fetchTemplates();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete template");
      } finally {
        setDeletingId(null);
      }
    },
    [fetchTemplates, previewTemplate],
  );

  const exitEditor = useCallback(() => {
    setEditorTemplate(null);
    setExitEditorNonce(0);
    void fetchTemplates();
  }, [fetchTemplates]);

  if (editorTemplate) {
    return (
      <TemplateEditorView
        template={editorTemplate}
        exitRequestNonce={exitEditorNonce}
        onBack={exitEditor}
      />
    );
  }

  return (
    <div className="space-y-0">
      <div className="flex items-center gap-0 overflow-x-auto border-b border-white/8 -mx-6 px-6 scrollbar-none">
        {TEMPLATE_CATEGORIES.map((cat) => {
          const isActive = activeTab === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`relative shrink-0 px-4 py-3 text-sm sm:text-base transition-colors whitespace-nowrap cursor-pointer ${isActive ? "text-brand" : "text-[#7a7a7a] hover:text-[#a8a8a8]"
                }`}
            >
              {cat}
              {isActive && (
                <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-brand rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/8 -mx-6 px-6 py-4">
        <div className="relative w-full sm:max-w-[448px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7a7a7a]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-white/10 bg-transparent text-sm sm:text-base text-white placeholder:text-white/50 outline-none focus:border-brand/40 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSortMode("newest")}
            className={`h-9 px-4 rounded-full text-sm font-medium transition-colors cursor-pointer ${sortMode === "newest"
              ? "bg-brand/15 text-brand"
              : "bg-white/5 text-[#a8a8a8] hover:bg-white/8"
              }`}
          >
            Newest
          </button>
          <button
            onClick={() => setSortMode("oldest")}
            className={`h-9 px-4 rounded-full text-sm font-medium transition-colors cursor-pointer ${sortMode === "oldest"
              ? "bg-brand/15 text-brand"
              : "bg-white/5 text-[#a8a8a8] hover:bg-white/8"
              }`}
          >
            Oldest
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-6">
        <div
          onClick={() => setShowCreateModal(true)}
          className="border-2 border-dashed border-white/15 rounded-xl flex flex-col overflow-hidden cursor-pointer hover:border-white/25 transition-colors group min-h-[280px]"
        >
          <div className="flex-1 flex flex-col items-center justify-center py-12 sm:py-16 gap-3 px-4">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center group-hover:border-brand/40 transition-colors">
              <Plus className="h-6 w-6 sm:h-7 sm:w-7 text-[#7a7a7a] group-hover:text-brand transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-sm sm:text-base font-medium text-white">Start from scratch</p>
              <p className="text-xs sm:text-sm text-[#7a7a7a] mt-0.5">No preset blocks</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="col-span-full flex items-center justify-center py-16">
            <div className="h-8 w-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayedTemplates.length === 0 ? (
          <div className="col-span-full py-12 text-center text-[#7a7a7a] text-sm">
            No templates found
          </div>
        ) : (
          displayedTemplates.map((template) => (
            <div
              key={template.id}
              className="border border-white/10 rounded-xl flex flex-col overflow-hidden bg-[#111111] hover:border-white/20 transition-colors"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => setPreviewTemplate(template)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPreviewTemplate(template);
                  }
                }}
                className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-inset"
              >
                <TemplateLibraryThumbnail template={template} />

                <div className="flex flex-col gap-1 px-3 sm:px-4 pt-3 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm sm:text-base font-medium text-white leading-snug line-clamp-2">
                      {template.name}
                    </h4>
                    {template.status === "draft" && (
                      <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#7a7a7a]">Created {template.createdDate}</p>
                </div>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-2 px-3 sm:px-4 pb-3 sm:pb-4">
                <button
                  type="button"
                  onClick={() => openEditor(template)}
                  className="h-8 px-2.5 sm:px-3 rounded-md border border-white/20 text-[11px] sm:text-xs font-medium text-white hover:bg-white/[0.06] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                >
                  Edit Template
                </button>
                <button
                  type="button"
                  onClick={() => openEditor(template)}
                  className="h-8 px-2.5 sm:px-3 rounded-md bg-brand text-[11px] sm:text-xs font-medium text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                >
                  Use Template
                </button>
                <button
                  type="button"
                  disabled={deletingId === template.id}
                  onClick={() => void handleDelete(template)}
                  className="ml-auto h-8 w-8 rounded-md flex items-center justify-center text-red-400 hover:bg-red-500/10 hover:text-red-300 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Delete ${template.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onEdit={() => {
            openEditor(previewTemplate);
            setPreviewTemplate(null);
          }}
        />
      )}

      {showCreateModal && (
        <CreateTemplateModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

const CAMPAIGN_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "Delivered", label: "Delivered" },
  { value: "Scheduled", label: "Scheduled" },
  { value: "Draft", label: "Draft" },
  { value: "Sending", label: "Sending" },
  { value: "Failed", label: "Failed" },
] as const;

type CampaignStatusFilter = (typeof CAMPAIGN_STATUS_OPTIONS)[number]["value"];

const CAMPAIGNS_PAGE_SIZE = 10;

/** Refresh cadence while a campaign is still scheduled or sending. */
const CAMPAIGNS_POLL_MS = 30_000;
/** A send in flight finishes in seconds, so waiting 30s to notice reads as broken. */
const CAMPAIGNS_ACTIVE_POLL_MS = 4_000;

function mapCampaignListItemToRow(item: CampaignListItem): CampaignRow {
  const net = item.netRecipientCount || item.recipientCount || 0;
  const sentDate =
    formatCampaignListDate(item.sentAt) ??
    formatCampaignListDate(item.scheduledFor);
  const status = apiStatusToDisplayStatus(item.status) as CampaignRow["status"];
  return {
    id: item.id,
    name: item.campaignName,
    template: item.templateName ?? "—",
    recipients: item.recipientCount,
    sentDate,
    status,
    delivered: item.deliveredCount,
    total: net,
  };
}

function CampaignsSection({
  openCreateCampaignRequest = 0,
  onCreateCampaignRequestHandled,
}: {
  openCreateCampaignRequest?: number;
  onCreateCampaignRequestHandled?: () => void;
}) {
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [viewingCampaignId, setViewingCampaignId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<CampaignStatusFilter>("all");
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteCampaignId, setDeleteCampaignId] = useState<string | null>(null);

  useEffect(() => {
    if (!openCreateCampaignRequest) return;
    setViewingCampaignId(null);
    setEditingCampaignId(null);
    setIsCreatingCampaign(true);
    onCreateCampaignRequestHandled?.();
  }, [openCreateCampaignRequest, onCreateCampaignRequestHandled]);

  const loadCampaigns = useCallback(async (silent = false) => {
    const orgId = getNetworkMailOrgId();
    if (!orgId) {
      setCampaigns([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const apiStatus = apiStatusToTableFilter(statusFilter);
      const res = await listCampaigns(orgId, {
        search: searchQuery.trim() || undefined,
        status: apiStatus,
        limit: CAMPAIGNS_PAGE_SIZE,
        offset: (page - 1) * CAMPAIGNS_PAGE_SIZE,
        sort: "newest",
      });
      setCampaigns(res.campaigns.map(mapCampaignListItemToRow));
      setTotal(res.total);
    } catch {
      if (silent) return;
      setCampaigns([]);
      setTotal(0);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [searchQuery, statusFilter, page, refreshKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCampaigns();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadCampaigns]);

  // A campaign is sent by a server-side worker, so nothing pushes the flip to
  // this list. Refresh quietly while any row can still change: fast while a
  // send is actually running, lazily for a schedule that may be hours away.
  const pollMs = useMemo(() => {
    if (campaigns.some((c) => c.status === "Sending")) return CAMPAIGNS_ACTIVE_POLL_MS;
    if (campaigns.some((c) => c.status === "Scheduled")) return CAMPAIGNS_POLL_MS;
    return 0;
  }, [campaigns]);

  useEffect(() => {
    if (!pollMs) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void loadCampaigns(true);
    }, pollMs);
    return () => clearInterval(timer);
  }, [pollMs, loadCampaigns]);

  // Coming back to the tab should show the current state, not a stale snapshot.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void loadCampaigns(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [loadCampaigns]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  const handleDuplicate = async (id: string) => {
    const orgId = getNetworkMailOrgId();
    if (!orgId) return;
    try {
      const duplicated = await duplicateCampaign(orgId, id);
      setRefreshKey((k) => k + 1);
      toast.success("Campaign duplicated — review and launch when ready");
      setEditingCampaignId(duplicated.id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to duplicate campaign",
      );
    }
  };

  const handleEditDraft = (id: string) => {
    setViewingCampaignId(null);
    setEditingCampaignId(id);
  };

  const handleCampaignRowClick = (campaign: CampaignRow) => {
    if (campaign.status === "Draft") {
      setViewingCampaignId(null);
      setEditingCampaignId(campaign.id);
      return;
    }
    setEditingCampaignId(null);
    setViewingCampaignId(campaign.id);
  };

  const handleDelete = (id: string) => {
    setDeleteCampaignId(id);
  };

  const statusFilterLabel =
    CAMPAIGN_STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ??
    "All statuses";

  if (viewingCampaignId) {
    return (
      <CampaignDetailsView
        campaignId={viewingCampaignId}
        onBack={() => setViewingCampaignId(null)}
      />
    );
  }

  return (
    <>
      <div className="space-y-0">
        {/* <div className="flex items-center justify-between border-b border-white/8 pb-4 -mx-6 px-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-2xl font-normal text-white leading-8">
            Campaigns
          </h3>
          <p className="text-sm text-[#a8a8a8] leading-5">
            Create and manage your email campaigns
          </p>
        </div>
      </div> */}

        {/* <div className="flex items-center justify-between border-b border-white/8 -mx-6  px-6 py-4">
        <div className="relative w-full max-w-[448px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7a7a7a]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search campaigns..."
            className="w-full h-[41px] pl-10 pr-4 rounded-lg border border-white/10 bg-transparent text-base text-white placeholder:text-white/50 outline-none focus:border-brand/40 transition-colors"
          />
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => setStatusDropdownOpen((open) => !open)}
              className={`h-[38px] min-w-[130px] px-3 rounded-lg border bg-transparent text-sm text-white flex items-center justify-between gap-2 cursor-pointer outline-none transition-colors ${
                statusDropdownOpen
                  ? "border-brand/40"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              <span className="truncate">{statusFilterLabel}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[#7a7a7a] transition-transform duration-200 ${
                  statusDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {statusDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-[9]"
                  onClick={() => setStatusDropdownOpen(false)}
                />
                <div className="absolute top-full right-0 mt-1.5 min-w-[130px] bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl shadow-black/40 py-1 z-10 overflow-hidden">
                  {CAMPAIGN_STATUS_OPTIONS.map((option) => {
                    const selected = statusFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setStatusFilter(option.value);
                          setStatusDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                          selected
                            ? "bg-brand/15 text-brand"
                            : "text-[#a8a8a8] hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
         
        </div>
      </div> */}

        <div className="mt-0">
          <CampaignTable
            campaigns={campaigns}
            total={total}
            page={page}
            onPageChange={setPage}
            loading={loading}
            onRowClick={handleCampaignRowClick}
            onEdit={handleEditDraft}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
          />
        </div>

        {deleteCampaignId && (
          <DeleteCampaignDialog
            open={!!deleteCampaignId}
            campaignName={campaigns.find((c) => c.id === deleteCampaignId)?.name ?? "this campaign"}
            onClose={() => setDeleteCampaignId(null)}
            onConfirm={async () => {
              const orgId = getNetworkMailOrgId();
              if (!orgId) return;
              try {
                await deleteCampaign(orgId, deleteCampaignId);
                setRefreshKey((k) => k + 1);
                toast.success("Campaign deleted successfully");
              } catch {
                toast.error("Failed to delete campaign");
              } finally {
                setDeleteCampaignId(null);
              }
            }}
          />
        )}
      </div>

      {(isCreatingCampaign || editingCampaignId) && (
        <CampaignCreateFlow
          editCampaignId={editingCampaignId ?? undefined}
          onExit={() => {
            setIsCreatingCampaign(false);
            setEditingCampaignId(null);
          }}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </>
  );
}

function NetworkMailComingSoon({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof BarChart3;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/8 pb-6 -mx-6 px-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-2xl font-normal text-white leading-8">{title}</h3>
          <p className="text-sm text-[#a8a8a8] leading-5">{description}</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[320px] rounded-xl border border-white/8 bg-white/[0.02] px-6 py-12 text-center">
        <div className="h-14 w-14 rounded-xl bg-brand/10 ring-1 ring-brand/20 flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-brand" />
        </div>
        <p className="text-sm font-medium text-white">Coming soon</p>
        <p className="text-xs text-[#7a7a7a] mt-1 max-w-sm">
          This section is under development and will be available in a future
          update.
        </p>
      </div>
    </div>
  );
}

function ReportsSection() {
  return (
    <NetworkMailComingSoon
      icon={BarChart3}
      title="Reports"
      description="Campaign analytics and performance metrics"
    />
  );
}

function SettingsSection() {
  return (
    <NetworkMailComingSoon
      icon={Settings}
      title="Settings"
      description="Configure your Network Mail workspace"
    />
  );
}

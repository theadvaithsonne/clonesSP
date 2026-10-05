"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Check, Loader2, SendHorizonal } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

import {
  createTemplate,
  formatTemplateListDate,
  getNetworkMailOrgId,
  listTemplates,
  updateTemplate,
  type TemplateCategory as MailTemplateCategory,
} from "@/lib/network-mail-api";
import { buildEmailTemplatePreset } from "@/components/dashboard/inlineApps/network-mail/email-template-presets";
import { buildTemplateHtmlBody } from "@/components/dashboard/inlineApps/network-mail/email-html-export";
import { CreateTemplateModal } from "@/components/dashboard/inlineApps/network-mail/create-template-modal";
import {
  TemplateEditorModal,
  type EditorModalTemplate,
} from "@/components/dashboard/inlineApps/network-mail/template-editor-modal";
import { TemplatePickerDropdown } from "@/components/dashboard/inlineApps/network-mail/campaign-create/template-picker-dropdown";
import type { CampaignTemplateItem } from "@/components/dashboard/inlineApps/network-mail/campaign-create/types";
import {
  EmailFullPreviewModal,
  EmailPreviewCard,
} from "@/components/shared/EmailTemplatePreview";
import {
  DEFAULT_ORG_WELCOME_TEMPLATE_ID,
  DEFAULT_ORG_WELCOME_TEMPLATE_NAME,
  applyOrgWelcomeSampleData,
  buildOrgWelcomeOverrides,
  resolveOrgWelcomeEmailHtml,
  type OrgWelcomePreviewContext,
} from "@/lib/org-welcome-email-template";
import { getUserData } from "@/utils/api";

/**
 * Welcome email picker for Manage Organization.
 *
 * Unlike the product/course order alerts there is no on/off toggle — a welcome
 * email always goes out when someone joins. The founder only chooses which
 * template it uses: the built-in Garage default, or one they built in Network
 * Mail.
 */

const DEFAULT_ENTRY: CampaignTemplateItem = {
  id: DEFAULT_ORG_WELCOME_TEMPLATE_ID,
  name: DEFAULT_ORG_WELCOME_TEMPLATE_NAME,
  category: "Transactional",
  createdDate: "",
  uses: 0,
  thumbnailUrl: null,
};

/** Stacks above the Manage Organization modal (z-[1000]) and its delete dialog (z-[1999]). */
const CREATE_MODAL_Z = 2100;
const FULL_PREVIEW_Z = 2150;
const EDITOR_MODAL_Z = 2200;

export interface OrgWelcomeEmailValue {
  templateId: string;
  templateName: string;
}

export function OrgWelcomeEmailSection({
  orgId,
  value,
  onChange,
  onTemplateHtmlChange,
  org,
}: {
  orgId: string;
  value: OrgWelcomeEmailValue;
  onChange: (next: OrgWelcomeEmailValue) => void;
  /**
   * Pushes the rendered HTML up so Manage Organization can snapshot it onto the
   * org at save time. `null` while it is still resolving or has failed to
   * resolve — `failure` separates the two, so the caller can tell the founder to
   * pick another template instead of waiting for something that never arrives.
   */
  onTemplateHtmlChange: (html: string | null, failure?: string | null) => void;
  /** The org being edited, live from the form — so the preview shows itself. */
  org: OrgWelcomePreviewContext;
}) {
  const { templateId, templateName } = value;

  const [templates, setTemplates] = useState<CampaignTemplateItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editorTemplate, setEditorTemplate] = useState<EditorModalTemplate | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Guards against a slow template fetch overwriting a newer selection.
  const previewRequestRef = useRef(0);

  // Held in a ref so callers can pass an inline callback without the resolve
  // effect below re-firing on every parent render.
  const htmlChangeRef = useRef(onTemplateHtmlChange);
  useEffect(() => {
    htmlChangeRef.current = onTemplateHtmlChange;
  }, [onTemplateHtmlChange]);
  const emitHtml = useCallback((html: string | null, failure?: string | null) => {
    htmlChangeRef.current(html, failure ?? null);
  }, []);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // An org that has never been configured lands on the built-in default, which
  // is what it is already being sent today.
  useEffect(() => {
    if (!templateId) {
      onChangeRef.current({
        templateId: DEFAULT_ORG_WELCOME_TEMPLATE_ID,
        templateName: DEFAULT_ORG_WELCOME_TEMPLATE_NAME,
      });
    }
  }, [templateId]);

  const fetchTemplates = useCallback(async () => {
    const mailOrgId = getNetworkMailOrgId();
    if (!mailOrgId) {
      setTemplates([]);
      return;
    }
    setLoadingTemplates(true);
    try {
      const res = await listTemplates({ orgId: mailOrgId, sort: "newest" });
      setTemplates(
        res.templates.map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          createdDate: formatTemplateListDate(t.createdAt),
          uses: t.useCount,
          thumbnailUrl: t.thumbnailUrl,
        })),
      );
    } catch {
      // Non-fatal: the built-in default is always selectable even if Network
      // Mail is unreachable, so the founder is never blocked from saving.
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  // Resolve the HTML for whatever is selected, for both the preview and the
  // snapshot the backend will actually send.
  useEffect(() => {
    if (!templateId) {
      setPreviewHtml(null);
      setPreviewError(null);
      emitHtml(null);
      return;
    }
    const requestId = ++previewRequestRef.current;
    const mailOrgId = getNetworkMailOrgId();
    if (!mailOrgId && templateId !== DEFAULT_ORG_WELCOME_TEMPLATE_ID) {
      setPreviewError("No organization selected");
      emitHtml(null, "No organization selected");
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    resolveOrgWelcomeEmailHtml(mailOrgId || orgId, templateId)
      .then((html) => {
        if (previewRequestRef.current !== requestId) return;
        setPreviewHtml(html);
        emitHtml(html || null, html ? null : "The template rendered as empty");
      })
      .catch((err) => {
        if (previewRequestRef.current !== requestId) return;
        const message =
          err instanceof Error ? err.message : "Failed to load template";
        setPreviewHtml(null);
        setPreviewError(message);
        emitHtml(null, message);
      })
      .finally(() => {
        if (previewRequestRef.current === requestId) setPreviewLoading(false);
      });
  }, [templateId, orgId, emitHtml]);

  const dropdownItems = useMemo(
    () => [DEFAULT_ENTRY, ...templates.filter((t) => t.id !== DEFAULT_ENTRY.id)],
    [templates],
  );

  const previewOverrides = useMemo(
    () =>
      buildOrgWelcomeOverrides({
        ...org,
        // Mirrors the backend: the founder's own account email wins over the
        // org's provisioned @networkmail.com mailbox, which is usually not an
        // inbox they read. The signed-in founder is the one editing this.
        supportEmail: org.supportEmail || getUserData()?.email || "",
        orgUrl:
          org.orgUrl ||
          (typeof window !== "undefined" && orgId
            ? `${window.location.origin}/workspace?orgId=${orgId}`
            : ""),
      }),
    [org, orgId],
  );

  const previewSrcDoc = useMemo(
    () => (previewHtml ? applyOrgWelcomeSampleData(previewHtml, previewOverrides) : ""),
    [previewHtml, previewOverrides],
  );

  const selectTemplate = (id: string, name: string) =>
    onChange({ templateId: id, templateName: name });

  const [sendingTest, setSendingTest] = useState(false);
  const [testSent, setTestSent] = useState(false);

  /**
   * Runs through the backend rather than the local preview: the founder is
   * checking the email a member will actually receive, so it has to go through
   * the same merge engine `sendWelcomeEmail` uses. The built-in default sends no
   * HTML at all — the backend owns that layout, workshop cards included.
   */
  const sendTestEmail = async () => {
    const isDefault = templateId === DEFAULT_ORG_WELCOME_TEMPLATE_ID;
    if (!isDefault && !previewHtml) {
      toast.error(
        previewError
          ? `Couldn't load this template (${previewError}) — pick another one`
          : "Still loading this template — try again in a moment",
      );
      return;
    }

    setSendingTest(true);
    try {
      const res = await api<{ success: boolean; to: string }>(
        `/org/${orgId}/welcome-email/test`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            isDefault ? {} : { templateHtml: previewHtml || "" },
          ),
        },
      );
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
      toast.success(`Test email sent to ${res.to}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send the test email",
      );
    } finally {
      setSendingTest(false);
    }
  };

  const handleCreateTemplate = async ({
    name,
    category,
  }: {
    name: string;
    category: string;
  }) => {
    const mailOrgId = getNetworkMailOrgId();
    if (!mailOrgId) {
      toast.error("No organization selected");
      throw new Error("No organization selected");
    }
    const created = await createTemplate(mailOrgId, {
      name,
      category: category as MailTemplateCategory,
    });

    // Seed the new template with the welcome layout so the founder starts from
    // the Garage default rather than an empty canvas.
    try {
      const components = buildEmailTemplatePreset("org-welcome");
      await updateTemplate(mailOrgId, created.id, {
        components,
        htmlBody: buildTemplateHtmlBody(components, created.name),
      });
    } catch {
      // A seeding failure still leaves a usable (empty) template behind.
    }

    await fetchTemplates();
    selectTemplate(created.id, created.name);
    setEditorTemplate({ id: created.id, name: created.name, category });
    toast.success("Template created — opening the editor");
  };

  return (
    <div className="space-y-4">
      <TemplatePickerDropdown
        templates={dropdownItems}
        loading={loadingTemplates}
        selectedId={templateId}
        selectedName={templateName}
        onSelect={selectTemplate}
        label="Welcome Email Template"
        hint=""
        placeholder="Select template"
      />

      <EmailPreviewCard
        srcDoc={previewSrcDoc}
        loading={previewLoading}
        error={previewError}
        onExpand={() => setShowFullPreview(true)}
      />
      <p className="text-xs text-[#6a6a7a] -mt-2">
        Your organization details are real. The member&apos;s name is a
        placeholder — each new member&apos;s own details are filled in when the
        email sends.
      </p>

      <button
        type="button"
        onClick={sendTestEmail}
        disabled={sendingTest || previewLoading}
        className="w-full h-10 rounded-lg border border-[#2a2a35] bg-[#16161a] text-sm font-semibold text-[#c8c8d4] hover:bg-[#1d1d23] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {testSent ? (
          <>
            <Check className="w-4 h-4 text-emerald-400" /> Test email sent
          </>
        ) : sendingTest ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Sending...
          </>
        ) : (
          <>
            <SendHorizonal className="w-4 h-4" /> Send test email to my inbox
          </>
        )}
      </button>

      <div>
        <label className="block text-xs font-semibold text-[#6a6a7a] mb-2 uppercase tracking-wide">
          Custom Template
        </label>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="w-full h-11 rounded-lg bg-brand text-brand-foreground text-sm font-bold hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          Create Email Template
          <ArrowUpRight className="w-4 h-4" />
        </button>
        <p className="text-xs text-[#6a6a7a] mt-2">
          Opens Network Mail here — build it, come back, and it&apos;s ready to
          select.
        </p>
      </div>

      {/* Portaled: the Manage Organization panel is `transform`ed, which would
          otherwise make these fixed-position modals position against it. */}
      {showCreateModal &&
        typeof document !== "undefined" &&
        createPortal(
          <CreateTemplateModal
            zIndex={CREATE_MODAL_Z}
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreateTemplate}
          />,
          document.body,
        )}

      {editorTemplate && (
        <TemplateEditorModal
          template={editorTemplate}
          zIndex={EDITOR_MODAL_Z}
          onClose={() => {
            setEditorTemplate(null);
            void fetchTemplates();
            // Re-resolve so an edit made in the builder lands in the snapshot.
            previewRequestRef.current++;
            const mailOrgId = getNetworkMailOrgId() || orgId;
            if (mailOrgId && templateId) {
              resolveOrgWelcomeEmailHtml(mailOrgId, templateId)
                .then((html) => {
                  setPreviewHtml(html);
                  emitHtml(html || null, html ? null : "The template rendered as empty");
                })
                .catch(() => undefined);
            }
          }}
        />
      )}

      {showFullPreview && (
        <EmailFullPreviewModal
          srcDoc={previewSrcDoc}
          zIndex={FULL_PREVIEW_Z}
          note="Shown with your organization's details — the member's own name is filled in when it sends."
          onClose={() => setShowFullPreview(false)}
        />
      )}
    </div>
  );
}

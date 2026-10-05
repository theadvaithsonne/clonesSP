"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  EmailFullPreviewModal,
  EmailPreviewCard,
} from "@/components/shared/EmailTemplatePreview";
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
  DEFAULT_PRODUCT_EMAIL_TEMPLATE_ID,
  DEFAULT_PRODUCT_EMAIL_TEMPLATE_NAME,
  applySampleMergeData,
  escapeMergeValue,
  formatPreviewMoney,
  resolveProductEmailHtml,
} from "@/lib/product-email-template";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { getUserData } from "@/utils/api";

const DEFAULT_ENTRY: CampaignTemplateItem = {
  id: DEFAULT_PRODUCT_EMAIL_TEMPLATE_ID,
  name: DEFAULT_PRODUCT_EMAIL_TEMPLATE_NAME,
  category: "Transactional",
  createdDate: "",
  uses: 0,
  thumbnailUrl: null,
};

export interface ProductEmailAlertsValue {
  enabled: boolean;
  templateId: string;
  templateName: string;
}

/** Live form values, so the preview shows this product rather than sample text. */
export interface ProductEmailPreviewContext {
  productName?: string;
  price?: number;
  currency?: string;
  isFree?: boolean;
}

export function ProductEmailAlertsSection({
  value,
  onChange,
  onTemplateHtmlChange,
  error,
  product,
}: {
  value: ProductEmailAlertsValue;
  onChange: (next: ProductEmailAlertsValue) => void;
  /**
   * Pushes the rendered HTML up so the form can snapshot it onto the product at
   * save time. `null` while it is still resolving or has failed to resolve —
   * `failure` separates the two, so the form can tell the founder to pick
   * another template instead of telling them to wait for something that will
   * never arrive.
   */
  onTemplateHtmlChange: (html: string | null, failure?: string | null) => void;
  error?: string | null;
  product?: ProductEmailPreviewContext;
}) {
  const { enabled, templateId, templateName } = value;

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

  const fetchTemplates = useCallback(async () => {
    const orgId = getNetworkMailOrgId();
    if (!orgId) {
      setTemplates([]);
      return;
    }
    setLoadingTemplates(true);
    try {
      const res = await listTemplates({ orgId, sort: "newest" });
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
    if (enabled) void fetchTemplates();
  }, [enabled, fetchTemplates]);

  // Resolve the HTML for whatever is selected, for both the preview and the
  // snapshot the backend will actually send.
  useEffect(() => {
    if (!enabled || !templateId) {
      setPreviewHtml(null);
      setPreviewError(null);
      emitHtml(null);
      return;
    }
    const requestId = ++previewRequestRef.current;
    const orgId = getNetworkMailOrgId();
    if (!orgId) {
      setPreviewError("No organization selected");
      emitHtml(null, "No organization selected");
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    resolveProductEmailHtml(orgId, templateId)
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
  }, [enabled, templateId, emitHtml]);

  // The founder's own org, so the preview says "Acme Ltd" and not a placeholder.
  const [org, setOrg] = useState<{ name?: string; supportEmail?: string } | null>(null);

  useEffect(() => {
    if (!enabled || org) return;
    const orgId = getNetworkMailOrgId();
    if (!orgId) return;
    let cancelled = false;
    api<{ org?: { name?: string; mailboxConfig?: { email?: string } } }>(
      `/org/${orgId}`,
      { method: "GET", headers: { Authorization: `Bearer ${getToken()}` } },
    )
      .then((res) => {
        if (cancelled) return;
        setOrg({
          name: res?.org?.name,
          // Mirrors the backend: the founder's own account email wins over the
          // org's provisioned @networkmail.com mailbox, which is usually not an
          // inbox they read. The signed-in user creating the product is that founder.
          supportEmail: getUserData()?.email || res?.org?.mailboxConfig?.email,
        });
      })
      // Non-fatal — the preview just falls back to the generic sample values.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled, org]);

  const dropdownItems = useMemo(
    () => [DEFAULT_ENTRY, ...templates.filter((t) => t.id !== DEFAULT_ENTRY.id)],
    [templates],
  );

  /**
   * Real values for the tags we can know at design time — the founder's org and
   * the product being edited. Everything else (customer name, order id, date)
   * stays sample data, since no order exists yet.
   */
  const previewOverrides = useMemo(() => {
    const next: Record<string, string> = {};
    if (org?.name) next.business_name = escapeMergeValue(org.name);
    if (org?.supportEmail) next.support_option = escapeMergeValue(org.supportEmail);

    const productName = product?.productName?.trim();
    if (productName) {
      next.order_items = `<strong>${escapeMergeValue(productName)}</strong> × 1`;
    }
    const amount = product?.isFree ? 0 : product?.price ?? null;
    if (amount !== null && Number.isFinite(amount)) {
      next.order_total = escapeMergeValue(
        formatPreviewMoney(amount as number, product?.currency),
      );
    }
    return next;
  }, [org, product?.productName, product?.price, product?.currency, product?.isFree]);

  const previewSrcDoc = useMemo(
    () => (previewHtml ? applySampleMergeData(previewHtml, previewOverrides) : ""),
    [previewHtml, previewOverrides],
  );

  const selectTemplate = (id: string, name: string) =>
    onChange({ ...value, templateId: id, templateName: name });

  const handleCreateTemplate = async ({
    name,
    category,
  }: {
    name: string;
    category: string;
  }) => {
    const orgId = getNetworkMailOrgId();
    if (!orgId) {
      toast.error("No organization selected");
      throw new Error("No organization selected");
    }
    const created = await createTemplate(orgId, {
      name,
      category: category as MailTemplateCategory,
    });

    // Seed the new template with the order-confirmation layout so the founder
    // starts from the Garage default rather than an empty canvas.
    try {
      const components = buildEmailTemplatePreset("order-confirmation");
      await updateTemplate(orgId, created.id, {
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
      <div>
        <label className="block text-xs font-semibold text-[#8b8c9d] mb-2 uppercase tracking-wide">
          Email Alerts
        </label>
        <p className="text-sm text-white mb-2">
          Do you want to send Email alerts to your customers?
        </p>
        <div className="flex rounded-lg border border-[#2a2a35] bg-[#1E1E1E] p-1 w-full max-w-[260px]">
          <button
            type="button"
            onClick={() => onChange({ ...value, enabled: false })}
            className={cn(
              "flex-1 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all text-center",
              !enabled ? "bg-brand text-brand-foreground" : "text-[#9fa0b8] hover:text-white",
            )}
          >
            No
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...value, enabled: true })}
            className={cn(
              "flex-1 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all text-center",
              enabled ? "bg-brand text-brand-foreground" : "text-[#9fa0b8] hover:text-white",
            )}
          >
            Yes
          </button>
        </div>
        <p className="text-xs text-[#8b8c9d] mt-2">
          Sent automatically once the customer&apos;s payment succeeds.
        </p>
      </div>

      {enabled && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <TemplatePickerDropdown
            templates={dropdownItems}
            loading={loadingTemplates}
            selectedId={templateId}
            selectedName={templateName}
            onSelect={selectTemplate}
            label="Email Template"
            hint=""
            placeholder="Select template"
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          {templateId && (
            <>
              <EmailPreviewCard
                srcDoc={previewSrcDoc}
                loading={previewLoading}
                error={previewError}
                onExpand={() => setShowFullPreview(true)}
              />
              <p className="text-xs text-[#8b8c9d] -mt-2">
                Your company, contact email and product details are real. The
                customer name, order id and date are placeholders — each buyer&apos;s
                own details are filled in when the email sends.
              </p>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#8b8c9d] mb-2 uppercase tracking-wide">
              Custom Template
            </label>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="w-full h-12 rounded-lg bg-brand text-brand-foreground text-sm font-bold hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              Create Email Template
              <ArrowUpRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-[#8b8c9d] mt-2">
              Opens Networkmail here build it, come back, and it&apos;s ready to select.
            </p>
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateTemplateModal
          zIndex={730}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateTemplate}
        />
      )}

      {editorTemplate && (
        <TemplateEditorModal
          template={editorTemplate}
          onClose={() => {
            setEditorTemplate(null);
            void fetchTemplates();
            // Re-resolve so an edit made in the builder lands in the snapshot.
            previewRequestRef.current++;
            const orgId = getNetworkMailOrgId();
            if (orgId && templateId) {
              resolveProductEmailHtml(orgId, templateId)
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
          note="Shown with sample data — real order details are filled in when it sends."
          onClose={() => setShowFullPreview(false)}
        />
      )}
    </div>
  );
}

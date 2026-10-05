"use client";

import { useCallback, useState } from "react";

import type { ProductEmailAlerts } from "@/lib/feed-api";
import { DEFAULT_PRODUCT_EMAIL_TEMPLATE_ID } from "@/lib/product-email-template";
import { getNetworkMailOrgId, recordTemplateUse } from "@/lib/network-mail-api";
import type { ProductEmailAlertsValue } from "./ProductEmailAlertsSection";

const EMPTY_VALUE: ProductEmailAlertsValue = {
  enabled: false,
  templateId: "",
  templateName: "",
};

/**
 * Shared form logic for the post-purchase email alerts section, used by the
 * product, course and community forms. `emailTemplateHtml` is the rendered
 * snapshot the backend sends — Network Mail is a separate service the backend
 * can't reach, so the HTML has to travel with the saved entity.
 */
export function useEmailAlerts(initial?: ProductEmailAlerts | null) {
  const [value, setValue] = useState<ProductEmailAlertsValue>(() =>
    initial
      ? {
          enabled: !!initial.enabled,
          templateId: initial.templateId || "",
          templateName: initial.templateName || "",
        }
      : EMPTY_VALUE,
  );
  // Re-resolved by the section from templateId; the saved copy only stands in
  // until that finishes, so a save-without-touching-email keeps the snapshot.
  const [templateHtml, setTemplateHtml] = useState<string | null>(
    initial?.templateHtml || null,
  );
  // Why the HTML is missing, when the section knows. Null while it is simply
  // still loading.
  const [templateFailure, setTemplateFailure] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onTemplateHtmlChange = useCallback(
    (html: string | null, failure?: string | null) => {
      setTemplateHtml(html);
      setTemplateFailure(failure ?? null);
    },
    [],
  );

  /** Copies a saved entity's alerts into the form (edit mode). */
  const hydrate = useCallback((saved?: ProductEmailAlerts | null) => {
    setValue({
      enabled: !!saved?.enabled,
      templateId: saved?.templateId || "",
      templateName: saved?.templateName || "",
    });
    setTemplateHtml(saved?.templateHtml || null);
    setTemplateFailure(null);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setValue(EMPTY_VALUE);
    setTemplateHtml(null);
    setTemplateFailure(null);
    setError(null);
  }, []);

  /**
   * Snapshot of the chosen order email, stored on the entity and re-synced on
   * every save.
   */
  const buildPayload = useCallback((): ProductEmailAlerts => {
    if (!value.enabled) {
      return { enabled: false, templateId: "", templateName: "", templateHtml: "" };
    }
    return {
      enabled: true,
      templateId: value.templateId,
      templateName: value.templateName,
      templateHtml: templateHtml || "",
      syncedAt: new Date().toISOString(),
    };
  }, [value, templateHtml]);

  /**
   * Returns the blocking error message (also stored in `error`), or null when
   * the section is valid. Callers own the toast so it composes with their
   * existing "first error wins" handling.
   */
  const validate = useCallback((): string | null => {
    if (value.enabled && !value.templateId) {
      const msg = "Please select an email template for your order alerts";
      setError(msg);
      return msg;
    }
    if (value.enabled && !templateHtml) {
      // The rendered snapshot is what the backend actually sends — saving
      // before it resolves would store an empty template and silently send
      // nothing on purchase. A failed resolve never recovers on its own, so
      // don't tell the founder to wait for it.
      const msg = templateFailure
        ? `Couldn't load your email template (${templateFailure}) — pick another template or reopen the builder`
        : "Still loading your email template — try again in a moment";
      setError(msg);
      return msg;
    }
    return null;
  }, [value, templateHtml, templateFailure]);

  /** Keeps Network Mail's use counts honest. Never blocks the save. */
  const noteTemplateUse = useCallback(() => {
    if (!value.enabled) return;
    const id = value.templateId;
    if (!id || id === DEFAULT_PRODUCT_EMAIL_TEMPLATE_ID) return;
    const orgId = getNetworkMailOrgId();
    if (!orgId) return;
    void recordTemplateUse(orgId, id).catch(() => undefined);
  }, [value]);

  const onChange = useCallback((next: ProductEmailAlertsValue) => {
    setValue(next);
    setError(null);
  }, []);

  return {
    value,
    error,
    templateHtml,
    /** Spread onto <ProductEmailAlertsSection>; add the `product` preview prop. */
    sectionProps: {
      value,
      onChange,
      onTemplateHtmlChange,
      error,
    },
    hydrate,
    reset,
    buildPayload,
    validate,
    noteTemplateUse,
  };
}

"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { CmsFormField, CmsFunnelRule, CmsPage, CmsPipeline } from "@/lib/cms/types";
import {
  connectCmsCrm,
  createCmsRule,
  deleteCmsRule,
  listCmsPipelines,
  listCmsRules,
  updateCmsRule,
} from "@/lib/cms/api";

export default function CrmFunnelMapping({
  open,
  page,
  formFields,
  onClose,
  onPageUpdate,
}: {
  open: boolean;
  page: CmsPage | null;
  formFields: CmsFormField[];
  onClose: () => void;
  onPageUpdate?: (page: CmsPage) => void;
}) {
  const [pipelines, setPipelines] = useState<CmsPipeline[]>([]);
  const [rules, setRules] = useState<CmsFunnelRule[]>([]);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [integrationComingSoon, setIntegrationComingSoon] = useState(false);

  const load = async () => {
    if (!page?.id) return;
    try {
      const [p, r] = await Promise.all([listCmsPipelines(), listCmsRules(page.id)]);
      setPipelines(p.pipelines || []);
      setRules(r.rules || []);
      setSyncEnabled(page.crmSyncEnabled !== false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load CRM mapping");
    }
  };

  useEffect(() => {
    if (open && page) load();
  }, [open, page?.id]);

  if (!open || !page) return null;

  const nonDefault = rules.filter((r) => !r.isDefault);
  const defaultRule = rules.find((r) => r.isDefault);

  const toggleSync = async () => {
    setBusy(true);
    try {
      const next = !syncEnabled;
      const { page: updated } = await connectCmsCrm(page.id, { crmSyncEnabled: next });
      setSyncEnabled(next);
      onPageUpdate?.(updated);
      toast.success(next ? "CRM sync enabled" : "CRM sync disabled");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update CRM connection");
    } finally {
      setBusy(false);
    }
  };

  const addRule = async () => {
    setBusy(true);
    try {
      const fieldKey = formFields[0]?.key || "industry";
      const { rule } = await createCmsRule(page.id, {
        name: `Rule ${nonDefault.length + 1}`,
        conditions: [
          { fieldKey, operator: "equals", value: "", logic: "AND" },
        ],
        funnelId: pipelines[0]?.id || "",
        priority: nonDefault.length,
        isActive: true,
      });
      setRules((prev) => [...prev.filter((r) => !r.isDefault), rule, ...prev.filter((r) => r.isDefault)]);
    } catch (err: any) {
      toast.error(err?.message || "Failed to add rule");
    } finally {
      setBusy(false);
    }
  };

  const patchRule = async (rule: CmsFunnelRule, patch: Partial<CmsFunnelRule>) => {
    try {
      const { rule: updated } = await updateCmsRule(page.id, rule.id, patch);
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err: any) {
      toast.error(err?.message || "Failed to update rule");
    }
  };

  const removeRule = async (ruleId: string) => {
    try {
      await deleteCmsRule(page.id, ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete rule");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="cms-ui max-h-[90vh] w-full max-w-[1100px] overflow-auto rounded-[14px] border border-[#2A2A2A] bg-[#0F0F0F] text-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#2A2A2A] bg-[#141414] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">CRM & Funnel Mapping</h2>
            <p className="text-sm text-[#888]">{page.name}</p>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer rounded p-1 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Garage CRM Connection</h3>
                  <p className="mt-1 text-sm">
                    <span className="text-[#22C55E]">Connected</span>
                    <span className="text-[#888]"> — API Syncing active (realtime).</span>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={toggleSync}
                  className="cursor-pointer text-sm text-[#EF4444] hover:underline"
                >
                  {syncEnabled ? "Disconnect" : "Connect"}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4">
              <h3 className="mb-3 font-semibold">Active Page Flows</h3>
              <div className="flex items-center justify-between rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-3">
                <div>
                  <p className="text-sm font-medium">{page.name}</p>
                  <p className="text-xs text-[#888]">
                    Routes to{" "}
                    {pipelines.find((p) => p.id === page.crmPipelineId)?.name ||
                      "selected funnel"}{" "}
                    ({page.leadCount || 0} leads)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleSync}
                  className={`h-5 w-9 cursor-pointer rounded-full ${syncEnabled ? "bg-brand" : "bg-[#2A2A2A]"}`}
                >
                  <span
                    className={`block h-4 w-4 rounded-full bg-white transition ${
                      syncEnabled ? "ml-4" : "ml-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div
              className="cursor-pointer rounded-xl border border-dashed border-[#2A2A2A] bg-[#141414] p-6 text-center text-sm text-[#888]"
              role="button"
              tabIndex={0}
              onClick={() => setIntegrationComingSoon(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setIntegrationComingSoon(true);
              }}
            >
              {integrationComingSoon ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-brand">Coming soon</p>
                  <p className="text-xs text-[#888]">
                    We&apos;re adding HubSpot / Salesforce / Zapier connection setup.
                  </p>
                  <button
                    type="button"
                    className="mx-auto cursor-pointer rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-1 text-xs text-white hover:border-brand"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIntegrationComingSoon(false);
                    }}
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <Plus className="mx-auto mb-2 h-5 w-5" />
                  Connect HubSpot, Salesforce or Zapier.
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Routing Rules & Logic</h3>
                <button
                  type="button"
                  disabled={busy}
                  onClick={addRule}
                  className="cursor-pointer rounded-lg border border-[#2A2A2A] px-2 py-1 text-xs text-white hover:border-brand"
                >
                  + Add Rule
                </button>
              </div>

              <div className="space-y-3">
                {nonDefault.map((rule, index) => {
                  const condition = rule.conditions?.[0] || {
                    fieldKey: formFields[0]?.key || "industry",
                    operator: "equals" as const,
                    value: "",
                  };
                  return (
                    <div
                      key={rule.id}
                      className="rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] p-3 text-sm"
                    >
                      <div className="mb-2 flex items-center justify-between text-xs text-[#888]">
                        <span>Rule {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeRule(rule.id)}
                          className="cursor-pointer text-[#EF4444]"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>IF</span>
                        <select
                          className="cursor-pointer rounded border border-[#2A2A2A] bg-[#141414] px-2 py-1 text-white"
                          value={condition.fieldKey}
                          onChange={(e) =>
                            patchRule(rule, {
                              conditions: [
                                { ...condition, fieldKey: e.target.value },
                              ],
                            })
                          }
                        >
                          {(formFields.length ? formFields : [{ key: "industry", label: "Industry" } as any]).map(
                            (f) => (
                              <option key={f.key} value={f.key}>
                                {f.label || f.key}
                              </option>
                            )
                          )}
                        </select>
                        <select
                          className="cursor-pointer rounded border border-[#2A2A2A] bg-[#141414] px-2 py-1 text-white"
                          value={condition.operator}
                          onChange={(e) =>
                            patchRule(rule, {
                              conditions: [
                                {
                                  ...condition,
                                  operator: e.target.value as any,
                                },
                              ],
                            })
                          }
                        >
                          <option value="equals">=</option>
                          <option value="not_equals">≠</option>
                          <option value="contains">contains</option>
                          <option value="starts_with">starts with</option>
                          <option value="greater_than">&gt;=</option>
                          <option value="less_than">&lt;</option>
                        </select>
                        <input
                          className="min-w-[100px] flex-1 rounded border border-[#2A2A2A] bg-[#141414] px-2 py-1"
                          value={String(condition.value || "")}
                          onChange={(e) =>
                            patchRule(rule, {
                              conditions: [{ ...condition, value: e.target.value }],
                            })
                          }
                          placeholder="Value"
                        />
                        <span>THEN</span>
                        <select
                          className="cursor-pointer rounded border border-[#2A2A2A] bg-[#141414] px-2 py-1 text-white"
                          value={rule.funnelId}
                          onChange={(e) => patchRule(rule, { funnelId: e.target.value })}
                        >
                          <option value="">Select funnel</option>
                          {pipelines.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}

                {defaultRule ? (
                  <div className="rounded-lg border-2 border-brand bg-[#1E1E1E] p-3 text-sm">
                    <p className="mb-2 text-xs font-bold text-brand">DEFAULT</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span>Route unmapped entries to</span>
                      <select
                        className="cursor-pointer rounded border border-[#2A2A2A] bg-[#141414] px-2 py-1 text-white"
                        value={defaultRule.funnelId}
                        onChange={(e) =>
                          patchRule(defaultRule, { funnelId: e.target.value })
                        }
                      >
                        <option value="">General Leads</option>
                        {pipelines.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4">
              <h3 className="mb-4 font-semibold">Routing Flow Visualization</h3>
              <div className="flex items-center justify-center gap-3 text-sm">
                <div className="rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-2">
                  Lead Form
                </div>
                <span className="text-[#888]">→</span>
                <div
                  className="cms-accent-on-yellow flex h-10 w-10 items-center justify-center rounded-full bg-brand text-lg font-bold !text-brand-foreground"
                  style={{ color: "#000000" }}
                >
                  ?
                </div>
                <span className="text-[#888]">→</span>
                <div className="rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-2">
                  Funnel Stages
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

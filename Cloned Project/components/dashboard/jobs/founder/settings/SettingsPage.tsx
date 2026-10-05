"use client";

// A18 · Jobs settings — careers page, email templates, rejection reasons,
// saved forms, default pipeline and data & privacy. Settings load once; each
// section edits its own draft and saves on its own, and SettingsPage asks
// before leaving a section with unsaved edits.

import React from "react";
import { Ban, FileStack, Globe, Mail, ShieldCheck, Workflow } from "lucide-react";
import * as jobsApi from "../../api";
import { ErrorState, LoadingBlock, PageHeader, useConfirm, useLoad } from "../../ui";
import type { JobsSettings } from "../../types";
import CareersPageSection from "./CareersPageSection";
import EmailTemplatesSection from "./EmailTemplatesSection";
import RejectionReasonsSection from "./RejectionReasonsSection";
import SavedFormsSection from "./SavedFormsSection";
import DefaultPipelineSection from "./DefaultPipelineSection";
import PrivacySection from "./PrivacySection";

type SectionKey = "careers" | "emails" | "reasons" | "forms" | "pipeline" | "privacy";

const SECTIONS: Array<{ key: SectionKey; label: string; icon: React.ReactNode }> = [
  { key: "careers", label: "Careers page", icon: <Globe className="h-4 w-4" /> },
  { key: "emails", label: "Email templates", icon: <Mail className="h-4 w-4" /> },
  { key: "reasons", label: "Rejection reasons", icon: <Ban className="h-4 w-4" /> },
  { key: "forms", label: "Saved forms", icon: <FileStack className="h-4 w-4" /> },
  { key: "pipeline", label: "Default pipeline", icon: <Workflow className="h-4 w-4" /> },
  { key: "privacy", label: "Data & privacy", icon: <ShieldCheck className="h-4 w-4" /> },
];

export default function SettingsPage() {
  const { data, setData, loading, error, reload } = useLoad(() => jobsApi.getSettings(), []);
  const [section, setSection] = React.useState<SectionKey>("careers");
  const [dirty, setDirty] = React.useState(false);
  const { confirm, confirmDialog } = useConfirm();

  // Saves answer with the settings only; keep the org, URL and consent text
  // from the first load.
  const onSaved = React.useCallback(
    (settings: JobsSettings) => setData((d) => (d ? { ...d, settings } : d)),
    [setData]
  );

  const choose = async (key: SectionKey) => {
    if (key === section) return;
    if (dirty) {
      const ok = await confirm({
        title: "Discard unsaved changes?",
        message: "You have edits in this section that haven't been saved.",
        confirmLabel: "Discard",
      });
      if (!ok) return;
    }
    setDirty(false);
    setSection(key);
  };

  const sectionProps = data ? { data, onSaved, onDirtyChange: setDirty } : null;

  return (
    <>
      <PageHeader
        title="Jobs settings"
        subtitle={
          data
            ? `How ${data.org.name} appears to candidates and how new jobs start out.`
            : "How your office appears to candidates and how new jobs start out."
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && !data ? (
          <LoadingBlock />
        ) : error ? (
          <div className="px-8 py-6">
            <ErrorState message={error} onRetry={() => reload()} />
          </div>
        ) : sectionProps ? (
          <div className="flex flex-col gap-6 px-8 py-6 md:flex-row">
            <nav className="shrink-0 md:w-56">
              <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-[#61627a]">Jobs settings</div>
              <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
                {SECTIONS.map((s) => {
                  const active = s.key === section;
                  return (
                    <li key={s.key} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => choose(s.key)}
                        className={[
                          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          active ? "bg-[#1f1f28] text-white" : "text-[#7c7d94] hover:bg-white/5 hover:text-white",
                        ].join(" ")}
                      >
                        {s.icon}
                        {s.label}
                        {active && dirty && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#fbbf24]" title="Unsaved changes" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="min-w-0 max-w-3xl flex-1">
              {section === "careers" && <CareersPageSection {...sectionProps} />}
              {section === "emails" && <EmailTemplatesSection {...sectionProps} />}
              {section === "reasons" && <RejectionReasonsSection {...sectionProps} />}
              {section === "forms" && <SavedFormsSection {...sectionProps} />}
              {section === "pipeline" && <DefaultPipelineSection {...sectionProps} />}
              {section === "privacy" && <PrivacySection {...sectionProps} />}
            </div>
          </div>
        ) : null}
      </div>
      {confirmDialog}
    </>
  );
}

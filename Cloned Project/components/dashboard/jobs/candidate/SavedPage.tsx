"use client";

// B6 · Saved — bookmarked jobs and job alerts in one place. Alerts email the
// member when a new role matches; every alert can be paused, edited or
// deleted, and chooses its own frequency.

import React from "react";
import { Bell, Bookmark, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  GOLD,
  LoadingBlock,
  PageHeader,
  RowMenu,
  SearchInput,
  UnderlineTabs,
  errorMessage,
  timeAgo,
  useConfirm,
  useLoad,
} from "../ui";
import AlertModal, { criteriaSummary, frequencyLabel } from "./AlertModal";
import { BOARD_PAGES, type SavedTab, useBoardNav, useBoardStore, useSavedStore } from "./boardNav";
import * as candidateApi from "./candidateApi";
import type { JobAlert, PublicJob } from "./candidateTypes";
import { JobCard } from "./shared";

export default function SavedPage() {
  const tab = useBoardStore((s) => s.savedTab);
  const setStore = useBoardStore((s) => s.set);
  const [alertModal, setAlertModal] = React.useState<{ open: boolean; alert: JobAlert | null }>({ open: false, alert: null });
  const [alertsVersion, setAlertsVersion] = React.useState(0);

  return (
    <>
      <PageHeader
        title="Saved"
        subtitle="Keep promising roles and alerts in one focused place."
        actions={
          tab === "alerts" ? (
            <Button onClick={() => setAlertModal({ open: true, alert: null })}>
              <Plus className="h-4 w-4" /> Create alert
            </Button>
          ) : undefined
        }
      >
        <UnderlineTabs<SavedTab>
          value={tab}
          onChange={(v) => setStore({ savedTab: v })}
          tabs={[
            { value: "saved", label: "Saved jobs" },
            { value: "alerts", label: "Job alerts" },
          ]}
        />
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {tab === "saved" ? (
          <SavedJobs />
        ) : (
          <Alerts key={alertsVersion} onEdit={(alert) => setAlertModal({ open: true, alert })} onCreate={() => setAlertModal({ open: true, alert: null })} />
        )}
      </div>
      <AlertModal
        open={alertModal.open}
        alert={alertModal.alert}
        onClose={() => setAlertModal({ open: false, alert: null })}
        onSaved={() => setAlertsVersion((v) => v + 1)}
      />
    </>
  );
}

function SavedJobs() {
  const nav = useBoardNav();
  const savedIds = useSavedStore((s) => s.ids);
  const savedLoaded = useSavedStore((s) => s.loaded);
  const setAll = useSavedStore((s) => s.setAll);
  const { data, loading, error, reload } = useLoad(() => candidateApi.getSavedJobs(), []);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    if (data) setAll(data.jobs.map((j) => j._id));
  }, [data, setAll]);

  // Unsaving from a card hides it straight away; the list reloads next visit.
  const jobs: PublicJob[] = (data?.jobs || []).filter((j) => !savedLoaded || savedIds.has(j._id));
  const q = search.trim().toLowerCase();
  const visible = q
    ? jobs.filter((j) => [j.title, j.org?.name, ...j.locations, ...j.skills].join(" ").toLowerCase().includes(q))
    : jobs;

  if (loading && !data) return <LoadingBlock />;
  if (error) return <ErrorState message={error} onRetry={() => reload()} />;
  if (!jobs.length) {
    return (
      <EmptyState
        icon={<Bookmark className="h-10 w-10" />}
        title="No saved jobs yet"
        description="Tap the bookmark on any role to keep it here."
        action={<Button onClick={() => nav.go(BOARD_PAGES.discover)}>Find jobs</Button>}
      />
    );
  }
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search saved jobs" />
        <span className="text-xs text-[#7c7d94]">
          {jobs.length} saved
        </span>
      </div>
      {visible.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((job) => (
            <JobCard
              key={job._id}
              job={job}
              onOpen={() => nav.openJob(job._id)}
              footer={
                <div className="mt-3 border-t border-[#1f1f24] pt-3">
                  <Button variant="secondary" className="w-full" onClick={() => nav.openJob(job._id)}>
                    View job
                  </Button>
                </div>
              }
            />
          ))}
        </div>
      ) : (
        <Card className="px-5 py-10 text-center text-sm text-[#7c7d94]">No saved jobs match “{search}”.</Card>
      )}
    </>
  );
}

function Alerts({ onEdit, onCreate }: { onEdit: (alert: JobAlert) => void; onCreate: () => void }) {
  const { data, setData, loading, error, reload } = useLoad(() => candidateApi.getAlerts(), []);
  const { confirm, confirmDialog } = useConfirm();
  const alerts = data?.alerts || [];
  const active = alerts.filter((a) => a.active).length;

  const replace = (alert: JobAlert) =>
    setData((d) => (d ? { ...d, alerts: d.alerts.map((a) => (a._id === alert._id ? alert : a)) } : d));

  const toggle = async (alert: JobAlert) => {
    try {
      const res = await candidateApi.updateAlert(alert._id, { active: !alert.active });
      replace(res.alert);
      toast.success(res.alert.active ? "Alert resumed" : "Alert paused");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update the alert."));
    }
  };

  const remove = async (alert: JobAlert) => {
    if (!(await confirm({ title: `Delete “${alert.name}”?`, message: "You'll stop getting emails for this search.", confirmLabel: "Delete alert" }))) return;
    try {
      await candidateApi.deleteAlert(alert._id);
      setData((d) => (d ? { ...d, alerts: d.alerts.filter((a) => a._id !== alert._id) } : d));
      toast.success("Alert deleted");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't delete the alert."));
    }
  };

  if (loading && !data) return <LoadingBlock />;
  if (error) return <ErrorState message={error} onRetry={() => reload()} />;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p className="text-sm text-[#c7c7da]">We&apos;ll notify you only when a role matches your saved criteria. You control every frequency.</p>
        <span
          className="rounded-md px-2 py-0.5 text-[11px] font-medium"
          style={{ color: GOLD, background: "color-mix(in srgb, var(--brand) 12%, transparent)" }}
        >
          {active} active
        </span>
      </Card>
      {!alerts.length ? (
        <EmptyState
          icon={<Bell className="h-10 w-10" />}
          title="No job alerts yet"
          description="Create an alert and we'll email you when a matching role goes live."
          action={
            <Button onClick={onCreate}>
              <Plus className="h-4 w-4" /> Create alert
            </Button>
          }
        />
      ) : (
        <Card className="overflow-visible">
          {alerts.map((alert) => (
            <div key={alert._id} className="flex flex-wrap items-center gap-4 border-t border-[#1f1f24] px-5 py-4 first:border-t-0">
              <Bell className="h-4 w-4 shrink-0" style={{ color: alert.active ? GOLD : "#4f5065" }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">{alert.name}</div>
                <div className="truncate text-xs text-[#7c7d94]">{criteriaSummary(alert.criteria)}</div>
              </div>
              <span className="rounded-md border border-[#262626] px-2 py-0.5 text-[11px] text-[#c7c7da]">{frequencyLabel(alert)}</span>
              <span className="w-32 text-right text-xs text-[#7c7d94]">
                {!alert.active
                  ? "Paused"
                  : alert.newMatches
                    ? `${alert.newMatches} new match${alert.newMatches === 1 ? "" : "es"}`
                    : alert.lastSentAt
                      ? `Last sent ${timeAgo(alert.lastSentAt)}`
                      : "No new matches"}
              </span>
              <RowMenu
                items={[
                  { label: "Edit", icon: <Pencil className="h-4 w-4" />, onClick: () => onEdit(alert) },
                  alert.active
                    ? { label: "Pause", icon: <Pause className="h-4 w-4" />, onClick: () => toggle(alert) }
                    : { label: "Resume", icon: <Play className="h-4 w-4" />, onClick: () => toggle(alert) },
                  { label: "Delete", icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => remove(alert) },
                ]}
              />
            </div>
          ))}
        </Card>
      )}
      <p className="text-xs text-[#61627a]">Email notifications · you control every frequency.</p>
      {confirmDialog}
    </div>
  );
}

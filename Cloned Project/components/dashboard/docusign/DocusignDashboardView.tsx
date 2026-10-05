"use client";

import { useEffect, useRef, useState } from "react";
import { useDocusignStore } from "@/store/docusign/docusignStore";
import { DateRangeToggle } from "@/components/dashboard/docusign/analytics/DateRangeToggle";
import { KpiCard } from "@/components/dashboard/docusign/analytics/KpiCard";
import { DocumentStatusDonut } from "@/components/dashboard/docusign/analytics/DocumentStatusDonut";
import { SigningActivityChart } from "@/components/dashboard/docusign/analytics/SigningActivityChart";
import { TopSendersList } from "@/components/dashboard/docusign/analytics/TopSendersList";
import { RecentDocumentsTable } from "@/components/dashboard/docusign/analytics/RecentDocumentsTable";
import type { DsAnalyticsRange } from "@/lib/docusign/types";
import type { DsDocument } from "@/lib/docusign/internal-api";
import type { DsExternalDocument } from "@/lib/docusign/external-api";

interface DocusignDashboardViewProps {
  // Passes the whole row through so the caller can seed the field editor (see documentSeed.ts).
  onOpen: (doc: DsDocument | DsExternalDocument, kind?: "internal" | "external") => void;
  onViewAll: () => void;
}

export function DocusignDashboardView({ onOpen, onViewAll }: DocusignDashboardViewProps) {
  const { stats, analytics, isLoadingAnalytics, fetchStats, fetchAnalytics } = useDocusignStore();
  const [range, setRange] = useState<DsAnalyticsRange>("1m");
  const hasLoadedStatsRef = useRef(false);

  useEffect(() => {
    if (hasLoadedStatsRef.current) return;
    hasLoadedStatsRef.current = true;
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchAnalytics(range);
  }, [range, fetchAnalytics]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white/90">Dashboard</h2>
          <p className="text-xs text-[#7a7a90]">An overview of e-signature activity across your organization</p>
        </div>
        <DateRangeToggle value={range} onChange={setRange} />
      </div>

      {stats && stats.assignedToMePending > 0 && (
        <div className="rounded-md border border-indigo-500/30 bg-indigo-500/10 p-3">
          <p className="text-sm text-indigo-300">
            <strong>{stats.assignedToMePending}</strong> document{stats.assignedToMePending === 1 ? "" : "s"} waiting on you to
            sign
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total Documents" kpi={analytics?.kpis.totalDocuments ?? null} color="#FBD10D" loading={isLoadingAnalytics && !analytics} />
        <KpiCard label="Sent" kpi={analytics?.kpis.sent ?? null} color="#3b82f6" loading={isLoadingAnalytics && !analytics} />
        <KpiCard label="Completed" kpi={analytics?.kpis.completed ?? null} color="#10b981" loading={isLoadingAnalytics && !analytics} />
        <KpiCard
          label="Pending Signatures"
          kpi={analytics?.kpis.pendingSignatures ?? null}
          color="#f59e0b"
          loading={isLoadingAnalytics && !analytics}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <DocumentStatusDonut totals={analytics?.totals ?? null} loading={isLoadingAnalytics && !analytics} />
        </div>
        <div className="lg:col-span-3">
          <SigningActivityChart activity={analytics?.signingActivity ?? null} loading={isLoadingAnalytics && !analytics} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <TopSendersList senders={analytics?.topSenders ?? null} loading={isLoadingAnalytics && !analytics} />
        </div>
        <div className="lg:col-span-3">
          <RecentDocumentsTable onOpen={onOpen} />
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={onViewAll} className="text-xs text-indigo-300 hover:text-indigo-200">
          View all agreements →
        </button>
      </div>
    </div>
  );
}

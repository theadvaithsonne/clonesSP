"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Copy, Pencil, Trash2 } from "lucide-react";

const CAMPAIGNS_PAGE_SIZE = 10;

export type CampaignStatus =
  | "Delivered"
  | "Scheduled"
  | "Draft"
  | "Sending"
  | "Failed"
  | "Cancelled";

export interface CampaignRow {
  id: string;
  name: string;
  template: string;
  recipients: number;
  sentDate: string | null;
  status: CampaignStatus;
  delivered: number;
  total: number;
}

const STATUS_STYLES: Record<CampaignStatus, string> = {
  Delivered: "bg-emerald-500/15 text-emerald-400",
  Scheduled: "bg-blue-500/15 text-blue-400",
  Draft: "bg-white/8 text-[#a8a8a8]",
  Sending: "bg-blue-500/15 text-blue-400",
  Failed: "bg-red-500/15 text-red-400",
  Cancelled: "bg-white/8 text-[#7a7a7a]",
};

const STATUS_LABEL: Record<CampaignStatus, string> = {
  Delivered: "Delivered",
  Scheduled: "Scheduled",
  Draft: "Draft",
  Sending: "In Progress",
  Failed: "Failed",
  Cancelled: "Cancelled",
};

function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-medium leading-4 whitespace-nowrap ${STATUS_STYLES[status]}`}
    >
      {status === "Scheduled" && <Clock className="h-3 w-3 shrink-0" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

function formatRecipients(count: number): string {
  return count.toLocaleString();
}

function formatDeliveryRatio(delivered: number, total: number): string {
  if (total <= 0) return "—";
  const pct = (delivered / total) * 100;
  return `${pct.toFixed(1)}%`;
}

function CampaignRowActions({
  campaignId,
  campaignName,
  status,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  campaignId: string;
  campaignName: string;
  status: CampaignStatus;
  onEdit?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const canEdit = status === "Draft" && !!onEdit;

  return (
    <div className="flex items-center justify-end gap-0.5 sm:gap-1">
      {canEdit && (
        <button
          type="button"
          aria-label={`Edit ${campaignName}`}
          title="Edit & launch"
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.(campaignId);
          }}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-[#7a7a7a] hover:bg-white/8 hover:text-white transition-colors cursor-pointer"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
      {onDuplicate && (
        <button
          type="button"
          aria-label={`Duplicate ${campaignName}`}
          title="Duplicate"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(campaignId);
          }}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-[#7a7a7a] hover:bg-white/8 hover:text-white transition-colors cursor-pointer"
        >
          <Copy className="h-4 w-4" />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          aria-label={`Delete ${campaignName}`}
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(campaignId);
          }}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-[#7a7a7a] hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

const TH =
  "px-5 first:pl-6 last:pr-6 py-3.5 text-left text-[11px] sm:text-xs font-medium text-[#7a7a7a] uppercase tracking-wider whitespace-nowrap";
const TD =
  "px-5 first:pl-6 last:pr-6 py-3.5 align-middle text-sm";
const TD_PRIMARY = `${TD} text-white`;
const TD_SECONDARY = `${TD} text-[#a8a8a8]`;

function CampaignTableFooter({
  total,
  page,
  totalPages,
  onPageChange,
}: {
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  return (
    <footer
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-white/8 bg-white/[0.03] px-5 sm:px-6 py-3.5 rounded-b-xl"
      aria-label="Campaign table pagination"
    >
      <p className="text-sm leading-5 text-[#7a7a7a]">{total} total</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canGoPrev}
          className="h-8 min-w-[76px] px-3 rounded-lg text-sm leading-5 text-[#a8a8a8] text-center hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#a8a8a8] disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          Previous
        </button>
        <span className="h-8 flex items-center px-2 sm:px-3 text-sm leading-5 text-white whitespace-nowrap">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!canGoNext}
          className="h-8 min-w-[53px] px-3 rounded-lg text-sm leading-5 text-[#a8a8a8] text-center hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#a8a8a8] disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          Next
        </button>
      </div>
    </footer>
  );
}

function CampaignMobileCard({
  campaign,
  onRowClick,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  campaign: CampaignRow;
  onRowClick?: (campaign: CampaignRow) => void;
  onEdit?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div
      role={onRowClick ? "button" : undefined}
      tabIndex={onRowClick ? 0 : undefined}
      onClick={() => onRowClick?.(campaign)}
      onKeyDown={(e) => {
        if (!onRowClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRowClick(campaign);
        }
      }}
      className="rounded-xl border border-white/8 bg-[#0a0a0a] p-4 space-y-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate" title={campaign.name}>
            {campaign.name}
          </p>
          <p className="text-xs text-[#7a7a7a] mt-0.5 truncate" title={campaign.template}>
            {campaign.template}
          </p>
        </div>
        <CampaignStatusBadge status={campaign.status} />
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-[#7a7a7a] uppercase tracking-wider mb-1">Recipients</p>
          <p className="text-[#a8a8a8]">{formatRecipients(campaign.recipients)}</p>
        </div>
        <div>
          <p className="text-[#7a7a7a] uppercase tracking-wider mb-1">Send date</p>
          <p className="text-[#a8a8a8]">{campaign.sentDate ?? "—"}</p>
        </div>
        <div>
          <p className="text-[#7a7a7a] uppercase tracking-wider mb-1">Delivery</p>
          <p className="text-[#a8a8a8]">
            {formatDeliveryRatio(campaign.delivered, campaign.total)}
          </p>
        </div>
      </div>

      <div
        className="flex items-center justify-end border-t border-white/8 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <CampaignRowActions
          campaignId={campaign.id}
          campaignName={campaign.name}
          status={campaign.status}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

export function CampaignTable({
  campaigns,
  total: totalProp,
  page: pageProp,
  onPageChange,
  onRowClick,
  onEdit,
  onDuplicate,
  onDelete,
  loading,
}: {
  campaigns: CampaignRow[];
  total?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (campaign: CampaignRow) => void;
  onEdit?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  loading?: boolean;
}) {
  const [internalPage, setInternalPage] = useState(1);
  const serverPaginated =
    totalProp != null && pageProp != null && onPageChange != null;

  const page = serverPaginated ? pageProp : internalPage;
  const total = serverPaginated ? totalProp : campaigns.length;
  const totalPages = Math.max(1, Math.ceil(total / CAMPAIGNS_PAGE_SIZE));

  useEffect(() => {
    if (!serverPaginated) setInternalPage(1);
  }, [campaigns, serverPaginated]);

  useEffect(() => {
    if (!serverPaginated && page > totalPages) setInternalPage(totalPages);
  }, [page, totalPages, serverPaginated]);

  const pagedCampaigns = useMemo(() => {
    if (serverPaginated) return campaigns;
    const start = (page - 1) * CAMPAIGNS_PAGE_SIZE;
    return campaigns.slice(start, start + CAMPAIGNS_PAGE_SIZE);
  }, [campaigns, page, serverPaginated]);

  const handlePageChange = (next: number) => {
    if (serverPaginated) onPageChange!(next);
    else setInternalPage(next);
  };

  return (
    <div className="w-full">
      {/* Mobile / tablet card list */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="rounded-xl border border-white/8 bg-[#0a0a0a] px-4 py-10 text-center text-sm text-[#7a7a7a]">
            Loading campaigns…
          </div>
        ) : pagedCampaigns.length === 0 ? (
          <div className="rounded-xl border border-white/8 bg-[#0a0a0a] px-4 py-10 text-center text-sm text-[#7a7a7a]">
            No campaigns match your search
          </div>
        ) : (
          pagedCampaigns.map((campaign) => (
            <CampaignMobileCard
              key={campaign.id}
              campaign={campaign}
              onRowClick={onRowClick}
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))
        )}
        <div className="rounded-xl border border-white/8 overflow-hidden">
          <CampaignTableFooter
            total={total}
            page={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block border border-white/8 rounded-xl bg-[#0a0a0a] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse">
            <thead>
              <tr className="border-b border-white/8 bg-white/[0.03]">
                <th className={TH}>Campaign name</th>
                <th className={`${TH} hidden lg:table-cell`}>Template</th>
                <th className={TH}>Recipients</th>
                <th className={TH}>Send date</th>
                <th className={TH}>Status</th>
                <th className={TH}>Delivery ratio</th>
                <th className={`${TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm text-[#7a7a7a]"
                  >
                    Loading campaigns…
                  </td>
                </tr>
              ) : pagedCampaigns.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm text-[#7a7a7a]"
                  >
                    No campaigns match your search
                  </td>
                </tr>
              ) : (
                pagedCampaigns.map((campaign) => (
                  <tr
                    key={campaign.id}
                    role={onRowClick ? "button" : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={() => onRowClick?.(campaign)}
                    onKeyDown={(e) => {
                      if (!onRowClick) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(campaign);
                      }
                    }}
                    className="border-b border-white/8 last:border-b-0 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    <td
                      className={`${TD_PRIMARY} font-medium truncate max-w-[220px]`}
                      title={campaign.name}
                    >
                      {campaign.name}
                    </td>
                    <td
                      className={`${TD_SECONDARY} hidden lg:table-cell truncate max-w-[180px]`}
                      title={campaign.template}
                    >
                      {campaign.template}
                    </td>
                    <td className={`${TD_SECONDARY} whitespace-nowrap`}>
                      {formatRecipients(campaign.recipients)}
                    </td>
                    <td className={`${TD_SECONDARY} whitespace-nowrap`}>
                      {campaign.sentDate ?? "—"}
                    </td>
                    <td className={TD}>
                      <CampaignStatusBadge status={campaign.status} />
                    </td>
                    <td className={`${TD_SECONDARY} whitespace-nowrap`}>
                      {formatDeliveryRatio(campaign.delivered, campaign.total)}
                    </td>
                    <td
                      className={TD}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <CampaignRowActions
                        campaignId={campaign.id}
                        campaignName={campaign.name}
                        status={campaign.status}
                        onEdit={onEdit}
                        onDuplicate={onDuplicate}
                        onDelete={onDelete}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <CampaignTableFooter
          total={total}
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}

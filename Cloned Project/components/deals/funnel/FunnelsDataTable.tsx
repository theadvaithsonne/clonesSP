"use client";

import { useMemo, type ReactNode } from "react";
import { DataTable } from "@/components/ui/data-table/DataTable";
import { Avatar, Dash, PersonBlock } from "@/components/ui/data-table/cells";
import type {
  ColumnDef,
  DataTableTotal,
  PaginationProps,
  SortState,
} from "@/components/ui/data-table/types";

export type FunnelOwner = { name: string; email?: string; avatar?: string | null };

export type FunnelsDataTableProps = {
  rows: any[];
  loading?: boolean;
  emptyLabel?: string;

  sort: SortState | null;
  onSortChange: (next: SortState) => void;

  getRowId: (funnel: any) => string;
  onRowClick: (funnel: any) => void;

  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;

  /* Field accessors + renderers stay on the page so all funnel business logic
   * lives in one place; this component only owns layout. */
  getFunnelName: (funnel: any) => string;
  getOwner: (funnel: any) => FunnelOwner;
  getActiveLeads: (funnel: any) => number;
  getStatus: (funnel: any) => string;
  getLastUpdated: (funnel: any) => string;
  renderStages: (funnel: any) => ReactNode;
  renderActions: (funnel: any) => ReactNode;

  footerTotals?: DataTableTotal[];
  pagination?: PaginationProps;
};

export function FunnelsDataTable(props: FunnelsDataTableProps) {
  const {
    getFunnelName,
    getOwner,
    getActiveLeads,
    getStatus,
    getLastUpdated,
    renderStages,
    renderActions,
  } = props;

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        id: "name",
        header: "Funnel Name",
        width: 240,
        minWidth: 160,
        frozen: "left",
        vAlign: "middle",
        sortable: true,
        cell: (funnel) => {
          const name = getFunnelName(funnel);
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar name={name} size={32} />
              <p className="truncate text-[13px] font-medium text-white/90">
                {name || "—"}
              </p>
            </div>
          );
        },
      },
      {
        id: "stages",
        header: "Stages",
        width: 140,
        minWidth: 100,
        vAlign: "middle",
        sortable: true,
        cell: (funnel) => {
          const stages = renderStages(funnel);
          if (!stages) return <Dash />;
          return <div className="flex flex-wrap items-center gap-1">{stages}</div>;
        },
      },
      {
        id: "owner",
        header: "Owner",
        width: 220,
        minWidth: 150,
        sortable: true,
        cell: (funnel) => {
          const owner = getOwner(funnel);
          if (!owner.name || owner.name === "--") return <Dash />;
          return (
            <PersonBlock name={owner.name} email={owner.email} avatar={owner.avatar} />
          );
        },
      },
      {
        id: "activeLeads",
        header: "Active Leads",
        width: 130,
        minWidth: 96,
        align: "right",
        vAlign: "middle",
        sortable: true,
        cell: (funnel) => (
          <span className="tabular-nums text-white/90">{getActiveLeads(funnel)}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: 120,
        minWidth: 96,
        vAlign: "middle",
        sortable: true,
        cell: (funnel) => {
          const status = getStatus(funnel);
          if (!status) return <Dash />;
          const active = status.toLowerCase() === "active";
          return (
            <span
              className={`inline-flex items-center rounded-[6px] border px-2 py-0.5 text-[11px] font-semibold ${
                active
                  ? "border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.1)] text-[#10b981]"
                  : "border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-white/55"
              }`}
            >
              {active ? "Active" : "Inactive"}
            </span>
          );
        },
      },
      {
        id: "updatedAt",
        header: "Last Updated",
        width: 150,
        minWidth: 110,
        vAlign: "middle",
        sortable: true,
        cell: (funnel) => {
          const updated = getLastUpdated(funnel);
          if (!updated || updated === "--") return <Dash />;
          return <span className="whitespace-nowrap text-white/55">{updated}</span>;
        },
      },
      {
        id: "actions",
        header: "Actions",
        width: 104,
        minWidth: 92,
        frozen: "right",
        vAlign: "middle",
        cell: (funnel) => (
          <div
            className="flex items-center justify-start gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {renderActions(funnel)}
          </div>
        ),
      },
    ],
    [
      getFunnelName,
      getOwner,
      getActiveLeads,
      getStatus,
      getLastUpdated,
      renderStages,
      renderActions,
    ]
  );

  return (
    <DataTable<any>
      // Deals keeps the louder grid line; only the admin moved to the
      // chrome's border-white/[0.06].
      borderColor="#5d5d5d"
      tableId="deals-funnels"
      columns={columns}
      rows={props.rows}
      getRowId={props.getRowId}
      loading={props.loading}
      emptyLabel={props.emptyLabel ?? "No funnels found."}
      sort={props.sort}
      onSortChange={props.onSortChange}
      selectable
      selectedIds={props.selectedIds}
      allSelected={props.allSelected}
      someSelected={props.someSelected}
      onToggleRow={props.onToggleRow}
      onToggleAll={props.onToggleAll}
      onRowClick={props.onRowClick}
      footerTotals={props.footerTotals}
      pagination={props.pagination}
    />
  );
}

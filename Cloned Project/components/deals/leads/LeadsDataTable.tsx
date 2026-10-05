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

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

export type LeadOwner = { name: string; email?: string; avatar?: string | null };

export type LeadsDataTableProps = {
  rows: any[];
  loading?: boolean;
  emptyLabel?: string;

  sort: SortState | null;
  onSortChange: (next: SortState) => void;

  getRowId: (lead: any) => string;
  onRowClick: (lead: any) => void;

  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;

  /* Field accessors + renderers stay on the page so all lead business logic
   * lives in one place; this component only owns layout. */
  getLeadName: (lead: any) => string;
  getOwner: (lead: any) => LeadOwner;
  getStage: (lead: any) => string;
  getValue: (lead: any) => number;
  formatValue: (n: number) => string;
  getNextFollowUp: (lead: any) => string;
  getEmail: (lead: any) => string;
  renderTags: (lead: any) => ReactNode;
  renderActions: (lead: any) => ReactNode;

  footerTotals?: DataTableTotal[];
  pagination?: PaginationProps;
};

export function LeadsDataTable(props: LeadsDataTableProps) {
  const {
    getLeadName,
    getOwner,
    getStage,
    getValue,
    formatValue,
    getNextFollowUp,
    getEmail,
    renderTags,
    renderActions,
  } = props;

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        id: "name",
        header: "Lead Name",
        width: 220,
        minWidth: 150,
        frozen: "left",
        vAlign: "middle",
        sortable: true,
        cell: (lead) => {
          const name = getLeadName(lead);
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
        id: "tags",
        header: "Tags",
        width: 240,
        minWidth: 160,
        cell: (lead) => {
          const tags = renderTags(lead);
          if (!tags) return <Dash />;
          return <div className="flex flex-wrap items-center gap-1">{tags}</div>;
        },
      },
      {
        id: "owner",
        header: "Owner",
        width: 210,
        minWidth: 150,
        sortable: true,
        cell: (lead) => {
          const owner = getOwner(lead);
          return (
            <PersonBlock name={owner.name} email={owner.email} avatar={owner.avatar} />
          );
        },
      },
      {
        id: "stage",
        header: "Stage",
        width: 140,
        minWidth: 100,
        vAlign: "middle",
        sortable: true,
        cell: (lead) => {
          const stage = getStage(lead);
          if (!stage || stage === "-") return <Dash />;
          return (
            <span className="block truncate text-[13px] text-white/85" title={stage}>
              {stage}
            </span>
          );
        },
      },
      {
        id: "value",
        header: "Value",
        width: 120,
        minWidth: 96,
        align: "right",
        vAlign: "middle",
        sortable: true,
        cell: (lead) => (
          <span className="tabular-nums text-white/90">{formatValue(getValue(lead))}</span>
        ),
      },
      {
        id: "nextFollowUp",
        header: "Next Follow-up",
        width: 150,
        minWidth: 110,
        vAlign: "middle",
        sortable: true,
        cell: (lead) => {
          const next = getNextFollowUp(lead);
          if (!next || next === "-") return <Dash />;
          return <span className="whitespace-nowrap text-white/55">{next}</span>;
        },
      },
      {
        id: "contact",
        header: "Contact",
        width: 220,
        minWidth: 140,
        vAlign: "middle",
        sortable: true,
        cell: (lead) => {
          const email = getEmail(lead);
          if (!email) return <Dash />;
          return (
            <span className="block truncate text-white/70" title={email}>
              {email}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        width: 104,
        minWidth: 92,
        frozen: "right",
        vAlign: "middle",
        cell: (lead) => (
          <div
            className="flex items-center justify-start gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {renderActions(lead)}
          </div>
        ),
      },
    ],
    [
      getLeadName,
      getOwner,
      getStage,
      getValue,
      formatValue,
      getNextFollowUp,
      getEmail,
      renderTags,
      renderActions,
    ]
  );

  return (
    <DataTable<any>
      // Deals keeps the louder grid line; only the admin moved to the
      // chrome's border-white/[0.06].
      borderColor="#5d5d5d"
      tableId="deals-leads"
      columns={columns}
      rows={props.rows}
      getRowId={props.getRowId}
      loading={props.loading}
      emptyLabel={props.emptyLabel ?? "No leads found."}
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

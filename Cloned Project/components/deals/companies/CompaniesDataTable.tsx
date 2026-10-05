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

export type CompanyOwner = { name: string; email?: string; avatar?: string | null };

export type CompaniesDataTableProps = {
  rows: any[];
  loading?: boolean;
  emptyLabel?: string;

  sort: SortState | null;
  onSortChange: (next: SortState) => void;

  getRowId: (company: any) => string;
  onRowClick: (company: any) => void;

  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;

  /* Field accessors stay on the page so all company business logic lives in
   * one place; this component only owns layout. */
  getCompanyName: (company: any) => string;
  getWebsite: (company: any) => string;
  getIndustry: (company: any) => string;
  getSize: (company: any) => string;
  getOwner: (company: any) => CompanyOwner;
  getOpenLeads: (company: any) => number;
  getWonDeals: (company: any) => number;
  getLastActivity: (company: any) => string;
  renderActions: (company: any) => ReactNode;

  footerTotals?: DataTableTotal[];
  pagination?: PaginationProps;
};

export function CompaniesDataTable(props: CompaniesDataTableProps) {
  const {
    getCompanyName,
    getWebsite,
    getIndustry,
    getSize,
    getOwner,
    getOpenLeads,
    getWonDeals,
    getLastActivity,
    renderActions,
  } = props;

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        id: "name",
        header: "Company",
        width: 250,
        minWidth: 160,
        frozen: "left",
        sortable: true,
        cell: (company) => {
          const name = getCompanyName(company);
          const website = getWebsite(company);
          return (
            <div className="flex min-w-0 items-start gap-2.5">
              <Avatar name={name} size={32} />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[13px] font-medium text-white/90">
                  {name || "—"}
                </p>
                {website ? (
                  <p className="truncate text-[11px] text-white/45" title={website}>
                    {website}
                  </p>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        id: "industry",
        header: "Industry",
        width: 170,
        minWidth: 110,
        vAlign: "middle",
        sortable: true,
        cell: (company) => {
          const industry = getIndustry(company);
          if (!industry || industry === "--") return <Dash />;
          return (
            <span className="block truncate text-white/85" title={industry}>
              {industry}
            </span>
          );
        },
      },
      {
        id: "size",
        header: "Size",
        width: 140,
        minWidth: 96,
        vAlign: "middle",
        sortable: true,
        cell: (company) => {
          const size = getSize(company);
          if (!size || size === "--") return <Dash />;
          return <span className="whitespace-nowrap text-white/85">{size}</span>;
        },
      },
      {
        id: "owner",
        header: "Owner",
        width: 210,
        minWidth: 150,
        sortable: true,
        cell: (company) => {
          const owner = getOwner(company);
          if (!owner.name || owner.name === "--") return <Dash />;
          return (
            <PersonBlock name={owner.name} email={owner.email} avatar={owner.avatar} />
          );
        },
      },
      {
        id: "openLeads",
        header: "Open Leads",
        width: 120,
        minWidth: 96,
        align: "right",
        vAlign: "middle",
        sortable: true,
        cell: (company) => (
          <span className="tabular-nums text-white/90">{getOpenLeads(company)}</span>
        ),
      },
      {
        id: "wonDeals",
        header: "Won Deals",
        width: 120,
        minWidth: 96,
        align: "right",
        vAlign: "middle",
        sortable: true,
        cell: (company) => (
          <span className="tabular-nums text-white/90">{getWonDeals(company)}</span>
        ),
      },
      {
        id: "lastActivity",
        header: "Last Activity",
        width: 150,
        minWidth: 110,
        vAlign: "middle",
        sortable: true,
        cell: (company) => {
          const value = getLastActivity(company);
          if (!value || value === "--") return <Dash />;
          return <span className="whitespace-nowrap text-white/55">{value}</span>;
        },
      },
      {
        id: "actions",
        header: "Actions",
        width: 104,
        minWidth: 92,
        frozen: "right",
        vAlign: "middle",
        cell: (company) => (
          <div
            className="flex items-center justify-start gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {renderActions(company)}
          </div>
        ),
      },
    ],
    [
      getCompanyName,
      getWebsite,
      getIndustry,
      getSize,
      getOwner,
      getOpenLeads,
      getWonDeals,
      getLastActivity,
      renderActions,
    ]
  );

  return (
    <DataTable<any>
      // Deals keeps the louder grid line; only the admin moved to the
      // chrome's border-white/[0.06].
      borderColor="#5d5d5d"
      tableId="deals-companies"
      columns={columns}
      rows={props.rows}
      getRowId={props.getRowId}
      loading={props.loading}
      emptyLabel={props.emptyLabel ?? "No companies found."}
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

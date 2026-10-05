"use client";

import { useMemo, type ReactNode } from "react";
import { DataTable } from "@/components/ui/data-table/DataTable";
import { Avatar, Dash } from "@/components/ui/data-table/cells";
import type {
  ColumnDef,
  DataTableTotal,
  PaginationProps,
  SortState,
} from "@/components/ui/data-table/types";

export type ContactsDataTableProps = {
  rows: any[];
  loading?: boolean;
  emptyLabel?: string;

  sort: SortState | null;
  onSortChange: (next: SortState) => void;

  getRowId: (contact: any) => string;
  onRowClick: (contact: any) => void;

  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;

  /* Field accessors stay on the page so all contact business logic lives in
   * one place; this component only owns layout. */
  getContactName: (contact: any) => string;
  getRole: (contact: any) => string;
  getEmail: (contact: any) => string;
  getPhone: (contact: any) => string;
  getCompany: (contact: any) => string;
  getLastActivity: (contact: any) => string;
  renderActions: (contact: any) => ReactNode;

  footerTotals?: DataTableTotal[];
  pagination?: PaginationProps;
};

/** Truncating text cell that falls back to an em dash when empty. */
function TextCell({ value, muted }: { value: string; muted?: boolean }) {
  if (!value || value === "--" || value === "-") return <Dash />;
  return (
    <span
      className={`block truncate ${muted ? "text-white/55" : "text-white/85"}`}
      title={value}
    >
      {value}
    </span>
  );
}

export function ContactsDataTable(props: ContactsDataTableProps) {
  const {
    getContactName,
    getRole,
    getEmail,
    getPhone,
    getCompany,
    getLastActivity,
    renderActions,
  } = props;

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        id: "name",
        header: "Contact",
        width: 220,
        minWidth: 150,
        frozen: "left",
        vAlign: "middle",
        sortable: true,
        cell: (contact) => {
          const name = getContactName(contact);
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
        id: "role",
        header: "Role",
        width: 150,
        minWidth: 100,
        vAlign: "middle",
        sortable: true,
        cell: (contact) => <TextCell value={getRole(contact)} />,
      },
      {
        id: "email",
        header: "Email",
        width: 240,
        minWidth: 150,
        vAlign: "middle",
        sortable: true,
        cell: (contact) => <TextCell value={getEmail(contact)} muted />,
      },
      {
        id: "phone",
        header: "Phone",
        width: 160,
        minWidth: 110,
        vAlign: "middle",
        sortable: true,
        cell: (contact) => <TextCell value={getPhone(contact)} muted />,
      },
      {
        id: "company",
        header: "Company",
        width: 180,
        minWidth: 120,
        vAlign: "middle",
        sortable: true,
        cell: (contact) => <TextCell value={getCompany(contact)} />,
      },
      {
        id: "lastActivity",
        header: "Last Activity",
        width: 150,
        minWidth: 110,
        vAlign: "middle",
        sortable: true,
        cell: (contact) => {
          const value = getLastActivity(contact);
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
        cell: (contact) => (
          <div
            className="flex items-center justify-start gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {renderActions(contact)}
          </div>
        ),
      },
    ],
    [getContactName, getRole, getEmail, getPhone, getCompany, getLastActivity, renderActions]
  );

  return (
    <DataTable<any>
      // Deals keeps the louder grid line; only the admin moved to the
      // chrome's border-white/[0.06].
      borderColor="#5d5d5d"
      tableId="deals-contacts"
      columns={columns}
      rows={props.rows}
      getRowId={props.getRowId}
      loading={props.loading}
      emptyLabel={props.emptyLabel ?? "No contacts found."}
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

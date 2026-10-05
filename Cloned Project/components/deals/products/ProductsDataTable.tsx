"use client";

import { useMemo, type ReactNode } from "react";
import { Briefcase, Package } from "lucide-react";
import { DataTable } from "@/components/ui/data-table/DataTable";
import { Dash } from "@/components/ui/data-table/cells";
import type {
  ColumnDef,
  DataTableTotal,
  PaginationProps,
  SortState,
} from "@/components/ui/data-table/types";

export type ProductsDataTableProps = {
  rows: any[];
  loading?: boolean;
  emptyLabel?: string;

  sort: SortState | null;
  onSortChange: (next: SortState) => void;

  getRowId: (product: any) => string;
  onRowClick: (product: any) => void;

  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;

  /* Field accessors stay on the page so all catalogue business logic lives in
   * one place; this component only owns layout. */
  getProductName: (product: any) => string;
  isService: (product: any) => boolean;
  getCode: (product: any) => string;
  getCategory: (product: any) => string;
  getPrice: (product: any) => string;
  getStatus: (product: any) => string;
  getUpdated: (product: any) => string;
  renderActions: (product: any) => ReactNode;

  footerTotals?: DataTableTotal[];
  pagination?: PaginationProps;
};

export function ProductsDataTable(props: ProductsDataTableProps) {
  const {
    getProductName,
    isService,
    getCode,
    getCategory,
    getPrice,
    getStatus,
    getUpdated,
    renderActions,
  } = props;

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        width: 240,
        minWidth: 160,
        frozen: "left",
        vAlign: "middle",
        sortable: true,
        cell: (product) => {
          const service = isService(product);
          const name = getProductName(product);
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                  service
                    ? "bg-[rgba(16,185,129,0.12)] text-[#10b981]"
                    : "bg-[rgba(139,122,255,0.12)] text-[#8b7aff]"
                }`}
              >
                {service ? (
                  <Briefcase className="h-3.5 w-3.5" />
                ) : (
                  <Package className="h-3.5 w-3.5" />
                )}
              </span>
              <p className="truncate text-[13px] font-medium text-white/90">
                {name || "—"}
              </p>
            </div>
          );
        },
      },
      {
        id: "type",
        header: "Type",
        width: 120,
        minWidth: 96,
        vAlign: "middle",
        sortable: true,
        cell: (product) => (
          <span className="whitespace-nowrap text-white/85">
            {isService(product) ? "Service" : "Product"}
          </span>
        ),
      },
      {
        id: "code",
        header: "Code",
        width: 150,
        minWidth: 110,
        vAlign: "middle",
        sortable: true,
        cell: (product) => {
          const code = getCode(product);
          if (!code || code === "-") return <Dash />;
          return (
            <span className="inline-block max-w-full truncate rounded-[4px] bg-[rgba(255,255,255,0.06)] px-2 py-0.5 font-mono text-[12px] text-white/85">
              {code}
            </span>
          );
        },
      },
      {
        id: "category",
        header: "Category",
        width: 170,
        minWidth: 110,
        vAlign: "middle",
        sortable: true,
        cell: (product) => {
          const category = getCategory(product);
          if (!category || category === "-") return <Dash />;
          return (
            <span className="block truncate text-white/85" title={category}>
              {category}
            </span>
          );
        },
      },
      {
        id: "price",
        header: "Price",
        width: 140,
        minWidth: 100,
        align: "right",
        vAlign: "middle",
        sortable: true,
        cell: (product) => {
          const price = getPrice(product);
          if (!price || price === "-") return <Dash />;
          return <span className="tabular-nums text-white/90">{price}</span>;
        },
      },
      {
        id: "status",
        header: "Status",
        width: 120,
        minWidth: 96,
        vAlign: "middle",
        sortable: true,
        cell: (product) => {
          const status = (getStatus(product) || "active").toLowerCase();
          const active = status === "active";
          const label = active ? "Active" : status === "pause" ? "Pause" : "Inactive";
          return (
            <span
              className={`inline-flex items-center rounded-[6px] border px-2 py-0.5 text-[11px] font-semibold ${
                active
                  ? "border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.1)] text-[#10b981]"
                  : "border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-white/55"
              }`}
            >
              {label}
            </span>
          );
        },
      },
      {
        id: "updated",
        header: "Updated",
        width: 150,
        minWidth: 110,
        vAlign: "middle",
        sortable: true,
        cell: (product) => {
          const updated = getUpdated(product);
          if (!updated || updated === "-") return <Dash />;
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
        cell: (product) => (
          <div
            className="flex items-center justify-start gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {renderActions(product)}
          </div>
        ),
      },
    ],
    [
      getProductName,
      isService,
      getCode,
      getCategory,
      getPrice,
      getStatus,
      getUpdated,
      renderActions,
    ]
  );

  return (
    <DataTable<any>
      // Deals keeps the louder grid line; only the admin moved to the
      // chrome's border-white/[0.06].
      borderColor="#5d5d5d"
      tableId="deals-products"
      columns={columns}
      rows={props.rows}
      getRowId={props.getRowId}
      loading={props.loading}
      emptyLabel={props.emptyLabel ?? "No products or services found."}
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

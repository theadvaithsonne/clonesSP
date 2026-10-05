"use client";

import { useState } from "react";
import {
  Plus,
  AlignLeft,
  Heading,
  Image as ImageIcon,
  RectangleHorizontal,
  Minus,
  MoveVertical,
  Share2,
  PanelBottom,
  Stamp,
  FormInput,
} from "lucide-react";
import type { CmsColumnData, CmsModule, CmsModuleType } from "@/lib/cms/types";
import { COLUMN_ADDABLE_TYPES } from "@/lib/cms/moduleDefaults";
import { getLayoutColumns } from "@/lib/cms/columns";

const ADDABLE_META: Record<
  CmsModuleType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  logo: { label: "Logo", icon: Stamp },
  heading: { label: "Heading", icon: Heading },
  text: { label: "Text", icon: AlignLeft },
  image: { label: "Image", icon: ImageIcon },
  button: { label: "Button", icon: RectangleHorizontal },
  divider: { label: "Divider", icon: Minus },
  spacer: { label: "Spacer", icon: MoveVertical },
  social_icons: { label: "Social Icons", icon: Share2 },
  footer: { label: "Footer", icon: PanelBottom },
  lead_form: { label: "Lead Form", icon: FormInput },
  section: { label: "Section", icon: AlignLeft },
  container: { label: "Container", icon: AlignLeft },
  two_column: { label: "Two Column", icon: AlignLeft },
  three_column: { label: "Three Column", icon: AlignLeft },
  columns: { label: "Columns", icon: AlignLeft },
  hero: { label: "Hero", icon: AlignLeft },
};

type ColumnModuleEditorProps = {
  layoutModule: CmsModule;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddToColumn: (layoutId: string, columnId: string, type: CmsModuleType) => void;
  onRemoveFromColumn: (layoutId: string, columnId: string, moduleId: string) => void;
  renderModule: (module: CmsModule) => React.ReactNode;
};

export default function ColumnModuleEditor({
  layoutModule,
  selectedId,
  onSelect,
  onDelete,
  onAddToColumn,
  onRemoveFromColumn,
  renderModule,
}: ColumnModuleEditorProps) {
  const columns = getLayoutColumns(layoutModule);
  const [addMenuCol, setAddMenuCol] = useState<string | null>(null);
  const gap = layoutModule.props.gap ?? 16;

  return (
    <div className="flex w-full" style={{ gap }}>
      {columns.map((col, colIdx) => (
        <ColumnSlot
          key={col.id}
          col={col}
          colIdx={colIdx}
          layoutId={layoutModule.id}
          selectedId={selectedId}
          onSelect={onSelect}
          onDelete={onDelete}
          addMenuCol={addMenuCol}
          setAddMenuCol={setAddMenuCol}
          onAddToColumn={onAddToColumn}
          onRemoveFromColumn={onRemoveFromColumn}
          renderModule={renderModule}
        />
      ))}
    </div>
  );
}

function ColumnSlot({
  col,
  colIdx,
  layoutId,
  selectedId,
  onSelect,
  onDelete,
  addMenuCol,
  setAddMenuCol,
  onAddToColumn,
  onRemoveFromColumn,
  renderModule,
}: {
  col: CmsColumnData;
  colIdx: number;
  layoutId: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  addMenuCol: string | null;
  setAddMenuCol: (id: string | null) => void;
  onAddToColumn: (layoutId: string, columnId: string, type: CmsModuleType) => void;
  onRemoveFromColumn: (layoutId: string, columnId: string, moduleId: string) => void;
  renderModule: (module: CmsModule) => React.ReactNode;
}) {
  const menuOpen = addMenuCol === col.id;

  return (
    <div
      className="min-w-0 flex-1 rounded border border-dashed border-[#ddd] bg-[#fafafa]/50 p-2"
      style={{ flexBasis: `${col.width}%` }}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#999]">
        Column {colIdx + 1}
      </p>
      <div className="space-y-2">
        {col.modules.length === 0 ? (
          <p className="py-4 text-center text-xs text-[#aaa]">No elements yet</p>
        ) : (
          col.modules.map((mod) => (
            <div key={mod.id} className="group relative">
              {renderModule(mod)}
              {onSelect ? (
                <button
                  type="button"
                  title="Remove"
                  className="absolute -right-1 -top-1 z-30 hidden cursor-pointer rounded-full bg-red-500 p-0.5 text-white group-hover:block"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFromColumn(layoutId, col.id, mod.id);
                    if (selectedId === mod.id) onSelect?.("");
                  }}
                >
                  <Minus className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
      {onSelect ? (
        <div className="relative mt-2">
          <button
            type="button"
            onClick={() => setAddMenuCol(menuOpen ? null : col.id)}
            className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#2A2A2A]/20 bg-white py-2 text-xs font-medium text-[#555] hover:border-brand hover:text-[#111]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Element
          </button>
          {menuOpen ? (
            <div className="absolute bottom-full left-0 z-40 mb-1 max-h-56 w-full overflow-auto rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] py-1 shadow-xl">
              {COLUMN_ADDABLE_TYPES.map((type) => {
                const meta = ADDABLE_META[type];
                const Icon = meta?.icon || AlignLeft;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      onAddToColumn(layoutId, col.id, type);
                      setAddMenuCol(null);
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                  >
                    <span className="text-brand">
                      <Icon className="h-4 w-4" />
                    </span>
                    {meta?.label || type}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

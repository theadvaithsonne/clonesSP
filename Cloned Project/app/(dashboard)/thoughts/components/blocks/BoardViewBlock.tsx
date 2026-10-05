"use client";

import React, { useState, useCallback, useRef } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";

interface BoardItem {
  id: string;
  label: string;
}

interface BoardColumn {
  title: string;
  color: string;
  headerBg: string;
  items: BoardItem[];
}

let cardIdCounter = 4;

function generateId() {
  return `card-${cardIdCounter++}`;
}

const INITIAL_COLUMNS: BoardColumn[] = [
  {
    title: "Todo",
    color: "border-t-zinc-500",
    headerBg: "bg-zinc-800/60",
    items: [
      { id: "card-1", label: "Research brief" },
    ],
  },
  {
    title: "In Progress",
    color: "border-t-amber-500",
    headerBg: "bg-amber-900/20",
    items: [
      { id: "card-2", label: "Draft copy" },
    ],
  },
  {
    title: "Done",
    color: "border-t-emerald-500",
    headerBg: "bg-emerald-900/20",
    items: [
      { id: "card-3", label: "Logo design" },
    ],
  },
];

function BoardBlock({ block, editor }: { block: any; editor: any }) {
  const loadedColumns = block.props?.columns ? JSON.parse(block.props.columns) : INITIAL_COLUMNS;
  const [columns, setColumns] = useState(loadedColumns);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const persistColumns = useCallback((newColumns: BoardColumn[]) => {
    setColumns(newColumns);
    editor.updateBlock(block, { props: { columns: JSON.stringify(newColumns) } });
  }, [editor, block]);
  const newCardInputs = useRef<Map<string, HTMLInputElement | null>>(new Map());

  const addCard = useCallback((colTitle: string) => {
    const newCard: BoardItem = { id: generateId(), label: "" };
    const next = columns.map((col) =>
      col.title === colTitle
        ? { ...col, items: [...col.items, newCard] }
        : col
    );
    persistColumns(next);
    requestAnimationFrame(() => {
      const input = newCardInputs.current.get(newCard.id);
      input?.focus();
      input?.select();
    });
  }, [columns, persistColumns]);

  const deleteCard = useCallback((colTitle: string, cardId: string) => {
    const next = columns.map((col) =>
      col.title === colTitle
        ? { ...col, items: col.items.filter((item) => item.id !== cardId) }
        : col
    );
    persistColumns(next);
  }, [columns, persistColumns]);

  const updateCardLabel = useCallback(
    (cardId: string, label: string) => {
      const next = columns.map((col) => ({
        ...col,
        items: col.items.map((item) =>
          item.id === cardId ? { ...item, label } : item
        ),
      }));
      persistColumns(next);
    },
    [columns, persistColumns]
  );

  const findCardColumn = (cardId: string): string | null => {
    for (const col of columns) {
      if (col.items.some((i) => i.id === cardId)) return col.title;
    }
    return null;
  };

  const handleDragStart = useCallback(
    (e: React.DragEvent, cardId: string) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", cardId);
      setDraggingId(cardId);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, cardId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (cardId !== draggingId) {
        setDragOverId(cardId);
      }
    },
    [draggingId]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetCardId: string) => {
      e.preventDefault();
      const sourceCardId = e.dataTransfer.getData("text/plain");
      if (!sourceCardId || sourceCardId === targetCardId) {
        setDraggingId(null);
        setDragOverId(null);
        return;
      }

      const sourceColName = findCardColumn(sourceCardId);
      const targetColName = findCardColumn(targetCardId);
      if (!sourceColName || !targetColName) {
        setDraggingId(null);
        setDragOverId(null);
        return;
      }

      const next = columns.map((col) => ({
        ...col,
        items: [...col.items],
      }));

      const sourceColumn = next.find((col) => col.title === sourceColName);
      const targetColumn = next.find((col) => col.title === targetColName);
      if (!sourceColumn || !targetColumn) { setDraggingId(null); setDragOverId(null); return; }

      const sourceIndex = sourceColumn.items.findIndex((i) => i.id === sourceCardId);
      if (sourceIndex === -1) { setDraggingId(null); setDragOverId(null); return; }

      const [movedItem] = sourceColumn.items.splice(sourceIndex, 1);

      if (sourceColName === targetColName) {
        const targetIndex = sourceColumn.items.findIndex((i) => i.id === targetCardId);
        sourceColumn.items.splice(targetIndex, 0, movedItem);
      } else {
        const targetIndex = targetColumn.items.findIndex((i) => i.id === targetCardId);
        if (targetIndex === -1) {
          targetColumn.items.push(movedItem);
        } else {
          targetColumn.items.splice(targetIndex, 0, movedItem);
        }
      }

      persistColumns(next);
      setDraggingId(null);
      setDragOverId(null);
    },
    [columns, persistColumns, findCardColumn]
  );

  const handleColumnDrop = useCallback(
    (e: React.DragEvent, colTitle: string) => {
      e.preventDefault();
      const sourceCardId = e.dataTransfer.getData("text/plain");
      if (!sourceCardId) {
        setDraggingId(null);
        setDragOverId(null);
        return;
      }

      const sourceColName = findCardColumn(sourceCardId);
      if (!sourceColName) {
        setDraggingId(null);
        setDragOverId(null);
        return;
      }

      const next = columns.map((col) => ({
        ...col,
        items: [...col.items],
      }));

      const sourceColumn = next.find((col) => col.title === sourceColName);
      const targetColumn = next.find((col) => col.title === colTitle);
      if (!sourceColumn || !targetColumn) { setDraggingId(null); setDragOverId(null); return; }

      const sourceIndex = sourceColumn.items.findIndex((i) => i.id === sourceCardId);
      if (sourceIndex === -1) { setDraggingId(null); setDragOverId(null); return; }

      const [movedItem] = sourceColumn.items.splice(sourceIndex, 1);

      if (sourceColName === colTitle) {
        sourceColumn.items.push(movedItem);
      } else {
        targetColumn.items.push(movedItem);
      }

      persistColumns(next);
      setDraggingId(null);
      setDragOverId(null);
    },
    [columns, persistColumns, findCardColumn]
  );

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverId(null);
  }, []);

  return (
    <div className="w-full bg-[#1E1E1E] rounded-lg border border-zinc-800/80 overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-800/60">
        <span className="text-[10px] text-zinc-500 font-medium tracking-wide">
          KANBAN BOARD
        </span>
      </div>
      <div className="flex gap-2 p-3 overflow-x-auto">
        {columns.map((col) => (
          <div
            key={col.title}
            className="flex-1 min-w-[160px] bg-zinc-800/30 rounded-lg border border-zinc-700/40 overflow-hidden flex flex-col"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => handleColumnDrop(e, col.title)}
          >
            <div
              className={`px-3 py-1.5 ${col.headerBg} border-b border-zinc-700/30`}
            >
              <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                {col.title}
              </span>
              <span className="ml-2 text-[10px] text-zinc-600">
                {col.items.length}
              </span>
            </div>
            <div className="p-2 space-y-1.5 flex-1 min-h-[60px]">
              {col.items.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  onDragOver={(e) => handleDragOver(e, item.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, item.id)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 rounded-md px-2 py-2 border transition-all group ${
                    draggingId === item.id
                      ? "bg-zinc-600/40 border-zinc-500/60 opacity-50 cursor-grabbing"
                      : dragOverId === item.id
                        ? "bg-zinc-600/60 border-emerald-500/50 scale-[1.02]"
                        : "bg-zinc-700/40 border-zinc-600/30 hover:border-zinc-500/50 cursor-grab"
                  }`}
                >
                  <GripVertical className="h-3 w-3 text-zinc-600 group-hover:text-zinc-400 shrink-0 transition-colors opacity-0 group-hover:opacity-100" />
                  <input
                    ref={(el) => {
                      newCardInputs.current.set(item.id, el);
                    }}
                    value={item.label}
                    onChange={(e) => updateCardLabel(item.id, e.target.value)}
                    placeholder="New task"
                    className="flex-1 bg-transparent text-[12px] font-medium text-zinc-200 focus:outline-none placeholder-zinc-500 min-w-0 overflow-hidden text-ellipsis"
                  />
                  <button
                    onClick={() => deleteCard(col.title, item.id)}
                    className="w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all shrink-0"
                    title="Delete card"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => addCard(col.title)}
              className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/30 transition-colors border-t border-zinc-700/30"
            >
              <Plus className="h-3 w-3" />
              New Card
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export const boardViewBlock = createReactBlockSpec(
  {
    type: "boardView" as const,
    propSchema: {
      columns: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => <BoardBlock block={block} editor={editor} />,
  }
);

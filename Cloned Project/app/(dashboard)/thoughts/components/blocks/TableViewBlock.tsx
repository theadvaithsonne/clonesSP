"use client";

import React, { useState, useCallback, useRef } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";

const INITIAL_HEADERS = ["Name", "Status", "Due Date"];

const STATUS_COLORS: Record<string, string> = {
  "In Progress": "text-amber-300",
  Done: "text-emerald-300",
  Todo: "text-zinc-400",
};

const INITIAL_ROWS = [
  ["Project Alpha", "In Progress", "Jun 20"],
  ["Design Review", "Done", "Jun 18"],
  ["Sprint Planning", "Todo", "Jun 25"],
];

function TableBlock({ block, editor }: { block: any; editor: any }) {
  const loadedHeaders = block.props?.headers ? JSON.parse(block.props.headers) : INITIAL_HEADERS;
  const loadedRows = block.props?.rows ? JSON.parse(block.props.rows) : INITIAL_ROWS;
  const [headers, setHeaders] = useState(loadedHeaders);
  const [rows, setRows] = useState(loadedRows);
  const headersRef = useRef(headers);
  headersRef.current = headers;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [editingHeader, setEditingHeader] = useState<number | null>(null);
  const firstCellRef = useRef<HTMLInputElement | null>(null);

  const persistTable = useCallback((newHeaders: string[], newRows: string[][]) => {
    setHeaders(newHeaders);
    setRows(newRows);
    editor.updateBlock(block, {
      props: {
        headers: JSON.stringify(newHeaders),
        rows: JSON.stringify(newRows),
      },
    });
  }, [editor, block]);

  const addRow = useCallback(() => {
    const newRows = [...rowsRef.current, headersRef.current.map(() => "")];
    persistTable(headersRef.current, newRows);
    requestAnimationFrame(() => {
      firstCellRef.current?.focus();
      firstCellRef.current?.select();
    });
  }, [persistTable]);

  const deleteRow = useCallback((rowIndex: number) => {
    const newRows = rowsRef.current.filter((_, i) => i !== rowIndex);
    persistTable(headersRef.current, newRows);
  }, [persistTable]);

  const addColumn = useCallback(() => {
    const colName = `Column ${headersRef.current.length + 1}`;
    const newHeaders = [...headersRef.current, colName];
    const newRows = rowsRef.current.map((row) => [...row, ""]);
    persistTable(newHeaders, newRows);
  }, [persistTable]);

  const deleteColumn = useCallback((colIndex: number) => {
    if (headersRef.current.length <= 1) return;
    const newHeaders = headersRef.current.filter((_, i) => i !== colIndex);
    const newRows = rowsRef.current.map((row) => row.filter((_, i) => i !== colIndex));
    persistTable(newHeaders, newRows);
  }, [persistTable]);

  const updateHeader = useCallback((colIndex: number, value: string) => {
    const newHeaders = headersRef.current.map((h, i) => (i === colIndex ? value : h));
    persistTable(newHeaders, rowsRef.current);
  }, [persistTable]);

  const updateCell = useCallback(
    (rowIndex: number, colIndex: number, value: string) => {
      const newRows = rowsRef.current.map((row, ri) =>
        ri === rowIndex
          ? row.map((cell, ci) => (ci === colIndex ? value : cell))
          : row
      );
      persistTable(headersRef.current, newRows);
    },
    [persistTable]
  );

  return (
    <div className="w-full bg-[#1E1E1E] rounded-lg border border-zinc-800/80 overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-800/60 flex items-center justify-between">
        <span className="text-[10px] text-zinc-500 font-medium tracking-wide">
          DATA TABLE
        </span>
        <span className="text-[10px] text-zinc-600">{rows.length} rows</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-zinc-800/60">
              {headers.map((h, ci) => (
                <th
                  key={ci}
                  className="px-3 py-2 text-left text-[11px] text-zinc-500 font-semibold tracking-wide uppercase relative group"
                  onMouseEnter={() => setHoveredCol(ci)}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  {editingHeader === ci ? (
                    <input
                      autoFocus
                      value={h}
                      onChange={(e) => updateHeader(ci, e.target.value)}
                      onBlur={() => setEditingHeader(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setEditingHeader(null);
                      }}
                      className="bg-zinc-800 text-[11px] text-zinc-300 font-semibold px-1 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500/50 w-full"
                    />
                  ) : (
                    <span
                      className="cursor-text"
                      onDoubleClick={() => setEditingHeader(ci)}
                    >
                      {h}
                    </span>
                  )}
                  {hoveredCol === ci && headers.length > 1 && (
                    <button
                      onClick={() => deleteColumn(ci)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded bg-zinc-700/60 hover:bg-red-500/30 text-zinc-400 hover:text-red-400 transition-colors"
                      title="Delete column"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </th>
              ))}
              <th className="w-8 px-1 py-2">
                <button
                  onClick={addColumn}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors"
                  title="Add column"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/20 transition-colors group/row"
                onMouseEnter={() => setHoveredRow(ri)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {row.map((cell, ci) => {
                  const isStatus = ci === 1 && headers[ci]?.toLowerCase() === "status";
                  return (
                    <td key={ci} className="px-1.5 py-1.5">
                      {isStatus ? (
                        <select
                          value={cell}
                          onChange={(e) => updateCell(ri, ci, e.target.value)}
                          className="w-full bg-transparent text-[13px] font-medium text-zinc-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 rounded px-2 py-1 cursor-pointer appearance-none"
                          style={{
                            color: cell && STATUS_COLORS[cell] ? undefined : "#a1a1aa",
                          }}
                        >
                          <option value="" className="bg-zinc-800 text-zinc-400">Select status</option>
                          {Object.keys(STATUS_COLORS).map((status) => (
                            <option key={status} value={status} className="bg-zinc-800" style={{ color: STATUS_COLORS[status].replace("text-", "#") }}>
                              {status}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          ref={ri === rows.length - 1 && ci === 0 ? firstCellRef : undefined}
                          value={cell}
                          onChange={(e) => updateCell(ri, ci, e.target.value)}
                          placeholder={headers[ci]}
                          className="w-full bg-transparent text-[13px] text-zinc-200 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500/50 rounded px-2 py-1 placeholder-zinc-600"
                        />
                      )}
                    </td>
                  );
                })}
                <td className="w-8 px-1 py-1.5">
                  {hoveredRow === ri && (
                    <button
                      onClick={() => deleteRow(ri)}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/30 text-zinc-500 hover:text-red-400 transition-colors"
                      title="Delete row"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addRow}
        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-colors border-t border-zinc-800/40"
      >
        <Plus className="h-3 w-3" />
        Add row
      </button>
    </div>
  );
}

export const tableViewBlock = createReactBlockSpec(
  {
    type: "tableView" as const,
    propSchema: {
      headers: { default: "", type: "string" },
      rows: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => <TableBlock block={block} editor={editor} />,
  }
);

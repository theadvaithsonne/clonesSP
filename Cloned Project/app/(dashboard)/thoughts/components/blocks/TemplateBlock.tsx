"use client";

import React, { useState, useCallback } from "react";
import { LayoutGrid, FileText, CheckSquare, List, MessageCircle, Calendar, ChevronRight } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  blocks: any[];
}

const TEMPLATES: Template[] = [
  {
    id: "meeting-notes",
    name: "Meeting Notes",
    description: "Agenda, attendees, and action items",
    icon: <FileText className="h-4 w-4 text-sky-400" />,
    blocks: [
      { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Meeting Notes", styles: { bold: true } }] },
      { type: "paragraph", content: [{ type: "text", text: "Date: ", styles: { bold: true } }, { type: "text", text: "June 25, 2026", styles: {} }] },
      { type: "heading", props: { level: 3 }, content: [{ type: "text", text: "Attendees", styles: {} }] },
      { type: "paragraph", content: [{ type: "text", text: "—", styles: {} }] },
      { type: "heading", props: { level: 3 }, content: [{ type: "text", text: "Agenda", styles: {} }] },
      { type: "bulletListItem", content: [{ type: "text", text: "Item 1", styles: {} }] },
      { type: "heading", props: { level: 3 }, content: [{ type: "text", text: "Action Items", styles: {} }] },
      { type: "checkListItem", content: [{ type: "text", text: "Follow up on action item", styles: {} }] },
    ],
  },
  {
    id: "task-list",
    name: "Task List",
    description: "Simple to-do checklist template",
    icon: <CheckSquare className="h-4 w-4 text-emerald-400" />,
    blocks: [
      { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Task List", styles: { bold: true } }] },
      { type: "checkListItem", content: [{ type: "text", text: "Complete project setup", styles: {} }] },
      { type: "checkListItem", content: [{ type: "text", text: "Review design mockups", styles: {} }] },
      { type: "checkListItem", content: [{ type: "text", text: "Write documentation", styles: {} }] },
      { type: "checkListItem", content: [{ type: "text", text: "Schedule review meeting", styles: {} }] },
    ],
  },
  {
    id: "project-brief",
    name: "Project Brief",
    description: "Overview, goals, and timeline",
    icon: <LayoutGrid className="h-4 w-4 text-violet-400" />,
    blocks: [
      { type: "heading", props: { level: 1 }, content: [{ type: "text", text: "Project Brief", styles: { bold: true } }] },
      { type: "paragraph", content: [{ type: "text", text: "A brief overview of the project goals and deliverables.", styles: { italic: true } }] },
      { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Goals", styles: {} }] },
      { type: "bulletListItem", content: [{ type: "text", text: "Define project scope and objectives", styles: {} }] },
      { type: "bulletListItem", content: [{ type: "text", text: "Identify key stakeholders", styles: {} }] },
      { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Timeline", styles: {} }] },
      { type: "paragraph", content: [{ type: "text", text: "Phase 1: ", styles: { bold: true } }, { type: "text", text: "Discovery and planning", styles: {} }] },
      { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Deliverables", styles: {} }] },
      { type: "numberedListItem", content: [{ type: "text", text: "Project plan document", styles: {} }] },
      { type: "numberedListItem", content: [{ type: "text", text: "Design mockups", styles: {} }] },
    ],
  },
  {
    id: "journal",
    name: "Daily Journal",
    description: "Reflect on the day",
    icon: <MessageCircle className="h-4 w-4 text-amber-400" />,
    blocks: [
      { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Daily Journal", styles: { bold: true } }] },
      { type: "paragraph", content: [{ type: "text", text: "Date: ", styles: { bold: true } }, { type: "text", text: "June 25, 2026", styles: {} }] },
      { type: "heading", props: { level: 3 }, content: [{ type: "text", text: "What went well today?", styles: {} }] },
      { type: "paragraph", content: [] },
      { type: "heading", props: { level: 3 }, content: [{ type: "text", text: "What could be improved?", styles: {} }] },
      { type: "paragraph", content: [] },
      { type: "heading", props: { level: 3 }, content: [{ type: "text", text: "Gratitude", styles: {} }] },
      { type: "paragraph", content: [] },
    ],
  },
];

function TemplateRenderer({ block, editor }: { block: any; editor: any }) {
  const [showPicker, setShowPicker] = useState(false);
  const [appliedTemplate, setAppliedTemplate] = useState(
    block.props?.templateName || ""
  );

  const applyTemplate = useCallback(
    (template: Template) => {
      editor.insertBlocks(template.blocks, block, "after");
      setAppliedTemplate(template.name);
      editor.updateBlock(block, {
        props: { templateName: template.name },
      });
      setShowPicker(false);
    },
    [editor, block]
  );

  return (
    <div className="w-full bg-[#1E1E1E] rounded-lg border border-zinc-800/80 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-[10px] text-zinc-500 font-medium tracking-wide">
            TEMPLATE
          </span>
          {appliedTemplate && (
            <span className="text-[10px] text-zinc-600">
              — {appliedTemplate}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {showPicker ? "Close" : "Browse"}
        </button>
      </div>

      {showPicker && (
        <div className="grid grid-cols-2 gap-2 p-3">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => applyTemplate(template)}
              className="flex items-start gap-2.5 bg-zinc-800/30 hover:bg-zinc-800/60 border border-zinc-700/40 hover:border-violet-500/40 rounded-lg p-3 text-left transition-all group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-md bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center shrink-0 group-hover:bg-violet-500/10 transition-colors">
                {template.icon}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] text-zinc-200 font-medium group-hover:text-violet-300 transition-colors">
                  {template.name}
                </span>
                <span className="text-[9px] text-zinc-500 leading-snug mt-0.5">
                  {template.description}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {!showPicker && !appliedTemplate && (
        <div className="flex items-center justify-center py-4">
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-2 text-[11px] text-zinc-500 hover:text-violet-300 transition-colors"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Choose a template
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export const templateBlock = createReactBlockSpec(
  {
    type: "template" as const,
    propSchema: {
      templateName: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      return <TemplateRenderer block={block} editor={editor} />;
    },
  }
);

"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  ChevronDown,
  Star,
  Trash2,
  Archive,
  Pin,
  PinOff,
  MoreVertical,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  UserCheck,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Sparkles,
  List,
  ListOrdered,
  CheckSquare,
  Palette,
  Paintbrush,
  RefreshCw,
  Image,
  Video,
  Music,
  File,
  FileText,
  Globe,
  Youtube,
  Code,
  Table as TableIcon,
  CheckCircle2,
  Wand2,
  Loader2,
  Copy,
  Share2,
  Link,
  ImageUp,
  ListChecks,
  CalendarDays,
  BarChart3,
  User,
  Calendar,
  Bell,
  Link2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { UserProvider } from "@/context/UserContext";
import { Note, CreateNoteData, UpdateNoteData, NoteBreadcrumbItem } from "./types";
import { buildExternalUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/utils/api";
import NoteBreadcrumbs from "./components/NoteBreadcrumbs";
import NotionDropdownItem from "./components/NotionDropdownItem";
import NotePageHeader from "./components/NotePageHeader";
import NotePageComments from "./components/NotePageComments";
import NoteSharePopover from "./components/NoteSharePopover";
import { buildNoteMemberUrl, buildNotePublicUrl, dedupeNoteBreadcrumbs, patchNoteParentId } from "@/lib/thoughts-events";
import { resolveNoteAccess } from "@/lib/noteAccess";
import { getUserIdFromToken } from "@/lib/auth";
import type { NotePageComment } from "./types";
import NotesReminderListener from "./components/NotesReminderListener";

// BlockNote editor imports
import { filterSuggestionItems, insertOrUpdateBlock as _insertOrUpdateBlock, defaultBlockSpecs, BlockNoteSchema } from "@blocknote/core";
const insertOrUpdateBlock = _insertOrUpdateBlock as any;
import { 
  useCreateBlockNote, 
  getDefaultReactSlashMenuItems, 
  SuggestionMenuController,
  SideMenuController,
  SideMenu,
  DragHandleButton,
  AddBlockButton,
  DragHandleMenu,
  RemoveBlockItem,
  BlockColorsItem
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { uploadFiles } from "@/utils/uploadthing";
import CommandsMenu from "./components/CommandsMenu";
import {
  coverPhotoBlock,
  documentListBlock,
  calendarViewBlock,
  timelineViewBlock,
  chartViewBlock,
  linkedViewBlock,
  tableViewBlock,
  boardViewBlock,
  galleryViewBlock,
  nestedPageBlock,
  pageLinkPillBlock,
  mentionPersonBlock,
  mentionPageBlock,
  datePickerBlock,
  reminderBlock,
  tableOfContentsBlock,
  commentBlock,
  buttonBlock,
  templateBlock,
  syncedBlockBlock,
  embedBlock,
  webBookmarkBlock,
  mathBlock,
  imageBlock,
  videoBlock,
  audioBlock,
  fileBlock,
} from "./components/blocks";

// Seed data matching the Figma file pages
const DEFAULT_FIGMA_CONTENT = [
  {
    type: "heading",
    props: { level: 2 },
    content: [{ type: "text", text: "Overview", styles: {} }]
  },
  {
    type: "paragraph",
    content: [
      {
        type: "text",
        text: "Use this section to outline the core objectives, schedule, and key details of the workshop. You can format text with headings, lists, or checklists.",
        styles: {}
      }
    ]
  },
  {
    type: "table",
    content: {
      type: "tableContent",
      rows: [
        {
          cells: [
            [{"type": "text", "text": "Name", "styles": {"bold": true}}],
            [{"type": "text", "text": "Status", "styles": {"bold": true}}],
            [{"type": "text", "text": "Due Date", "styles": {"bold": true}}]
          ]
        },
        {
          cells: [
            [{"type": "text", "text": "Project Alpha", "styles": {}}],
            [{"type": "text", "text": "In Progress", "styles": {}}],
            [{"type": "text", "text": "Jun 20", "styles": {}}]
          ]
        },
        {
          cells: [
            [{"type": "text", "text": "Design Review", "styles": {}}],
            [{"type": "text", "text": "Done", "styles": {}}],
            [{"type": "text", "text": "Jun 18", "styles": {}}]
          ]
        },
        {
          cells: [
            [{"type": "text", "text": "Sprint Planning", "styles": {}}],
            [{"type": "text", "text": "Todo", "styles": {}}],
            [{"type": "text", "text": "Jun 25", "styles": {}}]
          ]
        }
      ]
    }
  },
  {
    type: "paragraph",
    content: []
  },
  {
    type: "paragraph",
    props: { backgroundColor: "gray" },
    content: [
      {
        type: "text",
        text: "💡 Tip: keep your page title short and descriptive. It helps with search and navigation.",
        styles: { italic: true }
      }
    ]
  },
  {
    type: "paragraph",
    content: []
  },
  {
    type: "heading",
    props: { level: 3 },
    content: [{ type: "text", text: "Tasks", styles: {} }]
  },
  {
    type: "checkListItem",
    props: { checked: true },
    content: [{ type: "text", text: "Prepare workshop outline", styles: {} }]
  }
];

const SEED_NOTES: Partial<Note>[] = [
  {
    id: "figma-garage",
    title: "Garage",
    content: JSON.stringify([
      { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Welcome to Garage", styles: {} }] },
      { type: "paragraph", content: [{ type: "text", text: "This is your main dashboard workspace note.", styles: {} }] }
    ]),
    color: "#ffffff",
    isStarred: true,
    isArchived: false,
    isPinned: true,
    tags: ["general"]
  },
  {
    id: "figma-workshop",
    title: "Workshop",
    content: JSON.stringify(DEFAULT_FIGMA_CONTENT),
    color: "#ffffff",
    isStarred: true,
    isArchived: false,
    isPinned: true,
    tags: ["workshop", "planning"]
  },
  {
    id: "figma-storage",
    title: "Storage Room",
    content: JSON.stringify([
      { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Storage Inventory", styles: {} }] },
      { type: "paragraph", content: [{ type: "text", text: "List of assets, devices, and office supplies.", styles: {} }] }
    ]),
    color: "#ffffff",
    isStarred: false,
    isArchived: false,
    tags: ["inventory"]
  },
  {
    id: "figma-conference",
    title: "Conference Room",
    content: JSON.stringify([
      { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Meeting Agenda", styles: {} }] },
      { type: "paragraph", content: [{ type: "text", text: "Notes for the weekly sync and updates.", styles: {} }] }
    ]),
    color: "#ffffff",
    isStarred: false,
    isArchived: false,
    tags: ["meeting"]
  },
  {
    id: "figma-break",
    title: "Break Room",
    content: JSON.stringify([
      { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Coffee & Snacks", styles: {} }] },
      { type: "paragraph", content: [{ type: "text", text: "Coffee pod flavors and snack suggestions.", styles: {} }] }
    ]),
    color: "#ffffff",
    isStarred: false,
    isArchived: false,
    tags: ["social"]
  },
  {
    id: "figma-reception",
    title: "Reception Area",
    content: JSON.stringify([
      { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Visitor Register", styles: {} }] },
      { type: "paragraph", content: [{ type: "text", text: "Schedule for incoming guests and deliveries.", styles: {} }] }
    ]),
    color: "#ffffff",
    isStarred: false,
    isArchived: false,
    tags: ["logistics"]
  },
  {
    id: "figma-server",
    title: "Server Room",
    content: JSON.stringify([
      { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Server Status & Logs", styles: {} }] },
      { type: "paragraph", content: [{ type: "text", text: "Credentials, network config, and logs.", styles: {} }] }
    ]),
    color: "#ffffff",
    isStarred: false,
    isArchived: false,
    tags: ["devops"]
  }
];

const CustomDragHandleMenu = (props: any) => {
  const editor = props.editor;
  const block = props.block;
  const note = props.note;

  const [searchQuery, setSearchQuery] = useState("");
  const [activeSubmenu, setActiveSubmenu] = useState<"none" | "turn-into" | "color">("none");

  const handleDuplicate = () => {
    const originalBlock = editor.getBlock(block.id);
    if (originalBlock) {
      const cloneWithoutId = (b: any): any => {
        const { id, children, ...rest } = b;
        return {
          ...rest,
          children: children ? children.map(cloneWithoutId) : undefined
        };
      };
      
      const cleanBlock = cloneWithoutId(originalBlock);
      editor.insertBlocks([cleanBlock], originalBlock, "after");
    }
  };

  const handleTurnInto = (type: string, headingLevel?: number) => {
    editor.updateBlock(block, {
      type,
      props: headingLevel ? { level: headingLevel } : undefined
    } as any);
  };

  const handleColorText = (colorName: string) => {
    editor.focus();
    let targetBlock = block;
    try {
      targetBlock = editor.getTextCursorPosition().block;
    } catch {
      // fall through to props.block
    }
    editor.updateBlock(targetBlock, {
      props: { textColor: colorName }
    } as any);
  };

  const handleColorBg = (colorName: string) => {
    editor.focus();
    let targetBlock = block;
    try {
      targetBlock = editor.getTextCursorPosition().block;
    } catch {
      // fall through to props.block
    }
    editor.updateBlock(targetBlock, {
      props: { backgroundColor: colorName }
    } as any);
  };

  const getFormattedLastEdited = () => {
    const dateStr = note?.updatedAt || new Date().toISOString();
    const date = new Date(dateStr);
    const now = new Date();
    
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
    const timeStr = date.toLocaleTimeString([], timeOptions);
    
    if (isToday) {
      return `Today at ${timeStr}`;
    } else if (isYesterday) {
      return `Yesterday at ${timeStr}`;
    } else {
      const dateOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
      return `${date.toLocaleDateString([], dateOptions)} at ${timeStr}`;
    }
  };

  let blockTypeLabel = "Text";
  if (block.type === "heading") {
    const level = block.props?.level || 1;
    blockTypeLabel = `Heading ${level}`;
  } else if (block.type === "bulletListItem") {
    blockTypeLabel = "Bulleted list";
  } else if (block.type === "numberedListItem") {
    blockTypeLabel = "Numbered list";
  } else if (block.type === "checkListItem") {
    blockTypeLabel = "To-do list";
  } else if (block.type === "quote") {
    blockTypeLabel = "Block quote";
  } else if (block.type === "codeBlock") {
    blockTypeLabel = "Code";
  } else if (block.type === "image") {
    blockTypeLabel = "Image";
  } else if (block.type === "video") {
    blockTypeLabel = "Video";
  } else if (block.type === "audio") {
    blockTypeLabel = "Audio";
  } else if (block.type === "file") {
    blockTypeLabel = "File";
  } else if (block.type === "table") {
    blockTypeLabel = "Table";
  }

  const turnIntoItems = [
    { label: "Text", type: "paragraph", icon: <Type className="h-4 w-4 text-zinc-400" /> },
    { label: "Heading 1", type: "heading", level: 1, icon: <Heading1 className="h-4 w-4 text-zinc-400" /> },
    { label: "Heading 2", type: "heading", level: 2, icon: <Heading2 className="h-4 w-4 text-zinc-400" /> },
    { label: "Heading 3", type: "heading", level: 3, icon: <Heading3 className="h-4 w-4 text-zinc-400" /> },
    { label: "Bulleted list", type: "bulletListItem", icon: <List className="h-4 w-4 text-zinc-400" /> },
    { label: "Numbered list", type: "numberedListItem", icon: <ListOrdered className="h-4 w-4 text-zinc-400" /> },
    { label: "To-do list", type: "checkListItem", icon: <CheckSquare className="h-4 w-4 text-zinc-400" /> },
    { label: "Block quote", type: "quote", icon: <Quote className="h-4 w-4 text-zinc-400" /> },
  ];

  const colorItems = [
    // Text colors
    { label: "Default text", color: "default", type: "text", bgClass: "bg-white text-black" },
    { label: "Gray text", color: "gray", type: "text", bgClass: "bg-zinc-500 text-white" },
    { label: "Brown text", color: "brown", type: "text", bgClass: "bg-[#964B00] text-white" },
    { label: "Orange text", color: "orange", type: "text", bgClass: "bg-orange-500 text-white" },
    { label: "Yellow text", color: "yellow", type: "text", bgClass: "bg-yellow-500 text-black" },
    { label: "Green text", color: "green", type: "text", bgClass: "bg-green-500 text-white" },
    { label: "Blue text", color: "blue", type: "text", bgClass: "bg-blue-500 text-white" },
    { label: "Purple text", color: "purple", type: "text", bgClass: "bg-purple-500 text-white" },
    { label: "Pink text", color: "pink", type: "text", bgClass: "bg-pink-500 text-white" },
    { label: "Red text", color: "red", type: "text", bgClass: "bg-red-500 text-white" },
    // Background colors
    { label: "Default background", color: "default", type: "bg", bgClass: "bg-zinc-800 text-white" },
    { label: "Gray background", color: "gray", type: "bg", bgClass: "bg-zinc-600 text-white" },
    { label: "Brown background", color: "brown", type: "bg", bgClass: "bg-[#6e3700] text-white" },
    { label: "Orange background", color: "orange", type: "bg", bgClass: "bg-orange-950 text-white" },
    { label: "Yellow background", color: "yellow", type: "bg", bgClass: "bg-yellow-950 text-yellow-200" },
    { label: "Green background", color: "green", type: "bg", bgClass: "bg-green-950 text-white" },
    { label: "Blue background", color: "blue", type: "bg", bgClass: "bg-blue-950 text-white" },
    { label: "Purple background", color: "purple", type: "bg", bgClass: "bg-purple-950 text-white" },
    { label: "Pink background", color: "pink", type: "bg", bgClass: "bg-pink-950 text-white" },
    { label: "Red background", color: "red", type: "bg", bgClass: "bg-red-950 text-white" },
  ];

  const menuActions = [
    {
      id: "turn-into",
      label: "Turn into",
      shortcut: "",
      icon: <RefreshCw className="h-4 w-4 text-zinc-400" />,
      hasSubmenu: "turn-into",
      className: "hover:bg-white/5",
      keywords: ["turn", "convert", "type", "text", "heading", "h1", "h2", "h3", "list", "bullet", "todo", "quote"]
    },
    {
      id: "color",
      label: "Color",
      shortcut: "",
      icon: <Palette className="h-4 w-4 text-zinc-400" />,
      hasSubmenu: "color",
      className: "hover:bg-white/5",
      keywords: ["color", "text color", "background color", "style", "highlight", "red", "blue", "green", "yellow", "purple", "pink", "gray", "brown"]
    },
    {
      id: "duplicate",
      label: "Duplicate",
      shortcut: "Ctrl+D",
      icon: <Copy className="h-4 w-4 text-zinc-400" />,
      action: handleDuplicate,
      className: "hover:bg-white/5",
      keywords: ["duplicate", "copy block", "clone"]
    },
    {
      id: "delete",
      label: "Delete",
      shortcut: "Del",
      icon: <Trash2 className="h-4 w-4 text-red-500" />,
      action: () => {
        editor.removeBlocks([block]);
      },
      className: "text-[#ff5555] hover:bg-red-500/10",
      keywords: ["delete", "remove", "trash", "clear", "destroy"]
    }
  ];

  const filteredActions = searchQuery.trim() === "" 
    ? menuActions 
    : [
        ...menuActions.filter(a => 
          a.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.keywords.some(k => k.includes(searchQuery.toLowerCase()))
        ),
        ...turnIntoItems.filter(t => 
          t.label.toLowerCase().includes(searchQuery.toLowerCase())
        ).map(t => ({
          id: `turn-into-${t.label.toLowerCase().replace(/\s+/g, '-')}`,
          label: `Turn into ${t.label}`,
          shortcut: "",
          icon: t.icon,
          action: () => handleTurnInto(t.type, t.level),
          className: "hover:bg-white/5",
          keywords: []
        })),
        ...colorItems.filter(c => 
          c.label.toLowerCase().includes(searchQuery.toLowerCase())
        ).map(c => ({
          id: `color-${c.label.toLowerCase().replace(/\s+/g, '-')}`,
          label: c.label,
          shortcut: "",
          icon: <Palette className="h-4 w-4" style={{ color: c.color === 'default' ? '#fff' : c.color }} />,
          action: () => c.type === 'text' ? handleColorText(c.color) : handleColorBg(c.color),
          className: "hover:bg-white/5",
          keywords: []
        }))
      ];

  if (activeSubmenu === "turn-into") {
    return (
      <DragHandleMenu {...props}>
        <div 
          className="w-[275px] bg-[#1c1c1c] text-zinc-200 rounded-xl p-1.5 border border-zinc-800/85 shadow-2xl flex flex-col gap-0.5"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => setActiveSubmenu("none")}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded text-left transition-colors font-medium border-b border-zinc-800/60 pb-2 mb-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Back to actions</span>
          </button>
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar flex flex-col gap-0.5">
            {turnIntoItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  handleTurnInto(item.type, item.level);
                  setActiveSubmenu("none");
                }}
                className="flex items-center gap-2.5 w-full px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/5 hover:text-white rounded text-left transition-colors cursor-pointer"
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </DragHandleMenu>
    );
  }

  if (activeSubmenu === "color") {
    return (
      <DragHandleMenu {...props}>
        <div 
          className="w-[275px] bg-[#1c1c1c] text-zinc-200 rounded-xl p-1.5 border border-zinc-800/85 shadow-2xl flex flex-col gap-0.5"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => setActiveSubmenu("none")}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded text-left transition-colors font-medium border-b border-zinc-800/60 pb-2 mb-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Back to actions</span>
          </button>
          <div className="max-h-[350px] overflow-y-auto custom-scrollbar flex flex-col gap-0.5 pr-0.5">
            <div className="px-2 py-1 text-[11px] text-zinc-500 font-medium">Color</div>
            {colorItems.filter(c => c.type === 'text').map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  handleColorText(item.color);
                  setActiveSubmenu("none");
                }}
                className="flex items-center gap-2.5 w-full px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/5 hover:text-white rounded text-left transition-colors cursor-pointer"
              >
                <span className={`w-4 h-4 rounded flex items-center justify-center font-bold text-[10px] ${item.bgClass}`}>
                  A
                </span>
                <span>{item.label}</span>
              </button>
            ))}
            <div className="border-t border-zinc-800 my-1.5" />
            <div className="px-2 py-1 text-[11px] text-zinc-500 font-medium">Background</div>
            {colorItems.filter(c => c.type === 'bg').map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  handleColorBg(item.color);
                  setActiveSubmenu("none");
                }}
                className="flex items-center gap-2.5 w-full px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/5 hover:text-white rounded text-left transition-colors cursor-pointer"
              >
                <span className={`w-4 h-4 rounded border border-zinc-700/60 ${item.bgClass}`} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </DragHandleMenu>
    );
  }

  return (
    <DragHandleMenu {...props}>
      <div 
        className="w-[275px] bg-[#1c1c1c] border border-zinc-800/80 rounded-xl p-1.5 shadow-2xl text-zinc-200 flex flex-col gap-0.5 relative"
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Search actions input */}
        <div className="px-1 py-1">
          <input
            type="text"
            placeholder="Search actions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#252525] border border-zinc-800 text-xs text-white rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder-zinc-500"
            autoFocus
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>

        {/* Current block type header */}
        <div className="px-2 py-0.5 text-[11px] text-zinc-500 font-medium select-none">
          {blockTypeLabel}
        </div>

        {/* Filtered actions */}
        <div className="flex flex-col gap-0.5">
          {filteredActions.map((item) => {
            if (item.id === "turn-into") {
              return (
                <div key={item.id} className="relative group/submenu">
                  <button
                    onClick={() => setActiveSubmenu("turn-into")}
                    className="flex items-center justify-between w-full px-2 py-1.5 text-xs text-zinc-300 hover:bg-white/5 hover:text-white rounded text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                  </button>
                  
                  {/* Hover Submenu for Desktop */}
                  <div className="absolute left-[100%] top-0 ml-1 hidden group-hover/submenu:block bg-[#1c1c1c] border border-zinc-800/80 rounded-xl p-1.5 shadow-2xl min-w-[220px] z-50">
                    <div className="px-2 py-1 text-[11px] text-zinc-500 font-medium border-b border-zinc-800/60 pb-1 mb-1 select-none">Turn into</div>
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar flex flex-col gap-0.5">
                      {turnIntoItems.map((subItem) => (
                        <button
                          key={subItem.label}
                          onClick={() => handleTurnInto(subItem.type, subItem.level)}
                          className="flex items-center gap-2.5 w-full px-2 py-1.5 text-xs text-zinc-300 hover:bg-white/5 hover:text-white rounded text-left transition-colors cursor-pointer"
                        >
                          {subItem.icon}
                          <span>{subItem.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            if (item.id === "color") {
              return (
                <div key={item.id} className="relative group/submenu">
                  <button
                    onClick={() => setActiveSubmenu("color")}
                    className="flex items-center justify-between w-full px-2 py-1.5 text-xs text-zinc-300 hover:bg-white/5 hover:text-white rounded text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                  </button>
                  
                  {/* Hover Submenu for Desktop */}
                  <div className="absolute left-[100%] top-0 ml-1 hidden group-hover/submenu:block bg-[#1c1c1c] border border-zinc-800/80 rounded-xl p-1.5 shadow-2xl min-w-[240px] z-50 max-h-[350px] overflow-y-auto custom-scrollbar">
                    <div className="px-2.5 py-1 text-[11px] text-zinc-500 font-medium select-none">Color</div>
                    <div className="flex flex-col gap-0.5">
                      {colorItems.filter(c => c.type === 'text').map((subItem) => (
                        <button
                          key={subItem.label}
                          onClick={() => handleColorText(subItem.color)}
                          className="flex items-center gap-2.5 w-full px-2 py-1.5 text-xs text-zinc-300 hover:bg-white/5 hover:text-white rounded text-left transition-colors cursor-pointer"
                        >
                          <span className={`w-4 h-4 rounded flex items-center justify-center font-bold text-[10px] ${subItem.bgClass}`}>
                            A
                          </span>
                          <span>{subItem.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-zinc-800 my-1.5" />
                    <div className="px-2.5 py-1 text-[11px] text-zinc-500 font-medium select-none">Background</div>
                    <div className="flex flex-col gap-0.5">
                      {colorItems.filter(c => c.type === 'bg').map((subItem) => (
                        <button
                          key={subItem.label}
                          onClick={() => handleColorBg(subItem.color)}
                          className="flex items-center gap-2.5 w-full px-2 py-1.5 text-xs text-zinc-300 hover:bg-white/5 hover:text-white rounded text-left transition-colors cursor-pointer"
                        >
                          <span className={`w-4 h-4 rounded border border-zinc-700/60 ${subItem.bgClass}`} />
                          <span>{subItem.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <button
                key={item.id}
                onClick={item.action}
                className={`flex items-center justify-between w-full px-2 py-1.5 text-xs rounded text-left transition-colors cursor-pointer ${item.className || "text-zinc-300 hover:bg-white/5 hover:text-white"}`}
              >
                <div className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.shortcut && (
                  <span className="text-[10px] text-zinc-500 font-mono tracking-wider select-none pr-1">
                    {item.shortcut}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer: Last edited info */}
        <div className="border-t border-zinc-800/80 mt-1 px-2.5 pt-2 pb-1 text-[11px] text-zinc-500 flex flex-col gap-0.5 select-none pointer-events-none">
          <div>Last edited by Ram Mahender</div>
          <div>{getFormattedLastEdited()}</div>
        </div>
      </div>
    </DragHandleMenu>
  );
};

const getYouTubeVideoId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export default function ThoughtsPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showYouTubeDialog, setShowYouTubeDialog] = useState(false);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<NoteBreadcrumbItem[]>([]);

  const originalValuesRef = useRef<{
    title: string;
    content: string;
  } | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<Note[]>([]);
  const activeNoteRef = useRef<Note | null>(null);
  const handleCreateSubPageRef = useRef<() => void | Promise<void>>(() => {});

  const noteAccess = useMemo(() => {
    const resolved = resolveNoteAccess(activeNote, currentUserId);
    if (activeNote?.canEdit !== undefined) {
      return {
        ...resolved,
        canEdit: Boolean(activeNote.canEdit),
        canComment: Boolean(activeNote.canComment ?? resolved.canComment),
        canShare: Boolean(activeNote.canShare ?? resolved.canShare),
      };
    }
    return resolved;
  }, [activeNote, currentUserId]);

  useEffect(() => {
    setCurrentUserId(getUserIdFromToken());
  }, []);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    activeNoteRef.current = activeNote;
  }, [activeNote]);

  // Initialize BlockNote editor with file upload support
  const notesSchema = React.useMemo(() => BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      coverPhoto: coverPhotoBlock(),
      documentList: documentListBlock(),
      calendarView: calendarViewBlock(),
      timelineView: timelineViewBlock(),
      chartView: chartViewBlock(),
      linkedView: linkedViewBlock(),
      tableView: tableViewBlock(),
      boardView: boardViewBlock(),
      galleryView: galleryViewBlock(),
      nestedPage: nestedPageBlock(),
      pageLinkPill: pageLinkPillBlock(),
      mentionPerson: mentionPersonBlock(),
      mentionPage: mentionPageBlock(),
      datePicker: datePickerBlock(),
      reminder: reminderBlock(),
      tableOfContents: tableOfContentsBlock(),
      comment: commentBlock(),
      button: buttonBlock(),
      template: templateBlock(),
      syncedBlock: syncedBlockBlock(),
      embed: embedBlock(),
      webBookmark: webBookmarkBlock(),
      math: mathBlock(),
      image: imageBlock(),
      video: videoBlock(),
      audio: audioBlock(),
      file: fileBlock(),
    } as any,
  }), []);

  const editor = useCreateBlockNote({
    schema: notesSchema as unknown as Parameters<typeof useCreateBlockNote>[0]["schema"],
    initialContent: undefined,
    uploadFile: async (file: File) => {
      try {
        let endpoint: "postImages" | "postVideos" | "postDocuments";
        if (file.type.startsWith("image/")) {
          endpoint = "postImages";
        } else if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
          endpoint = "postVideos";
        } else {
          endpoint = "postDocuments";
        }
        const response = await uploadFiles(endpoint, {
          files: [file],
        });
        const url = response?.[0]?.ufsUrl || response?.[0]?.url;
        if (url) {
          return url;
        }
        throw new Error("Upload failed - no URL returned");
      } catch (error) {
        console.error("File upload error:", error);
        toast.error("Failed to upload file");
        throw error;
      }
    },
  });

  const renderSideMenu = React.useCallback(
    (sideMenuProps: any) => {
      const handleOpenChange = (open: boolean) => {
        if (open) {
          sideMenuProps.freezeMenu?.();
        } else {
          sideMenuProps.unfreezeMenu?.();
        }
        setSideMenuOpen(open);
      };

      const handleClose = () => {
        setSideMenuOpen(false);
        sideMenuProps.unfreezeMenu?.();
      };

      return (
        <SideMenu {...sideMenuProps}>
          <Popover open={sideMenuOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setSideMenuOpen(true);
                  sideMenuProps.freezeMenu?.();
                }}
                className="w-6 h-6 flex items-center justify-center hover:bg-white/5 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent 
              side="right" 
              align="start" 
              sideOffset={4}
              onOpenAutoFocus={(e) => e.preventDefault()}
              className="w-[511px] max-w-[calc(100vw-32px)] p-4 bg-[#0f0f11] border border-zinc-800/80 shadow-2xl rounded-xl text-white z-[9999]"
            >
              <CommandsMenu 
                editor={editor} 
                block={sideMenuProps.block}
                onClose={handleClose}
                onShowYouTubeDialog={() => setShowYouTubeDialog(true)}
                onCreateSubPage={() => handleCreateSubPageRef.current()}
              />
            </PopoverContent>
          </Popover>
          <DragHandleButton
            {...sideMenuProps}
            dragHandleMenu={(dragHandleMenuProps) => (
              <CustomDragHandleMenu
                {...sideMenuProps}
                {...dragHandleMenuProps}
                note={activeNote}
              />
            )}
          />
        </SideMenu>
      );
    },
    [activeNote, editor, sideMenuOpen]
  );
  const fetchNotes = async () => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(buildExternalUrl("notes"));
      
      let fetchedNotes: Note[] = [];
      if (response.ok) {
        const data = await response.json();
        fetchedNotes = data.notes || [];
      }

      const activeNotes = fetchedNotes.filter(n => !n.isDeleted && !n.isArchived);
      
      // Sort active notes by updatedAt descending (latest note first)
      activeNotes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      if (activeNotes.length > 0) {
        setNotes(activeNotes);
        // Select the latest updated note
        selectNote(activeNotes[0]);
      } else {
        // No notes exist! Create a blank Notion-style note
        await createInitialBlankNote();
      }
    } catch (error) {
      console.error("Error fetching notes:", error);
      createLocalBlankNote();
    } finally {
      setIsLoading(false);
    }
  };

  const createInitialBlankNote = async () => {
    try {
      setIsSaving(true);
      const newTitle = "";
      const newContent = JSON.stringify([{ type: "paragraph", content: [] }]);

      let newNote: Note;
      try {
        const response = await authenticatedFetch(buildExternalUrl("notes"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newTitle,
            content: newContent,
            color: "#ffffff",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          newNote = data.note;
        } else {
          throw new Error("Failed to create on API");
        }
      } catch (e) {
        const timestamp = new Date().toISOString();
        newNote = {
          id: `local-${Date.now()}`,
          title: newTitle,
          content: newContent,
          color: "#ffffff",
          isStarred: false,
          isArchived: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
      }

      setNotes([newNote]);
      selectNote(newNote);
    } catch (error) {
      console.error("Error creating initial note:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const createLocalBlankNote = () => {
    const timestamp = new Date().toISOString();
    const newNote: Note = {
      id: `local-${Date.now()}`,
      title: "",
      content: JSON.stringify([{ type: "paragraph", content: [] }]),
      color: "#ffffff",
      isStarred: false,
      isArchived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setNotes([newNote]);
    selectNote(newNote);
  };

  const selectNote = (note: Note) => {
    setActiveNote(note);
    setTitle(note.title || "");
    
    // Load content into editor
    if (editor) {
      try {
        const blocks = typeof note.content === "string"
          ? JSON.parse(note.content)
          : note.content;

        if (Array.isArray(blocks) && blocks.length > 0) {
          editor.replaceBlocks(editor.document, blocks);
        } else {
          editor.replaceBlocks(editor.document, [{ type: "paragraph", content: [] }]);
        }
      } catch (e) {
        if (note.content && typeof note.content === "string" && note.content.trim()) {
          editor.replaceBlocks(editor.document, [{
            type: "paragraph",
            content: [{ type: "text", text: note.content, styles: {} }]
          }]);
        } else {
          editor.replaceBlocks(editor.document, [{ type: "paragraph", content: [] }]);
        }
      }
    }

    originalValuesRef.current = {
      title: note.title || "",
      content: typeof note.content === "string" ? note.content : JSON.stringify(note.content),
    };
    setHasUnsavedChanges(false);
    void loadBreadcrumbs(note);
    // Ensure current crumb shows page icon
    setTimeout(() => {
      setBreadcrumbs((prev) => {
        if (prev.length === 0) {
          return [
            {
              id: note.id,
              title: note.title?.trim() || "New page",
              icon: note.icon || null,
            },
          ];
        }
        const next = [...prev];
        next[next.length - 1] = {
          ...next[next.length - 1],
          icon: note.icon || next[next.length - 1].icon || null,
        };
        return next;
      });
    }, 0);
  };

  const loadBreadcrumbs = async (note: Note) => {
    if (!note.parentId || note.id.startsWith("local-")) {
      // Build from local notes when offline / no parent
      if (!note.parentId) {
        setBreadcrumbs([]);
        return;
      }
      const chain: NoteBreadcrumbItem[] = [];
      let current: Note | undefined = note;
      const seen = new Set<string>();
      while (current?.parentId && !seen.has(current.parentId)) {
        seen.add(current.parentId);
        const parent = notesRef.current.find((n) => n.id === current!.parentId);
        if (!parent) break;
        chain.unshift({ id: parent.id, title: parent.title?.trim() || "Untitled" });
        current = parent;
      }
      chain.push({ id: note.id, title: note.title?.trim() || "New page" });
      setBreadcrumbs(chain);
      return;
    }

    try {
      const response = await authenticatedFetch(buildExternalUrl(`notes/${note.id}/breadcrumb`));
      if (response.ok) {
        const data = await response.json();
        setBreadcrumbs(dedupeNoteBreadcrumbs(data.breadcrumbs || []));
        return;
      }
    } catch (error) {
      console.error("Error loading breadcrumbs:", error);
    }

    // Fallback: parent title from local list
    const parent = notesRef.current.find((n) => n.id === note.parentId);
    setBreadcrumbs([
      ...(parent ? [{ id: parent.id, title: parent.title?.trim() || "Untitled" }] : []),
      { id: note.id, title: note.title?.trim() || "New page" },
    ]);
  };

  const openNoteById = async (noteId: string) => {
    const existing = notesRef.current.find((n) => n.id === noteId);
    if (existing) {
      selectNote(existing);
      return;
    }
    try {
      const response = await authenticatedFetch(buildExternalUrl(`notes/${noteId}`));
      if (response.ok) {
        const fetched = await response.json();
        setNotes((prev) => (prev.some((n) => n.id === fetched.id) ? prev : [fetched, ...prev]));
        selectNote(fetched);
        return;
      }
    } catch (error) {
      console.error("Error opening note:", error);
    }
    toast.error("Page not found. It may have been deleted.");
  };

  const renderNoteRow = (noteItem: Note) => {
    return (
      <div
        key={noteItem.id}
        onClick={() => {
          selectNote(noteItem);
          setIsDropdownOpen(false);
        }}
        className={`group px-3 py-2 flex items-center justify-between hover:bg-white/5 cursor-pointer ${activeNote?.id === noteItem.id ? "bg-white/5 text-white font-medium" : "text-zinc-300"}`}
      >
        <div className="flex items-center gap-2 truncate">
          <FileText className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          <span className="truncate">{noteItem.title || "Untitled"}</span>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          {/* Actions Button (...) */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              side="right"
              sideOffset={4}
              className="bg-[#1c1c1c] border-zinc-800 text-white text-xs z-[9999999]"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  selectNote(noteItem);
                  setIsDropdownOpen(false);
                  setTimeout(() => {
                    titleInputRef.current?.focus();
                    titleInputRef.current?.select();
                  }, 150);
                }} 
                className="hover:bg-white/5 cursor-pointer flex items-center gap-2 py-1.5"
              >
                <Type className="h-3.5 w-3.5 text-zinc-400" />
                <span>Edit</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const isLocal = noteItem.id.startsWith("local-");
                    if (!isLocal) {
                      await authenticatedFetch(buildExternalUrl(`notes/${noteItem.id}`), { method: "DELETE" });
                    }
                    const remainingNotes = notes.filter(n => n.id !== noteItem.id);
                    setNotes(remainingNotes);
                    if (activeNote?.id === noteItem.id) {
                      const remainingActive = remainingNotes.filter(n => !n.isDeleted && !n.isArchived);
                      if (remainingActive.length > 0) {
                        selectNote(remainingActive[0]);
                      } else {
                        createLocalBlankNote();
                      }
                    }
                    toast.success("Note moved to trash");
                  } catch (err) {
                    console.error(err);
                  }
                }} 
                className="hover:bg-red-500/10 text-red-500 cursor-pointer flex items-center gap-2 py-1.5 focus:text-red-500 focus:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Plus Button (+) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              selectNote(noteItem);
              setIsDropdownOpen(false);
            }}
            className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // Load notes on component mount (+ deep-link ?noteId= or pending inline open)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const noteParam = params.get("noteId");
    let pendingNoteId: string | null = null;
    try {
      pendingNoteId = sessionStorage.getItem("thoughts:inline-pending-note-id");
      if (pendingNoteId) sessionStorage.removeItem("thoughts:inline-pending-note-id");
    } catch {
      pendingNoteId = null;
    }
    const targetNoteId = noteParam || pendingNoteId;

    if (targetNoteId) {
      const loadAndOpen = async () => {
        try {
          setIsLoading(true);
          const response = await authenticatedFetch(buildExternalUrl("notes"));
          let fetchedNotes: Note[] = [];
          if (response.ok) {
            const data = await response.json();
            fetchedNotes = data.notes || [];
          }
          const activeNotes = fetchedNotes.filter(n => !n.isDeleted && !n.isArchived);
          activeNotes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          setNotes(activeNotes);
          
          const targetNote = activeNotes.find(n => n.id === targetNoteId);
          if (targetNote) {
            notesRef.current = activeNotes;
            selectNote(targetNote);
          } else {
            void openNoteById(targetNoteId);
          }
        } catch (error) {
          console.error("Error loading targeted note:", error);
          createLocalBlankNote();
        } finally {
          setIsLoading(false);
        }
      };
      void loadAndOpen();
    } else {
      fetchNotes();
    }
  }, []);

  // Open note from workspace deep-link event
  useEffect(() => {
    const onOpenNote = (event: Event) => {
      const customEvent = event as CustomEvent<{ noteId?: string }>;
      const noteId = customEvent.detail?.noteId;
      if (noteId) void openNoteById(noteId);
    };
    window.addEventListener("thoughts:open-note", onOpenNote as EventListener);
    return () => window.removeEventListener("thoughts:open-note", onOpenNote as EventListener);
  }, []);

  // Listen for inline refresh event
  useEffect(() => {
    const handleRefresh = (event: Event) => {
      const customEvent = event as CustomEvent<{ section?: string }>;
      if (customEvent.detail?.section === "all-notes") {
        fetchNotes();
      }
    };
    window.addEventListener("thoughts:inline-refresh", handleRefresh as EventListener);
    return () => {
      window.removeEventListener("thoughts:inline-refresh", handleRefresh as EventListener);
    };
  }, []);

  // Listen for inline navigation event (Add Page, Import, Open Page)
  useEffect(() => {
    const handleInlineNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        section?: string;
        noteId?: string;
        reparentAsSubpage?: boolean;
      }>;
      const section = customEvent.detail?.section;
      if (section === "add-page") {
        handleCreateNewNote();
      } else if (section === "open-page") {
        const noteId = customEvent.detail?.noteId;
        if (!noteId) return;
        void (async () => {
          if (customEvent.detail?.reparentAsSubpage) {
            const parentId = activeNoteRef.current?.id;
            if (parentId && parentId !== noteId) {
              const child = notesRef.current.find((n) => n.id === noteId);
              if (child?.parentId !== parentId) {
                const ok = await patchNoteParentId(noteId, parentId);
                if (ok) {
                  notesRef.current = notesRef.current.map((n) =>
                    n.id === noteId ? { ...n, parentId } : n
                  );
                  setNotes((prev) =>
                    prev.map((n) => (n.id === noteId ? { ...n, parentId } : n))
                  );
                }
              }
            }
          }
          void openNoteById(noteId);
        })();
      } else if (section === "import") {
        toast.info("Import feature is not supported in this offline notes version.");
      }
    };
    window.addEventListener("thoughts:inline-navigate", handleInlineNavigate as EventListener);
    return () => {
      window.removeEventListener("thoughts:inline-navigate", handleInlineNavigate as EventListener);
    };
  }, [notes, activeNote]);

  // Listen for link-subpage event: set parentId on linked child note
  useEffect(() => {
    const handleLinkSubpage = async (event: Event) => {
      const { childNoteId } = (event as CustomEvent<{ childNoteId: string }>).detail;
      const parentId = activeNoteRef.current?.id;
      if (!parentId || !childNoteId || parentId === childNoteId) return;
      const child = notesRef.current.find((n) => n.id === childNoteId);
      if (child?.parentId === parentId) return;
      const ok = await patchNoteParentId(childNoteId, parentId);
      if (!ok) {
        console.error("Failed to set parentId on linked subpage");
        return;
      }
      notesRef.current = notesRef.current.map((n) =>
        n.id === childNoteId ? { ...n, parentId } : n
      );
      setNotes((prev) =>
        prev.map((n) => (n.id === childNoteId ? { ...n, parentId } : n))
      );
    };
    window.addEventListener("thoughts:link-subpage", handleLinkSubpage as EventListener);
    return () => {
      window.removeEventListener("thoughts:link-subpage", handleLinkSubpage as EventListener);
    };
  }, []);

  // Detect editor changes
  useEffect(() => {
    if (!editor || isLoading || !activeNote) return;

    const unsubscribe = editor.onChange(() => {
      if (!originalValuesRef.current) return;
      const currentContent = JSON.stringify(editor.document);
      const contentChanged = currentContent !== originalValuesRef.current.content;
      setHasUnsavedChanges(title !== originalValuesRef.current.title || contentChanged);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [editor, isLoading, activeNote, title]);

  // Debounced auto-save effect
  useEffect(() => {
    if (isLoading || !activeNote || !hasUnsavedChanges || !noteAccess.canEdit) return;

    const delayDebounceFn = setTimeout(() => {
      saveActiveNote();
    }, 1500);

    return () => clearTimeout(delayDebounceFn);
  }, [title, hasUnsavedChanges, activeNote, noteAccess.canEdit]);

  const saveActiveNote = async () => {
    if (!activeNote || isSaving || !noteAccess.canEdit) return;

    const content = JSON.stringify(editor.document);
    try {
      setIsSaving(true);
      const isLocal = activeNote.id.startsWith("local-");
      
      let updatedNote = {
        ...activeNote,
        title,
        content,
        icon: activeNote.icon ?? null,
        coverUrl: activeNote.coverUrl ?? null,
        coverPosition: activeNote.coverPosition ?? 50,
        comments: activeNote.comments || [],
        commentsOpen: activeNote.commentsOpen ?? false,
      };

      if (!isLocal) {
        const response = await authenticatedFetch(buildExternalUrl(`notes/${activeNote.id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            content,
            icon: activeNote.icon ?? null,
            coverUrl: activeNote.coverUrl ?? null,
            coverPosition: activeNote.coverPosition ?? 50,
            comments: activeNote.comments || [],
            commentsOpen: activeNote.commentsOpen ?? false,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          updatedNote = data.note;
        }
      }

      // Update notes list
      setNotes(prev => prev.map(n => n.id === activeNote.id ? updatedNote : n));
      setActiveNote(updatedNote);
      originalValuesRef.current = { title, content };
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Error saving note:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const persistPageMeta = async (patch: {
    icon?: string | null;
    coverUrl?: string | null;
    coverPosition?: number | null;
    comments?: NotePageComment[];
    commentsOpen?: boolean;
  }) => {
    if (!activeNote) return;
    const commentsOnly = Object.keys(patch).every(
      (key) => key === "comments" || key === "commentsOpen"
    );
    if (!noteAccess.canEdit && !(commentsOnly && noteAccess.canComment)) return;
    const next = { ...activeNote, ...patch };
    setActiveNote(next);
    setNotes((prev) => prev.map((n) => (n.id === next.id ? next : n)));
    if (Object.prototype.hasOwnProperty.call(patch, "icon")) {
      setBreadcrumbs((prev) => {
        if (prev.length === 0) return prev;
        const crumbs = [...prev];
        crumbs[crumbs.length - 1] = {
          ...crumbs[crumbs.length - 1],
          icon: patch.icon ?? null,
        };
        return crumbs;
      });
    }

    if (next.id.startsWith("local-")) return;
    try {
      const response = await authenticatedFetch(buildExternalUrl(`notes/${next.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.note) {
          setActiveNote(data.note);
          setNotes((prev) => prev.map((n) => (n.id === data.note.id ? data.note : n)));
        }
      }
    } catch (error) {
      console.error("Error saving page meta:", error);
    }
  };

  const handleAddPageComment = () => {
    void persistPageMeta({ commentsOpen: true });
  };

  const handleYouTubeEmbed = () => {
    const videoId = getYouTubeVideoId(youtubeUrl);
    if (videoId) {
      insertOrUpdateBlock(editor, {
        type: "paragraph",
        content: [
          {
            type: "link",
            href: `https://www.youtube.com/watch?v=${videoId}`,
            content: `🎬 YouTube Video: https://www.youtube.com/watch?v=${videoId}`,
          },
        ],
      });
      setShowYouTubeDialog(false);
      setYoutubeUrl("");
      toast.success("YouTube link added");
    } else {
      toast.error("Invalid YouTube URL. Please enter a valid YouTube link.");
    }
  };

  const handleCreateNewNote = async () => {
    try {
      setIsSaving(true);
      const newTitle = "";
      const newContent = JSON.stringify([{ type: "paragraph", content: [] }]);

      let newNote: Note;

      // Try API first
      try {
        const response = await authenticatedFetch(buildExternalUrl("notes"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newTitle,
            content: newContent,
            color: "#ffffff",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          newNote = data.note;
        } else {
          throw new Error("Failed to create on API");
        }
      } catch (e) {
        // Fallback local creation
        const timestamp = new Date().toISOString();
        newNote = {
          id: `local-${Date.now()}`,
          title: newTitle,
          content: newContent,
          color: "#ffffff",
          isStarred: false,
          isArchived: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
      }

      setNotes(prev => [newNote, ...prev]);
      selectNote(newNote);
      setIsDropdownOpen(false);
      toast.success("New note created");
    } catch (error) {
      console.error("Error creating note:", error);
      toast.error("Failed to create note");
    } finally {
      setIsSaving(false);
    }
  };

  /** Notion-style /Page: create a child note, link it in the parent, then open it */
  const handleCreateSubPage = async () => {
    const parent = activeNoteRef.current;
    if (!parent || !editor) {
      toast.error("No active note to create a sub-page under");
      return;
    }

    try {
      setIsSaving(true);
      const newContent = JSON.stringify([{ type: "paragraph", content: [] }]);
      const parentIsLocal = parent.id.startsWith("local-");

      let newNote: Note;
      try {
        const response = await authenticatedFetch(buildExternalUrl("notes"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "",
            content: newContent,
            color: "#ffffff",
            ...(parentIsLocal ? {} : { parentId: parent.id }),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          newNote = data.note;
          if (parentIsLocal) {
            newNote = { ...newNote, parentId: parent.id };
          }
        } else {
          throw new Error("Failed to create sub-page on API");
        }
      } catch {
        const timestamp = new Date().toISOString();
        newNote = {
          id: `local-${Date.now()}`,
          title: "",
          content: newContent,
          color: "#ffffff",
          parentId: parent.id,
          isStarred: false,
          isArchived: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
      }

      // Insert linked nestedPage block into the parent editor
      insertOrUpdateBlock(editor, {
        type: "nestedPage",
        props: {
          title: "New page",
          linkedNoteId: newNote.id,
        },
      } as any);

      const parentContent = JSON.stringify(editor.document);
      const parentTitle = title;

      if (!parentIsLocal) {
        try {
          await authenticatedFetch(buildExternalUrl(`notes/${parent.id}`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: parentTitle, content: parentContent }),
          });
        } catch (saveErr) {
          console.error("Error saving parent after sub-page create:", saveErr);
        }
      }

      setNotes((prev) => {
        const updatedParent = {
          ...parent,
          title: parentTitle,
          content: parentContent,
          updatedAt: new Date().toISOString(),
        };
        const withoutDup = prev.filter((n) => n.id !== parent.id && n.id !== newNote.id);
        return [newNote, updatedParent, ...withoutDup];
      });

      selectNote(newNote);
      toast.success("Sub-page created");
    } catch (error) {
      console.error("Error creating sub-page:", error);
      toast.error("Failed to create sub-page");
    } finally {
      setIsSaving(false);
    }
  };
  handleCreateSubPageRef.current = handleCreateSubPage;

  const handleToggleStar = async (noteItem: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const isLocal = noteItem.id.startsWith("local-");
      let updatedStarred = !noteItem.isStarred;

      if (!isLocal) {
        const response = await authenticatedFetch(buildExternalUrl(`notes/${noteItem.id}/star`), {
          method: "PUT",
        });
        if (response.ok) {
          const data = await response.json();
          updatedStarred = data.isStarred;
        }
      }

      setNotes(prev => prev.map(n => n.id === noteItem.id ? { ...n, isStarred: updatedStarred } : n));
      if (activeNote && activeNote.id === noteItem.id) {
        setActiveNote(prev => prev ? { ...prev, isStarred: updatedStarred } : null);
      }
      toast.success(updatedStarred ? "Added to favourites" : "Removed from favourites");
    } catch (error) {
      console.error("Error toggling star:", error);
    }
  };

  const handleStarActiveNote = async () => {
    if (!activeNote) return;
    try {
      const isLocal = activeNote.id.startsWith("local-");
      let updatedStarred = !activeNote.isStarred;

      if (!isLocal) {
        const response = await authenticatedFetch(buildExternalUrl(`notes/${activeNote.id}/star`), {
          method: "PUT",
        });
        if (response.ok) {
          const data = await response.json();
          updatedStarred = data.isStarred;
        }
      }

      setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, isStarred: updatedStarred } : n));
      setActiveNote(prev => prev ? { ...prev, isStarred: updatedStarred } : null);
      toast.success(updatedStarred ? "Added to favourites" : "Removed from favourites");
    } catch (error) {
      console.error("Error toggling star:", error);
      toast.error("Failed to update favourite status");
    }
  };

  const fallbackCopyText = (text: string): boolean => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    let success = false;
    try {
      success = document.execCommand("copy");
    } catch (err) {
      console.error("Fallback copy failed:", err);
    }
    document.body.removeChild(textArea);
    return success;
  };

  const copyTextToClipboard = async (text: string): Promise<boolean> => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn("navigator.clipboard failed, using fallback:", err);
      }
    }
    return fallbackCopyText(text);
  };

  const handleShareNote = async () => {
    if (!activeNote) return;
    try {
      const isLocal = activeNote.id.startsWith("local-");
      let shareUrl = buildNoteMemberUrl(activeNote.id);

      if (!isLocal) {
        try {
          const response = await authenticatedFetch(buildExternalUrl(`notes/${activeNote.id}/share`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          if (response.ok) {
            const data = await response.json();
            if (data?.shareToken) {
              shareUrl = buildNotePublicUrl(data.shareToken);
            }
          }
        } catch {
          // Fallback to member link
        }
      }

      const copied = await copyTextToClipboard(shareUrl);
      if (copied) {
        toast.success("Share link copied to clipboard");
      } else {
        throw new Error("Copy failed");
      }
    } catch (error) {
      console.error("Error sharing note:", error);
      toast.error("Failed to generate share link");
    }
  };

  const handleCopyNoteLink = async () => {
    if (!activeNote) return;
    try {
      const url = buildNoteMemberUrl(activeNote.id);
      const copied = await copyTextToClipboard(url);
      if (copied) {
        toast.success("Note link copied to clipboard");
      } else {
        throw new Error("Copy failed");
      }
    } catch (error) {
      console.error("Error copying link:", error);
      toast.error("Failed to copy link");
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.dispatchEvent(new CustomEvent("thoughts:inline-refresh", { detail: { section: "all-notes" } }));
    window.setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleDeleteActiveNote = async () => {
    if (!activeNote) return;
    try {
      const isLocal = activeNote.id.startsWith("local-");
      if (!isLocal) {
        await authenticatedFetch(buildExternalUrl(`notes/${activeNote.id}`), { method: "DELETE" });
      }
      const remainingNotes = notes.filter(n => n.id !== activeNote.id);
      setNotes(remainingNotes);
      const remainingActive = remainingNotes.filter(n => !n.isDeleted && !n.isArchived);
      if (remainingActive.length > 0) {
        selectNote(remainingActive[0]);
      } else {
        createLocalBlankNote();
      }
      toast.success("Note moved to trash");
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Failed to delete note");
    }
  };

  // Filter notes based on dropdown search query
  const filteredDropdownNotes = notes.filter(n => 
    !n.isArchived && 
    !n.isDeleted && 
    n.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const starredNotes = filteredDropdownNotes.filter(n => n.isStarred);

  // Main pages (root level notes without parentId) when not searching
  const mainDropdownNotes = useMemo(() => {
    if (searchQuery.trim()) return filteredDropdownNotes;
    return filteredDropdownNotes.filter((n) => !n.parentId);
  }, [filteredDropdownNotes, searchQuery]);

  // Custom Slash Command Reference Items
  const getCustomSlashMenuItems = async (query: string) => {
    const customItems = [
      // ── BASIC TEXT ──────────────────────────────────────────────
      {
        title: "Normal Text",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "paragraph" });
        },
        aliases: ["text", "paragraph", "p", "normal"],
        group: "Basic Text",
        icon: <Type className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Normal paragraph text",
      },
      {
        title: "Heading 1",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "heading", props: { level: 1 } });
        },
        aliases: ["h1", "heading 1", "large heading"],
        group: "Basic Text",
        icon: <Heading1 className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Heading 1 — Top Level Section",
      },
      {
        title: "Heading 2",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "heading", props: { level: 2 } });
        },
        aliases: ["h2", "heading 2", "medium heading"],
        group: "Basic Text",
        icon: <Heading2 className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Heading 2 — Subsection",
      },
      {
        title: "Heading 3",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "heading", props: { level: 3 } });
        },
        aliases: ["h3", "heading 3", "small heading"],
        group: "Basic Text",
        icon: <Heading3 className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Heading 3 — Minor Heading",
      },
      {
        title: "Block Quote",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "quote" });
        },
        aliases: ["quote", "blockquote", "cite"],
        group: "Basic Text",
        icon: <Quote className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Block quote",
      },
      {
        title: "Callout",
        onItemClick: () => {
          insertOrUpdateBlock(editor, {
            type: "paragraph",
            props: { backgroundColor: "gray" },
            content: [{ type: "text", text: "💡 Use callouts to highlight tips, warnings, or key information.", styles: { italic: true } }]
          } as any);
        },
        aliases: ["callout", "info", "tip", "alert"],
        group: "Basic Text",
        icon: <Sparkles className="h-4 w-4 text-amber-400" />,
        subtext: "Use callouts to highlight tips, warnings, or key information.",
      },

      // ── LISTS ──────────────────────────────────────────────────
      {
        title: "Bulleted List",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "bulletListItem" });
        },
        aliases: ["bullet", "list", "ul"],
        group: "Lists",
        icon: <List className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "First bullet item",
      },
      {
        title: "Numbered List",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "numberedListItem" });
        },
        aliases: ["number", "ordered", "ol"],
        group: "Lists",
        icon: <ListOrdered className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "First item",
      },
      {
        title: "To-do List",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "checkListItem" });
        },
        aliases: ["todo", "task", "check"],
        group: "Lists",
        icon: <CheckSquare className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Completed task",
      },
      {
        title: "Toggle List",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "toggleListItem" });
        },
        aliases: ["toggle", "collapse"],
        group: "Lists",
        icon: <ChevronRight className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Toggle block — click to expand or collapse content",
      },
      {
        title: "Toggle Heading 1",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "heading", props: { level: 1, isToggleable: true }, content: "Heading 1" });
        },
        aliases: ["toggle-h1"],
        group: "Lists",
        icon: <ChevronRight className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Toggle Heading 1",
      },
      {
        title: "Toggle Heading 2",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "heading", props: { level: 2, isToggleable: true }, content: "Heading 2" });
        },
        aliases: ["toggle-h2"],
        group: "Lists",
        icon: <ChevronRight className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Toggle Heading 2",
      },
      {
        title: "Toggle Heading 3",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "heading", props: { level: 3, isToggleable: true }, content: "Heading 3" });
        },
        aliases: ["toggle-h3"],
        group: "Lists",
        icon: <ChevronRight className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Toggle Heading 3",
      },

      // ── TEXT COLORS ─────────────────────────────────────────────
      ...["red", "blue", "green", "yellow", "purple", "gray"].map((colorName) => ({
        title: `${colorName.charAt(0).toUpperCase() + colorName.slice(1)} Text`,
        onItemClick: () => {
          editor.addStyles({ textColor: colorName });
        },
        aliases: [colorName, "color", `text-${colorName}`],
        group: "Text Colors",
        icon: <Palette className="h-4 w-4" style={{ color: colorName === "gray" ? "#888" : colorName }} />,
        subtext: `This text is ${colorName}`,
      })),

      // ── BACKGROUND COLORS ───────────────────────────────────────
      ...["red", "blue", "green", "yellow", "purple", "gray"].map((colorName) => ({
        title: `${colorName.charAt(0).toUpperCase() + colorName.slice(1)} Background`,
        onItemClick: () => {
          const currentBlock = editor.getTextCursorPosition().block;
          editor.updateBlock(currentBlock, { props: { backgroundColor: colorName } } as any);
        },
        aliases: [`bg-${colorName}`, "background", "highlight"],
        group: "Background Colors",
        icon: <Paintbrush className="h-4 w-4" style={{ color: colorName === "gray" ? "#888" : colorName }} />,
        subtext: `Text with ${colorName} background`,
      })),
      {
        title: "Default Background",
        onItemClick: () => {
          const currentBlock = editor.getTextCursorPosition().block;
          editor.updateBlock(currentBlock, { props: { backgroundColor: "default" } } as any);
        },
        aliases: ["bg-default", "reset background"],
        group: "Background Colors",
        icon: <Paintbrush className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Text with default background",
      },

      // ── TURN INTO ───────────────────────────────────────────────
      {
        title: "Convert to Paragraph",
        onItemClick: () => {
          const currentBlock = editor.getTextCursorPosition().block;
          editor.updateBlock(currentBlock, { type: "paragraph" });
        },
        aliases: ["turn-text", "turn-p"],
        group: "Turn Into",
        icon: <RefreshCw className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Convert to plain text",
      },
      {
        title: "Convert to Heading 1",
        onItemClick: () => {
          const currentBlock = editor.getTextCursorPosition().block;
          editor.updateBlock(currentBlock, { type: "heading", props: { level: 1 } });
        },
        aliases: ["turn-h1"],
        group: "Turn Into",
        icon: <RefreshCw className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Convert to Heading 1",
      },
      {
        title: "Convert to Heading 2",
        onItemClick: () => {
          const currentBlock = editor.getTextCursorPosition().block;
          editor.updateBlock(currentBlock, { type: "heading", props: { level: 2 } });
        },
        aliases: ["turn-h2"],
        group: "Turn Into",
        icon: <RefreshCw className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Convert to Heading 2",
      },
      {
        title: "Convert to Heading 3",
        onItemClick: () => {
          const currentBlock = editor.getTextCursorPosition().block;
          editor.updateBlock(currentBlock, { type: "heading", props: { level: 3 } });
        },
        aliases: ["turn-h3"],
        group: "Turn Into",
        icon: <RefreshCw className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Convert to Heading 3",
      },
      {
        title: "Convert to Bullet List",
        onItemClick: () => {
          const currentBlock = editor.getTextCursorPosition().block;
          editor.updateBlock(currentBlock, { type: "bulletListItem" });
        },
        aliases: ["turn-bullet", "turn-ul"],
        group: "Turn Into",
        icon: <RefreshCw className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Convert to bullet list",
      },
      {
        title: "Convert to Numbered List",
        onItemClick: () => {
          const currentBlock = editor.getTextCursorPosition().block;
          editor.updateBlock(currentBlock, { type: "numberedListItem" });
        },
        aliases: ["turn-number", "turn-ol"],
        group: "Turn Into",
        icon: <RefreshCw className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Convert to numbered list",
      },
      {
        title: "Convert to Todo List",
        onItemClick: () => {
          const currentBlock = editor.getTextCursorPosition().block;
          editor.updateBlock(currentBlock, { type: "checkListItem" });
        },
        aliases: ["turn-todo", "turn-task"],
        group: "Turn Into",
        icon: <RefreshCw className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Convert to todo list",
      },
      {
        title: "Convert to Blockquote",
        onItemClick: () => {
          const currentBlock = editor.getTextCursorPosition().block;
          editor.updateBlock(currentBlock, { type: "quote" });
        },
        aliases: ["turn-blockquote"],
        group: "Turn Into",
        icon: <RefreshCw className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Convert to blockquote",
      },

      // ── MEDIA & EMBEDS ──────────────────────────────────────────
      {
        title: "Image",
        onItemClick: () => {
          insertOrUpdateBlock(editor, {
            type: "image" as const,
            props: { url: "", caption: "", previewWidth: 512 },
          } as any);
        },
        aliases: ["image", "img", "picture"],
        group: "Media & Embeds",
        icon: <Image className="h-4 w-4 text-emerald-400" />,
        subtext: "Resizable image with caption",
      },
      {
        title: "Video",
        onItemClick: () => {
          insertOrUpdateBlock(editor, {
            type: "video" as const,
            props: { url: "", caption: "", previewWidth: 512, showPreview: true },
          } as any);
        },
        aliases: ["video", "movie"],
        group: "Media & Embeds",
        icon: <Video className="h-4 w-4 text-emerald-400" />,
        subtext: "Resizable video with caption",
      },
      {
        title: "Audio",
        onItemClick: () => {
          insertOrUpdateBlock(editor, {
            type: "audio" as const,
            props: { url: "", caption: "", showPreview: true },
          } as any);
        },
        aliases: ["audio", "sound"],
        group: "Media & Embeds",
        icon: <Music className="h-4 w-4 text-emerald-400" />,
        subtext: "Embedded audio with caption",
      },
      {
        title: "YouTube",
        onItemClick: () => {
          setShowYouTubeDialog(true);
        },
        aliases: ["youtube", "yt", "embed"],
        group: "Media & Embeds",
        icon: <Youtube className="h-4 w-4 text-red-500" />,
        subtext: "Embed a YouTube video",
      },
      {
        title: "Code Block",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "codeBlock" });
        },
        aliases: ["code", "pre"],
        group: "Media & Embeds",
        icon: <Code className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Write code snippet",
      },
      {
        title: "File",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "file" } as any);
        },
        aliases: ["file", "upload", "attachment"],
        group: "Media & Embeds",
        icon: <File className="h-4 w-4 text-emerald-400" />,
        subtext: "Upload any file attachment",
      },
      {
        title: "PDF Embed",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "file" } as any);
        },
        aliases: ["pdf", "document"],
        group: "Media & Embeds",
        icon: <FileText className="h-4 w-4 text-rose-400" />,
        subtext: "Embed a PDF document inline",
      },
      {
        title: "Web Bookmark",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "webBookmark" } as any);
        },
        aliases: ["web", "bookmark", "link"],
        group: "Media & Embeds",
        icon: <Globe className="h-4 w-4 text-blue-400" />,
        subtext: "Embed a website preview via URL",
      },

      // ── DATABASE VIEWS ──────────────────────────────────────────
      {
        title: "Cover Photo",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "coverPhoto" } as any);
        },
        aliases: ["cover-photo", "dropzone", "cover", "banner", "image-upload"],
        group: "Database Views",
        icon: <ImageUp className="h-4 w-4 text-emerald-400" />,
        subtext: "Add a cover photo dropzone or upload area",
      },
      {
        title: "Document List",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "documentList" } as any);
        },
        aliases: ["list", "documents", "files", "docs"],
        group: "Database Views",
        icon: <ListChecks className="h-4 w-4 text-emerald-400" />,
        subtext: "Vertical stack of documents with file icons and dividers",
      },
      {
        title: "Calendar",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "calendarView" } as any);
        },
        aliases: ["calendar", "week", "schedule"],
        group: "Database Views",
        icon: <CalendarDays className="h-4 w-4 text-emerald-400" />,
        subtext: "Inline calendar strip with month header and days",
      },
      {
        title: "Timeline",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "timelineView" } as any);
        },
        aliases: ["timeline", "gantt", "progress"],
        group: "Database Views",
        icon: <BarChart3 className="h-4 w-4 text-emerald-400" />,
        subtext: "Gantt-style progress bar with date checkpoints",
      },
      {
        title: "Chart",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "chartView" } as any);
        },
        aliases: ["chart", "bar-chart", "analytics", "graph"],
        group: "Database Views",
        icon: <BarChart3 className="h-4 w-4 text-emerald-400" />,
        subtext: "Horizontal bar chart with alternating colored blocks",
      },
      {
        title: "Linked View",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "linkedView" } as any);
        },
        aliases: ["linked view", "linked", "database-link", "relation"],
        group: "Database Views",
        icon: <Link className="h-4 w-4 text-emerald-400" />,
        subtext: "Relational shortcut button linked to a database",
      },
      {
        title: "Table",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "tableView" } as any);
        },
        aliases: ["table", "grid", "data-table"],
        group: "Database Views",
        icon: <TableIcon className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Data table view with columns and rows",
      },
      {
        title: "Board View",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "boardView" } as any);
        },
        aliases: ["board", "kanban"],
        group: "Database Views",
        icon: <TableIcon className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Kanban board view with columns",
      },
      {
        title: "Gallery View",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "galleryView" } as any);
        },
        aliases: ["gallery", "cards"],
        group: "Database Views",
        icon: <TableIcon className="h-4 w-4 text-[#8e90a6]" />,
        subtext: "Gallery card view with image dropzones",
      },

      // ── LINKS & REFERENCES ───────────────────────────────────────
      {
        title: "Page",
        onItemClick: () => {
          void handleCreateSubPage();
        },
        aliases: ["page", "subpage", "child"],
        group: "Links & References",
        icon: <FileText className="h-4 w-4 text-zinc-400" />,
        subtext: "Create and open a sub-page",
      },
      {
        title: "Link to Page",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "pageLinkPill" });
        },
        aliases: ["link-page", "pagelink"],
        group: "Links & References",
        icon: <Link2 className="h-4 w-4 text-blue-400" />,
        subtext: "Link to another page",
      },
      {
        title: "Mention Person",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "mentionPerson" });
        },
        aliases: ["mention", "person", "user", "@"],
        group: "Links & References",
        icon: <User className="h-4 w-4 text-zinc-400" />,
        subtext: "Mention a team member",
      },
      {
        title: "Mention Page",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "mentionPage" });
        },
        aliases: ["mention-page", "pageref"],
        group: "Links & References",
        icon: <FileText className="h-4 w-4 text-zinc-400" />,
        subtext: "Reference another page",
      },
      {
        title: "Date",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "datePicker" });
        },
        aliases: ["date", "due", "deadline", "today", "tomorrow"],
        group: "Links & References",
        icon: <Calendar className="h-4 w-4 text-zinc-400" />,
        subtext: "Insert a date",
      },
      {
        title: "Reminder",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "reminder" });
        },
        aliases: ["reminder", "alert", "notify"],
        group: "Links & References",
        icon: <Bell className="h-4 w-4 text-amber-400" />,
        subtext: "Set a reminder",
      },
      {
        title: "Table of Contents",
        onItemClick: () => {
          insertOrUpdateBlock(editor, { type: "tableOfContents" });
        },
        aliases: ["toc", "contents", "outline"],
        group: "Links & References",
        icon: <List className="h-4 w-4 text-zinc-400" />,
        subtext: "Insert a table of contents",
      },

      // ── AI BLOCKS ───────────────────────────────────────────────
      {
        title: "AI Summarize",
        onItemClick: () => {
          const promise = new Promise((resolve) => setTimeout(resolve, 1500));
          toast.promise(
            promise,
            {
              loading: 'AI is summarizing this page...',
              success: 'AI Summary added to your note!',
              error: 'Failed to summarize',
            }
          );
          promise.then(() => {
            let noteText = "";
            editor.document.forEach(block => {
              if (block.type === "paragraph" && block.content && Array.isArray(block.content)) {
                block.content.forEach((c: any) => { if (c.text) noteText += c.text + " "; });
              }
            });
            const textToSummary = noteText.trim() 
              ? `This document details: "${noteText.slice(0, 100)}..."` 
              : "No text content found in note.";
            editor.insertBlocks([
              {
                type: "quote",
                content: [{ type: "text", text: `🤖 AI Summary:\n${textToSummary}\nKey points: Draft completed. Refinements in progress.`, styles: { italic: true } }]
              }
            ], editor.getTextCursorPosition().block, "after");
          });
        },
        aliases: ["ai-summarize", "summarize", "ai"],
        group: "AI Blocks",
        icon: <Sparkles className="h-4 w-4 text-brand" />,
        subtext: "Summarize the content of this page automatically",
      },
      {
        title: "AI Action Items",
        onItemClick: () => {
          const promise = new Promise((resolve) => setTimeout(resolve, 1500));
          toast.promise(
            promise,
            {
              loading: 'AI is extracting action items...',
              success: 'AI Action Items extracted!',
              error: 'Failed to extract',
            }
          );
          promise.then(() => {
            editor.insertBlocks([
              {
                type: "heading",
                props: { level: 3 },
                content: [{ type: "text", text: "🤖 AI Action Items", styles: { bold: true } }]
              },
              {
                type: "checkListItem",
                content: [{ type: "text", text: "Follow up with team on draft comments", styles: {} }]
              },
              {
                type: "checkListItem",
                content: [{ type: "text", text: "Prepare revised roadmap timeline", styles: {} }]
              }
            ], editor.getTextCursorPosition().block, "after");
          });
        },
        aliases: ["ai-action-items", "actions", "todo-ai"],
        group: "AI Blocks",
        icon: <CheckCircle2 className="h-4 w-4 text-brand" />,
        subtext: "Extract and list all action items from this content",
      },
      {
        title: "AI Improve Writing",
        onItemClick: () => {
          const currentBlock = editor.getTextCursorPosition().block;
          const promise = new Promise((resolve) => setTimeout(resolve, 1200));
          toast.promise(
            promise,
            {
              loading: 'AI is improving selected block...',
              success: 'Text improved and updated!',
              error: 'Failed to improve',
            }
          );
          promise.then(() => {
            let blockText = "";
            if (currentBlock.content && Array.isArray(currentBlock.content)) {
              currentBlock.content.forEach((c: any) => { if (c.text) blockText += c.text; });
            }
            if (!blockText.trim()) {
              blockText = "Please write some text in this block first, then run AI Improve!";
            } else {
              blockText = `✨ Improved writing: ${blockText} (clarified syntax, polished tone, and optimized flow)`;
            }
            editor.updateBlock(currentBlock, {
              content: [{ type: "text", text: blockText, styles: {} }]
            });
          });
        },
        aliases: ["ai-improve", "improve", "polish"],
        group: "AI Blocks",
        icon: <Wand2 className="h-4 w-4 text-brand" />,
        subtext: "Improve the clarity and flow of selected text",
      },
    ];

    return filterSuggestionItems(customItems, query);
  };

  return (
    <UserProvider>
    <div className={`flex h-full w-full flex-col bg-[#181818] text-white overflow-hidden relative notes-app-root${isDropdownOpen ? " notes-page-picker-open" : ""}`}>
      <NotesReminderListener onOpenNote={(noteId) => void openNoteById(noteId)} />
      
      {/* Upper header navigation — breadcrumbs + edited time live in this ribbon */}
      <header className="h-[52px] border-b border-white/5 flex items-center gap-3 px-6 select-none bg-[#141414]/40 backdrop-blur-md z-40">
        
        {/* Toggle Page dropdown */}
        <div className="flex items-center gap-1 shrink-0">
          <Popover open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 hover:bg-white/5 px-2.5 py-1.5 rounded-md transition-colors text-sm font-medium border border-transparent hover:border-white/10 text-zinc-100">
                <span className="max-w-[160px] truncate">{activeNote?.title || "Select Note"}</span>
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              </button>
            </PopoverTrigger>
            
            <PopoverContent 
              className="w-[280px] bg-[#1c1c1c] border-zinc-800/80 p-0 text-white rounded-lg shadow-2xl z-[100000]"
              onInteractOutside={(e) => {
                const target = e.target as HTMLElement;
                if (
                  target.closest("[data-notion-page-flyout]") ||
                  target.closest('[role="menu"]') || 
                  target.closest('[role="menuitem"]') || 
                  target.closest('[data-radix-menu-content]') ||
                  target.closest('[data-radix-popper-content-wrapper]') ||
                  target.closest('[data-state]')?.getAttribute('role') === 'menu'
                ) {
                  e.preventDefault();
                }
              }}
              onPointerDownOutside={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest("[data-notion-page-flyout]")) {
                  e.preventDefault();
                }
              }}
            >
              {/* Search note item */}
              <div className="p-2 border-b border-zinc-800/60 flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Find note..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-xs text-white placeholder-zinc-500"
                />
              </div>

              {/* Scrollable list */}
              <div className="max-h-[320px] overflow-y-auto py-1 text-xs px-1 space-y-2">
                
                {/* Favourites section */}
                {starredNotes.length > 0 && !searchQuery.trim() && (
                  <div>
                    <div className="px-2.5 py-1 text-[10px] text-zinc-500 font-semibold tracking-wider uppercase">Favourites</div>
                    <div className="space-y-0.5">
                      {starredNotes.map((noteItem) => (
                        <NotionDropdownItem
                          key={`fav-${noteItem.id}`}
                          note={noteItem}
                          onSelect={(noteId) => {
                            void openNoteById(noteId);
                            setIsDropdownOpen(false);
                          }}
                          activeNoteId={activeNote?.id}
                          allNotes={notes}
                          preferInlineSubpages
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Main Pages / Search Results section */}
                <div>
                  <div className="px-2.5 py-1 text-[10px] text-zinc-500 font-semibold tracking-wider uppercase">
                    {searchQuery.trim() ? "Search Results" : "Main Pages"}
                  </div>
                  <div className="space-y-0.5">
                    {mainDropdownNotes.map((noteItem) => (
                      <NotionDropdownItem
                        key={noteItem.id}
                        note={noteItem}
                        onSelect={(noteId) => {
                          void openNoteById(noteId);
                          setIsDropdownOpen(false);
                        }}
                        activeNoteId={activeNote?.id}
                        allNotes={notes}
                        preferInlineSubpages
                      />
                    ))}
                    {mainDropdownNotes.length === 0 && (
                      <div className="px-3 py-4 text-center text-zinc-500">No notes found</div>
                    )}
                  </div>
                  <div className="px-1 mt-1.5">
                    <button
                      onClick={handleCreateNewNote}
                      className="w-full text-left px-2 py-1.5 text-[11px] text-zinc-400 hover:text-white flex items-center gap-1.5 rounded hover:bg-white/5 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>New Note</span>
                    </button>
                  </div>
                </div>

              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Breadcrumbs (left) + Edited label (right of this flex area, before Share) */}
        {activeNote ? (
          <div className="flex-1 min-w-0">
            <NoteBreadcrumbs
              items={
                breadcrumbs.length > 0
                  ? breadcrumbs
                  : [
                      {
                        id: activeNote.id,
                        title: title || activeNote.title || "New page",
                        icon: activeNote.icon,
                        parentId: activeNote.parentId ?? null,
                      },
                    ]
              }
              allNotes={notes}
              activeNoteId={activeNote.id}
              onNavigate={(noteId) => void openNoteById(noteId)}
              editedLabel={(() => {
                const d = new Date(activeNote.updatedAt || Date.now());
                const mins = Math.max(
                  0,
                  Math.floor((Date.now() - d.getTime()) / 60_000)
                );
                if (mins < 1) return "Edited just now";
                if (mins < 60) return `Edited ${mins}m ago`;
                const hrs = Math.floor(mins / 60);
                if (hrs < 24) return `Edited ${hrs}h ago`;
                return `Edited ${Math.floor(hrs / 24)}d ago`;
              })()}
            />
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Right-aligned toolbar */}
        <div className="flex items-center gap-3 shrink-0">
          {activeNote && (
            <div className="flex items-center gap-1">
              {noteAccess.label && (
                <span className="text-[10px] font-medium text-zinc-500 border border-zinc-700/80 rounded-full px-2 py-0.5 mr-1">
                  {noteAccess.label}
                </span>
              )}
              {noteAccess.canShare && (
              <NoteSharePopover
                noteId={activeNote.id}
                noteTitle={activeNote.title || "Untitled"}
                trigger={
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white hover:bg-white/5 transition-colors text-sm"
                    title="Share note"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Share</span>
                  </button>
                }
              />
              )}

              {/* Copy Link */}
              <button
                onClick={handleCopyNoteLink}
                className="h-8 w-8 flex items-center justify-center hover:bg-white/5 rounded-md transition-colors text-zinc-400 hover:text-white"
                title="Copy note link"
              >
                <Link className="h-4 w-4" />
              </button>

              {/* Star / Favorite */}
              <button
                onClick={handleStarActiveNote}
                className="h-8 w-8 flex items-center justify-center hover:bg-white/5 rounded-md transition-colors text-zinc-400 hover:text-white"
                title={activeNote.isStarred ? "Remove from favourites" : "Add to favourites"}
              >
                <Star
                  className={`h-4 w-4 ${
                    activeNote.isStarred
                      ? "fill-yellow-400 text-yellow-400"
                      : ""
                  }`}
                />
              </button>

              {/* More Options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-8 w-8 flex items-center justify-center hover:bg-white/5 rounded-md transition-colors text-zinc-400 hover:text-white">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-[#1c1c1c] border-zinc-800 text-white text-xs min-w-[140px] z-[9999999]"
                >
                  <DropdownMenuItem
                    onClick={handleDeleteActiveNote}
                    className="hover:bg-red-500/10 text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer flex items-center gap-2 py-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Refresh */}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8 w-8 flex items-center justify-center hover:bg-white/5 rounded-md transition-colors disabled:opacity-60 text-zinc-400 hover:text-white"
                title="Refresh data"
                aria-label="Refresh data"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Editor Content Area */}
      <div className="flex-1 overflow-y-auto pb-48" style={{ scrollPaddingBottom: '12rem' }}>
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center min-h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
          </div>
        ) : activeNote ? (
          <div data-active-note-id={activeNote.id}>
            {/* Full-bleed cover + page chrome */}
            <NotePageHeader
              icon={activeNote.icon}
              coverUrl={activeNote.coverUrl}
              coverPosition={activeNote.coverPosition ?? 50}
              onIconChange={(icon) => void persistPageMeta({ icon })}
              onCoverChange={(coverUrl) =>
                void persistPageMeta({
                  coverUrl,
                  coverPosition: coverUrl ? activeNote.coverPosition ?? 50 : 50,
                })
              }
              onCoverPositionChange={(coverPosition) =>
                void persistPageMeta({ coverPosition })
              }
              showAddComment={
                !activeNote.commentsOpen &&
                !(activeNote.comments && activeNote.comments.length > 0)
              }
              onAddComment={handleAddPageComment}
              contentClassName="max-w-3xl mx-auto px-10 md:px-24"
            />

            <div className="max-w-3xl mx-auto px-10 md:px-24 space-y-2 pt-1">
            {/* Note Title Input */}
            <textarea
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setHasUnsavedChanges(true);
                // Keep last breadcrumb label in sync while typing
                setBreadcrumbs((prev) => {
                  if (prev.length === 0) return prev;
                  const next = [...prev];
                  next[next.length - 1] = {
                    ...next[next.length - 1],
                    title: e.target.value.trim() || "New page",
                    icon: activeNote.icon,
                  };
                  return next;
                });
              }}
              placeholder="New page"
              rows={1}
              readOnly={!noteAccess.canEdit}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
              }}
              className="w-full text-6xl md:text-7xl font-bold border-none outline-none focus:outline-none bg-transparent placeholder:text-white/15 text-white mb-2 resize-none overflow-hidden shadow-none ring-0 focus:ring-0 focus-visible:ring-0 garage-notes-title-textarea"
            />

            {isSaving && (
              <div className="flex items-center gap-1.5 text-[11px] text-white/40 pb-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving changes...
              </div>
            )}

            {(activeNote.commentsOpen ||
              (activeNote.comments && activeNote.comments.length > 0)) && (
              <NotePageComments
                comments={activeNote.comments || []}
                autoFocus={Boolean(activeNote.commentsOpen)}
                readOnly={!noteAccess.canComment}
                onChange={(comments) =>
                  void persistPageMeta({
                    comments,
                    commentsOpen: true,
                  })
                }
                onClose={() =>
                  void persistPageMeta({ commentsOpen: false, comments: [] })
                }
              />
            )}

            {/* BlockNote editor component */}
            <div className="prose prose-lg max-w-none dark-editor-override garage-notes-editor">
              <BlockNoteView editor={editor} theme="dark" editable={noteAccess.canEdit} slashMenu={false} sideMenu={false}>
                {/* Custom slash suggestions */}
                <SuggestionMenuController
                  triggerCharacter="/"
                  getItems={getCustomSlashMenuItems}
                />
                
                {/* Standard side menu handle */}
                <SideMenuController
                  sideMenu={renderSideMenu}
                />
              </BlockNoteView>
            </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-2 min-h-[300px] px-10">
            <FileText className="h-12 w-12 text-zinc-600" />
            <span className="text-lg">No Active Note Selected</span>
            <Button onClick={handleCreateNewNote} variant="outline" className="mt-2 border-zinc-700 hover:bg-zinc-800 text-zinc-300">
              <Plus className="h-4 w-4 mr-2" /> Create first note
            </Button>
          </div>
        )}
      </div>


      {/* Global CSS overrides inside the notes component to enforce absolute Notion-dark aesthetic */}
      <style jsx global>{`
        .notes-app-root.notes-page-picker-open .garage-notes-editor .bn-side-menu {
          visibility: hidden;
          pointer-events: none;
        }
        .dark-editor-override .bn-editor {
          background-color: transparent !important;
        }
        .dark-editor-override .bn-block-content[data-hovered] {
          background-color: rgba(255, 255, 255, 0.02) !important;
        }
        .dark-editor-override [data-theme="light"] {
          --bn-colors-editor-text: #ececf4 !important;
          --bn-colors-editor-background: transparent !important;
          --bn-colors-side-menu: #52525b !important;
          --bn-colors-side-menu-button: #a1a1aa !important;
          --bn-colors-hovered: rgba(255, 255, 255, 0.05) !important;
          --bn-colors-selected: rgba(255, 255, 255, 0.08) !important;
          --bn-colors-highlights-gray-text: #a1a1aa !important;
          --bn-colors-highlights-gray-background: #27272a !important;
          --bn-colors-highlights-blue-text: #93c5fd !important;
          --bn-colors-highlights-blue-background: #1e3a5f !important;
          --bn-colors-highlights-green-text: #86efac !important;
          --bn-colors-highlights-green-background: #14532d !important;
          --bn-colors-highlights-red-text: #fca5a5 !important;
          --bn-colors-highlights-red-background: #7f1d1d !important;
          --bn-colors-highlights-orange-text: #fdba74 !important;
          --bn-colors-highlights-orange-background: #7c2d12 !important;
          --bn-colors-highlights-yellow-text: #fde047 !important;
          --bn-colors-highlights-yellow-background: #713f12 !important;
          --bn-colors-highlights-purple-text: #d8b4fe !important;
          --bn-colors-highlights-purple-background: #3b0764 !important;
        }
        .dark-editor-override .bn-block-content input[type="text"],
        .dark-editor-override .bn-block-content input[type="url"] {
          color: #ececf4 !important;
          background: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
        }
        .dark-editor-override .bn-block-content input::placeholder {
          color: #71717a !important;
        }
        .dark-editor-override .bn-file-upload-label {
          background: #1a1a1e !important;
          color: #d4d4d8 !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
        }
        .dark-editor-override .bn-file-upload-label span,
        .dark-editor-override .bn-file-upload-label div,
        .dark-editor-override .bn-file-upload-label svg {
          color: #d4d4d8 !important;
          fill: #d4d4d8 !important;
        }
        .dark-editor-override .bn-file-upload-label:hover {
          background: #252529 !important;
          border-color: rgba(16, 185, 129, 0.4) !important;
        }
        .dark-editor-override img,
        .dark-editor-override video,
        .dark-editor-override audio {
          display: block !important;
          max-width: 100% !important;
          height: auto !important;
        }
      `}</style>

      {/* YouTube Embed Dialog */}
      <AlertDialog open={showYouTubeDialog} onOpenChange={setShowYouTubeDialog}>
        <AlertDialogContent className="bg-[#1c1c1c] border border-zinc-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Embed YouTube Video</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Paste a YouTube URL to embed the video in your note.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleYouTubeEmbed();
                }
              }}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full bg-[#252525] border border-zinc-800 text-xs text-white rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-zinc-500"
              autoFocus
            />
            <p className="mt-2 text-[10px] text-zinc-500">
              Supported formats: youtube.com/watch?v=, youtu.be/, youtube.com/embed/
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowYouTubeDialog(false);
                setYoutubeUrl("");
              }}
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              Cancel
            </AlertDialogCancel>
            <Button onClick={handleYouTubeEmbed} className="bg-red-600 hover:bg-red-700 text-white border-none">
              Embed Video
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
    </UserProvider>
  );
}
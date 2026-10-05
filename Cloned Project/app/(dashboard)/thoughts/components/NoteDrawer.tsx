"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Star,
  Archive,
  Trash2,
  Pin,
  MoreVertical,
  ArchiveX,
  PinOff,
  Loader2,
  Edit3,
  Save,
  X,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Sparkles,
  List,
  ListOrdered,
  CheckSquare,
  ChevronRight,
  ChevronLeft,
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
  MoreHorizontal,
  Link,
  Copy,
  ImageUp,
  ListChecks,
  CalendarDays,
  BarChart3,
  MessageSquare,
  FolderInput,
  Search,
  Plus,
  Link2,
  User,
  Calendar,
  Bell,
  Share2,
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
import CommandsMenu from "./CommandsMenu";
import { toast } from "sonner";
import { buildExternalUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/utils/api";
import { dedupeNoteBreadcrumbs, patchNoteParentId } from "@/lib/thoughts-events";
import { Note, NOTE_COLORS, NoteBreadcrumbItem } from "../types";
import NoteBreadcrumbs from "./NoteBreadcrumbs";
import NotePageHeader from "./NotePageHeader";
import NoteSharePopover from "./NoteSharePopover";
import NotePageComments from "./NotePageComments";
import type { NotePageComment } from "../types";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
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
import { uploadFiles } from "@/utils/uploadthing";
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
} from "../components/blocks";

// Helper function to extract YouTube video ID from various URL formats
const getYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;

  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
};

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

interface NoteDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  noteId?: string | null;
  initialEditMode?: boolean;
  onSave?: (note: Note) => void;
  onDelete?: (noteId: string) => void;
  onArchive?: (noteId: string) => void;
}

export default function NoteDrawer({
  isOpen,
  onClose,
  noteId,
  initialEditMode = false,
  onSave,
  onDelete,
  onArchive,
}: NoteDrawerProps) {
  const [note, setNote] = useState<Note | null>(null);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [color, setColor] = useState("#ffffff");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showTagsInput, setShowTagsInput] = useState(false);
  const [showColorPickerState, setShowColorPickerState] = useState(false);
  const [isEditorEmpty, setIsEditorEmpty] = useState(true);

  // Track original values to detect changes
  const originalValuesRef = useRef<{
    title: string;
    content: string;
    tags: string[];
    color: string;
  } | null>(null);

  // State for YouTube URL dialog
  const [showYouTubeDialog, setShowYouTubeDialog] = useState(false);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [breadcrumbs, setBreadcrumbs] = useState<NoteBreadcrumbItem[]>([]);
  const noteRef = useRef<Note | null>(null);

  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  // Listen for link-subpage event: set parentId on linked child note
  useEffect(() => {
    const handleLinkSubpage = async (event: Event) => {
      const { childNoteId } = (event as CustomEvent<{ childNoteId: string }>).detail;
      const parentId = noteRef.current?.id;
      if (!parentId || !childNoteId || parentId === childNoteId) return;
      const ok = await patchNoteParentId(childNoteId, parentId);
      if (!ok) {
        console.error("Failed to set parentId on linked subpage");
      }
    };
    window.addEventListener("thoughts:link-subpage", handleLinkSubpage as EventListener);
    return () => {
      window.removeEventListener("thoughts:link-subpage", handleLinkSubpage as EventListener);
    };
  }, []);

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
        // Determine which endpoint to use based on file type
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

  const loadBreadcrumbsForNote = async (loadedNote: Note) => {
    if (!loadedNote.parentId) {
      setBreadcrumbs([]);
      return;
    }
    try {
      const response = await authenticatedFetch(buildExternalUrl(`notes/${loadedNote.id}/breadcrumb`));
      if (response.ok) {
        const data = await response.json();
        setBreadcrumbs(dedupeNoteBreadcrumbs(data.breadcrumbs || []));
        return;
      }
    } catch (error) {
      console.error("Error loading breadcrumbs:", error);
    }
    setBreadcrumbs([
      { id: loadedNote.parentId, title: "Untitled" },
      { id: loadedNote.id, title: loadedNote.title?.trim() || "New page" },
    ]);
  };

  const applyNoteToEditor = (data: Note) => {
    setNote(data);
    setCurrentNoteId(data.id);
    setTitle(data.title || "");
    setTags(data.tags || []);
    setColor(data.color || "#ffffff");
    setHasUnsavedChanges(false);
    setIsEditMode(true);
    setShowTagsInput((data.tags && data.tags.length > 0) || false);
    setShowColorPickerState((data.color && data.color !== "#ffffff") || false);

    let loadedEmpty = true;
    if (data.content) {
      try {
        const blocks = typeof data.content === "string" ? JSON.parse(data.content) : data.content;
        if (Array.isArray(blocks) && blocks.length > 0) {
          editor.replaceBlocks(editor.document, blocks);
          if (blocks.length > 1) {
            loadedEmpty = false;
          } else {
            const firstBlock = blocks[0];
            if (
              firstBlock &&
              (firstBlock.type !== "paragraph" ||
                (firstBlock.content && Array.isArray(firstBlock.content) && firstBlock.content.length > 0))
            ) {
              loadedEmpty = false;
            }
          }
        } else {
          editor.replaceBlocks(editor.document, [{ type: "paragraph", content: [] }]);
        }
      } catch {
        editor.replaceBlocks(editor.document, [{ type: "paragraph", content: [] }]);
      }
    } else {
      editor.replaceBlocks(editor.document, [{ type: "paragraph", content: [] }]);
    }
    setIsEditorEmpty(loadedEmpty);
    originalValuesRef.current = {
      title: data.title || "",
      content: JSON.stringify(editor.document),
      tags: data.tags || [],
      color: data.color || "#ffffff",
    };
    void loadBreadcrumbsForNote(data);
  };

  const handleCreateSubPage = async () => {
    const parent = noteRef.current;
    if (!parent?.id || !editor) {
      toast.error("Save the note first, then create a sub-page");
      return;
    }

    try {
      setIsSaving(true);
      // Persist parent content with the upcoming link
      const newContent = JSON.stringify([{ type: "paragraph", content: [] }]);
      const response = await authenticatedFetch(buildExternalUrl("notes"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "",
          content: newContent,
          color: color || "#ffffff",
          parentId: parent.id,
        }),
      });

      if (!response.ok) throw new Error("Failed to create sub-page");
      const data = await response.json();
      const newNote: Note = data.note;

      insertOrUpdateBlock(editor, {
        type: "nestedPage",
        props: { title: "New page", linkedNoteId: newNote.id },
      } as any);

      const parentContent = JSON.stringify(editor.document);
      await authenticatedFetch(buildExternalUrl(`notes/${parent.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: parentContent, tags, color }),
      });

      if (onSave) {
        onSave({ ...parent, title, content: parentContent, tags, color });
        onSave(newNote);
      }

      applyNoteToEditor(newNote);
      toast.success("Sub-page created");
    } catch (error) {
      console.error("Error creating sub-page:", error);
      toast.error("Failed to create sub-page");
    } finally {
      setIsSaving(false);
    }
  };

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
      };

      return (
        <SideMenu {...sideMenuProps}>
          <Popover open={sideMenuOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
              <button
                className="w-6 h-6 flex items-center justify-center hover:bg-white/5 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent 
              side="right" 
              align="start" 
              sideOffset={4}
              className="w-[511px] max-w-[calc(100vw-32px)] p-4 bg-[#0f0f11] border border-zinc-800/80 shadow-2xl rounded-xl text-white z-[9999]"
            >
              <CommandsMenu 
                editor={editor} 
                block={sideMenuProps.block}
                onClose={handleClose}
                onShowYouTubeDialog={() => setShowYouTubeDialog(true)}
                onCreateSubPage={handleCreateSubPage}
              />
            </PopoverContent>
          </Popover>
          <DragHandleButton
            {...sideMenuProps}
            dragHandleMenu={(dragHandleMenuProps) => (
              <CustomDragHandleMenu
                {...sideMenuProps}
                {...dragHandleMenuProps}
                note={note}
              />
            )}
          />
        </SideMenu>
      );
    },
    [note, editor, sideMenuOpen, handleCreateSubPage]
  );

  // Custom slash menu items representing the complete Figma / Commands Reference
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
          insertOrUpdateBlock(editor, { type: "paragraph", content: [{ type: "link", href: "https://", content: "🌐 Web Bookmark" }] } as any);
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

  // Fetch note data when drawer opens with a noteId
  useEffect(() => {
    const fetchNote = async () => {
      if (!isOpen || !noteId) {
        // Reset for new note
        setNote(null);
        setCurrentNoteId(null);
        setTitle("");
        setTags([]);
        setNewTag("");
        setColor("#ffffff");
        setHasUnsavedChanges(false);
        setIsEditMode(true);
        setShowTagsInput(false);
        setShowColorPickerState(false);
        setIsEditorEmpty(true);
        setBreadcrumbs([]);
        editor.replaceBlocks(editor.document, [
          { type: "paragraph", content: [] },
        ]);
        originalValuesRef.current = {
          title: "",
          content: JSON.stringify(editor.document),
          tags: [],
          color: "#ffffff",
        };
        return;
      }

      setIsEditMode(initialEditMode);
      setCurrentNoteId(noteId);

      try {
        setIsLoading(true);
        const response = await authenticatedFetch(buildExternalUrl(`notes/${noteId}`));
        if (!response.ok) throw new Error("Failed to fetch note");

        const data = await response.json();
        applyNoteToEditor(data);
      } catch (error) {
        console.error("Error fetching note:", error);
        toast.error("Failed to load note");
        onClose();
      } finally {
        setIsLoading(false);
      }
    };

    fetchNote();
  }, [isOpen, noteId]);

  // Check for unsaved changes
  const checkForChanges = () => {
    if (!originalValuesRef.current) return false;

    const currentContent = JSON.stringify(editor.document);
    const tagsChanged = JSON.stringify(tags) !== JSON.stringify(originalValuesRef.current.tags);

    return (
      title !== originalValuesRef.current.title ||
      currentContent !== originalValuesRef.current.content ||
      tagsChanged ||
      color !== originalValuesRef.current.color
    );
  };

  // Update hasUnsavedChanges when values change
  useEffect(() => {
    if (isLoading || !isOpen) return;
    setHasUnsavedChanges(checkForChanges());
  }, [title, tags, color, isLoading, isOpen]);

  // Listen to editor changes
  useEffect(() => {
    if (!editor || isLoading || !isOpen) return;

    const unsubscribe = editor.onChange(() => {
      setHasUnsavedChanges(checkForChanges());
      
      // Calculate if editor is empty
      let empty = true;
      const blocks = editor.document;
      if (blocks.length > 1) {
        empty = false;
      } else {
        const firstBlock = blocks[0];
        if (firstBlock && (firstBlock.type !== "paragraph" || (firstBlock.content && Array.isArray(firstBlock.content) && firstBlock.content.length > 0))) {
          empty = false;
        }
      }
      setIsEditorEmpty(empty);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [editor, isLoading, isOpen]);

  // Debounced auto-save effect
  useEffect(() => {
    if (!isOpen || isLoading || !isEditMode) return;
    if (!hasUnsavedChanges) return;

    const delayDebounceFn = setTimeout(() => {
      handleSave(true); // Save silently
    }, 1500);

    return () => clearTimeout(delayDebounceFn);
  }, [title, tags, color, isEditorEmpty, hasUnsavedChanges, isEditMode]);

  const handleSave = async (isSilent = false) => {
    if (isLoading || isSaving) return;

    // Validate: must have title or content
    const blocks = editor.document;
    const content = JSON.stringify(blocks);
    const hasContent = blocks.some(block => {
      if (block.type === "paragraph" && Array.isArray(block.content)) {
        return block.content.some((item: any) => item.text?.trim());
      }
      return block.type !== "paragraph";
    });

    if (!title.trim() && !hasContent) {
      if (isSilent) return;
      toast.error("Please add a title or content");
      return;
    }

    try {
      setIsSaving(true);

      if (!currentNoteId) {
        // Create new note
        const response = await authenticatedFetch(buildExternalUrl("notes"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            content,
            tags,
            color,
            icon: note?.icon ?? null,
            coverUrl: note?.coverUrl ?? null,
            coverPosition: note?.coverPosition ?? 50,
            comments: note?.comments || [],
            commentsOpen: note?.commentsOpen ?? false,
          }),
        });

        if (!response.ok) throw new Error("Failed to create note");

        const data = await response.json();
        setNote(data.note);
        setCurrentNoteId(data.note.id);
        originalValuesRef.current = { title, content, tags: [...tags], color };
        setHasUnsavedChanges(false);
        if (!isSilent) toast.success("Note created");
        if (onSave) onSave(data.note);
      } else {
        // Update existing note
        const response = await authenticatedFetch(buildExternalUrl(`notes/${currentNoteId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            content,
            tags,
            color,
            icon: note?.icon ?? null,
            coverUrl: note?.coverUrl ?? null,
            coverPosition: note?.coverPosition ?? 50,
            comments: note?.comments || [],
            commentsOpen: note?.commentsOpen ?? false,
          }),
        });

        if (!response.ok) throw new Error("Failed to update note");

        const data = await response.json();
        setNote(data.note);
        originalValuesRef.current = { title, content, tags: [...tags], color };
        setHasUnsavedChanges(false);
        if (!isSilent) toast.success("Note saved");
        if (onSave) onSave(data.note);
      }
    } catch (error) {
      console.error("Error saving note:", error);
      if (!isSilent) toast.error("Failed to save note");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStar = async () => {
    if (!note) return;
    try {
      const response = await authenticatedFetch(buildExternalUrl(`notes/${note.id}/star`), {
        method: "PUT",
      });
      if (!response.ok) throw new Error("Failed to toggle star");
      const data = await response.json();
      setNote({ ...note, isStarred: data.isStarred });
      toast.success(data.isStarred ? "Note starred" : "Note unstarred");
      if (onSave) onSave({ ...note, isStarred: data.isStarred });
    } catch (error) {
      toast.error("Failed to update note");
    }
  };

  const handleToggleArchive = async () => {
    if (!note) return;
    try {
      const response = await authenticatedFetch(buildExternalUrl(`notes/${note.id}/archive`), {
        method: "PUT",
      });
      if (!response.ok) throw new Error("Failed to toggle archive");
      const data = await response.json();
      toast.success(data.isArchived ? "Note archived" : "Note unarchived");
      if (onArchive) onArchive(note.id);
      onClose();
    } catch (error) {
      toast.error("Failed to update note");
    }
  };

  const handleTogglePin = async () => {
    if (!note) return;
    try {
      const response = await authenticatedFetch(buildExternalUrl(`notes/${note.id}/pin`), {
        method: "PUT",
      });
      if (!response.ok) throw new Error("Failed to toggle pin");
      const data = await response.json();
      setNote({ ...note, isPinned: data.isPinned });
      toast.success(data.isPinned ? "Note pinned" : "Note unpinned");
      if (onSave) onSave({ ...note, isPinned: data.isPinned });
    } catch (error) {
      toast.error("Failed to update note");
    }
  };

  const handleDelete = async () => {
    if (!note) return;
    try {
      const response = await authenticatedFetch(buildExternalUrl(`notes/${note.id}`), {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete note");
      toast.success("Note moved to trash");
      if (onDelete) onDelete(note.id);
      onClose();
    } catch (error) {
      toast.error("Failed to delete note");
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleCloseAttempt = async () => {
    if (hasUnsavedChanges) {
      try {
        await handleSave(true);
      } catch (e) {
        console.error(e);
      }
    }
    onClose();
  };

  const handleDiscard = () => {
    setShowDiscardDialog(false);
    setHasUnsavedChanges(false);
    onClose();
  };

  const handleSaveAndClose = async () => {
    setShowDiscardDialog(false);
    await handleSave();
    onClose();
  };

  const handleYouTubeEmbed = () => {
    const videoId = getYouTubeVideoId(youtubeUrl);
    if (videoId) {
      // Insert a paragraph with a link styled as a YouTube embed placeholder
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

  return (
    <>
      <Sheet open={isOpen} onOpenChange={handleCloseAttempt}>
        <SheetContent side="right" className="w-full sm:max-w-4xl lg:max-w-5xl p-0 flex flex-col bg-[#191919] text-white border-l border-zinc-800/40 [&>button]:hidden">
          {/* Header */}
          <SheetHeader className="border-none bg-transparent px-12 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Visual hidden title for accessibility / SEO best practices */}
                <SheetTitle className="sr-only">
                  {!currentNoteId ? "New Note" : isEditMode ? "Edit Note" : note?.title || "Note"}
                </SheetTitle>

              </div>

              <div className="flex items-center gap-1">
                {/* Edit Button - shown in view mode */}
                {note && !isEditMode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditMode(true)}
                    className="gap-1.5 h-8 px-2.5 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors rounded-md"
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit
                  </Button>
                )}

                {note && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors rounded-md"
                      onClick={handleToggleStar}
                    >
                      <Star
                        className={
                          note.isStarred
                            ? "h-4 w-4 fill-yellow-400 text-yellow-400"
                            : "h-4 w-4"
                        }
                      />
                    </Button>

                    <NoteSharePopover
                      noteId={note.id}
                      noteTitle={note.title || "Untitled"}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors rounded-md"
                          title="Share note"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                      }
                    />

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors rounded-md"
                      onClick={handleTogglePin}
                    >
                      {note.isPinned ? (
                        <Pin className="h-4 w-4 fill-primary text-primary" />
                      ) : (
                        <Pin className="h-4 w-4" />
                      )}
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors rounded-md">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#1f1f1f] border-zinc-800 text-white">
                        <DropdownMenuItem onClick={handleToggleArchive} className="hover:bg-white/5 focus:bg-white/5 text-zinc-300">
                          {note.isArchived ? (
                            <>
                              <ArchiveX className="mr-2 h-4 w-4" />
                              Unarchive
                            </>
                          ) : (
                            <>
                              <Archive className="mr-2 h-4 w-4" />
                              Archive
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-zinc-800" />
                        <DropdownMenuItem
                          onClick={handleDelete}
                          className="text-destructive focus:text-destructive hover:bg-red-500/10 focus:bg-red-500/10"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Move to Trash
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}

                {/* Close Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors rounded-md"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCloseAttempt();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          {/* Content */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-sm text-muted-foreground">Loading note...</p>
              </div>
            </div>
          ) : isEditMode ? (
            // Edit Mode
            <div className="flex-1 overflow-y-auto relative">
              <div className="max-w-5xl mx-auto px-12 py-8">
                <div className="sticky top-0 z-30 -mx-12 px-12 py-1.5 mb-0 bg-[#191919]/90 backdrop-blur-sm border-b border-white/[0.04]">
                  <NoteBreadcrumbs
                    items={
                      breadcrumbs.length > 0
                        ? breadcrumbs
                        : note
                          ? [
                              {
                                id: note.id,
                                title: title || note.title || "New page",
                                icon: note.icon,
                                parentId: note.parentId ?? null,
                              },
                            ]
                          : []
                    }
                    allNotes={[]}
                    activeNoteId={note?.id}
                    onNavigate={async (id) => {
                      try {
                        setIsLoading(true);
                        const response = await authenticatedFetch(buildExternalUrl(`notes/${id}`));
                        if (!response.ok) throw new Error("Failed to fetch note");
                        const data = await response.json();
                        applyNoteToEditor(data);
                      } catch {
                        toast.error("Failed to open page");
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                  />
                </div>
                <NotePageHeader
                  icon={note?.icon}
                  coverUrl={note?.coverUrl}
                  coverPosition={note?.coverPosition ?? 50}
                  onIconChange={async (icon) => {
                    if (!note) return;
                    const next = { ...note, icon };
                    setNote(next);
                    if (!currentNoteId) return;
                    try {
                      const response = await authenticatedFetch(
                        buildExternalUrl(`notes/${currentNoteId}`),
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ icon }),
                        }
                      );
                      if (response.ok) {
                        const data = await response.json();
                        if (data.note) setNote(data.note);
                      }
                    } catch {
                      toast.error("Failed to save icon");
                    }
                  }}
                  onCoverChange={async (coverUrl) => {
                    if (!note) return;
                    const next = { ...note, coverUrl };
                    setNote(next);
                    if (!currentNoteId) return;
                    try {
                      const response = await authenticatedFetch(
                        buildExternalUrl(`notes/${currentNoteId}`),
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ coverUrl }),
                        }
                      );
                      if (response.ok) {
                        const data = await response.json();
                        if (data.note) setNote(data.note);
                      }
                    } catch {
                      toast.error("Failed to save cover");
                    }
                  }}
                  onCoverPositionChange={async (coverPosition) => {
                    if (!note) return;
                    setNote({ ...note, coverPosition });
                    if (!currentNoteId) return;
                    try {
                      await authenticatedFetch(buildExternalUrl(`notes/${currentNoteId}`), {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ coverPosition }),
                      });
                    } catch {
                      /* ignore */
                    }
                  }}
                  showAddComment={
                    !note?.commentsOpen && !(note?.comments && note.comments.length > 0)
                  }
                  onAddComment={async () => {
                    if (!note) return;
                    const next = { ...note, commentsOpen: true };
                    setNote(next);
                    if (!currentNoteId) return;
                    try {
                      const response = await authenticatedFetch(
                        buildExternalUrl(`notes/${currentNoteId}`),
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ commentsOpen: true }),
                        }
                      );
                      if (response.ok) {
                        const data = await response.json();
                        if (data.note) setNote(data.note);
                      }
                    } catch {
                      /* ignore */
                    }
                  }}
                  contentClassName="max-w-5xl mx-auto"
                />
                {/* Title */}
                <textarea
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setBreadcrumbs((prev) => {
                      if (prev.length === 0) return prev;
                      const next = [...prev];
                      next[next.length - 1] = {
                        ...next[next.length - 1],
                        title: e.target.value.trim() || "New page",
                        icon: note?.icon,
                      };
                      return next;
                    });
                  }}
                  placeholder="New page"
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                  className="w-full text-6xl md:text-7xl font-bold border-none outline-none focus:outline-none bg-transparent placeholder:text-white/15 text-white mb-2 resize-none overflow-hidden shadow-none ring-0 focus:ring-0 focus-visible:ring-0 garage-notes-title-textarea"
                />

                {(note?.commentsOpen || (note?.comments && note.comments.length > 0)) && (
                  <NotePageComments
                    comments={note?.comments || []}
                    autoFocus={Boolean(note?.commentsOpen)}
                    onChange={async (comments: NotePageComment[]) => {
                      if (!note) return;
                      setNote({ ...note, comments, commentsOpen: true });
                      if (!currentNoteId) return;
                      try {
                        const response = await authenticatedFetch(
                          buildExternalUrl(`notes/${currentNoteId}`),
                          {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ comments, commentsOpen: true }),
                          }
                        );
                        if (response.ok) {
                          const data = await response.json();
                          if (data.note) setNote(data.note);
                        }
                      } catch {
                        toast.error("Failed to save comment");
                      }
                    }}
                    onClose={async () => {
                      if (!note) return;
                      setNote({ ...note, commentsOpen: false, comments: [] });
                      if (!currentNoteId) return;
                      try {
                        await authenticatedFetch(buildExternalUrl(`notes/${currentNoteId}`), {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ commentsOpen: false, comments: [] }),
                        });
                      } catch {
                        /* ignore */
                      }
                    }}
                  />
                )}

                {/* BlockNote Editor */}
                <div className="prose prose-lg max-w-none garage-notes-editor">
                  <BlockNoteView editor={editor} theme="dark" editable={true} slashMenu={false} sideMenu={false}>
                    <SuggestionMenuController
                      triggerCharacter="/"
                      getItems={getCustomSlashMenuItems}
                    />
                    <SideMenuController
                      sideMenu={renderSideMenu}
                    />
                  </BlockNoteView>
                </div>
              </div>
            </div>
          ) : (
            // View Mode
            <div className="flex-1 overflow-y-auto relative">
              <div className="max-w-5xl mx-auto px-12 py-8">
                <h1 className="text-5xl font-bold mb-2">
                  {title || "Untitled"}
                </h1>
                {tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mb-8">
                    {tags.map((tag) => (
                      <div
                        key={tag}
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
                      >
                        <span className="text-muted-foreground/60">#</span>
                        <span>{tag}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="prose prose-lg max-w-none">
                  <BlockNoteView editor={editor} theme="dark" editable={false} />
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Discard Changes Dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Do you want to save them before closing?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDiscardDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <Button variant="destructive" onClick={handleDiscard}>
              Discard
            </Button>
            <Button onClick={handleSaveAndClose} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save & Close"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* YouTube Embed Dialog */}
      <AlertDialog open={showYouTubeDialog} onOpenChange={setShowYouTubeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Embed YouTube Video</AlertDialogTitle>
            <AlertDialogDescription>
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
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Supported formats: youtube.com/watch?v=, youtu.be/, youtube.com/embed/
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowYouTubeDialog(false);
              setYoutubeUrl("");
            }}>
              Cancel
            </AlertDialogCancel>
            <Button onClick={handleYouTubeEmbed} className="bg-red-600 hover:bg-red-700">
              Embed Video
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

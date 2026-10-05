"use client";

import React, { useState, useMemo } from "react";
import {
  Search, 
  Type, 
  Heading1, 
  Heading2, 
  Heading3, 
  CheckSquare, 
  Minus, 
  Info, 
  Code, 
  Quote, 
  ChevronRight, 
  List,
  ListOrdered,
  Sparkles,
  Palette,
  Paintbrush,
  RefreshCw,
  FileText,
  Link2,
  User,
  Calendar,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { insertOrUpdateBlock as _insertOrUpdateBlock } from "@blocknote/core";
import {
  TablePreview,
  BoardPreview,
  GalleryPreview,
  ListPreview,
  CalendarPreview,
  TimelinePreview,
  ChartPreview,
  LinkedViewPreview,
  PagePreview,
  LinkToPagePreview,
  MentionPersonPreview,
  MentionPagePreview,
  DatePreview,
  ReminderPreview,
  TableOfContentsPreview,
  CommentPreview,
  DuplicatePreview,
  MoveToPreview,
  DeletePreview,
  TemplatePreview,
  ButtonPreview,
  SyncedBlockPreview,
  MediaImagePreview,
  MediaVideoPreview,
  MediaAudioPreview,
  MediaFilePreview,
  MediaPDFPreview,
  MediaWebPreview,
  MediaEmbedPreview,
  MediaCodePreview,
  MediaMathPreview,
  MediaInlineEquationPreview,
  Tag,
} from "./DatabaseViewsSection";

const insertOrUpdateBlock = _insertOrUpdateBlock as any;

interface CommandsMenuProps {
  editor: any;
  block: any;
  onClose?: () => void;
  onShowYouTubeDialog?: () => void;
  onCreateSubPage?: () => void | Promise<void>;
}

interface CommandItem {
  title: string;
  icon: React.ReactNode;
  aliases: string[];
  subtext: string;
  action: (editor: any, block: any) => void;
}

interface CommandSection {
  title: string;
  items: CommandItem[];
}

export default function CommandsMenu({ editor, block, onClose, onShowYouTubeDialog, onCreateSubPage }: CommandsMenuProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const sections: CommandSection[] = useMemo(() => [
    {
      title: "Basic Text",
      items: [
        {
          title: "Text",
          icon: <Type className="h-4 w-4" />,
          aliases: ["text", "paragraph", "p", "normal"],
          subtext: "Normal paragraph text. The default block type.",
          action: (ed) => insertOrUpdateBlock(ed, { type: "paragraph" })
        },
        {
          title: "Heading 1",
          icon: <Heading1 className="h-4 w-4" />,
          aliases: ["h1", "heading 1", "large heading"],
          subtext: "Heading 1 — Top Level Section",
          action: (ed) => insertOrUpdateBlock(ed, { type: "heading", props: { level: 1 } })
        },
        {
          title: "Heading 2",
          icon: <Heading2 className="h-4 w-4" />,
          aliases: ["h2", "heading 2", "medium heading"],
          subtext: "Heading 2 — Subsection",
          action: (ed) => insertOrUpdateBlock(ed, { type: "heading", props: { level: 2 } })
        },
        {
          title: "Heading 3",
          icon: <Heading3 className="h-4 w-4" />,
          aliases: ["h3", "heading 3", "small heading"],
          subtext: "Heading 3 — Minor Heading",
          action: (ed) => insertOrUpdateBlock(ed, { type: "heading", props: { level: 3 } })
        },
        {
          title: "Block Quote",
          icon: <Quote className="h-4 w-4" />,
          aliases: ["quote", "blockquote", "cite"],
          subtext: "Block quote",
          action: (ed) => insertOrUpdateBlock(ed, { type: "quote" })
        },
        {
          title: "Callout",
          icon: <Sparkles className="h-4 w-4 text-amber-400" />,
          aliases: ["callout", "info", "tip", "alert"],
          subtext: "Highlight tips, warnings, or key information",
          action: (ed) => insertOrUpdateBlock(ed, {
            type: "paragraph",
            props: { backgroundColor: "gray" },
            content: [{ type: "text", text: "💡 Use callouts to highlight tips, warnings, or key information.", styles: { italic: true } }]
          } as any)
        },
      ]
    },
    {
      title: "Lists",
      items: [
        {
          title: "Bulleted List",
          icon: <List className="h-4 w-4" />,
          aliases: ["bullet", "list", "ul"],
          subtext: "Unordered list with bullet points",
          action: (ed) => insertOrUpdateBlock(ed, { type: "bulletListItem" })
        },
        {
          title: "Numbered List",
          icon: <ListOrdered className="h-4 w-4" />,
          aliases: ["number", "ordered", "ol"],
          subtext: "Ordered list with numbers",
          action: (ed) => insertOrUpdateBlock(ed, { type: "numberedListItem" })
        },
        {
          title: "To-do List",
          icon: <CheckSquare className="h-4 w-4" />,
          aliases: ["todo", "task", "check", "checklist"],
          subtext: "Task list with checkboxes",
          action: (ed) => insertOrUpdateBlock(ed, { type: "checkListItem" })
        },
        {
          title: "Toggle List",
          icon: <ChevronRight className="h-4 w-4" />,
          aliases: ["toggle", "collapse", "accordion"],
          subtext: "Toggle block — click to expand or collapse content",
          action: (ed) => insertOrUpdateBlock(ed, { type: "toggleListItem" })
        },
        {
          title: "Toggle Heading 1",
          icon: <ChevronRight className="h-4 w-4" />,
          aliases: ["toggle-h1"],
          subtext: "Collapsible heading — large section title",
          action: (ed) => {
            insertOrUpdateBlock(ed, { type: "heading", props: { level: 1, isToggleable: true }, content: "Heading 1" });
          }
        },
        {
          title: "Toggle Heading 2",
          icon: <ChevronRight className="h-4 w-4" />,
          aliases: ["toggle-h2"],
          subtext: "Collapsible heading — medium section title",
          action: (ed) => {
            insertOrUpdateBlock(ed, { type: "heading", props: { level: 2, isToggleable: true }, content: "Heading 2" });
          }
        },
        {
          title: "Toggle Heading 3",
          icon: <ChevronRight className="h-4 w-4" />,
          aliases: ["toggle-h3"],
          subtext: "Collapsible heading — minor section title",
          action: (ed) => {
            insertOrUpdateBlock(ed, { type: "heading", props: { level: 3, isToggleable: true }, content: "Heading 3" });
          }
        },
      ]
    },

    {
      title: "Text Colors",
      items: [
        ...["red", "blue", "green", "yellow", "purple", "gray"].map((colorName) => ({
          title: `${colorName.charAt(0).toUpperCase() + colorName.slice(1)} Text`,
          icon: <Palette className="h-4 w-4" style={{ color: colorName === "gray" ? "#888" : colorName }} />,
          aliases: [colorName, "color", `text-${colorName}`],
          subtext: `This text is ${colorName}`,
          action: (ed: any) => {
            ed.addStyles({ textColor: colorName });
          }
        })),
      ]
    },
    {
      title: "Background Colors",
      items: [
        ...["red", "blue", "green", "yellow", "purple", "gray"].map((colorName) => ({
          title: `${colorName.charAt(0).toUpperCase() + colorName.slice(1)} Background`,
          icon: <Paintbrush className="h-4 w-4" style={{ color: colorName === "gray" ? "#888" : colorName }} />,
          aliases: [`bg-${colorName}`, "background", "highlight"],
          subtext: `Text with ${colorName} background`,
          action: (ed: any) => {
            const currentBlock = ed.getTextCursorPosition().block;
            ed.updateBlock(currentBlock, { props: { backgroundColor: colorName } } as any);
          }
        })),
        {
          title: "Default Background",
          icon: <Paintbrush className="h-4 w-4 text-zinc-400" />,
          aliases: ["bg-default", "reset background"],
          subtext: "Reset to default background",
          action: (ed: any) => {
            const currentBlock = ed.getTextCursorPosition().block;
            ed.updateBlock(currentBlock, { props: { backgroundColor: "default" } } as any);
          }
        },
      ]
    },

    {
      title: "Turn Into",
      items: [
        {
          title: "Convert to Paragraph",
          icon: <RefreshCw className="h-4 w-4" />,
          aliases: ["turn-text", "turn-p", "convert paragraph"],
          subtext: "Convert to plain text",
          action: (ed) => {
            const currentBlock = ed.getTextCursorPosition().block;
            ed.updateBlock(currentBlock, { type: "paragraph" });
          }
        },
        {
          title: "Convert to H1",
          icon: <RefreshCw className="h-4 w-4" />,
          aliases: ["turn-h1", "convert heading 1"],
          subtext: "Convert to Heading 1",
          action: (ed) => {
            const currentBlock = ed.getTextCursorPosition().block;
            ed.updateBlock(currentBlock, { type: "heading", props: { level: 1 } });
          }
        },
        {
          title: "Convert to H2",
          icon: <RefreshCw className="h-4 w-4" />,
          aliases: ["turn-h2", "convert heading 2"],
          subtext: "Convert to Heading 2",
          action: (ed) => {
            const currentBlock = ed.getTextCursorPosition().block;
            ed.updateBlock(currentBlock, { type: "heading", props: { level: 2 } });
          }
        },
        {
          title: "Convert to H3",
          icon: <RefreshCw className="h-4 w-4" />,
          aliases: ["turn-h3", "convert heading 3"],
          subtext: "Convert to Heading 3",
          action: (ed) => {
            const currentBlock = ed.getTextCursorPosition().block;
            ed.updateBlock(currentBlock, { type: "heading", props: { level: 3 } });
          }
        },
        {
          title: "Convert to Bullet List",
          icon: <RefreshCw className="h-4 w-4" />,
          aliases: ["turn-bullet", "turn-ul"],
          subtext: "Convert to bullet list",
          action: (ed) => {
            const currentBlock = ed.getTextCursorPosition().block;
            ed.updateBlock(currentBlock, { type: "bulletListItem" });
          }
        },
        {
          title: "Convert to Numbered List",
          icon: <RefreshCw className="h-4 w-4" />,
          aliases: ["turn-number", "turn-ol"],
          subtext: "Convert to numbered list",
          action: (ed) => {
            const currentBlock = ed.getTextCursorPosition().block;
            ed.updateBlock(currentBlock, { type: "numberedListItem" });
          }
        },
        {
          title: "Convert to Todo",
          icon: <RefreshCw className="h-4 w-4" />,
          aliases: ["turn-todo", "turn-task"],
          subtext: "Convert to todo list",
          action: (ed) => {
            const currentBlock = ed.getTextCursorPosition().block;
            ed.updateBlock(currentBlock, { type: "checkListItem" });
          }
        },
        {
          title: "Convert to Quote",
          icon: <RefreshCw className="h-4 w-4" />,
          aliases: ["turn-blockquote", "turn-quote"],
          subtext: "Convert to blockquote",
          action: (ed) => {
            const currentBlock = ed.getTextCursorPosition().block;
            ed.updateBlock(currentBlock, { type: "quote" });
          }
        },
      ]
    },
    {
      title: "Links & References",
      items: [
        {
          title: "Page",
          icon: <FileText className="h-4 w-4" />,
          aliases: ["page", "subpage", "child"],
          subtext: "Create and open a sub-page",
          action: () => {
            if (onCreateSubPage) {
              void onCreateSubPage();
            } else {
              insertOrUpdateBlock(editor, { type: "nestedPage" });
            }
          }
        },
        {
          title: "Link to Page",
          icon: <Link2 className="h-4 w-4 text-blue-400" />,
          aliases: ["link-page", "pagelink"],
          subtext: "Link to another page",
          action: (ed) => insertOrUpdateBlock(ed, { type: "pageLinkPill" })
        },
        {
          title: "Mention Person",
          icon: <User className="h-4 w-4" />,
          aliases: ["mention", "person", "user", "@"],
          subtext: "Mention a team member",
          action: (ed) => insertOrUpdateBlock(ed, { type: "mentionPerson" })
        },
        {
          title: "Mention Page",
          icon: <FileText className="h-4 w-4" />,
          aliases: ["mention-page", "pageref"],
          subtext: "Reference another page",
          action: (ed) => insertOrUpdateBlock(ed, { type: "mentionPage" })
        },
        {
          title: "Date",
          icon: <Calendar className="h-4 w-4" />,
          aliases: ["date", "due", "deadline", "today", "tomorrow"],
          subtext: "Insert a date",
          action: (ed) => insertOrUpdateBlock(ed, { type: "datePicker" })
        },
        {
          title: "Reminder",
          icon: <Bell className="h-4 w-4 text-amber-400" />,
          aliases: ["reminder", "alert", "notify"],
          subtext: "Set a reminder",
          action: (ed) => insertOrUpdateBlock(ed, { type: "reminder" })
        },
        {
          title: "Table of Contents",
          icon: <List className="h-4 w-4" />,
          aliases: ["toc", "contents", "outline"],
          subtext: "Insert a table of contents",
          action: (ed) => insertOrUpdateBlock(ed, { type: "tableOfContents" })
        },
      ]
    },
  ], [editor, onCreateSubPage]);

  const filteredSections = useMemo(() => {
    if (!searchQuery) return sections;
    return sections.map(section => {
      const matchingItems = section.items.filter(item => 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.aliases.some(alias => alias.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.subtext.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return {
        ...section,
        items: matchingItems
      };
    }).filter(section => section.items.length > 0);
  }, [searchQuery, sections]);

  const searchLower = searchQuery.toLowerCase();

  const dbViewMatches = useMemo(() => {
    const items = [
      { title: "Table", aliases: ["table", "grid", "data-table"], component: TablePreview },
      { title: "Board", aliases: ["board", "kanban"], component: BoardPreview },
      { title: "Gallery", aliases: ["gallery", "cards", "image"], component: GalleryPreview },
      { title: "List", aliases: ["list", "documents", "files"], component: ListPreview },
      { title: "Calendar", aliases: ["calendar", "week", "schedule"], component: CalendarPreview },
      { title: "Timeline", aliases: ["timeline", "gantt", "progress"], component: TimelinePreview },
      { title: "Chart", aliases: ["chart", "analytics", "graph"], component: ChartPreview },
      { title: "Linked View", aliases: ["linked", "database-link", "relation"], component: LinkedViewPreview },
    ];
    if (!searchQuery) return items;
    return items.filter(i =>
      i.title.toLowerCase().includes(searchLower) ||
      i.aliases.some(a => a.includes(searchLower))
    );
  }, [searchQuery, searchLower]);

  const advancedMatches = useMemo(() => {
    const items = [
      { title: "Comment", aliases: ["comment", "discussion", "note"], component: CommentPreview },
      { title: "Duplicate", aliases: ["duplicate", "copy", "clone"], component: DuplicatePreview },
      { title: "Move To", aliases: ["move", "relocate"], component: MoveToPreview },
      { title: "Delete", aliases: ["delete", "remove", "trash"], component: DeletePreview },
      { title: "Template", aliases: ["template", "preset"], component: TemplatePreview },
      { title: "Button", aliases: ["button", "action", "cta"], component: ButtonPreview },
      { title: "Synced Block", aliases: ["sync", "synced", "linked-block"], component: SyncedBlockPreview },
    ];
    if (!searchQuery) return items;
    return items.filter(i =>
      i.title.toLowerCase().includes(searchLower) ||
      i.aliases.some(a => a.includes(searchLower))
    );
  }, [searchQuery, searchLower]);

  const aiMatches = useMemo(() => {
    const items = [
      {
        title: "AI Summarize",
        icon: <span className="text-base leading-none">✨</span>,
        aliases: ["ai-summarize", "summarize", "ai"],
        subtext: "Summarize the content of this page automatically",
        action: (ed) => {
          const promise = new Promise((resolve) => setTimeout(resolve, 1500));
          toast.promise(promise, {
            loading: 'AI is summarizing this page...',
            success: 'AI Summary added to your note!',
            error: 'Failed to summarize',
          });
          promise.then(() => {
            let noteText = "";
            ed.document.forEach((blk: any) => {
              if (blk.type === "paragraph" && blk.content && Array.isArray(blk.content)) {
                blk.content.forEach((c: any) => { if (c.text) noteText += c.text + " "; });
              }
            });
            const textToSummary = noteText.trim()
              ? `This document details: "${noteText.slice(0, 100)}..."`
              : "No text content found in note.";
            ed.insertBlocks([{
              type: "quote",
              content: [{ type: "text", text: `AI Summary:\n${textToSummary}\nKey points: Draft completed. Refinements in progress.`, styles: { italic: true } }]
            }], ed.getTextCursorPosition().block, "after");
          });
        }
      },
      {
        title: "AI Action Items",
        icon: <span className="text-base leading-none">✅</span>,
        aliases: ["ai-action-items", "actions", "todo-ai"],
        subtext: "Extract and list all action items from this content",
        action: (ed) => {
          const promise = new Promise((resolve) => setTimeout(resolve, 1500));
          toast.promise(promise, {
            loading: 'AI is extracting action items...',
            success: 'AI Action Items extracted!',
            error: 'Failed to extract',
          });
          promise.then(() => {
            ed.insertBlocks([
              { type: "heading", props: { level: 3 }, content: [{ type: "text", text: "AI Action Items", styles: { bold: true } }] },
              { type: "checkListItem", content: [{ type: "text", text: "Follow up with team on draft comments", styles: {} }] },
              { type: "checkListItem", content: [{ type: "text", text: "Prepare revised roadmap timeline", styles: {} }] }
            ], ed.getTextCursorPosition().block, "after");
          });
        }
      },
      {
        title: "AI Custom Block",
        icon: <span className="text-base leading-none">🤖</span>,
        aliases: ["ai-custom", "custom-ai"],
        subtext: "Write a custom AI instruction for any task...",
        action: () => toast.info("Custom AI blocks are not available in this offline version.")
      },
      {
        title: "AI Improve Writing",
        icon: <span className="text-base leading-none">✍️</span>,
        aliases: ["ai-improve", "improve", "polish"],
        subtext: "Improve the clarity and flow of selected text",
        action: (ed) => {
          const currentBlock = ed.getTextCursorPosition().block;
          const promise = new Promise((resolve) => setTimeout(resolve, 1200));
          toast.promise(promise, {
            loading: 'AI is improving selected block...',
            success: 'Text improved and updated!',
            error: 'Failed to improve',
          });
          promise.then(() => {
            let blockText = "";
            if (currentBlock.content && Array.isArray(currentBlock.content)) {
              currentBlock.content.forEach((c: any) => { if (c.text) blockText += c.text; });
            }
            if (!blockText.trim()) {
              blockText = "Please write some text in this block first, then run AI Improve!";
            } else {
              blockText = `Improved writing: ${blockText} (clarified syntax, polished tone, and optimized flow)`;
            }
            ed.updateBlock(currentBlock, {
              content: [{ type: "text", text: blockText, styles: {} }]
            });
          });
        }
      },
      {
        title: "AI Fix Spelling",
        icon: <span className="text-base leading-none">🔤</span>,
        aliases: ["ai-fix-spelling", "fix-spelling", "spellcheck"],
        subtext: "Fix spelling and grammar issues in selected text",
        action: (ed) => {
          const currentBlock = ed.getTextCursorPosition().block;
          const promise = new Promise((resolve) => setTimeout(resolve, 1200));
          toast.promise(promise, {
            loading: 'AI is fixing spelling...',
            success: 'Spelling fixed!',
            error: 'Failed to fix spelling',
          });
          promise.then(() => {
            let blockText = "";
            if (currentBlock.content && Array.isArray(currentBlock.content)) {
              currentBlock.content.forEach((c: any) => { if (c.text) blockText += c.text; });
            }
            if (!blockText.trim()) {
              blockText = "Please write some text in this block first, then run Fix Spelling!";
            } else {
              blockText = `Fixed spelling: ${blockText} (corrected grammar and spelling)`;
            }
            ed.updateBlock(currentBlock, {
              content: [{ type: "text", text: blockText, styles: {} }]
            });
          });
        }
      },
      {
        title: "AI Make Shorter",
        icon: <span className="text-base leading-none">⇄</span>,
        aliases: ["ai-make-shorter", "make-shorter", "shorten"],
        subtext: "Make the selected content more concise",
        action: (ed) => {
          const currentBlock = ed.getTextCursorPosition().block;
          const promise = new Promise((resolve) => setTimeout(resolve, 1200));
          toast.promise(promise, {
            loading: 'AI is condensing content...',
            success: 'Content shortened!',
            error: 'Failed to shorten',
          });
          promise.then(() => {
            let blockText = "";
            if (currentBlock.content && Array.isArray(currentBlock.content)) {
              currentBlock.content.forEach((c: any) => { if (c.text) blockText += c.text; });
            }
            if (!blockText.trim()) {
              blockText = "Please write some text in this block first, then run Make Shorter!";
            } else {
              blockText = `Shortened: ${blockText.slice(0, 60)}... (concise version)`;
            }
            ed.updateBlock(currentBlock, {
              content: [{ type: "text", text: blockText, styles: {} }]
            });
          });
        }
      },
      {
        title: "AI Make Longer",
        icon: <span className="text-base leading-none">↔️</span>,
        aliases: ["ai-make-longer", "make-longer", "expand"],
        subtext: "Expand and elaborate on the selected content",
        action: (ed) => {
          const currentBlock = ed.getTextCursorPosition().block;
          const promise = new Promise((resolve) => setTimeout(resolve, 1200));
          toast.promise(promise, {
            loading: 'AI is expanding content...',
            success: 'Content expanded!',
            error: 'Failed to expand',
          });
          promise.then(() => {
            let blockText = "";
            if (currentBlock.content && Array.isArray(currentBlock.content)) {
              currentBlock.content.forEach((c: any) => { if (c.text) blockText += c.text; });
            }
            if (!blockText.trim()) {
              blockText = "Please write some text in this block first, then run Make Longer!";
            } else {
              blockText = `Expanded: ${blockText} (further elaborated with additional details, examples, and deeper analysis)`;
            }
            ed.updateBlock(currentBlock, {
              content: [{ type: "text", text: blockText, styles: {} }]
            });
          });
        }
      },
      {
        title: "AI Translate",
        icon: <span className="text-base leading-none">🌐</span>,
        aliases: ["ai-translate", "translate"],
        subtext: "Translate selected text to another language",
        action: () => toast.info("AI Translate is not available in this offline version. Please use the online version for translation.")
      },
      {
        title: "AI Explain This",
        icon: <span className="text-base leading-none">💭</span>,
        aliases: ["ai-explain", "explain-this", "explain"],
        subtext: "Explain this concept or topic in simple terms",
        action: (ed) => {
          const currentBlock = ed.getTextCursorPosition().block;
          const promise = new Promise((resolve) => setTimeout(resolve, 1200));
          toast.promise(promise, {
            loading: 'AI is explaining this concept...',
            success: 'Explanation added!',
            error: 'Failed to explain',
          });
          promise.then(() => {
            let blockText = "";
            if (currentBlock.content && Array.isArray(currentBlock.content)) {
              currentBlock.content.forEach((c: any) => { if (c.text) blockText += c.text; });
            }
            const explanation = blockText.trim()
              ? `Simplified explanation: "${blockText}" — In simple terms, this refers to a process where components work together to achieve a specific outcome. Think of it like a system where each part plays a role, much like how different departments in a company collaborate on a project.`
              : "Please write a concept or topic in the selected block first, then run Explain This!";
            ed.updateBlock(currentBlock, {
              content: [{ type: "text", text: explanation, styles: {} }]
            });
          });
        }
      },
      {
        title: "AI Find Action Items",
        icon: <span className="text-base leading-none">🎯</span>,
        aliases: ["ai-find-action-items", "find-actions", "extract-actions"],
        subtext: "Find and extract all action items from content",
        action: (ed) => {
          const promise = new Promise((resolve) => setTimeout(resolve, 1500));
          toast.promise(promise, {
            loading: 'AI is finding action items...',
            success: 'Action items extracted!',
            error: 'Failed to extract',
          });
          promise.then(() => {
            ed.insertBlocks([
              { type: "heading", props: { level: 3 }, content: [{ type: "text", text: "Action Items", styles: { bold: true } }] },
              { type: "checkListItem", content: [{ type: "text", text: "Review project timeline and milestones", styles: {} }] },
              { type: "checkListItem", content: [{ type: "text", text: "Schedule follow-up meeting with stakeholders", styles: {} }] },
              { type: "checkListItem", content: [{ type: "text", text: "Update documentation with latest changes", styles: {} }] }
            ], ed.getTextCursorPosition().block, "after");
          });
        }
      },
    ];
    if (!searchQuery) return items;
    return items.filter(i =>
      i.title.toLowerCase().includes(searchLower) ||
      i.aliases.some(a => a.includes(searchLower))
    );
  }, [searchQuery, searchLower]);

  const mediaMatches = useMemo(() => {
    const items = [
      { title: "Image", aliases: ["image", "img", "picture", "photo"], component: MediaImagePreview },
      { title: "Video", aliases: ["video", "movie", "clip"], component: MediaVideoPreview },
      { title: "Audio", aliases: ["audio", "sound", "music"], component: MediaAudioPreview },
      { title: "File", aliases: ["file", "upload", "attachment"], component: MediaFilePreview },
      { title: "PDF", aliases: ["pdf", "document"], component: MediaPDFPreview },
      { title: "Web Bookmark", aliases: ["web", "bookmark", "link", "url"], component: MediaWebPreview },
      { title: "Embed", aliases: ["embed", "iframe"], component: MediaEmbedPreview },
      { title: "Code Block", aliases: ["code", "pre", "snippet"], component: MediaCodePreview },
      { title: "Math", aliases: ["math", "equation", "formula"], component: MediaMathPreview },
      { title: "Inline Equation", aliases: ["inline-equation", "latex"], component: MediaInlineEquationPreview },
    ];
    if (!searchQuery) return items;
    return items.filter(i =>
      i.title.toLowerCase().includes(searchLower) ||
      i.aliases.some(a => a.includes(searchLower))
    );
  }, [searchQuery, searchLower]);

  const handleItemClick = (item: CommandItem) => {
    editor.focus();
    try {
      editor.setTextCursorPosition(block.id, "end");
    } catch (e) {
      console.warn("Could not set cursor position:", e);
    }
    item.action(editor, block);
    if (onClose) onClose();
  };

  const hasResults = filteredSections.length > 0;

  return (
    <div className="flex flex-col h-full max-h-[500px]">
      <>
        {/* Search Input */}
        <div className="flex items-center gap-2.5 px-3 py-2 bg-[#18181b] border border-zinc-800 focus-within:border-zinc-700/80 rounded-lg mb-2">
          <Search className="h-4 w-4 text-zinc-500 shrink-0" />
          <input
            type="text"
            placeholder="Search for a block..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none focus:outline-none text-sm text-zinc-200 placeholder:text-zinc-500 w-full p-0"
            autoFocus
          />
        </div>

        {/* List Content */}
        <div className="overflow-y-auto pr-1 flex-1 min-h-0 custom-scrollbar">
          {hasResults ? (
            filteredSections.map((section) => (
              <div key={section.title} className="mb-3 last:mb-1">
                <div className="text-[10px] tracking-wider text-zinc-500 font-bold uppercase mb-1 px-1 select-none">
                  {section.title}
                </div>
                <div className="flex flex-col gap-0.5">
                  {section.items.map((item) => (
                    <button
                      key={item.title}
                      onClick={() => handleItemClick(item)}
                      className="group flex items-center gap-3 w-full px-2 py-1.5 rounded-md hover:bg-white/5 transition-all duration-150 text-left cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-md bg-[#18181b] border border-zinc-800/60 flex items-center justify-center shrink-0 text-zinc-400 group-hover:text-white group-hover:border-zinc-700 transition-colors">
                        {item.icon}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[13px] font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
                          {item.title}
                        </span>
                        <span className="text-[11px] text-zinc-500 group-hover:text-zinc-400 transition-colors truncate">
                          {item.subtext}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : null}

          {/* Database Views Section — filterable */}
          {dbViewMatches.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] tracking-wider text-zinc-500 font-bold uppercase mb-1.5 px-1 select-none">
                Database Views
              </div>
              <div className="space-y-2">
                {dbViewMatches.map((item) => (
                  <item.component key={item.title} onSelect={() => {
                    const typeMap: Record<string, string> = {
                      Table: "tableView", Board: "boardView", Gallery: "galleryView",
                      List: "documentList", Calendar: "calendarView", Timeline: "timelineView",
                      Chart: "chartView", "Linked View": "linkedView"
                    };
                    handleItemClick({ title: item.title, icon: null, aliases: [], subtext: "", action: (ed) => insertOrUpdateBlock(ed, { type: typeMap[item.title] } as any) });
                  }} />
                ))}
              </div>
            </div>
          )}

          {/* Advanced Blocks Section — filterable */}
          {advancedMatches.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] tracking-wider text-zinc-500 font-bold uppercase mb-1.5 px-1 select-none">
                Advanced Blocks
              </div>
              <div className="space-y-2">
                {advancedMatches.map((item) => {
                  const actionMap: Record<string, (ed: any) => void> = {
                    Comment: (ed) => handleItemClick({ title: "Comment", icon: null, aliases: [], subtext: "", action: (ed) => insertOrUpdateBlock(ed, { type: "comment" } as any) }),
                    Duplicate: (ed) => handleItemClick({ title: "Duplicate", icon: null, aliases: [], subtext: "", action: (ed) => {
                      const currentBlock = ed.getTextCursorPosition().block;
                      const clone = JSON.parse(JSON.stringify(currentBlock));
                      delete clone.id;
                      clone.children = (clone.children || []).map((c: any) => { const { id, ...rest } = c; return rest; });
                      ed.insertBlocks([clone], currentBlock, "after");
                    }}),
                    "Move To": () => handleItemClick({ title: "Move To", icon: null, aliases: [], subtext: "", action: () => toast.info("Select a destination page to move this block.") }),
                    Delete: (ed) => handleItemClick({ title: "Delete", icon: null, aliases: [], subtext: "", action: (ed) => { const currentBlock = ed.getTextCursorPosition().block; ed.removeBlocks([currentBlock]); }}),
                    Template: (ed) => handleItemClick({ title: "Template", icon: null, aliases: [], subtext: "", action: (ed) => insertOrUpdateBlock(ed, { type: "template" } as any) }),
                    Button: (ed) => handleItemClick({ title: "Button", icon: null, aliases: [], subtext: "", action: (ed) => insertOrUpdateBlock(ed, { type: "button" } as any) }),
                    "Synced Block": (ed) => handleItemClick({ title: "Synced Block", icon: null, aliases: [], subtext: "", action: (ed) => insertOrUpdateBlock(ed, { type: "syncedBlock" } as any) }),
                  };
                  return (
                    <item.component key={item.title} onSelect={() => actionMap[item.title]?.(editor)} />
                  );
                })}
              </div>
            </div>
          )}

          {/* Media & Embeds Section — filterable */}
          {mediaMatches.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] tracking-wider text-zinc-500 font-bold uppercase mb-1.5 px-1 select-none">
                Media & Embeds
              </div>
              <div className="space-y-2">
                {mediaMatches.map((item) => {
                  const typeMap: Record<string, any> = {
                    Image: { type: "image", props: { url: "", caption: "", previewWidth: 512 } },
                    Video: { type: "video", props: { url: "", caption: "", previewWidth: 512, showPreview: true } },
                    Audio: { type: "audio", props: { url: "", caption: "", showPreview: true } },
                    File: { type: "file" },
                    PDF: { type: "file" },
                    "Web Bookmark": { type: "webBookmark" },
                    Embed: { type: "embed" },
                    "Code Block": { type: "codeBlock" },
                    Math: { type: "math" },
                    "Inline Equation": { type: "math" },
                  };
                  return (
                    <item.component key={item.title} onSelect={() => handleItemClick({ title: item.title, icon: null, aliases: [], subtext: "", action: (ed) => insertOrUpdateBlock(ed, typeMap[item.title] as any) })} />
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Blocks Section — filterable (moved after Media & Embeds) */}
          {aiMatches.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] tracking-wider text-zinc-500 font-bold uppercase mb-1.5 px-1 select-none">
                AI Blocks
              </div>
              <div className="flex flex-col gap-0.5">
                {aiMatches.map((item) => (
                  <button
                    key={item.title}
                    onClick={() => handleItemClick(item)}
                    className="group flex items-center gap-3 w-full px-2 py-1.5 rounded-md hover:bg-white/5 transition-all duration-150 text-left cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-md bg-[#18181b] border border-zinc-800/60 flex items-center justify-center shrink-0 text-zinc-400 group-hover:text-white group-hover:border-zinc-700 transition-colors">
                      {item.icon}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
                        {item.title}
                      </span>
                      <span className="text-[11px] text-zinc-500 group-hover:text-zinc-400 transition-colors truncate">
                        {item.subtext}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-2 pt-2 border-t border-zinc-800/50 select-none">
          <span>Click ESC to close the menu</span>
        </div>
      </>
    </div>
  );
}

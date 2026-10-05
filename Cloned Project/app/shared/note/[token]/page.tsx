"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Globe } from "lucide-react";
import { toast } from "sonner";
import { buildExternalUrl } from "@/lib/api-config";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { defaultBlockSpecs, BlockNoteSchema } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

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
} from "../../../(dashboard)/thoughts/components/blocks";

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  icon: string | null;
  coverUrl: string | null;
  coverPosition: number;
}

export default function SharedNotePage() {
  const params = useParams();
  const token = params?.token as string;

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize BlockNote schema with custom block specs
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

  const [isEditable, setIsEditable] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error" | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchSharedNote = async () => {
      try {
        const response = await fetch(buildExternalUrl(`notes/shared/${token}`));
        if (response.ok) {
          const data = await response.json();
          setNote(data);
          // Set edit access if backend indicates it is allowed, or allow override via query parameter
          const urlParams = new URLSearchParams(window.location.search);
          const editOverride = urlParams.get("edit") === "true";
          setIsEditable(data.allowEditing || editOverride);
        } else {
          toast.error("Failed to load shared note");
        }
      } catch (err) {
        console.error("Error fetching shared note:", err);
        toast.error("An error occurred while loading the shared note");
      } finally {
        setLoading(false);
      }
    };

    void fetchSharedNote();
  }, [token]);

  const editor = useCreateBlockNote({
    schema: notesSchema as unknown as Parameters<typeof useCreateBlockNote>[0]["schema"],
    initialContent: note?.content ? JSON.parse(note.content) : undefined,
  });

  // Re-initialize content when note loaded
  useEffect(() => {
    if (note?.content && editor) {
      try {
        const blocks = JSON.parse(note.content);
        // Only replace if the document content is actually different to avoid cursor resets
        if (JSON.stringify(editor.document) !== note.content) {
          editor.replaceBlocks(editor.document, blocks);
        }
      } catch (err) {
        console.error("Failed to parse editor content:", err);
      }
    }
  }, [note, editor]);

  // Debounced auto-save for editable shared notes
  useEffect(() => {
    if (!isEditable || !editor || !token) return;

    let timeoutId: NodeJS.Timeout;

    const handleContentChange = () => {
      setSaveStatus("saving");
      clearTimeout(timeoutId);

      timeoutId = setTimeout(async () => {
        try {
          const content = JSON.stringify(editor.document);
          const response = await fetch(buildExternalUrl(`notes/shared/${token}`), {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ content }),
          });

          if (response.ok) {
            setSaveStatus("saved");
          } else {
            setSaveStatus("error");
          }
        } catch (err) {
          console.error("Error autosaving shared note:", err);
          setSaveStatus("error");
        }
      }, 1000); // 1-second debounce
    };

    // Listen to editor changes
    const unsubscribe = editor.onChange(handleContentChange);
    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [isEditable, editor, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center gap-3 text-zinc-400">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="text-sm">Loading shared page…</span>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center gap-2 text-zinc-400">
        <span className="text-lg font-medium text-zinc-300">Shared page not found</span>
        <span className="text-xs text-zinc-600">The link might have expired or is incorrect.</span>
      </div>
    );
  }

  const isGradient = note.coverUrl && (note.coverUrl.startsWith("linear-gradient") || note.coverUrl.startsWith("radial-gradient"));

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col pb-24">
      {/* Cover */}
      {note.coverUrl ? (
        <div
          className="w-full h-[250px] overflow-hidden bg-cover bg-center shrink-0"
          style={{
            backgroundImage: isGradient ? note.coverUrl : `url(${note.coverUrl})`,
            backgroundPosition: isGradient ? undefined : `50% ${note.coverPosition || 50}%`,
          }}
        />
      ) : (
        <div className="h-16 shrink-0" />
      )}

      {/* Main Content Area */}
      <div className="max-w-4xl w-full mx-auto px-6 flex flex-col flex-1">
        {/* Public view header */}
        <div className="flex items-center justify-between border-b border-white/[0.04] py-3 mb-6">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Globe className="h-3.5 w-3.5" />
            <span>Shared public link {isEditable ? "(Editable)" : "(View only)"}</span>
          </div>
          
          {isEditable && saveStatus && (
            <div className="text-[10px] text-zinc-500 font-medium">
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" /> Saving changes...
                </span>
              )}
              {saveStatus === "saved" && <span className="text-green-500">✓ Saved to cloud</span>}
              {saveStatus === "error" && <span className="text-red-400">⚠️ Save failed</span>}
            </div>
          )}
        </div>

        {/* Icon & Title */}
        {note.icon && (
          <div className={`text-[78px] leading-none select-none ${note.coverUrl ? "-mt-12" : "mt-2"} mb-4`}>
            {note.icon}
          </div>
        )}

        <h1 className="text-4xl md:text-5xl font-bold text-white mb-8 outline-none border-none">
          {note.title || "Untitled"}
        </h1>

        {/* BlockNote View (Read-only or Editable) */}
        <div className="prose prose-lg max-w-none dark-editor-override">
          <BlockNoteView
            editor={editor}
            theme="dark"
            editable={isEditable}
            slashMenu={isEditable}
            sideMenu={isEditable}
          />
        </div>
      </div>
    </div>
  );
}

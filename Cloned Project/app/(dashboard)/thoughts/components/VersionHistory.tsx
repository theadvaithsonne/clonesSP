"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Clock,
  RotateCcw,
  Loader2,
  X,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { buildExternalUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/utils/api";
import { NoteVersion, formatDate } from "../types";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
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
} from "./blocks";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

interface VersionHistoryProps {
  noteId: string;
  isOpen: boolean;
  onClose: () => void;
  onVersionRestored?: () => void; // Callback when version is restored
}

export default function VersionHistory({
  noteId,
  isOpen,
  onClose,
  onVersionRestored,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<NoteVersion | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

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
    } as any,
  }), []);

  // Initialize BlockNote editor for preview
  const previewEditor = useCreateBlockNote({
    schema: notesSchema as unknown as Parameters<typeof useCreateBlockNote>[0]["schema"],
    initialContent: undefined,
  });

  // Fetch version history
  useEffect(() => {
    const fetchVersions = async () => {
      if (!isOpen || !noteId) return;

      try {
        setIsLoading(true);
        const response = await authenticatedFetch(
          buildExternalUrl(`notes/${noteId}/versions`)
        );

        if (!response.ok) throw new Error("Failed to fetch versions");

        const data = await response.json();
        setVersions(data.versions || []);
      } catch (error) {
        console.error("Error fetching versions:", error);
        toast.error("Failed to load version history");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVersions();
  }, [isOpen, noteId]);

  // Update preview when selected version changes
  useEffect(() => {
    if (!selectedVersion || !previewEditor) return;

    try {
      const blocks =
        typeof selectedVersion.content === "string"
          ? JSON.parse(selectedVersion.content)
          : selectedVersion.content;

      if (Array.isArray(blocks) && blocks.length > 0) {
        previewEditor.replaceBlocks(previewEditor.document, blocks);
      }
    } catch (e) {
      // If content is old plain text format, create a paragraph block
      if (selectedVersion.content?.trim()) {
        previewEditor.replaceBlocks(previewEditor.document, [
          {
            type: "paragraph",
            content: [{ type: "text", text: selectedVersion.content, styles: {} }] as any,
          },
        ]);
      }
    }
  }, [selectedVersion, previewEditor]);

  const handleRestoreVersion = async (versionId: string) => {
    try {
      setIsRestoring(versionId);

      const response = await authenticatedFetch(
        buildExternalUrl(`notes/${noteId}/versions/restore/${versionId}`),
        {
          method: "POST",
        }
      );

      if (!response.ok) throw new Error("Failed to restore version");

      const data = await response.json();
      toast.success(data.message || "Version restored successfully");

      // Call callback to refresh note
      if (onVersionRestored) {
        onVersionRestored();
      }

      // Refresh version list
      const versionsResponse = await authenticatedFetch(
        buildExternalUrl(`notes/${noteId}/versions`)
      );
      if (versionsResponse.ok) {
        const versionsData = await versionsResponse.json();
        setVersions(versionsData.versions || []);
      }

      // Close preview if open
      setPreviewMode(false);
      setSelectedVersion(null);
    } catch (error) {
      console.error("Error restoring version:", error);
      toast.error("Failed to restore version");
    } finally {
      setIsRestoring(null);
    }
  };

  const handlePreviewVersion = (version: NoteVersion) => {
    setSelectedVersion(version);
    setPreviewMode(true);
  };

  const handleClosePreview = () => {
    setPreviewMode(false);
    setSelectedVersion(null);
  };

  return (
    <>
      {/* Version List Sheet */}
      <Sheet open={isOpen && !previewMode} onOpenChange={onClose}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl p-0 flex flex-col bg-[#191919] text-white border-l border-zinc-800/40"
        >
          <SheetHeader className="border-none bg-transparent px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <SheetTitle className="text-base font-medium">
                  Version History
                </SheetTitle>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Loading version history...
                  </p>
                </div>
              </div>
            ) : versions.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    No version history available yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Versions are created when you make changes to this note
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {versions.map((version, index) => (
                  <div
                    key={version.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            Version {version.versionNumber}
                          </span>
                          {index === 0 && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              Latest backup
                            </span>
                          )}
                          {version.metadata?.updatedFrom === "before_restore" && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              Before restore
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground mb-2">
                          {formatDate(version.createdAt)}
                        </p>

                        <div className="space-y-1">
                          <p className="text-sm font-medium truncate">
                            {version.title || "Untitled"}
                          </p>
                          {version.tags && version.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {version.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs text-muted-foreground"
                                >
                                  #{tag}
                                </span>
                              ))}
                              {version.tags.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{version.tags.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 h-8"
                          onClick={() => handlePreviewVersion(version)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </Button>

                        <Button
                          variant="default"
                          size="sm"
                          className="gap-1.5 h-8"
                          onClick={() => handleRestoreVersion(version.id)}
                          disabled={isRestoring === version.id}
                        >
                          {isRestoring === version.id ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Restoring...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-3.5 w-3.5" />
                              Restore
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Preview Sheet */}
      <Sheet open={previewMode} onOpenChange={handleClosePreview}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-4xl lg:max-w-5xl p-0 flex flex-col bg-[#191919] text-white border-l border-zinc-800/40"
        >
          <SheetHeader className="border-none bg-transparent px-12 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleClosePreview}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex flex-col">
                  <SheetTitle className="text-base font-medium">
                    {selectedVersion?.title || "Untitled"} - Version{" "}
                    {selectedVersion?.versionNumber}
                  </SheetTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedVersion &&
                      formatDate(selectedVersion.createdAt)}
                  </p>
                </div>
              </div>

              <Button
                variant="default"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  selectedVersion && handleRestoreVersion(selectedVersion.id)
                }
                disabled={!selectedVersion || isRestoring === selectedVersion?.id}
              >
                {isRestoring === selectedVersion?.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Restore This Version
                  </>
                )}
              </Button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-12 py-8">
              {/* Title */}
              <h1 className="text-5xl font-bold mb-2">
                {selectedVersion?.title || "Untitled"}
              </h1>

              {/* Tags - View only */}
              {selectedVersion?.tags && selectedVersion.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-8">
                  {selectedVersion.tags.map((tag) => (
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

              {/* Content Preview */}
              <div className="prose prose-lg max-w-none garage-notes-editor">
                <BlockNoteView
                  editor={previewEditor}
                  theme="dark"
                  editable={false}
                />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

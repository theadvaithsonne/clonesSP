"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Image as ImageIcon,
  X,
  Loader2,
  Smile,
  Mic,
  Square,
  AudioLines,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/feed-api";
import { useUploadThing } from "@/lib/uploadthing";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { toast } from "sonner";
import { GifPickerModal } from "./GifPickerModal";
import { VoiceMessagePlayer } from "@/components/ui/voice-message-player";

// GIF icon component - Twitter-style text badge
const GifIcon = () => (
  <div className="flex items-center justify-center w-4 h-4 border border-current rounded text-[9px] font-bold leading-none">
    GIF
  </div>
);

interface GifObject {
  id: string;
  url: string;
  preview: string;
  title: string;
  width?: number;
  height?: number;
}

export interface CommentAttachment {
  id: string;
  type: "image" | "gif" | "audio";
  url: string;
  name: string;
  uploading?: boolean;
  fileKey?: string;
  duration?: number;
}

interface CommentInputProps {
  user: {
    name: string;
    email?: string;
    profilePicture?: string;
  };
  onSubmit: (content: string, attachments: CommentAttachment[]) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function CommentInput({
  user,
  onSubmit,
  placeholder = "Post your reply...",
  disabled = false,
  autoFocus = false,
}: CommentInputProps) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<CommentAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  // Upload hooks
  const { startUpload: startImageUpload } = useUploadThing("postImages");

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = "auto";
      // Set the height to scrollHeight, but cap at max-height (150px)
      const newHeight = Math.min(textarea.scrollHeight, 150);
      textarea.style.height = `${newHeight}px`;
    }
  }, [content]);

  // Auto focus on mount
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Format recording duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Start audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Could not access microphone");
    }
  };

  // Stop audio recording
  const stopRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    const currentDuration = recordingDuration;
    setIsRecording(false);

    const audioBlob = await new Promise<Blob>((resolve) => {
      mediaRecorderRef.current!.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        resolve(blob);
      };
      mediaRecorderRef.current!.stop();
    });

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }

    const attachmentId = `audio-${Date.now()}`;

    setAttachments((prev) => [
      ...prev,
      {
        id: attachmentId,
        type: "audio" as const,
        url: "",
        name: "Voice Note",
        uploading: true,
        duration: currentDuration,
      },
    ]);

    try {
      const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, {
        type: "audio/webm",
      });
      const uploadResult = await uploadFile(audioFile);

      if (uploadResult && uploadResult.url) {
        setAttachments((prev) =>
          prev.map((att) =>
            att.id === attachmentId
              ? { ...att, url: uploadResult.url, fileKey: uploadResult.fileKey, uploading: false }
              : att
          )
        );
        toast.success("Voice note uploaded");
      } else {
        setAttachments((prev) => prev.filter((att) => att.id !== attachmentId));
        toast.error("Failed to upload voice note");
      }
    } catch (error) {
      console.error("Error uploading voice note:", error);
      setAttachments((prev) => prev.filter((att) => att.id !== attachmentId));
      toast.error("Failed to upload voice note");
    }

    setRecordingDuration(0);
  };

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImages(true);
    try {
      const fileArray = Array.from(files);
      const uploadResults = await startImageUpload(fileArray);

      if (uploadResults) {
        const newAttachments: CommentAttachment[] = uploadResults.map(
          (result, index) => ({
            id: `img-${Date.now()}-${index}`,
            type: "image" as const,
            url: result.url,
            name: fileArray[index].name,
          })
        );
        setAttachments((prev) => [...prev, ...newAttachments]);
        toast.success(`${uploadResults.length} image(s) uploaded`);
      }
    } catch (error) {
      console.error("Error uploading images:", error);
      toast.error("Failed to upload images");
    } finally {
      setIsUploadingImages(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle paste event to capture images from clipboard
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems) return;

    const imageFiles: File[] = [];

    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          const extension = item.type.split("/")[1] || "png";
          const newFile = new File([file], `pasted-image-${Date.now()}.${extension}`, {
            type: item.type,
          });
          imageFiles.push(newFile);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      setIsUploadingImages(true);
      try {
        const uploadResults = await startImageUpload(imageFiles);

        if (uploadResults) {
          const newAttachments: CommentAttachment[] = uploadResults.map(
            (result, index) => ({
              id: `img-${Date.now()}-${index}`,
              type: "image" as const,
              url: result.url,
              name: imageFiles[index].name,
            })
          );
          setAttachments((prev) => [...prev, ...newAttachments]);
          toast.success(`${uploadResults.length} image(s) pasted and uploaded`);
        }
      } catch (error) {
        console.error("Error uploading pasted images:", error);
        toast.error("Failed to upload pasted images");
      } finally {
        setIsUploadingImages(false);
      }
    }
  };

  // Add GIF attachment from modal
  const handleSelectGif = (gif: GifObject) => {
    setAttachments((prev) => [
      ...prev,
      {
        id: `gif-${gif.id}`,
        type: "gif",
        url: gif.url,
        name: gif.title || "GIF",
      },
    ]);
  };

  // Remove attachment
  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Handle emoji selection
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const cursor = textareaRef.current?.selectionStart || content.length;
    const newContent =
      content.slice(0, cursor) + emojiData.emoji + content.slice(cursor);
    setContent(newContent);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  // Handle submit
  const handleSubmit = async () => {
    if ((!content.trim() && attachments.length === 0) || isSubmitting) return;

    // Check for uploading attachments
    const hasUploadingAttachments = attachments.some((a) => a.uploading);
    if (hasUploadingAttachments) {
      toast.error("Please wait for uploads to complete");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(content.trim(), attachments);
      // Reset form
      setContent("");
      setAttachments([]);
    } catch (error) {
      console.error("Error submitting comment:", error);
      toast.error("Failed to submit comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle keyboard submit (Enter without Shift)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const COMMENT_CHAR_LIMIT = 1000;
  const hasUploadingAttachments = attachments.some((a) => a.uploading);
  const canSubmit =
    (content.trim() || attachments.length > 0) &&
    content.length <= COMMENT_CHAR_LIMIT &&
    !hasUploadingAttachments &&
    !isSubmitting &&
    !isRecording &&
    !disabled;

  return (
    <div ref={containerRef}>
      <div className="flex gap-3 items-start">
        {/* User Avatar */}
        <Avatar className="w-9 h-9 flex-shrink-0 mt-0.5">
          <AvatarImage src={user.profilePicture} />
          <AvatarFallback className="bg-brand text-brand-foreground font-semibold text-xs">
            {user.name?.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Input Area */}
        <div className="flex-1 min-w-0">
          {/* Text input with inline send button */}
          <div className="relative flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.length > COMMENT_CHAR_LIMIT) return;
                  setContent(val);
                }}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={placeholder}
                disabled={disabled || isRecording}
                className={cn(
                  "w-full min-h-[40px] max-h-[150px] py-2.5 px-4 bg-[#14141c] border border-[#22222e] rounded-xl",
                  "text-white placeholder:text-[#6a6a80] text-[13px] leading-relaxed resize-none outline-none",
                  "focus:border-brand/50 focus:bg-[#16161f] transition-all duration-200",
                  "overflow-y-auto scrollbar-hide",
                  (disabled || isRecording) && "opacity-50 cursor-not-allowed"
                )}
                style={{ overflow: content.split('\n').length <= 1 && content.length < 80 ? 'hidden' : 'auto' }}
                rows={1}
              />
              {/* Character counter — show when user is approaching limit */}
              {content.length > COMMENT_CHAR_LIMIT * 0.7 && (
                <div className={`text-right text-[10px] mt-0.5 pr-1 ${
                  content.length >= COMMENT_CHAR_LIMIT
                    ? 'text-red-500 font-semibold'
                    : 'text-yellow-400'
                }`}>
                  {content.length}/{COMMENT_CHAR_LIMIT}
                </div>
              )}
            </div>

            {/* Send button — inline right of textarea */}
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              size="sm"
              className={cn(
                "rounded-xl h-[40px] w-[40px] p-0 flex-shrink-0 transition-all duration-200",
                canSubmit
                  ? "bg-brand hover:opacity-90 text-brand-foreground shadow-lg shadow-brand/10"
                  : "bg-[#1a1a24] text-[#3a3a4a] cursor-not-allowed border border-[#22222e]"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Attachments preview */}
          {attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className={cn(
                    "relative group",
                    attachment.type === "audio" ? "w-full" : "w-16 h-16"
                  )}
                >
                  {attachment.type === "audio" ? (
                    <div className="bg-[#14141c] rounded-lg p-2.5 border border-[#22222e]">
                      {attachment.url && !attachment.uploading ? (
                        <VoiceMessagePlayer src={attachment.url} isOwnMessage={true} />
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-brand/15 rounded-full flex items-center justify-center">
                            {attachment.uploading ? (
                              <Loader2 className="w-4 h-4 text-brand animate-spin" />
                            ) : (
                              <AudioLines className="w-4 h-4 text-brand" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-[#E8EAED] font-medium">
                              {attachment.uploading ? "Uploading..." : "Voice Note"}
                            </span>
                            {attachment.duration && (
                              <span className="text-[10px] text-[#6E767D]">
                                {Math.floor(attachment.duration / 60)}:
                                {(attachment.duration % 60).toString().padStart(2, "0")}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full bg-[#14141c] rounded-lg overflow-hidden border border-[#22222e]">
                      <img
                        src={attachment.url}
                        alt={attachment.name}
                        className="w-full h-full object-cover"
                      />
                      {attachment.type === "gif" && (
                        <div className="absolute bottom-0.5 left-0.5 bg-black/70 px-1 py-0.5 rounded text-[9px] font-bold">
                          GIF
                        </div>
                      )}
                    </div>
                  )}
                  {attachment.uploading && attachment.type !== "audio" && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    </div>
                  )}
                  <button
                    onClick={() => removeAttachment(attachment.id)}
                    className="absolute -top-1 -right-1 p-0.5 bg-red-500 hover:bg-red-600 rounded-full transition-colors"
                  >
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Toolbar — compact */}
          <div className="flex items-center justify-between mt-1.5 px-0.5">
            <div className="flex items-center gap-0.5">
              {/* Emoji picker */}
              <div className="relative">
                <button
                  ref={emojiButtonRef}
                  onClick={() => {
                    setShowEmojiPicker(!showEmojiPicker);
                    setShowGifPicker(false);
                  }}
                  disabled={disabled}
                  className="p-1.5 hover:bg-brand/8 rounded-lg transition-colors group"
                  title="Emoji"
                >
                  <Smile className="w-[18px] h-[18px] text-[#5a5a70] group-hover:text-brand transition-colors" />
                </button>

                {showEmojiPicker && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowEmojiPicker(false)}
                    />
                    <div className="absolute bottom-full left-0 mb-2 z-20">
                      <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        theme={Theme.DARK}
                        width={320}
                        height={320}
                        previewConfig={{ showPreview: false }}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Image upload */}
              <label
                className={cn(
                  "p-1.5 hover:bg-brand/8 rounded-lg cursor-pointer transition-colors group",
                  isUploadingImages && "opacity-50 cursor-not-allowed"
                )}
                title="Upload image"
              >
                {isUploadingImages ? (
                  <Loader2 className="w-[18px] h-[18px] text-[#5a5a70] animate-spin" />
                ) : (
                  <ImageIcon className="w-[18px] h-[18px] text-[#5a5a70] group-hover:text-brand transition-colors" />
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploadingImages || disabled}
                />
              </label>

              {/* GIF picker */}
              <button
                onClick={() => {
                  setShowGifPicker(true);
                  setShowEmojiPicker(false);
                }}
                disabled={disabled}
                className="p-1.5 hover:bg-brand/8 rounded-lg transition-colors text-[#5a5a70] hover:text-brand group"
                title="GIF"
              >
                <GifIcon />
              </button>

              {/* Voice recording */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={disabled}
                className={cn(
                  "p-1.5 rounded-lg transition-colors group",
                  isRecording
                    ? "bg-red-500/15 hover:bg-red-500/25"
                    : "hover:bg-brand/8"
                )}
                title={isRecording ? "Stop recording" : "Voice note"}
              >
                {isRecording ? (
                  <Square className="w-[18px] h-[18px] text-red-500" />
                ) : (
                  <Mic className="w-[18px] h-[18px] text-[#5a5a70] group-hover:text-brand transition-colors" />
                )}
              </button>

              {/* Recording indicator */}
              {isRecording && (
                <div className="flex items-center gap-1.5 text-red-500 ml-1">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-xs font-medium">{formatDuration(recordingDuration)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* GIF Picker Modal */}
      <GifPickerModal
        open={showGifPicker}
        onOpenChange={setShowGifPicker}
        onSelectGif={handleSelectGif}
      />
    </div>
  );
}

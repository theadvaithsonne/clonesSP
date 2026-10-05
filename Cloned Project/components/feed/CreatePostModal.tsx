"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Image as ImageIcon,
  X,
  ChevronDown,
  Globe,
  Loader2,
  Check,
  Smile,
  Mic,
  Square,
  Hash,
  Link as LinkIcon,
  AudioLines,
  BarChart3,
  Video,
  Paperclip,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createPost, createPollPost, updatePost, PostAttachment, uploadFile, Post } from "@/lib/feed-api";
import { PollCreator } from "./PollCreator";
import { useUploadThing } from "@/lib/uploadthing";
import { VoiceMessagePlayer } from "@/components/ui/voice-message-player";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { toast } from "sonner";
import { ScreenRecorder } from "@/components/ui/screen-recorder";
import CustomVideoPlayer from "@/components/dashboard/CustomVideoPlayer";

// URL regex for detecting links
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

// Hashtag regex for extracting tags from content
const HASHTAG_REGEX = /#(\w+)/g;

// Extract URLs from text
const extractUrls = (text: string): string[] => {
  const matches = text.match(URL_REGEX);
  return matches ? [...new Set(matches)] : [];
};

// Extract hashtags from text
const extractHashtags = (text: string): string[] => {
  const matches = [...text.matchAll(HASHTAG_REGEX)];
  const tags = matches.map((match) => match[1]); // Get the captured group without #
  return [...new Set(tags)]; // Remove duplicates
};

// Get domain from URL
const getDomainFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return url;
  }
};

// Link preview interface
interface LinkPreview {
  url: string;
  domain: string;
}

// Empty array constant to prevent new reference on each render
const EMPTY_TEAM_MEMBERS: TeamMember[] = [];

// GIF icon component
const GifIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9.5 8.5c0 .83-.67 1.5-1.5 1.5H7v2H5.5V9H8c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V9H13c.83 0 1.5.67 1.5 1.5v3zm4-3H17v1h1.5v1H17v2h-1.5V9h3v1.5zM7 10.5h1v1H7v-1zm5 0h1v2h-1v-2z" />
  </svg>
);

interface Channel {
  channelId: string;
  channelTitle: string;
  logo?: string | null;
  memberCount?: number;
}

interface TeamMember {
  _id: string;
  name: string;
  email: string;
  profilePicture?: string;
}

interface GifObject {
  id: string;
  url: string;
  preview: string;
  title: string;
}

interface Attachment {
  id: string;
  type: "image" | "video" | "document" | "gif" | "audio";
  url: string;
  name: string;
  uploading?: boolean;
  fileKey?: string;
  duration?: number;
}

interface CreatePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channels: Channel[];
  orgId: string;
  user: {
    name: string;
    email?: string;
    profilePicture?: string;
  };
  onPostCreated: () => void;
  teamMembers?: TeamMember[];
  existingTags?: string[];
  editPost?: Post | null; // Post to edit (if provided, modal is in edit mode)
}

export function CreatePostModal({
  open,
  onOpenChange,
  channels,
  orgId,
  user,
  onPostCreated,
  teamMembers,
  existingTags = [],
  editPost = null,
}: CreatePostModalProps) {
  const isEditMode = !!editPost;
  // Use stable empty array reference if teamMembers is undefined
  const stableTeamMembers = teamMembers ?? EMPTY_TEAM_MEMBERS;
  const [content, setContent] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifs, setGifs] = useState<GifObject[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isUploadingScreenRecording, setIsUploadingScreenRecording] = useState(false);

  // Fixed ID for post composer (used as screen recording target)
  // Using a constant ID so recordings persist across remounts
  const postComposerId = "modal-post-composer";

  // Mention state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);

  // Hashtag state
  const [showHashtagDropdown, setShowHashtagDropdown] = useState(false);
  const [hashtagQuery, setHashtagQuery] = useState("");
  const [hashtagStartIndex, setHashtagStartIndex] = useState(-1);

  // Link preview state
  const [linkPreviews, setLinkPreviews] = useState<LinkPreview[]>([]);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollData, setPollData] = useState<{
    question: string;
    options: string[];
    durationHours: number;
    isMultipleChoice: boolean;
  } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleTextareaScroll = () => {
    const textarea = textareaRef.current;
    const overlay = overlayRef.current;
    if (textarea && overlay) {
      overlay.scrollTop = textarea.scrollTop;
    }
  };

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      // Let the CSS max-height handle the cap responsively
      textarea.style.height = `${Math.max(120, textarea.scrollHeight)}px`;
    }
  }, [content]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);

  // Upload hooks
  const { startUpload: startImageUpload } = useUploadThing("postImages");
  const { startUpload: startVideoUpload } = useUploadThing("postVideos");
  const { startUpload: startDocumentUpload } = useUploadThing("postDocuments");

  // Additional upload states
  const [isUploadingVideos, setIsUploadingVideos] = useState(false);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // Filter members based on query using useMemo (derived state, no useEffect needed)
  const filteredMembers = useMemo(() => {
    if (!showMentionDropdown) {
      return [];
    }
    if (!mentionQuery) {
      return stableTeamMembers.slice(0, 5);
    }
    const query = mentionQuery.toLowerCase();
    return stableTeamMembers
      .filter(
        (member) =>
          member.name?.toLowerCase().includes(query) ||
          member.email?.toLowerCase().includes(query)
      )
      .slice(0, 5);
  }, [mentionQuery, stableTeamMembers, showMentionDropdown]);

  // Filter hashtags based on query
  const filteredTags = useMemo(() => {
    if (!showHashtagDropdown) {
      return [];
    }
    if (!hashtagQuery) {
      return existingTags.slice(0, 5);
    }
    const query = hashtagQuery.toLowerCase();
    return existingTags
      .filter((tag) => tag.toLowerCase().includes(query))
      .slice(0, 5);
  }, [hashtagQuery, showHashtagDropdown, existingTags]);

  // Fetch trending GIFs from GIPHY
  const fetchTrendingGifs = useCallback(async () => {
    setLoadingGifs(true);
    try {
      const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY || "dc6zaTOxFJmzC";
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=20&rating=g`
      );
      const data = await response.json();
      const gifResults: GifObject[] = data.data.map((gif: any) => ({
        id: gif.id,
        url: gif.images.original.url,
        preview: gif.images.fixed_height_small.url,
        title: gif.title,
      }));
      setGifs(gifResults);
    } catch (error) {
      console.error("Error fetching GIFs:", error);
    } finally {
      setLoadingGifs(false);
    }
  }, []);

  // Search GIFs
  const searchGifs = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        fetchTrendingGifs();
        return;
      }
      setLoadingGifs(true);
      try {
        const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY || "dc6zaTOxFJmzC";
        const response = await fetch(
          `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(
            query
          )}&limit=20&rating=g`
        );
        const data = await response.json();
        const gifResults: GifObject[] = data.data.map((gif: any) => ({
          id: gif.id,
          url: gif.images.original.url,
          preview: gif.images.fixed_height_small.url,
          title: gif.title,
        }));
        setGifs(gifResults);
      } catch (error) {
        console.error("Error searching GIFs:", error);
      } finally {
        setLoadingGifs(false);
      }
    },
    [fetchTrendingGifs]
  );

  // Debounced GIF search
  useEffect(() => {
    if (showGifPicker) {
      const timer = setTimeout(() => {
        if (gifSearch) {
          searchGifs(gifSearch);
        } else {
          fetchTrendingGifs();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [gifSearch, showGifPicker, searchGifs, fetchTrendingGifs]);

  // Detect URLs in content and update link previews
  useEffect(() => {
    const urls = extractUrls(content);
    const newPreviews: LinkPreview[] = urls.map((url) => ({
      url,
      domain: getDomainFromUrl(url),
    }));

    setLinkPreviews((prev) => {
      // Only update if URLs have changed
      const currentUrls = prev.map((p) => p.url).sort().join(",");
      const newUrls = newPreviews.map((p) => p.url).sort().join(",");

      if (currentUrls !== newUrls) {
        return newPreviews;
      }
      return prev;
    });
  }, [content]);

  // Remove link preview
  const removeLinkPreview = useCallback((url: string) => {
    setLinkPreviews((prev) => prev.filter((p) => p.url !== url));
  }, []);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setContent("");
      setSelectedChannels([]);
      setAttachments([]);
      setShowEmojiPicker(false);
      setShowGifPicker(false);
      setShowMentionDropdown(false);
      setMentionQuery("");
      setShowHashtagDropdown(false);
      setHashtagQuery("");
      setLinkPreviews([]);
      setShowPollCreator(false);
      setPollData(null);
      // Stop recording if active
      if (isRecording && mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
        }
      }
    }
  }, [open, isRecording]);

  // Pre-populate fields when editing a post
  useEffect(() => {
    if (open && editPost) {
      setContent(editPost.content || "");
      // Set selected channels from the post
      const channelIds = editPost.channelIds?.map(ch => ch._id) || [];
      setSelectedChannels(channelIds);
      // Convert existing attachments to local format
      if (editPost.attachments && editPost.attachments.length > 0) {
        const existingAttachments: Attachment[] = editPost.attachments.map((att, idx) => ({
          id: `existing-${idx}`,
          type: att.type as Attachment["type"],
          url: att.url,
          name: att.name || "Attachment",
        }));
        setAttachments(existingAttachments);
      }
    }
  }, [open, editPost]);

  // Handle text change with mention and hashtag detection
  const POST_CHAR_LIMIT = 3000;
  const handleTextChange = (text: string) => {
    // Enforce character limit for regular posts
    if (text.length > POST_CHAR_LIMIT) return;
    setContent(text);

    // Find the last @ and # to determine which dropdown to show
    const lastAtIndex = text.lastIndexOf("@");
    const lastHashIndex = text.lastIndexOf("#");

    // Helper to check if we're actively typing after a trigger
    const isActivelyTyping = (triggerIndex: number) => {
      if (triggerIndex === -1) return false;
      const textAfter = text.slice(triggerIndex + 1);
      const spaceIndex = textAfter.indexOf(" ");
      const newlineIndex = textAfter.indexOf("\n");
      const endIndex = Math.min(
        spaceIndex === -1 ? Infinity : spaceIndex,
        newlineIndex === -1 ? Infinity : newlineIndex
      );
      return endIndex === Infinity && textAfter.length <= 30;
    };

    const atIsActive = lastAtIndex !== -1 && isActivelyTyping(lastAtIndex);
    const hashIsActive = lastHashIndex !== -1 && isActivelyTyping(lastHashIndex);

    // If both are active, use the more recent one
    if (atIsActive && hashIsActive) {
      if (lastAtIndex > lastHashIndex) {
        const textAfterAt = text.slice(lastAtIndex + 1);
        setMentionQuery(textAfterAt.toLowerCase());
        setMentionStartIndex(lastAtIndex);
        setShowMentionDropdown(true);
        setShowHashtagDropdown(false);
        setHashtagQuery("");
      } else {
        const textAfterHash = text.slice(lastHashIndex + 1);
        setHashtagQuery(textAfterHash.toLowerCase());
        setHashtagStartIndex(lastHashIndex);
        setShowHashtagDropdown(true);
        setShowMentionDropdown(false);
        setMentionQuery("");
      }
    } else if (atIsActive) {
      const textAfterAt = text.slice(lastAtIndex + 1);
      setMentionQuery(textAfterAt.toLowerCase());
      setMentionStartIndex(lastAtIndex);
      setShowMentionDropdown(true);
      setShowHashtagDropdown(false);
      setHashtagQuery("");
    } else if (hashIsActive) {
      const textAfterHash = text.slice(lastHashIndex + 1);
      setHashtagQuery(textAfterHash.toLowerCase());
      setHashtagStartIndex(lastHashIndex);
      setShowHashtagDropdown(true);
      setShowMentionDropdown(false);
      setMentionQuery("");
    } else {
      setShowMentionDropdown(false);
      setMentionQuery("");
      setShowHashtagDropdown(false);
      setHashtagQuery("");
    }
  };

  // Insert mention
  const insertMention = (member: TeamMember) => {
    const beforeMention = content.slice(0, mentionStartIndex);
    const afterMention = content.slice(mentionStartIndex + mentionQuery.length + 1);
    const mentionHandle = member.name.replace(/\s+/g, "");
    const mentionText = `@${mentionHandle} `;

    setContent(beforeMention + mentionText + afterMention);
    setShowMentionDropdown(false);
    setMentionQuery("");
    setMentionStartIndex(-1);
    textareaRef.current?.focus();
  };

  // Insert hashtag
  const insertHashtag = (tag: string) => {
    const beforeHashtag = content.slice(0, hashtagStartIndex);
    const afterHashtag = content.slice(hashtagStartIndex + hashtagQuery.length + 1);
    const hashtagText = `#${tag} `;

    setContent(beforeHashtag + hashtagText + afterHashtag);
    setShowHashtagDropdown(false);
    setHashtagQuery("");
    setHashtagStartIndex(-1);
    textareaRef.current?.focus();
  };

  // Format recording duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Store stream ref for cleanup
  const audioStreamRef = useRef<MediaStream | null>(null);

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

      // Start duration counter
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

    // Stop the interval first
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    const currentDuration = recordingDuration;
    setIsRecording(false);

    // Create a promise to wait for the recorder to stop
    const audioBlob = await new Promise<Blob>((resolve) => {
      mediaRecorderRef.current!.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        resolve(blob);
      };
      mediaRecorderRef.current!.stop();
    });

    // Stop all tracks
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }

    // Create attachment ID for tracking
    const attachmentId = `audio-${Date.now()}`;

    // Add attachment immediately with uploading state
    setAttachments((prev) => [
      ...prev,
      {
        id: attachmentId,
        type: "audio" as const,
        url: "", // Will be updated after upload
        name: "Voice Note",
        uploading: true,
        duration: currentDuration,
      },
    ]);

    // Upload the audio file using backend API (same as mobile app)
    try {
      const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, {
        type: "audio/webm",
      });
      const uploadResult = await uploadFile(audioFile);

      if (uploadResult && uploadResult.url) {
        // Update the attachment with the uploaded URL
        setAttachments((prev) =>
          prev.map((att) =>
            att.id === attachmentId
              ? { ...att, url: uploadResult.url, fileKey: uploadResult.fileKey, uploading: false }
              : att
          )
        );
        toast.success("Voice note uploaded");
      } else {
        // Remove failed attachment
        setAttachments((prev) => prev.filter((att) => att.id !== attachmentId));
        toast.error("Failed to upload voice note");
      }
    } catch (error) {
      console.error("Error uploading voice note:", error);
      // Remove failed attachment
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
        const newAttachments: Attachment[] = uploadResults.map(
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

  // Handle video upload
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingVideos(true);
    try {
      const fileArray = Array.from(files);
      const uploadResults = await startVideoUpload(fileArray);

      if (uploadResults) {
        const newAttachments: Attachment[] = uploadResults.map(
          (result, index) => ({
            id: `vid-${Date.now()}-${index}`,
            type: "video" as const,
            url: result.url,
            name: fileArray[index].name,
          })
        );
        setAttachments((prev) => [...prev, ...newAttachments]);
        toast.success(`${uploadResults.length} video(s) uploaded`);
      }
    } catch (error) {
      console.error("Error uploading videos:", error);
      toast.error("Failed to upload videos");
    } finally {
      setIsUploadingVideos(false);
      if (videoInputRef.current) {
        videoInputRef.current.value = "";
      }
    }
  };

  // Handle document upload
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingDocuments(true);
    try {
      const fileArray = Array.from(files);
      const uploadResults = await startDocumentUpload(fileArray);

      if (uploadResults) {
        const newAttachments: Attachment[] = uploadResults.map(
          (result, index) => ({
            id: `doc-${Date.now()}-${index}`,
            type: "document" as const,
            url: result.url,
            name: fileArray[index].name,
          })
        );
        setAttachments((prev) => [...prev, ...newAttachments]);
        toast.success(`${uploadResults.length} file(s) uploaded`);
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      toast.error("Failed to upload files");
    } finally {
      setIsUploadingDocuments(false);
      if (documentInputRef.current) {
        documentInputRef.current.value = "";
      }
    }
  };

  // Handle paste event to capture images and videos from clipboard
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems) return;

    const imageFiles: File[] = [];
    const videoFiles: File[] = [];

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
      } else if (item.type.startsWith("video/")) {
        const file = item.getAsFile();
        if (file) {
          const extension = item.type.split("/")[1] || "mp4";
          const newFile = new File([file], `pasted-video-${Date.now()}.${extension}`, {
            type: item.type,
          });
          videoFiles.push(newFile);
        }
      }
    }

    if (imageFiles.length > 0 || videoFiles.length > 0) {
      e.preventDefault();
    }

    if (imageFiles.length > 0) {
      setIsUploadingImages(true);
      try {
        const uploadResults = await startImageUpload(imageFiles);

        if (uploadResults) {
          const newAttachments: Attachment[] = uploadResults.map(
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

    if (videoFiles.length > 0) {
      setIsUploadingVideos(true);
      try {
        const uploadResults = await startVideoUpload(videoFiles);

        if (uploadResults) {
          const newAttachments: Attachment[] = uploadResults.map(
            (result, index) => ({
              id: `vid-${Date.now()}-${index}`,
              type: "video" as const,
              url: result.url,
              name: videoFiles[index].name,
            })
          );
          setAttachments((prev) => [...prev, ...newAttachments]);
          toast.success(`${uploadResults.length} video(s) pasted and uploaded`);
        }
      } catch (error) {
        console.error("Error uploading pasted videos:", error);
        toast.error("Failed to upload pasted videos");
      } finally {
        setIsUploadingVideos(false);
      }
    }
  };

  // Add GIF attachment
  const addGif = (gif: GifObject) => {
    setAttachments((prev) => [
      ...prev,
      {
        id: `gif-${gif.id}`,
        type: "gif",
        url: gif.url,
        name: gif.title || "GIF",
      },
    ]);
    setShowGifPicker(false);
    setGifSearch("");
  };

  // Handle screen recording complete - upload and add as attachment
  const handleScreenRecordingComplete = useCallback(async (file: File) => {
    setIsUploadingScreenRecording(true);
    const attachmentId = `screen-${Date.now()}`;

    // Add attachment immediately with uploading state
    setAttachments((prev) => [
      ...prev,
      {
        id: attachmentId,
        type: "video" as const,
        url: "",
        name: file.name,
        uploading: true,
      },
    ]);

    try {
      const uploadResult = await uploadFile(file);

      if (uploadResult && uploadResult.url) {
        setAttachments((prev) =>
          prev.map((att) =>
            att.id === attachmentId
              ? { ...att, url: uploadResult.url, fileKey: uploadResult.fileKey, uploading: false }
              : att
          )
        );
        toast.success("Screen recording uploaded");
        // Clear localStorage after successful upload
        localStorage.removeItem("pendingPostScreenRecording");
      } else {
        setAttachments((prev) => prev.filter((att) => att.id !== attachmentId));
        toast.error("Failed to upload screen recording");
      }
    } catch (error) {
      console.error("Error uploading screen recording:", error);
      setAttachments((prev) => prev.filter((att) => att.id !== attachmentId));
      toast.error("Failed to upload screen recording");
    } finally {
      setIsUploadingScreenRecording(false);
    }
  }, []);

  // Restore pending screen recording from localStorage when modal opens
  // Only restore if not already restored (e.g., after page refresh)
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (open && !hasRestoredRef.current) {
      const pendingRecording = localStorage.getItem("pendingPostScreenRecording");
      if (pendingRecording) {
        hasRestoredRef.current = true;
        try {
          const { base64, mimeType } = JSON.parse(pendingRecording);
          // Convert base64 back to Blob
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: mimeType });
          const extension = mimeType.includes("webm") ? "webm" : "mp4";
          const file = new File([blob], `screen-recording-${Date.now()}.${extension}`, { type: mimeType });

          // Auto-upload the restored recording
          handleScreenRecordingComplete(file);
          toast.info("Restored your screen recording");
        } catch (e) {
          console.error("Failed to restore screen recording from localStorage:", e);
          localStorage.removeItem("pendingPostScreenRecording");
        }
      }
    }
  }, [open, handleScreenRecordingComplete]);

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

  // Toggle channel selection
  const toggleChannel = (channelId: string) => {
    if (selectedChannels.includes(channelId)) {
      setSelectedChannels(selectedChannels.filter((id) => id !== channelId));
    } else {
      setSelectedChannels([...selectedChannels, channelId]);
    }
  };

  // Handle post submission
  const handleSubmit = async () => {
    // For poll posts, content is optional but poll data is required
    if (showPollCreator && pollData) {
      if (selectedChannels.length === 0) return;
    } else {
      if (!content.trim() || selectedChannels.length === 0) return;
    }

    setIsSubmitting(true);
    try {
      // Extract hashtags from content to save as tags
      const extractedTags = extractHashtags(content);

      if (isEditMode && editPost) {
        // Update existing post
        await updatePost(editPost._id, {
          content: content.trim(),
          tags: extractedTags.length > 0 ? extractedTags : undefined,
        });
        toast.success("Post updated successfully!");
      } else if (showPollCreator && pollData) {
        // Create poll post
        await createPollPost({
          orgId,
          content: content.trim() || undefined,
          channelIds: selectedChannels,
          tags: extractedTags.length > 0 ? extractedTags : undefined,
          poll: pollData,
        });
        toast.success("Poll created successfully!");
      } else {
        // Create regular post
        // Map 'gif' to 'image' and 'audio' to 'document' for backend compatibility
        const postAttachments: PostAttachment[] = attachments
          .filter((a) => !a.uploading)
          .map((a) => ({
            type: a.type === "gif" ? "image" : a.type === "audio" ? "document" : a.type,
            url: a.url,
            name: a.name,
            fileKey: a.fileKey,
          }));

        await createPost({
          orgId,
          content: content.trim(),
          channelIds: selectedChannels,
          tags: extractedTags.length > 0 ? extractedTags : undefined,
          attachments: postAttachments,
        });
        toast.success("Post created successfully!");
      }

      onOpenChange(false);
      onPostCreated();
    } catch (error) {
      console.error(isEditMode ? "Failed to update post:" : "Failed to create post:", error);
      toast.error(isEditMode ? "Failed to update post" : showPollCreator ? "Failed to create poll" : "Failed to create post");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render text with highlighted mentions and hashtags
  const renderHighlightedText = () => {
    if (!content) return null;

    const parts = content.split(/(@\w+|#\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span key={i} className="text-brand">
            {part}
          </span>
        );
      }
      if (part.startsWith("#")) {
        return (
          <span key={i} className="text-brand">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const hasUploadingAttachments = attachments.some((a) => a.uploading) || isUploadingImages;
  const canPost = showPollCreator
    ? // For polls: need valid poll data and at least one channel
      pollData !== null &&
      selectedChannels.length > 0 &&
      !isSubmitting
    : // For regular posts: need content, at least one channel, and within char limit
      content.trim() &&
      content.length <= POST_CHAR_LIMIT &&
      selectedChannels.length > 0 &&
      !hasUploadingAttachments &&
      !isSubmitting &&
      !isRecording;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#16181C] border-[#2F3336] text-white max-w-[600px] p-0 gap-0 [&>button]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2F3336]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {isEditMode && (
              <span className="text-white font-semibold">Edit Post</span>
            )}
          </div>
          {!isEditMode && (
            <button className="text-brand font-semibold text-sm hover:underline">
              Drafts
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <div className="flex gap-3">
            {/* Avatar */}
            <Avatar className="w-10 h-10 flex-shrink-0">
              <AvatarImage src={user.profilePicture} />
              <AvatarFallback className="bg-brand text-white">
                {user.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Main content area */}
            <div className="flex-1 min-w-0">
              {/* Audience selector */}
              <div className="relative mb-3">
                <button
                  ref={channelButtonRef}
                  onClick={() => {
                    if (!showChannelDropdown && channelButtonRef.current) {
                      const rect = channelButtonRef.current.getBoundingClientRect();
                      setDropdownPosition({
                        top: rect.bottom + 4,
                        left: rect.left,
                      });
                    }
                    setShowChannelDropdown(!showChannelDropdown);
                  }}
                  className="flex items-center gap-1 px-3 py-1 border border-[#536471] rounded-full text-brand text-sm font-semibold hover:bg-brand/10 transition-colors"
                >
                  {selectedChannels.length === 0
                    ? "Select communities"
                    : selectedChannels.length === 1
                    ? channels.find((c) => c.channelId === selectedChannels[0])
                        ?.channelTitle || "Community"
                    : `${selectedChannels.length} communities`}
                  <ChevronDown className="w-4 h-4" />
                </button>

                {/* Channel dropdown - rendered as portal */}
                {showChannelDropdown && dropdownPosition && typeof document !== 'undefined' && createPortal(
                  <>
                    <div
                      className="fixed inset-0 z-[9998]"
                      onClick={() => setShowChannelDropdown(false)}
                    />
                    <div
                      className="fixed bg-[#16181C] border border-[#2F3336] rounded-xl shadow-xl z-[9999] min-w-[280px] py-2 max-h-[60vh] overflow-y-auto"
                      style={{
                        top: dropdownPosition.top,
                        left: dropdownPosition.left,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Select All / Deselect All option */}
                      {channels.length > 1 && (
                        <>
                          <button
                            onClick={() => {
                              if (selectedChannels.length === channels.length) {
                                // Deselect all
                                setSelectedChannels([]);
                              } else {
                                // Select all
                                setSelectedChannels(channels.map(c => c.channelId));
                              }
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors"
                          >
                            {/* Icon */}
                            <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
                              <Check className="w-5 h-5 text-brand" />
                            </div>

                            {/* Label */}
                            <div className="flex-1 text-left">
                              <p className="text-brand text-sm font-medium">
                                {selectedChannels.length === channels.length ? "Deselect All" : "Select All"}
                              </p>
                              <p className="text-[#6E767D] text-xs">
                                {channels.length} communities
                              </p>
                            </div>

                            {/* Checkbox showing all-selected state */}
                            <div
                              className={cn(
                                "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0",
                                selectedChannels.length === channels.length
                                  ? "bg-brand border-brand"
                                  : selectedChannels.length > 0
                                  ? "border-brand bg-transparent"
                                  : "border-[#536471]"
                              )}
                            >
                              {selectedChannels.length === channels.length ? (
                                <Check className="w-3 h-3 text-white" />
                              ) : selectedChannels.length > 0 ? (
                                <div className="w-2 h-0.5 bg-brand rounded" />
                              ) : null}
                            </div>
                          </button>
                          <div className="mx-4 my-1 border-t border-[#2F3336]" />
                        </>
                      )}
                      {channels.map((channel) => (
                        <button
                          key={channel.channelId}
                          onClick={() => toggleChannel(channel.channelId)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                        >
                          {/* Channel Logo */}
                          {channel.logo ? (
                            <img
                              src={channel.logo}
                              alt={channel.channelTitle}
                              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-[#2a2a35] flex items-center justify-center text-brand font-semibold flex-shrink-0">
                              {channel.channelTitle.charAt(0).toUpperCase()}
                            </div>
                          )}

                          {/* Channel Info */}
                          <div className="flex-1 text-left">
                            <p className="text-white text-sm font-medium">
                              {channel.channelTitle}
                            </p>
                            {channel.memberCount !== undefined && (
                              <p className="text-[#6E767D] text-xs">
                                {channel.memberCount} {channel.memberCount === 1 ? 'Member' : 'Members'}
                              </p>
                            )}
                          </div>

                          {/* Checkbox */}
                          <div
                            className={cn(
                              "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0",
                              selectedChannels.includes(channel.channelId)
                                ? "bg-brand border-brand"
                                : "border-[#536471]"
                            )}
                          >
                            {selectedChannels.includes(channel.channelId) && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>,
                  document.body
                )}
              </div>

              {/* Text input with highlighting */}
              <div className="relative min-h-[120px] max-h-[250px] md:max-h-[400px] lg:max-h-[600px] xl:max-h-[750px] overflow-hidden rounded-xl border border-[#2F3336]/40 p-2">
                {/* Highlighted overlay */}
                <div
                  ref={overlayRef}
                  className="absolute inset-0 pointer-events-none text-lg leading-relaxed whitespace-pre-wrap break-words overflow-hidden no-scrollbar p-2"
                >
                  {content ? (
                    renderHighlightedText()
                  ) : (
                    <span className="text-[#6E767D]">What's happening?</span>
                  )}
                </div>
                {/* Actual textarea */}
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => handleTextChange(e.target.value)}
                  onPaste={handlePaste}
                  onScroll={handleTextareaScroll}
                  className="w-full bg-transparent text-transparent caret-white text-lg leading-relaxed resize-none outline-none overflow-y-auto max-h-[230px] md:max-h-[380px] lg:max-h-[580px] xl:max-h-[730px] no-scrollbar [&::-webkit-scrollbar]:hidden p-0"
                  placeholder=""
                  style={{
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                  }}
                />

                {/* Mention dropdown */}
                {showMentionDropdown && filteredMembers.length > 0 && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMentionDropdown(false)}
                    />
                    <div className="absolute left-0 right-0 top-8 bg-[#16181C] border border-[#2F3336] rounded-xl shadow-xl z-20 py-2 max-h-[200px] overflow-y-auto">
                      {filteredMembers.map((member) => (
                        <button
                          key={member._id}
                          onClick={() => insertMention(member)}
                          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-colors"
                        >
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={member.profilePicture} />
                            <AvatarFallback className="bg-brand text-white text-xs">
                              {member.name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-left">
                            <div className="text-white text-sm font-medium">
                              {member.name}
                            </div>
                            <div className="text-[#6E767D] text-xs">
                              @{member.email?.split("@")[0]}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Hashtag dropdown */}
                {showHashtagDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowHashtagDropdown(false)}
                    />
                    <div className="absolute left-0 right-0 top-8 bg-[#16181C] border border-[#2F3336] rounded-xl shadow-xl z-20 py-2 max-h-[200px] overflow-y-auto">
                      {filteredTags.length > 0 ? (
                        filteredTags.map((tag, index) => (
                          <button
                            key={`${tag}-${index}`}
                            onClick={() => insertHashtag(tag)}
                            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-colors"
                          >
                            <div className="w-8 h-8 bg-brand/10 rounded-full flex items-center justify-center">
                              <Hash className="w-4 h-4 text-brand" />
                            </div>
                            <span className="text-white text-sm">{tag}</span>
                          </button>
                        ))
                      ) : hashtagQuery ? (
                        <button
                          onClick={() => insertHashtag(hashtagQuery)}
                          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-colors"
                        >
                          <div className="w-8 h-8 bg-brand/10 rounded-full flex items-center justify-center">
                            <Hash className="w-4 h-4 text-brand" />
                          </div>
                          <span className="text-white text-sm">{hashtagQuery}</span>
                          <span className="text-brand text-xs ml-auto">Create new</span>
                        </button>
                      ) : (
                        <div className="px-4 py-2 text-[#6E767D] text-sm">
                          Type to create or search hashtags
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Attachments preview - hidden when poll is active */}
              {attachments.length > 0 && !showPollCreator && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className={`relative group ${attachment.type === "audio" ? "col-span-2" : ""}`}
                    >
                      {attachment.type === "audio" ? (
                        // Audio attachment preview with playback
                        <div className="bg-[#1a1a22] rounded-xl p-4">
                          {attachment.url && !attachment.uploading ? (
                            <VoiceMessagePlayer src={attachment.url} isOwnMessage={true} />
                          ) : (
                            // Show loading state while uploading
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-brand/20 rounded-full flex items-center justify-center">
                                {attachment.uploading ? (
                                  <Loader2 className="w-6 h-6 text-brand animate-spin" />
                                ) : (
                                  <AudioLines className="w-6 h-6 text-brand" />
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm text-[#E8EAED] font-medium">
                                  {attachment.uploading ? "Uploading..." : "Voice Note"}
                                </span>
                                {attachment.duration && (
                                  <span className="text-xs text-[#6E767D]">
                                    {Math.floor(attachment.duration / 60)}:{(attachment.duration % 60).toString().padStart(2, "0")}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : attachment.type === "video" ? (
                        // Video attachment preview with interactive timeline scrubber and skip buttons (+5s/-5s)
                        <div className="aspect-video bg-[#1a1a22] rounded-xl overflow-hidden min-h-[220px]">
                          {attachment.url ? (
                            <CustomVideoPlayer
                              src={attachment.url}
                              autoPlay={false}
                              className="w-full h-full"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Video className="w-8 h-8 text-[#6E767D]" />
                            </div>
                          )}
                        </div>
                      ) : attachment.type === "document" ? (
                        // Document attachment preview (Production Grade)
                        <div className="aspect-video bg-[#1a1a22] border border-[#2a2a35] rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2">
                          <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                            <FileText className="w-6 h-6 text-green-400" />
                          </div>
                          <div className="w-full px-2">
                            <div className="text-xs font-semibold text-white truncate">
                              {attachment.name || "Document"}
                            </div>
                            <div className="text-[10px] text-[#9fa0b8] mt-0.5">
                              {attachment.name?.split('.').pop()?.toUpperCase() || "PDF"} Document
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Image/GIF/other attachment preview (No Crop)
                        <div className="aspect-video bg-[#1a1a22] rounded-xl overflow-hidden flex items-center justify-center">
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="max-w-full max-h-full object-contain"
                          />
                          {attachment.type === "gif" && (
                            <div className="absolute bottom-2 left-2 bg-black/70 px-1.5 py-0.5 rounded text-xs font-bold">
                              GIF
                            </div>
                          )}
                        </div>
                      )}
                      {attachment.uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                      )}
                      <button
                        onClick={() => removeAttachment(attachment.id)}
                        className="absolute top-2 right-2 p-1 bg-black/70 rounded-full hover:bg-black transition-colors"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Link Previews */}
              {linkPreviews.length > 0 && !showPollCreator && (
                <div className="mt-3 space-y-2">
                  {linkPreviews.map((preview, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-[#202327] rounded-xl border border-[#2F3336]"
                    >
                      <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <LinkIcon className="w-5 h-5 text-brand" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#E8EAED] truncate">
                          {preview.domain}
                        </p>
                        <p className="text-xs text-[#6E767D] truncate">
                          {preview.url}
                        </p>
                      </div>
                      <button
                        onClick={() => removeLinkPreview(preview.url)}
                        className="p-1 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                      >
                        <X className="w-4 h-4 text-[#6E767D]" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Poll Creator */}
              {showPollCreator && (
                <div className="mt-3">
                  <PollCreator
                    onPollChange={setPollData}
                    onRemove={() => {
                      setShowPollCreator(false);
                      setPollData(null);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reply permission */}
        <div className="px-4 py-3 border-t border-[#2F3336]">
          <button className="flex items-center gap-2 text-brand text-sm font-semibold hover:underline">
            <Globe className="w-4 h-4" />
            Everyone can reply
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#2F3336]">
          <div className="flex items-center gap-1">
            {/* 1. Emoji picker */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker);
                  setShowGifPicker(false);
                }}
                className="p-2 hover:bg-brand/10 rounded-full transition-colors"
              >
                <Smile className="w-5 h-5 text-brand" />
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

            {/* 2. Image upload */}
            <label className={cn(
              "p-2 hover:bg-brand/10 rounded-full cursor-pointer transition-colors",
              (isUploadingImages || showPollCreator) && "opacity-50 cursor-not-allowed"
            )}>
              {isUploadingImages ? (
                <Loader2 className="w-5 h-5 text-brand animate-spin" />
              ) : (
                <ImageIcon className="w-5 h-5 text-brand" />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                disabled={isUploadingImages || showPollCreator}
              />
            </label>

            {/* 3. GIF picker */}
            <div className="relative">
              <button
                onClick={() => {
                  if (!showPollCreator) {
                    setShowGifPicker(!showGifPicker);
                    setShowEmojiPicker(false);
                  }
                }}
                disabled={showPollCreator}
                className={cn(
                  "p-2 hover:bg-brand/10 rounded-full transition-colors text-brand",
                  showPollCreator && "opacity-50 cursor-not-allowed"
                )}
              >
                <GifIcon />
              </button>

              {showGifPicker && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowGifPicker(false)}
                  />
                  <div className="absolute bottom-full left-0 mb-2 w-[320px] bg-[#16181C] border border-[#2F3336] rounded-xl shadow-xl z-20 overflow-hidden">
                    <div className="p-3 border-b border-[#2F3336]">
                      <input
                        type="text"
                        value={gifSearch}
                        onChange={(e) => setGifSearch(e.target.value)}
                        placeholder="Search GIFs..."
                        className="w-full bg-[#202327] text-white px-3 py-2 rounded-full text-sm outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                    <div className="h-[300px] overflow-y-auto p-2">
                      {loadingGifs ? (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="w-6 h-6 text-brand animate-spin" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {gifs.map((gif) => (
                            <button
                              key={gif.id}
                              onClick={() => addGif(gif)}
                              className="aspect-video bg-[#202327] rounded-lg overflow-hidden hover:ring-2 hover:ring-brand transition-all"
                            >
                              <img
                                src={gif.preview}
                                alt={gif.title}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="p-2 border-t border-[#2F3336] text-center">
                      <span className="text-[#6E767D] text-xs">
                        Powered by GIPHY
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 4. Video upload */}
            <label className={cn(
              "p-2 hover:bg-brand/10 rounded-full cursor-pointer transition-colors",
              (isUploadingVideos || showPollCreator) && "opacity-50 cursor-not-allowed"
            )}>
              {isUploadingVideos ? (
                <Loader2 className="w-5 h-5 text-brand animate-spin" />
              ) : (
                <Video className="w-5 h-5 text-brand" />
              )}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                multiple
                onChange={handleVideoUpload}
                className="hidden"
                disabled={isUploadingVideos || showPollCreator}
              />
            </label>

            {/* 5. Screen recording */}
            {!showPollCreator && (
              <div className={cn(
                "flex items-center",
                isUploadingScreenRecording && "opacity-50"
              )}>
                <ScreenRecorder
                  onRecordingComplete={handleScreenRecordingComplete}
                  onSend={handleScreenRecordingComplete}
                  target={{
                    type: "post",
                    id: postComposerId,
                    name: "New Post",
                  }}
                  className="text-brand hover:bg-brand/10"
                />
              </div>
            )}

            {/* 7. Attachment (file) upload */}
            <label className={cn(
              "p-2 hover:bg-brand/10 rounded-full cursor-pointer transition-colors",
              (isUploadingDocuments || showPollCreator) && "opacity-50 cursor-not-allowed"
            )}>
              {isUploadingDocuments ? (
                <Loader2 className="w-5 h-5 text-brand animate-spin" />
              ) : (
                <Paperclip className="w-5 h-5 text-brand" />
              )}
              <input
                ref={documentInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                multiple
                onChange={handleDocumentUpload}
                className="hidden"
                disabled={isUploadingDocuments || showPollCreator}
              />
            </label>

            {/* 8. Audio / Recording */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={showPollCreator}
              className={cn(
                "p-2 rounded-full transition-colors",
                isRecording
                  ? "bg-red-500/20 hover:bg-red-500/30"
                  : "hover:bg-brand/10",
                showPollCreator && "opacity-50 cursor-not-allowed"
              )}
            >
              {isRecording ? (
                <Square className="w-5 h-5 text-red-500" />
              ) : (
                <Mic className="w-5 h-5 text-brand" />
              )}
            </button>

            {/* 9. Poll button */}
            <button
              onClick={() => {
                setShowPollCreator(!showPollCreator);
                if (!showPollCreator) {
                  // Clear attachments when enabling poll
                  setAttachments([]);
                } else {
                  setPollData(null);
                }
              }}
              disabled={attachments.length > 0 && !showPollCreator}
              className={cn(
                "p-2 rounded-full transition-colors",
                showPollCreator
                  ? "bg-brand/20 text-brand"
                  : "hover:bg-brand/10 text-brand",
                attachments.length > 0 && !showPollCreator && "opacity-50 cursor-not-allowed"
              )}
            >
              <BarChart3 className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Character counter */}
            {content.length > 0 && (
              <div className={`text-right text-xs pr-1 ${
                content.length > POST_CHAR_LIMIT * 0.9
                  ? content.length >= POST_CHAR_LIMIT
                    ? 'text-red-500 font-semibold'
                    : 'text-yellow-400'
                  : 'text-[#6E767D]'
              }`}>
                {content.length}/{POST_CHAR_LIMIT}
              </div>
            )}

            {/* Recording indicator */}
            {isRecording && (
              <div className="flex items-center gap-2 text-red-500">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">{formatDuration(recordingDuration)}</span>
              </div>
            )}

            {/* Post/Update button */}
            <Button
              onClick={handleSubmit}
              disabled={!canPost}
              className={cn(
                "px-4 py-2 rounded-full font-bold transition-colors",
                canPost
                  ? "bg-brand hover:opacity-90 text-brand-foreground"
                  : "bg-brand/50 text-white/50 cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isEditMode ? (
                "Update"
              ) : (
                "Post"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

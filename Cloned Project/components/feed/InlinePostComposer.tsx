"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
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
  ExternalLink,
  ImageOff,
  FileText,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createPost, createPollPost, updatePost, PostAttachment, uploadFile, Post, LinkPreviewData } from "@/lib/feed-api";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { PollCreator } from "./PollCreator";
import { useUploadThing } from "@/lib/uploadthing";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { toast } from "sonner";
import { GifPickerModal } from "./GifPickerModal";
import { ScreenRecorder } from "@/components/ui/screen-recorder";
import { useScreenRecording } from "@/lib/screen-recording-context";
import { VoiceMessagePlayer } from "@/components/ui/voice-message-player";
import { ArticleEditor } from "./ArticleEditor";
import CustomVideoPlayer from "@/components/dashboard/CustomVideoPlayer";

// URL regex for detecting links
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

// Hashtag regex for extracting tags from content
const HASHTAG_REGEX = /#(\w+)/g;

// Extract URLs from text, cleaning any HTML tags that may have leaked in
const extractUrls = (text: string): string[] => {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  // Clean each match: strip HTML tags/entities that may have leaked into the URL
  const cleaned = matches.map((url) => {
    // Strip HTML tags
    let clean = url.replace(/<[^>]*>/g, "");
    // Remove trailing quotes/angle brackets
    clean = clean.replace(/[>"']+$/, "");
    // Extract only the first valid URL (handles duplication from tag stripping)
    const urlMatch = clean.match(/^(https?:\/\/[^\s"'<>]+)/i);
    return urlMatch ? urlMatch[1] : clean;
  });
  return [...new Set(cleaned)];
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

// Clean a URL that may have HTML tags leaked into it
const cleanUrl = (url: string): string => {
  // Strip HTML tags
  let clean = url.replace(/<[^>]*>/g, "");
  // Remove trailing quotes/angle brackets
  clean = clean.replace(/[>"']+$/, "");
  // Extract only the first valid URL
  const urlMatch = clean.match(/^(https?:\/\/[^\s"'<>]+)/i);
  return urlMatch ? urlMatch[1] : clean.trim();
};

// Link preview metadata type
interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  siteName?: string;
}

// Link preview interface with rich metadata
interface LinkPreview {
  url: string;
  domain: string;
  metadata?: LinkMetadata | null;
  isLoading?: boolean;
  showThumbnail?: boolean;
}

// Empty array constant to prevent new reference on each render
const EMPTY_TEAM_MEMBERS: TeamMember[] = [];

// GIF icon component - Twitter-style text badge
const GifIcon = () => (
  <div className="flex items-center justify-center w-5 h-5 border border-current rounded text-[10px] font-bold leading-none">
    GIF
  </div>
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
  width?: number;
  height?: number;
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

interface InlinePostComposerProps {
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
  editPost?: Post | null; // Post to edit (if provided, component is in edit mode)
  onCancel?: () => void; // Called when edit is cancelled
  renderAsPage?: boolean; // When true, renders as full-page content (no fixed positioning, parent handles viewport)
  isMuted?: boolean; // When true, user is muted in all channels — show locked state
  alwaysExpanded?: boolean; // When true, composer starts in expanded state and skips collapse logic
  isFloatingPopover?: boolean; // When true, hides avatar/audience selection and shows custom styling/labels
  initialSelectedChannels?: string[]; // Channels to pre-select on load
}

export function InlinePostComposer({
  channels,
  orgId,
  user,
  onPostCreated,
  teamMembers,
  existingTags = [],
  editPost = null,
  onCancel,
  renderAsPage = false,
  isMuted = false,
  alwaysExpanded = false,
  isFloatingPopover = false,
  initialSelectedChannels = [],
}: InlinePostComposerProps) {
  const isEditMode = !!editPost;
  const isPageMode = renderAsPage && !isEditMode;
  // Use stable empty array reference if teamMembers is undefined
  const stableTeamMembers = teamMembers ?? EMPTY_TEAM_MEMBERS;

  // Check if there's an active screen recording for this post
  const { state: screenRecordingState } = useScreenRecording();
  const isRecordingForThisPost =
    screenRecordingState.isRecording &&
    screenRecordingState.target?.type === "post" &&
    screenRecordingState.target?.id === "inline-post-composer";
  const hasQueuedRecordingForThisPost =
    !screenRecordingState.isRecording &&
    screenRecordingState.videoBlob !== null &&
    screenRecordingState.target?.type === "post" &&
    screenRecordingState.target?.id === "inline-post-composer";

  const [isExpanded, setIsExpanded] = useState(isEditMode || renderAsPage || alwaysExpanded);
  const isCreateModeExpanded = isExpanded && !isEditMode;

  // Auto-expand when recording or has queued recording for this post
  useEffect(() => {
    if (isRecordingForThisPost || hasQueuedRecordingForThisPost || alwaysExpanded) {
      setIsExpanded(true);
    }
  }, [isRecordingForThisPost, hasQueuedRecordingForThisPost, alwaysExpanded]);

  // Prevent background scrolling when mobile fullscreen composer is open.
  useEffect(() => {
    if (renderAsPage) return; // Parent wrapper handles scroll lock
    if (typeof window === "undefined") return;
    if (!isCreateModeExpanded) return;
    if (!window.matchMedia("(max-width: 639px)").matches) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isCreateModeExpanded, renderAsPage]);

  // Adjust container height when mobile keyboard opens (iOS Safari)
  useEffect(() => {
    if (renderAsPage) return; // Parent wrapper handles viewport adjustment
    if (!isCreateModeExpanded) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const initialHeight = vv.height;

    function onViewportChange() {
      if (!containerRef.current) return;
      const el = containerRef.current;
      const keyboardOpen = vv!.height < initialHeight - 50;
      if (keyboardOpen) {
        el.style.height = `${vv!.height}px`;
        el.style.top = `${vv!.offsetTop}px`;
      } else {
        el.style.height = "";
        el.style.top = "";
      }
    }

    vv.addEventListener("resize", onViewportChange);
    vv.addEventListener("scroll", onViewportChange);
    return () => {
      vv.removeEventListener("resize", onViewportChange);
      vv.removeEventListener("scroll", onViewportChange);
      if (containerRef.current) {
        containerRef.current.style.height = "";
        containerRef.current.style.top = "";
      }
    };
  }, [isCreateModeExpanded, renderAsPage]);

  // Notify dashboard layout to hide/show mobile sticky footer while composer is open.
  useEffect(() => {
    if (renderAsPage) return; // Parent wrapper handles this
    if (typeof window === "undefined") return;

    const isMobile = window.matchMedia("(max-width: 639px)").matches;
    const isVisible = isMobile && isCreateModeExpanded;

    window.dispatchEvent(
      new CustomEvent("feed:mobile-composer-visibility", {
        detail: { visible: isVisible },
      })
    );

    return () => {
      if (isVisible) {
        window.dispatchEvent(
          new CustomEvent("feed:mobile-composer-visibility", {
            detail: { visible: false },
          })
        );
      }
    };
  }, [isCreateModeExpanded, renderAsPage]);

  // Helper to detect audio files by URL extension or name
  const isAudioFile = (att: { url: string; name: string }) => {
    const audioExtensions = ['.webm', '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
    const url = att.url.toLowerCase();
    const name = att.name.toLowerCase();
    return audioExtensions.some(ext => url.includes(ext)) ||
           name.startsWith('voice_note') ||
           name === 'voice note';
  };

  // Auto-expand and pre-populate when in edit mode
  useEffect(() => {
    if (isEditMode && editPost) {
      setIsExpanded(true);
      setContent(editPost.content || "");
      // Set selected channels from the post
      const channelIds = editPost.channelIds?.map(ch => ch._id) || [];
      setSelectedChannels(channelIds);
      // Convert existing attachments to local format
      if (editPost.attachments && editPost.attachments.length > 0) {
        const existingAttachments: Attachment[] = editPost.attachments.map((att, idx) => {
          // Detect audio files stored as 'document' type
          let type = att.type as Attachment["type"];
          if (att.type === 'document' && isAudioFile(att)) {
            type = 'audio';
          }
          return {
            id: `existing-${idx}`,
            type,
            url: att.url,
            name: att.name || "Attachment",
          };
        });
        setAttachments(existingAttachments);
      }
      // Convert existing link previews to local format
      if (editPost.linkPreviews && editPost.linkPreviews.length > 0) {
        const existingPreviews: LinkPreview[] = editPost.linkPreviews.map((preview) => ({
          url: preview.url,
          domain: getDomainFromUrl(preview.url),
          metadata: {
            title: preview.title,
            description: preview.description,
            image: preview.image,
            siteName: preview.siteName,
          },
          isLoading: false,
          showThumbnail: preview.showThumbnail !== false,
        }));
        setLinkPreviews(existingPreviews);
      } else if (editPost.linkPreviews !== undefined) {
        // linkPreviews is explicitly empty - user removed all previews
        setLinkPreviews([]);
      }
      // If linkPreviews is undefined, let the URL detection handle it (for old posts)
      // Pre-populate article fields
      if (editPost.postType === 'article') {
        setPostType('article');
        setArticleTitle(editPost.title || '');
        setCoverImage(editPost.coverImage || null);
      }
    }
  }, [isEditMode, editPost]);

  const [content, setContent] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(() => {
    if (editPost) {
      return editPost.channelIds?.map(ch => ch._id) || [];
    }
    return initialSelectedChannels ?? [];
  });

  useEffect(() => {
    if (initialSelectedChannels && !isEditMode) {
      setSelectedChannels(initialSelectedChannels);
    }
  }, [initialSelectedChannels, isEditMode]);
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isUploadingScreenRecording, setIsUploadingScreenRecording] = useState(false);

  // Fixed ID for post composer (used as screen recording target)
  // Using a constant ID so recordings persist across remounts
  const postComposerId = "inline-post-composer";

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Poll state
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollData, setPollData] = useState<{
    question: string;
    options: string[];
    durationHours: number;
    isMultipleChoice: boolean;
  } | null>(null);

  // Article state
  const [postType, setPostType] = useState<'post' | 'article'>('post');
  const [articleTitle, setArticleTitle] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Auto-resize textarea based on content
  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set the height to scrollHeight, CSS max-height will cap it
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  // Callback ref: the textarea unmounts whenever the composer switches to
  // Article (or the poll creator). Resizing here — instead of only in an
  // effect keyed on `content` — restores the grown height the moment it
  // remounts, so toggling Post → Article → Post keeps the container sized
  // to the content instead of snapping back to the default height.
  const attachTextarea = useCallback((node: HTMLTextAreaElement | null) => {
    textareaRef.current = node;
    if (node) resizeTextarea();
  }, [resizeTextarea]);

  useEffect(() => {
    resizeTextarea();
  }, [content, postType, resizeTextarea]);

  // Handle textarea scroll (no longer needed for sync, but kept for potential future use)
  const handleTextareaScroll = useCallback(() => {
    // Scroll handling logic can be added here if needed
  }, []);

  // Click outside to collapse (only if empty)
  useEffect(() => {
    if (renderAsPage) return; // Page mode doesn't collapse on click outside
    const handleClickOutside = (event: MouseEvent) => {
      // Don't collapse if channel dropdown is open (it's rendered in a portal)
      if (showChannelDropdown) return;

      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        !content.trim() &&
        attachments.length === 0 &&
        !isRecording
      ) {
        setIsExpanded(false);
        setShowChannelDropdown(false);
        setShowEmojiPicker(false);
        setShowGifPicker(false);
        setShowMentionDropdown(false);
        setShowHashtagDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [content, attachments.length, isRecording, showChannelDropdown, renderAsPage]);

  // Fetch link metadata from backend (or YouTube oEmbed for YT links)
  const fetchLinkMetadata = useCallback(async (url: string): Promise<LinkMetadata | null> => {
    try {
      // YouTube-specific: use the public oEmbed API directly from the client.
      // YouTube blocks datacenter IPs (Vercel/AWS) from scraping metadata,
      // so the backend /link-preview returns generic data in production.
      // The oEmbed API is a public endpoint designed for this purpose.
      const ytMatch = url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/
      );
      if (ytMatch) {
        const videoId = ytMatch[1];
        try {
          const oembedRes = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
          );
          if (oembedRes.ok) {
            const data = await oembedRes.json();
            return {
              title: data.title || "YouTube Video",
              description: data.author_name ? `by ${data.author_name}` : undefined,
              image: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
              siteName: "YouTube",
            };
          }
        } catch {
          // oEmbed failed — fall back to thumbnail-only
          return {
            title: "YouTube Video",
            image: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            siteName: "YouTube",
          };
        }
      }

      const token = getToken();
      if (!token) return null;

      const res = await api<{
        success?: boolean;
        ok?: boolean;
        meta?: { title?: string; description?: string; thumbnail?: string; image?: string; author?: string; provider?: string; siteName?: string };
        metadata?: { title?: string; description?: string; image?: string; siteName?: string };
      }>(
        `/link-preview?url=${encodeURIComponent(url)}`,
        { method: "GET" },
        token
      );

      // The backend has returned both shapes over time: { ok, meta } and { success, metadata }.
      // Accept either so a successful fetch is never discarded.
      if (res.metadata) {
        return {
          title: res.metadata.title || undefined,
          description: res.metadata.description || undefined,
          image: res.metadata.image || undefined,
          siteName: res.metadata.siteName || undefined,
        };
      }
      if (res.meta) {
        return {
          title: res.meta.title || undefined,
          description: res.meta.description || undefined,
          image: res.meta.thumbnail || res.meta.image || undefined,
          siteName: res.meta.siteName || res.meta.author || res.meta.provider || undefined,
        };
      }
      return null;
    } catch (err) {
      console.error("Error fetching link metadata:", err);
      return null;
    }
  }, []);

  // Detect URLs in content and update link previews with metadata
  useEffect(() => {
    const urls = extractUrls(content);

    // Get current URLs for comparison
    const currentUrls = new Set(linkPreviews.map((p) => p.url));
    const newUrls = new Set(urls);

    // Find URLs that need to be added
    const urlsToAdd = urls.filter((url) => !currentUrls.has(url));

    // Find URLs that need to be removed
    const urlsToRemove = linkPreviews.filter((p) => !newUrls.has(p.url));

    if (urlsToAdd.length === 0 && urlsToRemove.length === 0) {
      return;
    }

    // Remove old URLs first
    if (urlsToRemove.length > 0) {
      setLinkPreviews((prev) => prev.filter((p) => newUrls.has(p.url)));
    }

    // Add new URLs with loading state and fetch metadata
    if (urlsToAdd.length > 0) {
      // Add previews with loading state
      setLinkPreviews((prev) => [
        ...prev,
        ...urlsToAdd.map((url) => ({
          url,
          domain: getDomainFromUrl(url),
          isLoading: true,
          showThumbnail: true,
        })),
      ]);

      // Fetch metadata for each new URL
      urlsToAdd.forEach(async (url) => {
        const metadata = await fetchLinkMetadata(url);
        setLinkPreviews((prev) =>
          prev.map((p) =>
            p.url === url
              ? { ...p, metadata, isLoading: false }
              : p
          )
        );
      });
    }
  }, [content, fetchLinkMetadata]);

  // Remove link preview
  const removeLinkPreview = useCallback((url: string) => {
    setLinkPreviews((prev) => prev.filter((p) => p.url !== url));
  }, []);

  // Toggle thumbnail visibility for a link preview
  const toggleLinkThumbnail = useCallback((url: string) => {
    setLinkPreviews((prev) =>
      prev.map((p) =>
        p.url === url ? { ...p, showThumbnail: !p.showThumbnail } : p
      )
    );
  }, []);

  // Handle text change with mention and hashtag detection
  const POST_CHAR_LIMIT = 3000;

  const handleTextChange = (text: string) => {
    // Enforce character limit for regular posts
    if (postType !== 'article' && text.length > POST_CHAR_LIMIT) return;
    setContent(text);

    const lastAtIndex = text.lastIndexOf("@");
    const lastHashIndex = text.lastIndexOf("#");

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

  // Restore pending screen recording from localStorage on mount
  // Only restore if the context doesn't already have the recording (e.g., after page refresh)
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    // Skip if already restored or if there's already a queued recording in context
    if (hasRestoredRef.current) return;

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
  }, [handleScreenRecordingComplete]);

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
        // Convert link previews to LinkPreviewData format for update
        // Use null instead of undefined for image when thumbnail is hidden (undefined gets stripped by JSON.stringify)
        // Keep previews whose metadata is missing or still loading — the feed card falls back to the
        // hostname, so dropping them here is what made previews silently disappear from the post.
        const postLinkPreviews = linkPreviews
          .map((p) => ({
            url: cleanUrl(p.url),
            title: p.metadata?.title,
            description: p.metadata?.description,
            image: p.showThumbnail ? p.metadata?.image : null,
            siteName: p.metadata?.siteName,
            showThumbnail: p.showThumbnail,
          }));

        // Update existing post
        await updatePost(editPost._id, {
          content: content.trim(),
          channelIds: selectedChannels,
          tags: extractedTags.length > 0 ? extractedTags : undefined,
          linkPreviews: postLinkPreviews,
          // Article fields - always pass when editing an article
          ...(editPost.postType === 'article' ? {
            title: articleTitle.trim(),
            coverImage: coverImage || '', // empty string clears it
          } : {}),
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
        // Map 'gif' to 'image' for backend compatibility (audio is now supported natively)
        const postAttachments: PostAttachment[] = attachments
          .filter((a) => !a.uploading)
          .map((a) => ({
            type: a.type === "gif" ? "image" : a.type,
            url: a.url,
            name: a.name,
            fileKey: a.fileKey,
          }));

        // Convert link previews to LinkPreviewData format
        // Always include linkPreviews array (even if empty) to indicate user's choice
        // Use null instead of undefined for image when thumbnail is hidden (undefined gets stripped by JSON.stringify)
        // Keep previews whose metadata is missing or still loading — the feed card falls back to the
        // hostname, so dropping them here is what made previews silently disappear from the post.
        const postLinkPreviews = linkPreviews
          .map((p) => ({
            url: cleanUrl(p.url),
            title: p.metadata?.title,
            description: p.metadata?.description,
            image: p.showThumbnail ? p.metadata?.image : null,
            siteName: p.metadata?.siteName,
            showThumbnail: p.showThumbnail,
          }));

        await createPost({
          orgId,
          content: content.trim(),
          channelIds: selectedChannels,
          tags: extractedTags.length > 0 ? extractedTags : undefined,
          attachments: postAttachments,
          // Always pass linkPreviews array - empty array means user chose not to include previews
          linkPreviews: postLinkPreviews,
          // Article fields
          ...(postType === 'article' ? {
            postType: 'article' as const,
            title: articleTitle.trim(),
            coverImage: coverImage || undefined,
          } : {}),
        });
        toast.success(postType === 'article' ? "Article published successfully!" : "Post created successfully!");
      }

      // Reset form
      setContent("");
      setSelectedChannels([]);
      setAttachments([]);
      setLinkPreviews([]);
      setShowPollCreator(false);
      setPollData(null);
      setPostType('post');
      setArticleTitle('');

      setCoverImage(null);
      setIsExpanded(false);

      onPostCreated();
    } catch (error) {
      console.error(isEditMode ? "Failed to update post:" : "Failed to create post:", error);
      toast.error(isEditMode ? "Failed to update post" : showPollCreator ? "Failed to create poll" : "Failed to create post");
    } finally {
      setIsSubmitting(false);
    }
  };


  const hasUploadingAttachments = attachments.some((a) => a.uploading) || isUploadingImages;
  const canPost = showPollCreator
    ? // For polls: need valid poll data and at least one channel
      pollData !== null &&
      selectedChannels.length > 0 &&
      !isSubmitting
    : postType === 'article'
    ? // For articles: need title, content, and at least one channel
      articleTitle.trim() &&
      content.trim() &&
      selectedChannels.length > 0 &&
      !hasUploadingAttachments &&
      !isSubmitting &&
      !isRecording &&
      !isUploadingCover
    : // For regular posts: need content, at least one channel, and within char limit
      content.trim() &&
      content.length <= POST_CHAR_LIMIT &&
      selectedChannels.length > 0 &&
      !hasUploadingAttachments &&
      !isSubmitting &&
      !isRecording;

  // Why the Post/Publish button is disabled. The button greys out on seven
  // different conditions with no feedback, so users (especially on articles,
  // where the borderless title input is easy to miss) could not tell what was
  // blocking them. Shown next to the button and as its tooltip.
  const blockedReason: string | null = (() => {
    if (canPost || isSubmitting) return null;
    if (isRecording) return "Stop the recording first";
    if (hasUploadingAttachments) return "Wait for the upload to finish";
    if (showPollCreator) {
      if (pollData === null) return "Finish setting up the poll";
      if (selectedChannels.length === 0)
        return channels.length === 0
          ? "You have no community to post in"
          : "Select a community to post in";
      return null;
    }
    if (postType === "article") {
      if (isUploadingCover) return "Wait for the cover image to finish uploading";
      if (!articleTitle.trim()) return "Add a title for your article";
      if (!content.trim()) return "Write your article before publishing";
    } else {
      if (!content.trim()) return "Write something to post";
      if (content.length > POST_CHAR_LIMIT)
        return `Post is over the ${POST_CHAR_LIMIT} character limit`;
    }
    if (selectedChannels.length === 0)
      return channels.length === 0
        ? "You have no community to post in"
        : "Select a community to post in";
    return null;
  })();

  const closeComposer = (clearDraft = false) => {
    if (clearDraft) {
      setContent("");
      setSelectedChannels([]);
      setAttachments([]);
      setLinkPreviews([]);
      setShowPollCreator(false);
      setPollData(null);
      // Reset article state
      setPostType('post');
      setArticleTitle('');

      setCoverImage(null);
    }
    setIsExpanded(false);
    setShowChannelDropdown(false);
    setShowEmojiPicker(false);
    setShowGifPicker(false);
    setShowMentionDropdown(false);
    setShowHashtagDropdown(false);
    if (renderAsPage || alwaysExpanded) {
      onCancel?.();
    }
  };

  // Muted state — show locked composer instead of interactive one
  if (isMuted && !isEditMode && !renderAsPage) {
    return (
      <div
        ref={containerRef}
        className="bg-transparent p-5 opacity-60 cursor-not-allowed"
      >
        <div className="flex gap-3 items-center">
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarImage src={user.profilePicture} />
            <AvatarFallback className="bg-brand text-white">
              {user.name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#6E767D] flex-shrink-0"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span className="text-[#6E767D] text-sm">You don&apos;t have posting permissions in this community</span>
          </div>
        </div>
      </div>
    );
  }

  // Collapsed state - simple input-like box (skip if in edit mode, page mode, or alwaysExpanded)
  if (!isExpanded && !isEditMode && !renderAsPage && !alwaysExpanded) {
    return (
      <div
        ref={containerRef}
        onClick={() => {
          setIsExpanded(true);
          setTimeout(() => textareaRef.current?.focus(), 100);
        }}
        className="bg-transparent p-5 cursor-text transition-colors"
      >
        <div className="flex gap-3">
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarImage src={user.profilePicture} />
            <AvatarFallback className="bg-brand text-white">
              {user.name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 pt-2">
            <span className="text-[#6E767D] text-lg">What&apos;s happening?</span>
          </div>
        </div>
      </div>
    );
  }

  // Expanded state - full composer
  return (
    <div
      ref={containerRef}
      className={cn(
        "bg-transparent sm:bg-transparent bg-[#16181C]",
        !isEditMode && !isCreateModeExpanded && !isPageMode && "rounded-none p-5",
        isPageMode && "flex flex-col h-full overflow-clip rounded-none border-0",
        isCreateModeExpanded && !isPageMode && (
          isFloatingPopover
            ? "flex flex-col flex-1 min-h-0 overflow-hidden border-0 p-4 sm:p-5"
            : "fixed top-0 left-0 right-0 bottom-0 z-[100] h-[100dvh] flex flex-col overflow-clip rounded-none border-0 sm:relative sm:inset-auto sm:z-auto sm:h-auto sm:overflow-hidden sm:block sm:rounded-none sm:border-0 sm:p-5"
        )
      )}
    >
      {(isCreateModeExpanded || isPageMode) && (
        <div className={cn("h-14 px-4 border-b border-[#2F3336] flex items-center justify-between", !isPageMode && "sm:hidden")}>
          <button
            onClick={() => closeComposer(true)}
            className="text-base text-white/90 hover:text-white"
          >
            Cancel
          </button>
          {blockedReason && (
            <span className="flex-1 px-3 text-center text-xs text-[#6E767D] truncate">
              {blockedReason}
            </span>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!canPost}
            title={blockedReason ?? undefined}
            className={cn(
              "h-9 px-4 rounded-full font-bold transition-colors text-sm",
              canPost
                ? "bg-brand hover:opacity-90 text-brand-foreground"
                : "bg-brand/50 text-brand-foreground/50 cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isFloatingPopover ? (
              "Publish"
            ) : (
              "Post"
            )}
          </Button>
        </div>
      )}

      {/* Content */}
      <div className={cn("px-4 pt-4 pb-3 no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", (isCreateModeExpanded || isPageMode) && "flex-1 overflow-y-auto")}>
        <div className="flex gap-3">
          {/* Avatar */}
          {!isFloatingPopover && (
            <Avatar className="w-10 h-10 flex-shrink-0">
              <AvatarImage src={user.profilePicture} />
              <AvatarFallback className="bg-brand text-white">
                {user.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}

          {/* Main content area */}
          <div className="flex-1 min-w-0">
            {/* Audience selector - hidden in edit mode or floating popover */}
            {!isEditMode && !isFloatingPopover && (
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
                    {channels.length === 0 && (
                      <div className="px-4 py-3 text-sm text-[#6E767D]">
                        No community available to post in. Join a community, or
                        ask an admin if you have been muted.
                      </div>
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
            )}

            {/* Post / Article Toggle */}
            {!isEditMode && !showPollCreator && (
              <div className={cn(
                "mb-3 flex items-center gap-1 p-0.5 rounded-full w-fit",
                isFloatingPopover
                  ? "border border-white/20 bg-transparent"
                  : "bg-[#1E2025]"
              )}>
                <button
                  type="button"
                  onClick={() => {
                    // When switching from article → post, strip HTML from content
                    // so the plain textarea doesn't show raw Tiptap HTML tags
                    if (postType === 'article' && content) {
                      const plainText = content
                        .replace(/<br\s*\/?>/gi, '\n')
                        .replace(/<\/p>/gi, '\n')
                        .replace(/<\/h[1-6]>/gi, '\n')
                        .replace(/<\/li>/gi, '\n')
                        .replace(/<\/blockquote>/gi, '\n')
                        .replace(/<[^>]*>/g, '')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                        .replace(/\n{3,}/g, '\n\n')
                        .trim();
                      setContent(plainText);
                    }
                    setPostType('post');
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                    postType === 'post'
                      ? "bg-brand text-brand-foreground shadow-sm"
                      : "text-[#6E767D] hover:text-white"
                  )}
                >
                  {!isFloatingPopover && <Type className="w-3.5 h-3.5" />}
                  Post
                </button>
                <button
                  type="button"
                  onClick={() => setPostType('article')}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                    postType === 'article'
                      ? "bg-brand text-brand-foreground shadow-sm"
                      : "text-[#6E767D] hover:text-white"
                  )}
                >
                  {!isFloatingPopover && <FileText className="w-3.5 h-3.5" />}
                  {isFloatingPopover ? "Articles" : "Article"}
                </button>
              </div>
            )}

            {/* Article-specific fields */}
            {postType === 'article' && (
              <div className="mb-3 space-y-3">
                {/* Title Input */}
                <input
                  type="text"
                  value={articleTitle}
                  onChange={(e) => setArticleTitle(e.target.value)}
                  placeholder="Article title..."
                  maxLength={200}
                  className="w-full bg-transparent text-white text-2xl font-bold leading-tight outline-none placeholder:text-[#3A3D42] border-none"
                />

                {/* Cover Image Upload */}
                <div className="relative">
                  {coverImage ? (
                    <div className="relative rounded-xl overflow-hidden group">
                      <img
                        src={coverImage}
                        alt="Cover"
                        className="w-full h-[180px] sm:h-[220px] object-cover rounded-xl"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-3">
                        <button
                          type="button"
                          onClick={() => setCoverImage(null)}
                          className="p-2 bg-red-500/80 rounded-full text-white hover:bg-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 w-full h-[120px] border-2 border-dashed border-[#2F3336] rounded-xl cursor-pointer hover:border-brand/40 hover:bg-brand/5 transition-all group">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setIsUploadingCover(true);
                          try {
                            const result = await startImageUpload([file]);
                            if (result && result[0]) {
                              setCoverImage(result[0].url);
                            }
                          } catch (err) {
                            console.error("Cover upload failed:", err);
                            toast.error("Failed to upload cover image");
                          } finally {
                            setIsUploadingCover(false);
                          }
                        }}
                      />
                      {isUploadingCover ? (
                        <Loader2 className="w-5 h-5 text-brand animate-spin" />
                      ) : (
                        <>
                          <ImageIcon className="w-5 h-5 text-[#6E767D] group-hover:text-brand transition-colors" />
                          <span className="text-sm text-[#6E767D] group-hover:text-brand transition-colors">Add cover image</span>
                        </>
                      )}
                    </label>
                  )}
                </div>

                <div className="border-t border-[#2F3336]" />
              </div>
            )}

            {/* Text input — Article uses Tiptap WYSIWYG editor, Posts use plain textarea */}
            <div className={postType === 'article' ? "" : "relative min-h-[80px]"}>
              {postType === 'article' ? (
                /* Medium-style rich text editor for articles */
                <ArticleEditor
                  initialContent={content}
                  onChange={(html) => setContent(html)}
                  placeholder="Write your article..."
                />
              ) : (
                /* Plain textarea for regular posts */
                <textarea
                  ref={attachTextarea}
                  value={content}
                  onChange={(e) => handleTextChange(e.target.value)}
                  onPaste={handlePaste}
                  onScroll={handleTextareaScroll}
                  className="w-full bg-transparent text-white text-lg leading-relaxed resize-none outline-none overflow-y-auto relative z-10 placeholder:text-[#6E767D] min-h-[80px] max-h-[200px] sm:max-h-[300px] md:max-h-[400px] lg:max-h-[500px] xl:max-h-[600px] no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  placeholder={isFloatingPopover ? "What's Happening ?" : "What's happening?"}
                  style={{
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    WebkitTextFillColor: 'white',
                    color: 'white'
                  }}
                />
              )}

              {/* Character counter for regular posts */}
              {postType !== 'article' && content.length > 0 && (
                <div className={`text-right text-xs mt-1 pr-1 ${
                  content.length > POST_CHAR_LIMIT * 0.9
                    ? content.length >= POST_CHAR_LIMIT
                      ? 'text-red-500 font-semibold'
                      : 'text-yellow-400'
                    : 'text-[#6E767D]'
                }`}>
                  {content.length}/{POST_CHAR_LIMIT}
                </div>
              )}

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

            {/* Attachments preview */}
            {attachments.length > 0 && !showPollCreator && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className={`relative group ${attachment.type === "audio" ? "col-span-2" : ""}`}
                  >
                    {attachment.type === "audio" ? (
                      <div className="bg-[#1a1a22] rounded-xl p-4">
                        {attachment.url && !attachment.uploading ? (
                          <VoiceMessagePlayer src={attachment.url} isOwnMessage={true} />
                        ) : (
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
                    className="relative rounded-xl border border-[#2F3336] overflow-hidden bg-[#15151b]"
                  >
                    {/* Loading state */}
                    {preview.isLoading && (
                      <div className="flex items-center gap-3 p-3">
                        <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Loader2 className="w-5 h-5 text-brand animate-spin" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#9fa0b8]">Loading preview...</p>
                          <p className="text-xs text-[#6E767D] truncate">{preview.url}</p>
                        </div>
                      </div>
                    )}

                    {/* Rich preview with metadata */}
                    {!preview.isLoading && (
                      <a
                        href={preview.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block hover:bg-[#1a1a22] transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex">
                          {/* Thumbnail */}
                          {preview.showThumbnail && preview.metadata?.image && (
                            <div className="w-32 h-32 flex-shrink-0 relative overflow-hidden bg-[#0e0e12]">
                              <img
                                src={preview.metadata.image}
                                alt={preview.metadata.title || "Preview"}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            </div>
                          )}

                          {/* Content */}
                          <div className="flex-1 p-3 min-w-0">
                            {preview.metadata?.siteName && (
                              <div className="text-[10px] text-[#9fa0b8] uppercase tracking-wide mb-1">
                                {preview.metadata.siteName}
                              </div>
                            )}
                            {preview.metadata?.title ? (
                              <div className="text-sm font-semibold text-white mb-1 line-clamp-2 hover:text-brand transition-colors">
                                {preview.metadata.title}
                              </div>
                            ) : (
                              <div className="text-sm font-semibold text-white mb-1 truncate">
                                {preview.domain}
                              </div>
                            )}
                            {preview.metadata?.description && (
                              <div className="text-xs text-[#9fa0b8] line-clamp-2 mb-1">
                                {preview.metadata.description}
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-[10px] text-[#6E767D]">
                              <ExternalLink className="h-3 w-3" />
                              <span className="truncate">{preview.domain}</span>
                            </div>
                          </div>
                        </div>
                      </a>
                    )}

                    {/* Action buttons - positioned over the preview */}
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                      {/* Toggle thumbnail button (only show if metadata has image) */}
                      {!preview.isLoading && preview.metadata?.image && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleLinkThumbnail(preview.url);
                          }}
                          className="p-1.5 bg-black/70 hover:bg-black/90 rounded-full transition-colors"
                          title={preview.showThumbnail ? "Hide thumbnail" : "Show thumbnail"}
                        >
                          {preview.showThumbnail ? (
                            <ImageOff className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <ImageIcon className="w-3.5 h-3.5 text-white" />
                          )}
                        </button>
                      )}
                      {/* Remove preview button */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeLinkPreview(preview.url);
                        }}
                        className="p-1.5 bg-black/70 hover:bg-black/90 rounded-full transition-colors"
                        title="Remove preview"
                      >
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
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
      {!isFloatingPopover && (
        <div className="px-4 py-2 border-t border-[#2F3336]">
          <button className="flex items-center gap-2 text-brand text-sm font-semibold hover:underline">
            <Globe className="w-4 h-4" />
            Everyone can reply
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-t border-[#2F3336] gap-1 sm:gap-2 flex-shrink-0"
        style={(isCreateModeExpanded || isPageMode) ? { paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" } : undefined}
      >
        <div
          className="grid grid-cols-8 w-full sm:w-auto sm:flex sm:items-center gap-0.5 sm:gap-1 flex-1 min-w-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* 1. Emoji picker */}
          <div className="relative flex justify-center sm:block flex-shrink-0">
            <button
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker);
                setShowGifPicker(false);
              }}
              className="p-1.5 sm:p-2 hover:bg-brand/10 rounded-full transition-colors"
            >
              <Smile className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
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
            "flex justify-center sm:block p-1.5 sm:p-2 hover:bg-brand/10 rounded-full cursor-pointer transition-colors flex-shrink-0",
            (isUploadingImages || showPollCreator) && "opacity-50 cursor-not-allowed"
          )}>
            {isUploadingImages ? (
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-brand animate-spin" />
            ) : (
              <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
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
          <button
            onClick={() => {
              if (!showPollCreator) {
                setShowGifPicker(true);
                setShowEmojiPicker(false);
              }
            }}
            disabled={showPollCreator}
            className={cn(
              "flex justify-center sm:block p-1.5 sm:p-2 hover:bg-brand/10 rounded-full transition-colors text-brand flex-shrink-0",
              showPollCreator && "opacity-50 cursor-not-allowed"
            )}
          >
            <GifIcon />
          </button>

          {/* 4. Video upload */}
          <label className={cn(
            "flex justify-center sm:block p-1.5 sm:p-2 hover:bg-brand/10 rounded-full cursor-pointer transition-colors flex-shrink-0",
            (isUploadingVideos || showPollCreator) && "opacity-50 cursor-not-allowed"
          )}>
            {isUploadingVideos ? (
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-brand animate-spin" />
            ) : (
              <Video className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
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
              "flex items-center justify-center sm:justify-start flex-shrink-0",
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
            "flex justify-center sm:block p-1.5 sm:p-2 hover:bg-brand/10 rounded-full cursor-pointer transition-colors flex-shrink-0",
            (isUploadingDocuments || showPollCreator) && "opacity-50 cursor-not-allowed"
          )}>
            {isUploadingDocuments ? (
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-brand animate-spin" />
            ) : (
              <Paperclip className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
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
              "flex justify-center sm:block p-1.5 sm:p-2 rounded-full transition-colors flex-shrink-0",
              isRecording
                ? "bg-red-500/20 hover:bg-red-500/30"
                : "hover:bg-brand/10",
              showPollCreator && "opacity-50 cursor-not-allowed"
            )}
          >
            {isRecording ? (
              <Square className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
            ) : (
              <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
            )}
          </button>

          {/* 9. Poll creator */}
          <button
            onClick={() => {
              setShowPollCreator(!showPollCreator);
              if (showPollCreator) {
                setPollData(null);
              }
              // Clear attachments when enabling poll
              if (!showPollCreator) {
                setAttachments([]);
              }
            }}
            disabled={attachments.length > 0 && !showPollCreator}
            className={cn(
              "flex justify-center sm:block p-1.5 sm:p-2 rounded-full transition-colors flex-shrink-0",
              showPollCreator
                ? "bg-brand/20 text-brand"
                : "hover:bg-brand/10 text-brand",
              attachments.length > 0 && !showPollCreator && "opacity-50 cursor-not-allowed"
            )}
          >
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className={cn("flex items-center gap-1 sm:gap-2 flex-shrink-0", isPageMode && "hidden")}>
          {/* Recording indicator */}
          {isRecording && (
            <div className="flex items-center gap-1 sm:gap-2 text-red-500">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs sm:text-sm font-medium">{formatDuration(recordingDuration)}</span>
            </div>
          )}

          {/* Cancel button (only in edit mode) */}
          {isEditMode && onCancel && (
            <Button
              onClick={onCancel}
              variant="ghost"
              className="px-2 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold text-[#6E767D] hover:text-white hover:bg-white/10 text-xs sm:text-sm"
            >
              Cancel
            </Button>
          )}

          {/* Reason the button is disabled — otherwise it just greys out silently */}
          {blockedReason && (
            <span className="hidden sm:inline text-xs text-[#6E767D] max-w-[220px] truncate">
              {blockedReason}
            </span>
          )}

          {/* Post/Update button */}
          <Button
            onClick={handleSubmit}
            disabled={!canPost}
            title={blockedReason ?? undefined}
            className={cn(
              "px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold transition-colors text-xs sm:text-sm",
              canPost
                ? "bg-brand hover:opacity-90 text-brand-foreground"
                : "bg-brand/50 text-brand-foreground/50 cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
            ) : isEditMode ? (
              "Update"
            ) : postType === 'article' || isFloatingPopover ? (
              "Publish"
            ) : (
              "Post"
            )}
          </Button>
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

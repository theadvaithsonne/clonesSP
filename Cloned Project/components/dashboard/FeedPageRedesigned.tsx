"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, memo } from "react";
import { Rss, Plus, X, Image as ImageIcon, Video, FileText, Loader2, Tag, Youtube, Upload, Hand, MessageCircle, Calendar, CheckSquare, Bookmark, Hash, ArrowLeft, CircleDollarSign, Link2, ChevronLeft, ChevronRight, Play, Lock } from "lucide-react";
import {
  getOrgChannels,
  getPosts,
  createPost,
  updatePost,
  deletePost,
  toggleLike,
  toggleRepost,
  toggleBookmark,
  addComment,
  getSubscribedChannels,
  subscribeToFreeChannel,
  getTeamMembers,
  getBookmarkedPosts,
  getTrendingTags,
  searchPostsByTag,
  getChannelSubscribers,
  pinPost,
  unpinPost,
  type Channel,
  type Post,
  type SubscribedChannel,
  type TeamMember,
  type TrendingTag,
  type Poll,
  type ChannelSubscriber,
} from "@/lib/feed-api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sanitizeDescription } from "@/lib/sanitizeDescription";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "@/lib/auth";
import { PostCard, type Post as CardPost } from "./FeedComponents";
import { PostDetailView } from "./PostDetailView";
import { LinkPreview } from "@/components/ui/link-preview";
import { getFirstUrl } from "@/lib/url-utils";
import { toast } from "sonner";
import { getPageCache, setPageCache, invalidatePageCache, getRevenueNetworkData } from "@/lib/revenue-network-cache";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useUploadThing } from "@/lib/uploadthing";
import { ChannelPaymentModalNew } from "./ChannelPaymentModalNew";
import { connectSocket } from "@/lib/socket";
import { CreatePostModal } from "@/components/feed/CreatePostModal";
import { InlinePostComposer } from "@/components/feed/InlinePostComposer";
import { MobileCreatePostPage } from "@/components/feed/MobileCreatePostPage";
import { QuotePostModal } from "@/components/feed/QuotePostModal";
import BookingDialog from "./BookingDialog";
import { UserTodosDialog } from "./UserTodosDialog";
import { RatingsReviewsCard } from "@/components/reviews";
import { useUser } from "@/store/authStore";

const MemoPostCard = memo(PostCard);

// useLayoutEffect is a no-op on the server; fall back to useEffect there so React
// doesn't warn during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface Attachment {
  id: string;
  type: 'image' | 'video' | 'document';
  url: string;
  name: string;
}

// Helper to get orgId from localStorage
function getOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("garage_org_id");
}

// Helper to get user info from token
function getUserFromToken(): { userId: string; name?: string; email?: string } | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return {
      userId: payload.userId,
      name: payload.name,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

// Adapted Post type for PostCard compatibility
interface PostCardPost {
  _id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  authorAvatar?: string | null;
  channelIds: { _id: string; title: string }[];
  tags?: string[];
  attachments?: {
    type: 'image' | 'video' | 'document' | 'audio';
    url: string;
    name: string;
  }[];
  linkPreviews?: Array<{
    url: string;
    title?: string;
    description?: string;
    image?: string | null;
    siteName?: string;
    showThumbnail?: boolean;
  }>;
  likes: number;
  likesCount?: number;
  hasLiked?: boolean;
  reactionsCount?: {
    like: number;
    love: number;
    fire: number;
    haha: number;
    wow: number;
    sad: number;
    angry: number;
    total: number;
  };
  userReaction?: 'like' | 'love' | 'fire' | 'haha' | 'wow' | 'sad' | 'angry' | null;
  comments: number;
  commentsCount?: number;
  reposts?: number;
  repostsCount?: number;
  hasReposted?: boolean;
  bookmarks?: number;
  bookmarksCount?: number;
  hasBookmarked?: boolean;
  shares: number;
  quotedPostId?: Post["quotedPostId"];
  createdAt: Date;
  updatedAt: Date;
  hasPoll?: boolean;
  poll?: Poll;
  // Article fields
  postType?: 'post' | 'article';
  title?: string;
  coverImage?: string;
  slug?: string;
  readingTimeMinutes?: number;
  // Pin
  isPinned?: boolean;
}
function getYoutubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /youtu\.be\/([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}


// ✅ ADDED: Stable scroll style constant — prevents new object on every render
const SCROLL_STYLE: React.CSSProperties = {
  scrollbarWidth: 'none' as const,
  msOverflowStyle: 'none' as const,
  WebkitOverflowScrolling: 'touch', // smooth momentum scrolling on iOS
  overscrollBehavior: 'contain',    // prevents scroll chaining / jank at boundaries
};

export function FeedPage() {
  const user = useUser();
  console.log('user------>', user)

  const [channels, setChannels] = useState<Channel[]>([]);
  const [subscribedChannels, setSubscribedChannels] = useState<SubscribedChannel[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("feed:selected-channel-id");
    }
    return null;
  });
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ userId: string; name?: string; email?: string } | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [channelMembers, setChannelMembers] = useState<ChannelSubscriber[]>([]);
  const [loadingChannelMembers, setLoadingChannelMembers] = useState(false);



  // View mode: 'feed' | 'bookmarks' | 'tags'
  const [viewMode, setViewMode] = useState<'feed' | 'bookmarks' | 'tags'>('feed');
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Post[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [selectedTagForPosts, setSelectedTagForPosts] = useState<string | null>(null);
  const [tagPosts, setTagPosts] = useState<Post[]>([]);
  const [loadingTagPosts, setLoadingTagPosts] = useState(false);

  // Modal states
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showChannelsModal, setShowChannelsModal] = useState(false);
  const [showMobileComposer, setShowMobileComposer] = useState(false);

  // Create post form
  const [postContent, setPostContent] = useState("");
  const [postTags, setPostTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [selectedPostChannels, setSelectedPostChannels] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Attachments state
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isUploadingVideos, setIsUploadingVideos] = useState(false);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);

  // UploadThing hooks
  const { startUpload: startImageUpload } = useUploadThing("postImages");
  const { startUpload: startVideoUpload } = useUploadThing("postVideos");
  const { startUpload: startDocumentUpload } = useUploadThing("postDocuments");

  // Image modal state


  // Post detail view state (inline, not modal)
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // Video option modal state
  const [showVideoOptionModal, setShowVideoOptionModal] = useState(false);
  const [youtubeLink, setYoutubeLink] = useState("");

  // Edit post modal state
  const [showEditPostModal, setShowEditPostModal] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Channel payment modal state
  const [showChannelPaymentModal, setShowChannelPaymentModal] = useState(false);
  const [selectedChannelForPayment, setSelectedChannelForPayment] = useState<Channel | null>(null);

  // Track if channels have been loaded
  const [channelsLoaded, setChannelsLoaded] = useState(false);

  // Track if user is founder
  const [isFounder, setIsFounder] = useState(false);

   // Track new comments per post for real-time updates
  const [newComments, setNewComments] = useState<Record<string, any>>({});

  // User profile popup state
  const [showUserPopup, setShowUserPopup] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TeamMember | null>(null);

  // User action dialogs state
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [showUserTodosDialog, setShowUserTodosDialog] = useState(false);

  // Quote post modal state
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quotePost, setQuotePost] = useState<Post | null>(null);

  // Floating new post composer popover state
  const [showNewPostPopover, setShowNewPostPopover] = useState(false);
  const [bottomNavWidth, setBottomNavWidth] = useState<number | null>(null);
  const [bottomNavHeight, setBottomNavHeight] = useState<number>(64);

  // Highlighted post state (for mention notifications)
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);

  // Link preview detection
  const detectedUrl = useMemo(() => getFirstUrl(postContent), [postContent]);

  // Enrich subscribed channels with logo and memberCount from full channels data
  const enrichedSubscribedChannels = useMemo(() => {
    return subscribedChannels.map(subChannel => {
      const fullChannel = channels.find(c => c._id === subChannel.channelId);
      return {
        ...subChannel,
        logo: fullChannel?.logo || null,
        memberCount: fullChannel?.memberCount,
      };
    });
  }, [subscribedChannels, channels]);

  // Channels the user can actually post in (filters out muted channels)
  const postableChannels = useMemo(() => {
    if (isFounder) return enrichedSubscribedChannels;
    return enrichedSubscribedChannels.filter(ch => ch.canPost !== false);
  }, [enrichedSubscribedChannels, isFounder]);

  // True when user has channels but is muted in all of them
  const isUserMutedInAll = useMemo(() => {
    if (isFounder) return false;
    return enrichedSubscribedChannels.length > 0 && postableChannels.length === 0;
  }, [enrichedSubscribedChannels, postableChannels, isFounder]);

  const currentUserProfilePicture = useMemo(() => {
    if (!currentUser?.userId && !currentUser?.email) return undefined;
    return teamMembers.find(
      (m) => m._id === currentUser?.userId || m.email === currentUser?.email
    )?.profilePicture;
  }, [teamMembers, currentUser?.userId, currentUser?.email]);

  // Store and Affiliate info for Affiliate Link
  const [storeSlug, setStoreSlug] = useState<string>("");
  const [affiliateId, setAffiliateId] = useState<string>("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);

  useEffect(() => {
    const loadRevenueNetworkData = async () => {
      try {
        const cachedData = await getRevenueNetworkData();
        let slug = cachedData?.storeSlug || "";
        let affId = cachedData?.affiliateId || "";

        // Fallback to localStorage organization slug if storeSlug is empty
        if (!slug && typeof window !== "undefined") {
          slug = localStorage.getItem("garage_org_slug") || "";
        }

        // If affiliateId is still empty, fetch it directly from the endpoint
        if (!affId && typeof window !== "undefined") {
          const token = getToken();
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
          if (token) {
            try {
              const affiliateResponse = await fetch(`${apiUrl}/affiliate/my-affiliate-id`, {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              });
              if (affiliateResponse.ok) {
                const affiliateData = await affiliateResponse.json();
                affId = affiliateData.affiliateId || "";
              }
            } catch (err) {
              console.error("Failed to fetch affiliate ID directly:", err);
            }
          }
        }

        setStoreSlug(slug);
        setAffiliateId(affId);
      } catch (error) {
        console.error("Error loading revenue network data:", error);
      }
    };
    loadRevenueNetworkData();
  }, []);

  const activeChannel = useMemo(() => {
    if (selectedChannelId) {
      return channels.find(c => c._id === selectedChannelId) || null;
    }
    if (subscribedChannels.length > 0) {
      return channels.find(c => c._id === subscribedChannels[0].channelId) || null;
    }
    return channels[0] || null;
  }, [selectedChannelId, channels, subscribedChannels]);

  // Check if current user is subscribed to active channel
  const isSubscribed = useMemo(() => {
    if (isFounder) return true;
    if (!activeChannel) return false;
    return subscribedChannels.some(c => c.channelId === activeChannel._id);
  }, [activeChannel, subscribedChannels, isFounder]);

  // Set default channel when loaded, or validate existing selection
  useEffect(() => {
    if (channelsLoaded && channels.length > 0) {
      if (!selectedChannelId) {
        const persisted = sessionStorage.getItem("feed:selected-channel-id");
        if (persisted && channels.some(c => c._id === persisted)) {
          setSelectedChannelId(persisted);
        } else {
          const defaultChan = subscribedChannels.length > 0 
            ? subscribedChannels[0].channelId 
            : channels[0]._id;
          setSelectedChannelId(defaultChan);
        }
      } else {
        // Validate that current selectedChannelId exists in channels
        if (!channels.some(c => c._id === selectedChannelId)) {
          const defaultChan = subscribedChannels.length > 0 
            ? subscribedChannels[0].channelId 
            : channels[0]._id;
          setSelectedChannelId(defaultChan);
        }
      }
    }
  }, [channelsLoaded, channels, subscribedChannels, selectedChannelId]);

  // Sync selectedChannelId changes to sessionStorage and notify the layout popover
  useEffect(() => {
    if (selectedChannelId) {
      sessionStorage.setItem("feed:selected-channel-id", selectedChannelId);
      window.dispatchEvent(new CustomEvent("feed:channel-changed", { detail: { channelId: selectedChannelId } }));
      setIsAboutExpanded(false);
      setIsVideoPlaying(false);
    }
  }, [selectedChannelId]);

  // Listen for switch-channel events from layout's popover
  useEffect(() => {
    const handleSwitchChannel = (event: CustomEvent<{ channelId: string }>) => {
      const { channelId } = event.detail;
      if (channelId && channelId !== selectedChannelId) {
        setSelectedChannelId(channelId);
      }
    };
    window.addEventListener("feed:switch-channel" as any, handleSwitchChannel);
    return () => {
      window.removeEventListener("feed:switch-channel" as any, handleSwitchChannel);
    };
  }, [selectedChannelId]);

  // Reset slide and video play state when channel changes
  useEffect(() => {
    setCurrentSlide(0);
    setIsVideoPlaying(false);
    setIsAboutExpanded(false);
  }, [selectedChannelId]);

  const bannerImages = useMemo(() => {
    const list: string[] = [];
    if (activeChannel?.coverImage) {
      list.push(activeChannel.coverImage);
    }
    if (activeChannel?.galleryImages && activeChannel.galleryImages.length > 0) {
      activeChannel.galleryImages.forEach(img => {
        if (img && !list.includes(img)) {
          list.push(img);
        }
      });
    }
    // No default/fallback image list
    return list;
  }, [activeChannel]);

  const handleCopyAffiliateLink = useCallback(() => {
    if (!activeChannel) {
      toast.error("No active community selected");
      return;
    }
    window.dispatchEvent(new CustomEvent("right-panel:open-information", {
      detail: {
        type: "affiliate",
        channel: activeChannel,
        affiliateId: affiliateId
      }
    }));
  }, [activeChannel, affiliateId]);

  const handleLearnAboutCommunity = useCallback(async () => {
    if (!activeChannel) return;
    window.dispatchEvent(new CustomEvent("right-panel:open-information", {
      detail: {
        type: "information",
        channel: activeChannel,
        affiliateId: affiliateId
      }
    }));
  }, [activeChannel, affiliateId]);

  const handleOpenMembersDrawer = useCallback(() => {
    if (!activeChannel) return;
    window.dispatchEvent(new CustomEvent("right-panel:open-information", {
      detail: {
        type: "members",
        channel: activeChannel,
        affiliateId: affiliateId
      }
    }));
  }, [activeChannel, affiliateId]);

  const videoUrl = useMemo(() => {
    return activeChannel?.videoUrl || activeChannel?.videoFile || "";
  }, [activeChannel]);

  const postsTagsKey = useMemo(() => {
    return posts.map((p) => `${p._id}:${(p.tags ?? []).join(",")}`).join("|");
  }, [posts]);

  const feedTagSummary = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    for (const post of posts) {
      for (const tag of post.tags ?? []) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
    const tagsSorted = Object.keys(tagCounts).sort(
      (a, b) => (tagCounts[b] || 0) - (tagCounts[a] || 0)
    );
    return {
      tagCounts,
      topTags: tagsSorted.slice(0, 8),
      allTagsCount: tagsSorted.length,
    };
  }, [postsTagsKey]);

  const visiblePosts = useMemo(() => {
    return selectedTag ? posts.filter((post) => post.tags?.includes(selectedTag)) : posts;
  }, [posts, selectedTag]);

  // Initialize orgId and user
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }
    const org = getOrgId();
    if (!org) {
      setError("No organization selected");
      setLoading(false);
      return;
    }
    setOrgId(org);
    setCurrentUser(getUserFromToken());
    setLoading(false);
  }, []);

  // Fetch channels
  useEffect(() => {
    if (!orgId) return;
    const fetchChannels = async () => {
      const cacheKey = `feed:channels:${orgId}`;
      const cached = getPageCache<{ channels: Channel[]; subscribedChannels: SubscribedChannel[]; isFounder: boolean }>(cacheKey);
      if (cached) {
        setChannels(cached.channels);
        setSubscribedChannels(cached.subscribedChannels);
        setIsFounder(cached.isFounder);
        setChannelsLoaded(true);
      }
      try {
        const [allChannelsData, subscribedData] = await Promise.all([
          getOrgChannels(orgId),
          getSubscribedChannels(orgId).catch(() => ({ channels: [], isFounder: false })),
        ]);
        setChannels(allChannelsData.channels);
        setSubscribedChannels(subscribedData.channels);
        setIsFounder(subscribedData.isFounder);
        setPageCache(cacheKey, { channels: allChannelsData.channels, subscribedChannels: subscribedData.channels, isFounder: subscribedData.isFounder });
      } catch (err) {
        console.error('Error fetching channels:', err);
      } finally {
        setChannelsLoaded(true);
      }
    };
    fetchChannels();
  }, [orgId]);

  // Socket.IO for real-time feed updates
  useEffect(() => {
    if (!orgId || !channelsLoaded || subscribedChannels.length === 0) return;
    const socket = connectSocket();
    socket.emit("feed:join-org", { orgId });
    const channelIds = subscribedChannels.map(ch => ch.channelId);
    socket.emit("feed:join-channels", { channelIds });

    const handleNewPost = (data: { post: Post }) => {
      setPosts(prev => {
        if (prev.some(p => p._id === data.post._id)) return prev;
        return [data.post, ...prev];
      });
    };
    const handlePostLiked = (data: { postId: string; likesCount: number; userId: string; liked: boolean }) => {
      setPosts(prev => prev.map(p =>
        p._id === data.postId
          ? { ...p, likesCount: data.likesCount, hasLiked: data.userId === currentUser?.userId ? data.liked : p.hasLiked }
          : p
      ));
    };
    const handleNewComment = (data: { postId: string; comment: any }) => {
      setPosts(prev => prev.map(p =>
        p._id === data.postId ? { ...p, commentsCount: p.commentsCount + 1 } : p
      ));
      setNewComments(prev => ({ ...prev, [data.postId]: data.comment }));
    };

    const handlePostPinned = (data: { postId: string; orgId: string }) => {
      setPosts(prev => {
        const updated = prev.map(p => ({ ...p, isPinned: p._id === data.postId }));
        const pinned = updated.find(p => p._id === data.postId);
        const rest = updated.filter(p => p._id !== data.postId);
        return pinned ? [pinned, ...rest] : updated;
      });
    };
    const handlePostUnpinned = (data: { postId: string }) => {
      setPosts(prev => prev.map(p => p._id === data.postId ? { ...p, isPinned: false } : p));
    };

    socket.on("feed:new-post", handleNewPost);
    socket.on("feed:post-liked", handlePostLiked);
    socket.on("feed:new-comment", handleNewComment);
    socket.on("feed:post-pinned", handlePostPinned);
    socket.on("feed:post-unpinned", handlePostUnpinned);

    return () => {
      socket.off("feed:new-post", handleNewPost);
      socket.off("feed:post-liked", handlePostLiked);
      socket.off("feed:new-comment", handleNewComment);
      socket.off("feed:post-pinned", handlePostPinned);
      socket.off("feed:post-unpinned", handlePostUnpinned);
      socket.emit("feed:leave-org", { orgId });
      channelIds.forEach(channelId => socket.emit("feed:leave-channel", { channelId }));
    };
  }, [orgId, channelsLoaded, subscribedChannels, currentUser?.userId]);

  // ✅ OPTIMIZED: Track joined post rooms with a ref to avoid re-joining on every posts state update
  // Only emit new joins/leaves when the SET of post IDs actually changes (not on like/comment updates)
  const joinedPostIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!posts.length) return;
    const socket = connectSocket();
    const currentIds = new Set(posts.map(p => p._id));

    const toJoin = [...currentIds].filter(id => !joinedPostIdsRef.current.has(id));
    const toLeave = [...joinedPostIdsRef.current].filter(id => !currentIds.has(id));

    toJoin.forEach(postId => socket.emit("feed:join-post", { postId }));
    toLeave.forEach(postId => socket.emit("feed:leave-post", { postId }));

    joinedPostIdsRef.current = currentIds;
  }, [posts.length]); // ✅ Only re-run when count changes, not on content updates (likes/comments)

  // Refresh posts function
  const refreshPosts = useCallback(async () => {
    if (!orgId) return;
    const cacheKey = `feed:posts:${orgId}:${selectedChannelId || "all"}`;
    const cached = getPageCache<{ posts: Post[] }>(cacheKey);
    if (cached) {
      setPosts(cached.posts);
      setLoadingPosts(false);
    } else {
      setLoadingPosts(true);
    }
    try {
      const data = await getPosts(orgId, {
        channelId: selectedChannelId || undefined,
        limit: 50,
      });
      setPosts(data.posts);
      setPageCache(cacheKey, { posts: data.posts });
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setLoadingPosts(false);
    }
  }, [orgId, selectedChannelId]);

  useEffect(() => {
    if (!orgId || !channelsLoaded) return;
    refreshPosts();
  }, [orgId, selectedChannelId, channelsLoaded, refreshPosts]);

  // Fetch team members for @ mentions
  useEffect(() => {
    if (!orgId) return;
    const fetchMembers = async () => {
      try {
        const members = await getTeamMembers(orgId);
        setTeamMembers(members);
      } catch (err) {
        console.error("Failed to fetch team members:", err);
      }
    };
    fetchMembers();
  }, [orgId]);

  // Fetch community/channel subscribers
  useEffect(() => {
    if (activeChannel?._id && orgId) {
      setLoadingChannelMembers(true);
      getChannelSubscribers(activeChannel._id, orgId)
        .then((result) => {
          if (result.success) {
            setChannelMembers(result.subscribers || []);
          } else {
            setChannelMembers([]);
          }
        })
        .catch((err) => {
          console.error("Failed to load channel members:", err);
          setChannelMembers([]);
        })
        .finally(() => {
          setLoadingChannelMembers(false);
        });
    } else {
      setChannelMembers([]);
    }
  }, [activeChannel?._id, orgId]);

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTag(tag);
  }, []);

  const handleMentionClick = useCallback((mention: string) => {
    const normalizedMention = mention.toLowerCase();
    const user = teamMembers.find(
      (m) => m.name.replace(/\s+/g, '').toLowerCase() === normalizedMention
    );
    if (user) {
      setSelectedUser(user);
      setShowUserPopup(true);
    }
  }, [teamMembers]);

  const handleTagClickForTagPosts = useCallback((tag: string) => {
    setSelectedTagForPosts(tag);
  }, []);

  const handleTagClickFromBookmarks = useCallback((tag: string) => {
    setViewMode("tags");
    setSelectedTagForPosts(tag);
  }, []);

  // Listen for highlight post events from notifications
  useEffect(() => {
    const handleHighlightPost = (event: CustomEvent) => {
      const { postId, channelId } = event.detail;
      if (postId) {
        if (channelId) setSelectedChannelId(channelId);
        setHighlightedPostId(postId);
        setTimeout(() => {
          const postElement = document.getElementById(`post-${postId}`);
          if (postElement) postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 500);
        setTimeout(() => setHighlightedPostId(null), 3000);
      }
    };
    window.addEventListener("feed:highlight-post", handleHighlightPost as EventListener);
    return () => window.removeEventListener("feed:highlight-post", handleHighlightPost as EventListener);
  }, []);

  const fetchBookmarks = useCallback(async () => {
    if (!orgId) return;
    const cacheKey = `feed:bookmarks:${orgId}`;
    const cached = getPageCache<{ posts: Post[] }>(cacheKey);
    if (cached) {
      setBookmarkedPosts(cached.posts);
      setLoadingBookmarks(false);
    } else {
      setLoadingBookmarks(true);
    }
    try {
      const data = await getBookmarkedPosts(orgId, { limit: 50 });
      setBookmarkedPosts(data.posts);
      setPageCache(cacheKey, { posts: data.posts });
    } catch (err) {
      console.error("Failed to fetch bookmarks:", err);
    } finally {
      setLoadingBookmarks(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (viewMode === 'bookmarks' && orgId) fetchBookmarks();
  }, [viewMode, orgId, fetchBookmarks]);

  const fetchTrendingTags = useCallback(async () => {
    if (!orgId) return;
    setLoadingTags(true);
    try {
      const data = await getTrendingTags(orgId, { limit: 50 });
      setTrendingTags(data.trending);
    } catch (err) {
      console.error("Failed to fetch trending tags:", err);
    } finally {
      setLoadingTags(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (viewMode === 'tags' && orgId) fetchTrendingTags();
  }, [viewMode, orgId, fetchTrendingTags]);

  useEffect(() => {
    if (orgId && channelsLoaded) fetchTrendingTags();
  }, [orgId, channelsLoaded, fetchTrendingTags]);

  const fetchPostsByTag = useCallback(async (tag: string) => {
    if (!orgId) return;
    setLoadingTagPosts(true);
    try {
      const data = await searchPostsByTag(tag, orgId, { limit: 50 });
      setTagPosts(data.posts);
    } catch (err) {
      console.error("Failed to fetch posts for tag:", err);
    } finally {
      setLoadingTagPosts(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (selectedTagForPosts && orgId) fetchPostsByTag(selectedTagForPosts);
  }, [selectedTagForPosts, orgId, fetchPostsByTag]);

  useEffect(() => {
    const handleOpenNewPost = () => {
      setShowNewPostPopover(true);
    };
    const handleCloseNewPost = () => {
      setShowNewPostPopover(false);
    };
    window.addEventListener("feed:open-new-post", handleOpenNewPost);
    window.addEventListener("feed:close-new-post", handleCloseNewPost);
    return () => {
      window.removeEventListener("feed:open-new-post", handleOpenNewPost);
      window.removeEventListener("feed:close-new-post", handleCloseNewPost);
    };
  }, []);

  // Measured before paint: in a plain useEffect the composer painted one frame
  // at its full-width fallback and then snapped to the dock's width, which is
  // the flicker seen every time it opened. The setters bail out when nothing
  // moved so the ResizeObserver can't re-render the feed on every frame.
  useIsomorphicLayoutEffect(() => {
    if (!showNewPostPopover) return;

    const bottomNav = document.getElementById("global-bottom-nav");
    if (!bottomNav) return;

    const updateDimensions = () => {
      const rect = bottomNav.getBoundingClientRect();
      setBottomNavWidth((prev) => (prev === rect.width ? prev : rect.width));
      setBottomNavHeight((prev) => (prev === rect.height ? prev : rect.height));
    };

    // Initial measurement
    updateDimensions();

    window.addEventListener("resize", updateDimensions);

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });
    resizeObserver.observe(bottomNav);

    return () => {
      window.removeEventListener("resize", updateDimensions);
      resizeObserver.disconnect();
    };
  }, [showNewPostPopover]);

  const handleCreatePost = async () => {
    if (!orgId || !postContent.trim() || selectedPostChannels.length === 0) return;
    setIsSubmitting(true);
    try {
      await createPost({
        orgId,
        content: postContent.trim(),
        channelIds: selectedPostChannels,
        tags: postTags,
        attachments: attachments.map(att => ({ type: att.type, url: att.url, name: att.name })),
      });
      toast.success("Post created successfully!");
      setPostContent("");
      setPostTags([]);
      setSelectedPostChannels([]);
      setAttachments([]);
      setShowCreatePostModal(false);
      invalidatePageCache(`feed:posts:${orgId}`);
      const postsData = await getPosts(orgId, { channelId: selectedChannelId || undefined, limit: 50 });
      setPosts(postsData.posts);
      setPageCache(`feed:posts:${orgId}:${selectedChannelId || "all"}`, { posts: postsData.posts });
    } catch (error) {
      toast.error("Failed to create post");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = useCallback(async (postId: string) => {
    if (!orgId) return;
    try {
      const result = await toggleLike(postId, orgId);
      setPosts(prev =>
        prev.map(p => p._id === postId ? { ...p, likesCount: result.likesCount, hasLiked: result.liked } : p)
      );
    } catch (error) {
      console.error("Failed to toggle like:", error);
    }
  }, [orgId]);

  const handleComment = useCallback(async (
    postId: string,
    content: string,
    attachments?: { type: "image" | "gif" | "audio"; url: string; name: string; fileKey?: string }[],
    parentCommentId?: string
  ) => {
    if (!orgId) return;
    try {
      await addComment(postId, orgId, content, parentCommentId, attachments);
      toast.success(parentCommentId ? "Reply added!" : "Comment added!");
      if (!parentCommentId) {
        setPosts(prev =>
          prev.map(p => p._id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p)
        );
      }
    } catch (error) {
      console.error("Comment error:", error);
      // Surface the real backend error — without this every failure
      // (Zod rejection on bad attachment type, network drop, 403 for
      // restricted commenter) showed the same opaque "Failed to add
      // comment" toast. Matches the pattern we added in ChannelsPage.
      const msg = error instanceof Error ? error.message : "Failed to add comment";
      toast.error(msg);
    }
  }, [orgId]);

  const handleRepost = useCallback(async (postId: string) => {
    if (!orgId) return;
    try {
      const result = await toggleRepost(postId, orgId);
      setPosts(prev =>
        prev.map(p => p._id === postId ? { ...p, repostsCount: result.repostsCount, hasReposted: result.reposted } : p)
      );
    } catch (error) {
      console.error("Failed to toggle repost:", error);
    }
  }, [orgId]);

  const handleQuotePost = useCallback((postId: string) => {
    const postToQuote = posts.find(p => p._id === postId)
      || bookmarkedPosts.find(p => p._id === postId)
      || tagPosts.find(p => p._id === postId);
    if (postToQuote) {
      setQuotePost(postToQuote);
      setShowQuoteModal(true);
    }
  }, [posts, bookmarkedPosts, tagPosts]);

  const handleQuotePostCreated = useCallback(() => {
    refreshPosts();
  }, [refreshPosts]);

  const handleBookmark = useCallback(async (postId: string) => {
    if (!orgId) return;
    try {
      const result = await toggleBookmark(postId, orgId);
      setPosts(prev =>
        prev.map(p => {
          if (p._id !== postId) return p;
          const prevCount = p.bookmarksCount || 0;
          const newCount = typeof result.bookmarksCount === "number"
            ? result.bookmarksCount
            : result.bookmarked ? prevCount + 1 : Math.max(prevCount - 1, 0);
          return { ...p, bookmarksCount: newCount, hasBookmarked: result.bookmarked };
        })
      );
    } catch (error) {
      console.error("Failed to toggle bookmark:", error);
    }
  }, [orgId]);

  const handleBookmarkAndRefresh = useCallback(async (postId: string) => {
    await handleBookmark(postId);
    fetchBookmarks();
  }, [handleBookmark, fetchBookmarks]);

  const handlePinPost = useCallback(async (postId: string) => {
    if (!orgId) return;
    try {
      await pinPost(postId, orgId);
      // Optimistic: mark this post as pinned, clear all others, move it to top
      setPosts(prev => {
        const updated = prev.map(p => ({ ...p, isPinned: p._id === postId }));
        const pinned = updated.find(p => p._id === postId);
        const rest = updated.filter(p => p._id !== postId);
        return pinned ? [pinned, ...rest] : updated;
      });
      toast.success("Post pinned!");
    } catch (error) {
      console.error("Failed to pin post:", error);
      toast.error("Failed to pin post");
    }
  }, [orgId]);

  const handleUnpinPost = useCallback(async (postId: string) => {
    if (!orgId) return;
    try {
      await unpinPost(postId, orgId);
      // Optimistic: clear pin flag
      setPosts(prev => prev.map(p => p._id === postId ? { ...p, isPinned: false } : p));
      toast.success("Post unpinned!");
    } catch (error) {
      console.error("Failed to unpin post:", error);
      toast.error("Failed to unpin post");
    }
  }, [orgId]);

  const handleAddTag = () => {
    if (tagInput.trim() && !postTags.includes(tagInput.trim())) {
      setPostTags([...postTags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setPostTags(postTags.filter(t => t !== tag));
  };

  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingImages(true);
    try {
      const fileArray = Array.from(files);
      const uploadResults = await startImageUpload(fileArray);
      if (uploadResults) {
        const newAttachments: Attachment[] = uploadResults.map((result, index) => ({
          id: `img-${Date.now()}-${index}`,
          type: 'image' as const,
          url: (result as any).url,
          name: fileArray[index].name,
        }));
        setAttachments(prev => [...prev, ...newAttachments]);
        toast.success(`${uploadResults.length} image(s) uploaded`);
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error('Failed to upload images. Please try again.');
    } finally {
      setIsUploadingImages(false);
      event.target.value = '';
    }
  }, [startImageUpload]);

  const handleVideoUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingVideos(true);
    try {
      const fileArray = Array.from(files);
      const uploadResults = await startVideoUpload(fileArray);
      if (uploadResults) {
        const newAttachments: Attachment[] = uploadResults.map((result, index) => ({
          id: `vid-${Date.now()}-${index}`,
          type: 'video' as const,
          url: (result as any).url,
          name: fileArray[index].name,
        }));
        setAttachments(prev => [...prev, ...newAttachments]);
        toast.success(`${uploadResults.length} video(s) uploaded`);
      }
    } catch (error) {
      console.error('Error uploading videos:', error);
      toast.error('Failed to upload videos. Please try again.');
    } finally {
      setIsUploadingVideos(false);
      event.target.value = '';
    }
  }, [startVideoUpload]);

  const handleDocumentUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingDocuments(true);
    try {
      const fileArray = Array.from(files);
      const uploadResults = await startDocumentUpload(fileArray);
      if (uploadResults) {
        const newAttachments: Attachment[] = uploadResults.map((result, index) => ({
          id: `doc-${Date.now()}-${index}`,
          type: 'document' as const,
          url: (result as any).url,
          name: fileArray[index].name,
        }));
        setAttachments(prev => [...prev, ...newAttachments]);
        toast.success(`${uploadResults.length} document(s) uploaded`);
      }
    } catch (error) {
      console.error('Error uploading documents:', error);
      toast.error('Failed to upload documents. Please try again.');
    } finally {
      setIsUploadingDocuments(false);
      event.target.value = '';
    }
  }, [startDocumentUpload]);

  const handleRemoveAttachment = (id: string) => {
    setAttachments(attachments.filter(att => att.id !== id));
  };

  // Convert Post to PostCard format
  const convertPostForCard = useCallback((post: Post): PostCardPost => ({
    _id: post._id,
    content: post.content,
    authorId: post.authorId?._id ?? '',
    authorName: post.authorId?.name ?? 'Unknown',
    authorEmail: post.authorId?.email,
    authorAvatar: post.authorId?.profilePicture || null,
    channelIds: post.channelIds,
    tags: post.tags,
    attachments: post.attachments,
    linkPreviews: post.linkPreviews,
    likes: post.likesCount,
    likesCount: post.likesCount,
    hasLiked: post.hasLiked,
    reactionsCount: post.reactionsCount
      ? { ...(post.reactionsCount as any), fire: (post.reactionsCount as any).fire ?? 0 }
      : undefined,
    userReaction: post.userReaction ?? null,
    comments: post.commentsCount,
    commentsCount: post.commentsCount,
    reposts: post.repostsCount || 0,
    repostsCount: post.repostsCount || 0,
    hasReposted: post.hasReposted,
    bookmarks: post.bookmarksCount || 0,
    bookmarksCount: post.bookmarksCount || 0,
    hasBookmarked: post.hasBookmarked,
    shares: 0,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    quotedPostId: post.quotedPostId,
    hasPoll: post.hasPoll,
    poll: post.poll,
    // Article fields
    postType: post.postType,
    title: post.title,
    coverImage: post.coverImage,
    slug: post.slug,
    readingTimeMinutes: post.readingTimeMinutes,
    isPinned: post.isPinned || false,
  }), []);

  // ✅ KEPT: WeakMap cache for Post → PostCardPost conversions (unchanged post objects reuse their conversion)
  const postCardCacheRef = useRef(new WeakMap<Post, PostCardPost>());

  const toPostCard = useCallback((post: Post): PostCardPost => {
    const cached = postCardCacheRef.current.get(post);
    if (cached) return cached;
    const converted = convertPostForCard(post);
    postCardCacheRef.current.set(post, converted);
    return converted;
  }, [convertPostForCard]);

  const handlePostClick = useCallback((postId: string) => {
    setSelectedPostId(postId);
  }, []);

  const handleBackToFeed = useCallback(() => {
    setSelectedPostId(null);
  }, []);

  const handleImageClick = useCallback((post: CardPost, _imageIndex: number) => {
    // Open PostDetailView instead of ImageModal for a consistent experience
    setSelectedPostId(post._id);
  }, []);

  const handleEditPost = useCallback((post: CardPost) => {
    setEditingPost(post as unknown as Post);
    setShowEditPostModal(true);
  }, []);

  const handleDeletePostClick = useCallback((postId: string) => {
    setDeletingPostId(postId);
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = async () => {
    if (!deletingPostId || !orgId) return;
    setIsDeleting(true);
    try {
      await deletePost(deletingPostId, orgId);
      toast.success("Post deleted successfully!");
      invalidatePageCache(`feed:posts:${orgId}`);
      setPosts(posts.filter(p => p._id !== deletingPostId));
      setShowDeleteConfirm(false);
      setDeletingPostId(null);
    } catch (error) {
      toast.error("Failed to delete post");
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddYoutubeLink = useCallback(() => {
    if (!youtubeLink.trim()) return;
    const getYoutubeVideoId = (url: string): string | null => {
      const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/,
      ];
      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
      }
      return null;
    };
    const videoId = getYoutubeVideoId(youtubeLink.trim());
    if (!videoId) {
      toast.error("Invalid YouTube URL. Please enter a valid YouTube link.");
      return;
    }
    const newAttachment: Attachment = {
      id: `yt-${Date.now()}`,
      type: 'video' as const,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      name: `YouTube Video (${videoId})`,
    };
    setAttachments(prev => [...prev, newAttachment]);
    setYoutubeLink("");
    setShowVideoOptionModal(false);
    toast.success("YouTube video added!");
  }, [youtubeLink]);

  const handleSubscribeToChannel = async (channelId: string) => {
    if (!orgId) {
      toast.error("Unable to subscribe. Please ensure you are logged in.");
      return;
    }
    const channel = channels.find(c => c._id === channelId);
    if (!channel) return;
    if (subscribedChannels.find(c => c.channelId === channelId)) {
      toast.info(`Already subscribed to ${channel.title}`);
      return;
    }
    if (!channel.isFree && channel.price > 0) {
      setSelectedChannelForPayment(channel);
      setShowChannelsModal(false);
      setShowChannelPaymentModal(true);
      return;
    }
    try {
      await subscribeToFreeChannel(channelId, orgId);
      const newSubscription: SubscribedChannel = {
        channelId,
        channelTitle: channel.title,
        status: 'active',
        joinedAt: new Date(),
      };
      setSubscribedChannels([...subscribedChannels, newSubscription]);
      toast.success(`Subscribed to ${channel.title}`);
    } catch (error) {
      console.error('Subscription error:', error);
      toast.error("Failed to subscribe to channel");
    }
  };

  const handleChannelPaymentSuccess = () => {
    if (selectedChannelForPayment) {
      const newSubscription: SubscribedChannel = {
        channelId: selectedChannelForPayment._id,
        channelTitle: selectedChannelForPayment.title,
        status: 'active',
        joinedAt: new Date(),
      };
      setSubscribedChannels([...subscribedChannels, newSubscription]);
    }
    setShowChannelPaymentModal(false);
    setSelectedChannelForPayment(null);
  };

  if (loading || !channelsLoaded) {
    return (
      <div className="h-full w-full flex flex-col bg-black">
        <div className="flex-1 overflow-hidden flex justify-center min-h-0">
          <div
            className="flex-1 min-w-0 h-full overflow-y-auto min-h-0 pb-4 no-scrollbar feed-scroll bg-black"
            style={SCROLL_STYLE}
          >
            {/* 1. Banner Carousel Placeholder - Full Width */}
            <div className="relative w-full aspect-[4/1] md:aspect-[5/1] lg:aspect-[6/1] max-h-[280px] min-h-[120px] overflow-hidden bg-gradient-to-r from-[#16161e] via-[#20202a] to-[#16161e] border-b border-[#2a2a35] flex items-center justify-center animate-pulse">
              <ImageIcon className="w-8 h-8 text-[#2a2a35]/60" />
            </div>

            <div className="max-w-6xl mx-auto px-4 space-y-6 mt-6">
              {/* 2. Community Info Section Placeholder */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-2 animate-pulse">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <div className="h-8 w-48 bg-gray-800 rounded" />
                  <div className="h-5 w-28 bg-gray-800 rounded" />
                  <div className="flex items-center gap-2">
                    <div className="flex items-center -space-x-2.5">
                      <div className="w-7 h-7 rounded-full bg-gray-800 border-2 border-black" />
                      <div className="w-7 h-7 rounded-full bg-gray-800 border-2 border-black" />
                      <div className="w-7 h-7 rounded-full bg-gray-800 border-2 border-black" />
                    </div>
                    <div className="h-4 w-24 bg-gray-800 rounded" />
                  </div>
                </div>
                <div className="h-10 w-32 bg-gray-800 rounded-full" />
              </div>

              {/* 3. Grid Columns Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Left Column (Composer and Feed List) */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-black border border-[#2a2a35] rounded-xl overflow-hidden divide-y divide-[#2a2a35] animate-pulse">
                    {/* Composer Skeleton */}
                    <div className="p-5 flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-800 shrink-0" />
                      <div className="h-10 flex-1 rounded-lg bg-gray-800" />
                    </div>
                    
                    {/* Skeletons list */}
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="p-5 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-800 shrink-0" />
                          <div className="space-y-1.5 flex-1">
                            <div className="h-3.5 w-32 bg-gray-800 rounded" />
                            <div className="h-2.5 w-20 bg-gray-800 rounded" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-3 w-full bg-gray-800 rounded" />
                          <div className="h-3 w-5/6 bg-gray-800 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column (About and Video Skeletons) */}
                <div className="space-y-6 animate-pulse">
                  {/* About card skeleton */}
                  <div className="bg-[#16161e] border border-[#2a2a35] rounded-2xl p-5 space-y-4">
                    <div className="h-5 w-16 bg-gray-800 rounded" />
                    <div className="space-y-2">
                      <div className="h-3 w-full bg-gray-800 rounded" />
                      <div className="h-3 w-5/6 bg-gray-800 rounded" />
                      <div className="h-3 w-4/6 bg-gray-800 rounded" />
                    </div>
                    <div className="h-10 w-full bg-gray-800 rounded-xl" />
                  </div>

                  {/* Intro Video skeleton */}
                  <div className="bg-[#16161e] border border-[#2a2a35] rounded-2xl p-5 space-y-4">
                    <div className="h-5 w-24 bg-gray-800 rounded" />
                    <div className="aspect-video w-full bg-gradient-to-r from-[#16161e] via-[#20202a] to-[#16161e] border border-[#2a2a35] rounded-xl flex items-center justify-center">
                      <Play className="w-8 h-8 text-white/20" />
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !orgId) {
    return (
      <div className="h-full w-full flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <p className="text-sm text-[#9fa0b8]">Please make sure you are logged in and have selected an organization.</p>
        </div>
      </div>
    );
  }

  // If a post is selected, show the PostDetailView instead of the feed
  if (selectedPostId && orgId) {
    return (
      <div className="h-full w-full flex flex-col bg-black">
        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 border-r border-[#2a2a35]">
            <PostDetailView
              postId={selectedPostId}
              orgId={orgId}
              currentUserId={currentUser?.userId}
              currentUserName={currentUser?.name}
              currentUserAvatar={currentUserProfilePicture}
              onBack={handleBackToFeed}
              onPostUpdate={(updatedPost) => {
                setPosts(posts.map(p => p._id === updatedPost._id ? updatedPost : p));
              }}
              onTagClick={(tag) => {
                setSelectedTag(tag);
                setSelectedPostId(null);
              }}
              onMentionClick={(mention) => {
                const user = teamMembers.find(
                  m => m.name.replace(/\s+/g, '').toLowerCase() === mention.toLowerCase() ||
                       m.email.split('@')[0].toLowerCase() === mention.toLowerCase()
                );
                if (user) {
                  setSelectedUser(user);
                  setShowUserPopup(true);
                }
              }}
              onEdit={(post) => {
                setSelectedPostId(null);
                setEditingPost(post);
                setShowEditPostModal(true);
              }}
              onDelete={(postId) => {
                setSelectedPostId(null);
                setDeletingPostId(postId);
                setShowDeleteConfirm(true);
              }}
            />
          </div>

          {/* Commented out detailed view right sidebar as all widgets inside it are commented out */}
          {/*
          <div className="hidden lg:block w-80 shrink-0 py-4 px-4">
            <div className="sticky top-4">
              <div className="bg-[#16161a] rounded-2xl overflow-hidden">
                <div className="px-4 py-3">
                  <h2 className="text-white font-bold text-lg">Trends for you</h2>
                </div>
                <div>
                  <button
                    onClick={() => { setSelectedPostId(null); setSelectedTag(null); }}
                    className={cn("w-full text-left px-4 py-3 transition-colors", !selectedTag ? "bg-white/5" : "hover:bg-white/5")}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn("font-bold text-[15px]", !selectedTag ? "text-brand" : "text-white")}>All Posts</p>
                        <p className="text-[#71767b] text-[13px]">{posts.length} posts</p>
                      </div>
                      {!selectedTag && <div className="w-2 h-2 rounded-full bg-brand"></div>}
                    </div>
                  </button>
                  {feedTagSummary.topTags.map((tag, index) => (
                    <button
                      key={tag}
                      onClick={() => { setSelectedPostId(null); setSelectedTag(tag); }}
                      className="w-full text-left px-4 py-3 transition-colors hover:bg-white/5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[#71767b] text-[13px]">{index + 1} · Trending</p>
                          <p className="font-bold text-[15px] text-white">#{tag}</p>
                          <p className="text-[#71767b] text-[13px]">{feedTagSummary.tagCounts[tag]} posts</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {feedTagSummary.allTagsCount > 8 && (
                  <button onClick={() => setSelectedPostId(null)} className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors">
                    <p className="text-brand text-[15px]">Show more</p>
                  </button>
                )}
              </div>
            </div>
          </div>
          */}
        </div>

        <Dialog open={showUserPopup} onOpenChange={setShowUserPopup}>
          <DialogContent className="bg-[#16181C] border-[#2F3336] text-white max-w-sm">
            {selectedUser && (
              <div className="flex flex-col items-center text-center py-4">
                {selectedUser.profilePicture ? (
                  <img src={selectedUser.profilePicture} alt={selectedUser.name} className="w-20 h-20 rounded-full object-cover mb-4" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-[#1D9BF0] flex items-center justify-center text-white text-2xl font-bold mb-4">
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <h3 className="text-xl font-bold text-white mb-1">{selectedUser.name}</h3>
                <p className="text-[#6E767D] text-sm mb-1">@{selectedUser.name.replace(/\s+/g, '').toLowerCase()}</p>
                <p className="text-[#6E767D] text-xs mb-4">{selectedUser.email}</p>
                <div className="flex items-center gap-3 mt-2">
                  <button onClick={() => { try { sessionStorage.setItem("workspace:pending-knock", selectedUser._id); } catch {} window.dispatchEvent(new CustomEvent("workspace:knock-user", { detail: { userId: selectedUser._id } })); setShowUserPopup(false); }} className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-white/5 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center"><Hand className="w-5 h-5 text-brand" /></div>
                    <span className="text-xs text-[#9fa0b8]">Knock</span>
                  </button>
                  <button onClick={() => { window.dispatchEvent(new CustomEvent("notification:open-dm", { detail: { userId: selectedUser._id } })); setShowUserPopup(false); }} className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-white/5 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-[#1D9BF0]/10 flex items-center justify-center"><MessageCircle className="w-5 h-5 text-[#1D9BF0]" /></div>
                    <span className="text-xs text-[#9fa0b8]">Chat</span>
                  </button>
                  <button onClick={() => { setShowUserPopup(false); setShowBookingDialog(true); }} className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-white/5 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center"><Calendar className="w-5 h-5 text-green-500" /></div>
                    <span className="text-xs text-[#9fa0b8]">Book</span>
                  </button>
                  <button onClick={() => { setShowUserPopup(false); setShowUserTodosDialog(true); }} className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-white/5 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center"><CheckSquare className="w-5 h-5 text-purple-500" /></div>
                    <span className="text-xs text-[#9fa0b8]">Task</span>
                  </button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <BookingDialog
          targetUser={showBookingDialog && selectedUser ? { id: selectedUser._id, name: selectedUser.name, email: selectedUser.email, spaceId: "lobby", status: "available" } : null}
          onClose={() => setShowBookingDialog(false)}
        />
        {selectedUser && (
          <UserTodosDialog
            isOpen={showUserTodosDialog}
            onClose={() => setShowUserTodosDialog(false)}
            targetUser={{ id: selectedUser._id, name: selectedUser.name, email: selectedUser.email }}
          />
        )}
      </div>
    );
  }

  const aboutText = activeChannel?.aboutText || activeChannel?.description || "Hello & Welcome to our group where we'll be sharing regular info and updates.";
  const plainAboutText = aboutText.replace(/<[^>]*>/g, '');
  const showSeeMore = plainAboutText.length > 180;



  return (
    <div className="h-full w-full flex flex-col bg-black">

      {/* Header */}
      {/* Commented out header at user request */}
      {/*
      <div className={cn(
        "border-b border-[#2a2a35] bg-[#0e0e12] px-4 sm:px-6 py-3 sm:py-3.5",
        viewMode === 'feed' && "hidden sm:block"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            {viewMode !== 'feed' && (
              <button onClick={() => { setViewMode('feed'); setSelectedTagForPosts(null); }} className="p-1.5 rounded-lg hover:bg-[#1a1a22] transition-colors">
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-[#9fa0b8]" />
              </button>
            )}
            <Rss className="h-5 w-5 sm:h-6 sm:w-6 text-brand" />
            <h1 className="text-lg sm:text-xl font-semibold text-white truncate max-w-[150px] sm:max-w-none">
              {viewMode === 'feed' ? 'Feed' : viewMode === 'bookmarks' ? 'Bookmarks' : selectedTagForPosts ? `#${selectedTagForPosts}` : 'Tags'}
            </h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => { setViewMode('bookmarks'); setSelectedTagForPosts(null); }}
              className={cn("p-1.5 sm:p-2 rounded-lg transition-colors", viewMode === 'bookmarks' ? "bg-brand text-brand-foreground" : "hover:bg-[#1a1a22] text-[#9fa0b8] hover:text-white")}
              title="Bookmarks"
            >
              <Bookmark className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <button
              onClick={() => { setViewMode('tags'); setSelectedTagForPosts(null); }}
              className={cn("p-1.5 sm:p-2 rounded-lg transition-colors", viewMode === 'tags' ? "bg-brand text-brand-foreground" : "hover:bg-[#1a1a22] text-[#9fa0b8] hover:text-white")}
              title="Tags"
            >
              <Hash className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <Button onClick={() => setShowChannelsModal(true)} className="bg-[#1a1a22] hover:bg-[#2a2a35] text-white h-8 sm:h-9 px-2 sm:px-3" size="sm">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Browse Communities</span>
            </Button>
          </div>
        </div>


      </div>
      */}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex justify-center min-h-0">

        {/* Feed View */}
        {viewMode === 'feed' && (
          <div
            className="flex-1 min-w-0 h-full overflow-y-auto min-h-0 pb-4 no-scrollbar feed-scroll bg-black"
            style={SCROLL_STYLE}
          >
            {/* 1. Banner Carousel - Full Width */}
            {bannerImages.length > 0 && (
              <div className="w-full mb-6">
                <div className="relative w-full aspect-[4/1] md:aspect-[5/1] lg:aspect-[6/1] max-h-[280px] min-h-[120px] overflow-hidden group bg-[#16161e] border-b border-[#2a2a35] shadow-lg">
                  <img
                    src={bannerImages[currentSlide]}
                    alt="Community Banner"
                    onClick={handleLearnAboutCommunity}
                    className="w-full h-full object-cover transition-all duration-500 cursor-pointer"
                  />
                  
                  {/* Arrow Controls (Only show if multiple images) */}
                  {bannerImages.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentSlide((prev) => (prev - 1 + bannerImages.length) % bannerImages.length);
                        }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentSlide((prev) => (prev + 1) % bannerImages.length);
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                      
                      {/* Index Indicator */}
                      <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 rounded-full text-xs font-semibold text-white tracking-widest">
                        {currentSlide + 1} / {bannerImages.length}
                      </div>
                    </>
                  )}
                </div>

                {/* Banner thumbnails row (only if multiple images) */}
                {bannerImages.length > 1 && (
                  <div className="max-w-6xl mx-auto px-4 mt-3">
                    <div className="flex gap-[10px] overflow-x-auto pb-1 no-scrollbar shrink-0">
                      {bannerImages.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentSlide(idx)}
                          className={cn(
                            "h-[50px] aspect-[1.8/1] rounded-[5px] overflow-hidden border-2 transition-all cursor-pointer shrink-0",
                            currentSlide === idx ? "border-brand scale-95" : "border-transparent opacity-60 hover:opacity-100"
                          )}
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="max-w-6xl mx-auto px-4 space-y-6">
              {/* 2. Community Info Section */}
              <div className="relative bg-black !mt-1 pt-2 pb-3 px-2">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                      {activeChannel?.title || "Community Feed"}
                    </h1>

                    
                    {/* Profiles of members overlapping + Member count */}
                    <div
                      onClick={handleOpenMembersDrawer}
                      className="flex items-center gap-2 cursor-pointer hover:opacity-85 transition-opacity select-none"
                    >
                      {channelMembers.filter(m => m.user?.profilePicture && !m.user?.profilePicture.includes("default")).length > 0 && (
                        <div className="flex items-center -space-x-2.5">
                          {channelMembers
                            .filter(m => m.user?.profilePicture && !m.user?.profilePicture.includes("default"))
                            .slice(0, 10)
                            .map((member, idx) => {
                              const user = member.user;
                              if (!user) return null;
                              return (
                                <div
                                  key={user._id}
                                  className="w-7 h-7 rounded-full border-2 border-[#0b0b0d] overflow-hidden bg-gray-800 flex-shrink-0"
                                  style={{ zIndex: 10 - idx }}
                                >
                                  <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
                                </div>
                              );
                            })}
                        </div>
                      )}
                      <span className="text-xs md:text-sm text-[#9fa0b8] font-medium hover:text-brand transition-colors">
                        {(activeChannel?.memberCount || channelMembers.length || 0) > 1 ? `+ ${(activeChannel?.memberCount || channelMembers.length || 0).toLocaleString()} Members` : `${activeChannel?.memberCount || channelMembers.length || 0} Member`}
                      </span>
                    </div>
                  </div>

                  {/* Affiliate Link button */}
                  {activeChannel && (
                    <button
                      onClick={handleCopyAffiliateLink}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-brand hover:opacity-90 text-brand-foreground font-bold rounded-full transition-all shadow-[0_4px_20px] shadow-brand/15 hover:scale-[1.02] active:scale-[0.98] shrink-0 cursor-pointer text-xs"
                    >
                      <Link2 className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Affiliate Link</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 3. Grid Columns Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  {/* Left Columns (Composer and Feed List) */}
                 <div className="lg:col-span-2 space-y-4">
                   <div className="space-y-4">
                     {!isSubscribed ? (
                       <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-[#111115] border border-[#2a2a35] rounded-xl shadow-2xl relative overflow-hidden group">
                         {/* Background subtle glowing effect */}
                         <div className="absolute inset-0 bg-gradient-to-b from-brand/5 via-transparent to-transparent pointer-events-none transition-all duration-500 group-hover:scale-105" />
                         
                         <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center text-brand mb-6 border border-brand/20 shadow-[0_0_30px] shadow-brand/5 animate-pulse">
                           <Lock className="w-8 h-8 stroke-[2.5]" />
                         </div>
                         
                         <h2 className="text-xl font-bold text-white mb-2">Locked Community</h2>
                         <p className="text-sm text-[#9fa0b8] max-w-md mb-6 leading-relaxed">
                           You need to enroll in <span className="font-semibold text-white">{activeChannel?.title}</span> to view its posts and join the conversation.
                         </p>
                         
                         <Button
                           onClick={() => activeChannel && handleSubscribeToChannel(activeChannel._id)}
                           className="bg-brand hover:opacity-90 text-brand-foreground font-bold px-8 py-2.5 rounded-full transition-all duration-300 shadow-[0_4px_20px] shadow-brand/15 hover:scale-[1.03] active:scale-[0.98] cursor-pointer animate-none"
                         >
                           {activeChannel?.isFree ? "Join Community" : "Subscribe to Unlock"}
                         </Button>
                       </div>
                     ) : loadingPosts ? (
                       Array.from({ length: 3 }).map((_, i) => (
                         <div key={i} className="bg-[#111115] border border-[#2a2a35] rounded-2xl p-5 space-y-3 animate-pulse">
                           <div className="flex items-center gap-3">
                             <div className="h-9 w-9 rounded-full bg-gray-800" />
                             <div className="space-y-1.5 flex-1">
                               <div className="h-3 w-32 bg-gray-800 rounded" />
                               <div className="h-2.5 w-20 bg-gray-800 rounded" />
                             </div>
                           </div>
                           <div className="space-y-2">
                             <div className="h-3 bg-gray-800 rounded w-full" />
                             <div className="h-3 bg-gray-800 rounded w-5/6" />
                           </div>
                         </div>
                       ))
                     ) : posts.length === 0 ? (
                       <div className="flex flex-col items-center justify-center py-12 text-center bg-[#111115] border border-[#2a2a35] rounded-2xl p-6">
                         <Rss className="h-12 w-12 text-[#9fa0b8] mb-4" />
                         <p className="text-[#9fa0b8] font-medium">No posts found in this community</p>
                         <p className="text-xs text-[#6b6b7b] mt-1">Be the first to share a post above!</p>
                       </div>
                     ) : (
                       visiblePosts.map((post) => (
                         <MemoPostCard
                           key={post._id}
                           post={toPostCard(post)}
                           orgId={orgId}
                           onLike={handleLike}
                           onComment={handleComment}
                           onRepost={handleRepost}
                           onQuote={handleQuotePost}
                           onBookmark={handleBookmark}
                           onPin={handlePinPost}
                           onUnpin={handleUnpinPost}
                           onEdit={handleEditPost}
                           onDelete={handleDeletePostClick}
                           onTagClick={handleTagClick}
                           onMentionClick={handleMentionClick}
                           currentUserId={currentUser?.userId}
                           currentUserEmail={currentUser?.email}
                           currentUserName={currentUser?.name}
                           currentUserAvatar={currentUserProfilePicture}
                           newComment={newComments[post._id]}
                           isHighlighted={highlightedPostId === post._id}
                         />
                       ))
                     )}
                   </div>
                 </div>

                {/* Right Column (About and Intro Video) */}
                <div className="space-y-6">
                  
                  {/* About community card — same surface as a feed post card */}
                  <div className="bg-[#111115] border border-[#2a2a35] rounded-2xl p-5 shadow-lg space-y-4">
                    <h2 className="text-lg font-bold text-white">About</h2>
                    
                    {/* Render rich-text safely with dangerouslySetInnerHTML */}
                    <div className="space-y-2">
                      <div 
                        className={cn(
                          "text-sm text-[#9fa0b8] leading-relaxed break-words [&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_p]:mb-2 [&_a]:text-brand [&_a]:hover:underline relative",
                          showSeeMore && !isAboutExpanded && "max-h-[120px] overflow-hidden"
                        )}
                      >
                        <div dangerouslySetInnerHTML={{ __html: sanitizeDescription(aboutText) }} />
                        {showSeeMore && !isAboutExpanded && (
                          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#16161e] to-transparent pointer-events-none" />
                        )}
                      </div>
                      
                      {showSeeMore && !isAboutExpanded && (
                        <button
                          onClick={() => setIsAboutExpanded(true)}
                          className="text-brand hover:underline font-semibold text-sm cursor-pointer bg-transparent border-0 p-0"
                        >
                          See more
                        </button>
                      )}
                      {showSeeMore && isAboutExpanded && (
                        <button
                          onClick={() => setIsAboutExpanded(false)}
                          className="text-brand hover:underline font-semibold text-sm cursor-pointer bg-transparent border-0 p-0 block mt-2"
                        >
                          Show less
                        </button>
                      )}
                    </div>
                    
                    {/* Intro Video section (only render if videoUrl exists) */}
                    {videoUrl && (
                      <div className="space-y-2.5 pt-2">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Intro Video</h3>
                        
                        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-[#2a2a35] group">
                          {videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be") ? (
                            isVideoPlaying ? (
                              <iframe
                                src={`https://www.youtube.com/embed/${getYoutubeVideoId(videoUrl)}?autoplay=1&rel=0`}
                                title="Intro Video"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                                allowFullScreen
                                className="w-full h-full"
                              />
                            ) : (
                              <>
                                <img
                                  src={`https://img.youtube.com/vi/${getYoutubeVideoId(videoUrl)}/hqdefault.jpg`}
                                  alt="Intro Video Preview"
                                  className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-300"
                                />
                                <button
                                  onClick={() => setIsVideoPlaying(true)}
                                  className="absolute inset-0 flex items-center justify-center bg-black/35 hover:bg-black/45 transition-colors cursor-pointer group"
                                >
                                  <div className="w-14 h-14 rounded-full bg-white/95 text-black flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                    <Play className="w-6 h-6 text-black ml-1 fill-black" />
                                  </div>
                                </button>
                              </>
                            )
                          ) : (
                            <video
                              src={videoUrl}
                              controls
                              preload="metadata"
                              className="w-full h-full object-contain"
                            />
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Learn about community CTA button */}
                    <div className="pt-2">
                      <button
                        onClick={handleLearnAboutCommunity}
                        className="w-full py-3 bg-black hover:bg-zinc-900 text-white font-bold rounded-xl transition-all border border-[#2a2a35] hover:border-[#383846] text-sm cursor-pointer shadow-md hover:scale-[1.01] active:scale-[0.99]"
                      >
                        Learn about this community
                      </button>
                    </div>
                  </div>

                  {/* Ratings & Reviews — sits directly below About */}
                  {activeChannel?._id && (
                    <RatingsReviewsCard
                      targetType="channel"
                      targetId={activeChannel._id}
                      targetName={activeChannel.title}
                    />
                  )}

                </div>

              </div>

            </div>
          </div>
        )}

        {/* Bookmarks View */}
        {viewMode === 'bookmarks' && (
          <div className="flex-1 min-w-0 h-full overflow-y-auto min-h-0 px-3 sm:px-4 py-3 sm:py-4 no-scrollbar" style={SCROLL_STYLE}>
            <div className="max-w-2xl mx-auto space-y-3 sm:space-y-4">
              {loadingBookmarks ? (
                <div className="space-y-4 py-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="bg-[#16161e] border border-[#2a2a35] rounded-xl p-4 space-y-3 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gray-800" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-3 w-32 bg-gray-800 rounded" />
                          <div className="h-2.5 w-20 bg-gray-800 rounded" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-800 rounded w-full" />
                        <div className="h-3 bg-gray-800 rounded w-5/6" />
                      </div>
                      <div className="flex gap-4 pt-1">
                        <div className="h-3 w-12 bg-gray-800 rounded" />
                        <div className="h-3 w-12 bg-gray-800 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : bookmarkedPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bookmark className="h-12 w-12 text-[#9fa0b8] mb-4" />
                  <p className="text-[#9fa0b8]">No bookmarks yet</p>
                  <p className="text-sm text-[#6b6b7b] mt-2">Posts you bookmark will appear here</p>
                </div>
              ) : (
                // ✅ OPTIMIZED: Removed AnimatePresence
                <>
                  {bookmarkedPosts.map((post) => (
                    <MemoPostCard
                      key={post._id}
                      post={toPostCard(post)}
                      orgId={orgId}
                      onLike={handleLike}
                      onComment={handleComment}
                      onRepost={handleRepost}
                      onQuote={handleQuotePost}
                      onBookmark={handleBookmarkAndRefresh}
                      onEdit={handleEditPost}
                      onDelete={handleDeletePostClick}
                      onTagClick={handleTagClickFromBookmarks}
                      onMentionClick={handleMentionClick}
                      currentUserId={currentUser?.userId}
                      currentUserEmail={currentUser?.email}
                      currentUserName={currentUser?.name}
                      currentUserAvatar={currentUserProfilePicture}
                      newComment={newComments[post._id]}
                      isHighlighted={highlightedPostId === post._id}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* Tags View */}
        {viewMode === 'tags' && (
          <div className="flex-1 min-w-0 h-full overflow-y-auto min-h-0 px-3 sm:px-4 py-3 sm:py-4 no-scrollbar" style={SCROLL_STYLE}>
            <div className="max-w-2xl mx-auto">
              {!selectedTagForPosts ? (
                <div className="space-y-2">
                  {loadingTags ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
                    </div>
                  ) : trendingTags.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Hash className="h-12 w-12 text-[#9fa0b8] mb-4" />
                      <p className="text-[#9fa0b8]">No tags found</p>
                      <p className="text-sm text-[#6b6b7b] mt-2">Tags from posts will appear here</p>
                    </div>
                  ) : (
                    trendingTags.map((tag, index) => (
                      <button
                        key={tag.tag}
                        onClick={() => setSelectedTagForPosts(tag.tag)}
                        className="w-full text-left px-4 py-4 bg-[#16161a] hover:bg-[#1a1a22] rounded-xl transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[#71767b] text-[13px]">{index + 1} · Trending</p>
                            <p className="font-bold text-[17px] text-white mt-0.5">#{tag.tag}</p>
                            <p className="text-[#71767b] text-[13px] mt-0.5">{tag.count} {tag.count === 1 ? 'post' : 'posts'}</p>
                          </div>
                          <Hash className="h-5 w-5 text-[#9fa0b8]" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  <button onClick={() => setSelectedTagForPosts(null)} className="flex items-center gap-2 text-[#9fa0b8] hover:text-white transition-colors mb-4">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to all tags</span>
                  </button>
                  {loadingTagPosts ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
                    </div>
                  ) : tagPosts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Hash className="h-12 w-12 text-[#9fa0b8] mb-4" />
                      <p className="text-[#9fa0b8]">No posts with #{selectedTagForPosts}</p>
                    </div>
                  ) : (
                    // ✅ OPTIMIZED: Removed AnimatePresence
                    <>
                      {tagPosts.map((post) => (
                        <MemoPostCard
                          key={post._id}
                          post={toPostCard(post)}
                          orgId={orgId}
                          onLike={handleLike}
                          onComment={handleComment}
                          onRepost={handleRepost}
                          onQuote={handleQuotePost}
                          onBookmark={handleBookmark}
                          onEdit={handleEditPost}
                          onDelete={handleDeletePostClick}
                          onTagClick={handleTagClickForTagPosts}
                          onMentionClick={handleMentionClick}
                          currentUserId={currentUser?.userId}
                          currentUserEmail={currentUser?.email}
                          currentUserName={currentUser?.name}
                          currentUserAvatar={currentUserProfilePicture}
                          newComment={newComments[post._id]}
                          isHighlighted={highlightedPostId === post._id}
                        />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Sidebar */}
        {/* Commented out right sidebar as all widgets inside it are commented out
        {viewMode === 'feed' && (
          <div className="hidden lg:block w-80 shrink-0 py-4 pl-4">
            <div className="sticky top-4 space-y-4">
              <div className="bg-[#16161a] rounded-2xl overflow-hidden">
                <div className="px-4 py-3">
                  <h2 className="text-white font-bold text-lg">Your Communities</h2>
                </div>
                <div>
                  <button
                    onClick={() => setSelectedChannelId(null)}
                    className={cn("w-full text-left px-4 py-3 transition-colors", !selectedChannelId ? "bg-white/5" : "hover:bg-white/5")}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn("font-bold text-[15px]", !selectedChannelId ? "text-brand" : "text-white")}>All Communities</p>
                        <p className="text-[#71767b] text-[13px]">{subscribedChannels.length} communities</p>
                      </div>
                      {!selectedChannelId && <div className="w-2 h-2 rounded-full bg-brand"></div>}
                    </div>
                  </button>
                  {subscribedChannels.map((channel) => (
                    <button
                      key={channel.channelId}
                      onClick={() => setSelectedChannelId(channel.channelId)}
                      className={cn("w-full text-left px-4 py-3 transition-colors", selectedChannelId === channel.channelId ? "bg-white/5" : "hover:bg-white/5")}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={cn("font-bold text-[15px]", selectedChannelId === channel.channelId ? "text-brand" : "text-white")}>{channel.channelTitle}</p>
                        </div>
                        {selectedChannelId === channel.channelId && <div className="w-2 h-2 rounded-full bg-brand"></div>}
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowChannelsModal(true)} className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors">
                  <p className="text-brand text-[15px]">Browse more communities</p>
                </button>
              </div>

              <div className="bg-[#16161a] rounded-2xl overflow-hidden">
                <div className="px-4 py-3">
                  <h2 className="text-white font-bold text-lg">Trends for you</h2>
                </div>
                <div>
                  <button
                    onClick={() => setSelectedTag(null)}
                    className={cn("w-full text-left px-4 py-3 transition-colors", !selectedTag ? "bg-white/5" : "hover:bg-white/5")}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn("font-bold text-[15px]", !selectedTag ? "text-brand" : "text-white")}>All Posts</p>
                        <p className="text-[#71767b] text-[13px]">{posts.length} posts</p>
                      </div>
                      {!selectedTag && <div className="w-2 h-2 rounded-full bg-brand"></div>}
                    </div>
                  </button>
                  {feedTagSummary.topTags.map((tag, index) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag)}
                      className={cn("w-full text-left px-4 py-3 transition-colors", selectedTag === tag ? "bg-white/5" : "hover:bg-white/5")}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[#71767b] text-[13px]">{index + 1} · Trending</p>
                          <p className={cn("font-bold text-[15px]", selectedTag === tag ? "text-brand" : "text-white")}>#{tag}</p>
                          <p className="text-[#71767b] text-[13px]">{feedTagSummary.tagCounts[tag]} posts</p>
                        </div>
                        {selectedTag === tag && <div className="w-2 h-2 rounded-full bg-brand"></div>}
                      </div>
                    </button>
                  ))}
                </div>
                {feedTagSummary.allTagsCount > 8 && (
                  <button onClick={() => setViewMode("tags")} className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors">
                    <p className="text-brand text-[15px]">Show more</p>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        */}
      </div>

      {/* Create Post Modal */}
      <CreatePostModal
        open={showCreatePostModal}
        onOpenChange={setShowCreatePostModal}
        channels={postableChannels}
        orgId={orgId || ""}
        user={{ name: currentUser?.name || "User", email: currentUser?.email, profilePicture: currentUserProfilePicture }}
        onPostCreated={refreshPosts}
        teamMembers={teamMembers}
        existingTags={trendingTags.map(t => t.tag)}
      />

      {/* Edit Post Modal */}
      <Dialog open={showEditPostModal} onOpenChange={(open) => { setShowEditPostModal(open); if (!open) setEditingPost(null); }}>
        <DialogContent
          className="bg-[#16181C] border-[#2F3336] text-white max-w-[100vw] sm:!max-w-[800px] w-full h-[100dvh] sm:h-auto sm:max-h-[85vh] p-0 gap-0 [&>button]:hidden overflow-y-auto rounded-none sm:rounded-lg"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <InlinePostComposer
            channels={postableChannels}
            orgId={orgId || ""}
            user={{ name: currentUser?.name || "User", email: currentUser?.email, profilePicture: currentUserProfilePicture }}
            onPostCreated={() => { refreshPosts(); setShowEditPostModal(false); setEditingPost(null); }}
            teamMembers={teamMembers}
            existingTags={trendingTags.map(t => t.tag)}
            editPost={editingPost}
            onCancel={() => { setShowEditPostModal(false); setEditingPost(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* Browse Channels Modal */}
      <Dialog open={showChannelsModal} onOpenChange={setShowChannelsModal}>
        <DialogContent className="bg-[#0e0e12] border-[#2a2a35] text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Browse Communities</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {channels.map((channel) => {
              const isSubscribed = subscribedChannels.some(c => c.channelId === channel._id);
              return (
                <div key={channel._id} className="flex items-start gap-3 p-4 bg-[#1a1a22] rounded-lg border border-[#2a2a35]">
                  {channel.logo ? (
                    <img src={channel.logo} alt={channel.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[#2a2a35] flex items-center justify-center text-brand font-semibold text-lg flex-shrink-0">
                      {channel.title.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium mb-1">{channel.title}</h3>
                        {channel.description && (
                          <div
                            className="text-sm text-[#9fa0b8] line-clamp-2 [&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1"
                            dangerouslySetInnerHTML={{ __html: sanitizeDescription(channel.description) }}
                          />
                        )}
                        {channel.memberCount !== undefined && (
                          <p className="text-xs text-[#6E767D] mt-1">{channel.memberCount} {channel.memberCount === 1 ? 'Member' : 'Members'}</p>
                        )}
                        <p className="text-xs mt-2 flex items-center gap-2">
                          {channel.isFree ? (
                            <span className="text-green-400">Free</span>
                          ) : (
                            <span className="text-brand">₹{channel.price}</span>
                          )}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleSubscribeToChannel(channel._id)}
                        disabled={isSubscribed}
                        size="sm"
                        className={cn("ml-4 flex-shrink-0", isSubscribed ? "bg-[#2a2a35] text-[#9fa0b8] cursor-not-allowed" : "bg-brand hover:opacity-90 text-brand-foreground")}
                      >
                        {isSubscribed ? "Subscribed" : channel.isFree ? "Join" : "Subscribe"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Option Modal */}
      <Dialog open={showVideoOptionModal} onOpenChange={setShowVideoOptionModal}>
        <DialogContent className="bg-[#0e0e12] border-[#2a2a35] text-white max-w-md">
          <DialogHeader><DialogTitle>Add Video</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[#9fa0b8]">Choose how you want to add a video:</p>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white">
                <Youtube className="w-5 h-5 text-red-500" />
                <span className="font-medium">YouTube Link</span>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Paste YouTube URL..."
                  value={youtubeLink}
                  onChange={(e) => setYoutubeLink(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddYoutubeLink()}
                  className="bg-[#1a1a22] border-[#2a2a35] text-white placeholder:text-[#9fa0b8] flex-1"
                />
                <Button onClick={handleAddYoutubeLink} disabled={!youtubeLink.trim()} className="bg-brand hover:opacity-90 text-brand-foreground">Add</Button>
              </div>
              <p className="text-xs text-[#9fa0b8]">Supports youtube.com and youtu.be links</p>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#2a2a35]" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-[#0e0e12] px-2 text-[#9fa0b8]">OR</span></div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white">
                <Upload className="w-5 h-5 text-purple-400" />
                <span className="font-medium">Upload Video File</span>
              </div>
              <label className={cn("flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-[#2a2a35] rounded-lg hover:bg-[#1a1a22] cursor-pointer transition-colors w-full", isUploadingVideos && "opacity-50 cursor-not-allowed")}>
                {isUploadingVideos ? (
                  <><Loader2 className="w-5 h-5 text-purple-400 animate-spin" /><span className="text-sm text-[#9fa0b8]">Uploading...</span></>
                ) : (
                  <><Video className="w-5 h-5 text-purple-400" /><span className="text-sm text-[#9fa0b8]">Choose video files</span></>
                )}
                <input type="file" accept="video/*" multiple onChange={(e) => { handleVideoUpload(e); setShowVideoOptionModal(false); }} className="hidden" disabled={isUploadingVideos} />
              </label>
              <p className="text-xs text-[#9fa0b8]">MP4, WebM, MOV supported</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-[#0e0e12] border-[#2a2a35] text-white max-w-md">
          <DialogHeader><DialogTitle>Delete Post</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-[#9fa0b8]">Are you sure you want to delete this post? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => { setShowDeleteConfirm(false); setDeletingPostId(null); }} variant="ghost" className="text-[#9fa0b8] hover:text-white">Cancel</Button>
              <Button onClick={handleConfirmDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white">{isDeleting ? "Deleting..." : "Delete"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Channel Payment Modal */}
      {selectedChannelForPayment && orgId && currentUser && (
        <ChannelPaymentModalNew
          isOpen={showChannelPaymentModal}
          onClose={() => { setShowChannelPaymentModal(false); setSelectedChannelForPayment(null); }}
          channel={selectedChannelForPayment}
          orgId={orgId}
          userData={{ name: currentUser.name || "", email: currentUser.email || "" }}
          onSuccess={handleChannelPaymentSuccess}
        />
      )}

      {/* User Profile Popup */}
      <Dialog open={showUserPopup} onOpenChange={setShowUserPopup}>
        <DialogContent className="bg-[#16181C] border-[#2F3336] text-white max-w-sm">
          {selectedUser && (
            <div className="flex flex-col items-center text-center py-4">
              {selectedUser.profilePicture ? (
                <img src={selectedUser.profilePicture} alt={selectedUser.name} className="w-20 h-20 rounded-full object-cover mb-4" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#1D9BF0] flex items-center justify-center text-white text-2xl font-bold mb-4">
                  {selectedUser.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <h3 className="text-xl font-bold text-white mb-1">{selectedUser.name}</h3>
              <p className="text-[#71767B] text-sm mb-6">@{selectedUser.email?.split('@')[0]}</p>
              <div className="grid grid-cols-4 gap-3 w-full mb-6">
                <button onClick={() => { try { sessionStorage.setItem("workspace:pending-knock", selectedUser._id); } catch {} window.dispatchEvent(new CustomEvent("workspace:knock-user", { detail: { userId: selectedUser._id } })); setShowUserPopup(false); }} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[#202327] hover:bg-[#2a2a35] transition-colors">
                  <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center"><Hand className="w-5 h-5 text-brand" /></div>
                  <span className="text-xs text-[#E8EAED]">Knock</span>
                </button>
                <button onClick={() => { window.dispatchEvent(new CustomEvent("notification:open-dm", { detail: { userId: selectedUser._id } })); setShowUserPopup(false); }} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[#202327] hover:bg-[#2a2a35] transition-colors">
                  <div className="w-10 h-10 rounded-full bg-[#1D9BF0]/20 flex items-center justify-center"><MessageCircle className="w-5 h-5 text-[#1D9BF0]" /></div>
                  <span className="text-xs text-[#E8EAED]">Chat</span>
                </button>
                <button onClick={() => { setShowUserPopup(false); setShowBookingDialog(true); }} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[#202327] hover:bg-[#2a2a35] transition-colors">
                  <div className="w-10 h-10 rounded-full bg-[#60A5FA]/20 flex items-center justify-center"><Calendar className="w-5 h-5 text-[#60A5FA]" /></div>
                  <span className="text-xs text-[#E8EAED]">Book</span>
                </button>
                <button onClick={() => { setShowUserPopup(false); setShowUserTodosDialog(true); }} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[#202327] hover:bg-[#2a2a35] transition-colors">
                  <div className="w-10 h-10 rounded-full bg-[#4ADE80]/20 flex items-center justify-center"><CheckSquare className="w-5 h-5 text-[#4ADE80]" /></div>
                  <span className="text-xs text-[#E8EAED]">Task</span>
                </button>
              </div>
              <div className="w-full px-4 py-3 bg-[#202327] rounded-xl">
                <p className="text-[#71767B] text-xs mb-1">Email</p>
                <p className="text-white text-sm">{selectedUser.email}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Booking Dialog */}
      <BookingDialog
        targetUser={showBookingDialog && selectedUser ? { id: selectedUser._id, name: selectedUser.name, email: selectedUser.email, spaceId: "lobby", status: "available" } : null}
        onClose={() => setShowBookingDialog(false)}
      />

      {/* User Todos Dialog */}
      {selectedUser && (
        <UserTodosDialog
          isOpen={showUserTodosDialog}
          onClose={() => setShowUserTodosDialog(false)}
          targetUser={{ id: selectedUser._id, name: selectedUser.name, email: selectedUser.email }}
        />
      )}

      {/* Quote Post Modal */}
      {quotePost && orgId && currentUser && (
        <QuotePostModal
          open={showQuoteModal}
          onOpenChange={(open) => { setShowQuoteModal(open); if (!open) setQuotePost(null); }}
          channels={subscribedChannels.map(c => ({ channelId: c.channelId, channelTitle: c.channelTitle }))}
          orgId={orgId}
          user={{ name: currentUser.name || "", email: currentUser.email, profilePicture: currentUserProfilePicture }}
          quotedPost={quotePost}
          onPostCreated={handleQuotePostCreated}
        />
      )}

      {/* Floating New Post Composer Popover */}
      <AnimatePresence>
        {showNewPostPopover && (
          <>
            {/* Transparent backdrop overlay to close when clicking outside */}
            <div
              className="absolute inset-0 z-[590] bg-transparent"
              onClick={() => setShowNewPostPopover(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 10, x: "-50%" }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-1/2 z-[600] rounded-[20px] sm:rounded-[24px] overflow-hidden flex flex-col"

              style={{
                bottom: `${24 + bottomNavHeight + 12}px`,
                width: bottomNavWidth ? `${bottomNavWidth}px` : "100%",
                maxWidth: bottomNavWidth ? "none" : "calc(100% - 32px)",
                maxHeight: `calc(100dvh - ${bottomNavHeight + 110}px)`,
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                // Hold the blurred panel on its own compositor layer for the
                // whole animation — Chrome otherwise re-rasterises the backdrop
                // mid-flight and the panel flashes.
                willChange: "transform",
                backfaceVisibility: "hidden",
                background: "rgba(30, 30, 30, 0.65)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 8px 32px rgba(0, 0, 0, 0.12)"
              }}
            >
              {/* Close Button overlay */}
              <button
                type="button"
                onClick={() => setShowNewPostPopover(false)}
                className="absolute top-5 right-5 z-[610] p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all border border-white/20 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>

              <InlinePostComposer
                channels={postableChannels}
                orgId={orgId || ""}
                user={{ name: currentUser?.name || "User", email: currentUser?.email, profilePicture: currentUserProfilePicture }}
                onPostCreated={() => {
                  refreshPosts();
                  setShowNewPostPopover(false);
                }}
                teamMembers={teamMembers}
                existingTags={trendingTags.map(t => t.tag)}
                isMuted={isUserMutedInAll}
                alwaysExpanded={true}
                onCancel={() => setShowNewPostPopover(false)}
                isFloatingPopover={true}
                initialSelectedChannels={selectedChannelId ? [selectedChannelId] : (postableChannels.length > 0 ? [postableChannels[0].channelId] : [])}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
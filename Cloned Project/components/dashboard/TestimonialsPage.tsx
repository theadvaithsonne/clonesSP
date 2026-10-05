"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Search,
  Grid,
  List,
  Filter,
  X,
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  Upload,
  Loader2,
  ArrowLeft,
  Save,
  Eye,
  EyeOff,
  Tag,
  Link2,
  Users,
  Globe,
  Image as ImageIcon,
  Video,
  Type,
  Quote,
  Youtube,
  Images,
  GripVertical,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  Building2,
  BarChart3,
  FileText,
  CheckCircle,
  Clock,
  Archive,
  Share2,
  Check,
} from "lucide-react";
import {
  getTestimonials,
  getTestimonial,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  publishTestimonial,
  addContentBlock,
  updateContentBlock,
  deleteContentBlock,
  reorderContentBlocks,
  extractYoutubeId,
  getYoutubeThumbnailUrl,
  type Testimonial,
  type TestimonialListItem,
  type ContentBlock,
  type CreateTestimonialData,
  type CreateContentBlockData,
  type Metric,
} from "@/lib/testimonials-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/auth";
import { toast } from "sonner";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

// Helper to get orgId
function getOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("garage_org_id");
}

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const config = {
    draft: { bg: "bg-yellow-500/20", text: "text-yellow-400", icon: Clock },
    published: { bg: "bg-green-500/20", text: "text-green-400", icon: CheckCircle },
    archived: { bg: "bg-gray-500/20", text: "text-gray-400", icon: Archive },
  };
  const { bg, text, icon: Icon } = config[status as keyof typeof config] || config.draft;

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", bg, text)}>
      <Icon className="h-3 w-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// Category chip component
function CategoryChip({
  category,
  isActive,
  onClick,
}: {
  category: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
        isActive
          ? "bg-brand text-brand-foreground"
          : "bg-[#1e1e2d] text-[#9fa0b8] hover:bg-[#2a2a35] hover:text-white"
      )}
    >
      {category}
    </button>
  );
}

export function TestimonialsPage() {
  const { amIFounder, loading: founderLoading } = useAmIFounder();
  const [testimonials, setTestimonials] = useState<TestimonialListItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "draft" | "published" | "archived">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [affiliateId, setAffiliateId] = useState<string | null>(null);
  const [shareStates, setShareStates] = useState<Record<string, "idle" | "loading" | "copied">>({});

  // View states
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [showCreateView, setShowCreateView] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Read org slug from localStorage (already stored by MainSidebar on login)
  useEffect(() => {
    const slug = typeof window !== "undefined" ? localStorage.getItem("garage_org_slug") : null;
    if (slug) setOrgSlug(slug);

    // Fetch affiliate ID for share links
    const fetchAffiliateId = async () => {
      try {
        const affRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/affiliate/my-affiliate-id`,
          { headers: { Authorization: `Bearer ${getToken()}` } }
        );
        const affData = await affRes.json();
        if (affData.success && affData.affiliateId) {
          setAffiliateId(affData.affiliateId);
        }
      } catch (error) {
        console.error("Error fetching affiliate ID:", error);
      }
    };
    fetchAffiliateId();
  }, []);

  // Fetch testimonials
  useEffect(() => {
    const fetchData = async () => {
      if (founderLoading) return;

      setLoading(true);
      try {
        const data = await getTestimonials({
          status: selectedStatus === "all" ? undefined : selectedStatus,
          category: selectedCategory === "ALL" ? undefined : selectedCategory,
        });
        setTestimonials(data.testimonials);
        setCategories(data.categories);
      } catch (error) {
        console.error("Error fetching testimonials:", error);
        toast.error("Failed to load testimonials");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [founderLoading, selectedStatus, selectedCategory]);

  // Filter testimonials by search
  const filteredTestimonials = testimonials.filter((testimonial) => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        testimonial.title.toLowerCase().includes(query) ||
        testimonial.clientName.toLowerCase().includes(query) ||
        testimonial.shortDescription?.toLowerCase().includes(query) ||
        testimonial.categories?.some((cat) => cat.toLowerCase().includes(query))
      );
    }
    return true;
  });

  // Open testimonial edit view
  const openTestimonialEdit = async (testimonial: TestimonialListItem) => {
    try {
      const data = await getTestimonial(testimonial._id);
      setEditingTestimonial(data.testimonial);
    } catch (error) {
      console.error("Error fetching testimonial:", error);
      toast.error("Failed to load testimonial details");
    }
  };

  // Handle delete testimonial
  const handleDeleteTestimonial = async (testimonialId: string) => {
    try {
      await deleteTestimonial(testimonialId);
      setTestimonials((prev) => prev.filter((t) => t._id !== testimonialId));
      toast.success("Testimonial deleted successfully");
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting testimonial:", error);
      toast.error("Failed to delete testimonial");
    }
  };

  // Refresh testimonials
  const refreshTestimonials = async () => {
    try {
      const data = await getTestimonials({
        status: selectedStatus === "all" ? undefined : selectedStatus,
        category: selectedCategory === "ALL" ? undefined : selectedCategory,
      });
      setTestimonials(data.testimonials);
      setCategories(data.categories);
    } catch (error) {
      console.error("Error refreshing testimonials:", error);
    }
  };

  // Robust clipboard copy with fallback for production environments
  const copyToClipboard = async (text: string): Promise<boolean> => {
    // Try modern Clipboard API first
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fall through to fallback
      }
    }
    // Fallback: temporary textarea + execCommand
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "-9999px";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  };

  // Handle share for a specific testimonial
  const handleShareTestimonial = async (testimonialSlug: string, testimonialId: string) => {
    if (!orgSlug) {
      toast.error("Organization not loaded yet. Please refresh.");
      return;
    }
    if (shareStates[testimonialId] === "loading" || shareStates[testimonialId] === "copied") return;

    setShareStates(prev => ({ ...prev, [testimonialId]: "loading" }));
    const base = `${window.location.origin}/guest/${orgSlug}/testimonials/${testimonialSlug}`;
    const shareLink = affiliateId ? `${base}?referCode=${affiliateId}` : base;

    const success = await copyToClipboard(shareLink);
    if (success) {
      setShareStates(prev => ({ ...prev, [testimonialId]: "copied" }));
      toast.success("Share link copied!");
      setTimeout(() => setShareStates(prev => ({ ...prev, [testimonialId]: "idle" })), 2000);
    } else {
      toast.error("Failed to copy link");
      setShareStates(prev => ({ ...prev, [testimonialId]: "idle" }));
    }
  };

  if (loading || founderLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#0b0b0d]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <div className="w-12 h-12 rounded-full border-2 border-brand border-t-transparent" />
        </motion.div>
      </div>
    );
  }

  // Not a founder - show access denied
  if (!amIFounder) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#0b0b0d] text-center p-6">
        <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center mb-4">
          <Star className="h-8 w-8 text-brand" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Founders Only</h2>
        <p className="text-[#9fa0b8] max-w-md">
          Client testimonials management is only available to founders. Please contact your organization founder if you need access.
        </p>
      </div>
    );
  }

  // Create View
  if (showCreateView) {
    return (
      <TestimonialCreateView
        onBack={() => {
          setShowCreateView(false);
          refreshTestimonials();
        }}
        onSuccess={() => {
          setShowCreateView(false);
          refreshTestimonials();
        }}
        existingCategories={categories}
      />
    );
  }

  // Edit View
  if (editingTestimonial) {
    return (
      <TestimonialEditView
        testimonial={editingTestimonial}
        onBack={() => {
          setEditingTestimonial(null);
          refreshTestimonials();
        }}
        onUpdate={(updated) => setEditingTestimonial(updated)}
        existingCategories={categories}
      />
    );
  }

  // Main List View
  return (
    <div className="h-full w-full flex flex-col bg-[#0b0b0d]">
      {/* Header */}
      <div className="border-b border-[#2a2a35] bg-gradient-to-r from-[#0e0e12] to-[#131318] px-4 sm:px-6 pt-4 sm:pt-5">
        {/* Title Row */}
        <div className="flex items-center justify-between gap-3 sm:gap-4 mb-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] flex items-center justify-center shadow-lg shadow-brand/20">
              <Star className="h-5 w-5 sm:h-6 sm:w-6 text-brand-foreground" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                Client Testimonials
              </h1>
              <p className="text-xs sm:text-sm text-[#9fa0b8] mt-0.5">
                Showcase your client success stories
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {orgSlug && (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  variant="outline"
                  onClick={() => window.open(`/guest/${orgSlug}/testimonials`, '_blank')}
                  className="border-[#2a2a35] text-white hover:bg-[#1a1a22] h-10 sm:h-11 px-4"
                >
                  <ExternalLink className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">View Public Page</span>
                </Button>
              </motion.div>
            )}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => setShowCreateView(true)}
                className="bg-linear-to-r from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] hover:from-[color:color-mix(in_srgb,var(--brand)_92%,black)] hover:to-[color:color-mix(in_srgb,var(--brand)_84%,black)] text-brand-foreground font-semibold h-10 sm:h-11 px-4 sm:px-5 shadow-lg shadow-brand/20"
              >
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Testimonial</span>
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
            <Input
              placeholder="Search testimonials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full pl-10 bg-[#1a1a22]/50 border-[#2a2a35] text-white placeholder:text-[#6b6b7b] focus:border-brand/50 focus:ring-brand/20"
            />
          </div>

          <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)}>
            <SelectTrigger className="w-[130px] h-10 bg-[#1a1a22]/50 border-[#2a2a35] text-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-[#1e1e2d] border-[#2a2a35]">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          <div className="hidden sm:flex items-center gap-1 p-1 bg-[#1a1a22] rounded-lg border border-[#2a2a35]">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-2 h-8 w-8",
                viewMode === "grid" ? "bg-brand text-brand-foreground" : "text-[#9fa0b8] hover:text-white"
              )}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("list")}
              className={cn(
                "p-2 h-8 w-8",
                viewMode === "list" ? "bg-brand text-brand-foreground" : "text-[#9fa0b8] hover:text-white"
              )}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-2 pb-4 overflow-x-auto scrollbar-hide">
          <CategoryChip
            category="ALL"
            isActive={selectedCategory === "ALL"}
            onClick={() => setSelectedCategory("ALL")}
          />
          {categories.map((category) => (
            <CategoryChip
              key={category}
              category={category}
              isActive={selectedCategory === category}
              onClick={() => setSelectedCategory(category)}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {filteredTestimonials.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-full bg-[#1e1e2d] flex items-center justify-center mb-4">
              <Star className="h-8 w-8 text-[#9fa0b8]" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No testimonials yet</h3>
            <p className="text-[#9fa0b8] mb-4 max-w-sm">
              Start showcasing your client success stories by adding your first testimonial.
            </p>
            <Button
              onClick={() => setShowCreateView(true)}
              className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Testimonial
            </Button>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className={cn(
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                : "flex flex-col gap-3"
            )}
          >
            {filteredTestimonials.map((testimonial) => (
              <motion.div
                key={testimonial._id}
                variants={fadeInUp}
                layout
                className={cn(
                  "group bg-[#1e1e2d] rounded-xl border border-[#2a2a35] overflow-hidden hover:border-brand/30 transition-all cursor-pointer",
                  testimonial.isFeatured && "ring-1 ring-brand/50"
                )}
                onClick={() => openTestimonialEdit(testimonial)}
              >
                {/* Cover Image */}
                {testimonial.coverImage && (
                  <div className="relative h-40 overflow-hidden">
                    <img
                      src={testimonial.coverImage}
                      alt={testimonial.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e2d] to-transparent" />
                    {testimonial.isFeatured && (
                      <div className="absolute top-3 left-3 px-2 py-1 bg-brand text-brand-foreground text-xs font-semibold rounded">
                        Featured
                      </div>
                    )}
                  </div>
                )}

                <div className="p-4">
                  {/* Client Info */}
                  <div className="flex items-center gap-3 mb-3">
                    {testimonial.clientLogo ? (
                      <img
                        src={testimonial.clientLogo}
                        alt={testimonial.clientName}
                        className="w-10 h-10 rounded-lg object-cover bg-[#2a2a35]"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[#2a2a35] flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-[#9fa0b8]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">
                        {testimonial.clientName}
                      </h4>
                      {testimonial.clientIndustry && (
                        <p className="text-xs text-[#9fa0b8]">{testimonial.clientIndustry}</p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#1e1e2d] border-[#2a2a35]">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openTestimonialEdit(testimonial);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[#2a2a35]" />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(testimonial._id);
                          }}
                          className="text-red-400"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Categories */}
                  {testimonial.categories && testimonial.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {testimonial.categories.slice(0, 2).map((cat) => (
                        <span
                          key={cat}
                          className="px-2 py-0.5 bg-brand/10 text-brand text-xs rounded"
                        >
                          {cat}
                        </span>
                      ))}
                      {testimonial.categories.length > 2 && (
                        <span className="px-2 py-0.5 bg-[#2a2a35] text-[#9fa0b8] text-xs rounded">
                          +{testimonial.categories.length - 2}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Title */}
                  <h3 className="text-base font-semibold text-white mb-2 line-clamp-2">
                    {testimonial.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-[#9fa0b8] line-clamp-2 mb-3">
                    {testimonial.shortDescription}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#2a2a35]">
                    <StatusBadge status={testimonial.status} />
                    <div className="flex items-center gap-2">
                      {testimonial.status === "published" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShareTestimonial(testimonial.slug, testimonial._id);
                          }}
                          className={cn(
                            "p-1.5 rounded-md transition-all",
                            shareStates[testimonial._id] === "copied"
                              ? "bg-green-500/20 text-green-400"
                              : "text-[#6b6b7b] hover:text-brand hover:bg-brand/10"
                          )}
                          title="Copy share link"
                        >
                          {shareStates[testimonial._id] === "loading" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : shareStates[testimonial._id] === "copied" ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Share2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                      {testimonial.publishedAt && (
                        <span className="text-xs text-[#6b6b7b]">
                          {new Date(testimonial.publishedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <AlertDialogContent className="bg-[#1e1e2d] border-[#2a2a35]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Testimonial</AlertDialogTitle>
            <AlertDialogDescription className="text-[#9fa0b8]">
              Are you sure you want to delete this testimonial? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#2a2a35] border-[#3a3a45] text-white hover:bg-[#3a3a45]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteConfirm && handleDeleteTestimonial(showDeleteConfirm)}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============= Create View Component =============

interface TestimonialCreateViewProps {
  onBack: () => void;
  onSuccess: () => void;
  existingCategories: string[];
}

function TestimonialCreateView({ onBack, onSuccess, existingCategories }: TestimonialCreateViewProps) {
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeSection, setActiveSection] = useState<"client" | "details" | "quote" | "media">("client");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Section navigation
  const sectionOrder: Array<"client" | "details" | "quote" | "media"> = ["client", "details", "quote", "media"];
  const currentSectionIndex = sectionOrder.indexOf(activeSection);
  const isFirstSection = currentSectionIndex === 0;
  const isLastSection = currentSectionIndex === sectionOrder.length - 1;

  const goToNextSection = () => {
    if (!isLastSection) {
      setActiveSection(sectionOrder[currentSectionIndex + 1]);
    }
  };

  const goToPreviousSection = () => {
    if (!isFirstSection) {
      setActiveSection(sectionOrder[currentSectionIndex - 1]);
    }
  };

  // Form state
  const [formData, setFormData] = useState<CreateTestimonialData>({
    clientName: "",
    clientLogo: "",
    clientWebsite: "",
    clientIndustry: "",
    title: "",
    shortDescription: "",
    coverImage: "",
    featuredImage: "",
    categories: [],
    tags: [],
    primaryQuote: "",
    primaryQuoteAuthor: "",
    primaryQuoteAuthorRole: "",
    metrics: [],
    artifactUrl: "",
    artifactLabel: "",
    isFeatured: false,
    status: "draft",
    isPublic: false,
  });

  const [newCategory, setNewCategory] = useState("");
  const [newTag, setNewTag] = useState("");

  // Handle image upload
  const handleImageUpload = async (
    file: File,
    field: "clientLogo" | "coverImage" | "featuredImage"
  ) => {
    setUploadingImage(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload?orgId=${getOrgId()}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
          body: uploadFormData,
        }
      );

      const data = await response.json();
      if (data.url) {
        setFormData((prev) => ({ ...prev, [field]: data.url }));
        toast.success("Image uploaded successfully");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!formData.clientName || !formData.title || !formData.shortDescription) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      await createTestimonial(formData);
      toast.success("Testimonial created successfully");
      onSuccess();
    } catch (error) {
      console.error("Error creating testimonial:", error);
      toast.error("Failed to create testimonial");
    } finally {
      setSaving(false);
    }
  };

  // Handle publish
  const handlePublish = async () => {
    if (!formData.clientName || !formData.title || !formData.shortDescription) {
      toast.error("Please fill in all required fields");
      return;
    }

    setPublishing(true);
    try {
      await createTestimonial({ ...formData, status: "published", isPublic: true });
      toast.success("Testimonial published successfully");
      onSuccess();
    } catch (error) {
      console.error("Error publishing testimonial:", error);
      toast.error("Failed to publish testimonial");
    } finally {
      setPublishing(false);
    }
  };

  // Add category
  const addCategory = () => {
    if (newCategory.trim() && !formData.categories?.includes(newCategory.trim())) {
      setFormData((prev) => ({
        ...prev,
        categories: [...(prev.categories || []), newCategory.trim().toUpperCase()],
      }));
      setNewCategory("");
    }
  };

  // Remove category
  const removeCategory = (cat: string) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories?.filter((c) => c !== cat) || [],
    }));
  };

  // Add tag
  const addTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()],
      }));
      setNewTag("");
    }
  };

  // Remove tag
  const removeTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags?.filter((t) => t !== tag) || [],
    }));
  };

  // Add metric
  const addMetric = () => {
    setFormData((prev) => ({
      ...prev,
      metrics: [...(prev.metrics || []), { label: "", value: "", description: "" }],
    }));
  };

  // Update metric
  const updateMetric = (index: number, field: keyof Metric, value: string) => {
    setFormData((prev) => ({
      ...prev,
      metrics: prev.metrics?.map((m, i) => (i === index ? { ...m, [field]: value } : m)) || [],
    }));
  };

  // Remove metric
  const removeMetric = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      metrics: prev.metrics?.filter((_, i) => i !== index) || [],
    }));
  };

  // Check if current section is complete
  const isSectionComplete = (section: string) => {
    switch (section) {
      case "client":
        return !!formData.clientName;
      case "details":
        return !!formData.title && !!formData.shortDescription;
      case "quote":
        return true; // Optional
      case "media":
        return true; // Optional
      default:
        return false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0b0b0d] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a35] bg-[#0e0e12] shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="text-[#9fa0b8] hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>
          <div className="h-6 w-px bg-[#2a2a35]" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-brand/20 to-brand/5 flex items-center justify-center">
              <Star className="h-5 w-5 text-brand" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Create Testimonial</h3>
              <p className="text-xs text-[#6b6b7b]">Showcase your client success story</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section Tabs with Navigation */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#2a2a35] bg-[#0e0e12]/80 backdrop-blur-sm shrink-0">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide py-2">
          {[
            { key: "client", label: "Client Info", icon: Building2, required: true },
            { key: "details", label: "Details", icon: FileText, required: true },
            { key: "quote", label: "Quote & Metrics", icon: Quote, required: false },
            { key: "media", label: "Media & Settings", icon: ImageIcon, required: false },
          ].map(({ key, label, icon: Icon, required }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key as typeof activeSection)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap relative",
                activeSection === key
                  ? "bg-brand/10 text-brand"
                  : "text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {required && !isSectionComplete(key) && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
              {isSectionComplete(key) && (
                <CheckCircle className="h-3.5 w-3.5 text-green-500 ml-1" />
              )}
            </button>
          ))}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-3 ml-4">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPreviousSection}
              disabled={isFirstSection}
              className={cn(
                "text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]",
                isFirstSection && "opacity-50 cursor-not-allowed"
              )}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1.5 px-3">
              {sectionOrder.map((section, index) => (
                <div
                  key={section}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    index === currentSectionIndex
                      ? "bg-brand scale-125"
                      : isSectionComplete(section)
                        ? "bg-green-500"
                        : "bg-[#2a2a35]"
                  )}
                />
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextSection}
              disabled={isLastSection}
              className={cn(
                "text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]",
                isLastSection && "opacity-50 cursor-not-allowed"
              )}
            >
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </Button>
          </div>

          <div className="h-6 w-px bg-[#2a2a35]" />

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              disabled={saving || publishing || !formData.clientName || !formData.title || !formData.shortDescription}
              className="border-[#2a2a35] text-white hover:bg-[#1a1a22] font-medium px-4"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1.5" />
                  Save Draft
                </>
              )}
            </Button>

            <Button
              size="sm"
              onClick={handlePublish}
              disabled={saving || publishing || !formData.clientName || !formData.title || !formData.shortDescription}
              className="bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] font-semibold px-4"
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1.5" />
                  Publish
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Client Information Section */}
          {activeSection === "client" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-[#2a2a35]">
                  <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-brand" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Client Information</h2>
                    <p className="text-sm text-[#6b6b7b]">Details about your client</p>
                  </div>
                </div>

                {/* Client Logo Upload - Featured */}
                <div className="flex items-start gap-6">
                  <div className="shrink-0">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "clientLogo")}
                    />
                    {formData.clientLogo ? (
                      <div className="relative group">
                        <img
                          src={formData.clientLogo}
                          alt="Client logo"
                          className="w-24 h-24 rounded-xl object-cover border-2 border-[#2a2a35]"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                          <button
                            onClick={() => logoInputRef.current?.click()}
                            className="p-2 bg-white/20 rounded-lg hover:bg-white/30"
                          >
                            <Edit className="h-4 w-4 text-white" />
                          </button>
                          <button
                            onClick={() => setFormData((prev) => ({ ...prev, clientLogo: "" }))}
                            className="p-2 bg-red-500/50 rounded-lg hover:bg-red-500/70"
                          >
                            <Trash2 className="h-4 w-4 text-white" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => logoInputRef.current?.click()}
                        className="w-24 h-24 rounded-xl border-2 border-dashed border-[#2a2a35] flex flex-col items-center justify-center cursor-pointer hover:border-brand transition-colors bg-[#1a1a22]"
                      >
                        {uploadingImage ? (
                          <Loader2 className="h-6 w-6 text-[#9fa0b8] animate-spin" />
                        ) : (
                          <>
                            <Upload className="h-6 w-6 text-[#6b6b7b] mb-1" />
                            <span className="text-xs text-[#6b6b7b]">Logo</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div className="col-span-2 sm:col-span-1">
                      <Label className="text-white mb-2 flex items-center gap-1">
                        Client Name <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        value={formData.clientName}
                        onChange={(e) => setFormData((prev) => ({ ...prev, clientName: e.target.value }))}
                        placeholder="e.g., Acme Inc"
                        className="bg-[#1a1a22] border-[#2a2a35] text-white h-11"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <Label className="text-white mb-2">Industry</Label>
                      <Input
                        value={formData.clientIndustry || ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, clientIndustry: e.target.value }))}
                        placeholder="e.g., Technology, Healthcare"
                        className="bg-[#1a1a22] border-[#2a2a35] text-white h-11"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label className="text-white mb-2">Website</Label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b6b7b]" />
                        <Input
                          value={formData.clientWebsite || ""}
                          onChange={(e) => setFormData((prev) => ({ ...prev, clientWebsite: e.target.value }))}
                          placeholder="https://example.com"
                          className="bg-[#1a1a22] border-[#2a2a35] text-white h-11 pl-10"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick tip card */}
              <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                  <Star className="h-4 w-4 text-brand" />
                </div>
                <div>
                  <p className="text-sm font-medium text-brand">Pro Tip</p>
                  <p className="text-sm text-[#9fa0b8] mt-0.5">
                    Adding a client logo and website helps build credibility and makes your testimonial more visually appealing.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Details Section */}
          {activeSection === "details" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-[#2a2a35]">
                  <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-brand" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Testimonial Details</h2>
                    <p className="text-sm text-[#6b6b7b]">The main content of your testimonial</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-1">
                    Title <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value.slice(0, 150) }))}
                    placeholder="e.g., How Acme transformed their workflow with our solution"
                    className="bg-[#1a1a22] border-[#2a2a35] text-white h-11"
                    maxLength={150}
                  />
                  <p className="text-xs text-[#6b6b7b]">{formData.title.length}/150 characters</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-1">
                    Short Description <span className="text-red-400">*</span>
                  </Label>
                  <Textarea
                    value={formData.shortDescription}
                    onChange={(e) => setFormData((prev) => ({ ...prev, shortDescription: e.target.value.slice(0, 300) }))}
                    placeholder="Brief summary for card preview (2-3 sentences)..."
                    className="bg-[#1a1a22] border-[#2a2a35] text-white resize-none min-h-[100px]"
                    maxLength={300}
                  />
                  <p className="text-xs text-[#6b6b7b]">{formData.shortDescription.length}/300 characters</p>
                </div>
              </div>

              {/* Categories & Tags */}
              <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-[#2a2a35]">
                  <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
                    <Tag className="h-5 w-5 text-brand" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Categories & Tags</h2>
                    <p className="text-sm text-[#6b6b7b]">Help visitors find relevant testimonials</p>
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <Label className="text-white mb-3">Categories</Label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.categories?.map((cat) => (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 text-brand rounded-lg text-sm font-medium"
                      >
                        {cat}
                        <button onClick={() => removeCategory(cat)} className="hover:text-white ml-1">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="Add category..."
                      className="flex-1 bg-[#1a1a22] border-[#2a2a35] text-white h-10"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())}
                    />
                    <Button onClick={addCategory} className="bg-[#1a1a22] border border-[#2a2a35] text-white hover:bg-[#2a2a35] h-10">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {existingCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <span className="text-xs text-[#6b6b7b] mr-1">Existing:</span>
                      {existingCategories
                        .filter((c) => !formData.categories?.includes(c))
                        .map((cat) => (
                          <button
                            key={cat}
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                categories: [...(prev.categories || []), cat],
                              }))
                            }
                            className="px-2 py-1 bg-[#2a2a35] text-[#9fa0b8] text-xs rounded-md hover:bg-[#3a3a45] hover:text-white transition-colors"
                          >
                            + {cat}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div>
                  <Label className="text-white mb-3">Tags</Label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2a2a35] text-[#9fa0b8] rounded-lg text-sm"
                      >
                        #{tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-white ml-1">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Add tag..."
                      className="flex-1 bg-[#1a1a22] border-[#2a2a35] text-white h-10"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                    />
                    <Button onClick={addTag} className="bg-[#1a1a22] border border-[#2a2a35] text-white hover:bg-[#2a2a35] h-10">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Quote & Metrics Section */}
          {activeSection === "quote" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Primary Quote */}
              <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-[#2a2a35]">
                  <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
                    <Quote className="h-5 w-5 text-brand" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Primary Quote</h2>
                    <p className="text-sm text-[#6b6b7b]">The main testimonial from your client</p>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute left-4 top-4 text-4xl text-brand/20 font-serif">"</div>
                  <Textarea
                    value={formData.primaryQuote || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, primaryQuote: e.target.value }))}
                    placeholder="The main testimonial quote from your client..."
                    className="bg-[#1a1a22] border-[#2a2a35] text-white resize-none min-h-[140px] pl-12 pt-6 text-lg"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <Label className="text-white mb-2">Author Name</Label>
                    <Input
                      value={formData.primaryQuoteAuthor || ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, primaryQuoteAuthor: e.target.value }))}
                      placeholder="e.g., John Smith"
                      className="bg-[#1a1a22] border-[#2a2a35] text-white h-11"
                    />
                  </div>
                  <div>
                    <Label className="text-white mb-2">Author Role</Label>
                    <Input
                      value={formData.primaryQuoteAuthorRole || ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, primaryQuoteAuthorRole: e.target.value }))}
                      placeholder="e.g., CEO, Product Manager"
                      className="bg-[#1a1a22] border-[#2a2a35] text-white h-11"
                    />
                  </div>
                </div>
              </div>

              {/* Results & Metrics */}
              <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[#2a2a35]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-brand" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">Results & Metrics</h2>
                      <p className="text-sm text-[#6b6b7b]">Quantifiable achievements</p>
                    </div>
                  </div>
                  <Button
                    onClick={addMetric}
                    size="sm"
                    className="bg-brand/10 text-brand hover:bg-brand/20 border-0"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Metric
                  </Button>
                </div>

                {formData.metrics && formData.metrics.length > 0 ? (
                  <div className="space-y-3">
                    {formData.metrics.map((metric, index) => (
                      <div key={index} className="flex items-center gap-3 p-4 bg-[#1a1a22] rounded-xl border border-[#2a2a35]">
                        <div className="w-10 h-10 rounded-lg bg-[#2a2a35] flex items-center justify-center shrink-0">
                          <span className="text-lg font-bold text-brand">{index + 1}</span>
                        </div>
                        <Input
                          value={metric.label}
                          onChange={(e) => updateMetric(index, "label", e.target.value)}
                          placeholder="Label (e.g., Revenue Increase)"
                          className="flex-1 bg-transparent border-[#2a2a35] text-white h-10"
                        />
                        <Input
                          value={metric.value}
                          onChange={(e) => updateMetric(index, "value", e.target.value)}
                          placeholder="Value (e.g., 150%)"
                          className="w-36 bg-transparent border-[#2a2a35] text-white text-center font-semibold h-10"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMetric(index)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-[#6b6b7b]">
                    <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No metrics added yet</p>
                    <p className="text-xs mt-1">Click "Add Metric" to showcase your results</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Media & Settings Section */}
          {activeSection === "media" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Cover Image */}
              <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-[#2a2a35]">
                  <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-brand" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Cover Image</h2>
                    <p className="text-sm text-[#6b6b7b]">Main visual for your testimonial card</p>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "coverImage")}
                />

                {formData.coverImage ? (
                  <div className="relative group">
                    <img
                      src={formData.coverImage}
                      alt="Cover"
                      className="w-full h-56 object-cover rounded-xl border border-[#2a2a35]"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 text-white text-sm font-medium flex items-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Change
                      </button>
                      <button
                        onClick={() => setFormData((prev) => ({ ...prev, coverImage: "" }))}
                        className="px-4 py-2 bg-red-500/50 rounded-lg hover:bg-red-500/70 text-white text-sm font-medium flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-56 bg-[#1a1a22] border-2 border-dashed border-[#2a2a35] rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-brand transition-colors"
                  >
                    {uploadingImage ? (
                      <Loader2 className="w-10 h-10 text-[#9fa0b8] animate-spin" />
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-2xl bg-[#2a2a35] flex items-center justify-center mb-4">
                          <Upload className="w-8 h-8 text-[#6b6b7b]" />
                        </div>
                        <p className="text-base text-white font-medium">Click to upload cover image</p>
                        <p className="text-sm text-[#6b6b7b] mt-1">PNG, JPG up to 5MB</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Live Artifact */}
              <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-[#2a2a35]">
                  <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
                    <Link2 className="h-5 w-5 text-brand" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Live Artifact</h2>
                    <p className="text-sm text-[#6b6b7b]">Link to a live demo or project</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white mb-2">Artifact URL</Label>
                    <Input
                      value={formData.artifactUrl || ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, artifactUrl: e.target.value }))}
                      placeholder="https://..."
                      className="bg-[#1a1a22] border-[#2a2a35] text-white h-11"
                    />
                  </div>
                  <div>
                    <Label className="text-white mb-2">Button Label</Label>
                    <Input
                      value={formData.artifactLabel || ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, artifactLabel: e.target.value }))}
                      placeholder="e.g., View Live Demo"
                      className="bg-[#1a1a22] border-[#2a2a35] text-white h-11"
                    />
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-[#2a2a35]">
                  <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
                    <Star className="h-5 w-5 text-brand" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Settings</h2>
                    <p className="text-sm text-[#6b6b7b]">Display options for this testimonial</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#1a1a22] rounded-xl border border-[#2a2a35]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand/20 flex items-center justify-center">
                      <Star className="h-5 w-5 text-brand" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Featured Testimonial</p>
                      <p className="text-sm text-[#6b6b7b]">Show this testimonial prominently</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isFeatured || false}
                      onChange={(e) => setFormData((prev) => ({ ...prev, isFeatured: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#2a2a35] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============= Edit View Component =============

interface TestimonialEditViewProps {
  testimonial: Testimonial;
  onBack: () => void;
  onUpdate: (testimonial: Testimonial) => void;
  existingCategories: string[];
}

function TestimonialEditView({
  testimonial,
  onBack,
  onUpdate,
  existingCategories,
}: TestimonialEditViewProps) {
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeSection, setActiveSection] = useState<"details" | "content" | "settings">("details");

  // Form state
  const [formData, setFormData] = useState({
    clientName: testimonial.clientName,
    clientLogo: testimonial.clientLogo || "",
    clientWebsite: testimonial.clientWebsite || "",
    clientIndustry: testimonial.clientIndustry || "",
    title: testimonial.title,
    shortDescription: testimonial.shortDescription,
    coverImage: testimonial.coverImage || "",
    featuredImage: testimonial.featuredImage || "",
    categories: testimonial.categories || [],
    tags: testimonial.tags || [],
    primaryQuote: testimonial.primaryQuote || "",
    primaryQuoteAuthor: testimonial.primaryQuoteAuthor || "",
    primaryQuoteAuthorRole: testimonial.primaryQuoteAuthorRole || "",
    metrics: testimonial.metrics || [],
    artifactUrl: testimonial.artifactUrl || "",
    artifactLabel: testimonial.artifactLabel || "",
    isFeatured: testimonial.isFeatured,
    status: testimonial.status,
    isPublic: testimonial.isPublic,
  });

  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>(
    testimonial.contentBlocks || []
  );
  const [newCategory, setNewCategory] = useState("");
  const [newTag, setNewTag] = useState("");

  // Handle image upload
  const handleImageUpload = async (
    file: File,
    field: "clientLogo" | "coverImage" | "featuredImage"
  ) => {
    setUploadingImage(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload?orgId=${getOrgId()}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
          body: formDataUpload,
        }
      );

      const data = await response.json();
      if (data.url) {
        setFormData((prev) => ({ ...prev, [field]: data.url }));
        toast.success("Image uploaded successfully");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!formData.clientName || !formData.title || !formData.shortDescription) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const result = await updateTestimonial(testimonial._id, {
        ...formData,
        contentBlocks: contentBlocks,
      });
      onUpdate(result.testimonial);
      toast.success("Testimonial saved successfully");
    } catch (error) {
      console.error("Error saving testimonial:", error);
      toast.error("Failed to save testimonial");
    } finally {
      setSaving(false);
    }
  };

  // Handle publish
  const handlePublish = async () => {
    setPublishing(true);
    try {
      // First save
      await updateTestimonial(testimonial._id, {
        ...formData,
        contentBlocks: contentBlocks,
      });
      // Then publish
      const result = await publishTestimonial(testimonial._id);
      onUpdate(result.testimonial);
      toast.success("Testimonial published successfully!");
    } catch (error) {
      console.error("Error publishing testimonial:", error);
      toast.error("Failed to publish testimonial");
    } finally {
      setPublishing(false);
    }
  };

  // Add category
  const addCategory = () => {
    if (newCategory.trim() && !formData.categories?.includes(newCategory.trim())) {
      setFormData((prev) => ({
        ...prev,
        categories: [...(prev.categories || []), newCategory.trim().toUpperCase()],
      }));
      setNewCategory("");
    }
  };

  // Remove category
  const removeCategory = (cat: string) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories?.filter((c) => c !== cat) || [],
    }));
  };

  // Add tag
  const addTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()],
      }));
      setNewTag("");
    }
  };

  // Remove tag
  const removeTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags?.filter((t) => t !== tag) || [],
    }));
  };

  // Add metric
  const addMetric = () => {
    setFormData((prev) => ({
      ...prev,
      metrics: [...(prev.metrics || []), { label: "", value: "", description: "" }],
    }));
  };

  // Update metric
  const updateMetricField = (index: number, field: keyof Metric, value: string) => {
    setFormData((prev) => ({
      ...prev,
      metrics: prev.metrics?.map((m, i) => (i === index ? { ...m, [field]: value } : m)) || [],
    }));
  };

  // Remove metric
  const removeMetric = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      metrics: prev.metrics?.filter((_, i) => i !== index) || [],
    }));
  };

  // Content block handlers
  const handleAddBlock = async (type: ContentBlock["type"]) => {
    try {
      const blockData: CreateContentBlockData = { type };

      // Set default content based on type
      if (type === "text") blockData.content = "";
      if (type === "quote") {
        blockData.quoteText = "";
        blockData.quoteAuthor = "";
      }

      const result = await addContentBlock(testimonial._id, blockData);
      setContentBlocks(result.testimonial.contentBlocks);
      toast.success("Content block added");
    } catch (error) {
      console.error("Error adding block:", error);
      toast.error("Failed to add content block");
    }
  };

  const handleUpdateBlock = async (blockId: string, data: Partial<CreateContentBlockData>) => {
    try {
      const result = await updateContentBlock(testimonial._id, blockId, data);
      setContentBlocks(result.testimonial.contentBlocks);
    } catch (error) {
      console.error("Error updating block:", error);
      toast.error("Failed to update content block");
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    try {
      const result = await deleteContentBlock(testimonial._id, blockId);
      setContentBlocks(result.testimonial.contentBlocks);
      toast.success("Content block deleted");
    } catch (error) {
      console.error("Error deleting block:", error);
      toast.error("Failed to delete content block");
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#0b0b0d]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2a2a35] bg-gradient-to-r from-[#0e0e12] to-[#131318] px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-[#9fa0b8] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="h-6 w-px bg-[#2a2a35]" />
          <div>
            <h1 className="text-lg font-semibold text-white">{formData.title || "Edit Testimonial"}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={formData.status} />
              {formData.isFeatured && (
                <span className="px-2 py-0.5 bg-brand/20 text-brand text-xs rounded">
                  Featured
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            variant="outline"
            className="border-[#2a2a35] text-white"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
          {formData.status !== "published" && (
            <Button
              onClick={handlePublish}
              disabled={publishing}
              className="bg-gradient-to-r from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] hover:from-[color:color-mix(in_srgb,var(--brand)_92%,black)] hover:to-[color:color-mix(in_srgb,var(--brand)_84%,black)] text-brand-foreground font-semibold"
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Globe className="h-4 w-4 mr-2" />
              )}
              Publish
            </Button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-[#2a2a35] bg-[#0e0e12] px-4 sm:px-6">
        <div className="flex gap-1">
          {[
            { id: "details", label: "Details", icon: FileText },
            { id: "content", label: "Content Blocks", icon: Type },
            { id: "settings", label: "Settings", icon: Eye },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                activeSection === tab.id
                  ? "text-brand border-brand"
                  : "text-[#9fa0b8] border-transparent hover:text-white"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          {activeSection === "details" && (
            <div className="space-y-8">
              {/* Client Information */}
              <section className="bg-[#1e1e2d] rounded-xl border border-[#2a2a35] p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-brand" />
                  Client Information
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[#9fa0b8] mb-2">Client Name *</Label>
                    <Input
                      value={formData.clientName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, clientName: e.target.value }))}
                      placeholder="e.g., Acme Inc"
                      className="bg-[#1a1a22] border-[#2a2a35] text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-[#9fa0b8] mb-2">Industry</Label>
                    <Input
                      value={formData.clientIndustry}
                      onChange={(e) => setFormData((prev) => ({ ...prev, clientIndustry: e.target.value }))}
                      placeholder="e.g., Technology"
                      className="bg-[#1a1a22] border-[#2a2a35] text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-[#9fa0b8] mb-2">Website</Label>
                    <Input
                      value={formData.clientWebsite}
                      onChange={(e) => setFormData((prev) => ({ ...prev, clientWebsite: e.target.value }))}
                      placeholder="https://example.com"
                      className="bg-[#1a1a22] border-[#2a2a35] text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-[#9fa0b8] mb-2">Client Logo</Label>
                    <div className="flex items-center gap-3">
                      {formData.clientLogo ? (
                        <img src={formData.clientLogo} alt="Logo" className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-[#2a2a35] flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-[#6b6b7b]" />
                        </div>
                      )}
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "clientLogo")}
                        />
                        <Button variant="outline" size="sm" className="border-[#2a2a35]" disabled={uploadingImage}>
                          {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                          Upload
                        </Button>
                      </label>
                    </div>
                  </div>
                </div>
              </section>

              {/* Testimonial Details */}
              <section className="bg-[#1e1e2d] rounded-xl border border-[#2a2a35] p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-brand" />
                  Testimonial Details
                </h2>

                <div className="space-y-4">
                  <div>
                    <Label className="text-[#9fa0b8] mb-2">Title *</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                      className="bg-[#1a1a22] border-[#2a2a35] text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-[#9fa0b8] mb-2">Short Description *</Label>
                    <Textarea
                      value={formData.shortDescription}
                      onChange={(e) => setFormData((prev) => ({ ...prev, shortDescription: e.target.value }))}
                      className="bg-[#1a1a22] border-[#2a2a35] text-white resize-none"
                      rows={3}
                    />
                  </div>

                  {/* Cover Image */}
                  <div>
                    <Label className="text-[#9fa0b8] mb-2">Cover Image</Label>
                    <div className="border-2 border-dashed border-[#2a2a35] rounded-lg p-4">
                      {formData.coverImage ? (
                        <div className="relative">
                          <img src={formData.coverImage} alt="Cover" className="w-full h-48 object-cover rounded-lg" />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70"
                            onClick={() => setFormData((prev) => ({ ...prev, coverImage: "" }))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center justify-center py-8">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "coverImage")}
                          />
                          <ImageIcon className="h-8 w-8 text-[#6b6b7b] mb-2" />
                          <span className="text-sm text-[#9fa0b8]">
                            {uploadingImage ? "Uploading..." : "Click to upload"}
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Categories & Tags */}
              <section className="bg-[#1e1e2d] rounded-xl border border-[#2a2a35] p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Tag className="h-5 w-5 text-brand" />
                  Categories & Tags
                </h2>

                <div className="mb-4">
                  <Label className="text-[#9fa0b8] mb-2">Categories</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.categories?.map((cat) => (
                      <span key={cat} className="inline-flex items-center gap-1 px-3 py-1 bg-brand/20 text-brand rounded-full text-sm">
                        {cat}
                        <button onClick={() => removeCategory(cat)}><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="Add category..."
                      className="flex-1 bg-[#1a1a22] border-[#2a2a35] text-white"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())}
                    />
                    <Button onClick={addCategory} variant="outline" className="border-[#2a2a35]">Add</Button>
                  </div>
                </div>

                <div>
                  <Label className="text-[#9fa0b8] mb-2">Tags</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.tags?.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-[#2a2a35] text-[#9fa0b8] rounded-full text-sm">
                        {tag}
                        <button onClick={() => removeTag(tag)}><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Add tag..."
                      className="flex-1 bg-[#1a1a22] border-[#2a2a35] text-white"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                    />
                    <Button onClick={addTag} variant="outline" className="border-[#2a2a35]">Add</Button>
                  </div>
                </div>
              </section>

              {/* Primary Quote */}
              <section className="bg-[#1e1e2d] rounded-xl border border-[#2a2a35] p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Quote className="h-5 w-5 text-brand" />
                  Primary Quote
                </h2>

                <div className="space-y-4">
                  <Textarea
                    value={formData.primaryQuote}
                    onChange={(e) => setFormData((prev) => ({ ...prev, primaryQuote: e.target.value }))}
                    placeholder="The main testimonial quote..."
                    className="bg-[#1a1a22] border-[#2a2a35] text-white resize-none"
                    rows={4}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      value={formData.primaryQuoteAuthor}
                      onChange={(e) => setFormData((prev) => ({ ...prev, primaryQuoteAuthor: e.target.value }))}
                      placeholder="Author name"
                      className="bg-[#1a1a22] border-[#2a2a35] text-white"
                    />
                    <Input
                      value={formData.primaryQuoteAuthorRole}
                      onChange={(e) => setFormData((prev) => ({ ...prev, primaryQuoteAuthorRole: e.target.value }))}
                      placeholder="Author role"
                      className="bg-[#1a1a22] border-[#2a2a35] text-white"
                    />
                  </div>
                </div>
              </section>

              {/* Metrics */}
              <section className="bg-[#1e1e2d] rounded-xl border border-[#2a2a35] p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-brand" />
                  Metrics
                </h2>

                <div className="space-y-3">
                  {formData.metrics?.map((metric, index) => (
                    <div key={index} className="flex items-center gap-3 bg-[#1a1a22] rounded-lg p-3">
                      <Input
                        value={metric.label}
                        onChange={(e) => updateMetricField(index, "label", e.target.value)}
                        placeholder="Label"
                        className="flex-1 bg-transparent border-[#2a2a35] text-white"
                      />
                      <Input
                        value={metric.value}
                        onChange={(e) => updateMetricField(index, "value", e.target.value)}
                        placeholder="Value"
                        className="w-32 bg-transparent border-[#2a2a35] text-white"
                      />
                      <Button variant="ghost" size="sm" onClick={() => removeMetric(index)} className="text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button onClick={addMetric} variant="outline" className="border-[#2a2a35]">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Metric
                  </Button>
                </div>
              </section>

              {/* Artifact */}
              <section className="bg-[#1e1e2d] rounded-xl border border-[#2a2a35] p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-brand" />
                  Live Artifact
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    value={formData.artifactUrl}
                    onChange={(e) => setFormData((prev) => ({ ...prev, artifactUrl: e.target.value }))}
                    placeholder="URL"
                    className="bg-[#1a1a22] border-[#2a2a35] text-white"
                  />
                  <Input
                    value={formData.artifactLabel}
                    onChange={(e) => setFormData((prev) => ({ ...prev, artifactLabel: e.target.value }))}
                    placeholder="Label"
                    className="bg-[#1a1a22] border-[#2a2a35] text-white"
                  />
                </div>
              </section>
            </div>
          )}

          {activeSection === "content" && (
            <div className="space-y-4">
              {/* Add Block Buttons */}
              <div className="bg-[#1e1e2d] rounded-xl border border-[#2a2a35] p-4">
                <h3 className="text-sm font-medium text-white mb-3">Add Content Block</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { type: "text" as const, icon: Type, label: "Text" },
                    { type: "image" as const, icon: ImageIcon, label: "Image" },
                    { type: "video" as const, icon: Video, label: "Video" },
                    { type: "youtube" as const, icon: Youtube, label: "YouTube" },
                    { type: "gallery" as const, icon: Images, label: "Gallery" },
                    { type: "quote" as const, icon: Quote, label: "Quote" },
                  ].map((item) => (
                    <Button
                      key={item.type}
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddBlock(item.type)}
                      className="border-[#2a2a35] text-[#9fa0b8] hover:text-white"
                    >
                      <item.icon className="h-4 w-4 mr-2" />
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Content Blocks */}
              {contentBlocks.length === 0 ? (
                <div className="bg-[#1e1e2d] rounded-xl border border-[#2a2a35] p-8 text-center">
                  <Type className="h-12 w-12 text-[#6b6b7b] mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-white mb-2">No content blocks yet</h3>
                  <p className="text-[#9fa0b8]">Add content blocks to create your testimonial story.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {contentBlocks
                    .sort((a, b) => a.order - b.order)
                    .map((block) => (
                      <ContentBlockItem
                        key={block._id}
                        block={block}
                        onUpdate={(data) => handleUpdateBlock(block._id, data)}
                        onDelete={() => handleDeleteBlock(block._id)}
                      />
                    ))}
                </div>
              )}
            </div>
          )}

          {activeSection === "settings" && (
            <div className="bg-[#1e1e2d] rounded-xl border border-[#2a2a35] p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Settings</h2>

              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isFeatured}
                    onChange={(e) => setFormData((prev) => ({ ...prev, isFeatured: e.target.checked }))}
                    className="w-5 h-5 rounded border-[#2a2a35] bg-[#1a1a22] text-brand"
                  />
                  <div>
                    <span className="text-white font-medium">Featured Testimonial</span>
                    <p className="text-sm text-[#9fa0b8]">Featured testimonials appear larger and first in the showcase.</p>
                  </div>
                </label>

                <div className="pt-4 border-t border-[#2a2a35]">
                  <Label className="text-[#9fa0b8] mb-2">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v as any }))}
                  >
                    <SelectTrigger className="w-48 bg-[#1a1a22] border-[#2a2a35] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e1e2d] border-[#2a2a35]">
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============= Content Block Item Component =============

interface ContentBlockItemProps {
  block: ContentBlock;
  onUpdate: (data: Partial<CreateContentBlockData>) => void;
  onDelete: () => void;
}

function ContentBlockItem({ block, onUpdate, onDelete }: ContentBlockItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);

  const blockIcons = {
    text: Type,
    image: ImageIcon,
    video: Video,
    youtube: Youtube,
    gallery: Images,
    quote: Quote,
  };

  const Icon = blockIcons[block.type];

  const handleImageUpload = async (file: File, field: string) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload?orgId=${getOrgId()}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
          body: formData,
        }
      );

      const data = await response.json();
      if (data.url) {
        onUpdate({ [field]: data.url });
        toast.success("Image uploaded");
      }
    } catch (error) {
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="bg-[#1e1e2d] rounded-xl border border-[#2a2a35] overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#252530]"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <GripVertical className="h-4 w-4 text-[#6b6b7b]" />
          <div className="w-8 h-8 rounded bg-brand/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-brand" />
          </div>
          <span className="text-white font-medium capitalize">{block.type} Block</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-red-400 hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-[#9fa0b8]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[#9fa0b8]" />
          )}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-[#2a2a35]"
          >
            <div className="p-4">
              {block.type === "text" && (
                <RichTextEditor
                  value={block.content || ""}
                  onChange={(content) => onUpdate({ content })}
                  placeholder="Enter your text content..."
                  minHeight="200px"
                />
              )}

              {block.type === "image" && (
                <div className="space-y-4">
                  {block.imageUrl ? (
                    <div className="relative">
                      <img src={block.imageUrl} alt="" className="w-full h-48 object-cover rounded-lg" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 bg-black/50"
                        onClick={() => onUpdate({ imageUrl: "" })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer border-2 border-dashed border-[#2a2a35] rounded-lg p-8 flex flex-col items-center">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "imageUrl")}
                      />
                      <ImageIcon className="h-8 w-8 text-[#6b6b7b] mb-2" />
                      <span className="text-sm text-[#9fa0b8]">
                        {uploadingImage ? "Uploading..." : "Click to upload image"}
                      </span>
                    </label>
                  )}
                  <Input
                    value={block.imageCaption || ""}
                    onChange={(e) => onUpdate({ imageCaption: e.target.value })}
                    placeholder="Image caption (optional)"
                    className="bg-[#1a1a22] border-[#2a2a35] text-white"
                  />
                </div>
              )}

              {block.type === "youtube" && (
                <div className="space-y-4">
                  <Input
                    value={block.youtubeUrl || ""}
                    onChange={(e) => {
                      const url = e.target.value;
                      const id = extractYoutubeId(url);
                      onUpdate({ youtubeUrl: url, youtubeId: id || undefined });
                    }}
                    placeholder="YouTube URL (e.g., https://youtube.com/watch?v=...)"
                    className="bg-[#1a1a22] border-[#2a2a35] text-white"
                  />
                  {block.youtubeId && (
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                      <iframe
                        src={`https://www.youtube.com/embed/${block.youtubeId}`}
                        className="absolute inset-0 w-full h-full"
                        allowFullScreen
                      />
                    </div>
                  )}
                </div>
              )}

              {block.type === "quote" && (
                <div className="space-y-4">
                  <Textarea
                    value={block.quoteText || ""}
                    onChange={(e) => onUpdate({ quoteText: e.target.value })}
                    placeholder="Quote text..."
                    className="bg-[#1a1a22] border-[#2a2a35] text-white resize-none"
                    rows={3}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      value={block.quoteAuthor || ""}
                      onChange={(e) => onUpdate({ quoteAuthor: e.target.value })}
                      placeholder="Author name"
                      className="bg-[#1a1a22] border-[#2a2a35] text-white"
                    />
                    <Input
                      value={block.quoteRole || ""}
                      onChange={(e) => onUpdate({ quoteRole: e.target.value })}
                      placeholder="Author role"
                      className="bg-[#1a1a22] border-[#2a2a35] text-white"
                    />
                  </div>
                </div>
              )}

              {block.type === "video" && (
                <div className="space-y-4">
                  {block.videoUrl ? (
                    <div className="relative">
                      <video src={block.videoUrl} controls className="w-full rounded-lg" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 bg-black/50"
                        onClick={() => onUpdate({ videoUrl: "" })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer border-2 border-dashed border-[#2a2a35] rounded-lg p-8 flex flex-col items-center">
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "videoUrl")}
                      />
                      <Video className="h-8 w-8 text-[#6b6b7b] mb-2" />
                      <span className="text-sm text-[#9fa0b8]">
                        {uploadingImage ? "Uploading..." : "Click to upload video"}
                      </span>
                    </label>
                  )}
                </div>
              )}

              {block.type === "gallery" && (
                <div className="text-center py-8 text-[#9fa0b8]">
                  Gallery editor coming soon...
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

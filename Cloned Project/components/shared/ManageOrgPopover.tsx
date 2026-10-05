"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Building,
  Crop,
  MapPin,
  Save,
  X,
  Loader2,
  Link,
  Check,
  Trash2,
  AlertTriangle,
  Palette,
  Type,
  Mail,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import CountryNamePicker from "@/components/ui/country-name-picker";
import OrgKycSection from "@/components/shared/OrgKycSection";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { notifyBrandingChanged } from "@/lib/brand-color-context";
import { UploadThingFileUpload } from "@/components/ui/uploadthing-file-upload";
import ImageCropDialog, { type CropState } from "@/components/shared/ImageCropDialog";
import { uploadFiles } from "@/lib/uploadthing";
import {
  resolveCropSource,
  resolveOriginalToRemember,
  writeCoverOriginal,
} from "@/lib/coverOriginal";
import {
  OrgWelcomeEmailSection,
  type OrgWelcomeEmailValue,
} from "@/components/shared/OrgWelcomeEmailSection";
import {
  DEFAULT_ORG_WELCOME_TEMPLATE_ID,
  DEFAULT_ORG_WELCOME_TEMPLATE_NAME,
} from "@/lib/org-welcome-email-template";

const NO_CATEGORY_SENTINEL = "__none__";

/**
 * The public organization profile on garage.app paints the cover as a 3.2:1
 * panoramic banner (≈1500×460). Framing against anything else here would mean
 * what the founder sees is not what visitors get, so this is the one number
 * both surfaces agree on.
 */
const COVER_ASPECT = 3.2;
/** Longest edge exported by the cropper — 1500 wide at the banner's ratio. */
const COVER_OUTPUT_WIDTH = 1500;
/** Client-side guard on the picked file. The backend enforces its own limit. */
const COVER_MAX_MB = 10;

interface ManageOrgPopoverProps {
  isOpen: boolean;
  onClose: () => void;
}

interface OrganizationData {
  _id: string;
  name: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  description?: string;
  headingText?: string;
  subHeadingText?: string;
  icon?: string;
  coverPhoto?: string;
  promoVideoLink?: string;
  // Additional branding fields
  colored_logo?: string;
  white_logo?: string;
  colored_icon?: string;
  white_icon?: string;
  website_meta_title?: string;
  website_meta_description?: string;
  office_public?: boolean;
  category?: string;
  font?: string;
  branding?: {
    primaryColor?: string;
  };
  /**
   * Which template the join-welcome email uses. `templateHtml` is a rendered
   * snapshot of the founder's Network Mail template — that service authenticates
   * with the browser's JWT, so the backend cannot fetch it at send time.
   */
  welcomeEmail?: {
    templateId?: string;
    templateName?: string;
    templateHtml?: string;
    syncedAt?: string;
  };
}

// Optional typography choice. `value` is stamped straight into
// `style={{ fontFamily }}` on consumer surfaces — empty = inherit app default.
const SYSTEM_DEFAULT_FONT = "system-default";

const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "System default", value: SYSTEM_DEFAULT_FONT },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "Open Sans", value: "'Open Sans', sans-serif" },
  { label: "Lato", value: "Lato, sans-serif" },
  { label: "Poppins", value: "Poppins, sans-serif" },
  { label: "Montserrat", value: "Montserrat, sans-serif" },
  { label: "Nunito", value: "Nunito, sans-serif" },
  { label: "Raleway", value: "Raleway, sans-serif" },
  { label: "Work Sans", value: "'Work Sans', sans-serif" },
  { label: "Source Sans 3", value: "'Source Sans 3', sans-serif" },
  { label: "IBM Plex Sans", value: "'IBM Plex Sans', sans-serif" },
  { label: "Ubuntu", value: "Ubuntu, sans-serif" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "Merriweather", value: "Merriweather, serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
];

const PRESET_COLORS = [
  { name: "Garage Yellow", value: "#FBD10D" },
  { name: "Ocean Blue", value: "#3B82F6" },
  { name: "Emerald", value: "#10B981" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Rose", value: "#F43F5E" },
  { name: "Orange", value: "#F97316" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Indigo", value: "#6366F1" },
];

/**
 * The two cover buttons, shared by the mobile and desktop layouts so they can't
 * drift apart. "Upload & Adjust" is the primary path — a cover picked here is
 * framed before it is uploaded at all — and "Crop (Fill & Fit)" reopens the
 * cropper on whatever cover the org already has.
 */
function CoverFramingControls({
  hasCover,
  busy,
  onPick,
  onReframe,
}: {
  hasCover: boolean;
  busy: boolean;
  onPick: () => void;
  onReframe: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      <button
        type="button"
        onClick={onPick}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg border border-brand-2/50 bg-brand-2/10 px-3 py-1.5 text-xs font-semibold text-brand-2 transition-colors hover:bg-brand-2/20 disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Crop className="h-3.5 w-3.5" />
        )}
        Upload &amp; Adjust
      </button>

      {hasCover && (
        <button
          type="button"
          onClick={onReframe}
          disabled={busy}
          title="Reframe the cover you already have"
          className="flex items-center gap-1.5 rounded-lg border border-[#2a2a35] px-3 py-1.5 text-xs font-medium text-[#9fa0b8] transition-colors hover:border-brand-2/50 hover:text-white disabled:opacity-40"
        >
          <Crop className="h-3.5 w-3.5" />
          Crop (Fill &amp; Fit)
        </button>
      )}

      <span className="text-[11px] text-[#6a6a7a]">
        Framed at {COVER_ASPECT}:1 — the profile banner&apos;s shape
      </span>
    </div>
  );
}

export function ManageOrgPopover({ isOpen, onClose }: ManageOrgPopoverProps) {
  const orgId =
    window !== undefined ? localStorage.getItem("garage_org_id") || "" : "";

  const [orgData, setOrgData] = useState<OrganizationData>({
    _id: "",
    name: "",
    location: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    description: "",
    headingText: "",
    subHeadingText: "",
    icon: "",
    coverPhoto: "",
    promoVideoLink: "",
    colored_logo: "",
    white_logo: "",
    colored_icon: "",
    white_icon: "",
    website_meta_title: "",
    website_meta_description: "",
    office_public: false,
    category: "",
    font: "",
    branding: { primaryColor: "#FBD10D" },
  });

  // Category suggestions state — populated from GET /org/categories,
  // which now reads the admin-managed OrgCategory collection. No
  // hardcoded fallback list; free-text input was removed as part of
  // the admin-taxonomy rollout (any category the founder can pick
  // MUST come from the admin list).
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);

  // Join-welcome email. The template picker owns the selection; the rendered
  // HTML is pushed back up by the section so it can be snapshotted on save.
  const [welcomeEmail, setWelcomeEmail] = useState<OrgWelcomeEmailValue>({
    templateId: DEFAULT_ORG_WELCOME_TEMPLATE_ID,
    templateName: DEFAULT_ORG_WELCOME_TEMPLATE_NAME,
  });
  const [welcomeEmailHtml, setWelcomeEmailHtml] = useState<string | null>(null);
  // Why the HTML is missing, when the section knows. Null while still loading.
  const [welcomeEmailFailure, setWelcomeEmailFailure] = useState<string | null>(
    null
  );
  // The form is written twice (mobile card stack + desktop panel). Everything
  // else duplicates harmlessly, but the email section fetches templates and
  // renders a preview iframe, so only the visible layout mounts it.
  const [isDesktopLayout, setIsDesktopLayout] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [postalCodeLoading, setPostalCodeLoading] = useState(false);
  const [postalCodeError, setPostalCodeError] = useState("");
  const postalCodeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Cover photo framing ───
  // A cover is never uploaded raw: it goes through the cropper first, so the
  // file that lands on the org is already the banner the profile renders.
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [showCoverCropper, setShowCoverCropper] = useState(false);
  /** What the dialog is editing — a file picked this session, or a hosted URL. */
  const [cropSource, setCropSource] = useState<File | string | null>(null);
  /** URL of `cropSource` when it is already hosted, so it isn't re-uploaded. */
  const [cropSourceOriginalUrl, setCropSourceOriginalUrl] = useState<string | null>(
    null
  );
  /** Framing to reopen on, in the ORIGINAL image's coordinates. */
  const [coverCropState, setCoverCropState] = useState<CropState | null>(null);
  /** The fuller image the saved cover was cropped from, when we still have it. */
  const [coverOriginalUrl, setCoverOriginalUrl] = useState<string | null>(null);
  const [coverSourceFile, setCoverSourceFile] = useState<File | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (isOpen && orgId) {
      fetchOrgData();
      fetchCategories();
    }
  }, [isOpen, orgId]);

  // Matches the `md:` breakpoint the two layouts switch on.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktopLayout(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  // Fetch admin-managed categories. Any string the founder can pick
  // MUST come from here (BE rejects unknown values). Empty on error —
  // founder can still save without a category (empty is allowed).
  async function fetchCategories() {
    try {
      const res = await api<{ categories: string[] }>("/org/categories", {
        method: "GET",
      });
      setCategorySuggestions(res.categories || []);
    } catch {
      setCategorySuggestions([]);
    }
  }

  const resolvePostalCode = async (pincode: string) => {
    if (pincode.length < 3) {
      setPostalCodeError("");
      return;
    }
    setPostalCodeLoading(true);
    setPostalCodeError("");
    try {
      const res = await api<{
        city: string;
        state: string;
        country: string;
        latitude: number;
        longitude: number;
      }>(`/org/resolve-pincode?pincode=${encodeURIComponent(pincode)}`, {
        method: "GET",
      });
      setOrgData((prev) => ({
        ...prev,
        city: res.city || "",
        state: res.state || "",
        country: res.country || "",
      }));
    } catch {
      setPostalCodeError("Could not resolve postal code. Please fill manually.");
    } finally {
      setPostalCodeLoading(false);
    }
  };

  const handlePostalCodeChange = (value: string) => {
    setOrgData((prev) => ({ ...prev, postalCode: value }));
    if (postalCodeTimerRef.current) clearTimeout(postalCodeTimerRef.current);
    if (value.length >= 3) {
      postalCodeTimerRef.current = setTimeout(() => {
        resolvePostalCode(value);
      }, 800);
    }
  };

  const fetchOrgData = async () => {
    try {
      setIsLoading(true);
      const response = await api<{
        org: OrganizationData;
        membership: { role: string; joinedAt: string };
      }>(`/org/${orgId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const fetchedOrg = response.org;
      if (!fetchedOrg.branding) {
        fetchedOrg.branding = { primaryColor: "#FBD10D" };
      } else if (!fetchedOrg.branding.primaryColor) {
        fetchedOrg.branding.primaryColor = "#FBD10D";
      }
      setOrgData(fetchedOrg);
      setWelcomeEmail({
        templateId:
          fetchedOrg.welcomeEmail?.templateId || DEFAULT_ORG_WELCOME_TEMPLATE_ID,
        templateName:
          fetchedOrg.welcomeEmail?.templateName ||
          DEFAULT_ORG_WELCOME_TEMPLATE_NAME,
      });
      // Stands in until the section re-resolves it, so a save that never
      // touches the email section keeps the existing snapshot.
      setWelcomeEmailHtml(fetchedOrg.welcomeEmail?.templateHtml || null);
      setWelcomeEmailFailure(null);
    } catch (error) {
      console.error("Error fetching organization data:", error);
      toast.error("Failed to load organization details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleWelcomeEmailHtml = useCallback(
    (html: string | null, failure?: string | null) => {
      setWelcomeEmailHtml(html);
      setWelcomeEmailFailure(failure ?? null);
    },
    []
  );

  const welcomeEmailPreviewOrg = useMemo(
    () => ({
      name: orgData.name,
      description: orgData.description,
      city: orgData.city,
      state: orgData.state,
      country: orgData.country,
      icon: orgData.icon,
    }),
    [
      orgData.name,
      orgData.description,
      orgData.city,
      orgData.state,
      orgData.country,
      orgData.icon,
    ]
  );

  const uploadCoverFile = async (file: File): Promise<string> => {
    const [result] = await uploadFiles("organizationCover", { files: [file] });
    if (!result?.url) throw new Error("Upload returned no URL");
    return result.url;
  };

  /** A file picked from disk goes straight into the cropper, never to the org. */
  const handleCoverPicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared immediately so picking the SAME file twice still fires a change.
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file");
      return;
    }
    if (file.size > COVER_MAX_MB * 1024 * 1024) {
      toast.error(`Cover photo must be under ${COVER_MAX_MB}MB`);
      return;
    }
    setCoverSourceFile(file);
    setCoverCropState(null);
    setCoverOriginalUrl(null);
    setCropSourceOriginalUrl(null);
    setCropSource(file);
    setShowCoverCropper(true);
  };

  /**
   * Re-opens the cropper on the fullest image we still have: the file picked
   * this session, else the original remembered from an earlier one, else the
   * saved cover itself (which only allows reframing within what was kept). With
   * nothing at all to open, this is just the upload button.
   */
  const openCoverCropper = () => {
    const resolved = resolveCropSource({
      pickedFile: coverSourceFile,
      pickedFileUrl: coverOriginalUrl,
      pickedFileState: coverCropState,
      coverUrl: orgData.coverPhoto || "",
    });
    if (!resolved) {
      coverInputRef.current?.click();
      return;
    }
    setCoverCropState(resolved.initialState);
    setCoverOriginalUrl(resolved.originalUrl);
    setCropSourceOriginalUrl(resolved.originalUrl);
    setCropSource(resolved.source);
    setShowCoverCropper(true);
  };

  /**
   * Uploads the framed cover. The org record isn't written here — this only
   * fills in `coverPhoto`, and Save is still what publishes it, same as every
   * other field in this form.
   */
  const handleCoverCropped = async (blob: Blob, state: CropState) => {
    setShowCoverCropper(false);
    const source = cropSource;
    if (!source) return;
    // Only meaningful against the image the framing was measured in.
    if (source instanceof File || cropSourceOriginalUrl) setCoverCropState(state);
    setUploadingCover(true);
    try {
      const extension = blob.type === "image/png" ? "png" : "jpg";
      const cropped = new File([blob], `organization-cover.${extension}`, {
        type: blob.type,
      });

      // The untouched upload goes up alongside the crop so a later reframe can
      // reopen the whole picture instead of nudging a banner-shaped sliver.
      // Uploaded in parallel, and a failure there costs only that convenience.
      const [url, uploadedOriginal] = await Promise.all([
        uploadCoverFile(cropped),
        source instanceof File && !cropSourceOriginalUrl
          ? uploadCoverFile(source).catch(() => null)
          : Promise.resolve(null),
      ]);

      const originalUrl = resolveOriginalToRemember({
        croppedFrom: source,
        uploadedOriginalUrl: uploadedOriginal,
        knownOriginalUrl: cropSourceOriginalUrl,
      });
      if (originalUrl) writeCoverOriginal(url, { url: originalUrl, state });
      setCoverOriginalUrl(originalUrl);
      setOrgData((prev) => ({ ...prev, coverPhoto: url }));
      toast.success("Cover photo updated — hit Save to publish it");
    } catch (error) {
      console.error("Error uploading cover photo:", error);
      toast.error("Failed to upload cover photo");
    } finally {
      setUploadingCover(false);
      setCropSource(null);
    }
  };

  /** Clearing the cover drops the framing that went with it. */
  const clearCoverPhoto = () => {
    setOrgData((prev) => ({ ...prev, coverPhoto: "" }));
    setCoverSourceFile(null);
    setCoverCropState(null);
    setCoverOriginalUrl(null);
    setCropSourceOriginalUrl(null);
  };

  const saveOrganization = async () => {
    // A custom template is only ever sent from the stored snapshot, so saving
    // before it resolves would leave the org sending nothing on join. The
    // built-in default needs no snapshot — the backend renders it itself.
    const usingCustomTemplate =
      !!welcomeEmail.templateId &&
      welcomeEmail.templateId !== DEFAULT_ORG_WELCOME_TEMPLATE_ID;
    if (usingCustomTemplate && !welcomeEmailHtml) {
      toast.error(
        welcomeEmailFailure
          ? `Couldn't load your welcome email template (${welcomeEmailFailure}) — pick another template or reopen the builder`
          : "Still loading your welcome email template — try again in a moment"
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await api<{
        message: string;
        org: OrganizationData;
      }>(`/org/${orgId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: orgData.name,
          location: orgData.location,
          city: orgData.city,
          state: orgData.state,
          country: orgData.country,
          postalCode: orgData.postalCode,
          description: orgData.description,
          headingText: orgData.headingText,
          subHeadingText: orgData.subHeadingText,
          icon: orgData.icon,
          coverPhoto: orgData.coverPhoto,
          promoVideoLink: orgData.promoVideoLink,
          colored_logo: orgData.colored_logo,
          white_logo: orgData.white_logo,
          colored_icon: orgData.colored_icon,
          white_icon: orgData.white_icon,
          website_meta_title: orgData.website_meta_title,
          website_meta_description: orgData.website_meta_description,
          office_public: orgData.office_public,
          category: orgData.category,
          font: orgData.font || "",
          welcomeEmail: {
            templateId:
              welcomeEmail.templateId || DEFAULT_ORG_WELCOME_TEMPLATE_ID,
            templateName:
              welcomeEmail.templateName || DEFAULT_ORG_WELCOME_TEMPLATE_NAME,
            // The default carries no snapshot: the backend already owns that
            // layout (workshops included), and storing a copy would freeze it.
            templateHtml: usingCustomTemplate ? welcomeEmailHtml || "" : "",
          },
        }),
      });

      // Update branding primary color
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      let primaryColor = orgData.branding?.primaryColor || "#FBD10D";
      if (!/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
        primaryColor = "#FBD10D";
      }

      await fetch(`${apiUrl}/org/${orgId}/branding`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ primaryColor }),
      });

      // The chrome is painted from this colour — repaint now instead of
      // waiting for the next reload.
      notifyBrandingChanged(orgId);

      onClose();
      toast.success("Organization updated successfully!");

      // Dispatch event to refetch organizations with a small delay
      console.log("Dispatching org:updated event");
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("org:updated"));
      }, 500);
    } catch (error) {
      console.error("Error updating organization:", error);
      toast.error("Failed to update organization");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteOrganization = async () => {
    setIsDeleting(true);
    try {
      await api(`/org/${orgId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
      toast.success("Organization deleted");
      localStorage.removeItem("garage_org_id");
      onClose();
      window.location.href = "/";
    } catch (error) {
      console.error("Error deleting organization:", error);
      toast.error("Failed to delete organization");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Helper: whether pin code resolved successfully
  const pinCodeResolved =
    !postalCodeLoading && !postalCodeError && !!orgData.city;

  if (isLoading) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 hidden md:block"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed top-0 left-0 right-0 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 z-50 md:w-4xl md:max-w-[90vw] bg-black md:bg-[#0e0e12]/98 md:border md:border-[#2a2a35] md:backdrop-blur-xl md:rounded-xl md:shadow-2xl flex items-center justify-center"
            >
              <div className="p-8 flex flex-col md:flex-row items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-brand-2" />
                <span className="text-[#c7c7da] text-center">
                  Loading organization details...
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay - hidden on mobile since we use full screen */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] hidden md:block"
              onClick={onClose}
            />

            {/* Organization Management Popover - Full screen on mobile, centered modal on desktop */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed top-0 left-0 right-0 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 z-[1000] md:w-4xl md:max-w-[90vw] md:max-h-[90vh] bg-black md:bg-[#0e0e12]/98 md:border md:border-[#2a2a35] md:backdrop-blur-xl md:rounded-xl md:shadow-2xl flex flex-col md:h-auto overflow-hidden"
            >
              {/* Mobile Header - Cancel/Done at top */}
              <div className="flex md:hidden items-center justify-between px-4 py-3 pt-[calc(env(safe-area-inset-top)+12px)] bg-black flex-shrink-0">
                <button
                  onClick={onClose}
                  className="text-brand-2 text-[17px] font-normal active:opacity-70 transition-opacity"
                >
                  Cancel
                </button>
                <div className="flex-1"></div>
                <button
                  onClick={saveOrganization}
                  disabled={isSubmitting || !orgData.name}
                  className="text-brand-2 text-[17px] font-semibold active:opacity-70 transition-opacity disabled:opacity-40 disabled:text-[#6a6a7a]"
                >
                  {isSubmitting ? "Saving..." : "Done"}
                </button>
              </div>

              {/* Desktop Header */}
              <div className="hidden md:block p-4 border-b border-[#2a2a35]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Building className="h-5 w-5 text-brand-2" />
                      <h3 className="text-lg font-semibold text-white">
                        Manage Organization
                      </h3>
                      <p className="text-sm text-[#9fa0b8]">
                        Update your organization details
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-[#1a1a22] hover:bg-[#2a2a35] flex items-center justify-center transition-all duration-200 hover:scale-105"
                  >
                    <X className="h-4 w-4 text-[#6a6a7a]" />
                  </button>
                </div>
              </div>

              {/* Form Content - Scrollable */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
                {/* Mobile Form Content */}
                <div className="md:hidden px-4 space-y-4 pb-[calc(env(safe-area-inset-bottom)+32px)] pt-4">
                  {/* Organization Icon Preview - Mobile */}
                  {orgData.icon && (
                    <div className="flex flex-col items-center pb-4">
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-[#1a1a22] border-2 border-[#2a2a35]">
                        <img
                          src={orgData.icon}
                          alt="Organization"
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => setOrgData((prev) => ({ ...prev, icon: "" }))}
                          className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                        >
                          <X className="h-3 w-3 text-white" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Name Card */}
                  <div className="bg-[#1a1a22] rounded-2xl overflow-hidden">
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Building className="h-5 w-5 text-[#6a6a7a]" />
                        <Input
                          value={orgData.name}
                          onChange={(e) =>
                            setOrgData((prev) => ({ ...prev, name: e.target.value }))
                          }
                          className="h-auto p-0 bg-transparent border-0 text-white text-lg placeholder-[#6a6a7a] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          placeholder="Organization Name *"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[#6a6a7a] px-2">
                    Enter your organization name.
                  </p>

                  {/* Location Card */}
                  {/* No overflow-hidden: the country picker's dropdown is
                      absolutely positioned inside this card and would be
                      clipped to a single row's height. The rows carry no
                      background of their own, so the rounded corners still
                      read correctly without it. */}
                  <div className="bg-[#1a1a22] rounded-2xl">
                    <div className="px-4 py-3 border-b border-[#2a2a35]/50">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-[#6a6a7a]" />
                        <Input
                          value={orgData.location || ""}
                          onChange={(e) =>
                            setOrgData((prev) => ({ ...prev, location: e.target.value }))
                          }
                          className="h-auto p-0 bg-transparent border-0 text-white placeholder-[#6a6a7a] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          placeholder="Street Address"
                        />
                      </div>
                    </div>
                    <div className="px-4 py-3 border-b border-[#2a2a35]/50">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-[#6a6a7a]" />
                        <Input
                          value={orgData.postalCode || ""}
                          onChange={(e) => handlePostalCodeChange(e.target.value)}
                          className="h-auto p-0 bg-transparent border-0 text-white placeholder-[#6a6a7a] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          placeholder="Postal Code"
                        />
                        {postalCodeLoading && (
                          <Loader2 className="h-4 w-4 animate-spin text-[#6a6a7a] flex-shrink-0" />
                        )}
                        {pinCodeResolved && (
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        )}
                      </div>
                      {postalCodeError && (
                        <p className="text-xs text-red-400 mt-1 pl-8">
                          {postalCodeError}
                        </p>
                      )}
                    </div>
                    <div className="px-4 py-3 border-b border-[#2a2a35]/50">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 flex-shrink-0 text-[#6a6a7a]" />
                        <div className="flex-1 min-w-0">
                          <CountryNamePicker
                            value={orgData.country || ""}
                            onChange={(name) =>
                              setOrgData((prev) => ({ ...prev, country: name }))
                            }
                            placeholder="Country"
                            hideIcon
                            className="h-9 border-0 bg-transparent px-0 hover:border-0"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-3 border-b border-[#2a2a35]/50">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-[#6a6a7a]" />
                        <Input
                          value={orgData.state || ""}
                          onChange={(e) =>
                            setOrgData((prev) => ({ ...prev, state: e.target.value }))
                          }
                          className="h-auto p-0 bg-transparent border-0 text-white placeholder-[#6a6a7a] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          placeholder="State"
                        />
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-[#6a6a7a]" />
                        <Input
                          value={orgData.city || ""}
                          onChange={(e) =>
                            setOrgData((prev) => ({ ...prev, city: e.target.value }))
                          }
                          className="h-auto p-0 bg-transparent border-0 text-white placeholder-[#6a6a7a] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          placeholder="City"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[#6a6a7a] px-2">
                    Country, state and city will be filled based on your postal code.
                  </p>

                  {/* Description Card */}
                  <div className="bg-[#1a1a22] rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#2a2a35]/50">
                      <Textarea
                        value={orgData.description || ""}
                        onChange={(e) =>
                          setOrgData((prev) => ({ ...prev, description: e.target.value }))
                        }
                        className="min-h-20 p-0 bg-transparent border-0 text-white placeholder-[#6a6a7a] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none"
                        placeholder="Organization Description"
                      />
                    </div>
                    <div className="px-4 py-3 border-b border-[#2a2a35]/50">
                      <Input
                        value={orgData.headingText || ""}
                        onChange={(e) =>
                          setOrgData((prev) => ({ ...prev, headingText: e.target.value }))
                        }
                        className="h-auto p-0 bg-transparent border-0 text-white placeholder-[#6a6a7a] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        placeholder="Heading Text"
                      />
                    </div>
                    <div className="px-4 py-3">
                      <Input
                        value={orgData.subHeadingText || ""}
                        onChange={(e) =>
                          setOrgData((prev) => ({ ...prev, subHeadingText: e.target.value }))
                        }
                        className="h-auto p-0 bg-transparent border-0 text-white placeholder-[#6a6a7a] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        placeholder="Sub Heading Text"
                      />
                    </div>
                  </div>

                  {/* Media Card */}
                  <div className="pt-4">
                    <p className="text-xs text-[#6a6a7a] uppercase tracking-wider px-2 mb-3">
                      Media & Links
                    </p>
                    <div className="bg-[#1a1a22] rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-[#2a2a35]/50">
                        <Label className="text-xs text-[#6a6a7a] mb-2 block">Organization Icon</Label>
                        <UploadThingFileUpload
                          endpoint="organizationIcon"
                          currentUrl={orgData.icon || ""}
                          onUploadComplete={(url) => setOrgData((prev) => ({ ...prev, icon: url }))}
                          onRemove={() => setOrgData((prev) => ({ ...prev, icon: "" }))}
                          placeholder="Upload icon"
                          description="256x256px recommended"
                          maxSize={2}
                        />
                      </div>
                      <div className="px-4 py-3 border-b border-[#2a2a35]/50">
                        <Label className="text-xs text-[#6a6a7a] mb-2 block">Cover Photo</Label>
                        {orgData.coverPhoto && (
                          <div className="relative mb-2">
                            {/* Shown at the profile banner's real ratio, so this
                                preview is exactly what garage.app renders. */}
                            <div
                              style={{ aspectRatio: String(COVER_ASPECT) }}
                              className="relative w-full rounded-lg overflow-hidden border border-[#2a2a35] bg-[#131316]"
                            >
                              <img
                                src={orgData.coverPhoto}
                                alt="Cover"
                                className="w-full h-full object-cover"
                              />
                              {uploadingCover && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                  <Loader2 className="h-5 w-5 animate-spin text-brand-2" />
                                </div>
                              )}
                            </div>
                            <button
                              onClick={clearCoverPhoto}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                            >
                              <X className="h-3 w-3 text-white" />
                            </button>
                          </div>
                        )}

                        <CoverFramingControls
                          hasCover={!!orgData.coverPhoto}
                          busy={uploadingCover}
                          onPick={() => coverInputRef.current?.click()}
                          onReframe={openCoverCropper}
                        />

                        <UploadThingFileUpload
                          endpoint="organizationCover"
                          currentUrl={orgData.coverPhoto || ""}
                          onUploadComplete={(url) => setOrgData((prev) => ({ ...prev, coverPhoto: url }))}
                          onRemove={clearCoverPhoto}
                          placeholder="Upload cover"
                          description="1500x460px (3.2:1) recommended"
                          maxSize={5}
                        />
                      </div>
                      <div className="px-4 py-3 flex items-center gap-3">
                        <Link className="h-5 w-5 text-[#6a6a7a]" />
                        <Input
                          value={orgData.promoVideoLink || ""}
                          onChange={(e) =>
                            setOrgData((prev) => ({ ...prev, promoVideoLink: e.target.value }))
                          }
                          className="h-auto p-0 bg-transparent border-0 text-white placeholder-[#6a6a7a] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          placeholder="Promo Video URL"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Branding Color Card - Mobile */}
                  <div className="pt-4">
                    <p className="text-xs text-[#6a6a7a] uppercase tracking-wider px-2 mb-3">
                      Branding Color
                    </p>
                    <div className="bg-[#1a1a22] rounded-2xl p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Palette className="h-5 w-5 text-[#6a6a7a]" />
                          <span className="text-white font-medium text-sm">Primary Accent Color</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border border-white/20"
                            style={{ backgroundColor: orgData.branding?.primaryColor || "#FBD10D" }}
                          />
                          <span className="text-xs font-mono text-[#c7c7da]">
                            {(orgData.branding?.primaryColor || "#FBD10D").toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <input
                            type="color"
                            value={orgData.branding?.primaryColor || "#FBD10D"}
                            onChange={(e) =>
                              setOrgData((prev) => ({
                                ...prev,
                                branding: {
                                  ...prev.branding,
                                  primaryColor: e.target.value,
                                },
                              }))
                            }
                            className="w-10 h-10 rounded-xl cursor-pointer border border-[#2a2a35] bg-transparent"
                            style={{ padding: "2px" }}
                          />
                        </div>
                        <input
                          type="text"
                          value={orgData.branding?.primaryColor || "#FBD10D"}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                              setOrgData((prev) => ({
                                ...prev,
                                branding: {
                                  ...prev.branding,
                                  primaryColor: value,
                                },
                              }));
                            }
                          }}
                          placeholder="#FBD10D"
                          className="flex-1 h-10 px-3 rounded-xl bg-[#13131a] border border-[#2a2a35] text-white font-mono text-sm focus:outline-none focus:border-brand-2/50 uppercase"
                          maxLength={7}
                        />
                      </div>

                      {/* Mobile presets list */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {PRESET_COLORS.map((preset) => (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() =>
                              setOrgData((prev) => ({
                                ...prev,
                                branding: {
                                  ...prev.branding,
                                  primaryColor: preset.value,
                                },
                              }))
                            }
                            className={cn(
                              "w-7 h-7 rounded-lg border transition-all active:scale-95",
                              (orgData.branding?.primaryColor || "#FBD10D").toLowerCase() === preset.value.toLowerCase()
                                ? "border-white scale-105 shadow-md"
                                : "border-transparent"
                            )}
                            style={{ backgroundColor: preset.value }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Font Card - Mobile */}
                  <div className="pt-4">
                    <p className="text-xs text-[#6a6a7a] uppercase tracking-wider px-2 mb-3">
                      Typography
                    </p>
                    <div className="bg-[#1a1a22] rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Type className="h-5 w-5 text-[#6a6a7a]" />
                        <span className="text-white font-medium text-sm">Font</span>
                        <span className="ml-auto text-[10px] uppercase tracking-wider text-[#6a6a7a]">
                          Optional
                        </span>
                      </div>
                      <Select
                        value={orgData.font || SYSTEM_DEFAULT_FONT}
                        onValueChange={(value) =>
                          setOrgData((prev) => ({
                            ...prev,
                            font: value === SYSTEM_DEFAULT_FONT ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger
                          className="w-full h-11 bg-[#13131a] border-[#2a2a35] text-white focus:border-brand-2/50 focus:ring-brand-2/20"
                          style={{ fontFamily: orgData.font || undefined }}
                        >
                          <SelectValue placeholder="System default" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0e0e12] border-[#2a2a35] text-white max-h-72">
                          {FONT_OPTIONS.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={opt.value}
                              className="focus:bg-[#1a1a22] focus:text-white"
                            >
                              <span
                                style={{
                                  fontFamily:
                                    opt.value === SYSTEM_DEFAULT_FONT
                                      ? undefined
                                      : opt.value,
                                }}
                              >
                                {opt.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-[#6a6a7a]">
                        Applied across your branded client surfaces.
                      </p>
                    </div>
                  </div>

                  {/* Visibility Card */}
                  <div className="pt-4">
                    <p className="text-xs text-[#6a6a7a] uppercase tracking-wider px-2 mb-3">
                      Visibility & Category
                    </p>
                    <div className="bg-[#1a1a22] rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-[#2a2a35]/50">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-white font-medium">Make Office Public</div>
                            <div className="text-xs text-[#6a6a7a]">
                              {orgData.office_public ? "Visible to public" : "Private"}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setOrgData((prev) => ({ ...prev, office_public: !prev.office_public }))
                            }
                            className={cn(
                              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200",
                              orgData.office_public ? "bg-brand-2" : "bg-[#2a2a35]"
                            )}
                          >
                            <span
                              className={cn(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200",
                                orgData.office_public ? "translate-x-6" : "translate-x-1"
                              )}
                            />
                          </button>
                        </div>
                      </div>
                      <div className="px-4 py-3 space-y-3">
                        {/* Mobile category picker — dropdown of the
                            admin-managed taxonomy (no free-text). */}
                        <Select
                          value={orgData.category || NO_CATEGORY_SENTINEL}
                          onValueChange={(value) =>
                            setOrgData((prev) => ({
                              ...prev,
                              category:
                                value === NO_CATEGORY_SENTINEL ? "" : value,
                            }))
                          }
                        >
                          <SelectTrigger className="w-full h-9 bg-[#1a1a22] border-[#2a2a35] text-white text-sm px-3 hover:bg-[#1a1a22]">
                            <SelectValue placeholder="Category (none)" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#15151d] border-[#2a2a35] text-white max-h-60">
                            <SelectItem
                              value={NO_CATEGORY_SENTINEL}
                              className="text-sm text-[#c7c7da] focus:bg-[#2a2a35] focus:text-white"
                            >
                              Category (none)
                            </SelectItem>
                            {categorySuggestions.map((cat) => (
                              <SelectItem
                                key={cat}
                                value={cat}
                                className="text-sm text-white focus:bg-[#2a2a35] focus:text-white"
                              >
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex flex-wrap gap-2">
                          {categorySuggestions.slice(0, 6).map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setOrgData((prev) => ({ ...prev, category: cat }))}
                              className={cn(
                                "px-2 py-1 text-xs rounded-md transition-colors border",
                                orgData.category === cat
                                  ? "bg-brand-2/20 text-brand-2 border-brand-2/50"
                                  : "bg-[#2a2a35] text-[#c7c7da] border-[#3a3a45]"
                              )}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Welcome Email Card - Mobile */}
                  <div className="pt-4">
                    <p className="text-xs text-[#6a6a7a] uppercase tracking-wider px-2 mb-3">
                      Member Welcome Email
                    </p>
                    <div className="bg-[#1a1a22] rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-[#6a6a7a]" />
                        <span className="text-white font-medium text-sm">
                          Sent automatically when someone joins
                        </span>
                      </div>
                      {!isDesktopLayout && (
                        <OrgWelcomeEmailSection
                          orgId={orgId}
                          value={welcomeEmail}
                          onChange={setWelcomeEmail}
                          onTemplateHtmlChange={handleWelcomeEmailHtml}
                          org={welcomeEmailPreviewOrg}
                        />
                      )}
                    </div>
                  </div>

                  {/* Office Verification (KYC) - Mobile. Renders nothing until
                      an admin has requested documents for this office. */}
                  <div className="pt-4">
                    <p className="text-xs text-[#6a6a7a] uppercase tracking-wider px-2 mb-3">
                      Office Verification
                    </p>
                    <div className="bg-[#1a1a22] rounded-2xl p-4">
                      {!isDesktopLayout && orgId && (
                        <OrgKycSection orgId={orgId} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Desktop Form Content */}
                <div className="hidden md:block p-4 space-y-5">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-2/20 to-[color:color-mix(in_srgb,var(--brand-2)_89%,white)]/20 flex items-center justify-center">
                        <span className="text-brand-2 font-bold text-[10px]">
                          1
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white">
                        Basic Information
                      </h4>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#2a2a35] to-transparent"></div>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="name"
                        className="text-sm font-medium text-[#c7c7da]"
                      >
                        Organization Name *
                      </Label>
                      <Input
                        id="name"
                        value={orgData.name}
                        onChange={(e) =>
                          setOrgData((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        className="h-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200"
                        placeholder="Enter organization name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="location"
                        className="text-sm font-medium text-[#c7c7da]"
                      >
                        Street Address
                      </Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#6a6a7a]" />
                        <Input
                          id="location"
                          value={orgData.location || ""}
                          onChange={(e) =>
                            setOrgData((prev) => ({
                              ...prev,
                              location: e.target.value,
                            }))
                          }
                          className="h-10 pl-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200"
                          placeholder="Enter street address"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="postalCode"
                        className="text-sm font-medium text-[#c7c7da]"
                      >
                        Postal Code
                      </Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#6a6a7a]" />
                        <Input
                          id="postalCode"
                          value={orgData.postalCode || ""}
                          onChange={(e) => handlePostalCodeChange(e.target.value)}
                          className="h-10 pl-10 pr-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200"
                          placeholder="Enter postal code"
                        />
                        {postalCodeLoading && (
                          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-[#6a6a7a]" />
                        )}
                        {pinCodeResolved && (
                          <Check className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
                        )}
                      </div>
                      {postalCodeError && (
                        <p className="text-xs text-red-400">
                          {postalCodeError}
                        </p>
                      )}
                      <p className="text-xs text-[#6a6a7a]">
                        Country, state and city will be filled based on your pin code.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label
                          htmlFor="country"
                          className="text-sm font-medium text-[#c7c7da]"
                        >
                          Country
                        </Label>
                        <CountryNamePicker
                          id="country"
                          value={orgData.country || ""}
                          onChange={(name) =>
                            setOrgData((prev) => ({ ...prev, country: name }))
                          }
                          placeholder="Select country"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="state"
                          className="text-sm font-medium text-[#c7c7da]"
                        >
                          State
                        </Label>
                        <Input
                          id="state"
                          value={orgData.state || ""}
                          onChange={(e) =>
                            setOrgData((prev) => ({
                              ...prev,
                              state: e.target.value,
                            }))
                          }
                          className="h-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200"
                          placeholder="Enter state"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="city"
                          className="text-sm font-medium text-[#c7c7da]"
                        >
                          City
                        </Label>
                        <Input
                          id="city"
                          value={orgData.city || ""}
                          onChange={(e) =>
                            setOrgData((prev) => ({
                              ...prev,
                              city: e.target.value,
                            }))
                          }
                          className="h-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200"
                          placeholder="Enter city"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-2/20 to-[color:color-mix(in_srgb,var(--brand-2)_89%,white)]/20 flex items-center justify-center">
                        <span className="text-brand-2 font-bold text-[10px]">
                          2
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white">
                        Description & Content
                      </h4>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#2a2a35] to-transparent"></div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="description"
                          className="text-sm font-medium text-[#c7c7da]"
                        >
                          Organization Description
                        </Label>
                        <Textarea
                          id="description"
                          value={orgData.description || ""}
                          onChange={(e) =>
                            setOrgData((prev) => ({
                              ...prev,
                              description: e.target.value,
                            }))
                          }
                          className="min-h-20 resize-y bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200"
                          placeholder="Describe your organization..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label
                            htmlFor="headingText"
                            className="text-sm font-medium text-[#c7c7da]"
                          >
                            Heading Text
                          </Label>
                          <Input
                            id="headingText"
                            value={orgData.headingText || ""}
                            onChange={(e) =>
                              setOrgData((prev) => ({
                                ...prev,
                                headingText: e.target.value,
                              }))
                            }
                            className="h-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200"
                            placeholder="Main heading text"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor="subHeadingText"
                            className="text-sm font-medium text-[#c7c7da]"
                          >
                            Sub Heading Text
                          </Label>
                          <Input
                            id="subHeadingText"
                            value={orgData.subHeadingText || ""}
                            onChange={(e) =>
                              setOrgData((prev) => ({
                                ...prev,
                                subHeadingText: e.target.value,
                              }))
                            }
                            className="h-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200"
                            placeholder="Sub heading text"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Media & Links */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#2a2a35] to-[#3a3a45] flex items-center justify-center">
                        <span className="text-[#6a6a7a] font-bold text-[10px]">
                          3
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white">
                        Media & Links
                      </h4>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#2a2a35] to-transparent"></div>
                      <span className="text-xs text-[#6a6a7a] bg-[#1a1a22] px-2 py-1 rounded-md">
                        Optional
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      {/* Organization Icon */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-[#c7c7da]">
                          Organization Icon
                        </Label>
                        {/* Upload Component */}
                        <UploadThingFileUpload
                          endpoint="organizationIcon"
                          currentUrl={orgData.icon || ""}
                          onUploadComplete={(url) => {
                            setOrgData((prev) => ({ ...prev, icon: url }));
                          }}
                          onRemove={() => {
                            setOrgData((prev) => ({ ...prev, icon: "" }));
                          }}
                          placeholder="Upload organization icon"
                          description="Recommended: 256x256px, PNG/JPG"
                          maxSize={2}
                        />
                      </div>

                      {/* Cover Photo */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-[#c7c7da]">
                          Cover Photo
                        </Label>

                        {/* Current Cover Preview — at the profile banner's own
                            3.2:1 ratio, so what's framed here is what shows. */}
                        {orgData.coverPhoto && (
                          <div className="space-y-2">
                            <div className="text-xs text-[#9fa0b8]">
                              Profile banner preview:
                            </div>
                            <div className="relative">
                              <div
                                style={{ aspectRatio: String(COVER_ASPECT) }}
                                className="relative w-full rounded-lg overflow-hidden border border-[#2a2a35] bg-[#131316]"
                              >
                                <img
                                  src={orgData.coverPhoto}
                                  alt="Cover Photo"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                                {uploadingCover && (
                                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-brand-2" />
                                  </div>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={clearCoverPhoto}
                                className="absolute -top-2 -right-2 w-6 h-6 p-0 bg-red-500 hover:bg-red-600 border-red-500"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}

                        <CoverFramingControls
                          hasCover={!!orgData.coverPhoto}
                          busy={uploadingCover}
                          onPick={() => coverInputRef.current?.click()}
                          onReframe={openCoverCropper}
                        />

                        {/* Upload Component */}
                        <UploadThingFileUpload
                          endpoint="organizationCover"
                          currentUrl={orgData.coverPhoto || ""}
                          onUploadComplete={(url) => {
                            setOrgData((prev) => ({ ...prev, coverPhoto: url }));
                          }}
                          onRemove={clearCoverPhoto}
                          placeholder="Upload cover photo"
                          description="Recommended: 1500x460px (3.2:1), PNG/JPG"
                          maxSize={5}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="promoVideoLink"
                        className="text-sm font-medium text-[#c7c7da]"
                      >
                        Promo Video Link
                      </Label>
                      <div className="relative">
                        <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#6a6a7a]" />
                        <Input
                          id="promoVideoLink"
                          value={orgData.promoVideoLink || ""}
                          onChange={(e) =>
                            setOrgData((prev) => ({
                              ...prev,
                              promoVideoLink: e.target.value,
                            }))
                          }
                          className="h-10 pl-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200"
                          placeholder="https://youtube.com/watch?v=..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Branding & SEO */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#2a2a35] to-[#3a3a45] flex items-center justify-center">
                        <span className="text-[#6a6a7a] font-bold text-[10px]">
                          4
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white">
                        Branding & SEO
                      </h4>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#2a2a35] to-transparent"></div>
                      <span className="text-xs text-[#6a6a7a] bg-[#1a1a22] px-2 py-1 rounded-md">
                        Optional
                      </span>
                    </div>

                    {/* Primary Color Accent */}
                    <div className="space-y-3 bg-[#13131a] p-4 rounded-xl border border-[#2a2a35]/50">
                      <div>
                        <Label className="text-sm font-medium text-[#c7c7da] flex items-center gap-2">
                          <Palette className="h-4 w-4 text-brand-2" />
                          Primary Accent Color
                        </Label>
                        <p className="text-xs text-[#6a6a7a] mt-0.5">
                          This color will be used throughout your branded client experience.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start gap-4 pt-2">
                        {/* Custom Color Selector */}
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <input
                              type="color"
                              value={orgData.branding?.primaryColor || "#FBD10D"}
                              onChange={(e) =>
                                setOrgData((prev) => ({
                                  ...prev,
                                  branding: {
                                    ...prev.branding,
                                    primaryColor: e.target.value,
                                  },
                                }))
                              }
                              className="w-10 h-10 rounded-lg cursor-pointer border border-[#2a2a35] bg-transparent"
                              style={{ padding: "2px" }}
                            />
                          </div>
                          <input
                            type="text"
                            value={orgData.branding?.primaryColor || "#FBD10D"}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                                setOrgData((prev) => ({
                                  ...prev,
                                  branding: {
                                    ...prev.branding,
                                    primaryColor: value,
                                  },
                                }));
                              }
                            }}
                            placeholder="#FBD10D"
                            className="w-24 h-10 px-3 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-white font-mono text-sm focus:outline-none focus:border-brand-2/50 uppercase"
                            maxLength={7}
                          />
                        </div>

                        {/* Presets Grid */}
                        <div className="flex-1">
                          <div className="flex flex-wrap gap-2">
                            {PRESET_COLORS.map((preset) => (
                              <button
                                key={preset.value}
                                type="button"
                                onClick={() =>
                                  setOrgData((prev) => ({
                                    ...prev,
                                    branding: {
                                      ...prev.branding,
                                      primaryColor: preset.value,
                                    },
                                  }))
                                }
                                className={cn(
                                  "w-8 h-8 rounded-lg border-2 transition-all hover:scale-110",
                                  (orgData.branding?.primaryColor || "#FBD10D").toLowerCase() === preset.value.toLowerCase()
                                    ? "border-white shadow-lg ring-2 ring-white/10"
                                    : "border-transparent hover:border-white/30"
                                )}
                                style={{ backgroundColor: preset.value }}
                                title={preset.name}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Preview Swatch */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a22] border border-[#2a2a35]">
                          <div
                            className="w-3 h-3 rounded-full animate-pulse"
                            style={{ backgroundColor: orgData.branding?.primaryColor || "#FBD10D" }}
                          />
                          <span className="text-xs font-mono text-[#c7c7da]">
                            {(orgData.branding?.primaryColor || "#FBD10D").toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Font Picker */}
                    <div className="space-y-3 bg-[#13131a] p-4 rounded-xl border border-[#2a2a35]/50">
                      <div>
                        <Label className="text-sm font-medium text-[#c7c7da] flex items-center gap-2">
                          <Type className="h-4 w-4 text-brand-2" />
                          Font
                          <span className="ml-1 text-[10px] uppercase tracking-wider text-[#6a6a7a] bg-[#1a1a22] px-1.5 py-0.5 rounded">
                            Optional
                          </span>
                        </Label>
                        <p className="text-xs text-[#6a6a7a] mt-0.5">
                          Applied across your branded client surfaces. Leave as System default to inherit the app font.
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start gap-4 pt-2">
                        <Select
                          value={orgData.font || SYSTEM_DEFAULT_FONT}
                          onValueChange={(value) =>
                            setOrgData((prev) => ({
                              ...prev,
                              font: value === SYSTEM_DEFAULT_FONT ? "" : value,
                            }))
                          }
                        >
                          <SelectTrigger
                            className="w-full sm:w-72 h-10 bg-[#1a1a22] border-[#2a2a35] text-white focus:border-brand-2/50 focus:ring-brand-2/20"
                            style={{ fontFamily: orgData.font || undefined }}
                          >
                            <SelectValue placeholder="System default" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0e0e12] border-[#2a2a35] text-white max-h-72">
                            {FONT_OPTIONS.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={opt.value}
                                className="focus:bg-[#1a1a22] focus:text-white"
                              >
                                <span
                                  style={{
                                    fontFamily:
                                      opt.value === SYSTEM_DEFAULT_FONT
                                        ? undefined
                                        : opt.value,
                                  }}
                                >
                                  {opt.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div
                          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-sm text-[#c7c7da] truncate"
                          style={{ fontFamily: orgData.font || undefined }}
                        >
                          The quick brown fox jumps over the lazy dog.
                        </div>
                      </div>
                    </div>

                    {/* Logo Variants */}
                    <div className="grid grid-cols-2 gap-6">
                      {/* Colored Logo */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-[#c7c7da]">
                          Colored Logo
                        </Label>
                        <UploadThingFileUpload
                          endpoint="organizationIcon"
                          fieldName="colored_logo"
                          currentUrl={orgData.colored_logo || ""}
                          onUploadComplete={(url) => {
                            setOrgData((prev) => ({ ...prev, colored_logo: url }));
                          }}
                          onRemove={() => {
                            setOrgData((prev) => ({ ...prev, colored_logo: "" }));
                          }}
                          placeholder="Upload colored logo"
                          description="Logo with colors, PNG/JPG"
                          maxSize={2}
                        />
                      </div>

                      {/* White Logo */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-[#c7c7da]">
                          White Logo
                        </Label>
                        <UploadThingFileUpload
                          endpoint="organizationIcon"
                          fieldName="white_logo"
                          currentUrl={orgData.white_logo || ""}
                          onUploadComplete={(url) => {
                            setOrgData((prev) => ({ ...prev, white_logo: url }));
                          }}
                          onRemove={() => {
                            setOrgData((prev) => ({ ...prev, white_logo: "" }));
                          }}
                          placeholder="Upload white logo"
                          description="White/light logo variant, PNG"
                          maxSize={2}
                        />
                      </div>
                    </div>

                    {/* Icon Variants */}
                    <div className="grid grid-cols-2 gap-6">
                      {/* Colored Icon */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-[#c7c7da]">
                          Colored Icon
                        </Label>
                        <UploadThingFileUpload
                          endpoint="organizationIcon"
                          fieldName="colored_icon"
                          currentUrl={orgData.colored_icon || ""}
                          onUploadComplete={(url) => {
                            setOrgData((prev) => ({ ...prev, colored_icon: url }));
                          }}
                          onRemove={() => {
                            setOrgData((prev) => ({ ...prev, colored_icon: "" }));
                          }}
                          placeholder="Upload colored icon"
                          description="Square icon with colors"
                          maxSize={2}
                        />
                      </div>

                      {/* White Icon */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-[#c7c7da]">
                          White Icon
                        </Label>
                        <UploadThingFileUpload
                          endpoint="organizationIcon"
                          fieldName="white_icon"
                          currentUrl={orgData.white_icon || ""}
                          onUploadComplete={(url) => {
                            setOrgData((prev) => ({ ...prev, white_icon: url }));
                          }}
                          onRemove={() => {
                            setOrgData((prev) => ({ ...prev, white_icon: "" }));
                          }}
                          placeholder="Upload white icon"
                          description="White/light icon variant"
                          maxSize={2}
                        />
                      </div>
                    </div>

                    {/* SEO Meta Fields */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="website_meta_title"
                          className="text-sm font-medium text-[#c7c7da]"
                        >
                          Website Meta Title
                        </Label>
                        <Textarea
                          id="website_meta_title"
                          value={orgData.website_meta_title || ""}
                          onChange={(e) =>
                            setOrgData((prev) => ({
                              ...prev,
                              website_meta_title: e.target.value,
                            }))
                          }
                          className="min-h-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200 resize-none"
                          placeholder="SEO title for your website"
                        />
                        <p className="text-xs text-[#6a6a7a]">
                          Appears in browser tabs and search results
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="website_meta_description"
                          className="text-sm font-medium text-[#c7c7da]"
                        >
                          Website Meta Description
                        </Label>
                        <Textarea
                          id="website_meta_description"
                          value={orgData.website_meta_description || ""}
                          onChange={(e) =>
                            setOrgData((prev) => ({
                              ...prev,
                              website_meta_description: e.target.value,
                            }))
                          }
                          className="min-h-20 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200 resize-none"
                          placeholder="Brief description for search engines..."
                        />
                        <p className="text-xs text-[#6a6a7a]">
                          Shown in search engine results (recommended: 150-160 characters)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Visibility & Category */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#2a2a35] to-[#3a3a45] flex items-center justify-center">
                        <span className="text-[#6a6a7a] font-bold text-[10px]">
                          5
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white">
                        Visibility & Category
                      </h4>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#2a2a35] to-transparent"></div>
                      <span className="text-xs text-[#6a6a7a] bg-[#1a1a22] px-2 py-1 rounded-md">
                        Optional
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      {/* Office Public Toggle */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-[#c7c7da]">
                          Make Office Public
                        </Label>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setOrgData((prev) => ({
                                ...prev,
                                office_public: !prev.office_public,
                              }))
                            }
                            className={cn(
                              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200",
                              orgData.office_public
                                ? "bg-brand-2"
                                : "bg-[#2a2a35]"
                            )}
                          >
                            <span
                              className={cn(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200",
                                orgData.office_public
                                  ? "translate-x-6"
                                  : "translate-x-1"
                              )}
                            />
                          </button>
                          <span className="text-sm text-[#9fa0b8]">
                            {orgData.office_public
                              ? "Visible to public"
                              : "Private"}
                          </span>
                        </div>
                        <p className="text-xs text-[#6a6a7a]">
                          When enabled, anyone can join your office as a guest
                          without approval.
                        </p>
                      </div>

                      {/* Category — admin-managed picker (no free-text).
                          Only categories in the admin taxonomy are
                          selectable; a founder who picks something outside
                          the list would be rejected by the BE anyway. */}
                      <div className="space-y-2">
                        <Label
                          htmlFor="category"
                          className="text-sm font-medium text-[#c7c7da]"
                        >
                          Category
                        </Label>
                        <Select
                          value={orgData.category || NO_CATEGORY_SENTINEL}
                          onValueChange={(value) =>
                            setOrgData((prev) => ({
                              ...prev,
                              category:
                                value === NO_CATEGORY_SENTINEL ? "" : value,
                            }))
                          }
                        >
                          <SelectTrigger
                            id="category"
                            className="h-10 w-full bg-[#1a1a22] border-[#2a2a35] text-white focus:border-brand-2/50 focus-visible:border-brand-2/50 focus-visible:ring-brand-2/20 hover:bg-[#1a1a22] rounded-md px-3 text-sm"
                          >
                            <SelectValue placeholder="— No category —" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#15151d] border-[#2a2a35] text-white max-h-60">
                            <SelectItem
                              value={NO_CATEGORY_SENTINEL}
                              className="text-sm text-[#c7c7da] focus:bg-[#2a2a35] focus:text-white"
                            >
                              — No category —
                            </SelectItem>
                            {categorySuggestions.map((cat) => (
                              <SelectItem
                                key={cat}
                                value={cat}
                                className="text-sm text-white focus:bg-[#2a2a35] focus:text-white"
                              >
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {/* Category quick-pick chips (top 8) — same list
                            as the dropdown, faster access. */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {categorySuggestions.slice(0, 8).map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() =>
                                setOrgData((prev) => ({ ...prev, category: cat }))
                              }
                              className={cn(
                                "px-2 py-1 text-xs rounded-md transition-colors border",
                                orgData.category === cat
                                  ? "bg-brand-2/20 text-brand-2 border-brand-2/50"
                                  : "bg-[#2a2a35] hover:bg-[#3a3a45] text-[#c7c7da] border-[#3a3a45] hover:border-brand-2/50"
                              )}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-[#6a6a7a]">
                          Pick from the categories your admin has set up.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Member Welcome Email */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#2a2a35] to-[#3a3a45] flex items-center justify-center">
                        <span className="text-[#6a6a7a] font-bold text-[10px]">
                          6
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white">
                        Member Welcome Email
                      </h4>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#2a2a35] to-transparent"></div>
                      <span className="text-xs text-[#6a6a7a] bg-[#1a1a22] px-2 py-1 rounded-md flex items-center gap-1.5">
                        <Mail className="h-3 w-3" />
                        Always sent
                      </span>
                    </div>

                    <p className="text-xs text-[#6a6a7a] -mt-1">
                      Sent automatically whenever someone joins your
                      organization — by invite, guest join or onboarding.
                    </p>

                    {isDesktopLayout && (
                      <OrgWelcomeEmailSection
                        orgId={orgId}
                        value={welcomeEmail}
                        onChange={setWelcomeEmail}
                        onTemplateHtmlChange={handleWelcomeEmailHtml}
                        org={welcomeEmailPreviewOrg}
                      />
                    )}
                  </div>

                  {/* Office Verification (KYC) — the documents a garage admin
                      asked this office for. Self-gating: renders a one-line
                      "nothing to verify" when none were requested. */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#2a2a35] to-[#3a3a45] flex items-center justify-center">
                        <span className="text-[#6a6a7a] font-bold text-[10px]">
                          7
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white">
                        Office Verification
                      </h4>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#2a2a35] to-transparent"></div>
                    </div>

                    <p className="text-xs text-[#6a6a7a] -mt-1">
                      KYC documents are encrypted and securely stored.
                    </p>

                    {isDesktopLayout && orgId && <OrgKycSection orgId={orgId} />}
                  </div>
                </div>
              </div>

              {/* Footer - Hidden on mobile (buttons are in mobile header) */}
              <div className="hidden md:block bg-[#1a1a22]/50 p-4 border-t border-[#2a2a35]">
                <div className="flex gap-4 justify-between items-center">
                  <Button
                    onClick={() => { setDeleteConfirmText(""); setShowDeleteConfirm(true); }}
                    variant="ghost"
                    className="w-fit h-8 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 font-medium"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Delete HQ
                  </Button>
                  <div className="flex gap-4">
                    <Button
                      onClick={onClose}
                      variant="outline"
                      className="w-fit h-8 border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] hover:border-[#3a3a45] transition-all duration-200 font-medium"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={saveOrganization}
                      disabled={isSubmitting || !orgData.name}
                      className={cn(
                        "w-fit h-8 bg-gradient-to-r from-brand-2 to-[color:color-mix(in_srgb,var(--brand-2)_89%,white)] hover:from-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] hover:to-[color:color-mix(in_srgb,var(--brand-2)_93%,black)] text-brand-foreground font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {isSubmitting ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* One picker and one cropper for both layouts — the form is written
          twice (mobile card stack + desktop panel) but the cover is one field,
          and two mounted croppers would fight over the same state. */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        onChange={handleCoverPicked}
        className="hidden"
        disabled={uploadingCover}
      />

      <ImageCropDialog
        open={showCoverCropper}
        source={cropSource}
        aspect={COVER_ASPECT}
        // The whole picture is saved, padded around the banner band. The
        // profile shows the band (object-cover centres it), and every other
        // surface — and any later reframe — still gets the full image without
        // asking the founder to upload it a second time.
        storeWholeImage
        outputWidth={COVER_OUTPUT_WIDTH}
        title="Cover photo"
        description="The bright area is your profile banner — drag, zoom or rotate to choose it. Fill crops to the frame; Fit keeps the whole image on a blurred backdrop."
        confirmLabel="Use this cover"
        busy={uploadingCover}
        // Only meaningful against the original file — a saved cover URL is
        // already cropped, so reopening it starts fresh.
        initialState={
          cropSource instanceof File || cropSourceOriginalUrl ? coverCropState : null
        }
        onCancel={() => {
          setShowCoverCropper(false);
          setCropSource(null);
        }}
        onConfirm={handleCoverCropped}
      />

      {/* Delete HQ Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={(open) => { if (!isDeleting) { setShowDeleteConfirm(open); setDeleteConfirmText(""); } }}>
        <DialogContent className="bg-[#0e0e12] border border-[#2a2a35] text-white max-w-md shadow-2xl z-[1999]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <DialogTitle className="text-white text-lg font-semibold">Delete this HQ?</DialogTitle>
            </div>
            <DialogDescription className="text-[#8a8a9a] text-sm leading-relaxed">
              This will permanently delete <span className="text-white font-medium">{orgData.name}</span> and remove all members from the organization. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <p className="text-xs text-[#6a6a7a] mb-2">
              Type <span className="text-[#c7c7da] font-medium">{orgData.name}</span> to confirm
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={orgData.name}
              className="w-full h-9 px-3 text-sm bg-[#1a1a22] border border-[#2a2a35] rounded-md text-white placeholder-[#4a4a5a] focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all duration-200"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
              disabled={isDeleting}
              className="h-8 text-[#8a8a9a] hover:text-white hover:bg-[#1a1a22] border border-transparent hover:border-[#2a2a35] transition-all duration-200"
            >
              Cancel
            </Button>
            <Button
              onClick={deleteOrganization}
              disabled={deleteConfirmText !== orgData.name || isDeleting}
              className="h-8 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 font-medium"
            >
              {isDeleting ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Deleting...</>
              ) : (
                <><Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete HQ</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

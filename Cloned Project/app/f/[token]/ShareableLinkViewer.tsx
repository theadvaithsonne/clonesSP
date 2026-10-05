"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { copyToClipboard } from "@/lib/affiliate-share";
import { getToken, getUserDataFromToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  File,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Link2,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Eye,
} from "lucide-react";

/**
 * The page every cabinet share link opens.
 *
 * Public and office-only links are indistinguishable from the outside — same
 * `/f/{token}` shape, same token alphabet — so this page cannot tell them
 * apart either. It always asks the unauthenticated route first and lets the
 * answer decide:
 *
 *  - the file comes back → public link, render it;
 *  - `AUTH_REQUIRED` comes back → office-only. The visitor signs in, and if
 *    they are not a member of that office yet they are joined automatically,
 *    so a link shared outside the office still works for them.
 *
 * Both are VIEW-ONLY. The presigned URL the backend hands back opens inline
 * and there is no download action anywhere on this page.
 *
 * The tab title and link-preview card are NOT set here — they are server-
 * rendered by `generateMetadata` in page.tsx, because the crawlers that build
 * those cards run no JavaScript.
 */

interface FileInfo {
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
}

/** What the office gate needs to say before the visitor signs in. */
interface GateInfo {
  organizationName: string;
  /** True once we know the visitor is signed in but not a member. */
  signedIn: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileIcon(mimeType: string, fileName?: string) {
  const ext = fileName?.split(".").pop()?.toLowerCase() || "";
  const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"];
  const videoExts = ["mp4", "webm", "mov", "avi", "mkv", "m4v", "ogv", "3gp"];
  const audioExts = ["mp3", "wav", "ogg", "m4a", "aac", "flac", "wma"];

  if (mimeType.startsWith("image/") || imageExts.includes(ext))
    return <Image className="h-12 w-12 text-pink-400" />;
  if (mimeType.startsWith("video/") || videoExts.includes(ext))
    return <Video className="h-12 w-12 text-purple-400" />;
  if (mimeType.startsWith("audio/") || audioExts.includes(ext))
    return <Music className="h-12 w-12 text-green-400" />;
  if (mimeType.includes("pdf") || ext === "pdf")
    return <FileText className="h-12 w-12 text-red-400" />;
  if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("tar") ||
    ["zip", "rar", "tar", "gz", "7z"].includes(ext)
  )
    return <Archive className="h-12 w-12 text-yellow-400" />;
  return <File className="h-12 w-12 text-blue-400" />;
}

/**
 * Raw fetch rather than `api()`: the office gate turns on the `code` field of
 * an error body, and `api()` collapses every failure into a message string.
 */
async function getJson(
  url: string,
  authToken?: string | null,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

interface ViewerHeaderProps {
  fileInfo: FileInfo;
  sharedBy: string | null;
  organizationName: string | null;
  /** Shown only when the visitor is signed into the office that owns the file. */
  canOpenInCabinet: boolean;
  onOpenInCabinet: () => void;
  onBackHome: () => void;
  /** Omitted for views with nothing worth filling the screen with. */
  onToggleFullScreen?: () => void;
  isFullScreen?: boolean;
}

/**
 * The bar across the top of every file view. Fixed and blurred rather than
 * inline: the media view is a full-bleed black canvas, and the PDF view is an
 * iframe that owns its own scrolling — neither can host a header in flow.
 */
function ViewerHeader({
  fileInfo,
  sharedBy,
  organizationName,
  canOpenInCabinet,
  onOpenInCabinet,
  onBackHome,
  onToggleFullScreen,
  isFullScreen,
}: ViewerHeaderProps) {
  const name = fileInfo.originalName || fileInfo.name;
  const kind = fileInfo.mimeType?.split("/")[1]?.toUpperCase() || "FILE";
  const attribution = sharedBy || organizationName;

  const copyLink = async () => {
    const ok = await copyToClipboard(window.location.href);
    if (ok) toast.success("Link copied");
    else toast.error("Couldn't copy the link");
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-3 sm:h-16 sm:gap-4 sm:px-5">
        {/* Left: out of the viewer, and whose product this is */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackHome}
            className="h-9 gap-1.5 px-2.5 text-xs text-white/80 hover:bg-white/10 hover:text-white sm:px-3"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Home</span>
          </Button>
          <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white/70 md:inline-flex">
            <span className="h-2 w-2 rounded-full bg-brand" />
            Garage
          </span>
        </div>

        {/* Centre: what this file is. `min-w-0` is what lets it truncate
            instead of shoving the action buttons off the bar. */}
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-medium text-white">{name}</p>
          <p className="truncate text-[11px] text-white/50">
            {attribution ? `Shared by ${attribution} • ` : ""}
            {formatFileSize(fileInfo.size)} • {kind}
          </p>
        </div>

        {/* Right: read-only status and the few things a visitor may do */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70 sm:inline-flex">
            <Eye className="h-3.5 w-3.5" />
            View only
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyLink}
            title="Copy link"
            className="h-9 gap-1.5 px-2.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
          >
            <Link2 className="h-4 w-4" />
            <span className="hidden lg:inline">Copy link</span>
          </Button>
          {canOpenInCabinet && (
            <Button
              size="sm"
              onClick={onOpenInCabinet}
              className="h-9 gap-1.5 bg-brand px-2.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90 sm:px-3"
            >
              <span className="hidden sm:inline">Open in Cabinet</span>
              <span className="sm:hidden">Cabinet</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {onToggleFullScreen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleFullScreen}
              title={isFullScreen ? "Exit full screen" : "Full screen"}
              className="h-9 px-2.5 text-white/80 hover:bg-white/10 hover:text-white"
            >
              {isFullScreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export default function ShareableLinkViewer({ token }: { token: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `?ref=` is affiliate attribution and rides along to the sign-in flow.
  const ref = searchParams.get("ref") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [gate, setGate] = useState<GateInfo | null>(null);
  const [joining, setJoining] = useState(false);
  const [sharedBy, setSharedBy] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);

  // Read from the JWT after mount, never during render — the server has no
  // localStorage, and reading it inline would hydrate mismatched markup.
  const [viewerOrgId, setViewerOrgId] = useState<string | null>(null);
  useEffect(() => {
    setViewerOrgId(getUserDataFromToken().orgId);
  }, []);

  const shellRef = useRef<HTMLDivElement | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // The browser can leave full screen without us (Esc, window controls), so
  // the button's state comes from the document rather than from our own click.
  useEffect(() => {
    const sync = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFullScreen = useCallback(() => {
    const node = shellRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    void node.requestFullscreen?.().catch(() => {
      toast.error("Full screen isn't available here");
    });
  }, []);

  // Check if file is media (image or video) - check both mimeType and file extension
  const fileName = fileInfo?.originalName || fileInfo?.name || "";
  const fileExtension = fileName.split(".").pop()?.toLowerCase() || "";

  const imageExtensions = [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "svg",
    "bmp",
    "ico",
  ];
  const videoExtensions = [
    "mp4",
    "webm",
    "mov",
    "avi",
    "mkv",
    "m4v",
    "ogv",
    "3gp",
  ];
  const audioExtensions = ["mp3", "wav", "ogg", "m4a", "aac", "flac", "wma"];

  const isImage =
    fileInfo?.mimeType?.startsWith("image/") ||
    imageExtensions.includes(fileExtension);
  const isVideo =
    fileInfo?.mimeType?.startsWith("video/") ||
    videoExtensions.includes(fileExtension);
  const isAudio =
    fileInfo?.mimeType?.startsWith("audio/") ||
    audioExtensions.includes(fileExtension);
  const isPdf =
    fileInfo?.mimeType?.includes("pdf") || fileExtension === "pdf";
  const isText =
    fileInfo?.mimeType?.startsWith("text/") ||
    ["txt", "md", "csv", "log", "json"].includes(fileExtension);
  const isMedia = isImage || isVideo;
  // Anything the browser can show in place: no download, no new tab.
  const isEmbeddable = isPdf || isText;

  /** Where sign-in should send the visitor back to. */
  const returnUrl = `/f/${token}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`;

  const goToSignIn = useCallback(() => {
    // The auth flow carries the destination through as `redirect`, all the way
    // from the OTP request to the workspace hand-off.
    router.push(
      `/login?flow=login&redirect=${encodeURIComponent(returnUrl)}`,
    );
  }, [router, returnUrl]);

  const goHome = useCallback(() => router.push("/"), [router]);

  // The cabinet is a dashboard popover, not a route of its own, so the
  // shortcut lands on the workspace the popover opens from.
  const openInCabinet = useCallback(() => router.push("/workspace"), [router]);

  /**
   * Only for someone already signed into the office that owns this file —
   * anyone else would be sent to a workspace that has never heard of it.
   */
  const canOpenInCabinet =
    !!viewerOrgId && !!organizationId && viewerOrgId === organizationId;

  const describeFailure = useCallback((message: string): string => {
    if (message.includes("expired")) return "This link has expired";
    if (message.includes("limit"))
      return "This link has reached its access limit";
    if (message.includes("revoked")) return "This link is no longer available";
    if (message.includes("not found") || message.includes("404"))
      return "This link is invalid or no longer exists";
    return message || "Failed to load file";
  }, []);

  /** Whoever shared it, and which office it came from, as the header needs. */
  const rememberProvenance = useCallback((data: any) => {
    if (data?.sharedBy) setSharedBy(data.sharedBy);
    if (data?.organizationId) setOrganizationId(data.organizationId);
    if (data?.organizationName) setOrganizationName(data.organizationName);
  }, []);

  /**
   * Reads the file behind the link. For an office-only link this may come back
   * as "you're not a member yet", which is not an error — it's the cue to join.
   */
  const fetchFileInfo = useCallback(
    async (opts: { allowJoin: boolean }) => {
      setLoading(true);
      setError(null);

      try {
        // Always the unauthenticated route first: the token is opaque, so the
        // server is the only thing that knows whether this link is public.
        const open = await getJson(`${API_URL}/public/f/${token}`);

        if (open.ok) {
          setFileInfo(open.body.data.file);
          setViewUrl(open.body.data.viewUrl || open.body.data.downloadUrl);
          rememberProvenance(open.body.data);
          setGate(null);
          return;
        }

        const needsAuth =
          open.body?.code === "AUTH_REQUIRED" ||
          open.body?.code === "OFFICE_ONLY";

        if (!needsAuth) {
          setError(describeFailure(open.body?.error || ""));
          return;
        }

        // The gated response still carries the safe half — who shared what —
        // so the gate and the header can name it.
        rememberProvenance(open.body?.data);

        const organizationName =
          open.body?.data?.organizationName || "this office";

        const authToken = getToken();
        if (!authToken) {
          // Signed out: say what they are being asked to join before sending
          // them off to sign in.
          setGate({ organizationName, signedIn: false });
          return;
        }

        const { ok, body } = await getJson(
          `${API_URL}/cabinet/f/${token}`,
          authToken,
        );

        if (ok) {
          setFileInfo(body.data.file);
          setViewUrl(body.data.viewUrl || body.data.downloadUrl);
          rememberProvenance(body.data);
          setGate(null);
          return;
        }

        if (body?.code === "NOT_A_MEMBER") {
          // Signed in but outside the office: joining is the whole point of an
          // office-only link, so do it once without making them click.
          if (opts.allowJoin) {
            setJoining(true);
            const joined = await getJson(
              `${API_URL}/cabinet/f/${token}/join`,
              authToken,
              { method: "POST" },
            );

            if (joined.ok) {
              const retry = await getJson(
                `${API_URL}/cabinet/f/${token}`,
                authToken,
              );
              setJoining(false);
              if (retry.ok) {
                setFileInfo(retry.body.data.file);
                setViewUrl(
                  retry.body.data.viewUrl || retry.body.data.downloadUrl,
                );
                rememberProvenance(retry.body.data);
                setGate(null);
                return;
              }
            } else {
              setJoining(false);
            }
          }

          setGate({
            organizationName: body?.data?.organizationName || organizationName,
            signedIn: true,
          });
          return;
        }

        setError(describeFailure(body?.error || ""));
      } catch (err: any) {
        console.error("Error fetching file:", err);
        setError(err?.message || "Failed to load file");
      } finally {
        setLoading(false);
      }
    },
    [describeFailure, rememberProvenance, token],
  );

  useEffect(() => {
    if (!token) {
      setError("Invalid link");
      setLoading(false);
      return;
    }

    void fetchFileInfo({ allowJoin: true });
  }, [token, fetchFileInfo]);

  /** Same header on every view that has a file to describe. */
  const header = (withFullScreen: boolean) =>
    fileInfo ? (
      <ViewerHeader
        fileInfo={fileInfo}
        sharedBy={sharedBy}
        organizationName={organizationName}
        canOpenInCabinet={canOpenInCabinet}
        onOpenInCabinet={openInCabinet}
        onBackHome={goHome}
        onToggleFullScreen={withFullScreen ? toggleFullScreen : undefined}
        isFullScreen={isFullScreen}
      />
    ) : null;

  // Loading state
  if (loading || joining) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
          <p className="text-white/60">
            {joining ? "Joining the office..." : "Loading file..."}
          </p>
        </div>
      </div>
    );
  }

  // Office gate — signed out, or signed in and the join did not take.
  if (gate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
        <Card className="w-full max-w-md border-white/10 bg-[#0C0C0E]/80 backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-yellow-400/10 flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-yellow-400" />
            </div>
            <CardTitle className="text-xl text-white">
              Shared with {gate.organizationName}
            </CardTitle>
            <CardDescription className="text-white/60">
              {gate.signedIn
                ? `We couldn't add you to ${gate.organizationName} automatically. Try again, or ask whoever shared this to invite you.`
                : `This file is for members of ${gate.organizationName}. Sign in and you'll be added to the office, then the file opens.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {gate.signedIn ? (
              <Button
                onClick={() => void fetchFileInfo({ allowJoin: true })}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-medium"
              >
                Try again
              </Button>
            ) : (
              <Button
                onClick={goToSignIn}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-medium"
              >
                Sign in to view
              </Button>
            )}
            <Button
              variant="outline"
              onClick={goHome}
              className="w-full border-white/20 text-white hover:bg-white/10"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
        <Card className="w-full max-w-md border-red-500/20 bg-[#0C0C0E]/80 backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
            <CardTitle className="text-xl text-red-400">
              Link Unavailable
            </CardTitle>
            <CardDescription className="text-white/60">{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button
              variant="outline"
              onClick={goHome}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Full-screen media preview for images and videos
  if (isMedia && viewUrl && fileInfo) {
    return (
      <div
        ref={shellRef}
        className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
      >
        {header(true)}

        {/* Media content. Right-click and the native download control are off:
            a view-only link should not hand out a saveable copy in one click.
            `pt-20` keeps the image clear of the fixed header. */}
        <div
          className="w-full h-full flex items-center justify-center p-4 pt-20 pb-4"
          onContextMenu={(e) => e.preventDefault()}
        >
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={viewUrl}
              alt={fileInfo.originalName || fileInfo.name}
              draggable={false}
              className="max-w-full max-h-full object-contain select-none"
            />
          ) : isVideo ? (
            <video
              src={viewUrl}
              controls
              autoPlay
              controlsList="nodownload"
              disablePictureInPicture
              className="max-w-full max-h-full"
            />
          ) : null}
        </div>
      </div>
    );
  }

  // In-page preview for PDFs, text and transcripts
  if (isEmbeddable && viewUrl && fileInfo) {
    return (
      <div
        ref={shellRef}
        className="min-h-screen bg-[#0a0a0a] flex flex-col pt-14 sm:pt-16"
      >
        {header(true)}
        {/* The padding above is on the column, not the frame — a PDF viewer
            scrolls its own document and would put its toolbar under ours. */}
        <iframe
          src={viewUrl}
          title={fileInfo.originalName || fileInfo.name}
          className="flex-1 w-full bg-white"
        />
      </div>
    );
  }

  // Audio, and anything else the browser can't show in place
  return (
    <div
      ref={shellRef}
      className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4 pt-20"
    >
      {header(false)}

      {/* Background gradient */}
      <div
        className="pointer-events-none absolute inset-0
        bg-[radial-gradient(800px_400px_at_50%_-10%,color-mix(in_srgb,_var(--brand)_15%,_transparent),transparent_60%)]"
      />

      <Card className="relative w-full max-w-md border-white/10 bg-[#0C0C0E]/80 backdrop-blur-xl">
        <CardHeader className="text-center space-y-4">
          {/* File icon */}
          <div className="mx-auto w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
            {fileInfo &&
              getFileIcon(
                fileInfo.mimeType,
                fileInfo.originalName || fileInfo.name
              )}
          </div>

          {/* File name */}
          <div>
            <CardTitle className="text-lg text-white truncate">
              {fileInfo?.originalName || fileInfo?.name}
            </CardTitle>
            <CardDescription className="text-white/50 mt-1">
              {fileInfo && formatFileSize(fileInfo.size)}
              {fileInfo?.mimeType && <span className="mx-2">•</span>}
              {fileInfo?.mimeType.split("/")[1]?.toUpperCase()}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isAudio && viewUrl ? (
            <audio
              src={viewUrl}
              controls
              controlsList="nodownload"
              className="w-full"
            />
          ) : (
            <p className="text-center text-sm text-white/50">
              This file type can&apos;t be previewed in the browser. Shared links
              are view-only, so there&apos;s no download.
            </p>
          )}

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-white/40">
            <Eye className="h-3.5 w-3.5" />
            View only
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

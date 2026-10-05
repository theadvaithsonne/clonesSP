"use client";

// Everything about the event's public site except the blocks themselves:
// the domain it answers on, the brand marks, how it appears in search, and
// how it unfurls when someone pastes the link.
//
// Domain is deliberately a three-step flow — claim, create DNS records,
// verify — rather than a text field that instantly says "connected". Nothing
// here marks a domain live; only a real DNS lookup on the server does.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import ImageCropDialog from "@/components/shared/ImageCropDialog";
import {
  SHARE_IMAGE_HEIGHT,
  SHARE_IMAGE_WIDTH,
  checkShareImage,
  toShareJpeg,
  type ShareImageIssue,
} from "@/lib/share-image";
import {
  Button,
  Card,
  GOLD,
  Label,
  Select,
  TextArea,
  TextInput,
  Toggle,
  useConfirm,
} from "../ui";
import {
  addEventDomain,
  getWebsite,
  removeEventDomain,
  saveWebsiteSettings,
  uploadEventImage,
  verifyEventDomain,
  type DnsRecord,
  type EventDomain,
  type EventWebsiteSettings,
} from "../api";

const EMPTY: EventWebsiteSettings = {
  branding: {},
  seo: { keywords: [], noIndex: false },
  social: { twitterCard: "summary_large_image" },
};

export default function WebsiteSettings({
  eventId,
  eventName,
  publicUrl,
}: {
  eventId: string;
  eventName: string;
  /** The /events/<slug> path, shown as the always-available address. */
  publicUrl: string;
}) {
  const [settings, setSettings] = useState<EventWebsiteSettings>(EMPTY);
  const [domain, setDomain] = useState<EventDomain | null>(null);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [hostInput, setHostInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);
  const ogRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  // Share image being framed: a picked file, or a saved image being fixed.
  const [shareCropSource, setShareCropSource] = useState<File | string | null>(null);
  const [bannerUrl, setBannerUrl] = useState("");
  const [shareIssue, setShareIssue] = useState<ShareImageIssue | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getWebsite(eventId);
      setBannerUrl(res.event?.bannerUrl || "");
      const c: any = res.config || {};
      setSettings({
        branding: c.branding || {},
        seo: { keywords: [], noIndex: false, ...(c.seo || {}) },
        social: { twitterCard: "summary_large_image", ...(c.social || {}) },
      });
      setDomain(c.domain || null);
      setHostInput(c.domain?.host || "");
      // The records live on the org's domain entry (shared with whitelabel),
      // so a fresh load has to ask for them rather than re-deriving a guess.
      if (c.domain?.host && c.domain.status !== "verified") {
        try {
          const v = await verifyEventDomain(eventId);
          setDomain(v.domain);
          setRecords(v.records);
        } catch {
          // Leave the table empty; "Check DNS" will populate it.
        }
      }
      setDirty(false);
    } catch (err: any) {
      toast.error(err?.message || "Could not load website settings");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (changes: Partial<EventWebsiteSettings>) => {
    setSettings((prev) => ({
      branding: { ...prev.branding, ...(changes.branding || {}) },
      seo: { ...prev.seo, ...(changes.seo || {}) },
      social: { ...prev.social, ...(changes.social || {}) },
    }));
    setDirty(true);
  };

  async function upload(
    file: File | undefined | null,
    slot: "logoUrl" | "faviconUrl" | "ogImageUrl"
  ) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file");
      return;
    }
    // The share image is framed first, then stored in a format and size that
    // every link-preview scraper renders — see lib/share-image.
    if (slot === "ogImageUrl") {
      setShareCropSource(file);
      return;
    }
    setUploading(slot);
    try {
      const res = await uploadEventImage(eventId, file, "branding");
      patch({ branding: { [slot]: res.url } as any });
    } catch (err: any) {
      toast.error(err?.message || "Could not upload that image");
    } finally {
      setUploading(null);
    }
  }

  async function uploadShareImage(framed: Blob) {
    setUploading("ogImageUrl");
    try {
      const file = await toShareJpeg(framed);
      const res = await uploadEventImage(eventId, file, "branding");
      patch({ social: { ogImageUrl: res.url } as any });
      setShareCropSource(null);
      toast.success("Share image ready — save to publish it");
    } catch (err) {
      toast.error((err instanceof Error && err.message) || "Could not upload that image");
    } finally {
      setUploading(null);
    }
  }

  // Link previews use the share image, else the banner. Check whichever one
  // is actually in play, so a preview that would come out blank says so here.
  const previewImage = settings.social.ogImageUrl || bannerUrl;
  useEffect(() => {
    setShareIssue(null);
    if (!previewImage) return;
    let alive = true;
    void checkShareImage(previewImage).then((issue) => {
      if (alive) setShareIssue(issue);
    });
    return () => {
      alive = false;
    };
  }, [previewImage]);

  async function save() {
    setSaving(true);
    try {
      await saveWebsiteSettings(eventId, settings);
      toast.success("Website settings saved");
      setDirty(false);
    } catch (err: any) {
      toast.error(err?.message || "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  // ── Domain ─────────────────────────────────────────────────────────────
  async function connect() {
    setConnecting(true);
    try {
      const res = await addEventDomain(eventId, hostInput);
      setDomain(res.domain);
      setRecords(res.records);
      toast.success("Domain added — now create the DNS records below");
    } catch (err: any) {
      toast.error(err?.message || "Could not add that domain");
    } finally {
      setConnecting(false);
    }
  }

  async function verify() {
    setVerifying(true);
    try {
      const res = await verifyEventDomain(eventId);
      setDomain(res.domain);
      setRecords(res.records);
      if (res.check.ok) toast.success("Domain verified — your site is live on it");
      else toast.error(res.check.error || "Not verified yet");
    } catch (err: any) {
      toast.error(err?.message || "Could not check the domain");
    } finally {
      setVerifying(false);
    }
  }

  async function disconnect() {
    const ok = await confirm({
      title: `Disconnect ${domain?.host}?`,
      message:
        "Visitors to that domain stop seeing your event immediately. Reconnecting later means verifying ownership again.",
      confirmLabel: "Disconnect",
    });
    if (!ok) return;
    try {
      await removeEventDomain(eventId);
      setDomain(null);
      setRecords([]);
      setHostInput("");
      toast.success("Domain disconnected");
    } catch (err: any) {
      toast.error(err?.message || "Could not remove the domain");
    }
  }

  const seoPreviewUrl = useMemo(() => {
    if (domain?.status === "verified") return domain.host;
    return `my.garage.app${publicUrl}`;
  }, [domain, publicUrl]);

  if (loading) {
    return (
      <div className="flex justify-center px-8 py-24">
        <Loader2 className="h-6 w-6 animate-spin text-[#4f5065]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 px-8 py-8 pb-28">
      {/* ── Domain ───────────────────────────────────────────────────── */}
      <Card className="p-6">
        <SectionHead
          icon={<Globe className="h-4 w-4" style={{ color: GOLD }} />}
          title="Custom domain"
          body="Serve this event on your own address instead of the Garage URL."
        />

        <div className="mt-5 rounded-xl border border-[#262626] bg-[#1A1A1A] p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Always available
          </div>
          <div className="mt-1 flex items-center gap-2">
            <code className="text-sm text-white">my.garage.app{publicUrl}</code>
            <CopyButton value={`https://my.garage.app${publicUrl}`} />
          </div>
        </div>

        {!domain ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={hostInput}
              onChange={(e) => setHostInput(e.target.value)}
              placeholder="tickets.yourbrand.com"
              className="flex-1 rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-brand"
            />
            <Button
              loading={connecting}
              disabled={!hostInput.trim()}
              onClick={connect}
            >
              Add domain
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#262626] bg-[#1A1A1A] p-3.5">
              <DomainStatus status={domain.status} />
              <code className="flex-1 truncate text-sm text-white">
                {domain.host}
              </code>
              {domain.status === "verified" && (
                <a
                  href={`https://${domain.host}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-500 transition-colors hover:text-white"
                  title="Open"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              <button
                type="button"
                onClick={disconnect}
                title="Disconnect"
                className="text-zinc-500 transition-colors hover:text-[#f87171]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {domain.status !== "verified" && (
              <>
                <p className="text-xs leading-5 text-zinc-400">
                  Add these two records at your DNS provider, then check again.
                  Both are required: the TXT proves the domain is yours, and the
                  {" "}
                  {records[1]?.type || "CNAME"} is what actually sends visitors
                  here.
                </p>

                <div className="overflow-hidden rounded-xl border border-[#262626]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1A1A1A] text-[10px] uppercase tracking-wider text-zinc-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 font-medium">Value</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262626]">
                      {records.map((r) => (
                        <tr key={`${r.type}-${r.name}`}>
                          <td className="px-3 py-2.5 font-mono text-zinc-300">
                            {r.type}
                          </td>
                          <td className="max-w-[180px] truncate px-3 py-2.5 font-mono text-zinc-300">
                            {r.name}
                          </td>
                          <td className="max-w-[220px] truncate px-3 py-2.5 font-mono text-zinc-300">
                            {r.value}
                          </td>
                          <td className="px-3 py-2.5">
                            <CopyButton value={r.value} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {domain.lastError && (
                  <p className="flex items-start gap-2 rounded-xl border border-[#3a2a1f] bg-[#3a2a1f]/30 p-3 text-xs leading-5 text-[#fbbf24]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {domain.lastError}
                  </p>
                )}

                <Button variant="secondary" loading={verifying} onClick={verify}>
                  <RefreshCw className="h-4 w-4" />
                  Check DNS
                </Button>
              </>
            )}
          </div>
        )}
      </Card>

      {/* ── Branding ─────────────────────────────────────────────────── */}
      <Card className="p-6">
        <SectionHead
          icon={<Upload className="h-4 w-4" style={{ color: GOLD }} />}
          title="Brand"
          body="Your marks, used in the site header and the browser tab."
        />

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <ImageSlot
            label="Logo"
            hint="Shown in the site header. SVG or PNG with transparency works best."
            value={settings.branding.logoUrl}
            busy={uploading === "logoUrl"}
            onPick={() => logoRef.current?.click()}
            onClear={() => patch({ branding: { logoUrl: "" } as any })}
            aspect="h-16 w-32"
          />
          <ImageSlot
            label="Favicon"
            hint="The browser tab icon. 32×32 or larger, square."
            value={settings.branding.faviconUrl}
            busy={uploading === "faviconUrl"}
            onPick={() => faviconRef.current?.click()}
            onClear={() => patch({ branding: { faviconUrl: "" } as any })}
            aspect="h-16 w-16"
          />
        </div>

        <div className="mt-5">
          <TextInput
            label="Site name"
            value={settings.branding.siteName || ""}
            onChange={(e) => patch({ branding: { siteName: e.target.value } as any })}
            placeholder={eventName}
            hint="Defaults to the event name"
          />
        </div>

        <input
          ref={logoRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void upload(e.target.files?.[0], "logoUrl");
            e.target.value = "";
          }}
        />
        <input
          ref={faviconRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void upload(e.target.files?.[0], "faviconUrl");
            e.target.value = "";
          }}
        />
      </Card>

      {/* ── SEO ──────────────────────────────────────────────────────── */}
      <Card className="p-6">
        <SectionHead
          icon={<Search className="h-4 w-4" style={{ color: GOLD }} />}
          title="SEO"
          body="How this page appears in search results."
        />

        <div className="mt-5 space-y-4">
          <TextInput
            label="Page title"
            value={settings.seo.title || ""}
            onChange={(e) => patch({ seo: { title: e.target.value } as any })}
            placeholder={eventName}
            hint={`${(settings.seo.title || "").length}/70`}
          />
          <TextArea
            label="Meta description"
            rows={2}
            value={settings.seo.description || ""}
            onChange={(e) => patch({ seo: { description: e.target.value } as any })}
            placeholder="One or two sentences describing the event."
            hint={`${(settings.seo.description || "").length}/200`}
          />
          <KeywordInput
            value={settings.seo.keywords}
            onChange={(keywords) => patch({ seo: { keywords } as any })}
          />
          {/* What Google will actually show. */}
          <div className="rounded-xl border border-[#262626] bg-[#1A1A1A] p-3.5">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Search preview
            </div>
            <div className="truncate text-xs text-[#9fa0b8]">{seoPreviewUrl}</div>
            <div className="mt-0.5 truncate text-sm text-[#8ab4f8]">
              {settings.seo.title || eventName}
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-zinc-400">
              {settings.seo.description ||
                "Add a meta description to control this line."}
            </p>
          </div>

          <div className="border-t border-[#262626] pt-3">
            <Toggle
              checked={settings.seo.noIndex}
              onChange={(v) => patch({ seo: { noIndex: v } as any })}
              label="Hide from search engines"
              description="For private or dry-run events. The page stays reachable by link."
            />
          </div>
        </div>
      </Card>

      {/* ── Sharing ──────────────────────────────────────────────────── */}
      <Card className="p-6">
        <SectionHead
          icon={<Share2 className="h-4 w-4" style={{ color: GOLD }} />}
          title="Sharing"
          body="How the link unfurls on WhatsApp, Slack, X and LinkedIn."
        />

        <div className="mt-5 space-y-4">
          <ImageSlot
            label="Share image"
            hint="Framed to 1200×630 and saved as a JPEG under 300 KB, so it shows on WhatsApp, LinkedIn, X and Slack. Falls back to the event banner."
            value={settings.social.ogImageUrl}
            busy={uploading === "ogImageUrl"}
            onPick={() => ogRef.current?.click()}
            onClear={() => patch({ social: { ogImageUrl: "" } as any })}
            aspect="h-28 w-full max-w-[240px]"
          />
          {shareIssue && previewImage && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[#4a3f1f] bg-[#2d2a1f] px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
              <p className="min-w-0 flex-1 text-xs leading-5 text-zinc-300">
                {settings.social.ogImageUrl ? "This share image" : "Your event banner, used for previews,"}{" "}
                {shareIssue.kind === "format"
                  ? `is ${shareIssue.format}, which WhatsApp, LinkedIn and X don't show in link previews.`
                  : `is ${Math.round(shareIssue.bytes / 1024)} KB — WhatsApp drops preview images over 300 KB.`}{" "}
                Fixing it saves a 1200×630 JPEG that shows everywhere.
              </p>
              <button
                type="button"
                disabled={uploading === "ogImageUrl"}
                onClick={() => setShareCropSource(previewImage)}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-black transition-all hover:brightness-95 disabled:opacity-50"
                style={{ background: GOLD }}
              >
                Fix image
              </button>
            </div>
          )}
          <TextInput
            label="Share title"
            value={settings.social.ogTitle || ""}
            onChange={(e) => patch({ social: { ogTitle: e.target.value } as any })}
            placeholder={settings.seo.title || eventName}
          />
          <TextArea
            label="Share description"
            rows={2}
            value={settings.social.ogDescription || ""}
            onChange={(e) =>
              patch({ social: { ogDescription: e.target.value } as any })
            }
            placeholder={settings.seo.description || "Shown under the title."}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="X card style"
              value={settings.social.twitterCard}
              onChange={(e) =>
                patch({ social: { twitterCard: e.target.value } as any })
              }
              options={[
                { value: "summary_large_image", label: "Large image" },
                { value: "summary", label: "Small thumbnail" },
              ]}
            />
            <TextInput
              label="X handle"
              value={settings.social.twitterHandle || ""}
              onChange={(e) =>
                patch({ social: { twitterHandle: e.target.value } as any })
              }
              placeholder="@yourbrand"
            />
          </div>
        </div>

        <input
          ref={ogRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void upload(e.target.files?.[0], "ogImageUrl");
            e.target.value = "";
          }}
        />
      </Card>

      {/* Sticky save, because this page is long enough to scroll past a
          button sitting at the bottom of it. */}
      {dirty && (
        <div className="sticky bottom-4 flex justify-end">
          <div className="flex items-center gap-3 rounded-xl border border-[#262626] bg-[#141414] px-4 py-3 shadow-2xl">
            <span className="text-xs text-zinc-400">Unsaved changes</span>
            <Button loading={saving} onClick={save}>
              Save settings
            </Button>
          </div>
        </div>
      )}

      <ImageCropDialog
        open={!!shareCropSource}
        source={shareCropSource}
        aspect={SHARE_IMAGE_WIDTH / SHARE_IMAGE_HEIGHT}
        outputWidth={SHARE_IMAGE_WIDTH}
        title="Share image"
        description="This frame is exactly what link previews show on WhatsApp, LinkedIn, X and Slack."
        confirmLabel="Use this image"
        busy={uploading === "ogImageUrl"}
        onCancel={() => setShareCropSource(null)}
        onConfirm={(blob) => uploadShareImage(blob)}
      />

      {confirmDialog}
    </div>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────────

function SectionHead({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-sm font-bold text-white">
        {icon}
        {title}
      </h2>
      <p className="mt-1 text-xs leading-5 text-zinc-400">{body}</p>
    </div>
  );
}

function DomainStatus({ status }: { status: EventDomain["status"] }) {
  const map = {
    verified: { label: "Live", bg: "#1f2d1f", fg: "#4ade80" },
    pending: { label: "Pending DNS", bg: "#2d2a1f", fg: "#FACC15" },
    failed: { label: "Not verified", bg: "#3a1f1f", fg: "#f87171" },
  }[status];
  return (
    <span
      className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: map.bg, color: map.fg }}
    >
      {map.label}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy"
      onClick={() => {
        navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => toast.error("Could not copy"));
      }}
      className="shrink-0 text-zinc-500 transition-colors hover:text-white"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" style={{ color: GOLD }} />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function ImageSlot({
  label,
  hint,
  value,
  busy,
  onPick,
  onClear,
  aspect,
}: {
  label: string;
  hint: string;
  value?: string;
  busy: boolean;
  onPick: () => void;
  onClear: () => void;
  aspect: string;
}) {
  return (
    <div>
      <Label hint={value ? undefined : "Optional"}>{label}</Label>
      <button
        type="button"
        onClick={onPick}
        disabled={busy}
        className={`group relative ${aspect} overflow-hidden rounded-xl border border-dashed border-[#262626] bg-[#1A1A1A] transition-colors hover:border-brand disabled:opacity-50`}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-full w-full object-contain p-2" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              Replace
            </span>
          </>
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-zinc-500">
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span className="text-[10px]">Upload</span>
          </span>
        )}
      </button>
      <p className="mt-1.5 text-[11px] leading-4 text-zinc-500">{hint}</p>
      {value && (
        <button
          type="button"
          onClick={onClear}
          className="mt-1 text-[11px] text-zinc-500 transition-colors hover:text-[#f87171]"
        >
          Remove
        </button>
      )}
    </div>
  );
}

/** Keywords as chips — a comma-separated string is a worse version of this. */
function KeywordInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const k = draft.trim();
    if (!k || value.includes(k) || value.length >= 20) {
      setDraft("");
      return;
    }
    onChange([...value, k]);
    setDraft("");
  };
  return (
    <div>
      <Label hint={`${value.length}/20`}>Keywords</Label>
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-[#262626] bg-[#1A1A1A] p-2">
        {value.map((k) => (
          <span
            key={k}
            className="inline-flex items-center gap-1 rounded-md bg-[#262626] px-2 py-1 text-xs text-zinc-300"
          >
            {k}
            <button
              type="button"
              aria-label={`Remove ${k}`}
              onClick={() => onChange(value.filter((x) => x !== k))}
              className="text-zinc-500 transition-colors hover:text-[#f87171]"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={commit}
          placeholder={value.length ? "" : "Add a keyword and press Enter"}
          className="min-w-[160px] flex-1 bg-transparent px-1 py-1 text-xs text-white placeholder:text-zinc-600 outline-none"
        />
      </div>
    </div>
  );
}

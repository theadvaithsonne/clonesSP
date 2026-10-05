"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { Image as ImageIcon, Loader2, Radio, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { createWorkshop, generateWorkshopMeeting, uploadFile, type Channel, type TeamMember } from "@/lib/feed-api";
import DescriptionEditor from "./DescriptionEditor";
import { showSellablePublished } from "@/components/shared/SellablePublishedModal";
import { SpeakerPicker } from "@/components/dashboard/SpeakerPicker";
import { WorkshopCommunitySelector } from "./WorkshopCommunitySelector";

// An instant stream has no scheduling UI, so the window is derived: it starts
// now and runs for this long. Long enough that a normal session doesn't get
// marked completed underneath the founder while they're still broadcasting.
const INSTANT_DURATION_HOURS = 2;

interface InstantLiveStreamModalProps {
  onClose: () => void;
  /** Refresh the live streams list. Called once the stream exists. */
  onSuccess: () => void;
  orgId: string;
  channels: Channel[];
  /** Office roster, for the speakers picker. */
  members: TeamMember[];
  /** Current organization name — used for the default title. */
  orgName?: string | null;
}

/**
 * "Go live now" form. Deliberately short compared to CreateWorkshopModal:
 * a community is the only thing we genuinely need, everything else is
 * optional and can be edited afterwards from the live streams list.
 *
 * Under the hood an instant stream is just a Workshop dated today, published
 * and with its meeting generated in one go — the same two calls the schedule
 * form makes when you hit Publish.
 */
export function InstantLiveStreamModal({
  onClose,
  onSuccess,
  orgId,
  channels,
  members,
  orgName,
}: InstantLiveStreamModalProps) {
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [speakerIds, setSpeakerIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [goingLive, setGoingLive] = useState(false);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const defaultTitle = `${orgName || "Garage"}'s Live Stream`;

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }
    setUploadingThumbnail(true);
    try {
      const { url } = await uploadFile(file);
      setThumbnail(url);
      toast.success("Cover image uploaded!");
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setUploadingThumbnail(false);
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
    }
  };

  const handleGoLive = async () => {
    if (channelIds.length === 0) {
      toast.error("Please select at least one community");
      return;
    }

    setGoingLive(true);
    try {
      const now = new Date();
      const end = new Date(now.getTime() + INSTANT_DURATION_HOURS * 60 * 60 * 1000);
      // The workshop record carries a single `date`, so a window that rolls
      // past midnight would end up with endTime earlier than startTime.
      // Clamp to the end of the day instead of wrapping.
      const endTime =
        end.getDate() === now.getDate() ? format(end, "HH:mm") : "23:59";

      const result = await createWorkshop(orgId, {
        title: title.trim() || defaultTitle,
        description,
        thumbnail,
        date: format(now, "yyyy-MM-dd"),
        startTime: format(now, "HH:mm"),
        endTime,
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
        maxParticipants: 100,
        channelIds,
        speakerIds: speakerIds.length ? speakerIds : undefined,
        isFree: true,
        price: 0,
        currency: "USD",
        isActive: true,
        isRecurring: false,
        recordingMode: "automatic",
      });

      const workshopId = result.workshop._id;
      if (!workshopId) throw new Error("Live stream was created without an id");

      // Sets workshop.meetingUrl — without it the stream stays a draft and
      // the host room refuses to open.
      await generateWorkshopMeeting(workshopId, orgId);

      showSellablePublished({
        kind: "live-stream",
        heading: "You're live!",
        badge: "Live now",
        cta: "Join live",
        title: result.workshop.title || title.trim() || defaultTitle,
        image: thumbnail || null,
        url: `/webinar/${workshopId}`,
        price: "Free",
        facts: [`Started ${format(now, "h:mm a")}`],
      });
      onSuccess();
      window.open(`/webinar/${workshopId}?role=host`, "_blank");
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to start live stream",
      );
    } finally {
      setGoingLive(false);
    }
  };

  const busy = goingLive || uploadingThumbnail;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-[520px] max-h-[92vh] flex flex-col bg-[#111114] border border-[#2a2a35] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">

        {/* ── Sticky Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a35] shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <h2 className="text-base font-semibold text-white">Go Live Now</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={goingLive}
            className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35] transition-colors disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable Body ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6" style={{ scrollbarWidth: "none" }}>
          <input
            ref={thumbnailInputRef}
            type="file"
            accept="image/*"
            onChange={handleThumbnailUpload}
            className="hidden"
          />

          {/* ════ AUDIENCE ════ */}
          <div className="pb-6 border-b border-[#2a2a35]/40">
            <WorkshopCommunitySelector
              channels={channels}
              selectedIds={channelIds}
              onChange={setChannelIds}
            />
          </div>

          {/* ════ SPEAKERS ════ */}
          <div className="pb-6 border-b border-[#2a2a35]/40">
            <label className="text-xs font-semibold text-[#9fa0b8] uppercase tracking-wide">Speakers</label>
            <p className="text-xs text-[#9fa0b8] mb-3 mt-1">
              Office members on stage. Listed on the stream page and seated as co-hosts when they join.
            </p>
            <SpeakerPicker members={members} selectedIds={speakerIds} onChange={setSpeakerIds} />
          </div>

          {/* ════ OPTIONAL DETAILS ════ */}
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#9fa0b8]">
                Live Stream Name <span className="text-[#6b6b7b] font-normal">(optional)</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={defaultTitle}
                maxLength={200}
                className="w-full bg-[#131316] border border-[#2a2a35] text-white text-sm rounded-xl px-3 py-2.5 outline-none focus:border-brand/60 transition-colors placeholder:text-[#4a4a5a]"
              />
              <p className="text-xs text-[#6b6b7b]">
                Leave blank and it&apos;ll be called &ldquo;{defaultTitle}&rdquo;.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#9fa0b8]">
                Description <span className="text-[#6b6b7b] font-normal">(optional)</span>
              </label>
              <DescriptionEditor
                value={description}
                onChange={setDescription}
                placeholder="What are you going live about?"
              />
            </div>

            {/* Cover Image */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#9fa0b8]">
                Cover Image <span className="text-[#6b6b7b] font-normal">(optional)</span>
              </label>

              {thumbnail ? (
                <div className="relative w-full h-40 rounded-xl overflow-hidden border border-[#2a2a35] bg-[#131316] flex items-center justify-center group">
                  <div
                    className="absolute inset-0 bg-cover bg-center filter blur-2xl opacity-30 scale-105 select-none pointer-events-none"
                    style={{ backgroundImage: `url(${thumbnail})` }}
                  />
                  <div className="absolute inset-0 bg-black/20 z-0" />
                  <img
                    src={thumbnail}
                    alt="Cover"
                    className="relative max-w-[90%] max-h-[85%] object-contain z-10 rounded-lg shadow-2xl border border-white/5"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2.5 z-20">
                    <button
                      type="button"
                      onClick={() => thumbnailInputRef.current?.click()}
                      disabled={uploadingThumbnail}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-white text-black hover:bg-white/90 px-3.5 py-2 rounded-xl transition-colors shadow-lg"
                    >
                      {uploadingThumbnail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Change
                    </button>
                    <button
                      type="button"
                      onClick={() => setThumbnail("")}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-xl transition-colors shadow-lg"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => thumbnailInputRef.current?.click()}
                  disabled={uploadingThumbnail}
                  className="w-full border border-dashed border-[#2a2a35] rounded-xl flex items-center hover:border-brand/50 transition-colors cursor-pointer bg-[#131316] hover:bg-[#131316]/80"
                >
                  {uploadingThumbnail ? (
                    <div className="w-full py-8 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 p-5 w-full">
                      <div className="w-12 h-12 rounded-xl bg-[#131316] flex items-center justify-center border border-[#2a2a35] shrink-0">
                        <ImageIcon className="w-5 h-5 text-[#9fa0b8]" />
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-semibold text-white block">Upload cover image</span>
                        <p className="text-xs text-[#6b6b7b] mt-0.5">
                          Images should be horizontal, at least 1280&times;720px. PNG or JPG
                        </p>
                      </div>
                    </div>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Sticky Footer ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[#2a2a35] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={goingLive}
            className="px-4 py-2.5 text-sm font-semibold text-[#9fa0b8] hover:text-white transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGoLive}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#EF4444] text-white hover:bg-[#dc2626] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {goingLive ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Starting…
              </>
            ) : (
              <>
                <Radio className="h-4 w-4" /> Go Live
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

// A18 · Careers page — how the office appears to candidates: cover, headline,
// about, culture photos, perks, whether referral rewards show publicly, and
// the public address. Name and logo come from the office profile.

import React from "react";
import { ImagePlus, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useUploadThing } from "@/lib/uploadthing";
import * as jobsApi from "../../api";
import { useJobsNav } from "../../nav";
import { Button, Card, Chip, CopyButton, OrgLogo, TextArea, TextInput, Toggle } from "../../ui";
import { SaveBar, SectionHeading, errorMessage, useDraft, type SectionProps } from "./shared";

type CareersDraft = {
  coverImage: string;
  headline: string;
  about: string;
  culturePhotos: string[];
  perks: string[];
  showRewards: boolean;
};

const MAX_PHOTOS = 12;
const MAX_PERKS = 20;
const MAX_IMAGE_MB = 8;

function checkImage(file: File): string | null {
  if (!file.type.startsWith("image/")) return `${file.name} isn't an image.`;
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) return `${file.name} is larger than ${MAX_IMAGE_MB} MB.`;
  return null;
}

export default function CareersPageSection({ data, onSaved, onDirtyChange }: SectionProps) {
  const nav = useJobsNav();
  const cp = data.settings.careersPage;
  const baseline = React.useMemo<CareersDraft>(
    () => ({
      coverImage: cp.coverImage || "",
      headline: cp.headline || "",
      about: cp.about || "",
      culturePhotos: cp.culturePhotos || [],
      perks: cp.perks || [],
      showRewards: !!cp.showRewards,
    }),
    [cp]
  );
  const { draft, setDraft, dirty, reset } = useDraft(baseline, onDirtyChange);
  const set = (patch: Partial<CareersDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const { startUpload } = useUploadThing("postDocuments");
  const [uploadingCover, setUploadingCover] = React.useState(false);
  const [uploadingPhotos, setUploadingPhotos] = React.useState(false);
  const [perkDraft, setPerkDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const coverInput = React.useRef<HTMLInputElement>(null);
  const photosInput = React.useRef<HTMLInputElement>(null);

  const uploadImages = async (files: File[]): Promise<string[]> => {
    for (const f of files) {
      const problem = checkImage(f);
      if (problem) throw new Error(problem);
    }
    const uploaded = await startUpload(files);
    return uploaded.map((u) => u.url).filter(Boolean);
  };

  const onCover = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const [url] = await uploadImages([file]);
      if (url) set({ coverImage: url });
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't upload the cover image."));
    } finally {
      setUploadingCover(false);
      if (coverInput.current) coverInput.current.value = "";
    }
  };

  const onPhotos = async (list: FileList | null) => {
    if (!list?.length) return;
    const room = MAX_PHOTOS - draft.culturePhotos.length;
    const files = Array.from(list).slice(0, Math.max(0, room));
    if (!files.length) {
      toast.error(`You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    if (list.length > files.length) toast.message(`Only the first ${files.length} photo(s) fit — the limit is ${MAX_PHOTOS}.`);
    setUploadingPhotos(true);
    try {
      const urls = await uploadImages(files);
      setDraft((d) => ({ ...d, culturePhotos: [...d.culturePhotos, ...urls].slice(0, MAX_PHOTOS) }));
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't upload the photos."));
    } finally {
      setUploadingPhotos(false);
      if (photosInput.current) photosInput.current.value = "";
    }
  };

  const addPerk = () => {
    const p = perkDraft.trim().slice(0, 60);
    if (!p) return;
    if (draft.perks.some((x) => x.toLowerCase() === p.toLowerCase())) {
      setPerkDraft("");
      return;
    }
    if (draft.perks.length >= MAX_PERKS) {
      toast.error(`You can list up to ${MAX_PERKS} perks.`);
      return;
    }
    set({ perks: [...draft.perks, p] });
    setPerkDraft("");
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await jobsApi.saveCareersPage({
        coverImage: draft.coverImage || null,
        headline: draft.headline.trim(),
        about: draft.about.trim(),
        culturePhotos: draft.culturePhotos,
        perks: draft.perks,
        showRewards: draft.showRewards,
      });
      onSaved(res.settings);
      toast.success("Careers page saved");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the careers page."));
    } finally {
      setSaving(false);
    }
  };

  const busy = uploadingCover || uploadingPhotos;

  return (
    <div>
      <SectionHeading
        title="Careers page"
        description={`Shape how ${data.org.name} appears to candidates.`}
      />

      <div className="space-y-5">
        <Card className="flex items-center gap-4 p-5">
          <OrgLogo name={data.org.name} src={data.org.icon} size={48} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">{data.org.name}</div>
            <div className="text-xs text-[#7c7d94]">Name and logo come from your office profile.</div>
          </div>
          <Button variant="secondary" onClick={() => nav.go("Office Settings")}>
            Edit in Office Settings
          </Button>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-white">Cover image</div>
              <div className="text-xs text-[#7c7d94]">Shown across the top of your careers page. Wide images work best.</div>
            </div>
            <div className="flex gap-2">
              {draft.coverImage && (
                <Button variant="secondary" onClick={() => set({ coverImage: "" })} disabled={busy}>
                  Remove
                </Button>
              )}
              <Button variant="secondary" onClick={() => coverInput.current?.click()} loading={uploadingCover} disabled={busy}>
                <ImagePlus className="h-4 w-4" /> {draft.coverImage ? "Replace" : "Upload"}
              </Button>
            </div>
          </div>
          {draft.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.coverImage} alt="" className="aspect-[16/5] w-full rounded-xl border border-[#262626] object-cover" />
          ) : (
            <button
              type="button"
              onClick={() => coverInput.current?.click()}
              disabled={busy}
              className="flex aspect-[16/5] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#3A3A3A] bg-[#141414] text-sm text-[#7c7d94] transition-colors hover:border-[#4a4a5c] disabled:opacity-60"
            >
              {uploadingCover ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              {uploadingCover ? "Uploading…" : `Upload a cover image · ${MAX_IMAGE_MB} MB max`}
            </button>
          )}
          <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => onCover(e.target.files)} />
        </Card>

        <Card className="space-y-4 p-5">
          <TextInput
            label="Headline"
            value={draft.headline}
            maxLength={200}
            placeholder={`Build what's next with ${data.org.name}`}
            onChange={(e) => set({ headline: e.target.value })}
          />
          <TextArea
            label="About"
            hint={`${draft.about.length} / 4000`}
            rows={5}
            value={draft.about}
            maxLength={4000}
            placeholder="What you build, who you build it for, and how the team works."
            onChange={(e) => set({ about: e.target.value })}
          />
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-white">Culture photos</div>
              <div className="text-xs text-[#7c7d94]">
                {draft.culturePhotos.length} / {MAX_PHOTOS} · the team, the space, the moments.
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => photosInput.current?.click()}
              loading={uploadingPhotos}
              disabled={busy || draft.culturePhotos.length >= MAX_PHOTOS}
            >
              <Plus className="h-4 w-4" /> Add photos
            </Button>
          </div>
          {draft.culturePhotos.length ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {draft.culturePhotos.map((url, i) => (
                <div key={`${url}-${i}`} className="group relative aspect-square overflow-hidden rounded-xl border border-[#262626] bg-[#141414]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => set({ culturePhotos: draft.culturePhotos.filter((_, j) => j !== i) })}
                    className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Remove photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-[#262626] px-4 py-6 text-center text-xs text-[#61627a]">
              No culture photos yet.
            </p>
          )}
          <input ref={photosInput} type="file" accept="image/*" multiple hidden onChange={(e) => onPhotos(e.target.files)} />
        </Card>

        <Card className="p-5">
          <div className="mb-3">
            <div className="text-sm font-medium text-white">Perks</div>
            <div className="text-xs text-[#7c7d94]">Highlights candidates see on your careers page.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {draft.perks.map((p) => (
              <Chip key={p} onRemove={() => set({ perks: draft.perks.filter((x) => x !== p) })}>
                {p}
              </Chip>
            ))}
            <input
              value={perkDraft}
              maxLength={60}
              onChange={(e) => setPerkDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPerk();
                }
              }}
              placeholder="Add a perk and press Enter"
              disabled={draft.perks.length >= MAX_PERKS}
              className="w-56 rounded-lg border border-[#262626] bg-[#1A1A1A] px-3 py-1.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-brand disabled:opacity-50"
            />
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="text-sm font-medium text-white">Publishing</div>
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Public URL</div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3">
              <span className="min-w-0 truncate text-sm text-white">{data.careersUrl}</span>
              <CopyButton value={data.careersUrl} />
            </div>
            <p className="mt-2 text-xs text-[#61627a]">
              Your public careers page goes live at this address with the candidate-side release.
            </p>
          </div>
          <Toggle
            checked={draft.showRewards}
            onChange={(v) => set({ showRewards: v })}
            label="Show referral rewards on public page"
            description="Visitors see the per-hire reward on roles that have one."
          />
        </Card>
      </div>

      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={save}
        onDiscard={reset}
        problem={busy ? "Wait for uploads to finish." : null}
      />
    </div>
  );
}

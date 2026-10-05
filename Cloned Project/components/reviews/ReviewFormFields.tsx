"use client";

import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { StarRatingInput } from "./StarRating";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/feed-api";
import { RATING_LABELS, StarKey } from "@/lib/reviews-api";

export const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB — matches the field's own copy
// Mirrors MAX_REVIEW_BODY / MAX_REVIEW_TITLE in the backend's review.model.ts
// — change both together or the counter will promise what the API rejects.
export const MAX_BODY = 500;
export const MAX_TITLE = 140;

/**
 * Body length for limit purposes: whitespace doesn't count. Must match
 * `countReviewChars` in the backend's review.model.ts.
 */
export function countBodyChars(value: string): number {
  return value.replace(/\s/g, "").length;
}

export interface ReviewFormValue {
  rating: number;
  title: string;
  body: string;
  images: string[];
}

export const EMPTY_REVIEW_FORM: ReviewFormValue = {
  rating: 0,
  title: "",
  body: "",
  images: [],
};

/**
 * The client-side guard rails, shared by every surface that submits a review.
 * Returns an error message, or null when the draft is good to send. The server
 * re-checks all of it — this exists so the user hears about it before the round
 * trip, not instead of it.
 */
export function validateReviewForm(value: ReviewFormValue): string | null {
  if (value.rating < 1) return "Pick a star rating first";
  if (!value.body.trim()) return "Tell others what you thought";
  // Catches an over-long draft that arrived by paste, or an older review
  // written before the limit was lowered.
  if (countBodyChars(value.body) > MAX_BODY) {
    return `Please shorten your review to ${MAX_BODY} characters or fewer (spaces aren't counted)`;
  }
  return null;
}

interface ReviewFormFieldsProps {
  value: ReviewFormValue;
  onChange: (next: ReviewFormValue) => void;
  disabled?: boolean;
  /** Lets the host disable Submit while an attachment is still uploading. */
  onUploadingChange?: (uploading: boolean) => void;
  /** Upload failures surface in the host's single error slot. */
  onError?: (message: string) => void;
}

/**
 * Rating / headline / details / attachments — the body of the write-a-review
 * form, with no dialog chrome and no submit button.
 *
 * Controlled, so a host can add its own fields around it (the office picker in
 * RateOfficesDialog) and decide what submitting means, while every surface
 * keeps the same fields, the same limits and the same copy.
 */
export function ReviewFormFields({
  value,
  onChange,
  disabled = false,
  onUploadingChange,
  onError,
}: ReviewFormFieldsProps) {
  const [hoverRating, setHoverRating] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayRating = (hoverRating || value.rating) as StarKey | 0;
  const bodyChars = countBodyChars(value.body);

  function patch(fields: Partial<ReviewFormValue>) {
    onChange({ ...value, ...fields });
  }

  function setUploadingState(next: boolean) {
    setUploading(next);
    onUploadingChange?.(next);
  }

  async function handleFiles(files: FileList | File[]) {
    const picked = Array.from(files);
    if (picked.length === 0) return;

    const room = MAX_IMAGES - value.images.length;
    if (room <= 0) {
      onError?.(`You can attach at most ${MAX_IMAGES} images`);
      return;
    }

    const accepted: File[] = [];
    for (const file of picked.slice(0, room)) {
      if (!file.type.startsWith("image/")) {
        onError?.("Only image files can be attached");
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        onError?.(`"${file.name}" is larger than 5MB`);
        return;
      }
      accepted.push(file);
    }

    setUploadingState(true);
    try {
      const uploaded = await Promise.all(
        accepted.map((file) => uploadFile(file))
      );
      // `value` is this render's snapshot, so a second batch started mid-upload
      // would append to a stale list and drop the first batch. Both entry
      // points below refuse to start while `uploading` is true, which is what
      // makes that impossible rather than merely unlikely.
      onChange({
        ...value,
        images: [...value.images, ...uploaded.map((u) => u.url)],
      });
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploadingState(false);
    }
  }

  return (
    <>
      {/* Rating */}
      <div className="space-y-2">
        <label className="block text-[11px] font-semibold text-[#8a8a9b] uppercase tracking-wider">
          Your rating
        </label>
        <div className="flex items-center gap-3">
          <StarRatingInput
            value={value.rating}
            onChange={(rating) => patch({ rating })}
            hoverValue={hoverRating}
            onHoverChange={setHoverRating}
            disabled={disabled}
          />
          {displayRating > 0 && (
            <span className="text-sm font-semibold text-brand">
              {RATING_LABELS[displayRating as StarKey]} ({displayRating}/5)
            </span>
          )}
        </div>
      </div>

      {/* Headline */}
      <div className="space-y-2">
        <label
          htmlFor="review-headline"
          className="block text-[11px] font-semibold text-[#8a8a9b] uppercase tracking-wider"
        >
          Review headline
        </label>
        <input
          id="review-headline"
          type="text"
          value={value.title}
          maxLength={MAX_TITLE}
          disabled={disabled}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="Sum it up in a line"
          // A review headline is never a reusable identity field, so the
          // browser's saved-entries dropdown is only noise here.
          autoComplete="off"
          spellCheck
          // `data-lg-field` is inert on its own — it only picks up the liquid
          // glass treatment under a `.lg-scope` ancestor (the Ratings & Reviews
          // dialog), so the other surfaces rendering this form keep their flat
          // styling.
          data-lg-field=""
          className="autofill-dark w-full px-3 py-2.5 bg-[#111115] border border-[#2a2a35] rounded-lg text-sm text-white placeholder:text-[#5a5a6a] outline-none focus:border-brand/60 transition-colors disabled:opacity-60"
        />
      </div>

      {/* Details */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="review-details"
            className="block text-[11px] font-semibold text-[#8a8a9b] uppercase tracking-wider"
          >
            Review details
          </label>
          <span
            className={cn(
              "text-[11px] tabular-nums",
              bodyChars >= MAX_BODY ? "text-brand" : "text-[#5a5a67]"
            )}
            title="Spaces aren't counted"
          >
            {bodyChars}/{MAX_BODY}
          </span>
        </div>
        <textarea
          id="review-details"
          value={value.body}
          disabled={disabled}
          // No `maxLength`: the cap counts non-whitespace only, so the raw
          // string length isn't the limit. Extra input is rejected here unless
          // the user is shortening the text (so deleting, and editing an
          // over-long draft, always still work).
          onChange={(e) => {
            const next = e.target.value;
            if (
              countBodyChars(next) <= MAX_BODY ||
              next.length < value.body.length
            ) {
              patch({ body: next });
            }
          }}
          rows={6}
          placeholder="What stood out? What would you tell someone considering this?"
          data-lg-field=""
          className="w-full px-3 py-2.5 bg-[#111115] border border-[#2a2a35] rounded-lg text-sm text-white placeholder:text-[#5a5a6a] outline-none focus:border-brand/60 transition-colors resize-y min-h-[120px] disabled:opacity-60"
        />
      </div>

      {/* Attachments */}
      <div className="space-y-2">
        <label className="block text-[11px] font-semibold text-[#8a8a9b] uppercase tracking-wider">
          Attach screenshot (optional)
        </label>

        {value.images.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-1">
            {value.images.map((url) => (
              <div key={url} className="relative group">
                <img
                  src={url}
                  alt="Attachment"
                  className="w-16 h-16 rounded-lg object-cover border border-[#2a2a35]"
                />
                <button
                  type="button"
                  onClick={() =>
                    patch({ images: value.images.filter((u) => u !== url) })
                  }
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black border border-[#2a2a35] text-white/80 hover:text-white hover:border-red-400 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Remove image"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {value.images.length < MAX_IMAGES && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (!uploading && e.dataTransfer.files?.length) {
                handleFiles(e.dataTransfer.files);
              }
            }}
            onClick={() => !uploading && fileInputRef.current?.click()}
            data-lg-dropzone=""
            data-lg-drag={dragActive ? "true" : "false"}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 py-7 px-4 rounded-lg border border-dashed transition-colors cursor-pointer",
              dragActive
                ? "border-brand bg-brand/5"
                : "border-[#2a2a35] hover:border-[#3a3a47] bg-[#111115]",
              uploading && "opacity-70 cursor-wait"
            )}
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 text-[#8a8a9b] animate-spin" />
            ) : (
              <Upload className="w-5 h-5 text-[#8a8a9b]" />
            )}
            <span className="text-xs text-[#8a8a9b]">
              {uploading
                ? "Uploading…"
                : "Drag & drop images here, or click to upload"}
            </span>
            <span className="text-[10px] text-[#5a5a67]">
              PNG, JPG up to 5MB
            </span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </>
  );
}

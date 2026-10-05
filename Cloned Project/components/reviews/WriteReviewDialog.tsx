"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import {
  ReviewFormFields,
  ReviewFormValue,
  EMPTY_REVIEW_FORM,
  validateReviewForm,
} from "./ReviewFormFields";
import {
  Review,
  ReviewTargetType,
  createReview,
  updateReview,
} from "@/lib/reviews-api";

interface WriteReviewDialogProps {
  open: boolean;
  onClose: () => void;
  targetType: ReviewTargetType;
  targetId: string;
  /** Present when editing — the dialog pre-fills and PATCHes instead. */
  existingReview?: Review | null;
  onSubmitted: (review: Review) => void;
}

export function WriteReviewDialog({
  open,
  onClose,
  targetType,
  targetId,
  existingReview,
  onSubmitted,
}: WriteReviewDialogProps) {
  const isEditing = Boolean(existingReview);

  const [form, setForm] = useState<ReviewFormValue>(EMPTY_REVIEW_FORM);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset (or pre-fill) whenever the dialog opens, so a cancelled draft
  // doesn't leak into the next open.
  useEffect(() => {
    if (!open) return;
    setForm({
      rating: existingReview?.rating ?? 0,
      title: existingReview?.title ?? "",
      body: existingReview?.body ?? "",
      images: existingReview?.images ?? [],
    });
    setError(null);
  }, [open, existingReview]);

  // Escape to close, and lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, submitting, onClose]);

  if (!open) return null;

  async function handleSubmit() {
    const invalid = validateReviewForm(form);
    if (invalid) {
      setError(invalid);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        rating: form.rating,
        body: form.body.trim(),
        title: form.title.trim() || undefined,
        images: form.images,
      };

      const saved =
        isEditing && existingReview
          ? await updateReview(existingReview._id, payload)
          : await createReview(targetType, targetId, payload);

      onSubmitted(saved);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit your review"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? "Edit your review" : "Write a review"}
        // Same surface as a feed post card (FeedComponents.tsx PostCard).
        className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-[#111115] border border-[#2a2a35] rounded-2xl shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h2 className="text-lg font-bold text-white">
            {isEditing ? "Edit your review" : "Write a review"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded-md text-[#8a8a9b] hover:text-white hover:bg-[#2a2a35] transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          <ReviewFormFields
            value={form}
            onChange={setForm}
            disabled={submitting}
            onUploadingChange={setUploading}
            onError={setError}
          />

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-[#c4c4d4] hover:text-white transition-colors cursor-pointer bg-transparent border-0 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || uploading}
              className="px-5 py-2 bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_79%,white)] text-brand-foreground text-sm font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEditing ? "Save changes" : "Submit a review"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

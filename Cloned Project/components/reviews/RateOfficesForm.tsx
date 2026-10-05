"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, Check, Crown, Loader2 } from "lucide-react";
import {
  ReviewFormFields,
  ReviewFormValue,
  EMPTY_REVIEW_FORM,
  validateReviewForm,
} from "./ReviewFormFields";
import { StarRating } from "./StarRating";
import { cn } from "@/lib/utils";
import { useMyOffices, MyOffice } from "@/lib/hooks/useMyOffices";
import {
  Review,
  createReview,
  updateReview,
  getMyReview,
} from "@/lib/reviews-api";

interface RateOfficesFormProps {
  /** Mounted state drives the reset — the host keeps the form unmounted when hidden. */
  open: boolean;
  onClose: () => void;
  /** Pre-ticks an office — e.g. the one the user is currently signed in to. */
  defaultOfficeId?: string | null;
  /** Fires after at least one office was rated successfully. */
  onSubmitted?: () => void;
}

/** A per-office outcome, so a partial failure names the office that failed. */
interface SubmitFailure {
  officeName: string;
  message: string;
}

/**
 * Rate the offices you've joined.
 *
 * The same form as `WriteReviewDialog` (identical fields, limits and copy —
 * both render `ReviewFormFields`) with one field added on top: which offices
 * this rating applies to. Ticking several submits the same rating and text to
 * each of them, as one review per office, which is what the reviews API stores
 * — there is no such thing as a review spanning two targets.
 *
 * Offices you already rated switch the submit to an edit, so re-submitting
 * updates your review instead of failing the API's one-review-per-target rule.
 *
 * Offices you *run* are listed but not selectable: a founder can't rate their
 * own office. The backend rejects it outright; showing the office greyed with
 * the reason beats hiding it, which would just read as a missing office.
 *
 * Renders the form body and its own action row, without dialog chrome — the
 * host (`RatingsReviewsDialog`) owns the modal and the tab bar.
 */
export function RateOfficesForm({
  open,
  onClose,
  defaultOfficeId,
  onSubmitted,
}: RateOfficesFormProps) {
  const {
    offices,
    loading: loadingOffices,
    error: officesError,
  } = useMyOffices(open);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<ReviewFormValue>(EMPTY_REVIEW_FORM);

  /** officeId -> the caller's existing review of it, once looked up. */
  const [existing, setExisting] = useState<Record<string, Review | null>>({});
  const [loadingExisting, setLoadingExisting] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState<SubmitFailure[]>([]);

  // Rateable first, then the ones you run — a list that opens with disabled
  // rows reads as a broken feature.
  const rateable = useMemo(
    () => offices.filter((office) => !office.isFounder),
    [offices]
  );
  const owned = useMemo(
    () => offices.filter((office) => office.isFounder),
    [offices]
  );

  // Fresh state on every open, so a cancelled draft doesn't leak into the next.
  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_REVIEW_FORM);
    setExisting({});
    setError(null);
    setFailures([]);
  }, [open]);

  // Pre-tick the current office, but only once we know it isn't one the user
  // runs — ticking then un-ticking as the list arrives would be worse than
  // waiting a beat.
  useEffect(() => {
    if (!open) return;
    const preselect =
      defaultOfficeId && rateable.some((o) => o.id === defaultOfficeId)
        ? [defaultOfficeId]
        : [];
    setSelected(new Set(preselect));
  }, [open, defaultOfficeId, rateable]);

  // Look up which of these offices the user has already reviewed. Without this
  // a re-submit would 409 against the one-review-per-target index; with it, the
  // row shows their current stars and the submit becomes an edit.
  useEffect(() => {
    if (!open || rateable.length === 0) return;

    let cancelled = false;
    setLoadingExisting(true);

    Promise.all(
      rateable.map((office) =>
        getMyReview("office", office.id)
          .then((result) => [office.id, result.review] as const)
          // A lookup failure just means we treat it as unrated: the submit
          // still recovers via the 409 fallback below.
          .catch(() => [office.id, null] as const)
      )
    )
      .then((entries) => {
        if (cancelled) return;
        setExisting(Object.fromEntries(entries));
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, rateable]);

  const toggleOffice = useCallback((officeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(officeId) ? next.delete(officeId) : next.add(officeId);
      return next;
    });
  }, []);

  const allSelected =
    rateable.length > 0 && rateable.every((o) => selected.has(o.id));

  const selectedOffices = useMemo(
    () => rateable.filter((office) => selected.has(office.id)),
    [rateable, selected]
  );

  // Editing means seeing what you wrote: when the user has exactly one office
  // ticked and they've reviewed it before, load that review into the still
  // untouched form. A dirty form is never overwritten, and multi-select stays
  // blank — one draft can't honestly represent two different old reviews.
  useEffect(() => {
    const pristine =
      form.rating === 0 &&
      form.title === "" &&
      form.body === "" &&
      form.images.length === 0;
    if (!pristine || selectedOffices.length !== 1) return;

    const mine = existing[selectedOffices[0].id];
    if (!mine) return;

    setForm({
      rating: mine.rating,
      title: mine.title ?? "",
      body: mine.body ?? "",
      images: mine.images ?? [],
    });
  }, [selectedOffices, existing, form]);

  /**
   * Submit one office. Creates, or edits when the user has already reviewed it
   * — including the case where the existing review appeared after this dialog
   * loaded, which the API reports as a 409.
   */
  async function submitOne(
    office: MyOffice,
    payload: {
      rating: number;
      body: string;
      title?: string;
      images: string[];
    }
  ): Promise<void> {
    const known = existing[office.id];
    if (known) {
      await updateReview(known._id, payload);
      return;
    }

    try {
      await createReview("office", office.id, payload);
    } catch (err) {
      const mine = await getMyReview("office", office.id).catch(() => null);
      if (mine?.review) {
        await updateReview(mine.review._id, payload);
        return;
      }
      throw err;
    }
  }

  async function handleSubmit() {
    // Checked against the resolved offices, not the raw id set: a
    // `defaultOfficeId` the user isn't actually a member of gets pre-ticked but
    // never renders a row, and submitting an empty batch would otherwise look
    // like a silent success.
    if (selectedOffices.length === 0) {
      setError("Pick at least one office to rate");
      return;
    }

    const invalid = validateReviewForm(form);
    if (invalid) {
      setError(invalid);
      return;
    }

    setSubmitting(true);
    setError(null);
    setFailures([]);

    const payload = {
      rating: form.rating,
      body: form.body.trim(),
      title: form.title.trim() || undefined,
      images: form.images,
    };

    // One office failing must not discard the others' reviews, so each is
    // settled independently and the failures are reported by name.
    const results = await Promise.allSettled(
      selectedOffices.map((office) => submitOne(office, payload))
    );

    const failed: SubmitFailure[] = [];
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        failed.push({
          officeName: selectedOffices[index].name,
          message:
            result.reason instanceof Error
              ? result.reason.message
              : "Couldn't submit",
        });
      }
    });

    setSubmitting(false);

    if (failed.length === results.length) {
      setFailures(failed);
      return;
    }

    // Anything that landed moves an average, so tell rating cards elsewhere on
    // screen to re-fetch — same convention ReviewsPanel uses.
    window.dispatchEvent(new CustomEvent("reviews:changed"));
    onSubmitted?.();

    if (failed.length > 0) {
      setFailures(failed);
      return;
    }
    onClose();
  }

  if (!open) return null;

  const nothingRateable = !loadingOffices && rateable.length === 0;

  const allUpdates =
    selectedOffices.length > 0 &&
    selectedOffices.every((office) => existing[office.id]);
  const submitLabel = submitting
    ? "Submitting…"
    : selectedOffices.length > 1
      ? `${allUpdates ? "Update" : "Submit"} ${selectedOffices.length} reviews`
      : allUpdates
        ? "Update review"
        : "Submit review";

  return (
    <div className="space-y-5">
      {/* Office picker — the field this form adds to the standard one. */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <label className="block text-[11px] font-semibold text-[#9a9aab] uppercase tracking-wider">
            Which office
          </label>

          {rateable.length > 1 && (
            <button
              type="button"
              disabled={submitting}
              onClick={() =>
                setSelected(
                  allSelected ? new Set() : new Set(rateable.map((o) => o.id))
                )
              }
              className="text-[11px] font-medium text-[#9a9aab] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          )}
        </div>

        {loadingOffices ? (
          <div className="lg-panel flex items-center justify-center gap-2 py-8 rounded-2xl">
            <Loader2 className="w-4 h-4 text-[#9a9aab] animate-spin" />
            <span className="text-xs text-[#9a9aab]">Loading your offices…</span>
          </div>
        ) : officesError ? (
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-400/25 rounded-2xl px-3 py-2.5 backdrop-blur-md">
            {officesError}
          </div>
        ) : offices.length === 0 ? (
          <div className="lg-panel rounded-2xl px-4 py-6 text-center">
            <Building2 className="w-5 h-5 text-[#7a7a8a] mx-auto mb-2" />
            <p className="text-sm text-[#e2e2ea] font-medium">
              You haven&apos;t joined an office yet
            </p>
            <p className="text-xs text-[#8a8a9b] mt-1">
              Join one and you can rate it from here.
            </p>
          </div>
        ) : (
          <>
            <div className="lg-panel lg-divide max-h-[188px] overflow-y-auto rounded-2xl">
              {rateable.map((office) => (
                <OfficeRow
                  key={office.id}
                  office={office}
                  selected={selected.has(office.id)}
                  existingRating={existing[office.id]?.rating ?? null}
                  pendingRating={form.rating}
                  disabled={submitting}
                  onToggle={() => toggleOffice(office.id)}
                />
              ))}

              {owned.map((office) => (
                <OfficeRow key={office.id} office={office} owned />
              ))}
            </div>

            {nothingRateable && (
              <p className="text-[11px] text-[#8a8a9b] leading-relaxed">
                You run every office on your account. Ratings are for the people
                who joined an office, so there&apos;s nothing here for you to
                rate.
              </p>
            )}

            {loadingExisting && rateable.length > 0 && (
              <p className="text-[11px] text-[#7a7a8a]">
                Checking which offices you&apos;ve already rated…
              </p>
            )}

            {selectedOffices.length > 1 && (
              <p className="text-[11px] text-[#8a8a9b]">
                The same rating and review goes to all{" "}
                {selectedOffices.length} selected offices.
              </p>
            )}
          </>
        )}
      </div>

      <ReviewFormFields
        value={form}
        onChange={setForm}
        disabled={submitting || nothingRateable}
        onUploadingChange={setUploading}
        onError={setError}
      />

      {error && (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-400/25 rounded-xl px-3 py-2 backdrop-blur-md">
          {error}
        </div>
      )}

      {failures.length > 0 && (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-400/25 rounded-xl px-3 py-2 space-y-1 backdrop-blur-md">
          {failures.map((failure) => (
            <div key={failure.officeName}>
              <span className="font-semibold">{failure.officeName}:</span>{" "}
              {failure.message}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="lg-btn px-4 py-2 rounded-xl text-sm font-medium text-[#e2e2ea] hover:text-white cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || uploading || nothingRateable}
          className="lg-btn-primary px-5 py-2 text-brand-foreground text-sm font-bold rounded-xl cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

interface OfficeRowProps {
  office: MyOffice;
  /** The viewer runs this office, so it's shown but not selectable. */
  owned?: boolean;
  selected?: boolean;
  existingRating?: number | null;
  /** The rating currently set in the form, echoed onto selected rows. */
  pendingRating?: number;
  disabled?: boolean;
  onToggle?: () => void;
}

/**
 * One office in the picker.
 *
 * A selected row echoes the rating the form is about to submit, and when the
 * user has rated this office before, shows the old value struck through to the
 * new one. Rating several offices at once is otherwise a blind action — this is
 * what makes "you are about to give these three offices 4 stars, changing one
 * of them from 2" legible before the button is pressed.
 */
function OfficeRow({
  office,
  owned = false,
  selected = false,
  existingRating = null,
  pendingRating = 0,
  disabled = false,
  onToggle,
}: OfficeRowProps) {
  const showsPending = selected && pendingRating > 0;

  const content = (
    <>
      {/* Checkbox, or a crown for an office you run. */}
      {owned ? (
        <span
          className="w-4 h-4 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <Crown className="w-3.5 h-3.5 text-[#5a5a67]" />
        </span>
      ) : (
        <span
          className={cn(
            "w-4 h-4 rounded-[6px] border flex items-center justify-center shrink-0 transition-all",
            selected
              ? "bg-brand border-brand shadow-[0_0_12px_-2px_color-mix(in_srgb,_var(--brand)_70%,_transparent)]"
              : "border-white/25 bg-white/5"
          )}
        >
          {selected && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
        </span>
      )}

      {office.icon ? (
        <img
          src={office.icon}
          alt=""
          className="w-7 h-7 rounded-lg object-cover bg-white/10 ring-1 ring-white/10 shrink-0"
        />
      ) : (
        <span className="w-7 h-7 rounded-lg bg-white/[0.07] ring-1 ring-white/10 flex items-center justify-center shrink-0">
          <Building2 className="w-3.5 h-3.5 text-[#9a9aab]" />
        </span>
      )}

      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm text-white truncate leading-tight">
          {office.name}
        </span>
        {owned ? (
          <span className="block text-[11px] text-[#8a8a9b] leading-tight mt-0.5">
            You run this office
          </span>
        ) : existingRating ? (
          <span className="block text-[11px] text-[#8a8a9b] leading-tight mt-0.5">
            {selected ? "Updates your review" : "You rated this"}
          </span>
        ) : null}
      </span>

      {/* Right slot: what this row's rating will be after submitting. */}
      {!owned && (existingRating || showsPending) && (
        <span className="flex items-center gap-1.5 shrink-0">
          {existingRating && (
            <StarRating
              value={existingRating}
              size={11}
              tone={showsPending ? "muted" : "accent"}
            />
          )}
          {showsPending && existingRating && (
            <ArrowRight className="w-3 h-3 text-[#5a5a67]" />
          )}
          {showsPending && <StarRating value={pendingRating} size={11} />}
        </span>
      )}
    </>
  );

  if (owned) {
    return (
      <div
        className="w-full flex items-center gap-2.5 px-3 py-2.5 opacity-45 select-none"
        title="A founder can't rate their own office"
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "lg-row w-full flex items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand/60",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        selected && "lg-row-selected"
      )}
    >
      {content}
    </button>
  );
}

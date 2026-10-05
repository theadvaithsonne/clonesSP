"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  MessageSquareQuote,
  ImagePlus,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const MAX_IMAGES = 10;

interface TestimonialImage {
  url: string;
  caption?: string;
}

interface Testimonial {
  _id: string;
  name: string;
  message: string;
  images?: TestimonialImage[];
  approvedAt: string;
}

// "mayur sonne" -> "Mayur Sonne" — capitalizes the first letter of every
// word as the user types, without touching the rest of what they typed.
function capitalizeWords(value: string): string {
  return value.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

interface PendingImage {
  file: File;
  previewUrl: string;
  uploadedUrl: string | null;
  caption: string;
  uploading: boolean;
  error: boolean;
}

function TestimonialCard({
  t,
  onImageClick,
}: {
  t: Testimonial;
  onImageClick: (images: TestimonialImage[], index: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const images = t.images ?? [];
  const hasImages = images.length > 0;
  const isLong = t.message.length > 260;
  const currentCaption = images[index]?.caption;

  function prev() {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }
  function next() {
    setIndex((i) => (i + 1) % images.length);
  }

  return (
    <div className="rounded-2xl border border-[#e6dcc3] bg-white overflow-hidden flex flex-col sm:flex-row">
      {hasImages && (
        <div className="relative w-full sm:w-[240px] aspect-[4/5] bg-black flex-shrink-0 group">
          {/*
            All of this card's photos are mounted up front and swapped with
            opacity instead of changing a single <img>'s src, so in-card
            next/prev and opening the popup viewer are instant — nothing
            has to be re-fetched.
          */}
          {images.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.url}
              src={img.url}
              alt={img.caption || ""}
              onClick={() => onImageClick(images, index)}
              className={`absolute inset-0 w-full h-full object-contain cursor-zoom-in transition-opacity duration-150 ${
                i === index ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            />
          ))}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/45 text-white text-[11px] font-bold">
                {index + 1}/{images.length}
              </div>
            </>
          )}
          {/* Bottom overlay: caption (only when the current photo actually
              has one) stacked above the page dots (only when there's more
              than one photo) — combined into a single scrim so they never
              collide, instead of two independently-positioned bars.
              Caption is clamped to 2 lines at rest; hovering THIS BAR
              specifically (its own group/cap, not the whole photo) drops
              the clamp — capped at 75% of the photo's height with its own
              scroll so a very long caption can't push past the top edge.
              Scoped to a local group instead of the outer photo-wide one
              on purpose: that was capturing hover over the prev/next
              arrows too (they sit in the same photo box), which meant
              clicking "next" briefly expanded the caption right as you
              tried to click through it. The arrows live outside this
              bar's DOM subtree now, so hovering them no longer affects it. */}
          {(currentCaption || images.length > 1) && (
            <div className="group/cap absolute bottom-0 inset-x-0 max-h-[75%] overflow-hidden group-hover/cap:overflow-y-auto bg-gradient-to-t from-black/80 to-transparent group-hover/cap:bg-black/90 px-3 pt-8 pb-2 flex flex-col items-center gap-1.5 transition-colors">
              {currentCaption && (
                <p
                  title={currentCaption}
                  className="w-full text-white text-[12px] leading-snug line-clamp-2 group-hover/cap:line-clamp-none text-left"
                >
                  {currentCaption}
                </p>
              )}
              {images.length > 1 && (
                <div className="flex items-center gap-1.5">
                  {images.map((_, i) => (
                    <span
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        i === index ? "bg-white" : "bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <div className={`flex flex-col p-6 sm:p-7 ${hasImages ? "flex-1 min-w-0" : "w-full"}`}>
        <MessageSquareQuote className="w-6 h-6 text-stone-300 mb-3 flex-shrink-0" />
        <p
          className={`text-stone-600 text-[15px] leading-relaxed flex-1 ${
            isLong && !expanded ? "line-clamp-4" : "mb-4"
          }`}
        >
          {t.message}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-emerald-800 text-sm font-semibold hover:underline mb-4 self-start"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
        <p className="text-stone-900 text-base font-bold">— {t.name}</p>
      </div>
    </div>
  );
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function clampScale(v: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));
}

function touchDistance(touches: React.TouchList): number {
  const a = touches[0];
  const b = touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: TestimonialImage[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  // Closing state drives a quick fade-out before the popup actually
  // unmounts — without it the overlay (plus up to 10 stacked full-res
  // images) disappears in a single frame, which reads as a lag/jump
  // rather than a close.
  const [closing, setClosing] = useState(false);

  // Zoom/pan state for the currently visible image.
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef(1);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Reset zoom whenever the visible image changes.
  useEffect(() => {
    resetZoom();
  }, [index, resetZoom]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);
  const next = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 150);
  }, [onClose]);

  // Keyboard nav + lock page scroll while the viewer is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [handleClose, prev, next]);

  function zoomIn() {
    setScale((s) => clampScale(s + 0.5));
  }
  function zoomOut() {
    setScale((s) => {
      const next = clampScale(s - 0.5);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }
  function toggleZoom() {
    if (scale > 1) resetZoom();
    else setScale(2.5);
  }

  // Mouse drag-to-pan (desktop, only while zoomed in).
  function onMouseDown(e: React.MouseEvent) {
    if (scale <= 1) return;
    draggingRef.current = true;
    lastPointRef.current = { x: e.clientX, y: e.clientY };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastPointRef.current.x;
    const dy = e.clientY - lastPointRef.current.y;
    lastPointRef.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }
  function stopDragging() {
    draggingRef.current = false;
  }

  // Wheel-to-zoom (desktop).
  function onWheel(e: React.WheelEvent) {
    const delta = e.deltaY > 0 ? -0.4 : 0.4;
    setScale((s) => {
      const nextScale = clampScale(s + delta);
      if (nextScale === 1) setPan({ x: 0, y: 0 });
      return nextScale;
    });
  }

  // Touch: pinch-to-zoom with two fingers, drag-to-pan with one finger
  // while zoomed in.
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      pinchStartDistRef.current = touchDistance(e.touches);
      pinchStartScaleRef.current = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      draggingRef.current = true;
      lastPointRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      const ratio = touchDistance(e.touches) / pinchStartDistRef.current;
      const nextScale = clampScale(pinchStartScaleRef.current * ratio);
      setScale(nextScale);
      if (nextScale === 1) setPan({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && draggingRef.current) {
      const touch = e.touches[0];
      const dx = touch.clientX - lastPointRef.current.x;
      const dy = touch.clientY - lastPointRef.current.y;
      lastPointRef.current = { x: touch.clientX, y: touch.clientY };
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchStartDistRef.current = null;
    if (e.touches.length === 0) draggingRef.current = false;
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 sm:p-10 transition-opacity duration-150 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
      onClick={handleClose}
    >
      {/* z-20 so this always sits above the full-screen photo underneath it
          — without an explicit stack order the image (painted after this
          button in the DOM) could visually cover the top-right corner and
          swallow the tap/click meant for Close. */}
      <button
        type="button"
        onClick={handleClose}
        aria-label="Close"
        style={{ touchAction: "manipulation" }}
        className="absolute z-20 top-4 right-4 sm:top-6 sm:right-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Caption of the currently-viewed photo — only rendered when it has
          one. Left-aligned with room cleared on the right for the close
          button (top-right), rather than a pill shape, since captions can
          run to a full sentence rather than a short label. */}
      {images[index]?.caption && (
        <div
          className="absolute z-20 top-4 left-4 right-16 sm:top-6 sm:left-6 sm:right-20 px-4 py-2 rounded-xl bg-black/50 text-white text-sm font-semibold leading-snug line-clamp-2"
          onClick={(e) => e.stopPropagation()}
        >
          {images[index].caption}
        </div>
      )}

      <div
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
        style={{ touchAction: "none" }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={toggleZoom}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* All photos mount up front and swap via opacity, so next/prev
            inside the popup are instant with no re-fetch lag. */}
        {images.map((img, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={img.url}
            src={img.url}
            alt={img.caption || ""}
            draggable={false}
            className={`absolute max-w-full max-h-full object-contain select-none transition-opacity duration-150 ${
              i === index ? "opacity-100" : "opacity-0 pointer-events-none"
            } ${scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
            style={
              i === index
                ? {
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                    transition: draggingRef.current ? "none" : "transform 0.15s ease-out",
                  }
                : undefined
            }
          />
        ))}

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous photo"
              style={{ touchAction: "manipulation" }}
              className="absolute z-20 left-1 sm:left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next photo"
              style={{ touchAction: "manipulation" }}
              className="absolute z-20 right-1 sm:right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-7 h-7" />
            </button>
            <div className="absolute z-10 bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-sm font-bold">
              {index + 1}/{images.length}
            </div>
          </>
        )}

        {/* Zoom controls */}
        <div className="absolute z-20 bottom-4 left-4 flex items-center gap-1 rounded-full bg-white/10 p-1">
          <button
            type="button"
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
            aria-label="Zoom out"
            style={{ touchAction: "manipulation" }}
            className="w-9 h-9 rounded-full hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-white text-xs font-bold w-10 text-center select-none">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
            aria-label="Zoom in"
            style={{ touchAction: "manipulation" }}
            className="w-9 h-9 rounded-full hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LostMoneyTestimonialsPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[] | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<PendingImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<{ images: TestimonialImage[]; index: number } | null>(null);

  useEffect(() => {
    fetch(`${API}/bat246/lostmoney/testimonials`)
      .then((r) => r.json())
      .then((d) => setTestimonials(d.testimonials ?? []))
      .catch(() => setTestimonials([]));
  }, []);

  async function uploadImage(entry: PendingImage) {
    const form = new FormData();
    form.append("file", entry.file);
    try {
      const res = await fetch(`${API}/uploads/public`, { method: "POST", body: form });
      const d = await res.json();
      if (!res.ok || !d.url) throw new Error();
      setImages((prev) =>
        prev.map((img) => (img === entry ? { ...img, uploading: false, uploadedUrl: d.url } : img))
      );
    } catch {
      setImages((prev) =>
        prev.map((img) => (img === entry ? { ...img, uploading: false, error: true } : img))
      );
    }
  }

  function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) return;
    const newEntries: PendingImage[] = Array.from(files)
      .slice(0, room)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        uploadedUrl: null,
        caption: "",
        uploading: true,
        error: false,
      }));
    setImages((prev) => [...prev, ...newEntries]);
    newEntries.forEach((entry) => uploadImage(entry));
  }

  function removeImage(entry: PendingImage) {
    setImages((prev) => prev.filter((img) => img !== entry));
    URL.revokeObjectURL(entry.previewUrl);
  }

  function setImageCaption(entry: PendingImage, caption: string) {
    setImages((prev) => prev.map((img) => (img === entry ? { ...img, caption } : img)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !message.trim()) {
      setError("Please fill in your name and testimonial before submitting.");
      return;
    }
    if (images.some((img) => img.uploading)) {
      setError("Please wait for your images to finish uploading.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/bat246/lostmoney/testimonials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          message: message.trim(),
          images: images
            .filter((img) => img.uploadedUrl)
            .map((img) => ({ url: img.uploadedUrl, caption: img.caption.trim() })),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Something went wrong. Please try again.");
        return;
      }
      setSubmitted(true);
      setName("");
      setMessage("");
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      setImages([]);
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#e6dcc3] mb-5">
        <span className="text-xs font-bold text-emerald-800 uppercase tracking-[0.12em]">In Their Words</span>
      </div>
      <h1 className="text-3xl sm:text-4xl font-black mb-3 text-stone-900">Testimonials</h1>
      <p className="text-stone-500 text-lg mb-10 max-w-[680px]">
        What people have to say about B2 and this process.
      </p>

      {testimonials === null ? (
        <div className="flex items-center gap-2 text-stone-400 text-base py-6 mb-14">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : testimonials.length === 0 ? (
        <div className="p-10 rounded-2xl border border-[#e6dcc3] bg-white text-center mb-14">
          <p className="text-stone-500 text-base">No testimonials yet — be the first to share your story.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-14 items-start">
          {testimonials.map((t) => (
            <TestimonialCard
              key={t._id}
              t={t}
              onImageClick={(images, index) => setLightbox({ images, index })}
            />
          ))}
        </div>
      )}

      <div className="rounded-3xl bg-[#f2ead6] border border-[#e6dcc3] p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 items-start">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 mb-2">Share Your Story</h2>
          <p className="text-stone-500 text-base leading-relaxed max-w-[420px]">
            Your testimonial will appear on this page once it&apos;s been reviewed and approved by
            our team.
          </p>
        </div>

        {submitted ? (
          <div className="flex items-center gap-2 text-emerald-800 text-base p-4 rounded-lg bg-white border border-emerald-800/20">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            Thank you — your testimonial has been submitted for review.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-[15px] text-stone-600 mb-2">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(capitalizeWords(e.target.value))}
                className="w-full h-12 px-4 rounded-lg bg-white border border-[#d9cead] text-base text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-800"
              />
            </div>
            <div>
              <label className="block text-[15px] text-stone-600 mb-2">Your Testimonial</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-white border border-[#d9cead] text-base text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-800 resize-y"
              />
            </div>

            <div>
              <label className="block text-[15px] text-stone-600 mb-2">
                Photos <span className="text-stone-400">(optional, up to {MAX_IMAGES})</span>
              </label>
              <div className="flex flex-wrap gap-3">
                {images.map((img, i) => (
                  <div key={i} className="w-20">
                    <div className="relative w-20 h-16 rounded-lg overflow-hidden border border-[#d9cead]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                      {img.uploading && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        </div>
                      )}
                      {img.error && (
                        <div className="absolute inset-0 bg-red-900/60 flex items-center justify-center text-white text-[10px] font-bold text-center px-1">
                          Failed
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(img)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {/* Optional per-photo caption — kept short (a label,
                        not the story itself; that's what the textarea
                        above is for) and hidden while the upload is still
                        in flight or failed, since there's nothing to
                        caption yet at that point. */}
                    {!img.uploading && !img.error && (
                      <input
                        type="text"
                        value={img.caption}
                        onChange={(e) => setImageCaption(img, e.target.value)}
                        placeholder="Caption (optional)"
                        maxLength={200}
                        className="mt-1 w-full px-1.5 py-1 rounded border border-[#d9cead] text-[11px] text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-800"
                      />
                    )}
                  </div>
                ))}
                {images.length < MAX_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-16 rounded-lg border-2 border-dashed border-[#d9cead] flex items-center justify-center text-stone-400 hover:text-emerald-800 hover:border-emerald-800 transition-colors"
                  >
                    <ImagePlus className="w-6 h-6" />
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFilesSelected(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-base">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto self-start px-6 py-3 rounded-lg bg-emerald-800 text-white font-bold text-base hover:bg-emerald-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {submitting ? "Submitting…" : "Submit Testimonial"}
            </button>
          </form>
        )}
      </div>

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

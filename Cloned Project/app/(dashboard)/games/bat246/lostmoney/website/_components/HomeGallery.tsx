"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface GalleryImage {
  _id: string;
  url: string;
}

export default function HomeGallery() {
  const [images, setImages] = useState<GalleryImage[] | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    fetch(`${API}/bat246/lostmoney/gallery`)
      .then((r) => r.json())
      .then((d) => setImages(d.images ?? []))
      .catch(() => setImages([]));
  }, []);

  function prev() {
    if (!images || images.length === 0) return;
    setIndex((i) => (i - 1 + images.length) % images.length);
  }
  function next() {
    if (!images || images.length === 0) return;
    setIndex((i) => (i + 1) % images.length);
  }

  // Nothing to show yet (loading, or admin hasn't uploaded any photos) —
  // stay out of the way rather than showing an empty box.
  if (!images || images.length === 0) return null;

  return (
    <div className="relative w-full aspect-[4/3] sm:aspect-[16/11] rounded-2xl overflow-hidden bg-black border border-[#e6dcc3] group">
      {/*
        All photos are mounted up front (each fetched/decoded once by the
        browser) and swapped with opacity instead of changing a single
        <img>'s src on every click. Swapping src forces a fresh
        fetch+decode of the new photo on every next/prev press, which is
        what caused the visible lag — this keeps every photo already
        loaded, so switching is instant.
      */}
      {images.map((img, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={img._id}
          src={img.url}
          alt=""
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-150 ${
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
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next photo"
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {images.map((img, i) => (
              <span
                key={img._id}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === index ? "bg-white" : "bg-white/50"
                }`}
              />
            ))}
          </div>
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/45 text-white text-[11px] font-bold flex items-center gap-1">
            <ImageIcon className="w-3 h-3" /> {index + 1}/{images.length}
          </div>
        </>
      )}
    </div>
  );
}

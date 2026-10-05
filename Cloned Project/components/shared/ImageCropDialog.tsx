"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  FlipHorizontal,
  FlipVertical,
  Loader2,
  RotateCcw,
  RotateCw,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const MAX_ZOOM = 4;
const ZOOM_STEP = 0.15;
const MAX_TILT = 45;
/** Breathing room between the crop window and the edge of the stage. */
const STAGE_PADDING = 56;

interface Point {
  x: number;
  y: number;
}

/**
 * `fill` crops the image to the frame (nothing empty, edges lost).
 * `fit` shrinks the whole image into the frame and backs the leftover space.
 */
export type CropMode = "fill" | "fit";
/** What sits behind the image in `fit` mode. */
export type CropBackdrop = "blur" | "black" | "white";

/** A framing choice, stored independently of the on-screen frame size. */
export interface CropState {
  zoom: number;
  /** Degrees, clockwise. */
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  /** Centre of the crop, as a 0–1 fraction of the image's natural size. */
  focusX: number;
  focusY: number;
  mode?: CropMode;
  backdrop?: CropBackdrop;
}

const DEFAULT_STATE: CropState = {
  zoom: 1,
  rotation: 0,
  flipX: false,
  flipY: false,
  focusX: 0.5,
  focusY: 0.5,
  mode: "fill",
  backdrop: "blur",
};

const BACKDROP_COLORS: Record<Exclude<CropBackdrop, "blur">, string> = {
  black: "#000000",
  white: "#ffffff",
};
/** Overdraw on the blurred backdrop so its soft edges never reach the frame. */
const BACKDROP_OVERDRAW = 1.12;
const BACKDROP_BLUR_PX = 28;

interface ImageCropDialogProps {
  open: boolean;
  /** A freshly picked File, or the URL of an already uploaded image. */
  source: File | string | null;
  /** Width / height of the crop window. Defaults to the 16:9 banner ratio. */
  aspect?: number;
  /**
   * A narrower ratio the same image is also displayed at (e.g. the mobile
   * banner). Drawn as a centred guide showing what those screens keep.
   */
  safeAreaAspect?: number;
  /**
   * Tallest ratio to actually save, centred on the crop window. Saving a
   * squarer image than the crop keeps surrounding pixels for repositioning
   * and for surfaces that show this image less wide, without changing what
   * the (object-cover, centred) banner displays. Defaults to `aspect`,
   * i.e. save exactly the crop.
   */
  storeAspect?: number;
  /**
   * Save the *whole* image, padded so the crop window stays dead centre.
   * `object-cover` shows the middle, so the banner is still exactly the crop
   * — but every other surface, and any later reframe, gets the full picture
   * without needing a second file. Supersedes `storeAspect`.
   */
  storeWholeImage?: boolean;
  /** Longest edge of the exported image. */
  outputWidth?: number;
  title?: string;
  description?: string;
  confirmLabel?: string;
  /** Keeps the confirm button in a spinner state while the caller uploads. */
  busy?: boolean;
  /** Shown in the rail — e.g. to say this is the saved crop, not the original. */
  notice?: string;
  /** Reopen on the framing the user chose last time. */
  initialState?: CropState | null;
  onCancel: () => void;
  onConfirm: (blob: Blob, state: CropState) => void | Promise<void>;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Reads a remote image through our own origin, so the canvas stays clean. */
const proxied = (url: string) =>
  `/api/image-proxy?url=${encodeURIComponent(url)}`;

const decodeImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });

/**
 * Downloads an image and hands back a local object URL for it.
 *
 * Loading an already-saved image straight off its host taints the canvas
 * (upload hosts rarely send CORS headers, and a browser that cached the image
 * for an ordinary `<img>` replays that header-less copy even for a
 * `crossOrigin` request) — and a tainted canvas can't be exported, which is
 * what used to force a re-upload just to reposition an old cover. Fetching the
 * bytes ourselves sidesteps that: same-origin blob in, clean canvas out. The
 * proxy is the fallback for hosts that refuse the direct fetch.
 */
const fetchAsObjectUrl = async (
  url: string,
): Promise<{ objectUrl: string; type: string } | null> => {
  for (const candidate of [url, proxied(url)]) {
    try {
      const res = await fetch(candidate, { credentials: "omit" });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob.size) continue;
      return { objectUrl: URL.createObjectURL(blob), type: blob.type };
    } catch {
      // CORS, network or proxy failure — try the next route in.
    }
  }
  return null;
};

export default function ImageCropDialog({
  open,
  source,
  aspect = 16 / 9,
  safeAreaAspect,
  storeAspect,
  storeWholeImage = false,
  outputWidth = 1600,
  title = "Edit image",
  description,
  confirmLabel = "Save changes",
  busy = false,
  notice,
  initialState = null,
  onCancel,
  onConfirm,
}: ImageCropDialogProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startFocus: Point;
  } | null>(null);
  /** Captured when the dialog opens so later edits don't re-trigger the reset. */
  const initialStateRef = useRef<CropState | null>(initialState);
  /** Guards the one-shot auto-switch to Fit, so it never fights the user. */
  const autoModeSettled = useRef(false);

  const [mounted, setMounted] = useState(false);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  /** Rotation is split so the buttons turn corners and the slider straightens. */
  const [quarterTurns, setQuarterTurns] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [mode, setMode] = useState<CropMode>("fill");
  const [backdrop, setBackdrop] = useState<CropBackdrop>("blur");
  /** True only while Fit is on because we chose it, not the user. */
  const [autoFitted, setAutoFitted] = useState(false);
  /** Crop centre in natural image pixels, measured from the image centre. */
  const [focus, setFocus] = useState<Point>({ x: 0, y: 0 });
  const [loadError, setLoadError] = useState(false);
  /** A remote image we could only display, never read — so it can't be exported. */
  const [exportBlocked, setExportBlocked] = useState(false);
  const [exporting, setExporting] = useState(false);
  /** Mime type of what's loaded, so a re-crop keeps a PNG's transparency. */
  const [sourceType, setSourceType] = useState<string>("");

  useEffect(() => setMounted(true), []);

  // ---- load the source ------------------------------------------------------
  useEffect(() => {
    if (!open || !source) return;

    let cancelled = false;
    let objectUrl: string | null = null;
    const start = initialState ?? DEFAULT_STATE;
    initialStateRef.current = initialState;
    autoModeSettled.current = false;
    setImage(null);
    setLoadError(false);
    setExportBlocked(false);
    setZoom(start.zoom);
    setQuarterTurns(Math.round(start.rotation / 90));
    setTilt(start.rotation - Math.round(start.rotation / 90) * 90);
    setFlipX(start.flipX);
    setFlipY(start.flipY);
    setMode(start.mode ?? "fill");
    setAutoFitted(false);
    setBackdrop(start.backdrop ?? "blur");
    setFocus({ x: 0, y: 0 });
    setSourceType(typeof source === "string" ? "" : source.type);

    const settle = (img: HTMLImageElement, blocked = false) => {
      setImage(img);
      setFocus({
        x: (start.focusX - 0.5) * img.naturalWidth,
        y: (start.focusY - 0.5) * img.naturalHeight,
      });
      setExportBlocked(blocked);
    };

    const load = async () => {
      if (typeof source !== "string") {
        objectUrl = URL.createObjectURL(source);
        try {
          const img = await decodeImage(objectUrl);
          if (!cancelled) settle(img);
        } catch {
          if (!cancelled) setLoadError(true);
        }
        return;
      }

      // Already-saved image: pull the bytes down first, directly or through
      // our proxy, so it can be re-cropped rather than only looked at.
      const fetched = await fetchAsObjectUrl(source);
      if (cancelled) {
        if (fetched) URL.revokeObjectURL(fetched.objectUrl);
        return;
      }
      if (fetched) {
        try {
          const img = await decodeImage(fetched.objectUrl);
          if (cancelled) {
            URL.revokeObjectURL(fetched.objectUrl);
            return;
          }
          objectUrl = fetched.objectUrl;
          setSourceType(fetched.type);
          settle(img);
          return;
        } catch {
          URL.revokeObjectURL(fetched.objectUrl);
        }
      }

      // Nothing readable came back. The host may still render it in an <img>,
      // so show it — the user can see what they have, just not export it.
      try {
        const img = await decodeImage(source);
        if (!cancelled) settle(img, true);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // `initialState` is deliberately read once, when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source]);

  // ---- measure the stage ----------------------------------------------------
  useLayoutEffect(() => {
    if (!open) return;
    const el = stageRef.current;
    if (!el) return;

    const measure = () =>
      setStage({ width: el.clientWidth, height: el.clientHeight });
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, mounted, image]);

  // ---- geometry -------------------------------------------------------------
  // The crop window is centred in the stage, as large as fits with padding.
  const availableWidth = Math.max(0, stage.width - STAGE_PADDING * 2);
  const availableHeight = Math.max(0, stage.height - STAGE_PADDING * 2);
  const cropWidth = Math.min(availableWidth, availableHeight * aspect);
  const cropHeight = cropWidth / aspect;

  const rotation = quarterTurns * 90 + tilt;
  const cos = Math.abs(Math.cos(toRadians(rotation)));
  const sin = Math.abs(Math.sin(toRadians(rotation)));

  /**
   * `fill`: smallest scale at which the (possibly rotated) crop window is
   * still fully covered by the image — the rotation-aware `object-cover`.
   * `fit`: largest scale at which the whole rotated image sits inside the
   * crop window — the rotation-aware `object-contain`.
   */
  const baseScale = !image || !cropWidth
    ? 1
    : mode === "fill"
      ? Math.max(
          (cropWidth * cos + cropHeight * sin) / image.naturalWidth,
          (cropWidth * sin + cropHeight * cos) / image.naturalHeight,
        )
      : Math.min(
          cropWidth / (image.naturalWidth * cos + image.naturalHeight * sin),
          cropHeight / (image.naturalWidth * sin + image.naturalHeight * cos),
        );
  const scale = baseScale * zoom;

  /**
   * How far the crop centre may sit from the image centre. Whichever of the
   * two is larger has to contain the other, so the same distance bounds both
   * cases: in `fill` the frame may not slide off the image, in `fit` the
   * image may not slide out of the frame. Natural image pixels.
   */
  const limitX = image
    ? Math.abs(
        image.naturalWidth / 2 -
          (cropWidth * cos + cropHeight * sin) / 2 / scale,
      )
    : 0;
  const limitY = image
    ? Math.abs(
        image.naturalHeight / 2 -
          (cropWidth * sin + cropHeight * cos) / 2 / scale,
      )
    : 0;

  // Clamped during render, so zooming or rotating can never leave a gap — even
  // for a frame — and the raw value is kept so panning back out feels natural.
  const activeFocus: Point = {
    x: Math.min(limitX, Math.max(-limitX, focus.x)),
    y: Math.min(limitY, Math.max(-limitY, focus.y)),
  };

  /**
   * Offset of the image centre from the crop centre, in screen pixels.
   * Derived from `activeFocus` by undoing the flip and rotation.
   */
  const rad = toRadians(rotation);
  const fx = flipX ? -1 : 1;
  const fy = flipY ? -1 : 1;
  const flippedFocus = { x: fx * activeFocus.x, y: fy * activeFocus.y };
  const centerOffset: Point = {
    x:
      -scale *
      (flippedFocus.x * Math.cos(rad) - flippedFocus.y * Math.sin(rad)),
    y:
      -scale *
      (flippedFocus.x * Math.sin(rad) + flippedFocus.y * Math.cos(rad)),
  };

  /**
   * Height of the region actually saved, in stage pixels.
   *
   * The banner uses `object-cover`, which centres what it shows — so saving a
   * taller region than the crop window still puts exactly the chosen band on
   * screen, while keeping the surrounding pixels for later repositioning and
   * for the surfaces that display this image at a squarer ratio. The extra
   * height has to be symmetric about the band or the band stops being the
   * middle, so it can only grow as far as the image reaches on *both* sides.
   */
  const savedHeight = (() => {
    if (!image || !cropWidth) return cropHeight;

    if (storeWholeImage) {
      // Grow until the image's full height is inside. The region has to stay
      // symmetric about the crop window, so one side may end up as padding —
      // that is the price of the banner still showing exactly the crop.
      const imageHalfHeight =
        ((image.naturalWidth * sin + image.naturalHeight * cos) * scale) / 2;
      const needed = 2 * (Math.abs(centerOffset.y) + imageHalfHeight);
      // Enough for any landscape or square upload framed anywhere. Beyond it
      // the user has zoomed so far in that they have chosen a crop anyway, and
      // the padding would dwarf the picture.
      return Math.min(Math.max(cropHeight, needed), cropWidth * 2);
    }

    if (!storeAspect || storeAspect >= aspect) return cropHeight;
    const ceiling = cropWidth / storeAspect; // tallest we would ever save
    // In `fit` the leftover is backdrop, so the extra height is free.
    if (mode === "fit") return ceiling;
    const roomX = scale * (image.naturalWidth - 2 * Math.abs(activeFocus.x)) - cropWidth * cos;
    const roomY = scale * (image.naturalHeight - 2 * Math.abs(activeFocus.y)) - cropWidth * sin;
    const limits = [ceiling];
    if (sin > 1e-6) limits.push(roomX / sin);
    if (cos > 1e-6) limits.push(roomY / cos);
    return Math.max(cropHeight, Math.min(...limits));
  })();
  /** True once the saved region is tall enough that no screen trims the sides. */
  const savedAspect = savedHeight > 0 ? cropWidth / savedHeight : aspect;

  /**
   * The image is already the frame's shape, so there is nothing outside the
   * frame to bring in — dragging and zooming out can achieve nothing. True of
   * a cover saved as a bare banner crop, and of an upload that happens to be
   * banner-shaped.
   */
  const nothingToReveal =
    !!image && cropWidth > 0 && zoom === 1 && limitX < 0.5 && limitY < 0.5;

  /**
   * Whether the saved region reaches past the image — `fit` always does, and
   * `storeWholeImage` does whenever the crop sits off-centre.
   */
  const needsBackdrop =
    mode === "fit" ||
    (!!image &&
      savedHeight / 2 >
        Math.abs(centerOffset.y) +
          ((image.naturalWidth * sin + image.naturalHeight * cos) * scale) / 2 -
          0.5);

  /**
   * Scale at which the image covers the whole saved region — used only for the
   * blurred backdrop in `fit` mode, with a little overdraw so the blur's soft
   * edge never creeps into frame.
   */
  const backdropScale =
    image && cropWidth
      ? Math.max(
          cropWidth / (image.naturalWidth * cos + image.naturalHeight * sin),
          savedHeight / (image.naturalWidth * sin + image.naturalHeight * cos),
        ) * BACKDROP_OVERDRAW
      : 1;

  /**
   * An image that is already the frame's shape has nothing to crop *to* —
   * Fill can only shave it down further. Open such an image in Fit instead,
   * so reframing an existing banner keeps every pixel it still has rather
   * than making the user re-upload. One shot, and only when the caller has
   * not asked for a specific mode.
   */
  useEffect(() => {
    if (!image || !cropWidth || autoModeSettled.current) return;
    autoModeSettled.current = true;
    if (initialStateRef.current?.mode) return;
    if (!nothingToReveal) return;
    setMode("fit");
    setAutoFitted(true);
  }, [image, cropWidth, nothingToReveal]);

  /** Screen-pixel drag delta → change in `focus`. */
  const screenDeltaToFocus = useCallback(
    (dx: number, dy: number): Point => {
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      // Inverse rotation, then undo the flip, then out of screen scale.
      const rx = dx * c + dy * s;
      const ry = -dx * s + dy * c;
      return { x: (-rx / scale) * fx, y: (-ry / scale) * fy };
    },
    [rad, scale, fx, fy],
  );

  // ---- interaction ----------------------------------------------------------
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!image) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startFocus: activeFocus,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const delta = screenDeltaToFocus(
      e.clientX - drag.startX,
      e.clientY - drag.startY,
    );
    setFocus({
      x: drag.startFocus.x + delta.x,
      y: drag.startFocus.y + delta.y,
    });
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.current?.pointerId === e.pointerId) dragState.current = null;
  };

  const applyZoom = useCallback((nextZoom: number) => {
    setZoom(Math.min(MAX_ZOOM, Math.max(1, Number(nextZoom.toFixed(3)))));
  }, []);

  // Wheel needs a non-passive native listener to be able to preventDefault.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !open) return;
    const handler = (e: WheelEvent) => {
      if (!image) return;
      e.preventDefault();
      applyZoom(zoom * (e.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [open, mounted, image, zoom, applyZoom]);

  // Esc closes, arrows nudge.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      const nudge: Record<string, Point> = {
        ArrowLeft: { x: -12, y: 0 },
        ArrowRight: { x: 12, y: 0 },
        ArrowUp: { x: 0, y: -12 },
        ArrowDown: { x: 0, y: 12 },
      };
      const delta = nudge[e.key];
      if (!delta) return;
      e.preventDefault();
      const inFocus = screenDeltaToFocus(delta.x, delta.y);
      setFocus((prev) => ({ x: prev.x + inFocus.x, y: prev.y + inFocus.y }));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel, screenDeltaToFocus]);

  const reset = () => {
    setZoom(1);
    setQuarterTurns(0);
    setTilt(0);
    setFlipX(false);
    setFlipY(false);
    setMode("fill");
    setFocus({ x: 0, y: 0 });
  };

  // ---- export ---------------------------------------------------------------
  const handleConfirm = async () => {
    if (!image || !cropWidth) return;

    // Natural pixels spanned by the crop window, capped at the target width.
    const naturalCropWidth = cropWidth / scale;
    const targetWidth = Math.max(
      320,
      Math.min(outputWidth, Math.round(naturalCropWidth)),
    );
    // Saved at the (possibly taller) region height — the band stays centred,
    // so `object-cover` still shows exactly the crop window.
    const targetHeight = Math.max(1, Math.round((targetWidth * savedHeight) / cropWidth));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Known for a re-crop too, now that saved images are downloaded rather
    // than linked — so reframing a transparent cover doesn't flatten it.
    const keepAlpha = /png|webp|gif|svg/.test(sourceType);
    const screenToOutput = targetWidth / cropWidth;

    // Anything the image doesn't reach needs backing before it is drawn on top.
    if (needsBackdrop) {
      ctx.fillStyle = backdrop === "blur" ? "#000000" : BACKDROP_COLORS[backdrop];
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      if (backdrop === "blur") {
        ctx.save();
        ctx.filter = `blur(${Math.max(4, Math.round(BACKDROP_BLUR_PX * screenToOutput))}px)`;
        ctx.translate(targetWidth / 2, targetHeight / 2);
        ctx.scale(screenToOutput, screenToOutput);
        ctx.rotate(rad);
        ctx.scale(fx * backdropScale, fy * backdropScale);
        ctx.drawImage(
          image,
          -image.naturalWidth / 2,
          -image.naturalHeight / 2,
          image.naturalWidth,
          image.naturalHeight,
        );
        ctx.restore();
      }
    } else if (!keepAlpha) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    // Mirror the on-screen transform: crop centre → offset → rotate → flip+scale.
    ctx.translate(targetWidth / 2, targetHeight / 2);
    ctx.scale(screenToOutput, screenToOutput);
    ctx.translate(centerOffset.x, centerOffset.y);
    ctx.rotate(rad);
    ctx.scale(fx * scale, fy * scale);
    ctx.drawImage(
      image,
      -image.naturalWidth / 2,
      -image.naturalHeight / 2,
      image.naturalWidth,
      image.naturalHeight,
    );

    setExporting(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        try {
          canvas.toBlob(resolve, keepAlpha ? "image/png" : "image/jpeg", 0.92);
        } catch {
          // Tainted canvas — the pixels were never ours to read.
          resolve(null);
        }
      });
      // Only an unreadable canvas belongs here; whatever the caller does with
      // the blob is its own to report, and no reason to demand a re-upload.
      if (!blob) {
        setExportBlocked(true);
        return;
      }
      await onConfirm(blob, {
        zoom,
        rotation,
        flipX,
        flipY,
        focusX: 0.5 + activeFocus.x / image.naturalWidth,
        focusY: 0.5 + activeFocus.y / image.naturalHeight,
        mode,
        backdrop,
      });
    } catch (err) {
      console.error("[ImageCropDialog] confirm failed", err);
    } finally {
      setExporting(false);
    }
  };

  if (!open || !mounted) return null;

  const working = busy || exporting;
  const cropLeft = (stage.width - cropWidth) / 2;
  const cropTop = (stage.height - cropHeight) / 2;
  const iconButton =
    "flex items-center justify-center w-9 h-9 rounded-lg border border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:border-brand/50 transition-colors disabled:opacity-40 disabled:hover:border-[#2a2a35] disabled:hover:text-[#9fa0b8]";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl rounded-2xl border border-[#2a2a35] bg-[#111114] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#1f1f2a] shrink-0">
          <div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            {description && (
              <p className="text-xs text-[#6b6b7b] mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-[#6b6b7b] hover:text-white transition-colors p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row min-h-0 flex-1">
          {/* Stage — the whole image, with everything outside the crop dimmed */}
          <div
            ref={stageRef}
            className={cn(
              "relative flex-1 min-h-[260px] md:min-h-[380px] overflow-hidden bg-[#0b0b0f] select-none touch-none",
              image ? "cursor-grab active:cursor-grabbing" : "cursor-default",
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {image && cropWidth > 0 ? (
              <>
                {/* Backdrop, clipped to the saved region */}
                {needsBackdrop && (
                  <div
                    className="pointer-events-none absolute overflow-hidden"
                    style={{
                      left: cropLeft,
                      top: (stage.height - savedHeight) / 2,
                      width: cropWidth,
                      height: savedHeight,
                      backgroundColor:
                        backdrop === "blur" ? "#000000" : BACKDROP_COLORS[backdrop],
                    }}
                  >
                    {backdrop === "blur" && (
                      <img
                        src={image.src}
                        alt=""
                        draggable={false}
                        style={{
                          position: "absolute",
                          left: "50%",
                          top: "50%",
                          width: image.naturalWidth * backdropScale,
                          height: image.naturalHeight * backdropScale,
                          maxWidth: "none",
                          filter: `blur(${BACKDROP_BLUR_PX}px)`,
                          transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${fx}, ${fy})`,
                        }}
                      />
                    )}
                  </div>
                )}

                <img
                  src={image.src}
                  alt=""
                  draggable={false}
                  style={{
                    position: "absolute",
                    left: stage.width / 2,
                    top: stage.height / 2,
                    width: image.naturalWidth * scale,
                    height: image.naturalHeight * scale,
                    maxWidth: "none",
                    transform: `translate(-50%, -50%) translate(${centerOffset.x}px, ${centerOffset.y}px) rotate(${rotation}deg) scale(${fx}, ${fy})`,
                  }}
                />

                {/* Everything outside the crop window is dimmed by the shadow */}
                <div
                  className="pointer-events-none absolute border border-white/90"
                  style={{
                    left: cropLeft,
                    top: cropTop,
                    width: cropWidth,
                    height: cropHeight,
                    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.62)",
                  }}
                >
                  {/* Rule-of-thirds guides */}
                  <div className="absolute inset-y-0 left-1/3 w-px bg-white/20" />
                  <div className="absolute inset-y-0 left-2/3 w-px bg-white/20" />
                  <div className="absolute inset-x-0 top-1/3 h-px bg-white/20" />
                  <div className="absolute inset-x-0 top-2/3 h-px bg-white/20" />

                  {/* Narrow screens trim the sides only if nothing extra is kept */}
                  {safeAreaAspect && safeAreaAspect < savedAspect && (
                    <div
                      className="absolute inset-y-0 left-1/2 -translate-x-1/2 border-x border-dashed border-brand/70"
                      style={{ width: `${(safeAreaAspect / aspect) * 100}%` }}
                    />
                  )}
                </div>

                {/* What actually gets saved — kept for repositioning later */}
                {savedHeight > cropHeight + 1 && (
                  <div
                    className="pointer-events-none absolute border border-dashed border-white/35"
                    style={{
                      left: cropLeft,
                      top: (stage.height - savedHeight) / 2,
                      width: cropWidth,
                      height: savedHeight,
                    }}
                  >
                    <span className="absolute -top-5 left-0 text-[10px] uppercase tracking-wide text-white/45">
                      Saved area
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-[#6b6b7b]">
                {loadError ? (
                  "Couldn't load this image"
                ) : (
                  <Loader2 className="w-5 h-5 animate-spin text-brand" />
                )}
              </div>
            )}
          </div>

          {/* Controls rail */}
          <div className="w-full md:w-72 shrink-0 border-t md:border-t-0 md:border-l border-[#1f1f2a] bg-[#0e0e12] p-5 space-y-5 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white border-b-2 border-brand pb-1">
                Crop
              </span>
              <button
                type="button"
                onClick={reset}
                disabled={!image}
                title="Reset to the original framing"
                className="flex items-center gap-1.5 text-xs text-[#6b6b7b] hover:text-white transition-colors disabled:opacity-40"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>

            {/* Fill vs fit */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#131316] border border-[#2a2a35]">
                {(
                  [
                    { value: "fill", label: "Fill", hint: "Crop to the frame" },
                    { value: "fit", label: "Fit", hint: "Show the whole image" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setMode(option.value);
                      setAutoFitted(false);
                      setZoom(1);
                      setFocus({ x: 0, y: 0 });
                    }}
                    disabled={!image}
                    title={option.hint}
                    className={cn(
                      "py-1.5 rounded-md text-xs font-semibold transition-colors disabled:opacity-40",
                      mode === option.value
                        ? "bg-brand text-brand-foreground"
                        : "text-[#9fa0b8] hover:text-white",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {needsBackdrop && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#6b6b7b]">Behind</span>
                  {(
                    [
                      { value: "blur", label: "Blur" },
                      { value: "black", label: "Black" },
                      { value: "white", label: "White" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setBackdrop(option.value)}
                      className={cn(
                        "px-2 py-1 rounded-md text-[11px] border transition-colors",
                        backdrop === option.value
                          ? "border-brand/60 text-white"
                          : "border-[#2a2a35] text-[#9fa0b8] hover:text-white",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Rotate / flip */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuarterTurns((q) => q - 1)}
                disabled={!image}
                title="Rotate left"
                className={iconButton}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setQuarterTurns((q) => q + 1)}
                disabled={!image}
                title="Rotate right"
                className={iconButton}
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setFlipX((v) => !v)}
                disabled={!image}
                title="Flip horizontally"
                className={cn(
                  iconButton,
                  flipX && "border-brand/60 text-white",
                )}
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setFlipY((v) => !v)}
                disabled={!image}
                title="Flip vertically"
                className={cn(
                  iconButton,
                  flipY && "border-brand/60 text-white",
                )}
              >
                <FlipVertical className="w-4 h-4" />
              </button>
            </div>

            {/* Zoom */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">Zoom</span>
                <span className="text-xs text-[#6b6b7b] tabular-nums">
                  {zoom.toFixed(1)}×
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => applyZoom(zoom - ZOOM_STEP)}
                  disabled={!image || zoom <= 1}
                  className="text-[#9fa0b8] hover:text-white transition-colors disabled:opacity-40"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <Slider
                  value={[zoom]}
                  min={1}
                  max={MAX_ZOOM}
                  step={0.01}
                  onValueChange={([next]) => applyZoom(next)}
                  disabled={!image}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => applyZoom(zoom + ZOOM_STEP)}
                  disabled={!image || zoom >= MAX_ZOOM}
                  className="text-[#9fa0b8] hover:text-white transition-colors disabled:opacity-40"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Straighten */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">Rotate</span>
                <span className="text-xs text-[#6b6b7b] tabular-nums">
                  {tilt}°
                </span>
              </div>
              {/* Straightens within ±45° of whatever quarter turn is applied. */}
              <Slider
                value={[tilt]}
                min={-MAX_TILT}
                max={MAX_TILT}
                step={1}
                onValueChange={([next]) => setTilt(next)}
                disabled={!image}
              />
            </div>

            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] text-[#6b6b7b]">
                Drag the image to choose what stays inside the bright frame that
                is exactly what shows in the community banner.
              </p>
              {savedHeight > cropHeight + 1 && (
                <p className="text-[11px] text-[#6b6b7b]">
                  The surrounding strip is saved too, so you can reframe this
                  later without uploading again.
                </p>
              )}
              {safeAreaAspect && safeAreaAspect < savedAspect && (
                <p className="text-[11px] text-[#6b6b7b] flex items-start gap-1.5">
                  <span className="inline-block w-3 mt-1.5 border-t border-dashed border-brand/70 shrink-0" />
                  On phones the banner is taller, so it cuts the left and right
                  edges — keep anything important inside the yellow lines.
                </p>
              )}
              {nothingToReveal && mode === "fill" && (
                <p className="text-[11px] text-amber-400/90">
                  This image is already the banner&apos;s shape, so there is
                  nothing outside the frame to bring in. Zoom in to reframe
                  within it, or switch to Fit to keep all of it.
                </p>
              )}
              {mode === "fit" && autoFitted && (
                <p className="text-[11px] text-[#6b6b7b]">
                  This banner is already cropped, so Fit is on to keep all of
                  what&apos;s left — zoom in to reframe within it. Nothing more
                  is lost when you save.
                </p>
              )}
              {notice && (
                <p className="text-[11px] text-amber-400/90">{notice}</p>
              )}
              {exportBlocked && (
                <p className="text-[11px] text-amber-400/90">
                  This image couldn&apos;t be read back from where it&apos;s
                  hosted, so it can&apos;t be re-saved. Upload it again to
                  reposition it.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#1f1f2a] bg-[#0e0e12] shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-[#9fa0b8] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!image || working || exportBlocked}
            className="px-5 py-2 rounded-full text-sm font-semibold bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {working && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

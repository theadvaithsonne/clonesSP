"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { uploadDocusignFile } from "@/lib/docusign/client";
import { Loader2, Upload as UploadIcon } from "lucide-react";
import { isLightColor, type SignatureStyle } from "@/components/dashboard/docusign/shared/fieldStyle";
import { downscaleImage } from "@/components/dashboard/docusign/shared/downscaleImage";

// Checked on the file as picked, before it is downscaled (what is actually sent is far smaller).
const MAX_SIGNATURE_IMAGE_BYTES = 5 * 1024 * 1024;
const SIGNATURE_IMAGE_EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg" };

interface SignatureCaptureModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  onCaptured: (result: { type: "draw" | "type" | "upload"; imageUrl: string }) => void;
  // Size / colour the sender chose for this field. Typed signatures are drawn at that size and colour,
  // drawn ones use the colour as the pen; an uploaded image is always kept exactly as it is.
  style?: SignatureStyle;
  // Defaults to uploadDocusignFile, which sends the logged-in user's platform token. A public,
  // no-login signer (app/sign/[token]/PublicSigningView.tsx) has no such token, so it passes a
  // different implementation here instead — see that file for what it does.
  uploadFn?: (file: Blob | File, filename: string, folder?: string) => Promise<{ url: string }>;
}

const DEFAULT_INK = "#111827";
// Pixels per PDF point for a typed signature drawn at its exact printed size (crisp when scaled).
const TYPED_PX_PER_PT = 4;
// The draw pad's size in CSS pixels at its natural width — the coordinate space strokes are drawn
// in. It is displayed w-full, so pointer positions are scaled into this space, and its backing store
// is devicePixelRatio times bigger (capped at 2) so the ink stays crisp on high-density screens.
const PAD_WIDTH = 460;
const PAD_HEIGHT = 160;

export function SignatureCaptureModal({ open, title = "Add your signature", onClose, onCaptured, style, uploadFn = uploadDocusignFile }: SignatureCaptureModalProps) {
  const inkColor = style?.color ?? DEFAULT_INK;
  // White ink would vanish on the white pad, so light colours get a dark backdrop.
  const lightInk = isLightColor(inkColor);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setHasDrawing(false);
      setTypedName("");
      setUploadFile(null);
    }
  }, [open]);

  // The pad mounts fresh (blank) every time the Draw tab or the dialog opens: size its backing store
  // for this screen and scale the context so drawing still happens in PAD_WIDTH x PAD_HEIGHT units.
  const setCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(PAD_WIDTH * dpr);
    canvas.height = Math.round(PAD_HEIGHT * dpr);
    canvas.getContext("2d")?.scale(dpr, dpr);
  }, []);

  // Where the pointer is, in pad units. The pad is stretched to the dialog's width, so the raw
  // offset from its corner is only right when it happens to be displayed at exactly PAD_WIDTH.
  const padPoint = (canvas: HTMLCanvasElement, e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (PAD_WIDTH / rect.width),
      y: (e.clientY - rect.top) * (PAD_HEIGHT / rect.height),
    };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const ctx = canvas.getContext("2d");
    const { x, y } = padPoint(canvas, e);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  };

  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const { x, y } = padPoint(canvas, e);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = inkColor;
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    setHasDrawing(true);
  };

  const endDraw = () => {
    drawing.current = false;
  };

  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext("2d");
    // In pad units — the context is scaled (see setCanvas).
    if (ctx) ctx.clearRect(0, 0, PAD_WIDTH, PAD_HEIGHT);
    setHasDrawing(false);
  };

  const canvasToPngBlob = (): Promise<Blob | null> =>
    new Promise((resolve) => canvasRef.current?.toBlob((b) => resolve(b), "image/png"));

  const typedNameToPngBlob = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      // With a size set, the image is the box itself (same aspect, text at the chosen pt size) so it
      // prints exactly as sized. Otherwise it is the original fixed 500x150 auto-fit image.
      const exact = !!(style?.fontSize && style.boxWidthPt && style.boxHeightPt);
      const width = exact ? Math.max(40, Math.round(style!.boxWidthPt! * TYPED_PX_PER_PT)) : 500;
      const height = exact ? Math.max(20, Math.round(style!.boxHeightPt! * TYPED_PX_PER_PT)) : 150;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      // Unstyled keeps its white background as before; a styled signature is transparent so a white
      // colour works and the page shows through.
      if (!style?.fontSize && !style?.color) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }
      const pad = exact ? Math.round(height * 0.1) : 20;
      let sizePx = exact ? style!.fontSize! * TYPED_PX_PER_PT : 48;
      const applyFont = () => {
        ctx.font = `italic ${sizePx}px 'Brush Script MT', cursive`;
      };
      applyFont();
      // Never cut a name off: shrink until the whole thing fits inside the box.
      while (sizePx > 8 && ctx.measureText(typedName).width > width - pad * 2) {
        sizePx -= 2;
        applyFont();
      }
      ctx.fillStyle = inkColor;
      ctx.textBaseline = "middle";
      ctx.fillText(typedName, pad, height / 2);
      canvas.toBlob((b) => resolve(b), "image/png");
    });

  const handleSave = async (type: "draw" | "type" | "upload") => {
    setIsSaving(true);
    try {
      let blobOrFile: Blob | File | null = null;
      if (type === "draw") blobOrFile = await canvasToPngBlob();
      else if (type === "type") blobOrFile = await typedNameToPngBlob();
      else if (type === "upload") blobOrFile = uploadFile;

      if (!blobOrFile) {
        toast.error("Nothing to save yet");
        setIsSaving(false);
        return;
      }

      // At most 800x400 and normally a small PNG (a photo becomes a JPEG) — see downscaleImage.ts.
      const image = await downscaleImage(blobOrFile);
      // Named after what the bytes actually are — an uploaded JPG used to go up as
      // "signature.png", and the server picked its image decoder from that name.
      const extension = SIGNATURE_IMAGE_EXTENSIONS[image.type] || "png";
      const { url } = await uploadFn(image, `signature.${extension}`, "docusign/signatures");
      onCaptured({ type, imageUrl: url });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save signature");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Leaving the Draw tab unmounts the pad, so coming back shows a blank one — forget the old
            drawing then too, or "Use this signature" would stay enabled and submit an empty image. */}
        <Tabs
          defaultValue="draw"
          onValueChange={() => {
            drawing.current = false;
            setHasDrawing(false);
          }}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="draw">Draw</TabsTrigger>
            <TabsTrigger value="type">Type</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="draw" className="space-y-3">
            <canvas
              ref={setCanvas}
              className={`w-full touch-none rounded-md border border-[#2a2a35] ${lightInk ? "bg-[#374151]" : "bg-white"}`}
              onPointerDown={startDraw}
              onPointerMove={moveDraw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
            />
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={clearCanvas}>
                Clear
              </Button>
              <Button size="sm" disabled={!hasDrawing || isSaving} onClick={() => handleSave("draw")}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Use this signature"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="type" className="space-y-3">
            <Input
              placeholder="Type your full name"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
            />
            {typedName && (
              <div className={`flex h-24 items-center rounded-md border border-[#2a2a35] px-4 ${lightInk ? "bg-[#374151]" : "bg-white"}`}>
                <span className="text-3xl italic" style={{ fontFamily: "'Brush Script MT', cursive", color: inkColor }}>
                  {typedName}
                </span>
              </div>
            )}
            <div className="flex justify-end">
              <Button size="sm" disabled={!typedName.trim() || isSaving} onClick={() => handleSave("type")}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Use this signature"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-3">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-[#2a2a35] bg-[#0c0c10] p-6 text-center text-xs text-[#8a8a9b] hover:border-[#3b3b4a]">
              <UploadIcon className="h-5 w-5" />
              {uploadFile ? uploadFile.name : "Click to choose an image (PNG/JPG)"}
              {(style?.fontSize || style?.color) && <span className="text-[11px] text-[#7a7a90]">Uploaded images are used exactly as they are.</span>}
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const picked = e.target.files?.[0] || null;
                  e.target.value = "";
                  if (picked && !SIGNATURE_IMAGE_EXTENSIONS[picked.type]) {
                    toast.error("Signature image must be a PNG or JPG");
                    return;
                  }
                  if (picked && picked.size > MAX_SIGNATURE_IMAGE_BYTES) {
                    toast.error("Signature image must be under 5 MB");
                    return;
                  }
                  setUploadFile(picked);
                }}
              />
            </label>
            <div className="flex justify-end">
              <Button size="sm" disabled={!uploadFile || isSaving} onClick={() => handleSave("upload")}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Use this signature"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

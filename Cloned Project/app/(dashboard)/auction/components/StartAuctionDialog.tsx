"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { uploadFile } from "@/lib/coverfi/uploadFile";
import { createAuction, updateAuction, getAuctionMyProducts, type IAuction, type CreateAuctionPayload, type AuctionProduct } from "@/lib/auction-api";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (auction: IAuction) => void;
  editAuction?: IAuction | null;
  creatorName: string;
  creatorAvatar?: string;
}

type Step = 1 | 2 | 3;

interface FormState {
  productSource: "garage" | "outside";
  productId: string;
  productName: string;
  productImages: string[];
  productDescription: string;
  productVideoUrl: string;
  minPrice: string;
  currency: "INR" | "USD";
  durationHours: 1 | 6 | 24 | 48;
}

const DEFAULT_FORM: FormState = {
  productSource: "garage",
  productId: "",
  productName: "",
  productImages: [],
  productDescription: "",
  productVideoUrl: "",
  minPrice: "",
  currency: "USD",
  durationHours: 6,
};

function formatHours(h: number) {
  return h === 1 ? "1 hour" : `${h} hours`;
}

export default function StartAuctionDialog({ open, onClose, onSuccess, editAuction, creatorName, creatorAvatar }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [garageProducts, setGarageProducts] = useState<AuctionProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load editing state
  useEffect(() => {
    if (editAuction) {
      setForm({
        productSource: editAuction.productSource,
        productId: editAuction.productId || "",
        productName: editAuction.productName,
        productImages: editAuction.productImages,
        productDescription: editAuction.productDescription || "",
        productVideoUrl: editAuction.productVideoUrl || "",
        minPrice: String(editAuction.minPrice),
        currency: editAuction.currency,
        durationHours: editAuction.durationHours as 1 | 6 | 24 | 48,
      });
      setStep(1);
    } else {
      setForm(DEFAULT_FORM);
      setStep(1);
    }
    setError("");
  }, [editAuction, open]);

  // Fetch garage products when needed
  useEffect(() => {
    if (open && form.productSource === "garage" && garageProducts.length === 0) {
      setLoadingProducts(true);
      getAuctionMyProducts()
        .then(setGarageProducts)
        .catch(() => setGarageProducts([]))
        .finally(() => setLoadingProducts(false));
    }
  }, [open, form.productSource]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
    setError("");
  }

  function handleGarageProductSelect(productId: string) {
    const product = garageProducts.find((p) => p._id === productId);
    if (product) {
      set("productId", productId);
      set("productName", product.name);
      set("productImages", product.images);
    }
  }

  async function handleImageUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingImages(true);
    try {
      const uploads = await Promise.all(Array.from(files).map((f) => uploadFile(f)));
      set("productImages", [...form.productImages, ...uploads.map((u) => u.url)]);
    } catch {
      setError("Image upload failed. Please try again.");
    } finally {
      setUploadingImages(false);
    }
  }

  function validateStep1(): string {
    if (form.productSource === "garage") {
      if (!form.productId) return "Please select a product";
    } else {
      if (!form.productName.trim()) return "Product title is required";
      if (form.productImages.length === 0) return "At least one image is required";
    }
    return "";
  }

  function validateStep2(): string {
    if (!form.minPrice || isNaN(Number(form.minPrice)) || Number(form.minPrice) < 0) {
      return "Enter a valid minimum price";
    }
    return "";
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const payload: CreateAuctionPayload = {
        productSource: form.productSource,
        productId: form.productSource === "garage" ? form.productId : undefined,
        productName: form.productName,
        productImages: form.productImages,
        productDescription: form.productDescription || undefined,
        productVideoUrl: form.productVideoUrl || undefined,
        minPrice: Number(form.minPrice),
        currency: form.currency,
        durationHours: form.durationHours,
        creatorName,
        creatorAvatar,
      };

      let result: IAuction;
      if (editAuction) {
        result = await updateAuction(editAuction._id, payload);
      } else {
        result = await createAuction(payload);
      }
      onSuccess(result);
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to save auction");
    } finally {
      setSubmitting(false);
    }
  }

  const isEdit = !!editAuction;
  const title = isEdit ? "Edit Auction" : "Start Auction";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title} — Step {step}/3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <Label className="text-sm font-medium">Product Source</Label>
            <RadioGroup
              value={form.productSource}
              onValueChange={(v) => set("productSource", v as "garage" | "outside")}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="garage" id="src-garage" />
                <Label htmlFor="src-garage">From Garage</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="outside" id="src-outside" />
                <Label htmlFor="src-outside">From Outside</Label>
              </div>
            </RadioGroup>

            {form.productSource === "garage" ? (
              <div className="space-y-2">
                <Label>Select Product</Label>
                {loadingProducts ? (
                  <p className="text-sm text-muted-foreground">Loading products…</p>
                ) : (
                  <Select value={form.productId} onValueChange={handleGarageProductSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {garageProducts.length === 0 ? (
                        <SelectItem value="_none" disabled>No active products</SelectItem>
                      ) : (
                        garageProducts.map((p) => (
                          <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
                {form.productImages[0] && (
                  <img src={form.productImages[0]} alt="preview" className="h-24 w-24 rounded object-cover mt-2" />
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Title *</Label>
                  <Input
                    placeholder="Product title"
                    value={form.productName}
                    onChange={(e) => set("productName", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Describe the product"
                    rows={2}
                    value={form.productDescription}
                    onChange={(e) => set("productDescription", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Images *</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleImageUpload(e.target.files)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImages}
                  >
                    {uploadingImages ? "Uploading…" : "Upload Images"}
                  </Button>
                  {form.productImages.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-1">
                      {form.productImages.map((url, i) => (
                        <img key={i} src={url} alt={`img-${i}`} className="h-16 w-16 rounded object-cover" />
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Video URL (optional)</Label>
                  <Input
                    placeholder="https://..."
                    value={form.productVideoUrl}
                    onChange={(e) => set("productVideoUrl", e.target.value)}
                  />
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => {
                const e = validateStep1();
                if (e) { setError(e); return; }
                setStep(2);
              }}>
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Duration</Label>
              <div className="flex gap-2">
                {([1, 6, 24, 48] as const).map((h) => (
                  <Button
                    key={h}
                    type="button"
                    variant={form.durationHours === h ? "default" : "outline"}
                    size="sm"
                    onClick={() => set("durationHours", h)}
                  >
                    {formatHours(h)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Minimum Price *</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.minPrice}
                  onChange={(e) => set("minPrice", e.target.value)}
                  className="flex-1"
                />
                <Select value={form.currency} onValueChange={(v) => set("currency", v as "INR" | "USD")}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="INR">INR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => {
                const e = validateStep2();
                if (e) { setError(e); return; }
                setStep(3);
              }}>
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              {form.productImages[0] && (
                <img
                  src={form.productImages[0]}
                  alt={form.productName}
                  className="h-32 w-full object-cover rounded"
                />
              )}
              <div>
                <p className="font-medium">{form.productName}</p>
                {form.productDescription && (
                  <p className="text-sm text-muted-foreground mt-1">{form.productDescription}</p>
                )}
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Duration: {formatHours(form.durationHours)}</p>
                <p>Min Bid: {form.currency} {form.minPrice}</p>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Saving…" : isEdit ? "Save Changes" : "Start Auction"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, Check, X, Trash2, ImagePlus, ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useBat246CardAccess } from "@/lib/hooks/useBat246CardAccess";
import { toast } from "sonner";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Claim {
  _id: string;
  companyName: string;
  totalLoss?: string;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  city?: string;
  country?: string;
  lossDescription?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  userId?: string | null;
  [key: string]: any;
}

interface TestimonialImage {
  url: string;
  caption?: string;
}

interface Testimonial {
  _id: string;
  name: string;
  message: string;
  images?: TestimonialImage[];
  createdAt: string;
  hidden?: boolean;
}

interface GalleryImage {
  _id: string;
  url: string;
}

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
  return { Authorization: `Bearer ${token}` };
}

// "lossDescription" -> "Loss Description" — used to label the raw claim
// fields in the expanded detail view without hardcoding every field name.
function humanizeKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export default function LostMoneyAdminPage() {
  const { isAdmin, loading: authLoading } = useBat246CardAccess("lostmoney");

  const [tab, setTab] = useState<"claims" | "testimonials" | "live" | "gallery">("claims");
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [testimonials, setTestimonials] = useState<Testimonial[] | null>(null);
  const [liveTestimonials, setLiveTestimonials] = useState<Testimonial[] | null>(null);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[] | null>(null);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Which Live Testimonials cards have been expanded past the collapsed preview.
  const [expandedLive, setExpandedLive] = useState<Set<string>>(new Set());
  const galleryFileInputRef = useRef<HTMLInputElement>(null);

  // Approve-claim popup
  const [approvingClaim, setApprovingClaim] = useState<Claim | null>(null);
  const [approveReportedLoss, setApproveReportedLoss] = useState("");
  const [approveAmount, setApproveAmount] = useState("");
  const [approveSubmitting, setApproveSubmitting] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    fetch(`${API}/bat246/lostmoney/claims`, { headers: authHeaders() })
      .then((r) => r.json())
      // Only pending claims need action here — once approved/rejected they
      // drop out of this list (the decision is still saved in the DB).
      .then((d) => setClaims((d.claims ?? []).filter((c: Claim) => c.status === "pending")))
      .catch(() => setClaims([]));
    fetch(`${API}/bat246/lostmoney/testimonials/pending`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setTestimonials(d.testimonials ?? []))
      .catch(() => setTestimonials([]));
    fetch(`${API}/bat246/lostmoney/testimonials/approved`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setLiveTestimonials(d.testimonials ?? []))
      .catch(() => setLiveTestimonials([]));
    fetch(`${API}/bat246/lostmoney/gallery`)
      .then((r) => r.json())
      .then((d) => setGalleryImages(d.images ?? []))
      .catch(() => setGalleryImages([]));
  }, [isAdmin]);

  async function setClaimStatus(id: string, status: "approved" | "rejected") {
    try {
      const res = await fetch(`${API}/bat246/lostmoney/claims/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      // Decided claims leave the pending list (still saved in the DB with
      // their new status — just no longer needing admin attention here).
      setClaims((prev) => prev?.filter((c) => c._id !== id) ?? null);
      toast.success(`Claim marked ${status}`);
    } catch {
      toast.error("Failed to update claim");
    }
  }

  async function moderateTestimonial(id: string, action: "approve" | "reject") {
    try {
      const res = await fetch(`${API}/bat246/lostmoney/testimonials/${id}/${action}`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      const moved = testimonials?.find((t) => t._id === id) ?? null;
      setTestimonials((prev) => prev?.filter((t) => t._id !== id) ?? null);
      if (action === "approve" && moved) {
        setLiveTestimonials((prev) => (prev ? [{ ...moved }, ...prev] : prev));
      }
      toast.success(action === "approve" ? "Testimonial approved" : "Testimonial rejected");
    } catch {
      toast.error("Failed to update testimonial");
    }
  }

  function toggleLiveExpanded(id: string) {
    setExpandedLive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteLiveTestimonial(id: string) {
    if (!confirm("Remove this testimonial from the live site? This can't be undone.")) return;
    try {
      const res = await fetch(`${API}/bat246/lostmoney/testimonials/${id}/delete`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      setLiveTestimonials((prev) => prev?.filter((t) => t._id !== id) ?? null);
      toast.success("Testimonial removed from the live site");
    } catch {
      toast.error("Failed to delete testimonial");
    }
  }

  // Hide/unhide — takes it off (or puts it back on) the public site without
  // deleting the testimonial, unlike deleteLiveTestimonial above.
  async function toggleTestimonialVisibility(id: string, hidden: boolean) {
    try {
      const res = await fetch(`${API}/bat246/lostmoney/testimonials/${id}/${hidden ? "hide" : "unhide"}`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      setLiveTestimonials((prev) => prev?.map((t) => (t._id === id ? { ...t, hidden } : t)) ?? null);
      toast.success(hidden ? "Testimonial hidden from the live site" : "Testimonial is live again");
    } catch {
      toast.error(`Failed to ${hidden ? "hide" : "unhide"} testimonial`);
    }
  }

  async function uploadGalleryImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    setGalleryUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`${API}/bat246/lostmoney/gallery`, {
          method: "POST",
          headers: authHeaders(),
          body: form,
        });
        const d = await res.json();
        if (!res.ok || !d.image) throw new Error(d.error || "Upload failed");
        setGalleryImages((prev) => (prev ? [...prev, d.image] : [d.image]));
      }
      toast.success("Gallery photo(s) uploaded");
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload photo");
    } finally {
      setGalleryUploading(false);
    }
  }

  async function deleteGalleryImage(id: string) {
    if (!confirm("Remove this photo from the homepage gallery? This can't be undone.")) return;
    try {
      const res = await fetch(`${API}/bat246/lostmoney/gallery/${id}/delete`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      setGalleryImages((prev) => prev?.filter((img) => img._id !== id) ?? null);
      toast.success("Photo removed from the gallery");
    } catch {
      toast.error("Failed to delete photo");
    }
  }

  async function moveGalleryImage(index: number, direction: -1 | 1) {
    if (!galleryImages) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= galleryImages.length) return;

    const reordered = [...galleryImages];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setGalleryImages(reordered);

    try {
      const res = await fetch(`${API}/bat246/lostmoney/gallery/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ orderedIds: reordered.map((img) => img._id) }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Failed to save new order");
      setGalleryImages(galleryImages); // revert on failure
    }
  }

  // Records the approval on the Paid List (the full grid/search UI for that
  // list now lives on its own page — this just needs to create/update the
  // row so the claim's approval is reflected there).
  async function addPayment(payload: {
    name: string;
    userId?: string;
    email?: string;
    reportedLoss?: string;
    amount: number;
    claimId?: string;
  }): Promise<boolean> {
    try {
      const res = await fetch(`${API}/bat246/lostmoney/paid/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to add");
      toast.success(
        d.created
          ? "Added to the Paid List"
          : `Approved amount updated — ${payload.name} now has $${(d.entry?.approvedAmount ?? 0).toLocaleString()} approved`
      );
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to add to the Paid List");
      return false;
    }
  }

  function openApprovePopup(claim: Claim) {
    setApprovingClaim(claim);
    setApproveReportedLoss(claim.totalLoss ?? "");
    setApproveAmount("");
  }

  function closeApprovePopup() {
    setApprovingClaim(null);
    setApproveReportedLoss("");
    setApproveAmount("");
  }

  async function confirmApprove() {
    if (!approvingClaim) return;
    const amount = Number(approveAmount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid amount to approve");

    setApproveSubmitting(true);
    const ok = await addPayment({
      name: `${approvingClaim.firstName} ${approvingClaim.lastName}`.trim(),
      userId: approvingClaim.userId ?? undefined,
      reportedLoss: approveReportedLoss.trim(),
      amount,
      claimId: approvingClaim._id,
    });
    if (ok) {
      await setClaimStatus(approvingClaim._id, "approved");
      closeApprovePopup();
    }
    setApproveSubmitting(false);
  }

  if (authLoading) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-full w-full bg-[#09090f] text-white flex items-center justify-center p-8">
        <p className="text-white/40 text-sm">Admin only.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full bg-[#09090f] text-white">
      <div className="px-4 sm:px-8 lg:px-12 xl:px-16 py-6 max-w-[1600px] mx-auto">
        <div className="mb-5">
          <Link
            href="/games/bat246/lostmoney"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/15 text-white/80 hover:text-white hover:bg-white/[0.1] hover:border-white/25 text-sm font-semibold transition-colors group"
          >
            <ChevronLeft className="w-4.5 h-4.5 group-hover:-translate-x-0.5 transition-transform" />
            Lost Money
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mb-6">
          <button
            onClick={() => setTab("claims")}
            className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-lg text-[13px] sm:text-sm font-semibold transition-colors ${
              tab === "claims" ? "bg-brand text-brand-foreground" : "bg-white/[0.05] text-white/60 hover:bg-white/[0.1]"
            }`}
          >
            Pending Claims {claims ? `(${claims.length})` : ""}
          </button>
          <button
            onClick={() => setTab("testimonials")}
            className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-lg text-[13px] sm:text-sm font-semibold transition-colors ${
              tab === "testimonials" ? "bg-brand text-brand-foreground" : "bg-white/[0.05] text-white/60 hover:bg-white/[0.1]"
            }`}
          >
            Pending Testimonials {testimonials ? `(${testimonials.length})` : ""}
          </button>
          <button
            onClick={() => setTab("live")}
            className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-lg text-[13px] sm:text-sm font-semibold transition-colors ${
              tab === "live" ? "bg-brand text-brand-foreground" : "bg-white/[0.05] text-white/60 hover:bg-white/[0.1]"
            }`}
          >
            Live Testimonials {liveTestimonials ? `(${liveTestimonials.length})` : ""}
          </button>
          <button
            onClick={() => setTab("gallery")}
            className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-lg text-[13px] sm:text-sm font-semibold transition-colors ${
              tab === "gallery" ? "bg-brand text-brand-foreground" : "bg-white/[0.05] text-white/60 hover:bg-white/[0.1]"
            }`}
          >
            Gallery {galleryImages ? `(${galleryImages.length})` : ""}
          </button>
        </div>

        {tab === "claims" && (
          claims === null ? (
            <div className="flex items-center gap-2 text-white/40 text-sm py-10">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : claims.length === 0 ? (
            <p className="text-white/40 text-sm py-10">No claims submitted yet.</p>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
              {claims.map((c, i) => {
                const isExpanded = expanded === c._id;
                return (
                  <div
                    key={c._id}
                    className={`rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 sm:p-5 transition-colors ${
                      isExpanded ? "xl:col-span-2" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <button
                        onClick={() => setExpanded(isExpanded ? null : c._id)}
                        className="text-left flex-1 min-w-0 flex items-start gap-3"
                      >
                        <span className="w-8 h-8 rounded-full bg-white/10 text-white/50 text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-white font-bold text-lg">
                            {c.firstName} {c.lastName}{" "}
                            <span className="text-white/30 font-normal">· {c.companyName}</span>
                          </div>
                          <div className="text-white/40 text-sm mt-0.5">
                            {c.mobileNumber} {c.city ? `· ${c.city}` : ""} {c.country ? `, ${c.country}` : ""}
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                            c.status === "approved"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : c.status === "rejected"
                              ? "bg-red-500/15 text-red-400"
                              : "bg-white/10 text-white/50"
                          }`}
                        >
                          {c.status}
                        </span>
                        <button
                          onClick={() => openApprovePopup(c)}
                          className="w-9 h-9 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 flex items-center justify-center"
                          title="Approve"
                        >
                          <Check className="w-[18px] h-[18px]" />
                        </button>
                        <button
                          onClick={() => setClaimStatus(c._id, "rejected")}
                          className="w-9 h-9 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 flex items-center justify-center"
                          title="Reject"
                        >
                          <X className="w-[18px] h-[18px]" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-5 pt-5 border-t border-white/[0.08] grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {Object.entries(c)
                          .filter(
                            ([k, v]) =>
                              !["_id", "__v", "userId", "status", "createdAt", "updatedAt"].includes(k) &&
                              (Array.isArray(v) ? v.length > 0 : v)
                          )
                          .map(([k, v]) =>
                            k === "teamsCopyImages" && Array.isArray(v) ? (
                              <div
                                key={k}
                                className="sm:col-span-2 xl:col-span-3 rounded-lg bg-white/[0.02] border border-white/[0.06] p-3.5"
                              >
                                <div className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-2">
                                  {humanizeKey(k)}
                                </div>
                                <div className="flex flex-wrap gap-2.5">
                                  {v.map((src: string, i: number) => (
                                    <a key={i} href={src} target="_blank" rel="noreferrer">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={src}
                                        alt=""
                                        className="w-20 h-20 rounded-lg object-cover border border-white/10 hover:border-brand/50 transition-colors"
                                      />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div
                                key={k}
                                className="rounded-lg bg-white/[0.02] border border-white/[0.06] px-4 py-3"
                              >
                                <div className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-1.5">
                                  {humanizeKey(k)}
                                </div>
                                <div className="text-white text-base leading-relaxed whitespace-pre-wrap break-words">
                                  {String(v)}
                                </div>
                              </div>
                            )
                          )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {tab === "testimonials" && (
          testimonials === null ? (
            <div className="flex items-center gap-2 text-white/40 text-sm py-10">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : testimonials.length === 0 ? (
            <p className="text-white/40 text-sm py-10">No testimonials awaiting review.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {testimonials.map((t) => (
                <div key={t._id} className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 sm:p-5">
                  <p className="text-white/80 text-[15px] leading-relaxed mb-3 whitespace-pre-wrap break-words">
                    &quot;{t.message}&quot;
                  </p>
                  {t.images && t.images.length > 0 && (
                    <div className="flex flex-wrap gap-2.5 mb-3">
                      {t.images.map((img, i) => (
                        <a
                          key={i}
                          href={img.url}
                          target="_blank"
                          rel="noreferrer"
                          title={img.caption || undefined}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.url}
                            alt={img.caption || ""}
                            className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover border border-white/10 hover:border-brand/50 transition-colors"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-brand text-sm font-bold">— {t.name}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => moderateTestimonial(t._id, "approve")}
                        className="w-8 h-8 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 flex items-center justify-center"
                        title="Approve"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moderateTestimonial(t._id, "reject")}
                        className="w-8 h-8 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 flex items-center justify-center"
                        title="Reject"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === "live" && (
          liveTestimonials === null ? (
            <div className="flex items-center gap-2 text-white/40 text-sm py-10">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : liveTestimonials.length === 0 ? (
            <p className="text-white/40 text-sm py-10">No testimonials live on the site yet.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {liveTestimonials.map((t) => {
                const isLong = t.message.length > 260;
                const isOpen = expandedLive.has(t._id);
                return (
                <div
                  key={t._id}
                  className={`rounded-xl bg-white/[0.03] border p-4 sm:p-5 ${
                    t.hidden ? "border-white/[0.08] opacity-60" : "border-white/[0.08]"
                  }`}
                >
                  {t.hidden && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-[11px] font-semibold mb-2">
                      Hidden from live site
                    </span>
                  )}
                  <p
                    className={`text-white/80 text-[15px] leading-relaxed mb-1 whitespace-pre-wrap break-words ${
                      isLong && !isOpen ? "line-clamp-4" : ""
                    }`}
                  >
                    &quot;{t.message}&quot;
                  </p>
                  {isLong && (
                    <button
                      type="button"
                      onClick={() => toggleLiveExpanded(t._id)}
                      className="text-brand text-sm font-semibold hover:underline mb-3"
                    >
                      {isOpen ? "Show less" : "Read more"}
                    </button>
                  )}
                  {t.images && t.images.length > 0 && (
                    <div className="flex flex-wrap gap-2.5 mb-3">
                      {t.images.map((img, i) => (
                        <a
                          key={i}
                          href={img.url}
                          target="_blank"
                          rel="noreferrer"
                          title={img.caption || undefined}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.url}
                            alt={img.caption || ""}
                            className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover border border-white/10 hover:border-brand/50 transition-colors"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-brand text-sm font-bold">— {t.name}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleTestimonialVisibility(t._id, !t.hidden)}
                        className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white/60 flex items-center justify-center"
                        title={t.hidden ? "Unhide — show on live site again" : "Hide from live site (keeps it saved)"}
                      >
                        {t.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => deleteLiveTestimonial(t._id)}
                        className="w-8 h-8 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 flex items-center justify-center"
                        title="Delete from live site"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )
        )}

        {tab === "gallery" && (
          <div>
            <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
              <p className="text-white/40 text-sm max-w-md">
                Shown next to Alan&apos;s opening message on the homepage, in this order. Use the
                arrows on each photo to change the sequence.
              </p>
              <button
                onClick={() => galleryFileInputRef.current?.click()}
                disabled={galleryUploading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand text-brand-foreground text-sm font-semibold hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {galleryUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                {galleryUploading ? "Uploading…" : "Upload Photos"}
              </button>
              <input
                ref={galleryFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  uploadGalleryImages(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {galleryImages === null ? (
              <div className="flex items-center gap-2 text-white/40 text-sm py-10">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : galleryImages.length === 0 ? (
              <p className="text-white/40 text-sm py-10">No gallery photos uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                {galleryImages.map((img, i) => (
                  <div
                    key={img._id}
                    className="relative aspect-square rounded-xl overflow-hidden border border-white/[0.08] group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[11px] font-bold">
                      {i + 1}
                    </div>
                    <button
                      onClick={() => deleteGalleryImage(img._id)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 hover:bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove from gallery"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => moveGalleryImage(i, -1)}
                        disabled={i === 0}
                        className="w-7 h-7 rounded-lg bg-black/60 hover:bg-black/80 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move earlier in sequence"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveGalleryImage(i, 1)}
                        disabled={i === galleryImages.length - 1}
                        className="w-7 h-7 rounded-lg bg-black/60 hover:bg-black/80 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move later in sequence"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {approvingClaim && (
          <div
            className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
            onClick={closeApprovePopup}
          >
            <div
              className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[#15151d] border border-white/10 rounded-2xl p-5 sm:p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-white font-bold text-xl mb-1">Approve Claim</div>
              <div className="text-white/40 text-[15px] mb-4">
                {approvingClaim.firstName} {approvingClaim.lastName} · {approvingClaim.companyName}
              </div>

              <div className="flex flex-col gap-2 mb-5 text-[15px] rounded-lg bg-white/[0.02] border border-white/[0.06] p-3.5">
                <div>
                  <span className="text-white/40">Mobile:</span>{" "}
                  <span className="text-white/80">{approvingClaim.mobileNumber}</span>
                </div>
                {(approvingClaim.city || approvingClaim.country) && (
                  <div>
                    <span className="text-white/40">Location:</span>{" "}
                    <span className="text-white/80">
                      {approvingClaim.city}
                      {approvingClaim.city && approvingClaim.country ? ", " : ""}
                      {approvingClaim.country}
                    </span>
                  </div>
                )}
                {approvingClaim.lossDescription && (
                  <div>
                    <span className="text-white/40">How they lost it:</span>{" "}
                    <span className="text-white/80 whitespace-pre-wrap break-words">
                      {approvingClaim.lossDescription}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-white/40 text-xs font-semibold uppercase tracking-wide mb-1.5">
                    Reported Loss ($)
                  </label>
                  <input
                    type="text"
                    value={approveReportedLoss}
                    onChange={(e) => setApproveReportedLoss(e.target.value)}
                    placeholder={approvingClaim.totalLoss ? "" : "Not reported — enter if known"}
                    className="w-full h-11 px-3.5 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white text-[15px] placeholder:text-white/30 focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-white/40 text-xs font-semibold uppercase tracking-wide mb-1.5">
                    Amount to Approve ($)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={approveAmount}
                    onChange={(e) => setApproveAmount(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white text-[15px] placeholder:text-white/30 focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeApprovePopup}
                  className="px-4 py-2.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/70 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmApprove}
                  disabled={approveSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {approveSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {approveSubmitting ? "Adding…" : "Add"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

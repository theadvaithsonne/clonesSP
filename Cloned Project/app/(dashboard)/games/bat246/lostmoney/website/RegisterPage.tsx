"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, Clock, FileText, ImagePlus, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const MAX_TEAMS_COPY_IMAGES = 5;

type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "textarea";
  required?: boolean;
  hint?: "important" | "good to know";
  full?: boolean;
  // Renders an image-upload widget below the textarea (currently only
  // "Copy of Teams You Were On" — claimants often have a screenshot rather
  // than something they can type out).
  allowImages?: boolean;
};

interface PendingImage {
  file: File;
  previewUrl: string;
  uploadedUrl: string | null;
  uploading: boolean;
  error: boolean;
}

const CONTACT_FIELDS: FieldDef[] = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name", required: true },
  { key: "mobileNumber", label: "Mobile Number", required: true },
  { key: "idNumberAtLoss", label: "ID Number at the Time of Loss", hint: "important" },
  { key: "city", label: "Current City" },
  { key: "cityAtLoss", label: "City at the Time of Loss" },
  { key: "country", label: "Current Country" },
  { key: "countryAtLoss", label: "Country at the Time of Loss" },
  { key: "ageNow", label: "Current Age" },
  { key: "ageAtLoss", label: "Age at the Time of Loss" },
];

const COMPANY_FIELDS: FieldDef[] = [
  { key: "companyName", label: "Company Name", required: true },
  { key: "registrationFees", label: "Registration Fees (if any)" },
  { key: "totalLoss", label: "Total Loss (USD)", hint: "important" },
  { key: "managementNames", label: "Names of Any Management People" },
  { key: "shareholderNames", label: "Names of Any Shareholders" },
  { key: "localManagement", label: "Any Local Management You Dealt With" },
];

const SPONSOR_FIELDS: FieldDef[] = [
  { key: "sponsorName", label: "Sponsor's Name", hint: "important" },
  { key: "sponsorPhone", label: "Sponsor's Phone Number", hint: "important" },
  { key: "sponsorCity", label: "Sponsor's City", hint: "important" },
  { key: "sponsorCountry", label: "Sponsor's Country", hint: "important" },
];

const STORY_FIELDS: FieldDef[] = [
  {
    key: "lossDescription",
    label: "In your own words, how did you lose your money, and why do you believe you lost it?",
    type: "textarea",
    hint: "important",
    full: true,
  },
  { key: "reasonJoined", label: "Reason You Joined the Business (Your Favorite Part)", type: "textarea", hint: "important", full: true },
  { key: "timeline", label: "Timeline From Paying Money and Joining to When You Lost the Money", type: "textarea", hint: "important", full: true },
  { key: "reasonForLoss", label: "Reason for the Loss of Money", type: "textarea", hint: "important", full: true },
  { key: "bestPart", label: "The Part of the Business/Product You Liked the Best", type: "textarea" },
  { key: "worstPart", label: "The Part of the Business You Disliked the Most", type: "textarea" },
];

const BUSINESS_FIELDS: FieldDef[] = [
  { key: "productBought", label: "Product You Bought (if any)", hint: "important" },
  { key: "productCost", label: "Cost of the Product", hint: "important" },
  { key: "productChosenOrReceived", label: "Product You Chose or Received" },
  { key: "paymentMethod", label: "Payment Method (Visa, MC, AMEX, Cash, Bank Transfer, Check, Apple Pay, PayPal, Crypto, Other)", hint: "important" },
  { key: "priorEarnings", label: "Any Earnings You Made With the Company Prior to the Loss", hint: "important" },
  { key: "profitCentersOnCount", label: "Number of Profit Centers or Teams You Were On?" },
  { key: "profitCentersCount", label: "Number of Profit Centers or Teams You Made From?" },
  { key: "boardsProfitedCount", label: "Any Board Earnings? (Total How Much)", hint: "important" },
  { key: "boardsLostCount", label: "Boards You Lost From? (Total How Much)", hint: "important" },
  { key: "peopleIntroducedCount", label: "Number of People You Introduced to the Business and You Made a Sale", hint: "important" },
  { key: "peopleIntroducedSaleCost", label: "At What Price Did You Sell to Them?", hint: "important" },
];

const PEOPLE_FIELDS: FieldDef[] = [
  { key: "knownPeople", label: "3 or 4 People You Knew in the Business at That Time", type: "textarea", hint: "important", full: true },
  { key: "teammates", label: "Any of Your Teammates at That Time", type: "textarea", full: true },
  {
    key: "teamsCopy",
    label: "Copy of Teams You Were On",
    type: "textarea",
    hint: "good to know",
    full: true,
    allowImages: true,
  },
  { key: "venuesAttended", label: "Venues You Attended", type: "textarea", hint: "important", full: true },
  {
    key: "meetingsHosted",
    label: "Any Meetings You Had or Hosted (at Home, a Restaurant, Hotel, Rented Room, etc.) — Approximate Month/Year and Location",
    type: "textarea",
    full: true,
  },
];

const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  { title: "Contact Information", fields: CONTACT_FIELDS },
  { title: "The Company You Lost Money With", fields: COMPANY_FIELDS },
  { title: "Sponsor Information", fields: SPONSOR_FIELDS },
  { title: "Your Story", fields: STORY_FIELDS },
  { title: "Business & Financial Details", fields: BUSINESS_FIELDS },
  { title: "People & Meetings", fields: PEOPLE_FIELDS },
];

const REQUIRED_KEYS = ["companyName", "firstName", "lastName", "mobileNumber"];

// Look up a required key's label so the error message can name it directly.
const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);
function labelFor(key: string): string {
  return ALL_FIELDS.find((f) => f.key === key)?.label ?? key;
}

export default function LostMoneyRegisterPage() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [missingKeys, setMissingKeys] = useState<Set<string>>(new Set());
  const [teamsCopyImages, setTeamsCopyImages] = useState<PendingImage[]>([]);
  const teamsCopyFileInputRef = useRef<HTMLInputElement>(null);

  function setField(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (missingKeys.has(key) && value.trim()) {
      setMissingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function uploadTeamsCopyImage(entry: PendingImage) {
    const uploadForm = new FormData();
    uploadForm.append("file", entry.file);
    try {
      const res = await fetch(`${API}/uploads/public`, { method: "POST", body: uploadForm });
      const d = await res.json();
      if (!res.ok || !d.url) throw new Error();
      setTeamsCopyImages((prev) =>
        prev.map((img) => (img === entry ? { ...img, uploading: false, uploadedUrl: d.url } : img))
      );
    } catch {
      setTeamsCopyImages((prev) =>
        prev.map((img) => (img === entry ? { ...img, uploading: false, error: true } : img))
      );
    }
  }

  function handleTeamsCopyFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_TEAMS_COPY_IMAGES - teamsCopyImages.length;
    if (room <= 0) return;
    const newEntries: PendingImage[] = Array.from(files)
      .slice(0, room)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        uploadedUrl: null,
        uploading: true,
        error: false,
      }));
    setTeamsCopyImages((prev) => [...prev, ...newEntries]);
    newEntries.forEach((entry) => uploadTeamsCopyImage(entry));
  }

  function removeTeamsCopyImage(entry: PendingImage) {
    setTeamsCopyImages((prev) => prev.filter((img) => img !== entry));
    URL.revokeObjectURL(entry.previewUrl);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const missing = REQUIRED_KEYS.filter((k) => !form[k]?.trim());
    if (missing.length > 0) {
      setMissingKeys(new Set(missing));
      setError(
        `Please fill in the required field${missing.length > 1 ? "s" : ""} highlighted below: ${missing
          .map(labelFor)
          .join(", ")}.`
      );
      const firstEl = document.getElementById(`field-${missing[0]}`);
      firstEl?.scrollIntoView({ behavior: "smooth", block: "center" });
      (firstEl?.querySelector("input, textarea") as HTMLElement | null)?.focus();
      return;
    }
    setMissingKeys(new Set());

    if (teamsCopyImages.some((img) => img.uploading)) {
      setError("Please wait for your images to finish uploading.");
      return;
    }

    setSubmitting(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
      const res = await fetch(`${API}/bat246/lostmoney/claims`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...form,
          teamsCopyImages: teamsCopyImages.filter((img) => img.uploadedUrl).map((img) => img.uploadedUrl),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Something went wrong. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="w-full max-w-[720px] mx-auto px-5 sm:px-8 py-24 text-center">
        <CheckCircle2 className="w-20 h-20 text-emerald-800 mx-auto mb-6" />
        <h1 className="text-4xl font-black mb-4 text-stone-900">Claim Submitted</h1>
        <p className="text-stone-600 text-xl leading-relaxed">
          Thank you for submitting your Lost Money claim. Every submission is reviewed individually.
          If anything is unclear, we will reach out to you using the contact details you provided.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16">
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#e6dcc3] mb-5">
        <span className="text-sm font-bold text-emerald-800 uppercase tracking-[0.12em]">Application Form</span>
      </div>
      <h1 className="text-4xl sm:text-5xl font-black mb-4 text-stone-900">Lost Money Claims</h1>
      <p className="text-stone-600 text-xl sm:text-2xl leading-relaxed mb-9 max-w-[720px]">
        Please answer as accurately and honestly as you can.     Fields marked with{" "}
        <span className="text-emerald-800 font-bold">*</span> are required - everything else is optional,
        but the more detail you can provide, the faster your claim can be reviewed and verified.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 xl:gap-16 items-start">
        <form onSubmit={handleSubmit} className="flex flex-col gap-10 min-w-0">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-xl sm:text-2xl font-black text-stone-900 mb-5 pb-3 border-b border-[#e6dcc3]">
                {section.title}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {section.fields.map((f) => {
                  const isMissing = missingKeys.has(f.key);
                  return (
                    <div key={f.key} id={`field-${f.key}`} className={f.full ? "md:col-span-2" : ""}>
                      <label className="block text-lg text-stone-700 mb-2.5 leading-snug">
                        {f.label}
                        {f.required && <span className="text-emerald-800 font-bold"> *</span>}
                        {f.hint === "important" && <span className="text-stone-400 italic text-base"> — helps a lot</span>}
                        {f.hint === "good to know" && (
                          <span className="text-stone-400 italic text-base"> — optional, good to know</span>
                        )}
                        {isMissing && (
                          <span className="text-red-600 font-bold text-base"> — this field is required</span>
                        )}
                      </label>
                      {f.allowImages ? (
                        // No text box for this field — just the image
                        // upload widget, centered inside an input-styled box.
                        <div className="w-full px-4 py-6 rounded-lg bg-white border border-[#d9cead] flex flex-col items-center justify-center text-center">
                          <div className="flex flex-wrap justify-center gap-2.5">
                            {teamsCopyImages.map((img, i) => (
                              <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-[#d9cead]">
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
                                  onClick={() => removeTeamsCopyImage(img)}
                                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            {teamsCopyImages.length < MAX_TEAMS_COPY_IMAGES && (
                              <button
                                type="button"
                                onClick={() => teamsCopyFileInputRef.current?.click()}
                                className="w-16 h-16 rounded-lg border-2 border-dashed border-[#d9cead] flex items-center justify-center text-stone-400 hover:text-emerald-800 hover:border-emerald-800 transition-colors"
                              >
                                <ImagePlus className="w-6 h-6" />
                              </button>
                            )}
                          </div>
                          <input
                            ref={teamsCopyFileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              handleTeamsCopyFilesSelected(e.target.files);
                              e.target.value = "";
                            }}
                          />
                          <p className="text-black font-bold text-sm mt-3">
                            Upload a photo/screenshot — up to {MAX_TEAMS_COPY_IMAGES}.
                          </p>
                        </div>
                      ) : f.type === "textarea" ? (
                        <textarea
                          value={form[f.key] ?? ""}
                          onChange={(e) => setField(f.key, e.target.value)}
                          rows={3}
                          className={`w-full px-4 py-3.5 rounded-lg bg-white text-lg text-stone-900 placeholder:text-stone-400 focus:outline-none resize-y border ${
                            isMissing
                              ? "border-red-400 focus:border-red-500 ring-2 ring-red-100"
                              : "border-[#d9cead] focus:border-emerald-800"
                          }`}
                        />
                      ) : (
                        <input
                          type="text"
                          value={form[f.key] ?? ""}
                          onChange={(e) => setField(f.key, e.target.value)}
                          className={`w-full h-14 px-4 rounded-lg bg-white text-lg text-stone-900 placeholder:text-stone-400 focus:outline-none border ${
                            isMissing
                              ? "border-red-400 focus:border-red-500 ring-2 ring-red-100"
                              : "border-[#d9cead] focus:border-emerald-800"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {error && (
            <div className="px-4 py-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto self-start px-9 py-5 rounded-lg bg-emerald-800 text-white font-bold text-lg hover:bg-emerald-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {submitting ? "Submitting…" : "Submit Claim"}
          </button>
        </form>

        <aside className="lg:sticky lg:top-28 self-start flex flex-col gap-4">
          <div className="rounded-2xl border border-[#e6dcc3] bg-white p-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-bold text-stone-900 text-lg">Reviewed individually</h3>
              <div className="w-16 h-16 rounded-xl bg-[#f2ead6] flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-8 h-8 text-emerald-800" />
              </div>
            </div>
            <p className="text-stone-700 text-base leading-relaxed">
              Every claim is checked by hand. If anything is unclear, we'll follow up directly with
              you.
            </p>
          </div>
          <div className="rounded-2xl border border-[#e6dcc3] bg-white p-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-bold text-stone-900 text-lg">It's okay if it's old</h3>
              <div className="w-16 h-16 rounded-xl bg-[#f2ead6] flex items-center justify-center flex-shrink-0">
                <Clock className="w-8 h-8 text-emerald-800" />
              </div>
            </div>
            <p className="text-stone-700 text-base leading-relaxed">
              Some losses happened years ago. Give as much accurate detail as you remember — you
              don't need every receipt.
            </p>
          </div>
          <div className="rounded-2xl border border-[#e6dcc3] bg-white p-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-bold text-stone-900 text-lg">What happens next</h3>
              <div className="w-16 h-16 rounded-xl bg-[#f2ead6] flex items-center justify-center flex-shrink-0">
                <FileText className="w-8 h-8 text-emerald-800" />
              </div>
            </div>
            <p className="text-stone-700 text-base leading-relaxed">
              Once verified and agreed, your claim is placed in line for repayment as funds become
              available.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Clock,
  Upload,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { API_URL } from "@/lib/api";
import type { CustomFieldDef, RecruitmentRequest } from "@/components/dashboard/inlineApps/teamforce/types";

type PublicRequest = Pick<
  RecruitmentRequest,
  | "_id"
  | "positionName"
  | "department"
  | "branch"
  | "employmentType"
  | "numberOfOpenings"
  | "experienceRequired"
  | "jobLocation"
  | "expectedJoiningDate"
  | "roleSummary"
  | "keyResponsibilities"
  | "requiredSkills"
  | "preferredSkills"
  | "status"
  | "customFieldsPublished"
>;

async function publicFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...(init || {}),
    headers: {      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function JobLandingClient() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [request, setRequest] = useState<PublicRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [applying, setApplying] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    publicFetch<{ request: PublicRequest }>(`/teamforce/recruitment-requests/public/${id}`)
      .then((res) => {
        if (!mounted.current) return;
        setRequest(res.request);
      })
      .catch(() => {
        if (!mounted.current) return;
        setNotFound(true);
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-[#7a7a7a] text-sm">
        Loading job details…
      </div>
    );
  }

  if (notFound || !request) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0a0a0a] border border-white/8 rounded-xl p-8 text-center">
          <div className="text-lg font-semibold text-white mb-2">Job not found</div>
          <p className="text-sm text-[#a8a8a8]">
            This job posting is no longer available or the link is invalid.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0a0a0a] border border-white/8 rounded-xl p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-green-400" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">
            Application submitted
          </h2>
          <p className="text-sm text-[#a8a8a8]">
            Thanks for applying to <span className="text-white">{request.positionName}</span>.
            The hiring team will review your application and reach out if there&apos;s a fit.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {applying ? (
          <ApplicationForm
            request={request}
            onBack={() => setApplying(false)}
            onSubmitted={() => setSubmitted(true)}
          />
        ) : (
          <JobDetails request={request} onApply={() => setApplying(true)} />
        )}
      </div>
    </div>
  );
}

function JobDetails({
  request,
  onApply,
}: {
  request: PublicRequest;
  onApply: () => void;
}) {
  const isOpen = request.status === "floated";

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <div className="rounded-xl border border-white/8 overflow-hidden bg-gradient-to-br from-[#0a1128] via-[#0e0e18] to-[#1a0f26]">
        <div className="w-full px-6 py-6 space-y-5">
          {/* Hero card */}
          <div className="bg-[#050505] rounded-xl border border-white/8 p-7">
            <div className="flex items-start justify-between mb-6 gap-4">
              <div className="min-w-0">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-purple-600/20">
                  <Building2 className="h-7 w-7 text-white" />
                </div>
                <p className="text-xs font-medium text-[#7a7a7a] mb-1">
                  Garage &ndash; Teamforce HR
                </p>
                <h2 className="text-[26px] font-bold text-white mb-2 tracking-tight">
                  {request.positionName}
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-sm text-[#a8a8a8]">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {request.jobLocation}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4" />
                    {request.employmentType}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {request.experienceRequired} years
                  </span>
                </div>
              </div>
              {isOpen ? (
                <button
                  onClick={onApply}
                  className="shrink-0 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer shadow-lg shadow-blue-600/20"
                >
                  Apply Now
                </button>
              ) : (
                <span className="shrink-0 px-4 py-2 rounded-lg border border-white/10 text-xs text-[#7a7a7a] bg-white/5">
                  Not accepting applications
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-6 pt-5 border-t border-white/8">
              <HeroStat label="Department" value={request.department} />
              <HeroStat label="Location" value={request.branch} />
              <HeroStat
                label="No. of Openings"
                value={String(request.numberOfOpenings)}
              />
            </div>
          </div>

          {/* Content card */}
          <div className="bg-[#050505] rounded-xl border border-white/8 p-7 space-y-6">
            <PreviewBlock title="About the Role" value={request.roleSummary} />
            <PreviewBlock
              title="Key Responsibilities"
              value={request.keyResponsibilities}
            />
            <PreviewBlock
              title="Required Skills & Qualifications"
              value={request.requiredSkills}
            />
            <PreviewBlock
              title="Preferred Skills"
              value={request.preferredSkills}
            />
          </div>

          {/* CTA card */}
          <div className="bg-[#050505] rounded-xl border border-white/8 p-8 text-center">
            {isOpen ? (
              <>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Ready to join our team?
                </h3>
                <p className="text-sm text-[#a8a8a8] mb-6">
                  Apply now and become part of our growing organization
                </p>
                <button
                  onClick={onApply}
                  className="px-7 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer shadow-lg shadow-blue-600/20"
                >
                  Apply for this Position
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Applications are currently closed
                </h3>
                <p className="text-sm text-[#a8a8a8]">
                  This position is not open for applications at this time.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-[#7a7a7a] mb-1">{label}</p>
      <p className="text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function PreviewBlock({
  title,
  value,
}: {
  title: string;
  value?: string;
}) {
  return (
    <div>
      <h3 className="text-[17px] font-semibold text-white mb-3">{title}</h3>
      <p className="text-sm text-[#c8c8c8] leading-relaxed whitespace-pre-line">
        {value?.trim() ? value : "—"}
      </p>
    </div>
  );
}

function ApplicationForm({
  request,
  onBack,
  onSubmitted,
}: {
  request: PublicRequest;
  onBack: () => void;
  onSubmitted: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [experienceDetails, setExperienceDetails] = useState("");
  const [currentCtc, setCurrentCtc] = useState("");
  const [expectedCtc, setExpectedCtc] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const customFields: CustomFieldDef[] = request.customFieldsPublished || [];
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [customFiles, setCustomFiles] = useState<Record<string, File | null>>({});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("Full name is required");
    if (!/[a-zA-Z]/.test(fullName)) return toast.error("Full name must contain valid letters");
    if (!mobileNumber.trim()) return toast.error("Mobile number is required");
    if ((mobileNumber.match(/[0-9]/g) || []).length < 7)
      return toast.error("Enter a valid mobile number (min 7 digits)");
    if (!email.trim()) return toast.error("Email is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()))
      return toast.error("Enter a valid email address");
    const yoe = Number(yearsOfExperience);
    if (!yearsOfExperience.trim() || Number.isNaN(yoe) || yoe < 0 || yoe > 60)
      return toast.error("Years of experience must be between 0 and 60");
    if (!resume) return toast.error("Please upload your resume");
    if (!experienceDetails.trim()) return toast.error("Experience details are required");
    if (!currentCtc.trim()) return toast.error("Current CTC is required");
    if (!/[0-9]/.test(currentCtc)) return toast.error("Enter a valid Current CTC");
    if (!expectedCtc.trim()) return toast.error("Expected CTC is required");
    if (!/[0-9]/.test(expectedCtc)) return toast.error("Enter a valid Expected CTC");
    if (!noticePeriod.trim()) return toast.error("Notice period is required");
    if (!/[a-zA-Z0-9]/.test(noticePeriod)) return toast.error("Enter a valid notice period");

    for (const f of customFields) {
      if (!f.required) continue;
      if (f.type === "upload") {
        if (!customFiles[f.id]) return toast.error(`${f.label} is required`);
      } else {
        if (!(customValues[f.id] || "").trim())
          return toast.error(`${f.label} is required`);
      }
    }

    const fd = new FormData();
    fd.append("fullName", fullName.trim());
    fd.append("mobileNumber", mobileNumber.trim());
    fd.append("email", email.trim());
    fd.append("yearsOfExperience", String(yoe));
    fd.append("experienceDetails", experienceDetails.trim());
    fd.append("currentCtc", currentCtc.trim());
    fd.append("expectedCtc", expectedCtc.trim());
    fd.append("noticePeriod", noticePeriod.trim());
    fd.append("resume", resume);
    for (const f of customFields) {
      const key = `customField_${f.id}`;
      if (f.type === "upload") {
        const file = customFiles[f.id];
        if (file) fd.append(key, file);
      } else {
        fd.append(key, (customValues[f.id] || "").trim());
      }
    }

    setSubmitting(true);
    try {
      await publicFetch<{ candidate: unknown }>(
        `/teamforce/candidates/public/${request._id}/apply`,
        { method: "POST", body: fd }
      );
      if (!mounted.current) return;
      toast.success("Application submitted");
      onSubmitted();
    } catch {
      if (mounted.current) toast.error("Failed to submit application");
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease-out] space-y-5">
      <div className="bg-[#050505] rounded-xl border border-white/8 px-6 py-4">
        <button
          onClick={onBack}
          type="button"
          className="flex items-center gap-2 text-sm text-[#a8a8a8] hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Job Details
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#050505] rounded-xl border border-white/8 p-7">
        <div className="mb-7">
          <h2 className="text-[22px] font-bold text-white mb-2 tracking-tight">
            Apply for {request.positionName}
          </h2>
          <p className="text-sm text-[#a8a8a8]">
            {request.department} • {request.jobLocation}
          </p>
        </div>

        <div className="space-y-5">
          <Field label="Full Name" required>
            <Input
              value={fullName}
              onChange={(v) =>
                setFullName(v.replace(/[^a-zA-Z\s'\-\.]/g, "").slice(0, 100))
              }
              placeholder="John Doe"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Mobile Number" required>
              <Input
                value={mobileNumber}
                onChange={(v) =>
                  setMobileNumber(v.replace(/[^0-9+\s\-()]/g, "").slice(0, 20))
                }
                placeholder="+1 (555) 123-4567"
                type="tel"
              />
            </Field>
            <Field label="Email ID" required>
              <Input value={email} onChange={setEmail} placeholder="john@example.com" type="email" />
            </Field>
          </div>

          <Field label="Years of Experience" required>
            <input
              type="text"
              inputMode="decimal"
              value={yearsOfExperience}
              onChange={(e) => {
                let v = e.target.value.replace(/[^0-9.]/g, "");
                const dot = v.indexOf(".");
                if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "").slice(0, 1);
                setYearsOfExperience(v.slice(0, 4));
              }}
              placeholder="e.g. 1.2 (1yr 2mo)"
              className="w-full bg-[#0a0a0a] border border-white/8 rounded-lg h-11 px-3 text-sm text-white placeholder:text-[#5a5a5a] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"
            />
          </Field>

          <Field label="Resume Upload" required>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => setResume(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 w-full bg-[#0a0a0a] border border-white/8 rounded-lg h-11 px-3 text-sm text-[#a8a8a8] hover:text-white hover:border-white/20 transition-colors cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              {resume ? `${resume.name} (${(resume.size / 1024).toFixed(0)} KB)` : "Choose file (PDF, DOC, DOCX)"}
            </button>
          </Field>

          <Field label="Experience Details" required>
            <textarea
              value={experienceDetails}
              rows={4}
              onChange={(e) => setExperienceDetails(e.target.value)}
              placeholder="Describe your relevant work experience..."
              className="w-full bg-[#0a0a0a] border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#5a5a5a] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Field label="Current CTC" required>
              <Input
                value={currentCtc}
                onChange={(v) =>
                  setCurrentCtc(v.replace(/[^0-9,.$€£₹]/g, "").slice(0, 20))
                }
                placeholder="$120,000"
              />
            </Field>
            <Field label="Expected CTC" required>
              <Input
                value={expectedCtc}
                onChange={(v) =>
                  setExpectedCtc(v.replace(/[^0-9,.$€£₹]/g, "").slice(0, 20))
                }
                placeholder="$140,000"
              />
            </Field>
            <Field label="Notice Period" required>
              <Input
                value={noticePeriod}
                onChange={(v) =>
                  setNoticePeriod(v.replace(/[^a-zA-Z0-9\s\-]/g, "").slice(0, 30))
                }
                placeholder="30 days"
              />
            </Field>
          </div>
        </div>

        {customFields.length > 0 && (
          <div className="mt-8 pt-6 border-t border-white/8 space-y-5">
            <div>
              <h3 className="text-[17px] font-semibold text-white">Additional Information</h3>
              <p className="text-[12px] text-[#7a7a7a] mt-1">
                Extra details requested for this role
              </p>
            </div>

            {customFields.map((f) => (
              <Field key={f.id} label={f.label} required={!!f.required}>
                {f.type === "upload" ? (
                  <CustomUpload
                    file={customFiles[f.id] || null}
                    onChange={(file) =>
                      setCustomFiles((m) => ({ ...m, [f.id]: file }))
                    }
                  />
                ) : (
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    value={customValues[f.id] || ""}
                    onChange={(e) =>
                      setCustomValues((m) => ({ ...m, [f.id]: e.target.value }))
                    }
                    placeholder={f.type === "number" ? "0" : `Enter ${f.label}`}
                    className="w-full bg-[#0a0a0a] border border-white/8 rounded-lg h-11 px-3 text-sm text-white placeholder:text-[#5a5a5a] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                  />
                )}
              </Field>
            ))}
          </div>
        )}

        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 rounded-lg border border-white/8 text-sm text-[#c8c8c8] hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-lg bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] text-brand-foreground text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting…" : "Submit Application"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#c8c8c8] mb-2">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#0a0a0a] border border-white/8 rounded-lg h-11 px-3 text-sm text-white placeholder:text-[#5a5a5a] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"
    />
  );
}

function CustomUpload({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex items-center justify-center gap-2 w-full bg-[#0a0a0a] border border-white/8 rounded-lg h-11 px-3 text-sm text-[#a8a8a8] hover:text-white hover:border-white/20 transition-colors cursor-pointer"
      >
        <Upload className="h-4 w-4" />
        {file ? `${file.name} (${(file.size / 1024).toFixed(0)} KB)` : "Choose file"}
      </button>
    </>
  );
}

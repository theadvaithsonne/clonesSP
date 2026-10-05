"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useUploadThing } from "@/lib/uploadthing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MapPin,
  Briefcase,
  IndianRupee,
  Loader2,
  Upload,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { Vacancy } from "../types";

export default function VacancyDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [loading, setLoading] = useState(true);

  // Application form state
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { startUpload, isUploading } = useUploadThing("postDocuments");

  const fetchVacancy = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api<{ vacancy: Vacancy }>(
        `/careers/vacancies/${id}`
      );
      setVacancy(response.vacancy);
    } catch {
      toast.error("Failed to load vacancy");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchVacancy();
  }, [id, fetchVacancy]);

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await startUpload([file]);
      if (result?.[0]) {
        setResumeUrl(result[0].ufsUrl || result[0].url);
        setResumeFileName(file.name);
        toast.success("Resume uploaded");
      }
    } catch {
      toast.error("Failed to upload resume");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!applicantName.trim() || !applicantEmail.trim()) {
      toast.error("Please fill in your name and email");
      return;
    }

    setSubmitting(true);
    try {
      await api("/careers/applications", {
        method: "POST",
        body: JSON.stringify({
          vacancyId: id,
          applicantName: applicantName.trim(),
          applicantEmail: applicantEmail.trim(),
          applicantPhone: applicantPhone.trim() || undefined,
          resumeUrl: resumeUrl || undefined,
          coverLetter: coverLetter.trim() || undefined,
        }),
      });
      setSubmitted(true);
    } catch {
      toast.error("Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0C0C0E] py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Back button skeleton */}
          <Skeleton className="h-9 w-36 mb-8" />
          {/* Title skeleton */}
          <Skeleton className="h-9 w-96 mb-4" />
          {/* Badges skeleton */}
          <div className="flex gap-3 mb-8">
            <Skeleton className="h-6 w-16 rounded-md" />
            <Skeleton className="h-6 w-24 rounded-md" />
            <Skeleton className="h-6 w-24 rounded-md" />
          </div>
          {/* Two-column skeleton */}
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-[70%] space-y-4">
              <Skeleton className="h-6 w-40 mb-2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="lg:w-[30%]">
              <Skeleton className="h-[400px] w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!vacancy) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0C0C0E]">
        <div className="text-center">
          <p className="text-gray-400 text-lg">Vacancy not found</p>
          <Button
            variant="ghost"
            onClick={() => router.push("/careers")}
            className="mt-4 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Careers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0C0E] py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => router.push("/careers")}
          className="mb-8 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Careers
        </Button>

        {/* Vacancy header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-white mb-4">
            {vacancy.title}
          </h1>
          <div className="flex flex-wrap gap-3">
            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 border">
              {vacancy.department}
            </Badge>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border border-white/10 text-gray-400">
              <MapPin className="h-3 w-3" />
              {vacancy.location}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border border-white/10 text-gray-400">
              <Briefcase className="h-3 w-3" />
              <span className="capitalize">{vacancy.employmentType}</span>
            </span>
            {vacancy.salary && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border border-white/10 text-gray-400">
                <IndianRupee className="h-3 w-3" />
                {vacancy.salary}
              </span>
            )}
          </div>
        </div>

        {/* Two-column layout: 70% JD | 30% Apply form (sticky) */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left column - Job details (70%) */}
          <div className="lg:w-[70%]">
            {/* Job Description */}
            <Card className="bg-white/5 border-white/10 mb-8">
              <CardContent className="pt-6">
                <h2 className="text-lg font-medium text-white mb-4">
                  Job Description
                </h2>
                <div
                  className="prose prose-invert prose-sm max-w-none text-gray-300 [&_a]:text-brand [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                  dangerouslySetInnerHTML={{ __html: vacancy.description }}
                />
              </CardContent>
            </Card>

            {/* Requirements */}
            {vacancy.requirements && (
              <Card className="bg-white/5 border-white/10">
                <CardContent className="pt-6">
                  <h2 className="text-lg font-medium text-white mb-4">
                    Requirements
                  </h2>
                  <p className="text-gray-300 text-sm whitespace-pre-line">
                    {vacancy.requirements}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column - Apply form (30%, sticky) */}
          <div className="lg:w-[30%]">
            <div className="lg:sticky lg:top-8">
              <Card className="bg-white/5 border-white/10">
                <CardContent className="pt-6">
                  <h2 className="text-lg font-medium text-white mb-6">
                    Apply for this position
                  </h2>

                  {submitted ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
                      <p className="text-white text-lg font-medium">
                        Application submitted!
                      </p>
                      <p className="text-gray-400 text-sm mt-2">
                        Thank you for your interest. We&apos;ll be in touch
                        soon.
                      </p>
                      <Button
                        variant="ghost"
                        onClick={() => router.push("/careers")}
                        className="mt-6 text-gray-400 hover:text-white"
                      >
                        Browse more positions
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name *</Label>
                        <Input
                          id="name"
                          value={applicantName}
                          onChange={(e) => setApplicantName(e.target.value)}
                          placeholder="John Doe"
                          className="bg-white/5 border-white/10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={applicantEmail}
                          onChange={(e) => setApplicantEmail(e.target.value)}
                          placeholder="john@example.com"
                          className="bg-white/5 border-white/10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone (optional)</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={applicantPhone}
                          onChange={(e) => setApplicantPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="bg-white/5 border-white/10"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Resume (optional)</Label>
                        <label className="flex items-center gap-2 px-4 py-2 rounded-md bg-white/5 border border-white/10 cursor-pointer hover:bg-white/[0.07] transition-colors text-sm text-gray-400 w-full">
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          {isUploading ? "Uploading..." : "Upload Resume"}
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={handleResumeUpload}
                            className="hidden"
                            disabled={isUploading}
                          />
                        </label>
                        {resumeFileName && (
                          <span className="flex items-center gap-1.5 text-sm text-green-400">
                            <FileText className="h-4 w-4" />
                            {resumeFileName}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="coverLetter">
                          Cover Letter (optional)
                        </Label>
                        <Textarea
                          id="coverLetter"
                          value={coverLetter}
                          onChange={(e) => setCoverLetter(e.target.value)}
                          placeholder="Tell us why you're a great fit..."
                          className="bg-white/5 border-white/10 min-h-[100px]"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={submitting || isUploading}
                        className="bg-brand text-brand-foreground hover:bg-brand/90 w-full"
                      >
                        {submitting && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Submit Application
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

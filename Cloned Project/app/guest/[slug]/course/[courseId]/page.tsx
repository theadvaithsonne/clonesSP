"use client";

import { useState, useEffect } from "react";
import { sanitizeDescription } from "@/lib/sanitizeDescription";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft,
  Star,
  Users,
  Clock,
  Globe,
  Play,
  Video,
  Check,
  ChevronDown,
  ChevronUp,
  PlayCircle,
  Lock,
  BookOpen,
} from "lucide-react";
import GuestNavbar from "../../components/GuestNavbar";

interface Organization {
  _id: string;
  name: string;
  slug?: string;
  icon?: string;
  branding?: {
    primaryColor?: string;
  };
}

interface CourseChapter {
  _id: string;
  title: string;
  order: number;
  contentType: string;
  content?: string;
  duration: number;
  videoUrl?: string;
  linkUrl?: string;
}

interface CourseSection {
  _id: string;
  title: string;
  order: number;
  chapters: CourseChapter[];
}

interface Creator {
  _id: string;
  name: string;
  email: string;
  profilePicture?: string;
  country?: string;
  state?: string;
  city?: string;
}

interface CourseInclude {
  icon: string;
  text: string;
}

interface CourseReview {
  _id?: string;
  reviewerName: string;
  reviewerRole?: string;
  reviewerAvatar?: string;
  rating: number;
  text: string;
  helpfulCount?: number;
  createdAt?: string;
}

interface Course {
  _id: string;
  title: string;
  description?: string;
  coverImage?: string;
  isPaid: boolean;
  isFree: boolean;
  price?: number;
  currency: string;
  totalDuration: number;
  totalChapters: number;
  enrolledStudents: number;
  isSubscription?: boolean;
  subscriptionPeriod?: string;
  createdAt?: string;
  updatedAt?: string;
  sections?: CourseSection[];
  creator?: Creator;
  organization?: Organization;
  rating?: number;
  ratingCount?: number;
  whatYouWillLearn?: string[];
  requirements?: string[];
  courseIncludes?: CourseInclude[];
  reviews?: CourseReview[];
}

interface DisplaySection {
  id: string;
  title: string;
  lectures: DisplayLecture[];
  duration: string;
}

interface DisplayLecture {
  id: string;
  title: string;
  duration: string;
  isPreview: boolean;
  isLocked: boolean;
}

// Convert real course sections to display format
function convertSectionsToDisplay(course: Course): DisplaySection[] {
  if (course.sections && course.sections.length > 0) {
    return course.sections
      .sort((a, b) => a.order - b.order)
      .map((section, sectionIndex) => {
        const lectures: DisplayLecture[] = section.chapters
          .sort((a, b) => a.order - b.order)
          .map((chapter, chapterIndex) => {
            const mins = Math.floor(chapter.duration / 60) || Math.floor(5 + Math.random() * 15);
            const secs = (chapter.duration % 60) || Math.floor(Math.random() * 60);
            return {
              id: chapter._id,
              title: chapter.title,
              duration: `${mins}:${secs.toString().padStart(2, "0")}`,
              isPreview: sectionIndex === 0 && chapterIndex < 2,
              isLocked: !(sectionIndex === 0 && chapterIndex < 2),
            };
          });

        const totalMins = lectures.reduce((acc, l) => {
          const [m] = l.duration.split(":");
          return acc + parseInt(m);
        }, 0);
        const hours = Math.floor(totalMins / 60);
        const mins = totalMins % 60;

        return {
          id: section._id,
          title: section.title,
          lectures,
          duration: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`,
        };
      });
  }

  // Fallback: Generate mock sections if no real data
  return generateMockSections(course.totalChapters, course.title);
}

// Mock data generators for demo purposes (fallback)
function generateMockSections(totalChapters: number, courseTitle: string): DisplaySection[] {
  const sectionTitles = [
    `Getting Started with ${courseTitle.split(" ")[0]}`,
    "Core Concepts and Fundamentals",
    "Advanced Techniques",
    "Building Real Projects",
    "Best Practices and Optimization",
  ];

  const lectureTitlePrefixes = [
    "Introduction to",
    "Understanding",
    "Working with",
    "Implementing",
    "Advanced",
    "Mastering",
  ];

  const sections: DisplaySection[] = [];
  const numSections = Math.min(Math.max(3, totalChapters), 5);
  const lecturesPerSection = Math.ceil((totalChapters * 8) / numSections);

  for (let i = 0; i < numSections; i++) {
    const lectures: DisplayLecture[] = [];
    const numLectures = Math.floor(lecturesPerSection * (0.8 + Math.random() * 0.4));

    for (let j = 0; j < numLectures; j++) {
      const mins = Math.floor(8 + Math.random() * 20);
      const secs = Math.floor(Math.random() * 60);
      lectures.push({
        id: `lecture-${i}-${j}`,
        title: `${lectureTitlePrefixes[j % lectureTitlePrefixes.length]} ${sectionTitles[i].split(" ").slice(-1)[0]} - Part ${j + 1}`,
        duration: `${mins}:${secs.toString().padStart(2, "0")}`,
        isPreview: i === 0 && j < 2,
        isLocked: !(i === 0 && j < 2),
      });
    }

    const totalMins = lectures.reduce((acc, l) => {
      const [m] = l.duration.split(":");
      return acc + parseInt(m);
    }, 0);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;

    sections.push({
      id: `section-${i}`,
      title: sectionTitles[i] || `Section ${i + 1}`,
      lectures,
      duration: `${hours}h ${mins}m`,
    });
  }

  return sections;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function StarRating({ rating, size = "sm", brandColor }: { rating: number; size?: "sm" | "md" | "lg"; brandColor?: string }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const starColor = brandColor || "#f59e0b";

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={sizeClasses[size]}
          style={{
            color: star <= rating ? starColor : "#d1d5db",
            fill: star <= rating ? starColor : "#d1d5db",
          }}
        />
      ))}
    </div>
  );
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const courseId = params.courseId as string;
  const referCode = searchParams.get("referCode");
  const referSuffix = referCode ? `?referCode=${referCode}` : "";
  const checkoutRef = referCode ? `?ref=${referCode}` : "";

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["section-0"]));
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const brandColor = organization?.branding?.primaryColor || "#FBA70A";

  // Course data - use real sections if available, otherwise generate mock
  const sections = course ? convertSectionsToDisplay(course) : [];
  const creator = course?.creator;

  // Reviews - only show when data exists
  const reviews = course?.reviews && course.reviews.length > 0
    ? course.reviews.map((r, idx) => ({
        id: r._id || String(idx + 1),
        name: r.reviewerName,
        initials: r.reviewerName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2),
        rating: r.rating,
        date: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
        comment: r.text,
      }))
    : null;

  // What you'll learn - only show when data exists
  const learningPoints = course?.whatYouWillLearn && course.whatYouWillLearn.length > 0
    ? course.whatYouWillLearn
    : null;

  const totalLectures = sections.reduce((acc, s) => acc + s.lectures.length, 0);
  const totalDuration = course ? `${Math.floor(course.totalDuration / 60)}h ${course.totalDuration % 60}m` : "0h";

  const displayRating = course?.rating;
  const displayRatingCount = course?.ratingCount;

  useEffect(() => {
    fetchData();
  }, [slug, courseId]);

  async function fetchData() {
    try {
      setLoading(true);

      // Try to fetch course from public endpoint first (includes organization data)
      try {
        const courseResponse = await api<{
          success: boolean;
          course: Course;
        }>(`/public/courses/${courseId}`, { method: "GET" });

        if (courseResponse.success && courseResponse.course) {
          setCourse(courseResponse.course);
          // Organization is included in the course response
          if (courseResponse.course.organization) {
            setOrganization(courseResponse.course.organization);
          }
          return;
        }
      } catch {
        // Public endpoint failed, try fallback
      }

      // Fallback: Fetch organization separately
      const orgResponse = await api<{
        ok: boolean;
        organization: Organization;
      }>(`/guest-auth/hq-by-slug/${slug}`, { method: "GET" });

      if (orgResponse.ok && orgResponse.organization) {
        setOrganization(orgResponse.organization);
      }

      // Fallback: Fetch from hq-items and find the course
      const itemsResponse = await api<{
        ok: boolean;
        courses: Course[];
      }>(`/guest-auth/hq-items/${slug}`, { method: "GET" });

      if (itemsResponse.ok && itemsResponse.courses) {
        const foundCourse = itemsResponse.courses.find((c) => c._id === courseId);
        if (foundCourse) {
          setCourse(foundCourse);
        }
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      toast.error("Failed to load course details");
    } finally {
      setLoading(false);
    }
  }

  function toggleSection(sectionId: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}>
        <div
          className="animate-spin rounded-full h-12 w-12 border-b-2"
          style={{ borderColor: brandColor }}
        />
      </div>
    );
  }

  if (!course || !organization) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}>
        <BookOpen className={`h-16 w-16 mb-4 ${theme === "dark" ? "text-zinc-700" : "text-gray-300"}`} />
        <h1 className={`text-2xl font-bold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Course Not Found</h1>
        <p className={`mb-6 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>The course you're looking for doesn't exist.</p>
        <Link href={`/guest/${slug}${referSuffix}`}>
          <Button style={{ backgroundColor: brandColor }} className="text-black">Back to Office</Button>
        </Link>
      </div>
    );
  }

  const ratingDistribution = [
    { stars: 5, percent: 85 },
    { stars: 4, percent: 12 },
    { stars: 3, percent: 3 },
    { stars: 2, percent: 0 },
    { stars: 1, percent: 0 },
  ];

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-zinc-950" : "bg-gray-50"}`}>
      {/* Dynamic brand color styles */}
      <style>{`
        .brand-hover:hover { color: ${brandColor} !important; }
        .brand-text { color: ${brandColor}; }
        .brand-bg { background-color: ${brandColor}; }
        .brand-border { border-color: ${brandColor}; }
      `}</style>

      <GuestNavbar organization={organization} slug={slug} theme={theme} setTheme={setTheme} brandColor={brandColor} />

      {/* Hero Section */}
      <section
        className={theme === "dark" ? "bg-zinc-950" : "bg-gray-50"}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="lg:grid lg:grid-cols-5 lg:gap-8 items-start">
            {/* Left Content - 3 columns */}
            <div className="lg:col-span-3">
              {/* Bestseller Badge */}
              <div className="mb-4">
                <span
                  className="inline-block px-3 py-1 text-sm font-semibold rounded text-black"
                  style={{ backgroundColor: brandColor }}
                >
                  Bestseller
                </span>
              </div>

              {/* Course Title */}
              <h1 className={`text-3xl md:text-4xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                {course.title}
              </h1>

              {/* Course Description with View More.
                  Backend stores rich HTML (org founders author via a
                  rich-text editor / paste from Notes/Word), so render
                  via dangerouslySetInnerHTML and let CSS line-clamp
                  handle the truncation instead of slicing by character
                  count — slicing HTML mid-tag would break the markup.
                  Same trust model as articles/videos/channels which
                  already do this. */}
              <div className="mb-6">
                {(() => {
                  const desc =
                    course.description ||
                    `Master ${course.title} from scratch to advanced with this comprehensive course.`;
                  const isLong = desc.length > 200;
                  return (
                    <>
                      {/* Truncate by visual height instead of line-clamp
                          (line-clamp collapses block-level <ol>/<li>
                          children to zero rendered height, which is what
                          was eating the GenAI agent list entirely).
                          Bottom fade-out via mask-image so the cut reads
                          as a gradient into View More, not as a hard
                          mid-word chop — the previous max-h-32 sliced
                          the next line at ~half-height which looked
                          like a layout bug. */}
                      <div
                        className={`text-lg ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        } [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_p]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_b]:font-bold [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_a]:underline [&_a]:break-all hover:[&_a]:opacity-80 ${
                          isLong && !isDescriptionExpanded
                            ? "max-h-40 overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)]"
                            : ""
                        }`}
                        dangerouslySetInnerHTML={{ __html: sanitizeDescription(desc) }}
                      />
                      {isLong && (
                        <button
                          onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                          className="mt-2 text-sm font-medium hover:underline"
                          style={{ color: brandColor }}
                        >
                          {isDescriptionExpanded ? "View less" : "View more"}
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Rating & Students */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                {displayRating != null && (
                  <div className="flex items-center gap-2">
                    <span style={{ color: brandColor }} className="font-bold">{displayRating}</span>
                    <StarRating rating={Math.round(displayRating)} size="sm" brandColor={brandColor} />
                    {displayRatingCount != null && (
                      <span style={{ color: brandColor }}>({displayRatingCount.toLocaleString()} ratings)</span>
                    )}
                  </div>
                )}
                <div className={`flex items-center gap-2 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
                  <Users className="h-4 w-4" />
                  <span>{course.enrolledStudents.toLocaleString()} students</span>
                </div>
              </div>

              {/* Creator */}
              <p className={`mb-4 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
                Created by <span style={{ color: brandColor }} className="hover:underline cursor-pointer">{creator?.name || organization.name}</span>
              </p>

              {/* Meta Info */}
              <div className={`flex flex-wrap items-center gap-6 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Last updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span>English</span>
                </div>
              </div>
            </div>

            {/* Right - Thumbnail - 2 columns */}
            <div className="lg:col-span-2 mt-6 lg:mt-0">
              <div className="relative rounded-xl overflow-hidden shadow-lg">
                {course.coverImage ? (
                  <img
                    src={course.coverImage}
                    alt={course.title}
                    className="w-full aspect-video object-cover"
                  />
                ) : (
                  <div
                    className="w-full aspect-video flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${brandColor}40, ${brandColor}20)` }}
                  >
                    <Video className="h-16 w-16 text-white/50" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <button className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center hover:scale-105 transition-transform">
                    <Play className="h-6 w-6 text-gray-900 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* Left Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* What You'll Learn */}
            {learningPoints && (
              <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
                <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>What you'll learn</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {learningPoints.map((point, index) => (
                    <div key={index} className="flex gap-3">
                      <Check className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: brandColor }} />
                      <span className={theme === "dark" ? "text-zinc-300" : "text-gray-700"}>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Course Content */}
            <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                <h2 className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Course content</h2>
                <span className={`text-sm ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>
                  {sections.length} sections • {totalLectures} lectures • {totalDuration} total length
                </span>
              </div>

              <div className="space-y-2">
                {sections.map((section) => (
                  <div key={section.id} className={`border rounded-lg overflow-hidden ${theme === "dark" ? "border-zinc-800" : "border-gray-200"}`}>
                    {/* Section Header */}
                    <button
                      onClick={() => toggleSection(section.id)}
                      className={`w-full flex items-center justify-between p-4 transition-colors ${
                        theme === "dark"
                          ? "bg-zinc-800/50 hover:bg-zinc-800"
                          : "bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {expandedSections.has(section.id) ? (
                          <ChevronUp className={`h-5 w-5 ${theme === "dark" ? "text-zinc-400" : "text-gray-500"}`} />
                        ) : (
                          <ChevronDown className={`h-5 w-5 ${theme === "dark" ? "text-zinc-400" : "text-gray-500"}`} />
                        )}
                        <div className="text-left">
                          <h3 className={`font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{section.title}</h3>
                          <p className={`text-sm ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>
                            {section.lectures.length} lectures • {section.duration}
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Section Content */}
                    {expandedSections.has(section.id) && (
                      <div className={`divide-y ${theme === "dark" ? "divide-zinc-800" : "divide-gray-100"}`}>
                        {section.lectures.map((lecture) => (
                          <div
                            key={lecture.id}
                            className={`flex items-center justify-between px-4 py-3 ${
                              theme === "dark" ? "hover:bg-zinc-800/30" : "hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {lecture.isLocked ? (
                                <Lock className={`h-4 w-4 ${theme === "dark" ? "text-zinc-600" : "text-gray-400"}`} />
                              ) : (
                                <PlayCircle className={`h-4 w-4 ${theme === "dark" ? "text-zinc-500" : "text-gray-400"}`} />
                              )}
                              <span className={theme === "dark" ? "text-zinc-300" : "text-gray-700"}>{lecture.title}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              {lecture.isPreview && (
                                <span className="text-sm font-medium" style={{ color: brandColor }}>Preview</span>
                              )}
                              <span className={`text-sm ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>{lecture.duration}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Requirements */}
            {course.requirements && course.requirements.length > 0 && (
              <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
                <h2 className={`text-xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Requirements</h2>
                <ul className={`space-y-2 ${theme === "dark" ? "text-zinc-300" : "text-gray-700"}`}>
                  {course.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className={theme === "dark" ? "text-zinc-600" : "text-gray-400"}>•</span>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Description */}
            <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
              <h2 className={`text-xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Description</h2>
              <div className="prose prose-gray max-w-none">
                <h3 className={`text-lg font-semibold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Course Overview</h3>
                <p className={`mb-4 ${theme === "dark" ? "text-zinc-400" : "text-gray-700"}`}>
                  This comprehensive course takes you from basics to building production-ready applications.
                  You'll learn modern development practices, best practices, and how to build scalable applications.
                </p>
                <h3 className={`text-lg font-semibold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>What Makes This Course Different?</h3>
                <p className={`mb-4 ${theme === "dark" ? "text-zinc-400" : "text-gray-700"}`}>
                  Unlike other courses, we focus on real-world projects and industry best practices.
                  You'll build complete projects including practical applications that you can add to your portfolio.
                </p>
                <h3 className={`text-lg font-semibold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Who This Course Is For</h3>
                <ul className={`space-y-1 ${theme === "dark" ? "text-zinc-400" : "text-gray-700"}`}>
                  <li>Beginners who want to learn modern development</li>
                  <li>Developers looking to update their skills</li>
                  <li>Anyone wanting to build professional applications</li>
                </ul>
              </div>
            </div>

            {/* Instructor */}
            <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
              <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Instructor</h2>
              <div className="flex items-start gap-4">
                {creator?.profilePicture ? (
                  <img
                    src={creator.profilePicture}
                    alt={creator.name}
                    className="w-20 h-20 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-black flex-shrink-0"
                    style={{ backgroundColor: brandColor }}
                  >
                    {(creator?.name || organization.name)?.split(" ").map(w => w[0]).join("").slice(0, 2) || "IN"}
                  </div>
                )}
                <div>
                  <h3 className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                    {creator?.name || organization.name}
                  </h3>
                  <p className={`mb-3 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>Course Creator & Instructor</p>
                  <div className={`flex flex-wrap items-center gap-6 text-sm ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4" style={{ color: brandColor, fill: brandColor }} />
                      <span>4.8 Instructor Rating</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{(course.enrolledStudents * 3).toLocaleString()} Students</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <PlayCircle className="h-4 w-4" />
                      <span>{Math.floor(3 + Math.random() * 10)} Courses</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Student Feedback */}
            {reviews && (
              <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
                <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Student feedback</h2>

                {/* Rating Overview */}
                {displayRating != null && (
                  <div className="flex flex-col md:flex-row gap-8 mb-8">
                    {/* Large Rating */}
                    <div className="text-center">
                      <div className="text-6xl font-bold mb-2" style={{ color: brandColor }}>{displayRating}</div>
                      <StarRating rating={Math.round(displayRating)} size="md" brandColor={brandColor} />
                      <p className={`text-sm mt-1 ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>Course Rating</p>
                    </div>

                    {/* Rating Bars */}
                    <div className="flex-1 space-y-2">
                      {ratingDistribution.map((item) => (
                        <div key={item.stars} className="flex items-center gap-3">
                          <div className={`w-32 h-2.5 rounded-full overflow-hidden ${theme === "dark" ? "bg-zinc-800" : "bg-gray-200"}`}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${item.percent}%`, backgroundColor: item.percent > 0 ? brandColor : "transparent" }}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <StarRating rating={item.stars} size="sm" brandColor={brandColor} />
                          </div>
                          <span className={`text-sm w-10 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>{item.percent}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reviews */}
                <div className="space-y-6">
                  {reviews.map((review) => (
                    <div key={review.id} className={`border-t pt-6 ${theme === "dark" ? "border-zinc-800" : "border-gray-100"}`}>
                      <div className="flex items-start gap-4">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold text-black shrink-0"
                          style={{ backgroundColor: brandColor }}
                        >
                          {review.initials}
                        </div>
                        <div className="flex-1">
                          <h4 className={`font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{review.name}</h4>
                          <div className="flex items-center gap-2 mb-2">
                            <StarRating rating={review.rating} size="sm" brandColor={brandColor} />
                            <span className={`text-sm ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>{review.date}</span>
                          </div>
                          <p className={theme === "dark" ? "text-zinc-400" : "text-gray-700"}>{review.comment}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar - Sticky */}
          <div className="lg:col-span-1 mt-8 lg:mt-0">
            <div className="lg:sticky lg:top-24">
              <div className={`rounded-xl border overflow-hidden shadow-lg ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
                {/* Course Image */}
                <div className="relative aspect-video">
                  {course.coverImage ? (
                    <img
                      src={course.coverImage}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${brandColor}66, ${brandColor}33)` }}
                    >
                      <BookOpen className="h-16 w-16 text-white/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <button
                      className="w-16 h-16 rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                      style={{ backgroundColor: "rgba(255,255,255,0.9)" }}
                    >
                      <Play className="h-7 w-7 text-gray-900 ml-1" />
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {/* Pricing */}
                  <div className="mb-6">
                    {course.isFree ? (
                      <div className={`text-3xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Free</div>
                    ) : (
                      <div className="flex items-baseline gap-3">
                        <span className={`text-3xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                          {formatCurrency(course.price || 0, course.currency)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* CTA Buttons */}
                  <div className="space-y-3 mb-6">
                    <Link href={`/checkout/course/${courseId}${checkoutRef}`} target="_blank">
                      <Button
                        className="w-full h-12 text-black font-semibold hover:opacity-90 cursor-pointer"
                        style={{ backgroundColor: brandColor }}
                      >
                        Add to Cart
                      </Button>
                    </Link>
                    <Link href={`/checkout/course/${courseId}${checkoutRef}`} target="_blank">
                      <Button
                        variant="outline"
                        className={`w-full h-12 font-semibold cursor-pointer ${
                          theme === "dark"
                            ? "border-zinc-700 text-white hover:bg-zinc-800"
                            : "border-gray-300 text-gray-900 hover:bg-gray-50"
                        }`}
                      >
                        Buy Now
                      </Button>
                    </Link>
                  </div>


                  {/* Course Includes */}
                  {course.courseIncludes && course.courseIncludes.length > 0 && (
                    <div>
                      <h4 className={`font-semibold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>This course includes:</h4>
                      <ul className="space-y-3">
                        {course.courseIncludes.map((item, i) => (
                          <li key={i} className={`flex items-center gap-3 text-sm ${theme === "dark" ? "text-zinc-400" : "text-gray-700"}`}>
                            {item.icon ? (
                              <img src={item.icon} alt="" className="h-4 w-4 object-cover rounded" />
                            ) : (
                              <Check className={`h-4 w-4 ${theme === "dark" ? "text-zinc-500" : "text-gray-400"}`} />
                            )}
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

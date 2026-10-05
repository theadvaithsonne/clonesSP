// src/services/course.ts
import { Types } from "mongoose";
import { Course, ICourse, ISection, IChapter, ICourseInclude, ICourseReview, IQuiz } from "../models/course.model";
import {
  CourseEnrollment,
  ICourseEnrollment,
} from "../models/courseEnrollment.model";
import {
  normalizeEmailAlerts,
  type EmailAlertsInput,
} from "../models/emailAlerts.schema";
import {
  normalizeFounderAlerts,
  type FounderAlertsInput,
} from "../models/founderAlerts.schema";
import {
  normalizeThankYouPage,
  type ThankYouPageInput,
} from "./thankYouPage";
import { distributeCommissions } from "./commission";

// ============== COURSE CRUD ==============

export async function createCourse(data: {
  title: string;
  description?: string;
  coverImage?: string;
  galleryImages?: string[];
  videoUrl?: string;
  videoFile?: string;
  organizationId: string;
  createdBy: string;
  channelIds?: string[];
  isPaid?: boolean;
  price?: number;
  currency?: string;
  status?: "draft" | "published" | "archived";
  gstInclusive?: boolean;
  requireIosPayment?: boolean;
  appleFeeInclusive?: boolean;
  rating?: number;
  ratingCount?: number;
  whatYouWillLearn?: string[];
  requirements?: string[];
  courseIncludes?: { icon: string; text: string }[];
  reviews?: { reviewerName: string; reviewerRole?: string; reviewerAvatar?: string; rating: number; text: string; helpfulCount?: number }[];
  emailAlerts?: EmailAlertsInput;
  founderAlerts?: FounderAlertsInput;
  thankYouPage?: ThankYouPageInput;
}): Promise<ICourse> {
  // Create default "Introduction" section with one "Introduction" chapter
  const defaultSectionId = new Types.ObjectId();
  const defaultChapterId = new Types.ObjectId();

  const defaultSection = {
    _id: defaultSectionId,
    title: "Introduction",
    order: 0,
    chapters: [
      {
        _id: defaultChapterId,
        title: "Introduction",
        order: 0,
        contentType: "text" as const,
        content: "",
        duration: 0,
      },
    ],
  };

  const course = new Course({
    title: data.title,
    description: data.description || "",
    coverImage: data.coverImage || data.galleryImages?.[0] || "",
    galleryImages: data.galleryImages || [],
    videoUrl: data.videoUrl || "",
    videoFile: data.videoFile || "",
    organizationId: new Types.ObjectId(data.organizationId),
    createdBy: new Types.ObjectId(data.createdBy),
    channelIds: data.channelIds?.map((id) => new Types.ObjectId(id)) || [],
    isPaid: data.isPaid || false,
    isFree: !data.isPaid,
    price: data.price || 0,
    currency: data.currency || "USD",
    // Persist only when explicitly set — mongoose schema defaults kick
    // in otherwise (gstInclusive: true, ios flags: false).
    ...(data.gstInclusive !== undefined ? { gstInclusive: data.gstInclusive } : {}),
    ...(data.requireIosPayment !== undefined ? { requireIosPayment: data.requireIosPayment } : {}),
    ...(data.appleFeeInclusive !== undefined ? { appleFeeInclusive: data.appleFeeInclusive } : {}),
    status: data.status || "draft",
    sections: [defaultSection],
    digitalAssets: [],
    totalDuration: 0,
    totalChapters: 1, // Start with 1 chapter (Introduction)
    enrolledStudents: 0,
    rating: data.rating,
    ratingCount: data.ratingCount,
    whatYouWillLearn: data.whatYouWillLearn,
    requirements: data.requirements,
    courseIncludes: data.courseIncludes,
    reviews: data.reviews?.map((r) => ({
      ...r,
      _id: new Types.ObjectId(),
      createdAt: new Date(),
    })),
    ...(data.emailAlerts !== undefined
      ? { emailAlerts: normalizeEmailAlerts(data.emailAlerts) }
      : {}),
    ...(data.founderAlerts !== undefined
      ? { founderAlerts: normalizeFounderAlerts(data.founderAlerts) }
      : {}),
    // Tri-state: undefined (leave), null (clear), object (validated write).
    // Shared normaliser with Product — throws on invalid URL / >5 sections /
    // missing heading; route handler maps to HTTP 400.
    ...(data.thankYouPage !== undefined
      ? { thankYouPage: normalizeThankYouPage(data.thankYouPage) || undefined }
      : {}),
  });

  return course.save();
}

export async function getCourseById(courseId: string): Promise<ICourse | null> {
  return Course.findById(courseId)
    .populate("createdBy", "name email avatar")
    .populate("organizationId", "name logo")
    .lean();
}

export async function getCoursesByOrganization(
  organizationId: string,
  options?: {
    status?: "draft" | "published" | "archived";
    createdBy?: string;
    limit?: number;
    skip?: number;
  }
): Promise<ICourse[]> {
  const query: any = { organizationId: new Types.ObjectId(organizationId) };

  if (options?.status) {
    query.status = options.status;
  }

  if (options?.createdBy) {
    query.createdBy = new Types.ObjectId(options.createdBy);
  }

  let queryBuilder = Course.find(query)
    .populate("createdBy", "name email avatar")
    .sort({ createdAt: -1 });

  if (options?.limit) {
    queryBuilder = queryBuilder.limit(options.limit);
  }

  if (options?.skip) {
    queryBuilder = queryBuilder.skip(options.skip);
  }

  return queryBuilder.lean();
}

export async function getPublishedCourses(
  organizationId: string,
  userChannelIds?: string[]
): Promise<ICourse[]> {
  const query: any = {
    organizationId: new Types.ObjectId(organizationId),
    status: "published",
  };

  // Channel-membership gating (parity with services/product.ts:513 +
  // services/workshop.ts:758). When `userChannelIds` is passed — even an
  // empty array — apply the $or so a stakeholder only sees courses whose
  // `channelIds` is empty (unrestricted) OR intersects with a channel they
  // belong to. If the caller passes `undefined` (rare — founder path)
  // no membership filter is applied.
  if (userChannelIds !== undefined) {
    const boundIds = userChannelIds.map((id) => new Types.ObjectId(id));
    query.$or = [
      { channelIds: { $size: 0 } }, // Public / unrestricted courses
      { channelIds: { $in: boundIds } }, // Restricted to a channel the user is in
    ];
  }

  return Course.find(query)
    .populate("createdBy", "name email avatar")
    .sort({ createdAt: -1 })
    .lean();
}

export async function updateCourse(
  courseId: string,
  data: Partial<{
    title: string;
    description: string;
    coverImage: string;
    galleryImages: string[];
    videoUrl: string;
    videoFile: string;
    status: "draft" | "published" | "archived";
    channelIds: string[];
    isPaid: boolean;
    price: number;
    currency: string;
    gstInclusive: boolean;
    requireIosPayment: boolean;
    appleFeeInclusive: boolean;
    rating: number;
    ratingCount: number;
    whatYouWillLearn: string[];
    requirements: string[];
    courseIncludes: { icon: string; text: string }[];
    reviews: { _id?: string; reviewerName: string; reviewerRole?: string; reviewerAvatar?: string; rating: number; text: string; helpfulCount?: number; createdAt?: string }[];
    emailAlerts: EmailAlertsInput;
    founderAlerts: FounderAlertsInput;
    thankYouPage: ThankYouPageInput;
  }>
): Promise<ICourse | null> {
  const updateData: any = { ...data };

  if (data.galleryImages && !data.coverImage) {
    updateData.coverImage = data.galleryImages[0] || "";
  }

  if (data.channelIds) {
    updateData.channelIds = data.channelIds.map((id) => new Types.ObjectId(id));
  }

  if (data.isPaid !== undefined) {
    updateData.isFree = !data.isPaid;
  }

  if (data.reviews) {
    updateData.reviews = data.reviews.map((r) => ({
      ...r,
      _id: r._id ? new Types.ObjectId(r._id) : new Types.ObjectId(),
      createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
    }));
  }

  // Only touch the alerts when the caller actually sent them — every other
  // course update (chapter edits, stat bumps) must leave the snapshot alone.
  if (data.emailAlerts !== undefined) {
    updateData.emailAlerts = normalizeEmailAlerts(data.emailAlerts);
  } else {
    delete updateData.emailAlerts;
  }

  // Same "only when sent" rule for the founder's own join alert.
  if (data.founderAlerts !== undefined) {
    updateData.founderAlerts = normalizeFounderAlerts(data.founderAlerts);
  } else {
    delete updateData.founderAlerts;
  }

  // Same tri-state contract as products: undefined leaves it alone,
  // null clears (translated to Mongo $unset), object is validated + written.
  if (data.thankYouPage !== undefined) {
    const normalised = normalizeThankYouPage(data.thankYouPage);
    if (normalised === null) {
      delete updateData.thankYouPage;
      return Course.findByIdAndUpdate(
        courseId,
        { ...updateData, $unset: { thankYouPage: "" } },
        { new: true },
      )
        .populate("createdBy", "name email avatar")
        .lean();
    }
    updateData.thankYouPage = normalised;
  } else {
    delete updateData.thankYouPage;
  }

  return Course.findByIdAndUpdate(courseId, updateData, { new: true })
    .populate("createdBy", "name email avatar")
    .lean();
}

export async function deleteCourse(courseId: string): Promise<boolean> {
  const result = await Course.findByIdAndDelete(courseId);
  if (result) {
    // Also delete all enrollments for this course
    await CourseEnrollment.deleteMany({ courseId: new Types.ObjectId(courseId) });
    return true;
  }
  return false;
}

// ============== SECTION MANAGEMENT ==============

export async function addSection(
  courseId: string,
  title: string
): Promise<ICourse | null> {
  const course = await Course.findById(courseId);
  if (!course) return null;

  const maxOrder = course.sections.reduce(
    (max, s) => Math.max(max, s.order),
    -1
  );

  course.sections.push({
    _id: new Types.ObjectId(),
    title,
    order: maxOrder + 1,
    chapters: [],
  });

  return course.save();
}

export async function updateSection(
  courseId: string,
  sectionId: string,
  title: string
): Promise<ICourse | null> {
  return Course.findOneAndUpdate(
    { _id: courseId, "sections._id": sectionId },
    { $set: { "sections.$.title": title } },
    { new: true }
  ).lean();
}

export async function deleteSection(
  courseId: string,
  sectionId: string
): Promise<ICourse | null> {
  return Course.findByIdAndUpdate(
    courseId,
    { $pull: { sections: { _id: new Types.ObjectId(sectionId) } } },
    { new: true }
  ).lean();
}

export async function reorderSections(
  courseId: string,
  sectionIds: string[]
): Promise<ICourse | null> {
  const course = await Course.findById(courseId);
  if (!course) return null;

  // Create a map of sectionId to new order
  const orderMap = new Map<string, number>();
  sectionIds.forEach((id, index) => {
    orderMap.set(id, index);
  });

  // Update section orders
  course.sections.forEach((section) => {
    const newOrder = orderMap.get(section._id.toString());
    if (newOrder !== undefined) {
      section.order = newOrder;
    }
  });

  // Sort sections by order
  course.sections.sort((a, b) => a.order - b.order);

  return course.save();
}

// ============== CHAPTER MANAGEMENT ==============

export async function addChapter(
  courseId: string,
  sectionId: string,
  chapterData: {
    title: string;
    contentType: "video" | "link" | "text" | "quiz" | "pdf" | "json";
    videoUrl?: string;
    videoS3Key?: string;
    linkUrl?: string;
    content?: string;
    duration?: number;
    quiz?: any;
    pdfUrl?: string;
    pdfS3Key?: string;
    pdfs?: any[];
    jsonFiles?: any[];
  }
): Promise<ICourse | null> {
  const course = await Course.findById(courseId);
  if (!course) return null;

  const section = course.sections.find(
    (s) => s._id.toString() === sectionId
  );
  if (!section) return null;

  const maxOrder = section.chapters.reduce(
    (max, c) => Math.max(max, c.order),
    -1
  );

  section.chapters.push({
    _id: new Types.ObjectId(),
    title: chapterData.title,
    order: maxOrder + 1,
    contentType: chapterData.contentType,
    videoUrl: chapterData.videoUrl,
    videoS3Key: chapterData.videoS3Key,
    linkUrl: chapterData.linkUrl,
    content: chapterData.content,
    duration: chapterData.duration || 0,
    quiz: chapterData.contentType === "quiz" ? chapterData.quiz : undefined,
    pdfUrl: chapterData.pdfUrl,
    pdfS3Key: chapterData.pdfS3Key,
    pdfs: chapterData.pdfs,
    jsonFiles: chapterData.jsonFiles,
  } as any);

  return course.save();
}

export async function updateChapter(
  courseId: string,
  sectionId: string,
  chapterId: string,
  chapterData: Partial<{
    title: string;
    contentType: "video" | "link" | "text" | "quiz" | "pdf" | "json";
    videoUrl: string;
    videoS3Key: string;
    linkUrl: string;
    content: string;
    duration: number;
    quiz: any;
    pdfUrl: string;
    pdfS3Key: string;
    pdfs: any[];
    jsonFiles: any[];
  }>
): Promise<ICourse | null> {
  const course = await Course.findById(courseId);
  if (!course) return null;

  const section = course.sections.find(
    (s) => s._id.toString() === sectionId
  );
  if (!section) return null;

  const chapter = section.chapters.find(
    (c) => c._id.toString() === chapterId
  );
  if (!chapter) return null;

  // Update chapter fields
  if (chapterData.title !== undefined) chapter.title = chapterData.title;
  if (chapterData.contentType !== undefined)
    chapter.contentType = chapterData.contentType;
  if (chapterData.videoUrl !== undefined) chapter.videoUrl = chapterData.videoUrl;
  if (chapterData.videoS3Key !== undefined) chapter.videoS3Key = chapterData.videoS3Key;
  if (chapterData.linkUrl !== undefined) chapter.linkUrl = chapterData.linkUrl;
  if (chapterData.content !== undefined) chapter.content = chapterData.content;
  if (chapterData.duration !== undefined) chapter.duration = chapterData.duration;
  if (chapterData.quiz !== undefined) (chapter as any).quiz = chapterData.quiz;
  if (chapterData.pdfUrl !== undefined) (chapter as any).pdfUrl = chapterData.pdfUrl;
  if (chapterData.pdfS3Key !== undefined) (chapter as any).pdfS3Key = chapterData.pdfS3Key;
  if (chapterData.pdfs !== undefined) (chapter as any).pdfs = chapterData.pdfs;
  if (chapterData.jsonFiles !== undefined) (chapter as any).jsonFiles = chapterData.jsonFiles;

  return course.save();
}

export async function deleteChapter(
  courseId: string,
  sectionId: string,
  chapterId: string
): Promise<ICourse | null> {
  const course = await Course.findById(courseId);
  if (!course) return null;

  const section = course.sections.find(
    (s) => s._id.toString() === sectionId
  );
  if (!section) return null;

  section.chapters = section.chapters.filter(
    (c) => c._id.toString() !== chapterId
  );

  return course.save();
}

export async function reorderChapters(
  courseId: string,
  sectionId: string,
  chapterIds: string[]
): Promise<ICourse | null> {
  const course = await Course.findById(courseId);
  if (!course) return null;

  const section = course.sections.find(
    (s) => s._id.toString() === sectionId
  );
  if (!section) return null;

  // Create a map of chapterId to new order
  const orderMap = new Map<string, number>();
  chapterIds.forEach((id, index) => {
    orderMap.set(id, index);
  });

  // Update chapter orders
  section.chapters.forEach((chapter) => {
    const newOrder = orderMap.get(chapter._id.toString());
    if (newOrder !== undefined) {
      chapter.order = newOrder;
    }
  });

  // Sort chapters by order
  section.chapters.sort((a, b) => a.order - b.order);

  return course.save();
}

// ============== ENROLLMENT ==============

export async function enrollInCourse(data: {
  courseId: string;
  userId: string;
  organizationId: string;
  isPaid?: boolean;
  amountPaid?: number;
  currency?: string;
  paymentId?: string;
  /**
   * Suppress the automatic $0 invoice this service mints for free enrolments.
   *
   * For `/checkout/course/:id`, which needs the invoice document back in the
   * same request to attach the order-confirmation email — so it awaits its own
   * mint. Without this flag the two would race: the background mint here and
   * the awaited one there could both pass the dedupe check and create two.
   *
   * Leave unset on any new caller so the invoice happens by default.
   */
  skipFreeInvoice?: boolean;
}): Promise<ICourseEnrollment> {
  const course = await Course.findById(data.courseId);
  if (!course) {
    throw new Error("Course not found");
  }

  // Check if already enrolled
  const existingEnrollment = await CourseEnrollment.findOne({
    courseId: new Types.ObjectId(data.courseId),
    userId: new Types.ObjectId(data.userId),
  });

  if (existingEnrollment) {
    throw new Error("Already enrolled in this course");
  }

  const enrollment = new CourseEnrollment({
    courseId: new Types.ObjectId(data.courseId),
    userId: new Types.ObjectId(data.userId),
    organizationId: new Types.ObjectId(data.organizationId),
    status: "enrolled",
    enrolledAt: new Date(),
    isPaid: data.isPaid || false,
    amountPaid: data.amountPaid,
    currency: data.currency,
    paymentId: data.paymentId,
    paymentStatus: data.isPaid ? "completed" : undefined,
    chaptersProgress: [],
    completedChapters: 0,
    totalChapters: course.totalChapters,
    progressPercentage: 0,
    lastAccessedAt: new Date(),
  });

  await enrollment.save();

  // Increment enrolled students count
  await Course.findByIdAndUpdate(data.courseId, {
    $inc: { enrolledStudents: 1 },
  });

  // Free enrolment gets the same $0 paper trail a free /checkout/course/:id
  // produces. Covers /courses/:id/enroll and the founder-comped path on a paid
  // course (both of which set isPaid false), which were previously uninvoiced.
  // Enrolment is written first — the invoice is best-effort and never blocks it.
  if (!data.isPaid && !data.skipFreeInvoice) {
    // Backgrounded: bookkeeping must not add latency to the enrol response.
    const { mintFreeItemInvoiceInBackground } = await import("./freeInvoice");
    mintFreeItemInvoiceInBackground({
      userId: data.userId,
      orgId: data.organizationId,
      sellerId: course.createdBy.toString(),
      itemType: "course",
      itemId: String(course._id),
      itemName: course.title,
      itemDescription: course.description,
      itemImage: course.coverImage,
      currency: data.currency || course.currency,
      metadataType: "course_checkout",
      source: "enroll",
      // Deliberate enrolment (in-app "Enrol" or the founder comping
      // themselves), so it earns the same order email a paid enrolment gets.
      notifyBuyer: true,
    });
  }

  // Distribute commissions if this is a paid course.
  // Pre-tax base: an inclusive-priced course sold to an Indian buyer has
  // 18% GST inside its listed price, which is the government's and not the
  // seller's — passing amountPaid verbatim would over-pay affiliates by
  // 18%. A foreign buyer paid no GST, so the whole amount is base. Same
  // rule as the route-level callers; this service-level path fires first
  // via dedup on paymentId, so the fix MUST live here to take effect.
  if (data.isPaid && data.amountPaid && data.amountPaid > 0) {
    try {
      const { getCommissionBase } = await import("../utils/gstTax");
      const { isBuyerInIndia } = await import("../utils/gstBuyerRegion");
      await distributeCommissions({
        orgId: data.organizationId,
        sellerId: course.createdBy.toString(),
        customerId: data.userId,
        itemType: "course",
        itemId: data.courseId,
        itemName: course.title,
        saleAmount: getCommissionBase(
          data.amountPaid,
          { gstInclusive: (course as any).gstInclusive },
          await isBuyerInIndia(
            data.userId,
            data.currency || course.currency || "USD"
          )
        ),
        currency: data.currency || "USD",
        paymentId: data.paymentId,
      });
    } catch (error) {
      console.error("Error distributing commissions for course enrollment:", error);
      // Don't fail the enrollment if commission distribution fails
    }
  }

  return enrollment;
}

export async function getEnrollment(
  courseId: string,
  userId: string
): Promise<ICourseEnrollment | null> {
  return CourseEnrollment.findOne({
    courseId: new Types.ObjectId(courseId),
    userId: new Types.ObjectId(userId),
  }).lean();
}

export async function getUserEnrollments(
  userId: string,
  organizationId: string
): Promise<ICourseEnrollment[]> {
  return CourseEnrollment.find({
    userId: new Types.ObjectId(userId),
    organizationId: new Types.ObjectId(organizationId),
  })
    .populate({
      path: "courseId",
      select: "title coverImage totalChapters totalDuration createdBy",
      populate: { path: "createdBy", select: "name avatar" },
    })
    .sort({ lastAccessedAt: -1 })
    .lean();
}

export async function markChapterComplete(
  courseId: string,
  userId: string,
  sectionId: string,
  chapterId: string
): Promise<ICourseEnrollment | null> {
  const enrollment = await CourseEnrollment.findOne({
    courseId: new Types.ObjectId(courseId),
    userId: new Types.ObjectId(userId),
  });

  if (!enrollment) return null;

  // Sync totalChapters from the course in case founder added/removed chapters
  const course = await Course.findById(courseId).lean();
  if (course) {
    enrollment.totalChapters = course.totalChapters;
  }

  // Check if chapter already in progress array
  const existingProgress = enrollment.chaptersProgress.find(
    (p) => p.chapterId.toString() === chapterId
  );

  if (existingProgress) {
    if (!existingProgress.completed) {
      existingProgress.completed = true;
      existingProgress.completedAt = new Date();
      enrollment.completedChapters += 1;
    }
  } else {
    enrollment.chaptersProgress.push({
      chapterId: new Types.ObjectId(chapterId),
      sectionId: new Types.ObjectId(sectionId),
      completed: true,
      completedAt: new Date(),
    });
    enrollment.completedChapters += 1;
  }

  enrollment.lastAccessedAt = new Date();
  enrollment.lastChapterId = new Types.ObjectId(chapterId);
  enrollment.lastSectionId = new Types.ObjectId(sectionId);

  return enrollment.save();
}

export async function markChapterIncomplete(
  courseId: string,
  userId: string,
  chapterId: string
): Promise<ICourseEnrollment | null> {
  const enrollment = await CourseEnrollment.findOne({
    courseId: new Types.ObjectId(courseId),
    userId: new Types.ObjectId(userId),
  });

  if (!enrollment) return null;

  // Sync totalChapters from the course in case founder added/removed chapters
  const courseFresh = await Course.findById(courseId).lean();
  if (courseFresh) {
    enrollment.totalChapters = courseFresh.totalChapters;
  }

  const existingProgress = enrollment.chaptersProgress.find(
    (p) => p.chapterId.toString() === chapterId
  );

  if (existingProgress && existingProgress.completed) {
    existingProgress.completed = false;
    existingProgress.completedAt = undefined;
    enrollment.completedChapters = Math.max(0, enrollment.completedChapters - 1);

    // Reset completion status if was completed
    if (enrollment.status === "completed") {
      enrollment.status = "enrolled";
      enrollment.completedAt = undefined;
    }
  }

  return enrollment.save();
}

export async function updateChapterProgress(
  courseId: string,
  userId: string,
  sectionId: string,
  chapterId: string,
  watchTime: number,
  lastPosition: number
): Promise<ICourseEnrollment | null> {
  const enrollment = await CourseEnrollment.findOne({
    courseId: new Types.ObjectId(courseId),
    userId: new Types.ObjectId(userId),
  });

  if (!enrollment) return null;

  const existingProgress = enrollment.chaptersProgress.find(
    (p) => p.chapterId.toString() === chapterId
  );

  if (existingProgress) {
    existingProgress.watchTime = watchTime;
    existingProgress.lastPosition = lastPosition;
  } else {
    enrollment.chaptersProgress.push({
      chapterId: new Types.ObjectId(chapterId),
      sectionId: new Types.ObjectId(sectionId),
      completed: false,
      watchTime,
      lastPosition,
    });
  }

  enrollment.lastAccessedAt = new Date();
  enrollment.lastChapterId = new Types.ObjectId(chapterId);
  enrollment.lastSectionId = new Types.ObjectId(sectionId);

  return enrollment.save();
}

// ============== DIGITAL ASSETS ==============

export async function addDigitalAsset(
  courseId: string,
  asset: {
    name: string;
    url: string;
    fileType: string;
    fileSize?: number;
  }
): Promise<ICourse | null> {
  return Course.findByIdAndUpdate(
    courseId,
    {
      $push: {
        digitalAssets: {
          _id: new Types.ObjectId(),
          ...asset,
        },
      },
    },
    { new: true }
  ).lean();
}

export async function removeDigitalAsset(
  courseId: string,
  assetId: string
): Promise<ICourse | null> {
  return Course.findByIdAndUpdate(
    courseId,
    { $pull: { digitalAssets: { _id: new Types.ObjectId(assetId) } } },
    { new: true }
  ).lean();
}

// ============== STATS ==============

export async function getCourseStats(courseId: string): Promise<{
  totalEnrollments: number;
  completedCount: number;
  averageProgress: number;
}> {
  const enrollments = await CourseEnrollment.find({
    courseId: new Types.ObjectId(courseId),
  }).lean();

  const totalEnrollments = enrollments.length;
  const completedCount = enrollments.filter(
    (e) => e.status === "completed"
  ).length;
  const averageProgress =
    totalEnrollments > 0
      ? enrollments.reduce((sum, e) => sum + e.progressPercentage, 0) /
      totalEnrollments
      : 0;

  return {
    totalEnrollments,
    completedCount,
    averageProgress: Math.round(averageProgress),
  };
}

// ============== QUIZ ==============

export async function submitQuizAttempt(
  courseId: string,
  userId: string,
  sectionId: string,
  chapterId: string,
  answers: { questionId: string; selectedOptions: number[] }[]
): Promise<{
  score: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  results: {
    questionId: string;
    isCorrect: boolean;
    correctOptions: number[];
    explanation?: string;
    relatedChapterId?: string;
  }[];
  attemptNumber: number;
}> {
  // 1. Get the course and find the quiz chapter
  const course = await Course.findById(courseId);
  if (!course) throw new Error("Course not found");

  const section = course.sections.find((s) => s._id.toString() === sectionId);
  if (!section) throw new Error("Section not found");

  const chapter = section.chapters.find((c) => c._id.toString() === chapterId);
  if (!chapter || chapter.contentType !== "quiz" || !chapter.quiz) {
    throw new Error("Quiz chapter not found");
  }

  const quiz = chapter.quiz;

  // 2. Grade answers
  let score = 0;
  let totalPoints = 0;
  const results: {
    questionId: string;
    isCorrect: boolean;
    correctOptions: number[];
    explanation?: string;
    relatedChapterId?: string;
  }[] = [];
  const attemptAnswers: { questionId: string; selectedOptions: number[]; isCorrect: boolean }[] = [];

  for (const question of quiz.questions) {
    totalPoints += question.points;
    const userAnswer = answers.find((a) => a.questionId === question._id.toString());
    const selectedOptions = userAnswer?.selectedOptions || [];

    // Find correct option indices
    const correctOptions = question.options
      .map((opt, idx) => (opt.isCorrect ? idx : -1))
      .filter((idx) => idx !== -1);

    // Check correctness
    let isCorrect = false;
    if (question.questionType === "mcq_single" || question.questionType === "true_false") {
      isCorrect =
        selectedOptions.length === 1 &&
        correctOptions.length === 1 &&
        selectedOptions[0] === correctOptions[0];
    } else {
      // mcq_multi — must match exactly
      isCorrect =
        selectedOptions.length === correctOptions.length &&
        selectedOptions.every((idx) => correctOptions.includes(idx)) &&
        correctOptions.every((idx) => selectedOptions.includes(idx));
    }

    if (isCorrect) score += question.points;

    results.push({
      questionId: question._id.toString(),
      isCorrect,
      correctOptions,
      explanation: question.explanation,
      relatedChapterId: question.relatedChapterId?.toString(),
    });

    attemptAnswers.push({
      questionId: question._id.toString(),
      selectedOptions,
      isCorrect,
    });
  }

  const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
  const passed = percentage >= quiz.passingScore;

  // 3. Save attempt to enrollment
  const enrollment = await CourseEnrollment.findOne({
    courseId: new Types.ObjectId(courseId),
    userId: new Types.ObjectId(userId),
  });

  if (!enrollment) throw new Error("Enrollment not found");

  // Sync totalChapters from the course in case founder added/removed chapters
  enrollment.totalChapters = course.totalChapters;

  // Count previous attempts for this chapter
  const previousAttempts = enrollment.quizAttempts?.filter(
    (a) => a.chapterId.toString() === chapterId
  ) || [];
  const attemptNumber = previousAttempts.length + 1;

  if (!enrollment.quizAttempts) enrollment.quizAttempts = [];
  enrollment.quizAttempts.push({
    chapterId: new Types.ObjectId(chapterId),
    sectionId: new Types.ObjectId(sectionId),
    attemptNumber,
    score,
    totalPoints,
    percentage,
    passed,
    answers: attemptAnswers,
    completedAt: new Date(),
  });

  // 4. If passed and quiz is required, auto-mark chapter complete
  if (passed) {
    const existingProgress = enrollment.chaptersProgress.find(
      (p) => p.chapterId.toString() === chapterId
    );
    if (existingProgress) {
      if (!existingProgress.completed) {
        existingProgress.completed = true;
        existingProgress.completedAt = new Date();
        enrollment.completedChapters += 1;
      }
    } else {
      enrollment.chaptersProgress.push({
        chapterId: new Types.ObjectId(chapterId),
        sectionId: new Types.ObjectId(sectionId),
        completed: true,
        completedAt: new Date(),
      });
      enrollment.completedChapters += 1;
    }
  }

  enrollment.lastAccessedAt = new Date();
  enrollment.lastChapterId = new Types.ObjectId(chapterId);
  enrollment.lastSectionId = new Types.ObjectId(sectionId);

  await enrollment.save();

  return {
    score,
    totalPoints,
    percentage,
    passed,
    results,
    attemptNumber,
  };
}

export async function getQuizAnalytics(courseId: string): Promise<{
  quizzes: {
    chapterId: string;
    chapterTitle: string;
    sectionId: string;
    sectionTitle: string;
    totalAttempts: number;
    uniqueStudents: number;
    passRate: number;
    averageScore: number;
    questionStats: {
      questionId: string;
      questionText: string;
      correctRate: number;
      totalAnswered: number;
    }[];
  }[];
}> {
  const course = await Course.findById(courseId).lean();
  if (!course) throw new Error("Course not found");

  // Find all quiz chapters
  const quizChapters: { chapter: any; section: any }[] = [];
  for (const section of course.sections) {
    for (const chapter of section.chapters) {
      if (chapter.contentType === "quiz" && chapter.quiz) {
        quizChapters.push({ chapter, section });
      }
    }
  }

  // Get all enrollments with quiz attempts
  const enrollments = await CourseEnrollment.find({
    courseId: new Types.ObjectId(courseId),
  }).lean();

  const quizzes = quizChapters.map(({ chapter, section }) => {
    const chId = chapter._id.toString();

    // Collect all attempts for this quiz
    const allAttempts: any[] = [];
    for (const enrollment of enrollments) {
      const attempts = (enrollment.quizAttempts || []).filter(
        (a) => a.chapterId.toString() === chId
      );
      allAttempts.push(...attempts);
    }

    const uniqueStudentIds = new Set(
      enrollments
        .filter((e) =>
          (e.quizAttempts || []).some((a) => a.chapterId.toString() === chId)
        )
        .map((e) => e.userId.toString())
    );

    const passedAttempts = allAttempts.filter((a) => a.passed).length;
    const totalScores = allAttempts.reduce((sum, a) => sum + a.percentage, 0);

    // Per-question stats
    const questionStats = (chapter.quiz?.questions || []).map((q: any) => {
      const qId = q._id.toString();
      let totalAnswered = 0;
      let correctCount = 0;

      for (const attempt of allAttempts) {
        const answer = (attempt.answers || []).find(
          (a: any) => a.questionId === qId
        );
        if (answer) {
          totalAnswered++;
          if (answer.isCorrect) correctCount++;
        }
      }

      return {
        questionId: qId,
        questionText: q.questionText,
        correctRate: totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0,
        totalAnswered,
      };
    });

    return {
      chapterId: chId,
      chapterTitle: chapter.title,
      sectionId: section._id.toString(),
      sectionTitle: section.title,
      totalAttempts: allAttempts.length,
      uniqueStudents: uniqueStudentIds.size,
      passRate: allAttempts.length > 0 ? Math.round((passedAttempts / allAttempts.length) * 100) : 0,
      averageScore: allAttempts.length > 0 ? Math.round(totalScores / allAttempts.length) : 0,
      questionStats,
    };
  });

  return { quizzes };
}

export async function cloneCourse(courseId: string, createdBy: string): Promise<ICourse> {
  const originalCourse = await Course.findById(courseId);
  if (!originalCourse) {
    throw new Error("Course not found");
  }

  const sectionIdMap = new Map<string, Types.ObjectId>();
  const chapterIdMap = new Map<string, Types.ObjectId>();

  // Map old section IDs and chapter IDs to new ones to properly decouple
  originalCourse.sections.forEach((sec) => {
    const newSecId = new Types.ObjectId();
    sectionIdMap.set(sec._id.toString(), newSecId);
    sec.chapters.forEach((ch) => {
      const newChId = new Types.ObjectId();
      chapterIdMap.set(ch._id.toString(), newChId);
    });
  });

  const clonedSections: ISection[] = originalCourse.sections.map((sec) => {
    const clonedChapters: IChapter[] = sec.chapters.map((ch) => {
      let clonedQuiz: IQuiz | undefined = undefined;
      if (ch.quiz) {
        clonedQuiz = {
          passingScore: ch.quiz.passingScore,
          isRequired: ch.quiz.isRequired,
          shuffleQuestions: ch.quiz.shuffleQuestions,
          shuffleOptions: ch.quiz.shuffleOptions,
          questions: ch.quiz.questions.map((q) => {
            const oldRelatedId = q.relatedChapterId ? q.relatedChapterId.toString() : undefined;
            const newRelatedId = oldRelatedId && chapterIdMap.has(oldRelatedId)
              ? chapterIdMap.get(oldRelatedId)
              : undefined;

            return {
              _id: new Types.ObjectId(),
              questionText: q.questionText,
              questionType: q.questionType,
              options: q.options.map((opt) => ({
                text: opt.text,
                isCorrect: opt.isCorrect,
              })),
              explanation: q.explanation,
              points: q.points,
              relatedChapterId: newRelatedId,
            } as any;
          }),
        };
      }

      const clonedPdfs = ch.pdfs?.map((pdf) => ({
        _id: new Types.ObjectId(),
        name: pdf.name,
        url: pdf.url,
        s3Key: pdf.s3Key,
        fileSize: pdf.fileSize,
      })) || [];

      const clonedJsonFiles = ch.jsonFiles?.map((json) => ({
        _id: new Types.ObjectId(),
        name: json.name,
        url: json.url,
        s3Key: json.s3Key,
        fileSize: json.fileSize,
      })) || [];

      return {
        _id: chapterIdMap.get(ch._id.toString())!,
        title: ch.title,
        order: ch.order,
        contentType: ch.contentType,
        videoUrl: ch.videoUrl,
        videoS3Key: ch.videoS3Key,
        linkUrl: ch.linkUrl,
        content: ch.content,
        duration: ch.duration,
        quiz: clonedQuiz,
        pdfUrl: ch.pdfUrl,
        pdfS3Key: ch.pdfS3Key,
        pdfs: clonedPdfs as any,
        jsonFiles: clonedJsonFiles as any,
      };
    });

    return {
      _id: sectionIdMap.get(sec._id.toString())!,
      title: sec.title,
      order: sec.order,
      chapters: clonedChapters,
    };
  });

  const clonedDigitalAssets = originalCourse.digitalAssets?.map((asset) => ({
    _id: new Types.ObjectId(),
    name: asset.name,
    url: asset.url,
    fileType: asset.fileType,
    fileSize: asset.fileSize,
  })) || [];

  const clonedCourseIncludes = originalCourse.courseIncludes?.map((inc) => ({
    icon: inc.icon,
    text: inc.text,
  })) || [];

  const clonedReviews = originalCourse.reviews?.map((rev) => ({
    _id: new Types.ObjectId(),
    reviewerName: rev.reviewerName,
    reviewerRole: rev.reviewerRole,
    reviewerAvatar: rev.reviewerAvatar,
    rating: rev.rating,
    text: rev.text,
    helpfulCount: rev.helpfulCount,
    createdAt: new Date(),
  })) || [];

  const clonedCourse = new Course({
    title: `${originalCourse.title} (Copy)`,
    description: originalCourse.description,
    coverImage: originalCourse.coverImage,
    galleryImages: originalCourse.galleryImages || [],
    videoUrl: originalCourse.videoUrl,
    videoFile: originalCourse.videoFile,
    status: "draft",
    organizationId: originalCourse.organizationId,
    createdBy: new Types.ObjectId(createdBy),
    channelIds: originalCourse.channelIds || [],
    isPaid: originalCourse.isPaid,
    isFree: originalCourse.isFree,
    price: originalCourse.price,
    currency: originalCourse.currency || "USD",
    gstInclusive: originalCourse.gstInclusive,
    requireIosPayment: originalCourse.requireIosPayment,
    appleFeeInclusive: originalCourse.appleFeeInclusive,
    isSubscription: originalCourse.isSubscription,
    subscriptionPeriod: originalCourse.subscriptionPeriod,
    sections: clonedSections,
    digitalAssets: clonedDigitalAssets,
    totalDuration: originalCourse.totalDuration,
    totalChapters: originalCourse.totalChapters,
    enrolledStudents: 0,
    rating: originalCourse.rating,
    ratingCount: originalCourse.ratingCount,
    whatYouWillLearn: originalCourse.whatYouWillLearn,
    requirements: originalCourse.requirements,
    courseIncludes: clonedCourseIncludes,
    reviews: clonedReviews,
  });

  return clonedCourse.save();
}

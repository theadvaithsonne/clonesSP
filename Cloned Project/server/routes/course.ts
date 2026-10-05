// src/routes/course.ts
import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { isFounderOrModuleAdmin } from "../utils/rbac";
import { User } from "../models/user.model";
import { Course } from "../models/course.model";
import { CourseEnrollment } from "../models/courseEnrollment.model";
import * as courseService from "../services/course";
import { Organization } from "../models/organization.model";
import { ChannelMembership } from "../models/channelMembership.model";
import { notifyNewCourseCreated } from "../services/bulkEmail";
import { createOrder, verifyPaymentSignature } from "../services/razorpay";
import { distributeCommissions } from "../services/commission";
import { getCommissionBase } from "../utils/gstTax";
import { isBuyerInIndia } from "../utils/gstBuyerRegion";
import {
  createSubscriptionPlan,
  getSubscriptionPlanForItem,
  createUserSubscription,
  hasSubscriptionAccess,
  getUserActiveSubscription,
} from "../services/subscription";

const router = Router();

/**
 * Can this user manage courses in this org?
 *
 * Founders, legacy single-org admins and `fullAccess` holders — plus members a
 * founder granted the "courses" module via /rbac. A superset of the founder
 * check this previously performed, so nobody loses access.
 */
async function isUserFounder(userId: string, orgId: string): Promise<boolean> {
  return isFounderOrModuleAdmin(userId, orgId, "courses");
}

// ============== COURSE CRUD ==============

// Create a new course (Founder only)
router.post("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    // Use orgId from query params if provided, fallback to JWT
    const orgId = (req.query.orgId as string) || me.organizationId;
    const {
      title,
      description,
      coverImage,
      galleryImages,
      videoUrl,
      videoFile,
      channelIds,
      isPaid,
      price,
      currency,
      status,
      // Tax + iOS payment surcharges. Silently stripped by the mongoose
      // schema if the caller sends unknown keys, so accept them here so
      // the FE toggle actually persists.
      gstInclusive,
      requireIosPayment,
      appleFeeInclusive,
      rating,
      ratingCount,
      whatYouWillLearn,
      requirements,
      courseIncludes,
      reviews,
      // Post-purchase order email. Same contract products and communities
      // use — see models/emailAlerts.schema.ts.
      emailAlerts,
      // "Notify me when someone enrols" — the founder's own alert. Separate
      // toggle from the buyer's order email above; see
      // models/founderAlerts.schema.ts.
      founderAlerts,
      // Founder-configurable post-payment page. Same normaliser Product
      // uses (services/thankYouPage.ts) — undefined = leave unchanged
      // (create: absent), null = clear, object = validated write.
      thankYouPage,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
      return res.status(400).json({ error: "Please select at least one community" });
    }

    const validLearn = Array.isArray(whatYouWillLearn)
      ? whatYouWillLearn.filter((s: any) => typeof s === "string" && s.trim())
      : [];
    if (validLearn.length === 0) {
      return res.status(400).json({ error: "Please add at least one 'What you will learn' point" });
    }

    const validReqs = Array.isArray(requirements)
      ? requirements.filter((s: any) => typeof s === "string" && s.trim())
      : [];
    if (validReqs.length === 0) {
      return res.status(400).json({ error: "Please add at least one requirement" });
    }

    const course = await courseService.createCourse({
      title,
      description,
      coverImage,
      galleryImages,
      videoUrl,
      videoFile,
      organizationId: orgId,
      createdBy: me.userId,
      channelIds,
      isPaid,
      price,
      currency,
      status,
      gstInclusive,
      requireIosPayment,
      appleFeeInclusive,
      rating,
      ratingCount,
      whatYouWillLearn,
      requirements,
      courseIncludes,
      reviews,
      emailAlerts,
      founderAlerts,
      thankYouPage,
    });

    // Notify org members about the new course (only for published courses).
    // Scoped to this office so members of unrelated orgs aren't spammed.
    if (course.status === "published") {
      const org = await Organization.findById(orgId).select("name").lean();
      notifyNewCourseCreated(
        {
          _id: course._id.toString(),
          name: course.title,
          price: course.price,
          currency: course.currency,
          description: course.description,
          coverImage: course.coverImage,
        },
        (org as any)?.name || "an organization",
        orgId
      );
    }

    res.status(201).json(course);
  } catch (error: any) {
    // Surface validation errors from normalizeThankYouPage as 400 so the
    // founder sees the actual reason. Matches routes/product.ts.
    const msg = String(error?.message || "");
    if (/URL|thank-you|Section|required/i.test(msg)) {
      return res.status(400).json({ error: msg });
    }
    console.error("Error creating course:", error);
    res.status(500).json({ error: "Failed to create course" });
  }
});

// Get all course enrollments in the organization (founder only)
router.get("/admin/enrollments", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const { courseId } = req.query;

    // Check if user is founder
    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({ error: "Only founders can view course enrollments" });
    }

    const filter: any = { organizationId: new Types.ObjectId(orgId) };
    if (courseId) {
      filter.courseId = new Types.ObjectId(courseId as string);
    }

    const enrollments = await CourseEnrollment.find(filter)
      .populate("userId", "name email avatar profilePicture")
      .populate("courseId", "title coverImage totalChapters")
      .sort({ enrolledAt: -1 })
      .lean();

    res.json({ success: true, enrollments });
  } catch (error) {
    console.error("Error fetching admin course enrollments:", error);
    res.status(500).json({ error: "Failed to fetch course enrollments" });
  }
});

// Get all courses for organization (for founders - includes drafts)
router.get("/manage", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    // Use orgId from query params if provided, fallback to JWT
    const orgId = (req.query.orgId as string) || me.organizationId;
    const { status, limit, skip } = req.query;

    // Founders should see ALL courses in the organization, not just their own
    const courses = await courseService.getCoursesByOrganization(
      orgId,
      {
        status: status as "draft" | "published" | "archived" | undefined,
        // Don't filter by createdBy - founders should see all org courses
        limit: limit ? parseInt(limit as string) : undefined,
        skip: skip ? parseInt(skip as string) : undefined,
      }
    );

    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

// Get courses - founders see all (including drafts), stakeholders see published only
router.get("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    // Use orgId from query params if provided, fallback to JWT
    const orgId = (req.query.orgId as string) || me.organizationId;

    console.log(
      "GET /courses - userId:",
      me.userId,
      "orgId:",
      orgId
    );

    // Check if user is founder
    const isFounder = await isUserFounder(me.userId, orgId);
    // console.log("isFounder result:", isFounder);

    let courses;
    if (isFounder) {
      // Founders see all their courses (including drafts)
      courses = await courseService.getCoursesByOrganization(
        orgId,
        {
          createdBy: me.userId,
        }
      );
    } else {
      // Stakeholders see only published courses AND only those they're
      // allowed to see per channel membership. A course with an empty
      // `channelIds` is public; a course with any `channelIds` is only
      // visible to members of at least one of those channels. Mirrors the
      // Products + Services + Workshops gating pattern.
      const { getUserChannelIds } = await import(
        "../services/channelMembership"
      );
      const userChannelIds = await getUserChannelIds(me.userId, orgId);
      courses = await courseService.getPublishedCourses(
        orgId,
        userChannelIds,
      );
    }

    res.json({
      courses,
      isFounder,
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

// Get course by ID
router.get("/:courseId", requireAuth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const me = (req as any).user as { userId: string; organizationId: string };

    const course = await courseService.getCourseById(courseId);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Channel-membership gating (parity with routes/product.ts:143-160).
    // Founders always see their own courses; stakeholders can only view
    // courses whose channelIds is empty OR intersects with a channel they
    // belong to.
    const orgVal = (course as any).organizationId;
    const courseOrgId =
      orgVal && typeof orgVal === "object"
        ? (orgVal._id?.toString() || orgVal.toString())
        : orgVal?.toString();
    if (courseOrgId) {
      const isFounder = await isUserFounder(me.userId, courseOrgId);
      const boundChannelIds: any[] = (course as any).channelIds || [];
      if (!isFounder && boundChannelIds.length > 0) {
        const memberships = await ChannelMembership.find({
          userId: new Types.ObjectId(me.userId),
          orgId: new Types.ObjectId(courseOrgId),
          status: "active",
        })
          .select("channelId")
          .lean();

        const userChannelIds = memberships.map((m) => m.channelId.toString());
        const boundIds = boundChannelIds.map((c: any) =>
          typeof c === "object" ? String(c._id ?? c) : String(c),
        );
        const hasAccess = boundIds.some((id) => userChannelIds.includes(id));
        if (!hasAccess) {
          return res.status(403).json({
            error: "You don't have access to this course",
          });
        }
      }
    }

    res.json(course);
  } catch (error) {
    console.error("Error fetching course:", error);
    res.status(500).json({ error: "Failed to fetch course" });
  }
});

// Update course
router.put("/:courseId", requireAuth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const {
      title,
      description,
      coverImage,
      galleryImages,
      videoUrl,
      videoFile,
      status,
      channelIds,
      isPaid,
      price,
      currency,
      gstInclusive,
      requireIosPayment,
      appleFeeInclusive,
      rating,
      ratingCount,
      whatYouWillLearn,
      requirements,
      courseIncludes,
      reviews,
      emailAlerts,
      founderAlerts,
      thankYouPage,
    } = req.body;

    if (channelIds !== undefined && (!Array.isArray(channelIds) || channelIds.length === 0)) {
      return res.status(400).json({ error: "Please select at least one community" });
    }

    const course = await courseService.updateCourse(courseId, {
      title,
      description,
      coverImage,
      galleryImages,
      videoUrl,
      videoFile,
      status,
      channelIds,
      isPaid,
      price,
      currency,
      gstInclusive,
      requireIosPayment,
      appleFeeInclusive,
      rating,
      ratingCount,
      whatYouWillLearn,
      requirements,
      courseIncludes,
      reviews,
      emailAlerts,
      founderAlerts,
      thankYouPage,
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    res.json(course);
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (/URL|thank-you|Section|required/i.test(msg)) {
      return res.status(400).json({ error: msg });
    }
    console.error("Error updating course:", error);
    res.status(500).json({ error: "Failed to update course" });
  }
});

// Delete course
router.delete("/:courseId", requireAuth, async (req, res) => {
  try {
    const { courseId } = req.params;

    const deleted = await courseService.deleteCourse(courseId);
    if (!deleted) {
      return res.status(404).json({ error: "Course not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({ error: "Failed to delete course" });
  }
});

// Clone course (Founder only)
router.post("/:courseId/clone", requireAuth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const me = (req as any).user as { userId: string; organizationId: string };

    const originalCourse = await Course.findById(courseId).lean();
    if (!originalCourse) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Check if user is founder in the organization of the course
    const isFounder = await isUserFounder(me.userId, originalCourse.organizationId.toString());
    if (!isFounder) {
      return res.status(403).json({ error: "Only founders can clone courses" });
    }

    const cloned = await courseService.cloneCourse(courseId, me.userId);
    res.status(201).json(cloned);
  } catch (error) {
    console.error("Error cloning course:", error);
    res.status(500).json({ error: "Failed to clone course" });
  }
});

// ============== SECTION MANAGEMENT ==============

// Add section to course
router.post("/:courseId/sections", requireAuth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Section title is required" });
    }

    const course = await courseService.addSection(courseId, title);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    res.json(course);
  } catch (error) {
    console.error("Error adding section:", error);
    res.status(500).json({ error: "Failed to add section" });
  }
});

// Update section
router.put("/:courseId/sections/:sectionId", requireAuth, async (req, res) => {
  try {
    const { courseId, sectionId } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Section title is required" });
    }

    const course = await courseService.updateSection(
      courseId,
      sectionId,
      title
    );
    if (!course) {
      return res.status(404).json({ error: "Course or section not found" });
    }

    res.json(course);
  } catch (error) {
    console.error("Error updating section:", error);
    res.status(500).json({ error: "Failed to update section" });
  }
});

// Delete section
router.delete(
  "/:courseId/sections/:sectionId",
  requireAuth,
  async (req, res) => {
    try {
      const { courseId, sectionId } = req.params;

      const course = await courseService.deleteSection(courseId, sectionId);
      if (!course) {
        return res.status(404).json({ error: "Course or section not found" });
      }

      res.json(course);
    } catch (error) {
      console.error("Error deleting section:", error);
      res.status(500).json({ error: "Failed to delete section" });
    }
  }
);

// Reorder sections
router.post("/:courseId/sections/reorder", requireAuth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { sectionIds } = req.body;

    if (!sectionIds || !Array.isArray(sectionIds)) {
      return res.status(400).json({ error: "sectionIds array is required" });
    }

    const course = await courseService.reorderSections(courseId, sectionIds);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    res.json(course);
  } catch (error) {
    console.error("Error reordering sections:", error);
    res.status(500).json({ error: "Failed to reorder sections" });
  }
});

// ============== CHAPTER MANAGEMENT ==============

// Sanitize quiz data — strip empty-string ObjectId fields that Mongoose can't cast
function sanitizeQuizData(quiz: any): any {
  if (!quiz) return quiz;
  return {
    ...quiz,
    questions: (quiz.questions || []).map((q: any) => ({
      ...q,
      // Remove empty-string relatedChapterId — Mongoose expects a valid ObjectId or undefined
      relatedChapterId: q.relatedChapterId && q.relatedChapterId.trim() !== ""
        ? q.relatedChapterId
        : undefined,
    })),
  };
}

// Add chapter to section
router.post(
  "/:courseId/sections/:sectionId/chapters",
  requireAuth,
  async (req, res) => {
    try {
      const { courseId, sectionId } = req.params;
      const { title, contentType, videoUrl, videoS3Key, linkUrl, content, duration, quiz, pdfUrl, pdfS3Key, pdfs, jsonFiles } =
        req.body;

      if (!title) {
        return res.status(400).json({ error: "Chapter title is required" });
      }

      const course = await courseService.addChapter(courseId, sectionId, {
        title,
        contentType: contentType || "video",
        videoUrl,
        videoS3Key,
        linkUrl,
        content,
        duration,
        quiz: sanitizeQuizData(quiz),
        pdfUrl,
        pdfS3Key,
        pdfs,
        jsonFiles,
      });

      if (!course) {
        return res.status(404).json({ error: "Course or section not found" });
      }

      res.json(course);
    } catch (error) {
      console.error("Error adding chapter:", error);
      res.status(500).json({ error: "Failed to add chapter" });
    }
  }
);

// Update chapter
router.put(
  "/:courseId/sections/:sectionId/chapters/:chapterId",
  requireAuth,
  async (req, res) => {
    try {
      const { courseId, sectionId, chapterId } = req.params;
      const { title, contentType, videoUrl, videoS3Key, linkUrl, content, duration, quiz, pdfUrl, pdfS3Key, pdfs, jsonFiles } =
        req.body;

      const course = await courseService.updateChapter(
        courseId,
        sectionId,
        chapterId,
        {
          title,
          contentType,
          videoUrl,
          videoS3Key,
          linkUrl,
          content,
          duration,
          quiz: sanitizeQuizData(quiz),
          pdfUrl,
          pdfS3Key,
          pdfs,
          jsonFiles,
        }
      );

      if (!course) {
        return res
          .status(404)
          .json({ error: "Course, section, or chapter not found" });
      }

      res.json(course);
    } catch (error) {
      console.error("Error updating chapter:", error);
      res.status(500).json({ error: "Failed to update chapter" });
    }
  }
);

// Delete chapter
router.delete(
  "/:courseId/sections/:sectionId/chapters/:chapterId",
  requireAuth,
  async (req, res) => {
    try {
      const { courseId, sectionId, chapterId } = req.params;

      const course = await courseService.deleteChapter(
        courseId,
        sectionId,
        chapterId
      );
      if (!course) {
        return res
          .status(404)
          .json({ error: "Course, section, or chapter not found" });
      }

      res.json(course);
    } catch (error) {
      console.error("Error deleting chapter:", error);
      res.status(500).json({ error: "Failed to delete chapter" });
    }
  }
);

// Reorder chapters within a section
router.post(
  "/:courseId/sections/:sectionId/chapters/reorder",
  requireAuth,
  async (req, res) => {
    try {
      const { courseId, sectionId } = req.params;
      const { chapterIds } = req.body;

      if (!chapterIds || !Array.isArray(chapterIds)) {
        return res.status(400).json({ error: "chapterIds array is required" });
      }

      const course = await courseService.reorderChapters(
        courseId,
        sectionId,
        chapterIds
      );
      if (!course) {
        return res.status(404).json({ error: "Course or section not found" });
      }

      res.json(course);
    } catch (error) {
      console.error("Error reordering chapters:", error);
      res.status(500).json({ error: "Failed to reorder chapters" });
    }
  }
);

// ============== ENROLLMENT ==============

// Enroll in a course
router.post("/:courseId/enroll", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    // Use orgId from query params if provided, fallback to JWT
    const orgId = (req.query.orgId as string) || me.organizationId;
    const { courseId } = req.params;
    const { isPaid, amountPaid, currency, paymentId } = req.body;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    let enrollIsPaid = isPaid;
    let enrollAmountPaid = amountPaid;
    let enrollCurrency = currency;
    let enrollPaymentId = paymentId;

    if (course.isPaid) {
      // Check if user is founder
      const isFounder = await isUserFounder(me.userId, course.organizationId.toString());
      if (!isFounder) {
        return res.status(403).json({ error: "This is a paid course. Payment is required." });
      } else {
        // Founder gets free access
        enrollIsPaid = false;
        enrollAmountPaid = 0;
        enrollCurrency = course.currency || "USD";
        enrollPaymentId = undefined;
      }
    }

    const enrollment = await courseService.enrollInCourse({
      courseId,
      userId: me.userId,
      organizationId: orgId,
      isPaid: enrollIsPaid,
      amountPaid: enrollAmountPaid,
      currency: enrollCurrency,
      paymentId: enrollPaymentId,
    });

    res.status(201).json(enrollment);
  } catch (error: any) {
    console.error("Error enrolling in course:", error);
    if (error.message === "Already enrolled in this course") {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === "Course not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to enroll in course" });
  }
});

// Get enrollment status for a course
router.get("/:courseId/enrollment", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { courseId } = req.params;

    const enrollment = await courseService.getEnrollment(courseId, me.userId);
    res.json(enrollment);
  } catch (error) {
    console.error("Error fetching enrollment:", error);
    res.status(500).json({ error: "Failed to fetch enrollment" });
  }
});

// Get user's enrollments
router.get("/enrollments/me", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    // Use orgId from query params if provided, fallback to JWT
    const orgId = (req.query.orgId as string) || me.organizationId;

    const enrollments = await courseService.getUserEnrollments(
      me.userId,
      orgId
    );

    res.json(enrollments);
  } catch (error) {
    console.error("Error fetching enrollments:", error);
    res.status(500).json({ error: "Failed to fetch enrollments" });
  }
});

// ============== RAZORPAY PAYMENT ==============

/**
 * POST /:courseId/create-order
 * Create Razorpay order for course enrollment
 */
router.post("/:courseId/create-order", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const { courseId } = req.params;
    // Use orgId from query params if provided, fallback to JWT
    const orgId = (req.query.orgId as string) || me.organizationId;

    // Bulk-buy-to-assign flow — founder pays for N seats up-front and
    // assigns each one later via ReservesPanel. Fulfillment at
    // services/invoice.ts:2145-2170 keys off `quantity > 1` to mint
    // ItemReserveLicense rows instead of enrolling the buyer.
    const { quantity: rawQty, forReserve } = z
      .object({
        quantity: z.number().int().min(1).max(100).optional(),
        forReserve: z.boolean().optional(),
      })
      .parse(req.body || {});
    const quantity = Math.max(1, rawQty ?? 1);

    // Get course details
    const course = await Course.findOne({
      _id: new Types.ObjectId(courseId),
      organizationId: new Types.ObjectId(orgId),
      status: "published",
    }).lean();

    if (!course) {
      return res.status(404).json({
        success: false,
        error: "Course not found",
      });
    }

    if (!course.isPaid || course.price === 0) {
      return res.status(400).json({
        success: false,
        error: "This is a free course. Use /enroll endpoint instead.",
      });
    }

    // Check if already enrolled — skip for reserve purchases (the buyer
    // isn't enrolling themselves; they're stocking N seats to hand out).
    if (!forReserve && quantity === 1) {
      const existingEnrollment = await CourseEnrollment.findOne({
        courseId: new Types.ObjectId(courseId),
        userId: new Types.ObjectId(me.userId),
      }).lean();

      if (existingEnrollment) {
        return res.status(400).json({
          success: false,
          error: "Already enrolled in this course",
        });
      }
    }

    // Use discounted price if available
    const amount = course.price || 0;
    const unitPriceCents = Math.round(amount * 100);

    // ── GST math ────────────────────────────────────────────────────
    // Gated on the BUYER's location, not the course's currency: an Indian
    // buyer owes GST on a USD course, a foreign buyer never owes it on an
    // INR one. `gstInclusive` (asked of the founder for every course
    // regardless of currency) only decides whether the listed price already
    // contains the tax.
    const { applyGstToLine } = await import("../utils/gstTax");
    const { resolveBuyerGstRegion, gstSkippedMetadata } = await import(
      "../utils/gstBuyerRegion"
    );

    // In-app purchase — the buyer is the logged-in user, so their profile
    // country is the signal, falling back to the course currency.
    const gstRegion = await resolveBuyerGstRegion({
      buyerUserId: me.userId,
      paymentCurrency: course.currency || "USD",
    });

    const gstInclusive = !!(course as any).gstInclusive;
    // Per-unit here — this route multiplies by `quantity` at the order and
    // invoice layers below, so keep the line calc at quantity 1.
    const gstLine = applyGstToLine({
      listedAmountMinor: unitPriceCents,
      gstInclusive,
      buyerInIndia: gstRegion.inIndia,
    });
    const lineItemUnitPrice = gstLine.lineUnitPrice;
    const invoiceTaxCents = gstLine.taxTotal;
    const chargeAmountCents = gstLine.chargeTotal;
    const gstMetadata = gstLine.gstMetadata
      ? {
          ...gstLine.gstMetadata,
          buyerCountry: gstRegion.country,
          buyerRegion: "IN" as const,
          regionSource: gstRegion.source,
        }
      : undefined;
    const gstSkipped = gstLine.gstMetadata
      ? undefined
      : gstSkippedMetadata(gstRegion, "buyer_outside_india");

    // Receipt must be max 40 chars: cr_ (3) + last 12 of courseId + _ (1) + timestamp last 10 (10) = 26 chars
    const shortId = courseId.slice(-12);
    const shortTs = Date.now().toString().slice(-10);
    const order = await createOrder({
      amount: chargeAmountCents * quantity,
      currency: course.currency || "USD",
      receipt: `cr_${shortId}_${shortTs}`,
      notes: {
        courseId,
        courseTitle: course.title,
        userId: me.userId,
        orgId,
        type: "course_enrollment",
        quantity: String(quantity),
      },
    });

    // Create invoice
    let invoiceId: string | undefined;
    try {
      const { createInvoice } = require("../services/invoice");
      const userDoc = await User.findById(me.userId).select("email").lean();
      const invoice = await createInvoice({
        organizationId: orgId,
        sellerId: course.createdBy,
        userId: me.userId,
        customerEmail: userDoc?.email || "",
        lineItems: [{
          itemType: "course",
          itemId: courseId,
          itemName: course.title,
          itemDescription: `Course enrollment: ${course.title}`,
          quantity,
          unitPrice: lineItemUnitPrice,
          originalCurrency: course.currency || "USD",
        }],
        itemCurrency: course.currency || "USD",
        tax: invoiceTaxCents ? invoiceTaxCents * quantity : undefined,
        metadata: {
          type: "course_purchase",
          ...(gstMetadata
            ? { gst: { ...gstMetadata, amount: gstMetadata.amount * quantity } }
            : {}),
          ...(gstSkipped ? { gstSkipped } : {}),
          ...(quantity > 1 || forReserve
            ? { forReserve: true, reserveCount: quantity }
            : {}),
        },
      });
      invoiceId = invoice._id.toString();
    } catch (invoiceError) {
      console.error("[Course] Invoice creation error (non-blocking):", invoiceError);
    }

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      course: {
        id: courseId,
        title: course.title,
        price: course.price,
      },
      invoiceId,
    });
  } catch (error) {
    console.error("Error creating course order:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create order",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /:courseId/verify-payment
 * Verify payment and complete enrollment with commission distribution
 */
router.post("/:courseId/verify-payment", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const { courseId } = req.params;
    // Use orgId from query params if provided, fallback to JWT
    const orgId = (req.query.orgId as string) || me.organizationId;

    const schema = z.object({
      razorpayOrderId: z.string(),
      razorpayPaymentId: z.string(),
      razorpaySignature: z.string(),
    });
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      schema.parse(req.body);

    // Verify signature
    const isValid = verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: "Payment verification failed",
      });
    }

    // Get course details
    const course = await Course.findById(courseId).lean();
    if (!course) {
      return res.status(404).json({
        success: false,
        error: "Course not found",
      });
    }

    // Use discounted price if available, otherwise regular price
    const amount = course.price;

    // Enroll user in course
    const enrollment = await courseService.enrollInCourse({
      courseId,
      userId: me.userId,
      organizationId: orgId,
      isPaid: true,
      amountPaid: amount,
      currency: course.currency || "USD",
      paymentId: razorpayPaymentId,
    });

    // Distribute commissions if amount > 0
    if (amount && amount > 0) {
      try {
        await distributeCommissions({
          orgId,
          sellerId: course.createdBy.toString(),
          customerId: me.userId,
          itemType: "course",
          itemId: courseId,
          itemName: course.title,
          saleAmount: getCommissionBase(
            amount,
            course as any,
            await isBuyerInIndia(me.userId, course.currency || "USD")
          ),
          currency: course.currency || "USD",
          paymentId: razorpayPaymentId,
        });
      } catch (commissionError) {
        // Log but don't fail the enrollment
        console.error("Error distributing commissions for course:", commissionError);
      }
    }

    res.json({
      success: true,
      message: "Payment verified and enrollment completed",
      enrollment,
    });
  } catch (error: any) {
    console.error("Error verifying course payment:", error);
    if (error.message === "Already enrolled in this course") {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    res.status(500).json({
      success: false,
      error: "Failed to verify payment",
      details: (error as Error).message,
    });
  }
});

// ============== SUBSCRIPTION ENDPOINTS ==============

/**
 * POST /:courseId/create-subscription
 * Create Razorpay subscription for recurring course access
 */
router.post("/:courseId/create-subscription", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const { courseId } = req.params;
    const orgId = (req.query.orgId as string) || me.organizationId;

    // Get course details
    const course = await Course.findById(courseId).lean();
    if (!course) {
      return res.status(404).json({
        success: false,
        error: "Course not found",
      });
    }

    if (course.isFree || !course.price || course.price === 0) {
      return res.status(400).json({
        success: false,
        error: "This is a free course. Use /enroll endpoint instead.",
      });
    }

    if (!course.isSubscription) {
      return res.status(400).json({
        success: false,
        error: "This is not a subscription course. Use /create-order endpoint instead.",
      });
    }

    // Check if user already has an active subscription
    const existingAccess = await hasSubscriptionAccess(me.userId, "course", courseId);
    if (existingAccess) {
      return res.status(400).json({
        success: false,
        error: "You already have an active subscription to this course",
      });
    }

    // Check for existing enrollment too
    const existingEnrollment = await CourseEnrollment.findOne({
      courseId,
      userId: me.userId,
      status: { $in: ["enrolled", "completed"] },
    });
    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        error: "You are already enrolled in this course",
      });
    }

    // Get or create subscription plan
    let plan = await getSubscriptionPlanForItem("course", courseId);

    if (!plan) {
      // Auto-create plan if it doesn't exist
      const amount = (course.price) * 100; // Convert to paise
      plan = await createSubscriptionPlan({
        itemType: "course",
        itemId: courseId,
        orgId,
        sellerId: course.createdBy.toString(),
        name: `${course.title} - ${course.subscriptionPeriod || "monthly"} subscription`,
        description: course.description || undefined,
        amount,
        currency: course.currency || "USD",
        period: course.subscriptionPeriod || "monthly",
      });
    }

    if (!plan || !plan.isActive) {
      return res.status(400).json({
        success: false,
        error: "No active subscription plan available for this course",
      });
    }

    // Create subscription for user
    const subscription = await createUserSubscription({
      planId: plan._id.toString(),
      userId: me.userId,
      orgId,
    });

    res.json({
      success: true,
      subscription: {
        id: subscription._id,
        razorpaySubscriptionId: subscription.razorpaySubscriptionId,
        shortUrl: subscription.shortUrl,
        status: subscription.status,
      },
      plan: {
        id: plan._id,
        name: plan.name,
        amount: plan.amount,
        currency: plan.currency,
        period: plan.period,
      },
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Error creating course subscription:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create subscription",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /:courseId/subscription-status
 * Check user's subscription status for a course
 */
router.get("/:courseId/subscription-status", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { courseId } = req.params;

    // Check subscription access
    const hasAccess = await hasSubscriptionAccess(me.userId, "course", courseId);
    const activeSubscription = await getUserActiveSubscription(me.userId, "course", courseId);

    // Also check course enrollment (for one-time purchases)
    const enrollment = await CourseEnrollment.findOne({
      userId: me.userId,
      courseId,
      status: { $in: ["enrolled", "completed"] },
    }).lean();

    res.json({
      success: true,
      hasAccess: hasAccess || !!enrollment,
      subscription: activeSubscription ? {
        id: activeSubscription._id,
        status: activeSubscription.status,
        currentEnd: activeSubscription.currentEnd,
        paidCount: activeSubscription.paidCount,
      } : null,
      enrollment: enrollment ? {
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        isPaid: enrollment.isPaid,
      } : null,
    });
  } catch (error) {
    console.error("Error checking course subscription status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check subscription status",
    });
  }
});

// ============== PROGRESS TRACKING ==============

// Mark chapter as complete
router.post(
  "/:courseId/chapters/:chapterId/complete",
  requireAuth,
  async (req, res) => {
    try {
      const me = (req as any).user as { userId: string };
      const { courseId, chapterId } = req.params;
      const { sectionId } = req.body;

      if (!sectionId) {
        return res.status(400).json({ error: "sectionId is required" });
      }

      const enrollment = await courseService.markChapterComplete(
        courseId,
        me.userId,
        sectionId,
        chapterId
      );

      if (!enrollment) {
        return res.status(404).json({ error: "Enrollment not found" });
      }

      res.json(enrollment);
    } catch (error) {
      console.error("Error marking chapter complete:", error);
      res.status(500).json({ error: "Failed to mark chapter complete" });
    }
  }
);

// Mark chapter as incomplete
router.post(
  "/:courseId/chapters/:chapterId/incomplete",
  requireAuth,
  async (req, res) => {
    try {
      const me = (req as any).user as { userId: string };
      const { courseId, chapterId } = req.params;

      const enrollment = await courseService.markChapterIncomplete(
        courseId,
        me.userId,
        chapterId
      );

      if (!enrollment) {
        return res.status(404).json({ error: "Enrollment not found" });
      }

      res.json(enrollment);
    } catch (error) {
      console.error("Error marking chapter incomplete:", error);
      res.status(500).json({ error: "Failed to mark chapter incomplete" });
    }
  }
);

// Update chapter progress (for video position tracking)
router.post(
  "/:courseId/chapters/:chapterId/progress",
  requireAuth,
  async (req, res) => {
    try {
      const me = (req as any).user as { userId: string };
      const { courseId, chapterId } = req.params;
      const { sectionId, watchTime, lastPosition } = req.body;

      if (!sectionId) {
        return res.status(400).json({ error: "sectionId is required" });
      }

      const enrollment = await courseService.updateChapterProgress(
        courseId,
        me.userId,
        sectionId,
        chapterId,
        watchTime || 0,
        lastPosition || 0
      );

      if (!enrollment) {
        return res.status(404).json({ error: "Enrollment not found" });
      }

      res.json(enrollment);
    } catch (error) {
      console.error("Error updating chapter progress:", error);
      res.status(500).json({ error: "Failed to update chapter progress" });
    }
  }
);

// ============== DIGITAL ASSETS ==============

// Add digital asset to course
router.post("/:courseId/assets", requireAuth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { name, url, fileType, fileSize } = req.body;

    if (!name || !url || !fileType) {
      return res
        .status(400)
        .json({ error: "name, url, and fileType are required" });
    }

    const course = await courseService.addDigitalAsset(courseId, {
      name,
      url,
      fileType,
      fileSize,
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    res.json(course);
  } catch (error) {
    console.error("Error adding digital asset:", error);
    res.status(500).json({ error: "Failed to add digital asset" });
  }
});

// Remove digital asset from course
router.delete("/:courseId/assets/:assetId", requireAuth, async (req, res) => {
  try {
    const { courseId, assetId } = req.params;

    const course = await courseService.removeDigitalAsset(courseId, assetId);
    if (!course) {
      return res.status(404).json({ error: "Course or asset not found" });
    }

    res.json(course);
  } catch (error) {
    console.error("Error removing digital asset:", error);
    res.status(500).json({ error: "Failed to remove digital asset" });
  }
});

// ============== STATS ==============

// Get course stats (for founders)
router.get("/:courseId/stats", requireAuth, async (req, res) => {
  try {
    const { courseId } = req.params;

    const stats = await courseService.getCourseStats(courseId);
    res.json(stats);
  } catch (error) {
    console.error("Error fetching course stats:", error);
    res.status(500).json({ error: "Failed to fetch course stats" });
  }
});

// ============== QUIZ ==============

// Submit quiz attempt
router.post("/:courseId/quiz/:chapterId/submit", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { courseId, chapterId } = req.params;
    const { sectionId, answers } = req.body;

    if (!sectionId) {
      return res.status(400).json({ error: "sectionId is required" });
    }
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: "answers array is required" });
    }

    const result = await courseService.submitQuizAttempt(
      courseId,
      me.userId,
      sectionId,
      chapterId,
      answers
    );

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Error submitting quiz:", error);
    if (error.message === "Enrollment not found") {
      return res.status(400).json({ error: "You must be enrolled in this course" });
    }
    res.status(500).json({ error: "Failed to submit quiz", details: error.message });
  }
});

// Get quiz analytics (founder only)
router.get("/:courseId/quiz-analytics", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const { courseId } = req.params;
    const orgId = (req.query.orgId as string) || me.organizationId;

    // Check if user is founder
    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({ error: "Only founders can view quiz analytics" });
    }

    const analytics = await courseService.getQuizAnalytics(courseId);
    res.json({ success: true, ...analytics });
  } catch (error) {
    console.error("Error fetching quiz analytics:", error);
    res.status(500).json({ error: "Failed to fetch quiz analytics" });
  }
});

export default router;

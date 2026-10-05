// src/models/courseEnrollment.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";

// Chapter progress interface
export interface IChapterProgress {
  chapterId: Types.ObjectId;
  sectionId: Types.ObjectId;
  completed: boolean;
  completedAt?: Date;
  watchTime?: number; // Time spent in seconds (for videos)
  lastPosition?: number; // Last video position in seconds
}

// Quiz attempt answer
export interface IQuizAttemptAnswer {
  questionId: string;
  selectedOptions: number[]; // Indices of selected options
  isCorrect: boolean;
}

// Quiz attempt
export interface IQuizAttempt {
  chapterId: Types.ObjectId;
  sectionId: Types.ObjectId;
  attemptNumber: number;
  score: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  answers: IQuizAttemptAnswer[];
  completedAt: Date;
}

// Course Enrollment interface
export interface ICourseEnrollment extends Document {
  _id: Types.ObjectId;
  courseId: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;

  // Enrollment status
  status: "enrolled" | "completed" | "dropped";
  enrolledAt: Date;
  completedAt?: Date;

  // Payment (if paid course)
  isPaid: boolean;
  amountPaid?: number;
  currency?: string;
  paymentId?: string;
  paymentStatus?: "pending" | "completed" | "failed" | "refunded";
  invoiceShortUrl?: string; // Public URL for Razorpay invoice

  // Progress tracking
  chaptersProgress: IChapterProgress[];
  completedChapters: number;
  totalChapters: number;
  progressPercentage: number;

  // Last activity
  lastAccessedAt: Date;
  lastChapterId?: Types.ObjectId;
  lastSectionId?: Types.ObjectId;

  // Quiz attempts
  quizAttempts: IQuizAttempt[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const ChapterProgressSchema = new Schema<IChapterProgress>(
  {
    chapterId: { type: Schema.Types.ObjectId, required: true },
    sectionId: { type: Schema.Types.ObjectId, required: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    watchTime: { type: Number, default: 0 },
    lastPosition: { type: Number, default: 0 },
  },
  { _id: false }
);

const QuizAttemptAnswerSchema = new Schema(
  {
    questionId: { type: String, required: true },
    selectedOptions: [{ type: Number }],
    isCorrect: { type: Boolean, required: true },
  },
  { _id: false }
);

const QuizAttemptSchema = new Schema(
  {
    chapterId: { type: Schema.Types.ObjectId, required: true },
    sectionId: { type: Schema.Types.ObjectId, required: true },
    attemptNumber: { type: Number, required: true },
    score: { type: Number, required: true },
    totalPoints: { type: Number, required: true },
    percentage: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    answers: [QuizAttemptAnswerSchema],
    completedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CourseEnrollmentSchema = new Schema<ICourseEnrollment>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    // Enrollment status
    status: {
      type: String,
      enum: ["enrolled", "completed", "dropped"],
      default: "enrolled",
    },
    enrolledAt: { type: Date, default: Date.now },
    completedAt: { type: Date },

    // Payment
    isPaid: { type: Boolean, default: false },
    amountPaid: { type: Number },
    currency: { type: String },
    paymentId: { type: String },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
    },
    invoiceShortUrl: { type: String },

    // Progress tracking
    chaptersProgress: [ChapterProgressSchema],
    completedChapters: { type: Number, default: 0 },
    totalChapters: { type: Number, default: 0 },
    progressPercentage: { type: Number, default: 0 },

    // Last activity
    lastAccessedAt: { type: Date, default: Date.now },
    lastChapterId: { type: Schema.Types.ObjectId },
    lastSectionId: { type: Schema.Types.ObjectId },

    // Quiz attempts
    quizAttempts: { type: [QuizAttemptSchema], default: [] },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique enrollment per user per course
CourseEnrollmentSchema.index({ courseId: 1, userId: 1 }, { unique: true });

// Index for querying user's enrollments
CourseEnrollmentSchema.index({ userId: 1, organizationId: 1, status: 1 });

// Index for querying course enrollments
CourseEnrollmentSchema.index({ courseId: 1, status: 1 });

// Pre-save hook to calculate progress percentage
CourseEnrollmentSchema.pre("save", function (next) {
  if (this.totalChapters > 0) {
    // Clamp completedChapters so it never exceeds totalChapters
    if (this.completedChapters > this.totalChapters) {
      this.completedChapters = this.totalChapters;
    }

    this.progressPercentage = Math.min(
      100,
      Math.round((this.completedChapters / this.totalChapters) * 100)
    );

    // Mark as completed if all chapters are done
    if (
      this.completedChapters >= this.totalChapters &&
      this.status !== "completed"
    ) {
      this.status = "completed";
      this.completedAt = new Date();
    }
  } else {
    this.progressPercentage = 0;
  }

  next();
});

export const CourseEnrollment = mongoose.model<ICourseEnrollment>(
  "CourseEnrollment",
  CourseEnrollmentSchema
);

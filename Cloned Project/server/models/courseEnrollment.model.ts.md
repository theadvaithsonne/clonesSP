# `server/models/courseEnrollment.model.ts`

> Mongoose model for a user's enrolment in a course, holding payment info, per-chapter progress, resume position and quiz attempts.

**Kind:** Mongoose model · **Lines:** 210

## Purpose
When a user enrols in a `Course` (free, or after paying at checkout), one `CourseEnrollment` row is created for that user and course. It drives the learning player (which chapter to resume, which are done, quiz results), the "my courses" lists, founder-side student lists, and access checks in other services such as playlists, reviews, wallet and downline purchase reports.

## How it works
- **Links:** `courseId` (ref `Course`), `userId` (ref `User`), `organizationId` (ref `Organization`); all required and indexed.
- **Status:** `enrolled` (default), `completed`, `dropped`; `enrolledAt` (default now), `completedAt`.
- **Payment:** `isPaid` (default false), `amountPaid`, `currency`, `paymentId`, `paymentStatus` (`pending`, `completed`, `failed`, `refunded`), `invoiceShortUrl` (public Razorpay invoice URL).
- **Progress:** `chaptersProgress[]` (no `_id`; each has `chapterId`, `sectionId`, `completed`, `completedAt`, `watchTime` seconds, `lastPosition` seconds for video resume), plus `completedChapters`, `totalChapters`, `progressPercentage`.
- **Resume:** `lastAccessedAt`, `lastChapterId`, `lastSectionId`.
- **Quizzes:** `quizAttempts[]` (default `[]`; each has `chapterId`, `sectionId`, `attemptNumber`, `score`, `totalPoints`, `percentage`, `passed`, `answers[]` of `{questionId, selectedOptions (option indices), isCorrect}`, `completedAt`).
- `timestamps: true`.

**`pre("save")` hook:** when `totalChapters > 0`, it clamps `completedChapters` to `totalChapters`, sets `progressPercentage = min(100, round(completed / total x 100))`, and, once every chapter is done, flips `status` to `completed` and stamps `completedAt`. With `totalChapters` 0 the percentage is 0.

**Indexes:** unique `{courseId, userId}` (one enrolment per user per course), `{userId, organizationId, status}` (a user's courses in an org), `{courseId, status}` (a course's students), plus single-field indexes on the three links.

## Exports
- `CourseEnrollment` - Mongoose model (`"CourseEnrollment"`, collection `courseenrollments`).
- `ICourseEnrollment` - document interface.
- `IChapterProgress`, `IQuizAttempt`, `IQuizAttemptAnswer` - sub-document interfaces.

## Interfaces
- **Database:** `CourseEnrollment` (collection `courseenrollments`) - read/write.
- **External services:** stores Razorpay payment id and invoice short URL.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/routes/course.ts` (mounted at `/courses`, browser `/backend/courses`), `server/routes/learnInit.ts` (`/learn`), `server/routes/public.ts` (`/public`), `server/routes/unifiedOrders.ts`, `server/services/course.ts`, `server/services/downlineMemberPurchases.ts`, `server/services/itemReserveLicense.ts`, `server/services/playlist.ts`, `server/services/review.ts`, `server/services/wallet.ts`.

## Notes
- The progress percentage and auto-completion only run on `document.save()`; `updateOne` / `findOneAndUpdate` bypass them.
- Once an enrolment is `completed`, the hook never reverts it, so if the founder later adds chapters (raising `totalChapters`) the status stays `completed` while the percentage drops.
- `totalChapters` is a copy taken from the course; it must be refreshed by the service when the curriculum changes.

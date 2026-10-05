# `server/services/course.ts`

> Module exporting `createCourse`, `getCourseById`, `getCoursesByOrganization`, `getPublishedCourses` and 22 more.

**Kind:** backend service · **Lines:** 1272

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `createCourse` | function | `async createCourse(data: { title: string; description?: string; coverImage?: s…): Promise<ICourse>` | 24 |
| `getCourseById` | function | `async getCourseById(courseId: string): Promise<ICourse \| null>` | 123 |
| `getCoursesByOrganization` | function | `async getCoursesByOrganization(organizationId: string, options?: { status?: "draft" \| "published" \| "archived"; cr…): Promise<ICourse[]>` | 130 |
| `getPublishedCourses` | function | `async getPublishedCourses(organizationId: string, userChannelIds?: string[]): Promise<ICourse[]>` | 164 |
| `updateCourse` | function | `async updateCourse(courseId: string, data: Partial<{ title: string; description: string; coverIm…): Promise<ICourse \| null>` | 193 |
| `deleteCourse` | function | `async deleteCourse(courseId: string): Promise<boolean>` | 282 |
| `addSection` | function | `async addSection(courseId: string, title: string): Promise<ICourse \| null>` | 294 |
| `updateSection` | function | `async updateSection(courseId: string, sectionId: string, title: string): Promise<ICourse \| null>` | 316 |
| `deleteSection` | function | `async deleteSection(courseId: string, sectionId: string): Promise<ICourse \| null>` | 328 |
| `reorderSections` | function | `async reorderSections(courseId: string, sectionIds: string[]): Promise<ICourse \| null>` | 339 |
| `addChapter` | function | `async addChapter(courseId: string, sectionId: string, chapterData: { title: string; contentType: "video" \| "link"…): Promise<ICourse \| null>` | 368 |
| `updateChapter` | function | `async updateChapter(courseId: string, sectionId: string, chapterId: string, chapterData: Partial<{ title: string; contentType: "video" …): Promise<ICourse \| null>` | 419 |
| `deleteChapter` | function | `async deleteChapter(courseId: string, sectionId: string, chapterId: string): Promise<ICourse \| null>` | 469 |
| `reorderChapters` | function | `async reorderChapters(courseId: string, sectionId: string, chapterIds: string[]): Promise<ICourse \| null>` | 489 |
| `enrollInCourse` | function | `async enrollInCourse(data: { courseId: string; userId: string; organizationId: s…): Promise<ICourseEnrollment>` | 524 |
| `getEnrollment` | function | `async getEnrollment(courseId: string, userId: string): Promise<ICourseEnrollment \| null>` | 647 |
| `getUserEnrollments` | function | `async getUserEnrollments(userId: string, organizationId: string): Promise<ICourseEnrollment[]>` | 657 |
| `markChapterComplete` | function | `async markChapterComplete(courseId: string, userId: string, sectionId: string, chapterId: string): Promise<ICourseEnrollment \| null>` | 674 |
| `markChapterIncomplete` | function | `async markChapterIncomplete(courseId: string, userId: string, chapterId: string): Promise<ICourseEnrollment \| null>` | 721 |
| `updateChapterProgress` | function | `async updateChapterProgress(courseId: string, userId: string, sectionId: string, chapterId: string, watchTime: number, lastPosition: number): Promise<ICourseEnrollment \| null>` | 758 |
| `addDigitalAsset` | function | `async addDigitalAsset(courseId: string, asset: { name: string; url: string; fileType: string; fileS…): Promise<ICourse \| null>` | 799 |
| `removeDigitalAsset` | function | `async removeDigitalAsset(courseId: string, assetId: string): Promise<ICourse \| null>` | 822 |
| `getCourseStats` | function | `async getCourseStats(courseId: string): Promise<{ totalEnrollments: number; completedCoun…` | 835 |
| `submitQuizAttempt` | function | `async submitQuizAttempt(courseId: string, userId: string, sectionId: string, chapterId: string, answers: { questionId: string; selectedOptions: number[] }[]): Promise<{ score: number; total…` | 863 |
| `getQuizAnalytics` | function | `async getQuizAnalytics(courseId: string): Promise<{ quizzes: { chapterId: string; chapterTi…` | 1022 |
| `cloneCourse` | function | `async cloneCourse(courseId: string, createdBy: string): Promise<ICourse>` | 1121 |

## Interfaces

- **Database (Mongoose models used):**
  - `Course` (server/models/course.model.ts) — reads: `findById`, `find`; **writes:** `new + save`, `findByIdAndUpdate`, `findByIdAndDelete`, `findOneAndUpdate`
  - `CourseEnrollment` (server/models/courseEnrollment.model.ts) — reads: `findOne`, `find`; **writes:** `deleteMany`, `new + save`

## Dependencies

- **Internal:**
  - `server/models/course.model.ts` — `Course`, `ICourse`, `ISection`, `IChapter`, `ICourseInclude`, `ICourseReview`, `IQuiz`
  - `server/models/courseEnrollment.model.ts` — `CourseEnrollment`, `ICourseEnrollment`
  - `server/models/emailAlerts.schema.ts` — `normalizeEmailAlerts`, `EmailAlertsInput`
  - `server/models/founderAlerts.schema.ts` — `normalizeFounderAlerts`, `FounderAlertsInput`
  - `server/services/thankYouPage.ts` — `normalizeThankYouPage`, `ThankYouPageInput`
  - `server/services/commission.ts` — `distributeCommissions`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/course.ts`
- `server/routes/courseCheckout.ts`
- `server/services/invoice.ts`

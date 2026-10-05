// app/api/uploadthing/core.ts
import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  // Organization icon upload
  organizationIcon: f({ image: { maxFileSize: "2MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      // Add any auth logic here if needed
      return { userId: "anonymous" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Organization icon uploaded:", file.url);
      return { uploadedBy: metadata.userId };
    }),

  // Organization cover photo upload
  organizationCover: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      // Add any auth logic here if needed
      return { userId: "anonymous" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Organization cover uploaded:", file.url);
      return { uploadedBy: metadata.userId };
    }),

  // Profile picture upload
  profilePicture: f({ image: { maxFileSize: "2MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      // Add any auth logic here if needed
      return { userId: "anonymous" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Profile picture uploaded:", file.url);
      return { uploadedBy: metadata.userId };
    }),

  // Post images upload (for revenue network feeds)
  postImages: f({ image: { maxFileSize: "8MB", maxFileCount: 10 } })
    .middleware(async ({ req }) => {
      return { userId: "anonymous" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Post image uploaded:", file.url);
      return { uploadedBy: metadata.userId, url: file.url };
    }),

  // Post videos upload
  postVideos: f({ video: { maxFileSize: "32MB", maxFileCount: 5 } })
    .middleware(async ({ req }) => {
      return { userId: "anonymous" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Post video uploaded:", file.url);
      return { uploadedBy: metadata.userId, url: file.url };
    }),

  // Post documents upload
  postDocuments: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 5 },
    text: { maxFileSize: "16MB", maxFileCount: 5 },
    blob: { maxFileSize: "16MB", maxFileCount: 5 },
  })
    .middleware(async ({ req }) => {
      return { userId: "anonymous" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Post document uploaded:", file.url);
      return { uploadedBy: metadata.userId, url: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;

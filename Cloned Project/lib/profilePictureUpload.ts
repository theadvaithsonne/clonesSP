// lib/profilePictureUpload.ts
//
// Direct-to-S3 upload helper for profile pictures.
//
// Uses the public (unauthenticated) POST /uploads/public route on our
// backend — same endpoint the onboarding org-logo flow uses. Auth is
// intentionally not required here because a common failure mode was:
// user's 7-day JWT expires, they open ProfilePopover to change their
// photo, the authenticated /profile/presigned-upload rejects them with
// 401 ("Invalid token"), and they have no clear signal to re-login.
// Making this anonymous side-steps that entirely — the trade-off is
// that S3 objects land under `public-onboarding/…` with no user
// attribution instead of `profile-pictures/{userId}/…`. Acceptable
// because the profile update PUT that follows this call carries the
// bearer token and attributes the URL to the user in Mongo anyway.
//
// Legacy profile pictures stored on UploadThing / old S3 paths are
// untouched — `User.profilePicture` is just a URL string, wherever
// it points renders as-is.

import { API_URL } from "@/lib/api";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB — matches BE /uploads/public cap

/**
 * Upload a profile picture to S3 (via the public backend route) and
 * return the public URL to save on the user's profile. Throws with a
 * friendly message when the file is too large / wrong type / network
 * fails.
 */
export async function uploadProfilePictureToS3(file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File size must be less than 5MB");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/uploads/public`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.hint || "Upload failed");
  }
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error("Upload returned no URL");
  return data.url;
}

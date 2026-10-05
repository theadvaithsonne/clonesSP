// lib/uploadthing.ts
//
// Drop-in replacement for UploadThing react helpers.
// Redirects all uploads to our first-party authenticated /upload S3 endpoint
// on the backend, or /uploads/public for unauthenticated onboarding uploads.
// This preserves backwards compatibility with existing UI components without
// relying on third-party UploadThing services.

import { useState, useCallback } from "react";
import { getToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Helper function to upload files to backend S3 endpoint /upload
async function uploadToBackendS3(file: File): Promise<{ url: string; key: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Upload failed with status ${response.status}`);
  }

  const data = await response.json();
  return {
    url: data.url,
    key: data.key || data.fileKey,
  };
}

export function useUploadThing(endpoint: string) {
  const [isUploading, setIsUploading] = useState(false);

  const startUpload = useCallback(async (files: File[]) => {
    setIsUploading(true);
    try {
      const results = [];
      for (const file of files) {
        const res = await uploadToBackendS3(file);
        results.push({
          url: res.url,
          key: res.key,
          name: file.name,
          size: file.size,
        });
      }
      return results;
    } catch (error) {
      console.error(`[useUploadThing] Error uploading to endpoint ${endpoint}:`, error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [endpoint]);

  return {
    startUpload,
    isUploading,
    permittedFileInfo: null,
  };
}

export async function uploadFiles(
  endpoint: string,
  options: { files: File[] }
) {
  const { files } = options;
  const results = [];
  for (const file of files) {
    const res = await uploadToBackendS3(file);
    results.push({
      url: res.url,
      key: res.key,
      name: file.name,
      size: file.size,
    });
  }
  return results;
}

// Decorative components to prevent import errors in legacy files
export const UploadButton = () => null;
export const UploadDropzone = () => null;

// Upload function for organization icons and cover photos (onboarding flow)
export async function uploadToUploadThing(
  file: File,
  type: "icon" | "coverPhoto"
): Promise<string> {
  console.log(`[uploadToUploadThing] Redirecting unauthenticated ${type} upload to S3 public endpoint`);
  
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/uploads/public`, {
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

export async function deleteFromUploadThing(fileKey: string): Promise<void> {
  console.log("[deleteFromUploadThing] Legacy file deletion skipped for key:", fileKey);
}

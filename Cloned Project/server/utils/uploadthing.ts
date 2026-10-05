// src/utils/uploadthing.ts
import { env } from "../config/env";

export interface UploadThingResponse {
  url: string;
  key: string;
  name: string;
  size: number;
}

export async function uploadToUploadThing(
  file: Buffer | string,
  fileName: string,
  fileType: string
): Promise<UploadThingResponse> {
  const formData = new FormData();

  // Convert buffer to blob if needed
  const blob =
    file instanceof Buffer
      ? new Blob([new Uint8Array(file)], { type: fileType })
      : new Blob([file as string], { type: fileType });

  formData.append("file", blob, fileName);

  const response = await fetch("https://api.uploadthing.com/api/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.UPLOADTHING_SECRET}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`UploadThing upload failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result;
}

export async function deleteFromUploadThing(fileKey: string): Promise<void> {
  const response = await fetch("https://api.uploadthing.com/api/delete", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${env.UPLOADTHING_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileKey }),
  });

  if (!response.ok) {
    throw new Error(`UploadThing delete failed: ${response.statusText}`);
  }
}

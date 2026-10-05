import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

export interface UploadedFile {
  url: string;
  key?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
}

/**
 * Uploads a single file via Garage's `/upload` endpoint and returns the public URL.
 * Used by every Coverfi form that takes an image / document.
 */
export async function uploadFile(file: File): Promise<UploadedFile> {
  const auth = getToken();
  if (!auth) throw new Error("Not authenticated");

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: fd,
    headers: { Authorization: `Bearer ${auth}` },
    cache: "no-store",
  });

  if (!res.ok) {
    let msg = `Upload failed (${res.status})`;
    try {
      const j = await res.json();
      msg = j.error || j.message || msg;
    } catch {
      /* not json */
    }
    throw new Error(msg);
  }

  const data: UploadedFile = await res.json();
  if (!data.url) throw new Error("Upload response missing url");
  return data;
}

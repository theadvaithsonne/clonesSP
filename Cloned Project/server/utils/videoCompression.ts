import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

/**
 * Compresses a video file using ffmpeg
 * @param inputBuffer - The video file buffer
 * @param mimeType - The MIME type of the video
 * @returns Compressed video buffer and new MIME type
 */
export async function compressVideo(
  inputBuffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  // Check if input is a video
  if (!mimeType.startsWith("video/")) {
    // Not a video, return original
    return { buffer: inputBuffer, mimeType };
  }

  // Create temporary files
  const inputExt = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "mp4" : "webm";
  const outputExt = "webm"; // Always compress to webm for best compression
  
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `input-${Date.now()}-${Math.random().toString(36).slice(2)}.${inputExt}`);
  const outputPath = path.join(tmpDir, `output-${Date.now()}-${Math.random().toString(36).slice(2)}.${outputExt}`);

  try {
    // Write input buffer to temp file
    await fs.writeFile(inputPath, inputBuffer);

    // Compress video using ffmpeg
    // Using VP9 codec with CRF 30 for good compression/quality balance
    // Scale to max 1920x1080 if larger
    const ffmpegCommand = `ffmpeg -i "${inputPath}" -c:v libvpx-vp9 -crf 30 -b:v 0 -c:a libopus -b:a 128k -vf "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease" -movflags +faststart -f webm -y "${outputPath}"`;
    
    try {
      await execAsync(ffmpegCommand, { timeout: 300000 }); // 5 minute timeout
      
      // Read compressed file
      const compressedBuffer = await fs.readFile(outputPath);
      
      // Only use compressed version if it's smaller
      if (compressedBuffer.length < inputBuffer.length) {
        return { buffer: compressedBuffer, mimeType: "video/webm" };
      } else {
        // If compression didn't reduce size, return original
        return { buffer: inputBuffer, mimeType };
      }
    } catch (ffmpegError: any) {
      // If ffmpeg fails (not installed or error), return original
      console.warn("FFmpeg compression failed, using original file:", ffmpegError.message);
      return { buffer: inputBuffer, mimeType };
    }
  } finally {
    // Cleanup temp files
    try {
      await fs.unlink(inputPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Check if ffmpeg is available on the system
 */
export async function isFfmpegAvailable(): Promise<boolean> {
  try {
    await execAsync("ffmpeg -version", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}


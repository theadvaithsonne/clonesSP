/**
 * Recording start time, derived from the S3 key.
 *
 * Keys look like `webinar-recordings/<workshopId>/2026-08-15T142835.mp4`,
 * where the timestamp is when the egress STARTED. The file document's
 * `createdAt` is when the upload finished — on a two-hour stream those are
 * two hours apart, which is useless for lining chat up against playback.
 *
 * Shared by the authed recordings list and the public single-recording
 * lookup: both anchor the watch page's chat and pin replays, so they have to
 * agree on where zero is.
 */
export function recordingStartedAt(s3Key: string, fallback: Date): Date {
  const m = /(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(s3Key || "");
  if (!m) return fallback;
  const [, y, mo, d, h, mi, sec] = m;
  const parsed = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

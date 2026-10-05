export const isAskSupported = (mimeType: string) => {
  if (!mimeType) return false;
  if (mimeType.startsWith("video/")) return true;
  // Broad support for common video containers sometimes mislabeled
  const videoHints = [
    "x-matroska", // mkv
    "quicktime", // mov
    "x-msvideo", // avi
    "x-ms-wmv", // wmv
    "x-flv", // flv
    "mp2t", // ts
    "3gpp", // 3gp
    "3gpp2", // 3g2
    "webm",
    "mp4",
    "mpeg",
    "m4v",
    "ogg", // ogv can be labeled application/ogg in some cases
    "mxf",
    "x-mpegurl", // m3u8
    "vnd.apple.mpegurl", // m3u8
    "dash+xml", // mpd
  ];
  if (videoHints.some((hint) => mimeType.toLowerCase().includes(hint))) {
    return true;
  }
  if (mimeType === "application/pdf" || mimeType.includes("pdf")) return true;
  return false;
};

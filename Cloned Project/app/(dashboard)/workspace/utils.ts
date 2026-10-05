// roam/roam-frontend/app/(dashboard)/workspace/utils.ts

export const isScreenTrack = (track: MediaStreamTrack) => {
  if (track.kind !== "video") return false;
  const settings =
    typeof track.getSettings === "function" ? track.getSettings() : {};
  const displaySurface = (settings as MediaTrackSettings).displaySurface;
  const label = track.label?.toLowerCase?.() ?? "";
  return (
    !!displaySurface || label.includes("screen") || label.includes("display")
  );
};

export const isLiveCameraTrack = (track: MediaStreamTrack) =>
  track.kind === "video" &&
  track.readyState === "live" &&
  track.enabled &&
  !track.muted &&
  !isScreenTrack(track);

export const getActiveScreenTrack = (stream?: MediaStream | null) =>
  stream
    ?.getVideoTracks()
    .find(
      (track) =>
        isScreenTrack(track) &&
        track.readyState === "live" &&
        !track.muted &&
        track.enabled !== false
    ) || null;

export const getActiveCameraTrack = (stream?: MediaStream | null) =>
  stream?.getVideoTracks().find(isLiveCameraTrack) || null;

export const buildSingleTrackStream = (track?: MediaStreamTrack | null) => {
  if (!track) return null;
  const mediaStream = new MediaStream();
  mediaStream.addTrack(track);
  return mediaStream;
};

export const getPreferredScreenTrack = (
  stream?: MediaStream | null,
  assumeScreenShare?: boolean
) => {
  const detectedTrack = getActiveScreenTrack(stream);
  if (detectedTrack) {
    return detectedTrack;
  }

  if (assumeScreenShare && stream) {
    return (
      stream
        .getVideoTracks()
        .find(
          (track) =>
            track.readyState === "live" &&
            track.kind === "video" &&
            !track.muted
        ) || null
    );
  }

  return null;
};

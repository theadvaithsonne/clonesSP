import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

/**
 * Lazy local-media container for the workspace.
 *
 * Previously this hook called `getUserMedia({ video, audio })` on mount,
 * which triggered the browser's camera/mic permission prompt every time
 * the user opened the workspace — even though we only ever need media
 * once they actually start a call or click the camera/mic toggles.
 * Since the realtime-presence path is now last-seen-driven (not media
 * driven), there's no reason to grab hardware on page load.
 *
 * What we do now:
 *   - Initialize `localStream` synchronously to an EMPTY MediaStream.
 *     `new MediaStream()` does NOT prompt for permissions.
 *   - Fetch `/team/list` for `meDetails` only (no media side effects).
 *   - `toggleTrack()` in WorkspaceClient already calls `getUserMedia`
 *     when the user clicks the camera toggle — that's where the
 *     permission prompt belongs (user-initiated, expected).
 *   - On mic toggle, if no audio track exists yet, that path needs to
 *     request mic and add the track — see WorkspaceClient.toggleTrack.
 */
export function useLocalMedia(me: string) {
  // Empty MediaStream from the get-go. No tracks, no permission prompt.
  // Components that read `localStream` can attach tracks lazily; the
  // existing camera-toggle path already does this via `addTrack`.
  const [localStream, setLocalStream] = useState<MediaStream | null>(() => {
    if (typeof window === "undefined") return null;
    return new MediaStream();
  });
  const [localStreamVersion, setLocalStreamVersion] = useState(0);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const [meDetails, setMeDetails] = useState<{
    name?: string;
    email?: string;
    profilePicture?: string;
  } | null>(null);

  const bumpLocalStreamVersion = useCallback(
    () => setLocalStreamVersion((prev) => prev + 1),
    []
  );

  // Fetch own profile from /team/list. No media side effects.
  useEffect(() => {
    let isMounted = true;
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;

    api<{ members: any[] }>("/team/list?orgId=" + orgId, {}, getToken()!)
      .then((teamData) => {
        if (!isMounted) return;
        const myInfo = teamData.members.find((m) => (m._id ?? m.id) === me);
        if (myInfo)
          setMeDetails({
            name: myInfo.name,
            email: myInfo.email,
            profilePicture: myInfo.profilePicture,
          });
      })
      .catch((err) => console.error("[useLocalMedia] /team/list failed:", err));

    return () => {
      isMounted = false;
    };
  }, [me]);

  // On unmount, stop any tracks the camera/mic toggles attached.
  useEffect(() => {
    return () => {
      cameraTrackRef.current = null;
    };
  }, []);

  return {
    localStream,
    localStreamVersion,
    cameraTrackRef,
    meDetails,
    bumpLocalStreamVersion,
    setLocalStream,
  };
}

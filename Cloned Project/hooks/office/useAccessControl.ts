'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '@/lib/auth';
import { connectSocket } from '@/lib/socket';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://backend.networkchains.com';

export interface AccessPolicy {
  allowUnmute: boolean;
  allowPresent: boolean;
}

export type PermissionKind = 'unmute' | 'present' | 'both';

export interface PendingRequest {
  userId: string;
  name: string;
  kind: PermissionKind;
  requestedAt: number;
}

interface Options {
  roomName: string;
  isHost: boolean;
  initialPolicy?: AccessPolicy;
  localUserId: string;
}

/**
 * useAccessControl — client-side glue for the conference access-control
 * feature. Owns the current room policy, the local participant's own
 * request state (pending / granted / denied), and — for hosts — the
 * inbound queue of pending requests from other participants.
 *
 * The four socket events it listens for come straight from the backend
 * routes in src/routes/livekitRecording.ts:
 *   livekit:policy-updated       — host changed the policy
 *   livekit:permission-request   — a participant asked for mic/present
 *   livekit:permission-granted   — a participant was approved
 *   livekit:permission-denied    — a participant was rejected
 *
 * All events include `roomName`; we filter to this room only.
 */
export function useAccessControl({
  roomName,
  isHost,
  initialPolicy,
  localUserId,
}: Options) {
  const [policy, setPolicy] = useState<AccessPolicy>(
    initialPolicy ?? { allowUnmute: true, allowPresent: true },
  );
  const [pending, setPending] = useState<PendingRequest[]>([]);
  // Local participant's own outbound request state — used to render
  // the "Waiting for host…" spinner on the mic / share button.
  const [myPending, setMyPending] = useState<PermissionKind | null>(null);

  useEffect(() => {
    const socket = connectSocket();

    const onPolicyUpdated = (data: {
      roomName: string;
      policy: AccessPolicy;
    }) => {
      if (data?.roomName !== roomName) return;
      setPolicy({
        allowUnmute: !!data.policy?.allowUnmute,
        allowPresent: !!data.policy?.allowPresent,
      });
    };

    const onPermissionRequest = (data: {
      roomName: string;
      request: PendingRequest;
    }) => {
      if (data?.roomName !== roomName) return;
      if (!data.request) return;
      // De-dupe by userId (a participant re-requesting replaces the
      // earlier entry, matching the backend's Map<userId, request>).
      setPending((prev) => {
        const next = prev.filter((p) => p.userId !== data.request.userId);
        next.push(data.request);
        return next;
      });
    };

    const onPermissionGranted = (data: {
      roomName: string;
      userId: string;
      kind: PermissionKind;
    }) => {
      if (data?.roomName !== roomName) return;
      setPending((prev) => prev.filter((p) => p.userId !== data.userId));
      if (data.userId === localUserId) {
        setMyPending(null);
      }
    };

    const onPermissionDenied = (data: {
      roomName: string;
      userId: string;
    }) => {
      if (data?.roomName !== roomName) return;
      setPending((prev) => prev.filter((p) => p.userId !== data.userId));
      if (data.userId === localUserId) {
        setMyPending(null);
      }
    };

    socket.on('livekit:policy-updated', onPolicyUpdated);
    socket.on('livekit:permission-request', onPermissionRequest);
    socket.on('livekit:permission-granted', onPermissionGranted);
    socket.on('livekit:permission-denied', onPermissionDenied);

    return () => {
      socket.off('livekit:policy-updated', onPolicyUpdated);
      socket.off('livekit:permission-request', onPermissionRequest);
      socket.off('livekit:permission-granted', onPermissionGranted);
      socket.off('livekit:permission-denied', onPermissionDenied);
    };
  }, [roomName, localUserId]);

  // Sync any snapshot of current pending from the server on mount for hosts.
  // Handles the case where the host reloads mid-meeting after requests
  // arrived while they were offline.
  useEffect(() => {
    if (!isHost) return;
    const token = getToken();
    if (!token) return;
    fetch(
      `${API_URL}/livekit/policy?roomName=${encodeURIComponent(roomName)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.policy) {
          setPolicy({
            allowUnmute: !!data.policy.allowUnmute,
            allowPresent: !!data.policy.allowPresent,
          });
        }
        if (Array.isArray(data.pending)) {
          setPending(data.pending);
        }
      })
      .catch(() => {});
  }, [isHost, roomName]);

  const setRoomPolicy = useCallback(
    async (next: AccessPolicy) => {
      const token = getToken();
      const res = await fetch(`${API_URL}/livekit/policy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomName,
          allowUnmute: next.allowUnmute,
          allowPresent: next.allowPresent,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to update policy');
      }
      setPolicy(next);
    },
    [roomName],
  );

  const requestPermission = useCallback(
    async (kind: PermissionKind) => {
      const token = getToken();
      setMyPending(kind);
      const res = await fetch(`${API_URL}/livekit/permission/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomName, kind }),
      });
      if (!res.ok) {
        setMyPending(null);
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to request permission');
      }
    },
    [roomName],
  );

  const grantPermission = useCallback(
    async (participantIdentity: string, kind: PermissionKind) => {
      const token = getToken();
      const res = await fetch(`${API_URL}/livekit/permission/grant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomName, participantIdentity, kind }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to grant permission');
      }
    },
    [roomName],
  );

  const denyPermission = useCallback(
    async (participantIdentity: string) => {
      const token = getToken();
      const res = await fetch(`${API_URL}/livekit/permission/deny`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomName, participantIdentity }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to deny permission');
      }
    },
    [roomName],
  );

  const pendingCount = pending.length;
  const locked = useMemo(
    () => !policy.allowUnmute || !policy.allowPresent,
    [policy.allowUnmute, policy.allowPresent],
  );

  return {
    policy,
    setRoomPolicy,
    pending,
    pendingCount,
    myPending,
    requestPermission,
    grantPermission,
    denyPermission,
    locked,
  };
}

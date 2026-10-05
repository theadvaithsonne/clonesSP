import { useState, useCallback } from 'react';
import { connectSocket } from '@/lib/socket';
import { PeerState, KnockRequest } from '../types';

export function useKnocking(
  me: string,
  localPeerState: PeerState | undefined
) {
  const [knockRequest, setKnockRequest] = useState<KnockRequest | null>(null);
  const [knockDeclinedToast, setKnockDeclinedToast] = useState(false);
  const [joiningSpace, setJoiningSpace] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [knockingId, setKnockingId] = useState<string | null>(null);

  const handleKnock = useCallback((peer: PeerState) => {
    setKnockingId(peer.id);
    connectSocket().emit('workspace:knock', { targetId: peer.id });
  }, []);

  const handleCancelKnock = useCallback((peer: PeerState) => {
    connectSocket().emit('workspace:knock-cancel', { targetId: peer.id });
    setKnockingId(null);
  }, []);

  const handleKnockResponse = (accepted: boolean) => {
    if (!knockRequest) return;
    const socket = connectSocket();
    if (accepted) {
      socket.emit('workspace:knock-accept', {
        targetId: knockRequest.from,
        byName: localPeerState?.name || 'A colleague',
        by: me,
      });
    } else {
      socket.emit('workspace:knock-decline', {
        targetId: knockRequest.from,
        byName: localPeerState?.name || 'A colleague',
      });
    }
    setKnockRequest(null);
  };

  return {
    knockRequest,
    knockDeclinedToast,
    joiningSpace,
    knockingId,
    handleKnock,
    handleCancelKnock,
    handleKnockResponse,
    setKnockingId,
    setJoiningSpace,
    setKnockDeclinedToast,
    setKnockRequest,
  };
}

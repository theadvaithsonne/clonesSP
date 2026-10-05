'use client';

import { useState, useCallback } from 'react';
import { getToken } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useHostControls() {
  const [kicking, setKicking] = useState(false);
  const [muting, setMuting] = useState(false);

  const kickParticipant = useCallback(async (roomName: string, participantIdentity: string) => {
    setKicking(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/meet/kick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomName, participantIdentity }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to kick participant');
      }
    } finally {
      setKicking(false);
    }
  }, []);

  const muteParticipant = useCallback(async (roomName: string, participantIdentity: string, trackSid: string) => {
    setMuting(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/meet/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomName, participantIdentity, trackSid }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to mute participant');
      }
    } finally {
      setMuting(false);
    }
  }, []);

  return { kickParticipant, muteParticipant, kicking, muting };
}

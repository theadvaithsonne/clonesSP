'use client';

import { useState, useEffect } from 'react';

interface ParticipantAvatarProps {
  name: string;
  avatarUrl?: string;
  sizeClass?: string;
  textSizeClass?: string;
  className?: string;
}

export function ParticipantAvatar({
  name,
  avatarUrl,
  sizeClass = 'h-8 w-8',
  textSizeClass = 'text-xs',
  className = '',
}: ParticipantAvatarProps) {
  const [failed, setFailed] = useState(false);

  // Reset failed state when the URL changes (e.g. user updates avatar mid-call)
  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);

  const showImage = !!avatarUrl && !failed;

  if (showImage) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setFailed(true)}
        referrerPolicy="no-referrer"
        className={`${sizeClass} shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`${sizeClass} shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 ${textSizeClass} font-semibold text-white ${className}`}
    >
      {initials}
    </div>
  );
}

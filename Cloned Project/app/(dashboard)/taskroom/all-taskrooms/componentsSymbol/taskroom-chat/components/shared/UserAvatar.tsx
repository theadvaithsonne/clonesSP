'use client';

import Image from 'next/image';

interface UserAvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showOnline?: boolean;
  isOnline?: boolean;
  userId?: string;
}

const sizeClasses: Record<Required<UserAvatarProps>['size'], string> = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
  xl: 'h-16 w-16 text-xl',
};

export default function UserAvatar({
  src,
  name,
  size = 'md',
  className = '',
  showOnline,
  isOnline,
  userId,
}: UserAvatarProps) {
  const initials = name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`relative inline-flex ${className} ${userId ? 'cursor-pointer hover:opacity-85 transition-opacity' : ''}`}
      onClick={(e) => {
        if (userId) {
          e.stopPropagation();
          window.dispatchEvent(
            new CustomEvent('affiliate-profile:open', {
              detail: { userId },
            })
          );
        }
      }}
    >
      <div
        className={`flex items-center justify-center overflow-hidden rounded-full bg-gray-200 text-gray-600 ${sizeClasses[size]}`}
      >
        {src ? (
          <Image src={src} alt={name} width={100} height={100} className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </div>

      {showOnline && (
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
            isOnline ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
      )}
    </div>
  );
}




'use client';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap: Record<Required<LoadingSpinnerProps>['size'], string> = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-4',
};

export default function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  return (
    <div className="flex items-center justify-center">
      <div className={`${sizeMap[size]} animate-spin rounded-full border-gray-200 border-t-blue-500`} />
    </div>
  );
}




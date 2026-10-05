import React from 'react';

const SkeletonCard = () => {
  return (
    <div className="relative">
      <div className="bg-[#1e1e2d] rounded-lg border border-gray-800 p-6 hover:shadow-md transition-shadow cursor-pointer group">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-gray-800 animate-pulse" />
            <div className="h-5 w-32 bg-gray-800 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-800 rounded animate-pulse opacity-0 group-hover:opacity-100" />
            <div className="w-5 h-5 bg-gray-800 rounded animate-pulse" />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2 mb-6">
          <div className="h-4 w-full bg-gray-800 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-gray-800 rounded animate-pulse" />
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="h-4 w-16 bg-gray-800 rounded animate-pulse" />
            <div className="h-4 w-20 bg-gray-800 rounded animate-pulse" />
          </div>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden animate-pulse">
            <div className="h-full bg-gray-700 w-1/4 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-gray-800 rounded animate-pulse" />
            <div className="h-4 w-16 bg-gray-800 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-gray-800 rounded animate-pulse" />
            <div className="h-4 w-20 bg-gray-800 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkeletonCard;
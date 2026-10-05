"use client";

import { Building2, Users, MapPin, Star } from "lucide-react";

interface HQCardProps {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  coverPhoto?: string;
  category?: string;
  city?: string;
  state?: string;
  country?: string;
  memberCount: number;
  onClick?: () => void;
}

export function HQCard({
  name,
  slug,
  description,
  icon,
  coverPhoto,
  category,
  city,
  state,
  country,
  memberCount,
  onClick,
}: HQCardProps) {
  const location = [city, state, country].filter(Boolean).join(", ");

  return (
    <button
      onClick={onClick}
      className="group relative w-full text-left bg-zinc-900/50 rounded-2xl overflow-hidden border border-white/5 hover:border-white/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20"
    >
      {/* Cover Photo */}
      <div className="relative aspect-[16/10] overflow-hidden bg-zinc-800">
        {coverPhoto ? (
          <img
            src={coverPhoto}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
            <Building2 className="h-12 w-12 text-zinc-600" />
          </div>
        )}

        {/* Category Badge */}
        {category && (
          <div className="absolute top-3 left-3">
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-black/60 backdrop-blur-sm text-white border border-white/10">
              {category}
            </span>
          </div>
        )}

        {/* Member Count Badge */}
        <div className="absolute top-3 right-3">
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-black/60 backdrop-blur-sm text-white border border-white/10 flex items-center gap-1">
            <Users className="h-3 w-3" />
            {memberCount}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          {icon ? (
            <img
              src={icon}
              alt={name}
              className="h-10 w-10 rounded-xl object-cover flex-shrink-0 border border-white/10"
            />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0 border border-white/10">
              <Building2 className="h-5 w-5 text-zinc-500" />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold truncate group-hover:text-brand-2 transition-colors">
              {name}
            </h3>
            {location && (
              <p className="text-zinc-500 text-sm truncate flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                {location}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        {description && (
          <p className="text-zinc-400 text-sm mt-3 line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </button>
  );
}

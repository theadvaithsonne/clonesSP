"use client";

import { cn } from "@/lib/utils";
import { Building2, Briefcase, Heart, GraduationCap, Megaphone, Palette, Home, Trophy, Film, UtensilsCrossed, Globe, Sparkles } from "lucide-react";

interface CategoryCardProps {
  name: string;
  count: number;
  image?: string;
  gradient?: string;
  isActive?: boolean;
  onClick?: () => void;
}

// Predefined gradients and icons for categories
const categoryConfig: Record<string, { gradient: string; icon: typeof Building2 }> = {
  All: { gradient: "from-brand-2 to-amber-600", icon: Sparkles },
  Technology: { gradient: "from-blue-600 to-cyan-500", icon: Globe },
  Finance: { gradient: "from-emerald-600 to-teal-500", icon: Briefcase },
  Health: { gradient: "from-rose-600 to-pink-500", icon: Heart },
  Education: { gradient: "from-violet-600 to-purple-500", icon: GraduationCap },
  Marketing: { gradient: "from-orange-600 to-amber-500", icon: Megaphone },
  Design: { gradient: "from-fuchsia-600 to-pink-500", icon: Palette },
  "Real Estate": { gradient: "from-amber-600 to-yellow-500", icon: Home },
  Sports: { gradient: "from-red-600 to-orange-500", icon: Trophy },
  Entertainment: { gradient: "from-indigo-600 to-blue-500", icon: Film },
  Food: { gradient: "from-lime-600 to-green-500", icon: UtensilsCrossed },
  default: { gradient: "from-zinc-600 to-zinc-500", icon: Building2 },
};

export function CategoryCard({
  name,
  count,
  image,
  gradient,
  isActive,
  onClick,
}: CategoryCardProps) {
  const config = categoryConfig[name] || categoryConfig.default;
  const gradientClass = gradient || config.gradient;
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative w-full rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.03] hover:shadow-lg hover:shadow-black/30",
        isActive && "ring-2 ring-white ring-offset-2 ring-offset-[#0a0a0a] scale-[1.02]"
      )}
    >
      {/* Background */}
      {image ? (
        <img
          src={image}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-90",
            gradientClass
          )}
        />
      )}

      {/* Content */}
      <div className="relative px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <h3 className="text-white text-sm font-semibold truncate">
            {name}
          </h3>
          <p className="text-white/70 text-xs">
            {count} {count === 1 ? "HQ" : "HQs"}
          </p>
        </div>
      </div>
    </button>
  );
}

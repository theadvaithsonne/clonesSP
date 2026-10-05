import type { CSSProperties } from "react";

/** Curated Notion-style cover presets (gradients + photos). */

export type CoverPreset = {
  id: string;
  label: string;
  /** http(s) image URL, or `gradient:...` CSS value */
  value: string;
  category: "gradient" | "photo";
};

export const COVER_GRADIENTS: CoverPreset[] = [
  { id: "g1", label: "Red", value: "gradient:linear-gradient(90deg,#ff6b6b,#ee5a24)", category: "gradient" },
  { id: "g2", label: "Orange", value: "gradient:linear-gradient(90deg,#feca57,#ff9f43)", category: "gradient" },
  { id: "g3", label: "Yellow", value: "gradient:linear-gradient(90deg,#f9ca24,#f6e58d)", category: "gradient" },
  { id: "g4", label: "Green", value: "gradient:linear-gradient(90deg,#26de81,#20bf6b)", category: "gradient" },
  { id: "g5", label: "Teal", value: "gradient:linear-gradient(90deg,#2bcbba,#0fb9b1)", category: "gradient" },
  { id: "g6", label: "Blue", value: "gradient:linear-gradient(135deg,#45aaf2,#2d98da)", category: "gradient" },
  { id: "g7", label: "Purple", value: "gradient:linear-gradient(135deg,#a55eea,#8854d0)", category: "gradient" },
  { id: "g8", label: "Pink", value: "gradient:linear-gradient(90deg,#fd79a8,#e84393)", category: "gradient" },
  { id: "g9", label: "Gray", value: "gradient:linear-gradient(90deg,#d1d8e0,#a5b1c2)", category: "gradient" },
  { id: "g10", label: "Dark", value: "gradient:linear-gradient(135deg,#2f3542,#1e272e)", category: "gradient" },
  { id: "g11", label: "Sunset", value: "gradient:linear-gradient(120deg,#f093fb 0%,#f5576c 100%)", category: "gradient" },
  { id: "g12", label: "Ocean", value: "gradient:linear-gradient(120deg,#89f7fe 0%,#66a6ff 100%)", category: "gradient" },
  { id: "g13", label: "Aurora", value: "gradient:linear-gradient(120deg,#43e97b 0%,#38f9d7 100%)", category: "gradient" },
  { id: "g14", label: "Night", value: "gradient:linear-gradient(120deg,#4facfe 0%,#00f2fe 100%)", category: "gradient" },
  { id: "g15", label: "Warm", value: "gradient:linear-gradient(120deg,#fa709a 0%,#fee140 100%)", category: "gradient" },
  { id: "g16", label: "Cool", value: "gradient:linear-gradient(120deg,#a18cd1 0%,#fbc2eb 100%)", category: "gradient" },
];

/** Stable Unsplash photo URLs (no API key required). */
export const COVER_PHOTOS: CoverPreset[] = [
  {
    id: "p1",
    label: "Sailboats",
    value:
      "https://images.unsplash.com/photo-1505142468610-359e7d316be0?auto=format&fit=crop&w=1600&q=80",
    category: "photo",
  },
  {
    id: "p2",
    label: "Mountains",
    value:
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=80",
    category: "photo",
  },
  {
    id: "p3",
    label: "Forest",
    value:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1600&q=80",
    category: "photo",
  },
  {
    id: "p4",
    label: "Desert",
    value:
      "https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=1600&q=80",
    category: "photo",
  },
  {
    id: "p5",
    label: "City night",
    value:
      "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1600&q=80",
    category: "photo",
  },
  {
    id: "p6",
    label: "Abstract paint",
    value:
      "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1600&q=80",
    category: "photo",
  },
  {
    id: "p7",
    label: "Waves",
    value:
      "https://images.unsplash.com/photo-1505144808419-1957a94ca61e?auto=format&fit=crop&w=1600&q=80",
    category: "photo",
  },
  {
    id: "p8",
    label: "Space",
    value:
      "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1600&q=80",
    category: "photo",
  },
  {
    id: "p9",
    label: "Flowers",
    value:
      "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1600&q=80",
    category: "photo",
  },
  {
    id: "p10",
    label: "Architecture",
    value:
      "https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1600&q=80",
    category: "photo",
  },
  {
    id: "p11",
    label: "Lake",
    value:
      "https://images.unsplash.com/photo-1439066615861-d1af74d74000?auto=format&fit=crop&w=1600&q=80",
    category: "photo",
  },
  {
    id: "p12",
    label: "Texture",
    value:
      "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1600&q=80",
    category: "photo",
  },
];

export const ALL_COVERS: CoverPreset[] = [...COVER_GRADIENTS, ...COVER_PHOTOS];

export function isGradientCover(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith("gradient:"));
}

export function gradientCss(value: string): string {
  return value.replace(/^gradient:/, "");
}

export function pickRandomCover(): string {
  const pool = ALL_COVERS;
  return pool[Math.floor(Math.random() * pool.length)].value;
}

export function renderCoverStyle(
  coverUrl: string | null | undefined,
  position = 50
): CSSProperties {
  if (!coverUrl) return {};
  if (isGradientCover(coverUrl)) {
    return { backgroundImage: gradientCss(coverUrl) };
  }
  return {
    backgroundImage: `url(${coverUrl})`,
    backgroundSize: "cover",
    backgroundPosition: `center ${position}%`,
  };
}

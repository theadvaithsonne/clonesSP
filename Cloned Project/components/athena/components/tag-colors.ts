export const TAG_PRESET_COLORS = [
  { hex: "#507EFF", fontColor: "#000000", legacyClass: "bg-blue-500" },
  { hex: "#56A548", fontColor: "#000000", legacyClass: "bg-green-600" },
  { hex: "#DFAF00", fontColor: "#000000", legacyClass: "bg-yellow-500" },
  { hex: "#E56900", fontColor: "#000000", legacyClass: "bg-orange-500" },
  { hex: "#C50011", fontColor: "#FFFFFF", legacyClass: "bg-red-600" },
  { hex: "#8217F5", fontColor: "#FFFFFF", legacyClass: "bg-purple-600" },
  { hex: "#D53696", fontColor: "#000000", legacyClass: "bg-pink-500" },
  { hex: "#4B3CF2", fontColor: "#FFFFFF", legacyClass: "bg-indigo-600" },
  { hex: "#4991B5", fontColor: "#000000", legacyClass: "bg-cyan-600" },
  { hex: "#77A400", fontColor: "#000000", legacyClass: "bg-lime-600" },
] as const

export const TAG_PRESET_HEX = TAG_PRESET_COLORS.map((c) => c.hex)

const LEGACY_CLASS_MAP = Object.fromEntries(
  TAG_PRESET_COLORS.map((c) => [c.legacyClass, c])
) as Record<string, (typeof TAG_PRESET_COLORS)[number]>

const HEX_FONT_MAP = Object.fromEntries(
  TAG_PRESET_COLORS.map((c) => [c.hex.toUpperCase(), c.fontColor])
) as Record<string, string>

function getContrastFontColor(hex: string): string {
  const normalized = hex.replace("#", "")
  if (normalized.length !== 6) return "#000000"
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? "#000000" : "#FFFFFF"
}

export function normalizeTagColor(color?: string): { hex: string; fontColor: string } {
  const fallback = { hex: "#64748b", fontColor: "#000000" }
  if (!color) return fallback

  const trimmed = color.trim()
  const legacy = LEGACY_CLASS_MAP[trimmed]
  if (legacy) return { hex: legacy.hex, fontColor: legacy.fontColor }

  if (trimmed.startsWith("#")) {
    const upper = trimmed.toUpperCase()
    return {
      hex: trimmed,
      fontColor: HEX_FONT_MAP[upper] ?? getContrastFontColor(trimmed),
    }
  }

  return fallback
}

export function getTagStyles(color?: string): { backgroundColor: string; color: string } {
  const { hex, fontColor } = normalizeTagColor(color)
  return { backgroundColor: hex, color: fontColor }
}

export function resolveTagColorForPicker(color?: string): string {
  return normalizeTagColor(color).hex
}

export function isSameTagColor(a?: string, b?: string): boolean {
  return normalizeTagColor(a).hex.toUpperCase() === normalizeTagColor(b).hex.toUpperCase()
}

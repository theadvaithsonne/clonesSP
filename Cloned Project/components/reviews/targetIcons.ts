import {
  Briefcase,
  Building2,
  GraduationCap,
  Phone,
  Rss,
  ShoppingBag,
  Video,
  type LucideIcon,
} from "lucide-react";
import { ReviewTargetType } from "@/lib/reviews-api";

/**
 * One icon per reviewable thing, matching what the sidebar already uses for the
 * same concepts (Rss for communities, GraduationCap for courses, ShoppingBag
 * for digital products, and so on).
 *
 * Reusing that vocabulary means a founder scanning the moderation queue reads
 * the same symbol they navigate by, rather than learning a second set that only
 * exists here.
 */
export const REVIEW_TARGET_ICONS: Record<ReviewTargetType, LucideIcon> = {
  office: Building2,
  channel: Rss,
  course: GraduationCap,
  product: ShoppingBag,
  workshop: Video,
  service: Briefcase,
  call: Phone,
};

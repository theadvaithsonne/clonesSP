import { getPlatformCouponByCode } from "../services/platformCoupon";

/**
 * Determine whether a user-provided coupon code refers to a PlatformCoupon
 * (new system) or a legacy Coupon. Returns the string to pass as
 * `platformCouponCode` in `createInvoice` options, or null if the code is not
 * a platform coupon (caller should fall back to legacy validation).
 *
 * Used at the top of founder-facing checkouts to auto-route coupons without
 * per-checkout wiring.
 */
export async function routeCoupon(
  code: string | undefined
): Promise<{ isPlatform: boolean; code?: string }> {
  if (!code) return { isPlatform: false };
  const platform = await getPlatformCouponByCode(code);
  if (platform) return { isPlatform: true, code };
  return { isPlatform: false };
}

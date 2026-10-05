"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Mail,
  KeyRound,
  User,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Shield,
  MapPin,
  Phone,
  Building2,
  UserPlus,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CouponInput, AppliedCoupon } from "@/components/ui/coupon-input";
import { toast } from "sonner";
import { saveToken, saveOrgId, getUserDataFromToken } from "@/lib/auth";
import { API_URL } from "@/lib/api";
import { useGstQuote } from "@/lib/hooks/useGstQuote";
import { CheckoutPaymentStep } from "@/components/checkout/CheckoutPaymentStep";
import { sanitizeDescription } from "@/lib/sanitizeDescription";

interface Product {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  currency: string;
  // GST semantics for INR products (per-unit; scales by quantity).
  gstInclusive?: boolean;
  images: string[];
  isDigital: boolean;
  isSubscription: boolean;
  subscriptionPeriod?: string;
  channelIds: string[];
  requiresShipping: boolean;
  deliveryMethod: string;
  tags?: string[];
}

interface Organization {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  coverPhoto?: string;
  description?: string;
}

// Display-only override — the real Organization.name in the DB is "Bat246"
// (other code matches against that exact string, so it's not renamed), but
// the correct public-facing brand text is "BAT 246". Scoped to this one org
// so every other organization's checkout page still shows its real name.
const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";

type Step =
  | "email"
  | "otp"
  | "name"
  | "shipping"
  | "processing"
  | "invoice_payment"
  | "already_member"
  | "bat246_membership_required"
  | "success";

interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

interface ReferrerInfo {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  affiliateCode?: string;
}

export function ProductCheckoutPage({ productId }: { productId: string }) {
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [referralId, setReferralId] = useState<string | null>(null);
  const [referrerInfo, setReferrerInfo] = useState<ReferrerInfo | null>(null);
  const [bat246BoardId, setBat246BoardId] = useState<string | null>(null);
  const [bat246Pos, setBat246Pos] = useState<string | null>(null);
  const [bat246DugoutRef, setBat246DugoutRef] = useState<string | null>(null);
  const [bat246UpperRef, setBat246UpperRef] = useState<string | null>(null);
  const [bat246UpperRefPlayerId, setBat246UpperRefPlayerId] = useState<string | null>(null);
  const [bat246GenRef, setBat246GenRef] = useState<string | null>(null);
  const [bat246Ref, setBat246Ref] = useState<string | null>(null);

  // Form state
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Checkout state
  const [userId, setUserId] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    fullName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
    phone: "",
  });

  // Coupon state
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  // Invoice state
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  // Bat246 membership gate state
  const [membershipPrice, setMembershipPrice] = useState<number>(20);

  // True only when the product itself is tagged bat246_entry
  const isBat246 = product?.tags?.includes("bat246_entry") ?? false;

  // Fetch product details on mount, then — if this browser already holds a
  // valid Garage session — skip the email/OTP steps entirely and resolve
  // straight to whichever step /verify-otp would have landed on, using the
  // session's own already-verified identity instead of a fresh OTP. A guest
  // with no/invalid token just falls straight through to the normal "email"
  // step, unchanged.
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const fetchedProduct = await fetchProductDetails();

      // Pre-fill email if user is already authenticated
      const { email: tokenEmail } = getUserDataFromToken();
      if (tokenEmail) setEmail(tokenEmail);

      // Read referral ID and optional bat246 invite params from URL query params
      let sessionBat246Ref: string | null = null;
      if (typeof window !== "undefined") {
        const searchParams = new URLSearchParams(window.location.search);
        const ref = searchParams.get("ref");
        if (ref) setReferralId(ref);
        const b246Board = searchParams.get("bat246BoardId");
        const b246Pos = searchParams.get("bat246Pos");
        const b246DugoutRef = searchParams.get("bat246DugoutRef");
        const b246UpperRef = searchParams.get("bat246UpperRef");
        const b246UpperRefPlayerId = searchParams.get("bat246UpperRefPlayerId");
        const b246GenRef = searchParams.get("bat246GenRef");
        if (b246Board) setBat246BoardId(b246Board);
        if (b246Pos) setBat246Pos(b246Pos);
        if (b246DugoutRef) setBat246DugoutRef(b246DugoutRef);
        if (b246UpperRef) setBat246UpperRef(b246UpperRef);
        if (b246UpperRefPlayerId) setBat246UpperRefPlayerId(b246UpperRefPlayerId);
        if (b246GenRef) setBat246GenRef(b246GenRef);
        const b246Ref = searchParams.get("bat246Ref");
        if (b246Ref) { setBat246Ref(b246Ref); sessionBat246Ref = b246Ref; }
      }

      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null;
      if (token && fetchedProduct) {
        try {
          const res = await fetch(`${API_URL}/checkout/product/${productId}/verify-session`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ...(sessionBat246Ref ? { bat246Ref: sessionBat246Ref } : {}) }),
          });
          const data = await res.json();

          if (!cancelled && data.success) {
            setUserId(data.userId);
            setNeedsProfile(data.needsProfile);
            const sessionEmail: string | undefined = data.user?.email;
            if (sessionEmail) setEmail(sessionEmail);

            if (data.requiresBat246Membership) {
              setMembershipPrice(data.membershipPrice ?? 20);
              setStep("bat246_membership_required");
            } else if (data.isMember) {
              setStep("already_member");
            } else if (data.needsProfile) {
              if (data.user?.name) setName(data.user.name);
              setStep("name");
            } else {
              const needsShipping =
                fetchedProduct && !fetchedProduct.isDigital && fetchedProduct.requiresShipping;
              if (needsShipping) {
                setShippingAddress((prev) => ({ ...prev, fullName: data.user?.name || "" }));
                setStep("shipping");
              } else {
                // Passing the session's email explicitly — `email` state may
                // not have committed from the setEmail() call above yet, and
                // processCheckout's default read of the `email` closure would
                // otherwise still see the pre-session-check (possibly empty)
                // value.
                await processCheckout(data.user?.name, undefined, sessionEmail);
              }
            }
          }
          // data.success === false → no valid session (guest, or an expired/
          // invalid token) — stay on the normal "email" step, same as before.
        } catch (err) {
          console.error("Session-based checkout check failed, falling back to email/OTP:", err);
        }
      }

      if (!cancelled) setLoading(false);
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Fetch referrer info when referralId (or, for bat246 entry, bat246Ref) is available
  useEffect(() => {
    const fetchReferrerInfo = async () => {
      const query = isBat246 && bat246Ref
        ? `userId=${bat246Ref}`
        : referralId
          ? `affiliateId=${referralId}`
          : null;
      if (!query) return;

      try {
        const res = await fetch(`${API_URL}/affiliate/referrer-info?${query}`);
        const data = await res.json();

        if (data.success && data.referrer) {
          setReferrerInfo(data.referrer);
        }
      } catch (err) {
        console.error("Error fetching referrer info:", err);
      }
    };

    fetchReferrerInfo();
  }, [referralId, isBat246, bat246Ref]);

  // Returns the fetched product directly (in addition to setting state) so
  // the mount effect can use it immediately — e.g. to decide whether the
  // session-based checkout bypass needs a shipping address — without
  // waiting on a re-render for the `product` state to commit.
  const fetchProductDetails = async (): Promise<Product | null> => {
    try {
      const res = await fetch(`${API_URL}/checkout/product/${productId}`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Product not found");
        return null;
      }

      setProduct(data.product);
      setOrganization(data.organization);
      return data.product as Product;
    } catch (err) {
      console.error("Error fetching product:", err);
      setError("Failed to load product details");
      return null;
    }
  };

  const handleRequestOtp = async () => {
    if (!email) {
      toast.error("Please enter your email");
      return;
    }

    setFormLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_URL}/checkout/product/${productId}/request-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );

      const data = await res.json();

      if (data.success) {
        toast.success("OTP sent to your email");
        setStep("otp");
      } else {
        setError(data.error || "Failed to send OTP");
      }
    } catch (err) {
      console.error("OTP request error:", err);
      setError("Failed to send OTP");
    } finally {
      setFormLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      toast.error("Please enter the 6-digit OTP");
      return;
    }

    setFormLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_URL}/checkout/product/${productId}/verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: otp, ...(bat246Ref ? { bat246Ref } : {}) }),
        }
      );

      const data = await res.json();

      if (data.success) {
        setUserId(data.userId);
        setNeedsProfile(data.needsProfile);

        if (data.requiresBat246Membership) {
          setMembershipPrice(data.membershipPrice ?? 20);
          setStep("bat246_membership_required");
          return;
        }

        if (data.isMember) {
          setStep("already_member");
        } else if (data.needsProfile) {
          if (data.user?.name) setName(data.user.name);
          setStep("name");
        } else {
          // Check if shipping is needed for physical products
          const needsShipping =
            product && !product.isDigital && product.requiresShipping;
          if (needsShipping) {
            setShippingAddress((prev) => ({
              ...prev,
              fullName: data.user?.name || name,
            }));
            setStep("shipping");
          } else {
            processCheckout(data.user?.name);
          }
        }
      } else {
        setError(data.error || "Invalid OTP");
      }
    } catch (err) {
      console.error("OTP verification error:", err);
      setError("Failed to verify OTP");
    } finally {
      setFormLoading(false);
    }
  };

  const processCheckout = async (
    userName?: string,
    withShipping?: ShippingAddress,
    overrideEmail?: string
  ) => {
    setFormLoading(true);
    setStep("processing");
    setError(null);

    const needsShipping =
      product && !product.isDigital && product.requiresShipping;
    const addressToSend =
      withShipping || (needsShipping ? shippingAddress : undefined);

    try {
      const res = await fetch(
        `${API_URL}/checkout/product/${productId}/process-checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: overrideEmail || email,
            name: userName || name,
            quantity: 1,
            shippingAddress: addressToSend,
            referralId: referralId || undefined,
            couponCode: appliedCoupon?.code || undefined,
            ...(isBat246 && bat246BoardId ? { bat246BoardId } : {}),
            ...(isBat246 && bat246Pos ? { bat246Pos } : {}),
            ...(isBat246 && bat246DugoutRef ? { bat246DugoutRef } : {}),
            ...(isBat246 && bat246UpperRef ? { bat246UpperRef } : {}),
            ...(isBat246 && bat246UpperRefPlayerId ? { bat246UpperRefPlayerId } : {}),
            ...(isBat246 && bat246GenRef ? { bat246GenRef } : {}),
            ...(isBat246 && bat246Ref ? { bat246Ref } : {}),
          }),
        }
      );

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Checkout failed");
        setStep("email");
        return;
      }

      if (data.isMember) {
        saveToken(data.token);
        saveOrgId(data.orgId);
        setStep("already_member");
        return;
      }

      setUserId(data.userId);

      // Store token/orgId for later use
      if (data.token) localStorage.setItem("checkout_token", data.token);
      if (data.orgId) localStorage.setItem("checkout_org_id", data.orgId);

      // Free product - order is auto-completed, go straight to success
      if (data.isFree) {
        saveToken(data.token);
        saveOrgId(data.orgId);
        setStep("success");
        toast.success("Purchase successful!");
        setTimeout(() => router.push(isBat246 ? "/games/bat246" : "/workspace"), 2000);
        return;
      }

      // Invoice-based payment flow
      setInvoiceId(data.invoiceId);
      setStep("invoice_payment");
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Checkout failed");
      setStep("email");
    } finally {
      setFormLoading(false);
    }
  };

  const formatPrice = (price: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  // GST is decided by the buyer's country, which only the server can resolve.
  // Physical products collect a shipping country, which outranks the buyer's
  // profile. Must sit above the early returns below (hook order).
  const gstPriceNow = product?.price || 0;
  const { quote: gstQuote } = useGstQuote({
    itemType: "product",
    itemId: product?._id,
    // This page always buys a single unit (see processCheckout).
    email: email || undefined,
    subtotalMinor: appliedCoupon
      ? appliedCoupon.finalAmount
      : Math.round(gstPriceNow * 100),
    shippingCountry: shippingAddress.country || undefined,
    enabled: !!product && gstPriceNow > 0,
  });

  // Loading state
  if (loading) {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  // Error state
  if (error && !product) {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">
            Product Not Found
          </h2>
          <p className="text-[#9fa0b8] mb-4">{error}</p>
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="border-[#2a2a35]"
          >
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const displayPrice = product?.price || 0;

  return (
    <div className="h-screen bg-[#0a0a0f] flex overflow-hidden">
      {/* Left Panel - Product Details */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0e0e12] flex-col p-8 lg:p-12 overflow-y-auto">
        <div className="flex-1">
          {/* Organization Logo */}
          <div className="flex items-center gap-3 mb-8">
            {organization?.icon ? (
              <img
                src={organization.icon}
                alt={organization.name}
                className="w-12 h-12 rounded-xl object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-brand/20 flex items-center justify-center">
                <span className="text-brand font-bold text-lg">
                  {organization?.name?.charAt(0) || "O"}
                </span>
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">
                {product?.name}
              </h1>
              <p className="text-[#9fa0b8] text-sm">
                By {organization?._id === BAT246_ORG_ID ? "BAT 246" : organization?.name}
              </p>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl lg:text-4xl font-bold text-white">
                {formatPrice(displayPrice, product?.currency)}
              </span>
              {product?.isSubscription && product?.subscriptionPeriod && (
                <span className="text-[#9fa0b8] text-sm">
                  /{product.subscriptionPeriod}
                </span>
              )}
            </div>

            {/* Description */}
            {product?.description && (
              <div className="pt-4 border-t border-[#2a2a35]">
                <div 
                  className="text-[#9fa0b8] text-sm leading-relaxed line-clamp-6 space-y-2 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-5 [&_ul]:pl-5 [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: sanitizeDescription(product.description) }}
                />
              </div>
            )}

            {/* Product Image */}
            {product?.images && product.images[0] && (
              <div className="pt-4">
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-full max-w-sm rounded-2xl object-cover shadow-2xl max-h-[40vh]"
                />
              </div>
            )}

            {/* Referred By Card */}
            {referrerInfo && (
              <div className="pt-4 border-t border-[#2a2a35]">
                <div className="flex items-center gap-3 p-3 bg-[#1a1a22] rounded-xl border border-[#2a2a35]">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 shrink-0">
                    {referrerInfo.profilePicture ? (
                      <img
                        src={referrerInfo.profilePicture}
                        alt={referrerInfo.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-semibold text-sm">
                        {referrerInfo.name?.charAt(0) || "?"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-[#9fa0b8] mb-0.5">
                      Referred by
                    </p>
                    <p className="text-white text-sm font-medium truncate">
                      {referrerInfo.name}
                    </p>
                  </div>
                  <UserPlus className="w-4 h-4 text-purple-400 shrink-0" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-[#2a2a35] flex-shrink-0">
          <p className="text-xs text-[#9fa0b8]">
            By completing this purchase, you agree to share information with{" "}
            {organization?.name}.
          </p>
          <div className="flex items-center gap-4 mt-3 text-xs text-[#9fa0b8]">
            <span>
              {organization?.name} {new Date().getFullYear()}
            </span>
            <a href="#" className="hover:text-white transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Terms
            </a>
          </div>
        </div>
      </div>

      {/* Right Panel - Payment Form */}
      <div className="w-full lg:w-1/2 flex flex-col p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center">
          {/* Mobile Header */}
          <div className="lg:hidden mb-8">
            <div className="flex items-center gap-3 mb-6">
              {organization?.icon ? (
                <img
                  src={organization.icon}
                  alt={organization.name}
                  className="w-10 h-10 rounded-xl object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center">
                  <span className="text-brand font-bold">
                    {organization?.name?.charAt(0) || "O"}
                  </span>
                </div>
              )}
              <span className="text-white font-medium">
                {organization?.name}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">
              {product?.name}
            </h1>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-brand">
                {formatPrice(displayPrice, product?.currency)}
              </span>
            </div>

            {/* Referred By Card - Mobile */}
            {referrerInfo && (
              <div className="mt-4 flex items-center gap-3 p-3 bg-[#1a1a22] rounded-xl border border-[#2a2a35]">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 shrink-0">
                  {referrerInfo.profilePicture ? (
                    <img
                      src={referrerInfo.profilePicture}
                      alt={referrerInfo.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-semibold text-xs">
                      {referrerInfo.name?.charAt(0) || "?"}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-[#9fa0b8]">
                    Referred by
                  </p>
                  <p className="text-white text-sm font-medium truncate">
                    {referrerInfo.name}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Payment Details Card */}
          <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-6 lg:p-8">
            <h2 className="text-xl font-bold text-white mb-2">
              Payment details
            </h2>
            <p className="text-sm text-[#9fa0b8] mb-6">
              Complete your purchase by providing your details.
            </p>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Processing State */}
            {step === "processing" && (
              <div className="py-12 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-brand mx-auto mb-4" />
                <p className="text-white font-medium">
                  Processing your order...
                </p>
                <p className="text-sm text-[#9fa0b8] mt-2">
                  Please don't close this window
                </p>
              </div>
            )}

            {/* Invoice Payment Step */}
            {step === "invoice_payment" && invoiceId && (
              <CheckoutPaymentStep
                invoiceId={invoiceId}
                organizationName={organization?.name || ""}
                userEmail={email}
                userName={name}
                onSuccess={(data) => {
                  const token = localStorage.getItem("checkout_token");
                  const orgId = localStorage.getItem("checkout_org_id");
                  if (token) saveToken(token);
                  if (orgId) saveOrgId(orgId);
                  setStep("success");
                  toast.success("Purchase successful!");
                  setTimeout(() => router.push(isBat246 ? "/games/bat246" : "/workspace"), 2000);
                }}
                onCancel={() => {
                  setStep("email");
                  setInvoiceId(null);
                }}
                onBack={() => {
                  setStep("email");
                  setInvoiceId(null);
                }}
              />
            )}

            {/* Success State */}
            {step === "success" && (
              <div className="py-12 text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Purchase Complete!
                </h3>
                <p className="text-sm text-[#9fa0b8] mb-4">
                  Welcome to {organization?.name}! Redirecting you to{" "}
                  {isBat246 ? "BAT 246..." : "your workspace..."}
                </p>
                <Loader2 className="w-5 h-5 animate-spin text-brand mx-auto" />
              </div>
            )}

            {/* Bat246 Membership Required */}
            {step === "bat246_membership_required" && (
              <div className="py-8">
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <Lock className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-400">
                          BAT 246 Membership Required
                        </p>
                        <p className="text-xs text-red-400/70 mt-1">
                          You need an active BAT 246 monthly membership to purchase this product. Activate it from the BAT 246 Boards page.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null;
                          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/bat246/office/join`, {
                            method: "POST",
                            headers: { "Authorization": `Bearer ${token}` },
                          });
                          if (res.ok) {
                            const data = await res.json();
                            if (data.token) localStorage.setItem("garage_tok", data.token);
                          }
                        } catch {}
                        router.push("/games/bat246/boards");
                      }}
                      className="flex-shrink-0 flex items-center gap-1.5 bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground h-8 sm:h-9 text-xs sm:text-sm font-semibold px-3 sm:px-4 rounded-md transition-colors cursor-pointer"
                    >
                      Activate ${membershipPrice}.00
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Already Member State */}
            {step === "already_member" && (
              <div className="py-12 text-center">
                <div className="w-16 h-16 bg-brand/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-brand" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  You're Already a Member!
                </h3>
                <p className="text-sm text-[#9fa0b8] mb-6">
                  You're already part of {organization?.name}. You can purchase
                  products from the Shop section in your workspace.
                </p>
                <Button
                  onClick={() => router.push("/workspace")}
                  className="w-full bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground font-semibold h-12 rounded-xl"
                >
                  Go to Workspace
                </Button>
              </div>
            )}

            {/* Shipping Address Step */}
            {step === "shipping" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-brand mb-2">
                  <MapPin className="w-5 h-5" />
                  <span className="font-medium">Shipping Address</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Input
                      type="text"
                      value={shippingAddress.fullName}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          fullName: e.target.value,
                        })
                      }
                      placeholder="Full Name"
                      className="h-11 bg-[#1a1a22] border-[#2a2a35] text-white rounded-xl placeholder:text-[#6b6b7b] focus:border-brand"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="text"
                      value={shippingAddress.phone || ""}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          phone: e.target.value,
                        })
                      }
                      placeholder="Phone Number"
                      className="h-11 bg-[#1a1a22] border-[#2a2a35] text-white rounded-xl placeholder:text-[#6b6b7b] focus:border-brand"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="text"
                      value={shippingAddress.addressLine1}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          addressLine1: e.target.value,
                        })
                      }
                      placeholder="Address Line 1"
                      className="h-11 bg-[#1a1a22] border-[#2a2a35] text-white rounded-xl placeholder:text-[#6b6b7b] focus:border-brand"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="text"
                      value={shippingAddress.addressLine2 || ""}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          addressLine2: e.target.value,
                        })
                      }
                      placeholder="Address Line 2 (Optional)"
                      className="h-11 bg-[#1a1a22] border-[#2a2a35] text-white rounded-xl placeholder:text-[#6b6b7b] focus:border-brand"
                    />
                  </div>
                  <Input
                    type="text"
                    value={shippingAddress.city}
                    onChange={(e) =>
                      setShippingAddress({
                        ...shippingAddress,
                        city: e.target.value,
                      })
                    }
                    placeholder="City"
                    className="h-11 bg-[#1a1a22] border-[#2a2a35] text-white rounded-xl placeholder:text-[#6b6b7b] focus:border-brand"
                  />
                  <Input
                    type="text"
                    value={shippingAddress.state}
                    onChange={(e) =>
                      setShippingAddress({
                        ...shippingAddress,
                        state: e.target.value,
                      })
                    }
                    placeholder="State"
                    className="h-11 bg-[#1a1a22] border-[#2a2a35] text-white rounded-xl placeholder:text-[#6b6b7b] focus:border-brand"
                  />
                  <Input
                    type="text"
                    value={shippingAddress.postalCode}
                    onChange={(e) =>
                      setShippingAddress({
                        ...shippingAddress,
                        postalCode: e.target.value,
                      })
                    }
                    placeholder="PIN Code"
                    className="h-11 bg-[#1a1a22] border-[#2a2a35] text-white rounded-xl placeholder:text-[#6b6b7b] focus:border-brand"
                  />
                  <Input
                    type="text"
                    value={shippingAddress.country}
                    onChange={(e) =>
                      setShippingAddress({
                        ...shippingAddress,
                        country: e.target.value,
                      })
                    }
                    placeholder="Country"
                    className="h-11 bg-[#1a1a22] border-[#2a2a35] text-white rounded-xl placeholder:text-[#6b6b7b] focus:border-brand"
                  />
                </div>

                {/* Order Summary */}
                <div className="pt-4 border-t border-[#2a2a35] space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#9fa0b8]">Product</span>
                    <span className="text-white">{product?.name}</span>
                  </div>
                  {/* Coupon discount */}
                  {appliedCoupon && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9fa0b8]">
                        Coupon ({appliedCoupon.code})
                      </span>
                      <span className="text-green-400">
                        -{formatPrice(appliedCoupon.discountAmount / 100, product?.currency)}
                      </span>
                    </div>
                  )}
                  {/* GST — same shape as the primary order-summary block.
                      Bat246 entry products are always sold tax-free, so
                      neither the line nor the total math ever adds GST. */}
                  {gstQuote?.applies && (
                    gstQuote.inclusive ? (
                      <div className="flex justify-between text-xs text-[#9fa0b8]">
                        <span>Includes GST ({gstQuote.rate}%)</span>
                        <span>{formatPrice(gstQuote.tax / 100, product?.currency)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-sm">
                        <span className="text-[#9fa0b8]">GST ({gstQuote.rate}%)</span>
                        <span className="text-white">
                          +{formatPrice(gstQuote.tax / 100, product?.currency)}
                        </span>
                      </div>
                    )
                  )}
                  <div className="flex justify-between text-base font-semibold pt-3 border-t border-[#2a2a35]">
                    <span className="text-white">Total</span>
                    <span className="text-brand">
                      {(() => {
                        const subtotal = appliedCoupon
                          ? appliedCoupon.finalAmount / 100
                          : displayPrice;
                        // The quote already carries the GST decision, and
                        // the server exempts bat246 entries at source.
                        const total = gstQuote
                          ? gstQuote.total / 100
                          : subtotal;
                        return formatPrice(total, product?.currency);
                      })()}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => processCheckout(name, shippingAddress)}
                  disabled={
                    formLoading ||
                    !shippingAddress.fullName ||
                    !shippingAddress.addressLine1 ||
                    !shippingAddress.city ||
                    !shippingAddress.state ||
                    !shippingAddress.postalCode ||
                    !shippingAddress.country
                  }
                  className="w-full bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground font-semibold h-14 rounded-xl text-base disabled:opacity-50 transition-all"
                >
                  {formLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Proceed to pay{" "}
                      {formatPrice(
                        appliedCoupon
                          ? appliedCoupon.finalAmount / 100
                          : displayPrice,
                        product?.currency
                      )}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>

                <button
                  onClick={() => setStep("email")}
                  className="w-full text-sm text-[#9fa0b8] hover:text-white transition-colors"
                >
                  Back to email
                </button>
              </div>
            )}

            {/* Form Steps */}
            {(step === "email" || step === "otp" || step === "name") && (
              <div className="space-y-6">
                {/* Email Field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9fa0b8]" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      disabled={step !== "email"}
                      className={`pl-12 h-12 bg-[#1a1a22] border-[#2a2a35] text-white rounded-xl placeholder:text-[#6b6b7b] focus:border-brand focus:ring-brand/20 transition-all ${step !== "email" ? "opacity-60" : ""
                        }`}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        step === "email" &&
                        handleRequestOtp()
                      }
                    />
                    {step !== "email" && (
                      <button
                        onClick={() => {
                          setStep("email");
                          setOtp("");
                          setName("");
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-brand text-sm hover:underline"
                      >
                        Change
                      </button>
                    )}
                  </div>
                </div>

                {/* OTP Field - Animated Entry */}
                <div
                  className={`space-y-2 overflow-hidden transition-all duration-300 ease-out ${step === "otp" || step === "name"
                    ? "max-h-32 opacity-100"
                    : "max-h-0 opacity-0"
                    }`}
                >
                  <label className="text-sm font-medium text-white">
                    Verification Code
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9fa0b8]" />
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      value={otp}
                      onChange={(e) =>
                        setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="Enter 6-digit code"
                      disabled={step !== "otp"}
                      maxLength={6}
                      className={`pl-12 h-12 bg-[#1a1a22] border-[#2a2a35] text-white rounded-xl placeholder:text-[#6b6b7b] text-center tracking-[0.5em] font-mono focus:border-brand focus:ring-brand/20 transition-all ${step !== "otp" ? "opacity-60" : ""
                        }`}
                      onKeyDown={(e) =>
                        e.key === "Enter" && step === "otp" && handleVerifyOtp()
                      }
                    />
                    {step === "otp" && (
                      <button
                        onClick={handleRequestOtp}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-brand text-sm hover:underline"
                      >
                        Resend
                      </button>
                    )}
                  </div>
                  {step === "otp" && (
                    <p className="text-xs text-[#9fa0b8]">
                      We sent a code to {email}
                    </p>
                  )}
                </div>

                {/* Name Field - Animated Entry */}
                <div
                  className={`space-y-2 overflow-hidden transition-all duration-300 ease-out ${step === "name"
                    ? "max-h-24 opacity-100"
                    : "max-h-0 opacity-0"
                    }`}
                >
                  <label className="text-sm font-medium text-white">Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9fa0b8]" />
                    <Input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="pl-12 h-12 bg-[#1a1a22] border-[#2a2a35] text-white rounded-xl placeholder:text-[#6b6b7b] focus:border-brand focus:ring-brand/20 transition-all"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && step === "name") {
                          const needsShipping =
                            product &&
                            !product.isDigital &&
                            product.requiresShipping;
                          if (needsShipping) {
                            setShippingAddress((prev) => ({
                              ...prev,
                              fullName: name,
                            }));
                            setStep("shipping");
                          } else {
                            processCheckout();
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Coupon Input */}
                <div className="pt-4 border-t border-[#2a2a35]">
                  <CouponInput
                    itemType="product"
                    itemId={productId}
                    amount={Math.round(displayPrice * 100)}
                    currency={product?.currency || "USD"}
                    onCouponApplied={(coupon) => setAppliedCoupon(coupon)}
                    onCouponRemoved={() => setAppliedCoupon(null)}
                    orgId={organization?._id}
                    userId={userId ?? undefined}
                    disabled={formLoading}
                  />
                </div>

                {/* Order Summary */}
                <div className="pt-4 border-t border-[#2a2a35] space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#9fa0b8]">Product</span>
                    <span className="text-white">{product?.name}</span>
                  </div>
                  {/* Coupon discount */}
                  {appliedCoupon && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9fa0b8]">
                        Coupon ({appliedCoupon.code})
                      </span>
                      <span className="text-green-400">
                        -{formatPrice(appliedCoupon.discountAmount / 100, product?.currency)}
                      </span>
                    </div>
                  )}
                  {/* GST — server-decided (buyer's country), not currency.
                      This page buys quantity: 1. Bat246 entry products are
                      exempt at source, so the quote simply reports
                      applies:false for them. */}
                  {gstQuote?.applies && (
                    gstQuote.inclusive ? (
                      <div className="flex justify-between text-xs text-[#9fa0b8]">
                        <span>Includes GST ({gstQuote.rate}%)</span>
                        <span>{formatPrice(gstQuote.tax / 100, product?.currency)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-sm">
                        <span className="text-[#9fa0b8]">GST ({gstQuote.rate}%)</span>
                        <span className="text-white">
                          +{formatPrice(gstQuote.tax / 100, product?.currency)}
                        </span>
                      </div>
                    )
                  )}
                  <div className="flex justify-between text-base font-semibold pt-3 border-t border-[#2a2a35]">
                    <span className="text-white">Amount to be paid</span>
                    <span className="text-brand">
                      {(() => {
                        const subtotal = appliedCoupon
                          ? appliedCoupon.finalAmount / 100
                          : displayPrice;
                        // The quote already carries the GST decision, and
                        // the server exempts bat246 entries at source.
                        const total = gstQuote
                          ? gstQuote.total / 100
                          : subtotal;
                        return formatPrice(total, product?.currency);
                      })()}
                      {product?.isSubscription &&
                        product?.subscriptionPeriod && (
                          <span className="text-sm font-normal text-[#9fa0b8]">
                            /{product.subscriptionPeriod}
                          </span>
                        )}
                    </span>
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  onClick={() => {
                    if (step === "email") handleRequestOtp();
                    else if (step === "otp") handleVerifyOtp();
                    else if (step === "name") {
                      const needsShipping =
                        product &&
                        !product.isDigital &&
                        product.requiresShipping;
                      if (needsShipping) {
                        setShippingAddress((prev) => ({
                          ...prev,
                          fullName: name,
                        }));
                        setStep("shipping");
                      } else {
                        processCheckout();
                      }
                    }
                  }}
                  disabled={
                    formLoading ||
                    (step === "email" && !email) ||
                    (step === "otp" && otp.length !== 6) ||
                    (step === "name" && !name.trim())
                  }
                  className="w-full bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground font-semibold h-14 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {formLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      {step === "email" && "Continue"}
                      {step === "otp" && "Verify & Continue"}
                      {step === "name" &&
                        (product &&
                          !product.isDigital &&
                          product.requiresShipping
                          ? "Continue to Shipping"
                          : `Proceed to pay ${formatPrice(
                            appliedCoupon
                              ? appliedCoupon.finalAmount / 100
                              : displayPrice,
                            product?.currency
                          )}`)}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>

                {/* Security Badge */}
                <div className="flex items-center justify-center gap-2 text-xs text-[#9fa0b8]">
                  <Shield className="w-4 h-4" />
                  <span>Secured by GaragePay</span>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Footer */}
          <div className="lg:hidden mt-6 text-center">
            <p className="text-xs text-[#9fa0b8]">
              By completing this purchase, you agree to share information with{" "}
              {organization?.name}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

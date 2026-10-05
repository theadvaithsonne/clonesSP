"use client";

import { useState, useEffect } from "react";
import { X, Loader2, CreditCard, RefreshCw, Calendar, Package, BookOpen, Video, Rss, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  subscribeToItem,
  getSubscriptionPlan,
  SubscriptionPlan,
  SubscriptionItemType,
  SubscriptionPeriod,
} from "@/lib/feed-api";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { getRazorpayContactForCurrentUser } from "@/lib/razorpayPrefill";

interface RazorpaySubscriptionOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  handler: (response: {
    razorpay_subscription_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void | Promise<void>;
  modal: {
    ondismiss: () => void;
  };
  theme: {
    color: string;
  };
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  image?: string;
}

interface RazorpayClass {
  new (options: RazorpaySubscriptionOptions): {
    open: () => void;
  };
}

interface ItemDetails {
  _id: string;
  name: string;
  description?: string;
  image?: string;
  price?: number;
  currency?: string;
}

interface SubscriptionPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: SubscriptionItemType;
  item: ItemDetails;
  orgId: string;
  userData: {
    name: string;
    email: string;
  };
  onSuccess: () => void;
}

const PERIOD_LABELS: Record<SubscriptionPeriod, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

const ITEM_TYPE_ICONS: Record<SubscriptionItemType, React.ReactNode> = {
  channel: <Rss className="w-5 h-5 text-brand" />,
  course: <BookOpen className="w-5 h-5 text-brand" />,
  workshop: <Video className="w-5 h-5 text-brand" />,
  product: <Package className="w-5 h-5 text-brand" />,
};

const ITEM_TYPE_LABELS: Record<SubscriptionItemType, string> = {
  channel: "Channel",
  course: "Course",
  workshop: "Workshop",
  product: "Product",
};

export function SubscriptionPaymentModal({
  isOpen,
  onClose,
  itemType,
  item,
  orgId,
  userData,
  onSuccess,
}: SubscriptionPaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [orderData, setOrderData] = useState<{ key?: string; currency?: string } | null>(null);

  // Fetch subscription plan on mount
  useEffect(() => {
    if (isOpen && item._id) {
      fetchPlan();
    }
  }, [isOpen, item._id, itemType, orgId]);

  const fetchPlan = async () => {
    setLoadingPlan(true);
    setError(null);
    try {
      const fetchedPlan = await getSubscriptionPlan(orgId, itemType, item._id);
      if (!fetchedPlan) {
        setError("No subscription plan available for this item");
      } else if (!fetchedPlan.isActive) {
        setError("Subscription plan is not active");
      } else {
        setPlan(fetchedPlan);
      }
    } catch (err) {
      console.error("Failed to fetch plan:", err);
      setError(err instanceof Error ? err.message : "Failed to load subscription plan");
    } finally {
      setLoadingPlan(false);
    }
  };

  const resetModalState = () => {
    setInvoiceId(null);
    setShowPaymentSelector(false);
    setOrderData(null);
    setError(null);
  };

  // Called by PaymentMethodSelector after user selects currency + method
  const handlePaymentInitiated = async (data: {
    razorpayOrderId?: string;
    razorpayKeyId?: string;
    razorpaySubscriptionId?: string;
    shortUrl?: string;
    cryptoPaymentUrl?: string;
    walletPaid?: boolean;
    stripePaid?: boolean;
    amount: number;
    currency: string;
    invoiceId: string;
  }) => {
    if (data.walletPaid || data.stripePaid) {
      toast.success("Payment successful!");
      resetModalState();
      onSuccess();
      onClose();
      return;
    }
    if (data.cryptoPaymentUrl) {
      window.open(data.cryptoPaymentUrl, "_blank");
      toast.info("Complete your crypto payment in the new tab. The invoice will update automatically once confirmed.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // If we got a short URL (e.g. for crypto), redirect
      if (data.shortUrl) {
        window.open(data.shortUrl, "_blank");
        setLoading(false);
        return;
      }

      // Open Razorpay with the details from select-payment
      const key = data.razorpayKeyId || orderData?.key;
      if (!key) throw new Error("Missing Razorpay key");

      // Load Razorpay SDK
      const windowWithRazorpay = window as { Razorpay?: unknown };
      if (!windowWithRazorpay.Razorpay) {
        const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
        if (!existingScript) {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.async = true;
          document.body.appendChild(script);
        }

        await new Promise((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 50;
          const checkRazorpay = () => {
            if (windowWithRazorpay.Razorpay) resolve(true);
            else if (attempts >= maxAttempts) reject(new Error("Razorpay SDK loading timeout"));
            else { attempts++; setTimeout(checkRazorpay, 100); }
          };
          checkRazorpay();
        });
      }

      if (!windowWithRazorpay.Razorpay) throw new Error("Razorpay SDK failed to load");

      const rzpOptions: RazorpaySubscriptionOptions = {
        key,
        subscription_id: data.razorpaySubscriptionId || "",
        name: `${ITEM_TYPE_LABELS[itemType]} Subscription`,
        description: `Subscribe to: ${item.name}`,
        image: item.image,
        handler: async () => {
          try {
            toast.success(`Successfully subscribed to ${item.name}!`);
            resetModalState();
            onSuccess();
            onClose();
          } catch (err) {
            console.error("Subscription completion error:", err);
            setError("Subscription activation failed");
            toast.error("Subscription activation failed");
          } finally {
            setLoading(false);
          }
        },
        modal: { ondismiss: () => setLoading(false) },
        theme: { color: "var(--brand)" },
        prefill: {
          name: userData.name,
          email: userData.email,
          contact: await getRazorpayContactForCurrentUser(),
        },
        notes: { item_type: itemType, item_id: item._id, org_id: orgId, item_name: item.name },
      };

      const rzp = new (windowWithRazorpay.Razorpay as RazorpayClass)(rzpOptions);
      rzp.open();
    } catch (error) {
      console.error("Payment initiation failed:", error);
      setError(error instanceof Error ? error.message : "Payment initiation failed");
      toast.error(error instanceof Error ? error.message : "Payment initiation failed");
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!plan) {
      setError("No subscription plan available");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create subscription using our backend
      const response = await subscribeToItem(orgId, {
        planId: plan._id,
      });

      const { razorpaySubscriptionId, razorpayKeyId } = response;

      // If backend returns an invoiceId, show payment method selector
      if (response.invoiceId) {
        setInvoiceId(response.invoiceId);
        setOrderData({ key: razorpayKeyId, currency: plan?.currency || item.currency || "INR" });
        setShowPaymentSelector(true);
        setLoading(false);
        return;
      }

      // Load Razorpay SDK dynamically if not already loaded
      const windowWithRazorpay = window as { Razorpay?: unknown };
      if (!windowWithRazorpay.Razorpay) {
        const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
        if (!existingScript) {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.async = true;
          document.body.appendChild(script);
        }

        await new Promise((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 50;
          const checkRazorpay = () => {
            if (windowWithRazorpay.Razorpay) {
              resolve(true);
            } else if (attempts >= maxAttempts) {
              reject(new Error("Razorpay SDK loading timeout"));
            } else {
              attempts++;
              setTimeout(checkRazorpay, 100);
            }
          };
          checkRazorpay();
        });
      }

      if (!windowWithRazorpay.Razorpay) {
        throw new Error("Razorpay SDK failed to load");
      }

      // Initialize Razorpay checkout for subscription
      const options: RazorpaySubscriptionOptions = {
        key: razorpayKeyId,
        subscription_id: razorpaySubscriptionId,
        name: `${ITEM_TYPE_LABELS[itemType]} Subscription`,
        description: `Subscribe to: ${item.name}`,
        image: item.image,
        handler: async (handlerResponse) => {
          try {
            // The webhook will handle subscription activation
            // We just need to show success message
            toast.success(`Successfully subscribed to ${item.name}!`);
            onSuccess();
            onClose();
          } catch (err) {
            console.error("Subscription completion error:", err);
            setError("Subscription activation failed");
            toast.error("Subscription activation failed");
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
        theme: {
          color: "var(--brand)",
        },
        prefill: {
          name: userData.name,
          email: userData.email,
          contact: await getRazorpayContactForCurrentUser(),
        },
        notes: {
          item_type: itemType,
          item_id: item._id,
          org_id: orgId,
          item_name: item.name,
        },
      };

      const rzp = new (windowWithRazorpay.Razorpay as RazorpayClass)(options);
      rzp.open();
    } catch (err) {
      console.error("Subscription failed:", err);
      setError(err instanceof Error ? err.message : "Subscription failed");
      toast.error(err instanceof Error ? err.message : "Subscription failed");
      setLoading(false);
    }
  };

  const formatCurrency = (value: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(value / 100); // Amount is in paise
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60]">
      <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Subscribe</h2>
          <button
            onClick={() => {
              resetModalState();
              onClose();
            }}
            className="p-2 hover:bg-[#1a1a22] rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {loadingPlan ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand" />
          </div>
        ) : error && !plan ? (
          <div className="text-center py-8">
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg mb-4">
              <div className="text-red-400 text-sm">{error}</div>
            </div>
            <Button
              onClick={onClose}
              variant="outline"
              className="border-[#2a2a35] text-white hover:bg-[#1a1a22]"
            >
              Close
            </Button>
          </div>
        ) : (
          <>
            {/* Item Info */}
            <div className="mb-6 p-4 bg-[#1a1a22] border border-[#2a2a35] rounded-lg">
              {item.image && (
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-32 object-cover rounded-lg mb-3"
                />
              )}
              <div className="flex items-center gap-2 mb-2">
                {ITEM_TYPE_ICONS[itemType]}
                <h3 className="font-semibold text-white">{item.name}</h3>
              </div>
              {item.description && (
                <p className="text-sm text-[#9fa0b8] mb-4 line-clamp-2">{item.description}</p>
              )}

              {/* Plan Details */}
              {plan && (
                <div className="space-y-3 pt-3 border-t border-[#2a2a35]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#9fa0b8]">Billing</span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                      <RefreshCw className="w-4 h-4 text-blue-400" />
                      {PERIOD_LABELS[plan.period]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#9fa0b8]">Price</span>
                    <span className="text-lg font-bold text-brand">
                      {formatCurrency(plan.amount, plan.currency)}
                      <span className="text-sm font-normal text-[#9fa0b8]">/{plan.period}</span>
                    </span>
                  </div>
                  {plan.totalCount && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#9fa0b8]">Total cycles</span>
                      <span className="text-sm text-white">{plan.totalCount}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <div className="text-red-400 text-sm">{error}</div>
                </div>
              )}

              {/* Subscribe Button or Payment Method Selector */}
              {showPaymentSelector && invoiceId ? (
                <div>
                  <button
                    onClick={() => { setShowPaymentSelector(false); setInvoiceId(null); setOrderData(null); }}
                    className="flex items-center gap-1 text-sm text-[#9fa0b8] hover:text-white mb-3 transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Back</span>
                  </button>
                  <PaymentMethodSelector
                    invoiceId={invoiceId}
                    itemCurrency={orderData?.currency || plan?.currency || item.currency || "INR"}
                    totalAmount={plan?.amount || 0}
                    onPaymentInitiated={handlePaymentInitiated}
                    onError={(errMsg) => { setError(errMsg); toast.error(errMsg); }}
                    disabled={loading}
                  />
                </div>
              ) : (
                <Button
                  onClick={handleSubscribe}
                  disabled={loading || !plan}
                  className="w-full bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      <span>
                        Subscribe for {plan ? formatCurrency(plan.amount, plan.currency) : "..."}/{plan?.period || "..."}
                      </span>
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Benefits */}
            <div className="mt-6 p-4 bg-brand/10 border border-brand/30 rounded-lg">
              <h4 className="text-sm font-medium text-brand mb-2">What you get:</h4>
              <ul className="text-sm text-[#9fa0b8] space-y-1">
                <li className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-green-400" />
                  Auto-renewal - never lose access
                </li>
                <li className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                  Automatic payments - no manual hassle
                </li>
                <li>• Full access to all {itemType} content</li>
                <li>• Exclusive updates and features</li>
                <li>• Cancel anytime</li>
              </ul>
            </div>

            {/* Payment Info */}
            <div className="mt-4 text-xs text-[#9fa0b8] text-center">
              <p>Secure payments powered by Razorpay</p>
              <p className="mt-1">You can cancel your subscription at any time</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

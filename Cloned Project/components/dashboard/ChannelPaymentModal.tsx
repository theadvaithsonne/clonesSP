"use client";

import { useState } from "react";
import { X, Loader2, CreditCard, Rss, Tag, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { getRazorpayContactForCurrentUser } from "@/lib/razorpayPrefill";
import { sanitizeDescription } from "@/lib/sanitizeDescription";

interface RazorpayOptions {
  key: string;
  amount?: number;
  currency?: string;
  order_id?: string;
  name: string;
  description: string;
  handler: (response: {
    razorpay_order_id?: string;
    razorpay_subscription_id?: string;
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
  subscription_id?: string;
  notes?: Record<string, string>;
  image?: string;
}

interface RazorpayClass {
  new (options: RazorpayOptions): {
    open: () => void;
  };
}

interface Channel {
  _id: string;
  title: string;
  description?: string;
  price: number;
  currency?: string;
  coverImage?: string;
  isFree: boolean;
  isSubscription: boolean;
  subscriptionPeriod?: 'monthly' | 'quarterly' | 'yearly';
  allowPayWhatYouWant?: boolean;
}

interface ChannelPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel;
  storeId: string;
  customerData: {
    customerId?: string;
    customerName: string;
    customerEmail: string;
  };
  onSuccess: () => void;
}

export function ChannelPaymentModal({
  isOpen,
  onClose,
  channel,
  storeId,
  customerData,
  onSuccess,
}: ChannelPaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payWhatYouWantAmount, setPayWhatYouWantAmount] = useState("");
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [orderData, setOrderData] = useState<{ key?: string; currency?: string } | null>(null);

  const finalPrice = channel.price ?? 0;
  const isPayWhatYouWant = channel.allowPayWhatYouWant;

  const CUSTOMER_APP_URL = process.env.NEXT_PUBLIC_CUSTOMER_APP_URL || "http://localhost:3001";

  // Load Razorpay SDK and open checkout
  const loadAndOpenRazorpay = async (options: {
    key: string;
    amount: number;
    currency: string;
    orderId?: string;
    subscriptionId?: string;
    isSubscription?: boolean;
  }) => {
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

    const rzpOptions: RazorpayOptions = {
      key: options.key,
      amount: options.amount,
      currency: options.currency,
      order_id: options.orderId,
      subscription_id: options.subscriptionId,
      name: options.isSubscription ? "Channel Subscription" : "Channel Subscription",
      description: `Subscribe to: ${channel.title}`,
      image: channel.coverImage,
      handler: async (response) => {
        try {
          const verifyEndpoint = options.isSubscription
            ? `${CUSTOMER_APP_URL}/api/razorpay/verify-subscription-payment`
            : `${CUSTOMER_APP_URL}/api/razorpay/verify-channel-payment`;

          const verifyBody = options.isSubscription
            ? {
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                channelId: channel._id,
                storeId,
                ...customerData,
              }
            : {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                channelId: channel._id,
                storeId,
                ...customerData,
              };

          const verifyResponse = await fetch(verifyEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.NEXT_PUBLIC_EXTERNAL_API_KEY || "",
            },
            body: JSON.stringify(verifyBody),
          });

          if (verifyResponse.ok) {
            toast.success(`Successfully subscribed to ${channel.title}!`);
            resetModalState();
            onSuccess();
            onClose();
          } else {
            const errorData = await verifyResponse.json();
            setError(errorData.error || "Payment verification failed");
            toast.error("Payment verification failed");
          }
        } catch (error) {
          console.error("Payment verification error:", error);
          setError("Payment verification failed");
          toast.error("Payment verification failed");
        } finally {
          setLoading(false);
        }
      },
      modal: { ondismiss: () => setLoading(false) },
      theme: { color: "var(--brand)" },
      prefill: {
        name: customerData.customerName,
        email: customerData.customerEmail,
        contact: await getRazorpayContactForCurrentUser(),
      },
      notes: { channel_id: channel._id, store_id: storeId, channel_title: channel.title },
    };

    const rzp = new (windowWithRazorpay.Razorpay as RazorpayClass)(rzpOptions);
    rzp.open();
  };

  const resetModalState = () => {
    setInvoiceId(null);
    setShowPaymentSelector(false);
    setOrderData(null);
    setError(null);
    setPayWhatYouWantAmount("");
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

      await loadAndOpenRazorpay({
        key,
        amount: data.amount,
        currency: data.currency,
        orderId: data.razorpayOrderId || "",
        subscriptionId: data.razorpaySubscriptionId,
      });
    } catch (error) {
      console.error("Payment initiation failed:", error);
      setError(error instanceof Error ? error.message : "Payment initiation failed");
      toast.error(error instanceof Error ? error.message : "Payment initiation failed");
      setLoading(false);
    }
  };

  const handleSubscribeChannel = async () => {
    let purchaseAmount = finalPrice;

    // Handle pay-what-you-want pricing
    if (isPayWhatYouWant) {
      const customAmount = parseFloat(payWhatYouWantAmount);
      if (!customAmount || customAmount <= 0) {
        setError("Please enter a valid amount");
        return;
      }
      if (customAmount < finalPrice) {
        setError(`Minimum amount is $${finalPrice}`);
        return;
      }
      purchaseAmount = customAmount;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if this is a subscription channel
      if (channel.isSubscription) {
        // Create Razorpay subscription
        const subscriptionResponse = await fetch(`${CUSTOMER_APP_URL}/api/razorpay/create-subscription`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.NEXT_PUBLIC_EXTERNAL_API_KEY || "",
          },
          body: JSON.stringify({
            channelId: channel._id,
            storeId,
            ...customerData,
          }),
        });

        if (!subscriptionResponse.ok) {
          const errorData = await subscriptionResponse.json();
          throw new Error(errorData.error || "Failed to create subscription");
        }

        const subscription = await subscriptionResponse.json();

        // If backend returns an invoiceId, show payment method selector
        if (subscription.invoiceId) {
          setInvoiceId(subscription.invoiceId);
          setOrderData({ key: subscription.key, currency: subscription.currency || channel.currency || "INR" });
          setShowPaymentSelector(true);
          setLoading(false);
          return;
        }

        // Fallback: direct Razorpay subscription flow
        await loadAndOpenRazorpay({
          key: subscription.key,
          amount: 0,
          currency: subscription.currency || channel.currency || "INR",
          subscriptionId: subscription.subscriptionId,
          isSubscription: true,
        });
        return;
      }

      // For one-time purchases, create Razorpay order
      const orderResponse = await fetch(`${CUSTOMER_APP_URL}/api/razorpay/create-channel-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.NEXT_PUBLIC_EXTERNAL_API_KEY || "",
        },
        body: JSON.stringify({
          channelId: channel._id,
          storeId,
          customAmount: isPayWhatYouWant ? purchaseAmount : undefined,
          ...customerData,
        }),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        throw new Error(errorData.error || "Failed to create order");
      }

      const order = await orderResponse.json();

      // If backend returns an invoiceId, show payment method selector
      if (order.invoiceId) {
        setInvoiceId(order.invoiceId);
        setOrderData({ key: order.key, currency: order.currency || channel.currency || "INR" });
        setShowPaymentSelector(true);
        setLoading(false);
        return;
      }

      // Fallback: direct Razorpay flow (no invoice)
      await loadAndOpenRazorpay({
        key: order.key,
        amount: isPayWhatYouWant ? purchaseAmount * 100 : order.amount,
        currency: order.currency,
        orderId: order.orderId,
      });
    } catch (error) {
      console.error("Payment failed:", error);
      setError(error instanceof Error ? error.message : "Payment failed");
      toast.error(error instanceof Error ? error.message : "Payment failed");
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: channel.currency || "USD",
    }).format(value);
  };

  const getSubscriptionPeriodLabel = () => {
    switch (channel.subscriptionPeriod) {
      case "yearly":
        return "year";
      case "quarterly":
        return "3 months";
      default:
        return "month";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60]">
      <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Subscribe to Channel</h2>
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

        {/* Channel Info */}
        <div className="mb-6 p-4 bg-[#1a1a22] border border-[#2a2a35] rounded-lg">
          {channel.coverImage && (
            <img
              src={channel.coverImage}
              alt={channel.title}
              className="w-full h-32 object-cover rounded-lg mb-3"
            />
          )}
          <div className="flex items-center gap-2 mb-2">
            <Rss className="w-5 h-5 text-brand" />
            <h3 className="font-semibold text-white">{channel.title}</h3>
          </div>
          {channel.description && (
            <p 
              className="text-sm text-[#9fa0b8] mb-4 [&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_p]:mb-2 [&_a]:text-brand [&_a]:hover:underline"
              dangerouslySetInnerHTML={{ __html: sanitizeDescription(channel.description) }}
            />
          )}

          {/* Pricing Display */}
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-lg font-bold text-brand">{formatCurrency(finalPrice)}</span>

            {channel.isSubscription && (
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full uppercase">
                {channel.subscriptionPeriod || "monthly"} subscription
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Pay What You Want Input */}
          {isPayWhatYouWant && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#9fa0b8] flex items-center gap-1">
                <Tag className="w-4 h-4" />
                <span>Pay What You Want (Minimum: {formatCurrency(finalPrice)})</span>
              </label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={payWhatYouWantAmount}
                onChange={(e) => setPayWhatYouWantAmount(e.target.value)}
                min={finalPrice}
                step="1"
                disabled={loading}
                className="bg-[#1a1a22] border-[#2a2a35] text-white"
              />
              {payWhatYouWantAmount && parseFloat(payWhatYouWantAmount) >= finalPrice && (
                <div className="text-sm text-green-400">
                  You&apos;ll pay: {formatCurrency(parseFloat(payWhatYouWantAmount))}
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
              <div className="text-red-400 text-sm">{error}</div>
            </div>
          )}

          {/* Subscribe / Pay Button or Payment Method Selector */}
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
                itemCurrency={orderData?.currency || channel.currency || "INR"}
                totalAmount={finalPrice * 100}
                onPaymentInitiated={handlePaymentInitiated}
                onError={(errMsg) => { setError(errMsg); toast.error(errMsg); }}
                disabled={loading}
              />
            </div>
          ) : (
            <Button
              onClick={handleSubscribeChannel}
              disabled={loading || (isPayWhatYouWant && (!payWhatYouWantAmount || parseFloat(payWhatYouWantAmount) < finalPrice))}
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
                    {channel.isSubscription ? "Subscribe for " : "Pay "}
                    {isPayWhatYouWant && payWhatYouWantAmount
                      ? formatCurrency(parseFloat(payWhatYouWantAmount))
                      : formatCurrency(finalPrice)}
                    {channel.isSubscription ? `/${getSubscriptionPeriodLabel()}` : ""}
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
            <li>• Full access to channel content</li>
            <li>• Exclusive posts and updates</li>
            <li>• Access to channel products</li>
            <li>• Access to channel courses</li>
            <li>• Access to channel workshops</li>
            {channel.isSubscription ? (
              <>
                <li>• Recurring {channel.subscriptionPeriod === "yearly" ? "yearly" : channel.subscriptionPeriod === "quarterly" ? "quarterly" : "monthly"} billing</li>
                <li>• Cancel anytime</li>
              </>
            ) : (
              <li>• One-time payment, lifetime access</li>
            )}
          </ul>
        </div>

        {/* Razorpay Info */}
        <div className="mt-4 text-xs text-[#9fa0b8] text-center">
          Powered by Razorpay - Secure payment processing
        </div>
      </div>
    </div>
  );
}

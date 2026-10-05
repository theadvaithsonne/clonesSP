"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import Script from "next/script";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getOrgId, getToken, getUserIdFromToken } from "@/lib/auth";
import {
  DollarSign,
  CreditCard,
  FileText,
  Gift,
  Settings,
  BarChart3,
  Info,
  Wallet,
  Plus,
  Zap,
  Shield,
  AlertCircle,
  Loader2,
  Bot,
  Briefcase,
  ClipboardCheck,
  ArrowDownCircle,
} from "lucide-react";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";

// ─── API types ────────────────────────────────────────────────────────────────

interface AgentSummary {
  agent_id: string;
  agent_name: string;
  lifetime_cost: number;
  current_month_cost: number;
  current_month_tokens: number;
  tasks_ran: number;
  jobs_ran: number;
  top_model: string;
}

interface MonthlyChartEntry {
  month: string;
  agent_id: string;
  agent_name: string;
  total_cost: number;
  total_tokens: number;
}

// ─── Static / mock data (non-usage tabs) ─────────────────────────────────────

const paymentMethods = [
  { id: 1, type: "Visa",       last4: "4242", expiry: "12/27", isDefault: true  },
  { id: 2, type: "Mastercard", last4: "8888", expiry: "06/26", isDefault: false },
];


const creditGrants = [
  { id: 1, name: "Welcome Credit",     amount: 50,  remaining: 12.40, expires: "Mar 31, 2026", status: "Active"  },
  { id: 2, name: "Referral Bonus",     amount: 25,  remaining:  4.72, expires: "Jun 30, 2026", status: "Active"  },
  { id: 3, name: "Beta Tester Reward", amount: 100, remaining:  0,    expires: "Dec 31, 2025", status: "Expired" },
];

const preferences = [
  { label: "Invoice email",    value: "admin@company.com" },
  { label: "Business name",   value: "Acme Corp" },
  { label: "Tax ID",          value: "US-EIN ••••5678" },
  { label: "Billing address", value: "123 Innovation Dr, San Francisco, CA 94105" },
  { label: "Currency",        value: "USD ($)" },
];

const usageLimits = { monthlyBudget: 200, currentSpend: 96.25, alertThreshold: 80 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

/** Deterministic accent colour derived from agent_id */
function agentColor(id: string): string {
  const hues = [260, 200, 25, 340, 150, 85, 45, 190, 310, 60];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffff;
  return `hsl(${hues[hash % hues.length]} 60% 65%)`;
}

function AgentBadge({ name, agentId }: { name: string; agentId: string }) {
  const color = agentColor(agentId);
  const bg    = color.replace("hsl(", "hsla(").replace(")", " / 0.12)");
  const border= color.replace("hsl(", "hsla(").replace(")", " / 0.25)");
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border"
      style={{ backgroundColor: bg, color, borderColor: border }}
    >
      <Bot className="h-2.5 w-2.5" />
      {name}
    </span>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-white mb-4">{children}</h2>;
}

function PanelCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-[#2a2a35] bg-[#0e0e12] ${className}`}>
      {children}
    </div>
  );
}

// ─── Static tabs ──────────────────────────────────────────────────────────────

interface WalletTransaction {
  type: "credit" | "debit";
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

function OverviewTab() {
  const [balanceCents, setBalanceCents] = useState(0);
  const [debtCents, setDebtCents] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [addAmount, setAddAmount] = useState("");
  const [addingCredits, setAddingCredits] = useState(false);

  // Invoice-based payment state
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [paymentOrderData, setPaymentOrderData] = useState<{ key?: string; currency?: string; amount?: number } | null>(null);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await fetch("/api/openclaw/wallet", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBalanceCents(data.balanceCents ?? 0);
        setDebtCents(data.debtCents ?? 0);
        setTransactions(data.transactions ?? []);
      }
    } catch {
      // silent
    } finally {
      setWalletLoading(false);
    }
  }, []);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  // Helper: load Razorpay SDK
  const loadRazorpayScript = async (): Promise<boolean> => {
    if ((window as any).Razorpay) return true;
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
    return new Promise((resolve) => {
      let attempts = 0;
      const check = () => {
        if ((window as any).Razorpay) resolve(true);
        else if (attempts >= 50) resolve(false);
        else { attempts++; setTimeout(check, 100); }
      };
      check();
    });
  };

  // Helper: open Razorpay checkout
  const openRazorpayCheckout = async (opts: {
    key: string; amount: number; currency: string; orderId: string;
    name: string; description: string; subscriptionId?: string;
    onVerify: (response: any) => Promise<void>;
  }) => {
    const loaded = await loadRazorpayScript();
    if (!loaded || !(window as any).Razorpay) throw new Error("Payment gateway not available");
    const { getRazorpayContactForCurrentUser } = await import("@/lib/razorpayPrefill");
    const rzpOptions: any = {
      key: opts.key, amount: opts.amount, currency: opts.currency,
      order_id: opts.orderId, name: opts.name, description: opts.description,
      handler: opts.onVerify,
      modal: { ondismiss: () => setAddingCredits(false) },
      theme: { color: "var(--brand)" },
      prefill: { contact: await getRazorpayContactForCurrentUser() },
    };
    if (opts.subscriptionId) rzpOptions.subscription_id = opts.subscriptionId;
    const razorpay = new (window as any).Razorpay(rzpOptions);
    razorpay.open();
  };

  // Called by PaymentMethodSelector after user selects currency + method
  const handlePaymentInitiated = async (data: {
    razorpayOrderId?: string; razorpayKeyId?: string; razorpaySubscriptionId?: string;
    shortUrl?: string; cryptoPaymentUrl?: string;
    walletPaid?: boolean; stripePaid?: boolean;
    amount: number; currency: string; invoiceId: string;
  }) => {
    if (data.walletPaid || data.stripePaid) {
      toast.success("Payment complete!");
      setAddingCredits(false);
      return;
    }
    if (data.cryptoPaymentUrl) {
      window.open(data.cryptoPaymentUrl, "_blank");
      toast.info("Complete your crypto payment in the new tab. The invoice will update automatically once confirmed.");
      setAddingCredits(false);
      return;
    }
    const dollars = parseFloat(addAmount);
    try {
      if (data.shortUrl) { window.open(data.shortUrl, "_blank"); return; }
      const key = data.razorpayKeyId || paymentOrderData?.key || "";
      if (!key) throw new Error("Missing Razorpay key");
      await openRazorpayCheckout({
        key, amount: data.amount, currency: data.currency,
        orderId: data.razorpayOrderId || "",
        name: "Garage AI Wallet",
        description: `Add $${dollars.toFixed(2)} credits`,
        subscriptionId: data.razorpaySubscriptionId,
        onVerify: async (response: any) => {
          await fetch("/api/openclaw/wallet/verify-payment", {
            method: "POST",
            headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amountCents: Math.round(dollars * 100),
            }),
          });
          setAddAmount("");
          setShowPaymentSelector(false);
          setInvoiceId(null);
          setPaymentOrderData(null);
          fetchWallet();
          setAddingCredits(false);
        },
      });
    } catch (err) {
      console.error("Payment initiation failed:", err);
      setAddingCredits(false);
    }
  };

  const handleAddCredits = async () => {
    const dollars = parseFloat(addAmount);
    if (!dollars || dollars <= 0) return;
    setAddingCredits(true);
    try {
      const orderRes = await fetch("/api/openclaw/wallet/create-order", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amountDollars: dollars }),
      });
      const order = await orderRes.json();
      if (!order.orderId) throw new Error("Failed to create order");

      // If backend returns an invoiceId, show payment method selector
      if (order.invoiceId) {
        setInvoiceId(order.invoiceId);
        setPaymentOrderData({ key: order.keyId, currency: order.currency || "USD", amount: order.amount });
        setShowPaymentSelector(true);
        setAddingCredits(false);
        return;
      }

      // Fallback: direct Razorpay flow
      await openRazorpayCheckout({
        key: order.keyId, amount: order.amount, currency: order.currency,
        orderId: order.orderId,
        name: "Garage AI Wallet",
        description: `Add $${dollars.toFixed(2)} credits`,
        onVerify: async (response: any) => {
          await fetch("/api/openclaw/wallet/verify-payment", {
            method: "POST",
            headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amountCents: Math.round(dollars * 100),
            }),
          });
          setAddAmount("");
          fetchWallet();
          setAddingCredits(false);
        },
      });
    } catch (err) {
      console.error("Add credits error:", err);
    } finally {
      setAddingCredits(false);
    }
  };

  const balanceDollars = (balanceCents / 100).toFixed(2);
  const debtDollars = (debtCents / 100).toFixed(2);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Balance card */}
      <PanelCard className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="h-4 w-4 text-brand" />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#5a5a72]">Credit Balance</span>
        </div>
        {walletLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
        ) : (
          <>
            <p className="text-3xl font-bold text-white">${balanceDollars}</p>
            {debtCents > 0 && (
              <p className="text-xs text-red-400">
                Outstanding debt: ${debtDollars} (max $2.00)
              </p>
            )}
          </>
        )}
        <p className="text-xs text-[#9fa0b8]">
          Pay-as-you-go · When balance reaches $0, scheduled Ai Employee jobs will pause.
        </p>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="number"
            min="1"
            step="1"
            placeholder="$ Amount"
            value={addAmount}
            onChange={(e) => setAddAmount(e.target.value)}
            className="h-7 w-24 rounded-md border border-[#2a2a35] bg-[#15151b] px-2 text-xs text-white placeholder-[#5a5a72] focus:outline-none focus:border-brand/50"
          />
          <Button
            size="sm"
            disabled={addingCredits || !addAmount || parseFloat(addAmount) <= 0}
            onClick={handleAddCredits}
            className="h-7 px-3 text-[10px] bg-brand/10 hover:bg-brand/20 text-brand border border-brand/30 gap-1"
          >
            {addingCredits ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Add credits
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-3 text-[10px] text-[#9fa0b8] hover:text-white border border-[#2a2a35]">
            Enable auto-recharge
          </Button>
        </div>

        {/* Payment Method Selector */}
        {showPaymentSelector && invoiceId && (
          <div className="mt-3 pt-3 border-t border-[#2a2a35]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#9fa0b8]">Select Payment Method</span>
              <button
                onClick={() => { setShowPaymentSelector(false); setInvoiceId(null); setPaymentOrderData(null); }}
                className="text-xs text-[#9fa0b8] hover:text-white"
              >
                Cancel
              </button>
            </div>
            <PaymentMethodSelector
              invoiceId={invoiceId}
              itemCurrency={paymentOrderData?.currency || "USD"}
              totalAmount={paymentOrderData?.amount || 0}
              onPaymentInitiated={handlePaymentInitiated}
              onError={(errMsg) => { console.error(errMsg); }}
              disabled={addingCredits}
            />
          </div>
        )}
      </PanelCard>

      {/* Debt warning */}
      {debtCents > 0 && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-400">
            Your wallet has ${debtDollars} in debt. Add credits to clear the debt and resume usage. Debt limit is $2.00.
          </p>
        </div>
      )}

      {/* Auto-recharge info */}
      {debtCents === 0 && (
        <div className="rounded-lg border border-[#2a2a35] bg-[#15151b] p-3 flex items-start gap-2.5">
          <Info className="h-4 w-4 text-[#9fa0b8] mt-0.5 shrink-0" />
          <p className="text-xs text-[#9fa0b8]">
            Auto-recharge is <span className="text-white font-medium">off</span>. Enable it to keep your Ai Employees running uninterrupted.
          </p>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {[
          { icon: CreditCard, label: "Payment methods",  desc: "Add or change payment method" },
          { icon: FileText,   label: "Billing history",   desc: "View past and current invoices" },
          { icon: Settings,   label: "Preferences",       desc: "Manage billing information" },
          { icon: Zap,        label: "Usage limits",       desc: "Set monthly spend limits" },
          { icon: BarChart3,  label: "Usage",              desc: "Spend breakdown by Ai Employee" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg border border-[#2a2a35] bg-[#0e0e12] hover:border-brand/30 transition-colors cursor-pointer group">
            <div className="h-8 w-8 rounded-md bg-[#15151b] border border-[#2a2a35] flex items-center justify-center shrink-0">
              <item.icon className="h-4 w-4 text-[#5a5a72] group-hover:text-brand transition-colors" />
            </div>
            <div>
              <p className="text-xs font-medium text-white">{item.label}</p>
              <p className="text-[10px] text-[#5a5a72]">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent transactions */}
      {transactions.length > 0 && (
        <PanelCard className="overflow-hidden">
          <div className="px-3 py-2 bg-[#15151b] border-b border-[#2a2a35] flex items-center gap-2">
            <ArrowDownCircle className="h-3.5 w-3.5 text-brand" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[#5a5a72]">Recent Transactions</span>
          </div>
          <div className="max-h-[240px] overflow-y-auto">
            {transactions.slice(0, 20).map((tx, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a35] last:border-b-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${tx.type === "credit" ? "bg-emerald-400" : "bg-red-400"}`} />
                  <span className="text-[10px] text-[#9fa0b8] truncate">{tx.description}</span>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className={`text-xs font-medium ${tx.type === "credit" ? "text-emerald-400" : "text-red-400"}`}>
                    {tx.type === "credit" ? "+" : "-"}${(tx.amount / 100).toFixed(2)}
                  </span>
                  <p className="text-[9px] text-[#5a5a72]">Bal: ${(tx.balanceAfter / 100).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      )}
    </motion.div>
  );
}

function PaymentMethodsTab() {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeading>Payment Methods</SectionHeading>
        <Button size="sm" className="h-7 px-3 text-[10px] bg-brand/10 hover:bg-brand/20 text-brand border border-brand/30 gap-1">
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      <div className="space-y-2">
        {paymentMethods.map((pm) => (
          <PanelCard key={pm.id} className="flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-[#15151b] border border-[#2a2a35] flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-[#5a5a72]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-white">{pm.type} ••••{pm.last4}</p>
                  {pm.isDefault && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-brand border-brand/30">Default</Badge>
                  )}
                </div>
                <p className="text-[10px] text-[#5a5a72]">Expires {pm.expiry}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-[#9fa0b8] hover:text-white">Edit</Button>
          </PanelCard>
        ))}
      </div>
    </motion.div>
  );
}

type CategoryFilter = "all" | "subscription" | "chat" | "cron";

interface TransactionRow {
  id: string;
  user_id: string;
  agent_id: string | null;
  agent_name: string | null;
  type: string;
  amount_cents: number;
  description: string;
  status: string;
  balance_after_cents: number | null;
  created_at: string;
}

function txnCategory(t: TransactionRow): CategoryFilter {
  if (t.type.startsWith("subscription")) return "subscription";
  if (t.description?.includes("scheduled task")) return "cron";
  return "chat";
}

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: "All",
  subscription: "Subscriptions",
  chat: "Chat",
  cron: "Cron Jobs",
};

const CATEGORY_COLORS: Record<CategoryFilter, string> = {
  all: "",
  subscription: "text-violet-400 border-violet-400/30",
  chat: "text-sky-400 border-sky-400/30",
  cron: "text-amber-400 border-amber-400/30",
};

function BillingHistoryTab() {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CategoryFilter>("all");

  const authHeaders = {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  };

  useEffect(() => {
    (async () => {
      try {
        const userId = getUserIdFromToken();
        const orgId = getOrgId();
        const params = new URLSearchParams();
        if (userId) params.set("user_id", userId);
        if (orgId) params.set("org_id", orgId);
        params.set("limit", "200");

        const res = await fetch(`/api/billing/transactions?${params}`, { headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          setTransactions(Array.isArray(data) ? data : []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = filter === "all" ? transactions : transactions.filter((t) => txnCategory(t) === filter);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeading>Billing History</SectionHeading>
        <div className="flex gap-1">
          {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                filter === cat
                  ? "bg-brand/10 text-brand border-brand/30"
                  : "text-[#9fa0b8] border-[#2a2a35] hover:text-white hover:border-[#3a3a45]"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      <PanelCard className="overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-2 bg-[#15151b] border-b border-[#2a2a35] text-[9px] uppercase tracking-wider font-semibold text-[#5a5a72]">
          <span>Description</span><span>Date</span><span>Amount</span><span>Balance</span><span>Status</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#5a5a72]">No transactions found.</div>
        ) : (
          filtered.map((t) => {
            const cat = txnCategory(t);
            const date = t.created_at
              ? new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "—";
            const amountDollars = (t.amount_cents / 100).toFixed(2);
            const balanceDollars = t.balance_after_cents != null ? (t.balance_after_cents / 100).toFixed(2) : "—";
            return (
              <div
                key={t.id}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-2.5 border-b border-[#2a2a35] last:border-b-0 hover:bg-[#15151b] transition-colors items-center"
              >
                <div>
                  <p className="text-xs text-white font-medium truncate">{t.description}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className={`text-[8px] h-3.5 px-1 ${CATEGORY_COLORS[cat]}`}>
                      {CATEGORY_LABELS[cat]}
                    </Badge>
                    {t.agent_name && (
                      <span className="text-[9px] text-[#5a5a72]">{t.agent_name}</span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-[#9fa0b8] whitespace-nowrap">{date}</span>
                <span className="text-xs text-white font-medium whitespace-nowrap">${amountDollars}</span>
                <span className="text-[10px] text-[#9fa0b8] whitespace-nowrap">${balanceDollars}</span>
                <Badge
                  variant="outline"
                  className={`text-[9px] h-4 px-1.5 ${
                    t.status === "success"
                      ? "text-emerald-400 border-emerald-400/30"
                      : "text-red-400 border-red-400/30"
                  }`}
                >
                  {t.status === "success" ? "Paid" : "Failed"}
                </Badge>
              </div>
            );
          })
        )}
      </PanelCard>
    </motion.div>
  );
}

function CreditGrantsTab() {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <SectionHeading>Credit Grants</SectionHeading>
      <div className="space-y-2">
        {creditGrants.map((cg) => {
          const pct = cg.amount > 0 ? (cg.remaining / cg.amount) * 100 : 0;
          return (
            <PanelCard key={cg.id} className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="h-3.5 w-3.5 text-brand" />
                  <span className="text-xs font-medium text-white">{cg.name}</span>
                </div>
                <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${cg.status === "Active" ? "text-emerald-400 border-emerald-400/30" : "text-[#5a5a72] border-[#2a2a35]"}`}>
                  {cg.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#5a5a72]">
                <span>${cg.remaining.toFixed(2)} / ${cg.amount.toFixed(2)} remaining</span>
                <span>Expires {cg.expires}</span>
              </div>
              <Progress value={pct} className="h-1" />
            </PanelCard>
          );
        })}
      </div>
    </motion.div>
  );
}

function PreferencesTab() {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <SectionHeading>Preferences</SectionHeading>
      <PanelCard className="divide-y divide-[#2a2a35]">
        {preferences.map((pref) => (
          <div key={pref.label} className="flex items-center justify-between px-3 py-2.5">
            <div>
              <p className="text-xs font-medium text-white">{pref.label}</p>
              <p className="text-[10px] text-[#5a5a72]">{pref.value}</p>
            </div>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-[#9fa0b8] hover:text-white">Edit</Button>
          </div>
        ))}
      </PanelCard>

      <PanelCard className="p-3 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-3.5 w-3.5 text-brand" />
          <span className="text-xs font-semibold text-white">Usage Limits</span>
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-[#5a5a72] mb-1.5">
            <span>Monthly budget</span>
            <span className="text-white font-medium">${usageLimits.monthlyBudget}</span>
          </div>
          <Progress value={(usageLimits.currentSpend / usageLimits.monthlyBudget) * 100} className="h-1.5" />
          <div className="flex justify-between text-[10px] text-[#5a5a72] mt-1">
            <span>${usageLimits.currentSpend.toFixed(2)} spent</span>
            <span>${(usageLimits.monthlyBudget - usageLimits.currentSpend).toFixed(2)} remaining</span>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-md border border-[#2a2a35] bg-[#15151b] p-2.5">
          <AlertCircle className="h-3.5 w-3.5 text-[#9fa0b8] mt-0.5 shrink-0" />
          <p className="text-[10px] text-[#9fa0b8]">
            You'll be notified when spend reaches {usageLimits.alertThreshold}% of your monthly budget.
          </p>
        </div>
      </PanelCard>
    </motion.div>
  );
}

// ─── Stacked area chart ───────────────────────────────────────────────────────

interface TooltipState {
  x: number;
  y: number;
  month: string;
  entries: { agentName: string; agentId: string; tokens: number; cost: number }[];
}

function StackedAreaChart({ data }: { data: MonthlyChartEntry[] }) {
  const svgRef        = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Organise data: months × agents
  const months   = [...new Set(data.map((d) => d.month))].sort();
  const agentIds = [...new Set(data.map((d) => d.agent_id))];

  // Build maps: month → { agentId → tokens } and month → { agentId → cost }
  const byMonth:     Record<string, Record<string, number>> = {};
  const byMonthCost: Record<string, Record<string, number>> = {};
  for (const m of months) { byMonth[m] = {}; byMonthCost[m] = {}; }
  for (const e of data) {
    byMonth[e.month][e.agent_id]     = e.total_tokens;
    byMonthCost[e.month][e.agent_id] = e.total_cost;
  }

  // Stacked values: for each month, cumulative sum per agent layer
  const stacked: { month: string; layers: number[] }[] = months.map((m) => {
    let cum = 0;
    const layers = agentIds.map((id) => {
      cum += byMonth[m][id] ?? 0;
      return cum;
    });
    return { month: m, layers };
  });

  const maxVal = Math.max(...stacked.map((s) => s.layers[s.layers.length - 1] ?? 0), 1);

  // SVG viewport
  const W = 600, H = 200, PL = 52, PR = 16, PT = 12, PB = 32;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;

  const xPos = (i: number) => PL + (i / Math.max(months.length - 1, 1)) * chartW;
  const yPos = (v: number) => PT + chartH - (v / maxVal) * chartH;

  // Build SVG path for each layer (area between layer[k] and layer[k-1])
  function areaPath(layerIdx: number): string {
    const top    = stacked.map((s, i) => [xPos(i), yPos(s.layers[layerIdx] ?? 0)] as [number, number]);
    const bottom = layerIdx === 0
      ? stacked.map((_, i) => [xPos(i), yPos(0)] as [number, number])
      : stacked.map((s, i) => [xPos(i), yPos(s.layers[layerIdx - 1] ?? 0)] as [number, number]);

    const topPath    = top.map((p, i)    => (i === 0 ? `M ${p[0]},${p[1]}` : `L ${p[0]},${p[1]}`)).join(" ");
    const bottomPath = bottom.slice().reverse().map((p) => `L ${p[0]},${p[1]}`).join(" ");
    return `${topPath} ${bottomPath} Z`;
  }

  function linePath(layerIdx: number): string {
    return stacked
      .map((s, i) => `${i === 0 ? "M" : "L"} ${xPos(i)},${yPos(s.layers[layerIdx] ?? 0)}`)
      .join(" ");
  }

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    val: maxVal * f,
    y:   yPos(maxVal * f),
  }));

  // Mouse move handler
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    // Find nearest month index
    let nearestIdx = 0;
    let minDist = Infinity;
    months.forEach((_, i) => {
      const dist = Math.abs(mx - xPos(i));
      if (dist < minDist) { minDist = dist; nearestIdx = i; }
    });
    const month = months[nearestIdx];
    const entries = agentIds.map((id) => ({
      agentId:   id,
      agentName: data.find((d) => d.agent_id === id)?.agent_name ?? id,
      tokens:    byMonth[month][id] ?? 0,
      cost:      byMonthCost[month][id] ?? 0,
    })).filter((e) => e.tokens > 0 || e.cost > 0);

    setTooltip({
      x: xPos(nearestIdx),
      y: PT,
      month,
      entries,
    });
  }, [months, agentIds, byMonth, byMonthCost, data]); // eslint-disable-line

  return (
    <div className="relative w-full select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-2xl overflow-visible"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid lines */}
        {yTicks.map((t) => (
          <line key={t.val} x1={PL} y1={t.y} x2={W - PR} y2={t.y} stroke="#2a2a35" strokeWidth="1" />
        ))}

        {/* Stacked areas */}
        {agentIds.map((id, k) => {
          const color = agentColor(id);
          return (
            <path
              key={id}
              d={areaPath(k)}
              fill={color.replace("hsl(", "hsla(").replace(")", " / 0.18)")}
            />
          );
        })}

        {/* Stacked lines */}
        {agentIds.map((id, k) => (
          <path
            key={id}
            d={linePath(k)}
            fill="none"
            stroke={agentColor(id)}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((t) => (
          <text key={t.val} x={PL - 6} y={t.y + 4} textAnchor="end" fontSize="9" fill="#5a5a72">
            {formatTokens(Math.round(t.val))}
          </text>
        ))}

        {/* X-axis labels */}
        {months.map((m, i) => (
          <text key={m} x={xPos(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#5a5a72">
            {m.slice(0, 7)}
          </text>
        ))}

        {/* Hover vertical line + dots */}
        {tooltip && (
          <>
            <line
              x1={tooltip.x} y1={PT}
              x2={tooltip.x} y2={PT + chartH}
              stroke="#FBD10D" strokeWidth="1" strokeDasharray="3,3" opacity={0.6}
            />
            {agentIds.map((id, k) => {
              const monthIdx = months.indexOf(tooltip.month);
              if (monthIdx === -1) return null;
              const yv = yPos(stacked[monthIdx]?.layers[k] ?? 0);
              return (
                <circle key={id} cx={tooltip.x} cy={yv} r="3"
                  fill={agentColor(id)} stroke="#0e0e12" strokeWidth="1.5" />
              );
            })}
          </>
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && tooltip.entries.length > 0 && (
        <div
          className="pointer-events-none absolute z-20 rounded-lg border border-[#2a2a35] bg-[#15151b] shadow-xl p-3 min-w-[200px]"
          style={{
            left:      `calc(${(tooltip.x / W) * 100}% + 12px)`,
            top:       "8px",
            transform: tooltip.x / W > 0.6 ? "translateX(calc(-100% - 24px))" : undefined,
          }}
        >
          {/* Month heading */}
          <p className="text-[9px] uppercase tracking-widest font-semibold text-brand mb-2">
            {tooltip.month}
          </p>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 mb-1 pb-1 border-b border-[#2a2a35]">
            <span className="text-[8px] uppercase tracking-wider text-[#5a5a72]">Agent</span>
            <span className="text-[8px] uppercase tracking-wider text-[#5a5a72] text-right">Tokens</span>
            <span className="text-[8px] uppercase tracking-wider text-[#5a5a72] text-right">Cost</span>
          </div>

          {/* Per-agent rows */}
          {tooltip.entries.map((e) => (
            <div key={e.agentId} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center py-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: agentColor(e.agentId) }}
                />
                <span className="text-[10px] text-[#9fa0b8] truncate">{e.agentName}</span>
              </div>
              <span className="text-[10px] font-medium text-white text-right tabular-nums">
                {formatTokens(e.tokens)}
              </span>
              <span className="text-[10px] font-medium text-emerald-400 text-right tabular-nums">
                ${e.cost.toFixed(4)}
              </span>
            </div>
          ))}

          {/* Totals row */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center mt-1 pt-1.5 border-t border-[#2a2a35]">
            <span className="text-[9px] text-[#5a5a72] font-semibold">Total</span>
            <span className="text-[10px] font-semibold text-white text-right tabular-nums">
              {formatTokens(tooltip.entries.reduce((s, e) => s + e.tokens, 0))}
            </span>
            <span className="text-[10px] font-semibold text-emerald-400 text-right tabular-nums">
              ${tooltip.entries.reduce((s, e) => s + e.cost, 0).toFixed(4)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Usage tab — live API data ────────────────────────────────────────────────

function UsageTab() {
  const userId      = getUserIdFromToken() || "";
  const authHeaders = { Authorization: `Bearer ${getToken()}` };

  const [summary,      setSummary]      = useState<AgentSummary[]>([]);
  const [monthlyChart, setMonthlyChart] = useState<MonthlyChartEntry[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const orgId = getOrgId();
        const baseQs = `user_id=${encodeURIComponent(userId)}${orgId ? `&org_id=${encodeURIComponent(orgId)}` : ""}`;
        const [summaryRes, chartRes] = await Promise.all([
          fetch(`/api/billing/usage/agents/summary?${baseQs}`,       { headers: authHeaders }),
          fetch(`/api/billing/usage/agents/monthly-chart?${baseQs}`, { headers: authHeaders }),
        ]);
        if (!summaryRes.ok || !chartRes.ok) throw new Error("Failed to fetch billing data");
        const [summaryData, chartData] = await Promise.all([summaryRes.json(), chartRes.json()]);
        setSummary(Array.isArray(summaryData) ? summaryData : []);
        setMonthlyChart(Array.isArray(chartData) ? chartData : []);
      } catch (err: any) {
        setError(err?.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const totalLifetime  = summary.reduce((s, a) => s + a.lifetime_cost, 0);
  const totalThisMonth = summary.reduce((s, a) => s + a.current_month_cost, 0);
  const totalTasks     = summary.reduce((s, a) => s + a.tasks_ran, 0);
  const totalJobs      = summary.reduce((s, a) => s + a.jobs_ran, 0);
  const maxSpent       = Math.max(...summary.map((a) => a.lifetime_cost), 0.0001);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-red-400">Failed to load usage data</p>
          <p className="text-[10px] text-red-400/70 mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  // Agent legend derived from chart data (unique agents)
  const agentIds  = [...new Set(monthlyChart.map((d) => d.agent_id))];
  const agentMeta = agentIds.map((id) => ({
    id,
    name: monthlyChart.find((d) => d.agent_id === id)?.agent_name ?? id,
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <SectionHeading>Usage by Ai Employee</SectionHeading>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Lifetime Spend",   value: `$${totalLifetime.toFixed(4)}`,  icon: Wallet,         color: "text-brand"   },
          { label: "This Month",       value: `$${totalThisMonth.toFixed(4)}`, icon: DollarSign,     color: "text-brand"   },
          { label: "Tasks Run",        value: totalTasks.toLocaleString(),      icon: ClipboardCheck, color: "text-brand"   },
          { label: "Jobs Run",         value: totalJobs.toLocaleString(),       icon: Briefcase,      color: "text-emerald-400" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <stat.icon className={`h-3 w-3 ${stat.color}`} />
              <span className="text-[9px] uppercase tracking-wider font-semibold text-[#5a5a72]">{stat.label}</span>
            </div>
            <span className="text-sm font-bold text-white">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Stacked area chart */}
      {monthlyChart.length > 0 && (
        <PanelCard className="p-4">
          <div className="flex items-center justify-between mb-3 max-w-2xl">
            <span className="text-xs font-semibold text-white">Monthly Token Usage by Ai Employee</span>
            {/* Legend */}
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {agentMeta.map((a) => (
                <div key={a.id} className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: agentColor(a.id) }} />
                  <span className="text-[9px] text-[#9fa0b8]">{a.name}</span>
                </div>
              ))}
            </div>
          </div>
          <StackedAreaChart data={monthlyChart} />
        </PanelCard>
      )}

      {/* Per-agent detail cards */}
      {summary.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#2a2a35] p-8 text-center">
          <p className="text-xs text-[#9fa0b8]">No usage data found for your account.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {summary.map((ag) => {
            const pct = (ag.lifetime_cost / maxSpent) * 100;
            return (
              <PanelCard key={ag.agent_id} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <AgentBadge name={ag.agent_name} agentId={ag.agent_id} />
                  <span className="text-sm font-bold text-white">${ag.lifetime_cost.toFixed(4)}</span>
                </div>
                <Progress value={pct} className="h-1" />
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px]">
                  <div>
                    <p className="text-[#5a5a72]">This month</p>
                    <p className="font-medium text-white">${ag.current_month_cost.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-[#5a5a72]">Tokens</p>
                    <p className="font-medium text-white">{formatTokens(ag.current_month_tokens)}</p>
                  </div>
                  <div>
                    <p className="text-[#5a5a72]">Tasks run</p>
                    <p className="font-medium text-white">{ag.tasks_ran.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[#5a5a72]">Jobs run</p>
                    <p className="font-medium text-white">{ag.jobs_ran.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[#5a5a72]">Top model</p>
                    <p className="font-medium text-white truncate">{ag.top_model}</p>
                  </div>
                </div>
              </PanelCard>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const tabs = [
  { value: "overview",    label: "Overview",        icon: DollarSign },
  { value: "payment",     label: "Payment methods", icon: CreditCard },
  { value: "history",     label: "Billing history", icon: FileText   },
  { value: "credits",     label: "Credit grants",   icon: Gift       },
  { value: "preferences", label: "Preferences",     icon: Settings   },
  { value: "usage",       label: "Usage",           icon: BarChart3  },
];

// ─── Main export ──────────────────────────────────────────────────────────────

export default function BillingPage() {
  return (
    <>
    <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
    <div className="space-y-5">
      {/* Header — consistent with other Ai Office pages */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center">
          <Wallet className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Billing</h2>
          <p className="text-xs text-[#9fa0b8]">Manage credits, payment methods &amp; usage</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <ScrollArea className="w-full" type="scroll">
          <TabsList className="bg-transparent border-b border-[#2a2a35] rounded-none h-auto p-0 gap-0 w-full justify-start flex">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="
                  rounded-none border-b-2 border-transparent
                  data-[state=active]:border-brand data-[state=active]:bg-transparent
                  data-[state=active]:shadow-none data-[state=active]:text-white
                  text-[#9fa0b8] hover:text-white transition-colors
                  px-3 py-2 text-[11px] font-medium whitespace-nowrap shrink-0
                "
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>

        <div className="mt-4">
          <TabsContent value="overview">    <OverviewTab />       </TabsContent>
          <TabsContent value="payment">     <PaymentMethodsTab /> </TabsContent>
          <TabsContent value="history">     <BillingHistoryTab /></TabsContent>
          <TabsContent value="credits">     <CreditGrantsTab />   </TabsContent>
          <TabsContent value="preferences"> <PreferencesTab />    </TabsContent>
          <TabsContent value="usage">       <UsageTab />          </TabsContent>
        </div>
      </Tabs>
    </div>
    </>
  );
}
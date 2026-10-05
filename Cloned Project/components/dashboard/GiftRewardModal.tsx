"use client";

import { useState, useEffect, useRef } from "react";
import {
  Loader2,
  Gift,
  X,
  Check,
  DollarSign,
  Wallet,
  Search,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { getToken, getOrgId } from "@/lib/auth";
import {
  EligibilityCandidate,
  createPaidCouponOffer,
  giftReward,
  searchRecipientEligibility,
} from "@/lib/rewards-api";
import { cn } from "@/lib/utils";

interface FoundUser {
  _id: string;
  name?: string;
  email: string;
  profilePicture?: string;
}

interface GiftRewardModalProps {
  open: boolean;
  onClose: () => void;
  assignmentId: string;
  couponCode: string;
  couponName?: string;
  onGifted: () => void;
}

export function GiftRewardModal({
  open,
  onClose,
  assignmentId,
  couponCode,
  couponName,
  onGifted,
}: GiftRewardModalProps) {
  // Shared
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Free path
  const [email, setEmail] = useState("");
  const [resolved, setResolved] = useState<FoundUser | null>(null);
  const [resolving, setResolving] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const freeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Paid path
  const [chargeEnabled, setChargeEnabled] = useState(false);
  const [priceUsd, setPriceUsd] = useState<string>("");
  const [searchQ, setSearchQ] = useState("");
  const [candidates, setCandidates] = useState<EligibilityCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] =
    useState<EligibilityCandidate | null>(null);
  const [searching, setSearching] = useState(false);
  const paidDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setEmail("");
      setMessage("");
      setResolved(null);
      setLookupError(null);
      setChargeEnabled(false);
      setPriceUsd("");
      setSearchQ("");
      setCandidates([]);
      setSelectedCandidate(null);
    }
  }, [open]);

  // Free-path: debounced exact-email lookup
  useEffect(() => {
    if (chargeEnabled) return;
    setResolved(null);
    setLookupError(null);
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) return;
    if (freeDebounceRef.current) clearTimeout(freeDebounceRef.current);
    freeDebounceRef.current = setTimeout(async () => {
      setResolving(true);
      try {
        const token = getToken();
        const res = await fetch(
          `${API_URL}/users/discover?search=${encodeURIComponent(trimmed)}&limit=20`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        const data = await res.json();
        const match = (data.users || []).find(
          (u: FoundUser) => u.email.toLowerCase() === trimmed.toLowerCase()
        );
        if (match) {
          setResolved(match);
          setLookupError(null);
        } else {
          setResolved(null);
          setLookupError("No Garage user with that email");
        }
      } catch {
        setLookupError("Lookup failed");
      } finally {
        setResolving(false);
      }
    }, 350);
    return () => {
      if (freeDebounceRef.current) clearTimeout(freeDebounceRef.current);
    };
  }, [email, chargeEnabled]);

  // Paid-path: debounced eligibility search. Re-runs when price changes so
  // the "eligible" flag re-evaluates live as the sender adjusts the ask.
  useEffect(() => {
    if (!chargeEnabled) return;
    setSelectedCandidate(null);
    const q = searchQ.trim();
    const price = parseFloat(priceUsd);
    if (q.length < 2 || !Number.isFinite(price) || price <= 0) {
      setCandidates([]);
      return;
    }
    const orgId = getOrgId();
    if (!orgId) {
      toast.error("No org context — open a workspace first.");
      return;
    }
    if (paidDebounceRef.current) clearTimeout(paidDebounceRef.current);
    paidDebounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchRecipientEligibility({
          q,
          orgId,
          priceUsd: price,
        });
        setCandidates(data.candidates || []);
      } catch (err: any) {
        toast.error(err?.message || "Search failed");
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (paidDebounceRef.current) clearTimeout(paidDebounceRef.current);
    };
  }, [searchQ, priceUsd, chargeEnabled]);

  const submitFree = async () => {
    if (!resolved) return;
    setSubmitting(true);
    try {
      await giftReward(assignmentId, {
        recipientEmail: resolved.email,
        message: message.trim() || undefined,
      });
      toast.success(`Gifted to ${resolved.name || resolved.email}`);
      onGifted();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to gift");
    } finally {
      setSubmitting(false);
    }
  };

  const submitPaid = async () => {
    if (!selectedCandidate) return;
    const price = parseFloat(priceUsd);
    const orgId = getOrgId();
    if (!orgId) {
      toast.error("No org context");
      return;
    }
    setSubmitting(true);
    try {
      await createPaidCouponOffer(assignmentId, {
        recipientEmail: selectedCandidate.email,
        priceUsd: price,
        orgId,
        message: message.trim() || undefined,
      });
      toast.success(
        `Offer sent — waiting for ${selectedCandidate.name || selectedCandidate.email} to approve`
      );
      onGifted();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to send offer");
    } finally {
      setSubmitting(false);
    }
  };

  const submitEnabled = chargeEnabled
    ? !!selectedCandidate &&
      Number.isFinite(parseFloat(priceUsd)) &&
      parseFloat(priceUsd) >= 0.01
    : !!resolved;

  const priceNumber = Number.isFinite(parseFloat(priceUsd))
    ? parseFloat(priceUsd)
    : 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md mx-4"
          >
            {/* Soft outer glow */}
            <div className="absolute -inset-px rounded-3xl bg-linear-to-br from-brand/15 via-transparent to-brand/5 blur-xl opacity-60 pointer-events-none" />

            <div className="relative rounded-3xl bg-[#0a0a0e]/95 ring-1 ring-white/6 shadow-[0_20px_80px_-20px_rgba(0,0,0,0.7)] overflow-hidden">
              {/* Header */}
              <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-linear-to-br from-brand/30 to-brand/5 flex items-center justify-center">
                      <Gift className="h-3.5 w-3.5 text-brand" />
                    </div>
                    <h2 className="text-base font-semibold text-white tracking-tight">
                      {chargeEnabled ? "Sell this reward" : "Gift this reward"}
                    </h2>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-[#9fa0b8]">
                    <code className="font-mono text-brand">{couponCode}</code>
                    {couponName && (
                      <>
                        <span className="text-[#3a3a45]">·</span>
                        <span className="truncate">{couponName}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-[#6b6b80] hover:text-white p-1.5 rounded-full transition-all duration-200 hover:bg-white/5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Soft separator */}
              <div className="h-px mx-5 bg-linear-to-r from-transparent via-white/8 to-transparent" />

              <div className="px-5 py-4 space-y-4">
                {/* Charge toggle */}
                <button
                  onClick={() => setChargeEnabled((v) => !v)}
                  disabled={submitting}
                  className={cn(
                    "w-full text-left p-3 rounded-2xl transition-all duration-300 group",
                    chargeEnabled
                      ? "bg-linear-to-br from-brand/12 to-brand/5 ring-1 ring-brand/30"
                      : "bg-white/3 hover:bg-white/5 ring-1 ring-white/6"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300",
                          chargeEnabled
                            ? "bg-brand/20 text-brand"
                            : "bg-white/5 text-[#9fa0b8]"
                        )}
                      >
                        <DollarSign className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-white font-medium">
                          Charge for this gift
                        </div>
                        <div className="text-[11px] text-[#7a7a8c] mt-0.5 leading-tight">
                          Recipient pays from their store wallet, then approves.
                        </div>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-300",
                        chargeEnabled ? "bg-brand" : "bg-white/10"
                      )}
                    >
                      <motion.span
                        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-md"
                        animate={{ x: chargeEnabled ? 18 : 2 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </div>
                  </div>
                </button>

                {/* Mode-specific block — animated swap */}
                <AnimatePresence mode="wait">
                  {chargeEnabled ? (
                    <motion.div
                      key="paid"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-3"
                    >
                      {/* Price input — large display style */}
                      <div className="p-4 rounded-2xl bg-white/3 ring-1 ring-white/6 focus-within:ring-brand/40 transition-all duration-300">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-[#6b6b80] font-medium mb-1">
                          Asking price
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-5 w-5 text-[#9fa0b8]" />
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0.01}
                            step={0.01}
                            value={priceUsd}
                            onChange={(e) => setPriceUsd(e.target.value)}
                            placeholder="0.00"
                            disabled={submitting}
                            className="flex-1 bg-transparent text-white text-2xl font-semibold tracking-tight placeholder:text-[#3a3a45] focus:outline-none"
                          />
                          <span className="text-xs uppercase tracking-wider text-[#6b6b80]">
                            USD
                          </span>
                        </div>
                        <div className="text-[10px] text-[#6b6b80] mt-1.5">
                          Settles into your store wallet for the current org.
                        </div>
                      </div>

                      {/* Eligibility-aware recipient search */}
                      <div>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6b6b80] pointer-events-none" />
                          <input
                            type="text"
                            value={searchQ}
                            onChange={(e) => setSearchQ(e.target.value)}
                            placeholder="Search name or email"
                            disabled={submitting}
                            className="w-full h-11 pl-9 pr-9 rounded-2xl bg-white/3 ring-1 ring-white/6 focus:ring-brand/40 text-white placeholder:text-[#6b6b80] outline-none transition-all duration-300 text-sm"
                          />
                          {searching && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-[#6b6b80]" />
                          )}
                        </div>

                        {/* Candidates list */}
                        <AnimatePresence>
                          {candidates.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 max-h-60 overflow-y-auto rounded-2xl bg-black/30 ring-1 ring-white/5 p-1.5 space-y-0.5">
                                {candidates.map((c) => {
                                  const isSelected =
                                    selectedCandidate?.userId === c.userId;
                                  return (
                                    <button
                                      key={c.userId}
                                      type="button"
                                      disabled={!c.eligible || submitting}
                                      onClick={() => setSelectedCandidate(c)}
                                      className={cn(
                                        "w-full flex items-center gap-2.5 p-2.5 text-left rounded-xl transition-all duration-200",
                                        isSelected
                                          ? "bg-emerald-500/8 ring-1 ring-emerald-500/30"
                                          : c.eligible
                                            ? "hover:bg-white/4 active:scale-[0.99]"
                                            : "opacity-40 cursor-not-allowed"
                                      )}
                                    >
                                      <span className="h-8 w-8 rounded-full bg-linear-to-br from-white/10 to-white/5 flex items-center justify-center text-[11px] text-white shrink-0">
                                        {(c.name || c.email)[0]?.toUpperCase()}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm text-white truncate leading-tight">
                                          {c.name || "—"}
                                        </div>
                                        <div className="text-[11px] text-[#7a7a8c] truncate mt-0.5">
                                          {c.email}
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <div
                                          className={cn(
                                            "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium",
                                            c.eligible
                                              ? "bg-emerald-500/12 text-emerald-300"
                                              : "bg-white/5 text-[#7a7a8c]"
                                          )}
                                        >
                                          <Wallet className="h-2.5 w-2.5" />
                                          ${c.balance.toFixed(2)}
                                        </div>
                                        {!c.eligible && (
                                          <div className="text-[9px] text-[#6b6b80] mt-0.5">
                                            Insufficient
                                          </div>
                                        )}
                                      </div>
                                      {isSelected && (
                                        <motion.div
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          className="ml-1 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0"
                                        >
                                          <Check className="h-3 w-3 text-black" />
                                        </motion.div>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {searchQ.trim().length >= 2 &&
                          !searching &&
                          candidates.length === 0 && (
                            <p className="text-[11px] text-[#6b6b80] mt-2 ml-1">
                              No matches in this org.
                            </p>
                          )}
                        {searchQ.trim().length > 0 &&
                          searchQ.trim().length < 2 && (
                            <p className="text-[11px] text-[#6b6b80] mt-2 ml-1">
                              Type at least 2 characters.
                            </p>
                          )}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="free"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-3"
                    >
                      <div className="relative">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Recipient email"
                          disabled={submitting}
                          className="w-full h-11 px-4 pr-10 rounded-2xl bg-white/3 ring-1 ring-white/6 focus:ring-brand/40 text-white placeholder:text-[#6b6b80] outline-none transition-all duration-300 text-sm"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {resolving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6b6b80]" />
                          ) : resolved ? (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center"
                            >
                              <Check className="h-3 w-3 text-black" />
                            </motion.div>
                          ) : null}
                        </div>
                      </div>
                      <AnimatePresence>
                        {resolved && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                          >
                            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-500/6 ring-1 ring-emerald-500/20">
                              {resolved.profilePicture ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={resolved.profilePicture}
                                  alt=""
                                  className="h-8 w-8 rounded-full object-cover"
                                />
                              ) : (
                                <span className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center text-[11px] text-emerald-300">
                                  {(resolved.name || resolved.email)[0]?.toUpperCase()}
                                </span>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate leading-tight">
                                  {resolved.name || "—"}
                                </div>
                                <div className="text-[11px] text-emerald-300/80 truncate mt-0.5">
                                  {resolved.email}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {lookupError && email.trim() && !resolving && (
                        <p className="text-[11px] text-rose-300/90 ml-1">
                          {lookupError}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Message (shared, animated reveal once recipient set) */}
                <div className="relative">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={280}
                    rows={2}
                    placeholder={
                      chargeEnabled
                        ? "Note for the buyer (optional)"
                        : "Message (optional)"
                    }
                    disabled={submitting}
                    className="w-full px-4 py-3 rounded-2xl bg-white/3 ring-1 ring-white/6 focus:ring-brand/40 text-white placeholder:text-[#6b6b80] outline-none transition-all duration-300 text-sm resize-none"
                  />
                  <span className="absolute bottom-2 right-3 text-[10px] text-[#6b6b80] tabular-nums pointer-events-none">
                    {message.length}/280
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 pb-5 pt-1 flex gap-2">
                <button
                  onClick={onClose}
                  disabled={submitting}
                  className="flex-1 h-11 rounded-2xl bg-white/4 text-[#9fa0b8] hover:text-white hover:bg-white/7 active:scale-[0.98] disabled:opacity-50 transition-all duration-200 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={chargeEnabled ? submitPaid : submitFree}
                  disabled={submitting || !submitEnabled}
                  className={cn(
                    "flex-1 h-11 rounded-2xl font-medium text-sm flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed",
                    "bg-linear-to-b from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground shadow-[0_4px_20px_-8px_color-mix(in_srgb,_var(--brand)_60%,_transparent)] hover:shadow-[0_8px_30px_-8px_color-mix(in_srgb,_var(--brand)_80%,_transparent)] hover:from-[color:color-mix(in_srgb,var(--brand)_91%,white)] hover:to-brand"
                  )}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : chargeEnabled ? (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Send offer for ${priceNumber.toFixed(2)}
                    </>
                  ) : (
                    <>
                      <Gift className="h-3.5 w-3.5" />
                      Send Gift
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

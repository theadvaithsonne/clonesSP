"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export type CashbackProductType =
  | "product"
  | "channel"
  | "course"
  | "workshop"
  | "service"
  | "call"
  | "ecommerce";

export interface CashbackCode {
  _id: string;
  code: string;
  name: string;
  description?: string;
  creatorId: string;
  status: "active" | "inactive";
  productType: CashbackProductType;
  itemId: string;
  orgId: string;
  ratePct: number;
  allowedBuyerIds: string[];
  cycleCount: number;
  validFrom: string;
  validUntil?: string;
  maxUsageCount?: number;
  maxUsagePerUser?: number;
  currentUsageCount: number;
  minOrderAmountCents?: number;
  createdAt: string;
  updatedAt: string;
}

export interface EligibleItem {
  itemId: string;
  productType: CashbackProductType;
  orgId: string;
  title: string;
  price: number;
  currency: string;
  image?: string;
}

export interface EligibleBuyer {
  _id: string;
  name?: string;
  email?: string;
  profilePicture?: string;
}

export interface CashbackDistribution {
  _id: string;
  codeId: string;
  invoiceId: string;
  invoiceLineItemIndex: number;
  creatorId: string;
  buyerId: string;
  sellerOrgId: string;
  productType: string;
  itemId?: string;
  saleAmountCents: number;
  saleCurrency: string;
  level1RatePct: number;
  configuredRatePct: number;
  appliedRatePct: number;
  cashbackAmount: number;
  cycleNumber: number;
  status: "completed" | "skipped" | "failed";
  failureReason?: string;
  createdAt: string;
}

export interface CashbackSummary {
  totalPaidOutUsd: number;
  activeCodesCount: number;
  totalCodesCount: number;
}

export function useCashbackCodes() {
  const [codes, setCodes] = useState<CashbackCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ success: boolean; codes: CashbackCode[] }>(
        "/cashback-codes"
      );
      setCodes(res.codes || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load codes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  return { codes, loading, error, refresh: fetchCodes };
}

export function useCashbackSummary() {
  const [summary, setSummary] = useState<CashbackSummary | null>(null);
  const [received, setReceived] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        api<{ success: boolean } & CashbackSummary>(
          "/cashback-codes/me/summary"
        ),
        api<{ success: boolean; totalReceived: number }>(
          "/cashback-codes/me/received?limit=1"
        ),
      ]);
      setSummary({
        totalPaidOutUsd: s.totalPaidOutUsd,
        activeCodesCount: s.activeCodesCount,
        totalCodesCount: s.totalCodesCount,
      });
      setReceived(r.totalReceived || 0);
    } catch {
      // Surface as 0 — summary tiles are informational, not blocking.
      setSummary({
        totalPaidOutUsd: 0,
        activeCodesCount: 0,
        totalCodesCount: 0,
      });
      setReceived(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { summary, received, loading, refresh };
}

export function useReceivedCashback() {
  const [rows, setRows] = useState<CashbackDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalReceived, setTotalReceived] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{
        success: boolean;
        distributions: CashbackDistribution[];
        totalReceived: number;
      }>("/cashback-codes/me/received?limit=100");
      setRows(res.distributions || []);
      setTotalReceived(res.totalReceived || 0);
    } catch {
      setRows([]);
      setTotalReceived(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { rows, totalReceived, loading, refresh };
}

export async function fetchEligibleItems(
  productType: CashbackProductType,
  orgId: string
): Promise<EligibleItem[]> {
  const res = await api<{ success: boolean; items: EligibleItem[] }>(
    `/cashback-codes/eligible-items?productType=${encodeURIComponent(
      productType
    )}&orgId=${encodeURIComponent(orgId)}`
  );
  return res.items || [];
}

export async function fetchEligibleBuyers(): Promise<EligibleBuyer[]> {
  const res = await api<{ success: boolean; buyers: EligibleBuyer[] }>(
    "/cashback-codes/eligible-buyers"
  );
  return res.buyers || [];
}

export async function fetchDistributionsForCode(codeId: string): Promise<{
  distributions: CashbackDistribution[];
  totals: {
    completedCount: number;
    completedAmount: number;
    skippedCount: number;
    failedCount: number;
  } | null;
}> {
  const res = await api<{
    success: boolean;
    distributions: CashbackDistribution[];
    totals: any;
  }>(`/cashback-codes/${codeId}/distributions?limit=100`);
  return {
    distributions: res.distributions || [],
    totals: res.totals || null,
  };
}

export interface CreateCodeInput {
  code: string;
  name: string;
  description?: string;
  productType: CashbackProductType;
  itemId: string;
  ratePct: number;
  allowedBuyerIds?: string[];
  cycleCount?: number;
  validFrom?: string;
  validUntil?: string;
  maxUsageCount?: number;
  maxUsagePerUser?: number;
  minOrderAmountCents?: number;
}

export async function createCashbackCode(
  input: CreateCodeInput
): Promise<CashbackCode> {
  const res = await api<{ success: boolean; code: CashbackCode }>(
    "/cashback-codes",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
  return res.code;
}

export interface UpdateCodeInput {
  name?: string;
  description?: string;
  ratePct?: number;
  allowedBuyerIds?: string[];
  cycleCount?: number;
  validFrom?: string;
  validUntil?: string;
  maxUsageCount?: number;
  maxUsagePerUser?: number;
  minOrderAmountCents?: number;
}

export async function updateCashbackCode(
  id: string,
  input: UpdateCodeInput
): Promise<CashbackCode> {
  const res = await api<{ success: boolean; code: CashbackCode }>(
    `/cashback-codes/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
  return res.code;
}

export async function setCashbackCodeStatus(
  id: string,
  status: "active" | "inactive"
): Promise<CashbackCode> {
  const path =
    status === "active"
      ? `/cashback-codes/${id}/activate`
      : `/cashback-codes/${id}/deactivate`;
  const res = await api<{ success: boolean; code: CashbackCode }>(path, {
    method: "POST",
  });
  return res.code;
}

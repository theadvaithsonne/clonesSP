"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AdminUnauthorizedError,
  getUsageSummary,
  getUsageUser,
  getUsageUsers,
  type UsageSummaryData,
  type UsageUserDetailData,
  type UsageUsersData,
} from "@/lib/nc-admin-api/admin";
import { getNcAdminToken } from "@/lib/nc-admin-api/auth";

/**
 * Don't retry on an expired admin session — let the error surface so the
 * page can drop back to the OTP gate.
 */
function retry(failureCount: number, error: unknown) {
  if (error instanceof AdminUnauthorizedError) return false;
  return failureCount < 2;
}

const hasToken = () => !!getNcAdminToken();

/** Per-user cost rollup for a date range. */
export function useUsageUsers(from: string, to: string, tokenPresent = hasToken()) {
  return useQuery<UsageUsersData>({
    queryKey: ["admin", "usage", "users", from, to],
    queryFn: () => getUsageUsers(from, to),
    enabled: tokenPresent && !!from && !!to,
    retry,
  });
}

/** Drill-down for a single user. Disabled until a userId is selected. */
export function useUsageUser(
  userId: string | null,
  from: string,
  to: string,
  tokenPresent = hasToken(),
) {
  return useQuery<UsageUserDetailData>({
    queryKey: ["admin", "usage", "user", userId, from, to],
    queryFn: () => getUsageUser(userId!, from, to),
    enabled: tokenPresent && !!userId && !!from && !!to,
    retry,
  });
}

/** Platform-wide summary for the strip. */
export function useUsageSummary(from: string, to: string, tokenPresent = hasToken()) {
  return useQuery<UsageSummaryData>({
    queryKey: ["admin", "usage", "summary", from, to],
    queryFn: () => getUsageSummary(from, to),
    enabled: tokenPresent && !!from && !!to,
    retry,
  });
}

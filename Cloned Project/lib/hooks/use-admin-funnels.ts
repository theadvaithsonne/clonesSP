"use client";
import { useEffect, useRef, type MutableRefObject } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminFunnelsApi,
  type FunnelSaveInput,
  type FunnelCta,
} from "@/lib/nc-admin-api/admin-funnels";
import { AdminUnauthorizedError } from "@/lib/nc-admin-api/admin";
import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";

const LIST_KEY = ["admin", "funnels"];
const one = (id: string) => ["admin", "funnel", id];

/**
 * Per-hook 401 recovery state. An expired NC token is recovered by
 * re-elevating from the Garage session — never by reloading, which would
 * drop the operator out of the whole Garage shell. Capped to one recovery
 * attempt per failure episode so a persistently-401ing endpoint can't loop
 * forever; re-arms once the request succeeds again.
 * lib/nc-admin-api/auth.ts already clears the stale NC token on every path
 * that throws this error, so no caller-level clear is needed here.
 */
function useNcRecovery() {
  const recoveryAttempted = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  return { recoveryAttempted, mountedRef };
}

/** The whole admin funnel library (default first). */
export function useAdminFunnels() {
  const { recoveryAttempted, mountedRef } = useNcRecovery();
  const query = useQuery({
    queryKey: LIST_KEY,
    queryFn: () => adminFunnelsApi.listFunnels().then((r) => r.funnels),
  });

  useEffect(() => {
    if (query.isSuccess) {
      recoveryAttempted.current = false; // healthy again — re-arm for a future episode
      return;
    }
    if (query.error instanceof AdminUnauthorizedError) {
      if (recoveryAttempted.current) return; // one attempt per failure episode
      recoveryAttempted.current = true;
      ensureNcAdminToken().then((result) => {
        if (result.ok === true && mountedRef.current) {
          query.refetch();
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isSuccess, query.error]);

  return query;
}

/** One funnel's full tree + cta, for the editor. */
export function useAdminFunnel(id: string) {
  const { recoveryAttempted, mountedRef } = useNcRecovery();
  const query = useQuery({
    queryKey: one(id),
    queryFn: () => adminFunnelsApi.getFunnel(id).then((r) => r.funnel),
    enabled: !!id,
  });

  useEffect(() => {
    if (query.isSuccess) {
      recoveryAttempted.current = false; // healthy again — re-arm for a future episode
      return;
    }
    if (query.error instanceof AdminUnauthorizedError) {
      if (recoveryAttempted.current) return; // one attempt per failure episode
      recoveryAttempted.current = true;
      ensureNcAdminToken().then((result) => {
        if (result.ok === true && mountedRef.current) {
          query.refetch();
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isSuccess, query.error]);

  return query;
}

/**
 * Shared 401 handling for a user-triggered write (create/save/delete/…).
 * On AdminUnauthorizedError, re-elevate once and retry the SAME variables —
 * gated on `mountedRef` so a save that finishes eleflating after the operator
 * has already navigated away doesn't fire a write behind their back.
 */
interface RetryableMutation<TVariables> {
  mutate: (variables: TVariables) => void;
}

function handleMutationError<TVariables>(
  e: unknown,
  recoveryAttempted: MutableRefObject<boolean>,
  mountedRef: MutableRefObject<boolean>,
  mutationRef: MutableRefObject<RetryableMutation<TVariables> | null>,
  variables: TVariables,
  fallbackMessage: string,
) {
  if (e instanceof AdminUnauthorizedError) {
    if (recoveryAttempted.current) {
      toast.error("Session expired. Please try again.");
      return;
    }
    recoveryAttempted.current = true;
    ensureNcAdminToken().then((result) => {
      if (!mountedRef.current) return; // navigated away during elevation — no retry
      if (result.ok === true) {
        mutationRef.current?.mutate(variables);
      } else {
        toast.error("Session expired. Please try again.");
      }
    });
    return;
  }
  toast.error((e as Error)?.message || fallbackMessage);
}

export function useCreateFunnel() {
  const qc = useQueryClient();
  const { recoveryAttempted, mountedRef } = useNcRecovery();
  const mutationRef = useRef<RetryableMutation<string | undefined> | null>(null);
  const mutation = useMutation({
    mutationFn: (name?: string) => adminFunnelsApi.createFunnel(name),
    onSuccess: () => {
      recoveryAttempted.current = false;
      qc.invalidateQueries({ queryKey: LIST_KEY });
      toast.success("Funnel created");
    },
    onError: (e: Error, variables) =>
      handleMutationError(e, recoveryAttempted, mountedRef, mutationRef, variables, "Failed to create funnel"),
  });
  mutationRef.current = mutation;
  return mutation;
}

export function useSaveFunnel(id: string) {
  const qc = useQueryClient();
  const { recoveryAttempted, mountedRef } = useNcRecovery();
  const mutationRef = useRef<RetryableMutation<FunnelSaveInput> | null>(null);
  const mutation = useMutation({
    mutationFn: (input: FunnelSaveInput) => adminFunnelsApi.saveFunnel(id, input),
    onSuccess: () => {
      recoveryAttempted.current = false;
      qc.invalidateQueries({ queryKey: one(id) });
      qc.invalidateQueries({ queryKey: LIST_KEY });
      toast.success("Funnel saved");
    },
    onError: (e: Error, variables) =>
      handleMutationError(e, recoveryAttempted, mountedRef, mutationRef, variables, "Failed to save"),
  });
  mutationRef.current = mutation;
  return mutation;
}

/** Save only name/CTA (not the tree). Quiet on success (no toast spam). */
export function useUpdateFunnelMeta(id: string) {
  const qc = useQueryClient();
  const { recoveryAttempted, mountedRef } = useNcRecovery();
  const mutationRef = useRef<RetryableMutation<{ name?: string; cta?: FunnelCta | null }> | null>(null);
  const mutation = useMutation({
    mutationFn: (meta: { name?: string; cta?: FunnelCta | null }) =>
      adminFunnelsApi.updateFunnelMeta(id, meta),
    onSuccess: () => {
      recoveryAttempted.current = false;
      qc.invalidateQueries({ queryKey: one(id) });
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (e: Error, variables) =>
      handleMutationError(e, recoveryAttempted, mountedRef, mutationRef, variables, "Failed to save"),
  });
  mutationRef.current = mutation;
  return mutation;
}

export function useDeleteFunnel() {
  const qc = useQueryClient();
  const { recoveryAttempted, mountedRef } = useNcRecovery();
  const mutationRef = useRef<RetryableMutation<string> | null>(null);
  const mutation = useMutation({
    mutationFn: (id: string) => adminFunnelsApi.deleteFunnel(id),
    onSuccess: () => {
      recoveryAttempted.current = false;
      qc.invalidateQueries({ queryKey: LIST_KEY });
      toast.success("Funnel deleted");
    },
    onError: (e: Error, variables) =>
      handleMutationError(e, recoveryAttempted, mountedRef, mutationRef, variables, "Failed to delete funnel"),
  });
  mutationRef.current = mutation;
  return mutation;
}

export function useSetDefaultFunnel() {
  const qc = useQueryClient();
  const { recoveryAttempted, mountedRef } = useNcRecovery();
  const mutationRef = useRef<RetryableMutation<string> | null>(null);
  const mutation = useMutation({
    mutationFn: (id: string) => adminFunnelsApi.setDefaultFunnel(id),
    onSuccess: () => {
      recoveryAttempted.current = false;
      qc.invalidateQueries({ queryKey: LIST_KEY });
      toast.success("Default funnel updated");
    },
    onError: (e: Error, variables) =>
      handleMutationError(e, recoveryAttempted, mountedRef, mutationRef, variables, "Failed to set default"),
  });
  mutationRef.current = mutation;
  return mutation;
}

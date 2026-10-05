"use client";

import { useEffect, useState } from "react";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";

const ALAN_K_EMAIL = "redbaron2020@mail.com";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const BAT246_CARD_KEYS = [
  "boards",
  "members",
  "distributors",
  "documentation",
  "lostmoney",
  "inviteandplace",
  "b2coinwallet",
  "snapbackloans",
] as const;

export type Bat246CardKey = (typeof BAT246_CARD_KEYS)[number];

let _grantsCache: Bat246CardKey[] | null = null;
let _grantsCacheAt = 0;
const GRANTS_TTL = 30_000;

/**
 * Alan always has every card. Anyone else's access is whatever has been
 * granted on the Permissions page (/games/bat246/permission) — see
 * bat246Permission.routes.ts on the backend.
 */
export function useMyBat246Grants() {
  const { userData, loading: authLoading } = useAmIFounder();
  const isAlanK = !authLoading && userData.email?.toLowerCase() === ALAN_K_EMAIL;
  const [grantedKeys, setGrantedKeys] = useState<Bat246CardKey[]>([]);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (isAlanK) { setChecked(true); return; }

    if (_grantsCache && Date.now() - _grantsCacheAt < GRANTS_TTL) {
      setGrantedKeys(_grantsCache);
      setChecked(true);
      return;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
    fetch(`${API}/bat246/permissions/mine`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const keys: Bat246CardKey[] = Array.isArray(d.cardKeys) ? d.cardKeys : [];
        _grantsCache = keys;
        _grantsCacheAt = Date.now();
        setGrantedKeys(keys);
      })
      .catch(() => setGrantedKeys([]))
      .finally(() => setChecked(true));
  }, [authLoading, isAlanK]);

  return { isAlanK, grantedKeys, loading: authLoading || !checked };
}

/** Whether the current user has admin access to one specific card. */
export function useBat246CardAccess(cardKey: Bat246CardKey) {
  const { isAlanK, grantedKeys, loading } = useMyBat246Grants();
  return { isAdmin: isAlanK || grantedKeys.includes(cardKey), loading };
}

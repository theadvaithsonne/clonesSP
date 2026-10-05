"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { uploadTemplateAsset, getNetworkMailOrgId } from "@/lib/network-mail-api";

type AssetPurpose = "logo" | "image" | "social-icon";

type NetworkMailEditorContextValue = {
  templateId: string;
  uploadAsset: (file: File, purpose: AssetPurpose) => Promise<string>;
};

const NetworkMailEditorContext =
  createContext<NetworkMailEditorContextValue | null>(null);

export function NetworkMailEditorProvider({
  templateId,
  children,
}: {
  templateId: string;
  children: ReactNode;
}) {
  const uploadAsset = useCallback(
    async (file: File, purpose: AssetPurpose) => {
      const orgId = getNetworkMailOrgId();
      if (!orgId) throw new Error("No organization selected");
      const res = await uploadTemplateAsset(orgId, file, { templateId, purpose });
      return res.url;
    },
    [templateId],
  );

  const value = useMemo(
    () => ({ templateId, uploadAsset }),
    [templateId, uploadAsset],
  );

  return (
    <NetworkMailEditorContext.Provider value={value}>
      {children}
    </NetworkMailEditorContext.Provider>
  );
}

export function useNetworkMailEditor() {
  return useContext(NetworkMailEditorContext);
}

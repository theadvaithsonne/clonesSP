"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { CmsDomain } from "@/lib/cms/types";
import {
  addCmsDomain,
  deleteCmsDomain,
  listCmsDomains,
  verifyCmsDomain,
} from "@/lib/cms/api";

export default function DomainSettingsModal({
  open,
  pageSlug,
  onClose,
}: {
  open: boolean;
  pageSlug?: string;
  onClose: () => void;
}) {
  const [domains, setDomains] = useState<CmsDomain[]>([]);
  const [hostname, setHostname] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listCmsDomains();
      setDomains(data.domains || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load domains");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  if (!open) return null;

  const custom = domains[0];

  const connect = async () => {
    if (!hostname.trim()) return;
    setBusy(true);
    try {
      await addCmsDomain(hostname.trim());
      setHostname("");
      toast.success("Domain added — configure DNS then verify");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to connect domain");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (id: string) => {
    setBusy(true);
    try {
      const result = await verifyCmsDomain(id);
      toast[result.verified ? "success" : "error"](result.message);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await deleteCmsDomain(id);
      toast.success("Domain removed");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove domain");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="cms-ui w-full max-w-[640px] rounded-[14px] border border-[#2A2A2A] bg-[#141414] text-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#2A2A2A] px-5 py-4">
          <div>
            <h2 className="text-[18px] font-bold">Domain Settings</h2>
            <p className="mt-1 text-sm text-[#888]">
              Configure how users access your published landing pages.
            </p>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer rounded p-1 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">Garage Subdomain</h3>
              <span className="rounded-full bg-[#22C55E]/15 px-2 py-0.5 text-[11px] font-bold text-[#22C55E]">
                Active
              </span>
            </div>
            <div className="rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 font-mono text-sm">
              garage.app/p/
              <span className="text-brand">{pageSlug || "[page-slug]"}</span>
            </div>
            <p className="mt-2 text-xs text-[#888]">
              Default system subdomain. No DNS setup required.
            </p>
          </div>

          <div className="rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">Custom Domain</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  custom?.status === "verified"
                    ? "bg-[#22C55E]/15 text-[#22C55E]"
                    : "bg-[#2A2A2A] text-[#888]"
                }`}
              >
                {custom?.status === "verified" ? "Connected" : "Not Connected"}
              </span>
            </div>

            {custom ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 font-mono text-sm">
                  {custom.hostname}
                </div>
                {custom.lastVerifyMessage ? (
                  <p className="text-xs text-[#888]">{custom.lastVerifyMessage}</p>
                ) : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => verify(custom.id)}
                    className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-bold !text-brand-foreground"
                  >
                    Verify
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(custom.id)}
                    className="cursor-pointer rounded-lg border border-[#2A2A2A] px-4 py-2 text-sm text-white"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-sm"
                  placeholder="e.g. promo.yourdomain.com"
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                />
                <button
                  type="button"
                  disabled={busy || !hostname.trim()}
                  onClick={connect}
                  className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-bold !text-brand-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Connect
                </button>
              </div>
            )}

            <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-[#888]">
              <li>
                Create a <strong className="text-white">CNAME</strong> record pointing to{" "}
                <span className="text-brand">cname.garage.app</span>
              </li>
              <li>Verify configuration status by clicking check below.</li>
              <li>SSL certificate provisioned automatically upon propagation.</li>
            </ol>
          </div>

          {loading ? <p className="text-xs text-[#888]">Loading domains...</p> : null}
        </div>

        <div className="flex justify-end border-t border-[#2A2A2A] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-4 py-2 text-sm text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

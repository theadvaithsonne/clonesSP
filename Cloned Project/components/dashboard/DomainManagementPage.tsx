"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Check,
  X,
  RefreshCw,
  Copy,
  CheckCircle2,
  Loader2,
  Server,
  AlertCircle,
  Shield,
  Clock,
  Plus,
  Trash2,
  Star,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { DomainSearchPanel } from "./DomainSearchPanel";
import { Badge } from "@/components/ui/badge";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import {
  fetchWhitelabelStatus,
  type WhitelabelStatusResponse,
} from "@/lib/whitelabel-addon-api";

type DnsRecord = {
  type: string;
  name: string;
  value: string;
  priority?: number;
  verified: boolean;
};

type DomainConfig = {
  type: "default" | "custom";
  customDomain?: string;
  verified: boolean;
  domainAddedToMailcow: boolean;
  dnsRecords: DnsRecord[];
  verifiedAt?: string;
};

type AppDomain = {
  domain: string;
  verified: boolean;
  verifiedAt?: string;
  sslProvisioned: boolean;
  isPrimary: boolean;
  createdAt: string;
  dnsRecords: DnsRecord[];
  /**
   * Deployment liveness, written by the backend's app-domain health sweep.
   * `verified` only proves DNS + SSL — a domain can resolve, serve 200 and
   * still sit on an old deployment that no longer has the routes public links
   * point at. When this is false, share links fall back to my.garage.app.
   */
  appHealth?: {
    ok?: boolean | null;
    checkedAt?: string;
    linkContract?: number;
    deploymentId?: string;
    error?: string;
  };
};

export default function DomainManagementPage() {
  // The page reads orgId from localStorage inside its handlers; the purchase
  // panel needs it at render time, so it is resolved once here.
  const [orgIdForPurchase, setOrgIdForPurchase] = useState<string>("");
  useEffect(() => {
    setOrgIdForPurchase(localStorage.getItem("garage_org_id") || "");
  }, []);

  const [loading, setLoading] = useState(true);
  const [domainConfig, setDomainConfig] = useState<DomainConfig | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [addingDomain, setAddingDomain] = useState(false);
  const { amIFounder } = useAmIFounder();

  // App Domain state
  const [appDomains, setAppDomains] = useState<AppDomain[]>([]);
  const [targetCname, setTargetCname] = useState("");
  const [targetIp, setTargetIp] = useState("");
  const [showAddAppDomain, setShowAddAppDomain] = useState(false);
  const [newAppDomain, setNewAppDomain] = useState("");
  const [addingAppDomain, setAddingAppDomain] = useState(false);
  const [verifyingAppDomain, setVerifyingAppDomain] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"email" | "app">("email");

  // Whitelabel add-on status — only used for the "renews on" line now.
  // The access gate moved up to WhitelabelGate, which swaps this whole
  // page for the WhitelabelPage pitch when the add-on isn't active.
  const [wlStatus, setWlStatus] = useState<WhitelabelStatusResponse | null>(
    null,
  );
  const [wlStatusLoading, setWlStatusLoading] = useState(true);
  const loadWhitelabelStatus = useCallback(async () => {
    setWlStatusLoading(true);
    try {
      const s = await fetchWhitelabelStatus();
      setWlStatus(s);
    } catch {
      // Non-fatal — treat as no-access to be safe. User can retry via
      // the banner's own error handling.
      setWlStatus({ success: true, hasAccess: false });
    } finally {
      setWlStatusLoading(false);
    }
  }, []);
  useEffect(() => {
    loadWhitelabelStatus();
  }, [loadWhitelabelStatus]);

  const loadDomainConfig = useCallback(async () => {
    try {
      setLoading(true);
      const orgId = localStorage.getItem("garage_org_id");

      const [configRes, appDomainsRes] = await Promise.all([
        api<{
          domainConfig: DomainConfig;
          userRole: "founder" | "stakeholder";
        }>(`/initial-setup/domain-config?orgId=${orgId}`),
        api<{
          domains: AppDomain[];
          targetCname: string;
          targetIp?: string;
        }>(`/initial-setup/app-domains?orgId=${orgId}`),
      ]);

      setDomainConfig(configRes.domainConfig);
      setAppDomains(appDomainsRes.domains || []);
      setTargetCname(appDomainsRes.targetCname || "my.garage.app");
      setTargetIp(appDomainsRes.targetIp || "");
    } catch (error) {
      console.error("Failed to load domain config:", error);
      toast.error("Failed to load domain configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDomainConfig();
  }, [loadDomainConfig]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const copyAllDnsRecords = () => {
    if (!domainConfig?.dnsRecords) return;

    const recordsText = domainConfig.dnsRecords
      .map((record) => {
        const priority = record.priority ? `${record.priority} ` : "";
        return `${record.type}\t${record.name}\t${priority}${record.value}`;
      })
      .join("\n");

    navigator.clipboard.writeText(recordsText);
    toast.success("All DNS records copied to clipboard");
  };

  const verifyDns = async () => {
    try {
      setVerifying(true);
      const orgId = localStorage.getItem("garage_org_id");

      const res = await api<{
        success: boolean;
        allVerified: boolean;
        mxVerified: boolean;
        dnsRecords: DnsRecord[];
      }>(`/initial-setup/verify-dns`, {
        method: "POST",
        body: JSON.stringify({ orgId }),
      });

      if (res.mxVerified) {
        toast.success("MX record verified! You can now add the domain.");
      } else {
        toast.error(
          "MX record not verified yet. Please check your DNS settings."
        );
      }

      setDomainConfig((prev) =>
        prev
          ? { ...prev, dnsRecords: res.dnsRecords, verified: res.mxVerified }
          : null
      );
    } catch (error: any) {
      console.error("Failed to verify DNS:", error);
      toast.error(error.message || "Failed to verify DNS records");
    } finally {
      setVerifying(false);
    }
  };

  const addDomainToMailcow = async () => {
    try {
      setAddingDomain(true);
      const orgId = localStorage.getItem("garage_org_id");

      await api(`/initial-setup/add-domain-to-mailcow`, {
        method: "POST",
        body: JSON.stringify({ orgId }),
      });

      toast.success("Domain added to mail server!");
      loadDomainConfig();
    } catch (error: any) {
      console.error("Failed to add domain:", error);
      toast.error(error.message || "Failed to add domain to mail server");
    } finally {
      setAddingDomain(false);
    }
  };

  // App Domain functions
  const addAppDomain = async () => {
    if (!newAppDomain) {
      toast.error("Please enter a domain");
      return;
    }

    // Validate domain format
    if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(newAppDomain)) {
      toast.error("Please enter a valid domain name");
      return;
    }

    try {
      setAddingAppDomain(true);
      const orgId = localStorage.getItem("garage_org_id");

      const res = await api<{
        success: boolean;
        domain: string;
        dnsRecords: DnsRecord[];
      }>(`/initial-setup/add-app-domain`, {
        method: "POST",
        body: JSON.stringify({
          orgId,
          domain: newAppDomain,
        }),
      });

      toast.success(`Domain ${res.domain} added! Configure DNS records.`);
      setNewAppDomain("");
      setShowAddAppDomain(false);
      loadDomainConfig();
    } catch (error: any) {
      console.error("Failed to add app domain:", error);
      toast.error(error.message || "Failed to add domain");
    } finally {
      setAddingAppDomain(false);
    }
  };

  const verifyAppDomain = async (domain: string) => {
    try {
      setVerifyingAppDomain(domain);
      const orgId = localStorage.getItem("garage_org_id");

      const res = await api<{
        success: boolean;
        verified: boolean;
        cnameVerified: boolean;
        txtVerified: boolean;
        dnsRecords: DnsRecord[];
      }>(`/initial-setup/verify-app-domain`, {
        method: "POST",
        body: JSON.stringify({ orgId, domain }),
      });

      if (res.verified) {
        toast.success(`Domain ${domain} verified!`);
      } else {
        toast.error("DNS not configured yet. Please check your records.");
      }

      loadDomainConfig();
    } catch (error: any) {
      console.error("Failed to verify app domain:", error);
      toast.error(error.message || "Failed to verify domain");
    } finally {
      setVerifyingAppDomain(null);
    }
  };

  const removeAppDomain = async (domain: string) => {
    if (!confirm(`Are you sure you want to remove ${domain}?`)) return;

    try {
      const orgId = localStorage.getItem("garage_org_id");

      await api(`/initial-setup/app-domain`, {
        method: "DELETE",
        body: JSON.stringify({ orgId, domain }),
      });

      toast.success("Domain removed");
      loadDomainConfig();
    } catch (error: any) {
      console.error("Failed to remove domain:", error);
      toast.error(error.message || "Failed to remove domain");
    }
  };

  const setPrimaryDomain = async (domain: string) => {
    try {
      const orgId = localStorage.getItem("garage_org_id");

      await api(`/initial-setup/set-primary-app-domain`, {
        method: "POST",
        body: JSON.stringify({ orgId, domain }),
      });

      toast.success(`${domain} is now your primary domain`);
      loadDomainConfig();
    } catch (error: any) {
      console.error("Failed to set primary domain:", error);
      toast.error(error.message || "Failed to set primary domain");
    }
  };

  if (!amIFounder) {
    return (
      <div className="h-full overflow-y-auto py-6">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <Shield className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Founders Only
              </h2>
              <p className="text-gray-400">
                Domain management is only available for organization founders.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full overflow-y-auto py-6">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center justify-center h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto py-6">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold text-white mb-2">
            Domain Management
          </h1>
          <p className="text-gray-400">
            Manage email domains and custom app domains for your organization.
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("email")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "email"
                ? "bg-purple-600 text-white"
                : "bg-[#1a1a20] text-gray-400 hover:bg-[#2a2a35]"
            }`}
          >
            <Server className="h-4 w-4 inline-block mr-2" />
            Email Domain
          </button>
          <button
            onClick={() => setActiveTab("app")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "app"
                ? "bg-purple-600 text-white"
                : "bg-[#1a1a20] text-gray-400 hover:bg-[#2a2a35]"
            }`}
          >
            <Globe className="h-4 w-4 inline-block mr-2" />
            App Domains
            {appDomains.length > 0 && (
              <Badge className="ml-2 bg-purple-500/20 text-purple-400">
                {appDomains.length}
              </Badge>
            )}
          </button>
        </div>

        {/* Email Domain Tab */}
        {activeTab === "email" && (
          <>
            {/* Domain Status Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-6 rounded-xl bg-[#0e0e12] border border-[#2a2a35] mb-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      domainConfig?.type === "custom"
                        ? "bg-purple-500/20"
                        : "bg-blue-500/20"
                    }`}
                  >
                    {domainConfig?.type === "custom" ? (
                      <Server className="h-5 w-5 text-purple-400" />
                    ) : (
                      <Globe className="h-5 w-5 text-blue-400" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {domainConfig?.type === "custom"
                        ? "Custom Domain"
                        : "Default Domain"}
                    </h2>
                    <p className="text-sm text-gray-400">
                      {domainConfig?.customDomain || "Not configured"}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={loadDomainConfig}
                  variant="outline"
                  size="sm"
                  className="!bg-[#1a1a20] !border-[#2a2a35] text-gray-300 hover:!bg-[#2a2a35]"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-[#111116] border border-[#2a2a35]">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                    Domain Type
                  </p>
                  <Badge
                    variant="outline"
                    className={
                      domainConfig?.type === "custom"
                        ? "border-purple-500 text-purple-400"
                        : "border-blue-500 text-blue-400"
                    }
                  >
                    {domainConfig?.type === "custom" ? "Custom" : "Default"}
                  </Badge>
                </div>

                <div className="p-4 rounded-lg bg-[#111116] border border-[#2a2a35]">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                    DNS Verification
                  </p>
                  {domainConfig?.type === "default" ? (
                    <Badge
                      variant="outline"
                      className="border-green-500 text-green-400"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Pre-verified
                    </Badge>
                  ) : domainConfig?.verified ? (
                    <Badge
                      variant="outline"
                      className="border-green-500 text-green-400"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-yellow-500 text-yellow-400"
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  )}
                </div>

                <div className="p-4 rounded-lg bg-[#111116] border border-[#2a2a35]">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                    Mail Server
                  </p>
                  {domainConfig?.domainAddedToMailcow ? (
                    <Badge
                      variant="outline"
                      className="border-green-500 text-green-400"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-gray-500 text-gray-400"
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      Not Connected
                    </Badge>
                  )}
                </div>
              </div>

              {domainConfig?.verifiedAt && (
                <div className="mt-4 pt-4 border-t border-[#2a2a35]">
                  <p className="text-xs text-gray-500">
                    Verified on{" "}
                    {new Date(domainConfig.verifiedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
            </motion.div>

            {/* DNS Records Section */}
            {domainConfig?.type === "custom" &&
              domainConfig?.dnsRecords?.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="p-6 rounded-xl bg-[#0e0e12] border border-[#2a2a35] mb-6"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-semibold text-white mb-1">
                        DNS Records
                      </h2>
                      <p className="text-sm text-gray-400">
                        Configure these records at your domain registrar
                      </p>
                    </div>
                    <Button
                      onClick={copyAllDnsRecords}
                      size="sm"
                      variant="outline"
                      className="!bg-[#1a1a20] !border-[#2a2a35] text-gray-300 hover:!bg-[#2a2a35]"
                    >
                      <Copy className="h-3 w-3 mr-2" />
                      Copy All
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {domainConfig.dnsRecords.map((record, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-lg bg-[#111116] border border-[#2a2a35]"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                record.type === "MX"
                                  ? "border-purple-500 text-purple-400"
                                  : record.type === "TXT"
                                  ? "border-blue-500 text-blue-400"
                                  : "border-orange-500 text-orange-400"
                              }`}
                            >
                              {record.type}
                            </Badge>
                            {record.verified ? (
                              <div className="flex items-center gap-1 text-green-400">
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="text-xs">Verified</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-red-400">
                                <X className="h-4 w-4" />
                                <span className="text-xs">Not Verified</span>
                              </div>
                            )}
                          </div>
                          <Button
                            onClick={() => copyToClipboard(record.value)}
                            size="sm"
                            variant="ghost"
                            className="h-7 text-gray-400 hover:text-white"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Name / Host</p>
                            <p className="text-sm text-gray-300 font-mono bg-[#0e0e12] px-2 py-1 rounded">
                              {record.name}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Value</p>
                            <p className="text-sm text-gray-300 font-mono bg-[#0e0e12] px-2 py-1 rounded break-all">
                              {record.priority ? `${record.priority} ` : ""}
                              {record.value}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 mt-6">
                    <Button
                      onClick={verifyDns}
                      disabled={verifying}
                      variant="outline"
                      className="flex-1 !bg-[#1a1a20] !border-[#2a2a35] text-gray-300 hover:!bg-[#2a2a35]"
                    >
                      {verifying ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Verify DNS Records
                    </Button>
                    {domainConfig.verified && !domainConfig.domainAddedToMailcow && (
                      <Button
                        onClick={addDomainToMailcow}
                        disabled={addingDomain}
                        className="flex-1 !bg-green-600 hover:!bg-green-700 text-white"
                      >
                        {addingDomain ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Server className="h-4 w-4 mr-2" />
                        )}
                        Add to Mail Server
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}
          </>
        )}

        {/* App Domains Tab */}
        {activeTab === "app" && (
          <>
            {wlStatusLoading ? (
              <div className="flex items-center gap-2 p-6 text-sm text-[#9fa0b8]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking whitelabel access…
              </div>
            ) : (
              // Access itself is gated one level up by WhitelabelGate —
              // an org without the add-on gets the WhitelabelPage pitch
              // and never reaches this tab.
              <>
                {wlStatus?.currentEnd && (
                  <div className="mb-4 flex items-center gap-2 text-xs text-[#9fa0b8]">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    Whitelabel active — renews{" "}
                    {new Date(wlStatus.currentEnd).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                )}
                {/* Add App Domain */}
                <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-xl bg-[#0e0e12] border border-[#2a2a35] mb-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white mb-1">
                    Custom App Domains
                  </h2>
                  <p className="text-sm text-gray-400">
                    Add your own domain to access Garage workspace
                  </p>
                </div>
                <Button
                  onClick={() => setShowAddAppDomain(true)}
                  className="!bg-purple-600 hover:!bg-purple-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Domain
                </Button>
              </div>

              {/* Buy a domain — for founders who don't have one yet.
                  Connecting an existing domain stays below, unchanged. */}
              {orgIdForPurchase && (
                <div className="mb-6">
                  <DomainSearchPanel orgId={orgIdForPurchase} />
                </div>
              )}

              {/* Add Domain Form */}
              <AnimatePresence>
                {showAddAppDomain && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-4 rounded-lg bg-[#111116] border border-[#2a2a35]"
                  >
                    <div className="flex gap-3">
                      <Input
                        value={newAppDomain}
                        onChange={(e) =>
                          setNewAppDomain(e.target.value.toLowerCase())
                        }
                        placeholder="app.yourdomain.com"
                        className="flex-1 !bg-[#1a1a20] !border-[#2a2a35] text-white"
                      />
                      <Button
                        onClick={addAppDomain}
                        disabled={addingAppDomain || !newAppDomain}
                        className="!bg-green-600 hover:!bg-green-700 text-white"
                      >
                        {addingAppDomain ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Add"
                        )}
                      </Button>
                      <Button
                        onClick={() => {
                          setShowAddAppDomain(false);
                          setNewAppDomain("");
                        }}
                        variant="outline"
                        className="!bg-[#1a1a20] !border-[#2a2a35]"
                      >
                        Cancel
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Enter your domain (e.g., app.yourcompany.com or yourcompany.com)
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Domain List */}
              {appDomains.length === 0 ? (
                <div className="text-center py-8">
                  <Globe className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No custom domains added yet</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Add a domain to access Garage from your own URL
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {appDomains.map((domain) => (
                    <div
                      key={domain.domain}
                      className="p-4 rounded-lg bg-[#111116] border border-[#2a2a35]"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Globe className="h-5 w-5 text-purple-400" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">
                                {domain.domain}
                              </span>
                              {domain.isPrimary && (
                                <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
                                  <Star className="h-3 w-3 mr-1" />
                                  Primary
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {domain.verified ? (
                                <Badge
                                  variant="outline"
                                  className="border-green-500 text-green-400 text-xs"
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Verified
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-yellow-500 text-yellow-400 text-xs"
                                >
                                  <Clock className="h-3 w-3 mr-1" />
                                  Pending
                                </Badge>
                              )}
                              {domain.verified &&
                                domain.appHealth?.ok === false && (
                                  <Badge
                                    variant="outline"
                                    className="border-red-500 text-red-400 text-xs"
                                  >
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Not serving the app
                                  </Badge>
                                )}
                            </div>
                            {domain.verified &&
                              domain.appHealth?.ok === false && (
                                <p className="mt-1.5 text-[11px] leading-relaxed text-red-400/80 max-w-md">
                                  DNS and SSL are fine, but this domain is not
                                  serving the current app
                                  {domain.appHealth?.error
                                    ? ` (${domain.appHealth.error})`
                                    : ""}
                                  . Re-point it at the Garage deployment in your
                                  hosting dashboard. Until then, shared and
                                  affiliate links are issued on my.garage.app so
                                  they keep working.
                                </p>
                              )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {domain.verified && (
                            <a
                              href={`https://${domain.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg hover:bg-[#2a2a35] text-gray-400 hover:text-white"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          {domain.verified && !domain.isPrimary && (
                            <Button
                              onClick={() => setPrimaryDomain(domain.domain)}
                              size="sm"
                              variant="outline"
                              className="!bg-[#1a1a20] !border-[#2a2a35] text-gray-300 hover:!bg-[#2a2a35]"
                            >
                              <Star className="h-3 w-3 mr-1" />
                              Set Primary
                            </Button>
                          )}
                          <Button
                            onClick={() => verifyAppDomain(domain.domain)}
                            disabled={verifyingAppDomain === domain.domain}
                            size="sm"
                            variant="outline"
                            className="!bg-[#1a1a20] !border-[#2a2a35] text-gray-300 hover:!bg-[#2a2a35]"
                          >
                            {verifyingAppDomain === domain.domain ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            onClick={() => removeAppDomain(domain.domain)}
                            size="sm"
                            variant="outline"
                            className="!bg-red-500/10 !border-red-500/30 text-red-400 hover:!bg-red-500/20"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* DNS Records for this domain */}
                      {!domain.verified && domain.dnsRecords?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#2a2a35]">
                          <p className="text-xs text-gray-500 mb-2">
                            Add these records at your DNS provider. Each field
                            goes in the matching box on their form.
                          </p>
                          {/*
                            Every field is labelled and separately copyable.
                            These get typed into a registrar's form one box at
                            a time, so the old single "name → value" line meant
                            hand-selecting a substring — and a TXT challenge
                            value is 50+ characters, which overflowed the row
                            and was silently clipped.
                          */}
                          <div className="space-y-2">
                            {domain.dnsRecords.map((record, idx) => (
                              <div
                                key={idx}
                                className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-3"
                              >
                                <div className="mb-2 flex items-center gap-2">
                                  <span className="text-[11px] uppercase tracking-wide text-gray-500">
                                    Type
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {record.type}
                                  </Badge>
                                  {record.verified ? (
                                    <span className="ml-auto flex items-center gap-1 text-[11px] text-green-400">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Verified
                                    </span>
                                  ) : (
                                    <span className="ml-auto text-[11px] text-gray-500">
                                      Not detected yet
                                    </span>
                                  )}
                                </div>

                                {[
                                  { label: "Name / Host", value: record.name },
                                  { label: "Value", value: record.value },
                                ].map((field) => (
                                  <div
                                    key={field.label}
                                    className="flex items-start gap-2 py-1"
                                  >
                                    <span className="w-24 shrink-0 pt-0.5 text-[11px] uppercase tracking-wide text-gray-500">
                                      {field.label}
                                    </span>
                                    {/* break-all so a long TXT challenge wraps
                                        in full rather than being clipped. */}
                                    <code className="min-w-0 flex-1 break-all font-mono text-xs text-gray-200">
                                      {field.value}
                                    </code>
                                    <Button
                                      onClick={() => copyToClipboard(field.value)}
                                      size="sm"
                                      variant="ghost"
                                      title={`Copy ${field.label}`}
                                      className="h-6 shrink-0 px-1.5 text-gray-400 hover:text-white"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}

                                {/*
                                  The commonest mistake: pasting the full
                                  hostname into Host, which most registrars
                                  append the domain to — producing
                                  _vercel.example.com.example.com and a
                                  challenge that never verifies.
                                */}
                                {record.name !== "@" && (
                                  <p className="mt-1.5 text-[11px] leading-snug text-gray-500">
                                    Enter the Name exactly as shown — most
                                    providers add{" "}
                                    <span className="font-mono">
                                      .{domain.domain}
                                    </span>{" "}
                                    for you.
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* How it works */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20"
            >
              <h4 className="text-sm font-medium text-purple-400 mb-2">
                How Custom Domains Work
              </h4>
              <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
                <li>Add your domain (e.g., app.yourcompany.com)</li>
                <li>Configure A record to point to <code className="text-purple-400">{targetIp || targetCname}</code></li>
                <li>Add TXT record for ownership verification</li>
                <li>Click verify once DNS propagates (up to 48 hours)</li>
                <li>Your Garage workspace is now accessible at your domain!</li>
              </ol>
            </motion.div>
              </>
            )}
          </>
        )}

        {/* Help Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-blue-400 mb-1">
                Need Help?
              </h4>
              <p className="text-sm text-gray-400">
                DNS changes can take up to 48 hours to propagate. If your
                records aren't verifying, please wait and try again. Make sure
                you've added all required records at your domain registrar.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

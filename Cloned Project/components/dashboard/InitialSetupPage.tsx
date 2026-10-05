"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Mail,
  Check,
  X,
  RefreshCw,
  Copy,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Inbox,
  ArrowRight,
  Server,
  Send,
  PenSquare,
  SendHorizonal,
  Paperclip,
  Clock,
  User,
  ArrowLeft,
  Reply,
  Forward,
  Trash2,
  Star,
  Search,
  MoreVertical,
  Archive,
  MailOpen,
  Tag,
  ChevronDown,
  Plus,
  Settings,
  Menu,
  FileEdit,
  ShieldAlert,
  FolderArchive,
  UserCircle,
  ChevronUp,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import EmailSenderSetup from "./EmailSenderSetup";
import {
  createMailbox as createMailboxDirect,
  isApiSuccess,
  getApiErrorMessage,
} from "@/lib/mail-api";

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

type MailboxConfig = {
  created: boolean;
  email?: string;
  localPart?: string;
  domain?: string;
  lastFetchedAt?: string;
};

type SetupStatus = {
  organization: {
    name: string;
    id: string;
  };
  setupStatus: {
    domainType: string;
    customDomain?: string;
    domainVerified: boolean;
    domainAddedToMailcow: boolean;
    domainConfigured: boolean;
    mailboxCreated: boolean;
    mailboxEmail?: string;
    currentStep: number;
    totalSteps: number;
  };
  userRole: "founder" | "stakeholder";
};

type Email = {
  _id?: string;
  id?: string;
  seqno?: number;
  subject: string;
  from: string;
  to: string;
  date: string;
  text: string;
  html?: string | boolean;
  hasHtml?: boolean;
  attachments: number;
  flags?: string[];
  uid?: number;
  isRead?: boolean;
  isStarred?: boolean;
};

type FolderType = "INBOX" | "Sent" | "Drafts" | "Junk" | "Trash" | "Archive";

export default function InitialSetupPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [addingDomain, setAddingDomain] = useState(false);
  const [creatingMailbox, setCreatingMailbox] = useState(false);
  const [fetchingEmails, setFetchingEmails] = useState(false);
  const [resettingDomain, setResettingDomain] = useState(false);

  // Domain config state
  const [domainType, setDomainType] = useState<"default" | "custom">("default");
  const [customDomain, setCustomDomain] = useState("");
  const [domainConfig, setDomainConfig] = useState<DomainConfig | null>(null);

  // Mailbox state
  const [mailboxConfig, setMailboxConfig] = useState<MailboxConfig | null>(
    null
  );
  const [localPart, setLocalPart] = useState("");

  // Email inbox state
  const [emails, setEmails] = useState<Email[]>([]);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [draftsEmails, setDraftsEmails] = useState<Email[]>([]);
  const [junkEmails, setJunkEmails] = useState<Email[]>([]);
  const [trashEmails, setTrashEmails] = useState<Email[]>([]);
  const [archiveEmails, setArchiveEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [activeFolder, setActiveFolder] = useState<FolderType>("INBOX");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);

  // Mailbox switching state
  const [userMailboxes, setUserMailboxes] = useState<any[]>([]);
  const [activeMailbox, setActiveMailbox] = useState<any>(null);
  const [showMailboxDropdown, setShowMailboxDropdown] = useState(false);
  const [showAddMailbox, setShowAddMailbox] = useState(false);
  const [newMailboxLocalPart, setNewMailboxLocalPart] = useState("");
  const [newMailboxDomain, setNewMailboxDomain] = useState<
    "default" | "custom"
  >("custom");
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newCustomDomain, setNewCustomDomain] = useState("");
  const [showDnsInModal, setShowDnsInModal] = useState(false);

  // Compose email state
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [composeMinimized, setComposeMinimized] = useState(false);

  // Setup status
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [userRole, setUserRole] = useState<"founder" | "stakeholder">(
    "stakeholder"
  );

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const orgId = localStorage.getItem("garage_org_id");

      const [configRes, statusRes, mailboxesRes] = await Promise.all([
        api<{
          domainConfig: DomainConfig;
          mailboxConfig: MailboxConfig;
          userRole: "founder" | "stakeholder";
        }>(`/initial-setup/domain-config?orgId=${orgId}`),
        api<SetupStatus>(`/initial-setup/status?orgId=${orgId}`),
        api<{ success: boolean; mailboxes: any[] }>(
          `/initial-setup/user-mailboxes?orgId=${orgId}`
        ).catch(() => ({ success: false, mailboxes: [] })),
      ]);

      setDomainConfig(configRes.domainConfig);
      setMailboxConfig(configRes.mailboxConfig);
      setSetupStatus(statusRes);
      setUserRole(configRes.userRole || statusRes.userRole || "stakeholder");
      setUserMailboxes(mailboxesRes.mailboxes || []);

      if (configRes.domainConfig) {
        setDomainType(configRes.domainConfig.type);
        setCustomDomain(configRes.domainConfig.customDomain || "");
      }
    } catch (error) {
      console.error("Failed to load config:", error);
      toast.error("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const saveDomainConfig = async () => {
    try {
      setSaving(true);
      const orgId = localStorage.getItem("garage_org_id");

      const res = await api<{ success: boolean; domainConfig: DomainConfig }>(
        `/initial-setup/domain-config`,
        {
          method: "POST",
          body: JSON.stringify({
            orgId,
            type: domainType,
            customDomain: domainType === "custom" ? customDomain : undefined,
          }),
        }
      );

      setDomainConfig(res.domainConfig);
      toast.success("Domain configuration saved");
      loadConfig();
    } catch (error: any) {
      console.error("Failed to save domain config:", error);
      toast.error(error.message || "Failed to save domain configuration");
    } finally {
      setSaving(false);
    }
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
      loadConfig();
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
      loadConfig();
    } catch (error: any) {
      console.error("Failed to add domain:", error);
      toast.error(error.message || "Failed to add domain to mail server");
    } finally {
      setAddingDomain(false);
    }
  };

  const createMailbox = async () => {
    if (!localPart) {
      toast.error("Please enter username");
      return;
    }

    // Use default password
    const defaultPassword = "Test@123";

    // Get domain from config (custom domain or default networkmail.com)
    const domain = domainConfig?.customDomain || "networkmail.com";

    try {
      setCreatingMailbox(true);
      const orgId = localStorage.getItem("garage_org_id");

      // Use direct Mailcow API call (same as /mail Mail Manager page)
      const response = await createMailboxDirect({
        local_part: localPart,
        name: localPart,
        domain: domain,
        password: defaultPassword,
        password2: defaultPassword,
        quota: "250",
        active: "1",
        force_pw_update: "0",
        tls_enforce_in: "1",
        tls_enforce_out: "1",
      });

      if (!isApiSuccess(response)) {
        throw new Error(getApiErrorMessage(response));
      }

      const email = `${localPart}@${domain}`;

      // Save mailbox config to backend database
      try {
        await api(`/initial-setup/save-mailbox`, {
          method: "POST",
          body: JSON.stringify({
            orgId,
            localPart,
            email,
            password: defaultPassword, // needed for IMAP access
          }),
        });
      } catch (saveError) {
        console.warn(
          "Failed to save mailbox to backend, but mailbox was created:",
          saveError
        );
      }

      toast.success(`Mailbox ${email} created!`);
      loadConfig();
    } catch (error: any) {
      console.error("Failed to create mailbox:", error);
      toast.error(error.message || "Failed to create mailbox");
    } finally {
      setCreatingMailbox(false);
    }
  };

  // Load cached emails from database
  const loadCachedEmails = async (folder: FolderType) => {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const res = await api<{
        success: boolean;
        emails: Email[];
        total: number;
      }>(`/initial-setup/emails?orgId=${orgId}&folder=${folder}&limit=50`);

      setFolderEmails(folder, res.emails);
      return res.emails.length;
    } catch (error) {
      console.error("Failed to load cached emails:", error);
      return 0;
    }
  };

  // Sync emails from IMAP server
  const fetchEmails = async (
    folder: FolderType = activeFolder,
    showToast = true,
    forceRefresh = true
  ) => {
    try {
      setFetchingEmails(true);
      const orgId = localStorage.getItem("garage_org_id");

      const res = await api<{
        success: boolean;
        emails: Email[];
        newCount: number;
      }>(`/initial-setup/sync-emails`, {
        method: "POST",
        body: JSON.stringify({ orgId, folder, forceRefresh }),
      });

      setFolderEmails(folder, res.emails);

      if (showToast) {
        if (res.newCount > 0) {
          toast.success(
            `Synced ${res.newCount} new email${res.newCount > 1 ? "s" : ""}`
          );
        } else {
          toast.success("Emails are up to date");
        }
      }
    } catch (error: any) {
      console.error("Failed to sync emails:", error);
      try {
        const orgId = localStorage.getItem("garage_org_id");
        const res = await api<{ success: boolean; emails: Email[] }>(
          `/initial-setup/fetch-inbox?orgId=${orgId}&folder=${folder}&limit=50`
        );

        setFolderEmails(folder, res.emails);

        if (showToast) {
          toast.success(`Fetched ${res.emails.length} emails`);
        }
      } catch (fallbackError: any) {
        toast.error(fallbackError.message || "Failed to fetch emails");
      }
    } finally {
      setFetchingEmails(false);
    }
  };

  const handleFolderChange = async (folder: FolderType) => {
    setActiveFolder(folder);
    setSelectedEmail(null);

    const cachedCount = await loadCachedEmails(folder);

    if (cachedCount === 0) {
      fetchEmails(folder, false, true); // Force refresh if no cached emails
    }
  };

  // Auto-load inbox emails when mailbox is ready
  useEffect(() => {
    if (mailboxConfig?.created) {
      loadCachedEmails("INBOX").then((count) => {
        if (count === 0) {
          fetchEmails("INBOX", false, true); // Force refresh on first load
        }
      });
    }
  }, [mailboxConfig?.created]);

  // Get emails for current folder
  const getFolderEmails = (folder: FolderType): Email[] => {
    switch (folder) {
      case "INBOX":
        return emails;
      case "Sent":
        return sentEmails;
      case "Drafts":
        return draftsEmails;
      case "Junk":
        return junkEmails;
      case "Trash":
        return trashEmails;
      case "Archive":
        return archiveEmails;
      default:
        return emails;
    }
  };

  const setFolderEmails = (folder: FolderType, newEmails: Email[]) => {
    switch (folder) {
      case "INBOX":
        setEmails(newEmails);
        break;
      case "Sent":
        setSentEmails(newEmails);
        break;
      case "Drafts":
        setDraftsEmails(newEmails);
        break;
      case "Junk":
        setJunkEmails(newEmails);
        break;
      case "Trash":
        setTrashEmails(newEmails);
        break;
      case "Archive":
        setArchiveEmails(newEmails);
        break;
    }
  };

  const currentEmails = getFolderEmails(activeFolder);

  // Filter emails by search query
  const filteredEmails = currentEmails.filter((email) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      email.subject?.toLowerCase().includes(query) ||
      email.from?.toLowerCase().includes(query) ||
      email.to?.toLowerCase().includes(query) ||
      email.text?.toLowerCase().includes(query)
    );
  });

  // Helper to format date
  const formatEmailDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isThisYear = date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (isThisYear) {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Helper to extract sender/recipient name
  const extractName = (emailStr: string) => {
    if (!emailStr) return "Unknown";
    const match = emailStr.match(/^([^<]+)</);
    if (match) return match[1].trim();
    return emailStr.split("@")[0];
  };

  // Check if email is unread
  const isUnread = (email: Email) => {
    if (email.isRead !== undefined) return !email.isRead;
    return !email.flags?.includes("\\Seen");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const copyAllDnsRecords = () => {
    if (!domainConfig?.dnsRecords?.length) return;

    const recordsText = domainConfig.dnsRecords
      .map((record) => {
        const priority = record.priority ? `${record.priority} ` : "";
        return `Type: ${record.type}\nName: ${record.name}\nValue: ${priority}${record.value}`;
      })
      .join("\n\n");

    navigator.clipboard.writeText(recordsText);
    toast.success("All DNS records copied to clipboard");
  };

  const resetDomainConfig = async () => {
    try {
      setResettingDomain(true);
      const orgId = localStorage.getItem("garage_org_id");

      await api(`/initial-setup/reset-domain-config`, {
        method: "POST",
        body: JSON.stringify({ orgId }),
      });

      toast.success("Domain configuration reset");
      setDomainConfig(null);
      setDomainType("default");
      setCustomDomain("");
      loadConfig();
    } catch (error: any) {
      console.error("Failed to reset domain config:", error);
      toast.error(error.message || "Failed to reset domain configuration");
    } finally {
      setResettingDomain(false);
    }
  };

  const sendEmail = async () => {
    if (!composeTo || !composeSubject || !composeBody) {
      toast.error("Please fill in all fields");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(composeTo)) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setSendingEmail(true);
      const orgId = localStorage.getItem("garage_org_id");

      await api(`/initial-setup/send-email`, {
        method: "POST",
        body: JSON.stringify({
          orgId,
          to: composeTo,
          subject: composeSubject,
          body: composeBody,
          isHtml: false,
        }),
      });

      toast.success("Email sent!");
      setShowCompose(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");

      // Sync sent folder after sending
      setTimeout(() => {
        fetchEmails("Sent", false);
      }, 2000);
    } catch (error: any) {
      console.error("Failed to send email:", error);
      toast.error(error.message || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  const currentStep = setupStatus?.setupStatus.currentStep || 1;
  const totalSteps = setupStatus?.setupStatus.totalSteps || 3;
  const domain = domainConfig?.customDomain || "networkmail.com";

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0b0b0d]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Show setup wizard if mailbox not created
  if (!mailboxConfig?.created) {
    return (
      <div className="h-full flex flex-col bg-[#0b0b0d] text-white">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a35]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-600/10 border border-purple-500/20">
              <Mail className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Network Mail Setup</h1>
              <p className="text-xs text-gray-400">
                {userRole === "founder"
                  ? "Configure your organization's email"
                  : "Create your email account"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              Step {currentStep} of {totalSteps}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-6 rounded-full ${
                    i + 1 <= currentStep ? "bg-blue-500" : "bg-[#2a2a35]"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Stakeholder waiting message */}
            {userRole === "stakeholder" && !domainConfig?.customDomain && (
              <div className="p-6 rounded-lg bg-[#0e0e12] border border-[#2a2a35]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <AlertCircle className="h-6 w-6 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-lg">Waiting for Setup</h3>
                    <p className="text-sm text-gray-400">
                      Your organization founder needs to configure the email
                      domain first.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* White-label sending domain (Resend) — founders only.
                Placed above the mailbox steps because it is what a white-label
                office needs first: it changes who mail appears to come FROM.
                It creates no mailboxes; the steps below do that. */}
            {userRole === "founder" && (
              <div className="mb-4">
                <EmailSenderSetup
                  orgId={
                    typeof window !== "undefined"
                      ? localStorage.getItem("garage_org_id")
                      : null
                  }
                />
              </div>
            )}

            {/*
              Step 1: Choose Domain (Mailcow) — only for offices already using
              it.

              Mailcow provisions MAILBOXES (receiving, IMAP). Garage is moving
              transactional sending to Resend, which is the card above, and the
              two look interchangeable on this page — founders were completing
              the Mailcow step expecting Resend's DNS records.

              Not removed outright: three offices have verified Mailcow domains
              and live mailboxes, with 133k stored messages and mail still
              arriving, so they must keep access to re-verify DNS. Offices with
              nothing configured no longer see it at all.
            */}
            {userRole === "founder" && domainConfig?.customDomain && (
              <div className="p-4 rounded-lg bg-[#0e0e12] border border-[#2a2a35]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        currentStep > 1
                          ? "bg-green-500 text-white"
                          : "bg-blue-500 text-white"
                      }`}
                    >
                      {currentStep > 1 ? <Check className="h-4 w-4" /> : "1"}
                    </div>
                    <h3 className="font-medium">Choose Domain</h3>
                  </div>
                  {domainConfig?.type &&
                    currentStep > 1 &&
                    !mailboxConfig?.created && (
                      <Button
                        onClick={resetDomainConfig}
                        disabled={resettingDomain}
                        size="sm"
                        variant="outline"
                        className="!bg-[#1a1a20] !border-[#2a2a35] text-gray-400 hover:text-white hover:!bg-[#2a2a35]"
                      >
                        {resettingDomain ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Change"
                        )}
                      </Button>
                    )}
                </div>

                {domainConfig?.customDomain && currentStep > 1 ? (
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    Using{" "}
                    {domainConfig.type === "default"
                      ? "networkmail.com"
                      : domainConfig.customDomain}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <button
                        onClick={() => setDomainType("default")}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          domainType === "default"
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-[#2a2a35] bg-[#111116] hover:border-gray-600"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Globe className="h-5 w-5 text-blue-400" />
                          {domainType === "default" && (
                            <Check className="h-4 w-4 text-blue-400" />
                          )}
                        </div>
                        <h4 className="font-medium mb-1">Default Domain</h4>
                        <p className="text-xs text-gray-400">
                          Use networkmail.com
                        </p>
                      </button>

                      <button
                        onClick={() => setDomainType("custom")}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          domainType === "custom"
                            ? "border-purple-500 bg-purple-500/10"
                            : "border-[#2a2a35] bg-[#111116] hover:border-gray-600"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Server className="h-5 w-5 text-purple-400" />
                          {domainType === "custom" && (
                            <Check className="h-4 w-4 text-purple-400" />
                          )}
                        </div>
                        <h4 className="font-medium mb-1">Custom Domain</h4>
                        <p className="text-xs text-gray-400">
                          Use your own domain
                        </p>
                      </button>
                    </div>

                    {domainType === "custom" && (
                      <div className="mb-4">
                        <Input
                          value={customDomain}
                          onChange={(e) => setCustomDomain(e.target.value)}
                          placeholder="example.com"
                          className="!bg-[#1a1a20] !border-[#2a2a35] text-white placeholder:text-gray-500"
                        />
                      </div>
                    )}

                    <Button
                      onClick={saveDomainConfig}
                      disabled={
                        saving || (domainType === "custom" && !customDomain)
                      }
                      className="w-full !bg-purple-600 hover:!bg-purple-700 text-white"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4 mr-2" />
                      )}
                      Continue
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* DNS Records (custom domain only) */}
            {userRole === "founder" &&
              domainType === "custom" &&
              domainConfig?.dnsRecords?.length > 0 && (
                <div className="p-4 rounded-lg bg-[#0e0e12] border border-[#2a2a35]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          domainConfig.verified
                            ? "bg-green-500 text-white"
                            : "bg-blue-500 text-white"
                        }`}
                      >
                        {domainConfig.verified ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          "2"
                        )}
                      </div>
                      <h3 className="font-medium">Configure DNS Records</h3>
                    </div>
                    <Button
                      onClick={copyAllDnsRecords}
                      size="sm"
                      variant="outline"
                      className="!bg-[#1a1a20] !border-[#2a2a35] text-gray-400 hover:text-white hover:!bg-[#2a2a35]"
                    >
                      <Copy className="h-3 w-3 mr-2" />
                      Copy All
                    </Button>
                  </div>

                  <div className="space-y-3 mb-4">
                    {domainConfig.dnsRecords.map((record, index) => (
                      <div
                        key={index}
                        className="p-3 rounded-lg bg-[#111116] border border-[#2a2a35]"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {record.type}
                            </Badge>
                            {record.verified ? (
                              <CheckCircle2 className="h-4 w-4 text-green-400" />
                            ) : (
                              <X className="h-4 w-4 text-red-400" />
                            )}
                          </div>
                          <Button
                            onClick={() => copyToClipboard(record.value)}
                            size="sm"
                            variant="ghost"
                            className="h-7"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-gray-400">
                          <span className="text-gray-500">Name:</span>{" "}
                          {record.name}
                        </p>
                        <p className="text-xs text-gray-400 break-all">
                          <span className="text-gray-500">Value:</span>{" "}
                          {record.priority ? `${record.priority} ` : ""}
                          {record.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
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
                      Verify DNS
                    </Button>
                    {domainConfig.verified &&
                      !domainConfig.domainAddedToMailcow && (
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
                </div>
              )}

            {/* Create Mailbox */}
            {domainConfig?.customDomain &&
              (domainConfig?.type === "default" ||
                (domainConfig?.type === "custom" &&
                  domainConfig?.domainAddedToMailcow)) && (
                <div className="p-4 rounded-lg bg-[#0e0e12] border border-[#2a2a35]">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-blue-500 text-white">
                      {userRole === "stakeholder"
                        ? "1"
                        : domainType === "default"
                        ? "2"
                        : "3"}
                    </div>
                    <h3 className="font-medium">Create Your Mailbox</h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Email Username
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={localPart}
                          onChange={(e) =>
                            setLocalPart(
                              e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9._-]/g, "")
                            )
                          }
                          placeholder="yourname"
                          className="!bg-[#1a1a20] !border-[#2a2a35] text-white placeholder:text-gray-500"
                        />
                        <span className="text-gray-400">@{domain}</span>
                      </div>
                    </div>

                    <Button
                      onClick={createMailbox}
                      disabled={creatingMailbox || !localPart}
                      className="w-full !bg-purple-600 hover:!bg-purple-700 text-white"
                    >
                      {creatingMailbox ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4 mr-2" />
                      )}
                      Create Mailbox
                    </Button>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    );
  }

  // Gmail-like Email Client UI - Dark Mode Garage Theme
  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* Top Header */}
      <div className="h-16 flex items-center justify-between px-4 bg-[#0e0e12] border-b border-[#2a2a35]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 rounded-full hover:bg-[#2a2a35]"
          >
            <Menu className="h-5 w-5 text-gray-400" />
          </button>
          <div className="flex items-center gap-2">
            <Image
              src="/networkmail.png"
              alt="Network Mail"
              width={28}
              height={28}
              className="h-7 w-7"
            />
            <span className="text-xl font-normal text-gray-200">
              Network Mail
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-2xl mx-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search mail"
              className="w-full h-12 pl-12 pr-4 rounded-full !bg-[#1a1a20] border !border-[#2a2a35] focus:!bg-[#111116] focus:!border-purple-500/50 focus:outline-none text-gray-200 placeholder:text-gray-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => fetchEmails(activeFolder)}
            disabled={fetchingEmails}
            variant="ghost"
            size="icon"
            className="rounded-full hover:!bg-[#2a2a35] text-gray-400"
          >
            {fetchingEmails ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <RefreshCw className="h-5 w-5" />
            )}
          </Button>
          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-medium">
            {mailboxConfig.email?.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <AnimatePresence>
          {showSidebar && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 256, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-[#0e0e12] border-r border-[#2a2a35] overflow-hidden"
            >
              <div className="p-4">
                {/* Compose Button */}
                <button
                  onClick={() => setShowCompose(true)}
                  className="w-full flex items-center gap-3 px-6 py-4 rounded-2xl bg-purple-600/10 border border-purple-500/20 hover:bg-purple-600/20 hover:border-purple-500/30 transition-all text-purple-400 font-medium"
                >
                  <PenSquare className="h-5 w-5" />
                  Compose
                </button>

                {/* Folder List */}
                <div className="mt-4 space-y-1">
                  {/* Inbox */}
                  <button
                    onClick={() => handleFolderChange("INBOX")}
                    className={`w-full flex items-center justify-between px-4 py-2 rounded-r-full transition-colors ${
                      activeFolder === "INBOX"
                        ? "bg-purple-600/20 text-purple-400 font-semibold"
                        : "hover:bg-[#1a1a20] text-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <Inbox className="h-5 w-5" />
                      <span>Inbox</span>
                    </div>
                    {emails.filter((e) => isUnread(e)).length > 0 && (
                      <span className="text-sm font-semibold">
                        {emails.filter((e) => isUnread(e)).length}
                      </span>
                    )}
                  </button>

                  {/* Sent */}
                  <button
                    onClick={() => handleFolderChange("Sent")}
                    className={`w-full flex items-center justify-between px-4 py-2 rounded-r-full transition-colors ${
                      activeFolder === "Sent"
                        ? "bg-purple-600/20 text-purple-400 font-semibold"
                        : "hover:bg-[#1a1a20] text-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <Send className="h-5 w-5" />
                      <span>Sent</span>
                    </div>
                    {sentEmails.length > 0 && (
                      <span className="text-sm text-gray-500">
                        {sentEmails.length}
                      </span>
                    )}
                  </button>

                  {/* Drafts */}
                  <button
                    onClick={() => handleFolderChange("Drafts")}
                    className={`w-full flex items-center justify-between px-4 py-2 rounded-r-full transition-colors ${
                      activeFolder === "Drafts"
                        ? "bg-purple-600/20 text-purple-400 font-semibold"
                        : "hover:bg-[#1a1a20] text-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <FileEdit className="h-5 w-5" />
                      <span>Drafts</span>
                    </div>
                    {draftsEmails.length > 0 && (
                      <span className="text-sm text-gray-500">
                        {draftsEmails.length}
                      </span>
                    )}
                  </button>

                  {/* Junk/Spam */}
                  <button
                    onClick={() => handleFolderChange("Junk")}
                    className={`w-full flex items-center justify-between px-4 py-2 rounded-r-full transition-colors ${
                      activeFolder === "Junk"
                        ? "bg-purple-600/20 text-purple-400 font-semibold"
                        : "hover:bg-[#1a1a20] text-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <ShieldAlert className="h-5 w-5" />
                      <span>Spam</span>
                    </div>
                    {junkEmails.length > 0 && (
                      <span className="text-sm text-orange-500">
                        {junkEmails.length}
                      </span>
                    )}
                  </button>

                  {/* Trash */}
                  <button
                    onClick={() => handleFolderChange("Trash")}
                    className={`w-full flex items-center justify-between px-4 py-2 rounded-r-full transition-colors ${
                      activeFolder === "Trash"
                        ? "bg-purple-600/20 text-purple-400 font-semibold"
                        : "hover:bg-[#1a1a20] text-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <Trash2 className="h-5 w-5" />
                      <span>Trash</span>
                    </div>
                    {trashEmails.length > 0 && (
                      <span className="text-sm text-gray-500">
                        {trashEmails.length}
                      </span>
                    )}
                  </button>

                  {/* Archive */}
                  <button
                    onClick={() => handleFolderChange("Archive")}
                    className={`w-full flex items-center justify-between px-4 py-2 rounded-r-full transition-colors ${
                      activeFolder === "Archive"
                        ? "bg-purple-600/20 text-purple-400 font-semibold"
                        : "hover:bg-[#1a1a20] text-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <FolderArchive className="h-5 w-5" />
                      <span>Archive</span>
                    </div>
                    {archiveEmails.length > 0 && (
                      <span className="text-sm text-gray-500">
                        {archiveEmails.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Account Info with Mailbox Switching */}
              <div className="absolute bottom-0 left-0 w-64 p-4 border-t border-[#2a2a35] bg-[#0e0e12]">
                <div className="relative">
                  <button
                    onClick={() => setShowMailboxDropdown(!showMailboxDropdown)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[#1a1a20] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium">
                      {mailboxConfig.email?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-white truncate">
                        {mailboxConfig.email}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        Active mailbox
                      </p>
                    </div>
                    {showMailboxDropdown ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </button>

                  {/* Mailbox Dropdown */}
                  <AnimatePresence>
                    {showMailboxDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1a20] border border-[#2a2a35] rounded-lg shadow-lg overflow-hidden z-50"
                      >
                        <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
                          <p className="text-xs text-gray-500 px-2 py-1">
                            Switch mailbox
                          </p>

                          {/* List all mailboxes */}
                          {userMailboxes.length > 0 ? (
                            userMailboxes.map((mb) => (
                              <button
                                key={mb.email}
                                onClick={async () => {
                                  if (mb.email === mailboxConfig.email) return;
                                  try {
                                    const orgId =
                                      localStorage.getItem("garage_org_id");
                                    const res = await api<{
                                      success: boolean;
                                      mailboxConfig: any;
                                      email: string;
                                    }>(`/initial-setup/switch-mailbox`, {
                                      method: "POST",
                                      body: JSON.stringify({
                                        orgId,
                                        email: mb.email,
                                      }),
                                    });
                                    if (res.success) {
                                      // Update mailbox config directly from response
                                      setMailboxConfig({
                                        created: true,
                                        email: res.mailboxConfig.email,
                                        localPart: res.mailboxConfig.localPart,
                                        domain: res.mailboxConfig.domain,
                                      });
                                      // Clear emails from previous mailbox
                                      setEmails([]);
                                      setSentEmails([]);
                                      setDraftsEmails([]);
                                      setJunkEmails([]);
                                      setTrashEmails([]);
                                      setArchiveEmails([]);
                                      setSelectedEmail(null);
                                      setShowMailboxDropdown(false);
                                      toast.success(`Switched to ${mb.email}`);
                                      // Fetch emails for new mailbox
                                      setTimeout(() => {
                                        fetchEmails("INBOX", false, true);
                                      }, 100);
                                    }
                                  } catch (error: any) {
                                    toast.error(
                                      error.message ||
                                        "Failed to switch mailbox"
                                    );
                                  }
                                }}
                                className={`w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors ${
                                  mb.email === mailboxConfig.email
                                    ? "bg-purple-600/10"
                                    : "hover:bg-[#2a2a35]"
                                }`}
                              >
                                <UserCircle
                                  className={`h-5 w-5 ${
                                    mb.email === mailboxConfig.email
                                      ? "text-purple-400"
                                      : "text-gray-400"
                                  }`}
                                />
                                <span
                                  className={`text-sm truncate ${
                                    mb.email === mailboxConfig.email
                                      ? "text-purple-400 font-medium"
                                      : "text-gray-300"
                                  }`}
                                >
                                  {mb.email}
                                </span>
                                {mb.email === mailboxConfig.email && (
                                  <Check className="h-4 w-4 text-purple-400 ml-auto" />
                                )}
                              </button>
                            ))
                          ) : (
                            <div className="flex items-center gap-2 px-2 py-2 bg-purple-600/10 rounded-md">
                              <UserCircle className="h-5 w-5 text-purple-400" />
                              <span className="text-sm text-purple-400 font-medium truncate">
                                {mailboxConfig.email}
                              </span>
                              <Check className="h-4 w-4 text-purple-400 ml-auto" />
                            </div>
                          )}

                          <div className="border-t border-[#2a2a35] my-1 pt-1" />

                          {/* Add new mailbox button */}
                          <button
                            onClick={() => {
                              setShowMailboxDropdown(false);
                              setNewMailboxDomain("custom");
                              setShowAddMailbox(true);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-2 text-gray-300 hover:bg-[#2a2a35] rounded-md transition-colors"
                          >
                            <Plus className="h-5 w-5" />
                            <span className="text-sm">Add another mailbox</span>
                          </button>

                          {/* Switch to default mail option */}
                          {domainConfig?.type === "custom" && (
                            <button
                              onClick={() => {
                                setShowMailboxDropdown(false);
                                setNewMailboxDomain("default");
                                setShowAddMailbox(true);
                              }}
                              className="w-full flex items-center gap-2 px-2 py-2 text-gray-300 hover:bg-[#2a2a35] rounded-md transition-colors"
                            >
                              <Globe className="h-5 w-5" />
                              <span className="text-sm">Use default mail</span>
                            </button>
                          )}

                          {/* Add custom domain (Founder only) */}
                          {userRole === "founder" && (
                            <button
                              onClick={() => {
                                setShowMailboxDropdown(false);
                                setShowAddDomain(true);
                              }}
                              className="w-full flex items-center gap-2 px-2 py-2 text-gray-300 hover:bg-[#2a2a35] rounded-md transition-colors border-t border-[#2a2a35] mt-1 pt-2"
                            >
                              <Server className="h-5 w-5" />
                              <span className="text-sm">Add custom domain</span>
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Email List or Detail View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Email List */}
          <div
            className={`${
              selectedEmail ? "hidden lg:block lg:w-[400px]" : "flex-1"
            } bg-[#0e0e12] overflow-hidden flex flex-col`}
          >
            {/* List Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a35]">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded !bg-[#1a1a20] !border-[#2a2a35] accent-purple-600"
                />
                <button
                  onClick={() => fetchEmails(activeFolder)}
                  disabled={fetchingEmails}
                  className="p-2 rounded-full hover:bg-[#2a2a35] disabled:opacity-50"
                >
                  {fetchingEmails ? (
                    <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 text-gray-500" />
                  )}
                </button>
                <button className="p-2 rounded-full hover:bg-[#2a2a35]">
                  <MoreVertical className="h-4 w-4 text-gray-500" />
                </button>
              </div>
              <span className="text-xs text-gray-500">
                {filteredEmails.length} of {currentEmails.length}
              </span>
            </div>

            {/* Email Items */}
            <div className="flex-1 overflow-auto">
              {filteredEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  {activeFolder === "INBOX" && (
                    <Inbox className="h-16 w-16 mb-4 text-gray-600" />
                  )}
                  {activeFolder === "Sent" && (
                    <Send className="h-16 w-16 mb-4 text-gray-600" />
                  )}
                  {activeFolder === "Drafts" && (
                    <FileEdit className="h-16 w-16 mb-4 text-gray-600" />
                  )}
                  {activeFolder === "Junk" && (
                    <ShieldAlert className="h-16 w-16 mb-4 text-gray-600" />
                  )}
                  {activeFolder === "Trash" && (
                    <Trash2 className="h-16 w-16 mb-4 text-gray-600" />
                  )}
                  {activeFolder === "Archive" && (
                    <FolderArchive className="h-16 w-16 mb-4 text-gray-600" />
                  )}
                  <p className="text-lg">
                    No emails in{" "}
                    {activeFolder === "INBOX"
                      ? "Inbox"
                      : activeFolder === "Sent"
                      ? "Sent"
                      : activeFolder === "Drafts"
                      ? "Drafts"
                      : activeFolder === "Junk"
                      ? "Spam"
                      : activeFolder === "Trash"
                      ? "Trash"
                      : activeFolder === "Archive"
                      ? "Archive"
                      : activeFolder}
                  </p>
                  <Button
                    onClick={() => fetchEmails(activeFolder)}
                    disabled={fetchingEmails}
                    variant="outline"
                    className="mt-4 !bg-[#1a1a20] !border-[#2a2a35] text-gray-300 hover:!bg-[#2a2a35]"
                  >
                    {fetchingEmails ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Refresh
                  </Button>
                </div>
              ) : (
                filteredEmails.map((email) => (
                  <div
                    key={email._id || email.id || email.uid}
                    onClick={() => setSelectedEmail(email)}
                    className={`flex items-center gap-4 px-4 py-3 border-b border-[#1a1a20] cursor-pointer transition-colors ${
                      selectedEmail?._id === email._id ||
                      selectedEmail?.uid === email.uid
                        ? "bg-purple-600/10"
                        : isUnread(email)
                        ? "bg-[#0e0e12] hover:bg-[#1a1a20]"
                        : "bg-[#111116] hover:bg-[#1a1a20]"
                    }`}
                  >
                    {/* Checkbox & Star */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded !bg-[#1a1a20] !border-[#2a2a35] accent-purple-600"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        className="text-gray-500 hover:text-yellow-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Star
                          className={`h-5 w-5 ${
                            email.isStarred
                              ? "fill-yellow-400 text-yellow-400"
                              : ""
                          }`}
                        />
                      </button>
                    </div>

                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
                        isUnread(email)
                          ? "bg-purple-600/20 text-purple-400"
                          : "bg-[#2a2a35] text-gray-400"
                      }`}
                    >
                      {extractName(
                        activeFolder === "INBOX" ? email.from : email.to
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm truncate ${
                            isUnread(email)
                              ? "font-semibold text-white"
                              : "text-gray-300"
                          }`}
                        >
                          {activeFolder === "INBOX"
                            ? extractName(email.from)
                            : `To: ${extractName(email.to)}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm truncate ${
                            isUnread(email)
                              ? "font-semibold text-white"
                              : "text-gray-400"
                          }`}
                        >
                          {email.subject || "(No subject)"}
                        </span>
                        <span className="text-sm text-gray-500 truncate">
                          - {email.text?.substring(0, 60) || "No preview"}
                        </span>
                      </div>
                    </div>

                    {/* Date & Attachments */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {email.attachments > 0 && (
                        <Paperclip className="h-4 w-4 text-gray-500" />
                      )}
                      <span
                        className={`text-xs ${
                          isUnread(email)
                            ? "font-semibold text-white"
                            : "text-gray-500"
                        }`}
                      >
                        {formatEmailDate(email.date)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Email Detail View */}
          {selectedEmail && (
            <div className="flex-1 bg-[#0e0e12] overflow-hidden flex flex-col border-l border-[#2a2a35]">
              {/* Detail Header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a35]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedEmail(null)}
                    className="p-2 rounded-full hover:bg-[#2a2a35] lg:hidden"
                  >
                    <ArrowLeft className="h-5 w-5 text-gray-400" />
                  </button>
                  <button className="p-2 rounded-full hover:bg-[#2a2a35]">
                    <Archive className="h-5 w-5 text-gray-500" />
                  </button>
                  <button className="p-2 rounded-full hover:bg-[#2a2a35]">
                    <Trash2 className="h-5 w-5 text-gray-500" />
                  </button>
                  <button className="p-2 rounded-full hover:bg-[#2a2a35]">
                    <MailOpen className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Email Content */}
              <div className="flex-1 overflow-auto p-6">
                {/* Subject */}
                <h1 className="text-2xl font-normal text-white mb-6">
                  {selectedEmail.subject || "(No subject)"}
                </h1>

                {/* Sender Info */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium flex-shrink-0">
                    {extractName(
                      activeFolder === "INBOX"
                        ? selectedEmail.from
                        : selectedEmail.to
                    )
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">
                          {extractName(
                            activeFolder === "INBOX"
                              ? selectedEmail.from
                              : selectedEmail.to
                          )}
                        </p>
                        <p className="text-sm text-gray-500">
                          {activeFolder === "INBOX"
                            ? selectedEmail.from
                            : `To: ${selectedEmail.to}`}
                        </p>
                      </div>
                      <div className="text-sm text-gray-500">
                        {selectedEmail.date
                          ? new Date(selectedEmail.date).toLocaleString()
                          : ""}
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      to{" "}
                      {activeFolder === "INBOX"
                        ? "me"
                        : extractName(selectedEmail.to)}
                    </p>
                  </div>
                </div>

                {/* Attachments */}
                {selectedEmail.attachments > 0 && (
                  <div className="flex items-center gap-2 mb-4 p-3 bg-[#1a1a20] border border-[#2a2a35] rounded-lg">
                    <Paperclip className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-300">
                      {selectedEmail.attachments} attachment
                      {selectedEmail.attachments > 1 ? "s" : ""}
                    </span>
                  </div>
                )}

                {/* Email Body */}
                <div className="prose prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-gray-300 text-base leading-relaxed">
                    {selectedEmail.text || "No content"}
                  </pre>
                </div>
              </div>

              {/* Reply Box */}
              <div className="p-4 border-t border-[#2a2a35]">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-[#2a2a35] !bg-[#1a1a20]">
                  <Input
                    placeholder="Click here to reply"
                    className="!border-0 !bg-transparent focus-visible:ring-0 text-gray-300 placeholder:text-gray-500"
                    onClick={() => {
                      setComposeTo(
                        activeFolder === "INBOX"
                          ? selectedEmail.from
                          : selectedEmail.to
                      );
                      setComposeSubject(`Re: ${selectedEmail.subject || ""}`);
                      setShowCompose(true);
                    }}
                  />
                  <Button
                    size="sm"
                    className="!bg-purple-600 hover:!bg-purple-700 text-white"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      <AnimatePresence>
        {showCompose && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className={`fixed ${
              composeMinimized
                ? "bottom-0 right-4 w-72"
                : "bottom-0 right-4 w-[560px]"
            } bg-[#111116] rounded-t-xl shadow-2xl border border-[#2a2a35] z-50 overflow-hidden`}
          >
            {/* Compose Header */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-[#1a1a20] cursor-pointer"
              onClick={() => setComposeMinimized(!composeMinimized)}
            >
              <span className="text-sm font-medium text-white">
                New Message
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setComposeMinimized(!composeMinimized);
                  }}
                  className="p-1 rounded hover:bg-white/10"
                >
                  <ChevronDown
                    className={`h-4 w-4 text-white transition-transform ${
                      composeMinimized ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCompose(false);
                  }}
                  className="p-1 rounded hover:bg-white/10"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>

            {/* Compose Body */}
            {!composeMinimized && (
              <div className="p-0">
                <div className="border-b border-[#2a2a35]">
                  <div className="flex items-center px-4 py-2">
                    <span className="text-sm text-gray-500 w-16">To</span>
                    <input
                      type="email"
                      value={composeTo}
                      onChange={(e) => setComposeTo(e.target.value)}
                      className="flex-1 !bg-transparent border-0 focus:outline-none text-sm text-white placeholder:text-gray-500"
                      placeholder="Recipients"
                    />
                  </div>
                </div>
                <div className="border-b border-[#2a2a35]">
                  <div className="flex items-center px-4 py-2">
                    <span className="text-sm text-gray-500 w-16">From</span>
                    <span className="text-sm text-gray-300">
                      {mailboxConfig?.email}
                    </span>
                  </div>
                </div>
                <div className="border-b border-[#2a2a35]">
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    className="w-full px-4 py-2 !bg-transparent border-0 focus:outline-none text-sm text-white placeholder:text-gray-500"
                    placeholder="Subject"
                  />
                </div>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  className="w-full h-64 px-4 py-3 !bg-transparent border-0 focus:outline-none text-sm text-white resize-none placeholder:text-gray-500"
                  placeholder="Compose email"
                />
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#2a2a35]">
                  <Button
                    onClick={sendEmail}
                    disabled={
                      sendingEmail ||
                      !composeTo ||
                      !composeSubject ||
                      !composeBody
                    }
                    className="!bg-purple-600 hover:!bg-purple-700 text-white rounded-full px-6"
                  >
                    {sendingEmail ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Send
                  </Button>
                  <div className="flex items-center gap-2">
                    <button className="p-2 rounded-full hover:bg-[#2a2a35]">
                      <Paperclip className="h-5 w-5 text-gray-500" />
                    </button>
                    <button
                      onClick={() => {
                        setShowCompose(false);
                        setComposeTo("");
                        setComposeSubject("");
                        setComposeBody("");
                      }}
                      className="p-2 rounded-full hover:bg-[#2a2a35]"
                    >
                      <Trash2 className="h-5 w-5 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Mailbox Modal */}
      <AnimatePresence>
        {showAddMailbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowAddMailbox(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111116] rounded-xl shadow-2xl w-full max-w-md p-6 border border-[#2a2a35]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">
                  Add New Mailbox
                </h2>
                <button
                  onClick={() => setShowAddMailbox(false)}
                  className="p-2 rounded-full hover:bg-[#2a2a35]"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Domain Selection */}
                {domainConfig?.type === "custom" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Select Domain
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setNewMailboxDomain("custom")}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          newMailboxDomain === "custom"
                            ? "border-purple-500 bg-purple-500/10"
                            : "border-[#2a2a35] bg-[#1a1a20] hover:border-gray-600"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-purple-400" />
                          <span className="text-sm font-medium text-white">
                            Custom
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {domainConfig?.customDomain}
                        </p>
                      </button>
                      <button
                        onClick={() => setNewMailboxDomain("default")}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          newMailboxDomain === "default"
                            ? "border-purple-500 bg-purple-500/10"
                            : "border-[#2a2a35] bg-[#1a1a20] hover:border-gray-600"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-green-400" />
                          <span className="text-sm font-medium text-white">
                            Default
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          networkmail.com
                        </p>
                      </button>
                    </div>
                    {/* Add new domain link for founders */}
                    {userRole === "founder" && (
                      <button
                        onClick={() => {
                          setShowAddMailbox(false);
                          setShowAddDomain(true);
                        }}
                        className="w-full mt-3 text-sm text-purple-400 hover:text-purple-300 flex items-center justify-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Add a different custom domain
                      </button>
                    )}
                  </div>
                )}

                {/* Add custom domain option when only default domain configured */}
                {domainConfig?.type !== "custom" && userRole === "founder" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Domain
                    </label>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[#1a1a20] border border-[#2a2a35]">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-green-400" />
                        <span className="text-sm text-gray-300">networkmail.com (default)</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowAddMailbox(false);
                        setShowAddDomain(true);
                      }}
                      className="w-full mt-3 text-sm text-purple-400 hover:text-purple-300 flex items-center justify-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add custom domain instead
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Username
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={newMailboxLocalPart}
                      onChange={(e) =>
                        setNewMailboxLocalPart(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9._-]/g, "")
                        )
                      }
                      placeholder="yourname"
                      className="!bg-[#1a1a20] !border-[#2a2a35] text-white placeholder:text-gray-500"
                    />
                    <span className="text-gray-500 whitespace-nowrap">
                      @
                      {newMailboxDomain === "default"
                        ? "networkmail.com"
                        : domainConfig?.customDomain || "networkmail.com"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => {
                      setShowAddMailbox(false);
                      setNewMailboxLocalPart("");
                    }}
                    variant="outline"
                    className="flex-1 !bg-[#1a1a20] !border-[#2a2a35] text-gray-300 hover:!bg-[#2a2a35]"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!newMailboxLocalPart) {
                        toast.error("Please enter a username");
                        return;
                      }
                      const domain =
                        newMailboxDomain === "default"
                          ? "networkmail.com"
                          : domainConfig?.customDomain || "networkmail.com";
                      const email = `${newMailboxLocalPart}@${domain}`;
                      const password = "Test@123";
                      try {
                        // Create mailbox in Mailcow
                        const response = await createMailboxDirect({
                          local_part: newMailboxLocalPart,
                          name: newMailboxLocalPart,
                          domain: domain,
                          password: password,
                          password2: password,
                          quota: "250",
                          active: "1",
                          force_pw_update: "0",
                          tls_enforce_in: "1",
                          tls_enforce_out: "1",
                        });
                        if (isApiSuccess(response)) {
                          // Also save to user's account so they can switch to it
                          const orgId = localStorage.getItem("garage_org_id");
                          await api(`/initial-setup/add-user-mailbox`, {
                            method: "POST",
                            body: JSON.stringify({
                              orgId,
                              email,
                              localPart: newMailboxLocalPart,
                              domain,
                              password,
                            }),
                          });
                          // Auto-switch to the new mailbox
                          await api(`/initial-setup/switch-mailbox`, {
                            method: "POST",
                            body: JSON.stringify({
                              orgId,
                              email,
                            }),
                          });
                          toast.success(`Mailbox ${email} created and activated!`);
                          setShowAddMailbox(false);
                          setNewMailboxLocalPart("");
                          loadConfig(); // Reload to get updated mailbox list
                        } else {
                          toast.error(getApiErrorMessage(response));
                        }
                      } catch (error: any) {
                        toast.error(
                          error.message || "Failed to create mailbox"
                        );
                      }
                    }}
                    disabled={!newMailboxLocalPart}
                    className="flex-1 !bg-purple-600 hover:!bg-purple-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Mailbox
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Custom Domain Modal (Founders Only) */}
      <AnimatePresence>
        {showAddDomain && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8"
            onClick={() => { setShowAddDomain(false); setShowDnsInModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111116] rounded-xl shadow-2xl w-full max-w-2xl p-6 border border-[#2a2a35] my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">
                  {showDnsInModal ? "Configure DNS Records" : "Add Custom Domain"}
                </h2>
                <button
                  onClick={() => { setShowAddDomain(false); setShowDnsInModal(false); }}
                  className="p-2 rounded-full hover:bg-[#2a2a35]"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {!showDnsInModal ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Domain Name
                  </label>
                  <Input
                    value={newCustomDomain}
                    onChange={(e) =>
                      setNewCustomDomain(
                        e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, "")
                      )
                    }
                    placeholder="example.com"
                    className="!bg-[#1a1a20] !border-[#2a2a35] text-white placeholder:text-gray-500"
                  />
                </div>

                <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-lg p-3">
                  <p className="text-sm text-yellow-400">
                    <strong>Important:</strong> After adding the domain, you
                    will need to configure DNS records (MX, SPF, DKIM) to point
                    to our mail server.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => {
                      setShowAddDomain(false);
                      setNewCustomDomain("");
                    }}
                    variant="outline"
                    className="flex-1 !bg-[#1a1a20] !border-[#2a2a35] text-gray-300 hover:!bg-[#2a2a35]"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!newCustomDomain) {
                        toast.error("Please enter a domain name");
                        return;
                      }
                      // Validate domain format
                      if (
                        !/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(
                          newCustomDomain
                        )
                      ) {
                        toast.error("Please enter a valid domain name");
                        return;
                      }
                      try {
                        const orgId = localStorage.getItem("garage_org_id");
                        const res = await api<{ success: boolean; domainConfig: DomainConfig }>(
                          `/initial-setup/domain-config`,
                          {
                            method: "POST",
                            body: JSON.stringify({
                              orgId,
                              type: "custom",
                              customDomain: newCustomDomain,
                            }),
                          }
                        );
                        // Update state with the response containing DNS records
                        setDomainConfig(res.domainConfig);
                        setDomainType("custom");
                        setCustomDomain(newCustomDomain);
                        toast.success(
                          `Domain ${newCustomDomain} added! Configure DNS records below.`
                        );
                        setNewCustomDomain("");
                        setShowDnsInModal(true);
                        loadConfig();
                      } catch (error: any) {
                        toast.error(error.message || "Failed to add domain");
                      }
                    }}
                    disabled={!newCustomDomain}
                    className="flex-1 !bg-purple-600 hover:!bg-purple-700 text-white"
                  >
                    <Server className="h-4 w-4 mr-2" />
                    Add Domain
                  </Button>
                </div>
              </div>
              ) : (
                /* DNS Records Display */
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                    <p className="text-sm text-green-400">
                      Domain <strong>{domainConfig?.customDomain}</strong> added! Now configure these DNS records.
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-400">Add these records at your domain registrar:</p>
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

                  <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                    {domainConfig?.dnsRecords?.map((record, index) => (
                      <div
                        key={index}
                        className="p-3 rounded-lg bg-[#1a1a20] border border-[#2a2a35]"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {record.type}
                            </Badge>
                            {record.verified ? (
                              <CheckCircle2 className="h-4 w-4 text-green-400" />
                            ) : (
                              <X className="h-4 w-4 text-red-400" />
                            )}
                          </div>
                          <Button
                            onClick={() => copyToClipboard(record.value)}
                            size="sm"
                            variant="ghost"
                            className="h-7"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-gray-400">
                          <span className="text-gray-500">Name:</span> {record.name}
                        </p>
                        <p className="text-xs text-gray-400 break-all">
                          <span className="text-gray-500">Value:</span>{" "}
                          {record.priority ? `${record.priority} ` : ""}
                          {record.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-2">
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
                      Verify DNS
                    </Button>
                    {domainConfig?.verified && !domainConfig?.domainAddedToMailcow && (
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

                  <div className="pt-2 border-t border-[#2a2a35]">
                    <Button
                      onClick={() => { setShowAddDomain(false); setShowDnsInModal(false); }}
                      className="w-full !bg-purple-600 hover:!bg-purple-700 text-white"
                    >
                      Done
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

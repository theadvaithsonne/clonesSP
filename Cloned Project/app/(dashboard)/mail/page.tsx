"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Loader2,
  Mail,
  RefreshCw,
  Trash2,
  Plus,
  User,
  HardDrive,
  Settings,
  Globe,
  Key,
  ExternalLink,
  Forward,
  Copy,
  Check,
  AlertCircle,
  Inbox,
  Server,
  Shield,
  Send,
  PenSquare,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  type MailDomainConfig,
  type Mailbox,
  type Alias,
  getDomainConfigs,
  getActiveDomainConfig,
  setActiveDomain,
  saveDomainConfig,
  deleteDomainConfig,
  getMailboxes,
  createMailbox,
  deleteMailbox,
  getAliases,
  createAlias,
  deleteAlias,
  formatBytes,
  isApiSuccess,
  getApiErrorMessage,
} from "@/lib/mail-api";

// Email types for My Mail tab
type Email = {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  text: string;
  html: boolean;
  attachments: number;
  flags: string[];
  seqno?: number;
};

type MailboxConfigType = {
  created: boolean;
  email?: string;
  localPart?: string;
  domain?: string;
  lastFetchedAt?: string;
};

// Generate a unique ID for new configurations
function generateId(): string {
  return `domain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default function MailPage() {
  // Domain configs state
  const [domainConfigs, setDomainConfigs] = useState<MailDomainConfig[]>([]);
  const [activeConfig, setActiveConfig] = useState<MailDomainConfig | null>(null);
  const [showDomainSettings, setShowDomainSettings] = useState(false);
  const [editingDomain, setEditingDomain] = useState<MailDomainConfig | null>(null);

  // Mailbox state
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loadingMailboxes, setLoadingMailboxes] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Alias state
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loadingAliases, setLoadingAliases] = useState(true);
  const [creatingAlias, setCreatingAlias] = useState(false);
  const [deletingAlias, setDeletingAlias] = useState<number | null>(null);

  // Messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Form state - Create Mailbox
  const [localPart, setLocalPart] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [quota, setQuota] = useState("1024");

  // Form state - Create Alias
  const [aliasAddress, setAliasAddress] = useState("");
  const [aliasGoto, setAliasGoto] = useState("");

  // Form state - Domain Config
  const [configName, setConfigName] = useState("");
  const [configDomain, setConfigDomain] = useState("");
  const [configApiBase, setConfigApiBase] = useState("");
  const [configReadKey, setConfigReadKey] = useState("");
  const [configWriteKey, setConfigWriteKey] = useState("");

  // Main tab (top level)
  const [mainTab, setMainTab] = useState("my-mail");

  // Active tab (within Mail Manager)
  const [activeTab, setActiveTab] = useState("mailboxes");

  // My Mail state
  const [myMailboxConfig, setMyMailboxConfig] = useState<MailboxConfigType | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [fetchingEmails, setFetchingEmails] = useState(false);
  const [loadingMyMail, setLoadingMyMail] = useState(true);

  // Compose email state
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const showMessage = useCallback((msg: string, type: "error" | "success") => {
    if (type === "error") {
      setError(msg);
      setSuccess(null);
    } else {
      setSuccess(msg);
      setError(null);
    }
    setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 5000);
  }, []);

  // Load domain configs
  useEffect(() => {
    const configs = getDomainConfigs();
    setDomainConfigs(configs);
    const active = getActiveDomainConfig();
    setActiveConfig(active);
  }, []);

  // Load mailboxes when active config changes
  const loadMailboxes = useCallback(async () => {
    if (!activeConfig) return;

    setLoadingMailboxes(true);
    try {
      const data = await getMailboxes();
      setMailboxes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading mailboxes:", err);
      showMessage(
        `Failed to load mailboxes: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error"
      );
    } finally {
      setLoadingMailboxes(false);
    }
  }, [activeConfig, showMessage]);

  // Load aliases
  const loadAliases = useCallback(async () => {
    if (!activeConfig) return;

    setLoadingAliases(true);
    try {
      const data = await getAliases();
      // Filter aliases for current domain
      const domainAliases = Array.isArray(data)
        ? data.filter((a) => a.domain === activeConfig.domain)
        : [];
      setAliases(domainAliases);
    } catch (err) {
      console.error("Error loading aliases:", err);
      showMessage(
        `Failed to load aliases: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error"
      );
    } finally {
      setLoadingAliases(false);
    }
  }, [activeConfig, showMessage]);

  useEffect(() => {
    if (activeConfig) {
      loadMailboxes();
      loadAliases();
    }
  }, [activeConfig, loadMailboxes, loadAliases]);

  // Load my mailbox config for "My Mail" tab
  const loadMyMailConfig = useCallback(async () => {
    try {
      setLoadingMyMail(true);
      const orgId = localStorage.getItem("garage_org_id");
      if (!orgId) {
        setLoadingMyMail(false);
        return;
      }

      const res = await api<{ mailboxConfig: MailboxConfigType }>(`/initial-setup/domain-config?orgId=${orgId}`);
      setMyMailboxConfig(res.mailboxConfig);
    } catch (err) {
      console.error("Error loading my mail config:", err);
    } finally {
      setLoadingMyMail(false);
    }
  }, []);

  // Fetch emails for "My Mail" tab
  const fetchEmails = useCallback(async () => {
    try {
      setFetchingEmails(true);
      const orgId = localStorage.getItem("garage_org_id");
      if (!orgId) return;

      const res = await api<{ success: boolean; emails: Email[] }>(
        `/initial-setup/fetch-inbox?orgId=${orgId}&limit=50`
      );

      setEmails(res.emails || []);
      toast.success(`Fetched ${res.emails?.length || 0} emails`);
    } catch (err: any) {
      console.error("Error fetching emails:", err);
      toast.error(err.message || "Failed to fetch emails");
    } finally {
      setFetchingEmails(false);
    }
  }, []);

  // Send email from "My Mail" tab
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

      toast.success("Email sent successfully!");
      setShowCompose(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
    } catch (err: any) {
      console.error("Error sending email:", err);
      toast.error(err.message || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  // Load my mail config on mount
  useEffect(() => {
    loadMyMailConfig();
  }, [loadMyMailConfig]);

  // Switch active domain
  const handleDomainSwitch = (configId: string) => {
    setActiveDomain(configId);
    const newConfig = domainConfigs.find((c) => c.id === configId);
    if (newConfig) {
      setActiveConfig(newConfig);
    }
  };

  // Save domain config
  const handleSaveDomainConfig = () => {
    if (!configName || !configDomain || !configApiBase || !configReadKey || !configWriteKey) {
      showMessage("All fields are required", "error");
      return;
    }

    const config: MailDomainConfig = {
      id: editingDomain?.id || generateId(),
      name: configName,
      domain: configDomain,
      apiBase: configApiBase.replace(/\/$/, ""), // Remove trailing slash
      readKey: configReadKey,
      writeKey: configWriteKey,
      isDefault: editingDomain?.isDefault || false,
    };

    saveDomainConfig(config);
    setDomainConfigs(getDomainConfigs());

    // Reset form
    setConfigName("");
    setConfigDomain("");
    setConfigApiBase("");
    setConfigReadKey("");
    setConfigWriteKey("");
    setEditingDomain(null);
    setShowDomainSettings(false);

    showMessage(`Domain "${config.name}" saved successfully!`, "success");
  };

  // Delete domain config
  const handleDeleteDomainConfig = (id: string) => {
    if (id === "default") {
      showMessage("Cannot delete the default domain", "error");
      return;
    }

    if (!confirm("Are you sure you want to delete this domain configuration?")) {
      return;
    }

    deleteDomainConfig(id);
    setDomainConfigs(getDomainConfigs());
    setActiveConfig(getActiveDomainConfig());
    showMessage("Domain configuration deleted", "success");
  };

  // Edit domain config
  const handleEditDomainConfig = (config: MailDomainConfig) => {
    setEditingDomain(config);
    setConfigName(config.name);
    setConfigDomain(config.domain);
    setConfigApiBase(config.apiBase);
    setConfigReadKey(config.readKey);
    setConfigWriteKey(config.writeKey);
    setShowDomainSettings(true);
  };

  // Create mailbox
  const handleCreateMailbox = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== password2) {
      showMessage("Passwords do not match!", "error");
      return;
    }

    if (password.length < 6) {
      showMessage("Password must be at least 6 characters!", "error");
      return;
    }

    setCreating(true);
    try {
      const result = await createMailbox({
        local_part: localPart,
        name: fullName,
        password,
        password2,
        quota,
      });

      if (isApiSuccess(result)) {
        showMessage(
          `Mailbox ${localPart}@${activeConfig?.domain} created successfully!`,
          "success"
        );
        setLocalPart("");
        setFullName("");
        setPassword("");
        setPassword2("");
        setQuota("1024");
        loadMailboxes();
      } else {
        showMessage(`Failed to create mailbox: ${getApiErrorMessage(result)}`, "error");
      }
    } catch (err) {
      console.error("Error creating mailbox:", err);
      showMessage(
        `Failed to create mailbox: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error"
      );
    } finally {
      setCreating(false);
    }
  };

  // Delete mailbox
  const handleDeleteMailbox = async (username: string) => {
    if (
      !confirm(
        `Are you sure you want to delete ${username}? This action cannot be undone.`
      )
    ) {
      return;
    }

    setDeleting(username);
    try {
      const result = await deleteMailbox([username]);

      if (isApiSuccess(result)) {
        showMessage(`Mailbox ${username} deleted successfully!`, "success");
        loadMailboxes();
      } else {
        showMessage(`Failed to delete mailbox: ${getApiErrorMessage(result)}`, "error");
      }
    } catch (err) {
      console.error("Error deleting mailbox:", err);
      showMessage(
        `Failed to delete mailbox: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error"
      );
    } finally {
      setDeleting(null);
    }
  };

  // Open webmail
  const openWebmail = (mailbox: Mailbox) => {
    if (!activeConfig) return;

    // Open SOGo webmail in new tab
    // The user will need to login with their mailbox credentials
    const webmailUrl = `${activeConfig.apiBase}/SOGo`;
    window.open(webmailUrl, "_blank");
  };

  // Copy email to clipboard
  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  // Create alias
  const handleCreateAlias = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!aliasAddress || !aliasGoto) {
      showMessage("Alias address and destination are required", "error");
      return;
    }

    // If alias doesn't contain @, append domain
    const fullAddress = aliasAddress.includes("@")
      ? aliasAddress
      : `${aliasAddress}@${activeConfig?.domain}`;

    setCreatingAlias(true);
    try {
      const result = await createAlias({
        address: fullAddress,
        goto: aliasGoto,
      });

      if (isApiSuccess(result)) {
        showMessage(`Alias ${fullAddress} created successfully!`, "success");
        setAliasAddress("");
        setAliasGoto("");
        loadAliases();
      } else {
        showMessage(`Failed to create alias: ${getApiErrorMessage(result)}`, "error");
      }
    } catch (err) {
      console.error("Error creating alias:", err);
      showMessage(
        `Failed to create alias: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error"
      );
    } finally {
      setCreatingAlias(false);
    }
  };

  // Delete alias
  const handleDeleteAlias = async (id: number) => {
    if (!confirm("Are you sure you want to delete this alias?")) {
      return;
    }

    setDeletingAlias(id);
    try {
      const result = await deleteAlias([id]);

      if (isApiSuccess(result)) {
        showMessage("Alias deleted successfully!", "success");
        loadAliases();
      } else {
        showMessage(`Failed to delete alias: ${getApiErrorMessage(result)}`, "error");
      }
    } catch (err) {
      console.error("Error deleting alias:", err);
      showMessage(
        `Failed to delete alias: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error"
      );
    } finally {
      setDeletingAlias(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b0d] p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Mail className="w-6 h-6 sm:w-8 sm:h-8 text-brand" />
            <h1 className="text-xl sm:text-2xl font-bold text-white">Mail</h1>
          </div>
        </div>

        {/* Main Tabs - My Mail / Mail Manager */}
        <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-4 sm:space-y-6">
          <TabsList className="bg-[#111116] border border-[#333] p-1 w-full sm:w-auto">
            <TabsTrigger
              value="my-mail"
              className="data-[state=active]:bg-brand data-[state=active]:text-brand-foreground px-3 sm:px-6 text-xs sm:text-sm flex-1 sm:flex-none"
            >
              <Inbox className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              My Mail
            </TabsTrigger>
            <TabsTrigger
              value="mail-manager"
              className="data-[state=active]:bg-brand data-[state=active]:text-brand-foreground px-3 sm:px-6 text-xs sm:text-sm flex-1 sm:flex-none"
            >
              <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Mail Manager
            </TabsTrigger>
          </TabsList>

          {/* MY MAIL TAB */}
          <TabsContent value="my-mail" className="space-y-4 sm:space-y-6">
            {loadingMyMail ? (
              <div className="flex items-center justify-center py-12 sm:py-20">
                <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-brand" />
              </div>
            ) : !myMailboxConfig?.created ? (
              <Card className="bg-[#111116] border-[#222]">
                <CardContent className="py-8 sm:py-12 px-4 sm:px-6">
                  <div className="text-center">
                    <Mail className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-600 mb-3 sm:mb-4" />
                    <h3 className="text-lg sm:text-xl font-medium text-white mb-2">No Mailbox Setup</h3>
                    <p className="text-sm sm:text-base text-gray-400 mb-4">
                      You need to set up your email first. Go to Email Setup in the sidebar to create your mailbox.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Mailbox Info & Actions */}
                <Card className="bg-[#111116] border-[#222]">
                  <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-brand/20 flex items-center justify-center">
                        <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
                      </div>
                      <div>
                        <CardTitle className="text-white text-sm sm:text-lg">{myMailboxConfig.email}</CardTitle>
                        <p className="text-xs sm:text-sm text-gray-400">Your organization email</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button
                        onClick={() => setShowCompose(true)}
                        className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] text-brand-foreground text-xs sm:text-sm h-8 sm:h-10 flex-1 sm:flex-none"
                      >
                        <PenSquare className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Compose
                      </Button>
                      <Button
                        onClick={fetchEmails}
                        disabled={fetchingEmails}
                        variant="outline"
                        className="border-[#333] text-gray-300 hover:bg-[#1a1a1f] text-xs sm:text-sm h-8 sm:h-10 flex-1 sm:flex-none"
                      >
                        {fetchingEmails ? (
                          <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
                        )}
                        <span className="ml-1 sm:ml-2">Refresh</span>
                      </Button>
                    </div>
                  </CardHeader>
                </Card>

                {/* Inbox */}
                <Card className="bg-[#111116] border-[#222]">
                  <CardHeader className="px-4 sm:px-6">
                    <CardTitle className="text-white flex items-center gap-2 text-sm sm:text-base">
                      <Inbox className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
                      Inbox
                      <span className="text-xs sm:text-sm text-gray-500 font-normal">
                        ({emails.length} emails)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6">
                    {emails.length === 0 ? (
                      <div className="text-center py-8 sm:py-12">
                        <Inbox className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-600 mb-3 sm:mb-4" />
                        <p className="text-sm sm:text-base text-gray-400">No emails yet</p>
                        <p className="text-gray-500 text-xs sm:text-sm mt-1">
                          Click refresh to check for new emails
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[400px] sm:max-h-[500px] overflow-auto">
                        {emails.map((email) => (
                          <button
                            key={email.id || email.seqno}
                            onClick={() => setSelectedEmail(email)}
                            className={`w-full text-left p-3 sm:p-4 rounded-lg border transition-all ${
                              selectedEmail?.id === email.id
                                ? "bg-brand/10 border-brand/50"
                                : "bg-[#0b0b0d] border-[#222] hover:border-[#444]"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs sm:text-sm font-medium text-white truncate max-w-[180px] sm:max-w-[300px]">
                                {email.from}
                              </span>
                              <span className="text-[10px] sm:text-xs text-gray-500">
                                {email.date ? new Date(email.date).toLocaleDateString() : ""}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-300 truncate">
                              {email.subject || "(No subject)"}
                            </p>
                            <p className="text-[10px] sm:text-xs text-gray-500 truncate mt-1">
                              {email.text?.substring(0, 100) || ""}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* MAIL MANAGER TAB */}
          <TabsContent value="mail-manager" className="space-y-4 sm:space-y-6">
            {/* Mail Manager Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-400">
                <Globe className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>Managing: </span>
                <span className="text-brand font-medium">{activeConfig?.domain}</span>
                {activeConfig && (
                  <>
                    <span className="mx-1 sm:mx-2 hidden sm:inline">|</span>
                    <a
                      href={activeConfig.apiBase}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white flex items-center gap-1"
                    >
                      Open Mail Server <ExternalLink className="w-3 h-3" />
                    </a>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                {/* Domain Selector */}
                <Select
                  value={activeConfig?.id || "default"}
                  onValueChange={handleDomainSwitch}
                >
                  <SelectTrigger className="w-full sm:w-[200px] bg-[#111116] border-[#333] text-white text-xs sm:text-sm h-8 sm:h-10">
                    <Globe className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-gray-400" />
                    <SelectValue placeholder="Select domain" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111116] border-[#333]">
                    {domainConfigs.map((config) => (
                      <SelectItem
                        key={config.id}
                        value={config.id}
                        className="text-white hover:bg-[#1a1a1f] text-xs sm:text-sm"
                      >
                        {config.name} ({config.domain})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Domain Settings Button */}
                <Dialog open={showDomainSettings} onOpenChange={setShowDomainSettings}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-[#333] text-gray-300 hover:bg-[#1a1a1f]"
                      onClick={() => {
                        setEditingDomain(null);
                        setConfigName("");
                        setConfigDomain("");
                        setConfigApiBase("");
                        setConfigReadKey("");
                        setConfigWriteKey("");
                      }}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
              <DialogContent className="bg-[#111116] border-[#333] text-white max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-brand" />
                    {editingDomain ? "Edit Domain" : "Add Mail Domain"}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300">Configuration Name</Label>
                      <Input
                        value={configName}
                        onChange={(e) => setConfigName(e.target.value)}
                        placeholder="My Company Mail"
                        className="bg-[#1a1a1f] border-[#333] text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Domain</Label>
                      <Input
                        value={configDomain}
                        onChange={(e) => setConfigDomain(e.target.value)}
                        placeholder="example.com"
                        className="bg-[#1a1a1f] border-[#333] text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">Mail Server API URL</Label>
                    <Input
                      value={configApiBase}
                      onChange={(e) => setConfigApiBase(e.target.value)}
                      placeholder="https://mail.example.com"
                      className="bg-[#1a1a1f] border-[#333] text-white"
                    />
                    <p className="text-xs text-gray-500">
                      The base URL of your mailcow instance
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300 flex items-center gap-2">
                        <Key className="w-3 h-3" />
                        Read-Only API Key
                      </Label>
                      <Input
                        value={configReadKey}
                        onChange={(e) => setConfigReadKey(e.target.value)}
                        placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX"
                        className="bg-[#1a1a1f] border-[#333] text-white font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300 flex items-center gap-2">
                        <Shield className="w-3 h-3" />
                        Read-Write API Key
                      </Label>
                      <Input
                        value={configWriteKey}
                        onChange={(e) => setConfigWriteKey(e.target.value)}
                        placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX"
                        className="bg-[#1a1a1f] border-[#333] text-white font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="bg-[#1a1a1f] p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">
                      How to get API Keys:
                    </h4>
                    <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
                      <li>Login to your Mailcow admin panel</li>
                      <li>Go to Configuration &rarr; Access &rarr; Edit administrator details</li>
                      <li>Expand the API section</li>
                      <li>Enable API access and add your IP to the whitelist</li>
                      <li>Copy the Read-Only and Read-Write API keys</li>
                    </ol>
                  </div>

                  {/* Existing domains list */}
                  {domainConfigs.length > 1 && (
                    <div className="border-t border-[#333] pt-4">
                      <h4 className="text-sm font-medium text-gray-300 mb-3">
                        Configured Domains
                      </h4>
                      <div className="space-y-2">
                        {domainConfigs.map((config) => (
                          <div
                            key={config.id}
                            className="flex items-center justify-between p-3 bg-[#1a1a1f] rounded-lg"
                          >
                            <div>
                              <p className="text-white font-medium">{config.name}</p>
                              <p className="text-xs text-gray-500">{config.domain}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {!config.isDefault && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditDomainConfig(config)}
                                    className="text-gray-400 hover:text-white"
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteDomainConfig(config.id)}
                                    className="text-red-400 hover:text-red-300"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                              {config.isDefault && (
                                <span className="text-xs text-brand">Default</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" className="border-[#333] text-gray-300">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button
                    onClick={handleSaveDomainConfig}
                    className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] text-brand-foreground"
                  >
                    {editingDomain ? "Update Domain" : "Add Domain"}
                  </Button>
                </DialogFooter>
              </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Alerts */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2">
                <Check className="w-5 h-5" />
                {success}
              </div>
            )}

            {/* Inner Tabs for Mail Manager */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
              <TabsList className="bg-[#0b0b0d] border border-[#333] w-full sm:w-auto">
                <TabsTrigger
                  value="mailboxes"
                  className="data-[state=active]:bg-[#333] data-[state=active]:text-white text-xs sm:text-sm flex-1 sm:flex-none"
                >
                  <User className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Mailboxes
                </TabsTrigger>
                <TabsTrigger
                  value="aliases"
                  className="data-[state=active]:bg-[#333] data-[state=active]:text-white text-xs sm:text-sm flex-1 sm:flex-none"
                >
                  <Forward className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Aliases
                </TabsTrigger>
              </TabsList>

              {/* Mailboxes Tab */}
              <TabsContent value="mailboxes" className="space-y-4 sm:space-y-6">
            {/* Create Mailbox Card */}
            <Card className="bg-[#111116] border-[#222]">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="text-white flex items-center gap-2 text-sm sm:text-base">
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
                  Create New Mailbox
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <form onSubmit={handleCreateMailbox} className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="localPart" className="text-gray-300">
                        Username
                      </Label>
                      <div className="flex">
                        <Input
                          id="localPart"
                          value={localPart}
                          onChange={(e) => setLocalPart(e.target.value)}
                          placeholder="info"
                          required
                          className="rounded-r-none bg-[#1a1a1f] border-[#333] text-white"
                        />
                        <span className="inline-flex items-center px-3 bg-[#222] border border-l-0 border-[#333] text-gray-400 rounded-r-md text-sm">
                          @{activeConfig?.domain}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-gray-300">
                        Full Name
                      </Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe"
                        required
                        className="bg-[#1a1a1f] border-[#333] text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-gray-300">
                        Password
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="bg-[#1a1a1f] border-[#333] text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password2" className="text-gray-300">
                        Confirm Password
                      </Label>
                      <Input
                        id="password2"
                        type="password"
                        value={password2}
                        onChange={(e) => setPassword2(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="bg-[#1a1a1f] border-[#333] text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quota" className="text-gray-300">
                        Quota (MB)
                      </Label>
                      <Input
                        id="quota"
                        type="number"
                        value={quota}
                        onChange={(e) => setQuota(e.target.value)}
                        min="1"
                        className="bg-[#1a1a1f] border-[#333] text-white"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={creating}
                    className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] text-brand-foreground"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Mailbox
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Mailboxes List Card */}
            <Card className="bg-[#111116] border-[#222]">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 sm:px-6">
                <CardTitle className="text-white flex items-center gap-2 text-sm sm:text-base">
                  <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
                  Mailboxes
                  <span className="text-xs sm:text-sm text-gray-500 font-normal">
                    ({mailboxes.length})
                  </span>
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMailboxes}
                  disabled={loadingMailboxes}
                  className="border-[#333] text-gray-300 hover:bg-[#1a1a1f] text-xs sm:text-sm h-8 sm:h-9"
                >
                  <RefreshCw
                    className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 ${loadingMailboxes ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                {loadingMailboxes ? (
                  <div className="flex items-center justify-center py-8 sm:py-12">
                    <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-brand" />
                  </div>
                ) : mailboxes.length === 0 ? (
                  <div className="text-center py-8 sm:py-12 text-gray-400">
                    <Mail className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                    <p className="text-sm sm:text-base">No mailboxes found. Create one above!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#222]">
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">
                            Email
                          </th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">
                            Name
                          </th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">
                            Status
                          </th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">
                            Quota
                          </th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">
                            Messages
                          </th>
                          <th className="text-right py-3 px-4 text-gray-400 font-medium">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {mailboxes.map((mb) => (
                          <tr
                            key={mb.username}
                            className="border-b border-[#1a1a1f] hover:bg-[#1a1a1f]/50 cursor-pointer group"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-500" />
                                <span
                                  className="text-white font-medium hover:text-brand cursor-pointer"
                                  onClick={() => openWebmail(mb)}
                                  title="Click to open webmail"
                                >
                                  {mb.username}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(mb.username);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Copy email"
                                >
                                  {copied === mb.username ? (
                                    <Check className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <Copy className="w-4 h-4 text-gray-500 hover:text-white" />
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-gray-300">{mb.name || "-"}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  mb.active === "1" || mb.active === 1
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-red-500/20 text-red-400"
                                }`}
                              >
                                {mb.active === "1" || mb.active === 1 ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                  <HardDrive className="w-3 h-3" />
                                  {formatBytes(mb.quota_used || 0)} /{" "}
                                  {formatBytes(mb.quota || 0)}
                                </div>
                                <div className="w-full bg-[#222] rounded-full h-1.5">
                                  <div
                                    className="bg-brand h-1.5 rounded-full"
                                    style={{
                                      width: `${Math.min(mb.percent_in_use || 0, 100)}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-gray-300">{mb.messages || 0}</td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openWebmail(mb)}
                                  className="text-gray-400 hover:text-white"
                                  title="Open Webmail"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteMailbox(mb.username)}
                                  disabled={deleting === mb.username}
                                >
                                  {deleting === mb.username ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aliases Tab */}
          <TabsContent value="aliases" className="space-y-4 sm:space-y-6">
            {/* Create Alias Card */}
            <Card className="bg-[#111116] border-[#222]">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="text-white flex items-center gap-2 text-sm sm:text-base">
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
                  Create New Alias
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <form onSubmit={handleCreateAlias} className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="aliasAddress" className="text-gray-300">
                        Alias Address
                      </Label>
                      <div className="flex">
                        <Input
                          id="aliasAddress"
                          value={aliasAddress}
                          onChange={(e) => setAliasAddress(e.target.value)}
                          placeholder="support"
                          required
                          className="rounded-r-none bg-[#1a1a1f] border-[#333] text-white"
                        />
                        <span className="inline-flex items-center px-3 bg-[#222] border border-l-0 border-[#333] text-gray-400 rounded-r-md text-sm">
                          @{activeConfig?.domain}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Use @ for catch-all (e.g., @{activeConfig?.domain})
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="aliasGoto" className="text-gray-300">
                        Forward To
                      </Label>
                      <Input
                        id="aliasGoto"
                        value={aliasGoto}
                        onChange={(e) => setAliasGoto(e.target.value)}
                        placeholder="user@example.com"
                        required
                        className="bg-[#1a1a1f] border-[#333] text-white"
                      />
                      <p className="text-xs text-gray-500">
                        Comma-separated for multiple destinations
                      </p>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={creatingAlias}
                    className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] text-brand-foreground"
                  >
                    {creatingAlias ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Alias
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Aliases List Card */}
            <Card className="bg-[#111116] border-[#222]">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 sm:px-6">
                <CardTitle className="text-white flex items-center gap-2 text-sm sm:text-base">
                  <Forward className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
                  Aliases
                  <span className="text-xs sm:text-sm text-gray-500 font-normal">
                    ({aliases.length})
                  </span>
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadAliases}
                  disabled={loadingAliases}
                  className="border-[#333] text-gray-300 hover:bg-[#1a1a1f] text-xs sm:text-sm h-8 sm:h-9"
                >
                  <RefreshCw
                    className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 ${loadingAliases ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                {loadingAliases ? (
                  <div className="flex items-center justify-center py-8 sm:py-12">
                    <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-brand" />
                  </div>
                ) : aliases.length === 0 ? (
                  <div className="text-center py-8 sm:py-12 text-gray-400">
                    <Forward className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                    <p className="text-sm sm:text-base">No aliases found. Create one above!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#222]">
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">
                            Alias
                          </th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">
                            Forward To
                          </th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">
                            Status
                          </th>
                          <th className="text-right py-3 px-4 text-gray-400 font-medium">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {aliases.map((alias) => (
                          <tr
                            key={alias.id}
                            className="border-b border-[#1a1a1f] hover:bg-[#1a1a1f]/50"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Forward className="w-4 h-4 text-gray-500" />
                                <span className="text-white font-medium">
                                  {alias.address}
                                </span>
                                {alias.is_catch_all === 1 && (
                                  <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">
                                    Catch-all
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-gray-300">
                              <span className="font-mono text-sm">{alias.goto}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  alias.active === "1" || alias.active === 1
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-red-500/20 text-red-400"
                                }`}
                              >
                                {alias.active === "1" || alias.active === 1
                                  ? "Active"
                                  : "Inactive"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteAlias(alias.id)}
                                disabled={deletingAlias === alias.id}
                              >
                                {deletingAlias === alias.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        {/* Email Detail Modal */}
        <AnimatePresence>
          {selectedEmail && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedEmail(null)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="bg-[#111116] rounded-lg border border-[#333] max-w-2xl w-full max-h-[80vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-[#333]">
                  <h3 className="font-medium text-white truncate">
                    {selectedEmail.subject || "(No subject)"}
                  </h3>
                  <button
                    onClick={() => setSelectedEmail(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-4 border-b border-[#333]">
                  <p className="text-sm">
                    <span className="text-gray-500">From:</span>{" "}
                    <span className="text-gray-300">{selectedEmail.from}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-500">To:</span>{" "}
                    <span className="text-gray-300">{selectedEmail.to}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-500">Date:</span>{" "}
                    <span className="text-gray-300">
                      {selectedEmail.date
                        ? new Date(selectedEmail.date).toLocaleString()
                        : ""}
                    </span>
                  </p>
                </div>
                <div className="p-4 overflow-auto max-h-96">
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">
                    {selectedEmail.text || "No content"}
                  </pre>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compose Email Modal */}
        <AnimatePresence>
          {showCompose && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
              onClick={() => setShowCompose(false)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="bg-[#111116] rounded-lg border border-[#333] max-w-2xl w-full max-h-[80vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-[#333]">
                  <div className="flex items-center gap-2">
                    <PenSquare className="h-5 w-5 text-brand" />
                    <h3 className="font-medium text-white">Compose Email</h3>
                  </div>
                  <button
                    onClick={() => setShowCompose(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <Label className="block text-xs text-gray-400 mb-1">From</Label>
                    <Input
                      value={myMailboxConfig?.email || ""}
                      disabled
                      className="bg-[#1a1a1f] border-[#333] text-gray-400"
                    />
                  </div>
                  <div>
                    <Label className="block text-xs text-gray-400 mb-1">To</Label>
                    <Input
                      value={composeTo}
                      onChange={(e) => setComposeTo(e.target.value)}
                      placeholder="recipient@example.com"
                      className="bg-[#1a1a1f] border-[#333] text-white"
                    />
                  </div>
                  <div>
                    <Label className="block text-xs text-gray-400 mb-1">Subject</Label>
                    <Input
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      placeholder="Email subject"
                      className="bg-[#1a1a1f] border-[#333] text-white"
                    />
                  </div>
                  <div>
                    <Label className="block text-xs text-gray-400 mb-1">Message</Label>
                    <textarea
                      value={composeBody}
                      onChange={(e) => setComposeBody(e.target.value)}
                      placeholder="Write your message here..."
                      rows={8}
                      className="w-full px-3 py-2 bg-[#1a1a1f] border border-[#333] rounded-md text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      onClick={() => setShowCompose(false)}
                      variant="outline"
                      className="border-[#333] text-gray-300"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={sendEmail}
                      disabled={sendingEmail || !composeTo || !composeSubject || !composeBody}
                      className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] text-brand-foreground"
                    >
                      {sendingEmail ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Send
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

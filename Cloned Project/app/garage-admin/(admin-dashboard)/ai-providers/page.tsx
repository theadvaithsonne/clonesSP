"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, ExternalLink, Info, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";

interface AIProvider {
  id: string;
  name: string;
  description: string;
  logo: React.ReactNode;
  instructions: string[];
  keyPlaceholder: string;
  docsUrl: string;
  isDefault?: boolean;
}

interface SavedApiKey {
  providerId: string;
  maskedKey: string;
  createdAt: string;
}

const AI_PROVIDERS: AIProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "Configure credentials for OpenAI AI provider.",
    logo: (
      <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center overflow-hidden">
        <img src="/openai-chatgpt-logo-icon-free-png.webp" alt="OpenAI" className="w-8 h-8 object-contain" />
      </div>
    ),
    instructions: [
      "Visit the following website:",
      "https://platform.openai.com/api-keys",
      "Once on the website, locate and click on the option to obtain your OpenAI API Key.",
    ],
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Configure credentials for Anthropic AI provider.",
    logo: (
      <div className="w-10 h-10 bg-[#d4a574] rounded-lg flex items-center justify-center overflow-hidden">
        <img src="/claude.png" alt="Anthropic Claude" className="w-8 h-8 object-contain" />
      </div>
    ),
    instructions: [
      "Visit the following website:",
      "https://console.anthropic.com/settings/keys",
      "Once on the website, locate and click on the option to obtain your Claude API Key.",
    ],
    keyPlaceholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "replicate",
    name: "Replicate",
    description: "Configure credentials for Replicate AI provider.",
    logo: (
      <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-lg">R</span>
      </div>
    ),
    instructions: [
      "Visit the following website:",
      "https://replicate.com/account/api-tokens",
      "Once on the website, locate and click on the option to obtain your Replicate API Token.",
    ],
    keyPlaceholder: "r8_...",
    docsUrl: "https://replicate.com/account/api-tokens",
  },
  {
    id: "google-gemini",
    name: "Google Gemini",
    description: "Configure credentials for Google Gemini AI provider.",
    logo: (
      <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
        <img src="/rectangle-gemini-google-icon-symbol-logo-free-png.webp" alt="Google Gemini" className="w-8 h-8 object-contain" />
      </div>
    ),
    instructions: [
      "Visit the following website:",
      "https://aistudio.google.com/app/apikey",
      "Once on the website, locate and click on the option to obtain your Google Gemini API Key.",
    ],
    keyPlaceholder: "AIza...",
    docsUrl: "https://aistudio.google.com/app/apikey",
    isDefault: true,
  },
  {
    id: "garage-copilot",
    name: "Garage Copilot",
    description: "Configure Garage Copilot for AI-assisted workflow automation.",
    logo: (
      <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-lg">G</span>
      </div>
    ),
    instructions: [
      "This is the Garage Copilot integration for AI-assisted automation.",
      "Enter your Garage Copilot API key to enable AI features.",
    ],
    keyPlaceholder: "gc-...",
    docsUrl: "",
  },
];

export default function AIProvidersPage() {
  // Provider keys are third-party credentials. A role holding
  // "ai_providers: view" reads which providers are configured; saving a key
  // (enable/edit → POST /keys) and deleting one are now separate grants.
  const { canDoAction } = useAdminAccess();
  const canAddKey = canDoAction("ai_providers", "add-key");
  const canDeleteKey = canDoAction("ai_providers", "delete-key");
  const [savedKeys, setSavedKeys] = useState<SavedApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteProvider, setDeleteProvider] = useState<AIProvider | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchSavedKeys();
  }, []);

  const fetchSavedKeys = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("garage_admin_token");
      const adminInfo = localStorage.getItem("garage_admin_info");

      if (!token || !adminInfo) {
        toast.error("Authentication required");
        return;
      }

      const parsedAdmin = JSON.parse(adminInfo);
      // Fetch saved API keys for this organization
      const response = await api<{ keys: SavedApiKey[] }>(
        `/ai-providers/keys?orgId=${parsedAdmin.organizationId || ""}`,
        { method: "GET" },
        token
      );
      setSavedKeys(response.keys || []);
    } catch (error) {
      console.error("Failed to fetch API keys:", error);
      // If endpoint doesn't exist yet, just set empty array
      setSavedKeys([]);
    } finally {
      setLoading(false);
    }
  };

  const isProviderConfigured = (providerId: string) => {
    return savedKeys.some((key) => key.providerId === providerId);
  };

  const getProviderKey = (providerId: string) => {
    return savedKeys.find((key) => key.providerId === providerId);
  };

  const handleOpenModal = (provider: AIProvider, editing: boolean = false) => {
    setSelectedProvider(provider);
    setIsEditing(editing);
    setApiKey("");
    setShowApiKey(false);
  };

  const handleCloseModal = () => {
    setSelectedProvider(null);
    setApiKey("");
    setShowApiKey(false);
    setIsEditing(false);
  };

  const handleSaveKey = async () => {
    if (!selectedProvider || !apiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem("garage_admin_token");
      const adminInfo = localStorage.getItem("garage_admin_info");

      if (!token || !adminInfo) {
        toast.error("Authentication required");
        return;
      }

      const parsedAdmin = JSON.parse(adminInfo);

      await api(
        `/ai-providers/keys`,
        {
          method: "POST",
          body: JSON.stringify({
            providerId: selectedProvider.id,
            apiKey: apiKey.trim(),
            orgId: parsedAdmin.organizationId || "",
          }),
        },
        token
      );

      toast.success(`${selectedProvider.name} API key saved successfully`);
      handleCloseModal();
      fetchSavedKeys();
    } catch (error) {
      console.error("Failed to save API key:", error);
      toast.error("Failed to save API key. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!deleteProvider) return;

    try {
      setDeleting(true);
      const token = localStorage.getItem("garage_admin_token");
      const adminInfo = localStorage.getItem("garage_admin_info");

      if (!token || !adminInfo) {
        toast.error("Authentication required");
        return;
      }

      const parsedAdmin = JSON.parse(adminInfo);

      await api(
        `/ai-providers/keys/${deleteProvider.id}?orgId=${parsedAdmin.organizationId || ""}`,
        { method: "DELETE" },
        token
      );

      toast.success(`${deleteProvider.name} API key deleted`);
      setDeleteProvider(null);
      fetchSavedKeys();
    } catch (error) {
      console.error("Failed to delete API key:", error);
      toast.error("Failed to delete API key. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return "****";
    return key.substring(0, 4) + "*".repeat(key.length - 8) + key.slice(-4);
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      {/* Header */}
      <div>
        <p className="text-xs sm:text-sm text-gray-400">
          Set provider credentials that will be used by universal AI pieces, i.e. Text AI.
        </p>
      </div>

      {/* Provider List */}
      <div className="space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          AI_PROVIDERS.map((provider) => {
            const isConfigured = isProviderConfigured(provider.id);
            const savedKey = getProviderKey(provider.id);

            return (
              <div
                key={provider.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between py-3 sm:py-4 px-3 sm:px-4 hover:bg-[#15151b] rounded-lg transition-colors gap-3 sm:gap-0"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  {provider.logo}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs sm:text-sm font-medium text-white">
                        {provider.name}
                      </h3>
                      {provider.isDefault && (
                        <span className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-400 truncate">{provider.description}</p>
                    {isConfigured && savedKey && (
                      <p className="text-[10px] sm:text-xs text-green-400 mt-1 truncate">
                        Configured: {savedKey.maskedKey}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {isConfigured ? (
                    <>
                      {canAddKey && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-white hover:bg-[#1a1a22]"
                          onClick={() => handleOpenModal(provider, true)}
                          title="Edit API Key"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDeleteKey && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-[#1a1a22]"
                          onClick={() => setDeleteProvider(provider)}
                          title="Delete API Key"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  ) : (
                    canAddKey && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-4 text-xs bg-transparent border-[#3b3b4a] hover:bg-[#1a1a22] hover:border-[#4a4a5a]"
                        onClick={() => handleOpenModal(provider)}
                      >
                        Enable
                      </Button>
                    )
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Note about default */}
      <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-[#1a1a22] rounded-lg border border-[#2a2a35]">
        <div className="flex items-start gap-2 sm:gap-3">
          <Info className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-xs sm:text-sm text-gray-300">
            <p>
              If no specific key is submitted, the system will automatically default to the{" "}
              <span className="text-blue-400 font-medium">Google Gemini</span> API key.
            </p>
            <p className="mt-1.5 sm:mt-2 text-gray-400">
              Once keys are submitted, all AI-related functions will use the keys tied to your organization.
            </p>
          </div>
        </div>
      </div>

      {/* Enable/Edit API Key Modal */}
      <Dialog open={selectedProvider !== null} onOpenChange={handleCloseModal}>
        <DialogContent className="bg-[#1a1a22] border-[#2a2a35] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {isEditing ? "Edit" : "Enable"} AI Provider ({selectedProvider?.name})
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Instructions */}
            <div className="flex items-start gap-3 p-3 bg-[#15151b] rounded-lg">
              <Info className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
              <div className="text-sm text-gray-300 space-y-2">
                <p>Follow these instructions to get your {selectedProvider?.name} API Key:</p>
                <ol className="list-decimal list-inside space-y-1 text-gray-400">
                  {selectedProvider?.instructions.map((instruction, index) => (
                    <li key={index}>
                      {instruction.startsWith("http") ? (
                        <a
                          href={instruction}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          {instruction}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        instruction
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* API Key Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">API Key</label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  placeholder={selectedProvider?.keyPlaceholder}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="bg-[#15151b] border-[#2a2a35] text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={handleCloseModal}
              className="text-gray-400 hover:text-white hover:bg-[#15151b]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveKey}
              disabled={saving || !apiKey.trim()}
              className="bg-primary text-black hover:bg-primary/90"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteProvider !== null} onOpenChange={() => setDeleteProvider(null)}>
        <AlertDialogContent className="bg-[#1a1a22] border-[#2a2a35] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete the {deleteProvider?.name} API key? This action
              cannot be undone and AI features using this provider will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[#2a2a35] text-gray-400 hover:bg-[#15151b] hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteKey}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
